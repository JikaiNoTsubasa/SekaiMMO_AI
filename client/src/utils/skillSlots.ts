export const skillSlots = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'] as const;

export type SkillSlot = (typeof skillSlots)[number];

export const isValidSkillSlot = (slot: string): slot is SkillSlot =>
  skillSlots.includes(slot.toUpperCase() as SkillSlot);
