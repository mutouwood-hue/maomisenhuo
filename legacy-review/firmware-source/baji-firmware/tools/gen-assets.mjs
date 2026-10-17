// Generate firmware assets from the Blockbench model:
//   components/cat3d/data/cat_model.h      geometry + skeleton + animation keyframes
//   components/cat3d/data/tex_<breed>.bin  six 256x256 RGB565LE textures (raw recolor output)
//   _ref/cat_model.json                    same data as JSON, for the host-side CPU reference
//
// Usage: node tools/gen-assets.mjs [--model path] [--out components/cat3d/data] [--ref _ref]

import fs from 'node:fs';
import path from 'node:path';
import { loadModel, REPO_ROOT, CAT_MODEL_BBMODEL, dataPath } from './cat-lib.mjs';
import { recolorBreed, BREEDS } from './render-cat.mjs';

const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};

const MODEL = get('model', CAT_MODEL_BBMODEL);
const OUT = get('out', dataPath());
const REF = get('ref', path.join(REPO_ROOT, '_ref'));

const BREED_ORDER = ['orange', 'silver', 'tuxedo', 'siamese', 'ragdoll', 'blue'];

/* ---------------- load ---------------- */

const model = loadModel(MODEL);
const W = model.texture.width;
const H = model.texture.height;

console.log(`model: ${model.bones.length} bones, ${model.elements.length} parts, ${model.faces.length} faces, texture ${W}x${H}`);

/* ---------------- vertices ---------------- */

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REF, { recursive: true });

const verts = [];          // flat list of [x,y,z]
const parts = [];          // { name, bone, firstVtx, vtxCount, firstFace, faceCount, boundMin, boundMax }
const faces = [];          // { tex, idx[4], uv[4][2], part }

const EPS = 1e-4;
const key = (p) => `${Math.round(p[0] / EPS)}|${Math.round(p[1] / EPS)}|${Math.round(p[2] / EPS)}`;

let badKeyframes = 0;

for (const el of model.elements) {
  const localIndex = new Map();
  const localVerts = [];
  const firstVtx = verts.length;
  const firstFace = faces.length;

  for (const f of el.faces) {
    const idx = [];
    for (let i = 0; i < 4; i++) {
      const p = f.pos[i];
      const k = key(p);
      let li = localIndex.get(k);
      if (li === undefined) {
        li = localVerts.length;
        localIndex.set(k, li);
        localVerts.push(p);
      }
      // Global index: the renderer addresses cat_verts[] directly.
      idx.push(li + firstVtx);
    }
    faces.push({ tex: 0, idx, uv: f.uv, part: parts.length, face: f.face, element: el.name });
  }

  for (const p of localVerts) verts.push(p);

  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  for (const p of localVerts) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < bmin[a]) bmin[a] = p[a];
      if (p[a] > bmax[a]) bmax[a] = p[a];
    }
  }

  parts.push({
    name: el.name,
    bone: el.bone,
    firstVtx,
    vtxCount: localVerts.length,
    firstFace,
    faceCount: faces.length - firstFace,
    boundMin: bmin,
    boundMax: bmax,
  });
}

/* ---------------- animation tracks ---------------- */

const CHAN = { position: 0, rotation: 1, scale: 2 };
const keys = [];
const tracks = [];
const anims = [];

for (const a of model.animations) {
  const firstTrack = tracks.length;
  for (const [uuid, anim] of Object.entries(a.animators ?? {})) {
    const bone = model.bones.findIndex((b) => b.uuid === uuid);
    if (bone < 0) {
      console.warn(`  ! animator for unknown bone uuid ${uuid} (${anim.name})`);
      continue;
    }
    for (const chName of ['position', 'rotation', 'scale']) {
      const kfs = (anim.keyframes ?? []).filter((k) => k.channel === chName).sort((p, q) => p.time - q.time);
      if (!kfs.length) continue;
      const first = keys.length;
      for (const k of kfs) {
        if (k.data_points.length !== 1) {
          badKeyframes++;
          console.warn(`  ! ${a.name}/${anim.name}/${chName}@${k.time}: ${k.data_points.length} data points`);
        }
        const d = k.data_points[0];
        keys.push({ t: k.time, v: [Number(d.x), Number(d.y), Number(d.z)] });
      }
      tracks.push({ bone, chan: CHAN[chName], first, count: kfs.length, name: anim.name, channel: chName });
    }
  }
  anims.push({ name: a.name, length: a.length, loop: a.loop === 'loop' || a.loop === true ? 1 : 0, firstTrack, trackCount: tracks.length - firstTrack });
  console.log(`anim ${a.name}: length=${a.length} loop=${a.loop} tracks=${tracks.length - firstTrack} keys=${keys.length}`);
}

