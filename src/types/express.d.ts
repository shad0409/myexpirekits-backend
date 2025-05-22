import 'express';

declare global {
  namespace Express {
    // This extends the existing Request interface
    interface Request {
      user?: {
        id: string;
        role?: string;
      };
    }
  }
}