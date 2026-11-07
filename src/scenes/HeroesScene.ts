import { ensureHeroTextures } from '../art/textures';
import { CLASSES, roleOf } from '../data/classes';
import { heroRace, heroStats, xpToNext, type Hero } from '../data/heroes';
import { slotPosition } from '../data/formations';
import { TRAITS, TRAIT_MAX, traitDesc, traitName } from '../data/traits';
import { drawChronicle } from '../ui/chronicle';
import { game, living, resetProgress, rosterCap, save } from '../state';
import type { MaterialId } from '../data/items';
import { TUT_DONE } from '../tutorial/steps';
import { tutSkip } from '../tutorial/overlay';
import { TRAIT_COLOR, classRole, fatigueDetail, heroCard, raceChip, shade, statusLine, xpBar } from '../ui/heroUi';
import { weaponIcon } from '../art/itemArt';
import { GRADES, WEAPON_TYPES, specialText, weaponDesc, weaponName } from '../data/items';
import { addFatigue, addLog, fatigueLevel } from '../data/heroes';
import Phaser from 'phaser';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';
import { fitScale } from '../art/hd';
import { isAvailable } from '../state';
import { FAMILIES } from '../data/races';

const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;
/** 영웅 목록이 시작하는 높이 (머리말 아래) */
const LIST_TOP = 196;

