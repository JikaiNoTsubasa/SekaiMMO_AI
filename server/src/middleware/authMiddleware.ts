import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from './errorHandler';

interface TokenPayload {
  userId: number;
  email: string;
  characterId?: number;
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError('Authentication required', 401);
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, appConfig.jwtSecret) as TokenPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { character: true }
    });

    if (!user) {
      throw new HttpError('Invalid credentials', 401);
    }

    req.user = {
      userId: user.id,
      email: user.email,
      characterId: user.character?.id
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError('Authentication failed', 401);
  }
};
