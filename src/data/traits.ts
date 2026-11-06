// GDD 3.5 특성. 좋음 / 나쁨 / 양면 + 전투 중 획득·극복.
// 수치 v는 퍼센트 정수 (10 = 10%)

import type { CombatFx } from '../battle/types';
import { FAMILIES, type Family } from './races';

export type TraitKind = 'good' | 'bad' | 'mixed';

export type TraitId =
  // 좋음 (태어날 때)
  | 'swift' | 'sturdy' | 'strong' | 'tough' | 'keen' | 'fastRecovery' | 'vanguard'
  // 나쁨 (태어날 때)
  | 'coward' | 'frail' | 'slow' | 'clumsy' | 'selfish' | 'whiner' | 'acrophobia' | 'skulker'
  // 양면 (태어날 때)
  | 'obese' | 'berserker' | 'ironSkin' | 'reckless' | 'cautious'
  // 전투 중 획득
  | 'trauma' | 'comeback' | 'hunter'
  // 극복으로 바뀌는 특성
  | 'courage' | 'devoted';

export interface HeroTrait {
  id: TraitId;
  v: number;
  /** 트라우마·사냥꾼의 대상 계열 */
  family?: Family;
}

export interface TraitDef {
  id: TraitId;
  name: string;
  kind: TraitKind;
  /** 태어날 때 뽑힐 수 있는지 */
  birth: boolean;
  desc: (v: number, family?: Family) => string;
  conflicts?: TraitId[];
}

const fam = (f?: Family) => (f ? FAMILIES[f].name : '?');

export const TRAITS: Record<TraitId, TraitDef> = {
  swift: { id: 'swift', name: '날렵함', kind: 'good', birth: true, desc: (v) => `속도 +${v}%`, conflicts: ['slow'] },
  sturdy: { id: 'sturdy', name: '튼튼함', kind: 'good', birth: true, desc: (v) => `체력 +${v}%`, conflicts: ['frail'] },
  strong: { id: 'strong', name: '힘셈', kind: 'good', birth: true, desc: (v) => `공격력 +${v}%` },
  tough: { id: 'tough', name: '단단함', kind: 'good', birth: true, desc: (v) => `방어력 +${v}%` },
  keen: { id: 'keen', name: '예리함', kind: 'good', birth: true, desc: (v) => `치명타 +${v / 2}%p` },
  fastRecovery: { id: 'fastRecovery', name: '빠른 회복', kind: 'good', birth: true, desc: (v) => `중상 회복 시간 -${v * 2.5}%`, conflicts: ['whiner'] },
  vanguard: { id: 'vanguard', name: '앞장서는 자', kind: 'good', birth: true, desc: (v) => `전열일 때 방어력 +${v * 1.5}%`, conflicts: ['skulker'] },

  coward: { id: 'coward', name: '겁쟁이', kind: 'bad', birth: true, desc: (v) => `체력 30% 이하일 때 ${v}% 확률로 행동 포기`, conflicts: ['courage'] },
  frail: { id: 'frail', name: '허약함', kind: 'bad', birth: true, desc: (v) => `체력 -${v}%`, conflicts: ['sturdy'] },
  slow: { id: 'slow', name: '느림보', kind: 'bad', birth: true, desc: (v) => `속도 -${v}%`, conflicts: ['swift'] },
  clumsy: { id: 'clumsy', name: '서툰 손', kind: 'bad', birth: true, desc: (v) => `${v}% 확률로 공격이 빗나감` },
  selfish: { id: 'selfish', name: '이기적임', kind: 'bad', birth: true, desc: (v) => `주는 치유·버프 -${v * 2}%`, conflicts: ['devoted'] },
  whiner: { id: 'whiner', name: '엄살', kind: 'bad', birth: true, desc: (v) => `중상 회복 시간 +${v * 5}%`, conflicts: ['fastRecovery'] },
  acrophobia: { id: 'acrophobia', name: '고소공포증', kind: 'bad', birth: true, desc: (v) => `5층 이상에서 공격력·방어력 -${v}%` },
  skulker: { id: 'skulker', name: '뒤에 숨는 자', kind: 'bad', birth: true, desc: (v) => `전열일 때 공격력·방어력 -${v * 1.5}%`, conflicts: ['vanguard'] },

  obese: { id: 'obese', name: '비만', kind: 'mixed', birth: true, desc: (v) => `체력 +${v}%, 속도 -${v}%` },
  berserker: { id: 'berserker', name: '광전사', kind: 'mixed', birth: true, desc: (v) => `쓰러진 아군 1명당 공격력 +${v}%, 방어력 -${v}%` },
  ironSkin: { id: 'ironSkin', name: '강철 피부', kind: 'mixed', birth: true, desc: (v) => `받는 피해 -${v}%, 속도 -${v}%` },
  reckless: { id: 'reckless', name: '무모함', kind: 'mixed', birth: true, desc: (v) => `공격력 +${v}%, 방어력 -${v}%`, conflicts: ['cautious'] },
  cautious: { id: 'cautious', name: '신중함', kind: 'mixed', birth: true, desc: (v) => `방어력 +${v}%, 공격력 -${v}%`, conflicts: ['reckless'] },

  trauma: { id: 'trauma', name: '트라우마', kind: 'bad', birth: false, desc: (v, f) => `${fam(f)}에게 주는 피해 -${v}%, 받는 피해 +${v}%` },
  comeback: { id: 'comeback', name: '역전의 용사', kind: 'good', birth: false, desc: (v) => `체력 30% 이하일 때 공격력 +${v}%` },
  hunter: { id: 'hunter', name: '사냥꾼', kind: 'good', birth: false, desc: (v, f) => `${fam(f)}에게 피해 +${v}%` },
  courage: { id: 'courage', name: '용기', kind: 'good', birth: false, desc: (v) => `체력 30% 이하일 때 공격력 +${v}% (겁쟁이 극복)`, conflicts: ['coward'] },
  devoted: { id: 'devoted', name: '헌신', kind: 'good', birth: false, desc: (v) => `주는 치유·버프 +${v * 2}% (이기적임 극복)`, conflicts: ['selfish'] },
};

