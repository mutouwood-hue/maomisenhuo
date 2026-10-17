#!/usr/bin/env python3
"""Wrap the user's complete town source; every adaptation is pinned and recorded."""
from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parents[1];raw=(root/'original/town.html').read_text();assert len((root/'original/town.html').read_bytes())==137976
sha=lambda s:hashlib.sha256(s.encode()).hexdigest();changes=[]
def change(s,old,new,name):
 assert s.count(old)==1,(name,s.count(old));changes.append({'name':name,'before':old,'after':new});return s.replace(old,new,1)
main=re.findall(r'<script>([\s\S]*?)</script>',raw)[0]
# Original geometry, town graph, profiles, palettes, building coordinates and director remain intact.
main=change(main,'renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: \'high-performance\' });','renderer = hostRenderer;','reuse-existing-room-renderer')
main=change(main,'renderer.outputEncoding = THREE.sRGBEncoding;','renderer.outputColorSpace = THREE.SRGBColorSpace;','r185-output-color-property')
main=change(main,'            requestAnimationFrame(animate);','            frameId=0;if(!active||disposed)return;frameId=requestAnimationFrame(animate);','owned-single-active-loop')
main=change(main,"        window.onload = function() {\n            initApp();\n            animate();\n        };",'', 'explicit-host-lifecycle-not-window-onload')
# r185 Color uniforms are linear; custom sky shader must encode output explicitly.
main=change(main,'gl_FragColor = vec4(col, 1.0);','gl_FragColor = vec4(col, 1.0);\n                        #include <colorspace_fragment>','r185-custom-sky-output-colorspace')
# Portrait fit moves the camera farther away; retain the original relative haze.
main=change(main,'new THREE.FogExp2(0xd98a82, 0.0068)','new THREE.FogExp2(0xd98a82, 0.0068*68/overviewRadius())','portrait-fit-relative-original-fog')
# Existing DOM/button handlers become closure-local, not global overwrites.
public=['setLightingMood','toggleFollowMode','switchFollowedCat','cycleCameraShotOverride','resetOverviewCamera','replayTownAssembly']
for name in public:
 old='window.'+name+' = function';assert old in main,name
 main=change(main,old,'const '+name+' = function','scoped-'+name)
# Every listener attached by original source belongs to this instance.
for target in ['dom','window']:
 main=main.replace(target+'.addEventListener(', 'listen('+target+',')
main=change(main,'            let pointerDownPos = { x: 0, y: 0 };','            let pointerDownPos = { x: 0, y: 0 };let pointerOwner=null;','own-original-pointer-sequence')
main=change(main,"            listen(dom,'pointerdown', (e) => {","            listen(dom,'pointerdown', (e) => {\n                if(!active)return;pointerOwner=e.pointerId;dom.setPointerCapture?.(e.pointerId);",'capture-pointer')
main=change(main,"            listen(window,'pointerup', (e) => {","            listen(window,'pointerup', (e) => {\n                if(pointerOwner!==e.pointerId)return;pointerOwner=null;",'ignore-unowned-pointerup')
main=change(main,"            listen(dom,'wheel', (e) => {","            listen(dom,'pointercancel',()=>{pointerOwner=null;orbitState.isDraggingLeft=false;orbitState.isDraggingRight=false;});\n            listen(dom,'wheel', (e) => {",'cancel-pointer')
# Crossing clearance includes two full cat circles and the red railing thickness.
main=change(main,'createVoxel(0.95, 0.35, 4.4,','createVoxel(0.95, 0.35, 5.2,','widen-bridge-deck-for-two-passing-cats')
main=change(main,'createVoxel(0.95, 0.35, 5.2, 0xb45309, bx, archY, 0, bridgeGroup);','createVoxel(0.95, 0.35, 5.2, 0xb45309, bx, archY, 0, bridgeGroup).userData.townBridgeDeck=true;','pick-actual-arched-deck-without-changing-collision')
for old,new in [('archY + 0.7, -2.0','archY + 0.7, -2.4'),('archY + 0.7, 2.0','archY + 0.7, 2.4'),('archY + 1.4, -2.0','archY + 1.4, -2.4'),('archY + 1.4, 2.0','archY + 1.4, 2.4'),('archY + 1.05, -2.0','archY + 1.05, -2.4'),('archY + 1.05, 2.0','archY + 1.05, 2.4')]:
 main=change(main,old,new,'bridge-rail-clearance-'+old)
