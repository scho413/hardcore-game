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
 * - back: 가장 뒤 열에서 무작위, 도발 무시 (암살)
 */
export type Targeting = 'front' | 'any' | 'lowest' | 'all' | 'ally-lowest' | 'ally-all' | 'self' | 'back';

export type Effect =
  | { kind: 'damage' }
  | { kind: 'heal' }
  /** 도발: 적의 단일 공격을 자신에게 유도 + 방어 증가 */
  | { kind: 'taunt'; turns: number }
  /** 버프: 대상 공격력 +atk (자기 턴 기준 turns번) */
  | { kind: 'buff'; atk: number; turns: number }
  /** 소환: 같은 편에 몬스터 count마리 (열마다 살아있는 3마리까지) */
  | { kind: 'summon'; monster: string; count: number }
  /** 아무것도 안 함 (겁에 질림 등) */
  | { kind: 'none' };

/** 상태 이상 (GDD 5.1.1 구간별 전투 규칙) */
export interface Inflict {
  /** 독: 매 자기 턴 시작에 최대 체력의 pct 피해 */
  poison?: { pct: number; turns: number };
  /** 둔화: 속도 -pct */
  slow?: { pct: number; turns: number };
  /** 기절: chance 확률로 turns번 행동 불가 */
  stun?: { chance: number; turns: number };
}

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
  /** 독 저항 (1 이상이면 면역, 해독제) */
  poisonResist?: number;
  // ── 무기 특수 능력 (전설 이상) ──
  /** 불굴: 전투당 1번, 쓰러질 피해를 받으면 이 체력 비율로 버팀 */
  lastStand?: number;
  /** 흡혈: 준 피해의 비율만큼 회복 */
  lifesteal?: number;
  /** 급소: 치명타 피해 가산 */
  critDmg?: number;
  /** 연쇄: 단일 공격 후 이 확률로 다른 적 1명에게 60% 피해 */
  chain?: number;
  /** 기적: 전투당 1번, 쓰러진 아군을 이 체력 비율로 일으킴 */
  miracle?: number;
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
  /** 맞힌 대상에게 상태 이상 */
  inflict?: Inflict;
  /** 방어력 무시 비율 */
  pierce?: number;
}

/** 보스 단계: 체력이 below 비율 아래로 내려가면 스킬이 바뀜 */
export interface PhaseDef {
  below: number;
  name: string;
  skills: SkillDef[];
  basic?: SkillDef;
  /** 공격력 배율 */
  atkMult?: number;
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
  /** 희귀 몬스터 (황금 변종) */
  rare?: boolean;
  /** 보스 단계 (체력 높은 쪽부터) */
  phases?: PhaseDef[];
  /** 소환된 유닛 */
  summoned?: boolean;
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
  /** 전투당 1번 쓰는 능력 사용 여부 (불굴, 기적) */
  used: Record<string, boolean>;
  /** 걸린 상태 이상 */
  poison: { dmg: number; turns: number; from: string; family?: string } | null;
  slow: { pct: number; turns: number } | null;
  stun: number;
  /** 지나간 보스 단계 수 */
  phase: number;
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
  /** 쓰러질 뻔했지만 버팀/일어남 (불굴, 기적) */
  saved?: string;
  /** 새로 건 상태 이상 ('독', '둔화', '기절') */
  inflicted?: string[];
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
  /** 턴 시작 독 피해 (행동한 유닛에게) */
  poisonTick?: Hit;
  /** 기절해서 행동 못 함 */
  stunned?: boolean;
  /** 새로 소환된 유닛 id */
  summoned?: string[];
  /** 보스 단계 전환 (이름) */
  phase?: { unitId: string; name: string };
}
