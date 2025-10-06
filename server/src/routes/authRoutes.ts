import { Router } from 'express';

import { login, profile, register } from '../controllers/authController';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/authMiddleware';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(register));
authRouter.post('/login', asyncHandler(login));
authRouter.get('/me', authenticate, asyncHandler(profile));
