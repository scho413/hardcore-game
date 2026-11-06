// 영웅 외형 생성기 (32×32, 부위 레이어 조합) — GDD 13
//
// 그리는 순서 = 레이어 순서:
//   등 뒤 소품 → 다리 → 몸(직업 의상) → 팔·손 → 무기·방패 → 머리(종족 피부/털) → 귀
//   → 머리카락 → 수염 → 눈·눈썹·코·입 → 표식 → 머리 장비 → 수인 귀 → 자동 외곽선
//
// 에셋 팩으로 바꿀 때: 각 draw* 함수를 "같은 좌표에 레이어 시트 한 장 그리기"로 바꾸면 됩니다.

import type { ClassId } from '../data/classes';
import type { BeastKind, RaceId } from '../data/races';

export type Grid = (string | null)[][];
export const SIZE = 32;
const OUTLINE = '#1b1626';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: string;
  eyes: string;
  eyeColor: number;
  brows: string;
  mouth: string;
  beard: string;
  mark: string;
  gear: string;
  weapon: string;
  cloth: number;
  cloth2: number;
  /** 수인 귀 변형 (토끼 한쪽 접힘 등) */
  earVar: number;
}

// ─────────────── 팔레트 ───────────────

const SKINS: Record<string, string[]> = {
  human: ['#f6d2b0', '#eebc94', '#d9a07a', '#b97e58', '#8c5a3c', '#6a432c'],
  barbarian: ['#eebc94', '#d9a07a', '#b97e58', '#8c5a3c', '#c49070'],
  elf: ['#f8e2cc', '#ecd0b4', '#d6b294', '#bfa6c8', '#a8c4a0'],
  dwarf: ['#f0c6a2', '#e0a884', '#c8896a', '#a86a4c'],
  rabbit: ['#f4f0ea', '#d8c8b0', '#a88866', '#9a9aa4'],
  cat: ['#f0a050', '#8a8a8a', '#3e3840', '#f2ece2', '#d8b890'],
  dog: ['#c89058', '#e8c890', '#6a4a32', '#f0ece4', '#3e3840'],
  bear: ['#7a5232', '#4e382a', '#c8a070', '#ece8e0'],
};

const HAIRS = ['#2a1e1a', '#5a3a24', '#8a5a34', '#c88a3a', '#e8c860', '#f0e8d8', '#c8402f', '#e07a30', '#9aa0aa', '#4a6ad0', '#3a9a6a', '#a060c0'];
/** 종족별로 자주 나오는 머리색 (인덱스) */
const HAIR_BY_RACE: Record<string, number[]> = {
  human: [0, 1, 2, 3, 4, 6, 7, 8],
  barbarian: [0, 1, 3, 6, 7, 4],
  elf: [4, 5, 9, 10, 11, 0, 8],
  dwarf: [1, 2, 3, 6, 7, 8, 0],
  beastfolk: [0, 1, 2, 4, 5, 8],
};
const EYE_COLORS = ['#3a6ad0', '#3a9a5a', '#6a4428', '#d09a2a', '#a83a3a', '#8a4ac8', '#2a2a2a'];
export const CLOTHS = ['#3d6fd1', '#c8402f', '#4f9a52', '#7b4fc9', '#8a5a3a', '#d08a2a', '#2a8a8a', '#c84a8a', '#4a4a5a', '#d8cfb8'];

const METAL = '#b8c2d4';
const METAL_D = '#7d88a3';
const WOOD = '#8b6a3e';
const WOOD_D = '#5c4428';
const GOLD = '#e8c25a';
const GOLD_D = '#b08a2e';

// ─────────────── 선택지 ───────────────

const HAIR_STYLES = ['short', 'spiky', 'long', 'bob', 'ponytail', 'bun', 'mohawk', 'bangs', 'braids', 'curly', 'bald'];
const EYES = ['dot', 'big', 'narrow', 'happy', 'sleepy', 'glint'];
const BROWS = ['none', 'flat', 'angry', 'worried', 'thick'];
const MOUTHS = ['smile', 'flat', 'open', 'frown', 'smirk', 'fang'];
const MARKS = ['none', 'none', 'scar', 'freckles', 'blush', 'eyepatch', 'mole', 'tattoo'];

const GEAR_BY_CLASS: Record<ClassId, string[]> = {
  knight: ['none', 'helm', 'helm', 'plumehelm'],
  warrior: ['none', 'none', 'horns', 'headband'],
  archer: ['none', 'hood', 'hood', 'feather'],
  mage: ['none', 'hat', 'hat', 'hat'],
  priest: ['none', 'circlet', 'halo', 'halo'],
};
const WEAPONS: Record<ClassId, string[]> = {
  knight: ['sword', 'mace'],
  warrior: ['axe', 'greatsword', 'hammer'],
  archer: ['bow', 'longbow'],
  mage: ['staff', 'wand'],
  priest: ['holystaff', 'book'],
};

