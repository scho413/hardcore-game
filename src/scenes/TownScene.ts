import { BH, BW, buildingTexture } from '../art/buildings';
import { matIcon } from '../art/itemArt';
import {
  ALCHEMY_UNLOCK,
  BUILD_MS,
  FACILITIES,
  FACILITY_IDS,
  FACILITY_MAX,
  POTIONS,
  POTION_ORDER,
  RECRUIT_ADS,
  RECRUIT_FREE,
  buildCost,
  recruitOdds,
  trainingSlots,
  type FacilityId,
  type PotionId,
} from '../data/base';
import { GRADES, MATERIALS, hasMats, spendMats, type MaterialId } from '../data/items';
import type { Hero } from '../data/heroes';
import {
  buildSlots,
  canAffordBuild,
  game,
  living,
  recruitDaily,
  recruitLeft,
  rosterCap,
  save,
  speedUpBuild,
  startBuild,
  startTraining,
  stopTraining,
} from '../state';
import { fmtTime, heroCard, shade } from '../ui/heroUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, panel } from '../ui/widgets';

/** 건물 자리 (마을 그림 위 좌표, 가운데 아래 기준) */
const PLOTS: Record<FacilityId, { x: number; y: number }> = {
  dorm: { x: 190, y: 0 },
  recruit: { x: 530, y: 0 },
  smithy: { x: 190, y: 1 },
  hospital: { x: 530, y: 1 },
  training: { x: 190, y: 2 },
  alchemy: { x: 530, y: 2 },
};
const SCALE = 5;

const fmtLong = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
};

/** 기지 탭 (GDD 9): 마을 그림 위의 건물을 탭해서 짓고, 올리고, 들어감 */
export class TownScene extends Page {
  protected tab = 'base' as const;
  private open: FacilityId | null = null;
  private picking = false;
  private recruited: Hero | null = null;

  constructor() {
    super('base');
  }

  protected onEnter(): void {
    this.open = null;
    this.picking = false;
    this.recruited = null;
  }

  protected draw(): void {
    const d = game.data;
    const now = Date.now();

    // ── 하늘·땅 ──
    const top = PAGE_TOP + 96;
    const bottom = PAGE_BOTTOM - TAB_H;
    const g = this.add.graphics();
    g.fillStyle(0x1e2a44, 1).fillRect(0, PAGE_TOP, W, top + 120);
    g.fillStyle(0x2a3a5a, 1).fillRect(0, top + 60, W, 60);
    // 멀리 보이는 탑
    g.fillStyle(0x151a2c, 1).fillRect(W / 2 - 34, PAGE_TOP + 10, 68, top + 110);
    g.fillTriangle(W / 2 - 44, PAGE_TOP + 14, W / 2 + 44, PAGE_TOP + 14, W / 2, PAGE_TOP - 30);
    for (let i = 0; i < 6; i++) g.fillStyle(0xffd27a, 0.5).fillRect(W / 2 - 4, PAGE_TOP + 30 + i * 30, 8, 10);
    g.fillStyle(0x3a5a34, 1).fillRect(0, top + 120, W, bottom - top - 120);
    g.fillStyle(0x6a5a3a, 1).fillRect(W / 2 - 30, top + 120, 60, bottom - top - 120);
    g.fillStyle(0x5a4a30, 1);
    for (let y = top + 140; y < bottom; y += 40) g.fillRect(W / 2 - 22, y, 44, 6);

    // ── 머리말 ──
    this.add.text(32, PAGE_TOP + 52, '기지', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(W - 28, PAGE_TOP + 40, `골드 ${d.gold}`, textStyle(26, C.goldStr)).setOrigin(1, 0.5);
    const builds = d.builds.length;
    this.add.text(W - 28, PAGE_TOP + 74, `건설 ${builds}/${buildSlots(d)}${d.test ? ' · 테스트' : ''}`, textStyle(18, builds >= buildSlots(d) ? C.redStr : C.dim)).setOrigin(1, 0.5);

    // ── 건물 ──
    const rowH = Math.min(300, (bottom - (top + 150)) / 3);
    for (const id of FACILITY_IDS) {
      const p = PLOTS[id];
      const cx = p.x;
      const by = top + 150 + p.y * rowH + rowH - 70;
      const lv = d.facilities[id];
      const build = d.builds.find((b) => b.id === id);
      const def = FACILITIES[id];
      const unlocked = d.test || d.cleared >= def.unlock || (id === 'recruit' && d.tutorial >= 1);
      const img = this.add.image(cx, by, buildingTexture(this, lv > 0 ? id : 'lot')).setOrigin(0.5, 1).setScale(SCALE);
      if (!unlocked) img.setAlpha(0.35);
      if (build) this.add.image(cx, by, buildingTexture(this, 'scaffold')).setOrigin(0.5, 1).setScale(SCALE).setAlpha(0.9);
      // 이름표
      const label = lv > 0 ? `${def.name} Lv${lv}` : def.name;
      const t = this.add.text(cx, by + 10, label, textStyle(22, lv > 0 ? C.text : C.dim, { stroke: '#14111c', strokeThickness: 5 })).setOrigin(0.5, 0);
      let sub = '';
      let subColor = C.dim;
      if (build) {
        sub = `건설 중 ${fmtLong(build.end - now)}`;
        subColor = '#9fd0ff';
      } else if (!unlocked) {
        sub = `탑 ${def.unlock}층 클리어 후`;
        subColor = C.faint;
      } else if (lv === 0) {
        sub = id === 'recruit' && d.tutorial === 1 ? '무료 건설' : '건설 가능';
        subColor = C.greenStr;
      } else if (lv < FACILITY_MAX && canAffordBuild(id, d)) {
        sub = '업그레이드 가능';
        subColor = C.greenStr;
      }
      if (sub) this.add.text(cx, t.y + 30, sub, textStyle(18, subColor, { stroke: '#14111c', strokeThickness: 4 })).setOrigin(0.5, 0);
      this.add
        .zone(cx, by - (BH * SCALE) / 2 + 30, BW * SCALE + 20, BH * SCALE + 60)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (!unlocked) return;
          this.open = id;
          this.picking = false;
          this.recruited = null;
          this.requestRender();
        });
      if (d.tutorial === 1 && id === 'recruit') this.hint(cx, by - BH * SCALE - 30, '모집소를 지어 보세요');
      if (d.tutorial === 2 && id === 'recruit' && !this.open) this.hint(cx, by - BH * SCALE - 30, '영웅을 모집하세요');
    }

