import amqplib from 'amqplib';
import config from '@/config';
import logger from '@/shared/logger';
import {Try} from '@/shared/utils/Try';
import {InternalServerError} from "@/shared/errors/AppError";

export interface DocumentMessage {
  documentId: string;
  userId: string;
  fileName: string;
  s3Key: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

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

      await this.channel.assertExchange(config.rabbitmq.exchangeName, 'topic', {
        durable: true,
      });

      await this.channel.assertQueue(config.rabbitmq.queueName, {
        durable: true,
      });

      await this.channel.bindQueue(
        config.rabbitmq.queueName,
        config.rabbitmq.exchangeName,
        config.rabbitmq.routingKey
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
    }).orElseThrow('Failed to connect to RabbitMQ', new InternalServerError('Failed to connect to RabbitMQ'));
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

      logger.info(`Message published to RabbitMQ: ${message.documentId}`);
    }).orElseThrow('Error publishing message to RabbitMQ', new InternalServerError('Failed to publish message to RabbitMQ'));
  }

  async consumeMessages(
    callback: (message: DocumentMessage) => Promise<void>
  ): Promise<void> {
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
        async (msg: amqplib.ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          try {
            const message: DocumentMessage = JSON.parse(msg.content.toString());
            logger.info(`Processing message: ${message.documentId}`);

            await callback(message);

            channel.ack(msg);
            logger.info(`Message acknowledged: ${message.documentId}`);
          } catch (error) {
            logger.error('Error processing message:', error);
            channel.nack(msg, false, false);
          }
        },
        {
          noAck: false,
        }
      );

      logger.info('Started consuming messages from RabbitMQ');
    }).orElseThrow('Error consuming messages from RabbitMQ', new InternalServerError('Failed to consume messages from RabbitMQ'));
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
