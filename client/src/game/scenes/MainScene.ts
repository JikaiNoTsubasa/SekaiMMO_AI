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
  private pointerMarker!: Phaser.GameObjects.Arc;
  private readonly worldBounds = { width: 3200, height: 3200 };
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
    this.add.grid(
      this.worldBounds.width / 2,
      this.worldBounds.height / 2,
      this.worldBounds.width,
      this.worldBounds.height,
      64,
      64,
      0x1f2238,
      0.15,
      0x1f2238,
      0.15
    );

    const startX = Phaser.Math.Clamp(this.options.initialPosition.x, 0, this.worldBounds.width);
    const startY = Phaser.Math.Clamp(this.options.initialPosition.y, 0, this.worldBounds.height);
    this.player = this.add.circle(startX, startY, 14, 0x4f9dff);
    this.player.setDepth(10);

    this.pointerMarker = this.add.circle(0, 0, 8, 0xffd166, 0.3);
    this.pointerMarker.setVisible(false);
    this.pointerMarker.setDepth(9);

    this.cameras.main.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.roundPixels = true;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const targetX = Phaser.Math.Clamp(pointer.worldX, 0, this.worldBounds.width);
      const targetY = Phaser.Math.Clamp(pointer.worldY, 0, this.worldBounds.height);
      this.moveTarget = new Phaser.Math.Vector2(targetX, targetY);
      this.pointerMarker.setPosition(this.moveTarget.x, this.moveTarget.y);
      this.pointerMarker.setVisible(true);
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
      this.pointerMarker.setVisible(false);
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.moveTarget.x,
      this.moveTarget.y
    );

    const velocity = speed * (delta / 1000);
    const nextX = this.player.x + Math.cos(angle) * velocity;
    const nextY = this.player.y + Math.sin(angle) * velocity;
    this.player.x = Phaser.Math.Clamp(nextX, 0, this.worldBounds.width);
    this.player.y = Phaser.Math.Clamp(nextY, 0, this.worldBounds.height);

    if (time - this.lastBroadcast > 180) {
      this.emitMovement(new Phaser.Math.Vector2(this.player.x, this.player.y));
      this.lastBroadcast = time;
    }
  }

  private emitMovement(position: Phaser.Math.Vector2) {
    const clampedX = Phaser.Math.Clamp(position.x, 0, this.worldBounds.width);
    const clampedY = Phaser.Math.Clamp(position.y, 0, this.worldBounds.height);
    this.options.socket.emit('player:move', {
      x: clampedX,
      y: clampedY
    });
  }

  private handlePlayerMoved(payload: MovementPayload) {
    if (payload.characterId === this.options.characterId) {
      return;
    }

    const clampedX = Phaser.Math.Clamp(payload.position.x, 0, this.worldBounds.width);
    const clampedY = Phaser.Math.Clamp(payload.position.y, 0, this.worldBounds.height);
    const existing = this.otherPlayers.get(payload.characterId);

    if (existing) {
      existing.setPosition(clampedX, clampedY);
      return;
    }

    const actor = this.add.circle(clampedX, clampedY, 12, 0xff6b6b);
    actor.setDepth(8);
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
