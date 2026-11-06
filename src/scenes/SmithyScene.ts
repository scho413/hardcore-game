import { matIcon, weaponIcon } from '../art/itemArt';
import { CLASSES, type ClassId } from '../data/classes';
import type { Hero } from '../data/heroes';
import {
  DIFFICULTIES,
  DUR_MAX,
  GRADES,
  KIND_NAME,
  MATERIALS,
  MAT_KINDS,
  TIERS,
  WEAPON_TYPES,
  canCraft,
  hasMats,
  matId,
  recipeFor,
  repairCost,
  spendMats,
  weaponDesc,
  weaponName,
  type Difficulty,
  type Weapon,
} from '../data/items';
import { SMITHY_MAX_DIFF, dismantleGold } from '../data/base';
import { game, living, save } from '../state';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';

const CLASS_ORDER: ClassId[] = ['knight', 'warrior', 'archer', 'mage', 'priest'];

/** 대장간 (GDD 7, 기지 시설): 재료 확인 → 무기 종류·난이도 선택 → 미니게임. 보관함·수리·분해 */
export class SmithyScene extends Page {
  protected tab = 'base' as const;
  private static cls: ClassId = 'knight';
  private static diff: Difficulty = 1;
  private armed: string | null = null;
  private listPage = 0;

  constructor() {
    super('smithy');
  }

