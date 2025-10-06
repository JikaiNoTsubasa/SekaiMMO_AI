import type { Request, Response } from 'express';
import { z } from 'zod';

import { HttpError } from '../middleware/errorHandler';
import { authService } from '../services/authService';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const register = async (req: Request, res: Response) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.register(email, password);
  res.status(201).json(result);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
};

export const profile = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError('Authentication required', 401);
  }

  const result = await authService.profile(req.user.userId);
  res.json(result);
};
