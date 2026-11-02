import { describe, expect, it } from 'vitest';
import { CHARACTER_ANIMATIONS, CHARACTER_SPRITE, facingFromAngle, firstFrameIndex } from './characterSprite';

describe('characterSprite', () => {
  it('déduit la direction dominante d\'un angle', () => {
    expect(facingFromAngle(0)).toBe('right');
    expect(facingFromAngle(Math.PI)).toBe('left');
    expect(facingFromAngle(Math.PI / 2)).toBe('down');
    expect(facingFromAngle(-Math.PI / 2)).toBe('up');
    expect(facingFromAngle(Math.PI / 6)).toBe('right'); // 30° vers le bas : horizontal dominant
  });

  it('place chaque animation sur sa ligne (down, left, right, up)', () => {
    expect(firstFrameIndex('idle', 'down')).toBe(0);
    expect(firstFrameIndex('idle', 'up')).toBe(3 * 8);
    expect(firstFrameIndex('walk', 'left')).toBe(5 * 8);
    expect(firstFrameIndex('cast', 'up')).toBe(15 * 8);
  });

  it('chaque animation tient sur une ligne du spritesheet', () => {
    for (const anim of Object.values(CHARACTER_ANIMATIONS)) {
      expect(anim.frames).toBeLessThanOrEqual(CHARACTER_SPRITE.columns);
    }
  });
});
