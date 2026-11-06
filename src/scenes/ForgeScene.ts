import Phaser from 'phaser';
import { weaponIcon } from '../art/itemArt';
import { CLASSES, type ClassId } from '../data/classes';
import { GRADES, TIER_CAP, canCraft, gradeFromScore, recipeFor, weaponDesc, weaponName, type Tier, type Weapon } from '../data/items';
import { game, newId, save } from '../state';
import { BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';

type Phase = 'heat' | 'hammer' | 'quench' | 'done';

const STEPS: { id: Phase; name: string; how: string }[] = [
  { id: 'heat', name: '가열', how: '누르고 있으면 온도가 오릅니다\n초록 구간에 오래 머무르세요' },
  { id: 'hammer', name: '망치질', how: '움직이는 표시가 가운데에 올 때 탭\n4번 내려칩니다' },
  { id: 'quench', name: '담금질', how: '게이지가 차오릅니다\n초록 구간에서 한 번 탭' },
];

const HEAT_TIME = 4;
const HAMMER_HITS = 4;
const HAMMER_ZONE = 0.12;
const QUENCH_WIN: [number, number] = [0.74, 0.86];

/**
 * 대장간 미니게임 (GDD 7): 가열 → 망치질 → 담금질. 세 점수 평균으로 등급 결정.
 * 시작할 때 재료를 먼저 소모해서 저장 (중간에 꺼도 되돌릴 수 없음)
 */
export class ForgeScene extends Phaser.Scene {
  private cls: ClassId = 'knight';
  private tier: Tier = 1;
  private step = 0;
  private scores: number[] = [];
  private active = false;
  private holding = false;
  private t = 0;
  // 단계별 상태
  private temp = 0;
  private inBand = 0;
  private hits: number[] = [];
  private fill = 0;
  // 그리기
  private gfx!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private how!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private icon!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;

  constructor() {
    super('forge');
  }

  init(data: { cls: ClassId; tier: Tier }): void {
    this.cls = data.cls;
    this.tier = data.tier;
    this.step = 0;
    this.scores = [];
    this.active = false;
    this.holding = false;
  }

  create(): void {
    this.cameras.main.setScroll(0, -OY);
    const d = game.data;
    if (!canCraft(d.materials, this.cls, this.tier)) {
      this.scene.start('base');
      return;
    }
    for (const r of recipeFor(this.cls, this.tier)) d.materials[r.id] = (d.materials[r.id] ?? 0) - r.n;
    save();

    const g = this.add.graphics();
    g.fillStyle(C.bgDeep, 1).fillRect(0, TOP, W, BOTTOM - TOP);
    // 화로와 모루
    g.fillStyle(0x2a2030, 1).fillRect(0, 560, W, BOTTOM - 560);
    g.fillStyle(0x3a3040, 1).fillRect(0, 560, W, 8);
    g.fillStyle(0x4a4458, 1).fillRoundedRect(W / 2 - 170, 440, 340, 60, 8);
    g.fillStyle(0x3a3448, 1).fillRect(W / 2 - 70, 500, 140, 60);
    g.fillStyle(0x2e2a3a, 1).fillRect(W / 2 - 120, 548, 240, 20);

    this.glow = this.add.graphics();
    this.icon = this.add.image(W / 2, 360, weaponIcon(this, this.cls, this.tier, 0)).setScale(14);

    this.add.text(W / 2, TOP + 60, `${CLASSES[this.cls].name} 무기 · ${this.tier}단계 재료`, textStyle(22, C.dim)).setOrigin(0.5);
    this.title = this.add.text(W / 2, TOP + 120, '', textStyle(55, C.goldStr)).setOrigin(0.5);
    this.how = this.add.text(W / 2, 640, '', textStyle(22, C.text, { align: 'center', lineSpacing: 8 })).setOrigin(0.5, 0);
    this.gfx = this.add.graphics();
    this.scoreText = this.add.text(W / 2, BOTTOM - 70, '', textStyle(22, C.dim)).setOrigin(0.5);

    this.input.on('pointerdown', () => this.press());
    this.input.on('pointerup', () => (this.holding = false));
    this.events.once('shutdown', () => this.input.removeAllListeners());

    this.cameras.main.fadeIn(200, 11, 9, 16);
    this.beginStep();
  }

  private beginStep(): void {
    const s = STEPS[this.step];
    this.title.setText(`${this.step + 1}. ${s.name}`);
    this.how.setText(s.how);
    this.temp = 0.2;
    this.inBand = 0;
    this.hits = [];
    this.fill = 0;
    this.t = 0;
    this.active = false;
    this.holding = false;
    this.refreshScores();
    const ready = this.add.text(W / 2, 1000, '준비…', textStyle(44, C.goldStr)).setOrigin(0.5);
    this.time.delayedCall(900, () => {
      ready.setText('시작!');
      this.tweens.add({ targets: ready, alpha: 0, scale: 1.4, duration: 400, onComplete: () => ready.destroy() });
      this.active = true;
    });
  }

  private press(): void {
    if (!this.active) return;
    const s = STEPS[this.step].id;
    if (s === 'heat') this.holding = true;
    else if (s === 'hammer') this.strike();
    else if (s === 'quench') this.quench();
  }

  update(_: number, dms: number): void {
    if (!this.active || this.step >= STEPS.length) return;
    const dt = Math.min(0.1, dms / 1000);
    this.t += dt;
    const s = STEPS[this.step].id;
    if (s === 'heat') {
      this.temp += (this.holding ? 0.6 : -0.42) * dt;
      this.temp = Phaser.Math.Clamp(this.temp, 0, 1);
      const [lo, hi] = this.heatBand();
      if (this.temp >= lo && this.temp <= hi) this.inBand += dt;
      if (this.t >= HEAT_TIME) this.finish(Math.min(1, this.inBand / (HEAT_TIME * 0.8)));
    } else if (s === 'quench') {
      this.fill += dt * (0.3 + this.fill * 0.85);
      if (this.fill >= 1) {
        this.fill = 1;
        this.pop('너무 늦음', C.redStr);
        this.finish(0);
      }
    }
    this.drawStep();
  }

  /** 가열 목표 구간 (천천히 움직임) */
  private heatBand(): [number, number] {
    const c = 0.66 + 0.1 * Math.sin(this.t * 1.4);
    return [c - 0.09, c + 0.09];
  }

  /** 망치질 표시 위치 -1..1 (칠 때마다 빨라짐) */
  private hammerPos(): number {
    const speed = 2.6 + this.hits.length * 0.7;
    return Math.sin(this.t * speed);
  }

  private strike(): void {
    const x = this.hammerPos();
    const sc = Phaser.Math.Clamp(1 - Math.max(0, Math.abs(x) - HAMMER_ZONE) / 0.55, 0, 1);
    this.hits.push(sc);
    this.pop(sc >= 0.99 ? '완벽!' : sc >= 0.6 ? '좋음' : '빗나감', sc >= 0.99 ? C.goldStr : sc >= 0.6 ? C.greenStr : C.redStr);
    this.cameras.main.shake(120, sc >= 0.6 ? 0.008 : 0.003);
    this.sparks(sc);
    if (this.hits.length >= HAMMER_HITS) this.finish(this.hits.reduce((a, b) => a + b, 0) / HAMMER_HITS);
  }

  private quench(): void {
    const f = this.fill;
    const [lo, hi] = QUENCH_WIN;
    const dist = f < lo ? lo - f : f > hi ? f - hi : 0;
    const sc = Phaser.Math.Clamp(1 - dist / 0.25, 0, 1);
    this.pop(sc >= 0.99 ? '완벽!' : sc >= 0.6 ? '좋음' : '실패', sc >= 0.99 ? C.goldStr : sc >= 0.6 ? C.greenStr : C.redStr);
    // 증기
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(W / 2 + Phaser.Math.Between(-120, 120), 420, Phaser.Math.Between(10, 24), 0xd8e0ea, 0.6);
      this.tweens.add({ targets: p, y: 260, alpha: 0, scale: 2, duration: 900, delay: i * 40, onComplete: () => p.destroy() });
    }
    this.finish(sc);
  }

  private finish(score: number): void {
    this.active = false;
    this.holding = false;
    this.scores.push(score);
    this.refreshScores();
    this.drawStep();
    this.step++;
    this.time.delayedCall(800, () => {
      if (this.step < STEPS.length) this.beginStep();
      else this.reveal();
    });
  }

  private refreshScores(): void {
    this.scoreText.setText(STEPS.map((s, i) => `${s.name} ${this.scores[i] === undefined ? '-' : `${Math.round(this.scores[i] * 100)}%`}`).join('   '));
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
    const s = STEPS[Math.min(this.step, STEPS.length - 1)].id;
    const bx = 80;
    const bw = W - 160;
    const by = 820;
    const bh = 56;
    if (s === 'heat') {
      const [lo, hi] = this.heatBand();
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(C.green, 0.45).fillRect(bx + bw * lo, by, bw * (hi - lo), bh);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xb04a2a),
        Phaser.Display.Color.ValueToColor(0xfff0a0),
        100,
        Math.round(this.temp * 100),
      );
      const c = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
      g.fillStyle(c, 1).fillRoundedRect(bx, by + 14, Math.max(8, bw * this.temp), bh - 28, 6);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(0xffffff, 1).fillRect(bx + bw * this.temp - 2, by - 8, 4, bh + 16);
      // 남은 시간
      g.fillStyle(C.gold, 1).fillRect(bx, by + bh + 18, bw * Math.max(0, 1 - this.t / HEAT_TIME), 6);
      // 쇠 달구기
      this.icon.setTint(c);
      this.glow.clear().fillStyle(0xff7a2a, 0.15 + this.temp * 0.35).fillCircle(W / 2, 360, 80 + this.temp * 70);
    } else if (s === 'hammer') {
      this.icon.clearTint();
      this.glow.clear().fillStyle(0xff7a2a, 0.18).fillCircle(W / 2, 360, 110);
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      const zw = bw * HAMMER_ZONE;
      g.fillStyle(C.green, 0.55).fillRect(W / 2 - zw / 2, by, zw, bh);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
      const x = W / 2 + this.hammerPos() * (bw / 2 - 10);
      g.fillStyle(0xffffff, 1).fillRect(x - 4, by - 10, 8, bh + 20);
      for (let i = 0; i < HAMMER_HITS; i++) {
        const h = this.hits[i];
        g.fillStyle(h === undefined ? 0x3d3352 : h >= 0.99 ? C.gold : h >= 0.6 ? C.green : C.red, 1).fillCircle(W / 2 - 66 + i * 44, by + bh + 40, 12);
      }
    } else if (s === 'quench') {
      this.icon.clearTint();
      this.glow.clear().fillStyle(0x6ab0ff, 0.12 + this.fill * 0.15).fillCircle(W / 2, 360, 120);
      const [lo, hi] = QUENCH_WIN;
      g.fillStyle(C.hpBack, 1).fillRoundedRect(bx, by, bw, bh, 10);
      g.fillStyle(C.green, 0.55).fillRect(bx + bw * lo, by, bw * (hi - lo), bh);
      g.fillStyle(0x6ab0ff, 1).fillRoundedRect(bx, by + 10, Math.max(8, bw * this.fill), bh - 20, 6);
      g.lineStyle(3, C.line, 1).strokeRoundedRect(bx, by, bw, bh, 10);
    }
  }

  private reveal(): void {
    const score = this.scores.reduce((a, b) => a + b, 0) / this.scores.length;
    const grade = gradeFromScore(score, this.tier);
    const d = game.data;
    const w: Weapon = { id: newId('w', d), cls: this.cls, tier: this.tier, grade, madeAt: Date.now() };
    d.stash.push(w);
    save();

    this.gfx.clear();
    this.how.setText('');
    this.title.setText('완성!');
    this.icon.clearTint().setTexture(weaponIcon(this, w.cls, w.tier, w.grade)).setScale(4);
    this.tweens.add({ targets: this.icon, scale: 16, duration: 500, ease: 'Back.easeOut' });
    const gc = GRADES[grade];
    this.glow.clear().fillStyle(gc.color, 0.3).fillCircle(W / 2, 360, 170);
    if (grade >= 3) this.cameras.main.flash(300, (gc.color >> 16) & 255, (gc.color >> 8) & 255, gc.color & 255);

    const box = this.add.container(0, 0).setDepth(30).setAlpha(0);
    box.add(panel(this, 40, 640, W - 80, 380, C.panel, gc.color));
    box.add(this.add.text(W / 2, 690, gc.name, textStyle(44, gc.str)).setOrigin(0.5));
    box.add(this.add.text(W / 2, 750, weaponName(w), textStyle(26, C.text)).setOrigin(0.5));
    box.add(this.add.text(W / 2, 796, weaponDesc(w), textStyle(22, C.dim)).setOrigin(0.5));
    box.add(this.add.text(W / 2, 846, `솜씨 ${Math.round(score * 100)}%${grade === TIER_CAP[this.tier] ? ' · 이 재료의 최고 등급!' : ` · 최고 등급은 85% 이상`}`, textStyle(18, grade === TIER_CAP[this.tier] ? C.goldStr : C.faint)).setOrigin(0.5));
    const can = canCraft(d.materials, this.cls, this.tier);
    box.add(button(this, W / 2 - 150, 950, 270, 84, '대장간으로', () => this.leave('base'), { fill: C.panelHi, textColor: C.text, size: 22 }));
    const again = button(this, W / 2 + 150, 950, 270, 84, can ? '한 번 더' : '영웅에게 장착', () => {
      if (can) this.scene.restart({ cls: this.cls, tier: this.tier });
      else this.leave('heroes');
    }, { size: 22 });
    box.add(again);
    this.tweens.add({ targets: box, alpha: 1, duration: 300, delay: 400 });
  }

  private leave(scene: string): void {
    this.cameras.main.fadeOut(160, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }
}