export function randomLook(rand: () => number, race: RaceId, beast: BeastKind | undefined, cls: ClassId): Look {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const skinKey = race === 'beastfolk' ? beast! : race;
  let beard = 'none';
  if (race === 'dwarf') beard = pick(['long', 'braided', 'wide', 'long']);
  else if (race === 'barbarian') beard = pick(['none', 'stubble', 'short', 'long', 'mustache']);
  else if (race === 'human') beard = pick(['none', 'none', 'none', 'stubble', 'mustache', 'short']);

  let mark = pick(MARKS);
  if (race === 'barbarian' && rand() < 0.6) mark = 'warpaint';
  if (race === 'beastfolk' && beast === 'cat' && rand() < 0.5) mark = 'whiskers';

  let hairStyle = pick(HAIR_STYLES);
  if (race === 'beastfolk' && ['mohawk', 'braids', 'bun'].includes(hairStyle)) hairStyle = pick(['short', 'bangs', 'curly', 'bald']);
  if (race === 'elf' && hairStyle === 'bald') hairStyle = 'long';

  return {
    skin: Math.floor(rand() * SKINS[skinKey].length),
    hair: pick(HAIR_BY_RACE[race]),
    hairStyle,
    eyes: pick(EYES),
    eyeColor: Math.floor(rand() * EYE_COLORS.length),
    brows: pick(BROWS),
    mouth: pick(MOUTHS),
    beard,
    mark,
    gear: pick(GEAR_BY_CLASS[cls]),
    weapon: pick(WEAPONS[cls]),
    cloth: Math.floor(rand() * CLOTHS.length),
    cloth2: Math.floor(rand() * CLOTHS.length),
    earVar: Math.floor(rand() * 3),
  };
}

/** 외형이 같은지 비교하는 키 (중복 영웅 방지) */
export function lookSignature(race: RaceId, beast: BeastKind | undefined, cls: ClassId, l: Look): string {
  return [race, beast ?? '', cls, l.skin, l.hair, l.hairStyle, l.eyes, l.eyeColor, l.brows, l.mouth, l.beard, l.mark, l.gear, l.cloth].join('|');
}

// ─────────────── 그리기 도구 ───────────────

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

class Canvas {
  g: Grid = Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null));
  px(x: number, y: number, c: string): void {
    if (x >= 1 && x < SIZE - 1 && y >= 0 && y < SIZE) this.g[y][x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  get(x: number, y: number): string | null {
    return this.g[y]?.[x] ?? null;
  }
  /** 투명 픽셀 중 칠해진 픽셀과 맞닿은 곳에 외곽선 */
  outline(): void {
    const add: [number, number][] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.g[y][x]) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.g[y][x] = OUTLINE;
  }
}

interface Layout {
  hx0: number; hx1: number; hy0: number; hy1: number;
  bx0: number; bx1: number; by0: number; by1: number;
  ly1: number;
}

function layout(race: RaceId, beast?: BeastKind): Layout {
  if (race === 'dwarf') return { hx0: 10, hx1: 21, hy0: 9, hy1: 19, bx0: 10, bx1: 21, by0: 20, by1: 25, ly1: 29 };
  const wide = race === 'barbarian' || beast === 'bear';
  return { hx0: 10, hx1: 21, hy0: 6, hy1: 16, bx0: wide ? 10 : 11, bx1: wide ? 21 : 20, by0: 17, by1: 24, ly1: 29 };
}

// ─────────────── 본체 ───────────────

export interface HeroLike {
  race: RaceId;
  beast?: BeastKind;
  classId: ClassId;
  look: Look;
}

export function heroGrid(h: HeroLike): Grid {
  const c = new Canvas();
  const L = layout(h.race, h.beast);
  const l = h.look;
  const skinKey = h.race === 'beastfolk' ? h.beast! : h.race;
  const skins = SKINS[skinKey];
  const S = skins[l.skin % skins.length];
  const Sd = shade(S, 0.82);
  const hair = HAIRS[l.hair % HAIRS.length];
  const hairD = shade(hair, 0.72);
  const C1 = CLOTHS[l.cloth % CLOTHS.length];
  const C1d = shade(C1, 0.7);
  const C2 = CLOTHS[(l.cloth2 === l.cloth ? l.cloth2 + 3 : l.cloth2) % CLOTHS.length];
  const beast = h.race === 'beastfolk';

  drawBack(c, h.classId, L);
  drawLegs(c, h.classId, L, C1, C1d);
  drawBody(c, h.classId, L, S, C1, C1d, C2);
  drawWeapon(c, h.classId, l.weapon, L, C1, C2, l.eyeColor);
  drawHead(c, L, S, Sd);
  if (!beast) drawEars(c, h.race, L, S, Sd);
  if (beast && h.beast === 'dog') drawBeastEars(c, 'dog', L, S, l.earVar);
  if (!['helm', 'plumehelm', 'hood', 'hat'].includes(l.gear) || beast) drawHair(c, l.hairStyle, L, hair, hairD, l.gear);
  drawBeard(c, l.beard, L, hair, hairD, Sd);
  drawFace(c, h.race, h.beast, l, L, S, Sd, hair);
  drawMark(c, l.mark, L, S, C2);
  drawGear(c, l.gear, L, C1, C1d, C2);
  if (beast && h.beast !== 'dog') drawBeastEars(c, h.beast!, L, S, l.earVar);
  c.outline();
  return c.g;
}

