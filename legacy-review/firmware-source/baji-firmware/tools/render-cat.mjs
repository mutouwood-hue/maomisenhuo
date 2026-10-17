// Reference software renderer for pixel-cat, mirroring the planned firmware path:
// orthographic projection + backface culling + painter's algorithm + nearest texel,
// with a per-frame Lambert shade computed from the view-space face normal.
//
// Usage:
//   node render-cat.mjs --anim idle --time 0 --size 320 --out out.png [--breed silver] [--yaw 30] [--pitch 12]

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  loadModel, prepareAnimation, boneMatrices, m4, encodePNG, FACE_NORMALS, CAT_MODEL_BBMODEL,
} from './cat-lib.mjs';

/* ---------------- breed recolouring (1:1 port of the HTML game) ---------------- */

export const BREEDS = {
  orange: null, // uses the raw texture
  silver: { fur: 12041922, shade: 10726577, stripe: 5858669, white: 16052969, point: 5858669 },
  tuxedo: { fur: 3160389, shade: 2568252, stripe: 3160389, white: 16315624, point: 3160389 },
  siamese: { fur: 15062197, shade: 14338216, stripe: 15062197, white: 15062197, point: 6639690 },
  ragdoll: { fur: 15919840, shade: 15195601, stripe: 15919840, white: 16775404, point: 9078158 },
  blue: { fur: 8163751, shade: 7374235, stripe: 8163751, white: 9084337, point: 8163751 },
};

const RECOLOR_TARGET = /^(tabby_|white_|soft_belly|muzzle_|ear_(base|step|tip)|tail_|(front|back)_(left|right)_(leg|white_sock|paw))/;
const IS_WHITE = /white_|soft_belly|muzzle_|_paw/;

const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

/** Returns a new RGBA buffer with the breed palette applied. */
export function recolorBreed(model, breed) {
  const W = model.texture.width;
  const H = model.texture.height;
  const src = model.texture.data;
  const out = new Uint8Array(src); // copy
  const P = BREEDS[breed];
  if (!P) return out;

  for (const el of model.elements) {
    if (!RECOLOR_TARGET.test(el.name)) continue;
    for (const f of el.faces) {
      // Rebuild the uv rect the same way the game does (from the raw face uv).
      const [u1, v1, u2, v2] = f.uvRect ?? [];
      if (!f.uvRect) continue;
      const x0 = Math.floor(Math.min(u1, u2));
      const y0 = Math.floor(Math.min(v1, v2));
      const x1 = Math.ceil(Math.max(u1, u2));
      const y1 = Math.ceil(Math.max(v1, v2));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const o = (py * W + px) * 4;
          if (!src[o + 3]) continue;
          const Q = (px - x0 + 0.5) / Math.max(1, x1 - x0);
          const ue = (py - y0 + 0.5) / Math.max(1, y1 - y0);
          const r = src[o];
          const g = src[o + 1];
          const isWhite = IS_WHITE.test(el.name);
          let c = isWhite ? P.white : P.fur;
          if (breed === 'silver' && !isWhite && r < 190 && g < 130) c = P.stripe;
          else if ((breed === 'silver' && !isWhite && r < 225) ||
                   (breed !== 'silver' && !isWhite && (px * 3 + py * 7) % 19 === 0)) c = P.shade;
          if (breed === 'tuxedo' && el.name === 'tabby_head' && f.face === 'north' &&
              Math.abs(Q - 0.5) < 0.07 + ue * 0.24) c = P.white;
          if (breed === 'siamese') {
            if (/^(tabby_head|ear_|tail_|white_chin|muzzle_)|_white_sock|_paw/.test(el.name)) c = P.point;
            if (/_leg/.test(el.name) && f.face !== 'up' && (f.face === 'down' || ue > 0.57)) c = 10125424;
            if (el.name === 'tabby_head' && f.face === 'north') c = Math.abs(Q - 0.5) < 0.34 ? 5719617 : P.point;
          }
          if (breed === 'ragdoll') {
            if (/^(tabby_head|ear_|tail_)/.test(el.name)) c = P.point;
            if (el.name === 'tabby_head' && f.face === 'north' &&
                Math.abs(Q - 0.5) < 0.035 + ue * 0.36) c = P.white;
            if (el.name === 'tabby_body' && f.face === 'up') c = 13156800;
            if (el.name === 'tabby_body' && (f.face === 'east' || f.face === 'west') && ue < 0.34) c = 13880266;
          }
          const rgbv = rgb(c);
          out[o] = rgbv[0]; out[o + 1] = rgbv[1]; out[o + 2] = rgbv[2];
        }
      }
    }
  }

  if (breed === 'siamese' || breed === 'ragdoll') {
    for (const el of model.elements.filter((e) => e.name.startsWith('eye_iris_'))) {
      for (const f of el.faces) {
        if (!f.uvRect) continue;
        const [u1, v1, u2, v2] = f.uvRect;
        const x0 = Math.floor(Math.min(u1, u2));
        const y0 = Math.floor(Math.min(v1, v2));
        const x1 = Math.ceil(Math.max(u1, u2));
        const y1 = Math.ceil(Math.max(v1, v2));
        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const o = (py * W + px) * 4;
            if (out[o + 1] > out[o] * 1.05 && out[o + 1] > out[o + 2] * 1.15) {
              out[o] = 103; out[o + 1] = 174; out[o + 2] = 221;
            }
          }
        }
      }
    }
  }
  return out;
}

