import Phaser from 'phaser';
import type { ClassId } from '../data/classes';
import { GRADES, MATERIALS, WEAPON_TYPES, type MatKind, type MaterialId, type Tier } from '../data/items';
import { makeGridTexture } from './textures';
import { hdWeaponIcon } from './hd';
import type { Grid } from './heroArt';

// 12×12 아이콘. 글자: o 외곽선, m 주색, l 밝은 주색, d 어두운 주색, w 나무, h 손잡이, g 보석(등급색)
const WEAPON_ICONS: Record<string, string[]> = {
  sword: [
    '..........oo',
    '.........olo',
    '........olmo',
    '.......olmo.',
    '......olmo..',
    '.....olmo...',
    '.o..olmo....',
    '.oooldo.....',
    '..ohho......',
    '.ohhoo......',
    'ogho.o......',
    'oo..........',
  ],
  axe: [
    '.....ooo....',
    '....olllo...',
    '...olmmmlo..',
    '...ommmwmo..',
    '...odmwmdo..',
    '....odwdo...',
    '.....owo....',
    '.....owo....',
    '.....owo....',
    '.....owo....',
    '.....ogo....',
    '......o.....',
  ],
  longbow: [
    '.....oo.....',
    '....owo.....',
    '...owo.l....',
    '..owo..l....',
    '..owo..l....',
    '.oggo..l....',
    '.oggo..l....',
    '..owo..l....',
    '..owo..l....',
    '...owo.l....',
    '....owo.....',
    '.....oo.....',
  ],
  staff: [
    '....ooo.....',
    '...oglgo....',
    '...ogggo....',
    '...owgwo....',
    '....owo.....',
    '....owo.....',
    '....owo.....',
    '....owo.....',
    '....owo.....',
    '....owo.....',
    '....odo.....',
    '.....o......',
  ],
  holystaff: [
    '....omo.....',
    '..ooomooo...',
    '..ommgmmo...',
    '..ooomooo...',
    '....omo.....',
    '....oho.....',
    '....oho.....',
    '....oho.....',
    '....oho.....',
    '....oho.....',
    '....omo.....',
    '.....o......',
  ],
};

const MAT_ICONS: Record<MatKind, string[]> = {
  metal: [
    '............',
    '....oooo....',
    '...ollmmo...',
    '..olmmmdmo..',
    '.olmmdmmmdo.',
    '.ommmmmdmdo.',
    '.odmmlmmddo.',
    '..oddmmdddo.',
    '...ooddddo..',
    '.....oooo...',
    '............',
    '............',
  ],
  wood: [
    '............',
    '............',
    '..ooooooooo.',
    '.ollwwwwwwdo',
    '.olmlwwwwwdo',
    '.olllwwwwwdo',
    '.ollwwwwwwdo',
    '..ooooooooo.',
    '............',
    '............',
    '............',
    '............',
  ],
  crystal: [
    '.....oo.....',
    '....olmo....',
    '...olmmdo...',
    '...olmmdo...',
    '..olmmmmdo..',
    '..olmmmmdo..',
    '..olmmmmdo..',
    '...olmmdo...',
    '...olmmdo...',
    '....olmo....',
    '.....oo.....',
    '............',
  ],
};

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
function tint(n: number, f: number): string {
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return hex((r << 16) | (g << 8) | b);
}

function toGrid(rows: string[], pal: Record<string, string>): Grid {
  return rows.map((r) => [...r].map((ch) => pal[ch] ?? null)) as Grid;
}

/** 무기 아이콘 텍스처 키 (`wicon-<직업>-<단계>-<등급>`) */
export function weaponIcon(scene: Phaser.Scene, cls: ClassId, tier: Tier, grade: number): string {
  const hd = hdWeaponIcon(scene, cls, tier, grade, GRADES[grade].color, 16);
  if (hd) return hd;
  const key = `wicon-${cls}-${tier}-${grade}`;
  if (scene.textures.exists(key)) return key;
  const t = WEAPON_TYPES[cls];
  const metal = MATERIALS[`metal${tier}` as MaterialId].color;
  const main = t.main === 'metal' ? metal : MATERIALS[`${t.main}${tier}` as MaterialId].color;
  const wood = MATERIALS[`wood${tier}` as MaterialId].color;
  const gc = GRADES[grade].color;
  const pal: Record<string, string> = {
    o: '#14111c',
    m: tint(main, 1),
    l: tint(main, 1.35),
    d: tint(main, 0.65),
    w: tint(wood, 1),
    h: '#6a4a3a',
    g: hex(gc),
  };
  if (cls === 'archer') pal.l = '#e8e0d0';
  makeGridTexture(scene, key, toGrid(WEAPON_ICONS[t.art], pal));
  return key;
}

/** 재료 아이콘 텍스처 키 */
export function matIcon(scene: Phaser.Scene, id: MaterialId): string {
  const key = `micon-${id}`;
  if (scene.textures.exists(key)) return key;
  const kind = id.slice(0, -1) as MatKind;
  const c = MATERIALS[id].color;
  const pal: Record<string, string> = { o: '#14111c', m: tint(c, 1), l: tint(c, 1.4), d: tint(c, 0.6), w: tint(c, 0.85) };
  makeGridTexture(scene, key, toGrid(MAT_ICONS[kind], pal));
  return key;
}
