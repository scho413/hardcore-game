import type { UnitInit } from '../battle/types';
import type { Summoner } from '../battle/engine';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';

export interface FloorDef {
  floor: number;
  /** 이름이 붙은 층 (보스 층) */
  title?: string;
  enemies: MonsterId[];
  /** 체력·공격력 보정 (난이도 미세 조정) */
  scale?: number;
}

// GDD 5.1.1: 10층마다 테마 (미리 알려주지 않음). 50층은 1~49층을 다스리는 탑의 주인
export const THEMES = [
  { from: 1, to: 10, name: '고블린 소굴', rule: '' },
  { from: 11, to: 20, name: '오크 전쟁 부대', rule: '분노: 체력이 낮을수록 강해짐' },
  { from: 21, to: 30, name: '거미 둥지', rule: '독 · 거미줄(둔화) · 알에서 새끼 소환' },
  { from: 31, to: 40, name: '도적 길드', rule: '암살: 도발 무시하고 후열 공격 · 방어 무시' },
  { from: 41, to: 50, name: '거인의 산', rule: '기절 · 거대한 체력' },
];

const F = (floor: number, enemies: MonsterId[], title?: string): FloorDef => ({ floor, enemies, title, scale: SCALE[floor] });

/** 층별 보정 (tools/sim.ts --weapons 기준: 일반 층 80~95%, 중간보스 55~70%, 메인보스 40~55%) */
const SCALE: Record<number, number> = {
  14: 0.85, 15: 0.95, 16: 0.85, 17: 0.85, 18: 0.85, 19: 0.95, 20: 0.6,
  22: 1.3, 23: 1.18, 24: 1.1, 25: 1.15, 26: 1.17, 27: 1.15, 29: 1.28, 30: 0.92,
  31: 1.35, 32: 1.35, 33: 1.3, 34: 1.1, 35: 0.78, 40: 0.88,
  41: 1.45, 42: 1.25, 43: 1.42, 44: 1.1, 45: 1.12, 46: 1.12, 48: 1.15, 50: 0.9,
};

