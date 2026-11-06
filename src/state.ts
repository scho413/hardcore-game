import type { ClassId } from './data/classes';
import type { FormationId } from './data/formations';
import { canAfford, gainXp, generateHero, heroLookKey, setRecoveryScale, tickRecovery, type Hero } from './data/heroes';
import {
  AD_SPEEDUP_MS,
  BUILD_MS,
  DORM_CAP,
  FACILITY_IDS,
  RECRUIT_ADS,
  RECRUIT_FREE,
  START_GOLD,
  TRAINING_MAX_MS,
  buildCost,
  hospitalSpeed,
  recruitOdds,
  trainingXpPerHour,
  type FacilityId,
  type PotionId,
} from './data/base';
import { hasMats, spendMats, type MaterialId, type Materials, type Weapon } from './data/items';
import { DUNGEON_IDS, type DungeonId } from './data/dungeons';

/** 던전 진행: 최고 층, 층별 클리어 당시 파티 평균 레벨(가장 낮은 기록) */
export interface DungeonProgress {
  best: number;
  clearLv: Record<number, number>;
}

/** 건설 중 (GDD 9) */
export interface Build {
  id: FacilityId;
  /** 완료되면 이 레벨 */
  to: number;
  start: number;
  end: number;
}

/** 튜토리얼: 0 탑 1층 → 1 모집소 건설 → 2 영웅 모집 → 3 끝 */
export type TutorialStep = 0 | 1 | 2 | 3;

/** 저장 데이터. v8: 골드, 기지 시설·건설, 모집소, 영웅 등급, 튜토리얼, 테스트 모드 */
export interface SaveData {
  v: 8;
  /** 살아있는 영웅 + 죽은 영웅 (status로 구분). 죽은 영웅은 추모의 벽에 표시 */
  heroes: Hero[];
  /** 진형 슬롯 5칸의 영웅 id (빈칸 = null) */
  formation: (string | null)[];
  /** 진형 종류 (GDD 4.1.1) */
  formationType: FormationId;
  /** 클리어한 최고 층 */
  cleared: number;
  /** 한 번이라도 도전한 층 (정찰 정보 공개) */
  known: number[];
  attempts: number;
  defeats: number;
  nextId: number;
  /** 보유 재료 */
  materials: Materials;
  /** 장착하지 않은 무기 */
  stash: Weapon[];
  /** 영웅이 죽으면서 잃은 무기 수 */
  lostWeapons: number;
  dungeons: Record<DungeonId, DungeonProgress>;
  gold: number;
  /** 시설 레벨 (0 = 짓지 않음) */
  facilities: Record<FacilityId, number>;
  builds: Build[];
  /** 광고로 얻은 임시 건설 자리 (다음 건설 1번) */
  bonusSlot: boolean;
  /** 모집소 하루 횟수 */
  recruitDay: string;
  recruitFree: number;
  recruitAds: number;
  potions: Partial<Record<PotionId, number>>;
  /** 다음 전투에 쓸 영약 */
  elixirs: { might?: boolean; guard?: boolean };
  tutorial: TutorialStep;
  /** 테스트 모드: 모든 층 바로 도전·정찰, 즉시 건설, 자원 지급 */
  test: boolean;
}

const KEY = 'hardcore-game/save/v8';

function fresh(): SaveData {
  const d: SaveData = {
    v: 8,
    heroes: [],
    formation: [null, null, null, null, null],
    formationType: 'basic',
    cleared: 0,
    known: [],
    attempts: 0,
    defeats: 0,
    nextId: 1,
    // 시작 재료: 바로 대장간을 써볼 수 있게
    materials: { metal1: 12, wood1: 10, crystal1: 8 },
    stash: [],
    lostWeapons: 0,
    dungeons: Object.fromEntries(DUNGEON_IDS.map((id) => [id, { best: 0, clearLv: {} }])) as Record<DungeonId, DungeonProgress>,
    gold: START_GOLD,
    // 처음엔 숙소만 (GDD 9)
    facilities: Object.fromEntries(FACILITY_IDS.map((id) => [id, id === 'dorm' ? 1 : 0])) as Record<FacilityId, number>,
    builds: [],
    bonusSlot: false,
    recruitDay: '',
    recruitFree: 0,
    recruitAds: 0,
    potions: {},
    elixirs: {},
    tutorial: 0,
    test: false,
  };
  // 시작 영웅: 무작위 2명 (튜토리얼에서 1명 더 모집)
  for (let i = 0; i < 2; i++) recruit(d);
  d.formation = [d.heroes[0].id, d.heroes[1].id, null, null, null];
  return d;
}