/* ---------------- textures ---------------- */

function toRGB565LE(rgba) {
  const out = Buffer.alloc(W * H * 2);
  for (let i = 0; i < W * H; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    let v;
    if (a === 0) {
      // fully transparent texels become magenta in RGB565 (debug marker)
      v = 0xf81f;
    } else {
      v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
    }
    out.writeUInt16LE(v, i * 2);
  }
  return out;
}

const texInfo = [];
for (const breed of BREED_ORDER) {
  const rgba = breed === 'orange' ? model.texture.data : recolorBreed(model, breed);
  const bin = toRGB565LE(rgba);
  const p = path.join(OUT, `tex_${breed}.bin`);
  fs.writeFileSync(p, bin);
  texInfo.push({ breed, file: `tex_${breed}.bin`, bytes: bin.length });
  console.log(`texture ${breed.padEnd(8)} -> ${p} (${bin.length} bytes)`);
}

/* ---------------- C header ---------------- */

const f = (x) => {
  const v = Number(x);
  if (Number.isInteger(v)) return v + '.0f';
  return v.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0') + 'f';
};

const L = [];
const p = (s = '') => L.push(s);

p('// AUTO-GENERATED by tools/gen-assets.mjs -- do not edit by hand.');
p('// Source model: pixel-cat.bbmodel (Blockbench 5.0, generic model / free).');
p('#pragma once');
p('#include <stdint.h>');
p();
p(`#define CAT_TEX_W ${W}`);
p(`#define CAT_TEX_H ${H}`);
p(`#define CAT_TEX_BYTES ${W * H * 2}`);
p(`#define CAT_BONE_COUNT ${model.bones.length}`);
p(`#define CAT_PART_COUNT ${parts.length}`);
p(`#define CAT_VERT_COUNT ${verts.length}`);
p(`#define CAT_FACE_COUNT ${faces.length}`);
p(`#define CAT_ANIM_COUNT ${anims.length}`);
p(`#define CAT_KEY_COUNT ${keys.length}`);
p(`#define CAT_TRACK_COUNT ${tracks.length}`);
p();
p('typedef struct { float x, y, z; } cat_vec3_t;');
p();
p('typedef struct {');
p('    int8_t   parent;      // index into cat_bones, -1 for root');
p('    uint8_t  reserved[3];');
p('    float    pivot[3];    // model-space rotation pivot');
p('} cat_bone_t;');
p();
p('typedef struct {');
p('    uint8_t  bone;        // owning bone index');
p('    uint8_t  vtx_count;   // number of corners in this part');
p('    uint8_t  face_count;  // number of quads in this part');
p('    uint8_t  reserved;');
p('    uint16_t first_vtx;   // index into cat_verts');
p('    uint16_t first_face;  // index into cat_faces');
p('    float    bound_min[3];  // model-space AABB, for quick rejection');
p('    float    bound_max[3];');
p('} cat_part_t;');
p();
p('typedef struct {');
p('    uint8_t  tex;         // texture slot (0 = the active breed texture)');
p('    uint8_t  part;        // owning cat_parts index');
p('    uint8_t  reserved[2];');
p('    uint16_t idx[4];      // GLOBAL vertex indices into cat_verts');
p('    float    uv[4][2];    // texel coordinates, matching idx[]');
p('} cat_face_t;');
p();
p('typedef struct { float t; float v[3]; } cat_key_t;');
p();
p('typedef struct {');
p('    uint8_t  bone;        // target bone index');
p('    uint8_t  chan;        // 0 = position, 1 = rotation (deg), 2 = scale');
p('    uint16_t first;       // index into cat_keys');
p('    uint16_t count;');
p('} cat_track_t;');
p();
p('typedef struct {');
p('    float    length;      // seconds');
p('    uint8_t  loop;');
p('    uint8_t  first_track;');
p('    uint8_t  track_count;');
p('    uint8_t  reserved;');
p('} cat_anim_t;');
p();

p('// Bone name table, index-aligned with cat_bones (debug / tooling only).');
p('static const char *const cat_bone_names[CAT_BONE_COUNT] = {');
for (const b of model.bones) p(`    "${b.name}",   // ${b.idx}`);
p('};');
p();

p('static const cat_bone_t cat_bones[CAT_BONE_COUNT] = {');
for (const b of model.bones) {
  p(`    { ${String(b.parent).padStart(2)}, {0,0,0}, { ${f(b.pivot[0])}, ${f(b.pivot[1])}, ${f(b.pivot[2])} } },   // ${b.idx} ${b.name}`);
}
p('};');
p();

