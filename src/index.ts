import app from './app';
import config from '@/config';
import database from '@/shared/database/mysql';
import cache from '@/shared/cache/redis';
import logger from '@/shared/logger';
import prisma from '@/shared/database/prisma';

const startServer = async () => {
  try {
    await database.connect();
    await cache.connect();
    await prisma.$connect();

    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`API available at http://localhost:${config.port}${config.apiPrefix}`);
    });

    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(() => {
        void (async () => {
          logger.info('HTTP server closed');

          try {
            await database.disconnect();
            await cache.disconnect();
            await prisma.$disconnect();
            logger.info('All connections closed. Exiting process.');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
          }
        })();
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection:', reason);
      throw reason;
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer()
  .then((r) => console.log(r))
  .catch((e) => console.log(e));