# Original clone owner must update the visible cloned window in every lighting mood.
main=change(main,'                    child.material = matClone;','                    if(windowMaterials.includes(child.material))windowMaterials.push(matClone);\n                    child.material = matClone;','track-visible-window-lighting-clones')
# r185 PBR lights no longer apply legacy PI; keep authored strengths via same-unit adapter.
main=main.replace('new THREE.AmbientLight(', 'new THREE.LegacyAmbientLight(').replace('new THREE.HemisphereLight(', 'new THREE.LegacyHemisphereLight(').replace('new THREE.DirectionalLight(', 'new THREE.LegacyDirectionalLight(')
# The assignments used by mood changes go through legacy-intensity accessors too.
# Responsive overview retains exact original orbit/FOV; only zoom-out fit expands on portrait.
main=change(main,'            orbitState.radius = 68;','            orbitState.radius = overviewRadius();','responsive-original-overview-fit')
main=change(main,'Math.min(115, orbitState.radius)','Math.min(overviewRadius()+40, orbitState.radius)','responsive-original-zoom-limit')
# Keep the original rig animation/camera but give every cat one shared road/occupancy system.
main=change(main,'            cats.forEach((cat) => {\n                cat.stateTimer -= dt;', '            cats.forEach((cat) => {\n                if(cat.isPlayer)return;\n                cat.stateTimer -= dt;', 'skip-player-in-npc-rig-animation')
a=main.index('                // 状态移动或原地动作逻辑',main.index('function updateCats('));b=main.index('                // ----------------------------------------------------',a)
oldMove=main[a:b];main=change(main,oldMove,'                if(townPlayer)townPlayer.moveNPC(cat,dt);\n                else {\n'+oldMove+'\n                }\n','unified-npc-road-occupancy-before-animation')
main=change(main,'            updateCats(dt, elapsed);','            townPlayer?.serviceBridge();\n            townPlayer?.serviceSocial();\n            updateCats(dt, elapsed);\n            townPlayer?.update(dt,elapsed);','player-navigation-and-original-animation-tick')
main=change(main,'                            followState.catIndex = clickedCatIndex;\n                            followState.shotOverride = null;\n                            toggleFollowMode(true);','                            if(townPlayer)townPlayer.clickNpc(clickedCatIndex);else{followState.catIndex = clickedCatIndex;followState.shotOverride = null;toggleFollowMode(true);}','npc-click-walk-to-separated-interaction')
main=change(main,'                    if (hits.length > 0) {','                    if(!hits.length&&townPlayer)townPlayer.pick(e);\n                    if (hits.length > 0) {','guide-click-only-walkable-road')
main=change(main,'            const nextState = forceEnable !== null ? forceEnable : !followState.active;','            if(townPlayer)followState.catIndex=townPlayer.own.index;\n            const nextState = forceEnable !== null ? forceEnable : !followState.active;','follow-current-save-cat-not-resident')
# Current own cat keeps the courtyard's readable medium-wide view in every action.
main=change(main,'function resolveActiveShotType(cat) {',"function resolveActiveShotType(cat) {\n            if(cat.isPlayer)return 'SIDE_TRACKING';",'own-cat-no-macro-or-closeup-switch')
main=change(main,'function getShotSpec(shotKey, cat, elapsed) {',"function getShotSpec(shotKey, cat, elapsed) {\n            if(cat.isPlayer)return {relAz:.72,el:(camRig.userElevation||.48),dist:(camRig.userDistance||18)*Math.max(1,Math.min(1.18,.6/camera.aspect)),lead:.65,lookY:1,focusTime:.3};",'courtyard-medium-wide-own-cat-distance')
main=change(main,'const safeDist = hitDist < Infinity ? Math.max(2.2, hitDist - 0.7) : 999;', 'const safeDist = cat.isPlayer ? 999 : hitDist < Infinity ? Math.max(2.2, hitDist - 0.7) : 999;', 'own-wide-view-uses-existing-xray-instead-of-face-push')
main=change(main,'shotCfg.fov + camRig.userFov','(cat.isPlayer?46:shotCfg.fov) + camRig.userFov','own-cat-courtyard-field-of-view')
main=change(main,'            // 3) 平滑插值（淡出快 / 淡入慢 / 保持时间）',"""            // Own-cat road corridor: fade large foreground roofs even if they miss the tiny center ray.
            if(isFollow&&cats[followState.catIndex]?.isPlayer){
                const probes=[];for(const ox of[-2.4,-1.2,0,1.2,2.4])for(const oy of[-1,0,1.6]){const direction=targetWorldPos.clone().addScaledVector(camRight,ox).addScaledVector(camUp,oy).sub(camPos);const distance=direction.length();probes.push({direction:direction.normalize(),distance});}
                for(const item of occludableGroups){
                    const box=item.box;if(item.catIndex>=0||!box||box.isEmpty()||box.max.y<targetWorldPos.y+.6)continue;
                    // Use the whole cat-and-road corridor. A building's aggregate box may contain
                    // the cat beside its eaves; that must never exempt its roof from fading.
                    let blocks=false;
                    for(const {direction,distance} of probes){
                        _ray.set(camPos,direction);const hit=_ray.intersectBox(box,_tmpV2);
                        if(hit&&hit.distanceTo(camPos)<distance-.25){blocks=true;break;}
                    }
                    if(blocks){item.wantOpacity=Math.min(item.wantOpacity,.015);if(item.currentOpacity>.45)sightBlocked=true;}
                }
            }
            // 3) 平滑插值（淡出快 / 淡入慢 / 保持时间）""",'own-cat-foreground-roof-road-visibility')
