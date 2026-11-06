import type { Row, SkillDef, Stats } from '../battle/types';

export type ClassId = 'knight' | 'warrior' | 'archer' | 'mage' | 'priest';

/** 전투 역할 (GDD 3.4). 같은 직업이라도 영웅마다 고를 수 있음 */
export interface RoleDef {
  id: string;
  name: string;
  desc: string;
  basic: SkillDef;
  skills: SkillDef[];
  /** 능력치 가산 */
  mod?: { atk?: number; def?: number };
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  defaultRow: Row;
  /** 1레벨 기준 */
  base: Stats;
  /** 첫 번째가 기본 역할 */
  roles: RoleDef[];
}

const dmg = (id: string, name: string, mult: number, targeting: SkillDef['targeting'], projectile: SkillDef['projectile'], cooldown = 0, extra: Partial<SkillDef> = {}): SkillDef => ({
  id, name, cooldown, mult, targeting, effect: { kind: 'damage' }, projectile, ...extra,
});

// GDD 3.4 직업 + 전투 역할. 수치는 tools/sim.ts로 검증하며 조정합니다.
export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    id: 'knight', name: '기사', role: '탱커', defaultRow: 'front',
    base: { hp: 280, atk: 20, def: 22, spd: 90, crit: 0.05 },
    roles: [
      {
        id: 'guard', name: '수호', desc: '도발로 공격을 끌어당김, 방어력 +10%',
        basic: dmg('slash', '베기', 1, 'front', 'none'),
        skills: [{ id: 'taunt', name: '도발', cooldown: 4, mult: 0, targeting: 'self', effect: { kind: 'taunt', turns: 2 }, projectile: 'none' }],
        mod: { def: 0.1 },
      },
      {
        id: 'assault', name: '공격', desc: '도발 없음, 방패 강타, 공격력 +10%',
        basic: dmg('slash', '베기', 1, 'front', 'none'),
        skills: [dmg('bash', '방패 강타', 1.8, 'front', 'none', 3, { big: true })],
        mod: { atk: 0.1 },
      },
    ],
  },
  warrior: {
    id: 'warrior', name: '전사', role: '근접 딜러', defaultRow: 'front',
    base: { hp: 210, atk: 32, def: 13, spd: 105, crit: 0.12 },
    roles: [
      {
        id: 'smash', name: '파괴', desc: '단일 대상 강타',
        basic: dmg('chop', '내려치기', 1, 'front', 'none'),
        skills: [dmg('smash', '강타', 2.0, 'front', 'none', 3, { big: true })],
      },
      {
        id: 'sweep', name: '휩쓸기', desc: '적 전체를 베는 회전 베기',
        basic: dmg('chop', '내려치기', 1, 'front', 'none'),
        skills: [dmg('whirl', '회전 베기', 0.75, 'all', 'none', 3, { big: true })],
      },
    ],
  },
  archer: {
    id: 'archer', name: '궁수', role: '원거리 딜러', defaultRow: 'back',
    base: { hp: 140, atk: 29, def: 8, spd: 118, crit: 0.2 },
    roles: [
      {
        id: 'snipe', name: '저격', desc: '체력 낮은 적에게 연사',
        basic: dmg('shot', '사격', 1, 'any', 'arrow'),
        skills: [dmg('volley', '연사', 0.7, 'lowest', 'arrow', 3, { hits: 3 })],
      },
      {
        id: 'rain', name: '화살비', desc: '적 전체에 화살비',
        basic: dmg('shot', '사격', 1, 'any', 'arrow'),
        skills: [dmg('rain', '화살비', 0.6, 'all', 'arrow', 3)],
      },
    ],
  },
  mage: {
    id: 'mage', name: '마법사', role: '마법 딜러', defaultRow: 'back',
    base: { hp: 125, atk: 31, def: 6, spd: 95, crit: 0.08 },
    roles: [
      {
        id: 'storm', name: '광역', desc: '적 전체에 원소 폭풍',
        basic: dmg('bolt', '마력탄', 1, 'any', 'magic'),
        skills: [dmg('storm', '원소 폭풍', 0.8, 'all', 'magic', 3, { big: true })],
      },
      {
        id: 'focus', name: '집중', desc: '체력 낮은 적 하나에 마력 폭발',
        basic: dmg('bolt', '마력탄', 1, 'any', 'magic'),
        skills: [dmg('burst', '마력 폭발', 2.2, 'lowest', 'magic', 3, { big: true })],
      },
    ],
  },
  priest: {
    id: 'priest', name: '사제', role: '지원', defaultRow: 'mid',
    base: { hp: 160, atk: 24, def: 10, spd: 100, crit: 0.05 },
    roles: [
      {
        id: 'heal', name: '치유', desc: '치유·성역 위주',
        basic: dmg('smite', '징벌', 0.8, 'any', 'holy'),
        skills: [
          { id: 'sanctuary', name: '성역', cooldown: 4, mult: 1.2, targeting: 'ally-all', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.7, minCount: 2 } },
          { id: 'heal', name: '치유', cooldown: 1, mult: 2.1, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.65, minCount: 1 } },
        ],
      },
      {
        id: 'smite', name: '공격', desc: '심판 위주, 아군이 위급할 때만 치유',
        basic: dmg('smite', '징벌', 1.05, 'any', 'holy'),
        skills: [
          { id: 'heal', name: '응급 치유', cooldown: 2, mult: 2.1, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.35, minCount: 1 } },
          dmg('judge', '심판', 1.8, 'lowest', 'holy', 3, { big: true }),
        ],
      },
      {
        id: 'bless', name: '축복', desc: '아군 전체 공격력 +20% (3턴), 약한 치유',
        basic: dmg('smite', '징벌', 0.8, 'any', 'holy'),
        skills: [
          { id: 'bless', name: '축복', cooldown: 4, mult: 0, targeting: 'ally-all', effect: { kind: 'buff', atk: 0.2, turns: 3 }, projectile: 'holy' },
          { id: 'heal', name: '치유', cooldown: 2, mult: 1.6, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.5, minCount: 1 } },
        ],
      },
    ],
  },
};

export function roleOf(cls: ClassId, roleId?: string): RoleDef {
  const roles = CLASSES[cls].roles;
  return roles.find((r) => r.id === roleId) ?? roles[0];
}

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
