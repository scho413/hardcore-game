// GDD 6장 던전: 재료 파밍. 영구 사망·중상 없음, 피로만 쌓임
import type { UnitInit } from '../battle/types';
import { matId, type MatKind, type Materials, type Tier } from './items';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';

export type DungeonId = 'mine' | 'forest' | 'cave';

export interface DungeonLevel {
  name: string;
  /** 적 강함 기준 층 (탑 층과 같은 강화식) */
  power: number;
  enemies: MonsterId[];
  /** 승리 시 재료 [단계, 최소, 최대] */
  drops: [Tier, number, number][];
}

export interface DungeonDef {
  id: DungeonId;
  name: string;
  mat: MatKind;
  desc: string;
  levels: DungeonLevel[];
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  mine: {
    id: 'mine', name: '버려진 광산', mat: 'metal', desc: '광부들이 떠난 갱도. 금속 광석이 남아 있다',
    levels: [
      { name: '얕은 곳', power: 2, enemies: ['slime', 'slime', 'spider'], drops: [[1, 3, 5]] },
      { name: '중간', power: 5, enemies: ['slime', 'troll', 'spider', 'spider'], drops: [[1, 2, 3], [2, 2, 3]] },
      { name: '깊은 곳', power: 8, enemies: ['troll', 'troll', 'slime', 'spider'], drops: [[2, 2, 3], [3, 1, 2]] },
    ],
  },
  forest: {
    id: 'forest', name: '어두운 숲', mat: 'wood', desc: '야수 수인들의 사냥터. 단단한 나무가 자란다',
    levels: [
      { name: '얕은 곳', power: 2, enemies: ['wolfkin', 'wolfkin', 'hyena'], drops: [[1, 3, 5]] },
      { name: '중간', power: 5, enemies: ['gnoll', 'wolfkin', 'hyena', 'hyena'], drops: [[1, 2, 3], [2, 2, 3]] },
      { name: '깊은 곳', power: 8, enemies: ['gnoll', 'wolfkin', 'wolfkin', 'wolfkin', 'hyena'], drops: [[2, 2, 3], [3, 1, 2]] },
    ],
  },
  cave: {
    id: 'cave', name: '마석 동굴', mat: 'crystal', desc: '마력이 고인 동굴. 악마와 망자가 모여든다',
    levels: [
      { name: '얕은 곳', power: 2, enemies: ['ghoul', 'imp', 'imp'], drops: [[1, 3, 5]] },
      { name: '중간', power: 5, enemies: ['ghoul', 'ghoul', 'naga', 'imp'], drops: [[1, 2, 3], [2, 2, 3]] },
      { name: '깊은 곳', power: 8, enemies: ['ghoul', 'naga', 'succubus', 'imp', 'imp'], drops: [[2, 2, 3], [3, 1, 2]] },
    ],
  },
};

export const DUNGEON_IDS = Object.keys(DUNGEONS) as DungeonId[];

/** 던전 경험치 = 탑의 절반 */
export const DUNGEON_XP_RATE = 0.5;

export function buildDungeonEnemies(id: DungeonId, level: number): UnitInit[] {
  const lv = DUNGEONS[id].levels[level];
  const slots = { front: 0, back: 0 };
  return lv.enemies.map((mid, i) => {
    const m = MONSTERS[mid];
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
      stats: monsterStats(m.base, lv.power),
      basic: m.basic,
      skills: m.skills,
    };
  });
}

export function rollDrops(id: DungeonId, level: number, rand: () => number): Materials {
  const d = DUNGEONS[id];
  const out: Materials = {};
  for (const [tier, lo, hi] of d.levels[level].drops) {
    const n = lo + Math.floor(rand() * (hi - lo + 1));
    const k = matId(d.mat, tier);
    out[k] = (out[k] ?? 0) + n;
  }
  return out;
}

// ─── 탑 보상 (GDD 5.2): 첫 클리어 / 재도전(절반) ───
export function towerReward(floor: number, first: boolean, rand: () => number): Materials {
  const tier: Tier = floor >= 8 ? 2 : 1;
  const kinds: MatKind[] = ['metal', 'wood', 'crystal'];
  const out: Materials = {};
  const base = first ? 2 + Math.ceil(floor / 2) : 1 + Math.floor(floor / 4);
  for (let i = 0; i < base; i++) {
    const k = matId(kinds[Math.floor(rand() * 3)], tier);
    out[k] = (out[k] ?? 0) + 1;
  }
  if (first && floor % 5 === 0) {
    // 보스 층 첫 클리어: 상위 재료
    const k = matId(kinds[Math.floor(rand() * 3)], floor === 10 ? 3 : 2);
    out[k] = (out[k] ?? 0) + 2;
  }
  return out;
}
