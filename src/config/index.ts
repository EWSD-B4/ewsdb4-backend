import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  env: string;
  port: number;
  apiPrefix: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    connectionLimit: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    s3BucketName: string;
    s3DocumentPrefix: string;
  };
  rabbitmq: {
    url: string;
    queueName: string;
    exchangeName: string;
    routingKey: string;
    dlxExchangeName: string;
    dlqName: string;
    dlqRoutingKey: string;
    maxRetries: number;
    retryDelayMs: number;
  };
  logging: {
    level: string;
  };
  cors: {
    origin: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'test_db',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME || '',
    s3DocumentPrefix: process.env.S3_DOCUMENT_PREFIX || 'documents/',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queueName: process.env.RABBITMQ_QUEUE_NAME || 'document-processing',
    exchangeName: process.env.RABBITMQ_EXCHANGE_NAME || 'documents',
    routingKey: process.env.RABBITMQ_ROUTING_KEY || 'document.upload',
    dlxExchangeName: process.env.RABBITMQ_DLX_EXCHANGE_NAME || 'documents-dlx',
    dlqName: process.env.RABBITMQ_DLQ_NAME || 'document-processing-dlq',
    dlqRoutingKey: process.env.RABBITMQ_DLQ_ROUTING_KEY || 'document.failed',
    maxRetries: parseInt(process.env.RABBITMQ_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RABBITMQ_RETRY_DELAY_MS || '60000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

export default config;
