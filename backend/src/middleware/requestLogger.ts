import { Request, Response, NextFunction } from 'express';
import { trackRequest } from '../lib/trafficTracker.js';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.uuid || 'anonymous',
    };

    console.log(JSON.stringify(logData));
    
    // Log in-memory analytics for threat map dashboard
    try {
      trackRequest(req, res, duration);
    } catch (err) {
      console.error('Failed to log analytics traffic:', err);
    }
  });

  next();
};
