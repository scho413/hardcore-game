import type { ClassId } from './data/classes';
import type { FormationId } from './data/formations';
import { ROSTER_MAX, canAfford, generateHero, heroLookKey, tickRecovery, type Hero } from './data/heroes';
import type { Materials, Weapon } from './data/items';
import { DUNGEON_IDS, type DungeonId } from './data/dungeons';

/** 던전 진행: 최고 층, 층별 클리어 당시 파티 평균 레벨(가장 낮은 기록) */
export interface DungeonProgress {
  best: number;
  clearLv: Record<number, number>;
}

/** 저장 데이터. v7: 무기 6등급·내구도, 기력 10, 던전 1~10층 */
export interface SaveData {
  v: 7;
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
}

const KEY = 'hardcore-game/save/v7';

function fresh(): SaveData {
  const d: SaveData = {
    v: 7,
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
  };
  // 시작 로스터: 직업별 1명씩 + 무작위 3명
  const start: (ClassId | undefined)[] = ['knight', 'warrior', 'priest', 'archer', 'mage', undefined, undefined, undefined];
  for (const c of start) recruit(d, c);
  d.formation = d.heroes.slice(0, 5).map((h) => h.id);
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
      if (d && d.v === 7 && Array.isArray(d.heroes) && Array.isArray(d.formation)) return d;
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

/** 새 영웅 모집. 로스터가 가득 차면 null */
export function recruit(d: SaveData = game.data, classId?: ClassId): Hero | null {
  if (living(d).length >= ROSTER_MAX) return null;
  const ctx = { names: new Set(d.heroes.map((h) => h.name)), looks: new Set(d.heroes.map(heroLookKey)) };
  const h = generateHero(Math.random, `h${d.nextId++}`, ctx, { classId });
  d.heroes.push(h);
  return h;
}

/**
 * 중상 회복 처리 + 진형에서 출전 불가 영웅 빼기.
 * 화면을 그리기 전에 호출. 바뀐 게 있으면 저장.
 */
export function refresh(now = Date.now()): void {
  const d = game.data;
  let changed = tickRecovery(d.heroes, now);
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
