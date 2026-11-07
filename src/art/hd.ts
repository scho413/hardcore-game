// 그린 그림 (src/assets/art, 256×256 등). 없는 것은 코드로 찍은 임시 도트를 그대로 씀
//
// 텍스처 키는 기존 것과 같게 맞춤 (`unit-<몬스터>`), 크기만 다르므로
// 화면에 놓을 때 fitScale()로 "예전 도트 기준 배율"을 실제 배율로 바꿈.
// 축소는 밉맵(main.ts render.mipmapFilter)으로 부드럽게, 확대(배경)는 도트 그대로.
import Phaser from 'phaser';
import type { ClassId } from '../data/classes';
import type { FacilityId, PotionId } from '../data/base';
import type { MonsterId } from '../data/monsters';
import type { Tier } from '../data/items';

const files = import.meta.glob('../assets/art/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** 폴더/파일 이름 → url */
function urls(folder: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const m = path.match(new RegExp(`/art/${folder}/(.+?)(\\.png)+$`));
    if (m) out.set(m[1], url);
  }
  return out;
}

// 파일 이름이 코드 id와 다른 것
const MON_ALIAS: Record<string, MonsterId> = { goblin_hob: 'hobgoblin', goblin_wolf_rider: 'wolf_rider' };
const BLD_ALIAS: Record<string, FacilityId> = { smith: 'smithy' };
/** 물약 그림 → 게임 물약 (힘·수호의 영약은 아직 그림 없음) */
const POTION_FILE: Partial<Record<PotionId, string>> = {
  stamina: 'potion_stimulant',
  cure: 'potion_panacea',
  might: 'potion_strengh',
  guard: 'potion_guardian',
  antidote: 'potion_antidote',
};
const WEAPON_FILE: Record<ClassId, string[]> = {
  knight: ['knight_shield', 'knight_sword'],
  warrior: ['warrior_axe'],
  archer: ['archer_bow'],
  mage: ['mage_staff'],
  priest: ['priest_relic'],
};
const TIER_FILE = ['', 'common', 'fine', 'superior'];

/** 몬스터 크기 (전투에서 예전 16px 도트 대비). 그림이 모두 칸을 꽉 채우므로 덩치는 여기서 */
const MON_SIZE: Partial<Record<MonsterId, number>> = {
  goblin: 1.15, goblin_bomber: 1.15, goblin_archer: 1.15, goblin_shaman: 1.15, wolf_rider: 1.35, hobgoblin: 1.35, goblin_chief: 1.25, goblin_king: 1,
  orc: 1.4, orc_hunter: 1.35, orc_shaman: 1.35, orc_berserker: 1.4, orc_warchief: 1.2, orc_warlord: 1.05,
  spider: 1.1, spiderling: 0.8, egg_sac: 1, giant_spider: 1.35, web_weaver: 1.3, broodmother: 1.15, spider_queen: 1.1,
  bandit: 1.3, assassin: 1.3, crossbowman: 1.3, mercenary: 1.35, battle_mage: 1.3, guild_lieutenant: 1.15, guild_master: 1.05,
  warg: 1.35, troll: 1.55, hill_giant: 1.6, ogre_brute: 1.6, ogre_shaman: 1.5, two_headed_ogre: 1.25, tower_lord: 1.2,
};

/** 텍스처가 "예전 도트 몇 px 크기"를 대신하는지 */
function setLogical(scene: Phaser.Scene, key: string, logical: number): void {
  const t = scene.textures.get(key);
  if (t) (t.customData as Record<string, unknown>).logical = logical;
}

