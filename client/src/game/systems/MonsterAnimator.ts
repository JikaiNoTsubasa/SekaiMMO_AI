// Monster Animator - Spritesheet (Monster.iconUrl) et animations d'un monstre
// Format décrit dans GUIDE_RESSOURCES.md (section "Sprites des Monstres")
// SekaiMMO v2.0

import Phaser from 'phaser';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { FACING_ORDER, facingFromAngle, type Facing } from './characterSprite';

type MonsterAnimation = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

const PLACEHOLDER_KEY = 'monster-placeholder';
const FRAME_SIZE = 32;
const COLUMNS = 8;
// Point d'ancrage = pieds du monstre : centre horizontal, 3px au-dessus du bas (y = 29)
const ORIGIN_X = 0.5;
const ORIGIN_Y = 29 / FRAME_SIZE;
// Le serveur envoie les déplacements toutes les 200 ms : au-delà, le monstre s'est arrêté
const WALK_TIMEOUT_MS = 300;

// firstRow : ligne de la direction "down" ; les 3 suivantes = left, right, up
const ANIMATIONS: Record<MonsterAnimation, { firstRow: number; frames: number; frameRate: number; loop: boolean }> = {
  idle: { firstRow: 0, frames: 4, frameRate: 6, loop: true },
  walk: { firstRow: 4, frames: 6, frameRate: 10, loop: true },
  attack: { firstRow: 8, frames: 4, frameRate: 12, loop: false },
  hurt: { firstRow: 12, frames: 2, frameRate: 8, loop: false },
  death: { firstRow: 16, frames: 6, frameRate: 10, loop: false },
};

const animKey = (sheetKey: string, anim: MonsterAnimation, facing: Facing) => `${sheetKey}-${anim}-${facing}`;

export class MonsterAnimator {
  private facing: Facing = 'down';
  private sheetKey: string | null = null;
  private actionPlaying = false;
  private dead = false;
  private walkTimer: Phaser.Time.TimerEvent | null = null;

  /**
   * À appeler dans create() : crée le placeholder affiché sans spritesheet ou pendant son chargement
   */
  static setup(scene: Phaser.Scene): void {
    if (scene.textures.exists(PLACEHOLDER_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xaa4444);
    g.fillRect(8, 0, 16, FRAME_SIZE);
    g.generateTexture(PLACEHOLDER_KEY, FRAME_SIZE, FRAME_SIZE);
    g.destroy();
  }

  static createSprite(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
    return scene.add.sprite(x, y, PLACEHOLDER_KEY).setOrigin(ORIGIN_X, ORIGIN_Y);
  }

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    iconUrl: string | null | undefined
  ) {
    const url = resolveAssetUrl(iconUrl);
    if (url) this.loadSheet(url);
  }

  /**
   * Marche dans la direction de l'angle, puis repos sans nouveau déplacement
   * (une attaque ou un coup reçu en cours n'est pas interrompu)
   */
  walk(angle: number): void {
    if (this.dead) return;
    this.facing = facingFromAngle(angle);
    if (!this.actionPlaying) this.play('walk');

    this.walkTimer?.remove();
    this.walkTimer = this.sprite.scene.time.delayedCall(WALK_TIMEOUT_MS, () => {
      this.walkTimer = null;
      if (!this.actionPlaying && !this.dead) this.play('idle');
    });
  }

  /**
   * Attaque orientée vers la cible, puis retour au repos ou à la marche
   */
  attack(angle: number): void {
    if (this.dead) return;
    this.facing = facingFromAngle(angle);
    this.playAction('attack');
  }

  /**
   * Coup reçu (n'interrompt pas une attaque en cours)
   */
  hurt(): void {
    if (this.dead || this.actionPlaying) return;
    this.playAction('hurt');
  }

  /**
   * Joue la mort puis appelle onComplete (immédiatement si l'animation n'existe pas)
   */
  playDeath(onComplete: () => void): void {
    this.dead = true;
    this.walkTimer?.remove();
    this.walkTimer = null;
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onActionComplete, this);

    if (this.play('death')) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
    } else {
      onComplete();
    }
  }

  // Les monstres d'une map ne sont connus qu'après preload() : chargement à la volée
  private loadSheet(url: string): void {
    const scene = this.sprite.scene;
    const key = `monster:${url}`;
    // Le monstre peut mourir (ou la scène redémarrer) avant la fin du chargement
    const apply = () => {
      if (this.sprite.active) this.applySheet(key);
    };

    if (scene.textures.exists(key)) {
      apply();
      return;
    }

    scene.load.spritesheet(key, url, { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE });
    scene.load.once(`filecomplete-spritesheet-${key}`, apply);
    scene.load.start();
  }

  private applySheet(key: string): void {
    const { anims, textures } = this.sprite.scene;
    const frameCount = textures.get(key).frameTotal - 1; // -1 : frame __BASE
    if (frameCount < FACING_ORDER.length * COLUMNS) {
      console.warn(`[MonsterAnimator] ${key} trop petit : placeholder conservé`);
      return;
    }

    for (const anim of Object.keys(ANIMATIONS) as MonsterAnimation[]) {
      const config = ANIMATIONS[anim];
      for (const [offset, facing] of FACING_ORDER.entries()) {
        const fullKey = animKey(key, anim, facing);
        if (anims.exists(fullKey)) continue;

        const start = (config.firstRow + offset) * COLUMNS;
        const end = start + config.frames - 1;
        if (end >= frameCount) {
          console.warn(`[MonsterAnimator] Frames manquantes pour ${fullKey} (${start}-${end}), spritesheet trop petit`);
          continue;
        }

        anims.create({
          key: fullKey,
          frames: anims.generateFrameNumbers(key, { start, end }),
          frameRate: config.frameRate,
          repeat: config.loop ? -1 : 0,
        });
      }
    }

    this.sheetKey = key;
    this.sprite.setTexture(key, 0);
    this.play('idle');
  }

  private playAction(anim: 'attack' | 'hurt'): void {
    if (!this.play(anim)) return;

    this.actionPlaying = true;
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onActionComplete, this);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onActionComplete, this);
  }

  private onActionComplete(): void {
    this.actionPlaying = false;
    this.play(this.walkTimer ? 'walk' : 'idle');
  }

  private play(anim: MonsterAnimation): boolean {
    if (!this.sheetKey || !this.sprite.active) return false;

    const key = animKey(this.sheetKey, anim, this.facing);
    if (!this.sprite.scene.anims.exists(key)) return false;

    // Boucles : ne pas repartir de zéro à chaque appel ; actions : toujours relancées
    this.sprite.anims.play(key, ANIMATIONS[anim].loop);
    return true;
  }
}
