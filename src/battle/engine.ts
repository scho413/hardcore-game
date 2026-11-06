import { Rng } from './rng';
import type { ActionResult, CombatFx, Hit, Side, SkillDef, Unit, UnitInit } from './types';

/** 소환 유닛 만들기 (몬스터 데이터는 battle 밖에 있으므로 주입) */
export type Summoner = (kind: string, id: string, row: 'front' | 'back', slot: number) => UnitInit | null;

export const GAUGE_MAX = 1000;

/** 이 행동 수를 넘기면 적이 광폭화 (전투가 끝없이 늘어지는 것 방지) */
export const ENRAGE_TURN = 90;
/** 이 행동 수를 넘기면 패배 처리 */
export const TURN_LIMIT = 200;

export const CRIT_MULT = 1.5;
/** 방어력 보정: 피해 − 방어력 × DEF_FACTOR, 최소 MIN_DAMAGE_RATIO 보장 */
export const DEF_FACTOR = 0.5;
export const MIN_DAMAGE_RATIO = 0.2;
/** 도발 중 방어력 배율 */
export const TAUNT_DEF_MULT = 1.5;
/** 빈사 기준 (겁쟁이, 용기, 역전의 용사) */
export const LOW_HP = 0.3;
/** 바바리안 분노 기준 */
export const RAGE_HP = 0.5;

const ROW_ORDER = ['front', 'mid', 'back'] as const;

const COWER: SkillDef = { id: 'cower', name: '겁에 질림', cooldown: 0, mult: 0, targeting: 'self', effect: { kind: 'none' }, projectile: 'none' };
const STUNNED: SkillDef = { id: 'stunned', name: '기절', cooldown: 0, mult: 0, targeting: 'self', effect: { kind: 'none' }, projectile: 'none' };
const POISONED: SkillDef = { id: 'poisoned', name: '독', cooldown: 0, mult: 0, targeting: 'self', effect: { kind: 'none' }, projectile: 'none' };

export class Battle {
  readonly units: Unit[];
  private rng: Rng;
  turn = 0;
  outcome: 'win' | 'lose' | null = null;
  private summoner: Summoner | null;
  private summonCount = 0;
  private phaseEvent: ActionResult['phase'];

  constructor(allies: UnitInit[], enemies: UnitInit[], seed: number, summoner: Summoner | null = null) {
    this.rng = new Rng(seed);
    this.summoner = summoner;
    this.units = [...allies, ...enemies].map((u) => this.makeUnit(u));
  }

