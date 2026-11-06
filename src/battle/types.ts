// 전투 로직 공용 타입. 이 폴더(src/battle)는 Phaser를 import하지 않습니다.
// → 헤드리스 시뮬레이션(tools/sim.ts)과 화면이 같은 코드를 씁니다.

export type Side = 'ally' | 'enemy';

/** 진형: 전열 2 / 중열 1 / 후열 2 (GDD 4.1). 적은 front/back만 사용 */
export type Row = 'front' | 'mid' | 'back';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** 0~1 */
  crit: number;
}

/**
 * 대상 선택 규칙
 * - front: 가장 앞 열에서 무작위 (근접)
 * - any: 아무나 무작위 (원거리)
 * - lowest: 체력이 가장 낮은 대상 (저격)
 * - all: 상대 전체 (광역)
 * - ally-lowest: 체력 비율이 가장 낮은 아군 (치유)
 * - ally-all: 아군 전체 (광역 치유)
 * - self: 자신
 */
export type Targeting = 'front' | 'any' | 'lowest' | 'all' | 'ally-lowest' | 'ally-all' | 'self';

export type Effect =
  | { kind: 'damage' }
  | { kind: 'heal' }
  /** 도발: 적의 단일 공격을 자신에게 유도 + 방어 증가 */
  | { kind: 'taunt'; turns: number }
  /** 버프: 대상 공격력 +atk (자기 턴 기준 turns번) */
  | { kind: 'buff'; atk: number; turns: number }
  /** 아무것도 안 함 (겁에 질림 등) */
  | { kind: 'none' };

/**
 * 전투 중 효과 수치. 특성·종족·진형·역할을 영웅 데이터 쪽에서 합산해 넘깁니다.
 * 가산 값은 비율 (0.15 = 15%)
 */
export interface CombatFx {
  /** 항상 적용되는 회피 확률 */
  dodge?: number;
  /** 체력 30% 이하일 때 행동을 포기할 확률 (겁쟁이) */
  cowerChance?: number;
  /** 공격이 빗나갈 확률 (서툰 손) */
  missChance?: number;
  /** 쓰러진 아군 1명당 공격력 + / 방어력 - (광전사) */
  berserkAtkPerDown?: number;
  berserkDefPerDown?: number;
  /** 체력 30% 이하일 때 공격력 + (용기, 역전의 용사) */
  lowHpAtk?: number;
  /** 체력 50% 이하일 때 공격력 + (바바리안) */
  rageAtk?: number;
  /** 받는 피해 가산 (-0.15 = 15% 덜 받음) */
  dmgTaken?: number;
  /** 광역 / 단일 공격에 받는 피해 가산 (산개 진형) */
  aoeTaken?: number;
  singleTaken?: number;
  /** 주는 치유·버프 효과 가산, 받는 치유 가산 */
  healGive?: number;
  healRecv?: number;
  /** 계열별 주는 피해 가산 (천적 +0.25, 사냥꾼 +, 트라우마 -) */
  vsFamily?: Record<string, number>;
  /** 계열별 받는 피해 가산 (트라우마 +) */
  fromFamily?: Record<string, number>;
}

export type Projectile = 'none' | 'arrow' | 'magic' | 'holy';

export interface SkillDef {
  id: string;
  name: string;
  /** 0 = 기본 공격. n = 사용 후 n번의 자기 턴 동안 사용 불가 */
  cooldown: number;
  /** 피해/치유 배율 (공격력 기준) */
  mult: number;
  /** 같은 대상을 여러 번 타격 */
  hits?: number;
  targeting: Targeting;
  effect: Effect;
  projectile: Projectile;
  /** 사용 조건: 아군 중 체력 비율이 이 값 미만인 대상이 minCount명 이상일 때 */
  healBelow?: { ratio: number; minCount: number };
  /** 화면 흔들림 등 큰 연출 */
  big?: boolean;
}

export interface UnitInit {
  id: string;
  name: string;
  side: Side;
  /** 화면/도감용 키 (직업 id 또는 몬스터 id) */
  kind: string;
  /** 화면에서 쓸 텍스처 키. 없으면 `unit-<kind>` */
  texture?: string;
  /** 전투 중 효과 (특성·종족·진형·역할 합산) */
  fx?: CombatFx;
  /** 적 계열 (data/races.ts) */
  family?: string;
  /** 투사체·마법 색 */
  fxColor?: number;
  row: Row;
  /** 같은 열 안에서의 위치 (0부터) */
  slot: number;
  stats: Stats;
  /** 우선순위 순서. 조건이 맞고 쿨다운이 끝난 첫 스킬을 사용 */
  skills: SkillDef[];
  basic: SkillDef;
  level?: number;
  boss?: 'mid' | 'main';
}

export interface Unit extends UnitInit {
  hp: number;
  /** 행동 게이지 0~GAUGE_MAX */
  gauge: number;
  /** 쓰러짐 (1단계에서는 = 전투 이탈) */
  down: boolean;
  cooldowns: Record<string, number>;
  tauntTurns: number;
  /** 공격력 버프 (축복) */
  atkBuff: { mult: number; turns: number } | null;
  /** 이 전투에서 쓰러뜨린 수 (계열별) */
  kills: Record<string, number>;
  /** 이 유닛을 쓰러뜨린 적 */
  downedBy?: { name: string; skill: string; family?: string };
  /** 이 전투 중 가장 낮았던 체력 비율 */
  lowestHp: number;
}

export interface Hit {
  targetId: string;
  amount: number;
  heal: boolean;
  crit: boolean;
  /** 천적 보너스가 붙은 타격 */
  favored: boolean;
  /** 이 타격으로 쓰러졌는지 */
  downed: boolean;
  /** 회피 (토끼 수인 등) */
  dodged?: boolean;
  /** 빗나감 (서툰 손) */
  missed?: boolean;
}

export interface ActionResult {
  actorId: string;
  skill: SkillDef;
  /** 기본 공격이 아니면 스킬 이름을 띄움 */
  isSkill: boolean;
  targetIds: string[];
  hits: Hit[];
  /** 도발·축복 등 상태 부여 */
  status?: { targetIds: string[]; label: string };
  /** 겁에 질려 행동하지 못함 */
  cowered?: boolean;
  /** 이 행동 후 전투 결과 */
  outcome: 'win' | 'lose' | null;
  /** 행동 번호 (1부터) */
  turn: number;
  enraged: boolean;
}
