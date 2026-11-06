import type { SkillDef, Stats } from '../battle/types';
import type { Family } from './races';

export type MonsterId =
  // 괴수
  | 'slime' | 'spider' | 'sandworm'
  // 녹색족 (1~10층 고블린 소굴)
  | 'goblin' | 'goblin_archer' | 'goblin_shaman' | 'goblin_bomber' | 'wolf_rider' | 'hobgoblin' | 'goblin_chief' | 'goblin_king' | 'orc'
  // 인간
  | 'bandit'
  // 야수
  | 'wolfkin' | 'hyena' | 'gnoll' | 'gnoll_chief'
  // 악마
  | 'imp' | 'succubus'
  // 언데드
  | 'skeleton' | 'ghoul' | 'lich'
  // 용족
  | 'lizardman' | 'naga' | 'drake'
  // 거인
  | 'ogre' | 'troll';

export interface MonsterDef {
  id: MonsterId;
  name: string;
  family: Family;
  row: 'front' | 'back';
  /** 1층 기준. 층이 오르면 monsterStats로 강화 */
  base: Stats;
  basic: SkillDef;
  skills: SkillDef[];
  boss?: 'mid' | 'main';
  /** 정찰 화면 한 줄 설명 */
  note: string;
  /** 마법·투사체 색 */
  fx?: number;
}

const melee = (name = '공격'): SkillDef => ({ id: 'hit', name, cooldown: 0, mult: 1, targeting: 'front', effect: { kind: 'damage' }, projectile: 'none' });
const ranged = (name: string, projectile: 'arrow' | 'magic' = 'magic', targeting: 'any' | 'lowest' = 'any'): SkillDef => ({ id: 'shot', name, cooldown: 0, mult: 1, targeting, effect: { kind: 'damage' }, projectile });
const skill = (id: string, name: string, mult: number, targeting: SkillDef['targeting'], cooldown = 3, extra: Partial<SkillDef> = {}): SkillDef => ({
  id, name, cooldown, mult, targeting, effect: { kind: 'damage' }, projectile: 'none', ...extra,
});

