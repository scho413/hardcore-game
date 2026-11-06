// 영웅 외형 생성기 (32×32, 부위 레이어 조합) — GDD 13
//
// 외형은 "성별 → 종족 → 직업" 순으로 정해집니다.
//   - 성별: 체형 폭, 머리 모양 후보, 수염, 속눈썹·입술
//   - 종족: 의상 스타일·체형·머리 장비 후보·색 후보 (바바리안은 털가죽, 드워프는 쇠와 가죽, 엘프는 숲색 옷 …)
//   - 직업: 무기와 작은 장신구 (인간만 직업별 정통 복장)
//
// 그리는 순서 = 레이어 순서:
//   등 뒤 소품 → 다리 → 몸(종족·직업 의상) → 팔·손 → 무기·방패 → 머리(종족 피부/털) → 귀
//   → 머리카락 → 수염 → 눈·눈썹·코·입 → 표식 → 머리 장비 → 수인 귀 → 자동 외곽선
//
// 에셋 팩으로 바꿀 때: 각 draw* 함수를 "같은 좌표에 레이어 시트 한 장 그리기"로 바꾸면 됩니다.

import type { ClassId } from '../data/classes';
import type { BeastKind, RaceId } from '../data/races';

export type Grid = (string | null)[][];
export const SIZE = 32;
const OUTLINE = '#1b1626';

export type Gender = 'm' | 'f';

