import type { Row } from '../battle/types';
import { ensureHeroTextures } from '../art/textures';
import { FORMATIONS, FORMATION_IDS, slotPosition } from '../data/formations';
import { canAfford } from '../data/heroes';
import { autoFormation } from '../data/autoFormation';
import { game, heroById, isAvailable, living, save } from '../state';
import { heroCard, shade, statusLine } from './heroUi';
import { tutDone } from '../tutorial/overlay';
import type { Page } from './page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from './theme';
import { button, panel } from './widgets';

export const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;

/**
 * 진형 선택 + 5칸 배치 + 영웅 선택창. 탑·던전 화면이 함께 씀 (진형은 하나를 공유).
 * cost: 이 화면의 출전 피로 비용. 피로가 모자란 영웅은 카드에 표시
 */
export class FormationPanel {
  picking: number | null = null;

  constructor(
    private page: Page,
    private costLabel: string,
  ) {}

  /** 진형 패널을 그리고 아래쪽 y를 돌려줌 */
  private firstEmptyMarked = false;

  draw(top: number, cost: number): number {
    const s = this.page;
    this.firstEmptyMarked = false;
    const ftype = game.data.formationType;
    s.add.text(28, top, '진형', textStyle(33));
    s.add.text(110, top + 10, '칸을 탭해 영웅 배치 · 전열이 먼저 맞음', textStyle(18, C.dim));
    // 자동 배치: 고른 진형에 맞춰 출전 가능한 영웅으로 가장 좋은 조합 (적 정보는 쓰지 않음)
    const auto = button(s, W - 104, top + 18, 156, 48, '자동 배치', () => {
      game.data.formation = autoFormation(living(), ftype, cost);
      save();
      s.requestRender();
    }, { fill: C.panelHi, textColor: C.goldStr, size: 18 });
    auto.setEnabled(living().some((h) => isAvailable(h) && canAfford(h, cost)));

    // 진형 종류 (GDD 4.1.1)
    const cw = 124;
    FORMATION_IDS.forEach((id, i) => {
      const on = id === ftype;
      button(s, 34 + cw / 2 + i * (cw + 8), top + 72, cw, 50, FORMATIONS[id].name, () => {
        game.data.formationType = id;
        save();
        s.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });
    s.add.text(28, top + 108, FORMATIONS[ftype].desc, textStyle(18, '#9fd0ff'));

    const rows: Row[] = ['front', 'mid', 'back'];
    const slotsByRow = new Map<Row, number[]>();
    for (let i = 0; i < 5; i++) {
      const r = slotPosition(ftype, i).row;
      slotsByRow.set(r, [...(slotsByRow.get(r) ?? []), i]);
    }
    let ry = top + 140;
    const cardH = 92;
    for (const row of rows) {
      const slots = slotsByRow.get(row) ?? [];
      if (slots.length === 0) continue;
      s.add.text(28, ry, ROW_LABEL[row], textStyle(18, C.faint));
      const n = slots.length;
      const cardW = n === 3 ? 214 : 316;
      const gap = n === 3 ? 8 : 16;
      const total = n * cardW + (n - 1) * gap;
      slots.forEach((slot, k) => {
        const x = W / 2 - total / 2 + k * (cardW + gap);
        const y = ry + 24;
        const hero = heroById(game.data.formation[slot]);
        s.mark(`slot${slot}`, x, y, cardW, cardH);
        if (!hero && !this.firstEmptyMarked) {
          this.firstEmptyMarked = true;
          s.mark('slot-empty', x, y, cardW, cardH);
        }
        if (hero) {
          const st = statusLine(hero);
          const note = isAvailable(hero) && !canAfford(hero, cost) ? { text: `${st.text} · ${this.costLabel} 불가`, color: C.redStr } : st;
          heroCard(s, x, y, cardW, cardH, hero, { note, onTap: () => this.open(slot) });
        } else {
          const g = s.add.graphics();
          g.lineStyle(3, C.line, 1).strokeRoundedRect(x, y, cardW, cardH, 10);
          s.add.text(x + cardW / 2, y + cardH / 2, '+ 영웅 배치', textStyle(22, C.faint)).setOrigin(0.5);
          s.add.zone(x + cardW / 2, y + cardH / 2, cardW, cardH).setInteractive({ useHandCursor: true }).on('pointerup', () => this.open(slot));
        }
      });
      ry += cardH + 34;
    }
    s.mark('formation', 18, top - 8, W - 36, ry - top + 4);
    return ry;
  }

  private open(slot: number): void {
    tutDone('slot');
    this.picking = slot;
    this.page.requestRender();
  }

  /** 열려 있으면 영웅 선택창을 맨 위에 그림 */
  drawPicker(cost: number): void {
    if (this.picking === null) return;
    const slot = this.picking;
    this.page.layer(100, () => this.picker(slot, cost));
  }

  private picker(slot: number, cost: number): void {
    const s = this.page;
    const close = () => {
      this.picking = null;
      s.requestRender();
    };
    shade(s, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const px = 16;
    const py = Math.max(PAGE_TOP + 16, 20);
    const pw = W - 32;
    const ph = Math.min(PAGE_BOTTOM - 16, 1262) - py;
    panel(s, px, py, pw, ph, C.panel, C.gold);
    s.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive();

    const pos = slotPosition(game.data.formationType, slot);
    s.add.text(px + 24, py + 22, `${ROW_LABEL[pos.row]}${pos.count > 1 ? ` ${pos.index + 1}번` : ''} 자리`, textStyle(33));
    s.add.text(px + 24, py + 66, '다른 칸의 영웅을 고르면 자리를 바꿉니다', textStyle(18, C.dim));

    const heroes = living();
    const cw = (pw - 48 - 12) / 2;
    const ch = 140;
    heroes.forEach((h, i) => {
      const x = px + 24 + (i % 2) * (cw + 12);
      const y = py + 104 + Math.floor(i / 2) * (ch + 10);
      const inSlot = game.data.formation.indexOf(h.id);
      const here = inSlot === slot;
      let note = statusLine(h);
      if (isAvailable(h) && !canAfford(h, cost)) note = { text: `${note.text} · ${this.costLabel} 불가`, color: C.redStr };
      if (inSlot >= 0 && !here) note = { text: `${ROW_LABEL[slotPosition(game.data.formationType, inSlot).row]} 배치 중`, color: C.goldStr };
      else if (here) note = { text: '지금 이 자리', color: C.goldStr };
      const blocked = !isAvailable(h) && inSlot < 0;
      ensureHeroTextures(s, h);
      heroCard(s, x, y, cw, ch, h, { highlight: here, dim: blocked, note, onTap: blocked ? undefined : () => this.place(slot, h.id) });
      if (h === heroes[heroes.length - 1]) s.mark('pick-new', x, y, cw, ch);
    });

    const by = py + ph - 62;
    const clear = button(s, px + pw / 2 - 150, by, 260, 76, '비우기', () => {
      game.data.formation[slot] = null;
      save();
      close();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    clear.setEnabled(!!game.data.formation[slot]);
    button(s, px + pw / 2 + 150, by, 260, 76, '닫기', close, { size: 22 });
  }

  private place(slot: number, heroId: string): void {
    tutDone('pick');
    const f = game.data.formation;
    const from = f.indexOf(heroId);
    if (from >= 0) f[from] = f[slot];
    f[slot] = heroId;
    save();
    this.picking = null;
    this.page.requestRender();
  }
}
