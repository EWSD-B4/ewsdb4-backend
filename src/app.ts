import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import config from '@/config';
import routes from '@/routes';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import logger from '@/shared/logger';
import { requestId } from '@/middleware/requestId';
import { activityLogger } from '@/middleware/activityLogger';

const app: Application = express();

app.use(requestId);
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
    })
  );
}

// Log user activity (page views)
app.use(activityLogger);

app.use(config.apiPrefix, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
