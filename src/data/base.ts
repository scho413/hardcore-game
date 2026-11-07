// GDD 9장 기지: 시설, 건설·업그레이드(골드 + 재료, 대기 시간), 모집소 등급 확률, 연금소, 골드 보상
import { matId, type MatKind, type Materials, type Tier } from './items';

export type FacilityId = 'dorm' | 'hospital' | 'training' | 'recruit' | 'smithy' | 'alchemy';
export const FACILITY_IDS: FacilityId[] = ['dorm', 'recruit', 'smithy', 'hospital', 'training', 'alchemy'];
export const FACILITY_MAX = 10;

export interface FacilityDef {
  id: FacilityId;
  name: string;
  desc: string;
  /** 업그레이드 재료 계열 (Lv3부터) */
  mat: MatKind;
  /** 짓기 위해 필요한 탑 클리어 층 (0 = 처음부터) */
  unlock: number;
  /** 레벨별 효과 한 줄 */
  effect: (lv: number) => string;
}

// ─── 레벨별 수치 ───
/** 숙소: 영웅 최대 인원 */
export const DORM_CAP = [5, 6, 7, 8, 10, 11, 12, 14, 16, 20];
/** 병원: 회복 속도 배율 (중상·기력). 짓지 않으면 1 */
export const hospitalSpeed = (lv: number) => (lv <= 0 ? 1 : 1 + 0.12 * lv);
/** 훈련장: 자리 수, 시간당 경험치, 최대 누적 시간 */
export const trainingSlots = (lv: number) => (lv <= 0 ? 0 : 1 + Math.floor(lv / 3));
/** 병원 침대 수 (입원한 영웅만 빨리 회복) */
export const hospitalSlots = (lv: number) => (lv <= 0 ? 0 : 1 + Math.floor(lv / 3));
export const trainingXpPerHour = (lv: number) => (lv <= 0 ? 0 : Math.round(40 * Math.pow(1.25, lv - 1)));
export const TRAINING_MAX_MS = 8 * 60 * 60 * 1000;
/** 대장간: 레벨별 최고 제작 난이도 (DIFFICULTIES 인덱스) */
export const SMITHY_MAX_DIFF = [1, 2, 2, 3, 3, 4, 4, 5, 5, 5];
/** 연금소: 레벨별 해금 물약 수 */
export const ALCHEMY_UNLOCK = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];

/** 모집소 레벨별 등급 확률 % (일반, 고급, 상급, 전설, 신화, 초월). 레벨 0 = 튜토리얼 전 */
export const RECRUIT_ODDS: number[][] = [
  [70, 25, 5, 0, 0, 0],
  [62, 28, 9, 1, 0, 0],
  [55, 30, 12, 2.5, 0.5, 0],
  [48, 32, 15, 4, 1, 0],
  [42, 32, 18, 6, 1.8, 0.2],
  [36, 32, 21, 8, 2.6, 0.4],
  [30, 32, 24, 10, 3.4, 0.6],
  [25, 31, 26, 13, 4.2, 0.8],
  [20, 30, 28, 16, 5, 1],
  [15, 28, 30, 19, 6.5, 1.5],
];
export const recruitOdds = (lv: number) => RECRUIT_ODDS[Math.max(0, Math.min(FACILITY_MAX, lv) - 1)];
/** 하루 무료 1명 + 광고 2명 */
export const RECRUIT_FREE = 1;
export const RECRUIT_ADS = 2;

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  dorm: { id: 'dorm', name: '숙소', desc: '영웅들이 지내는 곳', mat: 'wood', unlock: 0, effect: (lv) => `영웅 최대 ${DORM_CAP[lv - 1]}명` },
  recruit: { id: 'recruit', name: '모집소', desc: '하루 1명 무료, 광고로 2명 더', mat: 'wood', unlock: 1, effect: (lv) => `상급 이상 ${Math.round(recruitOdds(lv).slice(2).reduce((a, b) => a + b, 0))}%` },
  smithy: { id: 'smithy', name: '대장간', desc: '직업 전용 무기 제작·수리', mat: 'metal', unlock: 3, effect: (lv) => `제작 난이도 ${['쉬움', '보통', '어려움', '전설', '신화', '초월'][SMITHY_MAX_DIFF[lv - 1]]}까지` },
  hospital: { id: 'hospital', name: '병원', desc: '입원시킨 영웅의 중상·기력 회복을 빠르게 (입원 중엔 출전 불가)', mat: 'crystal', unlock: 4, effect: (lv) => `침대 ${hospitalSlots(lv)}개 · 회복 속도 ×${hospitalSpeed(lv).toFixed(2)}` },
  training: { id: 'training', name: '훈련장', desc: '맡겨둔 영웅이 시간마다 경험치를 얻음 (최대 8시간)', mat: 'metal', unlock: 6, effect: (lv) => `${trainingSlots(lv)}자리 · 시간당 경험치 ${trainingXpPerHour(lv)}` },
  alchemy: { id: 'alchemy', name: '연금소', desc: '물약·영약 제조', mat: 'crystal', unlock: 8, effect: (lv) => `물약 ${ALCHEMY_UNLOCK[lv - 1]}종` },
};

