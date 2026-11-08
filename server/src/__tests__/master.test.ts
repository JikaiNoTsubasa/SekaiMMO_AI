// Tests des achats chez les maîtres et de la sécurisation du cast
// SekaiMMO v2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { GameServer } from '../game/gameServer';
import { masterService } from '../services/masterService';
import { skillService } from '../services/skillService';

vi.mock('../config/prisma', () => {
  const prisma: Record<string, any> = {
    character: { findUnique: vi.fn(), update: vi.fn() },
    skill: { findUnique: vi.fn(), findFirst: vi.fn() },
    characterSkill: { findUnique: vi.fn(), upsert: vi.fn() },
    characterWeaponProgress: { findUnique: vi.fn(), updateMany: vi.fn() },
    characterElementProgress: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  return { prisma };
});

const swordMaster = { id: 1, weaponMasterFor: 'SWORD', elementMasterFor: null } as never;

const baseSkill = {
  id: 10,
  name: 'Coup',
  element: 'NONE',
  weaponTypeId: 1,
  weaponType: { name: 'Épée' },
  requiredRank: 'E',
  requiredWeaponXp: 100,
  requiredElementXp: 0,
};

const fireSkill = { ...baseSkill, id: 11, name: 'Feu', element: 'FIRE', requiredElementXp: 40 };

describe('achat de compétence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.characterSkill.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.characterWeaponProgress.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.characterElementProgress.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('paie un skill sans élément avec l\'XP d\'arme', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(baseSkill as never);
    vi.mocked(prisma.characterWeaponProgress.findUnique).mockResolvedValue({ currentRank: 'E', experience: 150 } as never);

    const result = await skillService.learnSkill(1, baseSkill.id);

    expect(result).toMatchObject({ success: true, xpSpent: 100 });
    expect(prisma.characterWeaponProgress.updateMany).toHaveBeenCalledWith({
      where: { characterId: 1, weaponTypeId: 1, experience: { gte: 100 } },
      data: { experience: { decrement: 100 } },
    });
    expect(prisma.characterElementProgress.updateMany).not.toHaveBeenCalled();
  });

  it('paie un sort élémentaire avec l\'XP d\'élément, pas l\'XP d\'arme', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(fireSkill as never);
    vi.mocked(prisma.characterElementProgress.findUnique).mockResolvedValue({ currentRank: 'E', experience: 40 } as never);

    const result = await skillService.learnSkill(1, fireSkill.id);

    expect(result).toMatchObject({ success: true, xpSpent: 40 });
    expect(prisma.characterElementProgress.updateMany).toHaveBeenCalledWith({
      where: { characterId: 1, element: 'FIRE', experience: { gte: 40 } },
      data: { experience: { decrement: 40 } },
    });
    expect(prisma.characterWeaponProgress.updateMany).not.toHaveBeenCalled();
  });

  it('refuse l\'achat si le solde d\'XP est insuffisant', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(baseSkill as never);
    vi.mocked(prisma.characterWeaponProgress.findUnique).mockResolvedValue({ currentRank: 'E', experience: 99 } as never);

    await expect(skillService.learnSkill(1, baseSkill.id)).rejects.toThrow('100 XP en Épée requis');
    expect(prisma.characterSkill.upsert).not.toHaveBeenCalled();
  });

  it('refuse un skill qu\'un maître n\'enseigne pas', async () => {
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);

    await expect(masterService.buySkill(1, swordMaster, fireSkill.id)).rejects.toThrow("n'enseigne pas");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('cast d\'un skill', () => {
  const activeSkill = {
    id: 20,
    category: 'ACTIVE',
    cooldown: 8,
    manaCost: 10,
    range: 500,
    areaOfEffect: 0,
    telegraphShape: null,
  };

  const createServer = () => {
    const server = Object.create(GameServer.prototype);
    Object.assign(server, {
      connectedPlayers: new Map([
        [1, { mapId: 1, positionX: 0, positionY: 0, autoAttack: { weaponCode: 'SWORD', weaponStats: {} } }],
      ]),
      skillLastCastAt: new Map(),
      spawnManager: { getMonstersOnMap: () => [] },
      io: { to: () => ({ emit: vi.fn() }) },
    });

    const socket = { emit: vi.fn() };
    const cast = () => server.handleSkillCast(socket, 1, { skillId: activeSkill.id, slot: 'Q', targetX: 0, targetY: 0 });

    return { socket, cast };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(activeSkill as never);
    vi.mocked(prisma.character.findUnique).mockResolvedValue({
      mana: 100,
      physicalAttack: 1,
      magicalAttack: 1,
      physicalDefense: 1,
      magicalDefense: 1,
      physicalPenetration: 0,
      magicalPenetration: 0,
      critChance: 0,
      critDamage: 1.5,
    } as never);
    vi.mocked(prisma.characterSkill.findUnique).mockResolvedValue({ isUnlocked: true } as never);
  });

  it('refuse un skill non débloqué', async () => {
    vi.mocked(prisma.characterSkill.findUnique).mockResolvedValue(null);
    const { socket, cast } = createServer();

    await cast();

    expect(socket.emit).toHaveBeenCalledWith('skill:failed', { reason: 'Skill not unlocked' });
    expect(prisma.character.update).not.toHaveBeenCalled();
  });

  it('refuse un skill passif', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({ ...activeSkill, category: 'PASSIVE' } as never);
    const { socket, cast } = createServer();

    await cast();

    expect(socket.emit).toHaveBeenCalledWith('skill:failed', { reason: 'Skill not unlocked' });
  });

  it('refuse un skill si la bonne arme n\'est pas équipée et l\'indique en rouge dans le chat', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...activeSkill,
      name: 'Boule de Feu',
      weaponType: { code: 'WAND', name: 'Baguette' },
    } as never);
    const { socket, cast } = createServer();

    await cast();

    expect(socket.emit).toHaveBeenCalledWith('skill:failed', { reason: 'Wrong weapon equipped' });
    expect(socket.emit).toHaveBeenCalledWith('chat:message', expect.objectContaining({
      content: "La bonne arme n'est pas équipée : Boule de Feu nécessite Baguette",
      isSystem: true,
      level: 'error',
    }));
    expect(prisma.character.update).not.toHaveBeenCalled();
  });

  it('accepte un skill lié à l\'arme équipée', async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...activeSkill,
      weaponType: { code: 'SWORD', name: 'Épée' },
    } as never);
    const { cast } = createServer();

    await cast();

    expect(prisma.character.update).toHaveBeenCalledTimes(1);
  });

  it('refuse un second cast pendant le cooldown, l\'accepte ensuite', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const { socket, cast } = createServer();

    await cast();
    expect(prisma.character.update).toHaveBeenCalledTimes(1);

    now.mockReturnValue(101000);
    await cast();
    expect(socket.emit).toHaveBeenCalledWith('skill:failed', { reason: 'Skill on cooldown' });
    expect(prisma.character.update).toHaveBeenCalledTimes(1);

    now.mockReturnValue(108000);
    await cast();
    expect(prisma.character.update).toHaveBeenCalledTimes(2);
  });

  it('applique un seul cast quand deux requêtes arrivent en même temps', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100000);
    const { cast } = createServer();

    await Promise.all([cast(), cast()]);

    expect(prisma.character.update).toHaveBeenCalledTimes(1);
  });
});
