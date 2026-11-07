import Phaser from 'phaser';
import { ensureHeroTextures } from '../art/textures';
import { generateHero, type Hero } from '../data/heroes';
import { Rng } from '../battle/rng';
import { game, living, save } from '../state';
import { C, W, textStyle } from '../ui/theme';
import { GREETING, GUIDE_NAME, STEPS, TUT_DONE, type TutStep } from './steps';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEPTH = 300;

// ─── 진행 상태 ───
export function tutActive(): boolean {
  return game.data.tutorial < TUT_DONE;
}

export function tutStep(): TutStep | null {
  return tutActive() ? STEPS[game.data.tutorial] : null;
}

export function tutIs(id: string): boolean {
  return tutStep()?.id === id;
}

/** 지금 단계가 id면 다음으로. 화면의 버튼 처리에서 부름 */
export function tutDone(id: string): boolean {
  if (!tutIs(id)) return false;
  game.data.tutorial++;
  save();
  return true;
}

/** 튜토리얼 건너뛰기: 모집소는 지어 줌 */
export function tutSkip(): void {
  const d = game.data;
  d.tutorial = TUT_DONE;
  d.facilities.recruit = Math.max(1, d.facilities.recruit);
  save();
}

// ─── 기록관 (안내 캐릭터) ───
let guide: Hero | null = null;
export function guideHero(): Hero {
  if (!guide) {
    const rng = new Rng(20261107);
    guide = { ...generateHero(() => rng.next(), 'guide', { names: new Set(), looks: new Set() }, { classId: 'priest', race: 'dwarf', gender: 'm', now: 0 }), name: GUIDE_NAME };
  }
  return guide;
}

/** 기록관 얼굴: 그린 그림(art/ui/advisor.png)이 있으면 그것, 없으면 도트 영웅 */
export function guideFace(scene: Phaser.Scene): string {
  if (scene.textures.exists('advisor')) return 'advisor';
  const g = guideHero();
  ensureHeroTextures(scene, g);
  return `face-${g.id}`;
}

/** 말하는 사람의 이름·얼굴·대사 */
export function resolveSpeaker(scene: Phaser.Scene, step: TutStep): { name: string; face: string; text: string } {
  const d = game.data;
  let hero: Hero | undefined;
  if (step.speaker === 'hero0') hero = d.heroes[0];
  else if (step.speaker === 'hero1') hero = d.heroes[1];
  else if (step.speaker === 'newest') hero = living()[living().length - 1];
  if (hero) {
    ensureHeroTextures(scene, hero);
    return { name: hero.name, face: `face-${hero.id}`, text: step.text || GREETING[hero.classId](hero.name) };
  }
  return { name: GUIDE_NAME, face: guideFace(scene), text: step.text };
}

/**
 * 대사창 + 하이라이트. 강조한 곳(target) 말고는 누를 수 없게 막음.
 * tap: 아무 데나 누르면 onTap / action: 강조한 곳만 열려 있음 (그 버튼 처리에서 tutDone)
 */
export function drawDialog(
  scene: Phaser.Scene,
  o: {
    name: string;
    face?: string;
    text: string;
    target?: Rect;
    mode: 'tap' | 'action';
    top: number;
    bottom: number;
    onTap: () => void;
    onSkip?: () => void;
  },
): void {
  const { top, bottom } = o;
  const H = bottom - top;
  const dim = 0x0b0910;
  const alpha = 0.72;
  const block = (x: number, y: number, w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    scene.add.rectangle(x + w / 2, y + h / 2, w, h, dim, alpha).setDepth(DEPTH).setInteractive();
  };
  const t = o.target;
  // 자동 테스트용: 지금 강조한 곳 (화면 좌표)
  (window as unknown as { __tut?: unknown }).__tut = t ? { x: t.x + t.w / 2, y: t.y + t.h / 2 - scene.cameras.main.scrollY } : null;
  if (t) {
    const pad = 6;
    const hx = Math.max(0, t.x - pad);
    const hy = Math.max(top, t.y - pad);
    const hw = Math.min(W, t.x + t.w + pad) - hx;
    const hh = Math.min(bottom, t.y + t.h + pad) - hy;
    block(0, top, W, hy - top);
    block(0, hy + hh, W, bottom - hy - hh);
    block(0, hy, hx, hh);
    block(hx + hw, hy, W - hx - hw, hh);
    const ring = scene.add.graphics().setDepth(DEPTH + 1);
    ring.lineStyle(5, C.gold, 1).strokeRoundedRect(hx, hy, hw, hh, 10);
    scene.tweens.add({ targets: ring, alpha: 0.35, yoyo: true, repeat: -1, duration: 520 });
    if (o.mode === 'action') {
      // 손가락 표시
      const fx = hx + hw / 2;
      const fy = hy + hh + 26 > bottom - 10 ? hy - 26 : hy + hh + 26;
      const arrow = scene.add.text(fx, fy, fy < hy ? '▼' : '▲', textStyle(33, C.goldStr, { stroke: '#14111c', strokeThickness: 6 })).setOrigin(0.5).setDepth(DEPTH + 2);
      scene.tweens.add({ targets: arrow, y: fy + (fy < hy ? -10 : 10), yoyo: true, repeat: -1, duration: 400 });
    }
  } else {
    block(0, top, W, H);
  }
  if (o.mode === 'tap') {
    scene.add
      .zone(W / 2, top + H / 2, W, H)
      .setDepth(DEPTH + 3)
      .setInteractive()
      .on('pointerup', o.onTap);
  }

  // 대사창: 강조한 곳이 아래쪽이면 위에, 아니면 아래에
  const bh = 230;
  const atTop = t ? t.y + t.h / 2 > top + H * 0.55 : false;
  const by = atTop ? top + 24 : bottom - bh - 24;
  const bx = 20;
  const bw = W - 40;
  const g = scene.add.graphics().setDepth(DEPTH + 4);
  g.fillStyle(0x1b1626, 0.97).fillRoundedRect(bx, by, bw, bh, 14);
  g.lineStyle(4, C.gold, 1).strokeRoundedRect(bx, by, bw, bh, 14);
  g.fillStyle(C.bgDeep, 1).fillRoundedRect(bx + 18, by + 50, 120, 120, 10);
  if (o.face) {
    const fw = scene.textures.get(o.face).getSourceImage().width;
    scene.add.image(bx + 78, by + 110, o.face).setScale(fw > 64 ? 112 / fw : 5).setDepth(DEPTH + 5);
  }
  scene.add.text(bx + 24, by + 14, o.name, textStyle(22, C.goldStr)).setDepth(DEPTH + 5);
  scene.add.text(bx + 156, by + 54, o.text, textStyle(22, C.text, { wordWrap: { width: bw - 180 }, lineSpacing: 8 })).setDepth(DEPTH + 5);
  scene.add
    .text(bx + bw - 20, by + bh - 16, o.mode === 'tap' ? '탭해서 계속 ▶' : '빛나는 곳을 누르세요', textStyle(18, o.mode === 'tap' ? C.dim : C.goldStr))
    .setOrigin(1, 1)
    .setDepth(DEPTH + 5);

  if (o.onSkip) {
    let armed = false;
    const skip = scene.add
      .text(bx + bw - 18, by + 16, '튜토리얼 건너뛰기', textStyle(18, C.faint))
      .setOrigin(1, 0)
      .setDepth(DEPTH + 6)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerup', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!armed) {
        armed = true;
        skip.setText('한 번 더 누르면 건너뜀').setColor(C.redStr);
        return;
      }
      o.onSkip!();
    });
  }
}