export const game: { data: SaveData } = { data: load() };
// 처음 시작이면 만들어진 영웅을 바로 저장 (새로고침해도 같은 영웅)
save();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as SaveData;
      if (d && d.v === 8 && Array.isArray(d.heroes) && Array.isArray(d.formation)) return d;
    }
  } catch {
    // 저장소를 쓸 수 없는 환경 → 메모리에서만 진행
  }
  return fresh();
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(game.data));
  } catch {
    // 저장 실패해도 게임은 계속
  }
}

export function resetProgress(): void {
  game.data = fresh();
  save();
}

export function living(d: SaveData = game.data): Hero[] {
  return d.heroes.filter((h) => h.status !== 'dead');
}

export function fallen(d: SaveData = game.data): Hero[] {
  return d.heroes.filter((h) => h.status === 'dead').sort((a, b) => (b.diedAt ?? 0) - (a.diedAt ?? 0));
}

export function heroById(id: string | null, d: SaveData = game.data): Hero | undefined {
  return id ? d.heroes.find((h) => h.id === id) : undefined;
}

export function rosterCap(d: SaveData = game.data): number {
  return DORM_CAP[Math.max(1, d.facilities.dorm) - 1];
}

/** 모집소 레벨 확률로 등급 추첨 */
export function rollHeroGrade(lv: number, rand: () => number = Math.random): number {
  const odds = recruitOdds(Math.max(1, lv));
  let r = rand() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i;
  }
  return 0;
}

/** 새 영웅 모집 (등급은 모집소 레벨 확률). 로스터가 가득 차면 null */
export function recruit(d: SaveData = game.data, classId?: ClassId): Hero | null {
  if (living(d).length >= rosterCap(d)) return null;
  const ctx = { names: new Set(d.heroes.map((h) => h.name)), looks: new Set(d.heroes.map(heroLookKey)) };
  const grade = rollHeroGrade(d.facilities?.recruit ?? 1);
  const h = generateHero(Math.random, `h${d.nextId++}`, ctx, { classId, grade });
  d.heroes.push(h);
  // 진형 빈칸에 자동 배치
  const empty = d.formation.indexOf(null);
  if (empty >= 0 && h) d.formation[empty] = h.id;
  return h;
}

// ─── 모집소 하루 횟수 (GDD 8) ───
function today(now = Date.now()): string {
  const t = new Date(now);
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
}

export function recruitLeft(d: SaveData = game.data, now = Date.now()): { free: number; ads: number } {
  if (d.recruitDay !== today(now)) return { free: RECRUIT_FREE, ads: RECRUIT_ADS };
  return { free: RECRUIT_FREE - d.recruitFree, ads: RECRUIT_ADS - d.recruitAds };
}

/** 모집 1회 (무료 또는 광고). 튜토리얼 모집은 항상 무료 */
export function recruitDaily(kind: 'free' | 'ad', d: SaveData = game.data, now = Date.now()): Hero | null {
  if (d.recruitDay !== today(now)) {
    d.recruitDay = today(now);
    d.recruitFree = 0;
    d.recruitAds = 0;
  }
  const left = recruitLeft(d, now);
  if (!d.test && d.tutorial !== 2 && (kind === 'free' ? left.free : left.ads) <= 0) return null;
  const h = recruit(d);
  if (!h) return null;
  if (d.tutorial === 2) d.tutorial = 3;
  else if (kind === 'free') d.recruitFree++;
  else d.recruitAds++;
  return h;
}

// ─── 시설 건설 (GDD 9) ───
export function buildSlots(d: SaveData = game.data): number {
  return 1 + (d.bonusSlot ? 1 : 0);
}

export function canAffordBuild(id: FacilityId, d: SaveData = game.data): boolean {
  const c = buildCost(id, d.facilities[id] + 1);
  return d.gold >= c.gold && hasMats(d.materials, Object.entries(c.mats).map(([k, n]) => ({ id: k as MaterialId, n: n! })));
}