    if (this.open) {
      const id = this.open;
      this.layer(100, () => this.drawPanel(id));
    }
  }

  // ───────── 시설 창 ─────────
  private drawPanel(id: FacilityId): void {
    const d = game.data;
    const now = Date.now();
    const close = () => {
      this.open = null;
      this.picking = false;
      this.recruited = null;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const x = 24;
    const w = W - 48;
    const y = PAGE_TOP + 40;
    const h = Math.min(PAGE_BOTTOM - 40, 1250) - y;
    panel(this, x, y, w, h, C.panel, C.gold);
    this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive();

    const def = FACILITIES[id];
    const lv = d.facilities[id];
    this.add.image(x + 90, y + 160, buildingTexture(this, lv > 0 ? id : 'lot')).setOrigin(0.5, 1).setScale(4);
    this.add.text(x + 180, y + 24, def.name, textStyle(44, C.goldStr));
    this.add.text(x + 180, y + 82, lv > 0 ? `Lv ${lv} / ${FACILITY_MAX}` : '아직 짓지 않음', textStyle(22, C.dim));
    this.add.text(x + 180, y + 114, def.desc, textStyle(18, C.dim, { wordWrap: { width: w - 200 } }));

    // 효과
    let cy = y + 190;
    if (lv > 0) this.add.text(x + 24, cy, `지금: ${def.effect(lv)}`, textStyle(22));
    if (lv < FACILITY_MAX) this.add.text(x + 24, cy + 32, `${lv > 0 ? '다음' : '지으면'}: ${def.effect(lv + 1)}`, textStyle(22, C.greenStr));
    cy += 80;

    // 건설·업그레이드
    const build = d.builds.find((b) => b.id === id);
    const tutorialFree = id === 'recruit' && d.tutorial === 1 && lv === 0;
    if (build) {
      const total = build.end - build.start;
      const g = this.add.graphics();
      g.fillStyle(C.hpBack, 1).fillRoundedRect(x + 24, cy, w - 48, 16, 6);
      g.fillStyle(0x8fd0ff, 1).fillRoundedRect(x + 24, cy, (w - 48) * Math.min(1, (now - build.start) / Math.max(1, total)), 16, 6);
      this.add.text(x + 24, cy + 26, `Lv ${build.to} 건설 중 · ${fmtLong(build.end - now)} 남음`, textStyle(22, '#9fd0ff'));
      button(this, x + w / 2 - 150, cy + 100, 280, 64, '광고 보고 -30분', () => {
        speedUpBuild(id, d, Date.now());
        save();
        this.requestRender();
      }, { size: 22, fill: 0x8fd0ff });
      if (d.test)
        button(this, x + w / 2 + 150, cy + 100, 260, 64, '즉시 완료 (테스트)', () => {
          speedUpBuild(id, d, Date.now(), Infinity);
          save();
          this.requestRender();
        }, { size: 18, fill: C.panelHi, textColor: C.text });
      cy += 150;
    } else if (lv < FACILITY_MAX) {
      const to = lv + 1;
      const cost = buildCost(id, to);
      this.add.text(x + 24, cy, tutorialFree ? '비용: 무료 (튜토리얼)' : `비용: 골드 ${cost.gold}`, textStyle(22, tutorialFree || d.gold >= cost.gold ? C.text : C.redStr));
      let mx = x + 24;
      if (!tutorialFree)
        for (const [k, n] of Object.entries(cost.mats) as [MaterialId, number][]) {
          const have = d.materials[k] ?? 0;
          this.add.image(mx + 12, cy + 46, matIcon(this, k)).setScale(2);
          const t = this.add.text(mx + 28, cy + 46, `${MATERIALS[k].name} ${have}/${n}`, textStyle(18, have >= n ? '#8fe0a0' : C.redStr)).setOrigin(0, 0.5);
          mx += t.width + 50;
        }
      this.add.text(x + w - 24, cy, `시간 ${tutorialFree || d.test ? '즉시' : fmtLong(BUILD_MS[to - 1])}`, textStyle(22, C.dim)).setOrigin(1, 0);
      const slotsFull = d.builds.length >= buildSlots(d);
      const can = tutorialFree || (!slotsFull && canAffordBuild(id, d));
      const bb = button(this, x + w / 2 - (slotsFull && !tutorialFree ? 150 : 0), cy + 110, slotsFull && !tutorialFree ? 280 : w - 48, 72, lv === 0 ? '건설' : `Lv ${to}로 업그레이드`, () => {
        startBuild(id, d, Date.now(), tutorialFree);
        if (tutorialFree) d.tutorial = 2;
        save();
        this.requestRender();
      }, { size: 26 });
      bb.setEnabled(can);
      if (slotsFull && !tutorialFree) {
        const ab = button(this, x + w / 2 + 150, cy + 110, 280, 72, d.bonusSlot ? '임시 자리 있음' : '광고 보고 자리 +1', () => {
          d.bonusSlot = true;
          save();
          this.requestRender();
        }, { size: 18, fill: 0x8fd0ff });
        ab.setEnabled(!d.bonusSlot);
        this.add.text(x + w / 2, cy + 160, '동시 건설은 1개. 광고를 보면 다음 건설 1번은 2개까지', textStyle(18, C.faint)).setOrigin(0.5, 0);
      }
      cy += 200;
    } else {
      this.add.text(x + 24, cy, '최고 레벨', textStyle(22, C.goldStr));
      cy += 50;
    }

    // ── 시설별 기능 ──
    const fy = cy;
    const fh = y + h - 110 - fy;
    if (lv > 0) {
      if (id === 'recruit') this.recruitPanel(x, fy, w, fh);
      else if (id === 'smithy') {
        button(this, x + w / 2, fy + 50, w - 48, 80, '대장간 들어가기', () => this.go('smithy'), { size: 30 });
      } else if (id === 'training') this.trainingPanel(x, fy, w, fh);
      else if (id === 'alchemy') this.alchemyPanel(x, fy, w);
      else if (id === 'dorm') this.add.text(x + 24, fy + 10, `영웅 ${living().length} / ${rosterCap(d)}명`, textStyle(26));
    }

    button(this, x + w / 2, y + h - 56, 260, 72, '닫기', close, { fill: C.panelHi, textColor: C.text, size: 22 });
  }

  private recruitPanel(x: number, y: number, w: number, h: number): void {
    const d = game.data;
    const left = recruitLeft(d);
    const odds = recruitOdds(d.facilities.recruit);
    this.add.text(x + 24, y, '등급 확률', textStyle(22, C.goldStr));
    let ox = x + 24;
    odds.forEach((p, i) => {
      if (p <= 0) return;
      const t = this.add.text(ox, y + 36, `${GRADES[i].name} ${p}%`, textStyle(18, GRADES[i].str));
      ox += t.width + 18;
    });
    const full = living().length >= rosterCap(d);
    const tut = d.tutorial === 2;
    const fb = button(this, x + w / 4 + 6, y + 110, w / 2 - 36, 72, tut ? '무료 모집 (튜토리얼)' : `무료 모집 ${left.free}/${RECRUIT_FREE}`, () => this.doRecruit('free'), { size: 22 });
    fb.setEnabled(!full && (tut || d.test || left.free > 0));
    const ab = button(this, x + (w * 3) / 4 - 6, y + 110, w / 2 - 36, 72, `광고 보고 모집 ${left.ads}/${RECRUIT_ADS}`, () => this.doRecruit('ad'), { size: 18, fill: 0x8fd0ff });
    ab.setEnabled(!full && !tut && (d.test || left.ads > 0));
    if (full) this.add.text(x + w / 2, y + 160, '숙소가 가득 찼습니다 (숙소 업그레이드)', textStyle(18, C.redStr)).setOrigin(0.5, 0);
    if (this.recruited) {
      const hero = this.recruited;
      const gc = GRADES[hero.grade];
      this.add.text(x + w / 2, y + 200, `${gc.name} 영웅 합류!`, textStyle(33, gc.str)).setOrigin(0.5, 0);
      heroCard(this, x + 40, y + 250, w - 80, 150, hero);
    }
    void h;
  }

  private doRecruit(kind: 'free' | 'ad'): void {
    const h = recruitDaily(kind);
    if (h) {
      save();
      this.recruited = h;
      this.cameras.main.flash(200, (GRADES[h.grade].color >> 16) & 255, (GRADES[h.grade].color >> 8) & 255, GRADES[h.grade].color & 255);
    }
    this.requestRender();
  }

  private trainingPanel(x: number, y: number, w: number, h: number): void {
    const d = game.data;
    const slots = trainingSlots(d.facilities.training);
    const trainees = living().filter((x2) => x2.status === 'training');
    this.add.text(x + 24, y, `훈련 중 ${trainees.length}/${slots} · 레벨 상한 ${Math.max(1, d.cleared)} (최고 클리어 층)`, textStyle(18, C.dim));
    if (this.picking) {
      const cands = living().filter((x2) => x2.status === 'ready');
      this.add.text(x + 24, y + 30, '맡길 영웅 선택 (진형에서 빠짐)', textStyle(18, C.goldStr));
      const cw = (w - 60) / 2;
      cands.slice(0, 8).forEach((hero, i) => {
        heroCard(this, x + 24 + (i % 2) * (cw + 12), y + 60 + Math.floor(i / 2) * 104, cw, 96, hero, {
          onTap: () => {
            startTraining(hero);
            this.picking = false;
            save();
            this.requestRender();
          },
        });
      });
      return;
    }
    const now = Date.now();
    for (let i = 0; i < slots; i++) {
      const sy = y + 36 + i * 108;
      const hero = trainees[i];
      if (hero) {
        heroCard(this, x + 24, sy, w - 220, 96, hero, { note: { text: `${fmtTime(Math.min(now - (hero.trainSince ?? now), 8 * 3600000))} / 8:00:00`, color: '#9fd0ff' } });
        button(this, x + w - 100, sy + 48, 140, 60, '빼기', () => {
          stopTraining(hero);
          save();
          this.requestRender();
        }, { fill: C.panelHi, textColor: C.text, size: 22 });
      } else {
        const b = button(this, x + w / 2, sy + 48, w - 48, 80, '+ 영웅 맡기기', () => {
          this.picking = true;
          this.requestRender();
        }, { fill: C.panelHi, textColor: C.text, size: 22 });
        b.setEnabled(living().some((x2) => x2.status === 'ready'));
      }
    }
    void h;
  }

  private alchemyPanel(x: number, y: number, w: number): void {
    const d = game.data;
    const n = ALCHEMY_UNLOCK[d.facilities.alchemy - 1];
    POTION_ORDER.slice(0, n).forEach((pid: PotionId, i) => {
      const p = POTIONS[pid];
      const ry = y + i * 110;
      const have = d.potions[pid] ?? 0;
      this.add.text(x + 24, ry, `${p.name}  보유 ${have}`, textStyle(22));
      this.add.text(x + 24, ry + 30, p.desc, textStyle(18, C.dim));
      const need = [...(Object.entries(p.mats) as [MaterialId, number][]).map(([k, v]) => ({ id: k, n: v }))];
      this.add.text(x + 24, ry + 56, `골드 ${p.gold} · ${need.map((r) => `${MATERIALS[r.id].name} ${r.n}`).join(', ')}`, textStyle(18, C.faint));
      const can = d.gold >= p.gold && hasMats(d.materials, need);
      const bb = button(this, x + w - 90, ry + 30, 140, 56, '제조', () => {
        d.gold -= p.gold;
        spendMats(d.materials, need);
        d.potions[pid] = have + 1;
        save();
        this.requestRender();
      }, { size: 22 });
      bb.setEnabled(can);
      if (pid === 'might' || pid === 'guard') {
        const on = !!d.elixirs[pid];
        const ub = button(this, x + w - 240, ry + 30, 140, 56, on ? '사용 예약됨' : '다음 전투', () => {
          if (on) {
            d.elixirs[pid] = false;
            d.potions[pid] = have + 1;
          } else {
            d.elixirs[pid] = true;
            d.potions[pid] = have - 1;
          }
          save();
          this.requestRender();
        }, { size: 18, fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text });
        ub.setEnabled(on || have > 0);
      }
    });
  }
}
