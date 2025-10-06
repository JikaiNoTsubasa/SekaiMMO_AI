import { describe, expect, it } from 'vitest';

import { isValidSkillSlot, skillSlots } from './skillSlots';

describe('skill slot helpers', () => {
  it('accepts all predefined slots', () => {
    skillSlots.forEach((slot) => {
      expect(isValidSkillSlot(slot)).toBe(true);
      expect(isValidSkillSlot(slot.toLowerCase())).toBe(true);
    });
  });

  it('rejects unknown slots', () => {
    expect(isValidSkillSlot('Z')).toBe(false);
    expect(isValidSkillSlot('1')).toBe(false);
  });
});
