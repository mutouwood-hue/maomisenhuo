#!/usr/bin/env node
/** Extract only the original bf static geometry. No HTML, WebGL, cat loader or RAF. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const sourceFile = path.join(root, '小橘电子宠物.html');
const output = path.join(root, 'assets/rendering/badge-v2/room');
const html = fs.readFileSync(sourceFile, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const source = scripts.find(m => m[1].includes('async function bf('))?.[1];
if (!source) throw Error('Original inline bf source missing');
const start = source.indexOf('async function bf(');
const body = source.indexOf('if(!i)', start);
const catLoad = source.indexOf('let z=await Ss()', body);
const furniture = source.indexOf('let j=[', catLoad);
const effects = source.indexOf('let $e=new ut;', furniture);
if (![start, body, catLoad, furniture, effects].every((x, i, a) => x >= 0 && (!i || x > a[i-1]))) throw Error('Static anchors changed');
const first = source.slice(body, catLoad)
  .replace('new Ni(', 'new DataRenderer(').replace('new Kl(', 'new DataControls(');
const second = source.slice(furniture, effects);
// Only shader/math/geometry/material class definitions preceding bf are evaluated.
// Entire gameplay renderer, cat/model loader and original app bootstrap are absent.
const dataFunction = `function collectRoom({container:i}){${first}${second}
 c.updateMatrixWorld(true);return {scene:c,camera:l,room:y,
 anchors:{home:wt.toArray(),food:B.getWorldPosition(new L()).toArray(),water:re.getWorldPosition(new L()).toArray(),bath:he.getWorldPosition(new L()).toArray(),bed:E.getWorldPosition(new L()).toArray(),climb:we.getWorldPosition(new L()).toArray()}};}`;
class DataRenderer {
  constructor(){this.domElement={setAttribute(){},style:{}};this.shadowMap={};}
  setPixelRatio(){}
}
class DataControls {
  constructor(camera){this.camera=camera;this.target=camera.position.clone().set(0,0,0);}
  update(){this.camera.lookAt(this.target);}
}
const context = vm.createContext({DataRenderer,DataControls,
  window:{devicePixelRatio:1},matchMedia:()=>({matches:false}),console,
  TextDecoder,TextEncoder,URL,Blob,atob,btoa,
  // Fail closed if a supposedly data-only path attempts browser interaction.
  document:new Proxy({}, {get(_t,k){throw Error('Unexpected DOM access: '+String(k));}})
});
vm.runInContext(source.slice(0,start)+dataFunction+
  ';globalThis.__roomData=collectRoom({container:{append(){}}});})();',context,{timeout:15000});
const data=context.__roomData;
const meshes=[],lights=[];
data.scene.traverseVisible(obj=>{
  if(obj.isLight) lights.push({type:obj.type,color:obj.color.toArray(),intensity:obj.intensity,
    groundColor:obj.groundColor?.toArray(),position:obj.getWorldPosition(obj.position.clone()).toArray(),
    target:obj.target?.getWorldPosition(obj.position.clone()).toArray()});
  if(!obj.isMesh) return;
  const g=obj.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal');
  if(Array.isArray(obj.material))throw Error('Multi-material room mesh needs explicit groups');
  const m=obj.material;
  meshes.push({name:obj.name,type:g.type,parameters:g.parameters,
    position:Array.from(p.array),normal:n?Array.from(n.array):null,
    index:g.index?Array.from(g.index.array):null,matrixWorld:obj.matrixWorld.toArray(),
    materialType:m.type,color:m.color.toArray(),emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity||0,
    opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,side:m.side,
    roughness:m.roughness,metalness:m.metalness,castShadow:obj.castShadow,receiveShadow:obj.receiveShadow});
});
const scene={schema:1,source:{file:'小橘电子宠物.html',htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),
  inlineScriptSha256:crypto.createHash('sha256').update(source).digest('hex'),
  staticSlices:{bfStart:start,body,catLoad,furniture,effects},
  method:'Original bf static statements + original Three geometry/math classes; data-only Renderer/Controls; no cat loader, DOM, RAF, original HTML execution or app bootstrap'},
  noCat:true,background:data.scene.background.toArray(),anchors:data.anchors,
  originalCamera:{position:data.camera.position.toArray(),fov:data.camera.fov,near:data.camera.near,far:data.camera.far,target:[0,7,1]},
  lights,meshes,counts:{meshes:meshes.length,triangles:meshes.reduce((s,m)=>s+(m.index?m.index.length:m.position.length/3)/3,0)}};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'original-room-scene.json'),JSON.stringify(scene));
console.log(JSON.stringify({counts:scene.counts,lights:lights.length,noCat:true,sourceSha256:scene.source.htmlSha256}));