function drawBack(c: Canvas, cls: ClassId, L: Layout): void {
  if (cls === 'archer') {
    // 화살통
    c.rect(L.bx1 - 1, L.by0 - 4, 3, 8, WOOD_D);
    c.px(L.bx1 - 1, L.by0 - 5, '#f2ece0');
    c.px(L.bx1 + 1, L.by0 - 5, '#f2ece0');
  }
  if (cls === 'knight') {
    // 망토 자락
    c.rect(L.bx0 - 1, L.by0 + 1, L.bx1 - L.bx0 + 3, L.by1 - L.by0 + 3, '#3a2f4a');
  }
}

function drawLegs(c: Canvas, cls: ClassId, L: Layout, C1: string, C1d: string): void {
  const y0 = L.by1 + 1;
  if (cls === 'mage' || cls === 'priest') {
    // 로브가 발까지 덮음
    const robe = cls === 'priest' ? '#e8e4da' : C1;
    const robeD = cls === 'priest' ? '#c7c2b6' : C1d;
    c.rect(L.bx0 - 1, y0, L.bx1 - L.bx0 + 3, L.ly1 - y0 + 1, robe);
    c.rect(L.bx0 - 1, L.ly1, L.bx1 - L.bx0 + 3, 1, robeD);
    c.rect(L.bx0 + 1, L.ly1 + 1, 3, 1, '#3a2e2a');
    c.rect(L.bx1 - 3, L.ly1 + 1, 3, 1, '#3a2e2a');
    return;
  }
  const pants = cls === 'knight' ? METAL_D : cls === 'archer' ? '#5a5a3a' : C1d;
  const cx = (L.bx0 + L.bx1) >> 1;
  c.rect(cx - 3, y0, 3, L.ly1 - y0 + 1, pants);
  c.rect(cx + 1, y0, 3, L.ly1 - y0 + 1, pants);
  const boot = cls === 'knight' ? '#5a6278' : '#4a3424';
  c.rect(cx - 4, L.ly1, 4, 2, boot);
  c.rect(cx + 1, L.ly1, 4, 2, boot);
}

function drawBody(c: Canvas, cls: ClassId, L: Layout, S: string, C1: string, C1d: string, C2: string): void {
  const { bx0, bx1, by0, by1 } = L;
  const w = bx1 - bx0 + 1;
  const h = by1 - by0 + 1;
  const cx = (bx0 + bx1) >> 1;
  let torso = C1;
  let sleeve = C1;
  switch (cls) {
    case 'knight':
      torso = METAL;
      sleeve = METAL;
      c.rect(bx0, by0, w, h, METAL);
      c.rect(bx0, by1, w, 1, METAL_D);
      c.rect(cx - 1, by0 + 1, 3, h, C1); // 휘장
      c.px(cx, by0 + 2, C2);
      break;
    case 'warrior':
      sleeve = S;
      c.rect(bx0, by0, w, h, C1);
      c.rect(cx - 1, by0, 3, 3, S); // 가슴 V
      c.px(cx, by0 + 3, S);
      c.rect(bx0, by1 - 1, w, 2, '#4a3424'); // 허리띠
      c.px(cx, by1 - 1, GOLD);
      break;
    case 'archer':
      c.rect(bx0, by0, w, h, C1);
      c.rect(bx0, by0, w, 1, C1d);
      c.rect(bx0, by1 - 1, w, 1, '#4a3424');
      c.rect(bx0 + 1, by0 + 1, 1, h - 2, '#4a3424'); // 화살통 끈
      break;
    case 'mage':
      c.rect(bx0, by0, w, h, C1);
      c.rect(cx, by0, 1, h, C2);
      c.rect(bx0, by1 - 2, w, 1, C2);
      break;
    case 'priest':
      torso = '#f2f0ea';
      sleeve = '#f2f0ea';
      c.rect(bx0, by0, w, h, '#f2f0ea');
      c.rect(cx - 1, by0, 2, h, C1);
      c.rect(cx - 1, by0 + 2, 2, 1, GOLD);
      break;
  }
  void torso;
  // 팔 + 손
  const armTop = by0;
  const armBot = by1 - 1;
  c.rect(bx0 - 2, armTop, 2, armBot - armTop + 1, sleeve);
  c.rect(bx1 + 1, armTop, 2, armBot - armTop + 1, sleeve);
  if (cls === 'knight') {
    c.rect(bx0 - 2, armTop, 2, 2, METAL_D);
    c.rect(bx1 + 1, armTop, 2, 2, METAL_D);
  }
  c.rect(bx0 - 2, armBot + 1, 2, 1, S);
  c.rect(bx1 + 1, armBot + 1, 2, 1, S);
}

