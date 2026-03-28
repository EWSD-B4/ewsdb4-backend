import { Request, Response, NextFunction } from 'express';
import { db } from '@/shared/database';
import logger from '@/shared/logger';

export const activityLogger = async (req: Request, _res: Response, next: NextFunction) => {
  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/api/v1/analytics'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }

  // Only log GET requests (page views)
  if (req.method === 'GET') {
    try {
      const userId = (req as any).user?.id || null;
      const sessionId = (req.headers['x-session-id'] as string) || null;
      const page = req.path;
      const userAgent = req.headers['user-agent'] || null;
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;

      // Log activity asynchronously (don't block the request)
      setImmediate(async () => {
        try {
          await db.$executeRaw`
            INSERT INTO user_activities (user_id, session_id, page, action, user_agent, ip_address, created_at)
            VALUES (${userId}, ${sessionId}, ${page}, 'view', ${userAgent}, ${ipAddress}, NOW())
          `;
        } catch (error) {
          logger.error('Failed to log user activity:', error);
        }
      });
    } catch (error) {
      logger.error('Error in activity logger middleware:', error);
    }
  }

  next();
};
