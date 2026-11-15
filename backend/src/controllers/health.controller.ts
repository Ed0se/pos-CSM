import { Request, Response, NextFunction } from 'express';
import { checkDatabaseConnection } from '../config/database.js';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dbStatus = await checkDatabaseConnection();
    const status = dbStatus.ok ? 'healthy' : 'degraded';
    const statusCode = dbStatus.ok ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: dbStatus.ok ? 'connected' : 'disconnected'
      },
      ...(dbStatus.message ? { database_error: dbStatus.message } : {})
    });
  } catch (err) {
    next(err);
  }
}
