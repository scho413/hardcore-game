// GDD 3.8 유산: 죽은 영웅은 살아서 한 만큼 기지에 무언가를 남김 (일대기·기록에서 계산)
import type { ClassId } from './classes';
import { CLASSES } from './classes';
import { FAMILIES, type Family } from './races';
import { TRAITS, traitName, type HeroTrait } from './traits';

/** 기여도 = 첫 돌파 층 ×5 + 보스 처치 ×20 + 레벨 ×2 */
export const SCORE = { pioneer: 5, boss: 20, level: 2 };
/** 기여도 기준: 비석 / 기념비 / 동상 */
export const TIERS = [10, 50, 150];
export const TIER_NAME = ['없음', '비석', '기념비', '동상'];
const TIER_MULT = [0, 1, 1.5, 2];

export type LegacyKind = 'slayer' | 'mentor' | 'blessing' | 'healer' | 'veteran' | 'disciple';

export interface LegacyItem {
  kind: LegacyKind;
  v: number;
  family?: Family;
  cls?: ClassId;
  trait?: HeroTrait;
}

export interface Legacy {
  score: number;
  tier: number;
  items: LegacyItem[];
}

/** 유산 계산에 필요한 영웅 정보 */
export interface LegacySource {
  classId: ClassId;
  level: number;
  traits: HeroTrait[];
  record: { kills: number; killsBy: Partial<Record<Family, number>>; pioneer?: number; bosses?: number };
}

export function contribution(h: LegacySource): { score: number; pioneer: number; bosses: number } {
  const pioneer = h.record.pioneer ?? 0;
  const bosses = h.record.bosses ?? 0;
  return { score: pioneer * SCORE.pioneer + bosses * SCORE.boss + h.level * SCORE.level, pioneer, bosses };
}

export function tierOf(score: number): number {
  return TIERS.filter((t) => score >= t).length;
}

/** 죽을 때 한 번 계산. 한 일이 많은 순서로 tier개 */
export function makeLegacy(h: LegacySource): Legacy {
  const { score } = contribution(h);
  const tier = tierOf(score);
  if (tier === 0) return { score, tier, items: [] };
  const m = TIER_MULT[tier];
  const cand: { w: number; item: LegacyItem }[] = [];
  // 가장 많이 잡은 계열 → 그 계열 사냥법 전수
  const fams = Object.entries(h.record.killsBy) as [Family, number][];
  if (fams.length) {
    const [fam, n] = fams.sort((a, b) => b[1] - a[1])[0];
    if (n >= 10) cand.push({ w: n, item: { kind: 'slayer', v: 0.03 * m, family: fam } });
  }
  cand.push({ w: h.level * 3, item: { kind: 'mentor', v: 0.05 * m, cls: h.classId } });
  cand.push({ w: 45, item: { kind: 'blessing', v: 0.02 * m, cls: h.classId } });
  if (h.classId === 'priest') cand.push({ w: 60, item: { kind: 'healer', v: 0.05 * m } });
  if (h.level >= 15) cand.push({ w: h.level * 2, item: { kind: 'veteran', v: 0.1 * m } });
  const good = h.traits.filter((t) => TRAITS[t.id].kind === 'good' && TRAITS[t.id].birth);
  if (good.length) cand.push({ w: 40 + good.length * 10, item: { kind: 'disciple', v: 0.5, cls: h.classId, trait: good.sort((a, b) => b.v - a.v)[0] } });
  return { score, tier, items: cand.sort((a, b) => b.w - a.w).slice(0, tier).map((c) => c.item) };
}

export function legacyText(it: LegacyItem): string {
  const p = (v: number) => `${Math.round(v * 100)}%`;
  switch (it.kind) {
    case 'slayer':
      return `사냥법 전수: 모든 영웅 ${FAMILIES[it.family!].name}에게 피해 +${p(it.v)}`;
    case 'mentor':
      return `가르침: ${CLASSES[it.cls!].name} 경험치 +${p(it.v)}`;
    case 'blessing':
      return `수호령: ${CLASSES[it.cls!].name} 체력·공격·방어 +${p(it.v)}`;
    case 'healer':
      return `치유의 손: 병원 회복 속도 +${p(it.v)}`;
    case 'veteran':
      return `노장의 교본: 훈련장 경험치 +${p(it.v)}`;
    case 'disciple':
      return `제자: 다음 ${CLASSES[it.cls!].name} 모집 시 50% 확률로 '${traitName(it.trait!)}' 물려받음`;
  }
}

/** 같은 종류 유산 합산 상한 (영웅을 일부러 죽여 강해지지 않도록) */
export const CAPS = { vsFamily: 0.15, classStat: 0.1, classXp: 0.3, hospital: 0.25, training: 0.5 };

export interface LegacyTotals {
  vsFamily: Partial<Record<Family, number>>;
  classStat: Partial<Record<ClassId, number>>;
  classXp: Partial<Record<ClassId, number>>;
  hospital: number;
  training: number;
}

export function emptyTotals(): LegacyTotals {
  return { vsFamily: {}, classStat: {}, classXp: {}, hospital: 0, training: 0 };
}

export function legacyTotals(list: (Legacy | undefined)[]): LegacyTotals {
  const t = emptyTotals();
  const add = <K extends string>(rec: Partial<Record<K, number>>, k: K, v: number, cap: number) => {
    rec[k] = Math.min(cap, (rec[k] ?? 0) + v);
  };
  for (const l of list) {
    for (const it of l?.items ?? []) {
      if (it.kind === 'slayer') add(t.vsFamily, it.family!, it.v, CAPS.vsFamily);
      else if (it.kind === 'mentor') add(t.classXp, it.cls!, it.v, CAPS.classXp);
      else if (it.kind === 'blessing') add(t.classStat, it.cls!, it.v, CAPS.classStat);
      else if (it.kind === 'healer') t.hospital = Math.min(CAPS.hospital, t.hospital + it.v);
      else if (it.kind === 'veteran') t.training = Math.min(CAPS.training, t.training + it.v);
    }
  }
  return t;
}