function drawWeapon(c: Canvas, cls: ClassId, weapon: string, L: Layout, C1: string, C2: string, eyeColor: number): void {
  const hx = L.bx1 + 3; // 오른손 옆
  const hy = L.by1;
  switch (weapon) {
    case 'sword':
      c.rect(hx, hy - 12, 1, 11, '#e8eef8');
      c.rect(hx + 1, hy - 12, 1, 11, METAL);
      c.rect(hx - 1, hy - 1, 4, 1, GOLD);
      c.rect(hx, hy, 2, 2, WOOD_D);
      break;
    case 'mace':
      c.rect(hx, hy - 8, 2, 10, WOOD);
      c.rect(hx - 1, hy - 11, 4, 4, METAL);
      c.px(hx - 1, hy - 11, METAL_D);
      c.px(hx + 2, hy - 8, METAL_D);
      break;
    case 'axe':
      c.rect(hx, hy - 12, 1, 15, WOOD);
      c.rect(hx + 1, hy - 12, 3, 5, METAL);
      c.rect(hx + 1, hy - 8, 2, 1, METAL_D);
      break;
    case 'greatsword':
      c.rect(hx, hy - 15, 2, 14, METAL);
      c.rect(hx, hy - 15, 1, 14, '#e8eef8');
      c.rect(hx - 1, hy - 1, 4, 1, METAL_D);
      c.rect(hx, hy, 2, 2, WOOD_D);
      break;
    case 'hammer':
      c.rect(hx, hy - 9, 1, 12, WOOD);
      c.rect(hx - 1, hy - 13, 4, 4, METAL_D);
      c.rect(hx - 1, hy - 13, 4, 1, METAL);
      break;
    case 'bow':
    case 'longbow': {
      // 왼손 활
      const x = L.bx0 - 4;
      const top = weapon === 'longbow' ? L.by0 - 6 : L.by0 - 3;
      const bot = L.by1 + (weapon === 'longbow' ? 5 : 3);
      const mid = (top + bot) >> 1;
      for (let y = top; y <= bot; y++) {
        const d = Math.abs(y - mid);
        const bx = x - (d < (bot - top) / 3 ? 1 : 0);
        c.px(bx, y, WOOD);
      }
      for (let y = top + 1; y < bot; y++) c.px(x + 1, y, '#e8e0c8');
      break;
    }
    case 'staff':
    case 'wand': {
      const orb = EYE_COLORS[eyeColor % EYE_COLORS.length];
      const long = weapon === 'staff';
      const top = long ? L.hy0 + 2 : hy - 7;
      c.rect(hx, top + 3, 1, hy + 3 - top, WOOD);
      c.rect(hx - 1, top, 3, 3, orb);
      c.px(hx - 1, top, '#ffffff');
      if (long) c.rect(hx - 1, top + 3, 3, 1, C2);
      break;
    }
    case 'holystaff':
      c.rect(hx, L.hy0 + 4, 1, L.ly1 - L.hy0 - 3, GOLD_D);
      c.rect(hx - 1, L.hy0 + 1, 3, 3, GOLD);
      c.px(hx, L.hy0 + 2, '#fff6d0');
      break;
    case 'book':
      c.rect(L.bx0 - 5, L.by1 - 3, 4, 4, C1);
      c.rect(L.bx0 - 5, L.by1 - 3, 4, 1, GOLD);
      c.px(L.bx0 - 3, L.by1 - 1, GOLD);
      break;
  }
  if (cls === 'knight') {
    // 방패 (왼쪽)
    const x = L.bx0 - 6;
    const y = L.by0;
    c.rect(x, y, 5, 7, C1);
    c.rect(x, y + 7, 5, 1, shade(C1, 0.7));
    c.rect(x + 1, y + 8, 3, 1, shade(C1, 0.7));
    c.rect(x + 2, y + 1, 1, 5, C2);
    c.rect(x + 1, y + 2, 3, 1, C2);
  }
}

function drawHead(c: Canvas, L: Layout, S: string, Sd: string): void {
  const { hx0, hx1, hy0, hy1 } = L;
  c.rect(hx0, hy0 + 1, hx1 - hx0 + 1, hy1 - hy0 - 1, S);
  c.rect(hx0 + 1, hy0, hx1 - hx0 - 1, 1, S);
  c.rect(hx0 + 1, hy1, hx1 - hx0 - 1, 1, S);
  c.rect(hx0 + 2, hy1, hx1 - hx0 - 3, 1, Sd); // 턱 그림자
  // 목
  c.rect(((hx0 + hx1) >> 1) - 1, hy1 + 1, 3, 1, Sd);
}

