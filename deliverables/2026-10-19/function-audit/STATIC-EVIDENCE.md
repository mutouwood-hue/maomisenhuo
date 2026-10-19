# 静态证据摘录

仅以文件读取、ZIP读取、字符串查找与文本一致性比较记录证据；未执行应用代码、构建、单元测试、lint、交互或设备操作。

APK：`deliverables/2026-10-19/cat-scene-expansion/catforest-0.5.3-scene-expansion-debug.apk`；其SHA-256（只读计算）：`9f0b0429ea1303d7d7a2387beb5d67a8382a5a13326f76f14a9e10b67b43683e`。

## APK静态事实

- 053 APK assets/game-08.js与当前Android资产相同：true。
- 没有hostPlanDeviceEncounter标识符：true。
- 没有nativeEncounterHelp标识符：true。
- 仍包含BroadcastChannel原型：true。
- 仍包含已取消的手机扫码相遇入口：true。

## app/scripts/build_assets.py

```text
185:     js = instrument_device_page(js, once)
186:     if 'window.__petGame={store:Nt' not in js:
187:         return js
```

```text
201:     if 'function vu(' in js:
202:         runtime=(ROOT/'scripts/care-runtime.cjs').read_text().split('// END EMBEDDED INSTALL')[0]
203:         assert 'function __hostInstallCareRuntime(' in runtime
204:         js=once(js,'return{hostDeviceCare:','const __hostApi={hostDeviceCare:','gate-original-public-writers-during-device-result-lease')
205:         js=once(js,'adoptCat:$e}}/**','adoptCat:$e};'+runtime+'return __hostInstallCareRuntime(__hostApi,{identity:()=>JSON.stringify([o.createdAt,o.activeCatId,o.cats.map(C=>[C.id,C.joinedAt])]),read:()=>p,replace:value=>{p=value},clock:e,cooldowns:Hf,activeCatId:()=>o.activeCatId,keys:()=>o.cats.flatMap(C=>[...Bo,"clinic"].map(Y=>C.id+":"+Y)),hydrate:Ue,seed:hostRuntime});}/**','expose-original-care-runtime-and-owned-device-hydration')
206:     return instrument_encounters(js,ROOT)
```


## app/scripts/encounter_patches.py

```text
2: def instrument_encounters(js,root):
3:     if 'function completeMeet(peer,how,extra={}){' not in js:return js
4:     if 'function hostPlanDeviceEncounter(' in js:return js
```

```text
14:     replace('function completeMeet(peer,how,extra={}){',helper+'function completeMeet(peer,how,extra={}){\n  if(peer.src!==\'npc\')throw Error(\'真实吧唧相遇须由持久设备收据结算\');')
15:     replace("const air=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('pg-badge-air'):null;","const air=null; /* Browser windows never stand in for physical badges. */")
16:     replace('function openMeet(fid,tab){const p=peerOf(fid);',"function openMeet(fid,tab){if(String(fid).startsWith('device:')){toast('请在双方吧唧上对暗号，完成后会自动同步到这里。');return;}const p=peerOf(fid);")
17:     replace("const tabs=[['rhythm','敲暗号'],['dots','连点暗号'],['qr','扫码兜底']];if(D.cfg.fate&&!f)tabs.push(['fate','缘分擦肩']);","const tabs=[['rhythm','敲暗号'],['dots','连点暗号']];")
```

```text
35:     a=js.index('function worldGrow(');b=js.index('/* ---------- 整理小家：',a)
36:     body=js[a:b]
37:     body=body.replace('function worldGrow(f,how,isNew){const d=today();d.world=d.world||0;const day=dk(new Date());','function worldGrow(f,how,isNew,ctx){if(f.src!==\'native_device\')return {skip:\'source\'};const target=ctx?.data||D,d=ctx?.daily||today();d.world=d.world||0;const day=ctx?.day||dk(new Date());')
38:     body=body.replace('D.world','target.world').replace('D.me.id','target.me.id').replace('wCap(day)','wCap(day,target)').replace('t:Date.now(),day,','t:ctx?.at||Date.now(),day,source:\'native_device\',eventId:ctx?.event?.eventId||null,')
39:     body=body.replace('const S=worldState();','const S=worldState(target);')
40:     body=body.replace('saveD();\n  try','if(ctx)return {tier,frag:fr};saveD();\n  try')
41:     js=js[:a]+body+js[b:]
42:     # Keep original social pages. Add real-device evidence before NPC interaction.
43:     replace('function near(){const d=today();const me=P();', 'function near(){const d=today();const me=P();')
44:     replace('return `<section class="sc-hero"><div class="sc-radar"', 'return nativeEncounterHelp()+`<details><summary>游戏角色互动（不是真实吧唧相遇）</summary><section class="sc-hero"><div class="sc-radar"')
45:     replace('吧唧用蓝牙广播匿名 ID，约 3 米内判定「遇见」，会震动 + 提示音 + 屏幕边缘发光。默认只展示宠物形象，主人匿名。','以下是游戏角色互动，不表示附近存在真实设备，不计入真实相遇世界成长。')
46:     replace('<button type="button" class="g-btn ghost" data-h="code">📷 扫码 / 输入遇见码</button>','')
47:     replace('<div class="lf-row"><button type="button" class="g-btn ghost" data-h="slotb">👥 双人试玩：打开玩家 ${window.__pgSlot===\'B\'?\'A\':\'B\'} 窗口</button></div>','')
```

