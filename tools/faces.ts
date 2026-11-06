// 외형 확인용: npm run dev 후 /tools/faces.html (?n=개수&mode=body|face|monsters)
import { FACE_CROP, heroGrid } from '../src/art/heroArt';
import { spriteGrid } from '../src/art/pixels';
import { MONSTERS, type MonsterId } from '../src/data/monsters';
import { FAMILIES } from '../src/data/races';
import { CLASSES } from '../src/data/classes';
import { generateHero, heroRace } from '../src/data/heroes';

const q = new URLSearchParams(location.search);
const n = Number(q.get('n') ?? 36);
const mode = q.get('mode') ?? 'body';
const ctx = { names: new Set<string>(), looks: new Set<string>() };
let stop = false;
const grid = document.getElementById('grid')!;
if (mode === 'monsters') {
  for (const id of Object.keys(MONSTERS) as MonsterId[]) {
    const g = spriteGrid(id);
    const cv = document.createElement('canvas');
    cv.width = 16;
    cv.height = 16;
    const c2 = cv.getContext('2d')!;
    g.forEach((row, y) => row.forEach((col, x) => { if (col) { c2.fillStyle = col; c2.fillRect(x, y, 1, 1); } }));
    const d = document.createElement('div');
    d.className = 'c';
    d.append(cv, document.createElement('br'), MONSTERS[id].name, document.createElement('br'), FAMILIES[MONSTERS[id].family].name);
    grid.append(d);
  }
  stop = true;
}
for (let i = 0; i < (stop ? 0 : n); i++) {
  const h = generateHero(Math.random, `t${i}`, ctx);
  const g = heroGrid(h);
  const [cx, cy, cw, ch] = mode === 'face' ? FACE_CROP : [0, 0, 32, 32];
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const c2 = cv.getContext('2d')!;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const col = g[cy + y][cx + x];
    if (col) { c2.fillStyle = col; c2.fillRect(x, y, 1, 1); }
  }
  const d = document.createElement('div');
  d.className = 'c';
  d.append(cv, document.createElement('br'), `${h.name}`, document.createElement('br'), `${heroRace(h).name} ${CLASSES[h.classId].name}`);
  grid.append(d);
}
