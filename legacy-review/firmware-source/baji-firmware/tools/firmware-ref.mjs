// Firmware-emulating reference renderer.
//
// This is an INDEPENDENT implementation of the same pipeline as components/cat3d,
// written against the verified geometry model. It deliberately mimics the
// firmware's *numeric* behaviour, not just its algorithm:
//
//   * every arithmetic step is rounded through Math.fround, so the reference
//     carries IEEE-754 binary32 precision exactly like the C `float` code;
//   * shading runs through the same 32-level quantisation and 5/6/5 lookup tables;
//   * the same painter's algorithm, same auto-fit, same integer UV stepping.
//
// That makes a byte-level comparison meaningful: if the two disagree, one of them
// has a real bug rather than a rounding difference.

import { loadModel } from './cat-lib.mjs';

const f = Math.fround;

export const SHADE_LEVELS = 32;
export const BREED_NAMES = ['orange', 'silver', 'tuxedo', 'siamese', 'ragdoll', 'blue'];

/* ------------------------------------------------------------------ */
/* float32 matrix helpers, mirroring the C evaluation order            */
/* ------------------------------------------------------------------ */

/**
 * o[c*4+r] = a[r]*b[c*4+0] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3]
 * summed left to right, as the C compiler emits for that expression.
 */
export function f32_mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      const t0 = f(a[r] * b[c * 4 + 0]);
      const t1 = f(a[4 + r] * b[c * 4 + 1]);
      const t2 = f(a[8 + r] * b[c * 4 + 2]);
      const t3 = f(a[12 + r] * b[c * 4 + 3]);
      o[c * 4 + r] = f(f(f(t0 + t1) + t2) + t3);
    }
  }
  return o;
}

export function f32_identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function f32_translate(x, y, z) {
  const m = f32_identity();
  m[12] = f(x); m[13] = f(y); m[14] = f(z);
  return m;
}

export function f32_scale(x, y, z) {
  const m = f32_identity();
  m[0] = f(x); m[5] = f(y); m[10] = f(z);
  return m;
}

/** C computes r = deg * (float)M_PI / 180.0f, then cosf/sinf on the float value. */
function trig(deg) {
  const r = f(f(f(deg) * f(Math.PI)) / f(180.0));
  return { c: f(Math.cos(r)), s: f(Math.sin(r)) };
}

export function f32_rot_x(deg) {
  const { c, s } = trig(deg);
  const m = f32_identity();
  m[5] = c; m[6] = s; m[9] = f(-s); m[10] = c;
  return m;
}

export function f32_rot_y(deg) {
  const { c, s } = trig(deg);
  const m = f32_identity();
  m[0] = c; m[2] = f(-s); m[8] = s; m[10] = c;
  return m;
}

export function f32_rot_z(deg) {
  const { c, s } = trig(deg);
  const m = f32_identity();
  m[0] = c; m[1] = s; m[4] = f(-s); m[5] = c;
  return m;
}

/** Transform a point by a float32 affine matrix, in the C's summation order. */
export function f32_point(m, v) {
  const x = f(f(f(f(m[0] * v[0]) + f(m[4] * v[1])) + f(m[8] * v[2])) + m[12]);
  const y = f(f(f(f(m[1] * v[0]) + f(m[5] * v[1])) + f(m[9] * v[2])) + m[13]);
  const z = f(f(f(f(m[2] * v[0]) + f(m[6] * v[1])) + f(m[10] * v[2])) + m[14]);
  return [x, y, z];
}

/* ------------------------------------------------------------------ */
/* tables, built the same way the generator emits cat_model.h          */
/* ------------------------------------------------------------------ */