/** 레벨 lv로 올리는 시간 (Lv1 = 처음 짓기). Lv1·2 즉시, Lv3 30초 → Lv10 24시간 */
export const BUILD_MS = [0, 0, 0.5, 2, 10, 30, 90, 240, 600, 1440].map((m) => m * 60 * 1000);
/** 광고 1번에 줄어드는 시간 */
export const AD_SPEEDUP_MS = 30 * 60 * 1000;

/** 레벨 lv로 올리는 비용: 골드 + Lv3부터 시설 계열 재료 */
export function buildCost(id: FacilityId, lv: number): { gold: number; mats: Materials } {
  const gold = Math.round(100 * Math.pow(1.8, lv - 1) / 10) * 10;
  const mats: Materials = {};
  if (lv >= 3) {
    const tier: Tier = lv <= 5 ? 1 : lv <= 8 ? 2 : 3;
    mats[matId(FACILITIES[id].mat, tier)] = 2 + lv;
  }
  return { gold, mats };
}

// ─── 골드 (GDD 11) ───
export const START_GOLD = 300;
/** 탑 층 클리어: 첫 클리어 60 × 층, 재도전 25 × 층 */
export const towerGold = (floor: number, first: boolean) => (first ? 60 : 25) * floor;
/** 던전 승리: 10 × 층 */
export const dungeonGold = (floor: number) => 10 * floor;
/** 무기 분해: 골드 */
export const dismantleGold = (grade: number, tier: number) => 20 * (grade + 1) * tier;

// ─── 연금소 ───
export type PotionId = 'stamina' | 'cure' | 'might' | 'guard' | 'antidote';
export const POTIONS: Record<PotionId, { name: string; desc: string; gold: number; mats: Materials }> = {
  stamina: { name: '기력 물약', desc: '영웅 1명 기력 +3 (영웅 상세에서 사용)', gold: 60, mats: { crystal1: 1 } },
  cure: { name: '치료 물약', desc: '중상 영웅 1명 즉시 회복 (영웅 상세에서 사용)', gold: 120, mats: { crystal1: 2, wood1: 1 } },
  might: { name: '힘의 영약', desc: '다음 전투 파티 전원 공격력 +10%', gold: 150, mats: { crystal2: 1, metal1: 1 } },
  guard: { name: '수호의 영약', desc: '다음 전투 파티 전원 방어력 +15%', gold: 150, mats: { crystal2: 1, wood1: 1 } },
  antidote: { name: '해독제', desc: '다음 전투 파티 전원 독 면역', gold: 120, mats: { wood2: 1, crystal1: 1 } },
};
export const POTION_ORDER: PotionId[] = ['stamina', 'cure', 'might', 'guard', 'antidote'];
