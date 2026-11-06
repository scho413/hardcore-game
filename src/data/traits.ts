// GDD 3.5 특성. 영웅당 1~2개.
// 전투 중 효과(겁쟁이·광전사·강철 피부)는 battle/engine.ts, 능력치 효과는 data/heroes.ts에서 적용합니다.

export type TraitId = 'coward' | 'berserker' | 'ironSkin' | 'fastRecovery' | 'swift' | 'sturdy' | 'keen';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  /** 같이 붙으면 안 되는 특성 */
  conflicts?: TraitId[];
}

export const TRAITS: Record<TraitId, TraitDef> = {
  coward: { id: 'coward', name: '겁쟁이', desc: '체력 30% 이하일 때 35% 확률로 공격 회피' },
  berserker: { id: 'berserker', name: '광전사', desc: '쓰러진 아군 1명당 공격력 +25%' },
  ironSkin: { id: 'ironSkin', name: '강철 피부', desc: '받는 피해 -15%, 속도 -10%', conflicts: ['swift'] },
  fastRecovery: { id: 'fastRecovery', name: '빠른 회복', desc: '중상 회복 시간 절반' },
  swift: { id: 'swift', name: '날렵함', desc: '속도 +10%', conflicts: ['ironSkin'] },
  sturdy: { id: 'sturdy', name: '튼튼함', desc: '최대 체력 +15%' },
  keen: { id: 'keen', name: '예리함', desc: '치명타율 +10%p' },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

// 엔진이 쓰는 수치
export const COWARD_HP_RATIO = 0.3;
export const COWARD_DODGE = 0.35;
export const BERSERKER_PER_DOWN = 0.25;
export const IRON_SKIN_TAKEN = 0.85;