/** BootScene.preload에서 부름 */
export function loadArt(scene: Phaser.Scene): void {
  for (const [name, url] of urls('monsters')) scene.load.image(`unit-${MON_ALIAS[name] ?? name}`, url);
  for (const [name, url] of urls('buildings')) {
    const m = name.match(/^(\w+?)_(\d+)$/);
    if (m) scene.load.image(`bld-${BLD_ALIAS[m[1]] ?? m[1]}-${m[2]}`, url);
    else scene.load.image(name.replace(/\.png$/, ''), url); // bld-lot, bld-scaffold
  }
  for (const [name, url] of urls('bgs')) scene.load.image(`bg-${name}`, url);
  for (const [name, url] of urls('weapons')) scene.load.image(`wraw-${name.replace(/_1$/, '')}`, url);
  for (const [name, url] of urls('consumables')) scene.load.image(`pot-${name}`, url);
  for (const [name, url] of urls('ui')) scene.load.image(name, url); // advisor 등
  for (const [name, url] of urls('materials')) scene.load.image(`mat-${name}`, url); // metal1 … crystal3, gold
}

/** BootScene.create에서: 로드한 몬스터 그림에 크기 정보 */
export function hdMonsters(scene: Phaser.Scene): Set<string> {
  const have = new Set<string>();
  for (const name of urls('monsters').keys()) {
    const id = MON_ALIAS[name] ?? name;
    setLogical(scene, `unit-${id}`, 16);
    have.add(id);
  }
  return have;
}

/** 예전 도트 기준 배율 → 이 텍스처의 실제 배율 */
export function fitScale(scene: Phaser.Scene, key: string, scale: number): number {
  const t = scene.textures.get(key);
  const lg = (t?.customData as Record<string, unknown> | undefined)?.logical as number | undefined;
  if (!lg) return scale;
  return (scale * lg) / t.getSourceImage().width;
}

/** 몬스터 배율 (그림이면 덩치 반영) */
export function unitScale(scene: Phaser.Scene, id: string, scale: number): number {
  const key = `unit-${id}`;
  const s = fitScale(scene, key, scale);
  return s === scale ? s : s * (MON_SIZE[id as MonsterId] ?? 1.3);
}

// ─── 배경 ───
/** 탑 층 배경: 보스 층은 보스 방, 나머지는 구간 배경 */
/** 골드 아이콘을 글자 왼쪽에 (그림이 있을 때만) */
export function goldIcon(scene: Phaser.Scene, text: Phaser.GameObjects.Text, size = 30): void {
  if (!scene.textures.exists('mat-gold')) return;
  const left = text.x - text.displayWidth * text.originX;
  scene.add.image(left - size / 2 - 6, text.y + text.displayHeight * (0.5 - text.originY), 'mat-gold').setDisplaySize(size, size).setDepth(text.depth);
}

/** 던전 배경 */
export function dungeonBg(id: string): string {
  return `bg-dungeon_${id}`;
}

/** 재료 아이콘 (그린 그림이 있으면). logical = 예전 도트 아이콘 폭 */
export function hdMatIcon(scene: Phaser.Scene, id: string, logical: number): string | null {
  const key = `mat-${id}`;
  if (!scene.textures.exists(key)) return null;
  setLogical(scene, key, logical);
  return key;
}

export function towerBg(floor: number): string {
  const boss: Record<number, string> = { 10: 'goblin_king', 20: 'orc_warlord', 30: 'spider_queen', 40: 'thieves_guild-master', 50: 'tower_lord' };
  if (boss[floor]) return `bg-${boss[floor]}`;
  const zone = ['goblin_cave', 'orc_warcamp', 'spider', 'bandit_guild', 'giant_mountain'][Math.min(4, Math.floor((floor - 1) / 10))];
  return `bg-${zone}`;
}

/** 기지 배경: 숙소 Lv1~3 / 4~6 / 7 이상 */
export function baseBg(dormLv: number): string {
  return `bg-bg-castle_${dormLv <= 3 ? 1 : dormLv <= 6 ? 2 : 3}`;
}

/** 배경을 영역에 꽉 차게 (넘치는 쪽은 잘림). 배율을 돌려줌 */
export function drawCover(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, anchorY = 0.5): { img: Phaser.GameObjects.Image; s: number; ox: number; oy: number } | null {
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  const s = Math.max(w / src.width, h / src.height);
  const ox = x + (w - src.width * s) / 2;
  const oy = y + (h - src.height * s) * anchorY;
  const img = scene.add.image(ox, oy, key).setOrigin(0, 0).setScale(s);
  img.setCrop((x - ox) / s, (y - oy) / s, w / s, h / s);
  return { img, s, ox, oy };
}

