// GDD 3.4.1 종족 + 5.1.1 적 계열. 불/물/바람 속성을 대체합니다.
import type { CombatFx } from '../battle/types';

/** 적 계열 */
export type Family = 'monster' | 'greenskin' | 'human' | 'beastkin' | 'demon' | 'undead' | 'draconic' | 'giant';

export const FAMILIES: Record<Family, { name: string; color: number }> = {
  monster: { name: '괴수', color: 0x8fb36a },
  greenskin: { name: '녹색족', color: 0x6fae3a },
  human: { name: '인간', color: 0xb8a68a },
  beastkin: { name: '야수', color: 0xc08a4a },
  demon: { name: '악마', color: 0xd0504a },
  undead: { name: '언데드', color: 0x9aa8b8 },
  draconic: { name: '용족', color: 0x4aa88a },
  giant: { name: '거인', color: 0xa07a5a },
};

/** 영웅 종족. 수인은 갈래(beast)로 나뉨 */
export type RaceId = 'human' | 'barbarian' | 'elf' | 'dwarf' | 'beastfolk';
export type BeastKind = 'rabbit' | 'cat' | 'dog' | 'bear';

export interface RaceTrait {
  /** 화면에 보이는 이름: 인간, 엘프, 토끼 수인 … */
  name: string;
  /** 고유 특성 이름과 설명 */
  perk: string;
  desc: string;
  favored: Family;
  /** 능력치 배율/가산 */
  mod: { hp?: number; atk?: number; def?: number; spd?: number; crit?: number };
  /** 전투 중 효과 (회피, 받는 치유, 분노) */
  fx?: CombatFx;
  /** 경험치 배율 */
  xp?: number;
  color: number;
}

const RACES: Record<string, RaceTrait> = {
  human: { name: '인간', perk: '빠른 성장', desc: '경험치 +20%', favored: 'greenskin', mod: {}, xp: 1.2, color: 0xd8b48a },
  barbarian: { name: '바바리안', perk: '전투 광기', desc: '공격력 +10%, 체력 50% 이하일 때 공격력 +20%', favored: 'giant', mod: { atk: 1.1 }, fx: { rageAtk: 0.2 }, color: 0xc0704a },
  elf: { name: '엘프', perk: '숲의 감각', desc: '속도 +8%, 치명타 +5%p, 체력 -8%', favored: 'undead', mod: { spd: 1.08, crit: 0.05, hp: 0.92 }, color: 0x8fd08a },
  dwarf: { name: '드워프', perk: '바위 같은 몸', desc: '방어력 +12%, 체력 +10%, 속도 -10%', favored: 'draconic', mod: { def: 1.12, hp: 1.1, spd: 0.9 }, color: 0xc89060 },
  rabbit: { name: '토끼 수인', perk: '재빠른 발', desc: '10% 확률로 공격 회피', favored: 'beastkin', mod: {}, fx: { dodge: 0.1 }, color: 0xe8d8e0 },
  cat: { name: '고양이 수인', perk: '사냥 본능', desc: '치명타 +8%p', favored: 'beastkin', mod: { crit: 0.08 }, color: 0xe8a050 },
  dog: { name: '강아지 수인', perk: '충직함', desc: '받는 치유 +25%, 방어력 +5%', favored: 'beastkin', mod: { def: 1.05 }, fx: { healRecv: 0.25 }, color: 0xc89a6a },
  bear: { name: '곰 수인', perk: '두꺼운 털', desc: '체력 +18%, 공격력 +5%, 속도 -8%', favored: 'beastkin', mod: { hp: 1.18, atk: 1.05, spd: 0.92 }, color: 0x8a5a3a },
};

export const RACE_IDS: RaceId[] = ['human', 'barbarian', 'elf', 'dwarf', 'beastfolk'];
export const BEAST_KINDS: BeastKind[] = ['rabbit', 'cat', 'dog', 'bear'];

/** 종족 + 수인 갈래 → 특성 */
export function raceTrait(race: RaceId, beast?: BeastKind): RaceTrait {
  return RACES[race === 'beastfolk' ? beast ?? 'cat' : race];
}

/** 천적 계열에 주는 피해 가산 (GDD 4.2) */
export const FAVORED_BONUS = 0.25;
