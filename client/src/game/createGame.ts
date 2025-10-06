import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';

import { MainScene } from './scenes/MainScene';

interface CreateGameOptions {
  container: HTMLElement;
  socket: Socket;
  characterId: number;
  position: { x: number; y: number };
  onReward?: (payload: { experience: number; drops: { itemId: number; quantity: number }[] }) => void;
}

export const createSekaiGame = (options: CreateGameOptions) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: options.container,
    backgroundColor: '#0f111f',
    physics: {
      default: 'arcade'
    },
    scene: [
      new MainScene({
        socket: options.socket,
        characterId: options.characterId,
        initialPosition: options.position,
        onReward: options.onReward
      })
    ]
  });