export function buildTables(model) {
  const verts = [];
  const parts = [];
  const faces = [];
  const EPS = 1e-4;
  const key = (p) => `${Math.round(p[0] / EPS)}|${Math.round(p[1] / EPS)}|${Math.round(p[2] / EPS)}`;

  for (const el of model.elements) {
    const localIndex = new Map();
    const localVerts = [];
    const firstVtx = verts.length;
    const firstFace = faces.length;

    for (const fc of el.faces) {
      const idx = [];
      for (let i = 0; i < 4; i++) {
        const p = fc.pos[i];
        const k = key(p);
        let li = localIndex.get(k);
        if (li === undefined) {
          li = localVerts.length;
          localIndex.set(k, li);
          localVerts.push(p);
        }
        idx.push(li + firstVtx);
      }
      faces.push({ idx, uv: fc.uv, part: parts.length, element: el.name, face: fc.face });
    }
    for (const p of localVerts) verts.push(p);
    parts.push({ bone: el.bone, firstVtx, vtxCount: localVerts.length, name: el.name });
  }

  const keys = [];
  const tracks = [];
  const anims = [];
  const CHAN = { position: 0, rotation: 1, scale: 2 };
  for (const a of model.animations) {
    const firstTrack = tracks.length;
    for (const [uuid, anim] of Object.entries(a.animators ?? {})) {
      const bone = model.bones.findIndex((b) => b.uuid === uuid);
      if (bone < 0) continue;
      for (const chName of ['position', 'rotation', 'scale']) {
        const kfs = (anim.keyframes ?? []).filter((k) => k.channel === chName).sort((p, q) => p.time - q.time);
        if (!kfs.length) continue;
        const first = keys.length;
        for (const k of kfs) {
          const d = k.data_points[0];
          keys.push({ t: k.time, v: [Number(d.x), Number(d.y), Number(d.z)] });
        }
        tracks.push({ bone, chan: CHAN[chName], first, count: kfs.length });
      }
    }
    anims.push({ name: a.name, length: a.length, firstTrack, trackCount: tracks.length - firstTrack });
  }

  return { verts, parts, faces, keys, tracks, anims };
}

/* ------------------------------------------------------------------ */
/* animation sampling and bone matrices, float32 for float32           */
/* ------------------------------------------------------------------ */

function sampleVec3(tr, keys, t) {
  if (tr.count === 0) return null;
  if (tr.count === 1 || t <= keys[tr.first].t) return keys[tr.first].v;
  const last = keys[tr.first + tr.count - 1];
  if (t >= last.t) return last.v;
  let i = tr.first;
  while (i < tr.first + tr.count - 1 && keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1];
  const span = f(b.t - a.t);
  const fr = span > 0 ? f(f(t - a.t) / span) : 0;
  return [
    f(a.v[0] + f(f(b.v[0] - a.v[0]) * fr)),
    f(a.v[1] + f(f(b.v[1] - a.v[1]) * fr)),
    f(a.v[2] + f(f(b.v[2] - a.v[2]) * fr)),
  ];
}

export function boneViewMatrices(model, tables, animIndex, time, yaw, pitch, focus) {
  const a = tables.anims[animIndex];
  let tt = time;
  if (a.length > 0) {
    tt = f(time % a.length);
    if (tt < 0) tt = f(tt + a.length);
  }

  const local = [];
  for (let b = 0; b < model.bones.length; b++) {
    let pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1];
    for (let i = 0; i < a.trackCount; i++) {
      const tr = tables.tracks[a.firstTrack + i];
      if (tr.bone !== b) continue;
      const v = sampleVec3(tr, tables.keys, tt);
      if (!v) continue;
      if (tr.chan === 0) pos = v;
      else if (tr.chan === 1) rot = v;
      else if (tr.chan === 2) scl = v;
    }
    const pv = model.bones[b].pivot;
    let M = f32_translate(pos[0], pos[1], pos[2]);
    M = f32_mul(M, f32_translate(pv[0], pv[1], pv[2]));
    M = f32_mul(M, f32_rot_z(rot[2]));
    M = f32_mul(M, f32_rot_y(rot[1]));
    M = f32_mul(M, f32_rot_x(rot[0]));
    M = f32_mul(M, f32_scale(scl[0], scl[1], scl[2]));
    M = f32_mul(M, f32_translate(-pv[0], -pv[1], -pv[2]));
    local[b] = M;
  }

  const world = [];
  for (let b = 0; b < model.bones.length; b++) {
    const p = model.bones[b].parent;
    world[b] = p >= 0 ? f32_mul(world[p], local[b]) : local[b];
  }

  // The model faces -Z, so add 180 degrees.
  const R = f32_mul(f32_rot_x(pitch), f32_rot_y(f(yaw + 180)));
  const cv = f32_point(R, focus);

  const view = [];
  const shift = f32_translate(f(-cv[0]), f(-cv[1]), f(-cv[2]));
  for (let b = 0; b < model.bones.length; b++) {
    view[b] = f32_mul(shift, f32_mul(R, world[b]));
  }
  return view;
}