main=change(main,'camRig.userYaw -= dx * 0.008;', 'camRig.userYaw -= dx * 0.008;camRig.userElevation=Math.max(.22,Math.min(.95,(camRig.userElevation||.48)+dy*.003));', 'manual-follow-elevation-and-orbit')
# Canvas tap dispatch is owned by the player's exact visible-mesh/road picker.
main=change(main,'                    const hits = raycaster.intersectObjects(interactiveMeshes, false);','                    if(townPlayer){townPlayer.handlePointer(e);return;}\n                    const hits = raycaster.intersectObjects(interactiveMeshes, false);','own-player-tap-before-legacy-invisible-cat-boxes')
main=change(main,'if (moveDist < 6 && e.button === 0)', 'if (moveDist < 14 && e.button === 0)', 'touch-tap-css-pixel-slop')
main=change(main,"                pointerDownPos = { x: e.clientX, y: e.clientY };","                e.preventDefault();pointerDownPos = { x: e.clientX, y: e.clientY };",'canvas-prevent-browser-touch-default')
main=change(main,'                const dx = e.clientX - orbitState.prevX;', '                if(pointerOwner===e.pointerId&&Math.hypot(e.clientX-pointerDownPos.x,e.clientY-pointerDownPos.y)<14)return;\n                const dx = e.clientX - orbitState.prevX;', 'camera-drag-starts-after-tap-slop')
body=raw.split('<body class="relative">',1)[1].split('    <script>',1)[0]
body=change(body,'                    <!-- 电影运镜实时说明与切换 -->','                    </div></div>\n                    <!-- 电影运镜实时说明与切换 -->','repair-two-missing-hud-closures')
body=body.replace('<div class="fixed top-4 left-4 right-4','<div id="original-town-top" class="fixed top-4 left-4 right-4',1).replace('<div class="fixed bottom-5 left-1/2','<div id="original-town-bottom" class="fixed bottom-5 left-1/2',1)
body=re.sub(r'onclick="([^"]+)"',lambda m:'data-town-call="'+m[1]+'"',body)
body='<div class="town-demo-label">小镇散步 · 镇上居民为NPC</div>'+body+'<div class="town-host-actions"><button data-host="home">回小家</button><button data-host="garden">原生活小花园</button><button data-host="zoom-out" aria-label="缩小原镇视角">−</button><button data-host="zoom-in" aria-label="放大原镇视角">＋</button></div>'
prefix="""/* Full original town, mechanically wrapped. No reconstructed street substitute. */
(function(root){'use strict';root.CatOriginalTown={create({THREE,renderer:hostRenderer,onHome=()=>{},onGarden=()=>{},playerModel=null,playerProfile=null}){
if(!THREE||!hostRenderer)throw Error('ORIGINAL_TOWN_ENGINE_REQUIRED');
const parent=hostRenderer.domElement.parentNode,nextSibling=hostRenderer.domElement.nextSibling;
const saved={outputColorSpace:hostRenderer.outputColorSpace,toneMapping:hostRenderer.toneMapping,exposure:hostRenderer.toneMappingExposure,pixelRatio:hostRenderer.getPixelRatio(),shadowEnabled:hostRenderer.shadowMap.enabled,shadowType:hostRenderer.shadowMap.type};
const panel=document.createElement('section');panel.id='original-town';panel.hidden=true;panel.setAttribute('aria-label','原素材喵喵瀑布镇');panel.innerHTML=BODY;document.body.append(panel);
let active=false,disposed=false,frameId=0,initialized=false,shown=false,townPlayer=null;const listeners=[];
function listen(target,event,fn,options){target.addEventListener(event,fn,options);listeners.push(()=>target.removeEventListener(event,fn,options));}
function overviewRadius(){return Math.max(68,68*Math.max(1,1.35/(window.innerWidth/window.innerHeight)));}
""".replace('BODY',json.dumps(body,ensure_ascii=False))
suffix="""
function initialize(){if(initialized)return;initApp();orbitState.radius=overviewRadius();townPlayer=createTownPlayer();initialized=true;}
function show(options={}){if(disposed)throw Error('ORIGINAL_TOWN_DISPOSED');panel.hidden=false;initialize();panel.querySelector('#canvas-container').append(hostRenderer.domElement);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setSize(innerWidth,innerHeight,false);clock.oldTime=performance.now();clock.running=true;if(!shown){replayTownAssembly();shown=true;}townPlayer?.begin(options.profile||playerProfile,options.session||null,options.store||null);active=true;if(!frameId)frameId=requestAnimationFrame(animate);}
function hide(){townPlayer?.leave();active=false;cancelAnimationFrame(frameId);frameId=0;orbitState.isDraggingLeft=false;orbitState.isDraggingRight=false;panel.hidden=true;if(hostRenderer.domElement.parentNode!==parent)parent.insertBefore(hostRenderer.domElement,nextSibling?.parentNode===parent?nextSibling:null);hostRenderer.outputColorSpace=saved.outputColorSpace;hostRenderer.toneMapping=saved.toneMapping;hostRenderer.toneMappingExposure=saved.exposure;hostRenderer.setPixelRatio(saved.pixelRatio);hostRenderer.shadowMap.enabled=saved.shadowEnabled;hostRenderer.shadowMap.type=saved.shadowType;if(parent)hostRenderer.setSize(Math.max(1,parent.clientWidth),Math.max(1,parent.clientHeight),false);}
function renderNow(){initialize();updateCameraSystem(1,clock.getElapsedTime());if(skyDomeMesh)skyDomeMesh.position.copy(camera.position);renderer.render(scene,camera);}
function previewFrame(seconds=5){initialize();updateSkyDropAssembly(seconds);updateCats(0,seconds);updateEnvironmentAnimations(0,seconds);updateCameraSystem(1,seconds);if(skyDomeMesh)skyDomeMesh.position.copy(camera.position);renderer.render(scene,camera);}
function captureOverview(){initialize();const old=followState.active;followState.active=false;const pos=camera.position.clone(),quat=camera.quaternion.clone(),fov=camera.fov;previewFrame(5);const copy=document.createElement('canvas');copy.width=renderer.domElement.width;copy.height=renderer.domElement.height;copy.getContext('2d').drawImage(renderer.domElement,0,0);camera.position.copy(pos);camera.quaternion.copy(quat);camera.fov=fov;camera.updateProjectionMatrix();followState.active=old;return copy;}
function dispose(){if(disposed)return;hide();disposed=true;listeners.splice(0).forEach(fn=>fn());const geos=new Set(),mats=new Set(Object.values(matCache));scene?.traverse(n=>{if(n.geometry)geos.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m)mats.add(m)});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());dirLight?.shadow?.map?.dispose();playerModel?.dispose();panel.remove();}
const calls={setLightingMood,toggleFollowMode,switchFollowedCat,cycleCameraShotOverride,resetOverviewCamera,replayTownAssembly};
listen(panel,'click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.host==='home'){onHome();return}if(button.dataset.host==='garden'){const b=panel.querySelector('[data-player-garden]');if(b)b.click();else onGarden();return}if(button.dataset.host==='zoom-out'){if(followState.active){camRig.userDistance=Math.min(36,(camRig.userDistance||18)+3);return;}orbitState.radius=Math.min(overviewRadius()+40,orbitState.radius+12);return}if(button.dataset.host==='zoom-in'){if(followState.active){camRig.userDistance=Math.max(12,(camRig.userDistance||18)-3);return;}orbitState.radius=Math.max(22,orbitState.radius-12);return}const code=button.dataset.townCall;if(!code)return;const m=code.match(/^(\\w+)\\((?:'([^']*)'|(-?\\d+))?\\)$/);if(!m||!calls[m[1]])return;calls[m[1]](m[2]??(m[3]!==undefined?Number(m[3]):undefined));});
return{show,hide,dispose,get playerProjection(){return townPlayer?.projection||null},get sessionComplete(){return townPlayer?.completed===true},renderNow,previewFrame,captureOverview,setLightingMood,resetOverviewCamera,toggleFollowMode,switchFollowedCat,cycleCameraShotOverride,get active(){return active},inspect(){let meshes=0;scene?.traverse(n=>{if(n.isMesh)meshes++});return{source:'original-town-137976B',originalSha256:ORIGINAL_SHA,active,disposed,initialized,engine:'shared-r185',ownsRenderer:false,frameScheduled:!!frameId,residents:cats.map(c=>({name:c.profile.name,role:c.profile.role,position:c.root.position.toArray(),state:c.state})),waypoints:townWaypoints,mood:currentMood,follow:followState.active,meshes,camera:{fov:camera?.fov,position:camera?.position.toArray()},render:renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null}}};
}};})(window);
""".replace('ORIGINAL_SHA',json.dumps(sha(raw)))
(root/'web/original-town-runtime.js').write_text(prefix+main+'\n'+(root/'web/town-player-runtime.inc.js').read_text().replace('/*__TOWN_CONTACT_RUNTIME__*/',(root/'web/town-contact-runtime.inc.js').read_text())+suffix)
# Add only omitted r185 classes to the already bundled r185 namespace; no second core.
classes=[]
for name in ['SphereGeometry','AmbientLight','PointLightShadow','PointLight','FogExp2','Clock']:
 s=(root/'vendor/three-r185'/f'{name}.js').read_text();s=re.sub(r'^import .*?;\n','',s,flags=re.M);s=re.sub(r'^export .*?;\n?','',s,flags=re.M);classes.append(s)
