import type { Unit } from './battle/types';
import { CHEST_CHANCE, DUNGEONS, DUNGEON_TRAIT_CHANCE, RARE_MULT, rollDrops, towerReward, type DungeonId } from './data/dungeons';
import { FLOORS, THEMES, zoneOf } from './data/floors';
import { FATIGUE_DUNGEON, FATIGUE_TOWER, addFatigue, addLog, gainXp, injuryDuration, towerXp, type Hero } from './data/heroes';
import { DUR_DUNGEON, DUR_LOSS, DUR_TOWER, TOWER_WEAPON_LOSS, addMats, weaponName, type Materials } from './data/items';
import { MONSTERS, type MonsterId } from './data/monsters';
import { FAMILIES, type Family } from './data/races';
import { TRAITS, canAddTrait, rollValue, traitName, type HeroTrait } from './data/traits';
import type { SaveData } from './state';
import { dungeonGold, towerGold } from './data/base';
import { TIER_NAME, legacyText, makeLegacy } from './data/legacy';
import { TUT_DONE } from './tutorial/steps';

export interface HeroReport {
  hero: Hero;
  /** 이번 전투 결과 */
  fate: 'ok' | 'injured' | 'dead';
  levelBefore: number;
  levelAfter: number;
  /** 얻은 경험치 */
  xp: number;
  /** 특성 변화 등 결과 화면에 띄울 문장 */
  notes: { text: string; tone: 'good' | 'bad' }[];
}

