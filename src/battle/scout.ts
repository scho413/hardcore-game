import { Battle } from './engine';
import type { UnitInit } from './types';

export type Risk = { label: string; color: string; winRate: number };

/**
 * 정찰: 현재 파티·진형으로 몇십 번 가상 전투를 돌려 위험도를 매깁니다 (GDD 5.2).
 * 승률 숫자는 보여주지 않고 등급만 보여줍니다.
 */
export function scoutRisk(allies: UnitInit[], enemies: UnitInit[], samples = 120): Risk {
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    if (new Battle(allies, enemies, 1000 + i * 104729).runToEnd() === 'win') wins++;
  }
  const winRate = wins / samples;
  if (winRate >= 0.97) return { label: '낮음', color: '#7fe08a', winRate };
  if (winRate >= 0.85) return { label: '보통', color: '#e8c25a', winRate };
  if (winRate >= 0.6) return { label: '높음', color: '#ff9a4a', winRate };
  return { label: '매우 높음', color: '#ff5a4a', winRate };
}