/** 화면 표시 이름. 대상 계열이 있으면 붙임 */
export function traitName(t: HeroTrait): string {
  const d = TRAITS[t.id];
  if (t.id === 'trauma') return `트라우마(${fam(t.family)})`;
  if (t.id === 'hunter') return `${fam(t.family)} 사냥꾼`;
  return d.name;
}

export function traitDesc(t: HeroTrait): string {
  return TRAITS[t.id].desc(t.v, t.family);
}

/** 같은 특성(대상 계열 포함)이 있거나 서로 반대인 특성이 있으면 붙일 수 없음 */
export function canAddTrait(list: HeroTrait[], t: HeroTrait): boolean {
  if (list.length >= TRAIT_MAX) return false;
  return !list.some((x) => (x.id === t.id && x.family === t.family) || TRAITS[x.id].conflicts?.includes(t.id) || TRAITS[t.id].conflicts?.includes(x.id));
}

/** 특성은 최대 4개, 태어날 때는 최대 2개 */
export const TRAIT_MAX = 4;
export const TRAIT_BIRTH_MAX = 2;

const POOLS: Record<TraitKind, TraitId[]> = {
  good: (Object.keys(TRAITS) as TraitId[]).filter((id) => TRAITS[id].birth && TRAITS[id].kind === 'good'),
  bad: (Object.keys(TRAITS) as TraitId[]).filter((id) => TRAITS[id].birth && TRAITS[id].kind === 'bad'),
  mixed: (Object.keys(TRAITS) as TraitId[]).filter((id) => TRAITS[id].birth && TRAITS[id].kind === 'mixed'),
};

