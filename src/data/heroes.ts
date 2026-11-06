import { CLOTHS, lookSignature, randomLook, type Look } from '../art/heroArt';
import type { Row, Stats, UnitInit } from '../battle/types';
import { CLASSES, statsAtLevel, type ClassId } from './classes';
import { randomName } from './names';
import { BEAST_KINDS, raceTrait, type BeastKind, type RaceId } from './races';
import { TRAITS, TRAIT_IDS, type TraitId } from './traits';

export type { Look };

export type HeroStatus = 'ready' | 'injured' | 'dead';

export interface Hero {
  id: string;
  name: string;
  classId: ClassId;
  race: RaceId;
  /** 수인 갈래 */
  beast?: BeastKind;
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

/** 종족 출현 비율 */
const RACE_WEIGHTS: [RaceId, number][] = [
  ['human', 0.28],
  ['elf', 0.18],
  ['dwarf', 0.18],
  ['barbarian', 0.14],
  ['beastfolk', 0.22],
];

/** 진형 슬롯 5개: 전열 2 / 중열 1 / 후열 2 (GDD 4.1) */
export const FORMATION_SLOTS: { row: Row; slot: number }[] = [
  { row: 'front', slot: 0 },
  { row: 'front', slot: 1 },
  { row: 'mid', slot: 0 },
  { row: 'back', slot: 0 },
  { row: 'back', slot: 1 },
];

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export interface GenContext {
  /** 이미 쓰인 이름 */
  names: Set<string>;
  /** 이미 있는 외형 (산 영웅 + 죽은 영웅). 같은 얼굴은 만들지 않음 */
  looks: Set<string>;
}

export function heroLookKey(h: Pick<Hero, 'race' | 'beast' | 'classId' | 'look'>): string {
  return lookSignature(h.race, h.beast, h.classId, h.look);
}

export function generateHero(rand: () => number, id: string, ctx: GenContext, opts: { classId?: ClassId; race?: RaceId; now?: number } = {}): Hero {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const classId = opts.classId ?? pick(CLASS_IDS);

  let race = opts.race;
  if (!race) {
    let r = rand();
    race = RACE_WEIGHTS[RACE_WEIGHTS.length - 1][0];
    for (const [id, w] of RACE_WEIGHTS) {
      if (r < w) {
        race = id;
        break;
      }
      r -= w;
    }
  }
  const beast = race === 'beastfolk' ? pick(BEAST_KINDS) : undefined;

  const traits: TraitId[] = [];
  const count = rand() < 0.35 ? 2 : 1;
  while (traits.length < count) {
    const t = pick(TRAIT_IDS);
    if (traits.includes(t)) continue;
    if (traits.some((x) => TRAITS[x].conflicts?.includes(t))) continue;
    traits.push(t);
  }

  const vary = () => Math.round((0.92 + rand() * 0.16) * 100) / 100;

  // 같은 얼굴이 나오면 다시 뽑기 (GDD 3.1: 모든 영웅의 얼굴이 달라야 함)
  let look = randomLook(rand, race, beast, classId);
  for (let i = 0; i < 30 && ctx.looks.has(lookSignature(race, beast, classId, look)); i++) look = randomLook(rand, race, beast, classId);
  ctx.looks.add(lookSignature(race, beast, classId, look));

  const name = randomName(rand, ctx.names, race);
  ctx.names.add(name);

  return {
    id,
    name,
    classId,
    race,
    beast,
    level: 1,
    xp: 0,
    traits,
    statMul: { hp: vary(), atk: vary(), def: vary(), spd: vary() },
    look,
    status: 'ready',
    bestFloor: 0,
    recruitedAt: opts.now ?? Date.now(),
  };
}

export function heroRace(h: Pick<Hero, 'race' | 'beast'>) {
  return raceTrait(h.race, h.beast);
}

/** 레벨·개체값·특성을 반영한 최종 능력치 */
export function heroStats(h: Hero): Stats {
  const s = statsAtLevel(CLASSES[h.classId].base, h.level);
  const has = (t: TraitId) => h.traits.includes(t);
  const m = heroRace(h).mod;
  return {
    hp: Math.round(s.hp * h.statMul.hp * (m.hp ?? 1) * (has('sturdy') ? 1.15 : 1)),
    atk: Math.round(s.atk * h.statMul.atk * (m.atk ?? 1)),
    def: Math.round(s.def * h.statMul.def * (m.def ?? 1)),
    spd: Math.round(s.spd * h.statMul.spd * (m.spd ?? 1) * (has('swift') ? 1.1 : 1) * (has('ironSkin') ? 0.9 : 1)),
    crit: s.crit + (m.crit ?? 0) + (has('keen') ? 0.1 : 0),
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
    favored: [heroRace(h).favored],
    fxColor: parseInt(CLOTHS[h.look.cloth % CLOTHS.length].slice(1), 16),
    row: pos.row,
    slot: pos.slot,
    stats: heroStats(h),
    basic: c.basic,
    skills: c.skills,
    level: h.level,
    traits: [...h.traits, ...(heroRace(h).hooks ?? [])],
  };
}

export function xpToNext(level: number): number {
  return XP_PER_LEVEL * level;
}

/** 경험치를 더하고 오른 레벨 수를 돌려줌 (인간은 +20%) */
export function gainXp(h: Hero, xp: number): number {
  let ups = 0;
  h.xp += Math.round(xp * (heroRace(h).xp ?? 1));
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
