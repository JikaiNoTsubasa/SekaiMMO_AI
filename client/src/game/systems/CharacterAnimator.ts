// Character Animator - Spritesheet et animations des personnages (joueurs)
// Format décrit dans GUIDE_RESSOURCES.md (section "Sprites des Personnages")
// SekaiMMO v2.0

import Phaser from 'phaser';
import {
  CHARACTER_ANIMATIONS,
  CHARACTER_SPRITE,
  FACING_ORDER,
  facingFromAngle,
  firstFrameIndex,
  type CharacterAnimation,
  type Facing,
} from './characterSprite';

export type { CharacterAnimation, Facing } from './characterSprite';

const PLACEHOLDER_KEY = 'character-placeholder';
// Durée max d'une animation d'attaque (raccourcie si la vitesse d'attaque est élevée)
const MAX_ATTACK_ANIM_MS = 400;

const animKey = (anim: CharacterAnimation, facing: Facing) => `character-${anim}-${facing}`;

export class CharacterAnimator {
  private static spritesheetAvailable = false;

  private facing: Facing = 'down';
  private actionPlaying = false;

  constructor(private readonly sprite: Phaser.GameObjects.Sprite) {
    this.idle();
  }

  /**
   * À appeler dans preload()
   */
  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(CHARACTER_SPRITE.key)) return;
    scene.load.spritesheet(CHARACTER_SPRITE.key, CHARACTER_SPRITE.path, {
      frameWidth: CHARACTER_SPRITE.frameWidth,
      frameHeight: CHARACTER_SPRITE.frameHeight,
    });
  }

  /**
   * À appeler dans create() : crée les animations, ou un placeholder si le spritesheet est absent
   */
  static setup(scene: Phaser.Scene): void {
    if (!scene.textures.exists(PLACEHOLDER_KEY)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff);
      // Silhouette 16x29 dans une frame 32x32, pieds sur la ligne 29
      g.fillRect(8, 0, 16, 29);
      g.generateTexture(PLACEHOLDER_KEY, CHARACTER_SPRITE.frameWidth, CHARACTER_SPRITE.frameHeight);
      g.destroy();
    }

    CharacterAnimator.spritesheetAvailable = scene.textures.exists(CHARACTER_SPRITE.key);
    if (!CharacterAnimator.spritesheetAvailable) {
      console.warn(`[CharacterAnimator] ${CHARACTER_SPRITE.path} introuvable : placeholder utilisé`);
      return;
    }

    const frameCount = scene.textures.get(CHARACTER_SPRITE.key).frameTotal - 1; // -1 : frame __BASE
    for (const anim of Object.keys(CHARACTER_ANIMATIONS) as CharacterAnimation[]) {
      const config = CHARACTER_ANIMATIONS[anim];
      for (const facing of FACING_ORDER) {
        const key = animKey(anim, facing);
        if (scene.anims.exists(key)) continue;

        const start = firstFrameIndex(anim, facing);
        const end = start + config.frames - 1;
        if (end >= frameCount) {
          console.warn(`[CharacterAnimator] Frames manquantes pour ${key} (${start}-${end}), spritesheet trop petit`);
          continue;
        }

        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(CHARACTER_SPRITE.key, { start, end }),
          frameRate: config.frameRate,
          repeat: config.loop ? -1 : 0,
        });
      }
    }
  }

  /**
   * Crée le sprite d'un personnage (spritesheet ou placeholder teinté)
   */
  static createSprite(
    scene: Phaser.Scene,
    x: number,
    y: number,
    placeholderColor: number
  ): Phaser.GameObjects.Sprite {
    const sprite = CharacterAnimator.spritesheetAvailable
      ? scene.add.sprite(x, y, CHARACTER_SPRITE.key, 0)
      : scene.add.sprite(x, y, PLACEHOLDER_KEY).setTint(placeholderColor);
    sprite.setOrigin(CHARACTER_SPRITE.originX, CHARACTER_SPRITE.originY);
    return sprite;
  }

  getFacing(): Facing {
    return this.facing;
  }

  /**
   * Marche dans la direction de l'angle (interrompt une attaque en cours)
   */
  walk(angle: number): void {
    this.facing = facingFromAngle(angle);
    this.actionPlaying = false;
    this.play('walk');
  }

  /**
   * Repos (n'interrompt pas une attaque/un sort en cours)
   */
  idle(): void {
    if (this.actionPlaying) return;
    this.play('idle');
  }

  /**
   * Attaque ou sort orienté vers la cible, puis retour au repos
   */
  playAction(anim: 'attack' | 'cast', angle: number, maxDurationMs: number = MAX_ATTACK_ANIM_MS): void {
    this.facing = facingFromAngle(angle);
    if (!this.play(anim, Math.min(maxDurationMs, MAX_ATTACK_ANIM_MS))) return;

    this.actionPlaying = true;
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onActionComplete, this);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onActionComplete, this);
  }

  private onActionComplete(): void {
    this.actionPlaying = false;
    this.play('idle');
  }

  private play(anim: CharacterAnimation, durationMs?: number): boolean {
    const key = animKey(anim, this.facing);
    if (!this.sprite.scene?.anims.exists(key)) return false;

    if (durationMs !== undefined) {
      // Animation d'action : toujours relancée, durée ajustée à la cadence
      this.sprite.anims.play({ key, duration: durationMs });
    } else {
      this.sprite.anims.play(key, true);
    }
    return true;
  }
}
