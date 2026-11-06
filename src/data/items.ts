// GDD 7장 대장간: 재료, 제작 난이도, 등급, 직업 전용 무기, 옵션·특수 능력, 내구도
import type { ClassId } from './classes';

export type MatKind = 'metal' | 'wood' | 'crystal';
export type Tier = 1 | 2 | 3;
export type MaterialId = `${MatKind}${Tier}`;

export const MAT_KINDS: MatKind[] = ['metal', 'wood', 'crystal'];
export const TIERS: Tier[] = [1, 2, 3];

export const MATERIALS: Record<MaterialId, { name: string; color: number }> = {
  metal1: { name: '구리 광석', color: 0xd08a4a },
  metal2: { name: '철 광석', color: 0xa8b0c0 },
  metal3: { name: '미스릴', color: 0x8ae0f0 },
  wood1: { name: '참나무', color: 0xb08a5a },
  wood2: { name: '흑단', color: 0x5a4a5a },
  wood3: { name: '세계수 가지', color: 0x8ad08a },
  crystal1: { name: '마석 조각', color: 0x9a8ad0 },
  crystal2: { name: '마석', color: 0x8a6aff },
  crystal3: { name: '순수 마석', color: 0xe0a0ff },
};

export const KIND_NAME: Record<MatKind, string> = { metal: '금속', wood: '목재', crystal: '마석' };

export const matId = (kind: MatKind, tier: Tier): MaterialId => `${kind}${tier}` as MaterialId;

export type Materials = Partial<Record<MaterialId, number>>;

// ─── 등급 (6단계) ───
export const GRADES = [
  { name: '일반', color: 0xb8c2d4, str: '#c8d0dc' },
  { name: '고급', color: 0x6fd47a, str: '#7fe08a' },
  { name: '상급', color: 0x5aa0f0, str: '#7ab8ff' },
  { name: '전설', color: 0xffa03a, str: '#ffb357' },
  { name: '신화', color: 0xff4a6a, str: '#ff6a85' },
  { name: '초월', color: 0x7affea, str: '#9ffff0' },
] as const;
export const GRADE_COUNT = GRADES.length;

/** 등급별 공격력 범위 (같은 등급도 무기마다 다름) */
export const GRADE_ATK: [number, number][] = [
  [0.04, 0.08],
  [0.09, 0.14],
  [0.15, 0.22],
  [0.23, 0.32],
  [0.33, 0.45],
  [0.46, 0.6],
];
/** 등급별 부가 옵션 개수, 옵션 수치 배율 */
const OPT_COUNT = [0, 1, 2, 2, 3, 3];
const OPT_MUL = [1, 1, 1.3, 1.7, 2.2, 2.8];

// ─── 제작 난이도 (6단계) ───
export type Difficulty = 0 | 1 | 2 | 3 | 4 | 5;
export interface DifficultyDef {
  name: string;
  /** 나올 수 있는 최고 등급 */
  maxGrade: number;
  /** 재료 단계, 재료 배수 */
  tier: Tier;
  mult: number;
  /** 파손 확률 (미니게임 만점이면 절반) */
  breakChance: number;
  /** 등급 확률: 미니게임 0% → base, 100% → best (사이는 비례) */
  base: number[];
  best: number[];
  /** 미니게임 구성 (0이면 자동 제작) */
  heat: number;
  hammer: number;
  quench: number;
  engrave: number;
  /** 미니게임 난도 0~1 */
  hard: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { name: '쉬움', maxGrade: 0, tier: 1, mult: 1, breakChance: 0, base: [100], best: [100], heat: 0, hammer: 0, quench: 0, engrave: 0, hard: 0 },
  { name: '보통', maxGrade: 1, tier: 1, mult: 1, breakChance: 0, base: [85, 15], best: [40, 60], heat: 1, hammer: 3, quench: 1, engrave: 0, hard: 0 },
  { name: '어려움', maxGrade: 2, tier: 1, mult: 2, breakChance: 0, base: [75, 20, 5], best: [15, 45, 40], heat: 1, hammer: 4, quench: 1, engrave: 0, hard: 0.25 },
  { name: '전설', maxGrade: 3, tier: 2, mult: 2, breakChance: 0.1, base: [70, 22, 7, 1], best: [1, 20, 49, 30], heat: 2, hammer: 5, quench: 1, engrave: 0, hard: 0.5 },
  { name: '신화', maxGrade: 4, tier: 3, mult: 1, breakChance: 0.3, base: [65, 23, 9, 2.5, 0.5], best: [1, 10, 30, 39, 20], heat: 2, hammer: 5, quench: 1, engrave: 1, hard: 0.75 },
  { name: '초월', maxGrade: 5, tier: 3, mult: 2, breakChance: 0.5, base: [60, 24, 11, 4, 0.8, 0.2], best: [1, 5, 20, 34, 28, 12], heat: 2, hammer: 6, quench: 1, engrave: 1, hard: 1 },
];

