// Respawn Service - Point de réapparition après la mort
// Un seul point par personnage (map + coordonnées), par défaut le spawn de base

import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';
import { mapFileService } from './mapFileService';

const BASE_RESPAWN_MAP_CODE = 'starting_village';

export interface RespawnPoint {
  mapId: number;
  mapCode: string;
  x: number;
  y: number;
}

export const respawnService = {
  /**
   * Point de réapparition du personnage : celui enregistré, sinon le spawn de base
   */
  async getRespawnPoint(characterId: number): Promise<RespawnPoint> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: {
        respawnX: true,
        respawnY: true,
        respawnMap: { select: { id: true, code: true } },
      },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    if (character.respawnMap && character.respawnX !== null && character.respawnY !== null) {
      return {
        mapId: character.respawnMap.id,
        mapCode: character.respawnMap.code,
        x: character.respawnX,
        y: character.respawnY,
      };
    }

    const baseMap = await prisma.gameMap.findUnique({ where: { code: BASE_RESPAWN_MAP_CODE } });

    if (!baseMap) {
      throw new HttpError('Base respawn map not found', 500);
    }

    const position =
      (await mapFileService.getArrivalPosition(baseMap.code, null, null)) ??
      { x: baseMap.width / 2, y: baseMap.height / 2 };

    return { mapId: baseMap.id, mapCode: baseMap.code, ...position };
  },

  /**
   * Enregistre le point de réapparition (fontaine ou équivalent)
   */
  async setRespawnPoint(characterId: number, mapId: number, x: number, y: number): Promise<void> {
    await prisma.character.update({
      where: { id: characterId },
      data: { respawnMapId: mapId, respawnX: x, respawnY: y },
    });
  },

  /**
   * Ramène le personnage à son point de réapparition, vie et mana restaurées
   */
  async respawnCharacter(characterId: number) {
    const point = await this.getRespawnPoint(characterId);

    const stats = await prisma.character.findUnique({
      where: { id: characterId },
      select: { maxHealth: true, maxMana: true },
    });

    if (!stats) {
      throw new HttpError('Character not found', 404);
    }

    await prisma.character.update({
      where: { id: characterId },
      data: {
        currentMapId: point.mapId,
        positionX: point.x,
        positionY: point.y,
        health: stats.maxHealth,
        mana: stats.maxMana,
      },
    });

    return { point, health: stats.maxHealth, maxHealth: stats.maxHealth, mana: stats.maxMana, maxMana: stats.maxMana };
  },
};
