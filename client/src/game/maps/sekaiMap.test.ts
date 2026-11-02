import { describe, expect, it } from 'vitest';
import {
  buildCollisionGrid,
  eventsToPortals,
  parseSekaiEvents,
  parseSekaiMap,
  resolveTilesetImagePath,
  type SekaiMap,
} from './sekaiMap';

// Map 3x2 telle qu'exportée par SekaiMapEditor (exportToSekaiMap)
const layer = (id: string, data: number[]) => ({
  id,
  name: id,
  type: 'tilelayer',
  visible: true,
  opacity: 1,
  data,
  width: 3,
  height: 2,
  x: 0,
  y: 0,
});

const sampleMap = {
  version: '1.0.0',
  width: 3,
  height: 2,
  tileWidth: 16,
  tileHeight: 16,
  orientation: 'orthogonal',
  layers: [
    layer('floor', [1, 1, 1, 1, 1, 1]),
    layer('behind', [0, 5, 0, 0, 0, 0]),
    layer('front', [0, 0, 0, 0, 0, 9]),
    layer('collider', [0, 1, 0, 0, 0, 1]),
    layer('event', [0, 0, 3, 0, 0, 0]),
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'tileset',
      tileWidth: 16,
      tileHeight: 16,
      tileCount: 100,
      columns: 10,
      image: 'assets/SunnysideWorld.png',
      imageWidth: 160,
      imageHeight: 160,
    },
  ],
  properties: [
    {
      name: 'events',
      type: 'string',
      value: JSON.stringify([
        { tileId: 3, x: 2, y: 0, eventType: 'WARP', eventName: 'to_forest', parameters: { targetMap: 'forest' } },
        { tileId: 3, x: 0, y: 1, eventType: 'DIALOG', eventName: 'sign' },
      ]),
    },
  ],
};

describe('sekaiMap', () => {
  it('parse un fichier .sm (objet ou texte JSON)', () => {
    expect(parseSekaiMap(sampleMap).width).toBe(3);
    expect(parseSekaiMap(JSON.stringify(sampleMap)).layers).toHaveLength(5);
    expect(() => parseSekaiMap({ foo: 1 })).toThrow();
  });

  it('construit la grille de collision depuis le layer collider', () => {
    const grid = buildCollisionGrid(parseSekaiMap(sampleMap));
    expect(Array.from(grid)).toEqual([0, 1, 0, 0, 0, 1]);
  });

  it('lit les événements et convertit les WARP en portails (coordonnées en pixels)', () => {
    const map: SekaiMap = parseSekaiMap(sampleMap);
    const events = parseSekaiEvents(map);
    expect(events).toHaveLength(2);
    expect(eventsToPortals(events, 16, 16)).toEqual([
      { targetMapCode: 'forest', x: 32, y: 0, width: 16, height: 16 },
    ]);
  });

  it('résout l\'image du tileset dans le dossier du client', () => {
    expect(resolveTilesetImagePath('assets/SunnysideWorld.png', 'assets/tilesets/')).toBe(
      'assets/tilesets/SunnysideWorld.png'
    );
  });
});
