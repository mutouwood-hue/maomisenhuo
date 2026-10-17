import { EnvironmentResume } from './environment-resume.js';
import { EnvironmentRevoke } from './environment-revoke.js';
import { requireEligibility, readEligibility, eligibilityAllows } from '../companion/privacy-eligibility.js';
import { supportsMethod } from './peer-protocol.js';
import { UpdateUploader } from './update-uploader.js';
import QRCode from 'qrcode';
import { SocialClient, SocialDeviceBridge } from './client.js';
import { SocialController, localCollection } from './controller.js';
import { QrScanner, discoveryQr } from './qr-scanner.js';
import { panelHtml, setOptions, showList } from './view.js';
import { dateKey } from '../companion/life-provider.js';
export function mountSocial({ api, getSession, getStorage, getBadge, getCloud, isUiBusy=()=>false, events }) {
  document.body.insertAdjacentHTML('beforeend', panelHtml);
  const $ = suffix => document.getElementById('m2-' + suffix);
  const save = () => { try { return JSON.parse(window.__petGame.store.exportSave()); } catch { return {}; } };
  const storage = { getItem: key => getStorage().getItem(key), setItem: (key, value) => getStorage().setItem(key, value) };
  const sourceClient = new SocialClient({ api, storage, getOwner: () => getSession()?.userId });
  const client = new Proxy(sourceClient, { get(target, key) { const value=target[key]; if(typeof value!=='function')return value; return async (...args)=>{ const owner=getSession()?.userId; const result=await value.apply(target,args); if(owner!==getSession()?.userId)throw new Error('账号已切换，旧结果已丢弃。'); return result; }; } });
  let currentOwner = getSession()?.userId, busy = false, snapshot = null, encounter = null, discoveryRound = null, encounterRound = null;
  const controller = new SocialController({ adapter: client, getOwner: () => getSession()?.userId, getSave: save, onChange: render });
  const device = () => { const badge = getBadge(); if (!badge) throw new Error('未连接已绑定的吧唧；请先到云与设备面板完成绑定。'); return new SocialDeviceBridge({ badge, client }); };
  const needed = suffix => { const value = $(suffix).value.trim(); if (!value) throw new Error('请先填写或选择' + $(suffix).closest('label')?.textContent.split('\n')[0]); return value; };
  const options = operationKey => ({ signal: events.signal, operationKey });
  async function execute(action, { refresh = false } = {}) {
    if (events.signal.aborted||isUiBusy()||busy||getBadge()?.transport.pending) return; busy = true; $('error').textContent = ''; $('status').textContent = '正在等待真实结果…';
    try {
      checkOwner(); if (!getSession()) throw new Error('请先登录真实后台；单机图鉴不会丢失。');
      const owner = getSession().userId, result = await action();
      if (owner !== getSession()?.userId) return;
      $('status').textContent = '已收到后台或设备回执。';
      if (refresh) await controller.refresh();
      return result;
    } catch (error) { $('status').textContent='操作未确认。'; $('error').textContent = error.message || '操作未确认，请刷新后核对。'; }
    finally { busy = false; }
  }
  function checkOwner() { const owner = getSession()?.userId; if (owner !== currentOwner) { currentOwner = owner; polling?.abort(); scanner.stop(); controller.invalidate(); snapshot = encounter = null; discoveryRound = encounterRound = null; $('code').hidden = true; $('encounter-id').value = ''; for(const id of ['contact','report-reason','venue'])$(id).value=''; for(const id of ['discover','environment','contact-allowed','diary-allow'])$(id).checked=false; for(const id of ['requested-asset','skill-id','peer-parent'])setOptions($(id),[],'id',row=>row.id,'请先读取当前遇见资格'); for(const id of ['personality-status','diaries-list','environment-events','environment-status','encounter-status','error'])$(id).textContent=''; } }
  function render(state) {
    $('status').textContent = state.status === 'loading' ? '正在读取真实云端记录…' : getSession() ? '云端资产与本机图鉴分开显示。' : '未登录；仍可查看单机图鉴。';
    if (state.error) $('error').textContent = state.error;
    snapshot = state.data ?? null;
    const collection = state.collection ?? localCollection(save());
    showList($('collection'), [...collection.breeds.map(row => `${row.isCollected ? '已收集' : '未收集'} · ${row.name}`), ...collection.goals.filter(row => row.isCollected).map(row => '愿望印章 · ' + row.name), ...collection.graduates.map(row => `毕业 · ${row.name || row.id} · ${row.trait || ''}`), ...(snapshot?.collection?.lineage ?? []).map(row => `云端谱系 · ${row.id} · 父母${(row.parents??[]).join(' / ')} · 子代${(row.children??[]).join(' / ')}`)], '还没有收藏。');
    if (snapshot) {
      $('discover').checked = !!snapshot.settings.isDiscoverable; $('venue').value = snapshot.settings.venueId ?? '';
      $('environment').checked = storage.getItem('m2-pending-env-grant')!=='true' && storage.getItem('m2-pending-env-revoke')!=='true' && !!snapshot.environment.isEnvironmentGranted;
      $('policy').textContent = snapshot.policy.isConfigured ? '当前为已配置的工程策略；试验参数不代表正式运营规则。' : '经济参数尚未完整配置，奖励/交换/联姻可能未开放，不会本机发奖。';
    }
    const friends = snapshot?.friends?.list ?? [], assets = snapshot?.assets?.list ?? [], breedings = snapshot?.breedings?.list ?? [];
    setOptions($('friend'), friends, 'id', row => row.peerPet?.name || row.id, '暂无已确认朋友');
    setOptions($('asset'), assets.filter(row => row.status === 'AVAILABLE'), 'assetId', row => `${row.catalogId} · ${row.rarity} · ${row.assetId}`, '暂无可转移云端资产');
    setOptions($('parent'), (snapshot?.pets?.list ?? []).filter(row=>row.isAdult), 'catId', row => `${row.breed} · ${row.sex} · XP${row.xp}`, '暂无云端成年小猫，单机XP不作为资格');
    setOptions($('exchange-id'), snapshot?.exchanges?.list ?? [], 'id', row => `${row.mode || '交换'} · ${row.status}`, '暂无参与的待确认交换');
    setOptions($('gift-pending'), (snapshot?.gifts?.list??[]).filter(row=>row.status==='IN_TRANSIT'), 'id', row=>row.id,'没有待送达礼物');
    setOptions($('breeding'), breedings, 'id', row => `${row.id} · ${row.status}`, '暂无玩家联姻');
    showList($('friends'), friends.map(row => `${row.peerPet?.name || '匿名小猫'} · 遇见${row.encounterCount}次 · 亲密度${row.intimacy}${row.isContactUnlocked ? ' · 联系方式：' + JSON.stringify(row.contacts) : ' · 联系方式未解锁'}`), '尚未与另一位玩家双向确认。');
    showList($('assets'), assets.map(row => `${row.catalogId} · ${row.status} · 来源${JSON.stringify(row.source)}`), '无云端资产，不以游戏背包代替。');
    showList($('gifts'), (snapshot?.gifts?.list ?? []).map(row => `${row.id} · ${row.status}`), '没有运输中的礼物。');
    showList($('breedings'), breedings.map(row => `${row.id} · ${row.status} · 自己${row.isSelfAccepted ? '已同意' : '待同意'} / 对方${row.isPeerAccepted ? '已同意' : '待同意'}`), '没有真实玩家联姻记录。');
  }
  function showEncounter(value) { encounter = value; $('encounter-id').value = value.id; $('encounter-status').textContent = `${value.status} · ${value.method} · 自己${value.isSelfConfirmed ? '已确认' : '未确认'} / 对方${value.isPeerConfirmed ? '已确认' : '未确认'} · 有效至${value.expiresAt}`; }
  const scanner = new QrScanner({ video: $('video'), canvas: $('scan-frame'), onValue: token => { $('video').hidden = true; void execute(async () => { encounterRound = crypto.randomUUID(); await device().assertMethod($('method').value); const value = await client.encounter({ ...device().identity(), peerToken: token, method: $('method').value }, options('encounter:' + encounterRound)); showEncounter(value); await device().challenge(value); }); }, onError: error => { $('error').textContent = error.message; } });
  const on = (suffix, action, refresh = false) => $(suffix).addEventListener('click', () => void execute(action, { refresh }), { signal: events.signal });
  $('open').addEventListener('click', () => { checkOwner(); $('dialog').showModal(); render(controller.state); if (getSession()) void execute(() => controller.refresh()); }, { signal: events.signal });
  $('dialog').querySelector('.close-button').addEventListener('click', () => $('dialog').close(), { signal: events.signal });
  $('dialog').addEventListener('close', () => { polling?.abort(); scanner.stop(); $('video').hidden = true; $('open').focus(); }, { signal: events.signal });
  on('refresh', () => controller.refresh());
  on('settings', () => client.settings({ baseRevision: snapshot?.settings?.revision ?? 0, isDiscoverable: $('discover').checked, venueId: $('venue').value.trim() || null }), true);
  on('qr', async () => { discoveryRound = crypto.randomUUID(); const result = await client.discovery(device().identity(), options('discovery:' + discoveryRound)); await QRCode.toCanvas($('code'), discoveryQr(result.token), { errorCorrectionLevel: 'M' }); $('code').hidden = false; $('encounter-status').textContent = `匿名二维码有效至${result.expiresAt}；不是联系方式。`; });
  on('scan', async () => { device().identity(); $('video').hidden = false; try { await scanner.start(); } catch (error) { $('video').hidden = true; throw error; } });
  $('stop-scan').addEventListener('click', () => { scanner.stop(); $('video').hidden = true; }, { signal: events.signal });
  on('challenge', async () => { const value = await client.encounterState(needed('encounter-id')); showEncounter(value); await device().challenge(value); });
  on('options', async () => { const value = await client.encounterOptions(needed('encounter-id')); setOptions($('requested-asset'), value.peerAssets, 'assetId', row=>row.catalogId,'本次没有可交换资产'); $('requested-asset').add(new Option('半随机交换（不指定收到物）',''),0); $('requested-asset').value=''; setOptions($('peer-parent'),value.peerParents.filter(row=>row.isAdult),'catId',row=>`${row.breed} · ${row.sex}`,'对方没有云端成年父母'); setOptions($('skill-id'),value.peerSkills.filter(row=>row.isTeachable),'skillId',row=>row.name,'本次没有可教技能'); });
  on('proof', async () => { const id = needed('encounter-id'); showEncounter(await client.proof(id, await device().proof(id), options('proof:' + id))); });
  on('encounter-refresh', async () => showEncounter(await client.encounterState(needed('encounter-id'))));
  on('cancel', async () => showEncounter(await client.cancelEncounter(needed('encounter-id'), options('encounter-cancel:' + needed('encounter-id')))));
  on('contact-save', () => client.contact(needed('friend'), { isContactAllowed: $('contact-allowed').checked, contact: $('contact').value.trim() }), true);
  on('remove', () => client.removeFriend(needed('friend')), true);
  on('block', () => client.block(needed('friend'), true), true);
  on('report', () => client.report({ friendshipId: needed('friend'), reason: needed('report-reason') }, options('report:' + crypto.randomUUID())));
  $('gift').textContent='让宠物挑礼物';$('gift').insertAdjacentHTML('afterend','<p id="m2-gift-range" role="status">礼物由宠物从当前可赠低稀有衣服/物品中挑选，不按资产选择器定向；确认前先读取范围。</p>');
   on('gift', async()=>{const friendshipId=needed('friend'),owner=getSession()?.userId;const range=await client.giftOptions(friendshipId,events.signal);if(range.selectionMode!=='PET_RANDOM'||!Number.isSafeInteger(range.candidateCount)||range.candidateCount<0||!Array.isArray(range.eligibleKinds)||range.eligibleKinds.some(kind=>!['ITEM','OUTFIT'].includes(kind))||!Number.isSafeInteger(range.maxRarity)||range.maxRarity<1)throw new Error('可赠范围回执非法，未提交礼物。');$('gift-range').textContent=`候选${range.candidateCount}件 · 类别${range.eligibleKinds.join(' / ')} · 最高稀有度${range.maxRarity} · 试验规则。后台最终复核并一次冻结结果，不保证指定物品。`;if(!range.candidateCount)throw new Error('当前没有可赠礼物。');if(!confirm(`让宠物从${range.candidateCount}件候选中挑一件？类别${range.eligibleKinds.join(' / ')}，最高稀有度${range.maxRarity}。提交会锁定实际资产，下次真实双向遇见才送达，可在送达前取消。`))return;if(owner!==getSession()?.userId||friendshipId!==$('friend').value)throw new Error('账号或朋友改变，未提交。');const roundKey='m2-gift-round:'+encodeURIComponent(owner)+':'+friendshipId;let round=storage.getItem(roundKey);if(!round){round=crypto.randomUUID();storage.setItem(roundKey,round);}const result=await client.gift({friendshipId,selectionMode:'PET_RANDOM'},options('gift-random:'+round));storage.setItem(roundKey,'');$('gift-range').textContent=`宠物挑选结果已冻结 · ${result.assetId} · ${result.status}；未遇见前不会交付。`;return result;}, true);
  on('gift-cancel',()=>client.cancelGift(needed('gift-pending'),options('gift-cancel:'+needed('gift-pending'))),true);
  on('exchange', async () => { const result = await client.exchange({ encounterId: needed('encounter-id'), offeredAssetId: needed('asset'), ...($('requested-asset').value.trim() ? { requestedAssetId: $('requested-asset').value.trim() } : {}) }, options('exchange:' + needed('encounter-id') + ':' + needed('asset'))); $('exchange-id').value = result.id; }, true);
  on('exchange-confirm', () => client.exchangeAction(needed('exchange-id'), 'confirm', options('exchange-confirm:' + needed('exchange-id'))), true);
  on('exchange-cancel', () => client.exchangeAction(needed('exchange-id'), 'cancel', options('exchange-cancel:' + needed('exchange-id'))), true);
  on('learn', () => client.learning({ encounterId: needed('encounter-id'), skillId: needed('skill-id') }, options('learning:' + needed('encounter-id') + ':' + needed('skill-id'))), true);
  on('breed', () => client.breeding({ friendshipId: needed('friend'), encounterId: needed('encounter-id'), parentCatId: needed('parent'), peerParentCatId: needed('peer-parent') }, options('breed:' + needed('encounter-id'))), true);
  on('breed-accept', () => client.breedingConsent(needed('breeding'), true, options('breed-accept:' + needed('breeding'))), true);
  on('breed-reject', () => client.breedingConsent(needed('breeding'), false, options('breed-reject:' + needed('breeding'))), true);
  on('breed-cancel', () => client.breedingAction(needed('breeding'), 'cancel', options('breed-cancel:' + needed('breeding'))), true);
  on('breed-claim', async () => { const result = await client.breedingAction(needed('breeding'), 'claim', options('breed-claim:' + needed('breeding'))); if (result.save) await getCloud().acceptDeviceSave({ save: result.save, revision: result.revision }); }, true);
  const revoker=new EnvironmentRevoke({getOwner:()=>getSession()?.userId,getStorage,getDevice:device,getCloud:()=>snapshot?.environment,revokeCloud:async baseRevision=>{const value=await client.environment({baseRevision,isEnvironmentGranted:false});if(snapshot)snapshot.environment=value;return value;},onStatus:value=>{$('environment').checked=false;$('environment-status').textContent=value;}});
  const resumer=new EnvironmentResume({getOwner:()=>getSession()?.userId,getStorage,getBadge,readConsent:()=>api.request('/api/environment-consent',{signal:events.signal}),requireEligibility:()=>requireEligibility(api,'environment'),canRun:()=>!events.signal.aborted&&!document.hidden&&!isUiBusy()&&!polling&& !revoker.pending(),onError:error=>{storage.setItem('m2-pending-env-grant','true');$('environment').checked=false;$('environment-status').textContent='环境授权或设备恢复未确认，等待重试：'+error.message;},onConfirmed:value=>{if(snapshot)snapshot.environment=value;$('environment').checked=value.isEnvironmentGranted;$('environment-status').textContent=value.isEnvironmentGranted?'既有独立授权已核验，设备回执确认；未重新发起授权。':'服务器独立授权已关闭，设备关闭回执确认。';}});
  async function environment(granted) {
    if(!granted){revoker.mark();$('environment').checked=false;showList($('environment-events'),[],'已在手机隐藏标签，正在撤回。');if(!await revoker.flush())throw new Error('保持关闭，设备或云端撤回待重试。');return;}
    if(revoker.pending())throw new Error('请先同步待撤回，不能重新授权。');
    const owner=getSession()?.userId;await requireEligibility(api,'environment',value=>$('environment-status').textContent=value);if(owner!==getSession()?.userId)throw new Error('账号改变。');
    storage.setItem('m2-pending-env-grant','true');$('environment').checked=false;
    const value=await client.environment({baseRevision:snapshot?.environment?.revision??0,isEnvironmentGranted:true});
    if(snapshot)snapshot.environment=value;await device().environmentConsent(value);if(owner!==getSession()?.userId||revoker.pending())throw new Error('授权期间账号或撤回状态改变。');storage.setItem('m2-pending-env-grant','false');$('environment').checked=value.isEnvironmentGranted;
  }
  on('privacy-read',async()=>{const owner=getSession()?.userId;const value=await readEligibility(api);if(owner!==getSession()?.userId)return;$('privacy-status').textContent=`${value.status} · ${value.ageBand}（14_PLUS非成年）；位置${value.isLocationEligible?'合格':'关闭'} · 环境${value.isEnvironmentEligible?'合格':'关闭'} · ${value.expiresAt??'无可信有效期'}`;$('environment').disabled=!eligibilityAllows(value,'environment')&&!$('environment').checked;});
  on('peer-read',async()=>{const owner=getSession()?.userId,bridge=device();try{const state=await bridge.socialStatus();if(owner!==getSession()?.userId)return;for(const method of ['KNOCK','PATTERN'])$('method').querySelector(`option[value=${method}]`).disabled=!supportsMethod(state,method);$('peer-status').textContent=`${state.state} · 设备能力${state.capabilities}；可信身份未配置不开放暗号。`;if(encounter&&encounter.method!=='QR'){const {status,reference}=await bridge.peerProgress(encounter.id);if(owner!==getSession()?.userId)return;$('peer-status').textContent=status.state==='REFERENCE'?'请在发起方吧唧真实录入参考。':status.state==='FOLLOW'?'请在跟随方吧唧照参考输入。':`${status.state} · 原因${status.reason} · 双方实际匹配后方可提交证明。`;$('peer-reference').textContent=reference?(reference.method===2?'敲击间隔(ms)：':'九宫格点位：')+reference.values.join(' → '):'设备尚无真实参考。';}}catch(error){for(const method of ['KNOCK','PATTERN'])$('method').querySelector(`option[value=${method}]`).disabled=true;throw error;}});
  on('environment-save', () => environment($('environment').checked), true);
  on('environment-stop', () => environment(false), true);
  function environmentAllowed(){if(storage.getItem('m2-pending-env-grant')==='true'||storage.getItem('m2-pending-env-revoke')==='true'||!snapshot?.environment?.isEnvironmentGranted)throw new Error('环境未授权或撤回待同步；不能读取/上传旧标签，请先同步撤回。');}
  on('environment-read', async () => { environmentAllowed(); const state = await device().environmentStatus(); $('environment-status').textContent = state.isModelAvailable ? `${state.isActive ? '采集中' : '未采集'} · ${state.label} · 置信度${state.confidencePermille}/1000` : '设备无场景分类模型；UNKNOWN，不能据此证明安静或有效分类。'; });
  on('environment-sync', async () => { environmentAllowed(); const bridge = device(), event = await bridge.environmentEvent(); if (!event) { $('environment-status').textContent = '没有待同步真实签名标签。'; return; } const result = await client.environmentEvents({ consentRevision: snapshot?.environment?.revision, events: [event] }, options('environment:' + event.deviceId + ':' + event.id)); const terminal = result.results?.find(row => row.id === event.id); if (!terminal?.isTerminal) throw new Error('后台未持久终态确认；设备队列保留。'); await bridge.environmentAck(event.id); $('environment-status').textContent = terminal.msg || terminal.status; });
  $('environment-date').value = dateKey(Date.now());
  on('environment-day', async () => { environmentAllowed(); const day = await client.environmentDay(needed('environment-date')); showList($('environment-events'), day.events.map(row => `${row.time || row.timestamp || row.createdAt || ''} · ${row.label} · ${row.confidencePermille}/1000`), '当天无已授权真实标签。'); });
  async function personality() { const catId=snapshot?.pets?.list?.[0]?.catId;if(!catId)return; const result=await client.personality(catId); $('personality-status').textContent=`${result.status} · 试验人格维度：${Object.entries(result.dimensions??{}).map(([key,value])=>key+' '+value+'/1000').join(' · ')}${result.expression?.bubbleText?' · 小猫说：'+result.expression.bubbleText:''}`; }
  on('personality',personality);
  on('diaries', async () => { const result = await client.diaries(); showList($('diaries-list'), result.list.map(row => `${row.date} · ${row.source} · ${row.text}`), '还没有真实日记。'); });
  on('diary', async () => { const result = await client.diary({ catId: snapshot?.pets?.list?.[0]?.catId, date: dateKey(Date.now()), isTextCloudAllowed: $('diary-allow').checked }, options('diary:' + dateKey(Date.now()) + ':' + snapshot?.pets?.list?.[0]?.catId)); showList($('diaries-list'), [`${result.date} · ${result.source} · ${result.text}`], ''); $('diary-allow').checked = false; });
  const uploader=new UpdateUploader({api,getBadge,getOwner:()=>getSession()?.userId,storage,onProgress:value=>{ $('update-progress').max=value.size||1;$('update-progress').value=value.received; $('update-status').textContent=value.phase==='UNCONFIGURED'?'后台未配置可信签名制品，不能上传。':value.phase==='VERIFIED'?'设备已校验整包；固件不自动重启，实体升级与健康回滚仍需真机验证。':`${value.phase} · ${value.received}/${value.size}字节`; }});
  on('update',()=>uploader.run(needed('update-target')));
  $('update-cancel').addEventListener('click',()=>{uploader.cancel();$('update-status').textContent='手机已请求中止传输；设备已写数据可能保留至会话结束，本地取消不代表设备擦除或回滚，不声称升级完成。';},{signal:events.signal});
  $('dialog').addEventListener('close',()=>uploader.cancel(),{signal:events.signal});
  events.signal.addEventListener('abort',()=>uploader.cancel(),{once:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) { uploader.cancel(); polling?.abort(); scanner.stop(); $('video').hidden = true; } }, { signal: events.signal });
  let polling = null;
  async function poll() {
    checkOwner();
    if (polling || busy || getBadge()?.transport.pending || document.hidden || !$('dialog').open || !getSession() || !snapshot?.settings?.isDiscoverable) return;
    const owner = getSession().userId, generation = controller.generation, abort = new AbortController(); polling=abort;
    try {
      const result = await client.pendingEncounters(abort.signal);
      if(owner!==getSession()?.userId||generation!==controller.generation||!$('dialog').open)return;
      const pending=result.list?.[0];
      if(pending && pending.id!==encounter?.id) { const value=await client.encounterState(pending.id,abort.signal); if(owner!==getSession()?.userId||abort.signal.aborted)return; showEncounter(value); await device().challenge(value); }
      else if(encounter?.status==='PENDING') { const value=await client.encounterState(encounter.id,abort.signal); if(owner===getSession()?.userId&&generation===controller.generation)showEncounter(value); }
    } catch(error) { if(!abort.signal.aborted&&owner===getSession()?.userId)$('error').textContent=error.message; }
    finally { if(polling===abort)polling=null; }
  }
  let expressionPending=false,lastExpressionRead=0;
  async function readExpression(){if(expressionPending||busy||document.hidden||!$('dialog').open||!getSession()||!snapshot||Date.now()-lastExpressionRead<10000)return;expressionPending=true;lastExpressionRead=Date.now();try{await personality();}catch(error){if(getSession())$('personality-status').textContent=error.message;}finally{expressionPending=false;}}
  async function maintainAndPoll(){if(isUiBusy()||events.signal.aborted)return;checkOwner();if(!busy&&!polling&&!document.hidden&&!getBadge()?.transport.pending){busy=true;try{if(revoker.pending())await revoker.flush();else if(getBadge()?.session)await resumer.flush();}finally{busy=false;}}if(!events.signal.aborted){await poll();void readExpression();}}
   const timer = setInterval(()=>void maintainAndPoll(), 1000);
  events.signal.addEventListener('abort', () => { clearInterval(timer); polling?.abort(); scanner.stop(); controller.invalidate(); }, { once: true });
  render(controller.state);
  return { client, controller, get isBusy(){return busy||!!polling||revoker.busy;},get hasPendingRevoke(){return revoker.pending();}, invalidate: () => { scanner.stop(); controller.invalidate(); } };
}
