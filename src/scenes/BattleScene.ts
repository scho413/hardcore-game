import Phaser from 'phaser';
import { Battle, GAUGE_MAX } from '../battle/engine';
import { randomSeed } from '../battle/rng';
import type { ActionResult, Hit, Unit } from '../battle/types';
import { ensureHeroTextures } from '../art/textures';
import { FLOORS, TOP_FLOOR, buildEnemies, summonerFor } from '../data/floors';
import { DUNGEONS, DUNGEON_FLOORS, RARE_CHANCE, buildDungeonEnemies, dungeonPower, type DungeonId } from '../data/dungeons';
import { FATIGUE_DUNGEON, FATIGUE_TOWER, heroToUnit } from '../data/heroes';
import { matsText, type Materials } from '../data/items';
import { applyBattleResult, applyDungeonResult, type HeroReport } from '../progress';
import { game, readyFormation, save } from '../state';
import { fmtTime } from '../ui/heroUi';
import { FAMILIES, type Family } from '../data/races';
import { BASE_H, BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';
import { CodexScene } from './CodexScene';
import { drawDialog, guideHero, resolveSpeaker, tutActive, tutDone, tutIs, tutSkip, type Rect } from '../tutorial/overlay';
import { GUIDE_NAME, STEPS, TIPS, stepIndex } from '../tutorial/steps';
import { drawCover, towerBg, unitScale } from '../art/hd';
import { button, panel } from '../ui/widgets';

interface View {
  unit: Unit;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Graphics;
  gauge: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  taunt: Phaser.GameObjects.Text;
  homeX: number;
  homeY: number;
  /** 화면상 스프라이트 크기(px) */
  size: number;
  barW: number;
  shownHp: number;
}

const SPEEDS = [1, 2, 3];
const SPEED_KEY = 'hardcore-game/speed';

// 화면 배치: 위쪽 적, 아래쪽 아군 (GDD 4)
const ENEMY_Y = { back: 300, front: 490 } as const;
const ALLY_Y = { front: 770, mid: 925, back: 1080 } as const;

function spread(n: number): number[] {
  if (n === 1) return [W / 2];
  if (n === 2) return [250, 470];
  return [140, 360, 580];
}

export class BattleScene extends Phaser.Scene {
  private floor = 1;
  private battle!: Battle;
  private views = new Map<string, View>();
  private speedIdx = 0;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private running = false;
  private enrageShown = false;
  private reports: HeroReport[] = [];
  private rewards: Materials = {};
  /** 던전 모드면 설정 */
  private dungeon: DungeonId | null = null;
  /** 던전 층 (this.floor는 특성 계산용 적 강함) */
  private dfloor = 1;
  /** 소탕: 전투 화면 없이 결과만 */
  private sweep = false;
  private news: string[] = [];
  private gold = 0;

  constructor() {
    super('battle');
  }

  init(data: { floor?: number; dungeon?: DungeonId; sweep?: boolean }): void {
    this.floor = data.floor ?? 1;
    this.dungeon = data.dungeon ?? null;
    this.dfloor = data.floor ?? 1;
    this.sweep = !!data.sweep;
    if (this.dungeon) this.floor = Math.round(dungeonPower(this.dungeon, this.dfloor));
    this.views.clear();
    this.enrageShown = false;
    try {
      this.speedIdx = Math.max(0, SPEEDS.indexOf(Number(localStorage.getItem(SPEED_KEY) ?? 1)));
    } catch {
      this.speedIdx = 0;
    }
  }

  create(): void {
    this.running = true;
    this.cameras.main.setScroll(0, -OY);
    this.events.once('shutdown', () => (this.running = false));
    this.applySpeed();

    const team = readyFormation(this.dungeon ? FATIGUE_DUNGEON : FATIGUE_TOWER);
    for (const t of team) ensureHeroTextures(this, t.hero);
    const allies = team.map((t) => heroToUnit(t.hero, t.slot, { formation: game.data.formationType, floor: this.floor }));
    // 연금소 영약: 다음 전투 1번 (GDD 9)
    const el = game.data.elixirs;
    if (el.might || el.guard || el.antidote) {
      for (const a of allies) {
        if (el.might) a.stats.atk = Math.round(a.stats.atk * 1.1);
        if (el.guard) a.stats.def = Math.round(a.stats.def * 1.15);
        if (el.antidote) a.fx = { ...a.fx, poisonResist: 1 };
      }
      game.data.elixirs = {};
    }
    // 희귀 몬스터 (던전 1~9층)
    const rare = !!this.dungeon && this.dfloor < DUNGEON_FLOORS && Math.random() < RARE_CHANCE;
    const enemies = this.dungeon ? buildDungeonEnemies(this.dungeon, this.dfloor, rare) : buildEnemies(this.floor);
    let seed = randomSeed();
    // 튜토리얼 1층은 반드시 이기는 판으로 (첫 전투에서 지는 경험을 막음)
    if (tutActive() && !this.dungeon) {
      for (let i = 0; i < 200 && new Battle(allies, enemies, seed).runToEnd() !== 'win'; i++) seed = randomSeed();
    }

    // 결과를 먼저 확정해서 저장 (전투는 시드로 결정되므로 화면과 결과가 같음).
    // 패배가 보일 때 앱을 꺼서 사망을 피하는 것을 막기 위함.
    const summoner = this.dungeon ? null : summonerFor(this.floor);
    const verdict = new Battle(allies, enemies, seed, summoner);
    const outcome = verdict.runToEnd();
    const res = this.dungeon
      ? applyDungeonResult(game.data, this.dungeon, this.dfloor, outcome, verdict.units, { rare })
      : applyBattleResult(game.data, this.floor, outcome, verdict.units);
    this.reports = res.reports;
    this.rewards = res.rewards;
    this.news = res.events;
    this.gold = res.gold;
    save();

    if (this.sweep) {
      // 소탕: 계산된 결과만 바로 보여줌
      this.battle = verdict;
      this.drawBackground();
      this.drawHeader();
      this.cameras.main.fadeIn(160, 11, 9, 16);
      this.showResult(outcome);
      return;
    }

    this.battle = new Battle(allies, enemies, seed, summoner);

    this.drawBackground();
    this.drawHeader();
    for (const u of this.battle.units) this.createView(u);

    this.logText = this.add.text(W / 2, BOTTOM - 46, '', textStyle(22, C.dim)).setOrigin(0.5);

    this.cameras.main.fadeIn(200, 11, 9, 16);
    void this.run();
  }

  // ───────────────────────── 진행 ─────────────────────────

  private async run(): Promise<void> {
    await this.intro();
    await this.tutDialog('auto');
    await this.tutDialog('speed', { x: W - 155, y: TOP + 23, w: 130, h: 64 });
    while (this.running) {
      const r = this.battle.step();
      if (!r) break;
      await this.playAction(r);
      if (r.phase) {
        const v = this.views.get(r.phase.unitId);
        this.cameras.main.shake(400, 0.012);
        if (v) this.burst(v.root.x, v.root.y, 0xff5a4a);
        await this.banner(`${this.battle.unit(r.phase.unitId).name} · ${r.phase.name}`, C.redStr, 1000);
      }
      if (!this.running) return;
      this.refreshStatus();
      if (r.enraged && !this.enrageShown) {
        this.enrageShown = true;
        await this.banner('적이 광폭화했다!', C.redStr, 900);
        for (const v of this.views.values()) if (v.unit.side === 'enemy' && !v.unit.down) v.sprite.setTint(0xff9a8a);
      }
      if (r.outcome) {
        await this.wait(500);
        this.showResult(r.outcome);
        return;
      }
      await this.wait(120);
    }
  }

  private async intro(): Promise<void> {
    if (this.dungeon) {
      const d = DUNGEONS[this.dungeon];
      const boss = this.dfloor >= DUNGEON_FLOORS;
      if (boss) this.cameras.main.shake(300, 0.006);
      await this.banner(`${d.name} ${this.dfloor}층${boss ? ' · 보스' : ''}`, boss ? C.redStr : '#9fd0ff', boss ? 1100 : 900);
      const rare = this.battle.units.find((u) => u.rare);
      if (rare) await this.banner(`${rare.name} 출현!`, '#ffd25a', 900);
      return;
    }
    const def = FLOORS[this.floor - 1];
    if (def.title) {
      this.cameras.main.shake(300, 0.006);
      await this.banner(`${this.floor}층 · ${def.title}`, C.redStr, 1100);
    } else {
      await this.banner(`${this.floor}층`, C.goldStr, 800);
    }
  }

  private async playAction(r: ActionResult): Promise<void> {
    const actor = this.views.get(r.actorId)!;
    const targets = r.targetIds.map((id) => this.views.get(id)!);
    this.logText.setText(this.describe(r));
    this.turnText.setText(`행동 ${r.turn}`);

    // 독 피해 (턴 시작)
    if (r.poisonTick) {
      const h = r.poisonTick;
      actor.sprite.setTintFill(0x9adf5a);
      this.time.delayedCall(90, () => actor.sprite.active && !actor.unit.down && actor.sprite.clearTint());
      this.floatText(actor, `독 ${h.amount}`, '#9adf5a', 26);
      if (h.saved) this.floatText(actor, h.saved, '#ffd25a', 33, -70);
      this.animateHp(actor);
      if (h.downed) this.playDown(actor);
      await this.wait(280);
    }
    if (r.stunned) {
      this.floatText(actor, '기절', '#ffd25a', 26);
      await this.tween({ targets: actor.sprite, angle: { from: -8, to: 8 }, duration: 80, yoyo: true, repeat: 2 });
      actor.sprite.angle = 0;
      return;
    }
    if (r.skill.id === 'poisoned') return;

    // 행동 예고: 살짝 뛰기
    await this.tween({ targets: actor.sprite, y: -14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });

    if (r.isSkill) {
      void this.banner(r.skill.name, actor.unit.side === 'ally' ? '#9fd0ff' : C.redStr, 520, 34);
      await this.wait(160);
    }

    const effect = r.skill.effect.kind;
    if (r.cowered) {
      this.floatText(actor, '겁에 질림…', '#c8b0ff', 22);
      await this.tween({ targets: actor.sprite, x: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 3 });
      actor.sprite.x = 0;
    } else if (effect === 'taunt') {
      await this.playTaunt(actor);
    } else if (effect === 'buff') {
      await this.playBuff(r);
    } else if (effect === 'summon') {
      await this.playSummon(r);
    } else if (effect === 'heal') {
      await Promise.all(r.hits.map((h) => this.projectile(actor, this.views.get(h.targetId)!, 'holy').then(() => this.applyHit(h))));
    } else if (r.skill.projectile === 'none') {
      if (r.skill.targeting === 'all') await this.playSlam(actor, r);
      else await this.playMelee(actor, targets[0], r);
    } else {
      await this.playRanged(actor, r);
    }
  }

  /** 소환: 새 유닛을 같은 열에 세우고 자리 다시 맞춤 */
  private async playSummon(r: ActionResult): Promise<void> {
    const ids = r.summoned ?? [];
    if (!ids.length) return;
    for (const id of ids) {
      const u = this.battle.unit(id);
      // 같은 자리에 있던 쓰러진 유닛은 숨김
      for (const v of this.views.values()) if (v.unit.side === u.side && v.unit.row === u.row && v.unit.slot === u.slot && v.unit.down) v.root.setVisible(false);
      this.createView(u);
      const v = this.views.get(id)!;
      v.root.setAlpha(0).setScale(0.4);
      this.burst(v.root.x, v.root.y, 0x9adf5a);
      this.tweens.add({ targets: v.root, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }
    // 열 자리 다시 계산
    for (const v of this.views.values()) {
      if (v.unit.side !== 'enemy') continue;
      const x = this.enemyX(v.unit);
      if (x !== v.homeX) {
        v.homeX = x;
        this.tweens.add({ targets: v.root, x, duration: 220 });
      }
    }
    await this.wait(300);
  }

  /** 적 x 위치: 같은 열 자리 수(가장 큰 slot + 1)로 나눔 */
  private enemyX(u: Unit): number {
    const n = Math.max(...this.battle.units.filter((o) => o.side === 'enemy' && o.row === u.row).map((o) => o.slot)) + 1;
    return spread(Math.min(3, n))[u.slot];
  }

  private async playBuff(r: ActionResult): Promise<void> {
    const targets = r.targetIds.map((id) => this.views.get(id)!);
    const label = r.status?.label ?? '강화';
    await Promise.all(
      targets.map(async (t) => {
        const ring = this.add.circle(t.root.x, t.root.y, t.size * 0.45, 0xffd36a, 0).setStrokeStyle(4, 0xffd36a, 1).setDepth(20);
        this.floatText(t, label, C.goldStr, 18);
        await this.tween({ targets: ring, scale: 1.6, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
        ring.destroy();
      }),
    );
  }

  private async playMelee(actor: View, target: View, r: ActionResult): Promise<void> {
    const dir = actor.unit.side === 'ally' ? 1 : -1;
    const tx = target.root.x;
    const ty = target.root.y + dir * (target.size / 2 + 34);
    actor.root.setDepth(10);
    await this.tween({ targets: actor.root, x: tx, y: ty, duration: 170, ease: 'Quad.easeIn' });
    for (const h of r.hits) {
      if (r.skill.big) this.cameras.main.shake(140, 0.007);
      this.slashFx(target);
      this.applyHit(h);
      await this.wait(r.hits.length > 1 ? 130 : 60);
    }
    await this.tween({ targets: actor.root, x: actor.homeX, y: actor.homeY, duration: 210, ease: 'Quad.easeOut' });
    actor.root.setDepth(0);
  }

  /** 전체 근접 공격 (지진 등): 점프 후 내려찍기 */
  private async playSlam(actor: View, r: ActionResult): Promise<void> {
    await this.tween({ targets: actor.sprite, y: -50, duration: 200, ease: 'Quad.easeOut' });
    await this.tween({ targets: actor.sprite, y: 0, duration: 110, ease: 'Quad.easeIn' });
    this.cameras.main.shake(260, 0.012);
    for (const h of r.hits) this.applyHit(h);
    await this.wait(260);
  }

  private async playRanged(actor: View, r: ActionResult): Promise<void> {
    // 같은 대상 연타는 시차를 두고, 서로 다른 대상은 동시에
    const shots = r.hits.map((h, i) => {
      const sameBefore = r.hits.slice(0, i).filter((x) => x.targetId === h.targetId).length;
      return this.wait(sameBefore * 110).then(async () => {
        if (!this.running) return;
        await this.projectile(actor, this.views.get(h.targetId)!, r.skill.projectile);
        if (r.skill.big && sameBefore === 0) this.cameras.main.shake(120, 0.005);
        this.applyHit(h);
      });
    });
    await Promise.all(shots);
    await this.wait(80);
  }

  private async playTaunt(actor: View): Promise<void> {
    const ring = this.add.circle(actor.root.x, actor.root.y, actor.size * 0.5, 0x6fb4ff, 0).setStrokeStyle(5, 0x6fb4ff, 1);
    this.floatText(actor, '도발!', '#9fd0ff', 33);
    await this.tween({ targets: ring, scale: 1.8, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
    ring.destroy();
  }

  // ───────────────────────── 이펙트 ─────────────────────────

  private projectile(from: View, to: View, kind: string): Promise<void> {
    const fx = from.unit.fxColor ?? 0xb07aff;
    const sx = from.root.x;
    const sy = from.root.y - from.size * 0.2;
    const ex = to.root.x;
    const ey = to.root.y;
    let obj: Phaser.GameObjects.Shape;
    if (kind === 'arrow') {
      obj = this.add.rectangle(sx, sy, 34, 5, 0xe8dcc0).setRotation(Phaser.Math.Angle.Between(sx, sy, ex, ey));
    } else if (kind === 'holy') {
      obj = this.add.circle(sx, sy, 10, 0xffe68a).setStrokeStyle(4, 0xfff6d0, 0.6);
    } else {
      const col = fx;
      obj = this.add.circle(sx, sy, 13, col).setStrokeStyle(5, 0xffffff, 0.5);
    }
    obj.setDepth(20);
    return this.tween({ targets: obj, x: ex, y: ey, duration: kind === 'arrow' ? 160 : 240, ease: kind === 'arrow' ? 'Linear' : 'Sine.easeIn' }).then(() => {
      this.burst(ex, ey, kind === 'holy' ? 0x9fffb0 : kind === 'arrow' ? 0xe8dcc0 : fx);
      obj.destroy();
    });
  }

  private slashFx(target: View): void {
    const g = this.add.graphics().setDepth(20);
    g.lineStyle(6, 0xffffff, 1);
    const s = target.size * 0.45;
    g.lineBetween(target.root.x - s, target.root.y - s, target.root.x + s, target.root.y + s);
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 7; i++) {
      const p = this.add.image(x, y, 'px').setTint(color).setScale(2).setDepth(21);
      const a = Math.random() * Math.PI * 2;
      const d = 24 + Math.random() * 30;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300, onComplete: () => p.destroy() });
    }
  }

  private applyHit(h: Hit): void {
    const v = this.views.get(h.targetId)!;
    if (h.heal) {
      this.floatText(v, `+${h.amount}`, C.greenStr, 33);
      this.animateHp(v);
      return;
    }
    if (h.missed) {
      this.floatText(v, '빗나감', C.dim, 22);
      return;
    }
    if (h.saved) this.floatText(v, h.saved, '#ffd25a', 33, -70);
    if (h.inflicted) this.floatText(v, h.inflicted.join('·'), '#c8ff8a', 22, -90);
    if (h.dodged) {
      this.floatText(v, '회피', '#9fd0ff', 33);
      this.tweens.add({ targets: v.sprite, x: { from: 18, to: 0 }, duration: 220, ease: 'Quad.easeOut' });
      return;
    }
    // 피격 반짝임 + 흔들림
    v.sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => {
      if (!v.sprite.active) return;
      v.sprite.clearTint();
      if (v.unit.down && v.unit.side === 'ally') v.sprite.setTint(0x5a5466);
      else if (this.enrageShown && v.unit.side === 'enemy') v.sprite.setTint(0xff9a8a);
      else if (v.unit.rare) v.sprite.setTint(0xffd25a);
    });
    this.tweens.add({ targets: v.sprite, x: { from: -9, to: 0 }, duration: 160, ease: 'Bounce.easeOut' });

    const base = v.unit.side === 'ally' ? '#ff8a7a' : '#ffffff';
    const color = h.favored ? '#ffb347' : base;
    const size = h.crit ? 44 : 33;
    this.floatText(v, `${h.amount}`, color, size);
    if (h.crit) this.floatText(v, '치명!', C.goldStr, 22, -46);
    else if (h.favored) this.floatText(v, '천적!', '#ffb347', 18, -40);

    this.animateHp(v);
    if (h.downed) this.playDown(v);
  }

  private playDown(v: View): void {
    v.taunt.setVisible(false);
    if (v.unit.side === 'ally') {
      this.tweens.killTweensOf(v.sprite);
      this.tweens.add({ targets: v.sprite, angle: 90, y: 10, duration: 260, ease: 'Quad.easeIn' });
      v.sprite.setTint(0x5a5466);
      v.name.setColor(C.faint);
      this.floatText(v, '쓰러짐', C.redStr, 22, -60);
    } else {
      this.tweens.killTweensOf(v.sprite);
      this.tweens.add({ targets: v.root, alpha: 0.12, duration: 380, ease: 'Stepped', easeParams: [4] });
      this.burst(v.root.x, v.root.y, 0xffffff);
    }
  }

  private floatText(v: View, s: string, color: string, size: number, dy = 0): void {
    const t = this.add
      .text(v.root.x + Phaser.Math.Between(-12, 12), v.root.y - v.size * 0.35 + dy, s, textStyle(size, color, { stroke: '#14111c', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(1.4);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 56, alpha: 0, delay: 380, duration: 520, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  private async banner(s: string, color: string, hold: number, size = 55): Promise<void> {
    const y = 640;
    const bg = this.add.rectangle(W / 2, y, W, size + 40, 0x0b0910, 0.75).setDepth(40).setScale(1, 0);
    const t = this.add.text(W / 2, y, s, textStyle(size, color, { stroke: '#0b0910', strokeThickness: 8 })).setOrigin(0.5).setDepth(41).setAlpha(0);
    this.tweens.add({ targets: bg, scaleY: 1, duration: 120 });
    await this.tween({ targets: t, alpha: 1, duration: 140 });
    await this.wait(hold);
    this.tweens.add({ targets: [bg, t], alpha: 0, duration: 180, onComplete: () => (bg.destroy(), t.destroy()) });
  }

  // ───────────────────────── 화면 구성 ─────────────────────────

  private drawBackground(): void {
    // 탑: 그린 배경 (구간·보스 방). 영웅·이름이 잘 보이게 살짝 어둡게
    if (!this.dungeon && this.textures.exists(towerBg(this.floor))) {
      drawCover(this, towerBg(this.floor), 0, TOP + 110, W, BOTTOM - 100 - TOP - 110, 0.35);
      const shadeG = this.add.graphics();
      shadeG.fillStyle(0x0b0910, 0.28).fillRect(0, TOP + 110, W, BOTTOM - 100 - TOP - 110);
      shadeG.fillGradientStyle(0x0b0910, 0x0b0910, 0x0b0910, 0x0b0910, 0, 0, 0.45, 0.45).fillRect(0, 640, W, BOTTOM - 100 - 640);
      shadeG.fillStyle(0x0b0910, 1).fillRect(0, BOTTOM - 100, W, 100);
      return;
    }
    const g = this.add.graphics();
    // 벽
    const wallTop = TOP + 110;
    g.fillStyle(0x1a1524, 1).fillRect(0, wallTop, W, 580 - wallTop);
    g.lineStyle(2, 0x241d31, 1);
    for (let y = 580 - 36 * Math.ceil((580 - wallTop) / 36); y < 580; y += 36) {
      g.lineBetween(0, y, W, y);
      const off = Math.round((580 - y) / 36) % 2 === 0 ? 0 : 40;
      for (let x = off; x < W; x += 80) g.lineBetween(x, y, x, y + 36);
    }
    // 바닥
    g.fillStyle(0x221b2e, 1).fillRect(0, 580, W, BOTTOM - 100 - 580);
    g.lineStyle(2, 0x2b2339, 1);
    for (let y = 580; y < BOTTOM - 100; y += 60) g.lineBetween(0, y, W, y);
    // 경계 띠
    g.fillStyle(0x0b0910, 1).fillRect(0, 574, W, 10);
    // 횃불
    for (const x of [70, W - 70]) {
      g.fillStyle(0x4a3a2a, 1).fillRect(x - 5, 170, 10, 34);
      const flame = this.add.circle(x, 162, 11, 0xff9a3a);
      const glow = this.add.circle(x, 162, 40, 0xff9a3a, 0.08);
      this.tweens.add({ targets: [flame, glow], scale: { from: 0.85, to: 1.15 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: x });
    }
    // 하단 로그 영역
    g.fillStyle(0x0b0910, 1).fillRect(0, BOTTOM - 100, W, 100);
  }

  private drawHeader(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0b0910, 1).fillRect(0, TOP, W, 110);
    const def = this.dungeon ? { title: `${this.dfloor}층${this.sweep ? ' · 소탕' : ''}` } : FLOORS[this.floor - 1];
    const title = this.add.text(32, TOP + 55, this.dungeon ? DUNGEONS[this.dungeon].name : `탑 ${this.floor}층`, textStyle(44, this.dungeon ? '#9fd0ff' : C.goldStr)).setOrigin(0, 0.5);
    if (def.title) this.add.text(title.x + title.width + 16, TOP + 58, def.title, textStyle(22, this.dungeon ? C.dim : C.redStr)).setOrigin(0, 0.5);
    this.turnText = this.add.text(W - 170, TOP + 55, '', textStyle(18, C.faint)).setOrigin(1, 0.5);

    const speedBtn = button(this, W - 90, TOP + 55, 130, 64, `${SPEEDS[this.speedIdx]}배속`, () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      speedBtn.setLabel(`${SPEEDS[this.speedIdx]}배속`);
      try {
        localStorage.setItem(SPEED_KEY, String(SPEEDS[this.speedIdx]));
      } catch {
        /* 무시 */
      }
      this.applySpeed();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
  }

  private applySpeed(): void {
    const s = SPEEDS[this.speedIdx];
    this.tweens.timeScale = s;
    this.time.timeScale = s;
  }

  private createView(u: Unit): void {
    let x: number;
    let y: number;
    if (u.side === 'enemy') {
      x = this.enemyX(u);
      y = ENEMY_Y[u.row as 'front' | 'back'];
    } else {
      const sameRow = this.battle.units.filter((o) => o.side === 'ally' && o.row === u.row).length;
      x = (sameRow === 2 ? [230, 490] : spread(sameRow))[u.slot];
      y = ALLY_Y[u.row];
    }
    const isHero = !!u.texture?.startsWith('hero-');
    const key = u.texture ?? `unit-${u.kind}`;
    const base = isHero ? 3 : u.boss === 'main' ? 10 : u.boss === 'mid' ? 9 : 5;
    const scale = isHero ? base : unitScale(this, u.kind, base) * (this.textures.get(key).getSourceImage().width > 64 ? 1.25 : 1);
    const size = this.textures.get(key).getSourceImage().height * scale;
    const barW = u.boss ? 220 : 116;

    const shadow = this.add.ellipse(0, size / 2 - 4, size * 0.7, size * 0.16, 0x000000, 0.35);
    const sprite = this.add.image(0, 0, key).setScale(scale);
    if (u.rare) sprite.setTint(0xffd25a);
    const nameY = -size / 2 - 18;
    const label = u.side === 'ally' ? `${u.name} Lv${u.level}` : u.name;
    const name = this.add.text(u.side === 'enemy' ? 8 : 0, nameY, label, textStyle(18, u.boss ? C.redStr : C.text, { stroke: '#14111c', strokeThickness: 4 })).setOrigin(0.5);
    const famColor = u.family ? FAMILIES[u.family as Family].color : 0x9d93b0;
    const dot = this.add.circle(name.x - name.width / 2 - 10, nameY, 7, famColor).setStrokeStyle(2, 0x14111c).setVisible(u.side === 'enemy');
    const hp = this.add.graphics();
    const gauge = this.add.graphics();
    const taunt = this.add.text(0, nameY - 26, '도발', textStyle(18, '#9fd0ff', { stroke: '#14111c', strokeThickness: 4 })).setOrigin(0.5).setVisible(false);

    const root = this.add.container(x, y, [shadow, sprite, name, dot, hp, gauge, taunt]);
    const v: View = { unit: u, root, sprite, hp, gauge, name, taunt, homeX: x, homeY: y, size, barW, shownHp: u.hp };
    this.views.set(u.id, v);
    this.drawHp(v, u.hp);
    this.drawGauge(v);

    // 대기 모션
    this.tweens.add({ targets: sprite, scaleY: scale * 1.04, duration: 520 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 400 });
  }

  private drawHp(v: View, hpVal: number): void {
    const y = v.size / 2 + 6;
    const ratio = Math.max(0, hpVal / v.unit.stats.hp);
    const col = v.unit.side === 'ally' ? (ratio < 0.3 ? 0xffb347 : C.hpAlly) : C.hpEnemy;
    v.hp.clear();
    v.hp.fillStyle(0x0b0910, 1).fillRect(-v.barW / 2 - 3, y - 3, v.barW + 6, 18);
    v.hp.fillStyle(C.hpBack, 1).fillRect(-v.barW / 2, y, v.barW, 12);
    v.hp.fillStyle(col, 1).fillRect(-v.barW / 2, y, v.barW * ratio, 12);
  }

  private drawGauge(v: View): void {
    const y = v.size / 2 + 24;
    const ratio = v.unit.down ? 0 : Math.min(1, v.unit.gauge / GAUGE_MAX);
    v.gauge.clear();
    v.gauge.fillStyle(0x0b0910, 1).fillRect(-v.barW / 2, y, v.barW, 6);
    v.gauge.fillStyle(C.gauge, 1).fillRect(-v.barW / 2, y, v.barW * ratio, 6);
  }

  private animateHp(v: View): void {
    const from = v.shownHp;
    const to = v.unit.hp;
    v.shownHp = to;
    this.tweens.addCounter({ from, to, duration: 260, ease: 'Quad.easeOut', onUpdate: (tw) => this.drawHp(v, tw.getValue() ?? to) });
  }

  private refreshStatus(): void {
    for (const v of this.views.values()) {
      this.drawGauge(v);
      const u = v.unit;
      const taunt = !u.down && u.tauntTurns > 0;
      const buff = !u.down && !!u.atkBuff;
      // 상태 표시: 기절 > 독 > 둔화 > 도발 > 공격↑
      const tag: [string, string] | null = u.down
        ? null
        : u.stun > 0
          ? ['기절', '#ffd25a']
          : u.poison
            ? ['독', '#9adf5a']
            : u.slow
              ? ['둔화', '#8fd0ff']
              : taunt
                ? ['도발', '#9fd0ff']
                : buff
                  ? ['공격↑', C.goldStr]
                  : null;
      v.taunt.setVisible(!!tag);
      if (tag) v.taunt.setText(tag[0]).setColor(tag[1]);
      if (taunt) v.sprite.setTint(0xbfdcff);
      else if (!v.unit.down && v.unit.side === 'ally') v.sprite.clearTint();
    }
  }

  private describe(r: ActionResult): string {
    const a = this.battle.unit(r.actorId).name;
    if (r.cowered) return `${a}이(가) 겁에 질려 움직이지 못한다`;
    if (r.stunned) return `${a}이(가) 기절해 움직이지 못한다`;
    if (r.skill.id === 'poisoned') return `${a}이(가) 독으로 쓰러졌다`;
    if (r.skill.effect.kind === 'summon') return `${a}의 ${r.skill.name} · ${r.summoned?.length ?? 0}마리 등장`;
    if (r.skill.effect.kind === 'taunt') return `${a}의 도발! 적의 공격을 끌어당긴다`;
    if (r.skill.effect.kind === 'buff') return `${a}의 ${r.skill.name} · ${r.status?.label ?? ''}`;
    if (r.skill.effect.kind === 'heal') {
      const total = r.hits.reduce((s, h) => s + h.amount, 0);
      return `${a}의 ${r.skill.name} · ${total} 회복`;
    }
    const total = r.hits.reduce((s, h) => s + h.amount, 0);
    const downs = r.hits.filter((h) => h.downed).map((h) => this.battle.unit(h.targetId).name);
    const tgt = r.targetIds.length > 1 ? '전체' : this.battle.unit(r.targetIds[0]).name;
    return `${a} → ${tgt} · ${r.skill.name} ${total}${downs.length ? ` · ${downs.join(', ')} 쓰러짐` : ''}`;
  }

  // ───────────────────────── 결과 ─────────────────────────

  private showResult(outcome: 'win' | 'lose'): void {
    this.applySpeedReset();
    const deaths = this.reports.filter((r) => r.fate === 'dead').length;
    const injured = this.reports.filter((r) => r.fate === 'injured').length;
    const win = outcome === 'win';
    const dg = this.dungeon ? DUNGEONS[this.dungeon] : null;
    const title = dg ? (win ? (this.sweep ? '소탕 완료' : '탐색 성공!') : '후퇴') : win ? (this.floor === TOP_FLOOR ? '탑 정복!' : '승리!') : '전멸';
    const summary = dg
      ? win ? `${dg.name} ${this.dfloor}층 돌파 · 기력 -${FATIGUE_DUNGEON}` : `${injured > 0 ? `중상 ${injured}명 · ` : ''}빠져나왔습니다 · 기력 -${FATIGUE_DUNGEON}`
      : win
        ? injured > 0 ? `${this.floor}층 클리어 · 중상 ${injured}명 · 기력 -${FATIGUE_TOWER}` : `${this.floor}층 클리어 · 전원 무사 · 기력 -${FATIGUE_TOWER}`
        : deaths > 0 ? `${deaths}명이 돌아오지 못했습니다` : `${this.floor}층 실패`;
    const rewardText = [...this.news, this.gold ? `골드 +${this.gold}` : '', Object.keys(this.rewards).length ? `획득: ${matsText(this.rewards)}` : ''].filter(Boolean).join('\n');

    const shade = this.add.rectangle(W / 2, BASE_H / 2, W, BOTTOM - TOP, 0x0b0910, 0).setDepth(50).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: win ? 0.7 : 0.85, duration: 300 });

    const rowH = (r: HeroReport) => (r.notes.length ? 94 : 66);
    const rewardH = rewardText ? 20 + 26 * rewardText.split('\n').length : 0;
    const ph = 300 + rewardH + this.reports.reduce((a, r) => a + rowH(r), 0);
    const box = this.add.container(W / 2, BASE_H / 2).setDepth(51).setAlpha(0);
    box.add(panel(this, -310, -ph / 2, 620, ph, C.panel, win ? C.gold : C.red));
    box.add(this.add.text(0, -ph / 2 + 64, title, textStyle(66, win ? C.goldStr : C.redStr)).setOrigin(0.5));
    box.add(this.add.text(0, -ph / 2 + 124, summary, textStyle(22, C.text)).setOrigin(0.5));

    if (rewardText) box.add(this.add.text(0, -ph / 2 + 152, rewardText, { ...textStyle(18, '#9fd0ff'), wordWrap: { width: 580 }, align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    let y = -ph / 2 + 176 + rewardH;
    this.reports.forEach((r) => {
      const dead = r.fate === 'dead';
      const face = this.add.image(-250, y + 26, `face-${r.hero.id}`).setScale(2.5);
      if (dead) face.setTint(0x6a6070);
      box.add(face);
      box.add(this.add.text(-200, y + 8, r.hero.name, textStyle(22, dead ? C.faint : C.text)));
      let text: string;
      let color: string;
      if (r.fate === 'dead') {
        text = '사망';
        color = C.redStr;
      } else if (r.fate === 'injured') {
        text = `중상 · ${fmtTime((r.hero.injuredUntil ?? 0) - Date.now())} 후 회복`;
        color = '#ff9a4a';
      } else if (r.levelAfter > r.levelBefore) {
        text = `+${r.xp} 경험치 · Lv ${r.levelBefore} → ${r.levelAfter}`;
        color = C.goldStr;
      } else {
        text = win ? (r.xp > 0 ? `Lv ${r.levelAfter} · +${r.xp} 경험치` : `Lv ${r.levelAfter}`) : '생존';
        color = C.dim;
      }
      if (r.fate === 'injured' && r.levelAfter > r.levelBefore) text = `Lv ${r.levelAfter} · ${text}`;
      box.add(this.add.text(270, y + 10, text, textStyle(r.fate === 'dead' ? 22 : 18, color)).setOrigin(1, 0));
      if (r.notes.length) {
        const n = r.notes[0];
        const more = r.notes.length > 1 ? ` 외 ${r.notes.length - 1}` : '';
        box.add(this.add.text(-200, y + 42, `${n.text}${more}`, textStyle(18, n.tone === 'good' ? '#8fe0a0' : '#ff9a7a')));
      }
      y += rowH(r);
    });

    const by = ph / 2 - 62;
    if (dg) {
      box.add(button(this, 0, by, 440, 84, '던전으로', () => this.leave('dungeon', {}), { size: 33 }));
    } else if (win) {
      const tut = tutActive();
      box.add(button(this, 0, by, 440, 84, tut ? '기지로' : '귀환', () => {
        tutDone('home');
        this.leave(tut ? 'base' : 'tower', {});
      }, { size: 33 }));
    } else {
      box.add(button(this, -125, by, 220, 84, '탑으로', () => this.leave('tower', {}), { fill: C.panelHi, textColor: C.text, size: 22 }));
      box.add(button(this, 125, by, 220, 84, deaths > 0 ? '죽은 영웅' : '영웅 목록', () => {
        if (deaths > 0) CodexScene.openFallen();
        this.leave(deaths > 0 ? 'codex' : 'heroes', {});
      }, { size: 22 }));
    }
    this.tweens.add({ targets: box, alpha: 1, y: { from: BASE_H / 2 + 30, to: BASE_H / 2 }, duration: 320, ease: 'Back.easeOut' });
    // 튜토리얼: 결과·기력 설명 후 기지로 / 그 밖엔 처음 겪는 중상·사망 도움말
    this.time.delayedCall(450, async () => {
      if (tutIs('result')) {
        await this.tutDialog('result', { x: 40, y: BASE_H / 2 - ph / 2 + 100, w: W - 80, h: ph - 210 });
        await this.tutDialog('stamina');
        if (tutIs('home')) void this.tutDialog('home', { x: W / 2 - 220, y: BASE_H / 2 + by - 42, w: 440, h: 84 });
        return;
      }
      if (tutActive()) return;
      if (deaths > 0) await this.tipDialog('death', TIPS.death);
      else if (injured > 0) await this.tipDialog('injury', TIPS.injury);
    });
  }

  /** 결과 창 연출은 배속과 무관하게 */
  private applySpeedReset(): void {
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
  }

  /** 튜토리얼 대사 1개. tap이면 누를 때까지 기다림, action이면 그려 두고 바로 돌아감 */
  private tutDialog(id: string, target?: Rect): Promise<void> {
    if (!tutIs(id)) return Promise.resolve();
    const step = STEPS[stepIndex(id)];
    const sp = resolveSpeaker(this, step);
    return new Promise((res) => {
      const before = new Set(this.children.list);
      const clear = () => {
        for (const o of [...this.children.list]) if (!before.has(o)) o.destroy();
      };
      drawDialog(this, {
        name: sp.name,
        face: sp.face,
        text: sp.text,
        target,
        mode: step.mode,
        top: TOP,
        bottom: BOTTOM,
        onTap: () => {
          clear();
          tutDone(id);
          res();
        },
        onSkip: () => {
          clear();
          tutSkip();
          res();
        },
      });
      if (step.mode === 'action') res();
    });
  }

  /** 상황별 도움말 (처음 한 번) */
  private tipDialog(id: string, text: string): Promise<void> {
    const d = game.data;
    if ((d.tips ?? []).includes(id)) return Promise.resolve();
    const g = guideHero();
    ensureHeroTextures(this, g);
    return new Promise((res) => {
      const before = new Set(this.children.list);
      drawDialog(this, {
        name: GUIDE_NAME,
        face: `face-${g.id}`,
        text,
        mode: 'tap',
        top: TOP,
        bottom: BOTTOM,
        onTap: () => {
          for (const o of [...this.children.list]) if (!before.has(o)) o.destroy();
          d.tips = [...(d.tips ?? []), id];
          save();
          res();
        },
      });
    });
  }

  private leave(scene: string, data: object): void {
    this.running = false;
    this.cameras.main.fadeOut(180, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  // ───────────────────────── 유틸 ─────────────────────────

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }
}
