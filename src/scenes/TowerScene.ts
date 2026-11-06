import { scoutRisk, type Risk } from '../battle/scout';
import { ensureHeroTextures } from '../art/textures';
import { FLOORS, TOP_FLOOR, buildEnemies } from '../data/floors';
import { FORMATION_SLOTS, heroToUnit } from '../data/heroes';
import { MONSTERS } from '../data/monsters';
import { game, heroById, living, readyFormation, save } from '../state';
import { heroCard, statusLine } from '../ui/heroUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, elementChip, panel } from '../ui/widgets';
import { shade } from '../ui/heroUi';

const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;

/** 탑 화면: 층 선택 / 정찰 / 진형 편성 / 도전. 층을 클리어하면 무조건 이 화면으로 귀환 (GDD 5.2) */
export class TowerScene extends Page {
  protected tab = 'tower' as const;
  private floor = 1;
  /** 영웅 선택창을 연 슬롯 */
  private picking: number | null = null;
  private riskCache = new Map<string, Risk>();

  constructor() {
    super('tower');
  }

  protected onEnter(): void {
    this.picking = null;
    this.floor = Math.min(game.data.cleared + 1, TOP_FLOOR);
  }

  protected draw(): void {
    this.drawHeader();
    this.drawLadder();
    this.drawScout();
    this.drawFormation();
    this.drawGo();
    if (this.picking !== null) this.layer(100, () => this.drawPicker(this.picking!));
  }

  private drawHeader(): void {
    this.add.text(32, PAGE_TOP + 52, '탑', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    const ready = living().filter((h) => h.status === 'ready').length;
    this.add.text(110, PAGE_TOP + 58, `최고 ${game.data.cleared}층 클리어`, textStyle(22, C.dim)).setOrigin(0, 0.5);
    this.add.text(W - 28, PAGE_TOP + 58, `출전 가능 영웅 ${ready}명`, textStyle(18, C.faint)).setOrigin(1, 0.5);
  }

  /** 왼쪽: 층 사다리. 클리어한 층 + 다음 층을 고를 수 있음 */
  private drawLadder(): void {
    const x = 28;
    const top = 118;
    const rowH = 46;
    panel(this, x - 10, top - 12, 232, rowH * TOP_FLOOR + 18, C.bgDeep);
    for (let i = 0; i < TOP_FLOOR; i++) {
      const floor = TOP_FLOOR - i;
      const def = FLOORS[floor - 1];
      const y = top + i * rowH;
      const open = floor <= game.data.cleared + 1;
      const cleared = floor <= game.data.cleared;
      const sel = floor === this.floor;
      const g = this.add.graphics();
      g.fillStyle(sel ? C.gold : cleared ? 0x253629 : C.panel, 1).fillRoundedRect(x, y, 212, rowH - 8, 8);
      const color = sel ? '#1b1626' : !open ? C.faint : cleared ? C.greenStr : def.title ? C.redStr : C.text;
      this.add.text(x + 14, y + 8, `${floor}층`, textStyle(22, color));
      const tag = !open ? '잠김' : cleared ? '클리어' : def.title ?? '도전';
      this.add.text(x + 198, y + 10, tag, textStyle(18, color)).setOrigin(1, 0);
      if (open) {
        this.add
          .zone(x + 106, y + (rowH - 8) / 2, 212, rowH - 8)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => {
            this.floor = floor;
            this.requestRender();
          });
      }
    }
  }

  private risk(): Risk | null {
    const team = readyFormation();
    if (team.length === 0) return null;
    const key = `${this.floor}|${team.map((t) => `${t.slot}:${t.hero.id}:${t.hero.level}`).join(',')}`;
    let r = this.riskCache.get(key);
    if (!r) {
      r = scoutRisk(team.map((t) => heroToUnit(t.hero, t.slot)), buildEnemies(this.floor));
      this.riskCache.set(key, r);
    }
    return r;
  }

