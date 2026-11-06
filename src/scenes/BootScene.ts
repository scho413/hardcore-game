import Phaser from 'phaser';
import { spriteGrid } from '../art/heroLook';
import { SPRITES } from '../art/pixels';
import { makeGridTexture } from '../art/textures';

/** 몬스터·기본 직업 스프라이트를 텍스처(`unit-<kind>`)로 굽습니다. 영웅은 각자 `hero-<id>`로 따로 만듦 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    for (const kind of Object.keys(SPRITES)) makeGridTexture(this, `unit-${kind}`, spriteGrid(kind));

    // 흰 픽셀 (파티클·이펙트용)
    const px = this.textures.createCanvas('px', 4, 4);
    if (px) {
      px.getContext().fillStyle = '#ffffff';
      px.getContext().fillRect(0, 0, 4, 4);
      px.refresh();
    }

    this.scene.start('tower');
  }
}
