"""Narrow social-v7 instrumentation for the real badge encounter release."""
def instrument_encounters(js,root):
    if 'function completeMeet(peer,how,extra={}){' not in js:return js
    if 'function hostPlanDeviceEncounter(' in js:return js
    def replace(old,new):
        nonlocal js
        if js.count(old)!=1:raise ValueError('Encounter source anchor changed: '+old[:100])
        js=js.replace(old,new,1)
    a=js.index('  const now=Date.now(),d=today();let f=',js.index('function completeMeet('))
    b=js.index("  if(how==='fate')",a)
    progress=js[a:b].replace('  const now=Date.now(),d=today();let f=','  let f=',1).replace('dk(new Date())','dk(new Date(now))').replace('const wk=weekKey();','const wk=weekKey(now);')
    helper='function friendProgress(D,peer,how,extra,now,d){\n'+progress+'  return {f,isNew,lines,gain};\n}\n'
    js=js[:a]+"  const now=Date.now(),d=today();const {f,isNew,lines,gain}=friendProgress(D,peer,how,extra,now,d);\n"+js[b:]
    replace('function completeMeet(peer,how,extra={}){',helper+'function completeMeet(peer,how,extra={}){\n  if(peer.src!==\'npc\')throw Error(\'真实吧唧相遇须由持久设备收据结算\');')
    replace("const air=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('pg-badge-air'):null;","const air=null; /* Browser windows never stand in for physical badges. */")
    replace('function openMeet(fid,tab){const p=peerOf(fid);',"function openMeet(fid,tab){if(String(fid).startsWith('device:')){toast('请在双方吧唧上对暗号，完成后会自动同步到这里。');return;}const p=peerOf(fid);")
    replace("const tabs=[['rhythm','敲暗号'],['dots','连点暗号'],['qr','扫码兜底']];if(D.cfg.fate&&!f)tabs.push(['fate','缘分擦肩']);","const tabs=[['rhythm','敲暗号'],['dots','连点暗号']];")
    replace('或「扫码兜底」','；真实相遇请在两台吧唧上完成')
    replace('function judge(a,b){','function judge(a,b,settings=D.cfg){')
    replace('const tol=D.cfg.tol/100,dt=D.cfg.dur/100;','const tol=settings.tol/100,dt=settings.dur/100;')
    # Removed purposes stay unreachable, including old links and camera listeners.
    a=js.index('/* ---------- 扫码兜底：');b=js.index('/* ---------- 破冰小剧场：',a)
    js=js[:a]+'''/* No QR, phone tilt, pointer tilt or generated Fate samples. */
function stopScan(){}function stopFate(){}
function myCode(){return ''}function parseCode(){return {err:'扫码相遇已取消'}}
function useCode(){toast('扫码相遇已取消，请使用吧唧暗号');return false}
function renderQr(){useCode()}function renderFate(){toast('缘分擦肩未开放采集')}
''' +js[b:]
    a=js.index("if(/^#meet=/.test(location.hash))");b=js.index('\nwindow.__pgSocial=',a)
    js=js[:a]+"if(/^#meet=/.test(location.hash))history.replaceState(null,'',location.href.split('#')[0]);"+js[b:]
    replace("if(m.type==='qr-ack'){if(!M.done)success('qr',{});return}","")
    replace('const wCap=(day=dk(new Date()))=>WCAP_MIN+hash(D.me.id', 'const wCap=(day=dk(new Date()),target=D)=>WCAP_MIN+hash(target.me.id')
    replace('function worldState(){','function worldState(target=D){')
    replace('(D.world.log||[]).forEach((e,i)=>','(target.world.log||[]).forEach((e,i)=>')
    a=js.index('function worldGrow(');b=js.index('/* ---------- 整理小家：',a)
    body=js[a:b]
    body=body.replace('function worldGrow(f,how,isNew){const d=today();d.world=d.world||0;const day=dk(new Date());','function worldGrow(f,how,isNew,ctx){if(f.src!==\'native_device\')return {skip:\'source\'};const target=ctx?.data||D,d=ctx?.daily||today();d.world=d.world||0;const day=ctx?.day||dk(new Date());')
    body=body.replace('D.world','target.world').replace('D.me.id','target.me.id').replace('wCap(day)','wCap(day,target)').replace('t:Date.now(),day,','t:ctx?.at||Date.now(),day,source:\'native_device\',eventId:ctx?.event?.eventId||null,')
    body=body.replace('const S=worldState();','const S=worldState(target);')
    body=body.replace('saveD();\n  try','if(ctx)return {tier,frag:fr};saveD();\n  try')
    js=js[:a]+body+js[b:]
    # Keep original social pages. Add real-device evidence before NPC interaction.
    replace('function near(){const d=today();const me=P();', 'function near(){const d=today();const me=P();')
    replace('return `<section class="sc-hero"><div class="sc-radar"', 'return nativeEncounterHelp()+`<details><summary>游戏角色互动（不是真实吧唧相遇）</summary><section class="sc-hero"><div class="sc-radar"')
    replace('吧唧用蓝牙广播匿名 ID，约 3 米内判定「遇见」，会震动 + 提示音 + 屏幕边缘发光。默认只展示宠物形象，主人匿名。','以下是游戏角色互动，不表示附近存在真实设备，不计入真实相遇世界成长。')
    replace('<button type="button" class="g-btn ghost" data-h="code">📷 扫码 / 输入遇见码</button>','')
    replace('<div class="lf-row"><button type="button" class="g-btn ghost" data-h="slotb">👥 双人试玩：打开玩家 ${window.__pgSlot===\'B\'?\'A\':\'B\'} 窗口</button></div>','')
    replace('${echoes()}`}', '${echoes()}</details>`}')
    replace('或打开双人试玩窗口。','。')
    replace("${f.src==='npc'?'官方小猫':'主人匿名'}", "${f.src==='npc'?'游戏角色':f.src==='native_device'?'真实吧唧 · 主人匿名':'历史原型记录'}")
    replace("${f.sex==='male'?'小男生':'小女生'}", "${f.src==='native_device'?'性别未交换':f.sex==='male'?'小男生':'小女生'}")
    replace('function eggCheck(f){const p=P();', "function eggCheck(f){if(f.src==='native_device')return '吧唧联机生蛋尚未开放';const p=P();")
    replace('function askContact(fid){const f=D.friends[fid];if(!f)return;', "function askContact(fid){const f=D.friends[fid];if(!f)return;if(f.src==='native_device'){toast('吧唧联系方式交换尚未开放');return;}")
    replace("${L.cfg.minor||f.contact?.theirs?'disabled':''}","${f.src==='native_device'||L.cfg.minor||f.contact?.theirs?'disabled':''}")
    replace("${tg('fate','缘分擦肩（Fate 模式）','默认关闭。蓝牙范围内两人同一时刻同样幅度晃动才算一次缘分，每对只算一次，会收到大礼物（馈赠限定服饰或家具）；费电，单独做功耗预算')}", "<label class=\"lf-tg dis\"><input type=\"checkbox\" disabled><span class=\"sw\"></span><div><b>缘分擦肩（独立开关 · 关闭）</b><small>默认关闭；需吧唧后台感知同步走过的晃动，不是当面连接后晃一晃。采集授权、广播对时和独立功耗确认前不开放。</small></div></label><p class=\"sc-small\">敲暗号：固件间隔误差初值15%，总时长差30%；手机设置不改变吧唧阈值。</p>")
    replace('<label class="lf-sel">敲暗号：间隔误差 ≤ ${sel(\'tol\',[[10,\'10%\'],[15,\'15%（初值）\'],[20,\'20%\'],[25,\'25%\']])}</label>','')
    replace('<label class="lf-sel">敲暗号：总时长差 ≤ ${sel(\'dur\',[[20,\'20%\'],[30,\'30%（初值）\'],[40,\'40%\']])}</label>','')
    js=js.replace('缘分擦肩默认关闭，可在「设置」里开启','缘分擦肩默认关闭，采集尚未开放').replace('开启缘分擦肩</button>','缘分擦肩说明</button>')
    # Historical Fate records remain intact and are explicitly distinguished.
    js=js.replace('缘分擦肩 · 限定印记「同频」</small>',"${x.source==='native_device'?'真实缘分擦肩':'历史原型记录 · 非真实吧唧擦肩'}</small>")
    replace("const h=t.closest('[data-h]')?.dataset.h;", "const h=t.closest('[data-h]')?.dataset.h;if(t.closest('[data-native-device]')){closeHub();window.CatOfflineHost?.openDevice();return;}")
    js=js.replace('window.__pgSocial={D,','window.__pgSocial={D,hostPlanDeviceEncounter,')
    replace('function friendProgress(D,peer,how,extra,now,d){', (root/'web/device-encounter-plan.inc.js').read_text()+'\nfunction friendProgress(D,peer,how,extra,now,d){')
    js=js.replace("${D.cfg.fate?'':'", "${false?'':'").replace("${D.cfg.fate?'':'", "${false?'':'")
    js=js.replace("textContent=D.cfg.discover?'可被发现':'隐身中'", "textContent=D.cfg.discover?'游戏角色开启':'游戏角色关闭'")
    js=js.replace("${tg('discover','可被发现','关闭后不广播、不提醒，也看不到别人（双方都开启才能遇见）')}", "${tg('discover','游戏角色来访','只控制下方游戏角色互动；真实吧唧仅在主人主动进入对暗号时发现和配对')}")
    js=js.replace('发现范围 ${sel(', '游戏角色出现范围 ${sel(')
    js=js.replace('给朋友准备礼物 <small>', '给游戏角色准备礼物 <small>')
    js=js.replace('const fl=Object.values(D.friends);', "const fl=Object.values(D.friends).filter(f=>f.src!=='native_device');")
    js=js.replace('function prepareGift(item,n,to){const p=P();', "function prepareGift(item,n,to){if(D.friends[to]?.src==='native_device'){toast('真实吧唧目前仅支持首次互赠野花，自定义礼物尚未开放');return;}const p=P();")
    js=js.replace('${dt.getMonth()+1}/${dt.getDate()} · 和「${esc(e.name)}」${wHow(e)}', "${e.source==='native_device'?'真实吧唧':'历史原型记录'} · ${dt.getMonth()+1}/${dt.getDate()} · 和「${esc(e.name)}」${wHow(e)}")
    js=js.replace("${tg('tone','提示音','靠近时吧唧发出提示音')}${tg('vib','震动','靠近时震动（手机浏览器支持时）')}", "${tg('tone','游戏角色提示音','手机游戏角色来访时提示，不配置吧唧音频')}${tg('vib','手机提示振动','仅手机支持时生效，不表示吧唧有马达')}")
    return js
