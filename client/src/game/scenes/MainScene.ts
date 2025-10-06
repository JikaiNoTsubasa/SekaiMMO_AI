import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';

interface MainSceneOptions {
  socket: Socket;
  characterId: number;
  initialPosition: { x: number; y: number };
  onReward?: (payload: { experience: number; drops: { itemId: number; quantity: number }[] }) => void;
}

interface MovementPayload {
  characterId: number;
  position: { x: number; y: number };
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  declare private readonly otherPlayers: Map<number, Phaser.GameObjects.Arc>;
  declare private moveTarget: Phaser.Math.Vector2 | null;
  declare private lastBroadcast: number;
  declare private readonly handlePlayerMovedListener: (payload: MovementPayload) => void;
  declare private readonly handleMonsterDefeatedListener: (payload: { monsterId: number; defeatedBy: number }) => void;
  declare private readonly handleSkillCastListener: (payload: { characterId: number; key: string }) => void;

  constructor(private readonly options: MainSceneOptions) {
    super('MainScene');
    this.otherPlayers = new Map();
    this.moveTarget = null;
    this.lastBroadcast = 0;
    this.handlePlayerMovedListener = (payload) => this.handlePlayerMoved(payload);
    this.handleMonsterDefeatedListener = (payload) => this.handleMonsterDefeated(payload);
    this.handleSkillCastListener = (payload) => this.handleSkillCast(payload);
  }

  create() {
    this.cameras.main.setBackgroundColor('#141625');
    this.add.grid(480, 270, 960, 540, 64, 64, 0x1f2238, 0.2, 0x1f2238, 0.2);

    this.player = this.add.circle(
      this.options.initialPosition.x,
      this.options.initialPosition.y,
      14,
      0x4f9dff
    );

    const pointerMarker = this.add.circle(0, 0, 8, 0xffd166, 0.3);
    pointerMarker.setVisible(false);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      pointerMarker.setPosition(this.moveTarget.x, this.moveTarget.y);
      pointerMarker.setVisible(true);
      this.emitMovement(this.moveTarget);
    });

    this.options.socket.on('player:moved', this.handlePlayerMovedListener);
    this.options.socket.on('monster:defeated', this.handleMonsterDefeatedListener);
    this.options.socket.on('player:skillCast', this.handleSkillCastListener);
    this.options.socket.on('player:reward', (payload) => this.options.onReward?.(payload));

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(time: number, delta: number) {
    if (!this.moveTarget) {
      return;
    }

    const speed = 180;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.moveTarget.x,
      this.moveTarget.y
    );

    if (distance < 4) {
      this.moveTarget = null;
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.moveTarget.x,
      this.moveTarget.y
    );

    const velocity = speed * (delta / 1000);
    this.player.x += Math.cos(angle) * velocity;
    this.player.y += Math.sin(angle) * velocity;

    if (time - this.lastBroadcast > 180) {
      this.emitMovement(new Phaser.Math.Vector2(this.player.x, this.player.y));
      this.lastBroadcast = time;
    }
  }

  private emitMovement(position: Phaser.Math.Vector2) {
    this.options.socket.emit('player:move', {
      x: position.x,
      y: position.y
    });
  }

  private handlePlayerMoved(payload: MovementPayload) {
    if (payload.characterId === this.options.characterId) {
      return;
    }

    const existing = this.otherPlayers.get(payload.characterId);

    if (existing) {
      existing.setPosition(payload.position.x, payload.position.y);
      return;
    }

    const actor = this.add.circle(payload.position.x, payload.position.y, 12, 0xff6b6b);
    this.otherPlayers.set(payload.characterId, actor);
  }

  private handleMonsterDefeated(_payload: { monsterId: number; defeatedBy: number }) {
    this.cameras.main.flash(120, 255, 255, 255);
  }

  private handleSkillCast(_payload: { characterId: number; key: string }) {
    this.cameras.main.shake(80, 0.002);
  }

  private cleanup() {
    this.options.socket.off('player:moved', this.handlePlayerMovedListener);
    this.options.socket.off('monster:defeated', this.handleMonsterDefeatedListener);
    this.options.socket.off('player:skillCast', this.handleSkillCastListener);
    this.otherPlayers.forEach((actor) => actor.destroy());
    this.otherPlayers.clear();
  }
}
