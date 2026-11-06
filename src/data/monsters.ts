import type { CombatFx, PhaseDef, SkillDef, Stats } from '../battle/types';
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
  | 'ogre' | 'troll'
  // 11~20층 오크 전쟁 부대
  | 'orc_berserker' | 'orc_hunter' | 'orc_shaman' | 'warg' | 'orc_warchief' | 'orc_warlord'
  // 21~30층 거미 둥지
  | 'giant_spider' | 'web_weaver' | 'egg_sac' | 'spiderling' | 'broodmother' | 'spider_queen'
  // 31~40층 도적 길드
  | 'crossbowman' | 'assassin' | 'battle_mage' | 'mercenary' | 'guild_lieutenant' | 'guild_master'
  // 41~49층 거인의 산
  | 'ogre_brute' | 'hill_giant' | 'ogre_shaman' | 'two_headed_ogre'
  // 50층 탑의 주인
  | 'tower_lord';

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
  /** 전투 효과 (분노 등) */
  combat?: CombatFx;
  /** 보스 단계 */
  phases?: PhaseDef[];
  /** 그림 (없으면 id). 색만 바꾼 변종은 pixels.ts에 따로 */
  sprite?: string;
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
  // ══ 11~20층 오크 전쟁 부대 (녹색족 + 야수) · 규칙: 분노 (체력이 낮을수록 강해짐) ══
  orc_berserker: {
    id: 'orc_berserker', name: '오크 광전사', family: 'greenskin', row: 'front',
    base: { hp: 200, atk: 26, def: 10, spd: 98, crit: 0.1 },
    basic: melee('쌍도끼'), skills: [skill('frenzy', '광란', 0.75, 'front', 3, { hits: 3 })],
    combat: { rageAtk: 0.35, lowHpAtk: 0.25 },
    note: '분노: 체력이 반 아래로 떨어지면 공격력 급상승',
  },
  orc_hunter: {
    id: 'orc_hunter', name: '오크 사냥꾼', family: 'greenskin', row: 'back',
    base: { hp: 130, atk: 24, def: 8, spd: 104, crit: 0.12 },
    basic: ranged('투창', 'arrow'), skills: [skill('harpoon', '작살', 1.6, 'lowest', 3, { projectile: 'arrow' })],
    note: '후열에서 약한 영웅을 노림',
  },
  orc_shaman: {
    id: 'orc_shaman', name: '오크 주술사', family: 'greenskin', row: 'back', fx: 0xd0503a,
    base: { hp: 125, atk: 21, def: 7, spd: 98, crit: 0.05 },
    basic: { ...ranged('피의 저주'), mult: 0.9 },
    skills: [
      { id: 'drums', name: '전쟁 북', cooldown: 4, mult: 0, targeting: 'ally-all', effect: { kind: 'buff', atk: 0.2, turns: 2 }, projectile: 'none' },
      { id: 'mend', name: '피의 치유', cooldown: 3, mult: 1.6, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.5, minCount: 1 } },
    ],
    note: '북으로 오크를 강화하고 치유 — 먼저 처치',
  },
  warg: {
    id: 'warg', name: '와르그', family: 'beastkin', row: 'front', sprite: 'warg',
    base: { hp: 150, atk: 24, def: 8, spd: 122, crit: 0.12 },
    basic: melee('물어뜯기'), skills: [skill('pounce', '덮치기', 1.5, 'lowest', 3)],
    note: '아주 빠른 늑대. 약한 영웅에게 달려듦',
  },
  orc_warchief: {
    id: 'orc_warchief', name: '오크 대장', family: 'greenskin', row: 'front', boss: 'mid', fx: 0xd0503a,
    base: { hp: 980, atk: 34, def: 17, spd: 92, crit: 0.1 },
    basic: melee('대도끼'),
    skills: [
      { id: 'warcry', name: '함성', cooldown: 4, mult: 0, targeting: 'ally-all', effect: { kind: 'buff', atk: 0.25, turns: 3 }, projectile: 'none', big: true },
      skill('whirl', '회전 베기', 0.85, 'all', 3, { big: true }),
    ],
    combat: { rageAtk: 0.3 },
    note: '중간보스. 함성과 회전 베기, 분노',
  },
  orc_warlord: {
    id: 'orc_warlord', name: '오크 대족장', family: 'greenskin', row: 'front', boss: 'main', fx: 0xd0503a,
    base: { hp: 1150, atk: 36, def: 18, spd: 94, crit: 0.12 },
    basic: melee('족장의 도끼'),
    skills: [skill('quake', '전쟁의 발구름', 0.9, 'all', 3, { big: true }), skill('execute', '처형', 1.9, 'lowest', 3, { pierce: 0.4 })],
    combat: { rageAtk: 0.35, lowHpAtk: 0.3 },
    phases: [{ below: 0.5, name: '피의 분노', atkMult: 1.25, skills: [skill('bloodrage', '피의 광란', 0.7, 'all', 2, { big: true, hits: 2 }), skill('execute', '처형', 1.9, 'lowest', 3, { pierce: 0.4 })] }],
    note: '메인보스. 체력이 반 아래면 피의 분노',
  },
  // ══ 21~30층 거미 둥지 (괴수) · 규칙: 독, 거미줄(둔화), 알에서 새끼 소환 ══
  giant_spider: {
    id: 'giant_spider', name: '거대 거미', family: 'monster', row: 'front', fx: 0x9adf5a, sprite: 'giant_spider',
    base: { hp: 210, atk: 24, def: 12, spd: 96, crit: 0.08 },
    basic: { ...melee('독니'), inflict: { poison: { pct: 0.04, turns: 3 } } },
    skills: [skill('lunge', '덮치기', 1.5, 'front', 3)],
    note: '물면 독 (매 턴 체력의 4%)',
  },
  web_weaver: {
    id: 'web_weaver', name: '거미줄 직조자', family: 'monster', row: 'back', fx: 0xe8e8f0, sprite: 'web_weaver',
    base: { hp: 120, atk: 19, def: 6, spd: 106, crit: 0.05 },
    basic: ranged('끈끈한 실'),
    skills: [skill('web', '거미줄 그물', 0.4, 'all', 4, { projectile: 'magic', inflict: { slow: { pct: 0.35, turns: 2 } } })],
    note: '거미줄로 파티 전체 속도 -35%',
  },
  egg_sac: {
    id: 'egg_sac', name: '거미 알', family: 'monster', row: 'back', sprite: 'egg_sac',
    base: { hp: 170, atk: 4, def: 6, spd: 70, crit: 0 },
    basic: { id: 'pulse', name: '꿈틀', cooldown: 0, mult: 0, targeting: 'self', effect: { kind: 'none' }, projectile: 'none' },
    skills: [{ id: 'hatch', name: '부화', cooldown: 2, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'spiderling', count: 1 }, projectile: 'none' }],
    note: '공격하지 않지만 새끼 거미를 계속 부화시킴',
  },
  spiderling: {
    id: 'spiderling', name: '새끼 거미', family: 'monster', row: 'front', sprite: 'spiderling',
    base: { hp: 60, atk: 15, def: 3, spd: 118, crit: 0.05 },
    basic: { ...melee('깨물기'), inflict: { poison: { pct: 0.02, turns: 2 } } },
    skills: [],
    note: '알에서 태어남. 약하지만 독',
  },
  broodmother: {
    id: 'broodmother', name: '어미 거미', family: 'monster', row: 'front', boss: 'mid', fx: 0x9adf5a, sprite: 'broodmother',
    base: { hp: 940, atk: 30, def: 15, spd: 90, crit: 0.08 },
    basic: { ...melee('독니'), inflict: { poison: { pct: 0.05, turns: 3 } } },
    skills: [
      { id: 'brood', name: '새끼 부르기', cooldown: 3, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'spiderling', count: 2 }, projectile: 'none', big: true },
      skill('venomrain', '독비', 0.55, 'all', 3, { projectile: 'magic', inflict: { poison: { pct: 0.03, turns: 2 } } }),
    ],
    note: '중간보스. 새끼를 부르고 독비',
  },
  spider_queen: {
    id: 'spider_queen', name: '거미 여왕', family: 'monster', row: 'front', boss: 'main', fx: 0xb07af0, sprite: 'spider_queen',
    base: { hp: 1100, atk: 33, def: 16, spd: 96, crit: 0.1 },
    basic: { ...melee('여왕의 독니'), inflict: { poison: { pct: 0.05, turns: 3 } } },
    skills: [
      skill('cocoon', '고치', 0.5, 'all', 4, { projectile: 'magic', big: true, inflict: { slow: { pct: 0.4, turns: 2 } } }),
      skill('devour', '포식', 2.0, 'lowest', 3, { big: true }),
      { id: 'brood', name: '알 낳기', cooldown: 4, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'spiderling', count: 2 }, projectile: 'none' },
    ],
    note: '메인보스. 고치로 묶고, 독, 새끼 소환',
  },
  // ══ 31~40층 도적 길드 (인간) · 규칙: 암살(후열 노림·도발 무시), 방어 무시 ══
  crossbowman: {
    id: 'crossbowman', name: '석궁병', family: 'human', row: 'back', sprite: 'crossbowman',
    base: { hp: 125, atk: 25, def: 8, spd: 100, crit: 0.12 },
    basic: { ...ranged('석궁', 'arrow'), pierce: 0.3 },
    skills: [skill('volley', '연사', 0.6, 'all', 3, { projectile: 'arrow', pierce: 0.3 })],
    note: '방어력을 30% 무시',
  },
  assassin: {
    id: 'assassin', name: '암살자', family: 'human', row: 'front', sprite: 'assassin',
    base: { hp: 130, atk: 27, def: 7, spd: 124, crit: 0.2 },
    basic: melee('단검'),
    skills: [skill('assassinate', '암살', 1.8, 'back', 3, { pierce: 0.5 })],
    combat: { dodge: 0.15 },
    note: '도발을 무시하고 후열을 암살. 15% 회피',
  },
  battle_mage: {
    id: 'battle_mage', name: '전투 마법사', family: 'human', row: 'back', fx: 0x8a6aff, sprite: 'battle_mage',
    base: { hp: 115, atk: 26, def: 6, spd: 98, crit: 0.08 },
    basic: { ...ranged('비전 화살'), pierce: 0.5 },
    skills: [skill('fireball', '화염구', 0.85, 'all', 3, { projectile: 'magic', big: true })],
    note: '방어력을 50% 무시하는 마법, 전체 화염구',
  },
  mercenary: {
    id: 'mercenary', name: '용병 기사', family: 'human', row: 'front', sprite: 'mercenary',
    base: { hp: 260, atk: 22, def: 22, spd: 84, crit: 0.06 },
    basic: melee('철퇴'),
    skills: [skill('bash', '방패 강타', 1.2, 'front', 3, { inflict: { stun: { chance: 0.35, turns: 1 } } })],
    note: '단단함. 방패로 기절 (35%)',
  },
  guild_lieutenant: {
    id: 'guild_lieutenant', name: '길드 부두목', family: 'human', row: 'front', boss: 'mid', sprite: 'guild_lieutenant',
    base: { hp: 900, atk: 34, def: 15, spd: 112, crit: 0.18 },
    basic: melee('쌍단검'),
    skills: [skill('shadow', '그림자 습격', 1.4, 'back', 2, { pierce: 0.5, hits: 2 }), skill('smoke', '독 연막', 0.5, 'all', 4, { projectile: 'magic', inflict: { poison: { pct: 0.03, turns: 3 } } })],
    combat: { dodge: 0.2 },
    note: '중간보스. 후열 습격, 독 연막, 20% 회피',
  },
  guild_master: {
    id: 'guild_master', name: '길드장', family: 'human', row: 'front', boss: 'main', fx: 0xe8c25a, sprite: 'guild_master',
    base: { hp: 1100, atk: 36, def: 17, spd: 108, crit: 0.2 },
    basic: { ...melee('독 묻은 검'), inflict: { poison: { pct: 0.03, turns: 3 } } },
    skills: [
      skill('mark', '죽음의 표식', 2.2, 'back', 3, { pierce: 0.6, big: true }),
      { id: 'thugs', name: '부하 호출', cooldown: 4, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'bandit', count: 2 }, projectile: 'none', big: true },
    ],
    combat: { dodge: 0.15 },
    note: '메인보스. 후열 암살, 독, 부하 호출',
  },
  // ══ 41~49층 거인의 산 (거인) · 규칙: 기절, 거대한 체력 ══
  ogre_brute: {
    id: 'ogre_brute', name: '오우거 장정', family: 'giant', row: 'front', sprite: 'ogre_brute',
    base: { hp: 330, atk: 32, def: 13, spd: 80, crit: 0.06 },
    basic: melee('몽둥이'),
    skills: [skill('smash', '내려치기', 1.5, 'front', 3, { inflict: { stun: { chance: 0.4, turns: 1 } } })],
    note: '내려치기로 기절 (40%)',
  },
  hill_giant: {
    id: 'hill_giant', name: '언덕 거인', family: 'giant', row: 'front', sprite: 'hill_giant',
    base: { hp: 460, atk: 34, def: 14, spd: 72, crit: 0.05 },
    basic: melee('주먹'),
    skills: [skill('boulder', '바위 굴리기', 0.75, 'all', 4, { big: true, inflict: { stun: { chance: 0.2, turns: 1 } } })],
    note: '체력이 매우 높음. 바위로 전체 공격, 20% 기절',
  },
  ogre_shaman: {
    id: 'ogre_shaman', name: '오우거 주술사', family: 'giant', row: 'back', fx: 0x9adf5a, sprite: 'ogre_shaman',
    base: { hp: 190, atk: 24, def: 8, spd: 88, crit: 0.05 },
    basic: ranged('돌 저주'),
    skills: [
      { id: 'stoneheal', name: '대지의 치유', cooldown: 3, mult: 1.8, targeting: 'ally-lowest', effect: { kind: 'heal' }, projectile: 'holy', healBelow: { ratio: 0.55, minCount: 1 } },
      skill('petrify', '석화', 0.4, 'all', 4, { projectile: 'magic', inflict: { slow: { pct: 0.3, turns: 2 } } }),
    ],
    note: '거인을 치유하고 석화로 둔화',
  },
  two_headed_ogre: {
    id: 'two_headed_ogre', name: '쌍두 오우거', family: 'giant', row: 'front', boss: 'mid', sprite: 'two_headed_ogre',
    base: { hp: 1150, atk: 38, def: 16, spd: 84, crit: 0.08 },
    basic: { ...melee('두 몽둥이'), hits: 2, mult: 0.6 },
    skills: [skill('quake', '대지 강타', 0.8, 'all', 3, { big: true, inflict: { stun: { chance: 0.3, turns: 1 } } }), skill('crush', '짓밟기', 2.0, 'lowest', 3)],
    note: '중간보스. 두 번 때리고 대지 강타로 기절',
  },
  // ══ 50층 탑의 주인 (용족) · 1~49층의 힘을 모두 씀 ══
  tower_lord: {
    id: 'tower_lord', name: '탑의 주인', family: 'draconic', row: 'front', boss: 'main', fx: 0xff7a45, sprite: 'tower_lord',
    base: { hp: 2400, atk: 38, def: 20, spd: 100, crit: 0.12 },
    basic: melee('용의 발톱'),
    skills: [
      skill('breath', '화염 숨결', 0.9, 'all', 3, { projectile: 'magic', big: true }),
      { id: 'legion', name: '녹색 군단 소환', cooldown: 5, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'orc_berserker', count: 2 }, projectile: 'none', big: true },
    ],
    phases: [
      {
        below: 0.66, name: '독의 날개', atkMult: 1.1,
        skills: [
          skill('venombreath', '독 숨결', 0.7, 'all', 3, { projectile: 'magic', big: true, inflict: { poison: { pct: 0.04, turns: 3 } } }),
          skill('webwing', '거미줄 날개', 0.4, 'all', 4, { projectile: 'magic', inflict: { slow: { pct: 0.4, turns: 2 } } }),
          { id: 'brood', name: '새끼 거미 소환', cooldown: 5, mult: 0, targeting: 'self', effect: { kind: 'summon', monster: 'spiderling', count: 2 }, projectile: 'none' },
        ],
      },
      {
        below: 0.33, name: '탑의 분노', atkMult: 1.25,
        skills: [
          skill('shadowclaw', '그림자 발톱', 1.8, 'back', 2, { pierce: 0.6, big: true }),
          skill('meteor', '대지 붕괴', 0.85, 'all', 3, { big: true, inflict: { stun: { chance: 0.3, turns: 1 } } }),
          skill('breath', '화염 숨결', 1.0, 'all', 3, { projectile: 'magic', big: true }),
        ],
      },
    ],
    note: '최종 보스. 체력에 따라 1~49층의 힘을 차례로 꺼냄',
  },
};

/** 층당 적 강화율 */
export const FLOOR_GROWTH = 0.13;
/** 적 공격력 전체 배율 — 난이도 1차 조절 손잡이 */
export const ENEMY_ATK_SCALE = 1.85;

/** 11층부터는 영웅 성장(레벨당 +10%)과 같은 속도로 강해짐. 차이는 무기·전투 규칙으로 */
export const FLOOR_GROWTH_LATE = 0.1;

export function monsterStats(base: Stats, floor: number): Stats {
  const g = 1 + FLOOR_GROWTH * Math.min(floor - 1, 9) + FLOOR_GROWTH_LATE * Math.max(0, floor - 10);
  return {
    hp: Math.round(base.hp * g),
    atk: Math.round(base.atk * g * ENEMY_ATK_SCALE),
    def: Math.round(base.def * g),
    spd: base.spd + Math.floor((floor - 1) / 2),
    crit: base.crit,
  };
}
