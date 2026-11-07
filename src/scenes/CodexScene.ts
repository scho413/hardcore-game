import { ensureHeroTextures } from '../art/textures';
import { CLASSES } from '../data/classes';
import { DUNGEONS, DUNGEON_IDS } from '../data/dungeons';
import { FLOORS } from '../data/floors';
import { TIER_NAME, contribution } from '../data/legacy';
import { MONSTERS, type MonsterId } from '../data/monsters';
import { FAMILIES } from '../data/races';
import { fallen, game } from '../state';
import { drawChronicle, fmtDate } from '../ui/chronicle';
import { shade } from '../ui/heroUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, chip, panel } from '../ui/widgets';

type Tab = 'monsters' | 'fallen';

/** 도감에 실릴 몬스터와 처음 나오는 곳 (탑 층 → 던전 → 소환) */
function codexList(): { id: MonsterId; where: string }[] {
  const out = new Map<MonsterId, string>();
  for (const f of FLOORS) for (const id of f.enemies) if (!out.has(id)) out.set(id, `탑 ${f.floor}층`);
  for (const dg of DUNGEON_IDS) {
    const d = DUNGEONS[dg];
    for (const id of [...d.weak, ...d.strong, d.boss]) if (!out.has(id)) out.set(id, `${d.name}${id === d.boss ? ' 10층' : ''}`);
  }
  // 소환되는 몬스터
  for (const m of Object.values(MONSTERS)) {
    for (const s of [...m.skills, ...(m.phases ?? []).flatMap((p) => p.skills)]) {
      if (s.effect.kind === 'summon' && !out.has(s.effect.monster as MonsterId)) out.set(s.effect.monster as MonsterId, `${m.name}이(가) 소환`);
    }
  }
  return [...out.entries()].map(([id, where]) => ({ id, where }));
}

/** 도감 탭 (GDD 10): 몬스터 도감 + 죽은 영웅 (추모의 벽, 유산) */
export class CodexScene extends Page {
  protected tab = 'codex' as const;
  private static view: Tab = 'monsters';
  private page = 0;
  private chron: { id: string; page: number } | null = null;
  private monster: MonsterId | null = null;

  constructor() {
    super('codex');
  }

  /** 다른 화면에서 죽은 영웅 탭으로 열 때 */
  static openFallen(): void {
    CodexScene.view = 'fallen';
  }

  protected onEnter(): void {
    this.page = 0;
    this.chron = null;
    this.monster = null;
  }

