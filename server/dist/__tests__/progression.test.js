"use strict";
// Progression Service Tests
// SekaiMMO v2.0
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const progressionService_1 = require("../services/progressionService");
(0, vitest_1.describe)('progressionService', () => {
    (0, vitest_1.describe)('calculateRankFromXp', () => {
        (0, vitest_1.it)('retourne E pour 0 XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(0)).toBe('E');
        });
        (0, vitest_1.it)('retourne E pour moins de 500 XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(499)).toBe('E');
        });
        (0, vitest_1.it)('retourne D pour 500+ XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(500)).toBe('D');
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(1999)).toBe('D');
        });
        (0, vitest_1.it)('retourne C pour 2000+ XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(2000)).toBe('C');
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(4999)).toBe('C');
        });
        (0, vitest_1.it)('retourne B pour 5000+ XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(5000)).toBe('B');
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(14999)).toBe('B');
        });
        (0, vitest_1.it)('retourne A pour 15000+ XP', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(15000)).toBe('A');
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(100000)).toBe('A');
        });
    });
    (0, vitest_1.describe)('isRankSufficient', () => {
        (0, vitest_1.it)('E est suffisant pour E', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('E', 'E')).toBe(true);
        });
        (0, vitest_1.it)('D est suffisant pour E et D', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('D', 'E')).toBe(true);
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('D', 'D')).toBe(true);
        });
        (0, vitest_1.it)('E n\'est pas suffisant pour D', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('E', 'D')).toBe(false);
        });
        (0, vitest_1.it)('C n\'est pas suffisant pour A', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('C', 'A')).toBe(false);
        });
        (0, vitest_1.it)('A est suffisant pour tous les ranks', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('A', 'E')).toBe(true);
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('A', 'D')).toBe(true);
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('A', 'C')).toBe(true);
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('A', 'B')).toBe(true);
            (0, vitest_1.expect)(progressionService_1.progressionService.isRankSufficient('A', 'A')).toBe(true);
        });
    });
    (0, vitest_1.describe)('getXpForNextRank', () => {
        (0, vitest_1.it)('retourne 500 pour le prochain rank après E', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('E')).toBe(500);
        });
        (0, vitest_1.it)('retourne 2000 pour le prochain rank après D', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('D')).toBe(2000);
        });
        (0, vitest_1.it)('retourne 5000 pour le prochain rank après C', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('C')).toBe(5000);
        });
        (0, vitest_1.it)('retourne 15000 pour le prochain rank après B', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('B')).toBe(15000);
        });
        (0, vitest_1.it)('retourne null pour le rank max A', () => {
            (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('A')).toBeNull();
        });
    });
});
(0, vitest_1.describe)('Rank Progression System', () => {
    (0, vitest_1.it)('la progression suit l\'ordre E -> D -> C -> B -> A', () => {
        const xpValues = [0, 500, 2000, 5000, 15000];
        const expectedRanks = ['E', 'D', 'C', 'B', 'A'];
        xpValues.forEach((xp, index) => {
            (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(xp)).toBe(expectedRanks[index]);
        });
    });
    (0, vitest_1.it)('les seuils de rank sont cohérents avec getXpForNextRank', () => {
        // E -> D: 500 XP nécessaire
        (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('E')).toBe(500);
        (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(500)).toBe('D');
        // D -> C: 2000 XP nécessaire
        (0, vitest_1.expect)(progressionService_1.progressionService.getXpForNextRank('D')).toBe(2000);
        (0, vitest_1.expect)(progressionService_1.progressionService.calculateRankFromXp(2000)).toBe('C');
    });
});