/* ------------------------------------------------------------------ */
/* shading lookup tables, matching lut_build()                         */
/* ------------------------------------------------------------------ */

function buildLut() {
  const lutR = [], lutG = [], lutB = [];
  for (let l = 0; l < SHADE_LEVELS; l++) {
    const fac = f(l / (SHADE_LEVELS - 1));
    const r = new Int16Array(32), g = new Int16Array(64), b = new Int16Array(32);
    for (let i = 0; i < 32; i++) r[i] = Math.trunc(f(f(i * fac) + 0.5));
    for (let i = 0; i < 64; i++) g[i] = Math.trunc(f(f(i * fac) + 0.5));
    for (let i = 0; i < 32; i++) b[i] = Math.trunc(f(f(i * fac) + 0.5));
    lutR.push(r); lutG.push(g); lutB.push(b);
  }
  return { lutR, lutG, lutB };
}

const LUT = buildLut();

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */

export function rgb565TexFromRGBA(rgba) {
  const t = new Uint16Array(rgba.length / 4);
  for (let i = 0; i < t.length; i++) {
    if (rgba[i * 4 + 3] === 0) t[i] = 0xf81f;
    else t[i] = ((rgba[i * 4] >> 3) << 11) | ((rgba[i * 4 + 1] >> 2) << 5) | (rgba[i * 4 + 2] >> 3);
  }
  return t;
}

export function modelBounds(tables) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const v of tables.verts) {
    for (let a = 0; a < 3; a++) {
      if (v[a] < mn[a]) mn[a] = v[a];
      if (v[a] > mx[a]) mx[a] = v[a];
    }
  }
  const focus = [0, 1, 2].map((a) => f((mn[a] + mx[a]) * 0.5));
  let r2 = 0;
  for (const v of tables.verts) {
    const dx = f(v[0] - focus[0]), dy = f(v[1] - focus[1]), dz = f(v[2] - focus[2]);
    const d = f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz));
    if (d > r2) r2 = d;
  }
  const radius = f(Math.sqrt(r2));
  return { focus, radius };
}

