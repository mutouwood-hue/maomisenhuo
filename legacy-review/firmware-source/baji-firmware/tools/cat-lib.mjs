// Shared library: parse a Blockbench .bbmodel into a flat, renderable form.
// This is the REFERENCE implementation; the firmware C code mirrors it 1:1.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

/*
 * Repo-root resolution. Every tool derives its inputs from here so that nothing
 * hard-codes an absolute path -- the workspace directory has non-ASCII characters,
 * and embedding those in scripts has already caused one encoding accident.
 */
export const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
export const refPath = (...p) => path.join(REPO_ROOT, '_ref', ...p);
export const dataPath = (...p) => path.join(REPO_ROOT, 'components', 'cat3d', 'data', ...p);
export const CAT_MODEL_BBMODEL = refPath('pixel-cat.bbmodel');

/* ------------------------------------------------------------------ */
/* PNG (decode RGBA8, encode RGB8)                                     */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Decode a PNG buffer into { width, height, data: Uint8Array RGBA } */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  const idat = [];
  let plte = null;
  let trns = null;

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString('latin1');
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('only 8-bit PNG supported, got ' + bitDepth);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unsupported color type ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(height * stride);
  let prev = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.slice(p, p + stride);
    p += stride;
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
        default: throw new Error('bad filter ' + filter);
      }
      out[i] = v;
    }
    prev = out;
  }

  // Expand to RGBA
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r, g, b, a = 255;
    if (colorType === 6) {
      r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3];
    } else if (colorType === 2) {
      r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2];
    } else if (colorType === 0) {
      r = g = b = px[i];
    } else if (colorType === 4) {
      r = g = b = px[i * 2]; a = px[i * 2 + 1];
    } else {
      const idx = px[i];
      r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
      if (trns && idx < trns.length) a = trns[idx];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { width, height, data: rgba };
}

/** Encode an RGBA Uint8Array as a PNG buffer (writes as RGBA). */
export function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Minimal mat4 (column-major like OpenGL, m[col*4+row])               */
/* ------------------------------------------------------------------ */

