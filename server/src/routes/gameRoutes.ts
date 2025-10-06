import { Router } from 'express';

import { getGameState } from '../controllers/gameController';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/authMiddleware';

export const gameRouter = Router();

gameRouter.use(authenticate);
gameRouter.get('/state', asyncHandler(getGameState));