```text
61:     replace("const h=t.closest('[data-h]')?.dataset.h;", "const h=t.closest('[data-h]')?.dataset.h;if(t.closest('[data-native-device]')){closeHub();window.CatOfflineHost?.openDevice();return;}")
62:     js=js.replace('window.__pgSocial={D,','window.__pgSocial={D,hostPlanDeviceEncounter,')
63:     replace('function friendProgress(D,peer,how,extra,now,d){', (root/'web/device-encounter-plan.inc.js').read_text()+'\nfunction friendProgress(D,peer,how,extra,now,d){')
```


## app/web/offline-device-events.js

```text
52:     else if(event.kind==='encounter'){
53:       if(!planEncounter)throw fail('真实相遇结算接口尚未准备好，设备事件保留。');
54:       encounter=planEncounter(d,event,now());
```

```text
118:             phase='plan';const planned=plan({event,game,social,createStore:source.createStore,now,runtime:source.readCareRuntime(),planEncounter:source.planEncounter});
```

```text
137:           phase='confirm_receipt';source.assertHealthy();ledger.assertHealthy();durable.confirm(receipt);if(!valid())return {processed:true,acknowledged:false};
138:           // Only a receipt whose original game AND social images completed can
139:           // reach the adapter. Source/storage errors are never quarantined.
140:           if(s.hello?.capabilities?.includes('care_receipt_v1')&&receipt.reason===undefined)throw fail('此历史收据未保存原终态原因，已保留设备事件，不能猜测或重新结算。','EVENT_HISTORY_MISSING');
141:           phase='ack';fault('before-ack');const reply=await ports.events.acknowledge({eventId:event.eventId,status:duplicate?'duplicate':receipt.status,originalStatus:receipt.status,reason:receipt.reason??(receipt.status==='applied'?'none':'ineligible'),persisted:true,saveDigest:receipt.saveDigest});
142:           if(reply?.status!=='device_persisted'||reply.eventId!==event.eventId)throw fail('设备尚未持久确认事件移出队列。');
143:           fault('acknowledged');onResult({stage:receipt.status,message:receipt.message,eventId:event.eventId,duplicate});return {processed:true,acknowledged:true};
144:         } catch(error){if(error&&typeof error==='object'){error.syncPhase=phase;error.eventCounter=eventCounter;}throw error;} finally {busy=false;}
```

```text
169:       wire:s=>root.CatOfflineSceneMap.read({deviceId:s.hello.deviceId,hasSnapshot:s.device?.hasSnapshot===true,snapshotPetId:s.device?.snapshot?.petId}),
170:       createStore:options=>g.hostCreateStore(options),
171:       planEncounter:(data,event,at)=>root.__pgSocial.hostPlanDeviceEncounter(data,event,at),
```


## app/android/app/src/main/assets/game-08.js

```text
214: /* ---------- 附近的人：官方 NPC 路过 + 同一浏览器其他窗口（BroadcastChannel 模拟 BLE 广播） ---------- */
215: const peers=new Map();
216: const air=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('pg-badge-air'):null;
217: function meCard(){const p=P();const r=myRegion();return {fid:D.me.id,owner:'匿名主人',petName:p?.name||'小橘',breed:p?.breed||'orange',sex:p?.sex||'male',outfit:p?.outfit||'none',stage:p?.stage||'kitten',region:r.id,regionInfo:r,skills:ownSkills(),persona:persona(),cards:giveableCards().slice(0,12)}}
```

```text
385:   const sameDay=f.meets.filter(t=>dk(new Date(t))===dk(new Date())).length;
386:   const gain=isNew?30:Math.max(1,Math.round(10*Math.pow(.5,sameDay)));const lines=[];f.pts+=gain;
```

