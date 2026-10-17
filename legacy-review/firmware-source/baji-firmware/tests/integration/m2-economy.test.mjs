import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness, TEST_POLICY, challengeBody, proof, hmac } from './m2-helper.mjs';
async function encounter(h) {
  const [a, b] = h.users;
  for (const u of [a, b]) { const setting = await h.ok(u, '/social-settings'); await h.ok(u, '/social-settings', 'PUT', { baseRevision: setting.revision, isDiscoverable: true, venueId: 'TEST-VENUE' }); }
  const token = await h.ok(b, '/discovery-tokens', 'POST', { deviceId: b.id, sessionId: b.binding.sessionId });
  const first = await h.ok(a, '/encounters', 'POST', { deviceId: a.id, sessionId: a.binding.sessionId, peerToken: token.token, method: 'QR' });
  const other = await h.ok(b, `/encounters/${first.id}`);
  for (const [u, value] of [[a, first], [b, other]]) await h.ok(u, `/encounters/${first.id}/proofs`, 'POST', { deviceId: u.id, sessionId: u.binding.sessionId, proofBase64: proof(challengeBody(value.ownChallengeBase64, u).body, u) });
  return h.ok(a, `/encounters/${first.id}`);
}
for(const change of ['DELETED','FLAGS_CHANGED'])test(`M2 HTTP original minted asset transfer survives deployed catalog ${change}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-asset-catalog-'));let h;const policy=structuredClone(TEST_POLICY);policy.starterCatalogIds.push('test-rare');
 try{h=await harness(policy,{dbPath:join(dir,'test.sqlite')});const [a,b]=h.users;await encounter(h);const before=(await h.ok(a,'/assets?size=100')).list,offered=before.find(v=>v.catalogId==='test-gift'),rare=before.find(v=>v.catalogId==='test-rare');
  policy.version='TEST-asset-new-version';policy.starterCatalogIds=[];policy.encounterRewards.newCatalogIds=[];policy.breeding.rareCatalogIds=[];
  if(change==='DELETED')policy.catalog=policy.catalog.filter(v=>v.id==='test-stamp');else for(const item of policy.catalog)Object.assign(item,{rarity:1,isGiftable:item.id==='test-rare',isExchangeable:item.id==='test-rare'});
  await h.restart();const e=await encounter(h);const x=await h.ok(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:offered.assetId});await h.ok(a,`/exchanges/${x.id}/confirm`,'POST',{});await h.ok(b,`/exchanges/${x.id}/confirm`,'POST',{});assert.ok((await h.ok(b,'/assets?size=100')).list.some(v=>v.assetId===offered.assetId&&v.status==='AVAILABLE'));
  assert.notEqual((await h.request(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:rare.assetId})).code,200,'original nonexchangeable rarity3 cannot be opened by live catalog edit');assert.notEqual((await h.request(a,'/gifts','POST',{friendshipId:e.friendshipId,assetId:rare.assetId})).code,200,'original non-giftable rarity3 stays closed');assert.equal((await h.ok(a,'/assets?size=100')).list.find(v=>v.assetId===rare.assetId).status,'AVAILABLE');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-asset-catalog-')));await rm(dir,{recursive:true,force:true});}
});

test('M2 HTTP expired exchange GET is pure read and explicit POST maintenance releases exactly owned locks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-expiry-')),dbPath=join(dir,'test.sqlite');let h;
 try{h=await harness(undefined,{dbPath});const [a,b]=h.users,e=await encounter(h),asset=await oneAsset(h,a);
  const x=await h.ok(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:asset.assetId});
  const snapshot=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return {exchange:db.prepare('SELECT body,status FROM social_exchange WHERE id=?').get(x.id),assets:db.prepare('SELECT id,body FROM social_asset WHERE id IN (?,?) ORDER BY id').all(x.offeredAssetId,x.requestedAssetId)};}finally{db.close();}};
  const locked=snapshot();h.advance(61000);await h.ok(a,'/exchanges?status=PENDING');await h.ok(a,'/assets?size=100');assert.deepEqual(snapshot(),locked,'GET cannot settle expired lock or mutate owned asset rows');
  await h.request(a,`/exchanges/${x.id}/confirm`,'POST',{});
  const final=snapshot();assert.equal(JSON.parse(final.exchange.body).status,'EXPIRED');assert.ok(final.assets.every(row=>JSON.parse(row.body).status==='AVAILABLE'&&!JSON.parse(row.body).lockOwnerId));
  const settled=snapshot();await h.request(b,`/exchanges/${x.id}/cancel`,'POST',{});assert.deepEqual(snapshot(),settled,'terminal retries do not write different locks or move assets');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-expiry-')));await rm(dir,{recursive:true,force:true});}
});

test('M2 HTTP concurrent confirm/cancel has one terminal outcome and conserves both assets', async () => {
  const h = await harness();
  try {
    const [a,b] = h.users, e = await encounter(h), asset = await oneAsset(h,a);
    const x = await h.ok(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:asset.assetId});
    await h.ok(a,`/exchanges/${x.id}/confirm`,'POST',{});
    await Promise.all([h.request(b,`/exchanges/${x.id}/confirm`,'POST',{}),h.request(a,`/exchanges/${x.id}/cancel`,'POST',{})]);
    const state = (await h.ok(a,'/exchanges?size=100')).list.find(row=>row.id===x.id);
    assert.ok(['COMPLETED','CANCELLED'].includes(state.status));
    const aa = (await h.ok(a,'/assets?size=100')).list, bb = (await h.ok(b,'/assets?size=100')).list;
    for(const id of [x.offeredAssetId,x.requestedAssetId]) assert.equal([...aa,...bb].filter(row=>row.assetId===id).length,1);
    assert.equal([...aa,...bb].filter(row=>[x.offeredAssetId,x.requestedAssetId].includes(row.assetId)&&row.status==='LOCKED').length,0);
    const transferred = state.status==='COMPLETED';
    assert.equal(bb.some(row=>row.assetId===x.offeredAssetId),transferred);
    assert.equal(aa.some(row=>row.assetId===x.requestedAssetId),transferred);
  } finally {await h.close();}
});

async function oneAsset(h, u) { return (await h.ok(u, '/assets?size=100')).list.find(asset => asset.status === 'AVAILABLE' && asset.kind !== 'TRAIT'); }
test('M2 HTTP cancellation of old exchange does not unlock asset locked by a new exchange', async () => {
  const h = await harness();
  try {
    const [a, b] = h.users, e = await encounter(h), offered = await oneAsset(h, a);
    const x = await h.ok(a, '/exchanges', 'POST', { encounterId: e.id, offeredAssetId: offered.assetId });
    await h.ok(a, `/exchanges/${x.id}/cancel`, 'POST', {});
    const y = await h.ok(a, '/exchanges', 'POST', { encounterId: e.id, offeredAssetId: offered.assetId });
    const old = await h.request(a, `/exchanges/${x.id}/cancel`, 'POST', {}); assert.ok(old.code === 200 || old.code === 47004);
    assert.equal((await h.ok(a, '/assets?size=100')).list.find(row => row.assetId === offered.assetId).status, 'LOCKED');
    assert.notEqual((await h.request(a, '/gifts', 'POST', { friendshipId: e.friendshipId, assetId: offered.assetId })).code, 200);
    await h.ok(a, `/exchanges/${y.id}/confirm`, 'POST', {});
    const completed = await h.ok(b, `/exchanges/${y.id}/confirm`, 'POST', {}); assert.equal(completed.status, 'COMPLETED');
    assert.equal((await h.ok(b, '/assets?size=100')).list.filter(row => row.assetId === offered.assetId).length, 1);
    assert.equal((await h.ok(a, '/assets?size=100')).list.filter(row => row.assetId === offered.assetId).length, 0);
  } finally { await h.close(); }
});
test('M2 HTTP old gift cancellation cannot unlock a newer gift and real delivery is next encounter only', async () => {
  const h = await harness();
  try {
    const [a, b] = h.users, first = await encounter(h);
    const x = await h.ok(a, '/gifts', 'POST', { friendshipId: first.friendshipId, selectionMode: 'PET_RANDOM' });
    await h.ok(a, `/gifts/${x.id}/cancel`, 'POST', {});
    const y = await h.ok(a, '/gifts', 'POST', { friendshipId: first.friendshipId, selectionMode: 'PET_RANDOM' });
    const asset = { assetId: y.assetId };
    assert.equal(y.status, 'IN_TRANSIT');
    await h.request(a, `/gifts/${x.id}/cancel`, 'POST', {});
    assert.equal((await h.ok(a, '/assets?size=100')).list.find(row => row.assetId === asset.assetId).status, 'LOCKED');
    assert.notEqual((await h.request(a, '/gifts', 'POST', { friendshipId: first.friendshipId, assetId: asset.assetId })).code, 200);
    assert.equal((await h.ok(b, '/assets?size=100')).list.some(row => row.assetId === asset.assetId), false);
    h.advance(2000); await encounter(h);
    assert.equal((await h.ok(b, '/assets?size=100')).list.filter(row => row.assetId === asset.assetId).length, 1);
    const gifts = await h.ok(a, '/gifts?size=100'); assert.equal(gifts.list.find(row => row.id === y.id).status, 'DELIVERED');
    const before = await h.ok(a, '/assets?size=100'); h.advance(2000); await encounter(h);
    assert.equal((await h.ok(b, '/assets?size=100')).list.filter(row => row.assetId === asset.assetId).length, 1);
    assert.equal((await h.ok(a, '/assets?size=100')).list.filter(row => row.source === 'GIVER_REWARD').length, before.list.filter(row => row.source === 'GIVER_REWARD').length);
  } finally { await h.close(); }
});
test('M2 HTTP original confirmed encounter cannot be reused after session rebinding', async () => {
  const h = await harness();
  try {
    const [a] = h.users, e = await encounter(h), asset = await oneAsset(h, a);
    const challenge = await h.ok(a, `/devices/${a.id}/binding-challenges`, 'POST', {});
    a.binding = await h.ok(a, '/device-bindings', 'POST', { deviceId: a.id, challengeId: challenge.challengeId, proofBase64: hmac(a.key, 'BAJI-BIND-v1', Buffer.from(a.id, 'hex'), Buffer.from(challenge.challengeBase64, 'base64')).toString('base64') });
    assert.notEqual((await h.request(a, '/exchanges', 'POST', { encounterId: e.id, offeredAssetId: asset.assetId })).code, 200);
    assert.notEqual((await h.request(a, '/breedings', 'POST', { friendshipId: e.friendshipId, encounterId: e.id, parentCatId: 'cat-1', peerParentCatId: 'cat-1' })).code, 200);
  } finally { await h.close(); }
});
