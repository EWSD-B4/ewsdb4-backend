import { PrismaClient, Prisma } from '@prisma/client';
import logger from '@/shared/logger';

const prismaClientSingleton = () => {
  // Build database URL from environment variables with connection pool settings
  const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '10');
  const baseUrl = process.env.DATABASE_URL || 
    `mysql://${process.env.DB_USER || 'root'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}/${process.env.DB_NAME || 'ewsd_db'}`;
  
  // Add connection pool parameters to URL
  const url = new URL(baseUrl);
  url.searchParams.set('connection_limit', connectionLimit.toString());
  url.searchParams.set('pool_timeout', '10');
  url.searchParams.set('connect_timeout', '10');
  
  const databaseUrl = url.toString();
  logger.info(`Connecting to database at ${url.hostname}:${url.port || 3306}`);
  
  return new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    transactionOptions: {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

prisma.$on('query', (e) => {
  logger.debug(`Query: ${e.query}`);
  logger.debug(`Duration: ${e.duration}ms`);
});

prisma.$on('error', (e) => {
  logger.error(`Prisma Error: ${e.message}`);
});

prisma.$on('info', (e) => {
  logger.info(`Prisma Info: ${e.message}`);
});

prisma.$on('warn', (e) => {
  logger.warn(`Prisma Warning: ${e.message}`);
});

class PrismaDatabase {
  private static instance: PrismaDatabase;

  private constructor() {}

  public static getInstance(): PrismaDatabase {
    if (!PrismaDatabase.instance) {
      PrismaDatabase.instance = new PrismaDatabase();
    }
    return PrismaDatabase.instance;
  }

  public async connect(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info('Prisma database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      logger.info('Prisma database disconnected');
    } catch (error) {
      logger.error('Failed to disconnect from database:', error);
      throw error;
    }
  }

  public getClient(): PrismaClient {
    return prisma;
  }
}

export const db = prisma;
export default PrismaDatabase.getInstance();
