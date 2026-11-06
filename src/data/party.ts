import type { Element, Row, UnitInit } from '../battle/types';
import { CLASSES, statsAtLevel, type ClassId } from './classes';

/** 1단계용 고정 영웅. 2단계에서 랜덤 생성 + 영구 사망으로 교체됩니다. */
export interface Hero {
  id: string;
  name: string;
  classId: ClassId;
  element: Element;
  level: number;
}

/** 진형 슬롯 5개: 전열 2 / 중열 1 / 후열 2 (GDD 4.1) */
export const FORMATION_SLOTS: { row: Row; slot: number }[] = [
  { row: 'front', slot: 0 },
  { row: 'front', slot: 1 },
  { row: 'mid', slot: 0 },
  { row: 'back', slot: 0 },
  { row: 'back', slot: 1 },
];

export function defaultParty(): Hero[] {
  // 배열 순서 = 진형 슬롯 순서
  return [
    { id: 'h1', name: '브람', classId: 'knight', element: 'none', level: 1 },
    { id: 'h2', name: '카이', classId: 'warrior', element: 'fire', level: 1 },
    { id: 'h3', name: '에린', classId: 'priest', element: 'none', level: 1 },
    { id: 'h4', name: '시엘', classId: 'archer', element: 'wind', level: 1 },
    { id: 'h5', name: '노아', classId: 'mage', element: 'water', level: 1 },
  ];
}

export function buildAllies(party: Hero[]): UnitInit[] {
  return party.map((h, i) => {
    const c = CLASSES[h.classId];
    const pos = FORMATION_SLOTS[i];
    return {
      id: h.id,
      name: h.name,
      side: 'ally',
      kind: c.id,
      element: h.element,
      row: pos.row,
      slot: pos.slot,
      stats: statsAtLevel(c.base, h.level),
      basic: c.basic,
      skills: c.skills,
      level: h.level,
    };
  });
}