/** 수치: 클수록 드물게 (GDD 3.5 표) */
export function rollValue(rand: () => number, kind: TraitKind): number {
  const table = kind === 'good' ? [[5, 40], [10, 30], [15, 20], [20, 10]] : [[5, 45], [10, 35], [15, 20]];
  let r = rand() * 100;
  for (const [v, w] of table) {
    if (r < w) return v;
    r -= w;
  }
  return table[0][0];
}

/** 태어날 때 특성: 개수 0/1/2 각 1/3 → 종류 좋음/나쁨/양면 각 1/3 → 특성 균등 → 수치 */
export function rollBirthTraits(rand: () => number): HeroTrait[] {
  const count = Math.floor(rand() * (TRAIT_BIRTH_MAX + 1));
  const out: HeroTrait[] = [];
  for (let tries = 0; out.length < count && tries < 30; tries++) {
    const kind = (['good', 'bad', 'mixed'] as const)[Math.floor(rand() * 3)];
    const pool = POOLS[kind];
    const t: HeroTrait = { id: pool[Math.floor(rand() * pool.length)], v: rollValue(rand, kind) };
    if (canAddTrait(out, t)) out.push(t);
  }
  return out;
}

/** 특성이 능력치·전투 효과에 주는 영향 */
export interface TraitEffect {
  stat: { hp: number; atk: number; def: number; spd: number };
  crit: number;
  injury: number;
  fx: CombatFx;
}

export function traitEffects(list: HeroTrait[], ctx: { front: boolean; floor: number }): TraitEffect {
  const e: TraitEffect = { stat: { hp: 0, atk: 0, def: 0, spd: 0 }, crit: 0, injury: 0, fx: {} };
  const add = (k: keyof CombatFx, v: number) => ((e.fx[k] as number | undefined) = ((e.fx[k] as number | undefined) ?? 0) + v);
  const famAdd = (k: 'vsFamily' | 'fromFamily', f: Family | undefined, v: number) => {
    if (!f) return;
    const m = (e.fx[k] ??= {});
    m[f] = (m[f] ?? 0) + v;
  };
  for (const t of list) {
    const p = t.v / 100;
    switch (t.id) {
      case 'swift': e.stat.spd += p; break;
      case 'sturdy': e.stat.hp += p; break;
      case 'strong': e.stat.atk += p; break;
      case 'tough': e.stat.def += p; break;
      case 'keen': e.crit += p / 2; break;
      case 'fastRecovery': e.injury -= p * 2.5; break;
      case 'vanguard': if (ctx.front) e.stat.def += p * 1.5; break;
      case 'coward': add('cowerChance', p); break;
      case 'frail': e.stat.hp -= p; break;
      case 'slow': e.stat.spd -= p; break;
      case 'clumsy': add('missChance', p); break;
      case 'selfish': add('healGive', -p * 2); break;
      case 'whiner': e.injury += p * 5; break;
      case 'acrophobia': if (ctx.floor >= 5) { e.stat.atk -= p; e.stat.def -= p; } break;
      case 'skulker': if (ctx.front) { e.stat.atk -= p * 1.5; e.stat.def -= p * 1.5; } break;
      case 'obese': e.stat.hp += p; e.stat.spd -= p; break;
      case 'berserker': add('berserkAtkPerDown', p); add('berserkDefPerDown', p); break;
      case 'ironSkin': add('dmgTaken', -p); e.stat.spd -= p; break;
      case 'reckless': e.stat.atk += p; e.stat.def -= p; break;
      case 'cautious': e.stat.def += p; e.stat.atk -= p; break;
      case 'trauma': famAdd('vsFamily', t.family, -p); famAdd('fromFamily', t.family, p); break;
      case 'comeback': add('lowHpAtk', p); break;
      case 'hunter': famAdd('vsFamily', t.family, p); break;
      case 'courage': add('lowHpAtk', p); break;
      case 'devoted': add('healGive', p * 2); break;
    }
  }
  return e;
}
