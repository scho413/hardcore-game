import type { UnitInit } from '../battle/types';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';

export interface FloorDef {
  floor: number;
  /** 이름이 붙은 층 (보스 층) */
  title?: string;
  enemies: MonsterId[];
}

// GDD 5.1 / 5.1.1. 프로토타입 범위는 10층.
// 11~25층 예정: 뱀족·샌드웜(15층 중간보스)·리치(20층 메인보스) 등
export const FLOORS: FloorDef[] = [
  { floor: 1, enemies: ['slime', 'goblin', 'slime'] },
  { floor: 2, enemies: ['goblin', 'bandit', 'goblin', 'spider'] },
  { floor: 3, enemies: ['wolfkin', 'hobgoblin', 'wolfkin', 'spider'] },
  { floor: 4, enemies: ['bandit', 'orc', 'hobgoblin', 'imp', 'skeleton'] },
  { floor: 5, title: '중간보스', enemies: ['goblin', 'ogre', 'goblin'] },
  { floor: 6, enemies: ['hyena', 'gnoll', 'hyena', 'imp', 'imp'] },
  { floor: 7, enemies: ['lizardman', 'ghoul', 'lizardman', 'naga', 'skeleton'] },
  { floor: 8, enemies: ['troll', 'ghoul', 'lizardman', 'succubus'] },
  { floor: 9, enemies: ['orc', 'goblin', 'bandit', 'succubus', 'skeleton'] },
  { floor: 10, title: '메인보스', enemies: ['drake', 'imp', 'imp'] },
];

export const TOP_FLOOR = FLOORS.length;

export function buildEnemies(floor: number): UnitInit[] {
  const def = FLOORS[floor - 1];
  const slots = { front: 0, back: 0 };
  return def.enemies.map((id, i) => {
    const m = MONSTERS[id];
    const slot = slots[m.row]++;
    return {
      id: `e${i}`,
      name: m.name,
      side: 'enemy',
      kind: m.id,
      family: m.family,
      fxColor: m.fx,
      row: m.row,
      slot,
      stats: monsterStats(m.base, floor),
      basic: m.basic,
      skills: m.skills,
      boss: m.boss,
    };
  });
}