function drawEars(c: Canvas, race: RaceId, L: Layout, S: string, Sd: string): void {
  const ey = L.hy0 + 5;
  if (race === 'elf') {
    for (const [dx, dy] of [[-1, 0], [-1, 1], [-2, -1], [-2, 0], [-3, -2], [-4, -3]] as const) {
      c.px(L.hx0 + dx, ey + dy, S);
      c.px(L.hx1 - dx, ey + dy, S);
    }
    c.px(L.hx0 - 2, ey, Sd);
    c.px(L.hx1 + 2, ey, Sd);
    return;
  }
  c.rect(L.hx0 - 1, ey, 1, 2, S);
  c.rect(L.hx1 + 1, ey, 1, 2, S);
}

function drawBeastEars(c: Canvas, kind: BeastKind, L: Layout, S: string, v: number): void {
  const { hx0, hx1, hy0 } = L;
  const inner = kind === 'rabbit' || kind === 'cat' ? '#f0a8b8' : shade(S, 0.7);
  switch (kind) {
    case 'rabbit': {
      const lx = hx0 + 2;
      const rx = hx1 - 3;
      c.rect(lx, hy0 - 7, 2, 7, S);
      c.rect(lx + 1, hy0 - 6, 1, 5, inner);
      if (v === 0) {
        // 오른쪽 귀가 접힘
        c.rect(rx, hy0 - 3, 2, 3, S);
        c.rect(rx + 2, hy0 - 4, 3, 2, S);
        c.px(rx + 2, hy0 - 3, inner);
      } else {
        c.rect(rx, hy0 - 7, 2, 7, S);
        c.rect(rx, hy0 - 6, 1, 5, inner);
      }
      break;
    }
    case 'cat':
      for (const [x0, dir] of [[hx0, 1], [hx1, -1]] as const) {
        c.px(x0 + dir * 1, hy0 - 3, S);
        c.rect(Math.min(x0, x0 + dir * 2), hy0 - 2, 3, 1, S);
        c.rect(Math.min(x0, x0 + dir * 3), hy0 - 1, 4, 1, S);
        c.px(x0 + dir * 1, hy0 - 2, inner);
        c.px(x0 + dir * 1, hy0 - 1, inner);
        c.px(x0 + dir * 2, hy0 - 1, inner);
      }
      break;
    case 'dog': {
      const ear = shade(S, v === 2 ? 1.25 : 0.7);
      c.rect(hx0 - 2, hy0 + 1, 3, 6, ear);
      c.rect(hx1, hy0 + 1, 3, 6, ear);
      c.rect(hx0 - 1, hy0 + 7, 1, 1, ear);
      c.rect(hx1 + 1, hy0 + 7, 1, 1, ear);
      break;
    }
    case 'bear':
      for (const x of [hx0, hx1 - 2]) {
        c.rect(x, hy0 - 2, 3, 2, S);
        c.px(x + 1, hy0 - 3, S);
        c.px(x + 1, hy0 - 2, inner);
      }
      break;
  }
}

