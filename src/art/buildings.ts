// 기지 건물 픽셀아트 (32×28). 도형 몇 개로 그려서 텍스처로 굽습니다.
import Phaser from 'phaser';
import type { FacilityId } from '../data/base';
import type { Grid } from './heroArt';
import { makeGridTexture } from './textures';

export const BW = 32;
export const BH = 28;

class Canvas {
  g: Grid = Array.from({ length: BH }, () => Array<string | null>(BW).fill(null));
  px(x: number, y: number, c: string): void {
    if (x >= 0 && y >= 0 && x < BW && y < BH) this.g[y][x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  /** 테두리 있는 사각형 */
  box(x: number, y: number, w: number, h: number, fill: string, line = K): void {
    this.rect(x, y, w, h, line);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  /** 삼각 지붕: 밑변 x..x+w, 높이 h */
  roof(x: number, y: number, w: number, h: number, c: string, dark: string): void {
    for (let j = 0; j < h; j++) {
      const inset = Math.round(((h - 1 - j) * (w / 2)) / h);
      for (let i = x + inset; i < x + w - inset; i++) this.px(i, y + j, i === x + inset || i === x + w - inset - 1 ? K : j % 2 ? dark : c);
    }
    this.rect(x, y + h, w, 1, K);
  }
  /** 경사 지붕 (사다리꼴) */
  slope(x: number, y: number, w: number, h: number, c: string, dark: string): void {
    for (let j = 0; j < h; j++) {
      const inset = h - 1 - j;
      for (let i = x + inset; i < x + w - inset; i++) this.px(i, y + j, i === x + inset || i === x + w - inset - 1 || j === 0 ? K : (i + j) % 3 === 0 ? dark : c);
    }
    this.rect(x - 1, y + h, w + 2, 1, K);
  }
  window(x: number, y: number, lit = true): void {
    this.box(x, y, 4, 4, lit ? '#ffd27a' : '#3a4a6a');
    this.px(x + 2, y + 1, K);
    this.px(x + 2, y + 2, K);
  }
  door(x: number, y: number, h = 6, c = '#6a4030'): void {
    this.box(x, y, 5, h, c);
    this.px(x + 3, y + Math.floor(h / 2), '#e8c25a');
  }
}

const K = '#1b1626';
const GRASS = '#4a7a3a';

function dorm(): Grid {
  // 2층 목조 숙소: 박공 지붕, 둥근 창, 발코니, 굴뚝 두 개, 꽃 화분
  const c = new Canvas();
  c.rect(1, 26, 30, 2, GRASS);
  // 1층 돌 기단 + 나무 벽
  c.box(2, 18, 28, 9, '#8a8478');
  for (let x = 3; x < 29; x += 4) c.rect(x, 21 + (x % 8 === 3 ? 0 : 2), 3, 1, '#6a6458');
  c.box(4, 10, 24, 9, '#c89a6a');
  for (let x = 6; x < 27; x += 4) c.rect(x, 11, 1, 7, '#a87a4a');
  // 지붕 (진한 청록)
  c.roof(1, 0, 30, 11, '#3a7a8a', '#2a5a6a');
  // 굴뚝·연기
  c.box(5, 1, 3, 6, '#8a6a5a');
  c.box(24, 1, 3, 6, '#8a6a5a');
  c.px(6, 0, '#c8c0d0');
  c.px(25, 0, '#a8a0b0');
  // 박공 둥근 창
  c.rect(14, 4, 4, 4, K);
  c.rect(15, 5, 2, 2, '#ffd27a');
  // 2층 창 + 화분
  c.window(6, 12);
  c.window(22, 12);
  c.rect(6, 16, 4, 1, '#e0503a');
  c.rect(22, 16, 4, 1, '#e8c25a');
  // 발코니
  c.rect(11, 17, 10, 1, K);
  for (let x = 11; x < 21; x += 2) c.px(x, 16, '#6a4030');
  // 1층 창과 문
  c.window(5, 20);
  c.window(23, 20);
  c.door(13, 20, 7, '#5a3020');
  c.px(15, 19, '#e8c25a');
  return c.g;
}

function recruit(): Grid {
  const c = new Canvas();
  c.rect(2, 26, 28, 2, GRASS);
  c.box(3, 12, 26, 15, '#b08a5a');
  c.slope(2, 5, 28, 7, '#4a8a5a', '#3a6a4a');
  // 깃발
  c.rect(27, 0, 1, 10, K);
  c.rect(28, 1, 3, 3, '#e8c25a');
  // 간판
  c.box(9, 13, 14, 4, '#6a4030');
  c.rect(11, 14, 10, 2, '#e8c25a');
  c.window(5, 18);
  c.window(23, 18);
  c.door(13, 20, 7, '#4a2a20');
  // 통
  c.box(0, 22, 3, 5, '#8a5a3a');
  return c.g;
}

function smithy(): Grid {
  const c = new Canvas();
  c.rect(2, 26, 28, 2, GRASS);
  c.box(3, 12, 22, 15, '#8a8a9a');
  for (let y = 14; y < 26; y += 3) for (let x = 4 + (y % 2) * 2; x < 24; x += 5) c.rect(x, y, 3, 1, '#6a6a7a');
  c.slope(2, 6, 24, 6, '#5a4a4a', '#3a3030');
  // 굴뚝·연기
  c.box(19, 1, 4, 8, '#7a6a6a');
  c.px(20, 0, '#c8c0d0');
  c.px(22, 0, '#a8a0b0');
  // 화로 입구
  c.box(6, 17, 8, 10, '#ff8a3a');
  c.rect(7, 20, 6, 6, '#ffd25a');
  c.window(17, 16);
  // 모루
  c.rect(25, 22, 6, 2, '#4a4458');
  c.rect(27, 24, 2, 3, '#3a3448');
  c.rect(24, 22, 1, 1, '#4a4458');
  return c.g;
}

function hospital(): Grid {
  const c = new Canvas();
  c.rect(2, 26, 28, 2, GRASS);
  c.box(3, 11, 26, 16, '#e8e4f0');
  c.slope(2, 5, 28, 6, '#5a8ad0', '#4a6ab0');
  // 십자
  c.rect(14, 13, 4, 8, '#e0503a');
  c.rect(12, 15, 8, 4, '#e0503a');
  c.window(5, 14);
  c.window(23, 14);
  c.door(13, 21, 6, '#7a8ab0');
  return c.g;
}

function training(): Grid {
  const c = new Canvas();
  c.rect(0, 22, 32, 6, '#8a6a4a');
  c.rect(0, 22, 32, 1, '#6a4a3a');
  // 울타리
  for (let x = 0; x < 32; x += 5) c.box(x, 17, 2, 7, '#a87a4a');
  c.rect(0, 19, 32, 1, '#a87a4a');
  // 허수아비
  c.rect(10, 8, 1, 15, '#6a4030');
  c.rect(6, 11, 9, 1, '#6a4030');
  c.box(8, 5, 5, 5, '#d8b070');
  c.box(8, 11, 5, 7, '#c8a060');
  c.px(9, 7, K);
  c.px(11, 7, K);
  // 과녁
  c.box(19, 7, 9, 9, '#f0e8d8');
  c.rect(21, 9, 5, 5, '#e0503a');
  c.rect(22, 10, 3, 3, '#f0e8d8');
  c.px(23, 11, '#e0503a');
  c.rect(23, 16, 1, 7, '#6a4030');
  // 무기 거치대
  c.rect(28, 12, 1, 11, '#8a8a9a');
  c.rect(30, 14, 1, 9, '#8a8a9a');
  return c.g;
}

function alchemy(): Grid {
  const c = new Canvas();
  c.rect(2, 26, 28, 2, GRASS);
  c.box(9, 10, 14, 17, '#7a6aa0');
  for (let y = 12; y < 26; y += 4) c.rect(10, y, 12, 1, '#6a5a8a');
  c.roof(7, 0, 18, 10, '#4a3a7a', '#3a2a6a');
  c.px(16, 0, '#e8c25a');
  c.window(14, 13);
  c.door(14, 21, 6, '#4a3a5a');
  // 플라스크
  c.box(24, 18, 6, 9, '#8ae08a');
  c.rect(26, 15, 2, 4, K);
  c.rect(25, 21, 4, 2, '#c8ffc8');
  // 솥
  c.box(1, 20, 7, 7, '#3a3448');
  c.rect(2, 20, 5, 1, '#8ad0ff');
  return c.g;
}

function lot(): Grid {
  const c = new Canvas();
  c.rect(3, 20, 26, 7, '#8a6a4a');
  c.rect(4, 21, 24, 5, '#9a7a5a');
  for (let i = 0; i < 6; i++) c.px(6 + i * 4, 22 + (i % 2) * 2, '#7a5a3a');
  // 팻말
  c.rect(15, 11, 1, 10, '#6a4030');
  c.box(10, 8, 12, 5, '#c8a070');
  c.rect(12, 10, 8, 1, '#6a4030');
  return c.g;
}

function scaffold(): Grid {
  const c = new Canvas();
  for (let x = 3; x < 30; x += 8) c.rect(x, 4, 1, 23, '#c8a060');
  for (let y = 8; y < 27; y += 6) c.rect(2, y, 28, 1, '#c8a060');
  for (let i = 0; i < 20; i++) c.px(4 + i, 8 + Math.floor(i * 0.9), '#a87a4a');
  return c.g;
}

const ART: Record<FacilityId | 'lot' | 'scaffold', () => Grid> = { dorm, recruit, smithy, hospital, training, alchemy, lot, scaffold };

/** `bld-<id>` 텍스처 키 */
export function buildingTexture(scene: Phaser.Scene, id: FacilityId | 'lot' | 'scaffold'): string {
  const key = `bld-${id}`;
  if (!scene.textures.exists(key)) makeGridTexture(scene, key, ART[id]());
  return key;
}
