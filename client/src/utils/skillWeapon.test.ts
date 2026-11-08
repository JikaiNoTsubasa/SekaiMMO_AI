import { describe, expect, it } from 'vitest';

import { getWrongWeaponMessage, isSkillWeaponEquipped } from './skillWeapon';

describe('isSkillWeaponEquipped', () => {
  const wandSkill = { weaponType: { code: 'WAND' as const, name: 'Baguette' } };

  it('accepte un skill lié à l\'arme équipée', () => {
    expect(isSkillWeaponEquipped(wandSkill, 'WAND')).toBe(true);
  });

  it('refuse un skill lié à une autre arme ou à mains nues', () => {
    expect(isSkillWeaponEquipped(wandSkill, 'SWORD')).toBe(false);
    expect(isSkillWeaponEquipped(wandSkill, null)).toBe(false);
  });

  it('accepte un skill sans arme requise', () => {
    expect(isSkillWeaponEquipped({ weaponType: null }, null)).toBe(true);
    expect(isSkillWeaponEquipped({}, 'SWORD')).toBe(true);
  });
});

describe('getWrongWeaponMessage', () => {
  it('indique le skill et l\'arme nécessaire', () => {
    expect(getWrongWeaponMessage({ name: 'Boule de Feu', weaponType: { code: 'WAND', name: 'Baguette' } })).toBe(
      "La bonne arme n'est pas équipée : Boule de Feu nécessite Baguette"
    );
  });
});
