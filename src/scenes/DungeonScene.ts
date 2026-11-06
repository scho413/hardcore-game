import { DUNGEONS, DUNGEON_FLOORS, DUNGEON_IDS, DUNGEON_TRAIT_CHANCE, RARE_CHANCE, dungeonDrops, dungeonLineup, dungeonPower, type DungeonId } from '../data/dungeons';
import { FATIGUE_DUNGEON, canAfford } from '../data/heroes';
import { TRAITS } from '../data/traits';
import { MATERIALS, matId } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { FAMILIES } from '../data/races';
import { avgLevel, game, living, readyFormation } from '../state';
import { FormationPanel } from '../ui/formationUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, chip, panel } from '../ui/widgets';

/** 던전 탭 (GDD 6): 던전마다 1~10층. 사망 없음(쓰러지면 중상), 기력 -3, 클리어한 층은 소탕 */
export class DungeonScene extends Page {
  protected tab = 'dungeon' as const;
  private static dungeon: DungeonId = 'mine';
  private static floor: Partial<Record<DungeonId, number>> = {};
  private formation = new FormationPanel(this, '던전');

  constructor() {
    super('dungeon');
  }

  protected onEnter(): void {
    this.formation.picking = null;
  }

  protected draw(): void {
    const sel = DungeonScene.dungeon;
    const d = DUNGEONS[sel];
    const prog = game.data.dungeons[sel];
    const open = game.data.test ? DUNGEON_FLOORS : Math.min(DUNGEON_FLOORS, prog.best + 1);
    const floor = Math.min(DungeonScene.floor[sel] ?? open, open);

    this.add.text(32, PAGE_TOP + 52, '던전', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(170, PAGE_TOP + 58, '재료·특성 · 쓰러지면 중상', textStyle(22, C.dim)).setOrigin(0, 0.5);
    const ready = living().filter((h) => h.status === 'ready' && canAfford(h, FATIGUE_DUNGEON)).length;
    this.add.text(W - 28, PAGE_TOP + 58, `출전 가능 영웅 ${ready}명`, textStyle(18, C.faint)).setOrigin(1, 0.5);

    // 던전 선택
    const bw = (W - 56 - 20) / 3;
    DUNGEON_IDS.forEach((id, i) => {
      const on = id === sel;
      const best = game.data.dungeons[id].best;
      button(this, 28 + bw / 2 + i * (bw + 10), 136, bw, 58, `${DUNGEONS[id].name}${best ? ` ${best}층` : ''}`, () => {
        DungeonScene.dungeon = id;
        this.requestRender();
      }, { fill: on ? C.gold : C.panelHi, textColor: on ? '#1b1626' : C.text, size: 18 });
    });

    // 던전 정보
    const px = 28;
    const py = 182;
    const pw = W - 56;
    const ph = 318;
    panel(this, px, py, pw, ph);
    this.add.text(px + 20, py + 14, d.desc, textStyle(18, C.dim));

    // 층 선택 (5 × 2)
    const fw = (pw - 40 - 4 * 8) / 5;
    for (let f = 1; f <= DUNGEON_FLOORS; f++) {
      const i = f - 1;
      const x = px + 20 + fw / 2 + (i % 5) * (fw + 8);
      const y = py + 64 + Math.floor(i / 5) * 52;
      const on = f === floor;
      const cleared = f <= prog.best;
      const boss = f === DUNGEON_FLOORS;
      const b = button(this, x, y, fw, 44, `${boss ? '보스' : `${f}층`}${cleared ? ' ✓' : ''}`, () => {
        DungeonScene.floor[sel] = f;
        this.requestRender();
      }, { fill: on ? 0x8fd0ff : boss ? 0x4a2a36 : C.panelHi, textColor: on ? '#1b1626' : cleared ? C.greenStr : C.text, size: 18 });
      b.setEnabled(f <= open);
    }

    const power = dungeonPower(sel, floor);
    this.add.text(px + 20, py + 150, `${floor}층 · 적 강함 탑 ${Math.round(power)}층 수준 · 경험치 없음`, textStyle(18, '#9fd0ff'));

    // 적
    const counts = new Map<string, number>();
    for (const id of dungeonLineup(sel, floor)) counts.set(id, (counts.get(id) ?? 0) + 1);
    let ex = px + 20;
    for (const [id, n] of counts) {
      const m = MONSTERS[id as keyof typeof MONSTERS];
      this.add.image(ex + 24, py + 202, `unit-${id}`).setScale(m.boss ? 3.6 : 3);
      const t = this.add.text(ex + 54, py + 180, `${m.name}${n > 1 ? ` ×${n}` : ''}`, textStyle(18, m.boss ? C.redStr : C.text));
      chip(this, ex + 54, py + 218, FAMILIES[m.family].name, FAMILIES[m.family].color, 18);
      ex += Math.max(132, t.width + 70);
    }

    // 보상
    this.add.text(px + 20, py + 260, '보상', textStyle(18, C.dim));
    let rx = px + 74;
    for (const [tier, lo, hi] of dungeonDrops(floor)) {
      const mat = MATERIALS[matId(d.mat, tier)];
      const c = chip(this, rx, py + 271, `${mat.name} ${lo}~${hi}`, mat.color, 18);
      rx += c.width + 8;
    }
    if (floor > prog.best) this.add.text(rx + 4, py + 271, '첫 클리어 ×2', textStyle(18, C.goldStr)).setOrigin(0, 0.5);
    this.add.text(px + 20, py + ph - 10, `특성 ${Math.round(DUNGEON_TRAIT_CHANCE * 100)}%: ${d.traits.map((t) => TRAITS[t].name).join('·')} · 희귀 몬스터 ${Math.round(RARE_CHANCE * 100)}%`, textStyle(18, C.faint)).setOrigin(0, 1);

    this.formation.draw(py + ph + 18, FATIGUE_DUNGEON);

    // 입장 / 소탕
    const team = readyFormation(FATIGUE_DUNGEON);
    const by = PAGE_BOTTOM - TAB_H - 70;
    const need = prog.clearLv[floor];
    const lv = avgLevel(team.map((t) => t.hero));
    const canSweep = team.length > 0 && floor <= prog.best && need !== undefined && lv + 1e-9 >= need;
    const sw = 230;
    const goW = W - 56 - sw - 12;
    const label = team.length === 0 ? '출전할 영웅이 없습니다' : `${floor}층 입장 · ${team.length}명 · 기력 -${FATIGUE_DUNGEON}`;
    const go = button(this, 28 + goW / 2, by, goW, 92, label, () => {
      this.go('battle', { dungeon: sel, floor });
    }, { size: team.length === 0 ? 18 : 22, fill: 0x8fd0ff });
    go.setEnabled(team.length > 0);
    const sweepLabel = floor > prog.best ? '소탕 · 미클리어' : canSweep ? '소탕' : `소탕 · 평균 Lv ${Math.ceil(need ?? 0)}+`;
    const sb = button(this, W - 28 - sw / 2, by, sw, 92, sweepLabel, () => {
      this.go('battle', { dungeon: sel, floor, sweep: true });
    }, { size: canSweep ? 26 : 18 });
    sb.setEnabled(canSweep);
    if (team.length > 0 && floor <= prog.best) {
      this.add.text(W - 28 - sw / 2, by - 58, `지금 파티 평균 Lv ${lv.toFixed(1)}`, textStyle(18, canSweep ? C.dim : C.redStr)).setOrigin(0.5);
    }

    this.formation.drawPicker(FATIGUE_DUNGEON);
  }
}
