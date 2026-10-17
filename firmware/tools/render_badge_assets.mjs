#!/usr/bin/env node
/** Offline original BadgeRenderer + PCAT extraction. No browser, GPU or remote code. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HTML = path.join(ROOT, '吧唧渲染参考V2照抄版.html');
const OUT = path.join(ROOT, 'assets/rendering/badge-v2');
const COUT = path.join(ROOT, 'firmware/main/assets');
const FULL = process.argv.includes('--full');
const roomArgIndex=process.argv.indexOf('--room');
requireFactArgument(roomArgIndex<0||process.argv[roomArgIndex+1]&&!process.argv[roomArgIndex+1].startsWith('--'), '--room requires a project-local PNG path');
const ROOM=roomArgIndex<0?null:path.resolve(ROOT,process.argv[roomArgIndex+1]);
function requireFactArgument(fact,message){if(!fact)throw new Error(message)}
const W = 192, H = 208, SCR = 466, ANCHOR = [96, 196];
const CAMERA = {yaw: -28, pitch: 14, distance: 90, ox: 0, oy: 24};
const CLIPS = [
  {id:'idle', animation:'idle', count:20, cycleMs:3200, loop:true, look:[0,0]},
  {id:'pet', animation:'paw', count:24, cycleMs:2400, loop:false, look:[0,0]},
  {id:'walk', animation:'walk', count:10, cycleMs:1000, loop:true, look:[0,0]},
  {id:'attention', animation:'idle', count:12, cycleMs:3200, loop:true, look:[-32,10]},
];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rel = name => path.relative(ROOT, name);
const requireFact = (fact, message) => {if(!fact) throw new Error(message)};
fs.mkdirSync(path.join(OUT, 'source'), {recursive:true});
fs.mkdirSync(path.join(OUT, 'samples'), {recursive:true});
fs.mkdirSync(COUT, {recursive:true});
const htmlBytes = fs.readFileSync(HTML), html = htmlBytes.toString('utf8');
requireFact(sha(htmlBytes) === '352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64', 'Frozen reference HTML changed; review its source first');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
requireFact(scripts.length === 6 && scripts[0].includes('class BadgeRenderer'), 'Original renderer script boundaries changed');
const original = scripts[0];
const encoded = scripts[1].match(/const\s+PCAT_B64\s*=\s*(['"])([A-Za-z0-9+/=\s]+)\1/);
requireFact(encoded, 'Original PCAT payload not found');
const pcat = Buffer.from(encoded[2].replace(/\s/g,''), 'base64');
requireFact(sha(pcat) === '82520ca7f00eb28f005795cc970746150d73075083d4032119d795d19c2d0b4e', 'PCAT differs from reviewed reference');
fs.writeFileSync(path.join(OUT,'source/badge-renderer.original.cjs'), original);
fs.writeFileSync(path.join(OUT,'source/pixel-cat.pcat'), pcat);

/** Instrument coverage only. Color, texture, geometry, lighting, projection and poses stay original. */
const patches = [
  ['this.fb=new Uint16Array(SCR*SCR);', 'this.fb=new Uint16Array(SCR*SCR);this.alpha=new Uint8Array(SCR*SCR);this.stripA=new Uint8Array(SCR*STRIP_H);'],
  ['C[row+x]=0;Zb[row+x]=0;', 'C[row+x]=0;Zb[row+x]=0;this.stripA[row+x]=0;'],
  ['C[zi]=c;Zb[zi]=z;st.written++;', 'C[zi]=c;Zb[zi]=z;this.stripA[zi]=255;st.written++;'],
  ['fb[fr+x]=C[row+x];', '{fb[fr+x]=C[row+x];this.alpha[fr+x]=this.stripA[row+x];}'],
];
let instrumented = original;
for(const [from,to] of patches) {
  requireFact(instrumented.split(from).length === 2, 'Review original renderer before coverage patch: '+from);
  instrumented = instrumented.replace(from,to);
}
fs.writeFileSync(path.join(OUT,'source/badge-renderer.coverage.cjs'), instrumented);
function moduleFrom(source) {
  // Source script 0 is verified to have no DOM, network or process dependency.
  const context = {module:{exports:{}}, TextDecoder};
  new vm.Script(source, {filename:'original-badge-renderer.cjs'}).runInNewContext(context, {timeout:10000});
  return context.module.exports;
}
const originalAPI = moduleFrom(original), API = moduleFrom(instrumented);
const asset = API.parsePCAT(new Uint8Array(pcat));
for(const clip of CLIPS) requireFact(asset.anims[clip.animation].len*1000 === clip.cycleMs, 'Animation duration no longer matches source');
const metadata = {
  source:rel(HTML), sourceSha256:sha(htmlBytes), originalScriptIndex:0, rendererSha256:sha(Buffer.from(original)),
  pcat:{file:'source/pixel-cat.pcat',bytes:pcat.length,sha256:sha(pcat),version:asset.ver,cubes:asset.cubes.length,bones:asset.bones.map(x=>x.name),
    animations:Object.fromEntries(Object.entries(asset.anims).map(([k,a])=>[k,{seconds:a.len,loop:a.loop,tracks:a.tracks.length}])),
    breeds:Object.keys(asset.texs),outfits:Object.keys(asset.outfits)},
  authorization:'User-provided local reference HTML/PCAT reused for this project; no new geometry, texture, AI image, remote service or invented asset license.',
  camera:CAMERA, material:{breed:'orange',outfit:'none',perspective:true,ground:false,halfResolution:false},
  frame:{width:W,height:H,anchor:ANCHOR,transparent:true},
  timingNote:'BadgeRenderer.pose expects seconds. Original controller supplies millisecond t; this exporter samples the original ANIM seconds and complete cycles, correcting that controller unit mismatch.',
  attentionNote:'Original controller stare cue look=[-32,10], added by original pose() to head; original idle skeletal animation continues. No synthetic eye/head pose authored.',
  alphaNote:'Coverage written at the original opaque fragment write, independent of RGB565 value; transparent texels never write coverage. Ground disabled for cutout. No chroma-key deletion of black eyes.',
  coveragePatches:patches, instrumentedRendererSha256:sha(Buffer.from(instrumented)),
  sceneNote:'Badge reference only supplies a black AMOLED background and optional flat ground disc, not the mobile room. room pointer remains NULL for root scene composition.',
};
function renderer(api, ground=false) {
  const r = new api.BadgeRenderer(api.parsePCAT(new Uint8Array(pcat)));
  Object.assign(r.opt,{half:false,persp:true,ground,breed:'orange',outfit:'none',ox:CAMERA.ox,oy:CAMERA.oy});
  r.camera(CAMERA.yaw,CAMERA.pitch,CAMERA.distance);
  return r;
}
const r = renderer(API), reference = renderer(originalAPI);
function render(clip,index,compare=false) {
  const seconds = index/clip.count*clip.cycleMs/1000;
  r.fb.fill(0);r.alpha.fill(0);r.prevDirty=null;
  r.pose(clip.animation,seconds,clip.look);const stats=r.frame();
  if(compare) {
    reference.fb.fill(0);reference.prevDirty=null;reference.pose(clip.animation,seconds,clip.look);reference.frame();
    requireFact(Buffer.from(reference.fb.buffer).equals(Buffer.from(r.fb.buffer)), 'Coverage instrumentation changed original RGB565 output');
  }
  return {clip:clip.id,index,seconds,colors:new Uint16Array(r.fb),alpha:new Uint8Array(r.alpha),stats};
}
function bounds(alpha,w,h) {
  let b=[w,h,-1,-1],coverage=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(alpha[y*w+x]) {b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];coverage++;}
  requireFact(coverage>0,'Empty rendered sprite');return {box:b,coverage};
}
// Calculate ONE shared transform across every real pose before exporting any frame.
const frames=[];let union=[SCR,SCR,-1,-1];
for(const clip of CLIPS) for(let i=0;i<clip.count;i++) {
  const f=render(clip,i, true), b=bounds(f.alpha,SCR,SCR).box;
  requireFact(b[0]>0&&b[1]>0&&b[2]<SCR-1&&b[3]<SCR-1,'Source pose clipped by reference viewport');
  union=[Math.min(union[0],b[0]),Math.min(union[1],b[1]),Math.max(union[2],b[2]),Math.max(union[3],b[3])];frames.push(f);
}
const scale=Math.min((W-16)/(union[2]-union[0]+1),(ANCHOR[1]-12)/(union[3]-union[1]+1));
const offsetX=ANCHOR[0]-(union[0]+union[2]+1)/2*scale, offsetY=ANCHOR[1]-(union[3]+1)*scale;
metadata.sharedTransform={sourceUnionBox:union,scale,offsetX,offsetY,resampling:'nearest-neighbor only',
  anchorMeaning:'Fixed common full-cycle floor/support bound mapped to (96,196); natural leg/body motion remains. No per-frame crop, re-centering or scaling.'};
