import Phaser from 'phaser';
import { ensureHeroTextures } from '../art/textures';
import { CLASSES, roleOf } from '../data/classes';
import { FATIGUE_MAX, FATIGUE_PENALTY, fatigueLevel, fatigueNextMs, heroRace, xpToNext, type Hero } from '../data/heroes';
import { TRAITS, traitName } from '../data/traits';
import { GRADES } from '../data/items';
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
  if (h.status === 'training') return { text: '훈련 중', color: '#9fd0ff' };
  const f = fatigueLevel(h, now);
  if (f > 0) return { text: `기력 ${FATIGUE_MAX - f}/${FATIGUE_MAX} -${Math.round(f * FATIGUE_PENALTY * 100)}%`, color: FATIGUE_MAX - f < 5 ? '#ff9a4a' : C.goldStr };
  return { text: '출전 가능', color: C.greenStr };
}

/** 기력 상세: "기력 6/10 · 능력치 -12% · 3:12 후 1 회복" (내부 값은 피로 = 10 - 기력) */
export function fatigueDetail(h: Hero, now = Date.now()): string {
  const f = fatigueLevel(h, now);
  if (f <= 0) return `기력 ${FATIGUE_MAX}/${FATIGUE_MAX} · 가득`;
  return `기력 ${FATIGUE_MAX - f}/${FATIGUE_MAX} · 능력치 -${Math.round(f * FATIGUE_PENALTY * 100)}% · ${fmtTime(fatigueNextMs(h, now))} 후 +1`;
}

const MARK = { good: '+', bad: '-', mixed: '±' } as const;

/** 특성 요약 한 줄: +좋음 -나쁨 ±양면 */
export function traitNames(h: Hero): string {
  if (h.traits.length === 0) return '특성 없음';
  return h.traits.map((t) => `${MARK[TRAITS[t.id].kind]}${traitName(t)}`).join(' ');
}

export const TRAIT_COLOR = { good: '#8fe0a0', bad: '#ff8a7a', mixed: '#e8c25a' } as const;

/** 직업 · 역할 */
export function classRole(h: Hero): string {
  return `${CLASSES[h.classId].name} · ${roleOf(h.classId, h.role).name}`;
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
  panel(scene, x, y, w, h, opts.highlight ? C.panelHi : C.panel, opts.highlight ? C.gold : C.line);
  const st = opts.note ?? statusLine(hero);

  if (w < 260) {
    // 좁은 카드 (진형 3명 행)
    const img = scene.add.image(x + 36, y + h / 2, `hero-${hero.id}`).setScale(2);
    if (hero.status === 'injured') img.setTint(0x9a8a9a);
    const tx = x + 70;
    scene.add.text(tx, y + 10, hero.name, textStyle(18, GRADES[hero.grade ?? 0].str));
    scene.add.text(x + w - 10, y + 12, `Lv${hero.level}`, textStyle(18, C.goldStr)).setOrigin(1, 0);
    scene.add.text(tx, y + 36, classRole(hero), textStyle(18, C.dim));
    scene.add.text(tx, y + 62, st.text, textStyle(18, st.color));
  } else {
    const img = scene.add.image(x + 50, y + h / 2, `hero-${hero.id}`).setScale(2.5);
    if (hero.status === 'injured') img.setTint(0x9a8a9a);
    const tx = x + 98;
    const nm = scene.add.text(tx, y + 14, hero.name, textStyle(22, GRADES[hero.grade ?? 0].str));
    scene.add.text(nm.x + nm.width + 8, y + 18, GRADES[hero.grade ?? 0].name, textStyle(18, GRADES[hero.grade ?? 0].str)).setAlpha(0.8);
    scene.add.text(x + w - 14, y + 16, `Lv ${hero.level}`, textStyle(18, C.goldStr)).setOrigin(1, 0);
    const tall = h >= 140;
    const clsText = scene.add.text(tx, y + (tall ? 46 : 40), classRole(hero), textStyle(18, C.dim));
    if (tall) raceChip(scene, tx + clsText.width + 10, y + 56, hero);
    if (tall) scene.add.text(tx, y + 76, traitNames(hero), textStyle(18, '#c9b8e8', { wordWrap: { width: w - 110 } }));
    scene.add.text(tx, tall ? y + h - 12 : y + 66, st.text, textStyle(18, st.color)).setOrigin(0, tall ? 1 : 0);
  }

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
