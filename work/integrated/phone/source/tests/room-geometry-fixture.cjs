const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),asset=root+'/android/app/src/main/assets/',main=fs.readFileSync(asset+'game-03.js','utf8');
const canvas=()=>({width:128,height:128,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(65536)}),putImageData(){}})});
async function createModel(){
 const ctx={window:{},document:{createElement:canvas},TextDecoder,TextEncoder,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},atob:x=>Buffer.from(x,'base64').toString('binary'),console};
 vm.runInNewContext(fs.readFileSync(asset+'game-02.js','utf8'),ctx);
 vm.runInNewContext(main.slice(0,main.indexOf('async function bf('))+';globalThis.types={Ss,Box:Xt,Vector:L,Texture:Fs,Loader:xo,Group:ut,Mesh:kt,Geometry:bn,Material:Ln};})();',ctx);
 const T=ctx.types;T.Loader.prototype.loadAsync=async()=>new T.Texture(canvas());
 const model=await T.Ss(),outer=new T.Group(),inner=new T.Group();outer.add(inner);inner.add(model.root);
 const bedApi=require('../web/offline-room-bed.js'),bed=new T.Group();const meshes=bedApi.build({group:bed,box:(group,size,position,color)=>{const mesh=new T.Mesh(new T.Geometry(...size),new T.Material({color}));mesh.position.set(...position);group.add(mesh);return mesh;}});
 function pose(stage='adult',amount=1,outfit='none'){
  model.setAppearance({outfit});const scale={kitten:.64,baby:.64,young:.82,adult:1}[stage];model.root.scale.setScalar(scale);outer.position.set(...bedApi.config.landing);outer.rotation.set(0,bedApi.config.yaw,0);inner.position.set(0,0,0);inner.rotation.set(0,0,0);
  const result=bedApi.pose({amount,bones:model.bones,model,inner,root:model.root,scale,stage,Vector:T.Vector,Box:T.Box});outer.updateWorldMatrix(true,true);return result;
 }
 return {T,model,outer,inner,bed,meshes,bedApi,pose,project:JSON.parse(Buffer.from(ctx.window.__CAT_PROJECT_BASE64__,'base64').toString('utf8'))};
}
module.exports={createModel};
