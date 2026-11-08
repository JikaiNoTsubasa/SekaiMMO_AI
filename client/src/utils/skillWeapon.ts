// Arme requise par un skill

import type { SkillData, WeaponCode } from '../game/types';

export const isSkillWeaponEquipped = (
  skill: Pick<SkillData, 'weaponType'>,
  equippedWeapon: WeaponCode | null
): boolean => !skill.weaponType || skill.weaponType.code === equippedWeapon;

export const getWrongWeaponMessage = (skill: Pick<SkillData, 'name' | 'weaponType'>): string =>
  `La bonne arme n'est pas équipée : ${skill.name} nécessite ${skill.weaponType?.name}`;
