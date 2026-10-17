// Render a contact sheet of several views so the geometry can be eyeballed quickly.
// Usage: node contact-sheet.mjs [out.png]
import fs from 'node:fs';
import { CAT_MODEL_BBMODEL, loadModel, encodePNG } from './cat-lib.mjs';
import { render } from './render-cat.mjs';

const VIEWS = [
  ['front', 0, 0],
  ['front-3/4', 35, 12],
  ['side', 90, 0],
  ['back', 180, 0],
  ['3/4-left', -35, 12],
  ['top', 0, 75],
];

const CELL = 240;
const COLS = 2;
const ROWS = Math.ceil(VIEWS.length / COLS);
const W = CELL * COLS;
const H = CELL * ROWS;

const model = loadModel(CAT_MODEL_BBMODEL);
const sheet = new Uint8Array(W * H * 4);
sheet.fill(255);
for (let i = 0; i < W * H; i++) { sheet[i * 4] = 245; sheet[i * 4 + 1] = 248; sheet[i * 4 + 2] = 246; }

VIEWS.forEach(([name, yaw, pitch], n) => {
  const cx = (n % COLS) * CELL;
  const cy = Math.floor(n / COLS) * CELL;
  const rgba = render(model, { width: CELL, height: CELL, animName: 'idle', time: 0, yaw, pitch });
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const s = (y * CELL + x) * 4;
      const d = ((cy + y) * W + cx + x) * 4;
      sheet[d] = rgba[s]; sheet[d + 1] = rgba[s + 1]; sheet[d + 2] = rgba[s + 2]; sheet[d + 3] = 255;
    }
  }
  // 1px separator
  for (let y = 0; y < CELL; y++) {
    const d = ((cy + y) * W + cx) * 4;
    sheet[d] = 200; sheet[d + 1] = 200; sheet[d + 2] = 200;
  }
});

const out = process.argv[2] ?? 'D:/榛戝鏉?_ref/contact-sheet.png';
fs.writeFileSync(out, encodePNG(W, H, sheet));
console.log('wrote', out, `${W}x${H}`, VIEWS.map((v) => v[0]).join(', '));