function crop(f) {
  const colors=new Uint16Array(W*H),alpha=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const sx=Math.floor((x+.5-offsetX)/scale),sy=Math.floor((y+.5-offsetY)/scale);
    if(sx<0||sy<0||sx>=SCR||sy>=SCR)continue;
    const a=f.alpha[sy*SCR+sx]; if(a){colors[y*W+x]=f.colors[sy*SCR+sx];alpha[y*W+x]=a;}
  }
  const b=bounds(alpha,W,H);
  requireFact(b.box[0]>0&&b.box[1]>0&&b.box[2]<W-1&&b.box[3]<H-1,'Output sprite touches border');
  const colorSet=[...new Set([...colors].filter((_,i)=>alpha[i]>0))].sort((a,b)=>a-b);
  return {...f,colors,alpha,bounds:b.box,coverage:b.coverage,colorSet};
}
const cropped=frames.map(crop), maxColors=Math.max(...cropped.map(f=>f.colorSet.length));
const FORMAT=maxColors<=255?'I8':'RGB565A8';
requireFact(frames.length*(FORMAT==='I8'?W*H+1024:W*H*3)<=40*W*H*3,
  'Lossless format exceeds the approved original payload budget; review frame counts before export');
metadata.colorStatistics={maxCoveredRGB565Colors:maxColors,countsByClip:Object.fromEntries(CLIPS.map(c=>[c.id,cropped.filter(f=>f.clip===c.id).map(f=>f.colorSet.length)]))};
metadata.lvglFormat=FORMAT;

