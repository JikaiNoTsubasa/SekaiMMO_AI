// Format du spritesheet des personnages (32x32) - source de vérité pour GUIDE_RESSOURCES.md
// Sans dépendance à Phaser (testable)
// SekaiMMO v2.0

export type Facing = 'down' | 'left' | 'right' | 'up';
export type CharacterAnimation = 'idle' | 'walk' | 'attack' | 'cast';

// Ordre des directions dans le spritesheet (une ligne par direction)
export const FACING_ORDER: Facing[] = ['down', 'left', 'right', 'up'];

// Spritesheet : frames de 32x32, 8 colonnes, une ligne par (animation, direction)
export const CHARACTER_SPRITE = {
  key: 'character',
  path: 'assets/sprites/characters/base_character.png',
  frameWidth: 32,
  frameHeight: 32,
  columns: 8,
  // Point d'ancrage = pieds du personnage : centre horizontal, 3px au-dessus du bas (y = 29)
  originX: 0.5,
  originY: 29 / 32,
} as const;

// firstRow : ligne de la direction "down" ; les 3 suivantes = left, right, up
export const CHARACTER_ANIMATIONS: Record<
  CharacterAnimation,
  { firstRow: number; frames: number; frameRate: number; loop: boolean }
> = {
  idle: { firstRow: 0, frames: 4, frameRate: 6, loop: true },
  walk: { firstRow: 4, frames: 6, frameRate: 10, loop: true },
  attack: { firstRow: 8, frames: 4, frameRate: 12, loop: false },
  cast: { firstRow: 12, frames: 4, frameRate: 10, loop: false },
};

/**
 * Direction dominante d'un angle (radians, convention Phaser : 0 = droite, PI/2 = bas)
 */
export function facingFromAngle(angle: number): Facing {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (Math.abs(cos) > Math.abs(sin)) {
    return cos > 0 ? 'right' : 'left';
  }
  return sin > 0 ? 'down' : 'up';
}

/**
 * Index de la première frame d'une animation pour une direction
 */
export function firstFrameIndex(anim: CharacterAnimation, facing: Facing): number {
  const row = CHARACTER_ANIMATIONS[anim].firstRow + FACING_ORDER.indexOf(facing);
  return row * CHARACTER_SPRITE.columns;
}