function drawHair(c: Canvas, style: string, L: Layout, H: string, Hd: string, gear: string): void {
  const { hx0, hx1, hy0, hy1 } = L;
  const w = hx1 - hx0 + 1;
  if (style === 'bald') {
    c.px(hx0 + 3, hy0 + 1, '#ffffff');
    return;
  }
  if (style === 'mohawk') {
    c.rect(hx0 + 4, hy0 - 3, 4, 4, H);
    c.rect(hx0 + 4, hy0 + 1, 4, 1, Hd);
    return;
  }
  const cap = () => {
    c.rect(hx0, hy0 - 1, w, 3, H);
    c.rect(hx0 - 1, hy0, 1, 3, H);
    c.rect(hx1 + 1, hy0, 1, 3, H);
    c.rect(hx0, hy0 + 2, 1, 2, Hd);
    c.rect(hx1, hy0 + 2, 1, 2, Hd);
    c.px(hx0 + 3, hy0 - 1, shade(H, 1.35));
    c.px(hx0 + 4, hy0 - 1, shade(H, 1.35));
  };
  const hasCap = gear === 'circlet' || gear === 'halo' || gear === 'headband' || gear === 'feather' || gear === 'horns' || gear === 'none';
  if (!hasCap && !['long', 'bob', 'ponytail', 'braids'].includes(style)) return;
  cap();
  switch (style) {
    case 'spiky':
      for (let i = 0; i < 4; i++) {
        c.px(hx0 + 1 + i * 3, hy0 - 2, H);
        c.px(hx0 + 2 + i * 3, hy0 - 3, H);
      }
      break;
    case 'long':
    case 'braids':
      c.rect(hx0 - 2, hy0 + 1, 2, hy1 - hy0 + 3, H);
      c.rect(hx1 + 1, hy0 + 1, 2, hy1 - hy0 + 3, H);
      c.rect(hx0 - 2, hy1 + 2, 2, 1, Hd);
      c.rect(hx1 + 1, hy1 + 2, 2, 1, Hd);
      if (style === 'braids') {
        c.px(hx0 - 2, hy1 + 4, GOLD);
        c.px(hx1 + 2, hy1 + 4, GOLD);
        c.px(hx0 - 2, hy1 + 3, H);
        c.px(hx1 + 2, hy1 + 3, H);
      }
      break;
    case 'bob':
      c.rect(hx0 - 1, hy0 + 1, 2, 7, H);
      c.rect(hx1, hy0 + 1, 2, 7, H);
      break;
    case 'ponytail':
      c.rect(hx1 + 1, hy0 + 1, 2, 9, H);
      c.rect(hx1 + 2, hy0 + 9, 1, 2, Hd);
      c.px(hx1 + 1, hy0 + 2, '#c84a4a');
      break;
    case 'bun':
      c.rect(hx0 + 4, hy0 - 4, 4, 3, H);
      c.rect(hx0 + 4, hy0 - 2, 4, 1, Hd);
      break;
    case 'bangs':
      for (let x = hx0 + 1; x < hx1; x += 2) c.px(x, hy0 + 2, H);
      c.rect(hx0 + 1, hy0 + 2, 3, 1, H);
      break;
    case 'curly':
      for (let x = hx0 - 1; x <= hx1 + 1; x += 2) c.px(x, hy0 - 2, H);
      c.rect(hx0 - 2, hy0 + 1, 1, 4, H);
      c.rect(hx1 + 2, hy0 + 1, 1, 4, H);
      c.px(hx0 - 1, hy0 + 4, H);
      c.px(hx1 + 1, hy0 + 4, H);
      break;
  }
}

function drawBeard(c: Canvas, style: string, L: Layout, H: string, Hd: string, Sd: string): void {
  if (style === 'none') return;
  const { hx0, hx1, hy0, hy1 } = L;
  const my = hy0 + 9;
  const cx = (hx0 + hx1 + 1) >> 1;
  switch (style) {
    case 'stubble':
      for (let x = hx0 + 2; x <= hx1 - 2; x += 2) c.px(x, hy1 - 1, Sd);
      for (let x = hx0 + 3; x <= hx1 - 3; x += 2) c.px(x, hy1, Sd);
      break;
    case 'mustache':
      c.rect(cx - 3, my - 1, 6, 1, H);
      c.px(cx - 3, my, H);
      c.px(cx + 2, my, H);
      break;
    case 'short':
      c.rect(hx0 + 1, my - 1, hx1 - hx0 - 1, hy1 - my + 2, H);
      c.rect(hx0 + 2, hy1 + 1, hx1 - hx0 - 3, 1, Hd);
      break;
    case 'long':
    case 'braided':
    case 'wide':
      c.rect(hx0 + (style === 'wide' ? 0 : 1), my - 1, hx1 - hx0 + (style === 'wide' ? 1 : -1), hy1 - my + 2, H);
      c.rect(cx - 3, hy1 + 1, 6, 3, H);
      c.rect(cx - 2, hy1 + 4, 4, 2, H);
      c.rect(cx - 1, hy1 + 6, 2, 1, Hd);
      if (style === 'braided') {
        c.px(cx - 1, hy1 + 7, GOLD);
        c.px(cx, hy1 + 7, GOLD);
      }
      if (style === 'wide') {
        c.rect(hx0 - 1, my, 1, 3, H);
        c.rect(hx1 + 1, my, 1, 3, H);
      }
      c.rect(cx - 3, my - 1, 6, 1, Hd); // 콧수염 경계
      break;
  }
}

