// Compare the firmware rasteriser's output against the independent
// firmware-emulating reference, pixel by pixel.
//
// A mismatch means one of the two implementations is wrong. Because the reference
// mirrors the firmware's numeric choices exactly (quantised shading, integer UV
// stepping, painter's algorithm), agreement has to be near-total; anything else
// is a real bug rather than a presentation difference.
//
// Usage: node tools/compare-render.mjs <frames_dir> <assets_dir> [--dump <dir>]

import fs from 'node:fs';
import path from 'node:path';
import { loadModel, encodePNG, CAT_MODEL_BBMODEL, dataPath } from './cat-lib.mjs';
import { buildTables, renderFirmware, BREED_NAMES } from './firmware-ref.mjs';
import { recolorBreed } from './render-cat.mjs';

const CASES = [
  { name: '01-orange-idle-front', breed: 0, anim: 0, time: 0.00, yaw: 0.0, pitch: 12.0 },
  { name: '02-orange-idle-3q', breed: 0, anim: 0, time: 0.00, yaw: 35.0, pitch: 12.0 },
  { name: '03-orange-idle-side', breed: 0, anim: 0, time: 0.80, yaw: 90.0, pitch: 0.0 },
  { name: '04-silver-idle-3q', breed: 1, anim: 0, time: 0.40, yaw: 35.0, pitch: 12.0 },
  { name: '05-tuxedo-walk', breed: 2, anim: 1, time: 0.25, yaw: 35.0, pitch: 12.0 },
  { name: '06-siamese-walk', breed: 3, anim: 1, time: 0.50, yaw: 35.0, pitch: 12.0 },
  { name: '07-ragdoll-paw', breed: 4, anim: 2, time: 1.00, yaw: -35.0, pitch: 10.0 },
  { name: '08-blue-paw-back', breed: 5, anim: 2, time: 1.60, yaw: 180.0, pitch: 12.0 },
  { name: '09-orange-idle-top', breed: 0, anim: 0, time: 1.60, yaw: 20.0, pitch: 70.0 },
  { name: '10-orange-walk-3q', breed: 0, anim: 1, time: 0.75, yaw: 50.0, pitch: 8.0 },
];

const framesDir = process.argv[2] ?? 'build/host/frames';
const assetsDir = process.argv[3] ?? dataPath();
const dumpIdx = process.argv.indexOf('--dump');
const dumpDir = dumpIdx >= 0 ? process.argv[dumpIdx + 1] : null;
const SIZE = Number(process.env.CAT_SIZE ?? 466);

const model = loadModel(CAT_MODEL_BBMODEL);
const tables = buildTables(model);

let totalDiff = 0;
let totalPx = 0;
let worst = 0;
const rows = [];

for (const c of CASES) {
  const rawPath = path.join(framesDir, `${c.name}.565`);
  if (!fs.existsSync(rawPath)) {
    console.error(`MISSING ${rawPath}`);
    process.exitCode = 1;
    continue;
  }
  const raw = fs.readFileSync(rawPath);
  const got = new Uint16Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) got[i] = raw.readUInt16LE(i * 2);

  const breedRGBA = c.breed === 0 ? model.texture.data : recolorBreed(model, BREED_NAMES[c.breed]);
  const ref = renderFirmware(model, tables, {
    width: SIZE, height: SIZE, anim: c.anim, time: c.time, yaw: c.yaw, pitch: c.pitch, breedRGBA,
  });

  let diff = 0;
  let maxErr = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (got[i] !== ref.out[i]) {
      diff++;
      const a = got[i], b = ref.out[i];
      const dr = Math.abs(((a >> 11) & 31) - ((b >> 11) & 31));
      const dg = Math.abs(((a >> 5) & 63) - ((b >> 5) & 63));
      const db = Math.abs((a & 31) - (b & 31));
      const e = Math.max(dr, dg, db);
      if (e > maxErr) maxErr = e;
    }
  }
  const pct = (diff / (SIZE * SIZE)) * 100;
  totalDiff += diff;
  totalPx += SIZE * SIZE;
  if (pct > worst) worst = pct;

  rows.push({ name: c.name, diff, pct, maxErr, refFaces: ref.faces, refPixels: ref.pixels });

  if (dumpDir && diff > 0) {
    fs.mkdirSync(dumpDir, { recursive: true });
    // Side-by-side: firmware | reference | difference heat map
    const w = SIZE * 3;
    const sheet = new Uint8Array(w * SIZE * 4);
    const put = (src, ox, isDiff) => {
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const v = src[y * SIZE + x];
          const d = (y * w + ox + x) * 4;
          if (isDiff) {
            const same = got[y * SIZE + x] === ref.out[y * SIZE + x];
            sheet[d] = same ? 230 : 255;
            sheet[d + 1] = same ? 230 : 40;
            sheet[d + 2] = same ? 230 : 40;
            sheet[d + 3] = 255;
          } else {
            sheet[d] = Math.round(((v >> 11) & 31) * 255 / 31);
            sheet[d + 1] = Math.round(((v >> 5) & 63) * 255 / 63);
            sheet[d + 2] = Math.round((v & 31) * 255 / 31);
            sheet[d + 3] = 255;
          }
        }
      }
    };
    put(got, 0, false);
    put(ref.out, SIZE, false);
    put(got, SIZE * 2, true);
    fs.writeFileSync(path.join(dumpDir, `${c.name}.diff.png`), encodePNG(w, SIZE, sheet));
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('case', 24) + pad('differing px', 14) + pad('% of frame', 12) + pad('max ch err', 12) + pad('ref faces', 11) + 'ref pixels');
for (const r of rows) {
  console.log(
    pad(r.name, 24) +
    pad(r.diff, 14) +
    pad(r.pct.toFixed(3) + '%', 12) +
    pad(r.maxErr, 12) +
    pad(r.refFaces, 11) +
    r.refPixels,
  );
}
console.log('');
const pct = (totalDiff / totalPx) * 100;
console.log(`TOTAL differing pixels: ${totalDiff} / ${totalPx}  (${pct.toFixed(4)}%)   worst case: ${worst.toFixed(3)}%`);
if (totalDiff === 0) console.log('RESULT: firmware output is byte-identical to the reference.');
else if (pct < 0.01) console.log('RESULT: essentially identical (sub-0.01% differences).');
else { console.log('RESULT: MISMATCH -- investigate.'); process.exitCode = 1; }
