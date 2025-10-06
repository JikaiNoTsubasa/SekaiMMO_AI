import { Router } from 'express';

import {
  assignSkill,
  createCharacter,
  getCharacter,
  getInventory,
  listSkills,
  unlockSkill
} from '../controllers/characterController';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/authMiddleware';

export const characterRouter = Router();

characterRouter.use(authenticate);
characterRouter.post('/', asyncHandler(createCharacter));
characterRouter.get('/me', asyncHandler(getCharacter));
characterRouter.get('/inventory', asyncHandler(getInventory));
characterRouter.get('/skills', asyncHandler(listSkills));
characterRouter.post('/skills/assign', asyncHandler(assignSkill));
characterRouter.post('/skills/unlock', asyncHandler(unlockSkill));