function drawFace(c: Canvas, race: RaceId, beast: BeastKind | undefined, l: Look, L: Layout, S: string, Sd: string, H: string): void {
  const { hx0, hx1, hy0 } = L;
  const ey = hy0 + 5;
  const lx = hx0 + 2;
  const rx = hx1 - 3;
  const cx = (hx0 + hx1 + 1) >> 1;
  const D = '#241a22';
  const eyeC = EYE_COLORS[l.eyeColor % EYE_COLORS.length];

  // 수인 주둥이
  if (race === 'beastfolk') {
    const muzzle = shade(S, beast === 'bear' || beast === 'dog' ? 1.25 : 1.15);
    c.rect(cx - 2, ey + 2, 4, 3, muzzle);
    const nose = beast === 'rabbit' || beast === 'cat' ? '#e07890' : D;
    c.rect(cx - 1, ey + 2, 2, 1, nose);
  }

  // 눈
  for (const x of [lx, rx]) {
    switch (l.eyes) {
      case 'dot':
        c.rect(x + (x === lx ? 1 : 0), ey, 1, 2, D);
        break;
      case 'big':
        c.rect(x, ey, 2, 2, '#ffffff');
        c.rect(x + (x === lx ? 1 : 0), ey, 1, 2, eyeC);
        break;
      case 'narrow':
        c.rect(x, ey + 1, 2, 1, D);
        break;
      case 'happy':
        // 웃는 눈: 왼쪽 '/', 오른쪽 '\' → ^ ^
        if (x === lx) {
          c.px(x, ey + 1, D);
          c.px(x + 1, ey, D);
        } else {
          c.px(x, ey, D);
          c.px(x + 1, ey + 1, D);
        }
        break;
      case 'sleepy':
        c.rect(x, ey, 2, 1, Sd);
        c.rect(x, ey + 1, 2, 1, D);
        break;
      case 'glint':
        c.rect(x, ey, 2, 2, eyeC);
        c.px(x, ey, '#ffffff');
        break;
    }
  }

  // 눈썹
  const by = ey - 2;
  const browC = race === 'beastfolk' ? shade(S, 0.6) : shade(H, 0.85);
  switch (l.brows) {
    case 'flat':
      c.rect(lx, by, 2, 1, browC);
      c.rect(rx, by, 2, 1, browC);
      break;
    case 'thick':
      c.rect(lx - 1, by, 3, 1, browC);
      c.rect(rx, by, 3, 1, browC);
      break;
    case 'angry':
      c.px(lx, by, browC);
      c.px(lx + 1, by + 1, browC);
      c.px(rx + 1, by, browC);
      c.px(rx, by + 1, browC);
      break;
    case 'worried':
      c.px(lx, by + 1, browC);
      c.px(lx + 1, by, browC);
      c.px(rx + 1, by + 1, browC);
      c.px(rx, by, browC);
      break;
  }

  // 코
  if (race === 'dwarf') {
    c.rect(cx - 1, ey + 2, 2, 2, shade(S, 0.85));
    c.px(cx - 1, ey + 2, '#e89a8a');
  } else if (race !== 'beastfolk') {
    c.px(cx - 1, ey + 2, Sd);
  }

  // 입
  const my = hy0 + 9;
  switch (l.mouth) {
    case 'smile':
      c.px(cx - 2, my - 1, D);
      c.rect(cx - 1, my, 2, 1, D);
      c.px(cx + 1, my - 1, D);
      break;
    case 'flat':
      c.rect(cx - 1, my, 2, 1, D);
      break;
    case 'open':
      c.rect(cx - 1, my - 1, 2, 1, D);
      c.rect(cx - 1, my, 2, 1, '#c84a5a');
      break;
    case 'frown':
      c.px(cx - 2, my, D);
      c.rect(cx - 1, my - 1, 2, 1, D);
      c.px(cx + 1, my, D);
      break;
    case 'smirk':
      c.rect(cx - 1, my, 2, 1, D);
      c.px(cx + 1, my - 1, D);
      break;
    case 'fang':
      c.rect(cx - 2, my, 4, 1, D);
      c.px(cx - 2, my + 1, '#ffffff');
      c.px(cx + 1, my + 1, '#ffffff');
      break;
  }
}

function drawMark(c: Canvas, mark: string, L: Layout, S: string, C2: string): void {
  const { hx0, hx1, hy0 } = L;
  const ey = hy0 + 5;
  const lx = hx0 + 2;
  const rx = hx1 - 3;
  switch (mark) {
    case 'scar':
      c.px(rx + 2, ey - 2, '#b04848');
      c.px(rx + 1, ey - 1, '#b04848');
      c.px(rx + 1, ey + 2, '#b04848');
      c.px(rx, ey + 3, '#b04848');
      break;
    case 'freckles':
      for (const [x, y] of [[lx, ey + 3], [lx + 2, ey + 3], [lx + 1, ey + 4], [rx, ey + 3], [rx + 2, ey + 3], [rx + 1, ey + 4]]) c.px(x, y, '#c8784a');
      break;
    case 'blush':
      c.rect(lx - 1, ey + 3, 2, 1, '#f08a9a');
      c.rect(rx + 1, ey + 3, 2, 1, '#f08a9a');
      break;
    case 'eyepatch':
      c.rect(lx, ey - 1, 3, 3, '#241a22');
      for (let i = 0; i < 4; i++) c.px(lx + 3 + i, ey - 2 - i, '#241a22');
      break;
    case 'mole':
      c.px(rx + 2, ey + 4, '#5a3a2a');
      break;
    case 'tattoo':
      c.px(((hx0 + hx1) >> 1), hy0 + 3, C2);
      c.px(((hx0 + hx1) >> 1) + 1, hy0 + 3, C2);
      c.px(lx - 1, ey + 3, C2);
      c.px(rx + 2, ey + 3, C2);
      break;
    case 'warpaint':
      c.rect(lx - 1, ey + 2, 3, 1, '#c8402f');
      c.rect(rx, ey + 2, 3, 1, '#c8402f');
      c.rect(lx, ey + 3, 2, 1, '#c8402f');
      c.rect(rx, ey + 3, 2, 1, '#c8402f');
      break;
    case 'whiskers':
      c.px(hx0 - 1, ey + 3, '#f2ece2');
      c.px(hx0 - 2, ey + 2, '#f2ece2');
      c.px(hx1 + 1, ey + 3, '#f2ece2');
      c.px(hx1 + 2, ey + 2, '#f2ece2');
      break;
  }
  void S;
}