/** 미니게임 판정 수 */
export function judgeCount(diff: Difficulty): number {
  const d = DIFFICULTIES[diff];
  return d.heat + d.hammer + d.quench + d.engrave;
}

/** 미니게임 점수(0~1)에 따른 등급 확률 (%) */
export function gradeOdds(diff: Difficulty, score: number): number[] {
  const d = DIFFICULTIES[diff];
  return d.base.map((b, i) => b + (d.best[i] - b) * Math.max(0, Math.min(1, score)));
}

export function breakChance(diff: Difficulty, score: number): number {
  return DIFFICULTIES[diff].breakChance * (1 - 0.5 * Math.max(0, Math.min(1, score)));
}

export function rollGrade(diff: Difficulty, score: number, rand: () => number): number {
  const odds = gradeOdds(diff, score);
  let r = rand() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i;
  }
  return odds.length - 1;
}

// ─── 직업 전용 무기 ───
export interface WeaponType {
  cls: ClassId;
  name: string;
  /** 영웅 그림에서 쓸 무기 모양 (art/heroArt.ts) */
  art: string;
  /** 기본 재료 (난이도 배수를 곱함) */
  recipe: Partial<Record<MatKind, number>>;
  /** 이름 앞에 붙는 재료 종류, 수리 재료 */
  main: MatKind;
}

export const WEAPON_TYPES: Record<ClassId, WeaponType> = {
  knight: { cls: 'knight', name: '장검과 방패', art: 'sword', recipe: { metal: 4 }, main: 'metal' },
  warrior: { cls: 'warrior', name: '전투 도끼', art: 'axe', recipe: { metal: 3, wood: 1 }, main: 'metal' },
  archer: { cls: 'archer', name: '장궁', art: 'longbow', recipe: { wood: 4 }, main: 'wood' },
  mage: { cls: 'mage', name: '마법 지팡이', art: 'staff', recipe: { wood: 2, crystal: 2 }, main: 'crystal' },
  priest: { cls: 'priest', name: '성스러운 홀', art: 'holystaff', recipe: { crystal: 2, metal: 2 }, main: 'crystal' },
};

// ─── 부가 옵션 ───
export type OptKey = 'hp' | 'def' | 'spd' | 'crit' | 'healGive';
export const OPTS: Record<OptKey, { name: string; range: [number, number]; pt?: boolean }> = {
  hp: { name: '체력', range: [0.03, 0.06] },
  def: { name: '방어력', range: [0.03, 0.06] },
  spd: { name: '속도', range: [0.02, 0.04] },
  crit: { name: '치명타', range: [0.015, 0.03], pt: true },
  healGive: { name: '치유·버프', range: [0.04, 0.08] },
};

// ─── 특수 능력 (전설 이상) ───
export type SpecialId = 'laststand' | 'lifesteal' | 'vital' | 'chain' | 'miracle';
export const SPECIALS: Record<SpecialId, { cls: ClassId; name: string; values: number[]; desc: (v: number) => string }> = {
  laststand: { cls: 'knight', name: '불굴', values: [0.01, 0.15, 0.3], desc: (v) => `전투당 1번, 쓰러질 피해를 받아도 체력 ${v <= 0.01 ? '1' : `${Math.round(v * 100)}%`}로 버팀` },
  lifesteal: { cls: 'warrior', name: '흡혈', values: [0.08, 0.12, 0.16], desc: (v) => `준 피해의 ${Math.round(v * 100)}%만큼 회복` },
  vital: { cls: 'archer', name: '급소', values: [0.4, 0.6, 0.8], desc: (v) => `치명타 피해 +${Math.round(v * 100)}%` },
  chain: { cls: 'mage', name: '연쇄', values: [0.2, 0.3, 0.4], desc: (v) => `${Math.round(v * 100)}% 확률로 다른 적 1명에게 60% 피해` },
  miracle: { cls: 'priest', name: '기적', values: [0.25, 0.35, 0.5], desc: (v) => `전투당 1번, 쓰러진 아군을 체력 ${Math.round(v * 100)}%로 일으킴` },
};
const CLASS_SPECIAL: Record<ClassId, SpecialId> = { knight: 'laststand', warrior: 'lifesteal', archer: 'vital', mage: 'chain', priest: 'miracle' };

export interface Weapon {
  id: string;
  cls: ClassId;
  /** 재료 단계 (이름·아이콘·수리 재료) */
  tier: Tier;
  grade: number;
  madeAt: number;
  /** 공격력 +비율 */
  atk: number;
  opts: { k: OptKey; v: number }[];
  /** lv 0 = 전설 수준, 1 = 신화, 2 = 초월 */
  specials: { id: SpecialId; lv: number }[];
  /** 내구도 0~100. 0이면 효과 없음 */
  dur: number;
}

