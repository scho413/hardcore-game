import { ensureHeroTextures } from '../art/textures';
import { CLASSES } from '../data/classes';
import { FORMATION_SLOTS, ROSTER_MAX, heroStats, xpToNext, type Hero } from '../data/heroes';
import { TRAITS } from '../data/traits';
import { game, living, recruit, resetProgress, save } from '../state';
import { heroCard, shade, statusLine, xpBar } from '../ui/heroUi';
import { Page } from '../ui/page';
import { C, ELEMENT_INFO, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, elementChip, panel } from '../ui/widgets';

const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;

/** 영웅 탭: 로스터 목록 + 상세 + (임시) 모집 */
export class HeroesScene extends Page {
  protected tab = 'heroes' as const;
  private detail: string | null = null;
  private resetArmed = false;
  private flash = '';

  constructor() {
    super('heroes');
  }

  protected onEnter(): void {
    this.detail = null;
    this.resetArmed = false;
    this.flash = '';
  }

  protected draw(): void {
    const heroes = living();
    this.add.text(32, PAGE_TOP + 52, '영웅', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(150, PAGE_TOP + 58, `${heroes.length} / ${ROSTER_MAX}명`, textStyle(22, C.dim)).setOrigin(0, 0.5);

    // 임시 모집: 4단계 모집소가 생기기 전까지 테스트용
    const full = heroes.length >= ROSTER_MAX;
    const rb = button(this, W - 290, 140, 250, 64, full ? '로스터 가득 참' : '모집 (임시·무료)', () => {
      const h = recruit();
      if (h) {
        save();
        this.flash = `${h.name}(${CLASSES[h.classId].name}) 합류`;
      }
      this.requestRender();
    }, { size: 22 });
    rb.setEnabled(!full);
    button(this, W - 90, 140, 130, 64, this.resetArmed ? '한 번 더' : '처음부터', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.time.delayedCall(2500, () => {
          this.resetArmed = false;
          this.requestRender();
        });
      } else {
        resetProgress();
        this.resetArmed = false;
        this.flash = '새로 시작했습니다';
      }
      this.requestRender();
    }, { fill: C.panelHi, textColor: this.resetArmed ? C.redStr : C.dim, size: 18 });
    if (this.flash) this.add.text(32, 140, this.flash, textStyle(18, C.greenStr)).setOrigin(0, 0.5);

    const cw = (W - 56 - 14) / 2;
    const ch = 148;
    heroes.forEach((h, i) => {
      const x = 28 + (i % 2) * (cw + 14);
      const y = 196 + Math.floor(i / 2) * (ch + 12);
      const slot = game.data.formation.indexOf(h.id);
      const note = slot >= 0 && h.status === 'ready' ? { text: `${ROW_LABEL[FORMATION_SLOTS[slot].row]} 배치`, color: C.goldStr } : statusLine(h);
      heroCard(this, x, y, cw, ch, h, {
        note,
        onTap: () => {
          this.detail = h.id;
          this.requestRender();
        },
      });
    });
    if (heroes.length === 0) {
      this.add.text(W / 2, 520, '살아남은 영웅이 없습니다.\n모집으로 새 영웅을 받으세요.', textStyle(22, C.dim, { align: 'center', lineSpacing: 10 })).setOrigin(0.5);
    }

    const d = this.detail ? heroes.find((h) => h.id === this.detail) : undefined;
    if (d) this.layer(100, () => this.drawDetail(d));
  }

  private drawDetail(h: Hero): void {
    const close = () => {
      this.detail = null;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const x = 40;
    const y = 150;
    const w = W - 80;
    const ht = 900;
    panel(this, x, y, w, ht, C.panel, C.gold);
    this.add.zone(x + w / 2, y + ht / 2, w, ht).setInteractive();
    ensureHeroTextures(this, h);

    const cls = CLASSES[h.classId];
    const frame = this.add.graphics();
    frame.fillStyle(C.bgDeep, 1).fillRoundedRect(x + 28, y + 28, 200, 200, 10);
    this.add.image(x + 128, y + 128, `hero-${h.id}`).setScale(10);

    const tx = x + 256;
    this.add.text(tx, y + 34, h.name, textStyle(44));
    const ct = this.add.text(tx, y + 96, `${cls.name} · Lv ${h.level}`, textStyle(22, C.dim));
    elementChip(this, tx + ct.width + 40, y + 108, h.element, 22);
    this.add.text(tx, y + 140, `경험치 ${h.xp} / ${xpToNext(h.level)}`, textStyle(18, C.faint));
    xpBar(this, tx, y + 168, w - 256 - 28, h);
    const st = statusLine(h);
    this.add.text(tx, y + 196, st.text, textStyle(22, st.color));

    // 능력치
    const s = heroStats(h);
    const rows: [string, string][] = [
      ['체력', String(s.hp)],
      ['공격력', String(s.atk)],
      ['방어력', String(s.def)],
      ['속도', String(s.spd)],
      ['치명타', `${Math.round(s.crit * 100)}%`],
      ['속성', ELEMENT_INFO[h.element].label],
    ];
    const sy = y + 264;
    this.add.text(x + 28, sy, '능력치', textStyle(22, C.goldStr));
    rows.forEach(([k, v], i) => {
      const cx = x + 28 + (i % 3) * ((w - 56) / 3);
      const cy = sy + 44 + Math.floor(i / 3) * 64;
      this.add.text(cx, cy, k, textStyle(18, C.dim));
      this.add.text(cx, cy + 24, v, textStyle(22));
    });

    const ty = sy + 196;
    this.add.text(x + 28, ty, '특성', textStyle(22, C.goldStr));
    h.traits.forEach((t, i) => {
      this.add.text(x + 28, ty + 44 + i * 64, TRAITS[t].name, textStyle(22, '#c9b8e8'));
      this.add.text(x + 28, ty + 72 + i * 64, TRAITS[t].desc, textStyle(18, C.dim));
    });

    const ry = ty + 200;
    this.add.text(x + 28, ry, '기록', textStyle(22, C.goldStr));
    this.add.text(x + 28, ry + 44, `최고 도달 ${h.bestFloor > 0 ? `${h.bestFloor}층` : '없음'} · 역할: ${cls.role}`, textStyle(18, C.dim));

    button(this, W / 2, y + ht - 60, 300, 76, '닫기', close, { size: 22 });
  }
}
