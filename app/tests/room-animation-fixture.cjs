/* Actual bf/lc/jt/Ot room machine, renderer/DOM fixtures. No device/WebGL claim. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),assets=root+'/android/app/src/main/assets/';
async function actualRoom(){
 const dom=new JSDOM('<div id="room"></div>',{pretendToBeVisual:true}),w=dom.window,d=w.document,frames=new Map();let seq=0,now=100;
 const box={width:390,height:844,left:0,top:0,right:390,bottom:844};d.getElementById('room').getBoundingClientRect=()=>box;
 w.CatOfflineBed=require('../web/offline-room-bed.js');w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(65536)}),putImageData(){},createRadialGradient:()=>({addColorStop(){}}),fillRect(){}});
 const ctx={window:w,document:d,console,TextDecoder,TextEncoder,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},atob:x=>Buffer.from(x,'base64').toString('binary'),matchMedia:w.matchMedia,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id),performance:{now:()=>now}};
 vm.runInNewContext(fs.readFileSync(assets+'game-02.js','utf8'),ctx);
 const code=fs.readFileSync(assets+'game-03.js','utf8');vm.runInNewContext(code.slice(0,code.indexOf('var Ir=Dt.clamp'))+';globalThis.roomAPI={bf,Vector:L,Box:Xt,Texture:Fs,Loader:xo,setStubs(renderer,controls){Ni=renderer;Kl=controls;}};})();',ctx);
 const api=ctx.roomAPI;
 api.Loader.prototype.loadAsync=async()=>{const canvas=d.createElement('canvas');canvas.width=canvas.height=128;return new api.Texture(canvas);};
 class Renderer{constructor(){this.domElement=d.createElement('canvas');this.domElement.getBoundingClientRect=()=>box;this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}dispose(){}}
 class Controls{constructor(camera){this.camera=camera;this.target=new api.Vector();}update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);}dispose(){}}
 api.setStubs(Renderer,Controls);const room=await api.bf({container:d.getElementById('room')});
 const step=()=>{now+=1000/60;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));return room.state();};
 return {room,step,types:api,inspect:w.__pgRoom,close(){room.dispose();dom.window.close();}};
}
module.exports={actualRoom};