export interface BattleResult {
  reports: HeroReport[];
  /** 얻은 재료 */
  rewards: Materials;
  /** 결과 화면에 띄울 소식 (첫 클리어, 보물 상자 등) */
  events: string[];
  gold: number;
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
): BattleResult {
  const allies = units.filter((u) => u.side === 'ally');
  const firstClear = outcome === 'win' && floor > d.cleared;
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
    const r: HeroReport = { hero, fate: 'ok', levelBefore: hero.level, levelAfter: hero.level, xp: 0, notes: [] };
    const log = (text: string, tone: 'info' | 'good' | 'bad' | 'death' = 'info') => addLog(hero, text, tone, now);

    // 기록
    if (hero.record.battles === 0) log(`${floor}층에서 첫 출전`);
    recordBattle(hero, u, r, rand, now);
    addFatigue(hero, FATIGUE_TOWER, now);
    hero.bestFloor = Math.max(hero.bestFloor, floor);

    if (win) {
      hero.record.wins++;
      if (firstClear) hero.record.pioneer = (hero.record.pioneer ?? 0) + 1;
      if (def.title) hero.record.bosses = (hero.record.bosses ?? 0) + 1;
      if (floor > hero.bestCleared) {
        hero.bestCleared = floor;
        log(boss ? `${floor}층 ${kindName(boss)} 처치` : `${floor}층 첫 돌파`, 'good');
      }
      r.xp = towerXp(floor, hero.level, firstClear);
      gainXp(hero, r.xp);
      for (let lv = r.levelBefore + 1; lv <= hero.level; lv++) if (lv % 5 === 0) log(`레벨 ${lv} 달성`, 'good');

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
    } else if (u.down && d.tutorial < TUT_DONE) {
      // 튜토리얼 첫 전투는 지더라도 죽지 않음 (중상)
      r.fate = 'injured';
      hero.status = 'injured';
      hero.injuredUntil = now + injuryDuration(hero);
      log(`${floor}층에서 중상 (튜토리얼)`, 'bad');
    } else if (u.down) {
      r.fate = 'dead';
      hero.status = 'dead';
      hero.diedFloor = floor;
      hero.diedAt = now;
      hero.diedBy = u.downedBy ? `${u.downedBy.name}의 ${u.downedBy.skill}` : undefined;
      delete hero.injuredUntil;
      log(`${floor}층에서 ${hero.diedBy ? `${hero.diedBy}에 쓰러져 ` : ''}전사`, 'death');
      // 무기는 영웅과 운명을 같이함 (GDD 7.3). 기록용으로 hero.weapon은 남겨둠
      if (hero.weapon) {
        r.notes.push({ text: `${weaponName(hero.weapon)} 소실`, tone: 'bad' });
        d.lostWeapons++;
      }
      // 유산 (GDD 3.8): 한 만큼 남기고 감
      hero.legacy = makeLegacy(hero);
      if (hero.legacy.tier > 0) {
        r.notes.unshift({ text: `${TIER_NAME[hero.legacy.tier]}을(를) 남김 · 유산 ${hero.legacy.items.length}`, tone: 'good' });
        log(`기여도 ${hero.legacy.score} · 기지에 ${TIER_NAME[hero.legacy.tier]}이(가) 세워짐`, 'info');
        for (const it of hero.legacy.items) {
          log(`유산: ${legacyText(it)}`, 'good');
          if (it.kind === 'disciple') d.disciples = [...(d.disciples ?? []), { cls: it.cls!, trait: it.trait!, from: hero.name }];
        }
      }
    }

    // ── 무기 내구도 (GDD 7.4): 탑 -10, 쓰러지거나 패배하면 -10 더. 탑에서 쓰러지면 무기를 잃을 수도 ──
    if (hero.status !== 'dead' && hero.weapon) {
      const hurt = u.down || !win;
      if (hurt && rand() < TOWER_WEAPON_LOSS) {
        r.notes.push({ text: `${weaponName(hero.weapon)} 부서짐`, tone: 'bad' });
        log(`${floor}층에서 ${weaponName(hero.weapon)}을(를) 잃음`, 'bad');
        hero.weapon = undefined;
        d.lostWeapons++;
      } else wear(hero, r, DUR_TOWER + (hurt ? DUR_LOSS : 0));
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

  recordCodex(d, units);
  if (!d.known.includes(floor)) d.known.push(floor);
  if (win) d.cleared = Math.max(d.cleared, floor);
  else d.defeats++;

  const rewards: Materials = win ? towerReward(floor, firstClear, rand) : {};
  addMats(d.materials, rewards);

  // 죽은 영웅은 진형에서 빠짐. 중상 영웅은 자리는 유지하되 회복 전까지 출전하지 않음
  d.formation = d.formation.map((id) => {
    const h = d.heroes.find((x) => x.id === id);
    return h && h.status !== 'dead' ? id : null;
  });
  const gold = win ? towerGold(floor, firstClear) : 0;
  d.gold += gold;
  return { reports, rewards, events: [], gold };

  function gain(hero: Hero, r: HeroReport, t: HeroTrait, why: string): void {
    gainTrait(hero, r, t, why, now);
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

/** 내구도 감소. 0이 되면 알림 */
function wear(hero: Hero, r: HeroReport, n: number): void {
  const w = hero.weapon;
  if (!w || w.dur <= 0) return;
  w.dur = Math.max(0, w.dur - n);
  if (w.dur === 0) r.notes.push({ text: `${weaponName(w)} 내구도 0 · 수리 필요`, tone: 'bad' });
}

/** 도감: 만난 몬스터와 쓰러뜨린 수 (소환된 적 포함) */
function recordCodex(d: SaveData, units: Unit[]): void {
  const seen = new Set(d.seen ?? []);
  const kills = { ...(d.monsterKills ?? {}) };
  for (const u of units) {
    if (u.side !== 'enemy') continue;
    seen.add(u.kind);
    if (u.down) kills[u.kind] = (kills[u.kind] ?? 0) + 1;
  }
  d.seen = [...seen];
  d.monsterKills = kills;
}

/** 구간(10층 단위)의 테마를 아는지: 그 구간에 도전했거나, 소문을 들었거나, 테스트 모드 */
export function zoneKnown(d: SaveData, zone: number): boolean {
  if (zone === 0 || d.test) return true;
  if (d.cleared >= zone * 10 + 1) return true;
  if (d.known.some((f) => zoneOf(f) === zone)) return true;
  return (d.rumors ?? []).includes(zone);
}

function gainTrait(hero: Hero, r: HeroReport, t: HeroTrait, why: string, now: number): void {
  if (!canAddTrait(hero.traits, t)) return;
  hero.traits.push(t);
  const tone = TRAITS[t.id].kind === 'bad' ? 'bad' : 'good';
  r.notes.push({ text: `${traitName(t)} 획득`, tone });
  addLog(hero, `${why} → ${traitName(t)} 획득`, tone, now);
}

/** 출전·처치 기록과 사냥꾼 특성 (탑·던전 공용) */
function recordBattle(hero: Hero, u: Unit, r: HeroReport, rand: () => number, now: number): void {
  hero.record.battles++;
  const kills = Object.values(u.kills).reduce((a, b) => a + b, 0);
  hero.record.kills += kills;
  for (const [f, n] of Object.entries(u.kills)) {
    const before = hero.record.killsBy[f as Family] ?? 0;
    hero.record.killsBy[f as Family] = before + n;
    // 사냥꾼: 같은 계열을 30마리 넘게 잡을 때마다 확률
    if (Math.floor((before + n) / HUNTER_STEP) > Math.floor(before / HUNTER_STEP) && rand() < P_HUNTER) {
      gainTrait(hero, r, { id: 'hunter', v: rollValue(rand, 'good'), family: f as Family }, `${FAMILIES[f as Family].name} ${before + n}마리 처치`, now);
    }
  }
}

/**
 * 던전 결과 (GDD 6): 사망 없음. 쓰러진 영웅은 승패와 관계없이 중상.
 * 승리하면 재료(첫 클리어 2배, 희귀 몬스터 3배, 보물 상자)와 경험치(탑의 절반). 출전 영웅 기력 -3
 */
export function applyDungeonResult(
  d: SaveData,
  dungeon: DungeonId,
  floor: number,
  outcome: 'win' | 'lose',
  units: Unit[],
  opts: { rare?: boolean } = {},
  rand: () => number = Math.random,
  now = Date.now(),
): BattleResult {
  const dg = DUNGEONS[dungeon];
  const win = outcome === 'win';
  const prog = d.dungeons[dungeon];
  const firstClear = win && floor > prog.best;
  const reports: HeroReport[] = [];
  const allies = units.filter((x) => x.side === 'ally');
  const heroes = allies.map((u) => d.heroes.find((h) => h.id === u.id)).filter((h): h is Hero => !!h);
  const partyLv = heroes.reduce((a, h) => a + h.level, 0) / Math.max(1, heroes.length);

  for (const u of allies) {
    const hero = d.heroes.find((h) => h.id === u.id);
    if (!hero) continue;
    const r: HeroReport = { hero, fate: 'ok', levelBefore: hero.level, levelAfter: hero.level, xp: 0, notes: [] };
    if (hero.record.battles === 0) addLog(hero, `${dg.name}에서 첫 출전`, 'info', now);
    recordBattle(hero, u, r, rand, now);
    addFatigue(hero, FATIGUE_DUNGEON, now);
    if (win) {
      hero.record.wins++;
      if (floor === 10) hero.record.bosses = (hero.record.bosses ?? 0) + 1;
      // 경험치 없음. 대신 던전마다 정해진 특성을 확률로 얻음
      if (rand() < DUNGEON_TRAIT_CHANCE) {
        const pool = dg.traits;
        const id = pool[Math.floor(rand() * pool.length)];
        gainTrait(hero, r, { id, v: rollValue(rand, TRAITS[id].kind) }, `${dg.name}에서 단련`, now);
      }
      if (firstClear && floor === 10) addLog(hero, `${dg.name} 10층 ${MONSTERS[dg.boss].name} 처치`, 'good', now);
    }
    if (u.down) {
      r.fate = 'injured';
      hero.status = 'injured';
      hero.injuredUntil = now + injuryDuration(hero);
      addLog(hero, `${dg.name} ${floor}층에서 중상 (${u.downedBy ? `${u.downedBy.name}의 ${u.downedBy.skill}` : '부상'})`, 'bad', now);
      // 트라우마 (탑과 같은 확률)
      const fam = u.downedBy?.family as Family | undefined;
      if (fam && rand() < P_TRAUMA_SELF) gainTrait(hero, r, { id: 'trauma', v: rollValue(rand, 'bad'), family: fam }, `${u.downedBy!.name}에게 쓰러짐`, now);
    }
    wear(hero, r, DUR_DUNGEON + (u.down || !win ? DUR_LOSS : 0));
    r.levelAfter = hero.level;
    reports.push(r);
  }

  recordCodex(d, units);
  const events: string[] = [];
  let rewards: Materials = {};
  if (win) {
    rewards = rollDrops(dungeon, floor, rand, (opts.rare ? RARE_MULT : 1) * (firstClear ? 2 : 1));
    if (opts.rare) events.push(`희귀 몬스터 처치! 재료 ×${RARE_MULT}`);
    if (firstClear) events.push(`${floor}층 첫 클리어! 재료 ×2`);
    if (rand() < CHEST_CHANCE) {
      addMats(rewards, rollDrops(dungeon, floor, rand));
      events.push('보물 상자 발견!');
    }
    // 던전 보스 첫 처치: 아직 모르는 다음 탑 구간의 소문
    if (firstClear && floor === 10) {
      const z = THEMES.findIndex((_, i) => !zoneKnown(d, i));
      if (z > 0) {
        d.rumors = [...(d.rumors ?? []), z];
        events.push(`소문: 탑 ${z * 10 + 1}~${z * 10 + 10}층에는 '${THEMES[z].name}'이(가) 있다`);
      }
    }
    prog.best = Math.max(prog.best, floor);
    const prev = prog.clearLv[floor];
    prog.clearLv[floor] = prev === undefined ? partyLv : Math.min(prev, partyLv);
  }
  addMats(d.materials, rewards);
  const gold = win ? dungeonGold(floor) : 0;
  d.gold += gold;
  return { reports, rewards, events, gold };
}