function rgba565(color) {const r=(color>>>11)&31,g=(color>>>5)&63,b=color&31;return [(r<<3)|(r>>>2),(g<<2)|(g>>>4),(b<<3)|(b>>>2)];}
function rgbaImage(f,w=W,h=H,opaque=false) {
  const rgba=Buffer.alloc(w*h*4);
  for(let i=0;i<w*h;i++){const rgb=rgba565(f.colors[i]);rgba[i*4]=rgb[0];rgba[i*4+1]=rgb[1];rgba[i*4+2]=rgb[2];rgba[i*4+3]=opaque?255:f.alpha[i];}
  return rgba;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function png(w,h,rgba) {
  const chunk=(type,data)=>{const t=Buffer.from(type),len=Buffer.alloc(4),tail=Buffer.alloc(4);len.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,tail])};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  const scan=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)rgba.copy(scan,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function encode(f) {
  if(FORMAT==='I8') {
    const data=Buffer.alloc(1024+W*H), index=new Map(f.colorSet.map((color,i)=>[color,i+1]));
    for(const [color,i] of index){const [red,green,blue]=rgba565(color);data.set([blue,green,red,255],i*4);}
    for(let i=0;i<W*H;i++)data[1024+i]=f.alpha[i]?index.get(f.colors[i]):0;
    for(let i=0;i<W*H;i++){
      const ix=data[1024+i],p=ix*4,back=((data[p+2]>>3)<<11)|((data[p+1]>>2)<<5)|(data[p]>>3);
      requireFact(data[p+3]===f.alpha[i]&&(!f.alpha[i]||back===f.colors[i]),'I8 decode is not pixel-identical to original RGB565 + alpha');
    }
    return data;
  }
  const data=Buffer.alloc(W*H*3);for(let i=0;i<W*H;i++){data.writeUInt16LE(f.colors[i],i*2);data[W*H*2+i]=f.alpha[i];}return data;
}
// Validate every planned frame even when only the three preview PNGs are written.
for(const f of cropped) encode(f);
const sampleFrames=[cropped.find(f=>f.clip==='idle'&&f.index===0),cropped.find(f=>f.clip==='pet'&&f.index===8),cropped.find(f=>f.clip==='attention'&&f.index===3)];
const sampleReport=[];
for(const f of sampleFrames){const name=`sample-${f.clip}.png`,bytes=png(W,H,rgbaImage(f)),encoded=encode(f);fs.writeFileSync(path.join(OUT,'samples',name),bytes);sampleReport.push({name,clip:f.clip,timeSeconds:f.seconds,opaquePixels:f.coverage,colors:f.colorSet.length,opaqueBlackPixels:[...f.colors].filter((v,i)=>f.alpha[i]&&v===0).length,bounds:f.bounds,pngSha256:sha(bytes),encodedBytes:encoded.length});}
// A contact sheet is a QA view, not a newly invented game background.
const sheet=Buffer.alloc(W*3*H*4);
for(let k=0;k<3;k++){const rgba=rgbaImage(sampleFrames[k]);for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const src=(y*W+x)*4,dst=(y*W*3+k*W+x)*4,checker=((x>>4)+(y>>4))%2?235:248;
  sheet.set(rgba[src+3]?rgba.subarray(src,src+4):[checker,checker,checker,255],dst);
}}
fs.writeFileSync(path.join(OUT,'samples/three-samples.png'),png(W*3,H,sheet));
// Original reference black background + its ground disc: explicitly not a room.
const scene=renderer(originalAPI,true);scene.pose('idle',0,[0,0]);scene.frame();
fs.writeFileSync(path.join(OUT,'samples/original-reference-scene.png'),png(SCR,SCR,rgbaImage({colors:scene.fb},SCR,SCR,true)));
metadata.samples=sampleReport;
metadata.plannedClips=CLIPS;
metadata.budget={frameCount:frames.length,encodedFrameBytes:FORMAT==='I8'?W*H+1024:W*H*3,totalPayloadBytes:frames.length*(FORMAT==='I8'?W*H+1024:W*H*3),original40FrameRGB565A8Budget:40*W*H*3};
metadata.verification={referenceFrameCount:frames.length,referenceRGB565Exact:true,alphaFromFragmentCoverage:true,allI8RoundTripsExact:FORMAT==='I8',allFramesBorderClear:true,noPerFrameAutoCrop:true};
metadata.runtimeCaveat='LVGL 9.5 software indexed decoder may expand one 192x208 I8 frame to ARGB8888 (159744 bytes) and cache it. Flash savings do not prove target decode speed, heap safety, animation FPS, or panel acceptance.';
metadata.stage=FULL?'full':'three-samples-awaiting-visual-review';

