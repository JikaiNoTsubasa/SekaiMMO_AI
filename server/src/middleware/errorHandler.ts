import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};
