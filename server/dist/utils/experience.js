"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWeaponExperience = void 0;
const calculateWeaponExperience = (baseExperience, weaponMultiplier = 1) => Math.max(0, Math.round(baseExperience * weaponMultiplier));
exports.calculateWeaponExperience = calculateWeaponExperience;
