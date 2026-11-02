// Map File Service - Lecture des maps .sm (SekaiMapEditor) côté serveur
// Sert à valider les warps et à calculer les positions d'arrivée

import { promises as fs } from 'fs';
import path from 'path';

import { appConfig } from '../config/env';

// Sous-ensemble du format .sm utile au serveur (voir client/src/game/maps/sekaiMap.ts)
interface SekaiMapFile {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  properties?: { name: string; value: unknown }[];
}

interface SekaiMapEvent {
  x: number;
  y: number;
  eventType: string;
  eventName?: string;
  parameters?: Record<string, unknown>;
}

export interface LoadedMapFile {
  width: number; // En pixels
  height: number; // En pixels
  tileWidth: number;
  tileHeight: number;
  events: SekaiMapEvent[];
}

export interface MapWarp {
  targetMapCode: string;
  // Tile d'arrivée (optionnelle) dans la map cible
  targetTileX: number | null;
  targetTileY: number | null;
  // Zone du warp en pixels
  x: number;
  y: number;
  width: number;
  height: number;
}

// Seules les maps trouvées sont mises en cache : un fichier ajouté plus tard sera lu
const cache = new Map<string, LoadedMapFile>();

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function parseEvents(map: SekaiMapFile): SekaiMapEvent[] {
  const prop = map.properties?.find((p) => p.name === 'events');
  if (!prop?.value) return [];
  try {
    const events = typeof prop.value === 'string' ? JSON.parse(prop.value) : prop.value;
    return Array.isArray(events)
      ? events.filter((e) => typeof e?.x === 'number' && typeof e?.y === 'number' && e?.eventType)
      : [];
  } catch {
    return [];
  }
}

export const mapFileService = {
  /**
   * Charge (et met en cache) le fichier <mapCode>.sm. Retourne null s'il n'existe pas.
   */
  async getMap(mapCode: string): Promise<LoadedMapFile | null> {
    const cached = cache.get(mapCode);
    if (cached) return cached;

    // Le code vient du client : interdire toute sortie du dossier des maps
    if (!/^[\w-]+$/.test(mapCode)) return null;

    const filePath = path.join(appConfig.mapFilesDir, `${mapCode}.sm`);
    let loaded: LoadedMapFile | null = null;

    try {
      const map = JSON.parse(await fs.readFile(filePath, 'utf-8')) as SekaiMapFile;
      const tileHeight = map.tileHeight ?? map.tileWidth;
      loaded = {
        width: map.width * map.tileWidth,
        height: map.height * tileHeight,
        tileWidth: map.tileWidth,
        tileHeight,
        events: parseEvents(map),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[mapFileService] Failed to read ${filePath}`, error);
      }
    }

    if (loaded) cache.set(mapCode, loaded);
    return loaded;
  },

  /**
   * Warps (événements WARP) d'une map
   * Paramètres : { "targetMap": "code", "targetX": 10, "targetY": 5 } (targetX/Y en tiles, optionnels)
   */
  async getWarps(mapCode: string): Promise<MapWarp[]> {
    const map = await this.getMap(mapCode);
    if (!map) return [];

    const warps: MapWarp[] = [];
    for (const event of map.events) {
      if (event.eventType !== 'WARP') continue;
      const params = event.parameters ?? {};
      const target = params.targetMap ?? params.targetMapCode ?? params.map;
      if (typeof target !== 'string' || !target) continue;

      warps.push({
        targetMapCode: target,
        targetTileX: toNumber(params.targetX),
        targetTileY: toNumber(params.targetY),
        x: event.x * map.tileWidth,
        y: event.y * map.tileHeight,
        width: map.tileWidth,
        height: map.tileHeight,
      });
    }
    return warps;
  },

  /**
   * Trouve le warp vers targetMapCode proche de la position du joueur.
   * Tolérance d'une tile : la position serveur a jusqu'à ~100ms de retard sur le client.
   */
  async findWarp(mapCode: string, targetMapCode: string, x: number, y: number): Promise<MapWarp | null> {
    const warps = await this.getWarps(mapCode);
    let best: { warp: MapWarp; distance: number } | null = null;

    for (const warp of warps) {
      if (warp.targetMapCode !== targetMapCode) continue;

      // Distance entre le point et le rectangle du warp
      const dx = Math.max(warp.x - x, 0, x - (warp.x + warp.width));
      const dy = Math.max(warp.y - y, 0, y - (warp.y + warp.height));
      const distance = Math.hypot(dx, dy);

      if (distance <= Math.max(warp.width, warp.height) && (!best || distance < best.distance)) {
        best = { warp, distance };
      }
    }
    return best?.warp ?? null;
  },

  /**
   * Position d'arrivée (en pixels) dans une map :
   * tile explicite du warp > premier SPAWN joueur > centre de la map
   */
  async getArrivalPosition(
    mapCode: string,
    tileX: number | null,
    tileY: number | null
  ): Promise<{ x: number; y: number } | null> {
    const map = await this.getMap(mapCode);
    if (!map) return null;

    const tileCenter = (tx: number, ty: number) => ({
      x: tx * map.tileWidth + map.tileWidth / 2,
      y: ty * map.tileHeight + map.tileHeight / 2,
    });

    if (tileX !== null && tileY !== null) {
      return tileCenter(tileX, tileY);
    }

    const spawn = map.events.find(
      (e) => e.eventType === 'SPAWN' && (e.parameters?.spawnType ?? 'player') === 'player'
    );
    if (spawn) {
      return tileCenter(spawn.x, spawn.y);
    }

    return { x: map.width / 2, y: map.height / 2 };
  },

  /**
   * Vide le cache (ex: après mise à jour des fichiers de maps)
   */
  clearCache(): void {
    cache.clear();
  },
};
