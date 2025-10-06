export const calculateWeaponExperience = (
  baseExperience: number,
  weaponMultiplier = 1
) => Math.max(0, Math.round(baseExperience * weaponMultiplier));