export const m4 = {
  ident: () => new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a, b) {
    const o = new Float64Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  translate(x, y, z) {
    const o = m4.ident(); o[12] = x; o[13] = y; o[14] = z; return o;
  },
  scale(x, y, z) {
    const o = m4.ident(); o[0] = x; o[5] = y; o[10] = z; return o;
  },
  rotX(d) { const r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); const o = m4.ident(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY(d) { const r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); const o = m4.ident(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  rotZ(d) { const r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); const o = m4.ident(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  /** Apply to a point (w = 1) */
  xform(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
    ];
  },
};

/* ------------------------------------------------------------------ */
/* Model parsing                                                       */
/* ------------------------------------------------------------------ */

/** Blockbench cube face -> outward normal, and the UV->corner mapping. */
const FACE_DEFS = ['north', 'south', 'east', 'west', 'up', 'down'];

/**
 * Corners of a box, in CCW order seen from OUTSIDE, together with the
 * normalized position inside the face's UV rect (su, sv) for each corner.
 */
function faceCorners(face, x0, y0, z0, x1, y1, z1) {
  switch (face) {
    // -Z : u -> +X, v -> -Y ; rect top-left = (x0, y1)
    case 'north': return [
      [[x1, y1, z0], 1, 0], [[x0, y1, z0], 0, 0],
      [[x0, y0, z0], 0, 1], [[x1, y0, z0], 1, 1]];
    // +Z : u -> -X, v -> -Y ; rect top-left = (x1, y1)
    case 'south': return [
      [[x0, y1, z1], 1, 0], [[x1, y1, z1], 0, 0],
      [[x1, y0, z1], 0, 1], [[x0, y0, z1], 1, 1]];
    // +X : u -> -Z, v -> -Y ; rect top-left = (z1, y1)
    case 'east': return [
      [[x1, y1, z1], 1, 0], [[x1, y1, z0], 0, 0],
      [[x1, y0, z0], 0, 1], [[x1, y0, z1], 1, 1]];
    // -X : u -> +Z, v -> -Y ; rect top-left = (z0, y1)
    case 'west': return [
      [[x0, y1, z0], 1, 0], [[x0, y1, z1], 0, 0],
      [[x0, y0, z1], 0, 1], [[x0, y0, z0], 1, 1]];
    // +Y : u -> +X, v -> +Z ; rect top-left = (x0, z0)
    case 'up': return [
      [[x0, y1, z0], 0, 0], [[x1, y1, z0], 1, 0],
      [[x1, y1, z1], 1, 1], [[x0, y1, z1], 0, 1]];
    // -Y : u -> +X, v -> -Z ; rect top-left = (x0, z1)
    case 'down': return [
      [[x0, y0, z1], 0, 0], [[x1, y0, z1], 1, 0],
      [[x1, y0, z0], 1, 1], [[x0, y0, z0], 0, 1]];
    default: throw new Error('bad face ' + face);
  }
}

/** Outward normal of each face, for backface culling and shading. */
export const FACE_NORMALS = {
  north: [0, 0, -1], south: [0, 0, 1],
  east: [1, 0, 0], west: [-1, 0, 0],
  up: [0, 1, 0], down: [0, -1, 0],
};

/**
 * Parse a .bbmodel into { bones, elements, faces, texture, animations }.
 * Geometry is emitted in *model space* with per-element static rotation baked in.
 */
export function loadModel(path) {
  const m = JSON.parse(fs.readFileSync(path, 'utf8'));
  const byUuid = new Map();
  for (const el of m.elements) byUuid.set(el.uuid, { kind: 'element', el });

  const groups = new Map();
  for (const g of m.groups) groups.set(g.uuid, g);

  // Walk the outliner to derive parent links and element ownership.
  const bones = [];
  const boneIndex = new Map();
  let order = 0;

  function addBone(g, parent) {
    const idx = bones.length;
    bones.push({
      idx,
      uuid: g.uuid,
      name: g.name,
      parent,
      pivot: g.origin ? [...g.origin] : [0, 0, 0],
      children: [],
    });
    boneIndex.set(g.uuid, idx);
    if (parent >= 0) bones[parent].children.push(idx);
    return idx;
  }

  const elementOwner = new Map();
  const flat = [];

  function walk(node, parentBone) {
    if (typeof node === 'string') {
      const e = byUuid.get(node);
      if (e) {
        elementOwner.set(node, parentBone);
        flat.push(e.el);
      }
      return;
    }
    const g = groups.get(node.uuid);
    if (!g) return;
    const idx = addBone(g, parentBone);
    for (const c of node.children ?? []) walk(c, idx);
  }

  // Synthesise a single root bone if the outliner has several top-level nodes.
  if (m.outliner.length > 1) {
    const rootIdx = addBone({ uuid: '__root__', name: 'root', origin: [0, 0, 0] }, -1);
    for (const n of m.outliner) walk(n, rootIdx);
  } else {
    for (const n of m.outliner) walk(n, -1);
  }

  // Emit faces
  const faces = [];
  const elementsOut = [];
  for (const el of flat) {
    const bone = elementOwner.get(el.uuid) ?? 0;
    const [x0, y0, z0] = el.from;
    const [x1, y1, z1] = el.to;
    const origin = el.origin ?? [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const rot = el.rotation ?? [0, 0, 0];
    const inflate = el.inflate ?? 0;

    const R =
      rot[0] || rot[1] || rot[2]
        ? m4.mul(m4.rotZ(rot[2]), m4.mul(m4.rotY(rot[1]), m4.rotX(rot[0])))
        : null;

    const a0 = x0 - inflate, b0 = y0 - inflate, c0 = z0 - inflate;
    const a1 = x1 + inflate, b1 = y1 + inflate, c1 = z1 + inflate;

    const place = (p) => {
      if (!R) return p;
      const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
      const r = m4.xform(R, d);
      return [r[0] + origin[0], r[1] + origin[1], r[2] + origin[2]];
    };

    const elFaces = [];
    for (const fname of FACE_DEFS) {
      const f = (el.faces ?? {})[fname];
      if (!f) continue;
      const uv = f.uv;
      if (!uv) continue;
      const u1 = Math.min(uv[0], uv[2]);
      const v1 = Math.min(uv[1], uv[3]);
      const u2 = Math.max(uv[0], uv[2]);
      const v2 = Math.max(uv[1], uv[3]);
      const corners = faceCorners(fname, a0, b0, c0, a1, b1, c1);
      const rec = {
        element: el.name,
        bone,
        face: fname,
        normal: FACE_NORMALS[fname],
        pos: corners.map((c) => place(c[0])),
        uv: corners.map((c) => [u1 + c[1] * (u2 - u1), v1 + c[2] * (v2 - v1)]),
        uvRect: [u1, v1, u2, v2],
      };
      faces.push(rec);
      elFaces.push(rec);
    }
    elementsOut.push({
      name: el.name,
      bone,
      boneName: bones[bone]?.name ?? '?',
      faces: elFaces,
      from: [x0, y0, z0],
      to: [x1, y1, z1],
    });
  }

  // Texture
  const texEntry = m.textures[0];
  const b64 = texEntry.source.split(',')[1];
  const tex = decodePNG(Buffer.from(b64, 'base64'));

  return { bones, elements: elementsOut, faces, texture: tex, animations: m.animations, raw: m, resolution: m.resolution };
}

/* ------------------------------------------------------------------ */
/* Animation sampling                                                  */
/* ------------------------------------------------------------------ */

function sampleChannel(keyframes, t) {
  if (!keyframes || keyframes.length === 0) return null;
  if (t <= keyframes[0].time) return keyframes[0].v;
  if (t >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].v;
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].time < t) i++;
  const a = keyframes[i];
  const b = keyframes[i + 1];
  const span = b.time - a.time;
  const f = span > 0 ? (t - a.time) / span : 0;
  // Blockbench "linear" interpolation between keyframe values.
  return [
    a.v[0] + (b.v[0] - a.v[0]) * f,
    a.v[1] + (b.v[1] - a.v[1]) * f,
    a.v[2] + (b.v[2] - a.v[2]) * f,
  ];
}

/** Pre-digest an animation into per-bone channel keyframe lists. */
export function prepareAnimation(model, animName) {
  const anim = model.animations.find((a) => a.name === animName);
  if (!anim) throw new Error('no animation ' + animName);
  const out = new Map(); // boneIdx -> { position, rotation, scale }
  for (const [uuid, a] of Object.entries(anim.animators ?? {})) {
    const bi = model.bones.findIndex((b) => b.uuid === uuid);
    if (bi < 0) continue;
    const chans = {};
    for (const ch of ['position', 'rotation', 'scale']) {
      const kfs = (a.keyframes ?? [])
        .filter((k) => k.channel === ch)
        .sort((p, q) => p.time - q.time)
        .map((k) => ({ time: k.time, v: k.data_points.map((d) => Number(d.x ?? d[0])).length === 3
          ? [Number(k.data_points[0].x), Number(k.data_points[0].y), Number(k.data_points[0].z)]
          : [Number(k.data_points[0].x ?? 0), Number(k.data_points[0].y ?? 0), Number(k.data_points[0].z ?? 0)] }));
      if (kfs.length) chans[ch] = kfs;
    }
    out.set(bi, chans);
  }
  return { name: animName, length: anim.length, loop: anim.loop, tracks: out };
}

/**
 * Bone world matrices at time t.
 * Matches Blockbench: M = T(pos) * T(pivot) * R * S * T(-pivot), composed with parent.
 */
export function boneMatrices(model, anim, t) {
  const local = new Array(model.bones.length);
  for (let i = 0; i < model.bones.length; i++) {
    const b = model.bones[i];
    const tr = anim.tracks.get(i);
    let pos = [0, 0, 0];
    let rot = [0, 0, 0];
    let scl = [1, 1, 1];
    if (tr) {
      if (tr.position) pos = sampleChannel(tr.position, t) ?? pos;
      if (tr.rotation) rot = sampleChannel(tr.rotation, t) ?? rot;
      if (tr.scale) scl = sampleChannel(tr.scale, t) ?? scl;
    }
    let M = m4.ident();
    M = m4.mul(M, m4.translate(pos[0], pos[1], pos[2]));
    M = m4.mul(M, m4.translate(b.pivot[0], b.pivot[1], b.pivot[2]));
    M = m4.mul(M, m4.rotZ(rot[2]));
    M = m4.mul(M, m4.rotY(rot[1]));
    M = m4.mul(M, m4.rotX(rot[0]));
    M = m4.mul(M, m4.scale(scl[0], scl[1], scl[2]));
    M = m4.mul(M, m4.translate(-b.pivot[0], -b.pivot[1], -b.pivot[2]));
    local[i] = M;
  }
  const world = new Array(model.bones.length);
  for (let i = 0; i < model.bones.length; i++) {
    const p = model.bones[i].parent;
    world[i] = p >= 0 ? m4.mul(world[p], local[i]) : local[i];
  }
  return world;
}
