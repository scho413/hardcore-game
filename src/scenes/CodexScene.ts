import { ensureHeroTextures } from '../art/textures';
import { CLASSES } from '../data/classes';
import { fallen } from '../state';
import { drawChronicle, fmtDate } from '../ui/chronicle';
import { Page } from '../ui/page';
import { C, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';

const PER_PAGE = 9;

/** 도감 탭. 2단계는 추모의 벽만 (GDD 10) */
export class CodexScene extends Page {
  protected tab = 'codex' as const;
  private page = 0;
  /** 일대기를 연 영웅과 그 페이지 */
  private chron: { id: string; page: number } | null = null;

  constructor() {
    super('codex');
  }

  protected onEnter(): void {
    this.page = 0;
    this.chron = null;
  }

  protected draw(): void {
    const dead = fallen();
    this.add.text(32, PAGE_TOP + 52, '도감', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(150, PAGE_TOP + 58, '추모의 벽', textStyle(22, C.text)).setOrigin(0, 0.5);
    this.add.text(W - 28, PAGE_TOP + 58, `잃은 영웅 ${dead.length}명`, textStyle(18, C.faint)).setOrigin(1, 0.5);

    if (dead.length === 0) {
      panel(this, 28, 140, W - 56, 260, C.bgDeep);
      this.add
        .text(W / 2, 270, '아직 잃은 영웅이 없습니다.\n\n탑에서 파티가 전멸하면\n쓰러진 영웅은 이곳에 기록됩니다.', textStyle(22, C.dim, { align: 'center', lineSpacing: 6 }))
        .setOrigin(0.5);
      return;
    }

    const pages = Math.ceil(dead.length / PER_PAGE);
    this.page = Math.min(this.page, pages - 1);
    const items = dead.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);

    const cw = (W - 56 - 24) / 3;
    const ch = 290;
    items.forEach((h, i) => {
      ensureHeroTextures(this, h);
      const x = 28 + (i % 3) * (cw + 12);
      const y = 120 + Math.floor(i / 3) * (ch + 12);
      panel(this, x, y, cw, ch, 0x1a1622, 0x4a4058);

      // 얼굴 아이콘 (스프라이트 머리 부분)
      const g = this.add.graphics();
      g.fillStyle(C.bgDeep, 1).fillRoundedRect(x + cw / 2 - 64, y + 16, 128, 104, 8);
      g.lineStyle(3, 0x6a5f7a, 1).strokeRoundedRect(x + cw / 2 - 64, y + 16, 128, 104, 8);
      this.add.image(x + cw / 2, y + 68, `face-${h.id}`).setScale(4).setTint(0xc8c0d0);

      const cls = CLASSES[h.classId];
      this.add.text(x + cw / 2, y + 140, h.name, textStyle(22)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 172, `${cls.name} · Lv ${h.level}`, textStyle(18, C.dim)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 206, `최고 도달 ${h.bestFloor}층`, textStyle(18, C.goldStr)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 234, `${h.diedFloor}층에서 전사`, textStyle(18, C.redStr)).setOrigin(0.5, 0);
      if (h.diedAt) this.add.text(x + cw / 2, y + 260, fmtDate(h.diedAt), textStyle(18, C.faint)).setOrigin(0.5, 0);
      this.add
        .zone(x + cw / 2, y + ch / 2, cw, ch)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.chron = { id: h.id, page: 0 };
          this.requestRender();
        });
    });
    this.add.text(W / 2, 120 + 3 * (ch + 12) + 4, '영웅을 누르면 일대기를 볼 수 있습니다', textStyle(18, C.faint)).setOrigin(0.5, 0);

    if (pages > 1) {
      const y = 120 + 3 * (ch + 12) + 44;
      const prev = button(this, 140, y, 180, 64, '이전', () => {
        this.page--;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 22 });
      prev.setEnabled(this.page > 0);
      this.add.text(W / 2, y, `${this.page + 1} / ${pages}`, textStyle(22, C.dim)).setOrigin(0.5);
      const next = button(this, W - 140, y, 180, 64, '다음', () => {
        this.page++;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 22 });
      next.setEnabled(this.page < pages - 1);
    }

    const open = this.chron && dead.find((h) => h.id === this.chron!.id);
    if (open) {
      this.layer(100, () =>
        drawChronicle(
          this,
          open,
          this.chron!.page,
          (p) => ((this.chron = { id: open.id, page: p }), this.requestRender()),
          () => ((this.chron = null), this.requestRender()),
        ),
      );
    }
  }
}
