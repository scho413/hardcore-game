// GDD 6장 던전: 재료 파밍. 던전마다 1~10층 + 10층 보스. 사망 없음(쓰러지면 중상), 기력 -3
import type { UnitInit } from '../battle/types';
import { matId, type MatKind, type Materials, type Tier } from './items';
import { MONSTERS, monsterStats, type MonsterId } from './monsters';
import type { TraitId } from './traits';

export type DungeonId = 'mine' | 'forest' | 'cave';

export const DUNGEON_FLOORS = 10;

export interface DungeonDef {
  id: DungeonId;
  name: string;
  mat: MatKind;
  desc: string;
  /** 약한 적 / 강한 적 / 10층 보스 */
  weak: MonsterId[];
  strong: MonsterId[];
  boss: MonsterId;
  /** 1~9층 적 수, 그중 강한 적 수 */
  sizes: number[];
  strongs: number[];
  /** 10층 보스전 적 강함 */
  bossPower: number;
  /** 승리 시 확률로 얻는 특성 (경험치 대신) */
  traits: TraitId[];
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  mine: {
    id: 'mine', name: '버려진 광산', mat: 'metal', desc: '광부들이 떠난 갱도. 금속 광석이 남아 있다',
    weak: ['slime', 'spider'], strong: ['troll'], boss: 'ogre',
    sizes: [3, 3, 4, 4, 4, 4, 5, 4, 4], strongs: [0, 0, 0, 1, 1, 1, 1, 2, 2], bossPower: 8.5,
    traits: ['sturdy', 'tough', 'ironSkin', 'slow'],
  },
  forest: {
    id: 'forest', name: '어두운 숲', mat: 'wood', desc: '야수 수인들의 사냥터. 단단한 나무가 자란다',
    weak: ['wolfkin', 'hyena'], strong: ['gnoll'], boss: 'gnoll_chief',
    sizes: [3, 3, 4, 4, 4, 4, 4, 4, 4], strongs: [0, 0, 0, 1, 1, 1, 1, 2, 3], bossPower: 7.5,
    traits: ['swift', 'keen', 'reckless', 'clumsy'],
  },
  cave: {
    id: 'cave', name: '마석 동굴', mat: 'crystal', desc: '마력이 고인 동굴. 악마와 망자가 모여든다',
    weak: ['imp', 'ghoul'], strong: ['naga', 'succubus'], boss: 'lich',
    sizes: [3, 3, 4, 4, 4, 4, 5, 5, 5], strongs: [0, 0, 0, 1, 1, 1, 1, 1, 1], bossPower: 7.5,
    traits: ['strong', 'fastRecovery', 'berserker', 'frail'],
  },
};

export const DUNGEON_IDS = Object.keys(DUNGEONS) as DungeonId[];

/** 던전은 경험치 없음. 승리 시 영웅마다 이 확률로 던전 특성 하나 */
export const DUNGEON_TRAIT_CHANCE = 0.06;
/** 희귀 몬스터 등장 확률, 등장 시 재료 배수 */
export const RARE_CHANCE = 0.05;
export const RARE_MULT = 3;
/** 승리 시 보물 상자 확률 (재료 한 번 더) */
export const CHEST_CHANCE = 0.1;

/** 적 강함 기준 층 (탑 층과 같은 강화식) */
export function dungeonPower(id: DungeonId, floor: number): number {
  return floor >= DUNGEON_FLOORS ? DUNGEONS[id].bossPower : floor;
}

/** 층별 적 구성 (고정이라 다시 도전하면 같은 적) */
export function dungeonLineup(id: DungeonId, floor: number): MonsterId[] {
  const d = DUNGEONS[id];
  if (floor >= DUNGEON_FLOORS) return [d.boss, d.weak[0], d.weak[1 % d.weak.length]];
  const n = d.sizes[floor - 1];
  const strong = d.strongs[floor - 1];
  const out: MonsterId[] = [];
  for (let i = 0; i < strong; i++) out.push(d.strong[(floor + i) % d.strong.length]);
  for (let i = 0; out.length < n; i++) out.push(d.weak[(floor + i) % d.weak.length]);
  return out;
}

export function buildDungeonEnemies(id: DungeonId, floor: number, rare = false): UnitInit[] {
  const power = dungeonPower(id, floor);
  const slots = { front: 0, back: 0 };
  const ids = dungeonLineup(id, floor);
  // 희귀 몬스터: 약한 적 하나가 황금 변종 (체력 1.5배)
  const rareIdx = rare ? ids.findIndex((m) => DUNGEONS[id].weak.includes(m)) : -1;
  return ids.map((mid, i) => {
    const m = MONSTERS[mid];
    const slot = slots[m.row]++;
    const stats = monsterStats(m.base, power);
    const golden = i === rareIdx;
    if (golden) stats.hp = Math.round(stats.hp * 1.5);
    return {
      id: `e${i}`,
      name: golden ? `황금 ${m.name}` : m.name,
      side: 'enemy',
      kind: m.id,
      family: m.family,
      fxColor: golden ? 0xffd25a : m.fx,
      row: m.row,
      slot,
      stats,
      basic: m.basic,
      skills: m.skills,
      boss: m.boss,
      rare: golden || undefined,
    };
  });
}

/** 층별 재료 [단계, 최소, 최대] */
export function dungeonDrops(floor: number): [Tier, number, number][] {
  if (floor <= 3) return [[1, 3, 5]];
  if (floor <= 6) return [[1, 2, 3], [2, 1, 3]];
  if (floor <= 9) return [[2, 2, 3], [3, 1, 2]];
  return [[2, 2, 3], [3, 2, 4]];
}

export function rollDrops(id: DungeonId, floor: number, rand: () => number, mult = 1): Materials {
  const d = DUNGEONS[id];
  const out: Materials = {};
  for (const [tier, lo, hi] of dungeonDrops(floor)) {
    const n = (lo + Math.floor(rand() * (hi - lo + 1))) * mult;
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
