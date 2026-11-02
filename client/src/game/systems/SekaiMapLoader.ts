// Sekai Map Loader - Chargement et rendu des maps .sm (SekaiMapEditor)
// Layers : floor, behind (sous le joueur), front (au-dessus du joueur), collider, event
// SekaiMMO v2.0

import Phaser from 'phaser';
import type { MapData, PortalData } from '../types';
import {
  buildCollisionGrid,
  eventsToPortals,
  getSekaiLayer,
  parseSekaiEvents,
  parseSekaiMap,
  resolveTilesetImagePath,
  type SekaiAnimationFrame,
  type SekaiLayerId,
  type SekaiMap,
  type SekaiMapEvent,
} from '../maps/sekaiMap';

export interface SekaiMapLoaderConfig {
  mapBasePath: string; // Dossier des fichiers .sm
  tilesetBasePath: string; // Dossier des images de tilesets
  defaultTileSize: number;
}

// Layers rendus et leur profondeur (joueur = 10, monstres = 7)
const RENDERED_LAYERS: { id: SekaiLayerId; depth: number }[] = [
  { id: 'floor', depth: 0 },
  { id: 'behind', depth: 1 },
  { id: 'front', depth: 15 },
];

interface TileAnimationGroup {
  firstgid: number;
  frames: SekaiAnimationFrame[];
  tiles: Phaser.Tilemaps.Tile[];
  frameIndex: number;
  elapsed: number;
}

const mapCacheKey = (mapCode: string) => `sekai-map:${mapCode}`;
const tilesetTextureKey = (imagePath: string) => `sekai-tileset:${imagePath}`;

