import type { Element, SkillDef, Stats } from '../battle/types';

export type MonsterId =
  | 'slime'
  | 'goblin'
  | 'wolf'
  | 'imp'
  | 'skeleton'
  | 'orc'
  | 'spirit'
  | 'ogre'
  | 'drake';

export interface MonsterDef {
  id: MonsterId;
  name: string;
  element: Element;
  row: 'front' | 'back';
  /** 1층 기준. 층이 오르면 floorScale 적용 */
  base: Stats;
  basic: SkillDef;
  skills: SkillDef[];
  boss?: 'mid' | 'main';
  /** 정찰 화면 한 줄 설명 */
  note: string;
}

const melee = (name = '공격'): SkillDef => ({ id: 'hit', name, cooldown: 0, mult: 1, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' });

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime: {
    id: 'slime', name: '슬라임', element: 'water', row: 'front',
    base: { hp: 120, atk: 16, def: 6, spd: 80, crit: 0.03 },
    basic: melee('몸통박치기'), skills: [],
    note: '느리고 약함',
  },
  goblin: {
    id: 'goblin', name: '고블린', element: 'none', row: 'front',
    base: { hp: 110, atk: 21, def: 8, spd: 108, crit: 0.08 },
    basic: melee('찌르기'), skills: [],
    note: '빠른 근접',
  },
  wolf: {
    id: 'wolf', name: '늑대', element: 'wind', row: 'front',
    base: { hp: 105, atk: 20, def: 6, spd: 128, crit: 0.12 },
    basic: melee('할퀴기'),
    skills: [{ id: 'bite', name: '물어뜯기', cooldown: 3, mult: 1.6, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' }],
    note: '매우 빠름, 치명타 주의',
  },
  imp: {
    id: 'imp', name: '불꽃 임프', element: 'fire', row: 'back',
    base: { hp: 85, atk: 23, def: 4, spd: 100, crit: 0.06 },
    basic: { id: 'ember', name: '불씨', cooldown: 0, mult: 1, targeting: 'any', effect: { kind: 'damage' }, projectile: 'magic' },
    skills: [{ id: 'fireball', name: '화염구', cooldown: 3, mult: 1.5, targeting: 'any', effect: { kind: 'damage' }, projectile: 'magic' }],
    note: '후열 원거리, 아무나 노림',
  },
  skeleton: {
    id: 'skeleton', name: '해골 궁수', element: 'none', row: 'back',
    base: { hp: 95, atk: 21, def: 7, spd: 104, crit: 0.1 },
    basic: { id: 'shot', name: '화살', cooldown: 0, mult: 1, targeting: 'lowest', effect: { kind: 'damage' }, projectile: 'arrow' },
    skills: [],
    note: '체력 낮은 영웅을 저격',
  },
  orc: {
    id: 'orc', name: '오크 전사', element: 'none', row: 'front',
    base: { hp: 230, atk: 25, def: 16, spd: 85, crit: 0.08 },
    basic: melee('도끼질'),
    skills: [{ id: 'cleave', name: '내려찍기', cooldown: 3, mult: 1.9, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none', big: true }],
    note: '단단하고 한 방이 셈',
  },
  spirit: {
    id: 'spirit', name: '물의 정령', element: 'water', row: 'back',
    base: { hp: 110, atk: 20, def: 6, spd: 96, crit: 0.05 },
    basic: { id: 'splash', name: '물방울', cooldown: 0, mult: 1, targeting: 'any', effect: { kind: 'damage' }, projectile: 'magic' },
    skills: [
      { id: 'mend', name: '정화의 물', cooldown: 4, mult: 1.8, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.6, minCount: 1 } },
      { id: 'wave', name: '물보라', cooldown: 4, mult: 0.6, targeting: 'all', effect: { kind: 'damage' }, projectile: 'magic' },
    ],
    note: '적을 치유함 — 먼저 처치',
  },
  ogre: {
    id: 'ogre', name: '오우거', element: 'none', row: 'front', boss: 'mid',
    base: { hp: 900, atk: 40, def: 14, spd: 82, crit: 0.08 },
    basic: melee('주먹'),
    skills: [{ id: 'quake', name: '대지 강타', cooldown: 3, mult: 0.85, targeting: 'all', effect: { kind: 'damage' }, projectile: 'none', big: true }],
    note: '중간보스. 3턴마다 전체 공격',
  },
  drake: {
    id: 'drake', name: '잿불 드레이크', element: 'fire', row: 'front', boss: 'main',
    base: { hp: 800, atk: 30, def: 15, spd: 92, crit: 0.1 },
    basic: melee('발톱'),
    skills: [
      { id: 'breath', name: '화염 숨결', cooldown: 3, mult: 0.95, targeting: 'all', effect: { kind: 'damage' }, projectile: 'magic', big: true },
      { id: 'tail', name: '꼬리 휩쓸기', cooldown: 2, mult: 1.6, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' },
    ],
    note: '메인보스. 불속성 — 물속성이 유리',
  },
};

/** 층당 적 강화율 */
export const FLOOR_GROWTH = 0.12;
/** 적 공격력 전체 배율 — 난이도 1차 조절 손잡이 */
export const ENEMY_ATK_SCALE = 1.85;

export function monsterStats(base: Stats, floor: number): Stats {
  const g = 1 + FLOOR_GROWTH * (floor - 1);
  return {
    hp: Math.round(base.hp * g),
    atk: Math.round(base.atk * g * ENEMY_ATK_SCALE),
    def: Math.round(base.def * g),
    spd: base.spd + Math.floor((floor - 1) / 2),
    crit: base.crit,
  };
}