/* ---------------- render ---------------- */

export function render(model, opts = {}) {
  const {
    width = 320,
    height = 320,
    animName = 'idle',
    time = 0,
    yaw = 30,
    pitch = 12,
    breed = 'orange',
    bg = [237, 247, 246],
  } = opts;

  const tex = breed === 'orange' ? model.texture.data : recolorBreed(model, breed);
  const anim = prepareAnimation(model, animName);
  const world = boneMatrices(model, anim, time);

  // Model bounds -> centre
  const centre = [0, 9.35, 0];

  // View rotation: yaw about Y then pitch about X.
  // The model faces -Z, so add 180 deg to make yaw=0 mean "looking at the face".
  const R = m4.mul(m4.rotX(pitch), m4.rotY(yaw + 180));

  // Orthographic fit: model is ~19 units tall, ~17 deep.
  const scale = (Math.min(width, height) / 21) * 1.0;

  const view = (p) => {
    const d = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
    return m4.xform(R, d);
  };
  const project = (v) => [width / 2 + v[0] * scale, height / 2 - v[1] * scale, v[2]];

  // Light fixed in view space (from upper-left-front).
  const L = (() => {
    const l = [0.35, 0.62, 0.70];
    const n = Math.hypot(...l);
    return l.map((x) => x / n);
  })();

  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255;
  }

  // Build the draw list: transform every face, cull, then sort back-to-front.
  const list = [];
  for (const f of model.faces) {
    const M = world[f.bone];
    const pv = f.pos.map((p) => view(m4.xform(M, p)));
    // Signed area in screen space -> backface cull.
    const s = pv.map(project);
    const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
    if (area >= 0) continue; // CCW outside -> keep the negative ones

    // View-space normal for shading
    const e1 = [pv[1][0] - pv[0][0], pv[1][1] - pv[0][1], pv[1][2] - pv[0][2]];
    const e2 = [pv[2][0] - pv[0][0], pv[2][1] - pv[0][1], pv[2][2] - pv[0][2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(...n) || 1;
    n = n.map((x) => x / nl);
    if (n[2] < 0) n = n.map((x) => -x); // face the viewer
    const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const shade = 0.55 + 0.45 * lam;

    const z = (pv[0][2] + pv[1][2] + pv[2][2] + pv[3][2]) / 4;
    list.push({ s, uv: f.uv, z, shade });
  }
  list.sort((a, b) => a.z - b.z);

  const W = model.texture.width;
  const H = model.texture.height;

  for (const tri of list) {
    for (let k = 0; k < 2; k++) {
      const i0 = k === 0 ? 0 : 0;
      const idx = k === 0 ? [0, 1, 2] : [0, 2, 3];
      const P = idx.map((i) => [tri.s[i][0], tri.s[i][1]]);
      const UV = idx.map((i) => tri.uv[i]);
      rasterTriangle(P, UV, tri.shade, tex, W, H, out, width, height);
    }
  }

  return out;
}

function rasterTriangle(P, UV, shade, tex, W, H, out, width, height) {
  const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
  const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
  if (minX > maxX || minY > maxY) return;

  const x0 = P[0][0], y0 = P[0][1], x1 = P[1][0], y1 = P[1][1], x2 = P[2][0], y2 = P[2][1];
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area === 0) return;

  for (let py = minY; py <= maxY; py++) {
    const fy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const fx = px + 0.5;
      let w0 = ((x1 - fx) * (y2 - fy) - (x2 - fx) * (y1 - fy)) / area;
      let w1 = ((x2 - fx) * (y0 - fy) - (x0 - fx) * (y2 - fy)) / area;
      let w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;

      const u = w0 * UV[0][0] + w1 * UV[1][0] + w2 * UV[2][0];
      const v = w0 * UV[0][1] + w1 * UV[1][1] + w2 * UV[2][1];
      const tx = Math.min(W - 1, Math.max(0, u | 0));
      const ty = Math.min(H - 1, Math.max(0, v | 0));
      const to = (ty * W + tx) * 4;
      if (!tex[to + 3]) continue;
      const o = (py * width + px) * 4;
      out[o] = Math.min(255, tex[to] * shade);
      out[o + 1] = Math.min(255, tex[to + 1] * shade);
      out[o + 2] = Math.min(255, tex[to + 2] * shade);
      out[o + 3] = 255;
    }
  }
}

/* ---------------- CLI ---------------- */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (k, d) => {
    const i = args.indexOf('--' + k);
    return i >= 0 ? args[i + 1] : d;
  };
  const modelPath = get('model', CAT_MODEL_BBMODEL);
  const out = get('out', 'D:/榛戝鏉?_ref/render.png');
  const size = Number(get('size', 320));
  const model = loadModel(modelPath);
  const rgba = render(model, {
    width: size,
    height: size,
    animName: get('anim', 'idle'),
    time: Number(get('time', 0)),
    yaw: Number(get('yaw', 30)),
    pitch: Number(get('pitch', 12)),
    breed: get('breed', 'orange'),
  });
  fs.writeFileSync(out, encodePNG(size, size, rgba));
  console.log('wrote', out, size + 'x' + size);
}
