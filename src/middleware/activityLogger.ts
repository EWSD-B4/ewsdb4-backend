import { Request, Response, NextFunction } from 'express';
import { db } from '@/shared/database';
import logger from '@/shared/logger';

interface PathPattern {
  pattern: RegExp;
  name: string;
}

const pathPatterns: PathPattern[] = [
  { pattern: /^\/api\/v1\/auth\/me$/, name: 'Profile' },
  { pattern: /^\/api\/v1\/users$/, name: 'Users Management' },
  { pattern: /^\/api\/v1\/users\/\d+$/, name: 'Users Management' },
  { pattern: /^\/api\/v1\/documents$/, name: 'Documents' },
  { pattern: /^\/api\/v1\/documents\/\d+/, name: 'Documents' },
  { pattern: /^\/api\/v1\/admin$/, name: 'Admin Panel' },
  { pattern: /^\/api\/v1\/admin\//, name: 'Admin Panel' },
  { pattern: /^\/api\/v1\/coordinator\/contributions$/, name: 'Coordinator - Contributions' },
  { pattern: /^\/api\/v1\/coordinator\/contributions\/\d+/, name: 'Coordinator - Contributions' },
  { pattern: /^\/api\/v1\/manager\/contributions$/, name: 'Manager - Contributions' },
  { pattern: /^\/api\/v1\/manager\/contributions\/\d+/, name: 'Manager - Contributions' },
  { pattern: /^\/api\/v1\/student\/contributions$/, name: 'Student - My Contributions' },
  { pattern: /^\/api\/v1\/student\/contributions\/\d+/, name: 'Student - My Contributions' },
  { pattern: /^\/api\/v1\/guest/, name: 'Guest View' },
  { pattern: /^\/api\/v1\/reports$/, name: 'Reports' },
  { pattern: /^\/api\/v1\/reports\//, name: 'Reports' },
  { pattern: /^\/api\/v1\/academic-years$/, name: 'Academic Years' },
  { pattern: /^\/api\/v1\/academic-years\/\d+/, name: 'Academic Years' },
  { pattern: /^\/api\/v1\/terms$/, name: 'Terms & Conditions' },
  { pattern: /^\/api\/v1\/terms\/\d+/, name: 'Terms & Conditions' },
  { pattern: /^\/api\/v1\/comments$/, name: 'Comments' },
  { pattern: /^\/api\/v1\/comments\/\d+/, name: 'Comments' },
  { pattern: /^\/api\/v1\/notifications$/, name: 'Notifications' },
  { pattern: /^\/api\/v1\/notifications\/\d+/, name: 'Notifications' },
  { pattern: /^\/api\/v1\/history$/, name: 'Activity History' },
  { pattern: /^\/api\/v1\/history\//, name: 'Activity History' },
  { pattern: /^\/api\/v1\/faculties$/, name: 'Faculties' },
  { pattern: /^\/api\/v1\/faculties\/\d+/, name: 'Faculties' },
  { pattern: /^\/api\/v1\/analytics\/dashboard$/, name: 'Analytics Dashboard' },
  { pattern: /^\/api\/v1\/analytics\/most-viewed-pages$/, name: 'Analytics - Most Viewed Pages' },
  { pattern: /^\/api\/v1\/analytics\/most-active-users$/, name: 'Analytics - Most Active Users' },
  { pattern: /^\/api\/v1\/analytics\/browser-usage$/, name: 'Analytics - Browser Usage' },
  { pattern: /^\/api\/v1\/analytics\/faculty-distribution$/, name: 'Analytics - Faculty Distribution' },
  { pattern: /^\/api\/v1\/analytics\/system-stats$/, name: 'Analytics - System Statistics' },
  { pattern: /^\/api\/v1\/plagiarism/, name: 'Plagiarism Detection' },
];

function getPageName(path: string): string | null {
  // Try to match against defined patterns
  for (const { pattern, name } of pathPatterns) {
    if (pattern.test(path)) {
      return name;
    }
  }

  // Return null if no pattern matches (won't log this activity)
  return null;
}

export const activityLogger = async (req: Request, _res: Response, next: NextFunction) => {
  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/api/v1/analytics'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }

  // Only log GET requests (page views)
  if (req.method === 'GET') {
    try {
      const pageName = getPageName(req.path);
      
      // Only log if path matches a defined pattern
      if (pageName) {
        const userId = (req as any).user?.id || null;
        const sessionId = (req.headers['x-session-id'] as string) || null;
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;

        // Log activity asynchronously (don't block the request)
        setImmediate(async () => {
          try {
            await db.$executeRaw`
              INSERT INTO user_activities (user_id, session_id, page, action, user_agent, ip_address, created_at)
              VALUES (${userId}, ${sessionId}, ${pageName}, 'view', ${userAgent}, ${ipAddress}, NOW())
            `;
          } catch (error) {
            logger.error('Failed to log user activity:', error);
          }
        });
      }
    } catch (error) {
      logger.error('Error in activity logger middleware:', error);
    }
  }

  next();
};
