import Phaser from 'phaser';
import { ensureHeroTextures } from '../art/textures';
import type { Hero } from '../data/heroes';
import { heroRace } from '../data/heroes';
import { GRADES, weaponName } from '../data/items';
import { classRole, shade } from './heroUi';
import { C, PAGE_BOTTOM, PAGE_TOP, W, textStyle } from './theme';
import { button, panel } from './widgets';

const TONE = { info: C.text, good: '#8fe0a0', bad: '#ff9a7a', death: '#ff5a4a' } as const;
const PER_PAGE = 12;

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 일대기 창 (GDD 3.7). 오래된 사건부터 위에서 아래로.
 * page: 0 = 가장 최근 페이지
 */
export function drawChronicle(scene: Phaser.Scene, hero: Hero, page: number, onPage: (p: number) => void, onClose: () => void): void {
  shade(scene, PAGE_TOP, PAGE_BOTTOM - PAGE_TOP, onClose);
  const x = 24;
  const y = PAGE_TOP + 40;
  const w = W - 48;
  const h = Math.min(PAGE_BOTTOM - 40, 1250) - y;
  const dead = hero.status === 'dead';
  panel(scene, x, y, w, h, C.panel, dead ? 0x6a5f7a : C.gold);
  scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive();
  ensureHeroTextures(scene, hero);

  // 머리말
  const g = scene.add.graphics();
  g.fillStyle(C.bgDeep, 1).fillRoundedRect(x + 24, y + 24, 150, 150, 10);
  const face = scene.add.image(x + 99, y + 99, `face-${hero.id}`).setScale(6);
  if (dead) face.setTint(0xc8c0d0);
  scene.add.text(x + 196, y + 28, hero.name, textStyle(44, dead ? C.dim : C.text));
  scene.add.text(x + 196, y + 86, `${heroRace(hero).name} ${hero.gender === 'f' ? '여성' : '남성'} · ${classRole(hero)} · Lv ${hero.level}`, textStyle(18, C.dim));
  const status = dead ? `${hero.diedFloor}층에서 전사${hero.diedBy ? ` (${hero.diedBy})` : ''}` : hero.status === 'injured' ? '중상' : '생존';
  scene.add.text(x + 196, y + 116, status, textStyle(18, dead ? C.redStr : C.greenStr, { wordWrap: { width: w - 220 } }));
  const r = hero.record;
  scene.add.text(x + 196, y + 150, `출전 ${r.battles} · 승리 ${r.wins} · 처치 ${r.kills} · 최고 ${hero.bestCleared}층`, textStyle(18, C.goldStr));
  if (hero.weapon) {
    scene.add.text(x + 196, y + 178, `${dead ? '마지막 무기' : '무기'}: ${weaponName(hero.weapon)}${dead ? ' (소실)' : ''}`, textStyle(18, dead ? C.faint : GRADES[hero.weapon.grade].str));
  }

  // 사건 목록
  const pages = Math.max(1, Math.ceil(hero.log.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  const end = hero.log.length - page * PER_PAGE;
  const items = hero.log.slice(Math.max(0, end - PER_PAGE), end);
  scene.add.text(x + 24, y + 214, '일대기', textStyle(22, C.goldStr));
  let ly = y + 252;
  for (const e of items) {
    scene.add.text(x + 24, ly, fmtDate(e.t), textStyle(18, C.faint));
    const t = scene.add.text(x + 160, ly, e.text, textStyle(18, TONE[e.tone], { wordWrap: { width: w - 184 } }));
    ly += Math.max(36, t.height + 14);
  }

  const by = y + h - 56;
  if (pages > 1) {
    const older = button(scene, x + 110, by, 170, 64, '이전 기록', () => onPage(page + 1), { fill: C.panelHi, textColor: C.text, size: 18 });
    older.setEnabled(page < pages - 1);
    const newer = button(scene, x + 300, by, 170, 64, '최근 기록', () => onPage(page - 1), { fill: C.panelHi, textColor: C.text, size: 18 });
    newer.setEnabled(page > 0);
  }
  button(scene, x + w - 110, by, 180, 64, '닫기', onClose, { size: 22 });
}
