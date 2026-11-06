import type { Unit } from './battle/types';
import { FLOORS } from './data/floors';
import { XP_PER_FLOOR, addLog, gainXp, injuryDuration, type Hero } from './data/heroes';
import { MONSTERS, type MonsterId } from './data/monsters';
import { FAMILIES, type Family } from './data/races';
import { TRAITS, canAddTrait, rollValue, traitName, type HeroTrait } from './data/traits';
import type { SaveData } from './state';

export interface HeroReport {
  hero: Hero;
  /** 이번 전투 결과 */
  fate: 'ok' | 'injured' | 'dead';
  levelBefore: number;
  levelAfter: number;
  /** 특성 변화 등 결과 화면에 띄울 문장 */
  notes: { text: string; tone: 'good' | 'bad' }[];
}

// ─── 전투 중 특성 획득·극복 확률 (GDD 3.5, 초안) ───
const P_TRAUMA_SELF = 0.15; // 내가 쓰러졌을 때
const P_TRAUMA_PER_ALLY = 0.08; // 동료 1명이 쓰러질 때마다
const P_COMEBACK = 0.4; // 보스 층에서 빈사(20% 이하)로 생존
const HUNTER_STEP = 30; // 같은 계열 처치 30마리마다
const P_HUNTER = 0.5;
const P_OVERCOME_COWARD = 0.25;
const P_OVERCOME_SELFISH = 0.15;
const P_OVERCOME_TRAUMA = 0.25;
const P_OVERCOME_OTHER = 0.03;

const kindName = (u: Unit) => MONSTERS[u.kind as MonsterId]?.name ?? u.name;

/**
 * 전투 결과를 저장 데이터에 반영 (GDD 3.3 쓰러짐 규칙, 3.5 특성 변화, 3.7 일대기)
 * - 승리: 쓰러진 영웅은 중상, 참여 영웅 전원 경험치
 * - 패배: 쓰러진 영웅은 전원 사망
 * 층을 클리어하면 무조건 귀환 (GDD 5.2)
 */
