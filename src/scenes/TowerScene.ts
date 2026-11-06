import { scoutRisk, type Risk } from '../battle/scout';
import { FLOORS, TOP_FLOOR, buildEnemies, themeOf } from '../data/floors';
import { FATIGUE_TOWER, canAfford, fatigueLevel, heroRace, heroToUnit, towerXp } from '../data/heroes';
import { MONSTERS } from '../data/monsters';
import { game, living, readyFormation, save } from '../state';
import { FormationPanel } from '../ui/formationUi';
import { Page, TAB_H } from '../ui/page';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from '../ui/theme';
import { button, chip, panel } from '../ui/widgets';
import { FAMILIES } from '../data/races';

const LADDER_ROW = 40;
const PANEL_H = LADDER_ROW * TOP_FLOOR + 18;

/** 탑 화면: 층 선택 / 정찰 / 진형 편성 / 도전. 층을 클리어하면 무조건 이 화면으로 귀환 (GDD 5.2) */
export class TowerScene extends Page {
  protected tab = 'tower' as const;
  private floor = 1;
  private formation = new FormationPanel(this, '탑');
  private riskCache = new Map<string, Risk>();

  constructor() {
    super('tower');
  }

  protected onEnter(): void {
    this.formation.picking = null;
    this.floor = Math.min(game.data.cleared + 1, TOP_FLOOR);
  }

  protected draw(): void {
    this.drawHeader();
    this.drawLadder();
    this.drawScout();
    this.drawFormation();
    this.drawGo();
    this.formation.drawPicker(FATIGUE_TOWER);
  }

  private drawHeader(): void {
    this.add.text(32, PAGE_TOP + 52, '탑', textStyle(55, C.goldStr)).setOrigin(0, 0.5);
    const ready = living().filter((h) => h.status === 'ready' && canAfford(h, FATIGUE_TOWER)).length;
    this.add.text(110, PAGE_TOP + 58, `최고 ${game.data.cleared}층 클리어`, textStyle(22, C.dim)).setOrigin(0, 0.5);
    this.add.text(W - 28, PAGE_TOP + 58, `출전 가능 영웅 ${ready}명`, textStyle(18, C.faint)).setOrigin(1, 0.5);
  }

