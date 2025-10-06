import type { Request, Response } from 'express';
import { z } from 'zod';

import { HttpError } from '../middleware/errorHandler';
import { characterService } from '../services/characterService';
import { inventoryService } from '../services/inventoryService';

const nameSchema = z.object({
  name: z.string().min(3).max(24)
});

const assignSchema = z.object({
  skillId: z.number().int().positive(),
  slot: z.string().length(1)
});

const unlockSchema = z.object({
  skillId: z.number().int().positive()
});

export const createCharacter = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError('Authentication required', 401);
  }

  const { name } = nameSchema.parse(req.body);
  const character = await characterService.createCharacter(req.user.userId, name);
  res.status(201).json(character);
};

export const getCharacter = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const character = await characterService.getCharacterById(req.user.characterId);
  res.json(character);
};

export const getInventory = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const inventory = await inventoryService.getInventory(req.user.characterId);
  res.json(inventory);
};

export const assignSkill = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const { skillId, slot } = assignSchema.parse(req.body);
  const character = await characterService.assignSkillToSlot(req.user.characterId, skillId, slot.toUpperCase());
  res.json(character);
};

export const unlockSkill = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const { skillId } = unlockSchema.parse(req.body);
  const skill = await characterService.unlockSkill(req.user.characterId, skillId);
  res.json(skill);
};

export const listSkills = async (req: Request, res: Response) => {
  if (!req.user?.characterId) {
    throw new HttpError('Character not found', 404);
  }

  const skills = await characterService.listSkills(req.user.characterId);
  res.json(skills);
};
