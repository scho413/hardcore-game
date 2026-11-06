import Phaser from 'phaser';
import { ensureHeroTextures } from '../art/textures';
import { CLASSES } from '../data/classes';
import { heroRace, xpToNext, type Hero } from '../data/heroes';
import { TRAITS } from '../data/traits';
import { C, textStyle } from './theme';
import { chip, panel } from './widgets';

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 상태 한 줄: 중상이면 남은 시간 */
export function statusLine(h: Hero, now = Date.now()): { text: string; color: string } {
  if (h.status === 'dead') return { text: `${h.diedFloor}층에서 사망`, color: C.redStr };
  if (h.status === 'injured') return { text: `중상 ${fmtTime((h.injuredUntil ?? now) - now)}`, color: '#ff9a4a' };
  return { text: '출전 가능', color: C.greenStr };
}

export function traitNames(h: Hero): string {
  return h.traits.map((t) => TRAITS[t].name).join(' · ');
}

/** 경험치 막대 */
export function xpBar(scene: Phaser.Scene, x: number, y: number, w: number, h: Hero): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(C.bgDeep, 1).fillRect(x, y, w, 8);
  g.fillStyle(C.gauge, 1).fillRect(x, y, Math.round((w * h.xp) / xpToNext(h.level)), 8);
  return g;
}

/**
 * 영웅 카드 (목록·편성·선택창 공용)
 * note: 오른쪽 아래에 표시할 추가 문구 (예: "전열 출전 중")
 */
export function heroCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  hero: Hero,
  opts: { highlight?: boolean; dim?: boolean; note?: { text: string; color: string }; onTap?: () => void } = {},
): void {
  ensureHeroTextures(scene, hero);
  const cls = CLASSES[hero.classId];
  panel(scene, x, y, w, h, opts.highlight ? C.panelHi : C.panel, opts.highlight ? C.gold : C.line);
  const img = scene.add.image(x + 50, y + h / 2, `hero-${hero.id}`).setScale(2.5);
  if (hero.status === 'injured') img.setTint(0x9a8a9a);

  const tx = x + 98;
  scene.add.text(tx, y + 14, hero.name, textStyle(22));
  scene.add.text(x + w - 14, y + 16, `Lv ${hero.level}`, textStyle(18, C.goldStr)).setOrigin(1, 0);
  const clsText = scene.add.text(tx, y + 46, cls.name, textStyle(18, C.dim));
  raceChip(scene, tx + clsText.width + 10, y + 56, hero);

  const st = opts.note ?? statusLine(hero);
  const line3 = h >= 140 ? traitNames(hero) : '';
  if (line3) scene.add.text(tx, y + 76, line3, textStyle(18, '#c9b8e8'));
  scene.add.text(tx, y + h - 12, st.text, textStyle(18, st.color)).setOrigin(0, 1);

  if (opts.dim) scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x0b0910, 0.55);
  if (opts.onTap) {
    scene.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', opts.onTap);
  }
}

/** 화면 전체를 덮는 어두운 막 (뒤쪽 탭 막기). 탭하면 onClose */
export function shade(scene: Phaser.Scene, top: number, height: number, onClose?: () => void): void {
  const r = scene.add.rectangle(360, top + height / 2, 720, height, 0x0b0910, 0.78).setDepth(100).setInteractive();
  if (onClose) r.on('pointerup', onClose);
}

/** 종족 칩 (예: 고양이 수인) */
export function raceChip(scene: Phaser.Scene, x: number, y: number, hero: Hero, size = 18): Phaser.GameObjects.Container {
  const r = heroRace(hero);
  return chip(scene, x, y, r.name, r.color, size);
}
