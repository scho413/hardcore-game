import Phaser from 'phaser';
import type { Hero } from '../data/heroes';
import { FACE_CROP, heroGrid, type Grid } from './heroLook';

function paint(ctx: CanvasRenderingContext2D, grid: Grid, ox = 0, oy = 0, w = 16, h = 16): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[oy + y]?.[ox + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function makeGridTexture(scene: Phaser.Scene, key: string, grid: Grid): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 16, 16);
  if (!tex) return;
  paint(tex.getContext(), grid);
  tex.refresh();
}

/** `hero-<id>` (전신)과 `face-<id>` (얼굴 아이콘) 텍스처를 준비. 외형은 바뀌지 않으므로 한 번만 만듦 */
export function ensureHeroTextures(scene: Phaser.Scene, hero: Hero): void {
  const body = `hero-${hero.id}`;
  const face = `face-${hero.id}`;
  if (scene.textures.exists(body) && scene.textures.exists(face)) return;
  const grid = heroGrid(hero);
  makeGridTexture(scene, body, grid);
  const [x, y, w, h] = FACE_CROP[hero.classId];
  const tex = scene.textures.createCanvas(face, w, h);
  if (!tex) return;
  paint(tex.getContext(), grid, x, y, w, h);
  tex.refresh();
}
