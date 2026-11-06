import { CLOTHS, lookSignature, randomLook, type Gender, type Look } from '../art/heroArt';
import type { CombatFx, Stats, UnitInit } from '../battle/types';
import { CLASSES, roleOf, statsAtLevel, type ClassId } from './classes';
import { FORMATIONS, slotPosition, type FormationId } from './formations';
import { GRADES, SPECIALS, weaponUsable, type Weapon } from './items';
import { randomName } from './names';
import { BEAST_KINDS, FAVORED_BONUS, raceTrait, type BeastKind, type Family, type RaceId } from './races';
import { rollBirthTraits, traitEffects, type HeroTrait } from './traits';

export type { Gender, Look };

export type HeroStatus = 'ready' | 'injured' | 'dead';

/** 일대기 한 줄 (GDD 3.7) */
export interface LogEntry {
  t: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'death';
}

export interface Hero {
  id: string;
  name: string;
  classId: ClassId;
  gender: Gender;
  race: RaceId;
  /** 수인 갈래 */
  beast?: BeastKind;
  /** 전투 역할 (classes.ts의 RoleDef id) */
  role: string;
  level: number;
  xp: number;
  traits: HeroTrait[];
  /** 개체값: 같은 직업이라도 능력치가 조금씩 다름 (0.92~1.08) */
  statMul: { hp: number; atk: number; def: number; spd: number };
  look: Look;
  status: HeroStatus;
  /** 중상 회복 시각 (epoch ms) */
  injuredUntil?: number;
  /** 도전해 본 가장 높은 층 / 클리어한 가장 높은 층 */
  bestFloor: number;
  bestCleared: number;
  /** 누적 기록 */
  record: { battles: number; wins: number; kills: number; killsBy: Partial<Record<Family, number>> };
  log: LogEntry[];
  /** 장착한 무기 (GDD 7.3: 영웅이 죽으면 함께 소실) */
  weapon?: Weapon;
  /** 피로 (GDD 3.2.1): fatigueAt 시점의 값. 실제 값은 fatigueNow()로 */
  fatigue: number;
  fatigueAt: number;
  /** 사망 기록 */
  diedFloor?: number;
  diedAt?: number;
  diedBy?: string;
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
/** 일대기 최대 줄 수 */
export const LOG_MAX = 40;

// ─── 피로 (GDD 3.2.1) ───
export const FATIGUE_MAX = 10;
export const FATIGUE_TOWER = 5;
export const FATIGUE_DUNGEON = 3;
/** 피로 1당 체력·공격·방어 감소 */
export const FATIGUE_PENALTY = 0.03;
/** 피로 1 회복 시간 */
export const FATIGUE_RECOVER_MS = 6 * 60 * 1000;

/** 지금 피로 (시간 경과 반영, 소수) */
export function fatigueNow(h: Pick<Hero, 'fatigue' | 'fatigueAt'>, now = Date.now()): number {
  return Math.max(0, (h.fatigue ?? 0) - (now - (h.fatigueAt ?? now)) / FATIGUE_RECOVER_MS);
}

/** 화면·능력치 계산용 피로 (올림 정수) */
export function fatigueLevel(h: Pick<Hero, 'fatigue' | 'fatigueAt'>, now = Date.now()): number {
  return Math.ceil(fatigueNow(h, now) - 1e-9);
}

export function canAfford(h: Pick<Hero, 'fatigue' | 'fatigueAt'>, cost: number, now = Date.now()): boolean {
  return fatigueLevel(h, now) + cost <= FATIGUE_MAX;
}

export function addFatigue(h: Hero, cost: number, now = Date.now()): void {
  h.fatigue = Math.min(FATIGUE_MAX, fatigueNow(h, now) + cost);
  h.fatigueAt = now;
}

/** 다음 피로 1이 회복될 때까지 남은 시간 */
export function fatigueNextMs(h: Pick<Hero, 'fatigue' | 'fatigueAt'>, now = Date.now()): number {
  const f = fatigueNow(h, now);
  if (f <= 0) return 0;
  return (f - Math.floor(f - 1e-9)) * FATIGUE_RECOVER_MS;
}

/** 종족 출현 비율 */
const RACE_WEIGHTS: [RaceId, number][] = [
  ['human', 0.28],
  ['elf', 0.18],
  ['dwarf', 0.18],
  ['barbarian', 0.14],
  ['beastfolk', 0.22],
];

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const GRADE_FX = GRADES.map((g) => g.color);

export interface GenContext {
  /** 이미 쓰인 이름 */
  names: Set<string>;
  /** 이미 있는 외형 (산 영웅 + 죽은 영웅). 같은 얼굴은 만들지 않음 */
  looks: Set<string>;
}

export function heroLookKey(h: Pick<Hero, 'race' | 'beast' | 'classId' | 'look'>): string {
  return lookSignature(h.race, h.beast, h.classId, h.look);
}

export function generateHero(rand: () => number, id: string, ctx: GenContext, opts: { classId?: ClassId; race?: RaceId; gender?: Gender; now?: number } = {}): Hero {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const classId = opts.classId ?? pick(CLASS_IDS);
  const now = opts.now ?? Date.now();

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
  const gender: Gender = opts.gender ?? (rand() < 0.5 ? 'm' : 'f');
  const vary = () => Math.round((0.92 + rand() * 0.16) * 100) / 100;

  // 같은 얼굴이 나오면 다시 뽑기 (GDD 3.1: 모든 영웅의 얼굴이 달라야 함)
  let look = randomLook(rand, race, beast, classId, gender);
  for (let i = 0; i < 30 && ctx.looks.has(lookSignature(race, beast, classId, look)); i++) look = randomLook(rand, race, beast, classId, gender);
  ctx.looks.add(lookSignature(race, beast, classId, look));

  const name = randomName(rand, ctx.names, race, gender);
  ctx.names.add(name);

  return {
    id,
    name,
    classId,
    gender,
    race,
    beast,
    role: CLASSES[classId].roles[0].id,
    level: 1,
    xp: 0,
    traits: rollBirthTraits(rand),
    statMul: { hp: vary(), atk: vary(), def: vary(), spd: vary() },
    look,
    status: 'ready',
    bestFloor: 0,
    bestCleared: 0,
    record: { battles: 0, wins: 0, kills: 0, killsBy: {} },
    fatigue: 0,
    fatigueAt: now,
    log: [{ t: now, text: '탑의 마을에 도착해 모집에 응함', tone: 'info' }],
    recruitedAt: now,
  };
}

export function heroRace(h: Pick<Hero, 'race' | 'beast'>) {
  return raceTrait(h.race, h.beast);
}

function addFx(a: CombatFx, b: CombatFx | undefined): CombatFx {
  if (!b) return a;
  const out: CombatFx = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof CombatFx, unknown][]) {
    if (typeof v === 'number') (out[k] as number) = ((out[k] as number | undefined) ?? 0) + v;
    else if (v && typeof v === 'object') {
      const m = { ...((out[k] as Record<string, number> | undefined) ?? {}) };
      for (const [f, n] of Object.entries(v as Record<string, number>)) m[f] = (m[f] ?? 0) + n;
      (out[k] as Record<string, number>) = m;
    }
  }
  return out;
}

