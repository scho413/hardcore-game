import Phaser from 'phaser';
import { scoutRisk } from '../battle/scout';
import { CLASSES } from '../data/classes';
import { FLOORS, TOP_FLOOR, buildEnemies } from '../data/floors';
import { MONSTERS } from '../data/monsters';
import { FORMATION_SLOTS, buildAllies } from '../data/party';
import { game, resetProgress, save } from '../state';
import { BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';
import { button, elementChip, panel } from '../ui/widgets';

const ROW_LABEL = { front: '전열', mid: '중열', back: '후열' } as const;

/** 탑 화면: 층 목록 / 다음 층 정찰 / 진형 편성 / 도전 */
export class TowerScene extends Phaser.Scene {
  private selected: number | null = null;
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('tower');
  }

  create(): void {
    this.selected = null;
    this.cameras.main.setScroll(0, -OY);
    this.cameras.main.fadeIn(200, 11, 9, 16);
    this.render();
  }

  private get nextFloor(): number {
    return Math.min(game.data.cleared + 1, TOP_FLOOR);
  }

  private get conquered(): boolean {
    return game.data.cleared >= TOP_FLOOR;
  }

  private render(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      return o;
    };

    // 헤더
    add(this.add.text(40, TOP + 44 + OY / 3, '탑', textStyle(55, C.goldStr)));
    add(this.add.text(120, TOP + 64 + OY / 3, '1단계 프로토타입 · 10층', textStyle(22, C.dim)));
    add(
      button(this, W - 110, TOP + 72 + OY / 3, 160, 52, '처음부터', () => {
        if (window.confirm('진행 상황을 지우고 1층부터 다시 시작할까요?')) {
          resetProgress();
          this.render();
        }
      }, { fill: C.panelHi, textColor: C.dim, size: 22 }),
    );

    this.renderLadder(add);
    this.renderScout(add);
    this.renderFormation(add);

    const label = this.conquered ? '10층 정복 완료' : `${this.nextFloor}층 도전`;
    const go = add(
      button(this, W / 2, BOTTOM - 92 - OY / 3, W - 80, 104, label, () => {
        game.data.attempts++;
        save();
        this.cameras.main.fadeOut(180, 11, 9, 16);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('battle', { floor: this.nextFloor }));
      }, { size: 44 }),
    );
    go.setEnabled(!this.conquered);
  }

  /** 왼쪽: 층 사다리 (10층이 위) */
  private renderLadder(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const x = 40;
    const top = 150;
    const rowH = 54;
    add(panel(this, x - 12, top - 14, 236, rowH * TOP_FLOOR + 22, C.bgDeep));
    for (let i = 0; i < TOP_FLOOR; i++) {
      const floor = TOP_FLOOR - i;
      const def = FLOORS[floor - 1];
      const y = top + i * rowH;
      const cleared = floor <= game.data.cleared;
      const current = floor === game.data.cleared + 1;
      const g = add(this.add.graphics());
      if (current) {
        g.fillStyle(C.gold, 1).fillRoundedRect(x, y, 212, rowH - 8, 8);
      } else {
        g.fillStyle(cleared ? 0x2a3a2e : C.panel, 1).fillRoundedRect(x, y, 212, rowH - 8, 8);
      }
      const color = current ? '#1b1626' : cleared ? C.greenStr : def.title ? C.redStr : C.dim;
      add(this.add.text(x + 16, y + 10, `${floor}층`, textStyle(22, color)));
      const tag = cleared ? '클리어' : def.title ?? '';
      if (tag) add(this.add.text(x + 196, y + 12, tag, textStyle(22, color)).setOrigin(1, 0));
    }
  }

  /** 오른쪽: 다음 층 정찰 정보 + 위험도 */
  private renderScout(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const x = 284;
    const y = 136;
    const w = W - x - 28;
    const h = 54 * TOP_FLOOR + 22;
    add(panel(this, x, y, w, h));

    if (this.conquered) {
      add(this.add.text(x + w / 2, y + h / 2 - 30, '10층 정복!', textStyle(44, C.goldStr)).setOrigin(0.5));
      add(this.add.text(x + w / 2, y + h / 2 + 30, `도전 ${game.data.attempts}회 · 패배 ${game.data.defeats}회`, textStyle(22, C.dim)).setOrigin(0.5));
      return;
    }

    const floor = this.nextFloor;
    const def = FLOORS[floor - 1];
    add(this.add.text(x + 22, y + 20, '정찰', textStyle(22, C.dim)));
    add(this.add.text(x + 22, y + 50, `${floor}층${def.title ? ` · ${def.title}` : ''}`, textStyle(33, def.title ? C.redStr : C.text)));

    const enemies = buildEnemies(floor);
    const risk = scoutRisk(buildAllies(game.data.party), enemies);
    add(this.add.text(x + 22, y + 104, '위험도', textStyle(22, C.dim)));
    add(this.add.text(x + 120, y + 99, risk.label, textStyle(33, risk.color)));

    // 같은 몬스터는 묶어서 표시
    const counts = new Map<string, number>();
    for (const id of def.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
    let ey = y + 168;
    for (const [id, n] of counts) {
      const m = MONSTERS[id as keyof typeof MONSTERS];
      add(this.add.image(x + 52, ey + 30, `unit-${id}`).setScale(m.boss ? 4.5 : 3.5));
      add(this.add.text(x + 96, ey + 4, `${m.name}${n > 1 ? ` ×${n}` : ''}`, textStyle(22, m.boss ? C.redStr : C.text)));
      add(elementChip(this, x + 116, ey + 44, m.element, 18));
      add(this.add.text(x + 146, ey + 34, m.note, textStyle(18, C.dim, { wordWrap: { width: w - 160 } })));
      ey += 82;
    }

    add(this.add.text(x + 22, y + h - 22, '전투는 자동 진행 · 전투 중 후퇴 불가', textStyle(18, C.faint)).setOrigin(0, 1));
  }

  /** 아래: 진형 (전열 2 / 중열 1 / 후열 2). 두 영웅을 차례로 탭하면 자리를 바꿈 */
  private renderFormation(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const top = 700;
    add(this.add.text(40, top, '진형', textStyle(33)));
    add(this.add.text(130, top + 10, this.selected === null ? '영웅 두 명을 탭해 자리 바꾸기 · 전열이 먼저 맞음' : '바꿀 자리를 탭하세요', textStyle(18, this.selected === null ? C.dim : C.goldStr)));

    const cardW = 300;
    const cardH = 106;
    const positions: Record<string, { y: number; xs: number[] }> = {
      front: { y: top + 60, xs: [W / 2 - 166, W / 2 + 166] },
      mid: { y: top + 60 + 124, xs: [W / 2] },
      back: { y: top + 60 + 248, xs: [W / 2 - 166, W / 2 + 166] },
    };

    // 열 이름: 전열/후열은 두 카드 사이, 중열은 카드 왼쪽
    for (const row of ['front', 'mid', 'back'] as const) {
      const label = ROW_LABEL[row];
      const ly = positions[row].y + cardH / 2;
      if (row === 'mid') {
        add(this.add.text(W / 2 - cardW / 2 - 24, ly, label, textStyle(22, C.faint)).setOrigin(1, 0.5));
      } else {
        add(this.add.text(W / 2, ly, label.split('').join('\n'), textStyle(18, C.faint, { align: 'center', lineSpacing: 4 })).setOrigin(0.5));
      }
    }

    FORMATION_SLOTS.forEach((pos, i) => {
      const hero = game.data.party[i];
      const cls = CLASSES[hero.classId];
      const cx = positions[pos.row].xs[pos.slot];
      const cy = positions[pos.row].y;
      const sel = this.selected === i;
      add(panel(this, cx - cardW / 2, cy, cardW, cardH, sel ? C.panelHi : C.panel, sel ? C.gold : C.line));
      add(this.add.image(cx - cardW / 2 + 52, cy + cardH / 2, `unit-${hero.classId}`).setScale(4));
      add(this.add.text(cx - cardW / 2 + 100, cy + 16, hero.name, textStyle(22)));
      add(this.add.text(cx + cardW / 2 - 16, cy + 18, `Lv ${hero.level}`, textStyle(18, C.goldStr)).setOrigin(1, 0));
      add(this.add.text(cx - cardW / 2 + 100, cy + 52, cls.name, textStyle(18, C.dim)));
      add(elementChip(this, cx - cardW / 2 + 180, cy + 62, hero.element, 18));
      if (cls.defaultRow !== pos.row) {
        add(this.add.text(cx + cardW / 2 - 16, cy + 66, '!', textStyle(22, '#ff9a4a')).setOrigin(1, 0));
      }

      const hit = add(this.add.zone(cx, cy + cardH / 2, cardW, cardH).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => this.tapSlot(i));
    });
  }

  private tapSlot(i: number): void {
    if (this.selected === null) {
      this.selected = i;
    } else if (this.selected === i) {
      this.selected = null;
    } else {
      const p = game.data.party;
      [p[this.selected], p[i]] = [p[i], p[this.selected]];
      this.selected = null;
      save();
    }
    this.render();
  }
}
