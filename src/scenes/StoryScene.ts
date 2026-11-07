import Phaser from 'phaser';
import { ensureHeroTextures } from '../art/textures';
import { game, save } from '../state';
import { guideHero, tutSkip } from '../tutorial/overlay';
import { GUIDE_NAME } from '../tutorial/steps';
import { unitScale } from '../art/hd';
import { BOTTOM, C, OY, TOP, W, textStyle } from '../ui/theme';

/** 이야기 장면 (튜토리얼 시작). 탑이 무엇인지, 그리고 영웅은 죽으면 돌아오지 않는다는 경고 */
const PAGES: { art: 'tower' | 'monsters' | 'graves' | 'guide'; text: string; color?: string }[] = [
  { art: 'tower', text: '구름을 뚫고 솟은 탑이 있다.\n누가 세웠는지 아무도 모른다.\n꼭대기에는 "탑의 주인"이 산다고 한다.' },
  { art: 'monsters', text: '탑은 층마다 괴물로 가득하다.\n오르는 자에게는 재물과 이름을 주고,\n층이 높을수록 더 많은 것을 요구한다.' },
  { art: 'graves', text: '그리고 탑에서 쓰러진 영웅은\n돌아오지 않는다.\n누구도, 다시는.', color: '#ff6a52' },
  { art: 'guide', text: `나는 ${GUIDE_NAME}.\n이 마을에서 탑에 오른 영웅들의 일대기를 적는다.\n네가 이끌 영웅들의 이야기도 함께 적어 보자.` },
];

export class StoryScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('story');
  }

  create(): void {
    this.page = 0;
    this.cameras.main.setScroll(0, -OY);
    this.input.on('pointerup', () => this.next());
    this.events.once('shutdown', () => this.input.removeAllListeners());
    this.drawPage();
  }

  private next(): void {
    this.page++;
    if (this.page >= PAGES.length) {
      this.finish(false);
      return;
    }
    this.cameras.main.fadeOut(160, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.drawPage();
      this.cameras.main.fadeIn(220, 11, 9, 16);
    });
  }

  private finish(skipAll: boolean): void {
    if (skipAll) tutSkip();
    else {
      game.data.tutorial = Math.max(game.data.tutorial, 1);
      save();
    }
    this.input.removeAllListeners();
    this.cameras.main.fadeOut(300, 11, 9, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(skipAll ? 'base' : 'tower'));
  }

  private drawPage(): void {
    this.children.removeAll(true);
    const p = PAGES[this.page];
    const g = this.add.graphics();
    g.fillStyle(0x0b0910, 1).fillRect(0, TOP, W, BOTTOM - TOP);
    const cy = 470;
    if (p.art === 'tower') {
      g.fillStyle(0x1e2a44, 1).fillRect(0, TOP, W, cy + 260 - TOP);
      for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.5).fillRect((i * 97) % W, TOP + ((i * 53) % 500), 3, 3);
      g.fillStyle(0x151a2c, 1).fillRect(W / 2 - 60, 120, 120, cy + 140);
      g.fillTriangle(W / 2 - 74, 124, W / 2 + 74, 124, W / 2, 20);
      for (let i = 0; i < 10; i++) g.fillStyle(0xffd27a, 0.6).fillRect(W / 2 - 6, 150 + i * 50, 12, 18);
      g.fillStyle(0xc8c0d0, 0.25).fillEllipse(W / 2 - 140, 260, 300, 50).fillEllipse(W / 2 + 160, 330, 260, 40);
      g.fillStyle(0x2e4a2c, 1).fillEllipse(W / 2, cy + 270, W * 1.4, 160);
    } else if (p.art === 'monsters') {
      const ids = ['goblin', 'orc', 'giant_spider', 'assassin', 'ogre_brute'];
      ids.forEach((id, i) => {
        const img = this.add.image(120 + i * 120, cy + (i % 2 ? -40 : 30), `unit-${id}`).setScale(unitScale(this, id, 6)).setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 400, delay: i * 140 });
      });
      g.fillStyle(0x3a1a1a, 0.4).fillRect(0, cy + 100, W, 6);
    } else if (p.art === 'graves') {
      g.fillStyle(0x1a1622, 1).fillRect(0, cy + 60, W, 200);
      for (let i = 0; i < 5; i++) {
        const x = 120 + i * 120;
        const h = 60 + (i % 3) * 20;
        g.fillStyle(0x5a5a6a, 1).fillRoundedRect(x - 26, cy + 60 - h, 52, h, { tl: 20, tr: 20, bl: 0, br: 0 });
        g.fillStyle(0x3a3a4a, 1).fillRect(x - 3, cy + 60 - h + 14, 6, 26).fillRect(x - 12, cy + 60 - h + 22, 24, 6);
      }
      const sword = this.add.graphics();
      sword.fillStyle(0xb8c2d4, 1).fillRect(W / 2 - 4, cy - 170, 8, 110);
      sword.fillStyle(0x6a4030, 1).fillRect(W / 2 - 22, cy - 66, 44, 8).fillRect(W / 2 - 4, cy - 58, 8, 30);
      sword.setAngle(12);
    } else {
      g.fillStyle(0x221c2e, 1).fillCircle(W / 2, cy - 30, 170);
      if (this.textures.exists('advisor')) {
        const a = this.add.image(W / 2, cy - 30, 'advisor').setScale(280 / 256);
        this.tweens.add({ targets: a, y: cy - 42, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      } else {
        const gh = guideHero();
        ensureHeroTextures(this, gh);
        this.add.image(W / 2, cy - 30, `hero-${gh.id}`).setScale(8);
      }
      this.add.text(W / 2, cy + 160, GUIDE_NAME, textStyle(33, C.goldStr)).setOrigin(0.5);
    }

    const t = this.add.text(W / 2, cy + 300, p.text, textStyle(30, p.color ?? C.text, { align: 'center', lineSpacing: 14 })).setOrigin(0.5, 0).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 500 });
    // 쪽 표시
    for (let i = 0; i < PAGES.length; i++) this.add.circle(W / 2 - (PAGES.length - 1) * 14 + i * 28, BOTTOM - 120, 7, i === this.page ? C.gold : 0x3d3352);
    this.add.text(W / 2, BOTTOM - 70, '탭해서 계속', textStyle(18, C.faint)).setOrigin(0.5);

    // 건너뛰기: 이야기만 / 튜토리얼 전체
    const skipStory = this.add.text(W - 28, TOP + 40, '이야기 건너뛰기 ▶', textStyle(22, C.dim)).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    skipStory.on('pointerup', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.finish(false);
    });
    let armed = false;
    const skipAll = this.add.text(28, TOP + 40, '튜토리얼 전체 건너뛰기', textStyle(18, C.faint)).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    skipAll.on('pointerup', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!armed) {
        armed = true;
        skipAll.setText('한 번 더 누르면 건너뜀').setColor(C.redStr);
        return;
      }
      this.finish(true);
    });
  }
}
