import { describe, expect, it } from 'vitest';
import { formatSkillDamage } from './skillDamage';

describe('formatSkillDamage', () => {
  it('affiche la base et les ratios non nuls', () => {
    expect(formatSkillDamage({ baseDamage: 25, attackScaling: 0.6, magicScaling: 0.6 })).toBe('25 (+60% Att) (+60% Mag)');
    expect(formatSkillDamage({ baseDamage: 25, attackScaling: 0, magicScaling: 1.2 })).toBe('25 (+120% Mag)');
    expect(formatSkillDamage({ baseDamage: 10, attackScaling: 0, magicScaling: 0 })).toBe('10');
  });
});
