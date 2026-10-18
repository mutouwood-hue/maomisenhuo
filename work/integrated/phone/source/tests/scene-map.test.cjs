const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/offline-scene-map.js'),'utf8'),sandbox);
const project=(s,e)=>JSON.parse(JSON.stringify(sandbox.window.CatOfflineSceneMap.project(s,e)));
const original=()=>({ready:true,pet:{id:'cat-7',name:'长名字小年糕',breed:'orange',coins:27,health:98,stats:{food:86,mood:72,clean:68,energy:75}},life:{view:'home'},room:{currentAction:null},mini:{running:false}});
test('scene projection preserves original values and never writes the source store',()=>{
 const s=original(),before=JSON.stringify(s); const p=project(s);
 assert.deepEqual(p,{petId:'cat-7',scene:'home',action:'idle',weather:'clear',pet:{name:'长名字小年糕',breed:'orange',food:86,mood:72,clean:68,energy:75,health:98,coins:27}});
 assert.equal(JSON.stringify(s),before);assert.equal(p.revision,undefined);assert.equal(p.requestId,undefined);
});
test('loading, outdoor walking, settling and real return map without fabricated transitions',()=>{
 const s=original();s.life={view:'world',entering:true,world:null};assert.equal(project(s).scene,'departing');
 s.life.entering=false;s.life.world={phase:'walking'};assert.equal(project(s).scene,'away');assert.equal(project(s).action,'walk');
 s.life.world.phase='settling';assert.equal(project(s).scene,'returning');
 s.life.view='home';assert.equal(project(s).scene,'home');assert.equal(project(s).action,'idle');
 s.life.view='shop';assert.equal(project(s).scene,'home');
});
test('care and mini actions follow actual renderer activity and cancellation returns idle',()=>{
 const s=original();for(const [source,target] of Object.entries({drink:'water',tease:'play',climb:'walk',feed:'feed',bath:'bath',pet:'pet',sleep:'sleep'})){
  s.room.currentAction=source;assert.equal(project(s).action,target);
 }
 s.room.currentAction=null;assert.equal(project(s).action,'idle');s.mini.running=true;assert.equal(project(s).action,'play');
});
test('only an actual outdoor rain effect maps rain; unknown weather cannot invent snow',()=>{
 const s=original();assert.equal(project(s,{type:'rain'}).weather,'clear');s.life.view='world';
 assert.equal(project(s,{type:'rain'}).weather,'rain');assert.equal(project(s,{type:null}).weather,'clear');assert.equal(project(s,{type:'snow'}).weather,'clear');
});
test('unready or incomplete state cannot produce a fake pet snapshot',()=>{
 assert.equal(project(null),null);const s=original();s.ready=false;assert.equal(project(s),null);s.ready=true;s.pet.id='';assert.equal(project(s),null);
 s.pet.id='cat-7';s.pet.health=NaN;assert.equal(project(s),null);
});
test('wire stats are rounded without changing original floats; coins are not limited to 100',()=>{
 const s=original();s.pet.stats.food=65.6;s.pet.health=98.2;s.pet.coins=1200;
 const p=project(s);assert.equal(p.pet.food,66);assert.equal(p.pet.health,98);assert.equal(p.pet.coins,1200);assert.equal(s.pet.stats.food,65.6);
 s.pet.stats.food=101;assert.equal(project(s),null);
});