p(`// ${verts.length} box corners, in part-local blocks of cat_parts[].vtx_count.`);
p('static const cat_vec3_t cat_verts[CAT_VERT_COUNT] = {');
for (let i = 0; i < verts.length; i++) {
  const v = verts[i];
  p(`    { ${f(v[0])}, ${f(v[1])}, ${f(v[2])} },`);
}
p('};');
p();

p('static const cat_face_t cat_faces[CAT_FACE_COUNT] = {');
for (const fc of faces) {
  const idx = fc.idx.map((n) => String(n)).join(', ');
  const uv = fc.uv.map((u) => `{ ${f(u[0])}, ${f(u[1])} }`).join(', ');
  p(`    { 0, ${String(fc.part).padStart(2)}, {0,0}, { ${idx} }, { ${uv} } },   // ${fc.element}/${fc.face}`);
}
p('};');
p();

p('static const cat_part_t cat_parts[CAT_PART_COUNT] = {');
for (const pt of parts) {
  p(
    `    { ${String(pt.bone).padStart(2)}, ${String(pt.vtxCount).padStart(2)}, ${String(pt.faceCount).padStart(2)}, 0, ` +
      `${String(pt.firstVtx).padStart(3)}, ${String(pt.firstFace).padStart(3)}, ` +
      `{ ${f(pt.boundMin[0])}, ${f(pt.boundMin[1])}, ${f(pt.boundMin[2])} }, ` +
      `{ ${f(pt.boundMax[0])}, ${f(pt.boundMax[1])}, ${f(pt.boundMax[2])} } },   // ${pt.name}`,
  );
}
p('};');
p();

p('static const cat_key_t cat_keys[CAT_KEY_COUNT] = {');
for (const k of keys) {
  p(`    { ${f(k.t)}, { ${f(k.v[0])}, ${f(k.v[1])}, ${f(k.v[2])} } },`);
}
p('};');
p();

p('static const cat_track_t cat_tracks[CAT_TRACK_COUNT] = {');
for (const t of tracks) {
  p(`    { ${String(t.bone).padStart(2)}, ${t.chan}, ${String(t.first).padStart(4)}, ${String(t.count).padStart(3)} },   // ${t.name}/${t.channel}`);
}
p('};');
p();

p('static const cat_anim_t cat_anims[CAT_ANIM_COUNT] = {');
for (const a of anims) {
  p(`    { ${f(a.length)}, ${a.loop}, ${String(a.firstTrack).padStart(3)}, ${String(a.trackCount).padStart(2)}, 0 },   // ${a.name}`);
}
p('};');
p();

fs.writeFileSync(path.join(OUT, 'cat_model.h'), L.join('\n'), 'utf8');
console.log(`wrote ${path.join(OUT, 'cat_model.h')} (${L.length} lines)`);

/* ---------------- JSON reference ---------------- */

const json = {
  generator: 'tools/gen-assets.mjs',
  texW: W,
  texH: H,
  boneNames: model.bones.map((b) => b.name),
  bones: model.bones.map((b) => ({ parent: b.parent, pivot: b.pivot })),
  verts,
  parts: parts.map((pt) => ({ name: pt.name, bone: pt.bone, firstVtx: pt.firstVtx, vtxCount: pt.vtxCount, firstFace: pt.firstFace, faceCount: pt.faceCount, boundMin: pt.boundMin, boundMax: pt.boundMax })),
  faces: faces.map((fc) => ({ tex: fc.tex, idx: fc.idx, uv: fc.uv, part: fc.part })),
  keys,
  tracks,
  anims,
};
fs.writeFileSync(path.join(REF, 'cat_model.json'), JSON.stringify(json), 'utf8');
console.log(`wrote ${path.join(REF, 'cat_model.json')}`);

/* ---------------- summary ---------------- */

const totalKeys = keys.length;
console.log('');
console.log('=== summary ===');
console.log(`bones      ${model.bones.length}`);
console.log(`parts      ${parts.length}`);
console.log(`verts      ${verts.length}`);
console.log(`faces      ${faces.length}`);
console.log(`anims      ${anims.length} (${anims.map((a) => a.name).join(', ')})`);
console.log(`tracks     ${tracks.length}`);
console.log(`keys       ${totalKeys}`);
console.log(`badKeys    ${badKeyframes}`);
console.log(`header     ${(L.join('\n').length / 1024).toFixed(1)} KB`);
console.log(`textures   ${texInfo.length} x ${W * H * 2} B = ${(texInfo.length * W * H * 2 / 1024).toFixed(0)} KB`);
console.log(`breeds     ${Object.keys(BREEDS).join(', ')}`);
