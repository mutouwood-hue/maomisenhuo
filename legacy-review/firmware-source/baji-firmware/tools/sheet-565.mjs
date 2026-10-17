// Build a contact sheet from raw RGB565 frame dumps produced by the C test.
// Usage: node tools/sheet-565.mjs <frames_dir> <out.png> [size] [cols]
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from './cat-lib.mjs';

const dir = process.argv[2] ?? 'build/host/frames';
const out = process.argv[3] ?? 'build/host/frames/sheet.png';
const SIZE = Number(process.argv[4] ?? 466);
const COLS = Number(process.argv[5] ?? 5);

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.565')).sort();
if (!files.length) {
  console.error('no .565 files in ' + dir);
  process.exit(1);
}

const CELL = SIZE;
const ROWS = Math.ceil(files.length / COLS);
const W = CELL * COLS;
const H = CELL * ROWS;
const sheet = new Uint8Array(W * H * 4);
sheet.fill(255);

files.forEach((name, n) => {
  const raw = fs.readFileSync(path.join(dir, name));
  const cx = (n % COLS) * CELL;
  const cy = Math.floor(n / COLS) * CELL;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = raw.readUInt16LE((y * SIZE + x) * 2);
      const d = ((cy + y) * W + cx + x) * 4;
      sheet[d] = Math.round(((v >> 11) & 31) * 255 / 31);
      sheet[d + 1] = Math.round(((v >> 5) & 63) * 255 / 63);
      sheet[d + 2] = Math.round((v & 31) * 255 / 31);
      sheet[d + 3] = 255;
    }
  }
});

fs.writeFileSync(out, encodePNG(W, H, sheet));
console.log(`wrote ${out} ${W}x${H} from ${files.length} frames`);
console.log(files.join('\n'));
