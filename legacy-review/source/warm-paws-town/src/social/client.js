import { decodeSocialStatus, decodeSocialReference, supportsMethod, transcriptHash, encounterHex } from './peer-protocol.js';
import { encodeBase64, decodeBase64 } from '../ble/protocol.js';
const keyPath = id => encodeURIComponent(String(id));
/** HTTP paths/DTO follow backend/docs/m2-http-draft.md. No local rewards or signing. */
export class SocialClient {
  constructor({ api, storage, getOwner = () => 'single-owner', createId = () => crypto.randomUUID() }) { Object.assign(this, { api, storage, getOwner, createId }); }
  get(path, signal) { return this.api.request('/api/' + path, { signal }); }
  async post(path, body = {}, { signal, operationKey } = {}) {
    // Callers explicitly identify a logical operation; leases use a fresh key each new round.
    const owner = this.getOwner();
    if (!owner) throw new Error('未登录，不能建立写请求。');
    const key = operationKey ? 'm2-request:' + encodeURIComponent(owner) + ':' + operationKey : null;
    const saved = key ? this.storage?.getItem(key) : null;
    let record;
    try { record = saved ? JSON.parse(saved) : { id: this.createId() }; } catch { throw new Error('幂等记录损坏；请先刷新云端核对结果，不能自动重发。'); }
    if (typeof record?.id !== 'string' || record.id.length < 8 || record.id.length > 128) throw new Error('幂等记录非法，写操作已停止。');
    if (key) this.storage?.setItem(key, JSON.stringify(record));
    // Keep key even after success: repeated confirmation is the same durable operation.
    return this.api.request('/api/' + path, { method: 'POST', body, signal, idempotencyKey: record.id });
  }
  put(path, body, signal) { return this.api.request('/api/' + path, { method: 'PUT', body, signal }); }
  async load({ signal } = {}) {
    const [settings, policy, collection, friends, assets, gifts, breedings, environment, pets, exchanges] = await Promise.all([
      this.get('social-settings', signal), this.get('m2-policy', signal), this.get('collections/current', signal),
      this.get('friendships?size=100', signal), this.get('assets?size=100', signal), this.get('gifts?size=100', signal),
      this.get('breedings?size=100', signal), this.get('environment-consent', signal), this.socialPets(signal), this.exchanges(signal),
    ]);
    return { settings, policy, collection, friends, assets, gifts, breedings, environment, pets, exchanges };
  }
  settings(value, signal) { return this.put('social-settings', value, signal); }
  discovery(device, options) { return this.post('discovery-tokens', device, options); }
  encounter(value, options) { return this.post('encounters', value, options); }
  pendingEncounters(signal) { return this.get('encounters?status=PENDING&size=100', signal); }
  encounterOptions(id, signal) { return this.get(`encounters/${keyPath(id)}/options`, signal); }
  exchanges(signal) { return this.get('exchanges?status=PENDING&size=100', signal); }
  socialPets(signal) { return this.get('social-pets', signal); }
  encounterState(id, signal) { return this.get('encounters/' + keyPath(id), signal); }
  proof(id, value, options) { return this.post(`encounters/${keyPath(id)}/proofs`, value, options); }
  cancelEncounter(id, options) { return this.post(`encounters/${keyPath(id)}/cancel`, {}, options); }
  contact(id, value, signal) { return this.put(`friendships/${keyPath(id)}/contact-consent`, value, signal); }
  removeFriend(id, signal) { return this.api.request('/api/friendships/' + keyPath(id), { method: 'DELETE', signal }); }
  block(id, isBlocked, signal) { return this.put('blocks/' + keyPath(id), { isBlocked }, signal); }
  report(value, options) { return this.post('reports', value, options); }
  exchange(value, options) { return this.post('exchanges', value, options); }
  exchangeAction(id, action, options) { if (!['confirm', 'cancel'].includes(action)) throw new Error('交换动作非法'); return this.post(`exchanges/${keyPath(id)}/${action}`, {}, options); }
  giftOptions(friendshipId, signal) { return this.get('gift-options?friendshipId=' + keyPath(friendshipId), signal); }
   gift(value, options) { return this.post('gifts', value, options); }
  cancelGift(id, options) { return this.post(`gifts/${keyPath(id)}/cancel`, {}, options); }
  learning(value, options) { return this.post('skill-learnings', value, options); }
  breeding(value, options) { return this.post('breedings', value, options); }
  breedingConsent(id, isAccepted, options) { return this.post(`breedings/${keyPath(id)}/consents`, { isAccepted }, options); }
  breedingAction(id, action, options) { if (!['claim', 'cancel'].includes(action)) throw new Error('联姻动作非法'); return this.post(`breedings/${keyPath(id)}/${action}`, {}, options); }
  environment(value, signal) { return this.put('environment-consent', value, signal); }
  environmentDay(date, signal) { return this.get('environment-days/' + keyPath(date), signal); }
  environmentEvents(value, options) { return this.post('environment-events', value, options); }
  personality(catId, signal) { return this.get('pets/' + keyPath(catId) + '/personality', signal); }
  diaries(signal) { return this.get('pet-diaries?size=100', signal); }
  diary(value, options) { return this.post('pet-diaries', value, options); }
}
export class SocialDeviceBridge {
  constructor({ badge, client, now=()=>Date.now() }) { this.badge = badge; this.socialClient=client; this.now=now; }
  identity() { this.badge.requireSession(); return { deviceId: this.badge.deviceId(), sessionId: this.badge.session.id }; }
  async socialStatus() { this.identity(); return decodeSocialStatus(await this.badge.transport.read(16)); }
  async assertMethod(method) { if(method!=='QR'&&!supportsMethod(await this.socialStatus(),method))throw new Error('真实输入或可信peer能力未就绪；请检查外置身份配置。'); }
  async challenge(encounter) {
    const identity=this.identity(),generation=this.badge.client?.generation;
    const current=()=>{if(this.identity().sessionId!==identity.sessionId||generation!==this.badge.client?.generation)throw new Error('设备会话已改变。');};
    const envelope=decodeBase64(encounter.ownChallengeBase64),body=envelope.slice(20,86),method=['','QR','KNOCK','PATTERN'][body[65]];
    if(envelope.length!==118||body[0]!==1||!method||encounter.method!==method)throw new Error('遇见挑战格式或玩法非法。');
    const hex=bytes=>[...bytes].map(v=>v.toString(16).padStart(2,'0')).join(''),expiry=new DataView(body.buffer,body.byteOffset,body.byteLength).getUint32(61,true);
    if(!/^[0-9a-f]{32}$/.test(encounterHex(identity.sessionId))||!/^[0-9a-f]{32}$/.test(encounterHex(encounter.id))||hex(envelope.slice(0,16))!==encounterHex(identity.sessionId)||hex(body.slice(1,17))!==encounterHex(encounter.id)||hex(body.slice(17,23))!==identity.deviceId.replaceAll(':','').toLowerCase()||/^0{12}$/.test(hex(body.slice(23,29)))||hex(body.slice(17,23))===hex(body.slice(23,29))||expiry<=Math.floor(this.now()/1000))throw new Error('挑战会话、遇见、设备或有效期不匹配。');
    this.badge.m2Challenge=null;
    await this.assertMethod(method);current();
    const expectedHash=method==='QR'?await transcriptHash(body):null;current();
    await this.badge.transport.write(10,envelope);current();
    this.badge.m2Challenge={id:encounter.id,body,method,expectedHash,identity,generation};
    if(method!=='QR') {
      if(!this.socialClient)throw new Error('角色签名服务未就绪。');
      const result=await this.socialClient.post(`devices/${keyPath(identity.deviceId)}/signed-objects`,{sessionId:identity.sessionId,kind:18,encounterId:encounter.id},{operationKey:`peer-role:${identity.sessionId}:${encounter.id}`});current();
      const role=decodeBase64(result.envelopeBase64),hex=bytes=>[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(result.kind!==18||role.length!==75||hex(role.slice(0,16))!==encounterHex(identity.sessionId)||role[20]!==1||hex(role.slice(21,37))!==encounterHex(encounter.id)||![hex(body.slice(17,23)),hex(body.slice(23,29))].includes(hex(role.slice(37,43))))throw new Error('角色封包不属于当前挑战。');
      await this.badge.transport.write(18,role);current();
    }
  }
  async peerProgress(encounterId) {
    const expected=this.badge.m2Challenge,identity=this.identity();
    if(!expected||expected.id!==encounterId||expected.identity.sessionId!==identity.sessionId||expected.generation!==this.badge.client?.generation)throw new Error('当前挑战未建立。');
    const status=await this.socialStatus();
    if(status.encounterId!==encounterHex(encounterId)||status.method!==expected.body[65])throw new Error('状态不属于当前遇见。');
    const raw=(status.flags&2)?await this.badge.transport.read(17):null;
    const reference=raw?decodeSocialReference(raw,{encounterId,method:status.method}):null;
    if(reference&&reference.count!==status.count)throw new Error('参考次数与状态不符。');
    if(this.identity().sessionId!==identity.sessionId||expected.generation!==this.badge.client?.generation||this.badge.m2Challenge!==expected)throw new Error('参考读取期间挑战已改变。');
    return {status,reference};
  }
  async proof(encounterId) {
    const identity=this.identity(),expected=this.badge.m2Challenge;
    if(!expected||expected.id!==encounterId||expected.identity.sessionId!==identity.sessionId||expected.generation!==this.badge.client?.generation)throw new Error('当前会话挑战尚未发送，旧证明不能复用。');
    let expectedHash=expected.expectedHash;
    if(expected.method!=='QR') {
      const {status,reference}=await this.peerProgress(encounterId);
      if(status.state!=='MATCHED'||!reference)throw new Error('请在两台吧唧真实完成暗号匹配，按钮不能代输入。');
      expectedHash=await transcriptHash(expected.body,reference.canonical);
    }
    const proof=await this.badge.transport.read(12);
    if(this.identity().sessionId!==identity.sessionId||expected.generation!==this.badge.client?.generation||this.badge.m2Challenge!==expected||new DataView(expected.body.buffer,expected.body.byteOffset,expected.body.byteLength).getUint32(61,true)<=Math.floor(this.now()/1000))throw new Error('读取期间设备会话或挑战改变。');
    if(!proof||proof.length!==64||!expectedHash.every((byte,index)=>byte===proof[index]))throw new Error('请在当前两台吧唧完成确认；尚无匹配本次挑战的证明。');
    return {...identity,proofBase64:encodeBase64(proof)};
  }
  async emergencyStop() { this.identity(); await this.badge.client.request(7); }
  async environmentConsent(expected) { this.identity(); await this.badge.signed(11,undefined,expected); }
  async environmentStatus() { this.identity(); return decodeEnvironmentStatus(await this.badge.transport.read(13)); }
  async environmentEvent() {
    const identity = this.identity(), raw = await this.badge.transport.read(14);
    if (!raw) return null;
    if (raw.length !== 56 || raw[0] !== 1) throw new Error('环境签名事件格式非法');
    const id = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getBigUint64(1, true).toString();
    return { id, deviceId: identity.deviceId, signedEventBase64: encodeBase64(raw) };
  }
  async environmentAck(id) { this.identity(); await this.badge.signed(15, id); }
}
export function decodeEnvironmentStatus(raw) {
  if (!raw || raw.length !== 10 || raw[0] !== 1 || raw[9] !== 0 || (raw[1] & 240) || raw[6] > 4) throw new Error('环境状态格式非法');
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), confidencePermille = view.getUint16(7, true);
  if (confidencePermille > 1000) throw new Error('环境置信度非法');
  return { isGranted: !!(raw[1] & 1), isActive: !!(raw[1] & 2), isModelAvailable: !!(raw[1] & 4), isFaulted: !!(raw[1] & 8), revision: view.getUint32(2, true), label: ['UNKNOWN', 'QUIET', 'CONVERSATION', 'NOISY', 'MUSIC'][raw[6]], confidencePermille };
}
