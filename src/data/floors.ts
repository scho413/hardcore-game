import type { UnitInit } from '../battle/types';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';

export interface FloorDef {
  floor: number;
  /** 이름이 붙은 층 (보스 층) */
  title?: string;
  enemies: MonsterId[];
}

// GDD 5.1: 5층 중간보스, 10층 메인보스. 1단계 범위는 10층까지.
export const FLOORS: FloorDef[] = [
  { floor: 1, enemies: ['slime', 'goblin', 'slime'] },
  { floor: 2, enemies: ['goblin', 'goblin', 'slime', 'skeleton'] },
  { floor: 3, enemies: ['wolf', 'goblin', 'wolf', 'imp'] },
  { floor: 4, enemies: ['goblin', 'orc', 'goblin', 'imp', 'skeleton'] },
  { floor: 5, title: '중간보스', enemies: ['goblin', 'ogre', 'goblin'] },
  { floor: 6, enemies: ['wolf', 'wolf', 'wolf', 'imp', 'imp'] },
  { floor: 7, enemies: ['orc', 'orc', 'spirit', 'skeleton'] },
  { floor: 8, enemies: ['wolf', 'orc', 'imp', 'spirit', 'imp'] },
  { floor: 9, enemies: ['orc', 'wolf', 'goblin', 'imp', 'skeleton'] },
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
      element: m.element,
      row: m.row,
      slot,
      stats: monsterStats(m.base, floor),
      basic: m.basic,
      skills: m.skills,
      boss: m.boss,
    };
  });
}
