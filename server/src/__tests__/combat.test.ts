// Combat Service Tests
// SekaiMMO v2.0

import { describe, expect, it, vi } from 'vitest';
import { combatService, type CombatStats, type SkillDamageParams } from '../services/combatService';

// Mock Math.random pour des tests déterministes
const mockRandom = (value: number) => {
  vi.spyOn(Math, 'random').mockReturnValue(value);
};

// Stats d'attaquant par défaut
const defaultAttacker: CombatStats = {
  physicalAttack: 100,
  magicalAttack: 80,
  physicalDefense: 50,
  magicalDefense: 40,
  physicalPenetration: 10,
  magicalPenetration: 5,
  critChance: 0.1,
  critDamage: 1.5,
};

// Stats de défenseur par défaut
const defaultDefender: CombatStats = {
  physicalAttack: 50,
  magicalAttack: 50,
  physicalDefense: 80,
  magicalDefense: 60,
  physicalPenetration: 0,
  magicalPenetration: 0,
  critChance: 0.05,
  critDamage: 1.5,
};

describe('combatService', () => {
  describe('calculateBasicAttackDamage', () => {
    it('calcule les dégâts physiques correctement', () => {
      mockRandom(0.5); // Pas de crit

      const result = combatService.calculateBasicAttackDamage(
        defaultAttacker,
        defaultDefender,
        'PHYSICAL'
      );

      expect(result.damageType).toBe('PHYSICAL');
      expect(result.isCritical).toBe(false);
      expect(result.rawDamage).toBe(100);
      expect(result.finalDamage).toBeGreaterThan(0);
      expect(result.blocked).toBeGreaterThan(0);
    });

    it('calcule les dégâts magiques correctement', () => {
      mockRandom(0.5); // Pas de crit

      const result = combatService.calculateBasicAttackDamage(
        defaultAttacker,
        defaultDefender,
        'MAGICAL'
      );

      expect(result.damageType).toBe('MAGICAL');
      expect(result.rawDamage).toBe(80); // magicalAttack
    });

    it('applique le multiplicateur critique', () => {
      mockRandom(0.05); // Crit (< 0.1 critChance)

      const result = combatService.calculateBasicAttackDamage(
        defaultAttacker,
        defaultDefender,
        'PHYSICAL'
      );

      expect(result.isCritical).toBe(true);
      // Les dégâts finaux devraient être plus élevés avec le crit
    });

    it('applique la pénétration à la défense', () => {
      mockRandom(0.5);

      // Attaquant avec haute pénétration
      const highPenAttacker: CombatStats = {
        ...defaultAttacker,
        physicalPenetration: 80, // Ignore presque toute la défense (80)
      };

      const result = combatService.calculateBasicAttackDamage(
        highPenAttacker,
        defaultDefender,
        'PHYSICAL'
      );

      // Moins de dégâts bloqués car pénétration élevée
      expect(result.blocked).toBeLessThan(50);
    });

    it('garantit un minimum de 1 dégât', () => {
      mockRandom(0.5);

      // Défenseur très résistant
      const tankDefender: CombatStats = {
        ...defaultDefender,
        physicalDefense: 1000,
      };

      const result = combatService.calculateBasicAttackDamage(
        defaultAttacker,
        tankDefender,
        'PHYSICAL'
      );

      expect(result.finalDamage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateSkillDamage', () => {
    it('calcule les dégâts de skill avec base + scaling', () => {
      mockRandom(0.5);

      const skillParams: SkillDamageParams = {
        baseDamage: 50,
        damageScaling: 0.5,
        damageType: 'PHYSICAL',
        element: 'FIRE',
      };

      const result = combatService.calculateSkillDamage(
        defaultAttacker,
        defaultDefender,
        skillParams
      );

      // rawDamage = baseDamage + (physicalAttack * scaling)
      // rawDamage = 50 + (100 * 0.5) = 100
      expect(result.rawDamage).toBe(100);
      expect(result.element).toBe('FIRE');
    });

    it('les dégâts PURE ignorent les défenses', () => {
      mockRandom(0.5);

      const skillParams: SkillDamageParams = {
        baseDamage: 100,
        damageScaling: 0,
        damageType: 'PURE',
        element: 'NONE',
      };

      // Défenseur très résistant
      const tankDefender: CombatStats = {
        ...defaultDefender,
        physicalDefense: 1000,
        magicalDefense: 1000,
      };

      const result = combatService.calculateSkillDamage(
        defaultAttacker,
        tankDefender,
        skillParams
      );

      // PURE damage = pas de réduction
      expect(result.blocked).toBe(0);
      expect(result.finalDamage).toBe(100);
    });

    it('applique le scaling avec l\'attaque magique pour les skills magiques', () => {
      mockRandom(0.5);

      const skillParams: SkillDamageParams = {
        baseDamage: 30,
        damageScaling: 1.0,
        damageType: 'MAGICAL',
        element: 'ICE',
      };

      const result = combatService.calculateSkillDamage(
        defaultAttacker,
        defaultDefender,
        skillParams
      );

      // rawDamage = baseDamage + (magicalAttack * scaling)
      // rawDamage = 30 + (80 * 1.0) = 110
      expect(result.rawDamage).toBe(110);
    });
  });

  describe('calculateElementalMultiplier', () => {
    it('retourne 1.0 pour tous les éléments (pas encore implémenté)', () => {
      expect(combatService.calculateElementalMultiplier('FIRE', 'WATER')).toBe(1.0);
      expect(combatService.calculateElementalMultiplier('ICE', 'FIRE')).toBe(1.0);
      expect(combatService.calculateElementalMultiplier('LIGHTNING', 'EARTH')).toBe(1.0);
    });
  });
});

describe('Combat Formulas', () => {
  it('la réduction de défense suit la formule defense/(defense+100)', () => {
    // Avec 100 de défense: réduction = 100/(100+100) = 50%
    // Avec 200 de défense: réduction = 200/(200+100) = 66%
    // Avec 0 de défense: réduction = 0%

    mockRandom(0.5);

    // Test avec 0 défense
    const noDefenseResult = combatService.calculateBasicAttackDamage(
      defaultAttacker,
      { ...defaultDefender, physicalDefense: 0 },
      'PHYSICAL'
    );

    // Avec 0 défense, pas de dégâts bloqués
    expect(noDefenseResult.blocked).toBe(0);
    expect(noDefenseResult.finalDamage).toBe(noDefenseResult.rawDamage);
  });

  it('le critique multiplie les dégâts par critDamage', () => {
    // Sans crit
    mockRandom(0.5);
    const noCritResult = combatService.calculateBasicAttackDamage(
      defaultAttacker,
      { ...defaultDefender, physicalDefense: 0 }, // 0 défense pour simplifier
      'PHYSICAL'
    );

    // Avec crit
    mockRandom(0.01);
    const critResult = combatService.calculateBasicAttackDamage(
      defaultAttacker,
      { ...defaultDefender, physicalDefense: 0 },
      'PHYSICAL'
    );

    expect(critResult.isCritical).toBe(true);
    expect(critResult.finalDamage).toBe(Math.floor(noCritResult.finalDamage * 1.5));
  });
});
