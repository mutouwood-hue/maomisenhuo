#!/usr/bin/env python3
"""Package the complete corrected HTML; fail closed when lifecycle hook anchors change."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys
from prd_experience_patches import instrument_experience

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(ROOT/'scripts/build_town.py')],check=True)
subprocess.run([sys.executable,str(ROOT/'scripts/build_town_components.py')],check=True)
source = (ROOT / 'original/game.html').read_text()
digest = lambda data: hashlib.sha256(data).hexdigest()
assets = ROOT / 'android/app/src/main/assets'
assets.mkdir(parents=True, exist_ok=True)
manifest = {'sourceSha256': digest(source.encode()), 'scripts': [], 'patches': []}

def once(text, old, new, name):
    assert text.count(old) == 1, f'{name}: source anchor changed'
    manifest['patches'].append(name)
    return text.replace(old, new, 1)

def instrument(js):
    js = instrument_experience(js, once, ROOT)
    if 'function Ss(' in js:
        js=once(js,'async function Ss({breed:i="orange",outfit:e="none"}={})','async function Ss({breed:i="orange",outfit:e="none",stage:hostStage="adult"}={})','stage-aware-original-model-factory')
        js=once(js,'function ae(j={}){let Te=', 'function ae(j={}){if(j.stage)hostStage=j.stage;let Te=','appearance-carries-growth-stage')
        js=once(js,'))}}let Ye=["white_chin"', '))}window.CatPetGrowth?.apply(a,hostStage)}let Ye=["white_chin"','growth-after-original-pose-no-accumulation')
        js=once(js,'applyAnimation:Fe,setMouth:me,','applyAnimation:Fe,setStage:value=>{hostStage=value},setMouth:me,','expose-model-growth-without-rebuilding-accessories')
        start=js.index('function ee(j){',js.index('function Ss('));end=js.index('function ae(',start)
        js=once(js,js[start:end],(ROOT/'web/approved-accessory-function.inc.js').read_text(),'approved-bow-bandana-retain-other-eight-outfits')
    if 'async function Mf(' in js:
        start=js.index('Ee={butterfly:',js.index('function G(){if(ge||!re'))+3
        end=js.index(',[We,ht,bt]=Ee[Ne]',start)
        catalogue=js[start:end]
        js=once(js,'async function Mf(', 'window.CatTownEventCatalogue=(n={})=>('+catalogue+');async function Mf(', 'reuse-authored-outdoor-event-catalogue-for-town')
    if 'async function bf(' in js:
        # Room and town share one canvas. Suspending only RAF leaves these
        # original room inputs live and can dispatch care from a town tap.
        for handler in ['hu','uu','du','fu']:
            js=once(js,'function '+handler+'(v){','function '+handler+'(v){if(!vi||gn)return;','pause-room-input-'+handler+'-with-room-renderer')
        js=once(js,'function zf(v){gn||(vi=!!v,','function zf(v){gn||(vi=!!v,d.enabled=vi,vi||oc(),','pause-room-orbit-controls-and-clear-pointer-with-room-renderer')
        js=once(js,'return De=v,N=Pr[v],ac()','return De=v,z.setStage(v),N=Pr[v],ac()','original-room-stage-updates-bone-proportions')
        start=js.index('let b=u(E,[14,1.1,12]')
        end=js.index('let F=E.children.flatMap',start)
        js=once(js,js[start:end],'let __bed=window.CatOfflineBed.build({group:E,box:u}),b=__bed.frame,I=__bed.mattress,A=__bed.blanket;', 'replace-small-bed-with-supported-full-size-bed')
        js=once(js,'m=new L(-14.5,3.22,11)','m=new L(...window.CatOfflineBed.config.landing)','move-bed-landing-inside-room')
        start=js.index('function st(v){');end=js.index('function at(){',start)
        js=once(js,js[start:end],'function st(v){window.CatOfflineBed.pose({amount:v,bones:_e,model:z,inner:ge,root:ne,scale:G,stage:De,Vector:L,Box:Xt});si=v;sn="sleep"}', 'supported-side-rest-pose-with-head-on-pillow')
        start=js.index('P.phase==="走向床边"?',js.index('function jt(v)'))
        end=js.index('P.phase==="床上入睡"?',start)
        js=once(js,js[start:end],'P.phase==="走向床边"?Ke(new L(0,wt.y,-5),v,5.5)&&lt(m.clone(),Math.PI/2,"床上入睡"):', 'approach-new-bed-without-floor-circles-through-frame')
        js=once(js,'P.phaseTime>.85&&(xt(Math.atan2(-12,12.3),2.5),dt("转向下床"))','P.phaseTime>.85&&lt(wt.clone(),0,"回家")','jump-down-before-turning-to-avoid-bed-edge')
        js=once(js,'P.phase==="转向下床"?Mt(v)&&(P.sleepTurn=null,lt(new L(0,wt.y,-1.3),0,"回家")):','','remove-obsolete-on-bed-turn')
        js=once(js,'else if(window.__pgQuirk?.on)', 'else if(window.CatDialogue?.poseActive){V.position.copy(wt);Fe(\"idle\",pt);window.CatDialogue.pose(_e,z,pt);sn=\"idle\";ri=window.CatDialogue.bubble}else if(window.__pgQuirk?.on)', 'dialogue-whitelist-presentation-without-store-actions')
        js=once(js,'function ou(v){if(yt=!1,','function ou(v){window.CatOfflineBed.reset(z);if(yt=!1,','restore-resting-whiskers-before-every-animation-frame')
        js=once(js,'function at(){ne.updateWorldMatrix','function at(){if(Math.abs(ge.rotation.z)>.001)return;ne.updateWorldMatrix','do-not-apply-upright-paw-offset-to-side-rest')
        js=once(js,'if((De==="kitten"||De==="baby")&&_e.get("head").scale.multiplyScalar(1.065),', 'if((De==="kitten"||De==="baby")&&sn!=="sleep"&&_e.get("head").scale.multiplyScalar(1.065),','apply-kitten-head-scale-once-in-sleep-pose')
    if 'dock.hidden=busy||' in js:
        js=once(js,"if(v==='home'){ if(mode==='panel'||mode==='world') closeSheet(true); }","if(v==='home'){ if(mode==='panel'||mode==='world') closeSheet(true); }",'retain-original-home-sheet-transition')
        js=once(js,"else openSheet('panel');\n  }", "else openSheet('panel');\n    sync();\n  }", 'refresh-care-dock-on-route-transition')
        js=once(js,"applyLayout();setInterval(sync,400);sync();", "applyLayout();new MutationObserver(sync).observe($('interaction-panel'),{attributes:true,attributeFilter:['hidden']});new MutationObserver(sync).observe($('care-shortcuts'),{attributes:true,attributeFilter:['hidden']});setInterval(sync,400);sync();",'refresh-care-dock-on-actual-interaction-and-shortcut-state')
    if 'function vu(' in js:
        js=once(js,'function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{}}={})',
            'function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{},hostRuntime}={})','accept-isolated-original-care-runtime')
        js=once(js,'function T(C,Y){return{ok:!1,message:Y,','function T(C,Y,reason="ineligible"){return{ok:!1,reason,message:Y,','original-care-errors-explicit-reason')
        js=once(js,'T(C,C==="feed"?"小鱼干需要 3 枚喵币，接鱼、户外探险和出售收获都能赚钱。":"洗澡需要 2 枚喵币，接鱼、户外探险和出售收获都能赚钱。")','T(C,C==="feed"?"小鱼干需要 3 枚喵币，接鱼、户外探险和出售收获都能赚钱。":"洗澡需要 2 枚喵币，接鱼、户外探险和出售收获都能赚钱。","insufficient_coins")','original-insufficient-funds-terminal-reason-no-rule-change')
        device_care = 'hostDeviceCare:C=>{if(!["feed","drink","bath","tease","pet","sleep"].includes(C))return T(C,"未知设备照料，不发放奖励。");return se(C)||(C==="pet"||C==="sleep"?ye(C):Z(C)||be(C))},'
        js = once(js, 'return{socialGrant:__pgSG,', 'return{'+device_care+'socialGrant:__pgSG,', 'reuse-original-care-rules-for-physically-completed-device-event')
        js = once(js, '!document.hidden&&!zn&&Nt.tick(e)', '!document.hidden&&!zn&&!globalThis.CatOfflineDurable?.transactionPaused&&Nt.tick(e)', 'pause-original-stat-tick-during-native-transaction')
        js = once(js, 'i.setItem(mu,JSON.stringify(o))', 'i.setItem(mu,JSON.stringify(globalThis.CatOfflineDurable?.stampGame(o)||o))', 'retain-native-event-commit-marker-in-original-game-projection')
        js = once(js, 'let t=Nt.importSave(await e.text())', 'let t=await Nt.importSave(await e.text())', 'await-native-backup-restore-before-import-success')
        js = once(js, 'if(e.size>1e5)', 'if(e.size>8e6)', 'allow-bounded-complete-device-backup-import')
    if 'window.__pgSocial={D,' in js:
        js = once(js, 'function closeMeet(){', 'function closeMeet(){keyControl.cancel(true);', 'cancel-key-before-closing-original-meet')
        js = once(js, 'function resetGame(){', 'function resetGame(){keyControl.cancel(true);', 'cancel-key-before-original-tab-reset')
        start=js.index('let keyT=0,keyAt=0;')
        end=js.index("addEventListener('keydown'",start)
        replacement="""const keyControl=window.CatOfflineMeetKey.bind({w:window,modal:mov,key:$('sc-key'),getSession:()=>M,arm});