/** 건설 시작. free = 튜토리얼 (비용·시간 없음) */
export function startBuild(id: FacilityId, d: SaveData = game.data, now = Date.now(), free = false): boolean {
  if (d.builds.some((b) => b.id === id)) return false;
  if (!free && d.builds.length >= buildSlots(d)) return false;
  const to = d.facilities[id] + 1;
  if (!free) {
    if (!canAffordBuild(id, d)) return false;
    const c = buildCost(id, to);
    d.gold -= c.gold;
    spendMats(d.materials, Object.entries(c.mats).map(([k, n]) => ({ id: k as MaterialId, n: n! })));
    if (d.builds.length >= 1) d.bonusSlot = false;
  }
  const ms = free || d.test ? 0 : BUILD_MS[to - 1];
  d.builds.push({ id, to, start: now, end: now + ms });
  finishBuilds(d, now);
  return true;
}

export function speedUpBuild(id: FacilityId, d: SaveData = game.data, now = Date.now(), ms = AD_SPEEDUP_MS): void {
  const b = d.builds.find((x) => x.id === id);
  if (b) b.end = Math.max(now, b.end - ms);
  finishBuilds(d, now);
}

function finishBuilds(d: SaveData, now: number): boolean {
  const done = d.builds.filter((b) => b.end <= now);
  for (const b of done) d.facilities[b.id] = Math.max(d.facilities[b.id], b.to);
  d.builds = d.builds.filter((b) => b.end > now);
  return done.length > 0;
}

// ─── 훈련장 (GDD 9) ───
/** 맡긴 영웅에게 시간당 경험치. 최대 8시간, 레벨 상한 = 최고 클리어 층 (최소 1) */
function tickTraining(d: SaveData, now: number): boolean {
  let changed = false;
  const rate = trainingXpPerHour(d.facilities.training);
  const cap = Math.max(1, d.cleared);
  for (const h of d.heroes) {
    if (h.status !== 'training' || h.trainSince === undefined) continue;
    const from = h.trainAt ?? h.trainSince;
    const to = Math.min(now, h.trainSince + TRAINING_MAX_MS);
    if (to <= from) continue;
    const xp = Math.floor(((to - from) / 3600000) * rate);
    if (xp <= 0) continue;
    h.trainAt = from + (xp / rate) * 3600000;
    if (h.level < cap) {
      gainXp(h, xp);
      if (h.level >= cap) {
        h.level = cap;
        h.xp = 0;
      }
    }
    changed = true;
  }
  return changed;
}

export function startTraining(h: Hero, now = Date.now()): void {
  h.status = 'training';
  h.trainSince = now;
  h.trainAt = now;
  game.data.formation = game.data.formation.map((id) => (id === h.id ? null : id));
}

export function stopTraining(h: Hero, now = Date.now()): void {
  tickTraining(game.data, now);
  h.status = 'ready';
  delete h.trainSince;
  delete h.trainAt;
}

/**
 * 중상 회복 처리 + 진형에서 출전 불가 영웅 빼기.
 * 화면을 그리기 전에 호출. 바뀐 게 있으면 저장.
 */
export function refresh(now = Date.now()): void {
  const d = game.data;
  setRecoveryScale(hospitalSpeed(d.facilities.hospital));
  let changed = tickRecovery(d.heroes, now);
  if (finishBuilds(d, now)) changed = true;
  if (tickTraining(d, now)) changed = true;
  d.formation = d.formation.map((id) => {
    const h = heroById(id, d);
    if (id && (!h || h.status === 'dead')) {
      changed = true;
      return null;
    }
    return id;
  });
  if (changed) save();
}

/**
 * 진형에 있고 출전 가능한 영웅 (슬롯 번호 포함).
 * cost: 출전 기력 비용 (탑 5, 던전 3). 기력이 모자라면 빠짐 (GDD 3.2.1)
 */
export function readyFormation(cost = 0, d: SaveData = game.data, now = Date.now()): { hero: Hero; slot: number }[] {
  const out: { hero: Hero; slot: number }[] = [];
  d.formation.forEach((id, slot) => {
    const h = heroById(id, d);
    if (h && h.status === 'ready' && canAfford(h, cost, now)) out.push({ hero: h, slot });
  });
  return out;
}

export function newId(prefix: string, d: SaveData = game.data): string {
  return `${prefix}${d.nextId++}`;
}

/** 파티 평균 레벨 (소탕 조건) */
export function avgLevel(heroes: Hero[]): number {
  return heroes.length ? heroes.reduce((a, h) => a + h.level, 0) / heroes.length : 0;
}
