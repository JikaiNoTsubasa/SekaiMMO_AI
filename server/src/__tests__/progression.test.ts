// Progression Service Tests
// SekaiMMO v2.0

import { describe, expect, it } from 'vitest';
import { progressionService } from '../services/progressionService';

describe('progressionService', () => {
  describe('calculateRankFromXp', () => {
    it('retourne E pour 0 XP', () => {
      expect(progressionService.calculateRankFromXp(0)).toBe('E');
    });

    it('retourne E pour moins de 500 XP', () => {
      expect(progressionService.calculateRankFromXp(499)).toBe('E');
    });

    it('retourne D pour 500+ XP', () => {
      expect(progressionService.calculateRankFromXp(500)).toBe('D');
      expect(progressionService.calculateRankFromXp(1999)).toBe('D');
    });

    it('retourne C pour 2000+ XP', () => {
      expect(progressionService.calculateRankFromXp(2000)).toBe('C');
      expect(progressionService.calculateRankFromXp(4999)).toBe('C');
    });

    it('retourne B pour 5000+ XP', () => {
      expect(progressionService.calculateRankFromXp(5000)).toBe('B');
      expect(progressionService.calculateRankFromXp(14999)).toBe('B');
    });

    it('retourne A pour 15000+ XP', () => {
      expect(progressionService.calculateRankFromXp(15000)).toBe('A');
      expect(progressionService.calculateRankFromXp(100000)).toBe('A');
    });
  });

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
});

describe('Rank Progression System', () => {
  it('la progression suit l\'ordre E -> D -> C -> B -> A', () => {
    const xpValues = [0, 500, 2000, 5000, 15000];
    const expectedRanks = ['E', 'D', 'C', 'B', 'A'];

    xpValues.forEach((xp, index) => {
      expect(progressionService.calculateRankFromXp(xp)).toBe(expectedRanks[index]);
    });
  });

  it('les seuils de rank sont cohérents avec getXpForNextRank', () => {
    // E -> D: 500 XP nécessaire
    expect(progressionService.getXpForNextRank('E')).toBe(500);
    expect(progressionService.calculateRankFromXp(500)).toBe('D');

    // D -> C: 2000 XP nécessaire
    expect(progressionService.getXpForNextRank('D')).toBe(2000);
    expect(progressionService.calculateRankFromXp(2000)).toBe('C');
  });
});