  /** 오른쪽: 선택한 층 정찰 정보 + 위험도 */
  private drawScout(): void {
    const x = 262;
    const y = 106;
    const w = W - x - 24;
    const h = 46 * TOP_FLOOR + 18;
    panel(this, x, y, w, h);

    const def = FLOORS[this.floor - 1];
    this.add.text(x + 20, y + 16, '정찰', textStyle(18, C.dim));
    this.add.text(x + 20, y + 42, `${this.floor}층${def.title ? ` · ${def.title}` : ''}`, textStyle(33, def.title ? C.redStr : C.text));

    const risk = this.risk();
    this.add.text(x + 20, y + 94, '위험도', textStyle(22, C.dim));
    if (risk) this.add.text(x + 116, y + 89, risk.label, textStyle(33, risk.color));
    else this.add.text(x + 116, y + 96, '출전할 영웅 없음', textStyle(18, C.faint));

    const counts = new Map<string, number>();
    for (const id of def.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
    let ey = y + 148;
    for (const [id, n] of counts) {
      const m = MONSTERS[id as keyof typeof MONSTERS];
      this.add.image(x + 48, ey + 28, `unit-${id}`).setScale(m.boss ? 4.2 : 3.4);
      this.add.text(x + 92, ey + 2, `${m.name}${n > 1 ? ` ×${n}` : ''}`, textStyle(22, m.boss ? C.redStr : C.text));
      elementChip(this, x + 112, ey + 42, m.element, 18);
      this.add.text(x + 142, ey + 32, m.note, textStyle(18, C.dim, { wordWrap: { width: w - 156 } }));
      ey += 78;
    }
    this.add.text(x + 20, y + h - 18, '자동 전투 · 후퇴 불가 · 클리어 후 귀환', textStyle(18, C.faint)).setOrigin(0, 1);
  }

  /** 진형 5칸. 칸을 탭하면 영웅 선택창 */
  private drawFormation(): void {
    const top = 604;
    this.add.text(28, top, '진형', textStyle(33));
    this.add.text(110, top + 10, '칸을 탭해 영웅 배치 · 전열이 먼저 맞음', textStyle(18, C.dim));

    const cardW = 316;
    const cardH = 104;
    const ys = { front: top + 48, mid: top + 48 + 116, back: top + 48 + 232 };
    const xs = { front: [W / 2 - 166, W / 2 + 166], mid: [W / 2], back: [W / 2 - 166, W / 2 + 166] };

    for (const row of ['front', 'mid', 'back'] as const) {
      const ly = ys[row] + cardH / 2;
      if (row === 'mid') this.add.text(W / 2 - cardW / 2 - 20, ly, ROW_LABEL[row], textStyle(22, C.faint)).setOrigin(1, 0.5);
      else this.add.text(W / 2, ly, ROW_LABEL[row].split('').join('\n'), textStyle(18, C.faint, { align: 'center', lineSpacing: 4 })).setOrigin(0.5);
    }

    FORMATION_SLOTS.forEach((pos, i) => {
      const cx = xs[pos.row][pos.slot];
      const x = cx - cardW / 2;
      const y = ys[pos.row];
      const hero = heroById(game.data.formation[i]);
      if (hero) {
        heroCard(this, x, y, cardW, cardH, hero, { onTap: () => this.openPicker(i) });
      } else {
        const g = this.add.graphics();
        g.lineStyle(3, C.line, 1).strokeRoundedRect(x, y, cardW, cardH, 10);
        this.add.text(cx, y + cardH / 2, '+ 영웅 배치', textStyle(22, C.faint)).setOrigin(0.5);
        this.add.zone(cx, y + cardH / 2, cardW, cardH).setInteractive({ useHandCursor: true }).on('pointerup', () => this.openPicker(i));
      }
    });
  }

  private drawGo(): void {
    const team = readyFormation();
    const y = PAGE_BOTTOM - TAB_H - 70;
    const label = team.length === 0 ? '출전할 영웅이 없습니다' : `${this.floor}층 도전 · ${team.length}명 출전`;
    const b = button(this, W / 2, y, W - 56, 92, label, () => {
      game.data.attempts++;
      save();
      this.go('battle', { floor: this.floor });
    }, { size: team.length === 0 ? 22 : 33 });
    b.setEnabled(team.length > 0);
  }

  private openPicker(slot: number): void {
    this.picking = slot;
    this.requestRender();
  }

  /** 영웅 선택창: 다른 칸에 있는 영웅을 고르면 자리 교체 */
  private drawPicker(slot: number): void {
    const close = () => {
      this.picking = null;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const px = 16;
    const py = Math.max(PAGE_TOP + 16, 20);
    const pw = W - 32;
    const ph = Math.min(PAGE_BOTTOM - 16, 1262) - py;
    panel(this, px, py, pw, ph, C.panel, C.gold);
    // 패널 안을 탭해도 닫히지 않게
    this.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive();

    const pos = FORMATION_SLOTS[slot];
    this.add.text(px + 24, py + 22, `${ROW_LABEL[pos.row]}${pos.row === 'mid' ? '' : ` ${pos.slot + 1}번`} 자리`, textStyle(33));
    this.add.text(px + 24, py + 66, '다른 칸의 영웅을 고르면 자리를 바꿉니다', textStyle(18, C.dim));

    const heroes = living();
    const cw = (pw - 48 - 12) / 2;
    const ch = 140;
    heroes.forEach((h, i) => {
      const x = px + 24 + (i % 2) * (cw + 12);
      const y = py + 104 + Math.floor(i / 2) * (ch + 10);
      const inSlot = game.data.formation.indexOf(h.id);
      const here = inSlot === slot;
      let note = statusLine(h);
      if (inSlot >= 0 && !here) {
        const p = FORMATION_SLOTS[inSlot];
        note = { text: `${ROW_LABEL[p.row]} 배치 중`, color: C.goldStr };
      } else if (here) note = { text: '지금 이 자리', color: C.goldStr };
      const blocked = h.status !== 'ready' && inSlot < 0;
      ensureHeroTextures(this, h);
      heroCard(this, x, y, cw, ch, h, {
        highlight: here,
        dim: blocked,
        note,
        onTap: blocked ? undefined : () => this.place(slot, h.id),
      });
    });

    const by = py + ph - 62;
    const clear = button(this, px + pw / 2 - 150, by, 260, 76, '비우기', () => {
      game.data.formation[slot] = null;
      save();
      close();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    clear.setEnabled(!!game.data.formation[slot]);
    button(this, px + pw / 2 + 150, by, 260, 76, '닫기', close, { size: 22 });
  }

  private place(slot: number, heroId: string): void {
    const f = game.data.formation;
    const from = f.indexOf(heroId);
    if (from >= 0) f[from] = f[slot];
    f[slot] = heroId;
    save();
    this.picking = null;
    this.requestRender();
  }
}
