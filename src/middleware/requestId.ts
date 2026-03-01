import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();

  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
