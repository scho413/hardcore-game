import Phaser from 'phaser';
import fontUrl from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import { BootScene } from './scenes/BootScene';
import { TowerScene } from './scenes/TowerScene';
import { BattleScene } from './scenes/BattleScene';
import { C, FONT, H, W } from './ui/theme';

async function loadFont(): Promise<void> {
  try {
    const face = new FontFace(FONT, `url(${fontUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch {
    // 폰트 실패 시 시스템 폰트로 진행
  }
}

loadFont().then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: C.bg,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TowerScene, BattleScene],
  });
});
