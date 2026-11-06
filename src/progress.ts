import type { Unit } from './battle/types';
import { XP_PER_FLOOR, gainXp, injuryDuration, type Hero } from './data/heroes';
import type { SaveData } from './state';

export interface HeroReport {
  hero: Hero;
  /** 이번 전투 결과 */
  fate: 'ok' | 'injured' | 'dead';
  levelBefore: number;
  levelAfter: number;
}

/**
 * 전투 결과를 저장 데이터에 반영 (GDD 3.3 쓰러짐 규칙)
 * - 승리: 쓰러진 영웅은 중상, 참여 영웅 전원 경험치
 * - 패배: 쓰러진 영웅은 전원 사망. 살아남은 영웅(시간 초과 패배)은 무사, 경험치 없음
 * 층을 클리어하면 무조건 귀환 (GDD 5.2)
 */
export function applyBattleResult(d: SaveData, floor: number, outcome: 'win' | 'lose', allies: Unit[], now = Date.now()): HeroReport[] {
  const reports: HeroReport[] = [];
  for (const u of allies) {
    const hero = d.heroes.find((h) => h.id === u.id);
    if (!hero) continue;
    const levelBefore = hero.level;
    hero.bestFloor = Math.max(hero.bestFloor, floor);
    let fate: HeroReport['fate'] = 'ok';

    if (outcome === 'win') {
      gainXp(hero, XP_PER_FLOOR * floor);
      if (u.down) {
        fate = 'injured';
        hero.status = 'injured';
        hero.injuredUntil = now + injuryDuration(hero);
      }
    } else if (u.down) {
      fate = 'dead';
      hero.status = 'dead';
      hero.diedFloor = floor;
      hero.diedAt = now;
      delete hero.injuredUntil;
    }
    reports.push({ hero, fate, levelBefore, levelAfter: hero.level });
  }

  if (outcome === 'win') d.cleared = Math.max(d.cleared, floor);
  else d.defeats++;

  // 죽은 영웅은 진형에서 빠짐. 중상 영웅은 자리는 유지하되 회복 전까지 출전하지 않음
  d.formation = d.formation.map((id) => {
    const h = d.heroes.find((x) => x.id === id);
    return h && h.status !== 'dead' ? id : null;
  });
  return reports;
}
