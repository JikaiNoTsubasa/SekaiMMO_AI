// Map File Service Tests - warps des maps .sm
// SekaiMMO v2.0

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(path.join(os.tmpdir(), 'sekai-maps-'));

const writeMap = (code: string, events: object[]) =>
  writeFileSync(
    path.join(dir, `${code}.sm`),
    JSON.stringify({
      version: '1.0.0',
      width: 10,
      height: 8,
      tileWidth: 16,
      tileHeight: 16,
      orientation: 'orthogonal',
      layers: [],
      tilesets: [],
      properties: [{ name: 'events', type: 'string', value: JSON.stringify(events) }],
    })
  );

let mapFileService: typeof import('../services/mapFileService').mapFileService;

beforeAll(async () => {
  writeMap('village', [
    { tileId: 1, x: 9, y: 4, eventType: 'WARP', parameters: { targetMap: 'forest', targetX: 1, targetY: 2 } },
    { tileId: 1, x: 0, y: 0, eventType: 'WARP', parameters: { targetMap: 'cave' } },
  ]);
  writeMap('forest', [{ tileId: 1, x: 3, y: 3, eventType: 'SPAWN', parameters: { spawnType: 'player' } }]);
  writeMap('cave', []);

  process.env.MAP_FILES_DIR = dir;
  ({ mapFileService } = await import('../services/mapFileService'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('mapFileService', () => {
  it('trouve le warp sur lequel se trouve le joueur', async () => {
    // Tile (9, 4) = pixels [144..160] x [64..80]
    const warp = await mapFileService.findWarp('village', 'forest', 150, 70);
    expect(warp).toMatchObject({ targetMapCode: 'forest', targetTileX: 1, targetTileY: 2 });
  });

  it('tolère une tile de décalage mais refuse un joueur loin du warp', async () => {
    expect(await mapFileService.findWarp('village', 'forest', 135, 70)).not.toBeNull();
    expect(await mapFileService.findWarp('village', 'forest', 40, 40)).toBeNull();
  });

  it('refuse un warp vers une autre map que celle demandée', async () => {
    expect(await mapFileService.findWarp('village', 'cave', 150, 70)).toBeNull();
  });

  it('calcule la position d\'arrivée : tile du warp > spawn joueur > centre', async () => {
    expect(await mapFileService.getArrivalPosition('forest', 1, 2)).toEqual({ x: 24, y: 40 });
    expect(await mapFileService.getArrivalPosition('forest', null, null)).toEqual({ x: 56, y: 56 });
    expect(await mapFileService.getArrivalPosition('cave', null, null)).toEqual({ x: 80, y: 64 });
  });

  it('ignore les codes de map invalides ou absents', async () => {
    expect(await mapFileService.getMap('../secret')).toBeNull();
    expect(await mapFileService.getMap('unknown')).toBeNull();
  });
});
