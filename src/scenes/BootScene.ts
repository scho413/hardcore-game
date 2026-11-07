import Phaser from 'phaser';
import { SPRITES, spriteGrid } from '../art/pixels';
import { makeGridTexture } from '../art/textures';
import { hdMonsters, loadArt } from '../art/hd';
import { game } from '../state';
import { STEPS, TUT_DONE } from '../tutorial/steps';

/** 몬스터·기본 직업 스프라이트를 텍스처(`unit-<kind>`)로 굽습니다. 영웅은 각자 `hero-<id>`로 따로 만듦 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    loadArt(this);
  }

  create(): void {
    hdMonsters(this);
    for (const kind of Object.keys(SPRITES)) makeGridTexture(this, `unit-${kind}`, spriteGrid(kind));

    // 흰 픽셀 (파티클·이펙트용)
    const px = this.textures.createCanvas('px', 4, 4);
    if (px) {
      px.getContext().fillStyle = '#ffffff';
      px.getContext().fillRect(0, 0, 4, 4);
      px.refresh();
    }

    const t = game.data.tutorial;
    this.scene.start(t === 0 ? 'story' : t < TUT_DONE ? STEPS[t].scene === 'battle' ? 'tower' : STEPS[t].scene : 'base');
  }
}