export function applyBattleResult(
  d: SaveData,
  floor: number,
  outcome: 'win' | 'lose',
  units: Unit[],
  rand: () => number = Math.random,
  now = Date.now(),
): HeroReport[] {
  const allies = units.filter((u) => u.side === 'ally');
  const enemies = units.filter((u) => u.side === 'enemy');
  const families = new Set(enemies.map((e) => e.family as Family));
  const def = FLOORS[floor - 1];
  const boss = enemies.find((e) => e.boss);
  const win = outcome === 'win';
  const downedAllies = allies.filter((u) => u.down);
  const reports: HeroReport[] = [];

  for (const u of allies) {
    const hero = d.heroes.find((h) => h.id === u.id);
    if (!hero) continue;
    const r: HeroReport = { hero, fate: 'ok', levelBefore: hero.level, levelAfter: hero.level, notes: [] };
    const log = (text: string, tone: 'info' | 'good' | 'bad' | 'death' = 'info') => addLog(hero, text, tone, now);

    // 기록
    if (hero.record.battles === 0) log(`${floor}층에서 첫 출전`);
    hero.record.battles++;
    const kills = Object.values(u.kills).reduce((a, b) => a + b, 0);
    hero.record.kills += kills;
    for (const [f, n] of Object.entries(u.kills)) {
      const before = hero.record.killsBy[f as Family] ?? 0;
      hero.record.killsBy[f as Family] = before + n;
      // 사냥꾼: 같은 계열을 30마리 넘게 잡을 때마다 확률
      if (Math.floor((before + n) / HUNTER_STEP) > Math.floor(before / HUNTER_STEP) && rand() < P_HUNTER) {
        gain(hero, r, { id: 'hunter', v: rollValue(rand, 'good'), family: f as Family }, `${FAMILIES[f as Family].name} ${before + n}마리 처치`);
      }
    }
    hero.bestFloor = Math.max(hero.bestFloor, floor);

    if (win) {
      hero.record.wins++;
      if (floor > hero.bestCleared) {
        hero.bestCleared = floor;
        log(boss ? `${floor}층 ${kindName(boss)} 처치` : `${floor}층 첫 돌파`, 'good');
      }
      const ups = gainXp(hero, XP_PER_FLOOR * floor);
      for (let lv = r.levelBefore + 1; lv <= hero.level; lv++) if (lv % 5 === 0) log(`레벨 ${lv} 달성`, 'good');
      void ups;

      if (u.down) {
        r.fate = 'injured';
        hero.status = 'injured';
        hero.injuredUntil = now + injuryDuration(hero);
        log(`${floor}층에서 중상 (${u.downedBy ? `${u.downedBy.name}의 ${u.downedBy.skill}` : '부상'})`, 'bad');
      }

      // ── 극복 ──
      overcome(hero, r, 'coward', !u.down && u.lowestHp <= 0.3 && rand() < P_OVERCOME_COWARD, 'courage', '빈사 속에서 끝까지 싸움');
      overcome(hero, r, 'selfish', downedAllies.some((a) => a !== u) && rand() < P_OVERCOME_SELFISH, 'devoted', '쓰러진 동료를 지켜봄');
      for (const t of [...hero.traits]) {
        if (t.id === 'trauma' && t.family && families.has(t.family) && downedAllies.length === 0 && rand() < P_OVERCOME_TRAUMA) {
          remove(hero, r, t, `${FAMILIES[t.family].name}을(를) 상대로 완승`);
        } else if (TRAITS[t.id].kind === 'bad' && TRAITS[t.id].birth && !['coward', 'selfish'].includes(t.id) && rand() < P_OVERCOME_OTHER) {
          remove(hero, r, t, '전투를 거듭하며');
        }
      }

      // ── 역전의 용사 ──
      if (def.title && !u.down && u.lowestHp <= 0.2 && rand() < P_COMEBACK) {
        gain(hero, r, { id: 'comeback', v: rollValue(rand, 'good') }, `${floor}층 보스전에서 빈사로 생존`);
      }
    } else if (u.down) {
      r.fate = 'dead';
      hero.status = 'dead';
      hero.diedFloor = floor;
      hero.diedAt = now;
      hero.diedBy = u.downedBy ? `${u.downedBy.name}의 ${u.downedBy.skill}` : undefined;
      delete hero.injuredUntil;
      log(`${floor}층에서 ${hero.diedBy ? `${hero.diedBy}에 쓰러져 ` : ''}전사`, 'death');
    }

    // ── 트라우마: 내가 쓰러지거나 동료가 쓰러지는 것을 봄 (살아남은 영웅만) ──
    if (hero.status !== 'dead') {
      const others = downedAllies.filter((a) => a !== u);
      const p = Math.min(0.4, (u.down ? P_TRAUMA_SELF : 0) + others.length * P_TRAUMA_PER_ALLY);
      const cause = u.down ? u : others[Math.floor(rand() * others.length)];
      const fam = cause?.downedBy?.family as Family | undefined;
      if (p > 0 && fam && rand() < p) {
        const why = cause === u ? `${cause.downedBy!.name}에게 쓰러짐` : `${cause.name}이(가) ${cause.downedBy!.name}에게 쓰러지는 것을 봄`;
        gain(hero, r, { id: 'trauma', v: rollValue(rand, 'bad'), family: fam }, why);
      }
      // 동료의 죽음 (시간 초과 패배 등으로 살아남은 경우)
      for (const a of allies) if (a !== u && !win && a.down) log(`동료 ${a.name}의 죽음을 지켜봄`, 'bad');
    }

    r.levelAfter = hero.level;
    reports.push(r);
  }

  if (!d.known.includes(floor)) d.known.push(floor);
  if (win) d.cleared = Math.max(d.cleared, floor);
  else d.defeats++;

  // 죽은 영웅은 진형에서 빠짐. 중상 영웅은 자리는 유지하되 회복 전까지 출전하지 않음
  d.formation = d.formation.map((id) => {
    const h = d.heroes.find((x) => x.id === id);
    return h && h.status !== 'dead' ? id : null;
  });
  return reports;

  function gain(hero: Hero, r: HeroReport, t: HeroTrait, why: string): void {
    if (!canAddTrait(hero.traits, t)) return;
    hero.traits.push(t);
    const tone = TRAITS[t.id].kind === 'bad' ? 'bad' : 'good';
    r.notes.push({ text: `${traitName(t)} 획득`, tone });
    addLog(hero, `${why} → ${traitName(t)} 획득`, tone, now);
  }

  function remove(hero: Hero, r: HeroReport, t: HeroTrait, why: string): void {
    hero.traits = hero.traits.filter((x) => x !== t);
    r.notes.push({ text: `${traitName(t)} 극복`, tone: 'good' });
    addLog(hero, `${why} → ${traitName(t)} 극복`, 'good', now);
  }

  /** 나쁜 특성을 같은 칸에서 좋은 특성으로 바꿈 (칸을 새로 쓰지 않음) */
  function overcome(hero: Hero, r: HeroReport, from: 'coward' | 'selfish', cond: boolean, to: 'courage' | 'devoted', why: string): void {
    const i = hero.traits.findIndex((t) => t.id === from);
    if (i < 0 || !cond) return;
    const old = hero.traits[i];
    hero.traits[i] = { id: to, v: old.v };
    r.notes.push({ text: `${TRAITS[from].name} 극복 → ${TRAITS[to].name}`, tone: 'good' });
    addLog(hero, `${why} → ${TRAITS[from].name}을(를) 극복하고 ${TRAITS[to].name}을(를) 얻음`, 'good', now);
  }
}
