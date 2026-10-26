// Tiled Map Loader - Chargement et rendu des maps Tiled
// Support des fichiers JSON exportés par Tiled Map Editor
// SekaiMMO v2.0

import Phaser from 'phaser';
import type { MapData, PortalData } from '../types';

// Types pour les données Tiled
export interface TiledMapData {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

export interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup' | 'imagelayer';
  data?: number[];
  objects?: TiledObject[];
  visible: boolean;
  opacity: number;
  width?: number;
  height?: number;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  properties?: TiledProperty[];
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image: string;
  imagewidth: number;
  imageheight: number;
}

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

// Configuration du loader
export interface MapLoaderConfig {
  basePath: string; // Chemin vers les assets des maps
  defaultTileSize: number;
}

export class TiledMapLoader {
  private scene: Phaser.Scene;
  private config: MapLoaderConfig;
  private currentMap: Phaser.Tilemaps.Tilemap | null = null;
  private layers: Map<string, Phaser.Tilemaps.TilemapLayer> = new Map();
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private portals: PortalData[] = [];
  private spawnPoints: { x: number; y: number; type: string }[] = [];

  constructor(scene: Phaser.Scene, config?: Partial<MapLoaderConfig>) {
    this.scene = scene;
    this.config = {
      basePath: config?.basePath ?? 'assets/maps/',
      defaultTileSize: config?.defaultTileSize ?? 32,
    };
  }

  /**
   * Précharge les assets d'une map
   */
  preloadMap(mapCode: string, tiledFile: string): void {
    const mapPath = `${this.config.basePath}${tiledFile}`;
    this.scene.load.tilemapTiledJSON(mapCode, mapPath);
  }

  /**
   * Précharge un tileset
   */
  preloadTileset(name: string, imagePath: string): void {
    this.scene.load.image(name, `${this.config.basePath}${imagePath}`);
  }

  /**
   * Charge et crée la map
   */
  createMap(mapCode: string, tilesetConfigs: { name: string; key: string }[]): Phaser.Tilemaps.Tilemap | null {
    // Créer la tilemap
    const map = this.scene.make.tilemap({ key: mapCode });
    if (!map) {
      console.error(`Failed to load map: ${mapCode}`);
      return null;
    }

    this.currentMap = map;

    // Ajouter les tilesets
    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const config of tilesetConfigs) {
      const tileset = map.addTilesetImage(config.name, config.key);
      if (tileset) {
        tilesets.push(tileset);
      }
    }

    if (tilesets.length === 0) {
      console.error('No tilesets loaded');
      return null;
    }

    // Créer les layers
    this.createLayers(map, tilesets);

    // Parser les objets (portails, spawns, etc.)
    this.parseObjectLayers(map);

