import { defaultParty, type Hero } from './data/party';

/** 1단계 진행 상황. 2단계에서 로스터/사망 기록 등으로 확장합니다. */
export interface SaveData {
  v: 1;
  /** 배열 순서 = 진형 슬롯 순서 */
  party: Hero[];
  /** 클리어한 최고 층 (0 = 아직 없음) */
  cleared: number;
  /** 통계: 도전 횟수 / 패배 횟수 */
  attempts: number;
  defeats: number;
}

const KEY = 'hardcore-game/save/v1';

function fresh(): SaveData {
  return { v: 1, party: defaultParty(), cleared: 0, attempts: 0, defeats: 0 };
}

export const game: { data: SaveData } = { data: load() };

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as SaveData;
      if (d && d.v === 1 && Array.isArray(d.party) && d.party.length === 5) return d;
    }
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등) → 메모리에서만 진행
  }
  return fresh();
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(game.data));
  } catch {
    // 무시: 저장 실패해도 게임은 계속
  }
}

export function resetProgress(): void {
  game.data = fresh();
  save();
}