compat="""/* MIT Three.js r185 omitted classes; use exactly the existing bundled core. */
(function(root){const T=root.CatTownTHREE;if(!T)throw Error('TOWN_CORE_NOT_READY');const {BufferGeometry,Float32BufferAttribute,Vector3,Color,Light,LightShadow,PerspectiveCamera}=T;const warn=()=>{};
"""+'\n'.join(classes)+"""
function legacy(Base){return class extends Base{constructor(...args){super(...args);const initial=this.intensity;Object.defineProperty(this,'intensity',{configurable:true,get(){return this._legacyIntensity*Math.PI},set(v){this._legacyIntensity=v}});this.intensity=initial}}}
Object.assign(T,{SphereGeometry,AmbientLight,PointLightShadow,PointLight,FogExp2,Clock,LegacyAmbientLight:legacy(AmbientLight),LegacyDirectionalLight:legacy(T.DirectionalLight),LegacyHemisphereLight:legacy(T.HemisphereLight)});
})(window);
"""
(root/'web/town-r185-compat.js').write_text(compat)
(root.parent/'evidence').mkdir(parents=True,exist_ok=True)
(root.parent/'evidence/town-source-adaptations.json').write_text(json.dumps({'originalBytes':137976,'originalSha256':sha(raw),'changes':changes,'completeOriginalScriptWrapped':True,'geometryAndProfilesRebuilt':False},ensure_ascii=False,indent=2)+'\n')
