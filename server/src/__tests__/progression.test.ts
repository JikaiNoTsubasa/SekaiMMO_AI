// Progression Service Tests
// SekaiMMO v2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { progressionService } from '../services/progressionService';

vi.mock('../config/prisma', () => ({
  prisma: {
    weaponType: { findUnique: vi.fn() },
    characterWeaponProgress: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    characterElementProgress: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  },
}));

describe('progressionService', () => {
  describe('isRankSufficient', () => {
    it('E est suffisant pour E', () => {
      expect(progressionService.isRankSufficient('E', 'E')).toBe(true);
    });

    it('D est suffisant pour E et D', () => {
      expect(progressionService.isRankSufficient('D', 'E')).toBe(true);
      expect(progressionService.isRankSufficient('D', 'D')).toBe(true);
    });

    it('E n\'est pas suffisant pour D', () => {
      expect(progressionService.isRankSufficient('E', 'D')).toBe(false);
    });

    it('C n\'est pas suffisant pour A', () => {
      expect(progressionService.isRankSufficient('C', 'A')).toBe(false);
    });

    it('A est suffisant pour tous les ranks', () => {
      expect(progressionService.isRankSufficient('A', 'E')).toBe(true);
      expect(progressionService.isRankSufficient('A', 'D')).toBe(true);
      expect(progressionService.isRankSufficient('A', 'C')).toBe(true);
      expect(progressionService.isRankSufficient('A', 'B')).toBe(true);
      expect(progressionService.isRankSufficient('A', 'A')).toBe(true);
    });
  });

  describe('getXpForNextRank', () => {
    it('retourne 500 pour le prochain rank après E', () => {
      expect(progressionService.getXpForNextRank('E')).toBe(500);
    });

    it('retourne 2000 pour le prochain rank après D', () => {
      expect(progressionService.getXpForNextRank('D')).toBe(2000);
    });

    it('retourne 5000 pour le prochain rank après C', () => {
      expect(progressionService.getXpForNextRank('C')).toBe(5000);
    });

    it('retourne 15000 pour le prochain rank après B', () => {
      expect(progressionService.getXpForNextRank('B')).toBe(15000);
    });

    it('retourne null pour le rank max A', () => {
      expect(progressionService.getXpForNextRank('A')).toBeNull();
    });
  });

  describe('getNextRank', () => {
    it('suit l\'ordre E -> D -> C -> B -> A', () => {
      expect(progressionService.getNextRank('E')).toBe('D');
      expect(progressionService.getNextRank('D')).toBe('C');
      expect(progressionService.getNextRank('C')).toBe('B');
      expect(progressionService.getNextRank('B')).toBe('A');
      expect(progressionService.getNextRank('A')).toBeNull();
    });
  });
});

describe('processActionExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.weaponType.findUnique).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.characterWeaponProgress.upsert).mockResolvedValue({ id: 1, experience: 15, currentRank: 'E' } as never);
    vi.mocked(prisma.characterElementProgress.upsert).mockResolvedValue({ id: 2, experience: 5, currentRank: 'E' } as never);
  });

  it('crédite le compteur de l\'arme et celui de l\'élément', async () => {
    const result = await progressionService.processActionExperience(1, {
      weaponXp: { weaponCode: 'SWORD', amount: 5 },
      elementXp: { element: 'FIRE', amount: 5 },
    });

    expect(result.weaponProgress).toMatchObject({ weaponCode: 'SWORD', previousXp: 10, newXp: 15 });
    expect(result.elementProgress).toMatchObject({ element: 'FIRE', previousXp: 0, newXp: 5 });
  });

  it('ne crédite aucun élément pour un coup sans élément', async () => {
    const result = await progressionService.processActionExperience(1, {
      weaponXp: { weaponCode: 'SWORD', amount: 5 },
      elementXp: { element: 'NONE', amount: 5 },
    });

    expect(result.elementProgress).toBeUndefined();
    expect(prisma.characterElementProgress.upsert).not.toHaveBeenCalled();
  });

  it('ne crédite aucune arme à mains nues', async () => {
    const result = await progressionService.processActionExperience(1, {
      elementXp: { element: 'FIRE', amount: 5 },
    });

    expect(result.weaponProgress).toBeUndefined();
    expect(prisma.characterWeaponProgress.upsert).not.toHaveBeenCalled();
  });

  it('ne monte jamais le rang automatiquement', async () => {
    vi.mocked(prisma.characterWeaponProgress.upsert).mockResolvedValue({ id: 1, experience: 100000, currentRank: 'E' } as never);

    const result = await progressionService.processActionExperience(1, {
      weaponXp: { weaponCode: 'SWORD', amount: 10 },
    });

    expect(result.weaponProgress).toMatchObject({ currentRank: 'E' });
    expect(prisma.characterWeaponProgress.updateMany).not.toHaveBeenCalled();
  });
});

describe('achat de rang', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.weaponType.findUnique).mockResolvedValue({ id: 1 } as never);
  });

  it('débite le prix du rang suivant du solde de l\'arme', async () => {
    vi.mocked(prisma.characterWeaponProgress.findUnique).mockResolvedValue({ currentRank: 'E', experience: 600 } as never);
    vi.mocked(prisma.characterWeaponProgress.updateMany).mockResolvedValue({ count: 1 } as never);

    await expect(progressionService.purchaseWeaponRank(1, 'SWORD')).resolves.toEqual({ rank: 'D', xpSpent: 500 });
    expect(prisma.characterWeaponProgress.updateMany).toHaveBeenCalledWith({
      where: { characterId: 1, weaponTypeId: 1, currentRank: 'E', experience: { gte: 500 } },
      data: { currentRank: 'D', experience: { decrement: 500 } },
    });
  });

  it('refuse l\'achat si le solde est insuffisant', async () => {
    vi.mocked(prisma.characterWeaponProgress.findUnique).mockResolvedValue({ currentRank: 'E', experience: 10 } as never);
    vi.mocked(prisma.characterWeaponProgress.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(progressionService.purchaseWeaponRank(1, 'SWORD')).rejects.toThrow('XP insuffisante');
  });

  it('refuse l\'achat au rang maximum', async () => {
    vi.mocked(prisma.characterElementProgress.findUnique).mockResolvedValue({ currentRank: 'A', experience: 99999 } as never);

    await expect(progressionService.purchaseElementRank(1, 'FIRE')).rejects.toThrow('Rang maximum');
    expect(prisma.characterElementProgress.updateMany).not.toHaveBeenCalled();
  });
});