```text
406:   const wg=worldGrow(f,how,isNew);if(wg.frag)lines.push(['🌱',`相遇世界 · ${W_TIER[wg.tier]}：${wg.frag.t}`]);else if(wg.skip==='cap')lines.push(['🌱',`今天的相遇世界已经长满 ${wCap()} 次，明天再来`]);else if(wg.skip==='same')lines.push(['🌱','今天已经和它种过种子了，世界不再重复生长']);
407:   /* NPC 当场带来它的礼物 */
```

```text
623: function worldGrow(f,how,isNew){const d=today();d.world=d.world||0;const day=dk(new Date());D.world.log=D.world.log||[];
624:   if(D.world.log.some(e=>e.fid===f.fid&&e.day===day))return {skip:'same'};
625:   if(d.world>=wCap(day))return {skip:'cap'};
626:   const tier=how==='fate'?'big':isNew?'mid':'small';
627:   const seed=hash([D.me.id,f.fid].sort().join('|')+'|'+day+'|'+how);
628:   D.world.log.push({t:Date.now(),day,fid:f.fid,name:f.petName,breed:f.breed,how,tier,seed});d.world++;D.world.unseen=(D.world.unseen||0)+1;
629:   const S=worldState();const fr=S.frags[S.frags.length-1];saveD();
630:   try{buildWorld3D()}catch(e){}
631:   track('world_grow',{tier,frag:fr.k,how});
632:   setTimeout(()=>toast(`🌱 相遇世界：${fr.t}`),900);
```

```text
794: function near(){const d=today();const me=P();
795:   return `<section class="sc-hero"><div class="sc-radar" id="sc-radar"></div><div class="sc-nearside"><p class="lf-note">吧唧用蓝牙广播匿名 ID，约 3 米内判定「遇见」，会震动 + 提示音 + 屏幕边缘发光。默认只展示宠物形象，主人匿名。</p>
796:   <div class="lf-row"><button type="button" class="g-btn" data-h="spawn">🔍 找找附近的小猫</button><button type="button" class="g-btn ghost" data-h="code">📷 扫码 / 输入遇见码</button></div>
797:   <div class="lf-row"><button type="button" class="g-btn ghost" data-h="slotb">👥 双人试玩：打开玩家 ${window.__pgSlot==='B'?'A':'B'} 窗口</button></div>
798:   <p class="sc-small">今日遇见提醒 ${d.alerts} / ${D.cfg.alertCap} · ${D.cfg.discover?(D.cfg.scope==='spots'?'只在外出 / 据点时可被发现':'随处可被发现'):'已隐身，不会被发现也不会提醒'}</p></div></section>
799:   <section class="lf-sec"><h4>附近的小猫 <small>按信号强弱估算距离</small></h4><div id="sc-plist" class="sc-plist"></div></section>
800:   ${echoes()}`}
```


## app/preview/game-06.js

```text
954:   const a=e.target.closest('[data-act]')?.dataset.act;
955:   if(a==='replay')replay();
956:   if(a==='sync'){L.cfg.sync=!L.cfg.sync;L.saveCfg();render();syncNow(true);track('life_sync',{on:L.cfg.sync})}
957:   if(a==='claim'){const pts=L.points(L.day()),v=pts.reduce((s,p)=>s+p.v,0);L.store.save(L.store.KEY.claim,L.dayKey(new Date()));
958:     try{game().store.lifeLog('life',`${petName()}把你今天的经历换成了行动点：${pts.map(p=>p.icon+p.name).join('、')}。`,Math.min(12,v),Math.min(20,v*2))}catch{}
959:     L.toast(`领取成功：心情 +${Math.min(12,v)} · 喵币 +${Math.min(20,v*2)}`);render();track('life_claim',{v})}
960:   if(a==='wipe'){if(!confirm('清除定位采样、心动时刻和生活设置？游戏存档不受影响。'))return;L.geoStop();L.geoClear();['mom','names','claim','cfg'].forEach(k=>localStorage.removeItem(L.store.KEY[k]));Object.assign(L.cfg,{sync:false,geo:false,voice:false,demo:true});L.saveCfg();L.toast('生活数据已清除');render();syncNow(true)}
```


## app/web/offline-event-store.js

