/* Reviewer-added checks using the actual original life-v5 closure and production SceneMap.
   Canvas, original time, localStorage and sensor endpoints are isolated fixtures. */
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../../artifacts/html-offline-candidate/ui025/source/tests/companion-scene-fixture.cjs');
const shape=x=>x&&JSON.parse(JSON.stringify({scene:x.scene,action:x.action,weather:x.weather}));
function use(fn){const h=fixture();try{return fn(h);}finally{h.close();}}
test('original render exception invalidates prior applied output and cannot silently reuse stale away or persist identity',()=>use(h=>{
 h.apply();assert.equal(h.mapped().scene,'away');const storage=h.storage(),map=h.w.__pgLife.map;
 h.w.__pgLife.map=()=>{throw Error('isolated original canvas/render failure');};
 assert.throws(()=>h.syncNow(),/isolated original/);assert.equal(h.w.__pgLife.hostCompanionState(),null);assert.equal(h.mapped(),null);assert.deepEqual(h.storage(),storage);assert.deepEqual(h.requests,[]);
 h.w.__pgLife.map=map;h.syncNow();assert.equal(h.mapped().scene,'away');
}));
test('lost room and game-not-ready refuse projection, without identity/store writes, then actual original apply recovers',()=>use(h=>{
 h.apply();const before=h.storage(),room=h.w.__pgRoom;h.w.__pgRoom=null;h.syncNow();assert.equal(h.mapped(),null);assert.equal(h.d.getElementById('pg-away').hidden,true);assert.deepEqual(h.storage(),before);
 h.w.__pgRoom=room;h.syncNow();h.raw.ready=false;assert.equal(h.mapped(),null);assert.deepEqual(h.storage(),before);h.raw.ready=true;assert.equal(h.mapped().scene,'away');
}));
test('recall crosses30minutes during hidden state without guessing on resume until original syncNow applies',()=>use(h=>{
 h.apply();h.callback();assert.equal(h.mapped().scene,'home');const before=h.storage();h.hidden(true);h.advance(1800001);
 assert.equal(h.w.__pgLife.hostCompanionState(),null);assert.equal(h.mapped(),null);h.hidden(false);
 assert.equal(h.mapped().scene,'home','last applied recall retained, no Date.now recomputation in SceneMap');h.syncNow();assert.equal(h.mapped().scene,'away');assert.deepEqual(h.storage(),before);assert.deepEqual(h.requests,[]);
}));
test('world transitions override actual companion and preserve original walk/rain while nonworld follows recalled room action',()=>use(h=>{
 h.apply();const before=h.storage();h.raw.life={view:'world',entering:true,world:{phase:'walking'}};h.w.__pgLife.hostWorldEvent=()=>({type:'rain'});
 assert.deepEqual(shape(h.mapped()),{scene:'departing',action:'walk',weather:'rain'});
 h.raw.life.entering=false;h.raw.life.world.phase='settling';assert.deepEqual(shape(h.mapped()),{scene:'returning',action:'idle',weather:'rain'});
 h.raw.life={view:'home'};assert.deepEqual(shape(h.mapped()),{scene:'away',action:'idle',weather:'clear'});h.callback();h.raw.room.currentAction='sleep';assert.deepEqual(shape(h.mapped()),{scene:'home',action:'sleep',weather:'clear'});assert.deepEqual(h.storage(),before);
}));