    return map;
  }

  /**
   * Crée une map procédurale simple (pour le développement sans assets)
   */
  createProceduralMap(mapData: MapData): void {
    const { width, height } = mapData;
    const tileSize = this.config.defaultTileSize;

    // Créer un tilemap vide
    const map = this.scene.make.tilemap({
      width: Math.ceil(width / tileSize),
      height: Math.ceil(height / tileSize),
      tileWidth: tileSize,
      tileHeight: tileSize,
    });

    this.currentMap = map;

    // Dessiner une grille de fond
    this.drawGridBackground(width, height, tileSize);

    // Dessiner les bordures
    this.drawMapBorders(width, height);

    // Dessiner les portails
    this.drawPortals(mapData.portals);

    // Stocker les portails
    this.portals = mapData.portals;
  }

  /**
   * Crée les layers de la tilemap
   */
  private createLayers(map: Phaser.Tilemaps.Tilemap, tilesets: Phaser.Tilemaps.Tileset[]): void {
    this.layers.clear();

    // Créer chaque layer
    for (const layerData of map.layers) {
      const layer = map.createLayer(layerData.name, tilesets);
      if (layer) {
        this.layers.set(layerData.name, layer);

        // Configurer le layer de collision
        if (layerData.name.toLowerCase().includes('collision')) {
          this.collisionLayer = layer;
          layer.setCollisionByExclusion([-1, 0]);
          layer.setVisible(false); // Cacher le layer de collision
        }

        // Configurer la profondeur
        if (layerData.name.toLowerCase().includes('above') || layerData.name.toLowerCase().includes('overlay')) {
          layer.setDepth(20);
        } else if (layerData.name.toLowerCase().includes('ground') || layerData.name.toLowerCase().includes('floor')) {
          layer.setDepth(0);
        } else {
          layer.setDepth(1);
        }
      }
    }
  }

  /**
   * Parse les layers d'objets
   */
  private parseObjectLayers(map: Phaser.Tilemaps.Tilemap): void {
    this.portals = [];
    this.spawnPoints = [];

    // Parcourir les object layers
    const objectLayers = map.getObjectLayer('objects') ?? map.getObjectLayer('Objects');
    if (!objectLayers) return;

    for (const obj of objectLayers.objects) {
      const type = obj.type?.toLowerCase() ?? obj.name?.toLowerCase() ?? '';

      if (type === 'portal' || type === 'teleport') {
        // Parser un portail
        const targetMap = this.getObjectProperty(obj, 'targetMap') as string;
        if (targetMap) {
          this.portals.push({
            targetMapCode: targetMap,
            x: obj.x ?? 0,
            y: obj.y ?? 0,
            width: obj.width ?? 32,
            height: obj.height ?? 32,
          });
        }
      } else if (type === 'spawn' || type === 'spawnpoint') {
        // Parser un point de spawn
        const spawnType = this.getObjectProperty(obj, 'spawnType') as string ?? 'player';
        this.spawnPoints.push({
          x: obj.x ?? 0,
          y: obj.y ?? 0,
          type: spawnType,
        });
      }
    }
  }

  /**
   * Récupère une propriété d'un objet Tiled
   */
  private getObjectProperty(obj: Phaser.Types.Tilemaps.TiledObject, name: string): unknown {
    if (!obj.properties) return undefined;

    for (const prop of obj.properties) {
      if (prop.name === name) {
        return prop.value;
      }
    }
    return undefined;
  }

  /**
   * Dessine une grille de fond
   */
  private drawGridBackground(width: number, height: number, tileSize: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(-1);

    // Couleur de fond
    graphics.fillStyle(0x1a1c2e);
    graphics.fillRect(0, 0, width, height);

    // Lignes de grille
    graphics.lineStyle(1, 0x2a2d45, 0.3);

    // Lignes verticales
    for (let x = 0; x <= width; x += tileSize) {
      graphics.lineBetween(x, 0, x, height);
    }

    // Lignes horizontales
    for (let y = 0; y <= height; y += tileSize) {
      graphics.lineBetween(0, y, width, y);
    }
  }

  /**
   * Dessine les bordures de la map
   */
  private drawMapBorders(width: number, height: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(100);

    graphics.lineStyle(4, 0xff4444, 0.8);
    graphics.strokeRect(0, 0, width, height);
  }

  /**
   * Dessine les portails
   */
  private drawPortals(portals: PortalData[]): void {
    for (const portal of portals) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(5);

      // Effet de portail
      graphics.fillStyle(0x6666ff, 0.4);
      graphics.fillRect(portal.x, portal.y, portal.width, portal.height);

      graphics.lineStyle(2, 0x8888ff, 0.8);
      graphics.strokeRect(portal.x, portal.y, portal.width, portal.height);

      // Animation de pulsation
      this.scene.tweens.add({
        targets: graphics,
        alpha: { from: 0.4, to: 0.8 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * Vérifie la collision à une position
   */
  checkCollision(x: number, y: number): boolean {
    if (!this.collisionLayer || !this.currentMap) return false;

    const tile = this.collisionLayer.getTileAtWorldXY(x, y);
    return tile !== null && tile.index !== -1 && tile.index !== 0;
  }

  /**
   * Récupère le layer de collision
   */
  getCollisionLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.collisionLayer;
  }

  /**
   * Récupère les portails
   */
  getPortals(): PortalData[] {
    return this.portals;
  }

  /**
   * Vérifie si une position est dans un portail
   */
  checkPortalCollision(x: number, y: number): PortalData | null {
    for (const portal of this.portals) {
      if (
        x >= portal.x &&
        x <= portal.x + portal.width &&
        y >= portal.y &&
        y <= portal.y + portal.height
      ) {
        return portal;
      }
    }
    return null;
  }

  /**
   * Récupère les points de spawn
   */
  getSpawnPoints(type?: string): { x: number; y: number }[] {
    if (type) {
      return this.spawnPoints.filter((s) => s.type === type);
    }
    return this.spawnPoints;
  }

  /**
   * Récupère un point de spawn aléatoire
   */
  getRandomSpawnPoint(type?: string): { x: number; y: number } | null {
    const points = this.getSpawnPoints(type);
    if (points.length === 0) return null;
    return points[Math.floor(Math.random() * points.length)];
  }

  /**
   * Récupère la map actuelle
   */
  getCurrentMap(): Phaser.Tilemaps.Tilemap | null {
    return this.currentMap;
  }

  /**
   * Récupère un layer par nom
   */
  getLayer(name: string): Phaser.Tilemaps.TilemapLayer | null {
    return this.layers.get(name) ?? null;
  }

  /**
   * Nettoie la map actuelle
   */
  clearMap(): void {
    this.layers.forEach((layer) => layer.destroy());
    this.layers.clear();
    this.currentMap?.destroy();
    this.currentMap = null;
    this.collisionLayer = null;
    this.portals = [];
    this.spawnPoints = [];
  }

  /**
   * Détruit le loader
   */
  destroy(): void {
    this.clearMap();
  }
}
