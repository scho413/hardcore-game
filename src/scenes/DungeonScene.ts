import { DUNGEONS, DUNGEON_IDS, DUNGEON_XP_RATE, type DungeonId } from '../data/dungeons';
import { FATIGUE_DUNGEON, XP_PER_FLOOR, canAfford } from '../data/heroes';
import { MATERIALS, matId } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { FAMILIES } from '../data/races';
import { game, living, readyFormation } from '../state';
import { FormationPanel } from '../ui/formationUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, chip, panel } from '../ui/widgets';

/** 던전 탭 (GDD 6): 재료 파밍. 사망·중상 없음, 피로 +2 */
export class DungeonScene extends Page {
  protected tab = 'dungeon' as const;
  private static dungeon: DungeonId = 'mine';
  private static level = 0;
  private formation = new FormationPanel(this, '던전');

  constructor() {
    super('dungeon');
  }

  protected onEnter(): void {
    this.formation.picking = null;
  }

  protected draw(): void {
    const sel = DungeonScene.dungeon;
    const lvIdx = DungeonScene.level;
    const d = DUNGEONS[sel];
    const lv = d.levels[lvIdx];

    this.add.text(32, PAGE_TOP + 52, '던전', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(170, PAGE_TOP + 58, '재료 파밍 · 죽지 않음', textStyle(22, C.dim)).setOrigin(0, 0.5);
    const ready = living().filter((h) => h.status === 'ready' && canAfford(h, FATIGUE_DUNGEON)).length;
    this.add.text(W - 28, PAGE_TOP + 58, `출전 가능 영웅 ${ready}명`, textStyle(18, C.faint)).setOrigin(1, 0.5);

    // 던전 선택
    const bw = (W - 56 - 20) / 3;
    DUNGEON_IDS.forEach((id, i) => {
      const on = id === sel;
      button(this, 28 + bw / 2 + i * (bw + 10), 136, bw, 58, DUNGEONS[id].name, () => {
        DungeonScene.dungeon = id;
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });

    // 던전 정보
    const px = 28;
    const py = 182;
    const pw = W - 56;
    const ph = 318;
    panel(this, px, py, pw, ph);
    this.add.text(px + 20, py + 16, d.desc, textStyle(18, C.dim));

    const lw = (pw - 40 - 16) / 3;
    d.levels.forEach((l, i) => {
      const on = i === lvIdx;
      button(this, px + 20 + lw / 2 + i * (lw + 8), py + 74, lw, 52, `${l.name}`, () => {
        DungeonScene.level = i;
        this.requestRender();
      }, { fill: on ? 0x8fd0ff : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 22 });
    });
    this.add.text(px + 20, py + 116, `적 강함: 탑 ${lv.power}층 수준 · 경험치 ${Math.round(XP_PER_FLOOR * lv.power * DUNGEON_XP_RATE)}`, textStyle(18, '#9fd0ff'));

    // 적
    const counts = new Map<string, number>();
    for (const id of lv.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
    let ex = px + 20;
    for (const [id, n] of counts) {
      const m = MONSTERS[id as keyof typeof MONSTERS];
      this.add.image(ex + 26, py + 180, `unit-${id}`).setScale(3);
      const t = this.add.text(ex + 58, py + 156, `${m.name}${n > 1 ? ` ×${n}` : ''}`, textStyle(18));
      chip(this, ex + 58, py + 196, FAMILIES[m.family].name, FAMILIES[m.family].color, 18);
      ex += Math.max(150, t.width + 76);
    }

    // 보상
    this.add.text(px + 20, py + 236, '승리 보상', textStyle(18, C.dim));
    let rx = px + 120;
    for (const [tier, lo, hi] of lv.drops) {
      const mat = MATERIALS[matId(d.mat, tier)];
      const c = chip(this, rx, py + 247, `${mat.name} ${lo}~${hi}`, mat.color, 18);
      rx += c.width + 8;
    }
    this.add.text(px + 20, py + ph - 16, `패배해도 죽지 않음 · 승패와 관계없이 피로 +${FATIGUE_DUNGEON}`, textStyle(18, C.faint)).setOrigin(0, 1);

    this.formation.draw(py + ph + 18, FATIGUE_DUNGEON);

    // 입장
    const team = readyFormation(FATIGUE_DUNGEON);
    const label = team.length === 0 ? '출전할 영웅이 없습니다' : `${d.name} ${lv.name} 입장 · ${team.length}명 · 피로 +${FATIGUE_DUNGEON}`;
    const go = button(this, W / 2, PAGE_BOTTOM - TAB_H - 70, W - 56, 92, label, () => {
      this.go('battle', { dungeon: sel, level: lvIdx });
    }, { size: team.length === 0 ? 22 : 26, fill: 0x8fd0ff });
    go.setEnabled(team.length > 0);
    void game;

    this.formation.drawPicker(FATIGUE_DUNGEON);
  }
}
