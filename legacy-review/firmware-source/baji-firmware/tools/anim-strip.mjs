// Render a strip of animation frames to validate the bone/animation math.
// Usage: node anim-strip.mjs [anim] [out.png]
import fs from 'node:fs';
import { CAT_MODEL_BBMODEL, loadModel, encodePNG } from './cat-lib.mjs';
import { render } from './render-cat.mjs';

const anim = process.argv[2] ?? 'idle';
const out = process.argv[3] ?? `D:/榛戝鏉?_ref/strip-${anim}.png`;

const N = 6;
const CELL = 200;
const W = CELL * N;
const H = CELL;

const model = loadModel(CAT_MODEL_BBMODEL);
const a = model.animations.find((x) => x.name === anim);

const sheet = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) { sheet[i * 4] = 245; sheet[i * 4 + 1] = 248; sheet[i * 4 + 2] = 246; sheet[i * 4 + 3] = 255; }

for (let n = 0; n < N; n++) {
  const t = (a.length * n) / N;
  const cx = n * CELL;
  const rgba = render(model, { width: CELL, height: CELL, animName: anim, time: t, yaw: 35, pitch: 10 });
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const s = (y * CELL + x) * 4;
      const d = (y * W + cx + x) * 4;
      sheet[d] = rgba[s]; sheet[d + 1] = rgba[s + 1]; sheet[d + 2] = rgba[s + 2]; sheet[d + 3] = 255;
    }
  }
  for (let y = 0; y < CELL; y++) {
    const d = (y * W + cx) * 4;
    sheet[d] = 205; sheet[d + 1] = 205; sheet[d + 2] = 205;
  }
}

fs.writeFileSync(out, encodePNG(W, H, sheet));
console.log('wrote', out, `${W}x${H}`, anim, 'length', a.length, 'frames at', Array.from({ length: N }, (_, n) => ((a.length * n) / N).toFixed(2)).join(', '));