  private makeUnit(u: UnitInit): Unit {
    return {
      ...u,
      hp: u.stats.hp,
      // 시작 게이지를 조금 흩어서 매번 같은 순서로 시작하지 않게
      gauge: this.rng.range(0, GAUGE_MAX * 0.3),
      down: false,
      cooldowns: {},
      tauntTurns: 0,
      atkBuff: null,
      kills: {},
      lowestHp: 1,
      used: {},
      poison: null,
      slow: null,
      stun: 0,
      phase: 0,
      skills: [...u.skills],
    };
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

    // 자기 턴 시작: 쿨다운·도발·버프 감소
    for (const k of Object.keys(actor.cooldowns)) {
      if (actor.cooldowns[k] > 0) actor.cooldowns[k]--;
    }
    if (actor.tauntTurns > 0) actor.tauntTurns--;
    if (actor.atkBuff && --actor.atkBuff.turns <= 0) actor.atkBuff = null;
    if (actor.slow && --actor.slow.turns <= 0) actor.slow = null;
    this.phaseEvent = undefined;

    // 독: 자기 턴 시작에 피해. 쓰러지면 행동 없음
    let poisonTick: Hit | undefined;
    if (actor.poison) {
      const p = actor.poison;
      const amount = Math.min(actor.hp, p.dmg);
      actor.hp -= amount;
      let saved: string | undefined;
      if (actor.hp === 0) saved = this.trySave(actor);
      actor.lowestHp = Math.min(actor.lowestHp, actor.hp / actor.stats.hp);
      const downed = actor.hp === 0;
      if (downed) {
        actor.down = true;
        actor.gauge = 0;
        actor.tauntTurns = 0;
        actor.atkBuff = null;
        actor.downedBy = { name: p.from, skill: '독', family: p.family };
      }
      poisonTick = { targetId: actor.id, amount, heal: false, crit: false, favored: false, downed, saved };
      if (--p.turns <= 0 || downed) actor.poison = null;
      if (downed) {
        actor.stun = 0;
        this.checkOutcome();
        return { actorId: actor.id, skill: POISONED, isSkill: false, targetIds: [], hits: [], outcome: this.outcome, turn: this.turn, enraged: this.enraged, poisonTick };
      }
    }

    // 기절: 행동 불가
    if (actor.stun > 0) {
      actor.stun--;
      this.checkOutcome();
      return { actorId: actor.id, skill: STUNNED, isSkill: false, targetIds: [], hits: [], outcome: this.outcome, turn: this.turn, enraged: this.enraged, poisonTick, stunned: true };
    }

    // 겁쟁이: 빈사 상태에서 행동 포기
    const fx = actor.fx ?? {};
    const cowered = !!fx.cowerChance && actor.hp / actor.stats.hp <= LOW_HP && this.rng.next() < fx.cowerChance;

    const skill = cowered ? COWER : this.chooseSkill(actor);
    if (skill.cooldown > 0) actor.cooldowns[skill.id] = skill.cooldown;

    const targets = cowered ? [] : this.selectTargets(actor, skill);
    const hits: Hit[] = [];
    let status: ActionResult['status'];
    let summoned: string[] = [];

    switch (skill.effect.kind) {
      case 'damage':
        for (const t of targets) {
          for (let i = 0; i < (skill.hits ?? 1); i++) {
            if (t.down) break;
            hits.push(this.dealDamage(actor, t, skill));
          }
        }
        // 연쇄 (무기 특수 능력): 단일 대상 공격 후 다른 적에게 튐
        if (fx.chain && skill.targeting !== 'all' && this.rng.next() < fx.chain) {
          const others = this.alive(actor.side === 'ally' ? 'enemy' : 'ally').filter((u) => !targets.includes(u));
          if (others.length) {
            const extra = this.rng.pick(others);
            targets.push(extra);
            hits.push(this.dealDamage(actor, extra, { ...skill, name: '연쇄', mult: skill.mult * 0.6 }));
          }
        }
        break;
      case 'heal':
        for (const t of targets) hits.push(this.heal(actor, t, skill));
        break;
      case 'taunt':
        actor.tauntTurns = skill.effect.turns;
        status = { targetIds: [actor.id], label: '도발!' };
        break;
      case 'buff': {
        const mult = skill.effect.atk * (1 + (fx.healGive ?? 0));
        for (const t of targets) t.atkBuff = { mult, turns: skill.effect.turns + (t === actor ? 1 : 0) };
        status = { targetIds: targets.map((t) => t.id), label: `공격 +${Math.round(mult * 100)}%` };
        break;
      }
      case 'summon':
        summoned = this.summon(actor, skill.effect.monster, skill.effect.count);
        break;
      case 'none':
        break;
    }

    this.checkOutcome();

    return {
      actorId: actor.id,
      skill,
      isSkill: skill.cooldown > 0,
      targetIds: targets.map((t) => t.id),
      hits,
      status,
      cowered,
      outcome: this.outcome,
      turn: this.turn,
      enraged: this.enraged,
      poisonTick,
      summoned: summoned.length ? summoned : undefined,
      phase: this.phaseEvent,
    };
  }

  private checkOutcome(): void {
    if (this.alive('enemy').length === 0) this.outcome = 'win';
    else if (this.alive('ally').length === 0) this.outcome = 'lose';
    else if (this.turn >= TURN_LIMIT) this.outcome = 'lose';
  }

