/* Read-only game projection plus a separate durable wire-identity registry. No game writes, rewards or ACK. */
(() => {
  'use strict';
  const actions = {idle:'idle',walk:'walk',pet:'pet',feed:'feed',drink:'water',bath:'bath',tease:'play',play:'play',climb:'walk',sleep:'sleep'};
  function project(state, event = null, companion = null) {
    if(!state?.ready || !state.pet?.id || !state.pet.stats || state.pet.storageIssue)return null;
    const pet=state.pet, life=state.life;
    const outdoors=life?.view==='world';
    const world=outdoors?life.world:null;
    const following=!outdoors&&companion?.out===true;
    const scene=outdoors?(life.entering?'departing':world?.phase==='settling'?'returning':'away'):following?'away':'home';
    const action=outdoors?(world?.phase==='walking'||world?.autonomousPose==='walk'?'walk':'idle'):
      following?'idle':state.mini?.running?'play':actions[state.room?.currentAction]||'idle';
    // Current HTML has simulated rain encounters, no snow source or live weather.
    const weather=outdoors&&event?.type==='rain'?'rain':'clear';
    const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):null;
    const snapshot={petId:String(pet.id),scene,action,weather,pet:{name:pet.name,breed:pet.breed,
      food:number(pet.stats.food),mood:number(pet.stats.mood),clean:number(pet.stats.clean),energy:number(pet.stats.energy),health:number(pet.health),coins:Number.isSafeInteger(pet.coins)&&pet.coins>=0?pet.coins:null}};
    // Display only: consume the existing game stage/outfit, never derive age or
    // body shape from care stats. Unknown appearance is omitted as one group.
    const growthStage=pet.stage==='baby'?'kitten':pet.stage;
    if(['kitten','young','adult'].includes(growthStage)&&typeof pet.outfit==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(pet.outfit)){
      Object.assign(snapshot.pet,{growthStage,outfit:pet.outfit,bodyShape:['standard','slim','round'].includes(pet.bodyShape)?pet.bodyShape:'standard'});
    }
    if(Object.values(snapshot.pet).some(value=>value===null||value===undefined))return null;
    return snapshot;
  }
  const IDENTITY_KEY='cat-cflocal2-source-identities-v1';
  const unsafe=(code,message)=>Object.assign(new Error(message),{code});
  function createIdentityRegistry({storage,uuid}){
    let seen=false;
    function load(){
      let raw;try{raw=storage.getItem(IDENTITY_KEY);}catch{throw unsafe('SOURCE_IDENTITY_STORAGE','无法读取手机宠物身份记录，未发送场景。');}
      if(raw===null){if(seen)throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份记录已丢失，暂停同步。');return {schema:1,cats:[],bindings:{}};}
      let value;try{value=JSON.parse(raw);}catch{throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份记录损坏，已保留原内容。');}
      if(value?.schema!==1||!Array.isArray(value.cats)||value.cats.length>256||!value.bindings||typeof value.bindings!=='object'||Array.isArray(value.bindings)||Object.keys(value.bindings).length>32)throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份记录不支持，暂停同步。');
      const fingerprints=new Set(),ids=new Set();
      for(const row of value.cats){if(typeof row?.fingerprint!=='string'||!/^cat-[0-9a-f-]{36}$/i.test(row.id)||fingerprints.has(row.fingerprint)||ids.has(row.id))throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份记录无效，暂停同步。');fingerprints.add(row.fingerprint);ids.add(row.id);}
      for(const [id,fingerprint] of Object.entries(value.bindings))if(!/^[0-9a-f]{32}$/.test(id)||!fingerprints.has(fingerprint))throw unsafe('SOURCE_IDENTITY_STORAGE','吧唧绑定记录无效，暂停同步。');
      seen=true;return value;
    }
    function write(value){const raw=JSON.stringify(value);try{storage.setItem(IDENTITY_KEY,raw);if(storage.getItem(IDENTITY_KEY)!==raw)throw Error();}catch{throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份未确认保存，未发送场景。');}seen=true;}
    return {resolve(pet,context){
      if(!Number.isSafeInteger(pet.createdAt)||pet.createdAt<=0||!Number.isSafeInteger(pet.joinedAt)||pet.joinedAt<=0||typeof pet.id!=='string'||!pet.id)throw unsafe('SOURCE_IDENTITY_INVALID','原存档缺少猫的来源身份，暂停同步。');
      const deviceId=context?.deviceId;
      if(!/^[0-9a-f]{32}$/.test(deviceId))throw unsafe('SOURCE_IDENTITY_INVALID','吧唧身份尚未确认。');
      const fingerprint=JSON.stringify([pet.createdAt,pet.id,pet.joinedAt]);
      const value=load(),bound=value.bindings[deviceId];
      if(bound&&bound!==fingerprint)throw unsafe('SOURCE_IDENTITY_CHANGED','检测到重开、导入或换猫。需先处理原猫与旧设备事件，当前暂停同步。');
      let cat=value.cats.find(row=>row.fingerprint===fingerprint);
      if(context.hasSnapshot&&(!cat||cat.id!==context.snapshotPetId))throw unsafe('SOURCE_IDENTITY_CHANGED','设备已有另一份宠物身份；暂停覆盖，需先处理旧猫与事件。');
      if(!cat){
        if(value.cats.length>=256)throw unsafe('SOURCE_IDENTITY_STORAGE','手机宠物身份记录已满。');
        const id=uuid();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw unsafe('SOURCE_IDENTITY_STORAGE','无法建立稳定宠物身份。');
        cat={fingerprint,id:'cat-'+id};value.cats.push(cat);
      }
      if(!bound){if(Object.keys(value.bindings).length>=32)throw unsafe('SOURCE_IDENTITY_STORAGE','吧唧身份绑定已满。');value.bindings[deviceId]=fingerprint;write(value);}
      return cat.id;
    }};
  }
  let identities=null;
  function read(context){
    if(window.CatOfflineDurable?.required){window.CatOfflineDurable.assertHealthy();if(window.CatOfflineDurable.eventLocked)throw unsafe('EVENT_IN_FLIGHT','设备结果尚在持久提交，暂停场景采样。');}
    if(window.CatOfflineEventStorageError)throw window.CatOfflineEventStorageError;
    window.CatOfflineEventLedger?.assertHealthy();
    const state=window.__petGame?.state();
    if(state?.pet?.storageIssue)throw unsafe('SOURCE_SAVE_UNSAFE','手机原存档未确认保存，请先导出备份并修复存档；场景同步已暂停。');
    // Original life-v5 applies a separate companion overlay without changing life.view.
    // Missing/unapplied projection must wait; never infer its private recall timer.
    const companion=window.__pgLife?.hostCompanionState?.();
    const town=window.CatTownExperience?.projection;
    const inTown=town?.source==='town-original-store'&&town.petId===state?.pet?.id;
    if(!inTown&&state?.life?.view!=='world'&&(!companion||companion.schema!==1||companion.source!=='life-v5-applied'||typeof companion.out!=='boolean'||!['demo','automatic'].includes(companion.mode)))return null;
    const snapshot=project(state,window.__pgLife?.hostWorldEvent?.(),companion);if(!snapshot)return null;
    identities??=createIdentityRegistry({storage:window.localStorage,uuid:()=>window.crypto.randomUUID()});
    snapshot.revision=window.CatTownExperience?.sceneRevision||0;
    if(context?.capabilities?.includes('scene_places_v1')&&snapshot.scene==='away')snapshot.scene='garden';
    if(inTown){snapshot.scene=context?.capabilities?.includes('scene_places_v1')?(town.region==='garden'?'garden':'town'):'away';snapshot.action=town.action==='walk'?'walk':'idle';snapshot.weather=town.weather==='rain'?'rain':'clear';}
    // The appearance travels with THIS resolved wire identity, not pet.id or
    // any separate display module's local cat-1 identifier.
    snapshot.petId=identities.resolve(state.pet,context);return snapshot;
  }
  window.CatOfflineSceneMap=Object.freeze({project,read,createIdentityRegistry,IDENTITY_KEY});
})();
