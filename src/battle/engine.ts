import {
  BERSERKER_PER_DOWN,
  COWARD_DODGE,
  COWARD_HP_RATIO,
  IRON_SKIN_TAKEN,
} from '../data/traits';
import { Rng } from './rng';
import type {
  ActionResult,
  ElemRel,
  Element,
  Hit,
  Side,
  SkillDef,
  Unit,
  UnitInit,
} from './types';

export const GAUGE_MAX = 1000;

/** 이 행동 수를 넘기면 적이 광폭화 (전투가 끝없이 늘어지는 것 방지) */
export const ENRAGE_TURN = 90;
/** 이 행동 수를 넘기면 패배 처리 */
export const TURN_LIMIT = 200;

/** GDD 4.2 상성 배율 */
export const ELEM_ADV = 1.3;
export const ELEM_DIS = 0.7;
export const CRIT_MULT = 1.5;
/** 방어력 보정: 피해 − 방어력 × DEF_FACTOR, 최소 MIN_DAMAGE_RATIO 보장 */
export const DEF_FACTOR = 0.5;
export const MIN_DAMAGE_RATIO = 0.2;
/** 도발 중 방어력 배율 */
export const TAUNT_DEF_MULT = 1.5;

const BEATS: Record<Element, Element | null> = {
  fire: 'wind',
  wind: 'water',
  water: 'fire',
  none: null,
};

export function elementRelation(attacker: Element, defender: Element): ElemRel {
  if (BEATS[attacker] === defender) return 'adv';
  if (BEATS[defender] === attacker) return 'dis';
  return 'neutral';
}

const ROW_ORDER = ['front', 'mid', 'back'] as const;

export class Battle {
  readonly units: Unit[];
  private rng: Rng;
  turn = 0;
  outcome: 'win' | 'lose' | null = null;

  constructor(allies: UnitInit[], enemies: UnitInit[], seed: number) {
    this.rng = new Rng(seed);
    this.units = [...allies, ...enemies].map((u) => ({
      ...u,
      hp: u.stats.hp,
      // 시작 게이지를 조금 흩어서 매번 같은 순서로 시작하지 않게
      gauge: this.rng.range(0, GAUGE_MAX * 0.3),
      down: false,
      cooldowns: {},
      tauntTurns: 0,
    }));
  }

  get enraged(): boolean {
    return this.turn >= ENRAGE_TURN;
  }

  unit(id: string): Unit {
    const u = this.units.find((x) => x.id === id);
    if (!u) throw new Error(`unknown unit ${id}`);
    return u;
  }

  alive(side: Side): Unit[] {
    return this.units.filter((u) => u.side === side && !u.down);
  }

  /** 다음 행동 1회를 진행. 전투가 끝났으면 null */
  step(): ActionResult | null {
    if (this.outcome) return null;

    const actor = this.advanceGauges();
    actor.gauge -= GAUGE_MAX;
    this.turn++;

    // 자기 턴 시작 시 쿨다운/도발 감소
    for (const k of Object.keys(actor.cooldowns)) {
      if (actor.cooldowns[k] > 0) actor.cooldowns[k]--;
    }
    if (actor.tauntTurns > 0) actor.tauntTurns--;

    const skill = this.chooseSkill(actor);
    if (skill.cooldown > 0) actor.cooldowns[skill.id] = skill.cooldown;

    const targets = this.selectTargets(actor, skill);
    const hits: Hit[] = [];
    let status: ActionResult['status'];

    switch (skill.effect.kind) {
      case 'damage':
        for (const t of targets) {
          for (let i = 0; i < (skill.hits ?? 1); i++) {
            if (t.down) break;
            hits.push(this.dealDamage(actor, t, skill));
          }
        }
        break;
      case 'heal':
        for (const t of targets) hits.push(this.heal(actor, t, skill));
        break;
      case 'taunt':
        actor.tauntTurns = skill.effect.turns;
        status = { targetId: actor.id, label: '도발!' };
        break;
    }

    if (this.alive('enemy').length === 0) this.outcome = 'win';
    else if (this.alive('ally').length === 0) this.outcome = 'lose';
    else if (this.turn >= TURN_LIMIT) this.outcome = 'lose';

    return {
      actorId: actor.id,
      skill,
      isSkill: skill.cooldown > 0,
      targetIds: targets.map((t) => t.id),
      hits,
      status,
      outcome: this.outcome,
      turn: this.turn,
      enraged: this.enraged,
    };
  }

  /** 끝까지 자동 진행 (시뮬레이션용) */
  runToEnd(): 'win' | 'lose' {
    while (!this.outcome) this.step();
    return this.outcome as 'win' | 'lose';
  }

