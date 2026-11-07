// 진형 자동 배치: 고른 진형에 맞춰 출전 가능한 영웅 중 가장 좋은 조합을 찾음.
// 적 정보를 쓰지 않음 (처음 가는 층은 적이 안 보이는 규칙과 맞추려고). 영웅 능력과 자리 궁합만 봄.
import type { Row } from '../battle/types';
import { CLASSES } from './classes';
import { FORMATIONS, type FormationId } from './formations';
import { canAfford, heroCombat, type Hero } from './heroes';

/** 영웅 전투력 (진형 효과 빼고, 지금 피로 반영) */
function power(h: Hero): number {
  const s = heroCombat(h).stats;
  return s.hp * 0.3 + s.atk * 2 + s.def * 1.5 + s.spd * 0.8 + s.crit * 200;
}

/** 앞에서 맞는 능력 (전열용) */
function bulk(h: Hero): number {
  const s = heroCombat(h).stats;
  return s.hp * 0.5 + s.def * 3;
}

/** 직업 기본 자리와 이 자리의 궁합 */
function fit(h: Hero, row: Row): number {
  const want = CLASSES[h.classId].defaultRow;
  if (want === row) return 1;
  if (want === 'mid' || row === 'mid') return 0.4; // 한 칸 차이
  return h.classId === 'warrior' && row === 'back' ? -0.6 : -1; // 앞뒤가 정반대
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  const out: T[][] = [];
  a.forEach((x, i) => {
    for (const p of permutations([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

/**
 * 진형 5칸에 넣을 영웅 id 배열 (빈칸은 null).
 * 1) 출전 가능(대기 중, 기력 충분)한 영웅을 전투력 순으로 5명 고르되, 전열 칸 수만큼 앞줄 직업과 사제 1명을 우선 챙김
 * 2) 고른 영웅을 5칸에 놓는 모든 경우(최대 120가지)를 따져 자리 궁합 + 전열의 맷집이 가장 높은 배치를 고름
 */
export function autoFormation(heroes: Hero[], formation: FormationId, cost: number, now = Date.now()): (string | null)[] {
  const rows = FORMATIONS[formation].rows;
  const ready = heroes.filter((h) => h.status === 'ready' && !h.ward && canAfford(h, cost, now)).sort((a, b) => power(b) - power(a));
  if (ready.length === 0) return [null, null, null, null, null];

  // 1) 영웅 고르기
  const picked: Hero[] = ready.slice(0, 5);
  const swapIn = (want: (h: Hero) => boolean, need: number) => {
    let have = picked.filter(want).length;
    for (const c of ready) {
      if (have >= need) break;
      if (picked.includes(c) || !want(c)) continue;
      // 바꿔 낼 사람: 조건에 안 맞는 사람 중 가장 약한 사람
      const out = [...picked].reverse().find((p) => !want(p) && !(p.classId === 'priest'));
      if (!out) break;
      picked[picked.indexOf(out)] = c;
      have++;
    }
  };
  if (picked.length === 5) {
    const fronts = rows.filter((r) => r === 'front').length;
    swapIn((h) => CLASSES[h.classId].defaultRow === 'front', fronts);
    swapIn((h) => h.classId === 'priest', 1);
  }

  // 2) 자리 정하기: 빈칸도 하나의 "사람"으로 보고 순열
  const units: (Hero | null)[] = [...picked];
  while (units.length < 5) units.push(null);
  const bulks = picked.map(bulk);
  const maxBulk = Math.max(1, ...bulks);
  let best: (Hero | null)[] = units;
  let bestScore = -Infinity;
  for (const p of permutations(units)) {
    let score = 0;
    p.forEach((h, slot) => {
      const row = rows[slot];
      if (!h) {
        // 빈칸은 전열보다 뒤쪽에 두는 편이 나음 (전열이 비면 뒷줄이 바로 맞음)
        score += row === 'front' ? -0.8 : 0;
        return;
      }
      score += fit(h, row) * 2;
      if (row === 'front') score += bulk(h) / maxBulk;
    });
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best.map((h) => h?.id ?? null);
}
