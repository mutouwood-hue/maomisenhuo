// Convert cat3d test output (.565 raw RGB565LE, or .ppm) into PNG for inspection.
// Usage: node ppm2png.mjs <in> <out.png>
import fs from 'node:fs';
import { encodePNG } from './cat-lib.mjs';

const [inp, outp] = process.argv.slice(2);
const buf = fs.readFileSync(inp);

let w, h, rgba;
if (inp.endsWith('.ppm')) {
  const m = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(buf.toString('latin1', 0, 64));
  if (!m) throw new Error('bad PPM header');
  w = Number(m[1]); h = Number(m[2]);
  const off = m[0].length;
  rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = buf[off + i * 3];
    rgba[i * 4 + 1] = buf[off + i * 3 + 1];
    rgba[i * 4 + 2] = buf[off + i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
} else {
  const size = Number(process.argv[4] ?? 466);
  w = size; h = size;
  rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = buf.readUInt16LE(i * 2);
    const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
    rgba[i * 4] = Math.round(r * 255 / 31);
    rgba[i * 4 + 1] = Math.round(g * 255 / 63);
    rgba[i * 4 + 2] = Math.round(b * 255 / 31);
    rgba[i * 4 + 3] = 255;
  }
}

fs.writeFileSync(outp, encodePNG(w, h, rgba));
console.log(`wrote ${outp} ${w}x${h}`);