export interface HeroContext {
  formation?: FormationId;
  /** 진형 슬롯 (없으면 위치 효과 없음) */
  slot?: number;
  floor?: number;
  /** 피로 계산 시각 (없으면 지금). 시뮬레이터는 피로 0 */
  now?: number;
  ignoreFatigue?: boolean;
}

/** 레벨·개체값·종족·특성·역할·진형·무기·피로를 반영한 능력치와 전투 효과 */
export function heroCombat(h: Hero, ctx: HeroContext = {}): { stats: Stats; fx: CombatFx } {
  const s = statsAtLevel(CLASSES[h.classId].base, h.level);
  const race = heroRace(h);
  const m = race.mod;
  const formation = ctx.formation ?? 'basic';
  const row = ctx.slot !== undefined ? slotPosition(formation, ctx.slot).row : undefined;
  const te = traitEffects(h.traits, { floor: ctx.floor ?? 1 });
  const role = roleOf(h.classId, h.role).mod ?? {};
  const fEff = FORMATIONS[formation].effects;
  const rowEff = row ? fEff[row] ?? {} : {};
  const allEff = fEff.all ?? {};

  // 무기 (내구도 0이면 효과 없음)
  const w = weaponUsable(h.weapon) ? h.weapon! : null;
  const wOpt = (k: string) => (w ? w.opts.filter((o) => o.k === k).reduce((a, o) => a + o.v, 0) : 0);
  const wAdd = (k: 'hp' | 'atk' | 'def' | 'spd') => (!w ? 0 : k === 'atk' ? w.atk : wOpt(k));
  const tired = ctx.ignoreFatigue ? 0 : fatigueLevel(h, ctx.now) * FATIGUE_PENALTY;
  const mul = (k: 'hp' | 'atk' | 'def' | 'spd') =>
    Math.max(
      0.3,
      1 +
        te.stat[k] +
        (k === 'atk' ? role.atk ?? 0 : k === 'def' ? role.def ?? 0 : 0) +
        (k !== 'hp' ? (rowEff[k] ?? 0) + (allEff[k] ?? 0) : 0) +
        wAdd(k) -
        (k !== 'spd' ? tired : 0),
    );

  const stats: Stats = {
    hp: Math.round(s.hp * h.statMul.hp * (m.hp ?? 1) * mul('hp')),
    atk: Math.round(s.atk * h.statMul.atk * (m.atk ?? 1) * mul('atk')),
    def: Math.round(s.def * h.statMul.def * (m.def ?? 1) * mul('def')),
    spd: Math.round(s.spd * h.statMul.spd * (m.spd ?? 1) * mul('spd')),
    crit: s.crit + (m.crit ?? 0) + te.crit + wOpt('crit'),
  };

  let fx: CombatFx = { vsFamily: { [race.favored]: FAVORED_BONUS } };
  fx = addFx(fx, race.fx);
  fx = addFx(fx, te.fx);
  fx = addFx(fx, rowEff.fx);
  fx = addFx(fx, allEff.fx);
  if (w) {
    const healGive = wOpt('healGive');
    if (healGive) fx = addFx(fx, { healGive });
    for (const sp of w.specials) {
      const v = SPECIALS[sp.id].values[sp.lv];
      if (sp.id === 'laststand') fx.lastStand = Math.max(fx.lastStand ?? 0, v);
      else if (sp.id === 'lifesteal') fx.lifesteal = (fx.lifesteal ?? 0) + v;
      else if (sp.id === 'vital') fx.critDmg = (fx.critDmg ?? 0) + v;
      else if (sp.id === 'chain') fx.chain = Math.max(fx.chain ?? 0, v);
      else if (sp.id === 'miracle') fx.miracle = Math.max(fx.miracle ?? 0, v);
    }
  }
  return { stats, fx };
}