// GDD 5.1.1 적 계열. 수치는 tools/sim.ts로 검증하며 조정합니다.
export const MONSTERS: Record<MonsterId, MonsterDef> = {
  // ── 괴수 ──
  slime: {
    id: 'slime', name: '슬라임', family: 'monster', row: 'front',
    base: { hp: 120, atk: 16, def: 6, spd: 80, crit: 0.03 },
    basic: melee('몸통박치기'), skills: [],
    note: '느리고 약함',
  },
  spider: {
    id: 'spider', name: '거미족', family: 'monster', row: 'back', fx: 0x9adf5a,
    base: { hp: 95, atk: 20, def: 6, spd: 112, crit: 0.08 },
    basic: ranged('독니', 'magic'),
    skills: [skill('venom', '독침 세례', 0.55, 'all', 4, { projectile: 'magic' })],
    note: '후열에서 독침. 가끔 전체 공격',
  },
  sandworm: {
    id: 'sandworm', name: '샌드웜', family: 'monster', row: 'front', boss: 'mid',
    base: { hp: 1000, atk: 38, def: 18, spd: 76, crit: 0.06 },
    basic: melee('삼키기'),
    skills: [skill('burrow', '모래 폭풍', 0.8, 'all', 3, { big: true }), skill('devour', '통째로 삼키기', 2.2, 'lowest', 4, { big: true })],
    note: '중간보스. 약한 영웅을 통째로 삼킴',
  },
  // ── 녹색족 ──
  goblin: {
    id: 'goblin', name: '고블린 전사', family: 'greenskin', row: 'front',
    base: { hp: 110, atk: 21, def: 8, spd: 108, crit: 0.08 },
    basic: melee('찌르기'), skills: [],
    note: '빠른 근접',
  },
  goblin_archer: {
    id: 'goblin_archer', name: '고블린 궁수', family: 'greenskin', row: 'back',
    base: { hp: 85, atk: 20, def: 5, spd: 110, crit: 0.1 },
    basic: ranged('화살', 'arrow'),
    skills: [skill('aim', '조준 사격', 1.5, 'lowest', 3, { projectile: 'arrow' })],
    note: '후열에서 약한 영웅을 저격',
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: '고블린 주술사', family: 'greenskin', row: 'back', fx: 0x8adf5a,
    base: { hp: 95, atk: 18, def: 5, spd: 100, crit: 0.05 },
    basic: { ...ranged('저주'), mult: 0.9 },
    skills: [{ id: 'totem', name: '치유의 토템', cooldown: 3, mult: 1.8, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.6, minCount: 1 } }],
    note: '고블린을 치유함 — 먼저 처치',
  },
  goblin_bomber: {
    id: 'goblin_bomber', name: '고블린 폭탄병', family: 'greenskin', row: 'back', fx: 0xff9a3a,
    base: { hp: 80, atk: 22, def: 4, spd: 96, crit: 0.05 },
    basic: { ...ranged('돌팔매'), mult: 0.8 },
    skills: [skill('bomb', '폭탄 투척', 0.7, 'all', 3, { projectile: 'magic', big: true })],
    note: '3턴마다 전체 폭발',
  },
  wolf_rider: {
    id: 'wolf_rider', name: '늑대 기수', family: 'greenskin', row: 'front',
    base: { hp: 130, atk: 22, def: 7, spd: 132, crit: 0.1 },
    basic: melee('창 찌르기'),
    skills: [skill('charge', '돌진', 1.5, 'lowest')],
    note: '매우 빠름, 약한 영웅에게 돌진',
  },
  goblin_chief: {
    id: 'goblin_chief', name: '고블린 족장', family: 'greenskin', row: 'front', boss: 'mid',
    base: { hp: 950, atk: 38, def: 14, spd: 88, crit: 0.08 },
    basic: melee('몽둥이'),
    skills: [
      { id: 'roar', name: '족장의 함성', cooldown: 4, mult: 0, targeting: 'ally-all', effect: { kind: 'buff', atk: 0.3, turns: 3 }, projectile: 'none', big: true },
      skill('slam', '내려찍기', 0.8, 'all', 3, { big: true }),
    ],
    note: '중간보스. 함성으로 고블린을 강화',
  },
  goblin_king: {
    id: 'goblin_king', name: '고블린 왕', family: 'greenskin', row: 'front', boss: 'main', fx: 0xe8c25a,
    base: { hp: 900, atk: 28, def: 16, spd: 95, crit: 0.1 },
    basic: melee('황금 홀'),
    skills: [
      { id: 'command', name: '총공격 명령', cooldown: 4, mult: 0, targeting: 'ally-all', effect: { kind: 'buff', atk: 0.25, turns: 3 }, projectile: 'none', big: true },
      skill('wrath', '진노', 0.9, 'all', 3, { projectile: 'magic', big: true }),
      skill('execute', '처형', 1.6, 'lowest', 3),
    ],
    note: '메인보스. 부하를 강화하고 약한 영웅을 처형',
  },
  hobgoblin: {
    id: 'hobgoblin', name: '홉고블린', family: 'greenskin', row: 'front',
    base: { hp: 175, atk: 22, def: 14, spd: 95, crit: 0.06 },
    basic: melee('창 찌르기'),
    skills: [skill('charge', '방패 돌진', 1.6, 'front')],
    note: '단단한 고블린 지휘관',
  },
  orc: {
    id: 'orc', name: '오크 전사', family: 'greenskin', row: 'front',
    base: { hp: 230, atk: 25, def: 16, spd: 85, crit: 0.08 },
    basic: melee('도끼질'),
    skills: [skill('cleave', '내려찍기', 1.9, 'front', 3, { big: true })],
    note: '단단하고 한 방이 셈',
  },
  // ── 인간 ──
  bandit: {
    id: 'bandit', name: '도적', family: 'human', row: 'front',
    base: { hp: 115, atk: 23, def: 8, spd: 114, crit: 0.15 },
    basic: melee('단검'),
    skills: [skill('backstab', '급소 찌르기', 1.7, 'lowest')],
    note: '범죄집단. 약한 영웅의 급소를 노림',
  },
  // ── 야수 ──
  wolfkin: {
    id: 'wolfkin', name: '늑대 수인', family: 'beastkin', row: 'front',
    base: { hp: 115, atk: 20, def: 6, spd: 126, crit: 0.12 },
    basic: melee('할퀴기'),
    skills: [skill('bite', '물어뜯기', 1.6, 'front')],
    note: '매우 빠름, 치명타 주의',
  },
  hyena: {
    id: 'hyena', name: '하이에나 수인', family: 'beastkin', row: 'front',
    base: { hp: 105, atk: 21, def: 6, spd: 130, crit: 0.1 },
    basic: melee('물기'),
    skills: [skill('scavenge', '사냥감 몰이', 1.5, 'lowest')],
    note: '쓰러지기 직전인 영웅을 노림',
  },
  gnoll: {
    id: 'gnoll', name: '놀', family: 'beastkin', row: 'front',
    base: { hp: 160, atk: 25, def: 9, spd: 100, crit: 0.08 },
    basic: melee('철퇴'),
    skills: [skill('frenzy', '광란의 연타', 0.7, 'front', 3, { hits: 3 })],
    note: '연타로 전열을 두들김',
  },
  gnoll_chief: {
    id: 'gnoll_chief', name: '놀 우두머리', family: 'beastkin', row: 'front', boss: 'mid', fx: 0xff6633,
    base: { hp: 880, atk: 40, def: 13, spd: 98, crit: 0.1 },
    basic: melee('대철퇴'),
    skills: [skill('howl', '피의 포효', 0.8, 'all', 3, { big: true }), skill('maul', '물어뜯기', 0.75, 'lowest', 2, { hits: 3 })],
    note: '던전 보스. 포효로 전체 공격, 약한 영웅을 물어뜯음',
  },
  // ── 악마 ──
  imp: {
    id: 'imp', name: '임프', family: 'demon', row: 'back', fx: 0xff7a45,
    base: { hp: 85, atk: 23, def: 4, spd: 100, crit: 0.06 },
    basic: ranged('불씨'),
    skills: [skill('fireball', '화염구', 1.5, 'any', 3, { projectile: 'magic' })],
    note: '후열 원거리, 아무나 노림',
  },
  succubus: {
    id: 'succubus', name: '서큐버스', family: 'demon', row: 'back', fx: 0xe060c0,
    base: { hp: 110, atk: 24, def: 6, spd: 112, crit: 0.08 },
    basic: ranged('마력 채찍'),
    skills: [skill('hex', '저주의 불꽃', 0.65, 'all', 3, { projectile: 'magic', big: true })],
    note: '후열에서 전체 저주',
  },
  // ── 언데드 ──
  skeleton: {
    id: 'skeleton', name: '해골 궁수', family: 'undead', row: 'back',
    base: { hp: 95, atk: 21, def: 7, spd: 104, crit: 0.1 },
    basic: ranged('화살', 'arrow', 'lowest'), skills: [],
    note: '체력 낮은 영웅을 저격',
  },
  ghoul: {
    id: 'ghoul', name: '구울', family: 'undead', row: 'front',
    base: { hp: 165, atk: 23, def: 8, spd: 104, crit: 0.08 },
    basic: melee('할퀴기'),
    skills: [skill('gnaw', '갉아먹기', 1.7, 'front')],
    note: '질기고 굶주림',
  },
  lich: {
    id: 'lich', name: '리치', family: 'undead', row: 'back', boss: 'main', fx: 0x8a6aff,
    base: { hp: 1100, atk: 36, def: 14, spd: 96, crit: 0.08 },
    basic: ranged('죽음의 화살'),
    skills: [skill('nova', '죽음의 파동', 0.9, 'all', 3, { projectile: 'magic', big: true }), skill('drain', '영혼 흡수', 1.8, 'lowest', 2, { projectile: 'magic' })],
    note: '메인보스. 후열에서 죽음의 마법',
  },
  // ── 용족 ──
  lizardman: {
    id: 'lizardman', name: '리자드맨', family: 'draconic', row: 'front',
    base: { hp: 165, atk: 24, def: 13, spd: 100, crit: 0.08 },
    basic: melee('삼지창'),
    skills: [skill('tail', '꼬리치기', 1.6, 'front')],
    note: '비늘이 단단함',
  },
  naga: {
    id: 'naga', name: '뱀족', family: 'draconic', row: 'back', fx: 0x6adf9a,
    base: { hp: 120, atk: 23, def: 8, spd: 106, crit: 0.08 },
    basic: ranged('독 침'),
    skills: [skill('mist', '독안개', 0.6, 'all', 4, { projectile: 'magic' })],
    note: '후열에서 독안개',
  },
  drake: {
    id: 'drake', name: '화염 용', family: 'draconic', row: 'front', boss: 'main', fx: 0xff7a45,
    base: { hp: 880, atk: 34, def: 15, spd: 92, crit: 0.1 },
    basic: melee('발톱'),
    skills: [
      skill('breath', '화염 숨결', 0.95, 'all', 3, { projectile: 'magic', big: true }),
      skill('tailsweep', '꼬리 휩쓸기', 1.6, 'front', 2),
    ],
    note: '메인보스. 3턴마다 전체 화염',
  },
  // ── 거인 ──
  ogre: {
    id: 'ogre', name: '오우거', family: 'giant', row: 'front', boss: 'mid',
    base: { hp: 900, atk: 45, def: 14, spd: 82, crit: 0.08 },
    basic: melee('주먹'),
    skills: [skill('quake', '대지 강타', 0.85, 'all', 3, { big: true })],
    note: '중간보스. 3턴마다 전체 공격',
  },
  troll: {
    id: 'troll', name: '트롤', family: 'giant', row: 'front',
    base: { hp: 360, atk: 34, def: 11, spd: 78, crit: 0.06 },
    basic: melee('몽둥이'),
    skills: [skill('boulder', '바위 던지기', 1.5, 'any', 3, { big: true })],
    note: '체력이 매우 높음',
  },
};

/** 층당 적 강화율 */
export const FLOOR_GROWTH = 0.13;
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
