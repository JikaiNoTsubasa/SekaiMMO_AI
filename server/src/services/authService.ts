import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const SALT_ROUNDS = 10;

const buildToken = (userId: number, email: string, characterId?: number) =>
  jwt.sign({ userId, email, characterId }, appConfig.jwtSecret, {
    expiresIn: '12h'
  });

export const authService = {
  async register(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      },
      include: {
        character: true
      }
    });

    const token = buildToken(user.id, user.email, user.character?.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        characterId: user.character?.id ?? null
      }
    };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        character: true
      }
    });

    if (!user) {
      throw new HttpError('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      throw new HttpError('Invalid credentials', 401);
    }

    const token = buildToken(user.id, user.email, user.character?.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        characterId: user.character?.id ?? null
      }
    };
  },

  async profile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        character: true
      }
    });

    if (!user) {
      throw new HttpError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      characterId: user.character?.id ?? null
    };
  }
};