/** 피로를 뺀 기본 능력치 (영웅 상세용) */
export function heroStats(h: Hero): Stats {
  return heroCombat(h, { ignoreFatigue: true }).stats;
}

export function heroToUnit(h: Hero, slot: number, ctx: { formation: FormationId; floor: number; now?: number; ignoreFatigue?: boolean }): UnitInit {
  const pos = slotPosition(ctx.formation, slot);
  const role = roleOf(h.classId, h.role);
  const { stats, fx } = heroCombat(h, { ...ctx, slot });
  return {
    id: h.id,
    name: h.name,
    side: 'ally',
    kind: h.classId,
    texture: `hero-${h.id}`,
    fx,
    fxColor: weaponUsable(h.weapon) ? GRADE_FX[h.weapon!.grade] : parseInt(CLOTHS[h.look.cloth % CLOTHS.length].slice(1), 16),
    row: pos.row,
    slot: pos.index,
    stats,
    basic: role.basic,
    skills: role.skills,
    level: h.level,
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
  const te = traitEffects(h.traits, { floor: 1 });
  return Math.round(INJURY_MS * Math.max(0.25, 1 + te.injury));
}

export function addLog(h: Hero, text: string, tone: LogEntry['tone'] = 'info', t = Date.now()): void {
  h.log.push({ t, text, tone });
  // 너무 길어지면 앞쪽 몇 줄(모집 등)은 남기고 중간을 줄임
  if (h.log.length > LOG_MAX) h.log.splice(3, h.log.length - LOG_MAX);
}

/** 회복 시간이 지난 중상 영웅을 정상으로 되돌림. 바뀐 게 있으면 true */
export function tickRecovery(heroes: Hero[], now: number): boolean {
  let changed = false;
  for (const h of heroes) {
    if (h.status === 'injured' && (h.injuredUntil ?? 0) <= now) {
      h.status = 'ready';
      delete h.injuredUntil;
      addLog(h, '중상에서 회복', 'info', now);
      changed = true;
    }
  }
  return changed;
}
