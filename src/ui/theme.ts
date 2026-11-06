import type { Element } from '../battle/types';

export const W = 720;
/** 레이아웃 기준 높이. 화면 좌표는 이 기준으로 짜고, 남는 높이는 위아래로 나눠 씁니다. */
export const BASE_H = 1280;

/** 실제 게임 높이: 기기 화면비에 맞춰 1280~1560 (19.5:9 폰에서 검은 띠 없음) */
export const H = (() => {
  if (typeof window === 'undefined') return BASE_H;
  const r = window.innerHeight / Math.max(1, window.innerWidth);
  return Math.round(Math.min(1560, Math.max(BASE_H, W * r)));
})();

/** 카메라를 이만큼 위로 올려서 기준 레이아웃을 화면 가운데에 둡니다 */
export const OY = Math.round((H - BASE_H) / 2);
/** 화면 맨 위 / 맨 아래의 월드 y */
export const TOP = -OY;
export const BOTTOM = BASE_H + OY;
/** 하단 탭 화면은 위에 붙여서 그림 (남는 높이는 아래쪽 버튼·탭바 사이로) */
export const PAGE_TOP = 0;
export const PAGE_BOTTOM = H;
export const FONT = 'Galmuri11';

export const C = {
  bg: 0x14111c,
  bgDeep: 0x0b0910,
  panel: 0x221c2e,
  panelHi: 0x2e2640,
  line: 0x3d3352,
  text: '#f2ead8',
  dim: '#9b90ad',
  faint: '#5f5672',
  gold: 0xe8c25a,
  goldStr: '#e8c25a',
  red: 0xe0503a,
  redStr: '#ff6a52',
  green: 0x6fd47a,
  greenStr: '#7fe08a',
  hpAlly: 0x6fd47a,
  hpEnemy: 0xe0503a,
  hpBack: 0x2a2236,
  gauge: 0x7fb8ff,
};

export const ELEMENT_INFO: Record<Element, { label: string; color: number; str: string }> = {
  fire: { label: '불', color: 0xff7a45, str: '#ff8a5a' },
  water: { label: '물', color: 0x4aa3e0, str: '#6fbaf0' },
  wind: { label: '바람', color: 0x6fcf6f, str: '#8ee08e' },
  none: { label: '무', color: 0x9d93b0, str: '#b8b0c8' },
};

export function textStyle(size: number, color: string = C.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}