export const FLOORS: FloorDef[] = [
  F(1, ['goblin', 'goblin']),
  F(2, ['goblin', 'goblin', 'goblin']),
  F(3, ['goblin', 'hobgoblin', 'goblin_archer', 'goblin_archer']),
  F(4, ['goblin', 'wolf_rider', 'hobgoblin', 'goblin_shaman', 'goblin_archer']),
  F(5, ['goblin', 'goblin_chief', 'goblin'], '중간보스'),
  F(6, ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_shaman', 'goblin_bomber']),
  F(7, ['wolf_rider', 'hobgoblin', 'wolf_rider', 'goblin_archer']),
  F(8, ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_bomber', 'goblin_shaman']),
  F(9, ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_bomber', 'goblin']),
  F(10, ['hobgoblin', 'goblin_king', 'goblin'], '메인보스'),
  // 오크 전쟁 부대
  F(11, ['orc', 'orc', 'orc_hunter']),
  F(12, ['orc', 'warg', 'orc_hunter', 'orc_hunter']),
  F(13, ['orc', 'orc_berserker', 'warg', 'orc_shaman']),
  F(14, ['orc_berserker', 'warg', 'warg', 'orc_hunter', 'orc_shaman']),
  F(15, ['orc', 'orc_warchief', 'orc_hunter'], '중간보스'),
  F(16, ['orc_berserker', 'orc', 'warg', 'orc_shaman', 'orc_hunter']),
  F(17, ['warg', 'warg', 'warg', 'orc_hunter', 'orc_hunter']),
  F(18, ['orc_berserker', 'orc_berserker', 'orc', 'orc_shaman', 'orc_hunter']),
  F(19, ['orc_berserker', 'warg', 'orc', 'orc_shaman', 'orc_shaman']),
  F(20, ['orc_berserker', 'orc_warlord', 'orc_shaman'], '메인보스'),
  // 거미 둥지
  F(21, ['giant_spider', 'spider', 'spider']),
  F(22, ['giant_spider', 'egg_sac', 'spider', 'web_weaver']),
  F(23, ['giant_spider', 'giant_spider', 'spider', 'web_weaver']),
  F(24, ['giant_spider', 'giant_spider', 'egg_sac', 'egg_sac', 'web_weaver']),
  F(25, ['giant_spider', 'broodmother', 'web_weaver'], '중간보스'),
  F(26, ['giant_spider', 'giant_spider', 'egg_sac', 'spider', 'spider']),
  F(27, ['giant_spider', 'giant_spider', 'egg_sac', 'egg_sac', 'web_weaver']),
  F(28, ['giant_spider', 'giant_spider', 'giant_spider', 'spider', 'web_weaver']),
  F(29, ['giant_spider', 'giant_spider', 'egg_sac', 'egg_sac', 'spider']),
  F(30, ['giant_spider', 'spider_queen', 'web_weaver'], '메인보스'),
  // 도적 길드
  F(31, ['bandit', 'bandit', 'crossbowman']),
  F(32, ['mercenary', 'bandit', 'crossbowman', 'crossbowman']),
  F(33, ['bandit', 'assassin', 'crossbowman', 'battle_mage']),
  F(34, ['mercenary', 'assassin', 'bandit', 'crossbowman', 'battle_mage']),
  F(35, ['assassin', 'guild_lieutenant', 'crossbowman'], '중간보스'),
  F(36, ['mercenary', 'assassin', 'assassin', 'battle_mage', 'crossbowman']),
  F(37, ['mercenary', 'mercenary', 'assassin', 'battle_mage', 'battle_mage']),
  F(38, ['assassin', 'assassin', 'bandit', 'crossbowman', 'battle_mage']),
  F(39, ['mercenary', 'assassin', 'assassin', 'battle_mage', 'crossbowman']),
  F(40, ['assassin', 'guild_master', 'battle_mage'], '메인보스'),
  // 거인의 산
  F(41, ['ogre_brute', 'troll', 'ogre_shaman']),
  F(42, ['ogre_brute', 'troll', 'ogre_shaman', 'ogre_shaman']),
  F(43, ['hill_giant', 'troll', 'ogre_shaman']),
  F(44, ['ogre_brute', 'hill_giant', 'troll', 'ogre_shaman']),
  F(45, ['troll', 'two_headed_ogre', 'ogre_shaman'], '중간보스'),
  F(46, ['hill_giant', 'ogre_brute', 'troll', 'ogre_shaman']),
  F(47, ['hill_giant', 'hill_giant', 'ogre_shaman', 'ogre_shaman']),
  F(48, ['ogre_brute', 'hill_giant', 'troll', 'ogre_shaman']),
  F(49, ['ogre_brute', 'hill_giant', 'ogre_brute', 'ogre_shaman', 'ogre_shaman']),
  F(50, ['tower_lord'], '탑의 주인'),
];

export function themeOf(floor: number): string {
  if (floor === TOP_FLOOR_ID) return '탑의 꼭대기';
  return THEMES.find((t) => floor >= t.from && floor <= t.to)?.name ?? '';
}

export function zoneOf(floor: number): number {
  return Math.floor((floor - 1) / 10);
}

const TOP_FLOOR_ID = 50;

/** 몬스터 1마리 → 전투 유닛 */
export function monsterUnit(id: MonsterId, uid: string, slot: number, floor: number): UnitInit {
  const m = MONSTERS[id];
  const st = monsterStats(m.base, floor);
  const k = FLOORS[floor - 1]?.scale ?? 1;
  if (k !== 1) {
    st.hp = Math.round(st.hp * k);
    st.atk = Math.round(st.atk * k);
  }
  return {
    id: uid,
    name: m.name,
    side: 'enemy',
    kind: m.id,
    family: m.family,
    fxColor: m.fx,
    row: m.row,
    slot,
    stats: st,
    basic: m.basic,
    skills: m.skills,
    boss: m.boss,
    fx: m.combat,
    phases: m.phases,
  };
}

/** 이 층의 소환 (알 → 새끼 거미 등). 소환된 적도 그 층 강함 */
export function summonerFor(floor: number): Summoner {
  return (kind, uid, _row, slot) => (MONSTERS[kind as MonsterId] ? monsterUnit(kind as MonsterId, uid, slot, floor) : null);
}

export const TOP_FLOOR = FLOORS.length;

export function buildEnemies(floor: number): UnitInit[] {
  const def = FLOORS[floor - 1];
  const slots = { front: 0, back: 0 };
  return def.enemies.map((id, i) => monsterUnit(id, `e${i}`, slots[MONSTERS[id].row]++, floor));
}
