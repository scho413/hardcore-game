import Phaser from 'phaser';
import type { Hero } from '../data/heroes';
import { GRADES, WEAPON_TYPES } from '../data/items';
import { FACE_CROP, heroGrid, lookSignature, type Grid, type HeldWeapon } from './heroArt';

function paint(ctx: CanvasRenderingContext2D, grid: Grid, ox = 0, oy = 0, w = grid[0].length, h = grid.length): void {
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
  const tex = scene.textures.createCanvas(key, grid[0].length, grid.length);
  if (!tex) return;
  paint(tex.getContext(), grid);
  tex.refresh();
}

/** 연습용 무기 색 (나무) */
const PRACTICE_COLOR = '#9a7a52';

export function heldWeapon(hero: Hero): HeldWeapon | undefined {
  const w = hero.weapon;
  // 무기를 안 줬으면 연습용 무기 (나무색, 능력치 없음)
  if (!w) return { art: WEAPON_TYPES[hero.classId].art, color: PRACTICE_COLOR, glow: false };
  return { art: WEAPON_TYPES[w.cls].art, color: `#${GRADES[w.grade].color.toString(16).padStart(6, '0')}`, glow: w.grade >= 3 };
}

/** 텍스처를 만들 때의 외형·무기. 바뀌면 다시 그림 (무기 장착, 새 게임에서 같은 id 재사용) */
const made = new Map<string, string>();

/** `hero-<id>` (전신)과 `face-<id>` (얼굴 아이콘) 텍스처를 준비 */
export function ensureHeroTextures(scene: Phaser.Scene, hero: Hero): void {
  const body = `hero-${hero.id}`;
  const face = `face-${hero.id}`;
  const sig = `${lookSignature(hero.race, hero.beast, hero.classId, hero.look)}|${hero.weapon?.id ?? ''}`;
  if (made.get(hero.id) === sig && scene.textures.exists(body) && scene.textures.exists(face)) return;
  if (scene.textures.exists(body)) scene.textures.remove(body);
  if (scene.textures.exists(face)) scene.textures.remove(face);
  made.set(hero.id, sig);
  const grid = heroGrid({ ...hero, held: heldWeapon(hero) });
  makeGridTexture(scene, body, grid);
  const [x, y, w, h] = FACE_CROP;
  const tex = scene.textures.createCanvas(face, w, h);
  if (!tex) return;
  paint(tex.getContext(), grid, x, y, w, h);
  tex.refresh();
}
