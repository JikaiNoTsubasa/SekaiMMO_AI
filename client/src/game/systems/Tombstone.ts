// Tombstone - Tombe animée affichée à la place d'un personnage mort
// Texture générée par le code en attendant un sprite dessiné
// SekaiMMO v2.0

import Phaser from 'phaser';
import { CHARACTER_SPRITE } from './characterSprite';

const TEXTURE_KEY = 'tombstone';
const ANIM_KEY = 'tombstone-idle';
const FRAME_COUNT = 6;

export class Tombstone {
  /**
   * À appeler dans create() : la texture et l'animation survivent aux restart de la scène
   */
  static setup(scene: Phaser.Scene): void {
    const { frameWidth, frameHeight } = CHARACTER_SPRITE;

    if (!scene.textures.exists(TEXTURE_KEY)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      for (let frame = 0; frame < FRAME_COUNT; frame++) {
        Tombstone.drawFrame(g, frame * frameWidth, frame);
      }
      g.generateTexture(TEXTURE_KEY, frameWidth * FRAME_COUNT, frameHeight);
      g.destroy();

      const texture = scene.textures.get(TEXTURE_KEY);
      for (let frame = 0; frame < FRAME_COUNT; frame++) {
        texture.add(frame, 0, frame * frameWidth, 0, frameWidth, frameHeight);
      }
    }

    if (!scene.anims.exists(ANIM_KEY)) {
      scene.anims.create({
        key: ANIM_KEY,
        frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key: TEXTURE_KEY, frame })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  /**
   * Crée une tombe animée, ancrée aux pieds comme un personnage
   */
  static create(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(x, y, TEXTURE_KEY, 0);
    sprite.setOrigin(CHARACTER_SPRITE.originX, CHARACTER_SPRITE.originY);
    sprite.play(ANIM_KEY);
    return sprite;
  }

  private static drawFrame(g: Phaser.GameObjects.Graphics, offsetX: number, frame: number): void {
    const rect = (color: number, x: number, y: number, width: number, height: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(offsetX + x, y, width, height);
    };

    // Monticule de terre
    rect(0x4a3a2a, 8, 26, 16, 3);
    rect(0x5c4834, 10, 25, 12, 1);

    // Pierre tombale
    rect(0x8a8f9c, 11, 12, 10, 14);
    rect(0x8a8f9c, 12, 10, 8, 2);
    rect(0x6a6f7c, 19, 12, 2, 14);

    // Croix gravée
    rect(0x4f5360, 15, 14, 2, 8);
    rect(0x4f5360, 13, 16, 6, 2);

    // Reflet qui parcourt le haut de la pierre
    rect(0xc8ccd6, 12 + frame, 11, 2, 1);

    // Deux feux follets qui montent et s'estompent
    const wisp = (x: number, step: number) => {
      rect(0xbfe4ff, x + (step % 2), 22 - step * 3, 2, 2, 1 - step / FRAME_COUNT);
    };
    wisp(6, frame);
    wisp(24, (frame + 3) % FRAME_COUNT);
  }
}
