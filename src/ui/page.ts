import Phaser from 'phaser';
import { game, refresh } from '../state';
import { C, PAGE_BOTTOM, W, textStyle } from './theme';

export type TabKey = 'base' | 'heroes' | 'tower' | 'dungeon' | 'codex';

const TABS: { key: TabKey; label: string; scene?: string }[] = [
  { key: 'base', label: '기지' },
  { key: 'heroes', label: '영웅', scene: 'heroes' },
  { key: 'tower', label: '탑', scene: 'tower' },
  { key: 'dungeon', label: '던전' },
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

  create(): void {
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.fadeIn(160, 11, 9, 16);
    this.onEnter();
    this.render();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (game.data.heroes.some((h) => h.status === 'injured')) this.render();
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
    this.draw();
    this.drawTabs();
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

  private drawTabs(): void {
    const top = PAGE_BOTTOM - TAB_H;
    const g = this.add.graphics().setDepth(90);
    g.fillStyle(C.bgDeep, 1).fillRect(0, top, W, TAB_H);
    g.fillStyle(C.line, 1).fillRect(0, top, W, 3);
    const w = W / TABS.length;
    TABS.forEach((t, i) => {
      const cx = w * i + w / 2;
      const active = t.key === this.tab;
      const enabled = !!t.scene;
      if (active) g.fillStyle(C.gold, 1).fillRect(w * i + 18, top, w - 36, 6);
      const color = active ? C.goldStr : enabled ? C.text : C.faint;
      this.add.text(cx, top + TAB_H / 2 - (enabled ? 0 : 10), t.label, textStyle(22, color)).setOrigin(0.5).setDepth(91);
      if (!enabled) this.add.text(cx, top + TAB_H / 2 + 18, '준비 중', textStyle(18, C.faint)).setOrigin(0.5).setDepth(91);
      if (enabled && !active) {
        this.add
          .zone(cx, top + TAB_H / 2, w, TAB_H)
          .setDepth(92)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.go(t.scene!));
      }
    });
  }
}
