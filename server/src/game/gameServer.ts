import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { appConfig } from '../config/env';
import { prisma } from '../config/prisma';
import { WeaponCode } from '../generated/prisma';
import { characterService } from '../services/characterService';
import { dropService } from '../services/dropService';
import { inventoryService } from '../services/inventoryService';
import { calculateWeaponExperience } from '../utils/experience';

interface SocketAuthPayload {
  userId: number;
  email: string;
  characterId: number;
}

const movementSchema = z.object({
  x: z.number(),
  y: z.number()
});

const castSchema = z.object({
  key: z.string().length(1),
  target: z.object({
    x: z.number(),
    y: z.number()
  }),
  skillId: z.number().int().positive().optional()
});

const monsterDefeatedSchema = z.object({
  monsterId: z.number().int().positive(),
  weaponCode: z.nativeEnum(WeaponCode)
});

export class GameServer {
  constructor(private readonly io: Server) {
    this.io.use(this.authenticateSocket);
    this.io.on('connection', (socket) => this.registerHandlers(socket));
  }

  private authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!token) {
        throw new Error('Authentication required');
      }

      const payload = jwt.verify(token, appConfig.jwtSecret) as SocketAuthPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { character: true }
      });

      if (!user?.character) {
        throw new Error('Character not found');
      }

      socket.data.userId = user.id;
      socket.data.characterId = user.character.id;

      await prisma.playerSession.upsert({
        where: { characterId: user.character.id },
        update: {
          socketId: socket.id,
          lastActive: new Date()
        },
        create: {
          characterId: user.character.id,
          socketId: socket.id
        }
      });

      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unauthorized connection'));
    }
  };

  private registerHandlers(socket: Socket) {
    socket.join('world');

    socket.on('player:move', async (payload) => {
      try {
        const data = movementSchema.parse(payload);
        const characterId = socket.data.characterId as number | undefined;
        if (!characterId) {
          return;
        }

        await characterService.updatePosition(characterId, data);
        socket.to('world').emit('player:moved', {
          characterId,
          position: data
        });
      } catch (error) {
        console.error('player:move handler', error);
      }
    });

    socket.on('player:castSkill', async (payload) => {
      try {
        const data = castSchema.parse(payload);
        const characterId = socket.data.characterId as number | undefined;
        if (!characterId) {
          return;
        }

        this.io.to('world').emit('player:skillCast', {
          characterId,
          ...data
        });
      } catch (error) {
        console.error('player:castSkill handler', error);
      }
    });

    socket.on('monster:defeated', async (payload) => {
      try {
        const data = monsterDefeatedSchema.parse(payload);
        const characterId = socket.data.characterId as number | undefined;
        if (!characterId) {
          return;
        }

        const monster = await prisma.monster.findUnique({ where: { id: data.monsterId } });
        if (!monster) {
          return;
        }

        const experience = calculateWeaponExperience(monster.baseExperience);
        await characterService.grantWeaponExperience(characterId, data.weaponCode, experience);

        const drops = await dropService.rollDrops(data.monsterId);
        if (drops.length) {
          await inventoryService.addItems(characterId, drops);
        }

        socket.emit('player:reward', {
          experience,
          drops
        });

        socket.to('world').emit('monster:defeated', {
          monsterId: data.monsterId,
          defeatedBy: characterId
        });
      } catch (error) {
        console.error('monster:defeated handler', error);
      }
    });

    socket.on('disconnect', async () => {
      const characterId = socket.data.characterId as number | undefined;
      if (!characterId) {
        return;
      }

      await prisma.playerSession.deleteMany({ where: { characterId } });
    });
  }
}
