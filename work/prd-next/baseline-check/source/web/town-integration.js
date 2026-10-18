/* Presentation-only original-town entry over the unchanged original persistent pet store. */
(function(root){
 'use strict';const d=root.document,$=id=>d.getElementById(id);
 let town=null,active=false,disposed=false,preview=null,camera=null,focus=null,inert=[],entering=false,townLoading=null,entryEpoch=0,trip=null,cancelTimer=null,hudPortal=[],sceneRevision=0;
 function sceneChanged(reason){sceneRevision=Math.min(Number.MAX_SAFE_INTEGER,sceneRevision+1);root.dispatchEvent(new CustomEvent('cat-town-scene-change',{detail:{revision:sceneRevision,reason}}));}
 const notice=t=>{const node=$('town-experience-note');if(node)node.textContent=t;};
 const panel=d.createElement('dialog');panel.id='town-experience-menu';panel.setAttribute('aria-labelledby','town-experience-title');
 panel.innerHTML='<header><h2 id="town-experience-title">小镇体验</h2><button type="button" data-town-close aria-label="关闭小镇体验">×</button></header><div class="town-experience-body"><p>带自己的小猫逛原小镇：先看全貌，再跟随它。沿用原散步与事件结算；居民互动不代表真实吧唧相遇解锁。</p><button type="button" data-town-enter>进入原小镇</button><button type="button" data-town-preview>预览扩房与窗景</button><button type="button" data-town-restore hidden>结束房间预览</button><p id="town-experience-note" role="status">照料、衣柜、家庭仍按原规则运行。镇中散步沿用原散步目标与结算，扩房预览不消耗种子。</p></div>';
 d.body.append(panel);
 const rail=d.createElement('button');rail.type='button';rail.id='town-experience-entry';rail.setAttribute('aria-label','小镇体验，浏览原素材小镇');rail.innerHTML='<span aria-hidden="true">🏘</span>小镇';$('m-rail')?.prepend(rail);
 const desktop=d.createElement('button');desktop.type='button';desktop.className='pg-navsocial';desktop.textContent='🏘 小镇体验';d.querySelector('.town-nav')?.append(desktop);
 const banner=d.createElement('button');banner.type='button';banner.id='town-room-preview';banner.hidden=true;banner.textContent='房间扩展预览 · 点此结束';d.body.append(banner);
 function showMenu(){if(disposed||active)return;focus=d.activeElement;notice('照料、衣柜、家庭仍按原规则运行。镇中散步沿用原散步目标与结算，扩房预览不消耗种子。');panel.querySelector('[data-town-restore]').hidden=!preview;panel.showModal();}
 rail.addEventListener('click',showMenu);desktop.addEventListener('click',showMenu);
 panel.querySelector('[data-town-close]').addEventListener('click',()=>{entryEpoch++;panel.close();});
 panel.addEventListener('close',()=>focus?.focus?.());
 function ready(){
  if(disposed||d.hidden||entering)throw Error('请稍后再打开小镇。');
  const state=root.__petGame?.state();
  if(!state?.ready)throw Error('请先完成原游戏的小猫选择，等待房间出现。');
  if(state.busy||state.pet?.busy||root.CatOfflineDurable?.transactionPaused)throw Error('请先完成或取消当前互动，再打开小镇。');
  if(d.body.dataset.view==='world')throw Error('请先回家，再打开小镇体验。');
  if(d.querySelector('#life-ov.on,#sc-hub.on,#sc-meet.on,#bk-ov.on,#grad-ov.on,#pg-away.on'))throw Error('请先关闭眼前的页面，再打开小镇。');
  return state;
 }
 async function ensure(profile=root.__petGame.state().pet){
  if(town)return town;if(!townLoading)townLoading=(async()=>{const model=await root.CatTownTHREE.createPet({breed:profile.breed,outfit:profile.outfit||'none'});if(disposed){model.dispose();throw Error('页面已关闭。');}return town=root.CatOriginalTown.create({THREE:root.CatTownTHREE,renderer:root.__pgRoom.renderer,playerModel:model,playerProfile:profile,onHome:leave,onGarden:()=>{}});})().catch(error=>{townLoading=null;throw error;});return townLoading;
 }
 function cancelTrip(){
  if(!trip)return;if(town?.sessionComplete){trip=null;return;}const result=root.__petGame?.store.cancelWorldActivity(trip.token);if(result?.ok){trip=null;clearTimeout(cancelTimer);cancelTimer=null;return;}
  if(result?.code==='CARE_RUNTIME_BUSY'&&!d.hidden&&!disposed){clearTimeout(cancelTimer);cancelTimer=setTimeout(cancelTrip,200);}
 }
 async function enter(){
  const initial=ready();if(trip){cancelTrip();if(trip)throw Error('上一段散步正在结束，请稍后。');}entering=true;const epoch=++entryEpoch;let roomPaused=false;
  panel.querySelector('[data-town-enter]').disabled=true;notice('正在准备自己的小猫和原小镇…');
  try{
   const view=await ensure(initial.pet);const current=root.__petGame.state();
   if(disposed||d.hidden||epoch!==entryEpoch)return false;if(current.pet.id!==initial.pet.id)throw Error('当前小猫已变化，请重新进入。');
   root.__petGame.hostSuspend();root.__petGame.setRoomActive(false);roomPaused=true;
   const result=root.__petGame.store.beginWorldActivity('walk','garden');if(!result.ok)throw Error(result.message||'当前不能出门。');trip=result;
   active=true;d.body.dataset.townExperience='open';view.show({profile:current.pet,session:trip,store:root.__petGame.store});
   entering=false;panel.close();portalHud();sceneChanged('entered_town');
   inert=[...d.body.children].filter(n=>n.id!=='original-town').map(n=>[n,n.inert]);for(const[n]of inert)n.inert=true;
  }catch(error){cancelTrip();const restored=leave();if(roomPaused&&!restored&&!d.hidden&&!disposed){root.__petGame.hostResume();root.__petGame.setRoomActive(true);}throw error;}finally{entering=false;panel.querySelector('[data-town-enter]').disabled=false;}
 }
 function restoreHud(){for(const [node,parent,next]of hudPortal)parent.insertBefore(node,next?.parentNode===parent?next:null);hudPortal=[];}
 function portalHud(){for(const node of [d.querySelector('.masthead'),$('m-stats')].filter(Boolean)){hudPortal.push([node,node.parentNode,node.nextSibling]);$('original-town').append(node);}}
 function leave(options={}){
  if(!active&&!town?.active)return false;
  const resume=options.resume!==false;cancelTrip();
  try{if(preview&&town?.active)preview.setWindowPreview(town.captureOverview());}
  catch(error){notice('窗景未更新，原游戏存档未受影响。');}
  finally{
   restoreHud();town?.hide();active=false;d.body.dataset.townExperience='closed';sceneChanged('returned_to_original_scene');
   for(const[n,value]of inert)n.inert=value;inert=[];
   if(resume&&!d.hidden&&!disposed){root.__petGame?.hostResume();root.__petGame?.setRoomActive(true);}
   focus?.focus?.();
  }
  return true;
 }
 async function previewRoom(){
  const state=ready(),epoch=entryEpoch;await ensure(state.pet);if(d.hidden||disposed||epoch!==entryEpoch)return false;root.__petGame.setRoomActive(false);
  try{
   preview??=root.CatWorldRenderer.create({room:root.__pgRoom});
   preview.applyGrowth({expanded:true,windowScene:'street',source:'simulation_fixture'});
   preview.setWindowPreview(town.captureOverview());
  }catch(error){restoreRoom();throw error;}finally{town?.hide();}
  const r=root.__pgRoom;
  camera??={position:r.cam.position.clone(),target:r.ctl.target.clone(),far:r.cam.far,fov:r.cam.fov,max:r.ctl.maxDistance};
  r.cam.position.set(57,48,-78);r.ctl.target.set(7,6,1);r.cam.fov=80;r.cam.far=300;r.ctl.maxDistance=180;r.cam.updateProjectionMatrix();r.ctl.update();
  banner.hidden=false;panel.querySelector('[data-town-restore]').hidden=false;panel.close();root.__petGame.setRoomActive(true);r.renderPreviewFrame?.();
 }
 function restoreRoom(){
  if(!preview)return;preview.dispose();preview=null;
  const r=root.__pgRoom;if(camera&&r){r.cam.position.copy(camera.position);r.ctl.target.copy(camera.target);r.cam.far=camera.far;r.cam.fov=camera.fov;r.ctl.maxDistance=camera.max;r.cam.updateProjectionMatrix();r.ctl.update();}camera=null;banner.hidden=true;panel.querySelector('[data-town-restore]').hidden=true;
 }
 function invoke(fn){return()=>{const failed=error=>{notice(error?.message||'小镇暂时无法打开，请返回后重试。');if(!d.hidden&&!panel.open&&!active)panel.showModal();};try{Promise.resolve(fn()).catch(failed);}catch(error){failed(error);}};}
 panel.querySelector('[data-town-enter]').addEventListener('click',invoke(enter));panel.querySelector('[data-town-preview]').addEventListener('click',invoke(previewRoom));panel.querySelector('[data-town-restore]').addEventListener('click',restoreRoom);banner.addEventListener('click',restoreRoom);
 function suspend(){entryEpoch++;leave({resume:false});cancelTrip();if(panel.open)panel.close();}
 root.CatTownExperience=Object.freeze({sceneChanged,get sceneRevision(){return sceneRevision;},get active(){return active;},get projection(){return active?town?.playerProjection:null;},resume(){if(trip&&!active)cancelTrip();},handleBack(){if(active)return leave();if(panel.open){entryEpoch++;panel.close();return true;}return false;},suspend});
 root.addEventListener('pagehide',()=>{if(disposed)return;suspend();restoreRoom();disposed=true;clearTimeout(cancelTimer);town?.dispose();},{once:true});
})(window);