  /** 소환: 열마다 살아있는 3마리까지. 쓰러진 유닛 자리를 다시 씀 */
  private summon(actor: Unit, kind: string, count: number): string[] {
    const out: string[] = [];
    if (!this.summoner) return out;
    for (let i = 0; i < count; i++) {
      const probe = this.summoner(kind, 'probe', 'front', 0);
      if (!probe) break;
      const row = probe.row as 'front' | 'back';
      const same = this.units.filter((u) => u.side === actor.side && u.row === row);
      if (same.filter((u) => !u.down).length >= 3) break;
      const freeSlot = same.find((u) => u.down && !same.some((o) => !o.down && o.slot === u.slot))?.slot;
      const slot = freeSlot ?? same.length;
      if (slot >= 3) break;
      const init = this.summoner(kind, `s${++this.summonCount}`, row, slot);
      if (!init) break;
      const u = this.makeUnit({ ...init, side: actor.side, summoned: true });
      u.gauge = 0;
      this.units.push(u);
      out.push(u.id);
    }
    return out;
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
      ticks = Math.min(ticks, Math.max(0, (GAUGE_MAX - u.gauge) / spdOf(u)));
    }
    for (const u of living) u.gauge += spdOf(u) * ticks;

    // 가득 찬 유닛 중 게이지가 가장 높은 쪽, 동률이면 빠른 쪽
    let best = living[0];
    for (const u of living) {
      if (u.gauge > best.gauge + 1e-6 || (Math.abs(u.gauge - best.gauge) < 1e-6 && spdOf(u) > spdOf(best))) {
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
    // 암살: 도발을 무시하고 가장 뒤 열
    if (skill.targeting === 'back') {
      for (const row of [...ROW_ORDER].reverse()) {
        const inRow = foes.filter((u) => u.row === row);
        if (inRow.length > 0) return [this.rng.pick(inRow)];
      }
    }
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
    const a: CombatFx = actor.fx ?? {};
    const t: CombatFx = target.fx ?? {};
    const vs = target.family ? a.vsFamily?.[target.family] ?? 0 : 0;
    const favored = vs > 0;
    const base = { targetId: target.id, amount: 0, heal: false, crit: false, favored, downed: false };

    if (t.dodge && this.rng.next() < t.dodge) return { ...base, dodged: true };
    if (a.missChance && this.rng.next() < a.missChance) return { ...base, missed: true };

    // 공격력 배율: 광전사·빈사·분노·축복
    const fallenFriends = this.units.filter((u) => u.side === actor.side && u.down).length;
    const hpA = actor.hp / actor.stats.hp;
    const atkMult =
      1 +
      (a.berserkAtkPerDown ?? 0) * fallenFriends +
      (hpA <= LOW_HP ? a.lowHpAtk ?? 0 : 0) +
      (hpA <= RAGE_HP ? a.rageAtk ?? 0 : 0) +
      (actor.atkBuff?.mult ?? 0) +
      (actor.phase > 0 ? (actor.phases?.[actor.phase - 1].atkMult ?? 1) - 1 : 0);
    const enrageMult = actor.side === 'enemy' && this.enraged ? 1.6 : 1;

    // GDD 4.2: 공격력 × 스킬 배율 × 천적 배율 − 방어력 보정
    const raw = actor.stats.atk * atkMult * skill.mult * (1 + vs) * enrageMult;
    const targetFallen = this.units.filter((u) => u.side === target.side && u.down).length;
    const defMult = Math.max(0.2, 1 - (t.berserkDefPerDown ?? 0) * targetFallen) * (target.tauntTurns > 0 ? TAUNT_DEF_MULT : 1);
    let dmg = Math.max(raw * MIN_DAMAGE_RATIO, raw - target.stats.def * defMult * DEF_FACTOR * (1 - (skill.pierce ?? 0)));
    dmg *= this.rng.range(0.9, 1.1);

    const crit = this.rng.next() < actor.stats.crit;
    if (crit) dmg *= CRIT_MULT + (a.critDmg ?? 0);

    // 받는 피해 배율: 강철 피부·진형·트라우마
    const aoe = skill.targeting === 'all';
    const taken = 1 + (t.dmgTaken ?? 0) + (aoe ? t.aoeTaken ?? 0 : t.singleTaken ?? 0) + (actor.family ? t.fromFamily?.[actor.family] ?? 0 : 0);
    dmg *= Math.max(0.2, taken);

    const amount = Math.max(1, Math.round(dmg));
    target.hp = Math.max(0, target.hp - amount);
    // 흡혈
    if (a.lifesteal && !actor.down) actor.hp = Math.min(actor.stats.hp, actor.hp + Math.round(amount * a.lifesteal));
    let saved: string | undefined;
    if (target.hp === 0) saved = this.trySave(target);
    target.lowestHp = Math.min(target.lowestHp, target.hp / target.stats.hp);
    const downed = target.hp === 0;
    // 상태 이상
    let inflicted: string[] | undefined;
    if (!downed && skill.inflict) {
      inflicted = [];
      const inf = skill.inflict;
      if (inf.poison && (target.fx?.poisonResist ?? 0) < 1) {
        target.poison = { dmg: Math.max(1, Math.round(target.stats.hp * inf.poison.pct)), turns: inf.poison.turns, from: actor.name, family: actor.family };
        inflicted.push('독');
      }
      if (inf.slow) {
        target.slow = { pct: inf.slow.pct, turns: inf.slow.turns };
        inflicted.push('둔화');
      }
      if (inf.stun && this.rng.next() < inf.stun.chance) {
        target.stun = Math.max(target.stun, inf.stun.turns);
        inflicted.push('기절');
      }
      if (!inflicted.length) inflicted = undefined;
    }
    // 보스 단계 전환
    if (!downed && target.phases && target.phase < target.phases.length && target.hp / target.stats.hp < target.phases[target.phase].below) {
      const ph = target.phases[target.phase];
      target.phase++;
      target.skills = [...ph.skills];
      if (ph.basic) target.basic = ph.basic;
      target.cooldowns = {};
      this.phaseEvent = { unitId: target.id, name: ph.name };
    }
    if (downed) {
      target.down = true;
      target.gauge = 0;
      target.tauntTurns = 0;
      target.atkBuff = null;
      target.downedBy = { name: actor.name, skill: skill.name, family: actor.family };
      const fam = target.family ?? 'none';
      actor.kills[fam] = (actor.kills[fam] ?? 0) + 1;
    }
    return { ...base, amount, crit, downed, saved, inflicted };
  }

  /** 쓰러질 피해: 불굴(자신) → 기적(살아있는 아군) 순서로 확인 */
  private trySave(target: Unit): string | undefined {
    const ls = target.fx?.lastStand;
    if (ls && !target.used.lastStand) {
      target.used.lastStand = true;
      target.hp = Math.max(1, Math.round(target.stats.hp * ls));
      return '불굴!';
    }
    const healer = this.units.find((u) => u !== target && u.side === target.side && !u.down && u.fx?.miracle && !u.used.miracle);
    if (healer) {
      healer.used.miracle = true;
      target.hp = Math.max(1, Math.round(target.stats.hp * healer.fx!.miracle!));
      return '기적!';
    }
    return undefined;
  }

  private heal(actor: Unit, target: Unit, skill: SkillDef): Hit {
    const give = 1 + (actor.fx?.healGive ?? 0);
    const recv = 1 + (target.fx?.healRecv ?? 0);
    const amount = Math.round(actor.stats.atk * skill.mult * give * recv * this.rng.range(0.95, 1.05));
    const before = target.hp;
    target.hp = Math.min(target.stats.hp, target.hp + amount);
    return { targetId: target.id, amount: target.hp - before, heal: true, crit: false, favored: false, downed: false };
  }
}

/** 둔화를 반영한 속도 */
function spdOf(u: Unit): number {
  return u.stats.spd * (u.slow ? 1 - u.slow.pct : 1);
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
