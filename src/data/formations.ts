// GDD 4.1.1 진형. 슬롯 5칸이 어느 열에 서는지와 열별 효과.
import type { CombatFx, Row } from '../battle/types';

export type FormationId = 'basic' | 'shieldwall' | 'wedge' | 'spread' | 'assault';

export interface RowEffect {
  atk?: number;
  def?: number;
  spd?: number;
  fx?: CombatFx;
}

export interface FormationDef {
  id: FormationId;
  name: string;
  desc: string;
  /** 슬롯 0~4가 서는 열 */
  rows: Row[];
  /** 열별 효과. all은 모든 열 */
  effects: Partial<Record<Row | 'all', RowEffect>>;
}

export const FORMATIONS: Record<FormationId, FormationDef> = {
  basic: { id: 'basic', name: '기본', desc: '전열 2 · 중열 1 · 후열 2. 효과 없음', rows: ['front', 'front', 'mid', 'back', 'back'], effects: {} },
  shieldwall: {
    id: 'shieldwall', name: '방패벽', desc: '전열 3 · 후열 2. 전열 방어력 +10%, 후열 속도 -5%',
    rows: ['front', 'front', 'front', 'back', 'back'],
    effects: { front: { def: 0.1 }, back: { spd: -0.05 } },
  },
  wedge: {
    id: 'wedge', name: '쐐기', desc: '전열 1 · 중열 2 · 후열 2. 전열 1명 방어력 +20%',
    rows: ['front', 'mid', 'mid', 'back', 'back'],
    effects: { front: { def: 0.2 } },
  },
  spread: {
    id: 'spread', name: '산개', desc: '전열 2 · 후열 3. 광역 피해 -15%, 단일 피해 +10%',
    rows: ['front', 'front', 'back', 'back', 'back'],
    effects: { all: { fx: { aoeTaken: -0.15, singleTaken: 0.1 } } },
  },
  assault: {
    id: 'assault', name: '돌격', desc: '전열 3 · 중열 1 · 후열 1. 전열 공격력 +10%, 받는 피해 +10%',
    rows: ['front', 'front', 'front', 'mid', 'back'],
    effects: { front: { atk: 0.1, fx: { dmgTaken: 0.1 } } },
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

/** 슬롯 번호 → 열과 열 안의 순번 */
export function slotPosition(f: FormationId, slot: number): { row: Row; index: number; count: number } {
  const rows = FORMATIONS[f].rows;
  const row = rows[slot];
  return { row, index: rows.slice(0, slot).filter((r) => r === row).length, count: rows.filter((r) => r === row).length };
}
