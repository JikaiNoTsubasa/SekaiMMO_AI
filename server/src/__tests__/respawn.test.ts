// Tests de la mort et de la réapparition des joueurs
// SekaiMMO v2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { GameServer } from '../game/gameServer';
import { mapFileService } from '../services/mapFileService';
import { respawnService } from '../services/respawnService';

vi.mock('../config/prisma', () => ({
  prisma: {
    character: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    gameMap: { findUnique: vi.fn() },
    skill: { findUnique: vi.fn() },
    characterSkill: { findUnique: vi.fn() },
  },
}));

vi.mock('../services/mapFileService', () => ({
  mapFileService: { getArrivalPosition: vi.fn() },
}));

const baseMap = { id: 1, code: 'starting_village', width: 800, height: 600 };

describe('getRespawnPoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.gameMap.findUnique).mockResolvedValue(baseMap as never);
  });

  it('utilise le spawn de base si aucun point n\'est enregistré', async () => {
    vi.mocked(prisma.character.findUnique).mockResolvedValue({ respawnX: null, respawnY: null, respawnMap: null } as never);
    vi.mocked(mapFileService.getArrivalPosition).mockResolvedValue({ x: 40, y: 56 });

    await expect(respawnService.getRespawnPoint(1)).resolves.toEqual({
      mapId: 1,
      mapCode: 'starting_village',
      x: 40,
      y: 56,
    });
  });

  it('utilise le point enregistré', async () => {
    vi.mocked(prisma.character.findUnique).mockResolvedValue({
      respawnX: 300,
      respawnY: 200,
      respawnMap: { id: 4, code: 'dark_forest' },
    } as never);

    await expect(respawnService.getRespawnPoint(1)).resolves.toEqual({
      mapId: 4,
      mapCode: 'dark_forest',
      x: 300,
      y: 200,
    });
    expect(prisma.gameMap.findUnique).not.toHaveBeenCalled();
  });
});

describe('mort et réapparition', () => {
  const createServer = (isDead = false) => {
    const roomEmit = vi.fn();
    const server: any = Object.create(GameServer.prototype);
    const player = {
      characterId: 1,
      mapId: 1,
      positionX: 10,
      positionY: 10,
      isDead,
      isChangingMap: false,
      autoAttack: { weaponCode: null, weaponStats: {} },
    };
    Object.assign(server, {
      connectedPlayers: new Map([[1, player]]),
      skillLastCastAt: new Map(),
      monsterAI: { removePlayer: vi.fn(), updatePlayerPosition: vi.fn() },
      spawnManager: { getMonster: vi.fn() },
      io: { to: () => ({ emit: roomEmit }) },
    });

    return { server, player, roomEmit, socket: { emit: vi.fn(), data: { character: {} } } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.gameMap.findUnique).mockResolvedValue(baseMap as never);
    vi.mocked(mapFileService.getArrivalPosition).mockResolvedValue({ x: 40, y: 56 });
  });

  it('passe le joueur à l\'état mort quand sa vie tombe à 0, une seule fois', async () => {
    vi.mocked(prisma.character.updateMany).mockResolvedValue({ count: 0 } as never);
    const { server, player, roomEmit } = createServer();

    await Promise.all([server.handlePlayerHit(1, 500), server.handlePlayerHit(1, 500)]);

    expect(player.isDead).toBe(true);
    expect(server.monsterAI.removePlayer).toHaveBeenCalledTimes(1);
    expect(roomEmit).toHaveBeenCalledTimes(1);
    expect(roomEmit).toHaveBeenCalledWith('player:died', { characterId: 1 });
  });

  it('ne tue pas un joueur qui a encore de la vie', async () => {
    vi.mocked(prisma.character.updateMany).mockResolvedValue({ count: 1 } as never);
    const { server, player, roomEmit } = createServer();

    await server.handlePlayerHit(1, 5);

    expect(player.isDead).toBe(false);
    expect(roomEmit).not.toHaveBeenCalled();
  });

  it('refuse les attaques et les skills d\'un joueur mort', async () => {
    const { server, socket } = createServer(true);

    await server.handleAutoAttack(socket, 1, 5);
    await server.handleSkillCast(socket, 1, { skillId: 1, slot: 'Q', targetX: 0, targetY: 0 });

    expect(server.spawnManager.getMonster).not.toHaveBeenCalled();
    expect(prisma.skill.findUnique).not.toHaveBeenCalled();
  });

  it('ramène un joueur mort à son point de réapparition avec vie et mana restaurées', async () => {
    vi.mocked(prisma.character.findUnique)
      .mockResolvedValueOnce({ respawnX: null, respawnY: null, respawnMap: null } as never)
      .mockResolvedValueOnce({ maxHealth: 120, maxMana: 60 } as never);
    const { server, player, roomEmit, socket } = createServer(true);

    await server.handleRespawn(socket, 1);

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currentMapId: 1, positionX: 40, positionY: 56, health: 120, mana: 60 },
    });
    expect(player).toMatchObject({ isDead: false, positionX: 40, positionY: 56, isChangingMap: false });
    expect(server.monsterAI.updatePlayerPosition).toHaveBeenCalledWith(1, 1, 40, 56);
    expect(roomEmit).toHaveBeenCalledWith('player:respawned', {
      characterId: 1,
      mapCode: 'starting_village',
      positionX: 40,
      positionY: 56,
      health: 120,
      maxHealth: 120,
      mana: 60,
      maxMana: 60,
    });
  });

  it('ignore la réapparition d\'un joueur vivant', async () => {
    const { server, socket } = createServer(false);

    await server.handleRespawn(socket, 1);

    expect(prisma.character.update).not.toHaveBeenCalled();
  });
});