  protected draw(): void {
    const d = game.data;
    button(this, 70, PAGE_TOP + 52, 100, 56, '◀ 기지', () => this.go('base'), { fill: C.panelHi, textColor: C.text, size: 18 });
    this.add.text(136, PAGE_TOP + 52, '대장간', textStyle(44, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(290, PAGE_TOP + 58, `Lv ${d.facilities.smithy}`, textStyle(22, C.dim)).setOrigin(0, 0.5);
    this.add.text(W - 28, PAGE_TOP + 58, `골드 ${d.gold}`, textStyle(22, C.goldStr)).setOrigin(1, 0.5);
    const maxDiff = d.test ? 5 : SMITHY_MAX_DIFF[Math.max(1, d.facilities.smithy) - 1];
    if (SmithyScene.diff > maxDiff) SmithyScene.diff = maxDiff as Difficulty;

    // ── 재료 ──
    const px = 28;
    const pw = W - 56;
    let y = PAGE_TOP + 92;
    panel(this, px, y, pw, 160);
    const colW = (pw - 24) / 3;
    MAT_KINDS.forEach((k, ci) => {
      const cx = px + 12 + ci * colW;
      this.add.text(cx + 10, y + 10, KIND_NAME[k], textStyle(18, C.dim));
      TIERS.forEach((t, ti) => {
        const id = matId(k, t);
        const n = d.materials[id] ?? 0;
        const ry = y + 48 + ti * 36;
        this.add.image(cx + 26, ry, matIcon(this, id)).setScale(2.5).setAlpha(n > 0 ? 1 : 0.35);
        this.add.text(cx + 48, ry, MATERIALS[id].name, textStyle(18, n > 0 ? C.text : C.faint)).setOrigin(0, 0.5);
        this.add.text(cx + colW - 14, ry, `${n}`, textStyle(22, n > 0 ? C.goldStr : C.faint)).setOrigin(1, 0.5);
      });
    });
    y += 160 + 14;

    // ── 무기 종류 ──
    const bw = (pw - 4 * 8) / 5;
    CLASS_ORDER.forEach((c, i) => {
      const on = c === SmithyScene.cls;
      button(this, px + bw / 2 + i * (bw + 8), y + 26, bw, 52, CLASSES[c].name, () => {
        SmithyScene.cls = c;
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });
    y += 64;

    // ── 난이도 (3 × 2) ──
    const cls = SmithyScene.cls;
    const tw = (pw - 2 * 8) / 3;
    DIFFICULTIES.forEach((df, i) => {
      const diff = i as Difficulty;
      const on = diff === SmithyScene.diff;
      const ok = canCraft(d.materials, cls, diff);
      const top = GRADES[df.maxGrade];
      const locked = diff > maxDiff;
      const lockLv = SMITHY_MAX_DIFF.findIndex((m) => m >= diff) + 1;
      const bt = button(this, px + tw / 2 + (i % 3) * (tw + 8), y + 24 + Math.floor(i / 3) * 54, tw, 46, locked ? `${df.name} ·Lv${lockLv}` : `${df.name}${ok ? '' : ' ·부족'}`, () => {
        SmithyScene.diff = diff;
        this.requestRender();
      }, { fill: on ? top.color : C.panelHi, textColor: on ? '#1b1626' : ok ? top.str : C.faint, size: 18 });
      bt.setEnabled(!locked);
    });
    y += 112;

    // ── 제작 정보 ──
    const diff = SmithyScene.diff;
    const df = DIFFICULTIES[diff];
    const ph = 214;
    panel(this, px, y, pw, ph);
    this.add.image(px + 62, y + 66, weaponIcon(this, cls, df.tier, df.maxGrade)).setScale(6);
    this.add.text(px + 124, y + 14, `${WEAPON_TYPES[cls].name} · ${df.name}`, textStyle(26));
    const range = df.maxGrade === 0 ? '일반 고정 (자동 제작)' : `일반 ~ ${GRADES[df.maxGrade].name}`;
    this.add.text(px + 124, y + 52, range, textStyle(18, GRADES[df.maxGrade].str));
    this.add.text(px + 124, y + 78, df.breakChance > 0 ? `파손 ${Math.round(df.breakChance * 100)}% (모두 완벽하면 ${Math.round(df.breakChance * 50)}%) · 재료도 사라짐` : '파손 없음', textStyle(18, df.breakChance > 0 ? C.redStr : C.dim));

    let rx = px + 124;
    for (const r of recipeFor(cls, diff)) {
      const have = d.materials[r.id] ?? 0;
      this.add.image(rx + 14, y + 118, matIcon(this, r.id)).setScale(2.2);
      const t = this.add.text(rx + 32, y + 118, `${MATERIALS[r.id].name} ${have}/${r.n}`, textStyle(18, have >= r.n ? '#8fe0a0' : C.redStr)).setOrigin(0, 0.5);
      rx += t.width + 50;
    }

    // 등급 확률: 시작 / 모두 완벽
    const barX = px + 80;
    const barW = pw - 230;
    const drawBar = (by: number, label: string, odds: number[]) => {
      this.add.text(px + 20, by + 9, label, textStyle(18, C.dim)).setOrigin(0, 0.5);
      const g = this.add.graphics();
      g.fillStyle(C.hpBack, 1).fillRect(barX, by, barW, 18);
      let x = barX;
      odds.forEach((p, i) => {
        g.fillStyle(GRADES[i].color, 1).fillRect(x, by, (barW * p) / 100, 18);
        x += (barW * p) / 100;
      });
      const top = odds.length - 1;
      this.add.text(barX + barW + 12, by + 9, `${GRADES[top].name} ${odds[top] >= 1 ? Math.round(odds[top]) : odds[top].toFixed(1)}%`, textStyle(18, GRADES[top].str)).setOrigin(0, 0.5);
    };
    if (df.maxGrade > 0) {
      drawBar(y + 156, '시작', df.base);
      drawBar(y + 186, '만점', df.best);
    } else {
      this.add.text(px + 20, y + 170, '미니게임 없이 바로 완성됩니다', textStyle(18, C.dim));
    }
    y += ph + 12;

    const ok = canCraft(d.materials, cls, diff);
    const go = button(this, W / 2, y + 40, pw, 80, ok ? (diff === 0 ? '바로 제작 · 재료 소모' : '제작 시작 · 재료 소모') : '재료가 부족합니다', () => {
      this.go('forge', { cls, diff });
    }, { size: ok ? 30 : 22 });
    go.setEnabled(ok);
    y += 92;

    this.drawList(y);
  }

  /** 보관함 + 장착 중인 무기 (수리) */
  private drawList(top: number): void {
    const d = game.data;
    const px = 28;
    const pw = W - 56;
    const owners = new Map<string, Hero>();
    for (const h of living()) if (h.weapon) owners.set(h.weapon.id, h);
    const all: Weapon[] = [...[...owners.values()].map((h) => h.weapon!), ...d.stash].sort((a, b) => a.dur - b.dur || b.grade - a.grade);
    this.add.text(px, top, '무기', textStyle(33));
    this.add.text(px + 86, top + 10, `보관 ${d.stash.length} · 장착 ${owners.size} · 장착은 영웅 탭에서`, textStyle(18, C.dim));
    let y = top + 48;
    const listBottom = PAGE_BOTTOM - TAB_H - 12;
    const rowH = 66;
    const perPage = Math.max(1, Math.floor((listBottom - y - 44) / rowH));
    const pages = Math.max(1, Math.ceil(all.length / perPage));
    this.listPage = Math.min(this.listPage, pages - 1);
    if (all.length === 0) this.add.text(W / 2, y + 36, '아직 만든 무기가 없습니다', textStyle(22, C.faint)).setOrigin(0.5);

    for (const w of all.slice(this.listPage * perPage, (this.listPage + 1) * perPage)) {
      const g = this.add.graphics();
      g.fillStyle(C.panel, 1).fillRoundedRect(px, y, pw, rowH - 8, 8);
      g.fillStyle(GRADES[w.grade].color, 1).fillRect(px, y, 6, rowH - 8);
      this.add.image(px + 38, y + (rowH - 8) / 2, weaponIcon(this, w.cls, w.tier, w.grade)).setScale(3.2).setAlpha(w.dur > 0 ? 1 : 0.4);
      const owner = owners.get(w.id);
      this.add.text(px + 72, y + 5, weaponName(w), textStyle(18, GRADES[w.grade].str));
      this.add.text(px + 72, y + 31, `${owner ? `${owner.name} · ` : `${CLASSES[w.cls].name} · `}${weaponDesc(w)}`, textStyle(18, C.dim)).setCrop(0, 0, pw - 250, 30);
      // 내구도
      const dw = 90;
      const dx = px + pw - 150 - dw;
      g.fillStyle(C.hpBack, 1).fillRect(dx, y + 14, dw, 8);
      g.fillStyle(w.dur > 30 ? C.green : w.dur > 0 ? 0xffa03a : C.red, 1).fillRect(dx, y + 14, (dw * w.dur) / DUR_MAX, 8);
      this.add.text(dx + dw / 2, y + 38, w.dur > 0 ? `${w.dur}/${DUR_MAX}` : '수리 필요', textStyle(18, w.dur > 0 ? C.faint : C.redStr)).setOrigin(0.5);
      const cost = repairCost(w);
      if (!owner && this.armed === w.id) {
        // 분해 확인
        const g2 = dismantleGold(w.grade, w.tier);
        button(this, px + pw - 70, y + (rowH - 8) / 2, 124, 44, `분해 +${g2}G`, () => {
          d.stash.splice(d.stash.indexOf(w), 1);
          d.gold += g2;
          const k = matId(WEAPON_TYPES[w.cls].main, w.tier);
          d.materials[k] = (d.materials[k] ?? 0) + 1;
          this.armed = null;
          save();
          this.requestRender();
        }, { size: 18, fill: C.red, textColor: '#ffffff' });
      } else if (!owner && !cost.length) {
        button(this, px + pw - 70, y + (rowH - 8) / 2, 124, 44, '분해', () => {
          this.armed = w.id;
          this.requestRender();
        }, { size: 18, fill: C.panelHi, textColor: C.text });
      } else if (cost.length) {
        const can = hasMats(d.materials, cost);
        const rb = button(this, px + pw - 70, y + (rowH - 8) / 2, 124, 44, `수리 ${cost[0].n}`, () => {
          spendMats(d.materials, cost);
          w.dur = DUR_MAX;
          save();
          this.requestRender();
        }, { size: 18, fill: 0x8fd0ff });
        rb.setEnabled(can);
        this.add.image(px + pw - 128, y + 6, matIcon(this, cost[0].id)).setScale(1.6).setDepth(5);
      }
      y += rowH;
    }
    if (pages > 1) {
      const by = listBottom - 18;
      this.add.text(W / 2, by, `${this.listPage + 1} / ${pages}`, textStyle(18, C.dim)).setOrigin(0.5);
      const prev = button(this, W / 2 - 120, by, 120, 36, '이전', () => {
        this.listPage--;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
      prev.setEnabled(this.listPage > 0);
      const next = button(this, W / 2 + 120, by, 120, 36, '다음', () => {
        this.listPage++;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
      next.setEnabled(this.listPage < pages - 1);
    }
  }
}
