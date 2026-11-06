// GDD 7장 대장간: 재료, 직업 전용 무기, 등급
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

// ─── 등급 ───
export const GRADES = [
  { name: '일반', color: 0xb8c2d4, str: '#c8d0dc' },
  { name: '고급', color: 0x6fd47a, str: '#7fe08a' },
  { name: '희귀', color: 0x5aa0f0, str: '#7ab8ff' },
  { name: '영웅', color: 0xb07af0, str: '#c89aff' },
  { name: '전설', color: 0xf0c040, str: '#ffd25a' },
] as const;

export const GRADE_ATK = [0.06, 0.12, 0.2, 0.3, 0.45];
/** 재료 단계별 최대 등급 (GRADES 인덱스) */
export const TIER_CAP: Record<Tier, number> = { 1: 2, 2: 3, 3: 4 };

// ─── 직업 전용 무기 ───
export type WeaponSub = 'def' | 'crit' | 'spd' | 'healGive';

export interface WeaponType {
  cls: ClassId;
  name: string;
  /** 영웅 그림에서 쓸 무기 모양 (art/heroArt.ts) */
  art: string;
  recipe: Partial<Record<MatKind, number>>;
  /** 이름 앞에 붙는 재료 종류 */
  main: MatKind;
  sub: WeaponSub;
  subName: string;
  /** 부가 효과 등급별 수치 */
  subValues: number[];
}

export const WEAPON_TYPES: Record<ClassId, WeaponType> = {
  knight: { cls: 'knight', name: '장검과 방패', art: 'sword', recipe: { metal: 4 }, main: 'metal', sub: 'def', subName: '방어력', subValues: [0.06, 0.12, 0.2, 0.3, 0.45] },
  warrior: { cls: 'warrior', name: '전투 도끼', art: 'axe', recipe: { metal: 3, wood: 1 }, main: 'metal', sub: 'crit', subName: '치명타', subValues: [0.02, 0.04, 0.06, 0.09, 0.12] },
  archer: { cls: 'archer', name: '장궁', art: 'longbow', recipe: { wood: 4 }, main: 'wood', sub: 'crit', subName: '치명타', subValues: [0.02, 0.04, 0.06, 0.09, 0.12] },
  mage: { cls: 'mage', name: '마법 지팡이', art: 'staff', recipe: { wood: 2, crystal: 2 }, main: 'crystal', sub: 'spd', subName: '속도', subValues: [0.02, 0.04, 0.06, 0.09, 0.12] },
  priest: { cls: 'priest', name: '성스러운 홀', art: 'holystaff', recipe: { crystal: 2, metal: 2 }, main: 'crystal', sub: 'healGive', subName: '치유·버프', subValues: [0.05, 0.1, 0.15, 0.22, 0.3] },
};

export interface Weapon {
  id: string;
  cls: ClassId;
  tier: Tier;
  grade: number;
  madeAt: number;
}

export function weaponName(w: Weapon): string {
  const t = WEAPON_TYPES[w.cls];
  const mat = MATERIALS[matId(t.main, w.tier)].name.replace(' 광석', '').replace(' 조각', '');
  return `${GRADES[w.grade].name} ${mat} ${t.name}`;
}

export function weaponStats(w: Weapon): { atk: number; sub: WeaponSub; subValue: number } {
  const t = WEAPON_TYPES[w.cls];
  return { atk: GRADE_ATK[w.grade], sub: t.sub, subValue: t.subValues[w.grade] };
}

export function weaponDesc(w: Weapon): string {
  const s = weaponStats(w);
  const t = WEAPON_TYPES[w.cls];
  const sub = s.sub === 'crit' ? `+${Math.round(s.subValue * 100)}%p` : `+${Math.round(s.subValue * 100)}%`;
  return `공격력 +${Math.round(s.atk * 100)}% · ${t.subName} ${sub}`;
}

/** 미니게임 점수(0~1) → 등급. 상한 등급은 85% 이상 */
export function gradeFromScore(score: number, tier: Tier): number {
  const cap = TIER_CAP[tier];
  if (score >= 0.85) return cap;
  return Math.max(0, Math.min(cap - 1, Math.floor((score / 0.85) * cap)));
}

export function recipeFor(cls: ClassId, tier: Tier): { id: MaterialId; n: number }[] {
  return (Object.entries(WEAPON_TYPES[cls].recipe) as [MatKind, number][]).map(([k, n]) => ({ id: matId(k, tier), n }));
}

export function canCraft(mats: Materials, cls: ClassId, tier: Tier): boolean {
  return recipeFor(cls, tier).every((r) => (mats[r.id] ?? 0) >= r.n);
}

export function addMats(mats: Materials, gain: Materials): void {
  for (const [k, v] of Object.entries(gain) as [MaterialId, number][]) mats[k] = (mats[k] ?? 0) + v;
}

export function matsText(m: Materials): string {
  const parts = (Object.entries(m) as [MaterialId, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${MATERIALS[k].name} ×${n}`);
  return parts.length ? parts.join(', ') : '없음';
}