if(FULL) {
  fs.mkdirSync(path.join(OUT,'frames'),{recursive:true});fs.mkdirSync(path.join(OUT,'encoded'),{recursive:true});
  const records=[];
  for(const clip of CLIPS) {
    let c='/* Generated by firmware/tools/render_badge_assets.mjs. Original geometry/texture/poses. */\n#include "game_assets.h"\n';
    const list=cropped.filter(f=>f.clip===clip.id), unique=new Set();let previous=null;
    for(const f of list) {
      const id=`game_${clip.id}_${String(f.index).padStart(2,'0')}`,data=encode(f),image=png(W,H,rgbaImage(f));
      fs.writeFileSync(path.join(OUT,'frames',`${id}.png`),image);fs.writeFileSync(path.join(OUT,'encoded',`${id}.${FORMAT.toLowerCase()}`),data);
      const lines=[];for(let i=0;i<data.length;i+=20)lines.push('    '+[...data.subarray(i,i+20)].map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ')+',');
      c+=`\nstatic const LV_ATTRIBUTE_MEM_ALIGN uint8_t ${id}_data[] = {\n${lines.join('\n')}\n};\n`;
      c+=`const lv_image_dsc_t ${id} = {.header.magic=LV_IMAGE_HEADER_MAGIC,.header.cf=LV_COLOR_FORMAT_${FORMAT},.header.flags=0,.header.w=${W},.header.h=${H},.header.stride=${FORMAT==='I8'?W:W*2},.data_size=sizeof(${id}_data),.data=${id}_data};\n`;
      let changed=null;if(previous){changed=0;for(let i=0;i<W*H;i++)if(f.alpha[i]!==previous.alpha[i]||f.alpha[i]&&f.colors[i]!==previous.colors[i])changed++;}
      const hash=sha(Buffer.concat([Buffer.from(f.colors.buffer),Buffer.from(f.alpha)]));unique.add(hash);
      records.push({id,clip:clip.id,index:f.index,timeSeconds:f.seconds,bounds:f.bounds,coverage:f.coverage,colors:f.colorSet.length,raw565AlphaSha256:hash,pngSha256:sha(image),encodedSha256:sha(data),encodedBytes:data.length,changedPixelsFromPrevious:changed});previous=f;
    }
    requireFact(unique.size>1,`${clip.id} sequence is static`);fs.writeFileSync(path.join(COUT,`game_${clip.id}.c`),c);
    clip.uniqueFrames=unique.size;
  }
  let roomAvailable=false;
  if(ROOM&&fs.existsSync(ROOM)) {
    requireFact(ROOM.startsWith(ROOT+path.sep),'Room source must stay in this project');
    const roomRaw=path.join(OUT,'encoded/game_room.rgb565');
    const convert=spawnSync('python3',[path.join(ROOT,'firmware/tools/convert_badge_room.py'),ROOM,roomRaw],{encoding:'utf8'});
    requireFact(convert.status===0,'Room conversion failed: '+convert.stderr);
    const info=JSON.parse(convert.stdout),raw=fs.readFileSync(roomRaw);
    const roomMeta=path.join(path.dirname(ROOM),'provenance.json');
    metadata.room={...info,source:rel(ROOM),raw:rel(roomRaw),sourceProvenance:fs.existsSync(roomMeta)?{path:rel(roomMeta),sha256:sha(fs.readFileSync(roomMeta))}:null};
    const lines=[];for(let i=0;i<raw.length;i+=20)lines.push('    '+[...raw.subarray(i,i+20)].map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ')+',');
    fs.writeFileSync(path.join(COUT,'game_room.c'),`/* Generated from reviewed opaque mobile-room PNG; no synthetic cat or environment. */\n#include "game_assets.h"\n\nstatic const LV_ATTRIBUTE_MEM_ALIGN uint8_t game_room_data[] = {\n${lines.join('\n')}\n};\nconst lv_image_dsc_t game_room={.header.magic=LV_IMAGE_HEADER_MAGIC,.header.cf=LV_COLOR_FORMAT_RGB565,.header.flags=0,.header.w=233,.header.h=233,.header.stride=466,.data_size=sizeof(game_room_data),.data=game_room_data};\n`);
    roomAvailable=true;
  } else metadata.room={source:ROOM?rel(ROOM):null,available:false,reason:'No reviewed room PNG supplied; asset bank room is NULL. Reference black ground-disc sample is not registered as a room.'};
  let header='#pragma once\n#include "lvgl.h"\n#include "badge_scene.h"\n\n';
  for(const f of cropped) header+=`extern const lv_image_dsc_t game_${f.clip}_${String(f.index).padStart(2,'0')};\n`;
  if(roomAvailable)header+='extern const lv_image_dsc_t game_room;\n';
  header+='\nconst badge_scene_assets_t *badge_game_assets(void);\n';fs.writeFileSync(path.join(COUT,'game_assets.h'),header);
  let c='/* Generated: original PCAT cycles, fixed shared 192x208 frame / anchor (96,196). */\n#include "game_assets.h"\n';
  for(const clip of CLIPS)c+=`\nstatic const lv_image_dsc_t *const game_${clip.id}_frames[] = {${cropped.filter(f=>f.clip===clip.id).map(f=>`&game_${f.clip}_${String(f.index).padStart(2,'0')}`).join(',')}};\n`;
  c+='\nstatic const badge_scene_assets_t game_bank = { .clips = {\n';
  for(const clip of CLIPS)c+=`    [BADGE_SCENE_${clip.id.toUpperCase()}] = {.frames=game_${clip.id}_frames,.count=${clip.count},.cycle_ms=${clip.cycleMs},.loop=${clip.loop?'true':'false'}},\n`;
  c+=`}, .room = ${roomAvailable?'&game_room':'NULL'} };\n\nconst badge_scene_assets_t *badge_game_assets(void) {return &game_bank;}\n`;fs.writeFileSync(path.join(COUT,'game_assets.c'),c);
  metadata.frames=records;
  metadata.generatedC=Object.fromEntries(fs.readdirSync(COUT).filter(n=>/^game_.*\.[ch]$/.test(n)).map(n=>[n,sha(fs.readFileSync(path.join(COUT,n)))]));
}
const evidenceFiles=['src/libs/bin_decoder/lv_bin_decoder.c','src/misc/lv_color.h'].map(p=>path.join(ROOT,'firmware/managed_components/lvgl__lvgl',p));
metadata.lvglLayoutEvidence=evidenceFiles.map(p=>({path:rel(p),sha256:sha(fs.readFileSync(p))}));
fs.writeFileSync(path.join(OUT,'provenance.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({stage:metadata.stage,samples:sampleReport,format:FORMAT,maxCoveredRGB565Colors:maxColors,budget:metadata.budget,sharedTransform:metadata.sharedTransform},null,2));
