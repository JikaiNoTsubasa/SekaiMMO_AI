// Formule de dégâts d'un skill (style LoL) : base + % attaque + % magie

interface SkillDamageFormula {
  baseDamage: number;
  attackScaling: number;
  magicScaling: number;
}

const toPercent = (ratio: number): number => Math.round(ratio * 100);

/**
 * Ex: "25 (+60% Att) (+60% Mag)"
 */
export const formatSkillDamage = ({ baseDamage, attackScaling, magicScaling }: SkillDamageFormula): string => {
  const parts = [`${baseDamage}`];
  if (attackScaling) parts.push(`(+${toPercent(attackScaling)}% Att)`);
  if (magicScaling) parts.push(`(+${toPercent(magicScaling)}% Mag)`);
  return parts.join(' ');
};
