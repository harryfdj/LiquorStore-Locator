import { Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function sendError(res: Response, error: unknown, fallback = 'Unexpected server error') {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  console.error(error);
  return res.status(500).json({ error: fallback });
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function requireStoreId(req: Express.Request) {
  if (!req.user || req.user.role !== 'store' || !req.user.storeId) {
    throw new HttpError(403, 'Store access required');
  }
  return req.user.storeId;
}
