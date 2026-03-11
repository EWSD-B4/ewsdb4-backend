import amqplib from 'amqplib';
import config from '@/config';
import logger from '@/shared/logger';
import { Try } from '@/shared/utils/Try';
import { InternalServerError } from '@/shared/errors/AppError';
import documentService from '@/modules/document/document.service';
import { DocumentStatus } from '@/modules/document/document.types';

export interface DocumentMessage {
  contributionFileId: number;
  contributionId: number;
  userId: number;
  fileName: string;
  s3Key: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  retryCount?: number;
  lastError?: string;
}

const isDocumentMessage = (value: unknown): value is DocumentMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return (
    typeof data.contributionFileId === 'number' &&
    typeof data.contributionId === 'number' &&
    typeof data.userId === 'number' &&
    typeof data.fileName === 'string' &&
    typeof data.s3Key === 'string' &&
    typeof data.contentType === 'string' &&
    typeof data.fileSize === 'number' &&
    typeof data.uploadedAt === 'string'
  );
};

class RabbitMQService {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    return Try.execute(async () => {
      if (this.isConnected && this.connection && this.channel) {
        logger.info('RabbitMQ already connected');
        return;
      }

      this.connection = await amqplib.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel');
      }

      // Main exchange
      await this.channel.assertExchange(config.rabbitmq.exchangeName, 'topic', {
        durable: true,
      });

      // Dead Letter Exchange (DLX)
      await this.channel.assertExchange(config.rabbitmq.dlxExchangeName, 'topic', {
        durable: true,
      });

      // Main queue with DLX configuration
      await this.channel.assertQueue(config.rabbitmq.queueName, {
        durable: true,
        deadLetterExchange: config.rabbitmq.dlxExchangeName,
        deadLetterRoutingKey: config.rabbitmq.dlqRoutingKey,
      });

      // Dead Letter Queue (DLQ) with TTL for retry
      await this.channel.assertQueue(config.rabbitmq.dlqName, {
        durable: true,
        messageTtl: config.rabbitmq.retryDelayMs,
        deadLetterExchange: config.rabbitmq.exchangeName,
        deadLetterRoutingKey: config.rabbitmq.routingKey,
      });

      // Bind main queue to main exchange
      await this.channel.bindQueue(
        config.rabbitmq.queueName,
        config.rabbitmq.exchangeName,
        config.rabbitmq.routingKey
      );

      // Bind DLQ to DLX
      await this.channel.bindQueue(
        config.rabbitmq.dlqName,
        config.rabbitmq.dlxExchangeName,
        config.rabbitmq.dlqRoutingKey
      );

      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
      });

      this.isConnected = true;
      logger.info('RabbitMQ connected successfully');
    }).orElseThrow(
      'Failed to connect to RabbitMQ',
      new InternalServerError('Failed to connect to RabbitMQ')
    );
  }

  async publishMessage(message: DocumentMessage): Promise<void> {
    return Try.execute(async () => {
      if (!this.channel) {
        await this.connect();
      }

      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = this.channel.publish(
        config.rabbitmq.exchangeName,
        config.rabbitmq.routingKey,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        }
      );

      if (!published) {
        throw new Error('Failed to publish message to RabbitMQ');
      }

      logger.info(`Message published to RabbitMQ: contributionFileId=${message.contributionFileId}`);
    }).orElseThrow(
      'Error publishing message to RabbitMQ',
      new InternalServerError('Failed to publish message to RabbitMQ')
    );
  }

  async consumeMessages(callback: (message: DocumentMessage) => Promise<void>): Promise<void> {
    return Try.execute(async () => {
      if (!this.channel) {
        await this.connect();
      }

      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.channel.prefetch(1);

      const channel = this.channel;

      await channel.consume(
        config.rabbitmq.queueName,
        (msg: amqplib.ConsumeMessage | null) => {
          void (async () => {
            if (!msg) {
              return;
            }

            const parsed: unknown = JSON.parse(msg.content.toString());
            if (!isDocumentMessage(parsed)) {
              logger.error('Invalid message format received from RabbitMQ');
              channel.nack(msg, false, false);
              return;
            }
            const message = parsed;
            // Read retry count from message headers (persisted across DLQ cycles)
            const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

            await Try.execute(async () => {
              logger.info(`Processing message: contributionFileId=${message.contributionFileId} (retry: ${retryCount})`);

              await callback(message);

              channel.ack(msg);
              logger.info(`Message acknowledged: contributionFileId=${message.contributionFileId}`);
            })
              .onFailure(async (error: Error) => {
                const errorMessage = error.message || 'Unknown error';

                logger.error(`Error processing message contributionFileId=${message.contributionFileId}:`, error);

                if (retryCount >= config.rabbitmq.maxRetries) {
                  // Max retries reached - send to permanent DLQ (nack without requeue)
                  logger.error(
                    `Max retries (${config.rabbitmq.maxRetries}) reached for message: contributionFileId=${message.contributionFileId}. Moving to DLQ permanently.`
                  );

                  // Update document status to FAILED with error details
                  await documentService.updateFileStatus(
                    message.contributionFileId,
                    DocumentStatus.FAILED,
                    `Failed after ${config.rabbitmq.maxRetries} retries. Last error: ${errorMessage}`
                  );

                  channel.nack(msg, false, false);
                } else {
                  // Increment retry count and republish with updated header
                  const newRetryCount = retryCount + 1;
                  const updatedMessage: DocumentMessage = {
                    ...message,
                    retryCount: newRetryCount,
                    lastError: errorMessage,
                  };

                  logger.warn(
                    `Retry ${newRetryCount}/${config.rabbitmq.maxRetries} for message: contributionFileId=${message.contributionFileId}. Will retry after ${config.rabbitmq.retryDelayMs}ms. Last error: ${errorMessage}`
                  );

                  // Publish to DLX with incremented retry count in headers
                  channel.publish(
                    config.rabbitmq.dlxExchangeName,
                    config.rabbitmq.dlqRoutingKey,
                    Buffer.from(JSON.stringify(updatedMessage)),
                    {
                      persistent: true,
                      contentType: 'application/json',
                      timestamp: Date.now(),
                      headers: {
                        'x-retry-count': newRetryCount,
                        'x-first-death-reason':
                          msg.properties.headers?.['x-first-death-reason'] || errorMessage,
                        'x-last-error': errorMessage,
                      },
                    }
                  );

                  // Ack the original message since we've republished it
                  channel.ack(msg);
                }
              })
              .orElseLogWarning(`Failed to process message contributionFileId=${message.contributionFileId}`);
          })();
        },
        {
          noAck: false,
        }
      );

      logger.info('Started consuming messages from RabbitMQ');
    }).orElseThrow(
      'Error consuming messages from RabbitMQ',
      new InternalServerError('Failed to consume messages from RabbitMQ')
    );
  }

  async close(): Promise<void> {
    await Try.execute(async () => {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      logger.info('RabbitMQ connection closed');
    }).orElseLogWarning('Error closing RabbitMQ connection');
  }
}

export default new RabbitMQService();
