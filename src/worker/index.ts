import documentProcessor from './document-processor';
import logger from '@/shared/logger';
import config from '@/config';
import {Try} from '@/shared/utils/Try';

async function startWorker(): Promise<void> {
  await Try.execute(async () => {
    logger.info('Starting worker service...');
    logger.info(`Environment: ${config.env}`);

    await documentProcessor.start();

    logger.info('Worker service started successfully');
  }).onFailure(() => {
    process.exit(1);
  }).orElseLogWarning('Failed to start worker service');
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing worker gracefully');
  await documentProcessor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing worker gracefully');
  await documentProcessor.stop();
  process.exit(0);
});

startWorker()
    .then(r => logger.info('Worker started successfully', r))
    .catch(e => logger.error('Failed to start worker service:', e));