export function renderFirmware(model, tables, opts) {
  const { width = 466, height = 466, anim = 0, time = 0, yaw = 0, pitch = 12, breedRGBA } = opts;

  const { focus, radius } = modelBounds(tables);
  const m = Math.min(width, height);
  const scale = f(f(f(f(m) * f(0.5) * f(0.94)) / (radius > 0.01 ? radius : 1)));

  const view = boneViewMatrices(model, tables, anim, time, yaw, pitch, focus);
  const halfW = f(f(width) * f(0.5));
  const halfH = f(f(height) * f(0.5));

  const N = tables.verts.length;
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  for (const pt of tables.parts) {
    const M = view[pt.bone];
    for (let k = 0; k < pt.vtxCount; k++) {
      const vi = pt.firstVtx + k;
      const v = tables.verts[vi];
      const p = f32_point(M, v);
      vx[vi] = f(halfW + f(p[0] * scale));
      vy[vi] = f(halfH - f(p[1] * scale));
      vz[vi] = p[2];
    }
  }

  const LIGHT = [f(0.35), f(0.62), f(0.70)];
  {
    const n = f(Math.sqrt(f(f(f(LIGHT[0] * LIGHT[0]) + f(LIGHT[1] * LIGHT[1])) + f(LIGHT[2] * LIGHT[2]))));
    LIGHT[0] = f(LIGHT[0] / n); LIGHT[1] = f(LIGHT[1] / n); LIGHT[2] = f(LIGHT[2] / n);
  }

  const items = [];
  for (let fi = 0; fi < tables.faces.length; fi++) {
    const fc = tables.faces[fi];
    const [i0, i1, i2, i3] = fc.idx;
    const ax = vx[i0], ay = vy[i0], bx = vx[i1], by = vy[i1], cx = vx[i2], cy = vy[i2];

    const area = f(f(f(bx - ax) * f(cy - ay)) - f(f(cx - ax) * f(by - ay)));
    if (area >= 0) continue;

    const minx = Math.min(ax, bx, cx, vx[i3]), maxx = Math.max(ax, bx, cx, vx[i3]);
    const miny = Math.min(ay, by, cy, vy[i3]), maxy = Math.max(ay, by, cy, vy[i3]);
    if (maxx < 0 || maxy < 0 || minx > width - 1 || miny > height - 1) continue;

    const e1x = f(vx[i1] - vx[i0]), e1y = f(vy[i1] - vy[i0]), e1z = f(vz[i1] - vz[i0]);
    const e2x = f(vx[i2] - vx[i0]), e2y = f(vy[i2] - vy[i0]), e2z = f(vz[i2] - vz[i0]);
    let nx = f(f(e1y * e2z) - f(e1z * e2y));
    let ny = f(f(e1z * e2x) - f(e1x * e2z));
    let nz = f(f(e1x * e2y) - f(e1y * e2x));
    const nl = f(Math.sqrt(f(f(f(nx * nx) + f(ny * ny)) + f(nz * nz))));
    if (nl < 1e-12) continue;
    nx = f(nx / nl); ny = f(ny / nl); nz = f(nz / nl);
    if (nz < 0) { nx = f(-nx); ny = f(-ny); nz = f(-nz); }

    let lam = f(f(f(f(nx * LIGHT[0]) + f(ny * LIGHT[1])) + f(nz * LIGHT[2])));
    if (lam < 0) lam = 0;
    const shade_f = f(f(0.55) + f(f(0.45) * lam));
    let shade = Math.trunc(f(f(shade_f * f(SHADE_LEVELS - 1)) + f(0.5)));
    if (shade < 0) shade = 0;
    if (shade > SHADE_LEVELS - 1) shade = SHADE_LEVELS - 1;

    const depth = f(f(f(f(vz[i0] + vz[i1]) + f(vz[i2] + vz[i3])) * f(0.25)));
    items.push({ fi, shade, depth });
  }

  items.sort((a, b) => (a.depth < b.depth ? -1 : a.depth > b.depth ? 1 : 0));

  // Background gradient, matching bg_rebuild().
  const out = new Uint16Array(width * height);
  const rowColor = new Uint16Array(height);
  {
    const bgTop = 0xefbe, bgBottom = 0xe79d;
    const r0 = (bgTop >> 11) & 31, g0 = (bgTop >> 5) & 63, b0 = bgTop & 31;
    const r1 = (bgBottom >> 11) & 31, g1 = (bgBottom >> 5) & 63, b1 = bgBottom & 31;
    const n = height > 1 ? height - 1 : 1;
    for (let y = 0; y < height; y++) {
      const r = r0 + Math.trunc(((r1 - r0) * y) / n);
      const g = g0 + Math.trunc(((g1 - g0) * y) / n);
      const b = b0 + Math.trunc(((b1 - b0) * y) / n);
      rowColor[y] = (r << 11) | (g << 5) | b;
    }
  }
  for (let y = 0; y < height; y++) out.fill(rowColor[y], y * width, (y + 1) * width);

  const W = model.texture.width, H = model.texture.height;
  const tex = breedRGBA ? rgb565TexFromRGBA(breedRGBA) : null;

  let pixels = 0;
  if (tex) {
    for (const it of items) {
      const fc = tables.faces[it.fi];
      const lr = LUT.lutR[it.shade], lg = LUT.lutG[it.shade], lb = LUT.lutB[it.shade];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        const P = tri.map((i) => [vx[fc.idx[i]], vy[fc.idx[i]]]);
        const UV = tri.map((i) => fc.uv[i]);
        pixels += rasterTri(out, width, height, P, UV, tex, W, H, lr, lg, lb);
      }
    }
  }
  return { out, pixels, faces: items.length, focus, radius, scale, items };
}