export class SekaiMapLoader {
  private scene: Phaser.Scene;
  private config: SekaiMapLoaderConfig;
  private map: SekaiMap | null = null;
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private layers: Map<SekaiLayerId, Phaser.Tilemaps.TilemapLayer> = new Map();
  private collisionGrid: Uint8Array | null = null;
  private events: SekaiMapEvent[] = [];
  private portals: PortalData[] = [];
  private animations: TileAnimationGroup[] = [];
  private proceduralObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, config?: Partial<SekaiMapLoaderConfig>) {
    this.scene = scene;
    this.config = {
      mapBasePath: config?.mapBasePath ?? 'maps/',
      tilesetBasePath: config?.tilesetBasePath ?? 'assets/tilesets/',
      defaultTileSize: config?.defaultTileSize ?? 16,
    };
  }

  /**
   * Précharge le fichier .sm puis, une fois lu, les images de ses tilesets.
   * À appeler dans preload().
   */
  preloadMap(mapCode: string): void {
    const key = mapCacheKey(mapCode);

    // Map déjà visitée : fichier et tilesets sont en cache
    if (this.scene.cache.json.exists(key)) return;

    this.scene.load.once(`filecomplete-json-${key}`, (_key: string, _type: string, data: unknown) => {
      try {
        const map = parseSekaiMap(data);
        for (const tileset of map.tilesets) {
          const path = resolveTilesetImagePath(tileset.image, this.config.tilesetBasePath);
          const textureKey = tilesetTextureKey(path);
          if (!this.scene.textures.exists(textureKey)) {
            this.scene.load.image(textureKey, path);
          }
        }
      } catch (error) {
        console.error(`[SekaiMapLoader] Invalid map file for "${mapCode}"`, error);
      }
    });

    this.scene.load.json(key, `${this.config.mapBasePath}${mapCode}.sm`);
  }

  /**
   * Crée la map préchargée. Retourne false si le fichier est absent ou invalide.
   * À appeler dans create().
   */
  createMap(mapCode: string): boolean {
    this.clearMap();

    const raw = this.scene.cache.json.get(mapCacheKey(mapCode));
    if (!raw) {
      console.error(`[SekaiMapLoader] Map "${mapCode}" not loaded (${this.config.mapBasePath}${mapCode}.sm)`);
      return false;
    }

    let map: SekaiMap;
    try {
      map = parseSekaiMap(raw);
    } catch (error) {
      console.error(`[SekaiMapLoader] Invalid map "${mapCode}"`, error);
      return false;
    }

    const tilemap = this.scene.make.tilemap({
      width: map.width,
      height: map.height,
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
    });

    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const tileset of map.tilesets) {
      const textureKey = tilesetTextureKey(resolveTilesetImagePath(tileset.image, this.config.tilesetBasePath));
      const added = tilemap.addTilesetImage(
        tileset.name,
        textureKey,
        tileset.tileWidth,
        tileset.tileHeight,
        tileset.margin ?? 0,
        tileset.spacing ?? 0,
        tileset.firstgid
      );
      if (added) {
        tilesets.push(added);
      } else {
        console.error(`[SekaiMapLoader] Tileset image missing: ${tileset.image} (texture ${textureKey})`);
      }
    }

    if (tilesets.length === 0) {
      console.error(`[SekaiMapLoader] No usable tileset for map "${mapCode}"`);
      tilemap.destroy();
      return false;
    }

    this.map = map;
    this.tilemap = tilemap;

    for (const { id, depth } of RENDERED_LAYERS) {
      this.createLayer(map, tilemap, tilesets, id, depth);
    }

    this.collisionGrid = buildCollisionGrid(map);
    this.events = parseSekaiEvents(map);
    this.portals = eventsToPortals(this.events, map.tileWidth, map.tileHeight);
    this.setupAnimations(map);

    console.log(
      `[SekaiMapLoader] Map "${mapCode}" loaded: ${map.width}x${map.height} tiles @ ${map.tileWidth}px, ` +
        `${this.events.length} events, ${this.portals.length} portals, ${this.animations.length} animated tiles`
    );
    return true;
  }

  private createLayer(
    map: SekaiMap,
    tilemap: Phaser.Tilemaps.Tilemap,
    tilesets: Phaser.Tilemaps.Tileset[],
    id: SekaiLayerId,
    depth: number
  ): void {
    const layerData = getSekaiLayer(map, id);
    if (!layerData) return;

    const layer = tilemap.createBlankLayer(id, tilesets, 0, 0, map.width, map.height);
    if (!layer) return;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const gid = layerData.data[y * map.width + x];
        if (gid > 0) {
          // Pas de recalcul des faces : les collisions passent par le layer collider
          layer.putTileAt(gid, x, y, false);
        }
      }
    }

    layer.setDepth(depth);
    layer.setAlpha(layerData.opacity ?? 1);
    layer.setVisible(layerData.visible !== false);
    this.layers.set(id, layer);
  }

  /**
   * Regroupe les tiles animées par id de tile (une animation partagée par toutes leurs occurrences)
   */
  private setupAnimations(map: SekaiMap): void {
    this.animations = [];

    for (const tileset of map.tilesets) {
      for (const definition of tileset.tiles ?? []) {
        const frames = definition.animation;
        if (!frames || frames.length < 2) continue;

        const gid = tileset.firstgid + definition.id;
        const tiles: Phaser.Tilemaps.Tile[] = [];
        this.layers.forEach((layer) => {
          layer.forEachTile((tile) => {
            if (tile.index === gid) tiles.push(tile);
          });
        });

        if (tiles.length > 0) {
          this.animations.push({ firstgid: tileset.firstgid, frames, tiles, frameIndex: 0, elapsed: 0 });
        }
      }
    }
  }

  /**
   * Fait avancer les animations de tiles. À appeler dans update().
   */
  update(delta: number): void {
    for (const anim of this.animations) {
      anim.elapsed += delta;

      let duration = anim.frames[anim.frameIndex].duration || 100;
      if (anim.elapsed < duration) continue;

      while (anim.elapsed >= duration) {
        anim.elapsed -= duration;
        anim.frameIndex = (anim.frameIndex + 1) % anim.frames.length;
        duration = anim.frames[anim.frameIndex].duration || 100;
      }

      const index = anim.firstgid + anim.frames[anim.frameIndex].tileid;
      for (const tile of anim.tiles) {
        tile.index = index;
      }
    }
  }

  /**
   * Crée une map procédurale simple (pour le développement sans fichier .sm)
   */
  createProceduralMap(mapData: MapData): void {
    this.clearMap();
    const { width, height } = mapData;
    const tileSize = this.config.defaultTileSize;

    const background = this.scene.add.graphics();
    background.setDepth(-1);
    background.fillStyle(0x1a1c2e);
    background.fillRect(0, 0, width, height);
    background.lineStyle(1, 0x2a2d45, 0.3);
    for (let x = 0; x <= width; x += tileSize) {
      background.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += tileSize) {
      background.lineBetween(0, y, width, y);
    }

    const borders = this.scene.add.graphics();
    borders.setDepth(100);
    borders.lineStyle(4, 0xff4444, 0.8);
    borders.strokeRect(0, 0, width, height);

    this.proceduralObjects.push(background, borders);
    this.portals = mapData.portals;
    this.drawPortals(this.portals);
  }

  /**
   * Dessine les zones de portail (maps procédurales)
   */
  private drawPortals(portals: PortalData[]): void {
    for (const portal of portals) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(5);
      graphics.fillStyle(0x6666ff, 0.4);
      graphics.fillRect(portal.x, portal.y, portal.width, portal.height);
      graphics.lineStyle(2, 0x8888ff, 0.8);
      graphics.strokeRect(portal.x, portal.y, portal.width, portal.height);

      this.scene.tweens.add({
        targets: graphics,
        alpha: { from: 0.4, to: 0.8 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.proceduralObjects.push(graphics);
    }
  }

  /**
   * Vérifie si une position (en pixels) est bloquée par le layer collider
   */
  checkCollision(x: number, y: number): boolean {
    if (!this.map || !this.collisionGrid) return false;

    const tileX = Math.floor(x / this.map.tileWidth);
    const tileY = Math.floor(y / this.map.tileHeight);
    if (tileX < 0 || tileY < 0 || tileX >= this.map.width || tileY >= this.map.height) {
      return true;
    }
    return this.collisionGrid[tileY * this.map.width + tileX] === 1;
  }

  /**
   * Affiche les tiles de collision et d'événements (debug)
   */
  showDebug(): void {
    if (!this.map || !this.collisionGrid) return;
    const { tileWidth, tileHeight, width } = this.map;

    const graphics = this.scene.add.graphics();
    graphics.setDepth(100);

    graphics.fillStyle(0xff0000, 0.35);
    this.collisionGrid.forEach((blocked, i) => {
      if (blocked) {
        graphics.fillRect((i % width) * tileWidth, Math.floor(i / width) * tileHeight, tileWidth, tileHeight);
      }
    });

    graphics.fillStyle(0xffff00, 0.35);
    for (const event of this.events) {
      graphics.fillRect(event.x * tileWidth, event.y * tileHeight, tileWidth, tileHeight);
    }
    this.proceduralObjects.push(graphics);
  }

  getPortals(): PortalData[] {
    return this.portals;
  }

  /**
   * Vérifie si une position est dans un portail
   */
  checkPortalCollision(x: number, y: number): PortalData | null {
    for (const portal of this.portals) {
      if (x >= portal.x && x <= portal.x + portal.width && y >= portal.y && y <= portal.y + portal.height) {
        return portal;
      }
    }
    return null;
  }

  getEvents(type?: SekaiMapEvent['eventType']): SekaiMapEvent[] {
    return type ? this.events.filter((e) => e.eventType === type) : this.events;
  }

  /**
   * Événement sur la tile qui contient la position (en pixels)
   */
  getEventAt(x: number, y: number): SekaiMapEvent | null {
    if (!this.map) return null;
    const tileX = Math.floor(x / this.map.tileWidth);
    const tileY = Math.floor(y / this.map.tileHeight);
    return this.events.find((e) => e.x === tileX && e.y === tileY) ?? null;
  }

  /**
   * Points de spawn (événements SPAWN), centrés sur leur tile.
   * Paramètre optionnel : { "spawnType": "player" }
   */
  getSpawnPoints(spawnType?: string): { x: number; y: number }[] {
    if (!this.map) return [];
    const { tileWidth, tileHeight } = this.map;
    return this.getEvents('SPAWN')
      .filter((e) => !spawnType || (e.parameters?.spawnType ?? 'player') === spawnType)
      .map((e) => ({ x: e.x * tileWidth + tileWidth / 2, y: e.y * tileHeight + tileHeight / 2 }));
  }

  getWidthInPixels(): number | null {
    return this.map ? this.map.width * this.map.tileWidth : null;
  }

  getHeightInPixels(): number | null {
    return this.map ? this.map.height * this.map.tileHeight : null;
  }

  getLayer(id: SekaiLayerId): Phaser.Tilemaps.TilemapLayer | null {
    return this.layers.get(id) ?? null;
  }

  /**
   * Nettoie la map actuelle
   */
  clearMap(): void {
    this.layers.forEach((layer) => layer.destroy());
    this.layers.clear();
    this.tilemap?.destroy();
    this.tilemap = null;
    this.map = null;
    this.collisionGrid = null;
    this.events = [];
    this.portals = [];
    this.animations = [];
    this.scene.tweens.killTweensOf(this.proceduralObjects);
    this.proceduralObjects.forEach((obj) => obj.destroy());
    this.proceduralObjects = [];
  }

  destroy(): void {
    this.clearMap();
  }
}
