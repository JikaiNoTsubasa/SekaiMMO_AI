// Tests de l'enregistrement des dégâts subis par les joueurs
// SekaiMMO v2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { MonsterAI } from '../game/MonsterAI';
import { combatService } from '../services/combatService';

vi.mock('../config/prisma', () => ({
  prisma: {
    character: { updateMany: vi.fn() },
  },
}));

describe('applyDamageToCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retire les dégâts de la vie enregistrée', async () => {
    vi.mocked(prisma.character.updateMany).mockResolvedValue({ count: 1 } as never);

    await expect(combatService.applyDamageToCharacter(1, 12)).resolves.toEqual({ isDead: false });
    expect(prisma.character.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.character.updateMany).toHaveBeenCalledWith({
      where: { id: 1, health: { gt: 12 } },
      data: { health: { decrement: 12 } },
    });
  });

  it('ne descend pas sous 0', async () => {
    vi.mocked(prisma.character.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(combatService.applyDamageToCharacter(1, 500)).resolves.toEqual({ isDead: true });
    expect(prisma.character.updateMany).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { health: 0 },
    });
  });
});

describe('MonsterAI', () => {
  it('signale les dégâts infligés au joueur ciblé', () => {
    const emit = vi.fn();
    const onPlayerHit = vi.fn();
    const ai = new MonsterAI({ to: () => ({ emit }) } as never, {} as never, onPlayerHit);

    (ai as any).performAttack(
      { spawnId: 5, mapId: 1, name: 'Loup', physicalAttack: 100, magicalAttack: 0, element: 'NONE' },
      7
    );

    const damage = emit.mock.calls[0][1].damage;
    expect(onPlayerHit).toHaveBeenCalledWith(7, damage);
  });
});
