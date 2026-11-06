import Phaser from 'phaser';
import type { Element } from '../battle/types';
import { C, ELEMENT_INFO, textStyle } from './theme';

/** 둥근 사각형 패널 */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = C.panel, stroke = C.line): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(3, stroke, 1).strokeRoundedRect(x, y, w, h, 10);
  return g;
}

/** 속성 칩 (불/물/바람/무) */
export function elementChip(scene: Phaser.Scene, x: number, y: number, el: Element, size = 22): Phaser.GameObjects.Container {
  const info = ELEMENT_INFO[el];
  const t = scene.add.text(0, 0, info.label, textStyle(size, '#14111c')).setOrigin(0.5);
  const w = t.width + 16;
  const h = size + 10;
  const g = scene.add.graphics();
  g.fillStyle(info.color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  return scene.add.container(x, y, [g, t]).setSize(w, h);
}

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): void;
  setLabel(s: string): void;
}

/** 탭 피드백이 있는 버튼 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onTap: () => void,
  opts: { fill?: number; textColor?: string; size?: number } = {},
): Button {
  const fill = opts.fill ?? C.gold;
  const g = scene.add.graphics();
  const draw = (pressed: boolean, enabled: boolean) => {
    g.clear();
    const f = enabled ? fill : 0x4a4258;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 12);
    g.fillStyle(f, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 4 : 0), w, h, 12);
    g.lineStyle(3, 0x1b1626, 1).strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 4 : 0), w, h, 12);
  };
  const t = scene.add.text(0, 0, label, textStyle(opts.size ?? 33, opts.textColor ?? '#1b1626')).setOrigin(0.5);
  const c = scene.add.container(x, y, [g, t]) as Button;
  let enabled = true;
  draw(false, true);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    if (!enabled) return;
    draw(true, true);
    t.y = 4;
  });
  const release = () => {
    draw(false, enabled);
    t.y = 0;
  };
  c.on('pointerout', release);
  c.on('pointerup', () => {
    if (!enabled) return;
    release();
    onTap();
  });
  c.setEnabled = (on: boolean) => {
    enabled = on;
    draw(false, on);
    t.setColor(on ? opts.textColor ?? '#1b1626' : '#8a8096');
  };
  c.setLabel = (s: string) => t.setText(s);
  return c;
}
