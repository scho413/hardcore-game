import Phaser from 'phaser';
import { weaponIcon } from '../art/itemArt';
import { CLASSES, type ClassId } from '../data/classes';
import {
  DIFFICULTIES,
  GRADES,
  breakChance,
  canCraft,
  gradeOdds,
  judgeCount,
  makeWeapon,
  optText,
  recipeFor,
  rollGrade,
  specialText,
  spendMats,
  weaponName,
  type Difficulty,
  type Weapon,
} from '../data/items';
import { game, newId, save } from '../state';
import { BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';
import { fitScale } from '../art/hd';
import { button, panel } from '../ui/widgets';

type StepKind = 'heat' | 'hammer' | 'quench' | 'engrave';

const HOW: Record<StepKind, { name: string; how: string }> = {
  heat: { name: '가열', how: '누르고 있으면 온도가 오릅니다\n움직이는 초록 구간에 머무르세요' },
  hammer: { name: '망치질', how: '움직이는 표시가 초록에 올 때 탭' },
  quench: { name: '담금질', how: '게이지가 점점 빨리 차오릅니다\n초록 구간에서 한 번 탭' },
  engrave: { name: '각인', how: '줄어드는 고리가 표식에 겹칠 때 탭' },
};

const HEAT_TIME = 3;

/**
 * 대장간 미니게임 (GDD 7). 판정 하나에 성공할 때마다 위 등급 확률이 오름.
 * 끝나면 파손 판정 → 등급 추첨. 시작할 때 재료를 먼저 소모해서 저장 (중간에 꺼도 되돌릴 수 없음)
 */
export class ForgeScene extends Phaser.Scene {
  private cls: ClassId = 'knight';
  private diff: Difficulty = 1;
  private steps: { kind: StepKind; n: number }[] = [];
  private step = 0;
  /** 판정별 점수 0~1 */
  private scores: number[] = [];
  private active = false;
  private holding = false;
  private t = 0;
  // 단계별 상태
  private round = 0;
  private temp = 0;
  private inBand = 0;
  private hits = 0;
  private fill = 0;
  private ring = 1;
  // 그리기
  private gfx!: Phaser.GameObjects.Graphics;
  private oddsGfx!: Phaser.GameObjects.Graphics;
  private oddsTexts: Phaser.GameObjects.Text[] = [];
  private breakText!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private how!: Phaser.GameObjects.Text;
  private icon!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;

  constructor() {
    super('forge');
  }

  init(data: { cls: ClassId; diff: Difficulty }): void {
    this.cls = data.cls;
    this.diff = data.diff;
    const d = DIFFICULTIES[this.diff];
    this.steps = [
      { kind: 'heat' as const, n: d.heat },
      { kind: 'hammer' as const, n: d.hammer },
      { kind: 'quench' as const, n: d.quench },
      { kind: 'engrave' as const, n: d.engrave },
    ].filter((s) => s.n > 0);
    this.step = 0;
    this.scores = [];
    this.active = false;
    this.holding = false;
    this.oddsTexts = [];
  }

  private get h(): number {
    return DIFFICULTIES[this.diff].hard;
  }

  /** 지금까지 성공한 만큼의 점수 (남은 판정은 0으로 침) */
  private get score(): number {
    const total = judgeCount(this.diff);
    return total ? this.scores.reduce((a, b) => a + b, 0) / total : 0;
  }

  create(): void {
    this.cameras.main.setScroll(0, -OY);
    const d = game.data;
    if (!canCraft(d.materials, this.cls, this.diff)) {
      this.scene.start('smithy');
      return;
    }
    spendMats(d.materials, recipeFor(this.cls, this.diff));
    save();

    const g = this.add.graphics();
    g.fillStyle(C.bgDeep, 1).fillRect(0, TOP, W, BOTTOM - TOP);
    // 화로와 모루
    g.fillStyle(0x2a2030, 1).fillRect(0, 560, W, BOTTOM - 560);
    g.fillStyle(0x3a3040, 1).fillRect(0, 560, W, 8);
    g.fillStyle(0x4a4458, 1).fillRoundedRect(W / 2 - 170, 440, 340, 60, 8);
    g.fillStyle(0x3a3448, 1).fillRect(W / 2 - 70, 500, 140, 60);
    g.fillStyle(0x2e2a3a, 1).fillRect(W / 2 - 120, 548, 240, 20);

    const def = DIFFICULTIES[this.diff];
    this.glow = this.add.graphics();
    this.icon = this.add.image(W / 2, 360, weaponIcon(this, this.cls, def.tier, 0)).setScale(fitScale(this, weaponIcon(this, this.cls, def.tier, 0), 14));

    this.add.text(W / 2, TOP + 60, `${CLASSES[this.cls].name} 무기 · 난이도 ${def.name}`, textStyle(22, C.dim)).setOrigin(0.5);
    this.title = this.add.text(W / 2, TOP + 120, '', textStyle(55, C.goldStr)).setOrigin(0.5);
    this.how = this.add.text(W / 2, 640, '', textStyle(22, C.text, { align: 'center', lineSpacing: 8 })).setOrigin(0.5, 0);
    this.gfx = this.add.graphics();
    this.oddsGfx = this.add.graphics();
    this.breakText = this.add.text(W / 2, BOTTOM - 40, '', textStyle(18, C.redStr)).setOrigin(0.5);
    this.drawOdds();

    this.input.on('pointerdown', () => this.press());
    this.input.on('pointerup', () => (this.holding = false));
    this.events.once('shutdown', () => this.input.removeAllListeners());

    this.cameras.main.fadeIn(200, 11, 9, 16);
    if (this.steps.length === 0) this.time.delayedCall(300, () => this.reveal());
    else this.beginStep();
  }

  // ───────── 등급 확률 막대 ─────────
  private drawOdds(): void {
    const odds = gradeOdds(this.diff, this.score);
    const g = this.oddsGfx.clear();
    const x0 = 40;
    const w = W - 80;
    const y = BOTTOM - 150;
    g.fillStyle(C.hpBack, 1).fillRoundedRect(x0, y, w, 26, 6);
    let x = x0;
    odds.forEach((p, i) => {
      const pw = (w * p) / 100;
      g.fillStyle(GRADES[i].color, 1).fillRect(x, y, pw, 26);
      x += pw;
    });
    if (this.oddsTexts.length === 0) {
      const cw = w / odds.length;
      odds.forEach((_, i) => this.oddsTexts.push(this.add.text(x0 + cw * i + cw / 2, y + 52, '', textStyle(18, GRADES[i].str, { align: 'center' })).setOrigin(0.5)));
    }
    odds.forEach((p, i) => this.oddsTexts[i].setText(`${GRADES[i].name}\n${p >= 10 ? Math.round(p) : p.toFixed(1)}%`));
    const br = breakChance(this.diff, this.score);
    this.breakText.setText(br > 0 ? `파손 확률 ${Math.round(br * 100)}% · 판정 ${this.scores.length}/${judgeCount(this.diff)}` : `판정 ${this.scores.length}/${judgeCount(this.diff)}`);
    this.breakText.setColor(br > 0 ? C.redStr : C.dim);
  }

  // ───────── 진행 ─────────
  private beginStep(): void {
    const s = this.steps[this.step];
    const info = HOW[s.kind];
    this.title.setText(`${this.step + 1}. ${info.name}${s.kind === 'heat' && s.n > 1 ? ` ${this.round + 1}/${s.n}` : ''}`);
    this.how.setText(s.kind === 'hammer' ? `${info.how}\n${s.n}번 내려칩니다` : info.how);
    this.temp = 0.2;
    this.inBand = 0;
    if (s.kind !== 'heat' || this.round === 0) this.hits = 0;
    this.fill = 0;
    this.ring = 1;
    this.t = 0;
    this.active = false;
    this.holding = false;
    const ready = this.add.text(W / 2, 1000, '준비…', textStyle(44, C.goldStr)).setOrigin(0.5);
    this.time.delayedCall(800, () => {
      ready.setText('시작!');
      this.tweens.add({ targets: ready, alpha: 0, scale: 1.4, duration: 400, onComplete: () => ready.destroy() });
      this.active = true;
    });
  }

  private press(): void {
    if (!this.active) return;
    const k = this.steps[this.step].kind;
    if (k === 'heat') this.holding = true;
    else if (k === 'hammer') this.strike();
    else if (k === 'quench') this.quench();
    else if (k === 'engrave') this.engrave();
  }

  update(_: number, dms: number): void {
    if (!this.active || this.step >= this.steps.length) return;
    const dt = Math.min(0.1, dms / 1000);
    this.t += dt;
    const k = this.steps[this.step].kind;
    if (k === 'heat') {
      this.temp = Phaser.Math.Clamp(this.temp + (this.holding ? 0.6 : -0.42) * dt, 0, 1);
      const [lo, hi] = this.heatBand();
      if (this.temp >= lo && this.temp <= hi) this.inBand += dt;
      if (this.t >= HEAT_TIME) this.judge(Math.min(1, this.inBand / (HEAT_TIME * 0.75)));
    } else if (k === 'quench') {
      this.fill += dt * (0.3 + this.fill * (0.85 + 0.5 * this.h));
      if (this.fill >= 1) {
        this.fill = 1;
        this.pop('너무 늦음', C.redStr);
        this.judge(0);
      }
    } else if (k === 'engrave') {
      this.ring -= dt / (1.4 - 0.4 * this.h);
      if (this.ring <= 0) {
        this.ring = 0;
        this.pop('놓침', C.redStr);
        this.judge(0);
      }
    }
    this.drawStep();
  }

  /** 가열 목표 구간 (난이도가 높을수록 좁고 빨리 움직임) */
  private heatBand(): [number, number] {
    const c = 0.62 + (0.1 + 0.12 * this.h) * Math.sin(this.t * (1.4 + 1.2 * this.h));
    const half = 0.1 - 0.04 * this.h;
    return [c - half, c + half];
  }

  private hammerZone(): number {
    return 0.13 - 0.05 * this.h;
  }

  /** 망치질 표시 위치 -1..1 (칠 때마다 빨라짐, 초월은 속도가 출렁임) */
  private hammerPos(): number {
    const speed = 2.6 + this.hits * 0.5 + 1.2 * this.h;
    const wobble = this.h >= 1 ? 0.6 * Math.sin(this.t * 2.3) : 0;
    return Math.sin(this.t * speed + wobble);
  }

  private quenchWin(): [number, number] {
    const half = 0.065 - 0.025 * this.h;
    return [0.8 - half, 0.8 + half];
  }

  private strike(): void {
    const x = this.hammerPos();
    const sc = Phaser.Math.Clamp(1 - Math.max(0, Math.abs(x) - this.hammerZone()) / 0.45, 0, 1);
    this.hits++;
    this.feedback(sc);
    this.cameras.main.shake(120, sc >= 0.6 ? 0.008 : 0.003);
    this.sparks(sc);
    this.scores.push(sc);
    this.drawOdds();
    if (this.hits >= this.steps[this.step].n) this.nextStep();
  }

  private quench(): void {
    const [lo, hi] = this.quenchWin();
    const f = this.fill;
    const dist = f < lo ? lo - f : f > hi ? f - hi : 0;
    const sc = Phaser.Math.Clamp(1 - dist / 0.2, 0, 1);
    this.feedback(sc);
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(W / 2 + Phaser.Math.Between(-120, 120), 420, Phaser.Math.Between(10, 24), 0xd8e0ea, 0.6);
      this.tweens.add({ targets: p, y: 260, alpha: 0, scale: 2, duration: 900, delay: i * 40, onComplete: () => p.destroy() });
    }
    this.judge(sc);
  }

  private engrave(): void {
    const target = 0.35;
    const sc = Phaser.Math.Clamp(1 - Math.max(0, Math.abs(this.ring - target) - 0.04) / 0.2, 0, 1);
    this.feedback(sc);
    this.cameras.main.flash(120, 200, 160, 255);
    this.judge(sc);
  }

  private feedback(sc: number): void {
    this.pop(sc >= 0.99 ? '완벽!' : sc >= 0.6 ? '좋음' : '실패', sc >= 0.99 ? C.goldStr : sc >= 0.6 ? C.greenStr : C.redStr);
  }

  /** 판정 1개 기록 후 다음으로 (가열은 라운드를 반복) */
  private judge(score: number): void {
    this.active = false;
    this.holding = false;
    this.scores.push(score);
    this.drawOdds();
    this.drawStep();
    const s = this.steps[this.step];
    if (s.kind === 'heat' && this.round + 1 < s.n) {
      this.round++;
      this.time.delayedCall(600, () => this.beginStep());
      return;
    }
    this.nextStep();
  }

  private nextStep(): void {
    this.active = false;
    this.round = 0;
    this.step++;
    this.time.delayedCall(700, () => {
      if (this.step < this.steps.length) this.beginStep();
      else this.reveal();
    });
  }

  private pop(text: string, color: string): void {
    const t = this.add.text(W / 2, 560, text, textStyle(44, color)).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: 500, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private sparks(power: number): void {
    const n = Math.round(4 + power * 10);
    for (let i = 0; i < n; i++) {
      const p = this.add.rectangle(W / 2, 430, 6, 6, i % 2 ? 0xffd25a : 0xff8a3a).setDepth(15);
      const a = Phaser.Math.FloatBetween(Math.PI * 1.05, Math.PI * 1.95);
      const r = Phaser.Math.Between(60, 200);
      this.tweens.add({ targets: p, x: W / 2 + Math.cos(a) * r, y: 430 + Math.sin(a) * r, alpha: 0, duration: 420, onComplete: () => p.destroy() });
    }
  }

  private drawStep(): void {
    const g = this.gfx;
    g.clear();
    if (this.step >= this.steps.length) return;
    const k = this.steps[this.step].kind;
    const bx = 80;
    const bw = W - 160;
    const by = 800;
    const bh = 56;
    if (k === 'heat') {
      const [lo, hi] = this.heatBand();
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(C.green, 0.45).fillRect(bx + bw * Math.max(0, lo), by, bw * (Math.min(1, hi) - Math.max(0, lo)), bh);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xb04a2a), Phaser.Display.Color.ValueToColor(0xfff0a0), 100, Math.round(this.temp * 100));
      const c = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
      g.fillStyle(c, 1).fillRoundedRect(bx, by + 14, Math.max(8, bw * this.temp), bh - 28, 6);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(0xffffff, 1).fillRect(bx + bw * this.temp - 2, by - 8, 4, bh + 16);
      g.fillStyle(C.gold, 1).fillRect(bx, by + bh + 18, bw * Math.max(0, 1 - this.t / HEAT_TIME), 6);
      this.icon.setTint(c);
      this.glow.clear().fillStyle(0xff7a2a, 0.15 + this.temp * 0.35).fillCircle(W / 2, 360, 80 + this.temp * 70);
    } else if (k === 'hammer') {
      this.icon.clearTint();
      this.glow.clear().fillStyle(0xff7a2a, 0.18).fillCircle(W / 2, 360, 110);
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      const zw = bw * this.hammerZone();
      g.fillStyle(C.green, 0.55).fillRect(W / 2 - zw / 2, by, zw, bh);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
      const x = W / 2 + this.hammerPos() * (bw / 2 - 10);
      g.fillStyle(0xffffff, 1).fillRect(x - 4, by - 10, 8, bh + 20);
      const n = this.steps[this.step].n;
      const done = this.scores.slice(this.scores.length - this.hits);
      for (let i = 0; i < n; i++) {
        const s = done[i];
        g.fillStyle(s === undefined ? 0x3d3352 : s >= 0.99 ? C.gold : s >= 0.6 ? C.green : C.red, 1).fillCircle(W / 2 - ((n - 1) * 44) / 2 + i * 44, by + bh + 40, 12);
      }
    } else if (k === 'quench') {
      this.icon.clearTint();
      this.glow.clear().fillStyle(0x6ab0ff, 0.12 + this.fill * 0.15).fillCircle(W / 2, 360, 120);
      const [lo, hi] = this.quenchWin();
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(C.green, 0.55).fillRect(bx + bw * lo, by, bw * (hi - lo), bh);
      g.fillStyle(0x6ab0ff, 1).fillRoundedRect(bx, by + 10, Math.max(8, bw * this.fill), bh - 20, 6);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
    } else if (k === 'engrave') {
      this.icon.clearTint();
      this.glow.clear().fillStyle(0xb07af0, 0.25).fillCircle(W / 2, 360, 130);
      const cx = W / 2;
      const cy = 880;
      const R = 150;
      g.lineStyle(14, C.green, 0.5).strokeCircle(cx, cy, R * 0.35);
      g.lineStyle(4, 0xffffff, 1).strokeCircle(cx, cy, Math.max(2, R * this.ring));
      g.fillStyle(0xb07af0, 1).fillCircle(cx, cy, 10);
    }
  }

  // ───────── 결과 ─────────
  private reveal(): void {
    const def = DIFFICULTIES[this.diff];
    const score = this.score;
    const d = game.data;
    this.gfx.clear();
    this.how.setText('');
    this.icon.clearTint();

    const br = breakChance(this.diff, score);
    if (br > 0 && Math.random() < br) {
      save();
      this.title.setText('파손!').setColor(C.redStr);
      this.cameras.main.shake(500, 0.02);
      this.glow.clear().fillStyle(0xe0503a, 0.25).fillCircle(W / 2, 360, 160);
      this.icon.setTint(0x5a4a4a);
      this.tweens.add({ targets: this.icon, angle: 25, alpha: 0.3, y: 420, duration: 600, ease: 'Quad.easeIn' });
      const box = this.add.container(0, 0).setDepth(30).setAlpha(0);
      box.add(panel(this, 40, 640, W - 80, 300, C.panel, C.red));
      box.add(this.add.text(W / 2, 700, '무기가 부서졌습니다', textStyle(33, C.redStr)).setOrigin(0.5));
      box.add(this.add.text(W / 2, 752, `파손 확률 ${Math.round(br * 100)}% · 재료는 사라졌습니다`, textStyle(18, C.dim)).setOrigin(0.5));
      this.addButtons(box, 860, true);
      this.tweens.add({ targets: box, alpha: 1, duration: 300, delay: 500 });
      return;
    }

    const grade = rollGrade(this.diff, score, Math.random);
    const w: Weapon = makeWeapon(newId('w', d), this.cls, def.tier, grade, Math.random, Date.now());
    d.stash.push(w);
    save();

    this.title.setText('완성!');
    this.icon.setTexture(weaponIcon(this, w.cls, w.tier, w.grade)).setScale(fitScale(this, weaponIcon(this, w.cls, w.tier, w.grade), 4));
    this.tweens.add({ targets: this.icon, scale: fitScale(this, this.icon.texture.key, 16), duration: 500, ease: 'Back.easeOut' });
    const gc = GRADES[grade];
    this.glow.clear().fillStyle(gc.color, 0.3).fillCircle(W / 2, 360, 170);
    if (grade >= 3) this.cameras.main.flash(300, (gc.color >> 16) & 255, (gc.color >> 8) & 255, gc.color & 255);

    const lines = [`공격력 +${Math.round(w.atk * 100)}%`, ...w.opts.map(optText)];
    const specials = w.specials.map(specialText);
    const ph = 300 + lines.length * 28 + specials.length * 52;
    const box = this.add.container(0, 0).setDepth(30).setAlpha(0);
    box.add(panel(this, 40, 610, W - 80, ph, C.panel, gc.color));
    box.add(this.add.text(W / 2, 660, gc.name, textStyle(44, gc.str)).setOrigin(0.5));
    box.add(this.add.text(W / 2, 716, weaponName(w), textStyle(26, C.text)).setOrigin(0.5));
    let y = 752;
    for (const l of lines) {
      box.add(this.add.text(W / 2, y, l, textStyle(18, C.dim)).setOrigin(0.5, 0));
      y += 28;
    }
    for (const s of specials) {
      box.add(this.add.text(W / 2, y + 6, s, textStyle(18, gc.str, { align: 'center', wordWrap: { width: W - 140 } })).setOrigin(0.5, 0));
      y += 52;
    }
    box.add(this.add.text(W / 2, y + 12, `솜씨 ${Math.round(score * 100)}%`, textStyle(18, C.faint)).setOrigin(0.5, 0));
    this.addButtons(box, 610 + ph - 66);
    this.tweens.add({ targets: box, alpha: 1, duration: 300, delay: 400 });
  }

  private addButtons(box: Phaser.GameObjects.Container, y: number, broken = false): void {
    const can = canCraft(game.data.materials, this.cls, this.diff);
    if (broken && !can) {
      box.add(button(this, W / 2, y, 300, 84, '대장간으로', () => this.leave('smithy'), { fill: C.panelHi, textColor: C.text, size: 22 }));
      return;
    }
    box.add(button(this, W / 2 - 150, y, 270, 84, '대장간으로', () => this.leave('smithy'), { fill: C.panelHi, textColor: C.text, size: 22 }));
    box.add(
      button(this, W / 2 + 150, y, 270, 84, can ? (broken ? '다시 도전' : '한 번 더') : '영웅에게 장착', () => {
        if (can) this.scene.restart({ cls: this.cls, diff: this.diff });
        else this.leave('heroes');
      }, { size: 22 }),
    );
  }

  private leave(scene: string): void {
    this.cameras.main.fadeOut(160, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }
}