  /** 속도 기반 게이지: 누군가 가득 찰 때까지 시간을 흘림 */
  private advanceGauges(): Unit {
    const living = this.units.filter((u) => !u.down);
    let ticks = Infinity;
    for (const u of living) {
      ticks = Math.min(ticks, Math.max(0, (GAUGE_MAX - u.gauge) / u.stats.spd));
    }
    for (const u of living) u.gauge += u.stats.spd * ticks;

    // 가득 찬 유닛 중 게이지가 가장 높은 쪽, 동률이면 빠른 쪽
    let best = living[0];
    for (const u of living) {
      if (u.gauge > best.gauge + 1e-6 || (Math.abs(u.gauge - best.gauge) < 1e-6 && u.stats.spd > best.stats.spd)) {
        best = u;
      }
    }
    return best;
  }

  private chooseSkill(actor: Unit): SkillDef {
    for (const s of actor.skills) {
      if ((actor.cooldowns[s.id] ?? 0) > 0) continue;
      if (s.healBelow) {
        const hurt = this.alive(actor.side).filter((u) => u.hp / u.stats.hp < s.healBelow!.ratio);
        if (hurt.length < s.healBelow.minCount) continue;
      }
      return s;
    }
    return actor.basic;
  }

  private selectTargets(actor: Unit, skill: SkillDef): Unit[] {
    const foeSide: Side = actor.side === 'ally' ? 'enemy' : 'ally';
    const foes = this.alive(foeSide);
    const friends = this.alive(actor.side);

    switch (skill.targeting) {
      case 'self':
        return [actor];
      case 'all':
        return foes;
      case 'ally-all':
        return friends;
      case 'ally-lowest':
        return [minBy(friends, (u) => u.hp / u.stats.hp)];
    }

    // 단일 대상: 도발이 최우선
    const taunters = foes.filter((u) => u.tauntTurns > 0);
    if (taunters.length > 0) return [this.rng.pick(taunters)];

    switch (skill.targeting) {
      case 'lowest':
        return [minBy(foes, (u) => u.hp)];
      case 'any':
        return [this.rng.pick(foes)];
      case 'front':
      default: {
        for (const row of ROW_ORDER) {
          const inRow = foes.filter((u) => u.row === row);
          if (inRow.length > 0) return [this.rng.pick(inRow)];
        }
        return [this.rng.pick(foes)];
      }
    }
  }

  private dealDamage(actor: Unit, target: Unit, skill: SkillDef): Hit {
    const elem = elementRelation(actor.element, target.element);
    const has = (u: Unit, t: string) => u.traits?.includes(t) ?? false;

    // 겁쟁이: 빈사 상태에서 회피
    if (has(target, 'coward') && target.hp / target.stats.hp <= COWARD_HP_RATIO && this.rng.next() < COWARD_DODGE) {
      return { targetId: target.id, amount: 0, heal: false, crit: false, elem, downed: false, dodged: true };
    }
    // 광전사: 쓰러진 아군 수만큼 공격력 증가
    const fallenFriends = this.units.filter((u) => u.side === actor.side && u.down).length;
    const berserk = has(actor, 'berserker') ? 1 + BERSERKER_PER_DOWN * fallenFriends : 1;
    const elemMult = elem === 'adv' ? ELEM_ADV : elem === 'dis' ? ELEM_DIS : 1;
    const enrageMult = actor.side === 'enemy' && this.enraged ? 1.6 : 1;

    // GDD 4.2: 공격력 × 스킬 배율 × 상성 배율 − 방어력 보정
    const raw = actor.stats.atk * berserk * skill.mult * elemMult * enrageMult;
    const def = target.stats.def * (target.tauntTurns > 0 ? TAUNT_DEF_MULT : 1);
    let dmg = Math.max(raw * MIN_DAMAGE_RATIO, raw - def * DEF_FACTOR);
    dmg *= this.rng.range(0.9, 1.1);

    const crit = this.rng.next() < actor.stats.crit;
    if (crit) dmg *= CRIT_MULT;
    if (has(target, 'ironSkin')) dmg *= IRON_SKIN_TAKEN;

    const amount = Math.max(1, Math.round(dmg));
    target.hp = Math.max(0, target.hp - amount);
    const downed = target.hp === 0;
    if (downed) {
      target.down = true;
      target.gauge = 0;
      target.tauntTurns = 0;
    }
    return { targetId: target.id, amount, heal: false, crit, elem, downed };
  }

  private heal(actor: Unit, target: Unit, skill: SkillDef): Hit {
    const amount = Math.round(actor.stats.atk * skill.mult * this.rng.range(0.95, 1.05));
    const before = target.hp;
    target.hp = Math.min(target.stats.hp, target.hp + amount);
    return { targetId: target.id, amount: target.hp - before, heal: true, crit: false, elem: 'neutral', downed: false };
  }
}

function minBy<T>(arr: T[], f: (x: T) => number): T {
  let best = arr[0];
  let bv = f(best);
  for (const x of arr) {
    const v = f(x);
    if (v < bv) {
      best = x;
      bv = v;
    }
  }
  return best;
}