/** 영웅 탭: 로스터 목록 + 상세 + (임시) 모집 */
export class HeroesScene extends Page {
  protected tab = 'heroes' as const;
  private detail: string | null = null;
  /** 일대기 창 페이지 (null = 닫힘) */
  private chronPage: number | null = null;
  private resetArmed = false;
  private flash = '';
  /** 무기 교체창 */
  private arming = false;
  // ── 목록 스크롤 ──
  private scroll = 0;
  private maxScroll = 0;
  private list: Phaser.GameObjects.Container | null = null;
  private listArea = { top: 0, bottom: 0 };
  private bar: Phaser.GameObjects.Rectangle | null = null;
  private barInfo = { trackH: 0, barH: 0 };
  private drag: { y: number; scroll: number } | null = null;
  private dragMoved = false;
  private inputBound = false;

  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll);
    if (this.list?.active) this.list.y = -this.scroll;
    if (this.bar?.active && this.maxScroll > 0) {
      const { trackH, barH } = this.barInfo;
      this.bar.y = this.listArea.top + (trackH - barH) * (this.scroll / this.maxScroll) + barH / 2;
    }
  }

  /** 끌기·휠로 목록 스크롤 (상세창이 열려 있으면 안 함) */
  private bindScroll(): void {
    if (this.inputBound) return;
    this.inputBound = true;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragMoved = false;
      if (this.detail || p.y < this.listArea.top || p.y > this.listArea.bottom) return;
      this.drag = { y: p.y, scroll: this.scroll };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 10) this.dragMoved = true;
      if (this.dragMoved) this.setScroll(this.drag.scroll - dy);
    });
    this.input.on('pointerup', () => {
      this.drag = null;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.detail) this.setScroll(this.scroll + dy);
    });
    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.inputBound = false;
    });
  }

  constructor() {
    super('heroes');
  }

  protected onEnter(): void {
    this.scroll = 0;
    this.bindScroll();
    this.detail = null;
    this.chronPage = null;
    this.resetArmed = false;
    this.flash = '';
    this.arming = false;
  }

  protected draw(): void {
    const heroes = living();
    // ── 영웅 목록 (스크롤). 머리말 버튼이 위에 오도록 먼저 그림 ──
    const listTop = LIST_TOP;
    const listBottom = PAGE_BOTTOM - TAB_H - 8;
    const cw = (W - 56 - 14) / 2;
    const ch = 148;
    const before = new Set(this.children.list);
    heroes.forEach((h, i) => {
      const x = 28 + (i % 2) * (cw + 14);
      const y = listTop + Math.floor(i / 2) * (ch + 12);
      const slot = game.data.formation.indexOf(h.id);
      const note = slot >= 0 && isAvailable(h) ? { text: `${ROW_LABEL[slotPosition(game.data.formationType, slot).row]} 배치`, color: C.goldStr } : statusLine(h);
      heroCard(this, x, y, cw, ch, h, {
        note,
        onTap: () => {
          // 끌어서 스크롤한 경우나, 목록 영역 밖(머리말 아래로 가려진 부분)을 누른 경우는 무시
          const py = this.input.activePointer.y;
          if (this.dragMoved || py < listTop || py > listBottom) return;
          this.detail = h.id;
          this.chronPage = null;
          this.arming = false;
          this.requestRender();
        },
      });
    });
    const list = this.add.container(0, 0, this.children.list.filter((o) => !before.has(o)));
    const contentH = Math.ceil(heroes.length / 2) * (ch + 12);
    this.maxScroll = Math.max(0, contentH - (listBottom - listTop));
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll);
    list.y = -this.scroll;
    const maskG = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, listTop - 6, W, listBottom - listTop + 6);
    list.setMask(maskG.createGeometryMask());
    this.list = list;
    this.listArea = { top: listTop, bottom: listBottom };
    // 스크롤 막대
    if (this.maxScroll > 0) {
      const trackH = listBottom - listTop;
      const barH = Math.max(40, (trackH * trackH) / contentH);
      this.bar = this.add.rectangle(W - 8, listTop + (trackH - barH) * (this.scroll / this.maxScroll) + barH / 2, 6, barH, C.gold, 0.5);
      this.barInfo = { trackH, barH };
    } else this.bar = null;
    if (heroes.length === 0) {
      this.add.text(W / 2, 520, '살아남은 영웅이 없습니다.\n모집으로 새 영웅을 받으세요.', textStyle(22, C.dim, { align: 'center', lineSpacing: 10 })).setOrigin(0.5);
    }

    this.add.text(32, PAGE_TOP + 52, '영웅', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(150, PAGE_TOP + 58, `${heroes.length} / ${rosterCap()}명 · 모집은 기지의 모집소`, textStyle(22, C.dim)).setOrigin(0, 0.5);

    // 테스트 모드 (출시 전 제거): 모든 층 도전·정찰, 즉시 건설, 자원·회복
    const gd = game.data;
    button(this, W - 270, 140, 210, 64, gd.test ? '테스트 켜짐' : '테스트 모드', () => {
      gd.test = !gd.test;
      if (gd.test && gd.tutorial < TUT_DONE) tutSkip();
      save();
      this.requestRender();
    }, { fill: gd.test ? 0xe0503a : C.panelHi, textColor: gd.test ? '#ffffff' : C.dim, size: 18 });
    if (gd.test) {
      button(this, 110, 140, 160, 64, '자원 +', () => {
        gd.gold += 5000;
        for (const k of ['metal', 'wood', 'crystal']) for (const t of [1, 2, 3]) gd.materials[`${k}${t}` as MaterialId] = (gd.materials[`${k}${t}` as MaterialId] ?? 0) + 20;
        this.flash = '골드 +5000, 재료 +20';
        save();
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
      button(this, 280, 140, 160, 64, '전원 회복', () => {
        for (const h of living()) {
          h.fatigue = 0;
          if (h.status === 'injured') {
            h.status = 'ready';
            delete h.injuredUntil;
          }
        }
        this.flash = '기력·중상 회복';
        save();
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
    }
    button(this, W - 90, 140, 130, 64, this.resetArmed ? '한 번 더' : '인트로부터', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.time.delayedCall(2500, () => {
          this.resetArmed = false;
          this.requestRender();
        });
      } else {
        // 저장을 지우고 이야기·튜토리얼부터 다시
        resetProgress();
        this.resetArmed = false;
        this.cameras.main.fadeOut(200, 11, 9, 16);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('story'));
        return;
      }
      this.requestRender();
    }, { fill: C.panelHi, textColor: this.resetArmed ? C.redStr : C.dim, size: 18 });
    if (this.flash) this.add.text(W - 28, PAGE_TOP + 92, this.flash, textStyle(18, C.greenStr)).setOrigin(1, 0.5);

    const d = this.detail ? heroes.find((h) => h.id === this.detail) : undefined;
    if (d) this.layer(100, () => this.drawDetail(d));
    if (d && this.arming) this.layer(110, () => this.drawArmory(d));
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
    const hn = this.add.text(tx, y + 28, h.name, textStyle(44, GRADES[h.grade ?? 0].str));
    this.add.text(hn.x + hn.width + 12, y + 44, GRADES[h.grade ?? 0].name, textStyle(22, GRADES[h.grade ?? 0].str));
    this.add.text(tx, y + 90, `${h.gender === 'f' ? '여성' : '남성'} · ${classRole(h)} · Lv ${h.level}`, textStyle(22, C.dim));
    raceChip(this, tx, y + 136, h, 18);
    this.add.text(tx, y + 160, `경험치 ${h.xp} / ${xpToNext(h.level)}`, textStyle(18, C.faint));
    xpBar(this, tx, y + 186, w - 248 - 24, h);
    const st = statusLine(h);
    this.add.text(tx, y + 200, h.status === 'ready' ? fatigueDetail(h) : st.text, textStyle(18, st.color));
    // 물약 (연금소)
    const pot = game.data.potions;
    let bx = tx;
    if (h.status !== 'dead' && (pot.stamina ?? 0) > 0 && fatigueLevel(h) > 0) {
      button(this, bx + 80, y + 238, 160, 32, `기력 물약 ${pot.stamina}`, () => {
        pot.stamina = (pot.stamina ?? 0) - 1;
        addFatigue(h, -3);
        save();
        this.requestRender();
      }, { size: 18, fill: 0x8fd0ff });
      bx += 170;
    }
    if (h.status === 'injured' && (pot.cure ?? 0) > 0) {
      button(this, bx + 80, y + 238, 160, 32, `치료 물약 ${pot.cure}`, () => {
        pot.cure = (pot.cure ?? 0) - 1;
        h.status = 'ready';
        delete h.injuredUntil;
        addLog(h, '치료 물약으로 회복', 'good');
        save();
        this.requestRender();
      }, { size: 18, fill: C.green });
    }

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
    const sy = y + 266;
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

    // 무기 (GDD 7)
    const wy = ry + 150;
    const wpn = h.weapon;
    const sp = wpn ? wpn.specials.map(specialText) : [];
    const wh = 64 + sp.length * 26;
    const wg = this.add.graphics();
    wg.fillStyle(C.bgDeep, 1).fillRoundedRect(x + 24, wy, w - 48, wh, 8);
    if (wpn) {
      wg.fillStyle(GRADES[wpn.grade].color, 1).fillRect(x + 24, wy, 6, wh);
      this.add.image(x + 62, wy + 32, weaponIcon(this, wpn.cls, wpn.tier, wpn.grade)).setScale(fitScale(this, weaponIcon(this, wpn.cls, wpn.tier, wpn.grade), 3.4)).setAlpha(wpn.dur > 0 ? 1 : 0.4);
      this.add.text(x + 98, wy + 8, weaponName(wpn), textStyle(22, GRADES[wpn.grade].str));
      this.add.text(x + 98, wy + 36, `${weaponDesc(wpn)}`, textStyle(18, C.dim)).setCrop(0, 0, w - 270, 30);
      this.add.text(x + w - 24 - 140, wy + 8, wpn.dur > 0 ? `내구 ${wpn.dur}` : '수리 필요', textStyle(18, wpn.dur > 30 ? C.faint : C.redStr)).setOrigin(1, 0);
      sp.forEach((t, i) => this.add.text(x + 44, wy + 64 + i * 26, t, textStyle(18, GRADES[wpn.grade].str)));
    } else {
      // 연습용 무기: 무기를 안 줬을 때 들고 있는 것. 능력치 없음, 아이템이 아니라 팔거나 분해할 수 없음
      const pk = weaponIcon(this, h.classId, 1, 0);
      this.add.image(x + 62, wy + 32, pk).setScale(fitScale(this, pk, 3.4)).setTint(0xc8a070);
      this.add.text(x + 98, wy + 8, `연습용 ${WEAPON_TYPES[h.classId].name}`, textStyle(22, C.dim));
      this.add.text(x + 98, wy + 36, '추가 능력 없음 · 팔 수 없음 · 대장간에서 제작', textStyle(18, C.faint));
    }
    const spare = game.data.stash.filter((wp) => wp.cls === h.classId).length;
    const ab = button(this, x + w - 24 - 70, wy + 38, 124, 44, h.weapon ? '교체' : `장착 ${spare}`, () => {
      this.arming = true;
      this.requestRender();
    }, { size: 18 });
    ab.setEnabled(spare > 0 || !!h.weapon);

    // 특성
    const ty = wy + wh + 20;
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

  /** 무기 교체창: 같은 직업 무기 목록 + 해제 */
  private drawArmory(h: Hero): void {
    const close = () => {
      this.arming = false;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const list = game.data.stash.filter((wp) => wp.cls === h.classId).sort((a, b) => b.grade - a.grade || b.tier - a.tier);
    const x = 40;
    const w = W - 80;
    const rowH = 76;
    const shown = list.slice(0, 9);
    const ht = 200 + shown.length * rowH + (h.weapon ? 0 : 0);
    const y = Math.max(PAGE_TOP + 60, (PAGE_BOTTOM - ht) / 2 - 40);
    panel(this, x, y, w, ht, C.panel, C.gold);
    this.add.zone(x + w / 2, y + ht / 2, w, ht).setInteractive();
    this.add.text(x + 24, y + 22, `${h.name}의 무기`, textStyle(33));
    this.add.text(x + 24, y + 66, `${CLASSES[h.classId].name} 전용 · 보관함 ${list.length}개`, textStyle(18, C.dim));
    if (shown.length === 0) this.add.text(x + w / 2, y + 120, '보관함에 맞는 무기가 없습니다', textStyle(18, C.faint)).setOrigin(0.5);
    shown.forEach((wp, i) => {
      const ry = y + 100 + i * rowH;
      const g = this.add.graphics();
      g.fillStyle(C.panelHi, 1).fillRoundedRect(x + 20, ry, w - 40, rowH - 10, 8);
      g.fillStyle(GRADES[wp.grade].color, 1).fillRect(x + 20, ry, 6, rowH - 10);
      this.add.image(x + 58, ry + (rowH - 10) / 2, weaponIcon(this, wp.cls, wp.tier, wp.grade)).setScale(fitScale(this, weaponIcon(this, wp.cls, wp.tier, wp.grade), 3.4));
      this.add.text(x + 94, ry + 8, weaponName(wp), textStyle(22, GRADES[wp.grade].str));
      this.add.text(x + 94, ry + 36, `${weaponDesc(wp)} · 내구 ${wp.dur}`, textStyle(18, C.dim)).setCrop(0, 0, w - 130, 30);
      this.add.zone(x + w / 2, ry + (rowH - 10) / 2, w - 40, rowH - 10).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const stash = game.data.stash;
        stash.splice(stash.indexOf(wp), 1);
        if (h.weapon) stash.push(h.weapon);
        h.weapon = wp;
        addLog(h, `${weaponName(wp)} 장착`, 'info');
        save();
        close();
      });
    });
    const by = y + ht - 52;
    if (h.weapon) {
      button(this, x + w / 2 - 130, by, 230, 64, '해제', () => {
        game.data.stash.push(h.weapon!);
        h.weapon = undefined;
        save();
        close();
      }, { fill: C.panelHi, textColor: C.text, size: 22 });
      button(this, x + w / 2 + 130, by, 230, 64, '닫기', close, { size: 22 });
    } else {
      button(this, x + w / 2, by, 300, 64, '닫기', close, { size: 22 });
    }
  }
}
