import { describe, expect, it } from 'vitest';

import { calculateWeaponExperience } from '../utils/experience';

describe('calculateWeaponExperience', () => {
  it('scales with multiplier', () => {
    expect(calculateWeaponExperience(10, 1.5)).toBe(15);
  });

  it('never returns negative values', () => {
    expect(calculateWeaponExperience(-10, 1)).toBe(0);
  });
});
