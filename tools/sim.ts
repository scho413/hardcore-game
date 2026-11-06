// 밸런스 시뮬레이션: npm run sim [-- 판수]
// 1) 기준 파티(직업별 1명, 개체값·특성 없음)로 각 층을 "그 층의 예상 레벨"에서 N번 싸움
// 2) 무작위 영웅 파티로 같은 조건 → 랜덤 생성이 난이도를 얼마나 흔드는지 확인
import { Battle } from '../src/battle/engine';
import { Rng } from '../src/battle/rng';
import type { UnitInit } from '../src/battle/types';
import type { ClassId } from '../src/data/classes';
import { FLOORS, buildEnemies } from '../src/data/floors';
import { generateHero, heroToUnit, type Hero } from '../src/data/heroes';

const N = Number(process.argv[2] ?? 500);

/** 레벨 f에서 f층을 깨면 딱 1레벨 오르도록 경험치가 짜여 있음 → f층 도전 시 레벨 f */
const levelFor = (floor: number) => floor;

const LINEUP: ClassId[] = ['knight', 'warrior', 'priest', 'archer', 'mage'];

function baseline(level: number): UnitInit[] {
  return LINEUP.map((classId, i) => {
    const h: Hero = {
      ...generateHero(() => 0.5, `b${i}`, new Set(), { classId, now: 0 }),
      element: (['none', 'fire', 'none', 'wind', 'water'] as const)[i],
      traits: [],
      statMul: { hp: 1, atk: 1, def: 1, spd: 1 },
      level,
    };
    return heroToUnit(h, i);
  });
}

function randomParty(level: number, rng: Rng): UnitInit[] {
  // 직업은 기준 진형대로, 나머지(속성·특성·개체값)만 무작위
  return LINEUP.map((classId, i) => heroToUnit({ ...generateHero(() => rng.next(), `r${i}`, new Set(), { classId, now: 0 }), level }, i));
}

function run(label: string, party: (floor: number, i: number) => UnitInit[]): void {
  console.log(`\n[${label}] 판수 ${N}`);
  console.log('층  레벨  승률    평균행동  생존(승리시)');
  for (const f of FLOORS) {
    let wins = 0;
    let turns = 0;
    let survivors = 0;
    for (let i = 0; i < N; i++) {
      const b = new Battle(party(f.floor, i), buildEnemies(f.floor), i * 7919 + f.floor);
      if (b.runToEnd() === 'win') {
        wins++;
        survivors += b.alive('ally').length;
      }
      turns += b.turn;
    }
    const tag = f.title ? ` (${f.title})` : '';
    console.log(
      `${String(f.floor).padStart(2)}  ${String(levelFor(f.floor)).padStart(4)}  ${((wins / N) * 100).toFixed(1).padStart(5)}%  ${(turns / N).toFixed(1).padStart(8)}  ${(wins ? survivors / wins : 0).toFixed(2).padStart(11)}${tag}`,
    );
  }
}

run('기준 파티', (f) => baseline(levelFor(f)));
const rng = new Rng(12345);
run('무작위 영웅 (직업 고정)', (f) => randomParty(levelFor(f), rng));