  protected draw(): void {
    this.add.text(32, PAGE_TOP + 52, '도감', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    const list = codexList();
    const seen = new Set(game.data.seen ?? []);
    const dead = fallen();
    const tabs: [Tab, string][] = [
      ['monsters', `몬스터 ${list.filter((m) => seen.has(m.id)).length}/${list.length}`],
      ['fallen', `죽은 영웅 ${dead.length}`],
    ];
    tabs.forEach(([t, label], i) => {
      const on = CodexScene.view === t;
      button(this, 290 + i * 220, PAGE_TOP + 52, 206, 56, label, () => {
        CodexScene.view = t;
        this.page = 0;
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 18 });
    });
    if (CodexScene.view === 'monsters') this.drawMonsters(list, seen);
    else this.drawFallen();
  }

  // ───────── 몬스터 ─────────
  private drawMonsters(list: { id: MonsterId; where: string }[], seen: Set<string>): void {
    const kills = game.data.monsterKills ?? {};
    const cols = 4;
    const cw = (W - 56 - (cols - 1) * 10) / cols;
    const ch = 150;
    const top = PAGE_TOP + 104;
    const bottom = PAGE_BOTTOM - TAB_H - 70;
    const rows = Math.max(1, Math.floor((bottom - top) / (ch + 10)));
    const per = rows * cols;
    const pages = Math.max(1, Math.ceil(list.length / per));
    this.page = Math.min(this.page, pages - 1);
    list.slice(this.page * per, (this.page + 1) * per).forEach(({ id }, i) => {
      const m = MONSTERS[id];
      const known = seen.has(id);
      const x = 28 + (i % cols) * (cw + 10);
      const y = top + Math.floor(i / cols) * (ch + 10);
      panel(this, x, y, cw, ch, known ? C.panel : 0x1a1622, m.boss && known ? C.red : C.line);
      const img = this.add.image(x + cw / 2, y + 58, `unit-${id}`).setScale(m.boss ? 4.2 : 3.6);
      if (!known) img.setTintFill(0x2a2436);
      this.add.text(x + cw / 2, y + 104, known ? m.name : '???', textStyle(18, known ? (m.boss ? C.redStr : C.text) : C.faint)).setOrigin(0.5, 0).setCrop(0, 0, cw, 30);
      if (known) this.add.text(x + cw / 2, y + 126, `처치 ${kills[id] ?? 0}`, textStyle(18, C.faint)).setOrigin(0.5, 0);
      if (known)
        this.add.zone(x + cw / 2, y + ch / 2, cw, ch).setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.monster = id;
          this.requestRender();
        });
    });
    this.pager(pages, bottom + 36);
    if (this.monster) {
      const id = this.monster;
      const where = list.find((x) => x.id === id)?.where ?? '';
      this.layer(100, () => this.monsterDetail(id, where, kills[id] ?? 0));
    }
  }

  private monsterDetail(id: MonsterId, where: string, kills: number): void {
    const close = () => {
      this.monster = null;
      this.requestRender();
    };
    shade(this, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, close);
    const m = MONSTERS[id];
    const x = 40;
    const w = W - 80;
    const y = PAGE_TOP + 180;
    const h = 560;
    panel(this, x, y, w, h, C.panel, m.boss ? C.red : C.gold);
    this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive();
    this.add.image(x + 110, y + 120, `unit-${id}`).setScale(9);
    this.add.text(x + 220, y + 40, m.name, textStyle(33, m.boss ? C.redStr : C.text));
    chip(this, x + 220, y + 100, FAMILIES[m.family].name, FAMILIES[m.family].color, 18);
    if (m.boss) this.add.text(x + 220 + 90, y + 100, m.boss === 'main' ? '메인보스' : '중간보스', textStyle(18, C.redStr)).setOrigin(0, 0.5);
    this.add.text(x + 220, y + 130, `${m.row === 'front' ? '전열' : '후열'} · 처음 만나는 곳: ${where}`, textStyle(18, C.dim));
    this.add.text(x + 220, y + 160, `쓰러뜨린 수 ${kills}`, textStyle(18, C.goldStr));
    this.add.text(x + 30, y + 240, m.note, textStyle(22, C.text, { wordWrap: { width: w - 60 } }));
    const skills = [m.basic, ...m.skills, ...(m.phases ?? []).flatMap((p) => p.skills)];
    const names = [...new Set(skills.map((s) => s.name))].join(' · ');
    this.add.text(x + 30, y + 320, `기술: ${names}`, textStyle(18, C.dim, { wordWrap: { width: w - 60 } }));
    if (m.phases?.length) this.add.text(x + 30, y + 400, `단계: ${m.phases.map((p) => `체력 ${Math.round(p.below * 100)}% → ${p.name}`).join(', ')}`, textStyle(18, C.redStr, { wordWrap: { width: w - 60 } }));
    button(this, x + w / 2, y + h - 56, 240, 68, '닫기', close, { size: 22 });
  }

  // ───────── 죽은 영웅 ─────────
  private drawFallen(): void {
    const dead = fallen();
    const top = PAGE_TOP + 104;
    if (dead.length === 0) {
      panel(this, 28, top + 20, W - 56, 260, C.bgDeep);
      this.add
        .text(W / 2, top + 150, '아직 잃은 영웅이 없습니다.\n\n죽은 영웅은 이곳에 기록되고,\n살아서 한 만큼 기지에 유산을 남깁니다.', textStyle(22, C.dim, { align: 'center', lineSpacing: 6 }))
        .setOrigin(0.5);
      return;
    }
    const cols = 3;
    const cw = (W - 56 - 24) / cols;
    const ch = 300;
    const bottom = PAGE_BOTTOM - TAB_H - 70;
    const rows = Math.max(1, Math.floor((bottom - top) / (ch + 12)));
    const per = rows * cols;
    const pages = Math.max(1, Math.ceil(dead.length / per));
    this.page = Math.min(this.page, pages - 1);
    dead.slice(this.page * per, (this.page + 1) * per).forEach((h, i) => {
      ensureHeroTextures(this, h);
      const x = 28 + (i % cols) * (cw + 12);
      const y = top + Math.floor(i / cols) * (ch + 12);
      const tier = h.legacy?.tier ?? 0;
      const frame = [0x4a4058, 0x8a8a9a, 0x8fd0ff, C.gold][tier];
      panel(this, x, y, cw, ch, 0x1a1622, frame);
      const g = this.add.graphics();
      g.fillStyle(C.bgDeep, 1).fillRoundedRect(x + cw / 2 - 64, y + 16, 128, 104, 8);
      this.add.image(x + cw / 2, y + 68, `face-${h.id}`).setScale(4).setTint(0xc8c0d0);
      this.add.text(x + cw / 2, y + 132, h.name, textStyle(22)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 162, `${CLASSES[h.classId].name} · Lv ${h.level}`, textStyle(18, C.dim)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 188, `${h.diedFloor}층에서 전사`, textStyle(18, C.redStr)).setOrigin(0.5, 0);
      const score = h.legacy?.score ?? contribution(h).score;
      this.add.text(x + cw / 2, y + 214, `기여도 ${score}`, textStyle(18, C.goldStr)).setOrigin(0.5, 0);
      this.add.text(x + cw / 2, y + 240, tier ? `${TIER_NAME[tier]} · 유산 ${h.legacy!.items.length}` : '남긴 것 없음', textStyle(18, tier ? '#9fd0ff' : C.faint)).setOrigin(0.5, 0);
      if (h.diedAt) this.add.text(x + cw / 2, y + 266, fmtDate(h.diedAt), textStyle(18, C.faint)).setOrigin(0.5, 0);
      this.add
        .zone(x + cw / 2, y + ch / 2, cw, ch)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.chron = { id: h.id, page: 0 };
          this.requestRender();
        });
    });
    this.pager(pages, bottom + 36, '영웅을 누르면 일대기와 유산을 볼 수 있습니다');

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

  private pager(pages: number, y: number, hint?: string): void {
    if (pages <= 1) {
      if (hint) this.add.text(W / 2, y, hint, textStyle(18, C.faint)).setOrigin(0.5);
      return;
    }
    const prev = button(this, 120, y, 160, 56, '이전', () => {
      this.page--;
      this.requestRender();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    prev.setEnabled(this.page > 0);
    this.add.text(W / 2, y, `${this.page + 1} / ${pages}`, textStyle(22, C.dim)).setOrigin(0.5);
    const next = button(this, W - 120, y, 160, 56, '다음', () => {
      this.page++;
      this.requestRender();
    }, { fill: C.panelHi, textColor: C.text, size: 22 });
    next.setEnabled(this.page < pages - 1);
  }
}