// ─── 건물 ───
export function buildingKey(scene: Phaser.Scene, id: FacilityId | 'lot' | 'scaffold', lv = 1): string | null {
  const key = id === 'lot' ? 'bld-lot' : id === 'scaffold' ? 'bld-scaffold' : `bld-${id}-${Math.max(1, lv)}`;
  return scene.textures.exists(key) ? key : null;
}

// ─── 물약 ───
export function potionKey(scene: Phaser.Scene, id: PotionId): string | null {
  const f = POTION_FILE[id];
  return f && scene.textures.exists(`pot-${f}`) ? `pot-${f}` : null;
}

// ─── 무기 ───
/** 무기 아이콘 (직업·재료 단계, 등급은 뒤의 빛 색). 없으면 null → 도트 아이콘 */
export function hdWeaponIcon(scene: Phaser.Scene, cls: ClassId, tier: Tier, grade: number, gradeColor: number, logical: number): string | null {
  const parts = WEAPON_FILE[cls].map((p) => `wraw-${p}_${TIER_FILE[tier]}`);
  if (!parts.every((k) => scene.textures.exists(k))) return null;
  const key = `whd-${cls}-${tier}-${grade}`;
  if (scene.textures.exists(key)) return key;
  const S = 256;
  const tex = scene.textures.createCanvas(key, S, S);
  if (!tex) return null;
  const ctx = tex.getContext();
  if (grade > 0) {
    const r = (gradeColor >> 16) & 255;
    const g = (gradeColor >> 8) & 255;
    const b = gradeColor & 255;
    const grad = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
    const a = 0.25 + grade * 0.08;
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
  }
  if (parts.length === 2) {
    // 기사: 방패 뒤 왼쪽, 검 앞 오른쪽
    ctx.drawImage(scene.textures.get(parts[0]).getSourceImage() as CanvasImageSource, -28, 22, S * 0.82, S * 0.82);
    ctx.drawImage(scene.textures.get(parts[1]).getSourceImage() as CanvasImageSource, 50, 0, S, S);
  } else {
    ctx.drawImage(scene.textures.get(parts[0]).getSourceImage() as CanvasImageSource, 0, 0, S, S);
  }
  tex.refresh();
  setLogical(scene, key, logical);
  return key;
}

/** 정해진 칸에 넣는 몬스터 (도감 칸 등): 그림이면 hd 배율(16px 기준), 도트면 예전 배율. 덩치는 무시 */
export function unitFit(scene: Phaser.Scene, id: string, old: number, hd: number): number {
  const s = fitScale(scene, `unit-${id}`, hd);
  return s === hd ? old : s;
}

/**
 * 그린 그림을 화면에 나올 크기(px)로 미리 줄인 텍스처.
 * 256px 도트를 실행 중에 0.69배 같은 애매한 배율로 줄이면 픽셀이 뭉개지거나 들쭉날쭉해 보여서,
 * 한 번만 고품질로 줄여 두고 그 텍스처를 1:1로 그림
 */
export function resampled(scene: Phaser.Scene, key: string, w: number): string {
  const rkey = `${key}@${w}`;
  if (scene.textures.exists(rkey)) return rkey;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const h = Math.round((src.height * w) / src.width);
  // 반씩 여러 번 줄이면 한 번에 줄이는 것보다 깨끗함
  let cur: CanvasImageSource = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= w) {
    const c = document.createElement('canvas');
    c.width = Math.round(cw / 2);
    c.height = Math.round(ch / 2);
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    cw = c.width;
    ch = c.height;
  }
  const tex = scene.textures.createCanvas(rkey, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, w, h);
  tex.refresh();
  return rkey;
}