mov.addEventListener('pointerdown',e=>{if(!M)return;if(M.tab==='rhythm'&&e.target.closest('#sc-screen')){e.preventDefault();tap()}});
"""
        js = once(js,js[start:end],replacement,'scope-original-rhythm-key-input-and-cancellation')
        for fn in ['function tickPeers(){','function watchHatch(){','function say(){']:
            js=once(js,fn,fn+'if(window.CatOfflineDurable?.transactionPaused)return;', 'pause-social-'+fn.split()[1].split('(')[0]+'-during-native-transaction')
        js = once(js, 'window.__pgSocial={D,', 'window.__pgSocial={D,hostRefresh:renderHub,', 'expose-social-refresh-after-durable-device-commit')
        anchor='  <section class="lf-sec"><h4>养成事件 <small>不社交也有的收集进度</small></h4>'
        insert='  ${window.CatOfflineDeviceEvents?.dexHtml?.(D)||""}\n'
        js = once(js,anchor,insert+anchor,'show-only-proven-device-receipts-in-original-dex')
    if 'const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};' in js:
        js = once(js, 'const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};',
            'const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};\nL.hostWorldEvent=()=>({type:ev.type,choice:ev.choice});',
            'expose-readonly-original-outdoor-event')
    if '/* 31-life-ui.js */' in js:
        js=once(js,'moments=[],center=true,mini=false}={})','moments=[],center=true,mini=false,wallNow=hostDayClock()}={})','reliable-wall-clock-for-daily-presentation')
        a=js.index('  day.segs.forEach(sg=>{',js.index('function ringSvg(day,'));b=js.index('  for(let h=0;h<24;h++)',a)
        js=once(js,js[a:b],(ROOT/'web/daily-ring-segments.inc.js').read_text(),'ring-foreground-color-clamps-to-same-selected-minute')
        js=once(js,'class=\"lf-ring\" role=\"img\" aria-label=\"24 小时时间环\"','class=\"lf-ring\" role=\"slider\" tabindex=\"0\" aria-valuemin=\"0\" aria-valuemax=\"1439\" aria-valuenow=\"${Math.min(1439,now)}\" aria-label=\"24 小时时间环，拖动或方向键查看\"','manual-ring-keyboard-entry')
        a=js.index('  if(center){const sg=',js.index('function ringSvg(day,'));b=js.index("  return s+'</svg>';",a)
        js=once(js,js[a:b],(ROOT/'web/daily-ring-center.inc.js').read_text(),'future-and-empty-past-center-do-not-borrow-events')
        js=once(js,'moments.forEach(m=>{const d=new Date(m.t),mm=d.getHours()*60+d.getMinutes(),','moments.filter(m=>mini||new Date(m.t).getHours()*60+new Date(m.t).getMinutes()<=observed).forEach(m=>{const d=new Date(m.t),mm=d.getHours()*60+d.getMinutes(),','no-future-heart-markers')
        js=once(js,'(day.env||[]).forEach(e=>{','(day.env||[]).filter(e=>mini||e.m<=observed).forEach(e=>{','no-future-environment-labels')
        js=once(js,'L.open=open;','L.open=open;'+(ROOT/'web/daily-selection.inc.js').read_text(),'one-selected-minute-original-ring-marker-bands-cards')
        js=once(js,"if(tab==='today'){const st=body.querySelector('#lf-stage');if(st)drawStage(st,L.segAt(day,L.nowMin()))}","if(tab==='today'){const st=body.querySelector('#lf-stage');if(st)drawStage(st,L.segAt(day,L.nowMin()));window.CatDayNavigation?.restore()}",'retain-manual-selection-through-original-page-render')
        start=js.index("    ring.querySelector('svg').outerHTML=ringSvg(day,{now:m,moments:ms.filter",js.index('function replay(){'))
        end=js.index('if(sg!==lastSeg)',start)
        js=once(js,js[start:end],"    L.hostSelectDayTime(m,ring.querySelector('svg'),'replay',t/1000);",'original-playback-uses-same-time-renderer-as-touch')
        js=once(js,'L.places=()=>cfg.demo||!geo.length?DEMO_PLACES.map(p=>({...p,name:names[p.id]||p.name})):realPlaces();','L.places=()=>cfg.demo?DEMO_PLACES.map(p=>({...p,name:names[p.id]||p.name})):realPlaces();','places-demo-only-fictional-data')
        js=once(js,"keepDays:7,demo:true},load(KEY.cfg,{}))","keepDays:7,demo:/[?&]demo=1(&|$)/.test(location.search)},load(KEY.cfg,{}))",'life-demo-off-by-default-explicit-opt-in')
        js=once(js,"if(added){bump();const y=dayKey(new Date(Date.now()-864e5));if(added===y){setTimeout(()=>L.toast?.('昨天的生活圆环已自动生成，去「今日生活」看看'),2500)}gtrack('life_ring_auto',{days:H.length})}","if(added){bump();gtrack('life_ring_auto',{days:H.length})}",'archive-silently-without-daily-review-push')
        js=once(js,"${L.cfg.demo?'演示：虚构地点':'根据定位聚类，仅保存在本机'}","${L.cfg.demo?'虚构地点 · 未采集真实位置':pl.length?'根据本机定位记录聚类':'暂无可展示的真实地点'}",'places-heading-matches-actual-source')
        js=once(js,"  const pl=L.places().filter(p=>p.id!=='home');\n  return `<section", "  const pl=L.places().filter(p=>p.id!=='home');\n  const empty=L.geoCount()?'已有本机定位记录，尚未识别出家以外的常去地点。':'还没有真实定位记录；不会用虚构地点填充。是否开启位置由你决定。';\n  return `<section",'places-real-empty-state-copy')
        js=once(js,"</div></div></article>`).join('')}</div></section>`;", "</div></div></article>`).join('')||`<p class=\"lf-empty\" role=\"status\">${empty}</p>`}</div></section>`;",'places-render-explicit-empty-state')
        js=once(js,"${L.cfg.demo?'演示地点':'来自生活同步'}", "${L.cfg.demo?'虚构地点 · 未采集真实位置':pl.length?'来自本机定位记录':'暂无可展示的真实地点'}",'world-places-heading-matches-actual-source')
        js=once(js,"${p.icon} ${esc(p.name)}</b></button>`).join('')}</div>`;", "${p.icon} ${esc(p.name)}</b></button>`).join('')||`<p class=\"lf-empty\" role=\"status\">${L.geoCount()?'已有本机定位记录，尚未识别出家以外的常去地点。':'还没有真实定位记录；不会用虚构地点填充。是否开启位置由你决定。'}</p>`}</div>`;",'world-places-render-explicit-empty-state')
        # 关闭演示/清空记录后，同一次渲染刷新出门面板，避免旧虚构按钮残留。
        js=once(js,"function render(){\n  const day=L.day(),body=$('lf-body');stopReplay();stopBadge();", "function render(){\n  if(window.CatDayNavigation?.deferRender(render))return;\n  const day=L.day(),body=$('lf-body');stopReplay();stopBadge();L.emit('places');",'places-refresh-without-removing-owned-ring-pointer')
        js=once(js,"fill();L.on('geo',fill);", "fill();L.on('geo',fill);L.on('places',fill);",'world-places-refresh-on-mode-change')
        js=once(js,"const p=L.place(sg.place)||L.place('work');const m=L.map(p,w,h);", "const p=L.place(sg.place);const m=L.map(p,w,h);",'daily-stage-does-not-borrow-work-location')
        js=once(js,"L.map(p||L.place('work'),220,120)", "L.map(p,220,120)",'companion-postcard-does-not-borrow-work-location')
        js=once(js,"  const key=p.id+w+'x'+h;const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');", "  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');\n  if(!p){g.fillStyle='#f5eee4';g.fillRect(0,0,w,h);g.fillStyle='#776a5a';g.font='14px system-ui';g.textAlign='center';g.fillText('暂无可确认的地点',w/2,h/2);c.setAttribute('aria-label','暂无可确认的地点；未用虚构地点代替');return c}\n  const key=p.id+w+'x'+h;",'missing-real-place-neutral-canvas-no-map-request')
        # 透明命中层覆盖真实两条轨道，不覆盖中心、环间空隙或时刻刻度。
        js=once(js,"  return s+'</svg>';\n}\nL.ringSvg=ringSvg;", "  if(!mini)s+=`<circle class=\"day-ring-track\" cx=\"${c}\" cy=\"${c}\" r=\"${r1}\" fill=\"none\" stroke=\"transparent\" stroke-width=\"16\" aria-hidden=\"true\"/><circle class=\"day-ring-track\" cx=\"${c}\" cy=\"${c}\" r=\"${r2}\" fill=\"none\" stroke=\"transparent\" stroke-width=\"7\" aria-hidden=\"true\"/>`;\n  return s+'</svg>';\n}\nL.ringSvg=ringSvg;",'manual-ring-track-only-hit-layer')

        assert "function catOut(){return L.cfg.sync&&Date.now()>callBack&&L.catDo(L.segAt(L.day(),L.nowMin())).k==='out'}" in js, 'Original life-v5 effective-state formula changed'
        js = once(js, 'let callBack=0,lastKind=null,lastPlace=null;',
            "let callBack=0,lastKind=null,lastPlace=null;\nlet hostAppliedCompanion=null;\nL.hostCompanionState=()=>document.hidden||!hostAppliedCompanion?null:{...hostAppliedCompanion};",
            'expose-readonly-applied-life-v5-companion')
        js = once(js, 'function syncNow(force){', 'function syncNow(force){\n  hostAppliedCompanion=null;', 'invalidate-companion-until-original-render-applied')
        js = once(js, "if(cd.k==='out')lastPlace=sg.place;lastKind=cd.k;",
            "if(cd.k==='out')lastPlace=sg.place;lastKind=cd.k;\n  hostAppliedCompanion=r?Object.freeze({schema:1,source:'life-v5-applied',out:Boolean(out),mode:L.cfg.demo?'demo':'automatic'}):null;",
            'publish-original-syncnow-applied-out-home-only')
    if 'function talkEnd(btn){' in js:
        js = once(js, 'function talkEnd(btn){',
            "L.hostStopCapture=()=>{if(rec){try{rec.abort()}catch{}rec=null}if(media){clearInterval(media._tick);media.getTracks().forEach(t=>t.stop());media._ac?.close();media=null}const b=document.getElementById('lf-talk');if(b){b.classList.remove('on');b.textContent='🎙️ 按住说话'}};\nfunction talkEnd(btn){",
            'expose-voice-cancel-without-completion-response')
    if "async function listen(src='auto'){" in js:
        start=js.index("async function listen(src='auto'){");end=js.index('\n}',start)+2
        js=once(js,js[start:end],"async function listen(src='auto'){return {ok:false,msg:'环境感知仅由已连接且具备该能力的吧唧提供；手机不采集环境录音。'}}",'environment-sensing-badge-only-no-phone-recording')
        a=js.index('function statusTxt(){');b=js.index('\nsetInterval',a)
        js=once(js,js[a:b],"function statusTxt(){return '环境感知仅支持吧唧传感器；本固件尚未提供，手机不录音。'}",'environment-state-no-false-phone-sensing')
        a=js.index('badgeHtml(){');b=js.index('\n};',a)
        js=once(js,js[a:b],"badgeHtml(){return '<section class=\"lf-sec\"><h4>吧唧环境感知 <small>当前不可用</small></h4><p class=\"lf-note\">仅接收具备明确传感能力的吧唧数据。当前固件没有此能力；手机不采集或定时录音。原历史保留，未作为新吧唧观测。</p></section>'}",'badge-only-environment-unavailable-view')
        js=once(js,'L.sensorToggle=async(k,on)=>{',"L.sensorToggle=async(k,on)=>{if(k==='scene')return {ok:false,msg:'当前吧唧未提供环境感知，手机采集保持禁用。'};",'disable-environment-toggle-without-capability')
    if "row('scene','麦克风 · 环境感知'" in js:
        a=js.index("  ${row('scene','麦克风 · 环境感知'");b=js.index("\n  ${row('minor'",a)
        js=once(js,js[a:b],"  ${row('scene','吧唧环境感知','当前固件未提供传感能力，暂不可用；手机不采集环境录音。',true)}",'privacy-badge-environment-disabled-clear-copy')
    if False:
        js = once(js, "async function listen(src='auto'){", "async function listen(src='auto'){\n  const hostGeneration=window.CatOfflineMedia?.generation;", 'capture-environment-generation')
        js = once(js, 'const r=classify(fr);lastAt=Date.now();',
            "if(hostGeneration!==window.CatOfflineMedia?.generation){showChip('');return {ok:false,msg:'采集已暂停，本次不记录环境标签'}}\n  const r=classify(fr);lastAt=Date.now();",
            'do-not-record-environment-after-native-cancel')
    if '正式版由云端校验一机一密' in js:
        js = once(js, '正式版由云端校验一机一密',
            '本候选仅验证本地试玩；真实吧唧双向确认尚待设备接口联调',
            'replace-obsolete-cloud-requirement-with-test-status')
    if 'window.__petGame={store:Nt' not in js:
        return js
    # The mobile script adds data-view to BODY before the async room finishes.
    # Registering navigation on BODY makes every bubbled click navigate home.
    js = once(js, 'document.querySelectorAll("[data-view]").forEach(O=>O.addEventListener("click",()=>B(O.dataset.view)))',
        'document.querySelectorAll("button[data-view]").forEach(O=>O.addEventListener("click",()=>B(O.dataset.view)))',
        'scope-navigation-to-buttons-not-body')
    # Reuse the original cancellation sequence. No new store or reward formulas.
    cleanup = 'Dr?.suspend(),Gs&&(Nt.cancelCare(Gs),Gs=null,Bn?.cancelInteraction(),iu(),Fi(!1)),(Ui||Jn.isRunning())&&(Jn.stop(),Nt.cancelPlay(Ui),Ui=null,Nr=!1,Xe("start-mini").hidden=!1,Xe("start-mini").textContent="开始游戏",Xe("game-dialog").open&&Xe("game-dialog").close(),Fi(!1)),Nt.flush()'
    assert cleanup in js, 'Original pagehide cancellation sequence changed'
    js = once(js, 'window.__petGame={store:Nt,',
        'window.__petGame={store:Nt,hostCreateStore:vu,hostSuspend(){'+cleanup+';Bn?.setActive(false)},hostResume(){ec=performance.now();Dr?.resume()},setRoomActive(value){Bn?.setActive(Boolean(value))},',
        'expose-original-lifecycle-and-room-active')
    js=once(js,'window.__petGame={store:Nt,',"window.CatTownTHREE={REVISION:'185',Scene:fi,PerspectiveCamera:an,Mesh:kt,Group:ut,BoxGeometry:bn,MeshStandardMaterial:Ln,MeshBasicMaterial:pi,ShaderMaterial:Yn,Color:_t,Vector3:L,Vector2:ze,Vector4:Kt,Box3:Xt,Ray:hs,Raycaster:Ri,WebGLRenderer:Ni,DirectionalLight:Zn,HemisphereLight:mi,BufferGeometry:Tn,Float32BufferAttribute:nn,Light:yo,LightShadow:Yc,PCFSoftShadowMap:tl,ACESFilmicToneMapping:Ki,BackSide:1,SRGBColorSpace:Zt,CanvasTexture:Fs,createPet:Ss};window.__petGame={store:Nt,",'expose-shared-r185-types-for-original-town')
    js=once(js,'window.__pgRoom={cam:l,','window.__pgRoom={renderer:a,renderPreviewFrame(){a.render(c,l)},cam:l,','expose-existing-room-renderer-for-town')
    if 'function vu(' in js:
        runtime=(ROOT/'scripts/care-runtime.cjs').read_text().split('// END EMBEDDED INSTALL')[0]
        assert 'function __hostInstallCareRuntime(' in runtime
        js=once(js,'return{hostDeviceCare:','const __hostApi={hostDeviceCare:','gate-original-public-writers-during-device-result-lease')
        js=once(js,'adoptCat:$e}}/**','adoptCat:$e};'+runtime+'return __hostInstallCareRuntime(__hostApi,{identity:()=>JSON.stringify([o.createdAt,o.activeCatId,o.cats.map(C=>[C.id,C.joinedAt])]),read:()=>p,replace:value=>{p=value},clock:e,cooldowns:Hf,activeCatId:()=>o.activeCatId,keys:()=>o.cats.flatMap(C=>[...Bo,"clinic"].map(Y=>C.id+":"+Y)),hydrate:Ue,seed:hostRuntime});}/**','expose-original-care-runtime-and-owned-device-hydration')
    return js

scripts = list(re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script>', source, re.I))
assert len(scripts) == 8 and 'social-v7-js' in source
html = source
for index, match in reversed(list(enumerate(scripts, 1))):
    assert not re.search(r'\bsrc\s*=', match[1])
    original = match[2]
    js = instrument(original)
    filename = f'game-{index:02}.js'
    (assets / filename).write_text(js)
    manifest['scripts'].append({'index': index, 'file': filename,
        'sourceSha256': digest(original.encode()), 'packagedSha256': digest(js.encode()),
        'changed': original != js})
    tag = f'<script{match[1]} src="{filename}"></script>' if index == 1 else f'<script{match[1]} type="application/x-catforest-script" data-offline-src="{filename}"></script>'
    html = html[:match.start()] + tag + html[match.end():]
manifest['scripts'].sort(key=lambda item: item['index'])
assert manifest['patches'].count('expose-readonly-applied-life-v5-companion') == 1, 'Required life-v5 companion hook missing'

# Android injects the actual system insets; ordinary browsers retain env() fallbacks.
def safe_area(match):
    css = re.sub(r'env\(safe-area-inset-(top|right|bottom|left)\)',
        r'var(--safe-area-inset-\1, env(safe-area-inset-\1))', match[2])
    return match[1] + css + match[3]
html = re.sub(r'(<style\b[^>]*>)([\s\S]*?)(</style>)', safe_area, html, flags=re.I)
html = html.replace('</head>', '<script src="offline-event-store.js"></script><script src="offline-durable-store.js"></script><script src="offline-prelude.js"></script><script src="offline-room-bed.js"></script><script src="pet-growth.js"></script><script src="cat-dialogue-port.js"></script><script src="offline-meet-key.js"></script></head>', 1)
host_scripts=['offline-host.js','offline-nav-icons.js','offline-layout.js','offline-encounter-ui.js','offline-page-icons.js','offline-family-ui.js','offline-scene-map.js','offline-device-events.js','offline-device-backup.js','offline-device-diagnostics.js','offline-day-display.js','offline-scene-sync.js','legacy-bj20-adapter.js','local-v2-transport.js','cflocal2-adapter.js','offline-world-renderer.js','town-r185-compat.js','town-garden-source.js','town-event-fx.js','original-town-runtime.js','town-integration.js','life-navigation.js','cat-dialogue.js','room-layout.js']
boot_status='<div id="offline-boot-status" role="status" style="position:fixed;inset:0;z-index:99999;background:#fffaf2;padding:32px;box-sizing:border-box">正在恢复本地存档…</div>'
extras='<link rel="stylesheet" href="original-town.css"><link rel="stylesheet" href="town-integration.css"><link rel="stylesheet" href="town-courtyard-components.css"><link rel="stylesheet" href="town-courtyard-layout.css"><link rel="stylesheet" href="town-courtyard-sheet.css"><link rel="stylesheet" href="town-guide-layout.css"><link rel="stylesheet" href="life-panels.css"><link rel="stylesheet" href="offline-host.css"><link rel="stylesheet" href="offline-ui-polish.css"><link rel="stylesheet" href="offline-page-polish.css"><link rel="stylesheet" href="offline-family-ui.css"><link rel="stylesheet" href="life-companion.css">'+''.join(f'<script type="application/x-catforest-script" data-offline-src="{name}"></script>' for name in host_scripts)+boot_status+'<script>window.CatOfflineDurable.boot()</script>'
html = html.replace('</body>',extras+'</body>',1)
for path in (ROOT / 'web').iterdir():
    if path.suffix not in {'.js', '.css'}:
        continue
    text = path.read_text()
    if path.suffix == '.css':
        text = re.sub(r'env\(safe-area-inset-(top|right|bottom|left)\)',
            r'var(--safe-area-inset-\1, env(safe-area-inset-\1))', text)
    (assets / path.name).write_text(text)
(assets / 'index.html').write_text(html)
(assets / 'build-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
# Browser preview is the identical asset payload; not a separate rebuilt mockup.
preview = ROOT / 'preview'
preview.mkdir(exist_ok=True)
for path in assets.iterdir():
    if path.is_file():
        shutil.copy2(path, preview / path.name)
print(json.dumps({'scripts': len(scripts), 'changedScripts': sum(s['changed'] for s in manifest['scripts']), 'sourceSha256': manifest['sourceSha256']}))
