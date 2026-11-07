import Phaser from 'phaser';
import { fatigueNow } from '../data/heroes';
import { game, refresh, save } from '../state';
import { drawDialog, resolveSpeaker, tutDone, tutSkip, tutStep, guideHero, type Rect } from '../tutorial/overlay';
import { GUIDE_NAME } from '../tutorial/steps';
import { ensureHeroTextures } from '../art/textures';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from './theme';

export type TabKey = 'base' | 'heroes' | 'tower' | 'dungeon' | 'codex';

const TABS: { key: TabKey; label: string; scene?: string }[] = [
  { key: 'base', label: '기지', scene: 'base' },
  { key: 'heroes', label: '영웅', scene: 'heroes' },
  { key: 'tower', label: '탑', scene: 'tower' },
  { key: 'dungeon', label: '던전', scene: 'dungeon' },
  { key: 'codex', label: '도감', scene: 'codex' },
];

export const TAB_H = 104;

/**
 * 하단 탭이 있는 화면의 공통 뼈대 (GDD 12).
 * 상태가 바뀌면 render()로 화면 전체를 다시 그리는 단순한 방식.
 * 중상 회복 타이머가 있으면 1초마다 다시 그림.
 */
export abstract class Page extends Phaser.Scene {
  protected abstract tab: TabKey;
  private pending = false;
  /** 튜토리얼이 강조할 수 있는 영역 (draw 중에 mark로 등록) */
  private marks = new Map<string, Rect>();
  /** 상황별 도움말 (처음 한 번) */
  private pendingTip: { id: string; text: string } | null = null;

  create(): void {
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.fadeIn(160, 11, 9, 16);
    this.onEnter();
    this.render();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        // 회복 타이머(중상·피로)가 돌고 있으면 1초마다 다시 그림. 누르고 있는 중에는 건너뜀 (탭이 끊기지 않게)
        if (this.input.activePointer.isDown) return;
        const now = Date.now();
        if (game.data.heroes.some((h) => h.status === 'injured' || (h.status !== 'dead' && fatigueNow(h, now) > 0))) this.render();
      },
    });
  }

  /** 화면에 들어올 때 상태 초기화 */
  protected onEnter(): void {}

  protected abstract draw(): void;

  /** 입력 처리 중에 바로 지우지 않도록 다음 프레임에 다시 그림 */
  requestRender(): void {
    if (this.pending) return;
    this.pending = true;
    this.events.once('postupdate', () => {
      this.pending = false;
      this.render();
    });
  }

  render(): void {
    refresh();
    this.children.removeAll(true);
    this.marks.clear();
    this.draw();
    this.drawTabs();
    this.drawTutorial();
  }

  /** 튜토리얼 강조 대상 등록 */
  mark(key: string, x: number, y: number, w: number, h: number): void {
    this.marks.set(key, { x, y, w, h });
  }

  /** 상황별 도움말: 처음이면 다음 그리기에서 보여줌 */
  tip(id: string, text: string): void {
    const d = game.data;
    if (tutStep()) return;
    if ((d.tips ?? []).includes(id) || this.pendingTip) return;
    this.pendingTip = { id, text };
  }

  private drawTutorial(): void {
    const step = tutStep();
    const top = PAGE_TOP;
    const bottom = PAGE_BOTTOM;
    if (step) {
      if (step.scene !== this.scene.key) return;
      const sp = resolveSpeaker(this, step);
      drawDialog(this, {
        name: sp.name,
        face: sp.face,
        text: sp.text,
        target: step.target ? this.marks.get(step.target) : undefined,
        mode: step.mode,
        top,
        bottom,
        onTap: () => {
          tutDone(step.id);
          this.requestRender();
        },
        onSkip: () => {
          tutSkip();
          this.requestRender();
        },
      });
      return;
    }
    if (this.pendingTip) {
      const tp = this.pendingTip;
      const g = guideHero();
      ensureHeroTextures(this, g);
      drawDialog(this, {
        name: GUIDE_NAME,
        face: `face-${g.id}`,
        text: tp.text,
        mode: 'tap',
        top,
        bottom,
        onTap: () => {
          game.data.tips = [...(game.data.tips ?? []), tp.id];
          save();
          this.pendingTip = null;
          this.requestRender();
        },
      });
    }
  }

  /** fn 안에서 만든 오브젝트를 모두 depth 위로 올림 (오버레이용) */
  layer(depth: number, fn: () => void): void {
    const before = new Set(this.children.list);
    fn();
    for (const o of this.children.list) {
      if (!before.has(o)) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(depth);
    }
  }

  go(scene: string, data: object = {}): void {
    this.cameras.main.fadeOut(140, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  /** 튜토리얼 말풍선 (위아래로 살짝 움직임) */
  hint(x: number, y: number, text: string): void {
    const g = this.add.graphics().setDepth(95);
    const t = this.add.text(x, y, text, textStyle(22, '#1b1626', { align: 'center' })).setOrigin(0.5).setDepth(96);
    g.fillStyle(C.gold, 1).fillRoundedRect(x - t.width / 2 - 14, y - t.height / 2 - 10, t.width + 28, t.height + 20, 10);
    g.fillTriangle(x - 10, y + t.height / 2 + 10, x + 10, y + t.height / 2 + 10, x, y + t.height / 2 + 22);
    this.tweens.add({ targets: [t, g], y: '-=6', yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
  }

  private drawTabs(): void {
    const top = PAGE_BOTTOM - TAB_H;
    const g = this.add.graphics().setDepth(90);
    g.fillStyle(C.bgDeep, 1).fillRect(0, top, W, TAB_H);
    g.fillStyle(C.line, 1).fillRect(0, top, W, 3);
    const w = W / TABS.length;
    const d = game.data;
    // 잠금: 던전은 대장간을 지은 뒤 (GDD 9 튜토리얼)
    const lock = (k: TabKey) => (k === 'dungeon' && !d.test && d.facilities.smithy < 1 ? '대장간 필요' : null);
    TABS.forEach((t, i) => {
      const cx = w * i + w / 2;
      const active = t.key === this.tab;
      const locked = lock(t.key);
      const enabled = !!t.scene && !locked;
      if (active) g.fillStyle(C.gold, 1).fillRect(w * i + 18, top, w - 36, 6);
      const color = active ? C.goldStr : enabled ? C.text : C.faint;
      this.add.text(cx, top + TAB_H / 2 - (enabled ? 0 : 10), t.label, textStyle(22, color)).setOrigin(0.5).setDepth(91);
      if (!enabled) this.add.text(cx, top + TAB_H / 2 + 18, locked ?? '준비 중', textStyle(18, C.faint)).setOrigin(0.5).setDepth(91);
      this.mark(`tab-${t.key}`, w * i, top, w, TAB_H);
      if (enabled && !active) {
        this.add
          .zone(cx, top + TAB_H / 2, w, TAB_H)
          .setDepth(92)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => {
            tutDone(`tab${t.key[0].toUpperCase()}${t.key.slice(1)}`);
            this.go(t.scene!);
          });
      }
    });
  }
}