  /** 왼쪽: 층 사다리. 클리어한 층 + 다음 층을 고를 수 있음 */
  private drawLadder(): void {
    const x = 28;
    const top = 118;
    const rowH = LADDER_ROW;
    panel(this, x - 10, top - 12, 232, rowH * TOP_FLOOR + 18, C.bgDeep);
    for (let i = 0; i < TOP_FLOOR; i++) {
      const floor = TOP_FLOOR - i;
      const def = FLOORS[floor - 1];
      const y = top + i * rowH;
      const open = floor <= game.data.cleared + 1 || game.data.test;
      const cleared = floor <= game.data.cleared;
      const sel = floor === this.floor;
      const g = this.add.graphics();
      g.fillStyle(sel ? C.gold : cleared ? 0x253629 : C.panel, 1).fillRoundedRect(x, y, 212, rowH - 6, 8);
      const color = sel ? '#1b1626' : !open ? C.faint : cleared ? C.greenStr : def.title ? C.redStr : C.text;
      this.add.text(x + 14, y + (rowH - 6) / 2, `${floor}층`, textStyle(22, color)).setOrigin(0, 0.5);
      const tag = !open ? '잠김' : cleared ? '클리어' : def.title ?? '도전';
      this.add.text(x + 198, y + (rowH - 6) / 2, tag, textStyle(18, color)).setOrigin(1, 0.5);
      if (open) {
        this.add
          .zone(x + 106, y + (rowH - 8) / 2, 212, rowH - 8)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => {
            this.floor = floor;
            this.requestRender();
          });
      }
    }
  }

  private risk(): Risk | null {
    const team = readyFormation(FATIGUE_TOWER);
    if (team.length === 0) return null;
    const key = `${this.floor}|${game.data.formationType}|${team.map((t) => `${t.slot}:${t.hero.id}:${t.hero.level}:${t.hero.role}:${t.hero.traits.length}:${t.hero.weapon?.id ?? ''}:${fatigueLevel(t.hero)}`).join(',')}`;
    let r = this.riskCache.get(key);
    if (!r) {
      r = scoutRisk(team.map((t) => heroToUnit(t.hero, t.slot, { formation: game.data.formationType, floor: this.floor })), buildEnemies(this.floor));
      this.riskCache.set(key, r);
    }
    return r;
  }

  /** 오른쪽: 선택한 층 정찰 정보 + 위험도 */
  private drawScout(): void {
    const x = 262;
    const y = 106;
    const w = W - x - 24;
    const h = PANEL_H;
    panel(this, x, y, w, h);

    const def = FLOORS[this.floor - 1];
    this.add.text(x + 20, y + 14, `정찰 · ${themeOf(this.floor)}`, textStyle(18, C.dim));
    const ft = this.add.text(x + 20, y + 38, `${this.floor}층${def.title ? ` ${def.title}` : ''}`, textStyle(33, def.title ? C.redStr : C.text));

    // 처음 도전하는 층은 정보 없음 (GDD 5.2)
    const known = this.floor <= game.data.cleared || game.data.known.includes(this.floor) || game.data.test;
    const rx = Math.max(x + 20 + ft.width + 24, x + 200);
    if (!known) {
      this.add.text(rx, y + 30, '위험도', textStyle(18, C.dim));
      this.add.text(rx, y + 50, '???', textStyle(22, C.faint));
      this.add.text(x + w / 2, y + 190, '?', textStyle(110, '#3d3352')).setOrigin(0.5);
      this.add
        .text(x + w / 2, y + 270, '처음 도전하는 층입니다.\n적 구성과 위험도는\n한 번 도전한 뒤에 알 수 있습니다.', textStyle(18, C.dim, { align: 'center', lineSpacing: 8 }))
        .setOrigin(0.5, 0);
    } else {
      const risk = this.risk();
      this.add.text(rx, y + 30, '위험도', textStyle(18, C.dim));
      if (risk) this.add.text(rx, y + 50, risk.label, textStyle(22, risk.color));
      else this.add.text(rx, y + 52, '출전 영웅 없음', textStyle(18, C.faint));

      const partyFavored = new Set(readyFormation(FATIGUE_TOWER).map((t) => heroRace(t.hero).favored));
      const counts = new Map<string, number>();
      for (const id of def.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
      let ey = y + 92;
      for (const [id, n] of counts) {
        const m = MONSTERS[id as keyof typeof MONSTERS];
        this.add.image(x + 40, ey + 24, `unit-${id}`).setScale(m.boss ? 3.4 : 2.8);
        const nm = this.add.text(x + 76, ey, `${m.name}${n > 1 ? ` ×${n}` : ''}`, textStyle(22, m.boss ? C.redStr : C.text));
        if (partyFavored.has(m.family)) this.add.text(nm.x + nm.width + 8, ey + 4, '천적 있음', textStyle(18, C.greenStr));
        const fc = chip(this, x + 76, ey + 40, FAMILIES[m.family].name, FAMILIES[m.family].color, 18);
        const note = this.add.text(x + 76 + fc.width + 8, ey + 30, m.note, textStyle(18, C.dim, { wordWrap: { width: w - 96 - fc.width } }));
        ey += Math.max(58, note.height + 36);
      }
    }
    // 경험치 (레벨이 층보다 많이 높으면 줄어듦)
    const first = this.floor > game.data.cleared;
    const team = readyFormation(FATIGUE_TOWER);
    const xps = team.map((t) => towerXp(this.floor, t.hero.level, first));
    const xpText = xps.length ? (Math.min(...xps) === Math.max(...xps) ? `${xps[0]}` : `${Math.min(...xps)}~${Math.max(...xps)}`) : `${towerXp(this.floor, 1, first)}`;
    this.add.text(x + w - 20, y + h - 14, `경험치 +${xpText}${first ? ' · 첫 2배' : ''}`, textStyle(18, '#9fd0ff')).setOrigin(1, 1);
    this.add.text(x + 20, y + h - 14, '후퇴 불가', textStyle(18, C.faint)).setOrigin(0, 1);
  }

  private drawFormation(): void {
    this.formation.draw(106 + PANEL_H + 16, FATIGUE_TOWER);
  }

  private drawGo(): void {
    const team = readyFormation(FATIGUE_TOWER);
    const y = PAGE_BOTTOM - TAB_H - 70;
    const label = team.length === 0 ? '출전할 영웅이 없습니다' : `${this.floor}층 도전 · ${team.length}명 · 기력 -${FATIGUE_TOWER}`;
    const b = button(this, W / 2, y, W - 56, 92, label, () => {
      game.data.attempts++;
      save();
      this.go('battle', { floor: this.floor });
    }, { size: team.length === 0 ? 22 : 33 });
    b.setEnabled(team.length > 0);
    if (game.data.tutorial === 0) this.hint(W / 2, y - 80, '탑 1층에 도전해 보세요');
    else if (game.data.tutorial < 3) this.hint(W / 2, y - 80, '기지로 돌아가세요');
  }
}
