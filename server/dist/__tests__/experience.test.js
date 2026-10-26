"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const experience_1 = require("../utils/experience");
(0, vitest_1.describe)('calculateWeaponExperience', () => {
    (0, vitest_1.it)('scales with multiplier', () => {
        (0, vitest_1.expect)((0, experience_1.calculateWeaponExperience)(10, 1.5)).toBe(15);
    });
    (0, vitest_1.it)('never returns negative values', () => {
        (0, vitest_1.expect)((0, experience_1.calculateWeaponExperience)(-10, 1)).toBe(0);
    });
});
