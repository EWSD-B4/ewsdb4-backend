import documentProcessorTipTap from './document-processor-tiptap';
import logger from '@/shared/logger';
import config from '@/config';
import { Try } from '@/shared/utils/Try';
import { database } from '@/shared/database';
import cache from '@/shared/cache/redis';
import mongodbConnection from '@/shared/database/mongodb';

async function startWorker(): Promise<void> {
  await Try.execute(async () => {
    logger.info('Starting worker service with TipTap processor...');
    logger.info(`Environment: ${config.env}`);

    await database.connect();
    await cache.connect();
    await mongodbConnection.connect();

    await documentProcessorTipTap.start();

    logger.info('Worker service started successfully with TipTap + MongoDB');
  })
    .onFailure(() => {
      process.exit(1);
    })
    .orElseLogWarning('Failed to start worker service');
}

process.on('SIGTERM', () => {
  void (async () => {
    logger.info('SIGTERM signal received: closing worker gracefully');
    await documentProcessorTipTap.stop();
    await mongodbConnection.disconnect();
    await database.disconnect();
    await cache.disconnect();
    process.exit(0);
  })();
});

process.on('SIGINT', () => {
  void (async () => {
    logger.info('SIGINT signal received: closing worker gracefully');
    await documentProcessorTipTap.stop();
    await mongodbConnection.disconnect();
    await database.disconnect();
    await cache.disconnect();
    process.exit(0);
  })();
});

startWorker()
  .then((r) => logger.info('Worker started successfully', r))
  .catch((e) => logger.error('Failed to start worker service:', e));
