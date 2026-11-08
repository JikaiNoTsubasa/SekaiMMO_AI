import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';

import { MainScene, type PlayerStatus } from './scenes/MainScene';
import type { SkillData, SkillSlot } from './types';

interface CreateGameOptions {
  container: HTMLElement;
  socket: Socket;
  characterId: number;
  position: { x: number; y: number };
  onReward?: (payload: { drops: { itemId: number; quantity: number }[] }) => void;
  onSkillCast?: (slot: SkillSlot) => void;
  onWrongWeapon?: (skill: SkillData) => void;
  character?: PlayerStatus;
  onStatusChange?: (status: PlayerStatus) => void;
}

// Résolution de référence : le zoom est l'entier qui s'en rapproche le plus
const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;

/**
 * Taille logique et zoom pour remplir le conteneur sans étirement non entier
 * (sinon les pixels du jeu ont des tailles inégales à l'écran).
 * Le zoom est entier en pixels physiques : divisé par devicePixelRatio pour Phaser,
 * qui l'applique en pixels CSS (mise à l'échelle Windows 125 %, 150 %...).
 */
const ceilToEven = (value: number) => Math.ceil(value / 2) * 2;

const computeViewport = (container: HTMLElement) => {
  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.max(1, Math.round(container.clientWidth * dpr));
  const deviceHeight = Math.max(1, Math.round(container.clientHeight * dpr));
  const zoom = Math.max(1, Math.round(Math.min(deviceWidth / BASE_WIDTH, deviceHeight / BASE_HEIGHT)));
  return {
    // Taille paire : avec une taille impaire, le centre de la caméra tombe sur un demi-pixel
    // et le joueur et ses barres tremblent d'un pixel pendant la marche
    width: ceilToEven(deviceWidth / zoom),
    height: ceilToEven(deviceHeight / zoom),
    zoom: zoom / dpr,
  };
};

export const createSekaiGame = (options: CreateGameOptions) => {
  const viewport = computeViewport(options.container);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: viewport.width,
    height: viewport.height,
    parent: options.container,
    backgroundColor: '#0f111f',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: viewport.zoom,
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
        onWrongWeapon: options.onWrongWeapon,
        character: options.character,
        onStatusChange: options.onStatusChange,
      }),
    ],
  });

  // Suivre la taille du conteneur en gardant un zoom entier
  const observer = new ResizeObserver(() => {
    const { width, height, zoom } = computeViewport(options.container);
    game.scale.setZoom(zoom);
    game.scale.resize(width, height);
  });
  observer.observe(options.container);
  game.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());

  return game;
};
