import type { Element, Row, Stats, UnitInit } from '../battle/types';
import { CLASSES, statsAtLevel, type ClassId } from './classes';
import { randomName } from './names';
import { TRAITS, TRAIT_IDS, type TraitId } from './traits';

/** 외형 = 부위 조합 (GDD 13). 숫자는 art/heroLook.ts의 팔레트/장식 목록 인덱스 */
export interface Look {
  skin: number;
  hair: number;
  cloth: number;
  /** 장식 id ('none' 포함). 직업마다 쓸 수 있는 장식이 다름 */
  acc: string;
}

export type HeroStatus = 'ready' | 'injured' | 'dead';

export interface Hero {
  id: string;
  name: string;
  classId: ClassId;
  element: Element;
  level: number;
  xp: number;
  traits: TraitId[];
  /** 개체값: 같은 직업이라도 능력치가 조금씩 다름 (0.92~1.08) */
  statMul: { hp: number; atk: number; def: number; spd: number };
  look: Look;
  status: HeroStatus;
  /** 중상 회복 시각 (epoch ms) */
  injuredUntil?: number;
  /** 도전해 본 가장 높은 층 */
  bestFloor: number;
  /** 사망 기록 */
  diedFloor?: number;
  diedAt?: number;
  recruitedAt: number;
}

// ─── 수치 (GDD 16 미정 사항 → 임시값) ───
/** 중상 회복 시간 */
export const INJURY_MS = 5 * 60 * 1000;
/** 층 클리어 시 참여 영웅 1명이 얻는 경험치 = XP_PER_FLOOR × 층 */
export const XP_PER_FLOOR = 100;
/** 다음 레벨까지 필요 경험치 = XP_PER_LEVEL × 현재 레벨 */
export const XP_PER_LEVEL = 100;
/** 로스터 최대 인원 (이후 숙소 업그레이드로 확장) */
export const ROSTER_MAX = 12;

export const LOOK_COUNTS = { skin: 4, hair: 6, cloth: 5 };

/** 직업별로 붙을 수 있는 장식 */
export const ACCESSORIES: Record<ClassId, string[]> = {
  knight: ['none', 'plume'],
  warrior: ['none', 'beard', 'eyepatch', 'scar', 'headband'],
  archer: ['none', 'scar', 'eyepatch'],
  mage: ['none', 'beard', 'scar'],
  priest: ['none', 'beard', 'headband'],
};

/** 진형 슬롯 5개: 전열 2 / 중열 1 / 후열 2 (GDD 4.1) */
export const FORMATION_SLOTS: { row: Row; slot: number }[] = [
  { row: 'front', slot: 0 },
  { row: 'front', slot: 1 },
  { row: 'mid', slot: 0 },
  { row: 'back', slot: 0 },
  { row: 'back', slot: 1 },
];

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export function generateHero(rand: () => number, id: string, taken: Set<string>, opts: { classId?: ClassId; now?: number } = {}): Hero {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const classId = opts.classId ?? pick(CLASS_IDS);

  const r = rand();
  const element: Element = r < 0.4 ? 'none' : r < 0.6 ? 'fire' : r < 0.8 ? 'water' : 'wind';

  const traits: TraitId[] = [];
  const count = rand() < 0.35 ? 2 : 1;
  while (traits.length < count) {
    const t = pick(TRAIT_IDS);
    if (traits.includes(t)) continue;
    if (traits.some((x) => TRAITS[x].conflicts?.includes(t))) continue;
    traits.push(t);
  }

  const vary = () => Math.round((0.92 + rand() * 0.16) * 100) / 100;

  return {
    id,
    name: randomName(rand, taken),
    classId,
    element,
    level: 1,
    xp: 0,
    traits,
    statMul: { hp: vary(), atk: vary(), def: vary(), spd: vary() },
    look: {
      skin: Math.floor(rand() * LOOK_COUNTS.skin),
      hair: Math.floor(rand() * LOOK_COUNTS.hair),
      cloth: Math.floor(rand() * LOOK_COUNTS.cloth),
      acc: rand() < 0.4 ? 'none' : pick(ACCESSORIES[classId]),
    },
    status: 'ready',
    bestFloor: 0,
    recruitedAt: opts.now ?? Date.now(),
  };
}

/** 레벨·개체값·특성을 반영한 최종 능력치 */
export function heroStats(h: Hero): Stats {
  const s = statsAtLevel(CLASSES[h.classId].base, h.level);
  const has = (t: TraitId) => h.traits.includes(t);
  return {
    hp: Math.round(s.hp * h.statMul.hp * (has('sturdy') ? 1.15 : 1)),
    atk: Math.round(s.atk * h.statMul.atk),
    def: Math.round(s.def * h.statMul.def),
    spd: Math.round(s.spd * h.statMul.spd * (has('swift') ? 1.1 : 1) * (has('ironSkin') ? 0.9 : 1)),
    crit: s.crit + (has('keen') ? 0.1 : 0),
  };
}

export function heroToUnit(h: Hero, slotIndex: number): UnitInit {
  const c = CLASSES[h.classId];
  const pos = FORMATION_SLOTS[slotIndex];
  return {
    id: h.id,
    name: h.name,
    side: 'ally',
    kind: c.id,
    texture: `hero-${h.id}`,
    element: h.element,
    row: pos.row,
    slot: pos.slot,
    stats: heroStats(h),
    basic: c.basic,
    skills: c.skills,
    level: h.level,
    traits: h.traits,
  };
}

export function xpToNext(level: number): number {
  return XP_PER_LEVEL * level;
}

/** 경험치를 더하고 오른 레벨 수를 돌려줌 */
export function gainXp(h: Hero, xp: number): number {
  let ups = 0;
  h.xp += xp;
  while (h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    ups++;
  }
  return ups;
}

export function injuryDuration(h: Hero): number {
  return h.traits.includes('fastRecovery') ? INJURY_MS / 2 : INJURY_MS;
}

/** 회복 시간이 지난 중상 영웅을 정상으로 되돌림. 바뀐 게 있으면 true */
export function tickRecovery(heroes: Hero[], now: number): boolean {
  let changed = false;
  for (const h of heroes) {
    if (h.status === 'injured' && (h.injuredUntil ?? 0) <= now) {
      h.status = 'ready';
      delete h.injuredUntil;
      changed = true;
    }
  }
  return changed;
}
