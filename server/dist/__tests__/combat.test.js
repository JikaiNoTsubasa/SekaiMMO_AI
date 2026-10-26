"use strict";
// Combat Service Tests
// SekaiMMO v2.0
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const combatService_1 = require("../services/combatService");
// Mock Math.random pour des tests déterministes
const mockRandom = (value) => {
    vitest_1.vi.spyOn(Math, 'random').mockReturnValue(value);
};
// Stats d'attaquant par défaut
const defaultAttacker = {
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
const defaultDefender = {
    physicalAttack: 50,
    magicalAttack: 50,
    physicalDefense: 80,
    magicalDefense: 60,
    physicalPenetration: 0,
    magicalPenetration: 0,
    critChance: 0.05,
    critDamage: 1.5,
};
(0, vitest_1.describe)('combatService', () => {
    (0, vitest_1.describe)('calculateBasicAttackDamage', () => {
        (0, vitest_1.it)('calcule les dégâts physiques correctement', () => {
            mockRandom(0.5); // Pas de crit
            const result = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, defaultDefender, 'PHYSICAL');
            (0, vitest_1.expect)(result.damageType).toBe('PHYSICAL');
            (0, vitest_1.expect)(result.isCritical).toBe(false);
            (0, vitest_1.expect)(result.rawDamage).toBe(100);
            (0, vitest_1.expect)(result.finalDamage).toBeGreaterThan(0);
            (0, vitest_1.expect)(result.blocked).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('calcule les dégâts magiques correctement', () => {
            mockRandom(0.5); // Pas de crit
            const result = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, defaultDefender, 'MAGICAL');
            (0, vitest_1.expect)(result.damageType).toBe('MAGICAL');
            (0, vitest_1.expect)(result.rawDamage).toBe(80); // magicalAttack
        });
        (0, vitest_1.it)('applique le multiplicateur critique', () => {
            mockRandom(0.05); // Crit (< 0.1 critChance)
            const result = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, defaultDefender, 'PHYSICAL');
            (0, vitest_1.expect)(result.isCritical).toBe(true);
            // Les dégâts finaux devraient être plus élevés avec le crit
        });
        (0, vitest_1.it)('applique la pénétration à la défense', () => {
            mockRandom(0.5);
            // Attaquant avec haute pénétration
            const highPenAttacker = {
                ...defaultAttacker,
                physicalPenetration: 80, // Ignore presque toute la défense (80)
            };
            const result = combatService_1.combatService.calculateBasicAttackDamage(highPenAttacker, defaultDefender, 'PHYSICAL');
            // Moins de dégâts bloqués car pénétration élevée
            (0, vitest_1.expect)(result.blocked).toBeLessThan(50);
        });
        (0, vitest_1.it)('garantit un minimum de 1 dégât', () => {
            mockRandom(0.5);
            // Défenseur très résistant
            const tankDefender = {
                ...defaultDefender,
                physicalDefense: 1000,
            };
            const result = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, tankDefender, 'PHYSICAL');
            (0, vitest_1.expect)(result.finalDamage).toBeGreaterThanOrEqual(1);
        });
    });
    (0, vitest_1.describe)('calculateSkillDamage', () => {
        (0, vitest_1.it)('calcule les dégâts de skill avec base + scaling', () => {
            mockRandom(0.5);
            const skillParams = {
                baseDamage: 50,
                damageScaling: 0.5,
                damageType: 'PHYSICAL',
                element: 'FIRE',
            };
            const result = combatService_1.combatService.calculateSkillDamage(defaultAttacker, defaultDefender, skillParams);
            // rawDamage = baseDamage + (physicalAttack * scaling)
            // rawDamage = 50 + (100 * 0.5) = 100
            (0, vitest_1.expect)(result.rawDamage).toBe(100);
            (0, vitest_1.expect)(result.element).toBe('FIRE');
        });
        (0, vitest_1.it)('les dégâts PURE ignorent les défenses', () => {
            mockRandom(0.5);
            const skillParams = {
                baseDamage: 100,
                damageScaling: 0,
                damageType: 'PURE',
                element: 'NONE',
            };
            // Défenseur très résistant
            const tankDefender = {
                ...defaultDefender,
                physicalDefense: 1000,
                magicalDefense: 1000,
            };
            const result = combatService_1.combatService.calculateSkillDamage(defaultAttacker, tankDefender, skillParams);
            // PURE damage = pas de réduction
            (0, vitest_1.expect)(result.blocked).toBe(0);
            (0, vitest_1.expect)(result.finalDamage).toBe(100);
        });
        (0, vitest_1.it)('applique le scaling avec l\'attaque magique pour les skills magiques', () => {
            mockRandom(0.5);
            const skillParams = {
                baseDamage: 30,
                damageScaling: 1.0,
                damageType: 'MAGICAL',
                element: 'ICE',
            };
            const result = combatService_1.combatService.calculateSkillDamage(defaultAttacker, defaultDefender, skillParams);
            // rawDamage = baseDamage + (magicalAttack * scaling)
            // rawDamage = 30 + (80 * 1.0) = 110
            (0, vitest_1.expect)(result.rawDamage).toBe(110);
        });
    });
    (0, vitest_1.describe)('calculateElementalMultiplier', () => {
        (0, vitest_1.it)('retourne 1.0 pour tous les éléments (pas encore implémenté)', () => {
            (0, vitest_1.expect)(combatService_1.combatService.calculateElementalMultiplier('FIRE', 'WATER')).toBe(1.0);
            (0, vitest_1.expect)(combatService_1.combatService.calculateElementalMultiplier('ICE', 'FIRE')).toBe(1.0);
            (0, vitest_1.expect)(combatService_1.combatService.calculateElementalMultiplier('LIGHTNING', 'EARTH')).toBe(1.0);
        });
    });
});
(0, vitest_1.describe)('Combat Formulas', () => {
    (0, vitest_1.it)('la réduction de défense suit la formule defense/(defense+100)', () => {
        // Avec 100 de défense: réduction = 100/(100+100) = 50%
        // Avec 200 de défense: réduction = 200/(200+100) = 66%
        // Avec 0 de défense: réduction = 0%
        mockRandom(0.5);
        // Test avec 0 défense
        const noDefenseResult = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, { ...defaultDefender, physicalDefense: 0 }, 'PHYSICAL');
        // Avec 0 défense, pas de dégâts bloqués
        (0, vitest_1.expect)(noDefenseResult.blocked).toBe(0);
        (0, vitest_1.expect)(noDefenseResult.finalDamage).toBe(noDefenseResult.rawDamage);
    });
    (0, vitest_1.it)('le critique multiplie les dégâts par critDamage', () => {
        // Sans crit
        mockRandom(0.5);
        const noCritResult = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, { ...defaultDefender, physicalDefense: 0 }, // 0 défense pour simplifier
        'PHYSICAL');
        // Avec crit
        mockRandom(0.01);
        const critResult = combatService_1.combatService.calculateBasicAttackDamage(defaultAttacker, { ...defaultDefender, physicalDefense: 0 }, 'PHYSICAL');
        (0, vitest_1.expect)(critResult.isCritical).toBe(true);
        (0, vitest_1.expect)(critResult.finalDamage).toBe(Math.floor(noCritResult.finalDamage * 1.5));
    });
});
