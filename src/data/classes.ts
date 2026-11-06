import type { Row, SkillDef, Stats } from '../battle/types';

export type ClassId = 'knight' | 'warrior' | 'archer' | 'mage' | 'priest';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  defaultRow: Row;
  /** 1레벨 기준 */
  base: Stats;
  basic: SkillDef;
  skills: SkillDef[];
}

// GDD 3.4 직업 초기안. 수치는 tools/sim.ts로 검증하며 조정합니다.
export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    id: 'knight',
    name: '기사',
    role: '탱커, 도발',
    defaultRow: 'front',
    base: { hp: 280, atk: 20, def: 22, spd: 90, crit: 0.05 },
    basic: { id: 'slash', name: '베기', cooldown: 0, mult: 1, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' },
    skills: [
      { id: 'taunt', name: '도발', cooldown: 4, mult: 0, targeting: 'self', effect: { kind: 'taunt', turns: 2 }, projectile: 'none' },
    ],
  },
  warrior: {
    id: 'warrior',
    name: '전사',
    role: '근접 딜러',
    defaultRow: 'front',
    base: { hp: 210, atk: 32, def: 13, spd: 105, crit: 0.12 },
    basic: { id: 'chop', name: '내려치기', cooldown: 0, mult: 1, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' },
    skills: [
      { id: 'smash', name: '강타', cooldown: 3, mult: 2.0, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none', big: true },
    ],
  },
  archer: {
    id: 'archer',
    name: '궁수',
    role: '원거리 딜러',
    defaultRow: 'back',
    base: { hp: 140, atk: 29, def: 8, spd: 118, crit: 0.2 },
    basic: { id: 'shot', name: '사격', cooldown: 0, mult: 1, targeting: 'any', effect: { kind: 'damage' }, projectile: 'arrow' },
    skills: [
      { id: 'volley', name: '연사', cooldown: 3, mult: 0.7, hits: 3, targeting: 'lowest', effect: { kind: 'damage' }, projectile: 'arrow' },
    ],
  },
  mage: {
    id: 'mage',
    name: '마법사',
    role: '광역 딜러, 속성',
    defaultRow: 'back',
    base: { hp: 125, atk: 31, def: 6, spd: 95, crit: 0.08 },
    basic: { id: 'bolt', name: '마력탄', cooldown: 0, mult: 1, targeting: 'any', effect: { kind: 'damage' }, projectile: 'magic' },
    skills: [
      { id: 'storm', name: '원소 폭풍', cooldown: 3, mult: 0.8, targeting: 'all', effect: { kind: 'damage' }, projectile: 'magic', big: true },
    ],
  },
  priest: {
    id: 'priest',
    name: '사제',
    role: '힐러',
    defaultRow: 'mid',
    base: { hp: 160, atk: 24, def: 10, spd: 100, crit: 0.05 },
    basic: { id: 'smite', name: '징벌', cooldown: 0, mult: 0.8, targeting: 'any', effect: { kind: 'damage' }, projectile: 'holy' },
    skills: [
      { id: 'sanctuary', name: '성역', cooldown: 4, mult: 1.2, targeting: 'ally-all', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.7, minCount: 2 } },
      { id: 'heal', name: '치유', cooldown: 1, mult: 2.1, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.65, minCount: 1 } },
    ],
  },
};

/** 레벨당 HP/공격/방어 증가율 */
export const LEVEL_GROWTH = 0.1;

export function statsAtLevel(base: Stats, level: number): Stats {
  const g = 1 + LEVEL_GROWTH * (level - 1);
  return {
    hp: Math.round(base.hp * g),
    atk: Math.round(base.atk * g),
    def: Math.round(base.def * g),
    spd: base.spd + (level - 1),
    crit: base.crit,
  };
}