export interface Look {
  gender: Gender;
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
/** 종족별로 고를 수 있는 옷 색 (CLOTHS 인덱스) */
const CLOTH_BY_RACE: Record<string, number[]> = {
  human: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  elf: [2, 6, 9, 3, 0],
  dwarf: [4, 1, 8, 0, 5],
  barbarian: [4, 1, 8, 5],
  beastfolk: [5, 2, 0, 7, 4, 9],
};
/** 바바리안 털가죽 색 */
const FURS = ['#8a5a3a', '#6a5a4a', '#b8905a', '#4a3a30', '#d8c8b0'];

const METAL = '#b8c2d4';
const METAL_D = '#7d88a3';
const WOOD = '#8b6a3e';
const WOOD_D = '#5c4428';
const GOLD = '#e8c25a';
const GOLD_D = '#b08a2e';

// ─────────────── 선택지 ───────────────

const HAIR_M = ['short', 'spiky', 'curly', 'bangs', 'bald', 'short', 'spiky'];
const HAIR_F = ['long', 'ponytail', 'bun', 'bob', 'braids', 'bangs', 'curly', 'twintail', 'long'];
const EYES = ['dot', 'big', 'narrow', 'happy', 'sleepy', 'glint'];
const BROWS_M = ['none', 'flat', 'angry', 'worried', 'thick'];
const BROWS_F = ['none', 'flat', 'worried', 'angry'];
const MOUTHS = ['smile', 'flat', 'open', 'frown', 'smirk', 'fang'];
const MARKS = ['none', 'none', 'scar', 'freckles', 'blush', 'eyepatch', 'mole', 'tattoo'];

type Style = 'human' | 'elf' | 'dwarf' | 'barbarian' | 'beast';
const styleOf = (race: RaceId): Style => (race === 'beastfolk' ? 'beast' : race);

/** 머리 장비 후보: 종족 × 직업 (인간만 직업 정통 장비) */
const GEAR: Record<Style, Record<ClassId, string[]>> = {
  human: {
    knight: ['none', 'helm', 'helm', 'plumehelm'],
    warrior: ['none', 'none', 'headband'],
    archer: ['none', 'hood', 'hood', 'feather'],
    mage: ['none', 'hat', 'hat', 'hat'],
    priest: ['none', 'circlet', 'halo', 'halo'],
  },
  elf: {
    knight: ['elfhelm', 'elfhelm', 'circlet'],
    warrior: ['none', 'circlet', 'leafcrown'],
    archer: ['hood', 'leafcrown', 'none'],
    mage: ['circlet', 'leafcrown', 'none'],
    priest: ['circlet', 'halo', 'leafcrown'],
  },
  dwarf: {
    knight: ['dwarfhelm', 'hornhelm'],
    warrior: ['hornhelm', 'dwarfhelm', 'none'],
    archer: ['cap', 'goggles', 'none'],
    mage: ['goggles', 'runeband', 'none'],
    priest: ['dwarfhelm', 'runeband', 'none'],
  },
  barbarian: {
    knight: ['horns', 'horns', 'none'],
    warrior: ['horns', 'bone', 'headband', 'none'],
    archer: ['bone', 'headband', 'none'],
    mage: ['skull', 'skull', 'bone'],
    priest: ['skull', 'bone', 'bone'],
  },
  beast: {
    knight: ['none', 'bandana'],
    warrior: ['bandana', 'headband', 'none'],
    archer: ['hood', 'bandana', 'none'],
    mage: ['none', 'circlet'],
    priest: ['halo', 'circlet', 'none'],
  },
};

const WEAPONS: Record<Style, Record<ClassId, string[]>> = {
  human: { knight: ['sword', 'mace'], warrior: ['axe', 'greatsword', 'hammer'], archer: ['bow', 'longbow'], mage: ['staff', 'wand'], priest: ['holystaff', 'book'] },
  elf: { knight: ['sword'], warrior: ['greatsword', 'sword'], archer: ['longbow'], mage: ['staff'], priest: ['holystaff'] },
  dwarf: { knight: ['hammer', 'mace'], warrior: ['axe', 'hammer'], archer: ['crossbow'], mage: ['staff', 'wand'], priest: ['hammer', 'book'] },
  barbarian: { knight: ['axe', 'mace'], warrior: ['axe', 'greatsword'], archer: ['bow'], mage: ['skullstaff'], priest: ['totem'] },
  beast: { knight: ['sword', 'mace'], warrior: ['axe', 'hammer'], archer: ['bow'], mage: ['wand', 'staff'], priest: ['holystaff'] },
};

export function randomLook(rand: () => number, race: RaceId, beast: BeastKind | undefined, cls: ClassId, gender: Gender): Look {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const skinKey = race === 'beastfolk' ? beast! : race;
  const style = styleOf(race);
  const f = gender === 'f';

  // 수염: 남성만
  let beard = 'none';
  if (!f) {
    if (race === 'dwarf') beard = pick(['long', 'braided', 'wide', 'long']);
    else if (race === 'barbarian') beard = pick(['stubble', 'short', 'long', 'mustache', 'none']);
    else if (race === 'human') beard = pick(['none', 'none', 'none', 'stubble', 'mustache', 'short']);
  }

  // 머리 모양: 성별 후보에서 종족에 맞게 보정
  let hairStyle = pick(f ? HAIR_F : HAIR_M);
  if (race === 'barbarian' && !f && rand() < 0.4) hairStyle = pick(['mohawk', 'long', 'braids']);
  if (race === 'dwarf' && f) hairStyle = pick(['braids', 'braids', 'bun', 'twintail']);
  if (race === 'elf') hairStyle = f ? pick(['long', 'long', 'braids', 'ponytail', 'bun']) : pick(['long', 'ponytail', 'short', 'bangs']);
  if (race === 'beastfolk' && ['mohawk', 'braids', 'bun', 'twintail'].includes(hairStyle)) hairStyle = pick(f ? ['bob', 'long', 'bangs'] : ['short', 'bangs', 'curly']);

  let mark = pick(MARKS);
  if (race === 'barbarian' && rand() < 0.6) mark = 'warpaint';
  if (race === 'beastfolk' && beast === 'cat' && rand() < 0.5) mark = 'whiskers';
  if (f && mark === 'none' && rand() < 0.3) mark = 'blush';

  let gear = pick(GEAR[style][cls]);
  if (style === 'beast' && f && rand() < 0.3) gear = 'flower';
  if (style === 'elf' && f && gear === 'none' && rand() < 0.4) gear = 'flower';

  const cloths = CLOTH_BY_RACE[race];
  return {
    gender,
    skin: Math.floor(rand() * SKINS[skinKey].length),
    hair: pick(HAIR_BY_RACE[race]),
    hairStyle,
    eyes: pick(EYES),
    eyeColor: Math.floor(rand() * EYE_COLORS.length),
    brows: pick(f ? BROWS_F : BROWS_M),
    mouth: pick(MOUTHS),
    beard,
    mark,
    gear,
    weapon: pick(WEAPONS[style][cls]),
    cloth: pick(cloths),
    cloth2: style === 'barbarian' ? Math.floor(rand() * FURS.length) : pick(cloths),
    earVar: Math.floor(rand() * 3),
  };
}

/** 외형이 같은지 비교하는 키 (중복 영웅 방지) */
export function lookSignature(race: RaceId, beast: BeastKind | undefined, cls: ClassId, l: Look): string {
  return [race, beast ?? '', cls, l.gender, l.skin, l.hair, l.hairStyle, l.eyes, l.eyeColor, l.brows, l.mouth, l.beard, l.mark, l.gear, l.cloth].join('|');
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

function layout(race: RaceId, beast: BeastKind | undefined, gender: Gender): Layout {
  // 여성은 어깨가 1픽셀씩 좁음
  const n = gender === 'f' ? 1 : 0;
  if (race === 'dwarf') return { hx0: 10, hx1: 21, hy0: 9, hy1: 19, bx0: 10 + n, bx1: 21 - n, by0: 20, by1: 25, ly1: 29 };
  const wide = race === 'barbarian' || beast === 'bear';
  const slim = race === 'elf';
  const x0 = wide ? 10 : slim ? 12 : 11;
  return { hx0: 10, hx1: 21, hy0: 6, hy1: 16, bx0: x0 + n, bx1: 31 - x0 - n, by0: 17, by1: 24, ly1: 29 };
}

// ─────────────── 본체 ───────────────

export interface HeroLike {
  gender?: Gender;
  race: RaceId;
  beast?: BeastKind;
  classId: ClassId;
  look: Look;
}

export function heroGrid(h: HeroLike): Grid {
  const c = new Canvas();
  const l = h.look;
  const gender: Gender = l.gender ?? h.gender ?? 'm';
  const L = layout(h.race, h.beast, gender);
  const style = styleOf(h.race);
  const skinKey = h.race === 'beastfolk' ? h.beast! : h.race;
  const skins = SKINS[skinKey];
  const S = skins[l.skin % skins.length];
  const Sd = shade(S, 0.82);
  const hair = HAIRS[l.hair % HAIRS.length];
  const hairD = shade(hair, 0.72);
  const C1 = CLOTHS[l.cloth % CLOTHS.length];
  const C1d = shade(C1, 0.7);
  const C2 = style === 'barbarian' ? FURS[l.cloth2 % FURS.length] : CLOTHS[(l.cloth2 === l.cloth ? l.cloth2 + 3 : l.cloth2) % CLOTHS.length];
  const beast = h.race === 'beastfolk';
  const p: Paint = { S, Sd, C1, C1d, C2, gender };

  drawBack(c, style, h.classId, L, p);
  drawLegs(c, style, h.classId, L, p);
  drawBody(c, style, h.classId, L, p);
  drawWeapon(c, style, h.classId, l.weapon, L, C1, C2, l.eyeColor);
  drawHead(c, L, S, Sd);
  if (!beast) drawEars(c, h.race, L, S, Sd);
  if (beast && h.beast === 'dog') drawBeastEars(c, 'dog', L, S, l.earVar);
  if (!COVERING.includes(l.gear) || beast) drawHair(c, l.hairStyle, L, hair, hairD, l.gear);
  drawBeard(c, l.beard, L, hair, hairD, Sd);
  drawFace(c, h.race, h.beast, l, L, S, Sd, hair);
  drawMark(c, l.mark, L, S, C2);
  drawGear(c, l.gear, L, C1, C1d, C2);
  if (beast && h.beast !== 'dog') drawBeastEars(c, h.beast!, L, S, l.earVar);
  c.outline();
  return c.g;
}

/** 머리카락을 덮는 머리 장비 */
const COVERING = ['helm', 'plumehelm', 'hood', 'hat', 'dwarfhelm', 'hornhelm', 'cap', 'bandana', 'skull'];

interface Paint {
  S: string;
  Sd: string;
  C1: string;
  C1d: string;
  /** 보조색 (바바리안은 털가죽 색) */
  C2: string;
  gender: Gender;
}

const LEATHER = '#4a3424';
const BONE = '#ece6d6';

function drawBack(c: Canvas, style: Style, cls: ClassId, L: Layout, p: Paint): void {
  if (cls === 'archer' && style !== 'dwarf') {
    // 화살통
    c.rect(L.bx1 - 1, L.by0 - 4, 3, 8, WOOD_D);
    c.px(L.bx1 - 1, L.by0 - 5, '#f2ece0');
    c.px(L.bx1 + 1, L.by0 - 5, '#f2ece0');
  }
  if (style === 'human' && cls === 'knight') {
    c.rect(L.bx0 - 1, L.by0 + 1, L.bx1 - L.bx0 + 3, L.by1 - L.by0 + 3, '#3a2f4a'); // 망토
  }
  if (style === 'elf' && (cls === 'knight' || cls === 'archer' || cls === 'warrior')) {
    c.rect(L.bx0 - 1, L.by0 + 1, L.bx1 - L.bx0 + 3, L.by1 - L.by0 + 4, shade(p.C1, 0.6)); // 긴 망토
  }
  if (style === 'barbarian' && (cls === 'mage' || cls === 'priest')) {
    c.rect(L.bx0 - 2, L.by0, L.bx1 - L.bx0 + 5, L.by1 - L.by0 + 4, shade(p.C2, 0.75)); // 털 망토
  }
}

function drawLegs(c: Canvas, style: Style, cls: ClassId, L: Layout, p: Paint): void {
  const y0 = L.by1 + 1;
  const cx = (L.bx0 + L.bx1) >> 1;
  const legs = (pants: string, boot: string, bootH = 2) => {
    c.rect(cx - 3, y0, 3, L.ly1 - y0 + 1, pants);
    c.rect(cx + 1, y0, 3, L.ly1 - y0 + 1, pants);
    c.rect(cx - 4, L.ly1 + 2 - bootH, 4, bootH, boot);
    c.rect(cx + 1, L.ly1 + 2 - bootH, 4, bootH, boot);
  };
  const robe = (color: string, dark: string) => {
    c.rect(L.bx0 - 1, y0, L.bx1 - L.bx0 + 3, L.ly1 - y0 + 1, color);
    c.rect(L.bx0 - 1, L.ly1, L.bx1 - L.bx0 + 3, 1, dark);
    c.rect(L.bx0 + 1, L.ly1 + 1, 3, 1, '#3a2e2a');
    c.rect(L.bx1 - 3, L.ly1 + 1, 3, 1, '#3a2e2a');
  };

  switch (style) {
    case 'human':
      if (cls === 'mage' || cls === 'priest') return robe(cls === 'priest' ? '#e8e4da' : p.C1, cls === 'priest' ? '#c7c2b6' : p.C1d);
      return legs(cls === 'knight' ? METAL_D : cls === 'archer' ? '#5a5a3a' : p.C1d, cls === 'knight' ? '#5a6278' : LEATHER);
    case 'elf':
      if (cls === 'mage' || cls === 'priest') return robe(cls === 'priest' ? '#f2f0ea' : p.C1, p.C1d);
      legs('#6a7a5a', '#8a6a46', 3);
      // 튜닉 자락
      c.rect(L.bx0, y0, L.bx1 - L.bx0 + 1, 2, p.C1);
      return;
    case 'dwarf':
      if (cls === 'mage' || cls === 'priest') {
        // 무릎까지 오는 짧은 로브 + 큰 장화
        c.rect(L.bx0 - 1, y0, L.bx1 - L.bx0 + 3, 2, p.C1);
        legs(LEATHER, '#3a2a1e', 2);
        return;
      }
      return legs(cls === 'knight' ? METAL_D : '#5a4a3a', '#3a2a1e', 2);
    case 'barbarian': {
      // 털 치마 + 맨다리 + 털 장화
      legs(p.S, p.C2, 2);
      c.rect(L.bx0, y0, L.bx1 - L.bx0 + 1, 2, p.C2);
      for (let x = L.bx0; x <= L.bx1; x += 2) c.px(x, y0 + 2, p.C2);
      return;
    }
    case 'beast':
      if (cls === 'mage' || cls === 'priest') return robe(cls === 'priest' ? '#e8e4da' : p.C1, p.C1d);
      // 반바지 + 맨발(털)
      c.rect(cx - 3, y0, 3, 2, p.C1d);
      c.rect(cx + 1, y0, 3, 2, p.C1d);
      c.rect(cx - 3, y0 + 2, 3, L.ly1 - y0 - 1, p.S);
      c.rect(cx + 1, y0 + 2, 3, L.ly1 - y0 - 1, p.S);
      c.rect(cx - 4, L.ly1 + 1, 4, 1, p.Sd);
      c.rect(cx + 1, L.ly1 + 1, 4, 1, p.Sd);
      return;
  }
}

function drawBody(c: Canvas, style: Style, cls: ClassId, L: Layout, p: Paint): void {
  const { bx0, bx1, by0, by1 } = L;
  const w = bx1 - bx0 + 1;
  const h = by1 - by0 + 1;
  const cx = (bx0 + bx1) >> 1;
  const { S, C1, C1d, C2 } = p;
  let sleeve = C1;
  let pauldron: string | null = null;

  switch (style) {
    case 'human':
      switch (cls) {
        case 'knight':
          sleeve = METAL;
          pauldron = METAL_D;
          c.rect(bx0, by0, w, h, METAL);
          c.rect(bx0, by1, w, 1, METAL_D);
          c.rect(cx - 1, by0 + 1, 3, h, C1);
          c.px(cx, by0 + 2, C2);
          break;
        case 'warrior':
          sleeve = S;
          c.rect(bx0, by0, w, h, C1);
          c.rect(cx - 1, by0, 3, 3, S);
          c.px(cx, by0 + 3, S);
          c.rect(bx0, by1 - 1, w, 2, LEATHER);
          c.px(cx, by1 - 1, GOLD);
          break;
        case 'archer':
          c.rect(bx0, by0, w, h, C1);
          c.rect(bx0, by0, w, 1, C1d);
          c.rect(bx0, by1 - 1, w, 1, LEATHER);
          c.rect(bx0 + 1, by0 + 1, 1, h - 2, LEATHER);
          break;
        case 'mage':
          c.rect(bx0, by0, w, h, C1);
          c.rect(cx, by0, 1, h, C2);
          c.rect(bx0, by1 - 2, w, 1, C2);
          break;
        case 'priest':
          sleeve = '#f2f0ea';
          c.rect(bx0, by0, w, h, '#f2f0ea');
          c.rect(cx - 1, by0, 2, h, C1);
          c.rect(cx - 1, by0 + 2, 2, 1, GOLD);
          break;
      }
      break;

    case 'elf': {
      // 날씬한 튜닉 + 대각선 띠 (기사는 은빛 경갑)
      const base = cls === 'knight' ? '#d8e0ea' : cls === 'priest' ? '#f2f0ea' : C1;
      sleeve = base;
      c.rect(bx0, by0, w, h, base);
      for (let i = 0; i < h; i++) c.px(bx0 + Math.min(w - 1, i), by0 + i, cls === 'knight' ? C1 : C2);
      c.rect(bx0, by1 - 1, w, 1, '#8a6a46');
      if (cls === 'knight') pauldron = METAL;
      break;
    }

    case 'dwarf': {
      // 두꺼운 가죽·쇠, 넓은 허리띠와 금 버클
      const base = cls === 'knight' ? METAL_D : cls === 'priest' ? '#d8cfb8' : C1;
      sleeve = cls === 'mage' || cls === 'priest' ? base : LEATHER;
      c.rect(bx0, by0, w, h, base);
      c.rect(bx0, by1 - 2, w, 2, LEATHER);
      c.rect(cx - 1, by1 - 2, 2, 2, GOLD);
      if (cls === 'mage') c.rect(cx - 1, by0 + 1, 2, 1, '#5ad0f0'); // 룬
      if (cls === 'priest') c.rect(cx - 1, by0 + 1, 2, 2, C1);
      if (cls === 'knight' || cls === 'warrior') pauldron = METAL;
      break;
    }

    case 'barbarian': {
      // 성별 무관 털가죽 조끼, 남성은 가슴이 드러남. 맨팔에 털 팔찌
      sleeve = S;
      if (p.gender === 'm') {
        c.rect(bx0, by0, w, h, S);
        c.rect(bx0, by0, 2, h, C2);
        c.rect(bx1 - 1, by0, 2, h, C2);
        c.px(cx - 1, by0 + 3, p.Sd);
        c.px(cx + 1, by0 + 3, p.Sd);
      } else {
        c.rect(bx0, by0, w, h, C2);
        c.rect(cx - 1, by0, 2, 2, S);
      }
      c.rect(bx0, by1 - 1, w, 2, LEATHER);
      c.px(cx, by1 - 1, BONE);
      if (cls === 'mage' || cls === 'priest') {
        // 뼈 목걸이
        for (let x = bx0 + 1; x < bx1; x += 2) c.px(x, by0 + 1, BONE);
      }
      if (cls === 'knight') {
        c.rect(cx - 1, by0 + 1, 3, 4, METAL); // 가슴 보호대
      }
      pauldron = C2;
      break;
    }

    case 'beast': {
      // 셔츠 위에 조끼, 팔은 털
      sleeve = S;
      c.rect(bx0, by0, w, h, '#e8e0d0');
      c.rect(bx0, by0, 3, h, C1);
      c.rect(bx1 - 2, by0, 3, h, C1);
      c.rect(bx0, by1 - 1, w, 1, LEATHER);
      if (cls === 'knight') c.rect(bx0 + 2, by0 + 1, w - 4, 4, METAL);
      if (cls === 'mage' || cls === 'priest') {
        c.rect(bx0 - 1, by0, w + 2, 2, cls === 'priest' ? '#f2f0ea' : C1); // 짧은 망토
        c.px(cx, by0 + 3, cls === 'priest' ? GOLD : '#5ad0f0'); // 부적
      }
      break;
    }
  }

  // 팔 + 손
  const armTop = by0;
  const armBot = by1 - 1;
  c.rect(bx0 - 2, armTop, 2, armBot - armTop + 1, sleeve);
  c.rect(bx1 + 1, armTop, 2, armBot - armTop + 1, sleeve);
  if (pauldron) {
    c.rect(bx0 - 2, armTop, 2, 2, pauldron);
    c.rect(bx1 + 1, armTop, 2, 2, pauldron);
  }
  if (style === 'barbarian') {
    c.rect(bx0 - 2, armBot - 1, 2, 1, C2);
    c.rect(bx1 + 1, armBot - 1, 2, 1, C2);
  }
  c.rect(bx0 - 2, armBot + 1, 2, 1, S);
  c.rect(bx1 + 1, armBot + 1, 2, 1, S);
}

function drawWeapon(c: Canvas, style: Style, cls: ClassId, weapon: string, L: Layout, C1: string, C2: string, eyeColor: number): void {
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
    case 'crossbow':
      c.rect(hx - 2, hy - 2, 6, 1, WOOD);
      c.px(hx - 3, hy - 3, WOOD);
      c.px(hx + 4, hy - 3, WOOD);
      c.rect(hx, hy - 3, 2, 4, WOOD_D);
      c.px(hx + 1, hy - 4, METAL);
      break;
    case 'skullstaff':
      c.rect(hx, L.hy0 + 5, 1, L.ly1 - L.hy0 - 4, WOOD_D);
      c.rect(hx - 1, L.hy0 + 2, 3, 3, BONE);
      c.px(hx - 1, L.hy0 + 3, '#241a22');
      c.px(hx + 1, L.hy0 + 3, '#241a22');
      c.px(hx - 2, L.hy0 + 1, BONE);
      c.px(hx + 2, L.hy0 + 1, BONE);
      c.px(hx, L.hy0 + 1, '#7affd0');
      break;
    case 'totem':
      c.rect(hx, L.hy0 + 4, 1, L.ly1 - L.hy0 - 3, WOOD);
      c.rect(hx - 1, L.hy0 + 1, 3, 3, C2);
      c.px(hx - 2, L.hy0 + 2, '#c8402f');
      c.px(hx + 2, L.hy0 + 2, '#3d6fd1');
      c.px(hx, L.hy0, '#f2ece0');
      break;
    case 'book':
      c.rect(L.bx0 - 5, L.by1 - 3, 4, 4, C1);
      c.rect(L.bx0 - 5, L.by1 - 3, 4, 1, GOLD);
      c.px(L.bx0 - 3, L.by1 - 1, GOLD);
      break;
  }
  if (cls === 'knight' && style === 'barbarian') {
    // 둥근 나무 방패
    const x = L.bx0 - 7;
    const y = L.by0;
    c.rect(x + 1, y, 4, 7, WOOD);
    c.rect(x, y + 1, 6, 5, WOOD);
    c.rect(x + 2, y + 2, 2, 3, METAL_D);
    c.px(x + 1, y + 1, WOOD_D);
    c.px(x + 4, y + 5, WOOD_D);
  } else if (cls === 'knight') {
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
  const covered = COVERING.includes(gear);
  if (covered && !['long', 'bob', 'ponytail', 'braids', 'twintail'].includes(style)) return;
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
    case 'twintail':
      c.rect(hx0 - 3, hy0 + 1, 2, 8, H);
      c.rect(hx1 + 2, hy0 + 1, 2, 8, H);
      c.px(hx0 - 2, hy0 + 1, '#e85a7a');
      c.px(hx1 + 2, hy0 + 1, '#e85a7a');
      c.rect(hx0 - 3, hy0 + 9, 1, 1, Hd);
      c.rect(hx1 + 3, hy0 + 9, 1, 1, Hd);
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

  // 여성: 바깥쪽 속눈썹
  if (l.gender === 'f' && l.eyes !== 'happy') {
    c.px(lx - 1, ey, D);
    c.px(rx + 2, ey, D);
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

  // 입 (여성은 입술색)
  const my = hy0 + 9;
  const lip = l.gender === 'f' && race !== 'beastfolk' ? '#b8485a' : D;
  switch (l.gender === 'f' && l.mouth === 'fang' ? 'smile' : l.mouth) {
    case 'smile':
      c.px(cx - 2, my - 1, lip);
      c.rect(cx - 1, my, 2, 1, lip);
      c.px(cx + 1, my - 1, lip);
      break;
    case 'flat':
      c.rect(cx - 1, my, 2, 1, lip);
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
      c.rect(cx - 1, my, 2, 1, lip);
      c.px(cx + 1, my - 1, lip);
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
    case 'elfhelm':
      // 은빛 띠 + 양옆 날개
      c.rect(hx0, hy0 + 1, w, 2, '#e0e8f2');
      c.px(cx, hy0 + 1, '#5ad0a0');
      for (const [x, d] of [[hx0 - 1, -1], [hx1 + 1, 1]] as const) {
        c.px(x, hy0 + 1, '#e0e8f2');
        c.px(x + d, hy0, '#e0e8f2');
        c.px(x + d * 2, hy0 - 1, '#e0e8f2');
        c.px(x + d, hy0 - 1, '#e0e8f2');
      }
      break;
    case 'leafcrown':
      for (let x = hx0; x <= hx1; x += 2) {
        c.px(x, hy0 - 1, '#5ab05a');
        c.px(x + 1, hy0 - 2, '#7ad07a');
      }
      c.rect(hx0, hy0, w, 1, '#3a7a3a');
      break;
    case 'dwarfhelm':
      // 둥근 쇠 투구 + 코 가리개
      c.rect(hx0 - 1, hy0 - 1, w + 2, 4, METAL_D);
      c.rect(hx0, hy0 - 2, w, 1, METAL);
      c.rect(hx0 - 1, hy0 + 2, w + 2, 1, METAL);
      c.rect(cx - 1, hy0 + 3, 1, 3, METAL);
      c.px(hx0 + 2, hy0 - 1, '#eef2fa');
      break;
    case 'hornhelm':
      c.rect(hx0 - 1, hy0 - 1, w + 2, 4, METAL_D);
      c.rect(hx0 - 1, hy0 + 2, w + 2, 1, METAL);
      for (const [x, d] of [[hx0 - 2, -1], [hx1 + 2, 1]] as const) {
        c.px(x, hy0, BONE);
        c.px(x, hy0 - 1, BONE);
        c.px(x + d, hy0 - 2, BONE);
        c.px(x + d, hy0 - 3, BONE);
      }
      break;
    case 'cap':
      c.rect(hx0, hy0 - 1, w, 3, '#7a5636');
      c.rect(hx0 - 1, hy0 + 1, w + 3, 1, '#5c4428');
      c.px(cx, hy0 - 1, '#c8402f');
      break;
    case 'goggles':
      c.rect(hx0, hy0 + 1, w, 1, LEATHER);
      c.rect(hx0 + 2, hy0, 3, 3, '#7a5636');
      c.rect(hx1 - 4, hy0, 3, 3, '#7a5636');
      c.px(hx0 + 3, hy0 + 1, '#8ad0f0');
      c.px(hx1 - 3, hy0 + 1, '#8ad0f0');
      break;
    case 'runeband':
      c.rect(hx0, hy0 + 2, w, 1, '#3a2e4a');
      c.px(cx - 1, hy0 + 2, '#5ad0f0');
      c.px(cx, hy0 + 2, '#5ad0f0');
      break;
    case 'bone':
      // 가죽 띠 + 뼈 장식 + 깃털
      c.rect(hx0, hy0 + 2, w, 1, LEATHER);
      c.px(hx0 + 2, hy0 + 2, BONE);
      c.px(hx1 - 2, hy0 + 2, BONE);
      c.rect(hx1 - 1, hy0 - 3, 1, 4, '#c8402f');
      c.px(hx1, hy0 - 4, '#c8402f');
      c.rect(hx1 - 3, hy0 - 2, 1, 3, BONE);
      break;
    case 'skull':
      // 짐승 두개골 머리장식 + 뿔
      c.rect(hx0 + 1, hy0 - 2, w - 2, 4, BONE);
      c.px(cx - 2, hy0, '#241a22');
      c.px(cx + 1, hy0, '#241a22');
      c.rect(hx0 - 1, hy0, 2, 4, C2);
      c.rect(hx1, hy0, 2, 4, C2);
      for (const [x, d] of [[hx0, -1], [hx1, 1]] as const) {
        c.px(x, hy0 - 3, BONE);
        c.px(x + d, hy0 - 4, BONE);
        c.px(x + d * 2, hy0 - 5, BONE);
        c.px(x + d * 2, hy0 - 3, BONE);
      }
      break;
    case 'bandana':
      c.rect(hx0, hy0 - 1, w, 3, C1);
      c.rect(hx0, hy0 + 1, w, 1, C1d);
      c.rect(hx1 + 1, hy0 + 1, 2, 2, C1);
      c.px(hx1 + 3, hy0 + 3, C1);
      c.px(hx0 + 3, hy0, '#ffffff');
      c.px(hx0 + 7, hy0, '#ffffff');
      break;
    case 'flower':
      c.rect(hx1 - 2, hy0, 3, 3, '#f08ab0');
      c.px(hx1 - 1, hy0 + 1, GOLD);
      c.px(hx1 - 3, hy0 + 2, '#5ab05a');
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
