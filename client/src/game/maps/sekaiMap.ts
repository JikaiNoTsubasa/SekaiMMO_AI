// Format de map Sekai (.sm) - produit par SekaiMapEditor
// Miroir de SekaiMapEditor/src/app/models/sekai-map.model.ts + helpers sans dépendance à Phaser
// SekaiMMO v2.0

import type { PortalData } from '../types';

export type SekaiLayerId = 'floor' | 'behind' | 'front' | 'collider' | 'event';

export interface SekaiMapLayer {
  id: SekaiLayerId;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  visible: boolean;
  opacity: number;
  // floor/behind/front/event : gid 1-based (0 = vide) ; collider : drapeaux 0/1
  data: number[];
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SekaiAnimationFrame {
  tileid: number; // Id local (0-based) dans le tileset
  duration: number; // ms
}

export interface SekaiTileDefinition {
  id: number; // Id local (0-based)
  animation?: SekaiAnimationFrame[];
}

export interface SekaiTileset {
  firstgid: number;
  name: string;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  columns: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
  margin?: number;
  spacing?: number;
  tiles?: SekaiTileDefinition[];
}

export interface SekaiMapProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface SekaiMap {
  version: string;
  width: number; // En tiles
  height: number; // En tiles
  tileWidth: number;
  tileHeight: number;
  orientation: 'orthogonal';
  layers: SekaiMapLayer[];
  tilesets: SekaiTileset[];
  properties?: SekaiMapProperty[];
}

export type SekaiEventType = 'WARP' | 'DIALOG' | 'TRIGGER' | 'SPAWN' | 'CUSTOM';

// Événement placé sur le layer "event" (coordonnées en tiles)
export interface SekaiMapEvent {
  tileId: number;
  x: number;
  y: number;
  eventType: SekaiEventType;
  eventName?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Valide la structure minimale d'un fichier .sm
 */
export function parseSekaiMap(raw: unknown): SekaiMap {
  const map = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<SekaiMap> | null;

  if (
    !map ||
    typeof map.width !== 'number' ||
    typeof map.height !== 'number' ||
    typeof map.tileWidth !== 'number' ||
    !Array.isArray(map.layers)
  ) {
    throw new Error('Invalid .sm map: missing width/height/tileWidth/layers');
  }

  return {
    ...map,
    tileHeight: map.tileHeight ?? map.tileWidth,
    tilesets: map.tilesets ?? [],
  } as SekaiMap;
}

export function getSekaiLayer(map: SekaiMap, id: SekaiLayerId): SekaiMapLayer | undefined {
  return map.layers.find((layer) => layer.id === id);
}

/**
 * Grille de collision (1 = bloquant), indexée y * width + x
 */
export function buildCollisionGrid(map: SekaiMap): Uint8Array {
  const grid = new Uint8Array(map.width * map.height);
  const data = getSekaiLayer(map, 'collider')?.data ?? [];
  for (let i = 0; i < grid.length && i < data.length; i++) {
    grid[i] = data[i] ? 1 : 0;
  }
  return grid;
}

/**
 * Les événements sont stockés dans la propriété de map "events" (JSON sérialisé)
 */
export function parseSekaiEvents(map: SekaiMap): SekaiMapEvent[] {
  const prop = map.properties?.find((p) => p.name === 'events');
  if (!prop?.value) return [];

  try {
    const events = typeof prop.value === 'string' ? JSON.parse(prop.value) : prop.value;
    return Array.isArray(events)
      ? events.filter((e): e is SekaiMapEvent => typeof e?.x === 'number' && typeof e?.y === 'number' && !!e?.eventType)
      : [];
  } catch (error) {
    console.error('[SekaiMap] Failed to parse events', error);
    return [];
  }
}

/**
 * Événements WARP -> portails (zone = la tile de l'événement)
 * Paramètres attendus : { "targetMap": "code_de_la_map" } (alias : targetMapCode, map)
 */
export function eventsToPortals(events: SekaiMapEvent[], tileWidth: number, tileHeight: number): PortalData[] {
  const portals: PortalData[] = [];
  for (const event of events) {
    if (event.eventType !== 'WARP') continue;

    const params = event.parameters ?? {};
    const target = params.targetMap ?? params.targetMapCode ?? params.map;
    if (typeof target !== 'string' || !target) {
      console.warn(`[SekaiMap] WARP event at (${event.x}, ${event.y}) has no "targetMap" parameter`);
      continue;
    }

    portals.push({
      targetMapCode: target,
      x: event.x * tileWidth,
      y: event.y * tileHeight,
      width: tileWidth,
      height: tileHeight,
    });
  }
  return portals;
}

/**
 * L'éditeur enregistre son propre chemin d'image (ex: "assets/SunnysideWorld.png") :
 * le client cherche le fichier du même nom dans son dossier de tilesets
 */
export function resolveTilesetImagePath(image: string, tilesetBasePath: string): string {
  const fileName = image.split(/[\\/]/).pop() ?? image;
  return `${tilesetBasePath}${fileName}`;
}
