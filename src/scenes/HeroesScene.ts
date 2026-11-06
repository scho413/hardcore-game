import { ensureHeroTextures } from '../art/textures';
import { CLASSES, roleOf } from '../data/classes';
import { ROSTER_MAX, heroRace, heroStats, xpToNext, type Hero } from '../data/heroes';
import { slotPosition } from '../data/formations';
import { TRAITS, TRAIT_MAX, traitDesc, traitName } from '../data/traits';
import { drawChronicle } from '../ui/chronicle';
import { game, living, recruit, resetProgress, save } from '../state';
import { TRAIT_COLOR, classRole, heroCard, raceChip, shade, statusLine, xpBar } from '../ui/heroUi';
import { Page } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';
import { FAMILIES } from '../data/races';

const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;

/** 영웅 탭: 로스터 목록 + 상세 + (임시) 모집 */
export class HeroesScene extends Page {
  protected tab = 'heroes' as const;
  private detail: string | null = null;
  /** 일대기 창 페이지 (null = 닫힘) */
  private chronPage: number | null = null;
  private resetArmed = false;
  private flash = '';

  constructor() {
    super('heroes');
  }

  protected onEnter(): void {
    this.detail = null;
    this.chronPage = null;
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
      const note = slot >= 0 && h.status === 'ready' ? { text: `${ROW_LABEL[slotPosition(game.data.formationType, slot).row]} 배치`, color: C.goldStr } : statusLine(h);
      heroCard(this, x, y, cw, ch, h, {
        note,
        onTap: () => {
          this.detail = h.id;
          this.chronPage = null;
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
    if (this.chronPage !== null) {
      drawChronicle(this, h, this.chronPage, (p) => ((this.chronPage = p), this.requestRender()), () => ((this.chronPage = null), this.requestRender()));
      return;
    }
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const x = 28;
    const y = PAGE_TOP + 30;
    const w = W - 56;
    const ht = Math.min(PAGE_BOTTOM - 30, 1250) - y;
    panel(this, x, y, w, ht, C.panel, C.gold);
    this.add.zone(x + w / 2, y + ht / 2, w, ht).setInteractive();
    ensureHeroTextures(this, h);

    const frame = this.add.graphics();
    frame.fillStyle(C.bgDeep, 1).fillRoundedRect(x + 24, y + 24, 200, 200, 10);
    this.add.image(x + 124, y + 124, `hero-${h.id}`).setScale(6);

    const tx = x + 248;
    this.add.text(tx, y + 28, h.name, textStyle(44));
    this.add.text(tx, y + 90, `${h.gender === 'f' ? '여성' : '남성'} · ${classRole(h)} · Lv ${h.level}`, textStyle(22, C.dim));
    raceChip(this, tx, y + 136, h, 18);
    this.add.text(tx, y + 160, `경험치 ${h.xp} / ${xpToNext(h.level)}`, textStyle(18, C.faint));
    xpBar(this, tx, y + 186, w - 248 - 24, h);
    const st = statusLine(h);
    this.add.text(tx, y + 200, st.text, textStyle(18, st.color));

    // 능력치 (진형 효과 제외)
    const s = heroStats(h);
    const rows: [string, string][] = [
      ['체력', String(s.hp)],
      ['공격력', String(s.atk)],
      ['방어력', String(s.def)],
      ['속도', String(s.spd)],
      ['치명타', `${Math.round(s.crit * 100)}%`],
      ['천적', FAMILIES[heroRace(h).favored].name],
    ];
    const sy = y + 250;
    this.add.text(x + 24, sy, '능력치', textStyle(22, C.goldStr));
    rows.forEach(([k, v], i) => {
      const cx = x + 24 + (i % 3) * ((w - 48) / 3);
      const cy = sy + 38 + Math.floor(i / 3) * 56;
      this.add.text(cx, cy, k, textStyle(18, C.dim));
      this.add.text(cx, cy + 22, v, textStyle(22));
    });

    // 전투 역할 (GDD 3.4)
    const ry = sy + 168;
    this.add.text(x + 24, ry, '전투 역할', textStyle(22, C.goldStr));
    const roles = CLASSES[h.classId].roles;
    const bw = (w - 48 - (roles.length - 1) * 10) / roles.length;
    roles.forEach((role, i) => {
      const on = role.id === roleOf(h.classId, h.role).id;
      button(this, x + 24 + bw / 2 + i * (bw + 10), ry + 66, bw, 60, role.name, () => {
        h.role = role.id;
        save();
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });
    this.add.text(x + 24, ry + 108, roleOf(h.classId, h.role).desc, textStyle(18, C.dim));

    // 특성
    const ty = ry + 156;
    this.add.text(x + 24, ty, `특성 ${h.traits.length} / ${TRAIT_MAX}`, textStyle(22, C.goldStr));
    const race = heroRace(h);
    const list: [string, string, string][] = [
      [`${race.perk} (종족)`, `${race.desc} · ${FAMILIES[race.favored].name}에게 피해 +25%`, '#9fe0c0'],
      ...h.traits.map((t): [string, string, string] => [`${traitName(t)} ${TRAITS[t.id].kind === 'good' ? '+' : TRAITS[t.id].kind === 'bad' ? '-' : '±'}${t.v}`, traitDesc(t), TRAIT_COLOR[TRAITS[t.id].kind]]),
    ];
    if (h.traits.length === 0) list.push(['특성 없음', '평범한 영웅. 전투를 거치며 특성이 생길 수 있음', C.dim]);
    let ly = ty + 38;
    for (const [name, desc, color] of list) {
      this.add.text(x + 24, ly, name, textStyle(22, color));
      const d = this.add.text(x + 24, ly + 26, desc, textStyle(18, C.dim, { wordWrap: { width: w - 48 } }));
      ly += 32 + d.height;
    }

    const by = y + ht - 56;
    button(this, x + w / 2 - 130, by, 240, 72, '일대기', () => {
      this.chronPage = 0;
      this.requestRender();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    button(this, x + w / 2 + 130, by, 240, 72, '닫기', close, { size: 22 });
  }
}