export const DUR_MAX = 100;
export const DUR_TOWER = 10;
export const DUR_DUNGEON = 5;
/** 쓰러지거나 패배하면 추가로 */
export const DUR_LOSS = 10;
/** 탑에서 쓰러졌는데 살아남은 영웅의 무기가 사라질 확률 */
export const TOWER_WEAPON_LOSS = 0.2;

/** 등급에 맞춰 수치를 굴려 무기를 만듦 */
export function makeWeapon(id: string, cls: ClassId, tier: Tier, grade: number, rand: () => number, now: number): Weapon {
  const [lo, hi] = GRADE_ATK[grade];
  const atk = Math.round((lo + (hi - lo) * rand()) * 1000) / 1000;
  const pool: OptKey[] = ['hp', 'def', 'spd', 'crit'];
  if (cls === 'priest') pool.push('healGive');
  const opts: Weapon['opts'] = [];
  for (let i = 0; i < OPT_COUNT[grade] && pool.length; i++) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const [a, b] = OPTS[k].range;
    opts.push({ k, v: Math.round((a + (b - a) * rand()) * OPT_MUL[grade] * 1000) / 1000 });
  }
  const specials: Weapon['specials'] = [];
  if (grade >= 3) {
    specials.push({ id: CLASS_SPECIAL[cls], lv: grade - 3 });
    if (grade === 5) {
      const others = (Object.keys(SPECIALS) as SpecialId[]).filter((s) => s !== CLASS_SPECIAL[cls]);
      specials.push({ id: others[Math.floor(rand() * others.length)], lv: 0 });
    }
  }
  return { id, cls, tier, grade, madeAt: now, atk, opts, specials, dur: DUR_MAX };
}

/** 공격력이 등급 범위 상위 25% 이상이면 ★ */
export function isStar(w: Weapon): boolean {
  const [lo, hi] = GRADE_ATK[w.grade];
  return w.atk >= lo + (hi - lo) * 0.75;
}

export function weaponName(w: Weapon): string {
  const t = WEAPON_TYPES[w.cls];
  const mat = MATERIALS[matId(t.main, w.tier)].name.replace(' 광석', '').replace(' 조각', '');
  return `${GRADES[w.grade].name} ${mat} ${t.name}${isStar(w) ? ' ★' : ''}`;
}

export function optText(o: { k: OptKey; v: number }): string {
  const d = OPTS[o.k];
  return `${d.name} +${Math.round(o.v * 1000) / 10}${d.pt ? '%p' : '%'}`;
}

export function specialText(s: { id: SpecialId; lv: number }): string {
  const d = SPECIALS[s.id];
  return `${d.name}: ${d.desc(d.values[s.lv])}`;
}

/** 한 줄 요약: "공격력 +18% · 체력 +5% · 속도 +3%" */
export function weaponDesc(w: Weapon): string {
  return [`공격력 +${Math.round(w.atk * 100)}%`, ...w.opts.map(optText)].join(' · ');
}

export function weaponUsable(w: Weapon | undefined): boolean {
  return !!w && w.dur > 0;
}

// ─── 재료 ───
export function recipeFor(cls: ClassId, diff: Difficulty): { id: MaterialId; n: number }[] {
  const d = DIFFICULTIES[diff];
  return (Object.entries(WEAPON_TYPES[cls].recipe) as [MatKind, number][]).map(([k, n]) => ({ id: matId(k, d.tier), n: n * d.mult }));
}

export function hasMats(mats: Materials, need: { id: MaterialId; n: number }[]): boolean {
  return need.every((r) => (mats[r.id] ?? 0) >= r.n);
}

export function canCraft(mats: Materials, cls: ClassId, diff: Difficulty): boolean {
  return hasMats(mats, recipeFor(cls, diff));
}

export function spendMats(mats: Materials, need: { id: MaterialId; n: number }[]): void {
  for (const r of need) mats[r.id] = (mats[r.id] ?? 0) - r.n;
}

/** 수리 비용: 같은 단계의 주재료, 닳은 만큼 × 등급 배수 */
export function repairCost(w: Weapon): { id: MaterialId; n: number }[] {
  const missing = DUR_MAX - w.dur;
  if (missing <= 0) return [];
  const n = Math.ceil(missing / 50) * (1 + Math.floor(w.grade / 2));
  return [{ id: matId(WEAPON_TYPES[w.cls].main, w.tier), n }];
}

export function addMats(mats: Materials, gain: Materials): void {
  for (const [k, v] of Object.entries(gain) as [MaterialId, number][]) mats[k] = (mats[k] ?? 0) + v;
}

export function matsText(m: Materials): string {
  const parts = (Object.entries(m) as [MaterialId, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${MATERIALS[k].name} ×${n}`);
  return parts.length ? parts.join(', ') : '없음';
}
