/* Read-only numeric model inspection. Uses original Three geometry, no renderer. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),asset=root+'/android/app/src/main/assets/';
const main=fs.readFileSync(asset+'game-03.js','utf8');
const canvas=()=>({width:128,height:128,getContext:()=>({imageSmoothingEnabled:false,drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(128*128*4)}),putImageData(){}})});
const ctx={window:{},document:{createElement:canvas},TextDecoder,TextEncoder,ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}},atob:x=>Buffer.from(x,'base64').toString('binary'),console};
vm.runInNewContext(fs.readFileSync(asset+'game-02.js','utf8'),ctx);
vm.runInNewContext(main.slice(0,main.indexOf('async function bf('))+';globalThis.inspect={Ss,Box:Xt,Vector:L,Texture:Fs,Loader:xo,Group:ut};})();',ctx);
(async()=>{
 const {Ss,Box,Vector,Texture,Loader,Group}=ctx.inspect;
 Loader.prototype.loadAsync=async()=>{const t=new Texture(canvas());return t;};
 const model=await Ss(),outer=new Group();outer.add(model.root);
 const data=[];
 for(const [stage,scale]of [['kitten',.64],['young',.82],['adult',1]])for(const pose of ['idle','sleep']){
  model.applyAnimation('idle',0);model.root.scale.setScalar(scale);outer.position.set(0,0,0);outer.rotation.set(0,0,0);
  const bones=model.bones,head=bones.get('head'),body=bones.get('body');
  if(pose==='sleep'){
   const depth=4.4;body.position.y-=depth;
   for(const name of ['front_left','front_right','back_left','back_right']){const leg=bones.get(name),s=1-depth/5.8;leg.scale.y=s;leg.position.y-=5.8*(1-s);}
   head.rotation.set(-.18,0,0,'ZYX');const pivot=new Vector(0,-2.2,.9).multiplyScalar(stage==='kitten'?1.065:1);head.position.add(pivot.clone().sub(pivot.clone().applyEuler(head.rotation)));
   body.rotation.x+=.035;bones.get('tail_base').rotation.x-=1.1;
   for(const n of ['eye_left','eye_right'])bones.get(n)?.scale.setY(.12);
  }
  if(stage==='kitten')head.scale.multiplyScalar(1.065);
  outer.updateMatrixWorld(true);let box=new Box().setFromObject(model.root);
  const local={min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new Vector()).toArray()};
  if(pose==='sleep'){outer.position.set(-14.5,3.22,11);outer.rotation.y=Math.PI/2;outer.updateMatrixWorld(true);box=new Box().setFromObject(model.root);}
  data.push({stage,scale,pose,local,bedWorld:pose==='sleep'?{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new Vector()).toArray()}:null});
 }
 console.log(JSON.stringify({measurement:'Original no-outfit mesh AABB, idle time=0; sleep exact st(1) before at() individual-paw bed collision and idle breathing; no WebGL/screenshot',data},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
