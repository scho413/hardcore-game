// 영웅 외형 = 직업별 기본 몸 + 팔레트 교체(피부/머리/옷) + 장식 레이어 (GDD 13)
//
// 에셋 팩으로 교체할 때도 구조는 같습니다:
//   기본 몸 시트(직업별) → 옷/머리 레이어 시트 → 장식 레이어 시트를 같은 좌표에 겹쳐 그리고,
//   색은 팔레트 교체(또는 틴트)로 바꿉니다. 이 파일의 heroGrid()를 "시트에서 잘라 겹치기"로 바꾸면 됩니다.

import type { ClassId } from '../data/classes';
import type { Hero } from '../data/heroes';
import { normalizedRows, SPRITES } from './pixels';

export type Grid = (string | null)[][];

const K = '#1b1626';

export const SKINS = [
  { S: '#f0c49b', s: '#c99a74' },
  { S: '#e0a878', s: '#b07a50' },
  { S: '#b07850', s: '#80553a' },
  { S: '#7a5236', s: '#553826' },
];

export const HAIRS = [
  { main: '#d4553a', shade: '#9c3524' }, // 적갈
  { main: '#e8c25a', shade: '#b8902e' }, // 금발
  { main: '#3a2a22', shade: '#241812' }, // 흑갈
  { main: '#8a5a3a', shade: '#5e3c27' }, // 갈색
  { main: '#e8e4dc', shade: '#b8b2a6' }, // 백발
  { main: '#4a3a6a', shade: '#2e2444' }, // 흑자
];

export const CLOTHS = [
  { main: '#3d6fd1', shade: '#294c94' }, // 청
  { main: '#c8402f', shade: '#8c2a1e' }, // 적
  { main: '#4f9a52', shade: '#2f6b38' }, // 녹
  { main: '#7b4fc9', shade: '#52348c' }, // 자
  { main: '#8a5a3a', shade: '#5e3c27' }, // 갈
];

const ELEMENT_ORB: Record<string, string> = { fire: '#ff7a45', water: '#4aa3e0', wind: '#6fcf6f', none: '#c9c2d6' };

interface FaceAnchor {
  /** 눈이 있는 행과 두 눈의 열 */
  eyeRow: number;
  eyes: [number, number];
  /** 턱 행과 열 범위 */
  chinRow: number;
  chin: [number, number];
  /** 이마 행과 열 범위 (머리띠) */
  browRow: number;
  brow: [number, number];
}

const FACES: Partial<Record<ClassId, FaceAnchor>> = {
  warrior: { eyeRow: 4, eyes: [5, 8], chinRow: 6, chin: [5, 9], browRow: 3, brow: [5, 9] },
  archer: { eyeRow: 4, eyes: [6, 9], chinRow: 6, chin: [6, 9], browRow: 3, brow: [6, 9] },
  mage: { eyeRow: 7, eyes: [5, 8], chinRow: 8, chin: [5, 8], browRow: 6, brow: [4, 9] },
  priest: { eyeRow: 5, eyes: [6, 9], chinRow: 7, chin: [6, 9], browRow: 4, brow: [5, 10] },
};

/** 얼굴 아이콘으로 잘라낼 영역 (x, y, w, h) */
export const FACE_CROP: Record<ClassId, [number, number, number, number]> = {
  knight: [3, 0, 10, 8],
  warrior: [3, 1, 10, 7],
  archer: [3, 1, 10, 7],
  mage: [2, 2, 11, 8],
  priest: [3, 2, 10, 7],
};

/** 직업별: 원본 팔레트 글자 → 영웅 외형에 따른 색 */
function recolor(cls: ClassId, ch: string, x: number, y: number, hero: Hero): string | undefined {
  const skin = SKINS[hero.look.skin % SKINS.length];
  const hair = HAIRS[hero.look.hair % HAIRS.length];
  const cloth = CLOTHS[hero.look.cloth % CLOTHS.length];
  if (ch === 'S' && cls !== 'knight') return skin.S;
  if (ch === 's' && cls !== 'knight') return skin.s;
  switch (cls) {
    case 'knight':
      if (ch === 'B') return cloth.main;
      if (ch === 'b') return cloth.shade;
      break;
    case 'warrior':
      if (ch === 'R') return hair.main;
      if (ch === 'r') return hair.shade;
      if (ch === 'A') return cloth.main;
      if (ch === 'a') return cloth.shade;
      break;
    case 'archer':
      if (ch === 'G') return cloth.main;
      if (ch === 'g') return cloth.shade;
      break;
    case 'mage':
      if (ch === 'P') return cloth.main;
      if (ch === 'p') return cloth.shade;
      if (ch === 'O') return ELEMENT_ORB[hero.element];
      break;
    case 'priest':
      if (ch === 'H') return hair.main;
      // 후광(위 2줄)과 지팡이(오른쪽)는 그대로, 로브 장식만 옷 색
      if ((ch === 'Y' || ch === 'y') && y >= 2 && x <= 11) return ch === 'Y' ? cloth.main : cloth.shade;
      break;
  }
  return undefined;
}

function applyAccessory(grid: Grid, cls: ClassId, hero: Hero): void {
  const acc = hero.look.acc;
  const hair = HAIRS[hero.look.hair % HAIRS.length];
  const cloth = CLOTHS[hero.look.cloth % CLOTHS.length];
  const set = (x: number, y: number, c: string) => {
    if (y >= 0 && y < 16 && x >= 0 && x < 16) grid[y][x] = c;
  };

  if (cls === 'knight') {
    if (acc === 'plume') for (let x = 6; x <= 9; x++) set(x, 0, hair.main);
    return;
  }
  const f = FACES[cls];
  if (!f) return;
  switch (acc) {
    case 'beard':
      for (let x = f.chin[0]; x <= f.chin[1]; x++) set(x, f.chinRow, hair.main);
      set(Math.floor((f.chin[0] + f.chin[1]) / 2), f.chinRow + 1, hair.shade);
      break;
    case 'eyepatch':
      set(f.eyes[0], f.eyeRow, K);
      set(f.eyes[0] - 1, f.eyeRow - 1, K);
      set(f.eyes[0] + 1, f.eyeRow - 1, K);
      break;
    case 'scar':
      set(f.eyes[1], f.eyeRow - 1, '#b84a4a');
      set(f.eyes[1] + 1, f.eyeRow + 1, '#b84a4a');
      break;
    case 'headband':
      for (let x = f.brow[0]; x <= f.brow[1]; x++) set(x, f.browRow, cloth.main);
      break;
  }
}

/** 영웅 한 명의 16×16 픽셀 색 배열 */
export function heroGrid(hero: Hero): Grid {
  const base = SPRITES[hero.classId];
  const rows = normalizedRows(base);
  const grid: Grid = rows.map((row, y) =>
    [...row].map((ch, x) => {
      if (ch === '.') return null;
      return recolor(hero.classId, ch, x, y, hero) ?? base.palette[ch] ?? null;
    }),
  );
  applyAccessory(grid, hero.classId, hero);
  return grid;
}

/** 몬스터/기본 직업 스프라이트 → 색 배열 */
export function spriteGrid(kind: string): Grid {
  const s = SPRITES[kind];
  return normalizedRows(s).map((row) => [...row].map((ch) => (ch === '.' ? null : s.palette[ch] ?? null)));
}
