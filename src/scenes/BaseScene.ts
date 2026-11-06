import { matIcon, weaponIcon } from '../art/itemArt';
import { CLASSES, type ClassId } from '../data/classes';
import {
  GRADES,
  GRADE_ATK,
  MATERIALS,
  MAT_KINDS,
  KIND_NAME,
  TIERS,
  TIER_CAP,
  canCraft,
  matId,
  recipeFor,
  weaponDesc,
  weaponName,
  type Tier,
} from '../data/items';
import { game, living } from '../state';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';

const CLASS_ORDER: ClassId[] = ['knight', 'warrior', 'archer', 'mage', 'priest'];

/** 기지 탭 = 대장간 (GDD 7): 재료 확인 → 무기 종류·재료 단계 선택 → 미니게임 */
export class BaseScene extends Page {
  protected tab = 'base' as const;
  private static cls: ClassId = 'knight';
  private static tier: Tier = 1;
  private stashPage = 0;

  constructor() {
    super('base');
  }

  protected draw(): void {
    const d = game.data;
    this.add.text(32, PAGE_TOP + 52, '대장간', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(220, PAGE_TOP + 58, '직업 전용 무기 제작', textStyle(22, C.dim)).setOrigin(0, 0.5);

    // ── 재료 ──
    const px = 28;
    const pw = W - 56;
    let y = PAGE_TOP + 100;
    panel(this, px, y, pw, 176);
    const colW = (pw - 24) / 3;
    MAT_KINDS.forEach((k, ci) => {
      const cx = px + 12 + ci * colW;
      this.add.text(cx + 10, y + 12, KIND_NAME[k], textStyle(18, C.dim));
      TIERS.forEach((t, ti) => {
        const id = matId(k, t);
        const n = d.materials[id] ?? 0;
        const ry = y + 52 + ti * 40;
        this.add.image(cx + 26, ry, matIcon(this, id)).setScale(2.5).setAlpha(n > 0 ? 1 : 0.35);
        this.add.text(cx + 48, ry, MATERIALS[id].name, textStyle(18, n > 0 ? C.text : C.faint)).setOrigin(0, 0.5);
        this.add.text(cx + colW - 14, ry, `${n}`, textStyle(22, n > 0 ? C.goldStr : C.faint)).setOrigin(1, 0.5);
      });
    });
    y += 176 + 22;

    // ── 무기 종류 ──
    this.add.text(px, y, '무기', textStyle(33));
    this.add.text(px + 82, y + 10, '그 직업만 장착 가능 · 영웅이 죽으면 함께 사라짐', textStyle(18, C.dim));
    y += 52;
    const bw = (pw - 4 * 8) / 5;
    CLASS_ORDER.forEach((c, i) => {
      const on = c === BaseScene.cls;
      button(this, px + bw / 2 + i * (bw + 8), y + 28, bw, 56, CLASSES[c].name, () => {
        BaseScene.cls = c;
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });
    y += 72;

    // ── 재료 단계 ──
    const tw = (pw - 2 * 8) / 3;
    TIERS.forEach((t, i) => {
      const on = t === BaseScene.tier;
      const ok = canCraft(d.materials, BaseScene.cls, t);
      button(this, px + tw / 2 + i * (tw + 8), y + 26, tw, 52, `${t}단계 재료${ok ? '' : ' ·부족'}`, () => {
        BaseScene.tier = t;
        this.requestRender();
      }, { fill: on ? 0x8fd0ff : C.panelHi, textColor: on ? '#1b1626' : ok ? C.text : C.faint, size: 18 });
    });
    y += 70;

    // ── 제작 정보 ──
    const cls = BaseScene.cls;
    const tier = BaseScene.tier;
    const cap = TIER_CAP[tier];
    const ph = 248;
    panel(this, px, y, pw, ph);
    this.add.image(px + 70, y + 74, weaponIcon(this, cls, tier, cap)).setScale(7);
    const sample = { id: '', cls, tier, grade: cap, madeAt: 0 };
    this.add.text(px + 140, y + 22, weaponName({ ...sample, grade: 0 }).replace(`${GRADES[0].name} `, ''), textStyle(26));
    this.add.text(px + 140, y + 60, `최대 등급 `, textStyle(18, C.dim));
    this.add.text(px + 232, y + 60, GRADES[cap].name, textStyle(18, GRADES[cap].str));
    this.add.text(px + 140, y + 88, `최고 성능: ${weaponDesc(sample)}`, textStyle(18, C.dim));

    // 필요 재료
    let rx = px + 140;
    const recipe = recipeFor(cls, tier);
    for (const r of recipe) {
      const have = d.materials[r.id] ?? 0;
      const ok = have >= r.n;
      this.add.image(rx + 14, y + 134, matIcon(this, r.id)).setScale(2.2);
      const t = this.add.text(rx + 32, y + 134, `${MATERIALS[r.id].name} ${have}/${r.n}`, textStyle(18, ok ? '#8fe0a0' : C.redStr)).setOrigin(0, 0.5);
      rx += t.width + 52;
    }

    // 등급표
    const gy = y + 174;
    const gw = (pw - 40) / GRADES.length;
    GRADES.forEach((g, i) => {
      const gx = px + 20 + i * gw;
      const reach = i <= cap;
      const gg = this.add.graphics();
      gg.fillStyle(reach ? g.color : 0x3d3352, reach ? 1 : 0.6).fillRoundedRect(gx + 2, gy, gw - 4, 8, 3);
      this.add.text(gx + gw / 2, gy + 26, `${g.name} +${Math.round(GRADE_ATK[i] * 100)}%`, textStyle(18, reach ? g.str : C.faint)).setOrigin(0.5);
    });
    this.add.text(px + pw - 20, y + 22, `공격력 ↑`, textStyle(18, C.faint)).setOrigin(1, 0);
    y += ph + 16;

    const ok = canCraft(d.materials, cls, tier);
    const go = button(this, W / 2, y + 44, pw, 88, ok ? '제작 시작 · 재료 소모' : '재료가 부족합니다', () => {
      this.go('forge', { cls, tier });
    }, { size: ok ? 33 : 22 });
    go.setEnabled(ok);
    y += 104;

    // ── 보관함 ──
    const owners = living().filter((h) => h.weapon);
    this.add.text(px, y, '보관함', textStyle(33));
    this.add.text(px + 120, y + 10, `${d.stash.length}개 · 장착 중 ${owners.length} · 영웅 탭에서 장착`, textStyle(18, C.dim));
    y += 50;
    const listBottom = PAGE_BOTTOM - TAB_H - 16;
    const rowH = 64;
    const perPage = Math.max(1, Math.floor((listBottom - y - 40) / rowH));
    const pages = Math.max(1, Math.ceil(d.stash.length / perPage));
    this.stashPage = Math.min(this.stashPage, pages - 1);
    if (d.stash.length === 0) {
      this.add.text(W / 2, y + 40, '아직 만든 무기가 없습니다', textStyle(22, C.faint)).setOrigin(0.5);
    }
    const items = [...d.stash].sort((a, b) => b.grade - a.grade || b.tier - a.tier).slice(this.stashPage * perPage, (this.stashPage + 1) * perPage);
    items.forEach((w, i) => {
      const ry = y + i * rowH;
      const g = this.add.graphics();
      g.fillStyle(C.panel, 1).fillRoundedRect(px, ry, pw, rowH - 8, 8);
      g.fillStyle(GRADES[w.grade].color, 1).fillRect(px, ry, 6, rowH - 8);
      this.add.image(px + 40, ry + (rowH - 8) / 2, weaponIcon(this, w.cls, w.tier, w.grade)).setScale(3.4);
      this.add.text(px + 76, ry + 6, weaponName(w), textStyle(22, GRADES[w.grade].str));
      this.add.text(px + 76, ry + 32, weaponDesc(w), textStyle(18, C.dim));
      this.add.text(px + pw - 14, ry + 8, CLASSES[w.cls].name, textStyle(18, C.faint)).setOrigin(1, 0);
    });
    if (pages > 1) {
      const by = listBottom - 16;
      this.add.text(W / 2, by, `${this.stashPage + 1} / ${pages}`, textStyle(18, C.dim)).setOrigin(0.5);
      const prev = button(this, W / 2 - 120, by, 120, 40, '이전', () => {
        this.stashPage--;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
      prev.setEnabled(this.stashPage > 0);
      const next = button(this, W / 2 + 120, by, 120, 40, '다음', () => {
        this.stashPage++;
        this.requestRender();
      }, { fill: C.panelHi, textColor: C.text, size: 18 });
      next.setEnabled(this.stashPage < pages - 1);
    }
  }
}
