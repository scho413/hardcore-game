import Phaser from 'phaser';
import { SPRITES, normalizedRows } from '../art/pixels';

/** 임시 픽셀 스프라이트를 텍스처(`unit-<kind>`)로 굽습니다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    for (const [kind, sprite] of Object.entries(SPRITES)) {
      const rows = normalizedRows(sprite);
      const tex = this.textures.createCanvas(`unit-${kind}`, 16, 16);
      if (!tex) continue;
      const ctx = tex.getContext();
      rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          const color = sprite.palette[ch];
          if (ch === '.' || !color) return;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        });
      });
      tex.refresh();
    }

    // 1×1 흰 픽셀 (파티클·이펙트용)
    const px = this.textures.createCanvas('px', 4, 4);
    if (px) {
      px.getContext().fillStyle = '#ffffff';
      px.getContext().fillRect(0, 0, 4, 4);
      px.refresh();
    }

    this.scene.start('tower');
  }
}
