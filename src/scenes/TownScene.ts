import { josa } from '../ui/josa';
import { buildingTexture } from '../art/buildings';
import { baseBg, buildingKey, drawCover, fitScale, potionKey, resampled } from '../art/hd';
import { ensureHeroTextures } from '../art/textures';
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
  hospitalSlots,
  recruitOdds,
  trainingSlots,
  type FacilityId,
  type PotionId,
} from '../data/base';
import { GRADES, MATERIALS, hasMats, spendMats, type MatKind, type MaterialId } from '../data/items';
import type { Hero } from '../data/heroes';
import { CodexScene } from './CodexScene';
import { tutActive, tutDone } from '../tutorial/overlay';
import {
  admitHospital,
  buildSlots,
  canAdmit,
  dischargeHospital,
  isAvailable,
  fallen,
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

/** 건물 자리: 광장 중심에서 (가로, 세로) px. 위 둘 사이로 탑 가는 길 */
const PLOTS: Record<FacilityId, [number, number]> = {
  dorm: [-170, -118],
  recruit: [170, -118],
  training: [-248, 78],
  smithy: [248, 78],
  alchemy: [-170, 280],
  hospital: [170, 280],
};
/** 건물 그림이 차지하는 폭 (px) */
const BLD_W = 176;

/** 칸이 좁을 때 큰 수 줄이기: 1234 → 1.2k */
const short = (n: number, from: number) => (n >= from ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`);

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
  private profileOpen = false;
  /** 자원 칸 펼침 (2·3단계 재료) */
  private resOpen = false;

  constructor() {
    super('base');
  }

  protected onEnter(): void {
    this.open = null;
    this.picking = false;
    this.recruited = null;
    this.profileOpen = false;
  }

  protected draw(): void {
    const d = game.data;
    const now = Date.now();

    // ── 배경 ──
    const top = PAGE_TOP + 96;
    const bottom = PAGE_BOTTOM - TAB_H;
    const bg = drawCover(this, baseBg(Math.min(...FACILITY_IDS.map((f) => d.facilities[f]))), 0, PAGE_TOP, W, bottom - PAGE_TOP, 0);
    // 그림 속 광장 (가로 50%, 세로 56.2%)과 지평선 (32.4%). 그림 크기가 바뀌어도 비율로
    const bw = bg ? bg.img.width * bg.s : W;
    const bh = bg ? bg.img.height * bg.s : bottom - top;
    const cx0 = bg ? bg.ox + bw * 0.5 : W / 2;
    const cy0 = bg ? bg.oy + bh * (355 / 632) : (top + bottom) / 2;
    this.drawHill(bg ? bg.oy + bh * (205 / 632) : top + 120);

    // ── 머리말 ──
    this.drawProfile();
    this.drawResources();

    // ── 건물: 광장을 둘러싼 여섯 자리 (광장 중심 기준, 아래 가장자리) ──
    const order = [...FACILITY_IDS].sort((a, b) => PLOTS[a][1] - PLOTS[b][1]);
    const labels: (() => void)[] = [];
    for (const id of order) {
      const [dx, dy] = PLOTS[id];
      const cx = cx0 + dx;
      const by = cy0 + dy;
      const lv = d.facilities[id];
      const build = d.builds.find((b) => b.id === id);
      const def = FACILITIES[id];
      const unlocked = d.test || lv > 0 || d.cleared >= def.unlock;
      const key = (build && lv === 0 ? buildingKey(this, 'scaffold') : buildingKey(this, lv > 0 ? id : 'lot', lv)) ?? buildingTexture(this, lv > 0 ? id : 'lot');
      const img = key.startsWith('bld-') ? this.add.image(Math.round(cx), Math.round(by), resampled(this, key, BLD_W)).setOrigin(0.5, 0.94) : this.add.image(cx, by, key).setOrigin(0.5, 0.94).setScale(4.6);
      if (!unlocked) img.setTint(0x6a6a7a).setAlpha(0.6);
      if (build && lv > 0) {
        // 업그레이드 중: 옆에 작은 비계
        const sk = buildingKey(this, 'scaffold');
        if (sk) this.add.image(Math.round(cx + BLD_W * 0.32), Math.round(by + 4), resampled(this, sk, Math.round(BLD_W * 0.45))).setOrigin(0.5, 0.94);
      }
      // 훈련장·병원: 자리마다 맡긴 영웅 얼굴 / 빈자리 (맡길 영웅이 있으면 초록 테두리)
      if (lv > 0 && (id === 'training' || id === 'hospital')) {
        const slots = id === 'training' ? trainingSlots(lv) : hospitalSlots(lv);
        const inSlot = living().filter((p) => (id === 'training' ? p.status === 'training' : !!p.ward));
        const canFill = living().some((p) => (id === 'training' ? isAvailable(p) : canAdmit(p)));
        labels.push(() => this.drawSlotPips(cx, by - 24, slots, inSlot, canFill)); // 건물 앞마당 위
      }
      labels.push(() => {
        const label = lv > 0 ? `${def.name} Lv${lv}` : def.name;
        const t = this.add.text(cx, by + 4, label, textStyle(22, lv > 0 ? C.text : C.dim, { stroke: '#14111c', strokeThickness: 5 })).setOrigin(0.5, 0);
        let sub = '';
        let subColor = C.dim;
        if (build) {
          sub = `건설 중 ${fmtLong(build.end - now)}`;
          subColor = '#9fd0ff';
        } else if (!unlocked) {
          sub = `탑 ${def.unlock}층 클리어 후`;
          subColor = C.faint;
        } else if (lv === 0) {
          sub = id === 'recruit' && tutActive() ? '무료 건설' : '건설 가능';
          subColor = C.greenStr;
        } else if (lv < FACILITY_MAX && canAffordBuild(id, d)) {
          sub = '업그레이드 가능';
          subColor = C.greenStr;
        }
        if (sub) this.add.text(cx, t.y + 28, sub, textStyle(18, subColor, { stroke: '#14111c', strokeThickness: 4 })).setOrigin(0.5, 0);
      });
      const zh = BLD_W * 0.95 + 50;
      this.add
        .zone(cx, by - BLD_W * 0.95 + zh / 2, BLD_W, zh)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (!unlocked) return;
          if (id === 'recruit') tutDone('plot');
          this.open = id;
          this.picking = false;
          this.recruited = null;
          this.requestRender();
        });
      this.mark(`plot-${id}`, cx - BLD_W / 2 - 6, by - BLD_W * 0.95 - 6, BLD_W + 12, zh + 12);
      // 새로 지을 수 있게 된 시설 안내 (처음 한 번)
      if (unlocked && lv === 0 && !build && id !== 'recruit' && !d.test) this.tip(`unlock-${id}`, `${josa(def.name, '을', '를')} 지을 수 있게 됐어.\n${def.desc}.`);
    }
    for (const l of labels) l();

    if (this.profileOpen) this.layer(100, () => this.drawProfileDetail());
    if (this.open) {
      const id = this.open;
      this.layer(100, () => this.drawPanel(id));
    }
  }

  /** 시설 위의 자리 표시: 채운 자리는 영웅 얼굴, 빈자리는 + */
  private drawSlotPips(cx: number, y: number, slots: number, heroes: Hero[], canFill: boolean): void {
    const r = 17;
    const gap = 6;
    const total = slots * r * 2 + (slots - 1) * gap;
    const g = this.add.graphics();
    for (let i = 0; i < slots; i++) {
      const x = cx - total / 2 + r + i * (r * 2 + gap);
      const hero = heroes[i];
      g.fillStyle(0x14111c, 0.9).fillCircle(x, y, r);
      if (hero) {
        ensureHeroTextures(this, hero);
        this.add.image(x, y + 2, `face-${hero.id}`).setScale(1.25);
        g.lineStyle(3, C.gold, 1).strokeCircle(x, y, r);
      } else {
        g.lineStyle(3, canFill ? C.green : 0x5a5070, 1).strokeCircle(x, y, r);
        this.add.text(x, y, '+', textStyle(22, canFill ? C.greenStr : C.faint)).setOrigin(0.5);
      }
    }
    // 얼굴이 원 밖으로 나가지 않게 테두리를 위에 한 번 더
    const top = this.add.graphics();
    for (let i = 0; i < slots; i++) {
      const x = cx - total / 2 + r + i * (r * 2 + gap);
      if (heroes[i]) top.lineStyle(3, C.gold, 1).strokeCircle(x, y, r);
    }
  }

  /** 왼쪽 위 프로필: 대표 영웅 얼굴, 이름, 탑 층. 누르면 자세히 */
  private drawProfile(): void {
    const d = game.data;
    const x = 16;
    const y = PAGE_TOP + 14;
    const w = 236;
    const g = this.add.graphics();
    g.fillStyle(0x0b0910, 0.72).fillRoundedRect(x, y, w, 82, 14);
    g.lineStyle(2, C.gold, 0.8).strokeRoundedRect(x, y, w, 82, 14);
    g.fillStyle(C.bgDeep, 1).fillRoundedRect(x + 8, y + 8, 66, 66, 10);
    g.lineStyle(2, C.gold, 1).strokeRoundedRect(x + 8, y + 8, 66, 66, 10);
    const lead = [...living()].sort((a, b) => b.level - a.level || (b.grade ?? 0) - (a.grade ?? 0))[0];
    if (lead) {
      ensureHeroTextures(this, lead);
      this.add.image(x + 41, y + 41, `face-${lead.id}`).setScale(2.6);
    } else if (this.textures.exists('advisor')) {
      this.add.image(x + 41, y + 41, 'advisor').setDisplaySize(58, 58);
    }
    this.add.text(x + 86, y + 12, d.playerName ?? '영주', textStyle(26, C.goldStr));
    this.add.text(x + 86, y + 48, `탑 ${d.cleared}층`, textStyle(22, C.text));
    this.add.zone(x + w / 2, y + 41, w, 82).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.profileOpen = true;
      this.requestRender();
    });
    const builds = d.builds.length;
    this.add.text(x + 4, y + 96, `건설 ${builds}/${buildSlots(d)}${d.test ? ' · 테스트' : ''}`, textStyle(18, builds >= buildSlots(d) ? C.redStr : C.dim, { stroke: '#14111c', strokeThickness: 4 }));
  }

  /** 프로필 자세히 */
  private drawProfileDetail(): void {
    const d = game.data;
    const close = () => {
      this.profileOpen = false;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const x = 40;
    const w = W - 80;
    const y = PAGE_TOP + 140;
    const dead = fallen();
    const tiers = [1, 2, 3].map((t) => dead.filter((h) => h.legacy?.tier === t).length);
    const kills = Object.values(d.monsterKills ?? {}).reduce((a, n) => a + n, 0);
    const best = [...living()].sort((a, b) => b.level - a.level)[0];
    const facSum = FACILITY_IDS.reduce((a, f) => a + d.facilities[f], 0);
    const rows: [string, string][] = [
      ['최고 층', `탑 ${d.cleared}층`],
      ['영웅', `${living().length} / ${rosterCap(d)}명`],
      ['최고 레벨', best ? `${best.name} Lv ${best.level}` : '-'],
      ['전사한 영웅', `${dead.length}명`],
      ['영웅의 언덕', `비석 ${tiers[0]} · 기념비 ${tiers[1]} · 동상 ${tiers[2]}`],
      ['쓰러뜨린 몬스터', `${kills}마리`],
      ['도감', `몬스터 ${(d.seen ?? []).length}종 발견`],
      ['기지', `시설 레벨 합계 ${facSum} / ${FACILITY_IDS.length * FACILITY_MAX}`],
    ];
    const h = 150 + rows.length * 52 + 100;
    panel(this, x, y, w, h, C.panel, C.gold);
    this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive();
    this.add.text(x + 28, y + 26, d.playerName ?? '영주', textStyle(44, C.goldStr));
    this.add.text(x + 28, y + 86, '기지의 기록', textStyle(18, C.dim));
    rows.forEach(([k, v], i) => {
      const ry = y + 130 + i * 52;
      this.add.text(x + 28, ry, k, textStyle(22, C.dim));
      this.add.text(x + w - 28, ry, v, textStyle(22)).setOrigin(1, 0);
    });
    button(this, x + w / 2, y + h - 56, 240, 68, '닫기', close, { size: 22 });
  }

  /**
   * 프로필 오른쪽 자원: 골드 · 나무 · 철 · 마석 (대장간 재료 배치처럼 종류별 세로줄).
   * 평소엔 1단계만, 누르면 2·3단계까지 펼침
   */
  private drawResources(): void {
    const d = game.data;
    const x = 262;
    const y = PAGE_TOP + 14;
    const w = W - 16 - x;
    const open = this.resOpen;
    const rowH = 34;
    const h = open ? 82 + rowH * 2 + 6 : 82;
    const g = this.add.graphics();
    g.fillStyle(0x0b0910, 0.78).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(2, C.gold, 0.5).strokeRoundedRect(x, y, w, h, 14);
    const cols: { label: string; kind: 'gold' | MatKind }[] = [
      { label: '골드', kind: 'gold' },
      { label: '나무', kind: 'wood' },
      { label: '철', kind: 'metal' },
      { label: '마석', kind: 'crystal' },
    ];
    const cw = w / cols.length;
    cols.forEach((c, i) => {
      const cx = x + i * cw;
      this.add.text(cx + 14, y + 10, c.label, textStyle(18, C.faint));
      const tiers = c.kind === 'gold' ? [0] : open ? [1, 2, 3] : [1];
      tiers.forEach((t, k) => {
        const ry = y + 52 + k * rowH;
        const id = c.kind === 'gold' ? null : (`${c.kind}${t}` as MaterialId);
        const n = id ? d.materials[id] ?? 0 : d.gold;
        const icon = id ? matIcon(this, id) : this.textures.exists('mat-gold') ? 'mat-gold' : null;
        if (icon) this.add.image(cx + 26, ry, icon).setDisplaySize(28, 28);
        this.add.text(cx + 44, ry, short(n, id ? 10000 : 1_000_000), textStyle(18, !id ? C.goldStr : n > 0 ? C.text : C.faint)).setOrigin(0, 0.5);
      });
    });
    this.add.text(x + w - 12, y + h - 4, open ? '▲' : '▼', textStyle(18, C.faint)).setOrigin(1, 1);
    this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.resOpen = !this.resOpen;
      this.requestRender();
    });
  }

  /** 영웅의 언덕 (GDD 3.8): 유산을 남긴 영웅의 비석·기념비·동상. 기여도 높은 순으로 최대 10개 */
  private drawHill(hy: number): void {
    const g = this.add.graphics();
    const stones = fallen()
      .filter((h) => (h.legacy?.tier ?? 0) > 0)
      .sort((a, b) => b.legacy!.score - a.legacy!.score)
      .slice(0, 10);
    const xs = [70, 650, 130, 590, 190, 530, 250, 470, 30, 690];
    stones.forEach((h, i) => {
      const x = xs[i];
      const base = hy - 14 + (i % 2 ? 4 : 0);
      const tier = h.legacy!.tier;
      if (tier === 1) {
        g.fillStyle(0x8a8a9a, 1).fillRoundedRect(x - 7, base - 16, 14, 18, 4);
        g.fillStyle(0x5a5a6a, 1).fillRect(x - 7, base - 2, 14, 3);
      } else if (tier === 2) {
        g.fillStyle(0x6a6a7a, 1).fillRect(x - 10, base - 4, 20, 6);
        g.fillStyle(0xb8c2d4, 1).fillTriangle(x - 6, base - 4, x + 6, base - 4, x, base - 40);
      } else {
        g.fillStyle(0x6a6a7a, 1).fillRect(x - 12, base - 10, 24, 12);
        g.fillStyle(0xe8c25a, 1).fillRect(x - 5, base - 34, 10, 24).fillCircle(x, base - 40, 6);
        g.fillStyle(0xe8c25a, 1).fillRect(x + 5, base - 44, 3, 22);
      }
    });
    if (stones.length) {
      this.add.text(150, hy + 22, `영웅의 언덕 · ${fallen().filter((h) => (h.legacy?.tier ?? 0) > 0).length}`, textStyle(18, C.dim, { stroke: '#14111c', strokeThickness: 4 })).setOrigin(0.5);
      this.add.zone(W / 2, hy, W, 60).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        CodexScene.openFallen();
        this.go('codex');
      });
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
    const pk = buildingKey(this, lv > 0 ? id : 'lot', lv) ?? buildingTexture(this, lv > 0 ? id : 'lot');
    if (pk.startsWith('bld-')) this.add.image(x + 90, y + 170, resampled(this, pk, 150)).setOrigin(0.5, 0.94);
    else this.add.image(x + 90, y + 170, pk).setOrigin(0.5, 0.94).setScale(4);
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
    const tutorialFree = id === 'recruit' && lv === 0 && tutActive();
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
          this.add.image(mx + 12, cy + 46, matIcon(this, k)).setScale(fitScale(this, matIcon(this, k), 2));
          const t = this.add.text(mx + 28, cy + 46, `${MATERIALS[k].name} ${have}/${n}`, textStyle(18, have >= n ? '#8fe0a0' : C.redStr)).setOrigin(0, 0.5);
          mx += t.width + 50;
        }
      this.add.text(x + w - 24, cy, `시간 ${tutorialFree || d.test || BUILD_MS[to - 1] === 0 ? '즉시' : fmtLong(BUILD_MS[to - 1])}`, textStyle(22, C.dim)).setOrigin(1, 0);
      const slotsFull = d.builds.length >= buildSlots(d);
      const can = tutorialFree || (!slotsFull && canAffordBuild(id, d));
      const bb = button(this, x + w / 2 - (slotsFull && !tutorialFree ? 150 : 0), cy + 110, slotsFull && !tutorialFree ? 280 : w - 48, 72, lv === 0 ? '건설' : `Lv ${to}로 업그레이드`, () => {
        startBuild(id, d, Date.now(), tutorialFree);
        tutDone('build');
        save();
        this.requestRender();
      }, { size: 26 });
      bb.setEnabled(can);
      this.mark('build', bb.x - bb.width / 2, bb.y - bb.height / 2, bb.width, bb.height);
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
      else if (id === 'hospital') this.hospitalPanel(x, fy, w);
      else if (id === 'alchemy') this.alchemyPanel(x, fy, w);
      else if (id === 'dorm') this.add.text(x + 24, fy + 10, `영웅 ${living().length} / ${rosterCap(d)}명`, textStyle(26));
    }

    button(this, x + w / 2, y + h - 56, 260, 72, '닫기', () => {
      tutDone('close');
      close();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    this.mark('close', x + w / 2 - 130, y + h - 92, 260, 72);
  }

  private recruitPanel(x: number, y: number, w: number, h: number): void {
    const d = game.data;
    const left = recruitLeft(d);
    const odds = recruitOdds(d.facilities.recruit);
    this.add.text(x + 24, y, '등급 확률', textStyle(22, C.goldStr));
    this.mark('odds', x + 16, y - 6, w - 32, 70);
    let ox = x + 24;
    odds.forEach((p, i) => {
      if (p <= 0) return;
      const t = this.add.text(ox, y + 36, `${GRADES[i].name} ${p}%`, textStyle(18, GRADES[i].str));
      ox += t.width + 18;
    });
    const full = living().length >= rosterCap(d);
    const tut = tutActive();
    this.mark('recruitFree', x + 24, y + 74, w / 2 - 36, 72);
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
      this.mark('recruited', x + 40, y + 200, w - 80, 200);
    }
    void h;
  }

  private doRecruit(kind: 'free' | 'ad'): void {
    const h = recruitDaily(kind);
    if (h) {
      tutDone('recruit');
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
      const cands = living().filter((x2) => isAvailable(x2));
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
        b.setEnabled(living().some((x2) => isAvailable(x2)));
      }
    }
    void h;
  }

  /** 병원: 침대마다 영웅 1명 입원. 입원한 영웅만 빨리 낫고, 다 나으면 자동 퇴원 */
  private hospitalPanel(x: number, y: number, w: number): void {
    const d = game.data;
    const beds = hospitalSlots(d.facilities.hospital);
    const patients = living().filter((p) => p.ward);
    this.add.text(x + 24, y, `입원 ${patients.length}/${beds} · 다 나으면 자동 퇴원 · 입원 중엔 출전 불가`, textStyle(18, C.dim));
    if (this.picking) {
      const cands = living().filter((p) => canAdmit(p));
      this.add.text(x + 24, y + 30, '입원시킬 영웅 선택 (중상이거나 기력이 덜 찬 영웅)', textStyle(18, C.goldStr));
      const cw = (w - 60) / 2;
      cands.slice(0, 8).forEach((hero, i) => {
        heroCard(this, x + 24 + (i % 2) * (cw + 12), y + 60 + Math.floor(i / 2) * 104, cw, 96, hero, {
          onTap: () => {
            admitHospital(hero);
            this.picking = false;
            save();
            this.requestRender();
          },
        });
      });
      if (cands.length === 0) this.add.text(x + w / 2, y + 120, '입원할 영웅이 없습니다', textStyle(22, C.faint)).setOrigin(0.5);
      return;
    }
    for (let i = 0; i < beds; i++) {
      const sy = y + 36 + i * 108;
      const hero = patients[i];
      if (hero) {
        heroCard(this, x + 24, sy, w - 220, 96, hero);
        button(this, x + w - 100, sy + 48, 140, 60, '퇴원', () => {
          dischargeHospital(hero);
          save();
          this.requestRender();
        }, { fill: C.panelHi, textColor: C.text, size: 22 });
      } else {
        const b = button(this, x + w / 2, sy + 48, w - 48, 80, '+ 입원시키기', () => {
          this.picking = true;
          this.requestRender();
        }, { fill: C.panelHi, textColor: C.text, size: 22 });
        b.setEnabled(living().some((p) => canAdmit(p)));
      }
    }
  }

  private alchemyPanel(x: number, y: number, w: number): void {
    const d = game.data;
    const n = ALCHEMY_UNLOCK[d.facilities.alchemy - 1];
    POTION_ORDER.slice(0, n).forEach((pid: PotionId, i) => {
      const p = POTIONS[pid];
      const ry = y + i * 110;
      const have = d.potions[pid] ?? 0;
      const pk = potionKey(this, pid);
      const tx = pk ? x + 104 : x + 24;
      if (pk) this.add.image(x + 54, ry + 40, pk).setScale(84 / 256);
      this.add.text(tx, ry, `${p.name}  보유 ${have}`, textStyle(22));
      // 버튼(다음 전투·제조)과 겹치지 않게 줄바꿈
      const btnLeft = x + w - (pid === 'might' || pid === 'guard' || pid === 'antidote' ? 316 : 166);
      const desc = this.add.text(tx, ry + 30, p.desc, textStyle(18, C.dim, { wordWrap: { width: btnLeft - tx } }));
      const need = [...(Object.entries(p.mats) as [MaterialId, number][]).map(([k, v]) => ({ id: k, n: v }))];
      this.add.text(tx, desc.y + desc.height + 2, `골드 ${p.gold} · ${need.map((r) => `${MATERIALS[r.id].name} ${r.n}`).join(', ')}`, textStyle(18, C.faint));
      const can = d.gold >= p.gold && hasMats(d.materials, need);
      const bb = button(this, x + w - 90, ry + 30, 140, 56, '제조', () => {
        d.gold -= p.gold;
        spendMats(d.materials, need);
        d.potions[pid] = have + 1;
        save();
        this.requestRender();
      }, { size: 22 });
      bb.setEnabled(can);
      if (pid === 'might' || pid === 'guard' || pid === 'antidote') {
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
