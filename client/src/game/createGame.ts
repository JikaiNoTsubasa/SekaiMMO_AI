import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';

import { MainScene } from './scenes/MainScene';
import type { SkillSlot } from './types';

interface CreateGameOptions {
  container: HTMLElement;
  socket: Socket;
  characterId: number;
  position: { x: number; y: number };
  onReward?: (payload: { experience: number; drops: { itemId: number; quantity: number }[] }) => void;
  onSkillCast?: (slot: SkillSlot) => void;
}

export const createSekaiGame = (options: CreateGameOptions) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: options.container,
    backgroundColor: '#0f111f',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    scene: [
      new MainScene({
        socket: options.socket,
        characterId: options.characterId,
        initialPosition: options.position,
        onReward: options.onReward,
        onSkillCast: options.onSkillCast,
      }),
    ],
  });
