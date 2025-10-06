import type { Request, Response } from 'express';

import { HttpError } from '../middleware/errorHandler';
import { gameStateService } from '../services/gameStateService';

export const getGameState = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const state = await gameStateService.getState(req.user.characterId);
  res.json(state);
};