function rasterTri(out, width, height, P, UV, tex, W, H, lr, lg, lb) {
  const order = [0, 1, 2].sort((a, b) => P[a][1] - P[b][1]);
  const x = order.map((i) => f(P[i][0]));
  const y = order.map((i) => f(P[i][1]));
  const u = order.map((i) => f(UV[i][0]));
  const v = order.map((i) => f(UV[i][1]));

  const denom = f(f(f(y[1] - y[2]) * f(x[0] - x[2])) + f(f(x[2] - x[1]) * f(y[0] - y[2])));
  if (Math.abs(denom) < 1e-9) return 0;
  const inv = f(f(1.0) / denom);

  const dudx = f(f(f(f(f(y[1] - y[2]) * u[0]) + f(f(y[2] - y[0]) * u[1])) + f(f(y[0] - y[1]) * u[2])) * inv);
  const dudy = f(f(f(f(f(x[2] - x[1]) * u[0]) + f(f(x[0] - x[2]) * u[1])) + f(f(x[1] - x[0]) * u[2])) * inv);
  const dvdx = f(f(f(f(f(y[1] - y[2]) * v[0]) + f(f(y[2] - y[0]) * v[1])) + f(f(y[0] - y[1]) * v[2])) * inv);
  const dvdy = f(f(f(f(f(x[2] - x[1]) * v[0]) + f(f(x[0] - x[2]) * v[1])) + f(f(x[1] - x[0]) * v[2])) * inv);

  let y0 = Math.ceil(f(y[0] - 0.5)), y1 = Math.floor(f(y[2] - 0.5));
  if (y0 < 0) y0 = 0;
  if (y1 > height - 1) y1 = height - 1;
  if (y0 > y1) return 0;

  const has01 = Math.abs(f(y[1] - y[0])) > 1e-6;
  const has02 = Math.abs(f(y[2] - y[0])) > 1e-6;
  const has12 = Math.abs(f(y[2] - y[1])) > 1e-6;
  const m01 = has01 ? f(f(x[1] - x[0]) / f(y[1] - y[0])) : 0;
  const m02 = has02 ? f(f(x[2] - x[0]) / f(y[2] - y[0])) : 0;
  const m12 = has12 ? f(f(x[2] - x[1]) / f(y[2] - y[1])) : 0;

  let painted = 0;
  for (let py = y0; py <= y1; py++) {
    const fy = f(py + 0.5);
    let xa, xb;
    if (fy < y[1]) {
      xa = has01 ? f(x[0] + f(m01 * f(fy - y[0]))) : x[0];
      xb = has02 ? f(x[0] + f(m02 * f(fy - y[0]))) : x[0];
    } else {
      xa = has12 ? f(x[1] + f(m12 * f(fy - y[1]))) : x[1];
      xb = has02 ? f(x[0] + f(m02 * f(fy - y[0]))) : x[0];
    }
    if (xa > xb) { const t = xa; xa = xb; xb = t; }

    let px0 = Math.ceil(f(xa - 0.5)), px1 = Math.floor(f(xb - 0.5));
    if (px0 < 0) px0 = 0;
    if (px1 > width - 1) px1 = width - 1;
    if (px0 > px1) continue;

    const dxs = f(f(px0 + 0.5) - x[0]);
    const dys = f(fy - y[0]);
    let fu = f(f(u[0] + f(dudx * dxs)) + f(dudy * dys));
    let fv = f(f(v[0] + f(dvdx * dxs)) + f(dvdy * dys));

    let uq = Math.trunc(f(fu * 65536));
    let vq = Math.trunc(f(fv * 65536));
    const duq = Math.trunc(f(dudx * 65536));
    const dvq = Math.trunc(f(dvdx * 65536));

    for (let px = px0; px <= px1; px++) {
      const tx = uq >> 16;
      const ty = vq >> 16;
      uq = (uq + duq) | 0;
      vq = (vq + dvq) | 0;
      if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
      const texel = tex[ty * W + tx];
      if (texel === 0xf81f) continue;
      out[py * width + px] = (lr[(texel >> 11) & 31] << 11) | (lg[(texel >> 5) & 63] << 5) | lb[texel & 31];
      painted++;
    }
  }
  return painted;
}
