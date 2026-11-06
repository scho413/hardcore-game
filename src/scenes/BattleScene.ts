import Phaser from 'phaser';
import { Battle, GAUGE_MAX } from '../battle/engine';
import { randomSeed } from '../battle/rng';
import type { ActionResult, Hit, Unit } from '../battle/types';
import { ensureHeroTextures } from '../art/textures';
import { FLOORS, TOP_FLOOR, buildEnemies } from '../data/floors';
import { heroToUnit } from '../data/heroes';
import { applyBattleResult, type HeroReport } from '../progress';
import { game, readyFormation, save } from '../state';
import { fmtTime } from '../ui/heroUi';
import { FAMILIES, type Family } from '../data/races';
import { BASE_H, BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';
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
const ALLY_X = { front: [230, 490], mid: [360], back: [230, 490] } as const;

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

  constructor() {
    super('battle');
  }

  init(data: { floor: number }): void {
    this.floor = data.floor ?? 1;
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

    const team = readyFormation();
    for (const t of team) ensureHeroTextures(this, t.hero);
    const allies = team.map((t) => heroToUnit(t.hero, t.slot));
    const enemies = buildEnemies(this.floor);
    const seed = randomSeed();

    // 결과를 먼저 확정해서 저장 (전투는 시드로 결정되므로 화면과 결과가 같음).
    // 패배가 보일 때 앱을 꺼서 사망을 피하는 것을 막기 위함.
    const verdict = new Battle(allies, enemies, seed);
    const outcome = verdict.runToEnd();
    this.reports = applyBattleResult(game.data, this.floor, outcome, verdict.units.filter((u) => u.side === 'ally'));
    save();

    this.battle = new Battle(allies, enemies, seed);

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
    while (this.running) {
      const r = this.battle.step();
      if (!r) break;
      await this.playAction(r);
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

    // 행동 예고: 살짝 뛰기
    await this.tween({ targets: actor.sprite, y: -14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });

    if (r.isSkill) {
      void this.banner(r.skill.name, actor.unit.side === 'ally' ? '#9fd0ff' : C.redStr, 520, 34);
      await this.wait(160);
    }

    const effect = r.skill.effect.kind;
    if (effect === 'taunt') {
      await this.playTaunt(actor);
    } else if (effect === 'heal') {
      await Promise.all(r.hits.map((h) => this.projectile(actor, this.views.get(h.targetId)!, 'holy').then(() => this.applyHit(h))));
    } else if (r.skill.projectile === 'none') {
      if (r.skill.targeting === 'all') await this.playSlam(actor, r);
      else await this.playMelee(actor, targets[0], r);
    } else {
      await this.playRanged(actor, r);
    }
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
    const def = FLOORS[this.floor - 1];
    const title = this.add.text(32, TOP + 55, `탑 ${this.floor}층`, textStyle(44, C.goldStr)).setOrigin(0, 0.5);
    if (def.title) this.add.text(title.x + title.width + 16, TOP + 58, def.title, textStyle(22, C.redStr)).setOrigin(0, 0.5);
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
      const sameRow = this.battle.units.filter((o) => o.side === 'enemy' && o.row === u.row);
      x = spread(sameRow.length)[u.slot];
      y = ENEMY_Y[u.row as 'front' | 'back'];
    } else {
      x = ALLY_X[u.row][u.slot];
      y = ALLY_Y[u.row];
    }
    const isHero = !!u.texture?.startsWith('hero-');
    const scale = isHero ? 3 : u.boss === 'main' ? 10 : u.boss === 'mid' ? 9 : 5;
    const size = (isHero ? 32 : 16) * scale;
    const barW = u.boss ? 220 : 116;

    const shadow = this.add.ellipse(0, size / 2 - 4, size * 0.7, size * 0.16, 0x000000, 0.35);
    const sprite = this.add.image(0, 0, u.texture ?? `unit-${u.kind}`).setScale(scale);
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
      v.taunt.setVisible(!v.unit.down && v.unit.tauntTurns > 0);
      if (v.taunt.visible) v.sprite.setTint(0xbfdcff);
      else if (!v.unit.down && v.unit.side === 'ally') v.sprite.clearTint();
    }
  }

  private describe(r: ActionResult): string {
    const a = this.battle.unit(r.actorId).name;
    if (r.skill.effect.kind === 'taunt') return `${a}의 도발! 적의 공격을 끌어당긴다`;
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
    const title = win ? (this.floor === TOP_FLOOR ? '탑 정복!' : '승리!') : '전멸';
    const summary = win
      ? injured > 0 ? `${this.floor}층 클리어 · 중상 ${injured}명` : `${this.floor}층 클리어 · 전원 무사`
      : deaths > 0 ? `${deaths}명이 돌아오지 못했습니다` : `${this.floor}층 실패`;

    const shade = this.add.rectangle(W / 2, BASE_H / 2, W, BOTTOM - TOP, 0x0b0910, 0).setDepth(50).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: win ? 0.7 : 0.85, duration: 300 });

    const rowH = 66;
    const ph = 300 + this.reports.length * rowH;
    const box = this.add.container(W / 2, BASE_H / 2).setDepth(51).setAlpha(0);
    box.add(panel(this, -310, -ph / 2, 620, ph, C.panel, win ? C.gold : C.red));
    box.add(this.add.text(0, -ph / 2 + 64, title, textStyle(66, win ? C.goldStr : C.redStr)).setOrigin(0.5));
    box.add(this.add.text(0, -ph / 2 + 124, summary, textStyle(22, C.text)).setOrigin(0.5));

    this.reports.forEach((r, i) => {
      const y = -ph / 2 + 176 + i * rowH;
      const dead = r.fate === 'dead';
      const face = this.add.image(-250, y + 22, `face-${r.hero.id}`).setScale(5);
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
        text = `Lv ${r.levelBefore} → ${r.levelAfter}`;
        color = C.goldStr;
      } else {
        text = win ? `Lv ${r.levelAfter} · 경험치 획득` : '생존';
        color = C.dim;
      }
      if (r.fate === 'injured' && r.levelAfter > r.levelBefore) text = `Lv ${r.levelAfter} · ${text}`;
      box.add(this.add.text(270, y + 10, text, textStyle(r.fate === 'dead' ? 22 : 18, color)).setOrigin(1, 0));
    });

    const by = ph / 2 - 62;
    if (win) {
      box.add(button(this, 0, by, 440, 84, '귀환', () => this.leave('tower', {}), { size: 33 }));
    } else {
      box.add(button(this, -125, by, 220, 84, '탑으로', () => this.leave('tower', {}), { fill: C.panelHi, textColor: C.text, size: 22 }));
      box.add(button(this, 125, by, 220, 84, deaths > 0 ? '추모의 벽' : '영웅 목록', () => this.leave(deaths > 0 ? 'codex' : 'heroes', {}), { size: 22 }));
    }
    this.tweens.add({ targets: box, alpha: 1, y: { from: BASE_H / 2 + 30, to: BASE_H / 2 }, duration: 320, ease: 'Back.easeOut' });
  }

  /** 결과 창 연출은 배속과 무관하게 */
  private applySpeedReset(): void {
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
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
