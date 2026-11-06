// 밸런스 시뮬레이션: npm run sim [-- 판수]
// 1) 최저선: 직업별 1명, 전원 인간, 개체값·특성 없음 (실제보다 약함)으로 각 층을 "그 층의 예상 레벨"에서 N번 싸움
// 2) 무작위 영웅(종족·특성·개체값 무작위, 직업만 고정)으로 같은 조건 → 랜덤 생성이 난이도를 얼마나 흔드는지 확인
import { Battle } from '../src/battle/engine';
import { Rng } from '../src/battle/rng';
import type { UnitInit } from '../src/battle/types';
import type { ClassId } from '../src/data/classes';
import { FLOORS, buildEnemies, summonerFor } from '../src/data/floors';
import { generateHero, heroToUnit, type Hero } from '../src/data/heroes';
import { makeWeapon } from '../src/data/items';

const N = Number(process.argv[2] ?? 500);
const ctx = () => ({ names: new Set<string>(), looks: new Set<string>() });

/** 기준: f층 도전 시 레벨 f (첫 클리어만으로는 조금 모자라고, 클리어한 층 반복으로 맞춤) */
const levelFor = (floor: number) => floor;

const LINEUP: ClassId[] = ['knight', 'warrior', 'priest', 'archer', 'mage'];

function baseline(level: number, floor: number): UnitInit[] {
  return LINEUP.map((classId, i) => {
    const h: Hero = {
      ...generateHero(() => 0.5, `b${i}`, ctx(), { classId, race: 'human', now: 0 }),
      traits: [],
      statMul: { hp: 1, atk: 1, def: 1, spd: 1 },
      level,
    };
    return heroToUnit(h, i, { formation: 'basic', floor });
  });
}

function randomParty(level: number, floor: number, rng: Rng): UnitInit[] {
  // 직업은 기준 진형대로, 나머지(종족·특성·개체값)만 무작위
  return LINEUP.map((classId, i) => heroToUnit({ ...generateHero(() => rng.next(), `r${i}`, ctx(), { classId, now: 0 }), level }, i, { formation: 'basic', floor }));
}

function run(label: string, party: (floor: number, i: number) => UnitInit[]): void {
  console.log(`\n[${label}] 판수 ${N}`);
  console.log('층  레벨  승률    평균행동  생존(승리시)');
  for (const f of FLOORS) {
    let wins = 0;
    let turns = 0;
    let survivors = 0;
    for (let i = 0; i < N; i++) {
      const b = new Battle(party(f.floor, i), buildEnemies(f.floor), i * 7919 + f.floor, summonerFor(f.floor));
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

run('최저선 (전원 인간, 특성 없음)', (f) => baseline(levelFor(f), f));
if (process.argv.includes('--weapons')) {
  // 구간별 무기 (11~20 고급, 21~30 상급, 31~40 전설, 41~50 신화)
  const wr = new Rng(777);
  const gradeFor = (f: number) => [0, 1, 2, 3, 4][Math.min(4, Math.floor((f - 1) / 10))];
  run('무작위 영웅 + 구간별 무기', (f) =>
    LINEUP.map((classId, i) => {
      const h = generateHero(() => wr.next(), `w${i}`, ctx(), { classId, now: 0 });
      const weapon = f > 10 ? makeWeapon('w', classId, 3, gradeFor(f), () => wr.next(), 0) : undefined;
      return heroToUnit({ ...h, level: levelFor(f), weapon }, i, { formation: 'basic', floor: f, now: 0 });
    }),
  );
}
const rng = new Rng(12345);
run('무작위 영웅 (직업 고정)', (f) => randomParty(levelFor(f), f, rng));

// 3) 던전 (GDD 6): 던전 n층 = 탑 n층 수준 적. 레벨 = 층
import { DUNGEONS, DUNGEON_FLOORS, DUNGEON_IDS, buildDungeonEnemies, dungeonLineup } from '../src/data/dungeons';
console.log(`\n[던전 · 무작위 영웅, 레벨 = 층] 판수 ${N}`);
for (const id of DUNGEON_IDS) {
  const row: string[] = [];
  for (let f = 1; f <= DUNGEON_FLOORS; f++) {
    let wins = 0;
    const r2 = new Rng(999 + f);
    for (let i = 0; i < N; i++) {
      const b = new Battle(randomParty(f, f, r2), buildDungeonEnemies(id, f), i * 104729 + f);
      if (b.runToEnd() === 'win') wins++;
    }
    row.push(`${f}:${Math.round((wins / N) * 100)}%`);
  }
  console.log(`${DUNGEONS[id].name}  ${row.join(' ')}`);
  if (process.argv.includes('--lineup')) for (let f = 1; f <= DUNGEON_FLOORS; f++) console.log(`  ${f}층 ${dungeonLineup(id, f).join(', ')}`);
}
