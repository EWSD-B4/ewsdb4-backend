import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import logger from '@/shared/logger';

const prismaClientSingleton = () => {
  // Build database URL from environment variables
  const databaseUrl = process.env.DATABASE_URL || 
    `mysql://${process.env.DB_USER || 'root'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}/${process.env.DB_NAME || 'ewsd_db'}`;
  
  // Parse the database URL to extract connection details
  const url = new URL(databaseUrl);
  
  // Create Prisma adapter with pool configuration
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    acquireTimeout: 10000,
    connectTimeout: 5000,
    idleTimeout: 30000,
    keepAliveDelay: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  });
  
  return new PrismaClient({
    adapter,
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
