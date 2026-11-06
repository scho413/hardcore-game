import type { UnitInit } from '../battle/types';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';

export interface FloorDef {
  floor: number;
  /** 이름이 붙은 층 (보스 층) */
  title?: string;
  enemies: MonsterId[];
}

// GDD 5.1.1: 10층마다 테마. 1~10층 = 고블린 소굴 (녹색족 → 인간이 천적)
export const THEMES = [{ from: 1, to: 10, name: '고블린 소굴' }];

export const FLOORS: FloorDef[] = [
  { floor: 1, enemies: ['goblin', 'goblin', 'goblin'] },
  { floor: 2, enemies: ['goblin', 'goblin', 'goblin_archer'] },
  { floor: 3, enemies: ['goblin', 'hobgoblin', 'goblin_archer', 'goblin_archer'] },
  { floor: 4, enemies: ['goblin', 'wolf_rider', 'hobgoblin', 'goblin_shaman', 'goblin_archer'] },
  { floor: 5, title: '중간보스', enemies: ['goblin', 'goblin_chief', 'goblin'] },
  { floor: 6, enemies: ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_shaman', 'goblin_bomber'] },
  { floor: 7, enemies: ['wolf_rider', 'hobgoblin', 'wolf_rider', 'goblin_archer'] },
  { floor: 8, enemies: ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_bomber', 'goblin_shaman'] },
  { floor: 9, enemies: ['hobgoblin', 'wolf_rider', 'hobgoblin', 'goblin_bomber', 'goblin'] },
  { floor: 10, title: '메인보스', enemies: ['hobgoblin', 'goblin_king', 'goblin'] },
];

export function themeOf(floor: number): string {
  return THEMES.find((t) => floor >= t.from && floor <= t.to)?.name ?? '';
}

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
