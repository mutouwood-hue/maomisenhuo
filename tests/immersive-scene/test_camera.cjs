const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
let now = 0, size = {width:390,height:844};
class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
  clone(){return new V(this.x,this.y,this.z)}
  copy(v){Object.assign(this,v);return this}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this}
  lerpVectors(a,b,k){for(const n of ['x','y','z'])this[n]=a[n]+(b[n]-a[n])*k;return this}
  toArray(){return [this.x,this.y,this.z]}
}
const context = {window:{},matchMedia:()=>({matches:false}),performance:{now:()=>now}};
vm.runInNewContext(fs.readFileSync('scripts/immersive-room.js','utf8'),context);
const api=context.window.CatImmersion, events={};
const room={cam:{aspect:390/844,position:new V()},ctl:{target:new V(),update(){}},canvas:{dataset:{},style:{},getBoundingClientRect:()=>size,addEventListener:(k,f)=>events[k]=f},act:null};
const frame=()=>api.frame(room), settle=()=>{now+=1000;frame()};
frame();const initial=room.cam.position.toArray();
room.cam.position.x=11;frame();assert.equal(room.cam.position.x,11,'idle must preserve user camera');
events.pointerdown();
room.act={interactive:true,name:'feed'};frame();settle();
assert.notDeepEqual(room.cam.position.toArray(),initial);
api.suspend(true);room.act=null;frame();assert.equal(api.state().action,'feed','hidden scene must stop camera work');
api.suspend(false);frame();settle();assert.equal(room.cam.position.x,11,'cancel returns to the user view');
room.act={interactive:true,name:'bath'};frame();settle();
size={width:844,height:390};room.cam.aspect=844/390;frame();settle();
room.act=null;frame();settle();assert.deepEqual(room.cam.position.toArray(),[10,29,-58],'resize during care must restore landscape home');
assert.equal(room.ctl.minDistance,42,'relaxed care limits restored');
assert.equal(room.canvas.style.touchAction,'none');
assert.equal(api.reset(),true);settle();
console.log('PASS idle camera ownership, interrupted care restoration, hidden scene suspension, care rotation restoration, home reset');