function drawGear(c: Canvas, gear: string, L: Layout, C1: string, C1d: string, C2: string): void {
  const { hx0, hx1, hy0, hy1 } = L;
  const w = hx1 - hx0 + 1;
  const cx = (hx0 + hx1 + 1) >> 1;
  switch (gear) {
    case 'helm':
    case 'plumehelm':
      c.rect(hx0, hy0 - 1, w, 4, METAL);
      c.rect(hx0 - 1, hy0, 1, 3, METAL);
      c.rect(hx1 + 1, hy0, 1, 3, METAL);
      c.rect(hx0, hy0 + 2, w, 1, METAL_D);
      c.rect(hx0, hy0 + 3, 2, hy1 - hy0 - 4, METAL_D);
      c.rect(hx1 - 1, hy0 + 3, 2, hy1 - hy0 - 4, METAL_D);
      c.px(hx0 + 3, hy0, '#eef2fa');
      if (gear === 'plumehelm') {
        c.rect(cx - 1, hy0 - 4, 2, 3, C2);
        c.rect(cx + 1, hy0 - 5, 2, 2, C2);
      }
      break;
    case 'horns':
      c.rect(hx0, hy0 - 1, w, 3, METAL_D);
      c.rect(hx0, hy0 + 1, w, 1, METAL);
      c.px(hx0 - 1, hy0, '#f2ece0');
      c.px(hx0 - 2, hy0 - 1, '#f2ece0');
      c.px(hx0 - 2, hy0 - 2, '#f2ece0');
      c.px(hx1 + 1, hy0, '#f2ece0');
      c.px(hx1 + 2, hy0 - 1, '#f2ece0');
      c.px(hx1 + 2, hy0 - 2, '#f2ece0');
      break;
    case 'headband':
      c.rect(hx0, hy0 + 2, w, 1, C1);
      c.px(hx1 + 1, hy0 + 2, C1);
      c.px(hx1 + 2, hy0 + 3, C1);
      break;
    case 'hood':
      // 머리 위와 양옆만 감싸고 얼굴은 드러냄
      c.rect(hx0 - 1, hy0 - 1, w + 2, 2, C1);
      c.rect(hx0, hy0 + 1, w, 1, C1d);
      c.rect(hx0 - 1, hy0 + 1, 1, hy1 - hy0 - 1, C1);
      c.rect(hx1 + 1, hy0 + 1, 1, hy1 - hy0 - 1, C1);
      c.px(hx0, hy0 + 2, C1d);
      c.px(hx1, hy0 + 2, C1d);
      c.rect(hx0 + 1, hy0 - 2, 3, 1, C1);
      c.px(hx0 + 1, hy0 - 3, C1);
      break;
    case 'feather':
      c.rect(hx1 - 2, hy0 - 4, 1, 4, C2);
      c.px(hx1 - 1, hy0 - 5, C2);
      break;
    case 'hat':
      c.rect(hx0 - 3, hy0, w + 6, 1, C1d);
      c.rect(hx0 - 1, hy0 - 1, w + 2, 1, C1);
      c.rect(hx0 + 1, hy0 - 2, w - 2, 1, C2);
      c.rect(hx0 + 2, hy0 - 3, w - 4, 1, C1);
      c.rect(hx0 + 3, hy0 - 4, w - 6, 1, C1);
      c.rect(hx0 + 5, hy0 - 5, 3, 1, C1);
      c.rect(hx0 + 7, hy0 - 6, 2, 1, C1);
      c.px(hx0 + 9, hy0 - 6, C1d);
      break;
    case 'circlet':
      c.rect(hx0, hy0 + 2, w, 1, GOLD);
      c.px(cx, hy0 + 2, '#5ad0f0');
      break;
    case 'halo':
      c.rect(cx - 3, hy0 - 4, 6, 1, GOLD);
      c.px(cx - 4, hy0 - 3, GOLD);
      c.px(cx + 3, hy0 - 3, GOLD);
      break;
  }
}

/** 얼굴 아이콘으로 잘라낼 영역 (x, y, w, h). 키 큰 귀·모자까지 포함 */
export const FACE_CROP: [number, number, number, number] = [5, 0, 22, 23];