```text
24:   const KEY='cat-cflocal2-event-ledger-v1',GAME='pixel-cat-pet-v1',SOCIAL='pg-social-v1';
25:   const IDENTITY='cat-cflocal2-source-identities-v1',JOURNAL='cat-cflocal2-journal-v1';
26:   const MEMORIAL='cat-cflocal2-memorial-v1',PHOTO_PREFIX='pet-grad-photo:';
27:   const MANAGED=[GAME,SOCIAL,IDENTITY,JOURNAL,MEMORIAL],LIMIT=4096;
28:   const MAX_PHOTO=160_000,MAX_MEMORIAL=1_200_000,MAX_PHOTOS=64;
```


## app/web/offline-device-backup.js

```text
50:  function createBridge({storage,ledger,source,originalExport,durable,uuid=()=>globalThis.crypto.randomUUID(),connected=()=>false,reload=()=>{}}){
51:    const read=k=>{const raw=storage.getItem(k);return raw===null?null:JSON.parse(raw);};
52:    return {
53:      exportData(){
54:        if(durable?.required)durable.assertHealthy();source.assertHealthy();const game=JSON.parse(originalExport());
55:        const metadata={schema:2,ledger:ledger.snapshot(),identity:read(db.IDENTITY),adapter:read(db.JOURNAL),social:read(db.SOCIAL),memorial:db.collectMemorial(storage,game)};
56:        const binding=db.sha256(db.canonical({game,metadata}));game.__cflocal2Backup={...metadata,binding};
57:        return JSON.stringify(game,null,2);
58:      },
59:      async restore(raw){
60:        durable.assertHealthy();
61:        if(connected()||source.busy())fail('请先结束互动并断开吧唧，再导入存档。');
```


## firmware/main/local2_core.c

```text
125: bool l2_bath_allowed(const l2_core_t *c){return c&&c->ready&&!c->storage_error&&c->saved.has_owner&&c->bath_allowed_owner[0]&&!strcmp(c->bath_allowed_owner,c->saved.last_request.client_id);}
126: l2_status_t l2_confirm_bath(l2_core_t *c,const char *client_id,uint32_t session){
127:  l2_status_t a=available(c);if(a!=L2_OK)return a;
128:  if(!uuid(client_id)||!session)return L2_INVALID;
129:  if(!c->saved.has_owner||!c->saved.has_snapshot)return L2_NOT_READY;
130:  if(strcmp(client_id,c->saved.last_request.client_id))return L2_OWNER_CONFLICT;
131:  strcpy(c->bath_allowed_owner,client_id);c->bath_confirmed_session=session;return L2_OK;
132: }
133: l2_status_t l2_emit_care(l2_core_t *c,l2_action_t type,uint64_t ms){l2_status_t a=available(c);if(a!=L2_OK)return a;if((type!=L2_ACTION_PET&&type!=L2_ACTION_FEED&&type!=L2_ACTION_WATER&&type!=L2_ACTION_BATH&&type!=L2_ACTION_PLAY&&type!=L2_ACTION_SLEEP) || ms>L2_JS_MAX)return L2_INVALID;if(type==L2_ACTION_BATH&&!l2_bath_allowed(c))return L2_NOT_READY;if(!c->saved.has_snapshot)return L2_NOT_READY;if(c->saved.event_count==L2_EVENT_MAX)return L2_QUEUE_FULL;if(c->saved.next_event>=L2_JS_MAX)return L2_INVALID;c->work=c->saved;l2_event_t *e=&c->work.events[c->work.event_count++];memset(e,0,sizeof(*e));e->counter=c->work.next_event++;e->epoch_ms=ms;e->kind=L2_EVENT_CARE;e->action=type;e->peer_slot=255;a=commit(c);if(a==L2_OK)c->care_change++;return a;}
```


## firmware/main/badge_appearance.c

```text
11: bool badge_appearance_from_names(badge_appearance_t *out,const char *growth,const char *breed,const char *outfit,const char *body)
12: {
13:  static const char *const stages[]={"adult","kitten","young"};
14:  static const char *const breeds[]={"orange","silver","tuxedo","siamese","ragdoll","blue","calico","golden","starry"};
15:  static const char *const outfits[]={"none","bandana","bow","cap","raincoat","backpack","scarf","sakura","bell","crown","cape","wings"};
16:  static const char *const bodies[]={"standard","slim","round"};
```

```text
34: bool badge_appearance_outfit_supported(badge_outfit_t outfit)
35: {
36:  return outfit==BADGE_OUTFIT_NONE||outfit==BADGE_OUTFIT_BOW||outfit==BADGE_OUTFIT_BANDANA||outfit==BADGE_OUTFIT_BACKPACK||outfit==BADGE_OUTFIT_WINGS;
```
