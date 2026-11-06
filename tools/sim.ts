// 밸런스 시뮬레이션: npm run sim [-- 판수]
// 각 층을 "그 층에 도달했을 때의 예상 레벨"로 N번 싸워서 승률/전투 길이/생존 인원을 출력합니다.
import { Battle } from '../src/battle/engine';
import { FLOORS, buildEnemies } from '../src/data/floors';
import { buildAllies, defaultParty } from '../src/data/party';

const N = Number(process.argv[2] ?? 500);

/** 층 클리어마다 1레벨 → f층 도전 시 레벨 f */
const levelFor = (floor: number) => floor;

console.log(`판수: ${N}\n`);
console.log('층  레벨  승률    평균행동  생존(승리시)  평균잔여HP%');
for (const f of FLOORS) {
  let wins = 0;
  let turns = 0;
  let survivors = 0;
  let hpPct = 0;
  for (let i = 0; i < N; i++) {
    const party = defaultParty().map((h) => ({ ...h, level: levelFor(f.floor) }));
    const b = new Battle(buildAllies(party), buildEnemies(f.floor), i * 7919 + f.floor);
    const r = b.runToEnd();
    turns += b.turn;
    if (r === 'win') {
      wins++;
      const alive = b.alive('ally');
      survivors += alive.length;
      const total = b.units.filter((u) => u.side === 'ally');
      hpPct += total.reduce((s, u) => s + u.hp, 0) / total.reduce((s, u) => s + u.stats.hp, 0);
    }
  }
  const tag = f.title ? ` (${f.title})` : '';
  console.log(
    `${String(f.floor).padStart(2)}  ${String(levelFor(f.floor)).padStart(4)}  ${(wins / N * 100).toFixed(1).padStart(5)}%  ${(turns / N).toFixed(1).padStart(8)}  ${(wins ? survivors / wins : 0).toFixed(2).padStart(11)}  ${(wins ? hpPct / wins * 100 : 0).toFixed(0).padStart(9)}%${tag}`,
  );
}
