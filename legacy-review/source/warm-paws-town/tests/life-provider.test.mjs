import test from 'node:test';
import assert from 'node:assert/strict';
import { LifeProvider, dateKey, apiTime } from '../src/companion/life-provider.js';
function fixture() {
  let time = Date.parse('2026-10-14T08:00:00+08:00'), id = 0;
  const values = new Map();
  const provider = new LifeProvider({ storage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }, now: () => time, createId: () => `id-${++id}` });
  return { provider, advance: ms => time += ms, position: (latitude=31,longitude=121) => provider.addPosition({ timestamp: time, coords: { latitude, longitude, accuracy: 15 } }) };
}
test('no consent or samples has empty day, not fabricated home, work or steps', () => {
  const { provider, position } = fixture();
  assert.equal(position(), false);
  assert.deepEqual(provider.summary().segments, []);
  assert.equal(provider.summary().motion, null);
});
test('fifteen minute stays become one visit, not one visit per GPS sample', () => {
  const f = fixture(); f.provider.setConsent({ isLocationGranted:true, isMotionGranted:false });
  for(let i=0;i<16;i++){f.position();f.advance(60000);}
  assert.equal(f.provider.summary().places[0].visitIds.length, 1);
  assert.equal(f.provider.summary().segments.length, 1);
  assert.equal(f.provider.summary().places[0].type, 'OTHER');
  assert.doesNotMatch(JSON.stringify(f.provider.summary()), /"(?:lat|lon|accuracy)"/);
  f.provider.stopSampling();f.advance(60000);
  for(let i=0;i<16;i++){f.position();f.advance(60000);}
  assert.equal(f.provider.summary().places[0].visitIds.length, 1, '暂停后同地点不冒充再次到访');
  f.position(32,122);f.advance(60000);
  for(let i=0;i<16;i++){f.position();f.advance(60000);}
  assert.equal(f.provider.summary().places[0].visitIds.length, 2);
});
test('unknown intervals do not become a fabricated long stay', () => {
  const f=fixture();f.provider.setConsent({isLocationGranted:true,isMotionGranted:false});
  f.position();f.advance(3600000);f.position();assert.equal(f.provider.summary().segments.length,0);
});
test('step counter first read, reset, pause and day boundary only establish baseline', () => {
  const f=fixture();f.provider.setConsent({isLocationGranted:false,isMotionGranted:true});
  const read=(n,bootId='boot-a')=>f.provider.addSteps({cumulativeSteps:n,bootId});
  read(1000);f.advance(1000);read(1010);assert.equal(f.provider.summary().motion.stepCount,10);
  f.advance(1000);read(2,'boot-b');f.advance(1000);read(5,'boot-b');assert.equal(f.provider.summary().motion.stepCount,13);
  f.provider.stopSampling();f.advance(1000);read(500,'boot-b');assert.equal(f.provider.summary().motion.stepCount,13);
  f.advance(86400000);read(600,'boot-b');assert.equal(f.provider.summary().motion.stepCount,0);
});
test('revoke and seven-day purge erase sensitive derived data', () => {
  const f=fixture();f.provider.setConsent({isLocationGranted:true,isMotionGranted:true});
  f.position();f.provider.addSteps({cumulativeSteps:30,bootId:'a'});f.provider.addMoment({type:'CARE',heart:3});
  f.advance(8*86400000);assert.equal(f.provider.summary().moments.length,0);assert.equal(f.provider.samples.length,0);
  f.provider.setConsent({isLocationGranted:false,isMotionGranted:false});assert.equal(f.provider.summary().motion,null);
});
test('API dates use explicit Shanghai timezone not host locale',()=>{
  const time=Date.parse('2026-10-13T16:10:00Z');assert.equal(dateKey(time),'2026-10-14');assert.equal(apiTime(time),'2026-10-14 00:10:00');
});
