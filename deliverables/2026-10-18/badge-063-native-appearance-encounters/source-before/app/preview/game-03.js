(()=>{var kn=[{id:"orange",name:"橘白田园猫",description:"爱晒太阳的小吃货，橘色条纹配白围兜。",color:"#dd8b48"},{id:"silver",name:"银虎斑",description:"银灰底色、深色虎斑，眼神里装着好奇。",color:"#a4abb2"},{id:"tuxedo",name:"奶牛猫",description:"黑白小礼服，总有一点古灵精怪。",color:"#40494e"},{id:"siamese",name:"暹罗猫",description:"奶油色身体、深色脸和爪，喜欢与你作伴。",color:"#b2967c"},{id:"ragdoll",name:"布偶猫",description:"柔软的浅色毛与蓝眼睛，安静地陪你生活。",color:"#c9bcb2"},{id:"blue",name:"英短蓝猫",description:"圆圆脸、蓝灰毛，是一位温柔的小室友。",color:"#798fa0"},{id:"calico",name:"三花猫",description:"白底橘黑三色花斑，只出现在联机生蛋的后代里。",color:"#e8c9a0",rare:!0},{id:"golden",name:"金渐层",description:"毛尖泛金的渐层毛色，只出现在联机生蛋的后代里。",color:"#e0b25a",rare:!0},{id:"starry",name:"星空猫",description:"深蓝夜空色带星点，鸳鸯眼，最稀有的联姻后代。",color:"#2f3a66",rare:!0}],Mi=[{id:"bandana",name:"莓莓三角巾",description:"给胸前添一块暖红色小围巾。",price:12,slot:"outfit"},{id:"bow",name:"蝴蝶结",description:"今天也要打扮得可可爱爱。",price:18,slot:"outfit"},{id:"cap",name:"小鸭遮阳帽",description:"一顶青蓝色的像素小帽子。",price:25,slot:"outfit"},{id:"raincoat",name:"晴黄雨衣",description:"雨天出门也可以亮亮的。",price:36,slot:"outfit"},{id:"backpack",name:"探险小背包",description:"带上好奇心，到庭院和河岸走一走。",price:32,slot:"outfit"},{id:"scarf",name:"暖暖针织围巾",description:"一圈柔和的青蓝色温暖。",price:28,slot:"outfit"},{id:"sakura",name:"樱花发卡",description:"馈赠限定：只在 Fate 缘分擦肩的大礼物里出现。",price:0,slot:"outfit",gift:!0},{id:"bell",name:"铃铛项圈",description:"馈赠限定：走起来叮铃叮铃。",price:0,slot:"outfit",gift:!0},{id:"crown",name:"星星小王冠",description:"馈赠限定：缘分擦肩时最常收到的大礼物。",price:0,slot:"outfit",gift:!0},{id:"cape",name:"夜空小斗篷",description:"馈赠限定：缀着星星的小斗篷。",price:0,slot:"outfit",gift:!0}],ei=[{id:"fish",name:"小鱼",description:"从河岸带回的小收获。",sellPrice:3},{id:"flower",name:"野花",description:"庭院小路旁的彩色花朵。",sellPrice:2},{id:"shell",name:"贝壳",description:"河岸砂石里亮闪闪的贝壳。",sellPrice:4},{id:"star",name:"星星石",description:"藏在草地里的珍贵小石头。",sellPrice:7}],Ws=[{id:"sniffles",name:"小感冒",description:"淋雨后有点打喷嚏，到诊所检查一下。"},{id:"tummy",name:"肚子不舒服",description:"需要医生检查和温柔照料。"}],ts=[{id:"walk",name:"牵绳散步",target:3,minSeconds:12,xp:6,coins:4,description:"陪小猫依次走到三个路标。"},{id:"explore",name:"自由探险",target:5,minSeconds:15,xp:8,coins:5,description:"让小猫闻花、找贝壳，收集五件小礼物。"},{id:"fish",name:"河岸钓鱼",target:4,minSeconds:15,xp:8,coins:4,description:"看准时机，带回四条小鱼。"}],Xs=[{id:"first_walk",name:"邻里散步委托",description:"完成一次牵绳散步",target:1,rewardCoins:8,metric:"walk"},{id:"flower_bundle",name:"小花店的礼物",description:"探险累计找到三朵野花",target:3,rewardCoins:10,metric:"flower"},{id:"river_fisher",name:"河岸收获",description:"亲手钓回四条小鱼",target:4,rewardCoins:12,metric:"fishCaught"}];var mu="pixel-cat-pet-v1",Br=["food","mood","clean","energy"],xu=["feed","bath","pet","play","sleep"],Bo=[...xu,"climb","tease","drink"],Hf={feed:4e3,bath:4e3,pet:2e3,play:4e3,sleep:4e3,climb:4e3,tease:4e3,drink:4e3},hc={feed:{changes:{food:25,mood:3,clean:-2},xp:8,cost:3,message:"咔嚓咔嚓，小猫吃掉了小鱼干！"},bath:{changes:{clean:35,mood:4,energy:-3},xp:8,cost:2,message:"泡泡洗香香，变成一只蓬松的小猫啦。"},climb:{changes:{energy:-6,food:-3,mood:12},xp:10,cost:0,message:"登顶成功！小猫在猫爬架上开心地摇了摇尾巴。"},tease:{changes:{energy:-5,food:-3,mood:12},xp:8,cost:0,message:"扑到羽毛啦！小猫还想再陪你玩一会儿。"},drink:{changes:{mood:3,energy:6},xp:4,cost:0,message:"舔一舔清水，小猫喝好了，又有精神啦。"}},zo=[{id:"first_meal",title:"第一顿小鱼干",description:"亲手喂小猫吃一顿饭",target:1,rewardCoins:5,progress:i=>i.counts.feed},{id:"sparkle",title:"香香小猫",description:"帮小猫完成一次泡泡澡",target:1,rewardCoins:5,progress:i=>i.counts.bath},{id:"explorer",title:"高处探险家",description:"陪小猫登上猫爬架",target:1,rewardCoins:6,progress:i=>i.counts.climb},{id:"playmate",title:"最佳玩伴",description:"玩过逗猫棒和接鱼游戏各一次",target:2,rewardCoins:8,progress:i=>+(i.counts.tease>0)+ +(i.counts.play>0)},{id:"grown_up",title:"陪你长大",description:"把小猫养到成年",target:160,rewardCoins:10,progress:i=>i.xp}],qs=6,Si=(i,e=0,t=100)=>Math.min(t,Math.max(e,i)),Oo=i=>JSON.parse(JSON.stringify(i)),Ei=(i,e)=>i.some(t=>t.id===e),Gf=()=>Object.fromEntries(Bo.map(i=>[i,0])),ko=()=>Object.fromEntries(ei.map(i=>[i.id,0])),yu=()=>({completed:{walk:0,explore:0,fish:0},collected:ko(),claimedOrders:[],choices:0,lastLocation:"garden",nextSession:1});function Vn(i){return i>=160?{stage:"adult",stageLabel:"成年猫",growthProgress:100,nextStageXp:null}:i>=60?{stage:"young",stageLabel:"少年猫",growthProgress:i-60,nextStageXp:160}:{stage:"kitten",stageLabel:"幼猫",growthProgress:i/60*100,nextStageXp:60}}function zr(i){if(typeof i!="string")return!1;let e=Array.from(i.trim()).length;return e>=2&&e<=12&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(i)}function Vi(i,e=1e6){return Number.isInteger(i)&&i>=0&&i<=e}function gu(i,e=!1){if(!i||typeof i!="object"||Array.isArray(i))throw new Error("存档中的小猫无效。");if(!zr(i.name))throw new Error("存档中的名字需要有 2～12 个字符。");if(!Vi(i.xp,1e7))throw new Error("存档中的成长值无效。");if(!i.stats||Br.some(s=>!Number.isFinite(i.stats[s])||i.stats[s]<0||i.stats[s]>100))throw new Error("存档中的小猫状态无效。");if(!i.counts||xu.some(s=>i.counts[s]===void 0)||Bo.some(s=>i.counts[s]!==void 0&&!Vi(i.counts[s])))throw new Error("存档中的互动记录无效。");let t=i.claimedGoals===void 0&&e?[]:i.claimedGoals;if(!Array.isArray(t)||t.length>zo.length||t.some(s=>!Ei(zo,s))||new Set(t).size!==t.length)throw new Error("存档中的愿望印章无效。");let n={id:e?"cat-1":i.id,name:i.name.trim(),xp:i.xp,stats:Object.fromEntries(Br.map(s=>[s,i.stats[s]])),counts:Object.fromEntries(Bo.map(s=>[s,i.counts[s]??0])),claimedGoals:[...t],breed:e?"orange":i.breed,sex:e?"male":i.sex,outfit:e?"none":i.outfit,health:e?100:i.health,healthIssue:e?null:i.healthIssue,...__pgX(i)};if(!/^cat-[1-9]\d{0,5}$/.test(n.id)||!Ei(kn,n.breed)||!["male","female"].includes(n.sex)||n.outfit!=="none"&&!Ei(Mi,n.outfit))throw new Error("存档中的品种或装扮信息无效。");if(!Number.isFinite(n.health)||n.health<0||n.health>100||n.healthIssue!==null&&!Ei(Ws,n.healthIssue))throw new Error("存档中的健康记录无效。");return n}function __pgRm(x){if(!x||typeof x!="object")return null;const s=(v,n)=>String(v??"").slice(0,n);return{owner:s(x.owner,16),fid:s(x.fid,24),rare:typeof x.rare=="string"&&Ei(kn,x.rare)?x.rare:null}}function __pgLn(l){if(!l||typeof l!="object")return{};const s=(v,n)=>String(v??"").slice(0,n);return{lineage:{kind:"egg",partnerName:s(l.partnerName,24),partnerBreed:Ei(kn,l.partnerBreed)?l.partnerBreed:"orange",owner:s(l.owner,16),fid:s(l.fid,24),parentName:s(l.parentName,24),parentId:s(l.parentId,20),rare:typeof l.rare=="string"&&Ei(kn,l.rare)?l.rare:null,at:Number.isSafeInteger(l.at)?l.at:0}}}function __pgX(i){const t=v=>Number.isSafeInteger(v)&&v>=0?v:null;let h=i.heritage;h=h&&typeof h=="object"&&typeof h.trait=="string"&&h.trait.length<=20&&typeof h.fromName=="string"&&h.fromName.length<=24?{trait:h.trait,fromName:h.fromName,fromId:String(h.fromId||"").slice(0,20)}:null;return{joinedAt:t(i.joinedAt),adultAt:t(i.adultAt),generation:Number.isInteger(i.generation)&&i.generation>=1&&i.generation<=9999?i.generation:1,heritage:h,gradCalledAt:t(i.gradCalledAt),gradDelayUntil:t(i.gradDelayUntil),...__pgLn(i.lineage)}}function __pgY(a){if(a==null)return[];const bad=()=>{throw new Error("存档中的毕业纪念册无效。")};if(!Array.isArray(a)||a.length>200)bad();const S=(v,n)=>typeof v=="string"&&v.length<=n;let r=a.map(g=>{if(!g||typeof g!="object"||!/^cat-[1-9]\d{0,5}$/.test(g.id)||!zr(g.name)||!Ei(kn,g.breed)||!Number.isSafeInteger(g.graduatedAt))bad();return{id:g.id,name:g.name.trim(),breed:g.breed,sex:g.sex==="female"?"female":"male",generation:Number.isInteger(g.generation)&&g.generation>=1&&g.generation<=9999?g.generation:1,joinedAt:Number.isSafeInteger(g.joinedAt)?g.joinedAt:g.graduatedAt,graduatedAt:g.graduatedAt,days:Vi(g.days,1e5)?g.days:0,care:Vi(g.care)?g.care:0,stamps:Vi(g.stamps,50)?g.stamps:0,outfit:S(g.outfit,30)?g.outfit:"none",trait:S(g.trait,20)?g.trait:"",letter:S(g.letter,800)?g.letter:"",heirId:S(g.heirId,20)?g.heirId:"",heirName:S(g.heirName,24)?g.heirName:"",reason:["natural","trial"].includes(g.reason)?g.reason:"natural"}});if(new Set(r.map(g=>g.id)).size!==r.length)bad();return r}const __pgTR={feed:"小吃货",bath:"爱干净",pet:"黏人精",play:"接鱼高手",sleep:"爱睡懒觉",climb:"爱爬高",tease:"好奇宝宝",drink:"爱喝水"};function __pgT(c){let b=null,m=0;for(let k of Bo)c.counts[k]>m&&(m=c.counts[k],b=k);return b?__pgTR[b]:"温柔"}function __pgH(n){let CN="一二三四五六七八九十",base=n.trim().replace(/[一二三四五六七八九十\d]+世$/u,"")||n.trim(),m=n.trim().match(/([一二三四五六七八九十])世$/u),g=m?CN.indexOf(m[1])+2:2,r=base+(CN[g-1]||g)+"世";return zr(r)?r:(Array.from(base).slice(0,9).join("")+"二世")}function _u(i){if(!i||typeof i!="object"||Array.isArray(i)||![1,2].includes(i.version))throw new Error("这不是受支持的小猫存档。");if(!Vi(i.coins))throw new Error("存档中的金币无效。");if(![i.createdAt,i.lastSavedAt].every(r=>Number.isSafeInteger(r)&&r>=0)||i.lastSavedAt<i.createdAt)throw new Error("存档中的保存时间无效。");if(i.version===1)return{version:2,activeCatId:"cat-1",cats:[{...gu(i,!0),joinedAt:i.createdAt}],coins:i.coins,wardrobe:["none"],inventory:ko(),world:yu(),family:{pair:null,babiesBorn:0},journal:[],createdAt:i.createdAt,lastSavedAt:i.lastSavedAt,graduates:[]};if(!Array.isArray(i.cats)||i.cats.length<1||i.cats.length>qs)throw new Error("存档中的猫咪家庭需要有 1～6 只猫。");let e=i.cats.map(r=>gu(r));if(new Set(e.map(r=>r.id)).size!==e.length||!e.some(r=>r.id===i.activeCatId))throw new Error("存档中的当前小猫无效。");if(!Array.isArray(i.wardrobe)||!i.wardrobe.includes("none")||i.wardrobe.length>Mi.length+1||new Set(i.wardrobe).size!==i.wardrobe.length||i.wardrobe.some(r=>r!=="none"&&!Ei(Mi,r))||e.some(r=>!i.wardrobe.includes(r.outfit)))throw new Error("存档中的衣柜无效。");if(!i.inventory||ei.some(r=>!Vi(i.inventory[r.id],1e5)))throw new Error("存档中的背包物品无效。");let t=i.world;if(!t||!t.completed||ts.some(r=>!Vi(t.completed[r.id]))||!t.collected||ei.some(r=>!Vi(t.collected[r.id]))||!Vi(t.choices)||!Number.isSafeInteger(t.nextSession)||t.nextSession<1||!["garden","park","river"].includes(t.lastLocation))throw new Error("存档中的户外记录无效。");if(!Array.isArray(t.claimedOrders)||t.claimedOrders.length>Xs.length||new Set(t.claimedOrders).size!==t.claimedOrders.length||t.claimedOrders.some(r=>!Ei(Xs,r)))throw new Error("存档中的委托记录无效。");let __pgQ=__pgY(i.graduates);if(__pgQ.some(g=>e.some(c=>c.id===g.id)))throw new Error("存档中的毕业纪念册无效。");let n=i.family;if(!n||!Vi(n.babiesBorn))throw new Error("存档中的家庭记录无效。");let s=null;if(n.pair!==null){let r=n.pair;if(!r||!e.some(a=>a.id===r.parentId)||!Ei(kn,r.partnerBreed)||!zr(r.partnerName)||!["male","female"].includes(r.partnerSex)||!Vi(r.careProgress,3)||r.careTarget!==3||!Number.isFinite(r.activeSeconds)||r.activeSeconds<0||r.activeSeconds>60||r.requiredSeconds!==60||!Number.isSafeInteger(r.createdAt)||r.createdAt<0)throw new Error("存档中的配对陪伴记录无效。");let o=e.find(a=>a.id===r.parentId);if(Vn(o.xp).stage!=="adult"||o.sex===r.partnerSex)throw new Error("存档中的家庭配对需要成年、异性小伙伴。");s={parentId:r.parentId,partnerBreed:r.partnerBreed,partnerName:r.partnerName.trim(),partnerSex:r.partnerSex,careProgress:r.careProgress,careTarget:3,activeSeconds:r.activeSeconds,requiredSeconds:60,createdAt:r.createdAt,...(__pgRm(r.remote)?{remote:__pgRm(r.remote)}:{})}}if(!Array.isArray(i.journal)||i.journal.length>30||i.journal.some(r=>!r||typeof r.id!="string"||r.id.length>100||typeof r.kind!="string"||r.kind.length>40||typeof r.message!="string"||r.message.length>300||!Number.isSafeInteger(r.at)||r.at<0||!e.some(o=>o.id===r.catId)&&!__pgQ.some(o=>o.id===r.catId)))throw new Error("存档中的生活日记无效。");return{version:2,activeCatId:i.activeCatId,cats:e.map(c=>(c.joinedAt??=i.createdAt,c)),coins:i.coins,wardrobe:[...i.wardrobe],inventory:Object.fromEntries(ei.map(r=>[r.id,i.inventory[r.id]])),world:{completed:Object.fromEntries(ts.map(r=>[r.id,t.completed[r.id]])),collected:Object.fromEntries(ei.map(r=>[r.id,t.collected[r.id]])),claimedOrders:[...t.claimedOrders],choices:t.choices,lastLocation:t.lastLocation,nextSession:t.nextSession},family:{pair:s,babiesBorn:n.babiesBorn},journal:i.journal.map(r=>({id:r.id,kind:r.kind,message:r.message,at:r.at,catId:r.catId})),createdAt:i.createdAt,lastSavedAt:i.lastSavedAt,graduates:__pgQ}}function Wf(i){return(i==="walk"?[null,null,null]:i==="fish"?["fish","fish","fish","fish"]:["flower","flower","shell","star","fish"]).map((t,n)=>({id:`${i}-${n+1}`,itemId:t}))}function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{},hostRuntime}={}){let n=()=>Math.max(0,Math.floor(e())),s=(C,Y="orange",W="male",K="小橘")=>({id:C,name:K,xp:0,breed:Y,sex:W,outfit:"none",health:100,healthIssue:null,stats:{food:65,mood:72,clean:68,energy:75},counts:Gf(),claimedGoals:[],joinedAt:n(),adultAt:null,generation:1,heritage:null,gradCalledAt:null,gradDelayUntil:null}),r=()=>({version:2,activeCatId:"cat-1",cats:[s("cat-1")],coins:30,wardrobe:["none"],inventory:ko(),world:yu(),family:{pair:null,babiesBorn:0},journal:[],createdAt:n(),lastSavedAt:n(),graduates:[]}),o=r(),a=null,c=null,l=!1,d=0,f=null,h=null,u=null,_=null,y=0,g=e(),p={},S=()=>o.cats.find(C=>C.id===o.activeCatId);if(i===void 0)try{i=globalThis.localStorage}catch{a="浏览器暂时无法保存进度，请及时导出存档。"}if(i){let C;try{C=i.getItem(mu)}catch{l=!0,a="浏览器暂时无法读取原存档，已暂停自动保存。请重新载入，或明确导入存档、重新开始；当前互动不会覆盖原进度。"}if(C!=null)try{o=_u(JSON.parse(C))}catch{c=C,a="原存档无法读取，已保留原文。请先导出备份，再导入有效存档或重新开始；当前互动不会覆盖原存档。"}}else a||(a="当前环境未开启自动保存，请使用导出存档保存进度。");function E(C){return C==="walk"?o.world.completed.walk:C==="fishCaught"?o.world.completed.fish*4:o.world.collected[C]||0}function b(){let C=o.family.pair,Y=C?1:0;return{...o.family,maxCats:qs,count:o.cats.length,reservedSlots:Y,availableSlots:Math.max(0,qs-o.cats.length-Y),pair:C?{...C,ready:C.careProgress>=C.careTarget&&C.activeSeconds>=C.requiredSeconds,progress:Math.min(C.careProgress/C.careTarget,C.activeSeconds/C.requiredSeconds)}:null}}function I(C){return{...C,...Vn(C.xp),breedName:kn.find(Y=>Y.id===C.breed).name,sexLabel:C.sex==="male"?"小男生":"小女生",healthIssue:C.healthIssue?Ws.find(Y=>Y.id===C.healthIssue):null,grad:__pgR(C)}}function __pgR(C){let st=Vn(C.xp).stage,now=e(),GM=(globalThis.PET_GRAD_ADULT_DAYS??7)*864e5,adultAt=C.adultAt||(st==="adult"?now:null),due=adultAt!==null?adultAt+GM:null,called=!!C.gradCalledAt,reached=called||due!==null&&now>=due,blocked=o.family.pair&&o.family.pair.parentId===C.id?"pair":null,wait=C.gradDelayUntil&&now<C.gradDelayUntil?C.gradDelayUntil:null;return{stage:st,dueAt:called?C.gradCalledAt:due,called,reached,ready:reached&&!blocked&&!wait,blocked,waitingUntil:wait,canPostpone:!C.gradDelayUntil,days:Math.max(1,Math.ceil((now-(C.joinedAt||o.createdAt))/864e5)),trait:__pgT(C),heirName:__pgH(C.name),generation:C.generation||1,heritage:C.heritage||null}}function A(){let C=S(),Y=Bo.reduce((Ve,Ge)=>Ve+C.counts[Ge],0),W=Y>=20?"亲密伙伴":Y>=6?"越来越熟悉":"刚刚认识",K=zo.map(({progress:Ve,...Ge})=>({...Ge,progress:Math.min(Ge.target,Ve(C)),completed:Ve(C)>=Ge.target,claimed:C.claimedGoals.includes(Ge.id)})),Ie=Xs.map(Ve=>({...Ve,progress:Math.min(Ve.target,E(Ve.metric)),completed:E(Ve.metric)>=Ve.target,claimed:o.world.claimedOrders.includes(Ve.id)}));return Oo({...o,...I(C),cats:o.cats.map(I),activeCatId:o.activeCatId,family:b(),world:{...o.world,orders:Ie},storageIssue:a,goals:K,bondLabel:W,busy:!!(f||h||u||_),catalog:{breeds:kn,outfits:Mi,items:ei,activities:ts,orders:Xs,healthIssues:Ws},pendingWorld:u?{mode:u.mode,location:u.location,collected:u.nodes.filter(Ve=>u.collected.has(Ve.id)).length,target:u.activity.target,items:{...u.items},elapsedSeconds:Math.max(0,(e()-u.startedAt)/1e3)}:null})}function F(){for(let c of o.cats)Vn(c.xp).stage==="adult"&&!c.adultAt&&(c.adultAt=n());if(o.lastSavedAt=Math.max(o.createdAt,n()),d=0,!(c!==null||l||!i))try{i.setItem(mu,JSON.stringify(globalThis.CatOfflineDurable?.stampGame(o)||o)),a=null}catch{a="浏览器暂时无法保存进度，请导出存档备份。"}}function m(C=!0){C&&F(),t(A())}function w(C,Y,W=o.activeCatId){o.journal.push({id:`${n().toString(36)}-${o.journal.length}-${++y}`,kind:C,message:Y,at:n(),catId:W}),o.journal=o.journal.slice(-30)}function T(C,Y,reason="ineligible"){return{ok:!1,reason,message:Y,action:C,xpGain:0,coinDelta:0,stageChanged:!1,stage:Vn(S().xp).stage}}function U(C,Y,W={}){return{ok:!0,action:C,message:Y,xpGain:0,coinDelta:0,stageChanged:!1,stage:Vn(S().xp).stage,...W}}function B(C){return`${C}-${n().toString(36)}-${++y}-${Math.random().toString(36).slice(2,10)}`}function re(C){let Y=p[`${o.activeCatId}:${C}`];return Y!==void 0&&e()-Y<Hf[C]?T(C,"让小猫缓一缓，稍等一下再来吧。"):null}function se(C){return f?T(C,"这一局还没结束，先陪小猫接完鱼吧。"):h?T(C,"小猫正在互动，陪它完成这次再来吧。"):u?T(C,"小猫正在户外，先完成活动或一起回家吧。"):_?T(C,"小猫正在看医生，先完成检查或离开诊所吧。"):null}function Z(C){let Y=S();if(!Object.hasOwn(hc,C))return T(C,"小猫还不会这个互动。");let W=re(C);return W||(C==="feed"&&Y.stats.food>=95?T(C,"小猫已经吃饱啦，等肚子饿一点再喂。"):C==="bath"&&Y.stats.clean>=95?T(C,"小猫已经很干净啦，暂时不用洗澡。"):o.coins<hc[C].cost?T(C,C==="feed"?"小鱼干需要 3 枚喵币，接鱼、户外探险和出售收获都能赚钱。":"洗澡需要 2 枚喵币，接鱼、户外探险和出售收获都能赚钱。","insufficient_coins"):(C==="climb"||C==="tease")&&Y.stats.energy<10?T(C,"小猫有点累了，先让它睡个小觉吧。"):(C==="climb"||C==="tease")&&Y.healthIssue?T(C,"小猫有点不舒服，先去诊所检查，再陪它剧烈运动吧。"):null)}function ee(C){let Y=o.family.pair;Y&&Y.parentId===o.activeCatId&&["feed","bath","pet","sleep","climb","tease","drink"].includes(C)&&(Y.careProgress=Math.min(Y.careTarget,Y.careProgress+1))}function ae(C,Y,W,K,Ie,Ve=0){let Ge=S(),H=Vn(Ge.xp).stage,De=Ge.xp,N=o.coins;for(let Se of Br)Ge.stats[Se]=Si(Ge.stats[Se]+(Y[Se]||0));Ge.xp=Si(Ge.xp+W,0,1e7),o.coins=Si(o.coins+K,0,1e6),Ge.health=Si(Ge.health+Ve),Object.hasOwn(Ge.counts,C)&&(Ge.counts[C]=Math.min(1e6,Ge.counts[C]+1)),p[`${Ge.id}:${C}`]=e(),ee(C);let G=Vn(Ge.xp).stage;return G!==H&&w("growth",`${Ge.name}长成${Vn(Ge.xp).stageLabel}啦。`),m(),U(C,Ie,{xpGain:Ge.xp-De,coinDelta:o.coins-N,stageChanged:G!==H,stage:G})}function ye(C,Y={}){if(C==="play")return Ye(Y.token||f?.token,Y.score);let W=se(C);if(W)return W;if(C==="feed"||C==="bath")return Z(C)||be(C);if(!["pet","sleep"].includes(C))return T(C,"小猫还不会这个互动。");let K=re(C);return K||(C==="pet"?S().stats.mood>=98?T(C,"小猫现在心情超好，可以陪它做点别的。"):ae(C,{mood:9},3,0,"呼噜呼噜，小猫蹭了蹭你的手。"):S().stats.energy>=95?T(C,"小猫精神满满，暂时还不困。"):ae(C,{energy:35,food:-4},6,0,"小猫打了个盹，醒来又有精神了。",2))}function be(C){let Y=hc[C];return ae(C,Y.changes,Y.xp,-Y.cost,Y.message,C==="bath"?1:0)}function O(C){let Y=se(C);if(Y)return Y;let W=Z(C);return W||(h={token:B("care"),action:C,startedAt:e(),catId:o.activeCatId},U(C,"小猫准备好啦，来陪它一起完成吧！",{token:h.token}))}function z(C,{score:Y=0}={}){if(!h||C!==h.token||h.catId!==o.activeCatId)return T("care","请先开始一次小猫互动。");let{action:W,startedAt:K}=h;return!Number.isFinite(Y)||Y<0||Y>100?T(W,"这次互动的成绩无效，请重新开始。"):e()-K<1e3?T(W,"互动还没完成，再陪小猫一会儿。"):(h=null,be(W))}function ne(C){h&&(!C||C===h.token)&&(h=null)}function _e(C){let Y=se("goal");if(Y)return Y;let W=S(),K=zo.find(Ve=>Ve.id===C);if(!K)return{ok:!1,message:"没有找到这个小猫愿望。",coinsGain:0};if(W.claimedGoals.includes(C))return{ok:!1,message:"这个愿望的印章已经收好啦。",coinsGain:0};if(K.progress(W)<K.target)return{ok:!1,message:"这个愿望还没有完成，继续陪小猫一起实现吧。",coinsGain:0};let Ie=o.coins;return W.claimedGoals.push(C),o.coins=Math.min(1e6,o.coins+K.rewardCoins),w("stamp",`${W.name}收集了「${K.title}」印章。`),m(),{ok:!0,id:C,message:`收集到「${K.title}」印章！`,coinsGain:o.coins-Ie,coinDelta:o.coins-Ie}}function Fe(){let C=se("play");if(C)return C;let Y=re("play");return Y||(S().stats.energy<10?T("play","小猫有点累了，先让它睡个小觉吧。"):(f={token:B("play"),startedAt:e(),catId:o.activeCatId},U("play","接住小鱼，躲开水滴！",{token:f.token})))}function Ye(C,Y){if(!f||C!==f.token||f.catId!==o.activeCatId)return T("play","请先开始一局接鱼游戏。");if(!Number.isFinite(Y)||!Number.isInteger(Y)||Y<0||Y>15)return T("play","这局的分数无效，请重新开始。");if(e()-f.startedAt<1200)return T("play","这一局还没完成，再陪小猫玩一会儿。");f=null;let W=Y/15;return ae("play",{mood:12+Math.round(W*13),energy:-8,food:-5},10+Math.round(W*10),3+Math.round(W*9),`接住了 ${Y} 条小鱼，小猫玩得很开心！`)}function me(C){f&&(!C||C===f.token)&&(f=null)}function V(C){let Y=se("breed");if(Y)return Y;let W=kn.find(Ie=>Ie.id===C);if(!W)return T("breed","请选择已有的小猫品种。");let K=S();if(W.rare&&K.breed!==C&&K.lineage?.rare!==C)return T("breed",`${W.name}是联机生蛋的稀有后代，不能直接换上。`);return K.breed===C?U("breed",`${K.name}已经是${W.name}啦。`):(K.breed=C,w("breed",`${K.name}换上了${W.name}的毛色。`),m(),U("breed",`${K.name}现在是${W.name}啦，陪伴和成长都保留。`))}function ge(C){let Y=se("buy");if(Y)return Y;let W=Mi.find(K=>K.id===C);return W&&W.gift&&!o.wardrobe.includes(C)?T("buy",`${W.name}是馈赠限定，商店买不到，只在 Fate 缘分擦肩的大礼物里出现。`):W?o.wardrobe.includes(C)?T("buy","衣柜里已经有这件服装，不用重复购买。"):o.coins<W.price?T("buy",`这件${W.name}需要 ${W.price} 枚喵币，去户外找些收获吧。`):(o.coins-=W.price,o.wardrobe.push(C),w("shopping",`买到了${W.name}，可以在衣柜里给猫咪穿上。`),m(),U("buy",`${W.name}已经放进衣柜啦！`,{id:C,coinDelta:-W.price})):T("buy","没有找到这件服装。")}function j(C="none"){let Y=se("outfit");return Y||(C!=="none"&&!Ei(Mi,C)?T("outfit","没有找到这件服装。"):o.wardrobe.includes(C)?(S().outfit=C,m(),U("outfit",C==="none"?"换回自然蓬松的毛毛啦。":`穿上${Mi.find(W=>W.id===C).name}啦！`,{id:C})):T("outfit","先在小商店买下这件服装吧。"))}function Te(C,Y=1){let W=se("sell");if(W)return W;let K=ei.find(Ve=>Ve.id===C);if(!K)return T("sell","没有找到这件背包物品。");if(!Number.isInteger(Y)||Y<1||Y>1e5)return T("sell","出售数量需要是有效的正整数。");if(o.inventory[C]<Y)return T("sell","背包里没有这么多物品。");let Ie=Y*K.sellPrice;return o.coins+Ie>1e6?T("sell","喵币存放上限快满了，先买些喜欢的东西吧。"):(o.inventory[C]-=Y,o.coins+=Ie,w("trade",`卖出${Y}份${K.name}，赚到${Ie}枚喵币。`),m(),U("sell",`卖出${Y}份${K.name}，喵币 +${Ie}。`,{id:C,quantity:Y,coinDelta:Ie,coinsGain:Ie}))}function we(C,Y="park"){let W=se("world");if(W)return W;let K=ts.find(Ve=>Ve.id===C);if(!K||!["garden","park","river"].includes(Y))return T("world","请选择地图上的户外活动。");if(S().healthIssue)return T("world","小猫有点不舒服，先去诊所看医生吧。");if(S().stats.energy<12)return T("world","小猫累了，睡一觉再出门吧。");let Ie=o.world.nextSession;return o.world.nextSession=Ie===Number.MAX_SAFE_INTEGER?1:Ie+1,u={token:B(`world-${Ie}`),catId:o.activeCatId,mode:C,location:Y,activity:K,nodes:Wf(C),collected:new Set,items:ko(),startedAt:e(),choice:null},m(),U("world",K.description,{token:u.token,activity:Oo(K),nodes:Oo(u.nodes),location:Y})}function Re(C,Y){if(!u||C!==u.token||u.catId!==o.activeCatId)return T("world","这次户外活动已经结束，重新出门吧。");let W=u.nodes.find(K=>K.id===Y);return W?u.collected.has(W.id)?T("world","这个位置已经探索过了，去找下一个吧。"):u.mode==="walk"&&W.id!==u.nodes[u.collected.size]?.id?T("world","沿着牵绳路线，先走到前一个路标吧。"):(u.collected.add(W.id),W.itemId&&(u.items[W.itemId]+=1),m(!1),U("world",W.itemId?`找到${ei.find(K=>K.id===W.itemId).name}啦，完成后带回家。`:"到达散步路标啦。",{nodeId:Y,itemId:W.itemId,collected:u.collected.size,target:u.activity.target,items:{...u.items}})):T("world","这不是本次活动的收获。")}function Le(C,Y,W){if(!u||C!==u.token)return T("world","这次户外活动已经结束。");if(!["rain","butterfly","lost-pouch"].includes(Y)||!["safe","care","coins"].includes(W))return T("world","请选择这次小故事里的行动。");if(u.choice)return T("world","这次小故事已经做过选择啦。");let K={},Ie=0,Ve=0,Ge=null,H;return Y==="rain"?W==="safe"?H="一起躲到了屋檐下，小猫没有淋湿。":W==="care"?(Ve=3,K={mood:4},H="擦干毛毛，抱着小猫等待雨停。"):S().outfit==="raincoat"?(Ve=-2,K={mood:6,clean:-3},H="雨衣挡住了大部分雨水，小猫踩了踩水洼。"):(Ve=-18,K={mood:4,clean:-8},Ge="sniffles",H="小猫在水洼玩得很开心，但有点打喷嚏。回家后去诊所检查吧。"):Y==="lost-pouch"?W==="care"?(K={mood:6},H="把小包送回失主手里，小猫收到了一个温柔的夸奖。"):W==="coins"?(Ie=4,H="帮邻居找到小包，收到了 4 枚喵币的感谢。"):H="留在原地等了一会儿，失主回来拿走了小包。":W==="care"?(K={mood:6},H="静静看蝴蝶停在野花上，留下了一段小回忆。"):W==="coins"?(K={energy:-4,mood:5},H="小猫追着蝴蝶绕了一圈，开心地跑了回来。"):H="沿着小路绕过蝴蝶，给它留一点安静。",u.choice={event:Y,choice:W,changes:K,coinDelta:Ie,healthGain:Ve,issue:Ge,message:H},m(!1),U("world",`${H} 完成活动后保存这段经历。`,{event:Y,choice:W})}function q(){let C=0,Y=[];for(let W of Xs)!o.world.claimedOrders.includes(W.id)&&E(W.metric)>=W.target&&(o.world.claimedOrders.push(W.id),C+=W.rewardCoins,Y.push(W.id),w("order",`完成「${W.name}」委托，奖励${W.rewardCoins}枚喵币。`));return{coins:C,completed:Y}}function he(C){if(!u||C!==u.token||u.catId!==o.activeCatId)return T("world","这次户外活动已经结算过啦。");if(u.collected.size<u.activity.target)return T("world","还有小目标没有完成，继续陪小猫走走吧。");let Y=Math.ceil(u.activity.minSeconds-(e()-u.startedAt)/1e3);if(Y>0)return T("world",`小猫还想看看风景，再陪它 ${Y} 秒吧。`);let W=u;u=null;let K=S(),Ie=K.xp,Ve=o.coins,Ge=Vn(K.xp).stage;for(let Se of ei)o.inventory[Se.id]=Math.min(1e5,o.inventory[Se.id]+W.items[Se.id]),o.world.collected[Se.id]=Math.min(1e6,o.world.collected[Se.id]+W.items[Se.id]);o.world.completed[W.mode]=Math.min(1e6,o.world.completed[W.mode]+1),o.world.lastLocation=W.location,K.xp=Math.min(1e7,K.xp+W.activity.xp),K.stats.energy=Si(K.stats.energy-(W.mode==="walk"?4:6)),K.stats.food=Si(K.stats.food-3),K.stats.mood=Si(K.stats.mood+9);let H=0;if(W.choice){let Se=W.choice;for(let J of Br)K.stats[J]=Si(K.stats[J]+(Se.changes[J]||0));K.health=Si(K.health+Se.healthGain),Se.issue&&(K.healthIssue=Se.issue),H=Se.coinDelta,o.world.choices=Math.min(1e6,o.world.choices+1),w("story",Se.message)}let De=q();o.coins=Math.min(1e6,o.coins+W.activity.coins+H+De.coins);let N=`${W.activity.name}完成！收获已放进背包${De.completed.length?`，还完成了${De.completed.length}份邻里委托`:""}。`;w("outdoor",`${K.name}完成了${W.activity.name}。`);let G=Vn(K.xp).stage;return G!==Ge&&w("growth",`${K.name}长成${Vn(K.xp).stageLabel}啦。`),m(),U("world",N,{xpGain:K.xp-Ie,coinDelta:o.coins-Ve,stageChanged:G!==Ge,stage:G,items:{...W.items},ordersCompleted:De.completed,healthIssue:K.healthIssue?Ws.find(Se=>Se.id===K.healthIssue):null})}function Me(C){return!u||C&&C!==u.token?T("world","没有需要结束的户外活动。"):(u=null,m(!1),U("world","小猫回家啦，未完成的活动没有扣钱或结算收获。"))}/* 仅把已有病种转换成准确反馈，不修改诊疗费用、时序、数值或处方规则。 */
function __hostClinicFeedback(issue, name, phase) {
  const messages = {
    sniffles: {
      start: '小猫有小感冒：先量体温，再听诊和检查。完成三个步骤后才收取诊疗费用。',
      journal: '完成小感冒诊疗，打喷嚏的症状已经缓解。',
      result: '小感冒诊疗完成，小猫恢复健康啦。'
    },
    tummy: {
      start: '小猫肚子不舒服：先量体温，再听诊和检查。完成三个步骤后才收取诊疗费用。',
      journal: '完成肠胃不适诊疗，肚子已经舒服啦。',
      result: '肠胃不适诊疗完成，小猫恢复健康啦。'
    },
    healthy: {
      start: '这次是健康体检：先量体温，再完成三个检查步骤。检查完成才收费。',
      journal: '完成了一次健康体检。',
      result: '检查结束，小猫很健康，继续一起生活吧。'
    },
    unknown: {
      start: '小猫有不适：先量体温，再完成医生的三个检查步骤。检查完成才收费。',
      journal: '完成诊疗，小猫恢复健康啦。',
      result: '诊疗完成，小猫恢复健康啦。'
    }
  };
  const kind = issue === null || issue === undefined ? 'healthy' : Object.hasOwn(messages, issue) ? issue : 'unknown';
  const text = messages[kind][phase];
  if (typeof text !== 'string') throw new Error('未知诊疗反馈阶段。');
  return phase === 'journal' ? String(name) + text : text;
}
function Ae(){let C=se("clinic");if(C)return C;let Y=S().healthIssue,W=Y?8:4;return o.coins<W?T("clinic",`这次${Y?"诊疗":"体检"}需要 ${W} 枚喵币，先出售一些背包收获吧。`):(_={token:B("clinic"),startedAt:e(),catId:o.activeCatId,cost:W,issue:Y},U("clinic",__hostClinicFeedback(Y,S().name,"start"),{token:_.token,cost:W,issue:Y?Oo(Ws.find(K=>K.id===Y)):null,requiredSteps:3}))}function Be(C,{steps:Y=0}={}){if(!_||C!==_.token||_.catId!==o.activeCatId)return T("clinic","这次检查已经结束，请重新挂号。");if(Y!==3)return T("clinic","先完成医生的三个检查步骤吧。");if(e()-_.startedAt<1500)return T("clinic","医生还在检查，再陪小猫一会儿。");let W=_.cost;if(o.coins<W)return T("clinic","喵币不足，这次检查没有扣费。");let K=S(),Ie=K.healthIssue;return _=null,K.healthIssue=null,w("clinic",__hostClinicFeedback(Ie,K.name,"journal")),ae("clinic",{mood:3},3,-W,__hostClinicFeedback(Ie,K.name,"result"),Ie?30:8)}function ke(C){return!_||C&&C!==_.token?T("clinic","没有需要取消的检查。"):(_=null,m(!1),U("clinic","检查已取消，没有收取诊疗费用。"))}function qe(){let C=1;for(;o.cats.some(Y=>Y.id===`cat-${C}`)||o.graduates.some(Y=>Y.id===`cat-${C}`);)C+=1;return`cat-${C}`}function $e({breed:C="orange",sex:Y="female",name:W="小奶糖"}={}){let K=se("adopt");if(K)return K;if(!Ei(kn,C)||!["male","female"].includes(Y)||!zr(W))return T("adopt","请选择有效品种、性别和 2～12 字的猫咪名字。");if(o.cats.length>=qs)return T("adopt","家里已经有 6 只猫咪啦，先好好陪伴它们吧。");if(b().availableSlots===0)return T("adopt","最后一个位置已留给正在准备出生的幼猫。先迎接幼猫，或取消育幼后再领养吧。");if(o.coins<12)return T("adopt","准备幼猫用品需要 12 枚喵币。");let Ie=s(qe(),C,Y,W.trim());return o.cats.push(Ie),o.activeCatId=Ie.id,o.coins-=12,w("adopt",`${Ie.name}来到家里，从小小幼猫开始长大。`),m(),U("adopt",`欢迎${Ie.name}回家！可以在家庭里切换照顾每一只猫。`,{catId:Ie.id,coinDelta:-12})}function it(C){let Y=se("switch");if(Y)return Y;let W=o.cats.find(K=>K.id===C);return W?(o.activeCatId=C,g=e(),m(),U("switch",`现在陪伴${W.name}啦。`,{catId:C})):T("switch","没有找到这只家庭猫咪。")}function X(C){let Y=se("family");if(Y)return Y;let W=S();return kn.find(K=>K.id===C)?.rare?T("family","稀有品种只会出现在联机生蛋的后代里，NPC 小伙伴里没有哦。"):Ei(kn,C)?o.family.pair?T("family","家里已经有一对正在准备迎接幼猫的小伙伴。"):Vn(W.xp).stage!=="adult"?T("family","小猫需要先长到成年，才能迎接新的家庭成员。"):W.healthIssue||W.health<65?T("family","先让小猫恢复健康，再准备迎接幼猫吧。"):o.cats.length>=qs?T("family","家里已经有 6 只猫咪啦，没有新的幼猫位置。"):o.coins<30?T("family","为新家庭准备用品需要 30 枚喵币。"):(o.coins-=30,o.family.pair={parentId:W.id,partnerBreed:C,partnerName:"小伙伴",partnerSex:W.sex==="male"?"female":"male",careProgress:0,careTarget:3,activeSeconds:0,requiredSeconds:60,createdAt:n()},g=e(),w("family",`${W.name}与${kn.find(K=>K.id===C).name}小伙伴开始准备迎接幼猫。`),m(),U("family","配对成功！实际照顾它 3 次，再一起活跃陪伴 60 秒，就能迎接幼猫。",{coinDelta:-30,family:b()})):T("family","请选择小伙伴的品种。")}function gt(){let C=se("family");if(C)return C;let Y=o.family.pair;if(!Y)return T("family","当前没有需要取消的育幼准备。");if(o.coins+30>1e6)return T("family","喵币暂时放不下完整的 30 枚退款，先买些喜欢的东西，再取消育幼吧。");let W=o.cats.find(K=>K.id===Y.parentId);if(Y.remote)return o.family.pair=null,g=e(),w("family",`${W.name}和${Y.partnerName}的联机蛋先收起来了，下次见面可以再约。`,W.id),m(),U("family","联机蛋已取消（联机生蛋不消耗喵币）。",{coinDelta:0,family:b()});return o.family.pair=null,o.coins+=30,g=e(),w("family",`${W.name}取消了这次育幼准备，退回 30 枚喵币，家里的猫咪继续保留。`,W.id),m(),U("family","育幼准备已取消，30 枚喵币已经退回。",{coinDelta:30,family:b()})}function ot(C){let Y=Math.max(0,(e()-g)/1e3);g=e();let W=o.family.pair;if(!W||W.parentId!==o.activeCatId||S().healthIssue||!Number.isFinite(C)||C<=0)return!1;let K=Math.min(5,C,Y);return K<=0||W.activeSeconds>=W.requiredSeconds?!1:(W.activeSeconds=Math.min(W.requiredSeconds,W.activeSeconds+K),!0)}function R(C){return ot(C)&&(d+=Math.min(5,C),m(d>=15)),A().family}function x(C="小奶糖",Y){let W=se("family");if(W)return W;let K=o.family.pair;if(!K||K.careProgress<K.careTarget||K.activeSeconds<K.requiredSeconds)return T("family","还需要更多实际照料和活跃陪伴，幼猫还没有准备好。");let Ie=o.cats.find(H=>H.id===K.parentId);if(Vn(Ie.xp).stage!=="adult")return T("family","父母需要长到成年，才能迎接幼猫。");if(Ie.healthIssue||Ie.health<65)return T("family","先让猫妈妈和猫爸爸恢复健康，再迎接幼猫吧。");if(o.cats.length>=qs)return T("family","家里已经有 6 只猫咪，没有新的幼猫位置。");let Ve=Y===void 0?K.remote&&K.remote.rare||(o.family.babiesBorn%2?Ie.breed:K.partnerBreed):Y;if(!zr(C)||![Ie.breed,K.partnerBreed,K.remote&&K.remote.rare].filter(Boolean).includes(Ve))return T("family","为幼猫取 2～12 字的名字，并选择父母中的一种毛色。");let Ge=s(qe(),Ve,o.family.babiesBorn%2?"male":"female",C.trim());return K.remote&&(Ge.lineage={kind:"egg",partnerName:K.partnerName,partnerBreed:K.partnerBreed,owner:K.remote.owner,fid:K.remote.fid,parentName:Ie.name,parentId:Ie.id,rare:K.remote.rare||null,at:n()}),o.cats.push(Ge),o.activeCatId=Ge.id,o.family.babiesBorn=Math.min(1e6,o.family.babiesBorn+1),o.family.pair=null,w("birth",`${Ge.name}出生啦！从幼猫开始陪它长大。`,Ge.id),m(),U("family",`${Ge.name}出生啦！现在可以照顾幼猫，也能切回家里的大猫。`,{catId:Ge.id,baby:I(Ge)})}function Q(C){if(!Number.isFinite(C)||C<=0)return A();let Y=Math.min(30,C),W=S(),K={food:.006,mood:.004,clean:.003,energy:.004};for(let Ie of Br)W.stats[Ie]=Si(W.stats[Ie]-K[Ie]*Y);return ot(Y),d+=Y,m(d>=15),A()}function ue(C){let Y=se("rename");return Y||(zr(C)?(S().name=C.trim(),m(),{ok:!0,message:`以后就叫${S().name}啦！`}):{ok:!1,message:"名字需要 2～12 个字符，不能包含控制字符。"})}function xe(){return c!==null?c:JSON.stringify({...o,lastSavedAt:Math.max(o.createdAt,n())},null,2)}function Pe(){f=null,h=null,u=null,_=null,g=e();for(let C of Object.keys(p))delete p[C]}function Ue(C){let Y=se("import");if(Y)return Y;let W;try{if(typeof C!="string"||C.length>1e5)throw new Error("请选择有效的小猫存档文件。");W=_u(JSON.parse(C))}catch(K){return{ok:!1,message:K instanceof SyntaxError?"存档格式不正确，当前进度没有改变。":K.message}}return o=W,c=null,l=!1,a=null,Pe(),m(),{ok:!0,message:"存档已恢复，整个猫咪家庭回来啦！",stage:Vn(S().xp).stage}}function fe(){return o=r(),c=null,l=!1,a=null,Pe(),m(),A()}function __pgC(C=o.activeCatId,{force:Y=!1}={}){let W=o.cats.find(K=>K.id===C);if(!W)return T("graduate","没有找到这只猫咪。");if(W.gradCalledAt)return U("graduate","已经在准备毕业啦。");if(!Y&&Vn(W.xp).stage==="kitten")return T("graduate","幼猫还太小，等它长大一些吧。");W.gradCalledAt=n(),w("graduate",`${W.name}望着窗外发呆，好像有话想对你说。`,W.id),m();return U("graduate","毕业邀请已送达。")}function __pgP(C=o.activeCatId){let W=o.cats.find(K=>K.id===C);if(!W)return T("graduate","没有找到这只猫咪。");let g=__pgR(W);if(!g.ready)return T("graduate","现在还不是毕业的时候。");if(!g.canPostpone)return T("graduate","已经多陪过一天啦，这次好好送它出发吧。");W.gradDelayUntil=n()+864e5,w("graduate",`${W.name}答应再陪你一天。`,W.id),m();return U("graduate",`${W.name}蹭了蹭你：「那就再陪你一天。」`)}function __pgG(C=o.activeCatId,{heirName:Y,heirSex:X,letter:L=""}={}){let bz=se("graduate");if(bz)return bz;let ix=o.cats.findIndex(K=>K.id===C),W=o.cats[ix];if(!W)return T("graduate","没有找到这只猫咪。");if(!__pgR(W).ready)return T("graduate","现在还不是毕业的时候。");let tr=__pgT(W),hn=typeof Y=="string"&&zr(Y)?Y.trim():__pgH(W.name),hid=qe(),H=s(hid,W.breed,X==="male"||X==="female"?X:W.sex==="male"?"female":"male",hn);H.generation=(W.generation||1)+1,H.heritage={trait:tr,fromName:W.name,fromId:W.id},H.stats.mood=88;let rec={id:W.id,name:W.name,breed:W.breed,sex:W.sex,generation:W.generation||1,joinedAt:W.joinedAt||o.createdAt,graduatedAt:n(),days:Math.max(1,Math.ceil((n()-(W.joinedAt||o.createdAt))/864e5)),care:Bo.reduce((a,k)=>a+W.counts[k],0),stamps:W.claimedGoals.length,outfit:W.outfit,trait:tr,letter:String(L).slice(0,800),heirId:hid,heirName:hn,reason:W.gradCalledAt?"trial":"natural"};o.graduates.push(rec),o.cats.splice(ix,1,H),o.activeCatId===W.id&&(o.activeCatId=hid,g=e());for(let k of Object.keys(p))k.startsWith(W.id+":")&&delete p[k];w("graduate",`${W.name}毕业啦，带着和你的回忆去看更大的世界。`,W.id),w("graduate",`${hn}来到家里，是第 ${H.generation} 代，继承了「${tr}」的性子。`,hid),m();return U("graduate",`${W.name}毕业啦，${hn}来到了家里。`,{record:Oo(rec),heirId:hid})}function ve(){return m(!0),A()}function __pgSG(G={}){let c=S(),co=Math.round(+G.coins||0);if(!Number.isFinite(co))co=0;co=Math.max(-1e4,Math.min(500,co));if(co<0&&o.coins+co<0)return T("social","喵币不够啦。");co&&(o.coins=Si(o.coins+co,0,1e6));let md=Math.round(+G.mood||0);md&&(c.stats.mood=Si(c.stats.mood+Math.max(-20,Math.min(20,md))));for(let[k,v]of Object.entries(G.items||{}))ei.some(x=>x.id===k)&&(o.inventory[k]=Math.max(0,Math.min(1e5,(o.inventory[k]||0)+(v|0))));let got=[];for(let id of G.outfits||[])Ei(Mi,id)&&!o.wardrobe.includes(id)&&(o.wardrobe.push(id),got.push(id));G.journal&&w(String(G.journal.kind||"social").slice(0,40),String(G.journal.msg||"").slice(0,120));m();return U("social",String(G.message||"收到啦"),{coinDelta:co,outfits:got})}function __pgRF(P={}){let Y=se("family");if(Y)return Y;let W=S(),nm=String(P.name||"").trim();zr(nm)||(nm="好友的猫");return o.family.pair?T("family","家里已经有一对正在准备迎接幼猫的小伙伴，先完成或取消它。"):Vn(W.xp).stage!=="adult"?T("family","小猫需要先长到成年，才能和好友的猫一起生蛋。"):W.healthIssue||W.health<65?T("family","先让小猫恢复健康，再约好友一起生蛋吧。"):o.cats.length>=qs?T("family","家里已经有 6 只猫咪啦，没有新的幼猫位置。"):!Ei(kn,P.breed)?T("family","好友猫咪的品种无效。"):P.sex&&P.sex===W.sex?T("family","联机生蛋需要一只异性的好友猫咪。"):(o.family.pair={parentId:W.id,partnerBreed:P.breed,partnerName:nm,partnerSex:W.sex==="male"?"female":"male",careProgress:0,careTarget:3,activeSeconds:0,requiredSeconds:60,createdAt:n(),remote:{owner:String(P.owner||"").slice(0,16),fid:String(P.fid||"").slice(0,24),rare:typeof P.rare=="string"&&Ei(kn,P.rare)?P.rare:null}},g=e(),w("family",`${W.name}和好友的${nm}约好一起孵一颗蛋。`),m(),U("family","联机蛋放进窝里啦！照顾 3 次 + 活跃陪伴 60 秒就会孵化。",{coinDelta:0,family:b()}))}const __hostApi={hostDeviceCare:C=>{if(!["feed","drink","bath","tease","pet","sleep"].includes(C))return T(C,"未知设备照料，不发放奖励。");return se(C)||(C==="pet"||C==="sleep"?ye(C):Z(C)||be(C))},socialGrant:__pgSG,beginRemoteFamily:__pgRF,lifeLog:(k,M,d=0,cn=0)=>{let c=S();d&&(c.stats.mood=Si(c.stats.mood+d));cn&&(o.coins=Si(o.coins+cn,0,1e6));w(k,M);m();return A()},callGraduation:__pgC,postponeGraduation:__pgP,graduate:__pgG,getState:A,act:ye,tick:Q,rename:ue,exportSave:xe,importSave:Ue,reset:fe,beginCare:O,finishCare:z,cancelCare:ne,beginPlay:Fe,finishPlay:Ye,cancelPlay:me,claimGoal:_e,flush:ve,chooseBreed:V,buyItem:ge,equipItem:j,sellItem:Te,beginWorldActivity:we,collectWorldItem:Re,applyWorldChoice:Le,settleWorldActivity:he,cancelWorldActivity:Me,beginVisit:Ae,finishVisit:Be,cancelVisit:ke,beginFamily:X,cancelFamily:gt,advanceFamily:R,claimBaby:x,switchCat:it,adoptCat:$e};/* Embedded into the original vu closure by build_assets. No persistence or clocks are invented. */
function __hostInstallCareRuntime(api,{identity,read,replace,clock,cooldowns,activeCatId,keys,hydrate,seed}){
  let owner=null;
  const fail=message=>Object.assign(new Error(message),{code:'CARE_RUNTIME_INVALID'});
  const runtime=()=>({schema:1,identity:identity(),cooldowns:{...read()}});
  function validate(value){
    if(value?.schema!==1||value.identity!==identity()||!value.cooldowns||typeof value.cooldowns!=='object'||Array.isArray(value.cooldowns))throw fail('照料会话上下文与当前原存档不符。');
    const allowed=new Set(keys()),entries=Object.entries(value.cooldowns);
    if(entries.length>allowed.size||entries.some(([k,v])=>!allowed.has(k)||!Number.isSafeInteger(v)||v<0))throw fail('照料会话冷却记录无效。');
    return {...value.cooldowns};
  }
  const originalImport=hydrate,originalFlush=api.flush;
  if(seed!==undefined)replace(validate(seed));
  // Guard every original public write, including reset/tick/socialGrant and future additions.
  for(const [name,fn]of Object.entries(api))if(typeof fn==='function'&&!['getState','exportSave'].includes(name)){
    api[name]=(...args)=>owner?{ok:false,code:'CARE_RUNTIME_BUSY',action:name,message:'设备结果正在保存，请稍后再操作。'}:fn(...args);
  }
  api.hostReadCareRuntime=runtime;
  api.hostCareRuntimeBusy=()=>owner!==null;
  api.hostCareDelay=action=>{
    const last=read()[activeCatId()+':'+action];
    return last===undefined?0:Math.max(0,(cooldowns[action]||0)-(clock()-last));
  };
  api.hostFreezeDeviceResult=()=>{
    if(owner)throw Object.assign(Error('设备结果正在保存，请稍后再操作。'),{code:'CARE_RUNTIME_BUSY'});
    const token={};owner=token;
    const owned=()=>{if(owner!==token)throw Object.assign(Error('设备结果存储通道已释放。'),{code:'CARE_RUNTIME_STALE'});};
    return Object.freeze({
      flush(){owned();return originalFlush();},
      hydrateDevice(raw,context){
        owned();const next=validate(context);let result;
        try{result=originalImport(raw);}catch(e){replace(next);throw e;}
        if(result.ok){replace(validate({...context,cooldowns:next}));}
        return result;
      },
      importSave(raw){owned();return originalImport(raw);},
      release(){if(owner===token)owner=null;}
    });
  };
  return api;
}
return __hostInstallCareRuntime(__hostApi,{identity:()=>JSON.stringify([o.createdAt,o.activeCatId,o.cats.map(C=>[C.id,C.joinedAt])]),read:()=>p,replace:value=>{p=value},clock:e,cooldowns:Hf,activeCatId:()=>o.activeCatId,keys:()=>o.cats.flatMap(C=>[...Bo,"clinic"].map(Y=>C.id+":"+Y)),hydrate:Ue,seed:hostRuntime});}/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */var gs={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},_s={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Qu=0,jc=1,ed=2;var gi=1,tl=2,Sr=3,$i=0,Dn=1,Ci=2,Pi=0,Ds=1,Qc=2,eh=3,th=4,td=5;var cs=100,nd=101,id=102,sd=103,rd=104,od=200,ad=201,ld=202,cd=203,fa=204,pa=205,hd=206,ud=207,dd=208,fd=209,pd=210,md=211,gd=212,_d=213,xd=214,ma=0,ga=1,_a=2,Ns=3,xa=4,ya=5,va=6,ba=7,nh=0,yd=1,vd=2,_i=0,ih=1,sh=2,rh=3,Ki=4,oh=5,ah=6,lh=7;var ch=300,xs=301,Bs=302,nl=303,il=304,Mo=306,Ma=1e3,Ti=1001,Sa=1002,Jt=1003,bd=1004;var So=1005;var yn=1006,sl=1007;var ys=1008;var Fn=1009,hh=1010,uh=1011,Er=1012,rl=1013,xi=1014,yi=1015,Ii=1016,ol=1017,al=1018,wr=1020,dh=35902,fh=35899,ph=1021,mh=1022,ii=1023,Ai=1026,vs=1027,gh=1028,ll=1029,bs=1030,cl=1031;var hl=1033,Eo=33776,wo=33777,To=33778,Ao=33779,ul=35840,dl=35841,fl=35842,pl=35843,ml=36196,gl=37492,_l=37496,xl=37488,yl=37489,Ro=37490,vl=37491,bl=37808,Ml=37809,Sl=37810,El=37811,wl=37812,Tl=37813,Al=37814,Rl=37815,Cl=37816,Pl=37817,Il=37818,Ll=37819,Dl=37820,Nl=37821,Ul=36492,Fl=36494,Ol=36495,Bl=36283,zl=36284,Co=36285,kl=36286;var Jr=2300,Ea=2301,ua=2302,Oc=2303,Bc=2400,zc=2401,kc=2402;var Md=3200;var Vl=0,Sd=1,ji="",Zt="srgb",Kr="srgb-linear",jr="linear",zt="srgb";var Ps=7680;var Vc=519,Ed=512,wd=513,Td=514,Hl=515,Ad=516,Rd=517,Gl=518,Cd=519,Hc=35044;var _h="300 es",ui=2e3,lr=2001;function Xf(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function qf(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function cr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Pd(){let i=cr("canvas");return i.style.display="block",i}var bu={},hr=null;function xh(...i){let e="THREE."+i.shift();hr?hr("log",e,...i):console.log(e,...i)}function Id(i){let e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function ft(...i){i=Id(i);let e="THREE."+i.shift();if(hr)hr("warn",e,...i);else{let t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function mt(...i){i=Id(i);let e="THREE."+i.shift();if(hr)hr("error",e,...i);else{let t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Ls(...i){let e=i.join(" ");e in bu||(bu[e]=!0,ft(...i))}function Ld(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}var Dd={[ma]:ga,[_a]:va,[xa]:ba,[Ns]:ya,[ga]:ma,[va]:_a,[ba]:xa,[ya]:Ns},di=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let s=n[e];if(s!==void 0){let r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,e);e.target=null}}},Mn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Mu=1234567,qr=Math.PI/180,ur=180/Math.PI;function zs(){let i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Mn[i&255]+Mn[i>>8&255]+Mn[i>>16&255]+Mn[i>>24&255]+"-"+Mn[e&255]+Mn[e>>8&255]+"-"+Mn[e>>16&15|64]+Mn[e>>24&255]+"-"+Mn[t&63|128]+Mn[t>>8&255]+"-"+Mn[t>>16&255]+Mn[t>>24&255]+Mn[n&255]+Mn[n>>8&255]+Mn[n>>16&255]+Mn[n>>24&255]).toLowerCase()}function St(i,e,t){return Math.max(e,Math.min(t,i))}function yh(i,e){return(i%e+e)%e}function Yf(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function $f(i,e,t){return i!==e?(t-i)/(e-i):0}function Yr(i,e,t){return(1-t)*i+t*e}function Zf(i,e,t,n){return Yr(i,e,1-Math.exp(-t*n))}function Jf(i,e=1){return e-Math.abs(yh(i,e*2)-e)}function Kf(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function jf(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function Qf(i,e){return i+Math.floor(Math.random()*(e-i+1))}function ep(i,e){return i+Math.random()*(e-i)}function tp(i){return i*(.5-Math.random())}function np(i){i!==void 0&&(Mu=i);let e=Mu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function ip(i){return i*qr}function sp(i){return i*ur}function rp(i){return(i&i-1)===0&&i!==0}function op(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function ap(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function lp(i,e,t,n,s){let r=Math.cos,o=Math.sin,a=r(t/2),c=o(t/2),l=r((e+n)/2),d=o((e+n)/2),f=r((e-n)/2),h=o((e-n)/2),u=r((n-e)/2),_=o((n-e)/2);switch(s){case"XYX":i.set(a*d,c*f,c*h,a*l);break;case"YZY":i.set(c*h,a*d,c*f,a*l);break;case"ZXZ":i.set(c*f,c*h,a*d,a*l);break;case"XZX":i.set(a*d,c*_,c*u,a*l);break;case"YXY":i.set(c*u,a*d,c*_,a*l);break;case"ZYZ":i.set(c*_,c*u,a*d,a*l);break;default:ft("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function or(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Pn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Dt={DEG2RAD:qr,RAD2DEG:ur,generateUUID:zs,clamp:St,euclideanModulo:yh,mapLinear:Yf,inverseLerp:$f,lerp:Yr,damp:Zf,pingpong:Jf,smoothstep:Kf,smootherstep:jf,randInt:Qf,randFloat:ep,randFloatSpread:tp,seededRandom:np,degToRad:ip,radToDeg:sp,isPowerOfTwo:rp,ceilPowerOfTwo:op,floorPowerOfTwo:ap,setQuaternionFromProperEuler:lp,normalize:Pn,denormalize:or},wh=class wh{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=St(this.x,e.x,t.x),this.y=St(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=St(this.x,e,t),this.y=St(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(St(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(St(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*s+e.x,this.y=r*s+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};wh.prototype.isVector2=!0;var ze=wh,In=class{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,o,a){let c=n[s+0],l=n[s+1],d=n[s+2],f=n[s+3],h=r[o+0],u=r[o+1],_=r[o+2],y=r[o+3];if(f!==y||c!==h||l!==u||d!==_){let g=c*h+l*u+d*_+f*y;g<0&&(h=-h,u=-u,_=-_,y=-y,g=-g);let p=1-a;if(g<.9995){let S=Math.acos(g),E=Math.sin(S);p=Math.sin(p*S)/E,a=Math.sin(a*S)/E,c=c*p+h*a,l=l*p+u*a,d=d*p+_*a,f=f*p+y*a}else{c=c*p+h*a,l=l*p+u*a,d=d*p+_*a,f=f*p+y*a;let S=1/Math.sqrt(c*c+l*l+d*d+f*f);c*=S,l*=S,d*=S,f*=S}}e[t]=c,e[t+1]=l,e[t+2]=d,e[t+3]=f}static multiplyQuaternionsFlat(e,t,n,s,r,o){let a=n[s],c=n[s+1],l=n[s+2],d=n[s+3],f=r[o],h=r[o+1],u=r[o+2],_=r[o+3];return e[t]=a*_+d*f+c*u-l*h,e[t+1]=c*_+d*h+l*f-a*u,e[t+2]=l*_+d*u+a*h-c*f,e[t+3]=d*_-a*f-c*h-l*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,s=e._y,r=e._z,o=e._order,a=Math.cos,c=Math.sin,l=a(n/2),d=a(s/2),f=a(r/2),h=c(n/2),u=c(s/2),_=c(r/2);switch(o){case"XYZ":this._x=h*d*f+l*u*_,this._y=l*u*f-h*d*_,this._z=l*d*_+h*u*f,this._w=l*d*f-h*u*_;break;case"YXZ":this._x=h*d*f+l*u*_,this._y=l*u*f-h*d*_,this._z=l*d*_-h*u*f,this._w=l*d*f+h*u*_;break;case"ZXY":this._x=h*d*f-l*u*_,this._y=l*u*f+h*d*_,this._z=l*d*_+h*u*f,this._w=l*d*f-h*u*_;break;case"ZYX":this._x=h*d*f-l*u*_,this._y=l*u*f+h*d*_,this._z=l*d*_-h*u*f,this._w=l*d*f+h*u*_;break;case"YZX":this._x=h*d*f+l*u*_,this._y=l*u*f+h*d*_,this._z=l*d*_-h*u*f,this._w=l*d*f-h*u*_;break;case"XZY":this._x=h*d*f-l*u*_,this._y=l*u*f-h*d*_,this._z=l*d*_+h*u*f,this._w=l*d*f+h*u*_;break;default:ft("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],s=t[4],r=t[8],o=t[1],a=t[5],c=t[9],l=t[2],d=t[6],f=t[10],h=n+a+f;if(h>0){let u=.5/Math.sqrt(h+1);this._w=.25/u,this._x=(d-c)*u,this._y=(r-l)*u,this._z=(o-s)*u}else if(n>a&&n>f){let u=2*Math.sqrt(1+n-a-f);this._w=(d-c)/u,this._x=.25*u,this._y=(s+o)/u,this._z=(r+l)/u}else if(a>f){let u=2*Math.sqrt(1+a-n-f);this._w=(r-l)/u,this._x=(s+o)/u,this._y=.25*u,this._z=(c+d)/u}else{let u=2*Math.sqrt(1+f-n-a);this._w=(o-s)/u,this._x=(r+l)/u,this._y=(c+d)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(St(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,s=e._y,r=e._z,o=e._w,a=t._x,c=t._y,l=t._z,d=t._w;return this._x=n*d+o*a+s*l-r*c,this._y=s*d+o*c+r*a-n*l,this._z=r*d+o*l+n*c-s*a,this._w=o*d-n*a-s*c-r*l,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,o=e._w,a=this.dot(e);a<0&&(n=-n,s=-s,r=-r,o=-o,a=-a);let c=1-t;if(a<.9995){let l=Math.acos(a),d=Math.sin(l);c=Math.sin(c*l)/d,t=Math.sin(t*l)/d,this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+o*t,this._onChangeCallback()}else this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+o*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Th=class Th{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Su.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Su.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,s=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,s=this.z,r=e.x,o=e.y,a=e.z,c=e.w,l=2*(o*s-a*n),d=2*(a*t-r*s),f=2*(r*n-o*t);return this.x=t+c*l+o*f-a*d,this.y=n+c*d+a*l-r*f,this.z=s+c*f+r*d-o*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=St(this.x,e.x,t.x),this.y=St(this.y,e.y,t.y),this.z=St(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=St(this.x,e,t),this.y=St(this.y,e,t),this.z=St(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(St(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,s=e.y,r=e.z,o=t.x,a=t.y,c=t.z;return this.x=s*c-r*a,this.y=r*o-n*c,this.z=n*a-s*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return uc.copy(this).projectOnVector(e),this.sub(uc)}reflect(e){return this.sub(uc.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(St(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Th.prototype.isVector3=!0;var L=Th,uc=new L,Su=new In,Ah=class Ah{constructor(e,t,n,s,r,o,a,c,l){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,c,l)}set(e,t,n,s,r,o,a,c,l){let d=this.elements;return d[0]=e,d[1]=s,d[2]=a,d[3]=t,d[4]=r,d[5]=c,d[6]=n,d[7]=o,d[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[3],c=n[6],l=n[1],d=n[4],f=n[7],h=n[2],u=n[5],_=n[8],y=s[0],g=s[3],p=s[6],S=s[1],E=s[4],b=s[7],I=s[2],A=s[5],F=s[8];return r[0]=o*y+a*S+c*I,r[3]=o*g+a*E+c*A,r[6]=o*p+a*b+c*F,r[1]=l*y+d*S+f*I,r[4]=l*g+d*E+f*A,r[7]=l*p+d*b+f*F,r[2]=h*y+u*S+_*I,r[5]=h*g+u*E+_*A,r[8]=h*p+u*b+_*F,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],d=e[8];return t*o*d-t*a*l-n*r*d+n*a*c+s*r*l-s*o*c}invert(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],d=e[8],f=d*o-a*l,h=a*c-d*r,u=l*r-o*c,_=t*f+n*h+s*u;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);let y=1/_;return e[0]=f*y,e[1]=(s*l-d*n)*y,e[2]=(a*n-s*o)*y,e[3]=h*y,e[4]=(d*t-s*c)*y,e[5]=(s*r-a*t)*y,e[6]=u*y,e[7]=(n*c-l*t)*y,e[8]=(o*t-n*r)*y,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,o,a){let c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*o+l*a)+o+e,-s*l,s*c,-s*(-l*o+c*a)+a+t,0,0,1),this}scale(e,t){return Ls("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(dc.makeScale(e,t)),this}rotate(e){return Ls("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(dc.makeRotation(-e)),this}translate(e,t){return Ls("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(dc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Ah.prototype.isMatrix3=!0;var vt=Ah,dc=new vt,Eu=new vt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),wu=new vt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function cp(){let i={enabled:!0,workingColorSpace:Kr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===zt&&(s.r=Yi(s.r),s.g=Yi(s.g),s.b=Yi(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===zt&&(s.r=ar(s.r),s.g=ar(s.g),s.b=ar(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ji?jr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Ls("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Ls("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Kr]:{primaries:e,whitePoint:n,transfer:jr,toXYZ:Eu,fromXYZ:wu,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Zt},outputColorSpaceConfig:{drawingBufferColorSpace:Zt}},[Zt]:{primaries:e,whitePoint:n,transfer:zt,toXYZ:Eu,fromXYZ:wu,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Zt}}}),i}var Ct=cp();function Yi(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ar(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Ys,wa=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Ys===void 0&&(Ys=cr("canvas")),Ys.width=e.width,Ys.height=e.height;let s=Ys.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=Ys}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=cr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Yi(r[o]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Yi(t[n]/255)*255):t[n]=Yi(t[n]);return{data:t,width:e.width,height:e.height}}else return ft("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},hp=0,dr=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:hp++}),this.uuid=zs(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(fc(s[o].image)):r.push(fc(s[o]))}else r=fc(s);n.url=r}return t||(e.images[this.uuid]=n),n}};function fc(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?wa.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(ft("Texture: Unable to serialize Texture."),{})}var up=0,pc=new L,wn=class i extends di{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=Ti,s=Ti,r=yn,o=ys,a=ii,c=Fn,l=i.DEFAULT_ANISOTROPY,d=ji){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:up++}),this.uuid=zs(),this.name="",this.source=new dr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new ze(0,0),this.repeat=new ze(1,1),this.center=new ze(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new vt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(pc).x}get height(){return this.source.getSize(pc).y}get depth(){return this.source.getSize(pc).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){ft(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){ft(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ch)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Ma:e.x=e.x-Math.floor(e.x);break;case Ti:e.x=e.x<0?0:1;break;case Sa:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Ma:e.y=e.y-Math.floor(e.y);break;case Ti:e.y=e.y<0?0:1;break;case Sa:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};wn.DEFAULT_IMAGE=null;wn.DEFAULT_MAPPING=ch;wn.DEFAULT_ANISOTROPY=1;var Rh=class Rh{constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,s=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*s+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r,c=e.elements,l=c[0],d=c[4],f=c[8],h=c[1],u=c[5],_=c[9],y=c[2],g=c[6],p=c[10];if(Math.abs(d-h)<.01&&Math.abs(f-y)<.01&&Math.abs(_-g)<.01){if(Math.abs(d+h)<.1&&Math.abs(f+y)<.1&&Math.abs(_+g)<.1&&Math.abs(l+u+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let E=(l+1)/2,b=(u+1)/2,I=(p+1)/2,A=(d+h)/4,F=(f+y)/4,m=(_+g)/4;return E>b&&E>I?E<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(E),s=A/n,r=F/n):b>I?b<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(b),n=A/s,r=m/s):I<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(I),n=F/r,s=m/r),this.set(n,s,r,t),this}let S=Math.sqrt((g-_)*(g-_)+(f-y)*(f-y)+(h-d)*(h-d));return Math.abs(S)<.001&&(S=1),this.x=(g-_)/S,this.y=(f-y)/S,this.z=(h-d)/S,this.w=Math.acos((l+u+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=St(this.x,e.x,t.x),this.y=St(this.y,e.y,t.y),this.z=St(this.z,e.z,t.z),this.w=St(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=St(this.x,e,t),this.y=St(this.y,e,t),this.z=St(this.z,e,t),this.w=St(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(St(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Rh.prototype.isVector4=!0;var Kt=Rh,Ta=class extends di{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:yn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Kt(0,0,e,t),this.scissorTest=!1,this.viewport=new Kt(0,0,e,t),this.textures=[];let s={width:e,height:t,depth:n.depth},r=new wn(s),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:yn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let s=Object.assign({},e.textures[t].image);this.textures[t].source=new dr(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Xn=class extends Ta{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Qr=class extends wn{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Jt,this.minFilter=Jt,this.wrapR=Ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Aa=class extends wn{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Jt,this.minFilter=Jt,this.wrapR=Ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var el=class el{constructor(e,t,n,s,r,o,a,c,l,d,f,h,u,_,y,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,c,l,d,f,h,u,_,y,g)}set(e,t,n,s,r,o,a,c,l,d,f,h,u,_,y,g){let p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=c,p[2]=l,p[6]=d,p[10]=f,p[14]=h,p[3]=u,p[7]=_,p[11]=y,p[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new el().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,s=1/$s.setFromMatrixColumn(e,0).length(),r=1/$s.setFromMatrixColumn(e,1).length(),o=1/$s.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,s=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),c=Math.cos(s),l=Math.sin(s),d=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){let h=o*d,u=o*f,_=a*d,y=a*f;t[0]=c*d,t[4]=-c*f,t[8]=l,t[1]=u+_*l,t[5]=h-y*l,t[9]=-a*c,t[2]=y-h*l,t[6]=_+u*l,t[10]=o*c}else if(e.order==="YXZ"){let h=c*d,u=c*f,_=l*d,y=l*f;t[0]=h+y*a,t[4]=_*a-u,t[8]=o*l,t[1]=o*f,t[5]=o*d,t[9]=-a,t[2]=u*a-_,t[6]=y+h*a,t[10]=o*c}else if(e.order==="ZXY"){let h=c*d,u=c*f,_=l*d,y=l*f;t[0]=h-y*a,t[4]=-o*f,t[8]=_+u*a,t[1]=u+_*a,t[5]=o*d,t[9]=y-h*a,t[2]=-o*l,t[6]=a,t[10]=o*c}else if(e.order==="ZYX"){let h=o*d,u=o*f,_=a*d,y=a*f;t[0]=c*d,t[4]=_*l-u,t[8]=h*l+y,t[1]=c*f,t[5]=y*l+h,t[9]=u*l-_,t[2]=-l,t[6]=a*c,t[10]=o*c}else if(e.order==="YZX"){let h=o*c,u=o*l,_=a*c,y=a*l;t[0]=c*d,t[4]=y-h*f,t[8]=_*f+u,t[1]=f,t[5]=o*d,t[9]=-a*d,t[2]=-l*d,t[6]=u*f+_,t[10]=h-y*f}else if(e.order==="XZY"){let h=o*c,u=o*l,_=a*c,y=a*l;t[0]=c*d,t[4]=-f,t[8]=l*d,t[1]=h*f+y,t[5]=o*d,t[9]=u*f-_,t[2]=_*f-u,t[6]=a*d,t[10]=y*f+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(dp,e,fp)}lookAt(e,t,n){let s=this.elements;return Hn.subVectors(e,t),Hn.lengthSq()===0&&(Hn.z=1),Hn.normalize(),ns.crossVectors(n,Hn),ns.lengthSq()===0&&(Math.abs(n.z)===1?Hn.x+=1e-4:Hn.z+=1e-4,Hn.normalize(),ns.crossVectors(n,Hn)),ns.normalize(),Vo.crossVectors(Hn,ns),s[0]=ns.x,s[4]=Vo.x,s[8]=Hn.x,s[1]=ns.y,s[5]=Vo.y,s[9]=Hn.y,s[2]=ns.z,s[6]=Vo.z,s[10]=Hn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[4],c=n[8],l=n[12],d=n[1],f=n[5],h=n[9],u=n[13],_=n[2],y=n[6],g=n[10],p=n[14],S=n[3],E=n[7],b=n[11],I=n[15],A=s[0],F=s[4],m=s[8],w=s[12],T=s[1],U=s[5],B=s[9],re=s[13],se=s[2],Z=s[6],ee=s[10],ae=s[14],ye=s[3],be=s[7],O=s[11],z=s[15];return r[0]=o*A+a*T+c*se+l*ye,r[4]=o*F+a*U+c*Z+l*be,r[8]=o*m+a*B+c*ee+l*O,r[12]=o*w+a*re+c*ae+l*z,r[1]=d*A+f*T+h*se+u*ye,r[5]=d*F+f*U+h*Z+u*be,r[9]=d*m+f*B+h*ee+u*O,r[13]=d*w+f*re+h*ae+u*z,r[2]=_*A+y*T+g*se+p*ye,r[6]=_*F+y*U+g*Z+p*be,r[10]=_*m+y*B+g*ee+p*O,r[14]=_*w+y*re+g*ae+p*z,r[3]=S*A+E*T+b*se+I*ye,r[7]=S*F+E*U+b*Z+I*be,r[11]=S*m+E*B+b*ee+I*O,r[15]=S*w+E*re+b*ae+I*z,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],o=e[1],a=e[5],c=e[9],l=e[13],d=e[2],f=e[6],h=e[10],u=e[14],_=e[3],y=e[7],g=e[11],p=e[15],S=c*u-l*h,E=a*u-l*f,b=a*h-c*f,I=o*u-l*d,A=o*h-c*d,F=o*f-a*d;return t*(y*S-g*E+p*b)-n*(_*S-g*I+p*A)+s*(_*E-y*I+p*F)-r*(_*b-y*A+g*F)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],o=e[5],a=e[9],c=e[2],l=e[6],d=e[10];return t*(o*d-a*l)-n*(r*d-a*c)+s*(r*l-o*c)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],d=e[8],f=e[9],h=e[10],u=e[11],_=e[12],y=e[13],g=e[14],p=e[15],S=t*a-n*o,E=t*c-s*o,b=t*l-r*o,I=n*c-s*a,A=n*l-r*a,F=s*l-r*c,m=d*y-f*_,w=d*g-h*_,T=d*p-u*_,U=f*g-h*y,B=f*p-u*y,re=h*p-u*g,se=S*re-E*B+b*U+I*T-A*w+F*m;if(se===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let Z=1/se;return e[0]=(a*re-c*B+l*U)*Z,e[1]=(s*B-n*re-r*U)*Z,e[2]=(y*F-g*A+p*I)*Z,e[3]=(h*A-f*F-u*I)*Z,e[4]=(c*T-o*re-l*w)*Z,e[5]=(t*re-s*T+r*w)*Z,e[6]=(g*b-_*F-p*E)*Z,e[7]=(d*F-h*b+u*E)*Z,e[8]=(o*B-a*T+l*m)*Z,e[9]=(n*T-t*B-r*m)*Z,e[10]=(_*A-y*b+p*S)*Z,e[11]=(f*b-d*A-u*S)*Z,e[12]=(a*w-o*U-c*m)*Z,e[13]=(t*U-n*w+s*m)*Z,e[14]=(y*E-_*I-g*S)*Z,e[15]=(d*I-f*E+h*S)*Z,this}scale(e){let t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),s=Math.sin(t),r=1-n,o=e.x,a=e.y,c=e.z,l=r*o,d=r*a;return this.set(l*o+n,l*a-s*c,l*c+s*a,0,l*a+s*c,d*a+n,d*c-s*o,0,l*c-s*a,d*c+s*o,r*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,o){return this.set(1,n,r,0,e,1,o,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){let s=this.elements,r=t._x,o=t._y,a=t._z,c=t._w,l=r+r,d=o+o,f=a+a,h=r*l,u=r*d,_=r*f,y=o*d,g=o*f,p=a*f,S=c*l,E=c*d,b=c*f,I=n.x,A=n.y,F=n.z;return s[0]=(1-(y+p))*I,s[1]=(u+b)*I,s[2]=(_-E)*I,s[3]=0,s[4]=(u-b)*A,s[5]=(1-(h+p))*A,s[6]=(g+S)*A,s[7]=0,s[8]=(_+E)*F,s[9]=(g-S)*F,s[10]=(1-(h+y))*F,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){let s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let o=$s.set(s[0],s[1],s[2]).length(),a=$s.set(s[4],s[5],s[6]).length(),c=$s.set(s[8],s[9],s[10]).length();r<0&&(o=-o),li.copy(this);let l=1/o,d=1/a,f=1/c;return li.elements[0]*=l,li.elements[1]*=l,li.elements[2]*=l,li.elements[4]*=d,li.elements[5]*=d,li.elements[6]*=d,li.elements[8]*=f,li.elements[9]*=f,li.elements[10]*=f,t.setFromRotationMatrix(li),n.x=o,n.y=a,n.z=c,this}makePerspective(e,t,n,s,r,o,a=ui,c=!1){let l=this.elements,d=2*r/(t-e),f=2*r/(n-s),h=(t+e)/(t-e),u=(n+s)/(n-s),_,y;if(c)_=r/(o-r),y=o*r/(o-r);else if(a===ui)_=-(o+r)/(o-r),y=-2*o*r/(o-r);else if(a===lr)_=-o/(o-r),y=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=d,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=f,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=_,l[14]=y,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,o,a=ui,c=!1){let l=this.elements,d=2/(t-e),f=2/(n-s),h=-(t+e)/(t-e),u=-(n+s)/(n-s),_,y;if(c)_=1/(o-r),y=o/(o-r);else if(a===ui)_=-2/(o-r),y=-(o+r)/(o-r);else if(a===lr)_=-1/(o-r),y=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=d,l[4]=0,l[8]=0,l[12]=h,l[1]=0,l[5]=f,l[9]=0,l[13]=u,l[2]=0,l[6]=0,l[10]=_,l[14]=y,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};el.prototype.isMatrix4=!0;var Wt=el,$s=new L,li=new Wt,dp=new L(0,0,0),fp=new L(1,1,1),ns=new L,Vo=new L,Hn=new L,Tu=new Wt,Au=new In,ni=class i{constructor(e=0,t=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let s=e.elements,r=s[0],o=s[4],a=s[8],c=s[1],l=s[5],d=s[9],f=s[2],h=s[6],u=s[10];switch(t){case"XYZ":this._y=Math.asin(St(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-d,u),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(h,l),this._z=0);break;case"YXZ":this._x=Math.asin(-St(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(a,u),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(St(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-St(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(h,u),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(St(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-d,l),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,u));break;case"XZY":this._z=Math.asin(-St(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(h,l),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-d,u),this._y=0);break;default:ft("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Tu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Tu,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Au.setFromEuler(this),this.setFromQuaternion(Au,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ni.DEFAULT_ORDER="XYZ";var fr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},pp=0,Ru=new L,Zs=new In,Hi=new Wt,Ho=new L,kr=new L,mp=new L,gp=new In,Cu=new L(1,0,0),Pu=new L(0,1,0),Iu=new L(0,0,1),Lu={type:"added"},_p={type:"removed"},Js={type:"childadded",child:null},mc={type:"childremoved",child:null},vn=class i extends di{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:pp++}),this.uuid=zs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new L,t=new ni,n=new In,s=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Wt},normalMatrix:{value:new vt}}),this.matrix=new Wt,this.matrixWorld=new Wt,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new fr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Zs.setFromAxisAngle(e,t),this.quaternion.multiply(Zs),this}rotateOnWorldAxis(e,t){return Zs.setFromAxisAngle(e,t),this.quaternion.premultiply(Zs),this}rotateX(e){return this.rotateOnAxis(Cu,e)}rotateY(e){return this.rotateOnAxis(Pu,e)}rotateZ(e){return this.rotateOnAxis(Iu,e)}translateOnAxis(e,t){return Ru.copy(e).applyQuaternion(this.quaternion),this.position.add(Ru.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Cu,e)}translateY(e){return this.translateOnAxis(Pu,e)}translateZ(e){return this.translateOnAxis(Iu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Hi.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Ho.copy(e):Ho.set(e,t,n);let s=this.parent;this.updateWorldMatrix(!0,!1),kr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Hi.lookAt(kr,Ho,this.up):Hi.lookAt(Ho,kr,this.up),this.quaternion.setFromRotationMatrix(Hi),s&&(Hi.extractRotation(s.matrixWorld),Zs.setFromRotationMatrix(Hi),this.quaternion.premultiply(Zs.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(mt("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Lu),Js.child=e,this.dispatchEvent(Js),Js.child=null):mt("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(_p),mc.child=e,this.dispatchEvent(mc),mc.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Hi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Hi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Hi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Lu),Js.child=e,this.dispatchEvent(Js),Js.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(kr,e,mp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(kr,gp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let l=0,d=c.length;l<d;l++){let f=c[l];r(e.shapes,f)}else r(e.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(r(e.materials,this.material[c]));s.material=a}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];s.animations.push(r(e.animations,c))}}if(t){let a=o(e.geometries),c=o(e.materials),l=o(e.textures),d=o(e.images),f=o(e.shapes),h=o(e.skeletons),u=o(e.animations),_=o(e.nodes);a.length>0&&(n.geometries=a),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),d.length>0&&(n.images=d),f.length>0&&(n.shapes=f),h.length>0&&(n.skeletons=h),u.length>0&&(n.animations=u),_.length>0&&(n.nodes=_)}return n.object=s,n;function o(a){let c=[];for(let l in a){let d=a[l];delete d.metadata,c.push(d)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let s=e.children[n];this.add(s.clone())}return this}};vn.DEFAULT_UP=new L(0,1,0);vn.DEFAULT_MATRIX_AUTO_UPDATE=!0;vn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ut=class extends vn{constructor(){super(),this.isGroup=!0,this.type="Group"}},xp={type:"move"},pr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ut,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ut,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ut,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,o=null,a=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){o=!0;for(let y of e.hand.values()){let g=t.getJointPose(y,n),p=this._getHandJoint(l,y);g!==null&&(p.matrix.fromArray(g.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=g.radius),p.visible=g!==null}let d=l.joints["index-finger-tip"],f=l.joints["thumb-tip"],h=d.position.distanceTo(f.position),u=.02,_=.005;l.inputState.pinching&&h>u+_?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&h<=u-_&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(xp)))}return a!==null&&(a.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new ut;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Nd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},is={h:0,s:0,l:0},Go={h:0,s:0,l:0};function gc(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}var _t=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Zt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ct.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=Ct.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ct.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=Ct.workingColorSpace){if(e=yh(e,1),t=St(t,0,1),n=St(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=gc(o,r,e+1/3),this.g=gc(o,r,e),this.b=gc(o,r,e-1/3)}return Ct.colorSpaceToWorking(this,s),this}setStyle(e,t=Zt){function n(r){r!==void 0&&parseFloat(r)<1&&ft("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:ft("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);ft("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Zt){let n=Nd[e.toLowerCase()];return n!==void 0?this.setHex(n,t):ft("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Yi(e.r),this.g=Yi(e.g),this.b=Yi(e.b),this}copyLinearToSRGB(e){return this.r=ar(e.r),this.g=ar(e.g),this.b=ar(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Zt){return Ct.workingToColorSpace(Sn.copy(this),e),Math.round(St(Sn.r*255,0,255))*65536+Math.round(St(Sn.g*255,0,255))*256+Math.round(St(Sn.b*255,0,255))}getHexString(e=Zt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ct.workingColorSpace){Ct.workingToColorSpace(Sn.copy(this),t);let n=Sn.r,s=Sn.g,r=Sn.b,o=Math.max(n,s,r),a=Math.min(n,s,r),c,l,d=(a+o)/2;if(a===o)c=0,l=0;else{let f=o-a;switch(l=d<=.5?f/(o+a):f/(2-o-a),o){case n:c=(s-r)/f+(s<r?6:0);break;case s:c=(r-n)/f+2;break;case r:c=(n-s)/f+4;break}c/=6}return e.h=c,e.s=l,e.l=d,e}getRGB(e,t=Ct.workingColorSpace){return Ct.workingToColorSpace(Sn.copy(this),t),e.r=Sn.r,e.g=Sn.g,e.b=Sn.b,e}getStyle(e=Zt){Ct.workingToColorSpace(Sn.copy(this),e);let t=Sn.r,n=Sn.g,s=Sn.b;return e!==Zt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(is),this.setHSL(is.h+e,is.s+t,is.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(is),e.getHSL(Go);let n=Yr(is.h,Go.h,t),s=Yr(is.s,Go.s,t),r=Yr(is.l,Go.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Sn=new _t;_t.NAMES=Nd;var eo=class i{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new _t(e),this.near=t,this.far=n}clone(){return new i(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},fi=class extends vn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ni,this.environmentIntensity=1,this.environmentRotation=new ni,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},ci=new L,Gi=new L,_c=new L,Wi=new L,Ks=new L,js=new L,Du=new L,xc=new L,yc=new L,vc=new L,bc=new Kt,Mc=new Kt,Sc=new Kt,ls=class i{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),ci.subVectors(e,t),s.cross(ci);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){ci.subVectors(s,t),Gi.subVectors(n,t),_c.subVectors(e,t);let o=ci.dot(ci),a=ci.dot(Gi),c=ci.dot(_c),l=Gi.dot(Gi),d=Gi.dot(_c),f=o*l-a*a;if(f===0)return r.set(0,0,0),null;let h=1/f,u=(l*c-a*d)*h,_=(o*d-a*c)*h;return r.set(1-u-_,_,u)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Wi)===null?!1:Wi.x>=0&&Wi.y>=0&&Wi.x+Wi.y<=1}static getInterpolation(e,t,n,s,r,o,a,c){return this.getBarycoord(e,t,n,s,Wi)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,Wi.x),c.addScaledVector(o,Wi.y),c.addScaledVector(a,Wi.z),c)}static getInterpolatedAttribute(e,t,n,s,r,o){return bc.setScalar(0),Mc.setScalar(0),Sc.setScalar(0),bc.fromBufferAttribute(e,t),Mc.fromBufferAttribute(e,n),Sc.fromBufferAttribute(e,s),o.setScalar(0),o.addScaledVector(bc,r.x),o.addScaledVector(Mc,r.y),o.addScaledVector(Sc,r.z),o}static isFrontFacing(e,t,n,s){return ci.subVectors(n,t),Gi.subVectors(e,t),ci.cross(Gi).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ci.subVectors(this.c,this.b),Gi.subVectors(this.a,this.b),ci.cross(Gi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return i.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,s=this.b,r=this.c,o,a;Ks.subVectors(s,n),js.subVectors(r,n),xc.subVectors(e,n);let c=Ks.dot(xc),l=js.dot(xc);if(c<=0&&l<=0)return t.copy(n);yc.subVectors(e,s);let d=Ks.dot(yc),f=js.dot(yc);if(d>=0&&f<=d)return t.copy(s);let h=c*f-d*l;if(h<=0&&c>=0&&d<=0)return o=c/(c-d),t.copy(n).addScaledVector(Ks,o);vc.subVectors(e,r);let u=Ks.dot(vc),_=js.dot(vc);if(_>=0&&u<=_)return t.copy(r);let y=u*l-c*_;if(y<=0&&l>=0&&_<=0)return a=l/(l-_),t.copy(n).addScaledVector(js,a);let g=d*_-u*f;if(g<=0&&f-d>=0&&u-_>=0)return Du.subVectors(r,s),a=(f-d)/(f-d+(u-_)),t.copy(s).addScaledVector(Du,a);let p=1/(g+y+h);return o=y*p,a=h*p,t.copy(n).addScaledVector(Ks,o).addScaledVector(js,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Xt=class{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(hi.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(hi.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=hi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,hi):hi.fromBufferAttribute(r,o),hi.applyMatrix4(e.matrixWorld),this.expandByPoint(hi);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Wo.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Wo.copy(n.boundingBox)),Wo.applyMatrix4(e.matrixWorld),this.union(Wo)}let s=e.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,hi),hi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Vr),Xo.subVectors(this.max,Vr),Qs.subVectors(e.a,Vr),er.subVectors(e.b,Vr),tr.subVectors(e.c,Vr),ss.subVectors(er,Qs),rs.subVectors(tr,er),Ts.subVectors(Qs,tr);let t=[0,-ss.z,ss.y,0,-rs.z,rs.y,0,-Ts.z,Ts.y,ss.z,0,-ss.x,rs.z,0,-rs.x,Ts.z,0,-Ts.x,-ss.y,ss.x,0,-rs.y,rs.x,0,-Ts.y,Ts.x,0];return!Ec(t,Qs,er,tr,Xo)||(t=[1,0,0,0,1,0,0,0,1],!Ec(t,Qs,er,tr,Xo))?!1:(qo.crossVectors(ss,rs),t=[qo.x,qo.y,qo.z],Ec(t,Qs,er,tr,Xo))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,hi).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(hi).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Xi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Xi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Xi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Xi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Xi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Xi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Xi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Xi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Xi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Xi=[new L,new L,new L,new L,new L,new L,new L,new L],hi=new L,Wo=new Xt,Qs=new L,er=new L,tr=new L,ss=new L,rs=new L,Ts=new L,Vr=new L,Xo=new L,qo=new L,As=new L;function Ec(i,e,t,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){As.fromArray(i,r);let a=s.x*Math.abs(As.x)+s.y*Math.abs(As.y)+s.z*Math.abs(As.z),c=e.dot(As),l=t.dot(As),d=n.dot(As);if(Math.max(-Math.max(c,l,d),Math.min(c,l,d))>a)return!1}return!0}var on=new L,Yo=new ze,yp=0,Wn=class extends di{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:yp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Hc,this.updateRanges=[],this.gpuType=yi,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Yo.fromBufferAttribute(this,t),Yo.applyMatrix3(e),this.setXY(t,Yo.x,Yo.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)on.fromBufferAttribute(this,t),on.applyMatrix3(e),this.setXYZ(t,on.x,on.y,on.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)on.fromBufferAttribute(this,t),on.applyMatrix4(e),this.setXYZ(t,on.x,on.y,on.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)on.fromBufferAttribute(this,t),on.applyNormalMatrix(e),this.setXYZ(t,on.x,on.y,on.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)on.fromBufferAttribute(this,t),on.transformDirection(e),this.setXYZ(t,on.x,on.y,on.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=or(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Pn(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=or(t,this.array)),t}setX(e,t){return this.normalized&&(t=Pn(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=or(t,this.array)),t}setY(e,t){return this.normalized&&(t=Pn(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=or(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Pn(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=or(t,this.array)),t}setW(e,t){return this.normalized&&(t=Pn(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Pn(t,this.array),n=Pn(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Pn(t,this.array),n=Pn(n,this.array),s=Pn(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Pn(t,this.array),n=Pn(n,this.array),s=Pn(s,this.array),r=Pn(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Hc&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}};var to=class extends Wn{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var no=class extends Wn{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var nn=class extends Wn{constructor(e,t,n){super(new Float32Array(e),t,n)}},vp=new Xt,Hr=new L,wc=new L,Us=class{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):vp.setFromPoints(e).getCenter(n);let s=0;for(let r=0,o=e.length;r<o;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Hr.subVectors(e,this.center);let t=Hr.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Hr,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(wc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Hr.copy(e.center).add(wc)),this.expandByPoint(Hr.copy(e.center).sub(wc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},bp=0,ti=new Wt,Tc=new vn,nr=new L,Gn=new Xt,Gr=new Xt,fn=new L,Tn=class i extends di{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:bp++}),this.uuid=zs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Xf(e)?no:to)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new vt().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return ti.makeRotationFromQuaternion(e),this.applyMatrix4(ti),this}rotateX(e){return ti.makeRotationX(e),this.applyMatrix4(ti),this}rotateY(e){return ti.makeRotationY(e),this.applyMatrix4(ti),this}rotateZ(e){return ti.makeRotationZ(e),this.applyMatrix4(ti),this}translate(e,t,n){return ti.makeTranslation(e,t,n),this.applyMatrix4(ti),this}scale(e,t,n){return ti.makeScale(e,t,n),this.applyMatrix4(ti),this}lookAt(e){return Tc.lookAt(e),Tc.updateMatrix(),this.applyMatrix4(Tc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(nr).negate(),this.translate(nr.x,nr.y,nr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let s=0,r=e.length;s<r;s++){let o=e[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new nn(n,3))}else{let n=Math.min(e.length,t.count);for(let s=0;s<n;s++){let r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&ft("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Xt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){mt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){let r=t[n];Gn.setFromBufferAttribute(r),this.morphTargetsRelative?(fn.addVectors(this.boundingBox.min,Gn.min),this.boundingBox.expandByPoint(fn),fn.addVectors(this.boundingBox.max,Gn.max),this.boundingBox.expandByPoint(fn)):(this.boundingBox.expandByPoint(Gn.min),this.boundingBox.expandByPoint(Gn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&mt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Us);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){mt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){let n=this.boundingSphere.center;if(Gn.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];Gr.setFromBufferAttribute(a),this.morphTargetsRelative?(fn.addVectors(Gn.min,Gr.min),Gn.expandByPoint(fn),fn.addVectors(Gn.max,Gr.max),Gn.expandByPoint(fn)):(Gn.expandByPoint(Gr.min),Gn.expandByPoint(Gr.max))}Gn.getCenter(n);let s=0;for(let r=0,o=e.count;r<o;r++)fn.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(fn));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],c=this.morphTargetsRelative;for(let l=0,d=a.count;l<d;l++)fn.fromBufferAttribute(a,l),c&&(nr.fromBufferAttribute(e,l),fn.add(nr)),s=Math.max(s,n.distanceToSquared(fn))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&mt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){mt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,s=t.normal,r=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new Wn(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],c=[];for(let m=0;m<n.count;m++)a[m]=new L,c[m]=new L;let l=new L,d=new L,f=new L,h=new ze,u=new ze,_=new ze,y=new L,g=new L;function p(m,w,T){l.fromBufferAttribute(n,m),d.fromBufferAttribute(n,w),f.fromBufferAttribute(n,T),h.fromBufferAttribute(r,m),u.fromBufferAttribute(r,w),_.fromBufferAttribute(r,T),d.sub(l),f.sub(l),u.sub(h),_.sub(h);let U=1/(u.x*_.y-_.x*u.y);isFinite(U)&&(y.copy(d).multiplyScalar(_.y).addScaledVector(f,-u.y).multiplyScalar(U),g.copy(f).multiplyScalar(u.x).addScaledVector(d,-_.x).multiplyScalar(U),a[m].add(y),a[w].add(y),a[T].add(y),c[m].add(g),c[w].add(g),c[T].add(g))}let S=this.groups;S.length===0&&(S=[{start:0,count:e.count}]);for(let m=0,w=S.length;m<w;++m){let T=S[m],U=T.start,B=T.count;for(let re=U,se=U+B;re<se;re+=3)p(e.getX(re+0),e.getX(re+1),e.getX(re+2))}let E=new L,b=new L,I=new L,A=new L;function F(m){I.fromBufferAttribute(s,m),A.copy(I);let w=a[m];E.copy(w),E.sub(I.multiplyScalar(I.dot(w))).normalize(),b.crossVectors(A,w);let U=b.dot(c[m])<0?-1:1;o.setXYZW(m,E.x,E.y,E.z,U)}for(let m=0,w=S.length;m<w;++m){let T=S[m],U=T.start,B=T.count;for(let re=U,se=U+B;re<se;re+=3)F(e.getX(re+0)),F(e.getX(re+1)),F(e.getX(re+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Wn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let h=0,u=n.count;h<u;h++)n.setXYZ(h,0,0,0);let s=new L,r=new L,o=new L,a=new L,c=new L,l=new L,d=new L,f=new L;if(e)for(let h=0,u=e.count;h<u;h+=3){let _=e.getX(h+0),y=e.getX(h+1),g=e.getX(h+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,y),o.fromBufferAttribute(t,g),d.subVectors(o,r),f.subVectors(s,r),d.cross(f),a.fromBufferAttribute(n,_),c.fromBufferAttribute(n,y),l.fromBufferAttribute(n,g),a.add(d),c.add(d),l.add(d),n.setXYZ(_,a.x,a.y,a.z),n.setXYZ(y,c.x,c.y,c.z),n.setXYZ(g,l.x,l.y,l.z)}else for(let h=0,u=t.count;h<u;h+=3)s.fromBufferAttribute(t,h+0),r.fromBufferAttribute(t,h+1),o.fromBufferAttribute(t,h+2),d.subVectors(o,r),f.subVectors(s,r),d.cross(f),n.setXYZ(h+0,d.x,d.y,d.z),n.setXYZ(h+1,d.x,d.y,d.z),n.setXYZ(h+2,d.x,d.y,d.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)fn.fromBufferAttribute(e,t),fn.normalize(),e.setXYZ(t,fn.x,fn.y,fn.z)}toNonIndexed(){function e(a,c){let l=a.array,d=a.itemSize,f=a.normalized,h=new l.constructor(c.length*d),u=0,_=0;for(let y=0,g=c.length;y<g;y++){a.isInterleavedBufferAttribute?u=c[y]*a.data.stride+a.offset:u=c[y]*d;for(let p=0;p<d;p++)h[_++]=l[u++]}return new Wn(h,d,f)}if(this.index===null)return ft("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,s=this.attributes;for(let a in s){let c=s[a],l=e(c,n);t.setAttribute(a,l)}let r=this.morphAttributes;for(let a in r){let c=[],l=r[a];for(let d=0,f=l.length;d<f;d++){let h=l[d],u=e(h,n);c.push(u)}t.morphAttributes[a]=c}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,c=o.length;a<c;a++){let l=o[a];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let c in n){let l=n[c];e.data.attributes[c]=l.toJSON(e.data)}let s={},r=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],d=[];for(let f=0,h=l.length;f<h;f++){let u=l[f];d.push(u.toJSON(e.data))}d.length>0&&(s[c]=d,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let s=e.attributes;for(let l in s){let d=s[l];this.setAttribute(l,d.clone(t))}let r=e.morphAttributes;for(let l in r){let d=[],f=r[l];for(let h=0,u=f.length;h<u;h++)d.push(f[h].clone(t));this.morphAttributes[l]=d}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let l=0,d=o.length;l<d;l++){let f=o[l];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Mp=0,Zi=class extends di{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Mp++}),this.uuid=zs(),this.name="",this.type="Material",this.blending=Ds,this.side=$i,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=fa,this.blendDst=pa,this.blendEquation=cs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new _t(0,0,0),this.blendAlpha=0,this.depthFunc=Ns,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Vc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ps,this.stencilZFail=Ps,this.stencilZPass=Ps,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){ft(`Material: parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){ft(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ds&&(n.blending=this.blending),this.side!==$i&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==fa&&(n.blendSrc=this.blendSrc),this.blendDst!==pa&&(n.blendDst=this.blendDst),this.blendEquation!==cs&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ns&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Vc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ps&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Ps&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Ps&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let o=[];for(let a in r){let c=r[a];delete c.metadata,o.push(c)}return o}if(t){let r=s(e.textures),o=s(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new _t().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ze().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ze().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var qi=new L,Ac=new L,$o=new L,os=new L,Rc=new L,Zo=new L,Cc=new L,hs=class{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,qi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=qi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(qi.copy(this.origin).addScaledVector(this.direction,t),qi.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){Ac.copy(e).add(t).multiplyScalar(.5),$o.copy(t).sub(e).normalize(),os.copy(this.origin).sub(Ac);let r=e.distanceTo(t)*.5,o=-this.direction.dot($o),a=os.dot(this.direction),c=-os.dot($o),l=os.lengthSq(),d=Math.abs(1-o*o),f,h,u,_;if(d>0)if(f=o*c-a,h=o*a-c,_=r*d,f>=0)if(h>=-_)if(h<=_){let y=1/d;f*=y,h*=y,u=f*(f+o*h+2*a)+h*(o*f+h+2*c)+l}else h=r,f=Math.max(0,-(o*h+a)),u=-f*f+h*(h+2*c)+l;else h=-r,f=Math.max(0,-(o*h+a)),u=-f*f+h*(h+2*c)+l;else h<=-_?(f=Math.max(0,-(-o*r+a)),h=f>0?-r:Math.min(Math.max(-r,-c),r),u=-f*f+h*(h+2*c)+l):h<=_?(f=0,h=Math.min(Math.max(-r,-c),r),u=h*(h+2*c)+l):(f=Math.max(0,-(o*r+a)),h=f>0?r:Math.min(Math.max(-r,-c),r),u=-f*f+h*(h+2*c)+l);else h=o>0?-r:r,f=Math.max(0,-(o*h+a)),u=-f*f+h*(h+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Ac).addScaledVector($o,h),u}intersectSphere(e,t){qi.subVectors(e.center,this.origin);let n=qi.dot(this.direction),s=qi.dot(qi)-n*n,r=e.radius*e.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=n-o,c=n+o;return c<0?null:a<0?this.at(c,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,o,a,c,l=1/this.direction.x,d=1/this.direction.y,f=1/this.direction.z,h=this.origin;return l>=0?(n=(e.min.x-h.x)*l,s=(e.max.x-h.x)*l):(n=(e.max.x-h.x)*l,s=(e.min.x-h.x)*l),d>=0?(r=(e.min.y-h.y)*d,o=(e.max.y-h.y)*d):(r=(e.max.y-h.y)*d,o=(e.min.y-h.y)*d),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(e.min.z-h.z)*f,c=(e.max.z-h.z)*f):(a=(e.max.z-h.z)*f,c=(e.min.z-h.z)*f),n>c||a>s)||((a>n||n!==n)&&(n=a),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,qi)!==null}intersectTriangle(e,t,n,s,r){Rc.subVectors(t,e),Zo.subVectors(n,e),Cc.crossVectors(Rc,Zo);let o=this.direction.dot(Cc),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;os.subVectors(this.origin,e);let c=a*this.direction.dot(Zo.crossVectors(os,Zo));if(c<0)return null;let l=a*this.direction.dot(Rc.cross(os));if(l<0||c+l>o)return null;let d=-a*os.dot(Cc);return d<0?null:this.at(d/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},pi=class extends Zi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new _t(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ni,this.combine=nh,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Nu=new Wt,Rs=new hs,Jo=new Us,Uu=new L,Ko=new L,jo=new L,Qo=new L,Pc=new L,ea=new L,Fu=new L,ta=new L,kt=class extends vn{constructor(e=new Tn,t=new pi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(s,e);let a=this.morphTargetInfluences;if(r&&a){ea.set(0,0,0);for(let c=0,l=r.length;c<l;c++){let d=a[c],f=r[c];d!==0&&(Pc.fromBufferAttribute(f,e),o?ea.addScaledVector(Pc,d):ea.addScaledVector(Pc.sub(t),d))}t.add(ea)}return t}raycast(e,t){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Jo.copy(n.boundingSphere),Jo.applyMatrix4(r),Rs.copy(e.ray).recast(e.near),!(Jo.containsPoint(Rs.origin)===!1&&(Rs.intersectSphere(Jo,Uu)===null||Rs.origin.distanceToSquared(Uu)>(e.far-e.near)**2))&&(Nu.copy(r).invert(),Rs.copy(e.ray).applyMatrix4(Nu),!(n.boundingBox!==null&&Rs.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Rs)))}_computeIntersections(e,t,n){let s,r=this.geometry,o=this.material,a=r.index,c=r.attributes.position,l=r.attributes.uv,d=r.attributes.uv1,f=r.attributes.normal,h=r.groups,u=r.drawRange;if(a!==null)if(Array.isArray(o))for(let _=0,y=h.length;_<y;_++){let g=h[_],p=o[g.materialIndex],S=Math.max(g.start,u.start),E=Math.min(a.count,Math.min(g.start+g.count,u.start+u.count));for(let b=S,I=E;b<I;b+=3){let A=a.getX(b),F=a.getX(b+1),m=a.getX(b+2);s=na(this,p,e,n,l,d,f,A,F,m),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=g.materialIndex,t.push(s))}}else{let _=Math.max(0,u.start),y=Math.min(a.count,u.start+u.count);for(let g=_,p=y;g<p;g+=3){let S=a.getX(g),E=a.getX(g+1),b=a.getX(g+2);s=na(this,o,e,n,l,d,f,S,E,b),s&&(s.faceIndex=Math.floor(g/3),t.push(s))}}else if(c!==void 0)if(Array.isArray(o))for(let _=0,y=h.length;_<y;_++){let g=h[_],p=o[g.materialIndex],S=Math.max(g.start,u.start),E=Math.min(c.count,Math.min(g.start+g.count,u.start+u.count));for(let b=S,I=E;b<I;b+=3){let A=b,F=b+1,m=b+2;s=na(this,p,e,n,l,d,f,A,F,m),s&&(s.faceIndex=Math.floor(b/3),s.face.materialIndex=g.materialIndex,t.push(s))}}else{let _=Math.max(0,u.start),y=Math.min(c.count,u.start+u.count);for(let g=_,p=y;g<p;g+=3){let S=g,E=g+1,b=g+2;s=na(this,o,e,n,l,d,f,S,E,b),s&&(s.faceIndex=Math.floor(g/3),t.push(s))}}}};function Sp(i,e,t,n,s,r,o,a){let c;if(e.side===Dn?c=n.intersectTriangle(o,r,s,!0,a):c=n.intersectTriangle(s,r,o,e.side===$i,a),c===null)return null;ta.copy(a),ta.applyMatrix4(i.matrixWorld);let l=t.ray.origin.distanceTo(ta);return l<t.near||l>t.far?null:{distance:l,point:ta.clone(),object:i}}function na(i,e,t,n,s,r,o,a,c,l){i.getVertexPosition(a,Ko),i.getVertexPosition(c,jo),i.getVertexPosition(l,Qo);let d=Sp(i,e,t,n,Ko,jo,Qo,Fu);if(d){let f=new L;ls.getBarycoord(Fu,Ko,jo,Qo,f),s&&(d.uv=ls.getInterpolatedAttribute(s,a,c,l,f,new ze)),r&&(d.uv1=ls.getInterpolatedAttribute(r,a,c,l,f,new ze)),o&&(d.normal=ls.getInterpolatedAttribute(o,a,c,l,f,new L),d.normal.dot(n.direction)>0&&d.normal.multiplyScalar(-1));let h={a,b:c,c:l,normal:new L,materialIndex:0};ls.getNormal(Ko,jo,Qo,h.normal),d.face=h,d.barycoord=f}return d}var Ra=class extends wn{constructor(e=null,t=1,n=1,s,r,o,a,c,l=Jt,d=Jt,f,h){super(null,o,a,c,l,d,s,r,f,h),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ic=new L,Ep=new L,wp=new vt,En=class{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let s=Ic.subVectors(n,t).cross(Ep.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let s=e.delta(Ic),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(s,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||wp.getNormalMatrix(e),s=this.coplanarPoint(Ic).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Cs=new Us,Tp=new ze(.5,.5),ia=new L,mr=class{constructor(e=new En,t=new En,n=new En,s=new En,r=new En,o=new En){this.planes=[e,t,n,s,r,o]}set(e,t,n,s,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=ui,n=!1){let s=this.planes,r=e.elements,o=r[0],a=r[1],c=r[2],l=r[3],d=r[4],f=r[5],h=r[6],u=r[7],_=r[8],y=r[9],g=r[10],p=r[11],S=r[12],E=r[13],b=r[14],I=r[15];if(s[0].setComponents(l-o,u-d,p-_,I-S).normalize(),s[1].setComponents(l+o,u+d,p+_,I+S).normalize(),s[2].setComponents(l+a,u+f,p+y,I+E).normalize(),s[3].setComponents(l-a,u-f,p-y,I-E).normalize(),n)s[4].setComponents(c,h,g,b).normalize(),s[5].setComponents(l-c,u-h,p-g,I-b).normalize();else if(s[4].setComponents(l-c,u-h,p-g,I-b).normalize(),t===ui)s[5].setComponents(l+c,u+h,p+g,I+b).normalize();else if(t===lr)s[5].setComponents(c,h,g,b).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Cs.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Cs.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Cs)}intersectsSprite(e){Cs.center.set(0,0,0);let t=Tp.distanceTo(e.center);return Cs.radius=.7071067811865476+t,Cs.applyMatrix4(e.matrixWorld),this.intersectsSphere(Cs)}intersectsSphere(e){let t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let s=t[n];if(ia.x=s.normal.x>0?e.max.x:e.min.x,ia.y=s.normal.y>0?e.max.y:e.min.y,ia.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(ia)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var gr=class extends Zi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new _t(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Ca=new L,Pa=new L,Ou=new Wt,Wr=new hs,sa=new Us,Lc=new L,Bu=new L,io=class extends vn{constructor(e=new Tn,t=new gr){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)Ca.fromBufferAttribute(t,s-1),Pa.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=Ca.distanceTo(Pa);e.setAttribute("lineDistance",new nn(n,1))}else ft("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),sa.copy(n.boundingSphere),sa.applyMatrix4(s),sa.radius+=r,e.ray.intersectsSphere(sa)===!1)return;Ou.copy(s).invert(),Wr.copy(e.ray).applyMatrix4(Ou);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=this.isLineSegments?2:1,d=n.index,h=n.attributes.position;if(d!==null){let u=Math.max(0,o.start),_=Math.min(d.count,o.start+o.count);for(let y=u,g=_-1;y<g;y+=l){let p=d.getX(y),S=d.getX(y+1),E=ra(this,e,Wr,c,p,S,y);E&&t.push(E)}if(this.isLineLoop){let y=d.getX(_-1),g=d.getX(u),p=ra(this,e,Wr,c,y,g,_-1);p&&t.push(p)}}else{let u=Math.max(0,o.start),_=Math.min(h.count,o.start+o.count);for(let y=u,g=_-1;y<g;y+=l){let p=ra(this,e,Wr,c,y,y+1,y);p&&t.push(p)}if(this.isLineLoop){let y=ra(this,e,Wr,c,_-1,u,_-1);y&&t.push(y)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function ra(i,e,t,n,s,r,o){let a=i.geometry.attributes.position;if(Ca.fromBufferAttribute(a,s),Pa.fromBufferAttribute(a,r),t.distanceSqToSegment(Ca,Pa,Lc,Bu)>n)return;Lc.applyMatrix4(i.matrixWorld);let l=e.ray.origin.distanceTo(Lc);if(!(l<e.near||l>e.far))return{distance:l,point:Bu.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}var so=class extends wn{constructor(e=[],t=xs,n,s,r,o,a,c,l,d){super(e,t,n,s,r,o,a,c,l,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Fs=class extends wn{constructor(e,t,n,s,r,o,a,c,l){super(e,t,n,s,r,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Ji=class extends wn{constructor(e,t,n=xi,s,r,o,a=Jt,c=Jt,l,d=Ai,f=1){if(d!==Ai&&d!==vs)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:f};super(h,s,r,o,a,c,d,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new dr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},Ia=class extends Ji{constructor(e,t=xi,n=xs,s,r,o=Jt,a=Jt,c,l=Ai){let d={width:e,height:e,depth:1},f=[d,d,d,d,d,d];super(e,e,t,n,s,r,o,a,c,l),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},ro=class extends wn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},bn=class i extends Tn{constructor(e=1,t=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let c=[],l=[],d=[],f=[],h=0,u=0;_("z","y","x",-1,-1,n,t,e,o,r,0),_("z","y","x",1,-1,n,t,-e,o,r,1),_("x","z","y",1,1,e,n,t,s,o,2),_("x","z","y",1,-1,e,n,-t,s,o,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new nn(l,3)),this.setAttribute("normal",new nn(d,3)),this.setAttribute("uv",new nn(f,2));function _(y,g,p,S,E,b,I,A,F,m,w){let T=b/F,U=I/m,B=b/2,re=I/2,se=A/2,Z=F+1,ee=m+1,ae=0,ye=0,be=new L;for(let O=0;O<ee;O++){let z=O*U-re;for(let ne=0;ne<Z;ne++){let _e=ne*T-B;be[y]=_e*S,be[g]=z*E,be[p]=se,l.push(be.x,be.y,be.z),be[y]=0,be[g]=0,be[p]=A>0?1:-1,d.push(be.x,be.y,be.z),f.push(ne/F),f.push(1-O/m),ae+=1}}for(let O=0;O<m;O++)for(let z=0;z<F;z++){let ne=h+z+Z*O,_e=h+z+Z*(O+1),Fe=h+(z+1)+Z*(O+1),Ye=h+(z+1)+Z*O;c.push(ne,_e,Ye),c.push(_e,Fe,Ye),ye+=6}a.addGroup(u,ye,w),u+=ye,h+=ae}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var oo=class i extends Tn{constructor(e=1,t=1,n=1,s=32,r=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:c};let l=this;s=Math.floor(s),r=Math.floor(r);let d=[],f=[],h=[],u=[],_=0,y=[],g=n/2,p=0;S(),o===!1&&(e>0&&E(!0),t>0&&E(!1)),this.setIndex(d),this.setAttribute("position",new nn(f,3)),this.setAttribute("normal",new nn(h,3)),this.setAttribute("uv",new nn(u,2));function S(){let b=new L,I=new L,A=0,F=(t-e)/n;for(let m=0;m<=r;m++){let w=[],T=m/r,U=T*(t-e)+e;for(let B=0;B<=s;B++){let re=B/s,se=re*c+a,Z=Math.sin(se),ee=Math.cos(se);I.x=U*Z,I.y=-T*n+g,I.z=U*ee,f.push(I.x,I.y,I.z),b.set(Z,F,ee).normalize(),h.push(b.x,b.y,b.z),u.push(re,1-T),w.push(_++)}y.push(w)}for(let m=0;m<s;m++)for(let w=0;w<r;w++){let T=y[w][m],U=y[w+1][m],B=y[w+1][m+1],re=y[w][m+1];(e>0||w!==0)&&(d.push(T,U,re),A+=3),(t>0||w!==r-1)&&(d.push(U,B,re),A+=3)}l.addGroup(p,A,0),p+=A}function E(b){let I=_,A=new ze,F=new L,m=0,w=b===!0?e:t,T=b===!0?1:-1;for(let B=1;B<=s;B++)f.push(0,g*T,0),h.push(0,T,0),u.push(.5,.5),_++;let U=_;for(let B=0;B<=s;B++){let se=B/s*c+a,Z=Math.cos(se),ee=Math.sin(se);F.x=w*ee,F.y=g*T,F.z=w*Z,f.push(F.x,F.y,F.z),h.push(0,T,0),A.x=Z*.5+.5,A.y=ee*.5*T+.5,u.push(A.x,A.y),_++}for(let B=0;B<s;B++){let re=I+B,se=U+B;b===!0?d.push(se,se+1,re):d.push(se+1,se,re),m+=3}l.addGroup(p,m,b===!0?1:2),p+=m}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var La=class i extends Tn{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};let r=[],o=[];a(s),l(n),d(),this.setAttribute("position",new nn(r,3)),this.setAttribute("normal",new nn(r.slice(),3)),this.setAttribute("uv",new nn(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(S){let E=new L,b=new L,I=new L;for(let A=0;A<t.length;A+=3)u(t[A+0],E),u(t[A+1],b),u(t[A+2],I),c(E,b,I,S)}function c(S,E,b,I){let A=I+1,F=[];for(let m=0;m<=A;m++){F[m]=[];let w=S.clone().lerp(b,m/A),T=E.clone().lerp(b,m/A),U=A-m;for(let B=0;B<=U;B++)B===0&&m===A?F[m][B]=w:F[m][B]=w.clone().lerp(T,B/U)}for(let m=0;m<A;m++)for(let w=0;w<2*(A-m)-1;w++){let T=Math.floor(w/2);w%2===0?(h(F[m][T+1]),h(F[m+1][T]),h(F[m][T])):(h(F[m][T+1]),h(F[m+1][T+1]),h(F[m+1][T]))}}function l(S){let E=new L;for(let b=0;b<r.length;b+=3)E.x=r[b+0],E.y=r[b+1],E.z=r[b+2],E.normalize().multiplyScalar(S),r[b+0]=E.x,r[b+1]=E.y,r[b+2]=E.z}function d(){let S=new L;for(let E=0;E<r.length;E+=3){S.x=r[E+0],S.y=r[E+1],S.z=r[E+2];let b=g(S)/2/Math.PI+.5,I=p(S)/Math.PI+.5;o.push(b,1-I)}_(),f()}function f(){for(let S=0;S<o.length;S+=6){let E=o[S+0],b=o[S+2],I=o[S+4],A=Math.max(E,b,I),F=Math.min(E,b,I);A>.9&&F<.1&&(E<.2&&(o[S+0]+=1),b<.2&&(o[S+2]+=1),I<.2&&(o[S+4]+=1))}}function h(S){r.push(S.x,S.y,S.z)}function u(S,E){let b=S*3;E.x=e[b+0],E.y=e[b+1],E.z=e[b+2]}function _(){let S=new L,E=new L,b=new L,I=new L,A=new ze,F=new ze,m=new ze;for(let w=0,T=0;w<r.length;w+=9,T+=6){S.set(r[w+0],r[w+1],r[w+2]),E.set(r[w+3],r[w+4],r[w+5]),b.set(r[w+6],r[w+7],r[w+8]),A.set(o[T+0],o[T+1]),F.set(o[T+2],o[T+3]),m.set(o[T+4],o[T+5]),I.copy(S).add(E).add(b).divideScalar(3);let U=g(I);y(A,T+0,S,U),y(F,T+2,E,U),y(m,T+4,b,U)}}function y(S,E,b,I){I<0&&S.x===1&&(o[E]=S.x-1),b.x===0&&b.z===0&&(o[E]=I/2/Math.PI+.5)}function g(S){return Math.atan2(S.z,-S.x)}function p(S){return Math.atan2(-S.y,Math.sqrt(S.x*S.x+S.z*S.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.vertices,e.indices,e.radius,e.detail)}};var qn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){ft("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,s=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),s=0,r=n.length,o;t?o=t:o=e*n[r-1];let a=0,c=r-1,l;for(;a<=c;)if(s=Math.floor(a+(c-a)/2),l=n[s]-o,l<0)a=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,n[s]===o)return s/(r-1);let d=n[s],h=n[s+1]-d,u=(o-d)/h;return(s+u)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);let o=this.getPoint(s),a=this.getPoint(r),c=t||(o.isVector2?new ze:new L);return c.copy(a).sub(o).normalize(),c}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new L,s=[],r=[],o=[],a=new L,c=new Wt;for(let u=0;u<=e;u++){let _=u/e;s[u]=this.getTangentAt(_,new L)}r[0]=new L,o[0]=new L;let l=Number.MAX_VALUE,d=Math.abs(s[0].x),f=Math.abs(s[0].y),h=Math.abs(s[0].z);d<=l&&(l=d,n.set(1,0,0)),f<=l&&(l=f,n.set(0,1,0)),h<=l&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),o[u]=o[u-1].clone(),a.crossVectors(s[u-1],s[u]),a.length()>Number.EPSILON){a.normalize();let _=Math.acos(St(s[u-1].dot(s[u]),-1,1));r[u].applyMatrix4(c.makeRotationAxis(a,_))}o[u].crossVectors(s[u],r[u])}if(t===!0){let u=Math.acos(St(r[0].dot(r[e]),-1,1));u/=e,s[0].dot(a.crossVectors(r[0],r[e]))>0&&(u=-u);for(let _=1;_<=e;_++)r[_].applyMatrix4(c.makeRotationAxis(s[_],u*_)),o[_].crossVectors(s[_],r[_])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},_r=class extends qn{constructor(e=0,t=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=c}getPoint(e,t=new ze){let n=t,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);let a=this.aStartAngle+e*r,c=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let d=Math.cos(this.aRotation),f=Math.sin(this.aRotation),h=c-this.aX,u=l-this.aY;c=h*d-u*f+this.aX,l=h*f+u*d+this.aY}return n.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Da=class extends _r{constructor(e,t,n,s,r,o){super(e,t,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function vh(){let i=0,e=0,t=0,n=0;function s(r,o,a,c){i=r,e=a,t=-3*r+3*o-2*a-c,n=2*r-2*o+a+c}return{initCatmullRom:function(r,o,a,c,l){s(o,a,l*(a-r),l*(c-o))},initNonuniformCatmullRom:function(r,o,a,c,l,d,f){let h=(o-r)/l-(a-r)/(l+d)+(a-o)/d,u=(a-o)/d-(c-o)/(d+f)+(c-a)/f;h*=d,u*=d,s(o,a,h,u)},calc:function(r){let o=r*r,a=o*r;return i+e*r+t*o+n*a}}}var zu=new L,ku=new L,Dc=new vh,Nc=new vh,Uc=new vh,Na=class extends qn{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new L){let n=t,s=this.points,r=s.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),c=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:c===0&&a===r-1&&(a=r-2,c=1);let l,d;this.closed||a>0?l=s[(a-1)%r]:(ku.subVectors(s[0],s[1]).add(s[0]),l=ku);let f=s[a%r],h=s[(a+1)%r];if(this.closed||a+2<r?d=s[(a+2)%r]:(zu.subVectors(s[r-1],s[r-2]).add(s[r-1]),d=zu),this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?.5:.25,_=Math.pow(l.distanceToSquared(f),u),y=Math.pow(f.distanceToSquared(h),u),g=Math.pow(h.distanceToSquared(d),u);y<1e-4&&(y=1),_<1e-4&&(_=y),g<1e-4&&(g=y),Dc.initNonuniformCatmullRom(l.x,f.x,h.x,d.x,_,y,g),Nc.initNonuniformCatmullRom(l.y,f.y,h.y,d.y,_,y,g),Uc.initNonuniformCatmullRom(l.z,f.z,h.z,d.z,_,y,g)}else this.curveType==="catmullrom"&&(Dc.initCatmullRom(l.x,f.x,h.x,d.x,this.tension),Nc.initCatmullRom(l.y,f.y,h.y,d.y,this.tension),Uc.initCatmullRom(l.z,f.z,h.z,d.z,this.tension));return n.set(Dc.calc(c),Nc.calc(c),Uc.calc(c)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(new L().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Vu(i,e,t,n,s){let r=(n-e)*.5,o=(s-t)*.5,a=i*i,c=i*a;return(2*t-2*n+r+o)*c+(-3*t+3*n-2*r-o)*a+r*i+t}function Ap(i,e){let t=1-i;return t*t*e}function Rp(i,e){return 2*(1-i)*i*e}function Cp(i,e){return i*i*e}function $r(i,e,t,n){return Ap(i,e)+Rp(i,t)+Cp(i,n)}function Pp(i,e){let t=1-i;return t*t*t*e}function Ip(i,e){let t=1-i;return 3*t*t*i*e}function Lp(i,e){return 3*(1-i)*i*i*e}function Dp(i,e){return i*i*i*e}function Zr(i,e,t,n,s){return Pp(i,e)+Ip(i,t)+Lp(i,n)+Dp(i,s)}var ao=class extends qn{constructor(e=new ze,t=new ze,n=new ze,s=new ze){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new ze){let n=t,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Zr(e,s.x,r.x,o.x,a.x),Zr(e,s.y,r.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Ua=class extends qn{constructor(e=new L,t=new L,n=new L,s=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new L){let n=t,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Zr(e,s.x,r.x,o.x,a.x),Zr(e,s.y,r.y,o.y,a.y),Zr(e,s.z,r.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},lo=class extends qn{constructor(e=new ze,t=new ze){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ze){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ze){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Fa=class extends qn{constructor(e=new L,t=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},co=class extends qn{constructor(e=new ze,t=new ze,n=new ze){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ze){let n=t,s=this.v0,r=this.v1,o=this.v2;return n.set($r(e,s.x,r.x,o.x),$r(e,s.y,r.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Oa=class extends qn{constructor(e=new L,t=new L,n=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){let n=t,s=this.v0,r=this.v1,o=this.v2;return n.set($r(e,s.x,r.x,o.x),$r(e,s.y,r.y,o.y),$r(e,s.z,r.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ho=class extends qn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ze){let n=t,s=this.points,r=(s.length-1)*e,o=Math.floor(r),a=r-o,c=s[o===0?o:o-1],l=s[o],d=s[o>s.length-2?s.length-1:o+1],f=s[o>s.length-3?s.length-1:o+2];return n.set(Vu(a,c.x,l.x,d.x,f.x),Vu(a,c.y,l.y,d.y,f.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(s.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(new ze().fromArray(s))}return this}},Gc=Object.freeze({__proto__:null,ArcCurve:Da,CatmullRomCurve3:Na,CubicBezierCurve:ao,CubicBezierCurve3:Ua,EllipseCurve:_r,LineCurve:lo,LineCurve3:Fa,QuadraticBezierCurve:co,QuadraticBezierCurve3:Oa,SplineCurve:ho}),Ba=class extends qn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Gc[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let o=s[r]-n,a=this.curves[r],c=a.getLength(),l=c===0?0:1-o/c;return a.getPointAt(l,t)}r++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let s=0,r=this.curves;s<r.length;s++){let o=r[s],a=o.isEllipseCurve?e*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?e*o.points.length:e,c=o.getPoints(a);for(let l=0;l<c.length;l++){let d=c[l];n&&n.equals(d)||(t.push(d),n=d)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let s=e.curves[t];this.curves.push(new Gc[s.type]().fromJSON(s))}return this}},uo=class extends Ba{constructor(e){super(),this.type="Path",this.currentPoint=new ze,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new lo(this.currentPoint.clone(),new ze(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){let r=new co(this.currentPoint.clone(),new ze(e,t),new ze(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,o){let a=new ao(this.currentPoint.clone(),new ze(e,t),new ze(n,s),new ze(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new ho(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,o){let a=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(e+a,t+c,n,s,r,o),this}absarc(e,t,n,s,r,o){return this.absellipse(e,t,n,n,s,r,o),this}ellipse(e,t,n,s,r,o,a,c){let l=this.currentPoint.x,d=this.currentPoint.y;return this.absellipse(e+l,t+d,n,s,r,o,a,c),this}absellipse(e,t,n,s,r,o,a,c){let l=new _r(e,t,n,s,r,o,a,c);if(this.curves.length>0){let f=l.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(l);let d=l.getPoint(1);return this.currentPoint.copy(d),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},xr=class extends uo{constructor(e){super(e),this.uuid=zs(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let s=e.holes[t];this.holes.push(new uo().fromJSON(s))}return this}};function Np(i,e,t=2){let n=e&&e.length,s=n?e[0]*t:i.length,r=Ud(i,0,s,t,!0),o=[];if(!r||r.next===r.prev)return o;let a,c,l;if(n&&(r=zp(i,e,r,t)),i.length>80*t){a=i[0],c=i[1];let d=a,f=c;for(let h=t;h<s;h+=t){let u=i[h],_=i[h+1];u<a&&(a=u),_<c&&(c=_),u>d&&(d=u),_>f&&(f=_)}l=Math.max(d-a,f-c),l=l!==0?32767/l:0}return fo(r,o,t,a,c,l,0),o}function Ud(i,e,t,n,s){let r;if(s===Jp(i,e,t,n)>0)for(let o=e;o<t;o+=n)r=Hu(o/n|0,i[o],i[o+1],r);else for(let o=t-n;o>=e;o-=n)r=Hu(o/n|0,i[o],i[o+1],r);return r&&yr(r,r.next)&&(mo(r),r=r.next),r}function Os(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(yr(t,t.next)||Qt(t.prev,t,t.next)===0)){if(mo(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function fo(i,e,t,n,s,r,o){if(!i)return;!o&&r&&Wp(i,n,s,r);let a=i;for(;i.prev!==i.next;){let c=i.prev,l=i.next;if(r?Fp(i,n,s,r):Up(i)){e.push(c.i,i.i,l.i),mo(i),i=l.next,a=l.next;continue}if(i=l,i===a){o?o===1?(i=Op(Os(i),e),fo(i,e,t,n,s,r,2)):o===2&&Bp(i,e,t,n,s,r):fo(Os(i),e,t,n,s,r,1);break}}}function Up(i){let e=i.prev,t=i,n=i.next;if(Qt(e,t,n)>=0)return!1;let s=e.x,r=t.x,o=n.x,a=e.y,c=t.y,l=n.y,d=Math.min(s,r,o),f=Math.min(a,c,l),h=Math.max(s,r,o),u=Math.max(a,c,l),_=n.next;for(;_!==e;){if(_.x>=d&&_.x<=h&&_.y>=f&&_.y<=u&&Xr(s,a,r,c,o,l,_.x,_.y)&&Qt(_.prev,_,_.next)>=0)return!1;_=_.next}return!0}function Fp(i,e,t,n){let s=i.prev,r=i,o=i.next;if(Qt(s,r,o)>=0)return!1;let a=s.x,c=r.x,l=o.x,d=s.y,f=r.y,h=o.y,u=Math.min(a,c,l),_=Math.min(d,f,h),y=Math.max(a,c,l),g=Math.max(d,f,h),p=Wc(u,_,e,t,n),S=Wc(y,g,e,t,n),E=i.prevZ,b=i.nextZ;for(;E&&E.z>=p&&b&&b.z<=S;){if(E.x>=u&&E.x<=y&&E.y>=_&&E.y<=g&&E!==s&&E!==o&&Xr(a,d,c,f,l,h,E.x,E.y)&&Qt(E.prev,E,E.next)>=0||(E=E.prevZ,b.x>=u&&b.x<=y&&b.y>=_&&b.y<=g&&b!==s&&b!==o&&Xr(a,d,c,f,l,h,b.x,b.y)&&Qt(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;E&&E.z>=p;){if(E.x>=u&&E.x<=y&&E.y>=_&&E.y<=g&&E!==s&&E!==o&&Xr(a,d,c,f,l,h,E.x,E.y)&&Qt(E.prev,E,E.next)>=0)return!1;E=E.prevZ}for(;b&&b.z<=S;){if(b.x>=u&&b.x<=y&&b.y>=_&&b.y<=g&&b!==s&&b!==o&&Xr(a,d,c,f,l,h,b.x,b.y)&&Qt(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function Op(i,e){let t=i;do{let n=t.prev,s=t.next.next;!yr(n,s)&&Od(n,t,t.next,s)&&po(n,s)&&po(s,n)&&(e.push(n.i,t.i,s.i),mo(t),mo(t.next),t=i=s),t=t.next}while(t!==i);return Os(t)}function Bp(i,e,t,n,s,r){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Yp(o,a)){let c=Bd(o,a);o=Os(o,o.next),c=Os(c,c.next),fo(o,e,t,n,s,r,0),fo(c,e,t,n,s,r,0);return}a=a.next}o=o.next}while(o!==i)}function zp(i,e,t,n){let s=[];for(let r=0,o=e.length;r<o;r++){let a=e[r]*n,c=r<o-1?e[r+1]*n:i.length,l=Ud(i,a,c,n,!1);l===l.next&&(l.steiner=!0),s.push(qp(l))}s.sort(kp);for(let r=0;r<s.length;r++)t=Vp(s[r],t);return t}function kp(i,e){let t=i.x-e.x;if(t===0&&(t=i.y-e.y,t===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=n-s}return t}function Vp(i,e){let t=Hp(i,e);if(!t)return e;let n=Bd(t,i);return Os(n,n.next),Os(t,t.next)}function Hp(i,e){let t=e,n=i.x,s=i.y,r=-1/0,o;if(yr(i,t))return t;do{if(yr(i,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){let f=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=n&&f>r&&(r=f,o=t.x<t.next.x?t:t.next,f===n))return o}t=t.next}while(t!==e);if(!o)return null;let a=o,c=o.x,l=o.y,d=1/0;t=o;do{if(n>=t.x&&t.x>=c&&n!==t.x&&Fd(s<l?n:r,s,c,l,s<l?r:n,s,t.x,t.y)){let f=Math.abs(s-t.y)/(n-t.x);po(t,i)&&(f<d||f===d&&(t.x>o.x||t.x===o.x&&Gp(o,t)))&&(o=t,d=f)}t=t.next}while(t!==a);return o}function Gp(i,e){return Qt(i.prev,i,e.prev)<0&&Qt(e.next,i,i.next)<0}function Wp(i,e,t,n){let s=i;do s.z===0&&(s.z=Wc(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Xp(s)}function Xp(i){let e,t=1;do{let n=i,s;i=null;let r=null;for(e=0;n;){e++;let o=n,a=0;for(let l=0;l<t&&(a++,o=o.nextZ,!!o);l++);let c=t;for(;a>0||c>0&&o;)a!==0&&(c===0||!o||n.z<=o.z)?(s=n,n=n.nextZ,a--):(s=o,o=o.nextZ,c--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=o}r.nextZ=null,t*=2}while(e>1);return i}function Wc(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function qp(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Fd(i,e,t,n,s,r,o,a){return(s-o)*(e-a)>=(i-o)*(r-a)&&(i-o)*(n-a)>=(t-o)*(e-a)&&(t-o)*(r-a)>=(s-o)*(n-a)}function Xr(i,e,t,n,s,r,o,a){return!(i===o&&e===a)&&Fd(i,e,t,n,s,r,o,a)}function Yp(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!$p(i,e)&&(po(i,e)&&po(e,i)&&Zp(i,e)&&(Qt(i.prev,i,e.prev)||Qt(i,e.prev,e))||yr(i,e)&&Qt(i.prev,i,i.next)>0&&Qt(e.prev,e,e.next)>0)}function Qt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function yr(i,e){return i.x===e.x&&i.y===e.y}function Od(i,e,t,n){let s=aa(Qt(i,e,t)),r=aa(Qt(i,e,n)),o=aa(Qt(t,n,i)),a=aa(Qt(t,n,e));return!!(s!==r&&o!==a||s===0&&oa(i,t,e)||r===0&&oa(i,n,e)||o===0&&oa(t,i,n)||a===0&&oa(t,e,n))}function oa(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function aa(i){return i>0?1:i<0?-1:0}function $p(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&Od(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function po(i,e){return Qt(i.prev,i,i.next)<0?Qt(i,e,i.next)>=0&&Qt(i,i.prev,e)>=0:Qt(i,e,i.prev)<0||Qt(i,i.next,e)<0}function Zp(i,e){let t=i,n=!1,s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function Bd(i,e){let t=Xc(i.i,i.x,i.y),n=Xc(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function Hu(i,e,t,n){let s=Xc(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function mo(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Xc(i,e,t){return{i,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Jp(i,e,t,n){let s=0;for(let r=e,o=t-n;r<t;r+=n)s+=(i[o]-i[r])*(i[r+1]+i[o+1]),o=r;return s}var qc=class{static triangulate(e,t,n=2){return Np(e,t,n)}},Is=class i{static area(e){let t=e.length,n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return i.area(e)<0}static triangulateShape(e,t){let n=[],s=[],r=[];Gu(e),Wu(n,e);let o=e.length;t.forEach(Gu);for(let c=0;c<t.length;c++)s.push(o),o+=t[c].length,Wu(n,t[c]);let a=qc.triangulate(n,s);for(let c=0;c<a.length;c+=3)r.push(a.slice(c,c+3));return r}};function Gu(i){let e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function Wu(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}var go=class i extends Tn{constructor(e=new xr([new ze(.5,.5),new ze(-.5,.5),new ze(-.5,-.5),new ze(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,s=[],r=[];for(let a=0,c=e.length;a<c;a++){let l=e[a];o(l)}this.setAttribute("position",new nn(s,3)),this.setAttribute("uv",new nn(r,2)),this.computeVertexNormals();function o(a){let c=[],l=t.curveSegments!==void 0?t.curveSegments:12,d=t.steps!==void 0?t.steps:1,f=t.depth!==void 0?t.depth:1,h=t.bevelEnabled!==void 0?t.bevelEnabled:!0,u=t.bevelThickness!==void 0?t.bevelThickness:.2,_=t.bevelSize!==void 0?t.bevelSize:u-.1,y=t.bevelOffset!==void 0?t.bevelOffset:0,g=t.bevelSegments!==void 0?t.bevelSegments:3,p=t.extrudePath,S=t.UVGenerator!==void 0?t.UVGenerator:Kp,E,b=!1,I,A,F,m;if(p){E=p.getSpacedPoints(d),b=!0,h=!1;let q=p.isCatmullRomCurve3?p.closed:!1;I=p.computeFrenetFrames(d,q),A=new L,F=new L,m=new L}h||(g=0,u=0,_=0,y=0);let w=a.extractPoints(l),T=w.shape,U=w.holes;if(!Is.isClockWise(T)){T=T.reverse();for(let q=0,he=U.length;q<he;q++){let Me=U[q];Is.isClockWise(Me)&&(U[q]=Me.reverse())}}function re(q){let Me=10000000000000001e-36,Ae=q[0];for(let Be=1;Be<=q.length;Be++){let ke=Be%q.length,qe=q[ke],$e=qe.x-Ae.x,it=qe.y-Ae.y,X=$e*$e+it*it,gt=Math.max(Math.abs(qe.x),Math.abs(qe.y),Math.abs(Ae.x),Math.abs(Ae.y)),ot=Me*gt*gt;if(X<=ot){q.splice(ke,1),Be--;continue}Ae=qe}}re(T),U.forEach(re);let se=U.length,Z=T;for(let q=0;q<se;q++){let he=U[q];T=T.concat(he)}function ee(q,he,Me){return he||mt("ExtrudeGeometry: vec does not exist"),q.clone().addScaledVector(he,Me)}let ae=T.length;function ye(q,he,Me){let Ae,Be,ke,qe=q.x-he.x,$e=q.y-he.y,it=Me.x-q.x,X=Me.y-q.y,gt=qe*qe+$e*$e,ot=qe*X-$e*it;if(Math.abs(ot)>Number.EPSILON){let R=Math.sqrt(gt),x=Math.sqrt(it*it+X*X),Q=he.x-$e/R,ue=he.y+qe/R,xe=Me.x-X/x,Pe=Me.y+it/x,Ue=((xe-Q)*X-(Pe-ue)*it)/(qe*X-$e*it);Ae=Q+qe*Ue-q.x,Be=ue+$e*Ue-q.y;let fe=Ae*Ae+Be*Be;if(fe<=2)return new ze(Ae,Be);ke=Math.sqrt(fe/2)}else{let R=!1;qe>Number.EPSILON?it>Number.EPSILON&&(R=!0):qe<-Number.EPSILON?it<-Number.EPSILON&&(R=!0):Math.sign($e)===Math.sign(X)&&(R=!0),R?(Ae=-$e,Be=qe,ke=Math.sqrt(gt)):(Ae=qe,Be=$e,ke=Math.sqrt(gt/2))}return new ze(Ae/ke,Be/ke)}let be=[];for(let q=0,he=Z.length,Me=he-1,Ae=q+1;q<he;q++,Me++,Ae++)Me===he&&(Me=0),Ae===he&&(Ae=0),be[q]=ye(Z[q],Z[Me],Z[Ae]);let O=[],z,ne=be.concat();for(let q=0,he=se;q<he;q++){let Me=U[q];z=[];for(let Ae=0,Be=Me.length,ke=Be-1,qe=Ae+1;Ae<Be;Ae++,ke++,qe++)ke===Be&&(ke=0),qe===Be&&(qe=0),z[Ae]=ye(Me[Ae],Me[ke],Me[qe]);O.push(z),ne=ne.concat(z)}let _e;if(g===0)_e=Is.triangulateShape(Z,U);else{let q=[],he=[];for(let Me=0;Me<g;Me++){let Ae=Me/g,Be=u*Math.cos(Ae*Math.PI/2),ke=_*Math.sin(Ae*Math.PI/2)+y;for(let qe=0,$e=Z.length;qe<$e;qe++){let it=ee(Z[qe],be[qe],ke);j(it.x,it.y,-Be),Ae===0&&q.push(it)}for(let qe=0,$e=se;qe<$e;qe++){let it=U[qe];z=O[qe];let X=[];for(let gt=0,ot=it.length;gt<ot;gt++){let R=ee(it[gt],z[gt],ke);j(R.x,R.y,-Be),Ae===0&&X.push(R)}Ae===0&&he.push(X)}}_e=Is.triangulateShape(q,he)}let Fe=_e.length,Ye=_+y;for(let q=0;q<ae;q++){let he=h?ee(T[q],ne[q],Ye):T[q];b?(F.copy(I.normals[0]).multiplyScalar(he.x),A.copy(I.binormals[0]).multiplyScalar(he.y),m.copy(E[0]).add(F).add(A),j(m.x,m.y,m.z)):j(he.x,he.y,0)}for(let q=1;q<=d;q++)for(let he=0;he<ae;he++){let Me=h?ee(T[he],ne[he],Ye):T[he];b?(F.copy(I.normals[q]).multiplyScalar(Me.x),A.copy(I.binormals[q]).multiplyScalar(Me.y),m.copy(E[q]).add(F).add(A),j(m.x,m.y,m.z)):j(Me.x,Me.y,f/d*q)}for(let q=g-1;q>=0;q--){let he=q/g,Me=u*Math.cos(he*Math.PI/2),Ae=_*Math.sin(he*Math.PI/2)+y;for(let Be=0,ke=Z.length;Be<ke;Be++){let qe=ee(Z[Be],be[Be],Ae);j(qe.x,qe.y,f+Me)}for(let Be=0,ke=U.length;Be<ke;Be++){let qe=U[Be];z=O[Be];for(let $e=0,it=qe.length;$e<it;$e++){let X=ee(qe[$e],z[$e],Ae);b?j(X.x,X.y+E[d-1].y,E[d-1].x+Me):j(X.x,X.y,f+Me)}}}me(),V();function me(){let q=s.length/3;if(h){let he=0,Me=ae*he;for(let Ae=0;Ae<Fe;Ae++){let Be=_e[Ae];Te(Be[2]+Me,Be[1]+Me,Be[0]+Me)}he=d+g*2,Me=ae*he;for(let Ae=0;Ae<Fe;Ae++){let Be=_e[Ae];Te(Be[0]+Me,Be[1]+Me,Be[2]+Me)}}else{for(let he=0;he<Fe;he++){let Me=_e[he];Te(Me[2],Me[1],Me[0])}for(let he=0;he<Fe;he++){let Me=_e[he];Te(Me[0]+ae*d,Me[1]+ae*d,Me[2]+ae*d)}}n.addGroup(q,s.length/3-q,0)}function V(){let q=s.length/3,he=0;ge(Z,he),he+=Z.length;for(let Me=0,Ae=U.length;Me<Ae;Me++){let Be=U[Me];ge(Be,he),he+=Be.length}n.addGroup(q,s.length/3-q,1)}function ge(q,he){let Me=q.length;for(;--Me>=0;){let Ae=Me,Be=Me-1;Be<0&&(Be=q.length-1);for(let ke=0,qe=d+g*2;ke<qe;ke++){let $e=ae*ke,it=ae*(ke+1),X=he+Ae+$e,gt=he+Be+$e,ot=he+Be+it,R=he+Ae+it;we(X,gt,ot,R)}}}function j(q,he,Me){c.push(q),c.push(he),c.push(Me)}function Te(q,he,Me){Re(q),Re(he),Re(Me);let Ae=s.length/3,Be=S.generateTopUV(n,s,Ae-3,Ae-2,Ae-1);Le(Be[0]),Le(Be[1]),Le(Be[2])}function we(q,he,Me,Ae){Re(q),Re(he),Re(Ae),Re(he),Re(Me),Re(Ae);let Be=s.length/3,ke=S.generateSideWallUV(n,s,Be-6,Be-3,Be-2,Be-1);Le(ke[0]),Le(ke[1]),Le(ke[3]),Le(ke[1]),Le(ke[2]),Le(ke[3])}function Re(q){s.push(c[q*3+0]),s.push(c[q*3+1]),s.push(c[q*3+2])}function Le(q){r.push(q.x),r.push(q.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return jp(t,n,e)}static fromJSON(e,t){let n=[];for(let r=0,o=e.shapes.length;r<o;r++){let a=t[e.shapes[r]];n.push(a)}let s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new Gc[s.type]().fromJSON(s)),new i(n,e.options)}},Kp={generateTopUV:function(i,e,t,n,s){let r=e[t*3],o=e[t*3+1],a=e[n*3],c=e[n*3+1],l=e[s*3],d=e[s*3+1];return[new ze(r,o),new ze(a,c),new ze(l,d)]},generateSideWallUV:function(i,e,t,n,s,r){let o=e[t*3],a=e[t*3+1],c=e[t*3+2],l=e[n*3],d=e[n*3+1],f=e[n*3+2],h=e[s*3],u=e[s*3+1],_=e[s*3+2],y=e[r*3],g=e[r*3+1],p=e[r*3+2];return Math.abs(a-d)<Math.abs(o-l)?[new ze(o,1-c),new ze(l,1-f),new ze(h,1-_),new ze(y,1-p)]:[new ze(a,1-c),new ze(d,1-f),new ze(u,1-_),new ze(g,1-p)]}};function jp(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var vr=class i extends La{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}};var us=class i extends Tn{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};let r=e/2,o=t/2,a=Math.floor(n),c=Math.floor(s),l=a+1,d=c+1,f=e/a,h=t/c,u=[],_=[],y=[],g=[];for(let p=0;p<d;p++){let S=p*h-o;for(let E=0;E<l;E++){let b=E*f-r;_.push(b,-S,0),y.push(0,0,1),g.push(E/a),g.push(1-p/c)}}for(let p=0;p<c;p++)for(let S=0;S<a;S++){let E=S+l*p,b=S+l*(p+1),I=S+1+l*(p+1),A=S+1+l*p;u.push(E,b,A),u.push(b,I,A)}this.setIndex(u),this.setAttribute("position",new nn(_,3)),this.setAttribute("normal",new nn(y,3)),this.setAttribute("uv",new nn(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}};function ks(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let s=i[t][n];if(Xu(s))s.isRenderTargetTexture?(ft("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(Xu(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function An(i){let e={};for(let t=0;t<i.length;t++){let n=ks(i[t]);for(let s in n)e[s]=n[s]}return e}function Xu(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Qp(i){let e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function bh(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ct.workingColorSpace}var zd={clone:ks,merge:An},em=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,tm=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Yn=class extends Zi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=em,this.fragmentShader=tm,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ks(e.uniforms),this.uniformsGroups=Qp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?t.uniforms[s]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[s]={type:"m4",value:o.toArray()}:t.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new _t().setHex(s.value);break;case"v2":this.uniforms[n].value=new ze().fromArray(s.value);break;case"v3":this.uniforms[n].value=new L().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Kt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new vt().fromArray(s.value);break;case"m4":this.uniforms[n].value=new Wt().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},za=class extends Yn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Ln=class extends Zi{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new _t(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new _t(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Vl,this.normalScale=new ze(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ni,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};var ka=class extends Zi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Md,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Va=class extends Zi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function la(i,e){return!i||i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}var ds=class{constructor(e,t,n,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,s=t[n],r=t[n-1];n:{e:{let o;t:{i:if(!(e<s)){for(let a=n+2;;){if(s===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=s,s=t[++n],e<s)break e}o=t.length;break t}if(!(e>=r)){let a=t[1];e<a&&(n=2,r=a);for(let c=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===c)break;if(s=r,r=t[--n-1],e>=r)break e}o=n,n=0;break t}break n}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(s=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=e*s;for(let o=0;o!==s;++o)t[o]=n[r+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Ha=class extends ds{constructor(e,t,n,s){super(e,t,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Bc,endingEnd:Bc}}intervalChanged_(e,t,n){let s=this.parameterPositions,r=e-2,o=e+1,a=s[r],c=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case zc:r=e,a=2*t-n;break;case kc:r=s.length-2,a=t+s[r]-s[r+1];break;default:r=e,a=n}if(c===void 0)switch(this.getSettings_().endingEnd){case zc:o=e,c=2*n-t;break;case kc:o=1,c=n+s[1]-s[0];break;default:o=e-1,c=t}let l=(n-t)*.5,d=this.valueSize;this._weightPrev=l/(t-a),this._weightNext=l/(c-n),this._offsetPrev=r*d,this._offsetNext=o*d}interpolate_(e,t,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,d=this._offsetPrev,f=this._offsetNext,h=this._weightPrev,u=this._weightNext,_=(n-t)/(s-t),y=_*_,g=y*_,p=-h*g+2*h*y-h*_,S=(1+h)*g+(-1.5-2*h)*y+(-.5+h)*_+1,E=(-1-u)*g+(1.5+u)*y+.5*_,b=u*g-u*y;for(let I=0;I!==a;++I)r[I]=p*o[d+I]+S*o[l+I]+E*o[c+I]+b*o[f+I];return r}},Ga=class extends ds{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,d=(n-t)/(s-t),f=1-d;for(let h=0;h!==a;++h)r[h]=o[l+h]*f+o[c+h]*d;return r}},Wa=class extends ds{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e){return this.copySampleValue_(e-1)}},Xa=class extends ds{interpolate_(e,t,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,d=this.inTangents,f=this.outTangents;if(!d||!f){let _=(n-t)/(s-t),y=1-_;for(let g=0;g!==a;++g)r[g]=o[l+g]*y+o[c+g]*_;return r}let h=a*2,u=e-1;for(let _=0;_!==a;++_){let y=o[l+_],g=o[c+_],p=u*h+_*2,S=f[p],E=f[p+1],b=e*h+_*2,I=d[b],A=d[b+1],F=(n-t)/(s-t),m,w,T,U,B;for(let re=0;re<8;re++){m=F*F,w=m*F,T=1-F,U=T*T,B=U*T;let Z=B*t+3*U*F*S+3*T*m*I+w*s-n;if(Math.abs(Z)<1e-10)break;let ee=3*U*(S-t)+6*T*F*(I-S)+3*m*(s-I);if(Math.abs(ee)<1e-10)break;F=F-Z/ee,F=Math.max(0,Math.min(1,F))}r[_]=B*y+3*U*F*E+3*T*m*A+w*g}return r}},$n=class{constructor(e,t,n,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=la(t,this.TimeBufferType),this.values=la(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:la(e.times,Array),values:la(e.values,Array)};let s=e.getInterpolation();s!==e.DefaultInterpolation&&(n.interpolation=s)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Wa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Ga(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Ha(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Xa(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Jr:t=this.InterpolantFactoryMethodDiscrete;break;case Ea:t=this.InterpolantFactoryMethodLinear;break;case ua:t=this.InterpolantFactoryMethodSmooth;break;case Oc:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return ft("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Jr;case this.InterpolantFactoryMethodLinear:return Ea;case this.InterpolantFactoryMethodSmooth:return ua;case this.InterpolantFactoryMethodBezier:return Oc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]*=e}return this}trim(e,t){let n=this.times,s=n.length,r=0,o=s-1;for(;r!==s&&n[r]<e;)++r;for(;o!==-1&&n[o]>t;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(mt("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,s=this.values,r=n.length;r===0&&(mt("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let c=n[a];if(typeof c=="number"&&isNaN(c)){mt("KeyframeTrack: Time is not a valid number.",this,a,c),e=!1;break}if(o!==null&&o>c){mt("KeyframeTrack: Out of order keys.",this,a,c,o),e=!1;break}o=c}if(s!==void 0&&qf(s))for(let a=0,c=s.length;a!==c;++a){let l=s[a];if(isNaN(l)){mt("KeyframeTrack: Value is not a valid number.",this,a,l),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===ua,r=e.length-1,o=1;for(let a=1;a<r;++a){let c=!1,l=e[a],d=e[a+1];if(l!==d&&(a!==1||l!==e[0]))if(s)c=!0;else{let f=a*n,h=f-n,u=f+n;for(let _=0;_!==n;++_){let y=t[f+_];if(y!==t[h+_]||y!==t[u+_]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];let f=a*n,h=o*n;for(let u=0;u!==n;++u)t[h+u]=t[f+u]}++o}}if(r>0){e[o]=e[r];for(let a=r*n,c=o*n,l=0;l!==n;++l)t[c+l]=t[a+l];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,s=new n(this.name,e,t);return s.createInterpolant=this.createInterpolant,s}};$n.prototype.ValueTypeName="";$n.prototype.TimeBufferType=Float32Array;$n.prototype.ValueBufferType=Float32Array;$n.prototype.DefaultInterpolation=Ea;var fs=class extends $n{constructor(e,t,n){super(e,t,n)}};fs.prototype.ValueTypeName="bool";fs.prototype.ValueBufferType=Array;fs.prototype.DefaultInterpolation=Jr;fs.prototype.InterpolantFactoryMethodLinear=void 0;fs.prototype.InterpolantFactoryMethodSmooth=void 0;var qa=class extends $n{constructor(e,t,n,s){super(e,t,n,s)}};qa.prototype.ValueTypeName="color";var Ya=class extends $n{constructor(e,t,n,s){super(e,t,n,s)}};Ya.prototype.ValueTypeName="number";var $a=class extends ds{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=(n-t)/(s-t),l=e*a;for(let d=l+a;l!==d;l+=4)In.slerpFlat(r,0,o,l-a,o,l,c);return r}},_o=class extends $n{constructor(e,t,n,s){super(e,t,n,s)}InterpolantFactoryMethodLinear(e){return new $a(this.times,this.values,this.getValueSize(),e)}};_o.prototype.ValueTypeName="quaternion";_o.prototype.InterpolantFactoryMethodSmooth=void 0;var ps=class extends $n{constructor(e,t,n){super(e,t,n)}};ps.prototype.ValueTypeName="string";ps.prototype.ValueBufferType=Array;ps.prototype.DefaultInterpolation=Jr;ps.prototype.InterpolantFactoryMethodLinear=void 0;ps.prototype.InterpolantFactoryMethodSmooth=void 0;var Za=class extends $n{constructor(e,t,n,s){super(e,t,n,s)}};Za.prototype.ValueTypeName="vector";var da={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(qu(i)||(this.files[i]=e))},get:function(i){if(this.enabled!==!1&&!qu(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function qu(i){try{let e=i.slice(i.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var Ja=class{constructor(e,t,n){let s=this,r=!1,o=0,a=0,c,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(d){a++,r===!1&&s.onStart!==void 0&&s.onStart(d,o,a),r=!0},this.itemEnd=function(d){o++,s.onProgress!==void 0&&s.onProgress(d,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(d){s.onError!==void 0&&s.onError(d)},this.resolveURL=function(d){return d=d.normalize("NFC"),c?c(d):d},this.setURLModifier=function(d){return c=d,this},this.addHandler=function(d,f){return l.push(d,f),this},this.removeHandler=function(d){let f=l.indexOf(d);return f!==-1&&l.splice(f,2),this},this.getHandler=function(d){for(let f=0,h=l.length;f<h;f+=2){let u=l[f],_=l[f+1];if(u.global&&(u.lastIndex=0),u.test(d))return _}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},kd=new Ja,br=class{constructor(e){this.manager=e!==void 0?e:kd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(s,r){n.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};br.DEFAULT_MATERIAL_NAME="__DEFAULT";var ir=new WeakMap,Ka=class extends br{constructor(e){super(e)}load(e,t,n,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=da.get(`image:${e}`);if(o!==void 0){if(o.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);else{let f=ir.get(o);f===void 0&&(f=[],ir.set(o,f)),f.push({onLoad:t,onError:s})}return o}let a=cr("img");function c(){d(),t&&t(this);let f=ir.get(this)||[];for(let h=0;h<f.length;h++){let u=f[h];u.onLoad&&u.onLoad(this)}ir.delete(this),r.manager.itemEnd(e)}function l(f){d(),s&&s(f),da.remove(`image:${e}`);let h=ir.get(this)||[];for(let u=0;u<h.length;u++){let _=h[u];_.onError&&_.onError(f)}ir.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function d(){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1)}return a.addEventListener("load",c,!1),a.addEventListener("error",l,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),da.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}};var xo=class extends br{constructor(e){super(e)}load(e,t,n,s){let r=new wn,o=new Ka(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,s),r}},yo=class extends vn{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new _t(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},mi=class extends yo{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(vn.DEFAULT_UP),this.updateMatrix(),this.groundColor=new _t(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Fc=new Wt,Yu=new L,$u=new L,Yc=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ze(512,512),this.mapType=Fn,this.map=null,this.mapPass=null,this.matrix=new Wt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new mr,this._frameExtents=new ze(1,1),this._viewportCount=1,this._viewports=[new Kt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Yu.setFromMatrixPosition(e.matrixWorld),t.position.copy(Yu),$u.setFromMatrixPosition(e.target.matrixWorld),t.lookAt($u),t.updateMatrixWorld(),Fc.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Fc,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===lr||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Fc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ca=new L,ha=new In,wi=new L,vo=class extends vn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Wt,this.projectionMatrix=new Wt,this.projectionMatrixInverse=new Wt,this.coordinateSystem=ui,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ca,ha,wi),wi.x===1&&wi.y===1&&wi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ca,ha,wi.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ca,ha,wi),wi.x===1&&wi.y===1&&wi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ca,ha,wi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},as=new L,Zu=new ze,Ju=new ze,an=class extends vo{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=ur*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(qr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return ur*2*Math.atan(Math.tan(qr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){as.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(as.x,as.y).multiplyScalar(-e/as.z),as.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(as.x,as.y).multiplyScalar(-e/as.z)}getViewSize(e,t){return this.getViewBounds(e,Zu,Ju),t.subVectors(Ju,Zu)}setViewOffset(e,t,n,s,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(qr*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let c=o.fullWidth,l=o.fullHeight;r+=o.offsetX*s/c,t-=o.offsetY*n/l,s*=o.width/c,n*=o.height/l}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var ms=class extends vo{constructor(e=-1,t=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-e,o=n+e,a=s+t,c=s-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,o=r+l*this.view.width,a-=d*this.view.offsetY,c=a-d*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},$c=class extends Yc{constructor(){super(new ms(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Zn=class extends yo{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(vn.DEFAULT_UP),this.updateMatrix(),this.target=new vn,this.shadow=new $c}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var sr=-90,rr=1,ja=class extends vn{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new an(sr,rr,e,t);s.layers=this.layers,this.add(s);let r=new an(sr,rr,e,t);r.layers=this.layers,this.add(r);let o=new an(sr,rr,e,t);o.layers=this.layers,this.add(o);let a=new an(sr,rr,e,t);a.layers=this.layers,this.add(a);let c=new an(sr,rr,e,t);c.layers=this.layers,this.add(c);let l=new an(sr,rr,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,s,r,o,a,c]=t;for(let l of t)this.remove(l);if(e===ui)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===lr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,c,l,d]=this.children,f=e.getRenderTarget(),h=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;let y=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let g=!1;e.isWebGLRenderer===!0?g=e.state.buffers.depth.getReversed():g=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,2,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,3,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),e.setRenderTarget(n,4,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),n.texture.generateMipmaps=y,e.setRenderTarget(n,5,s),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,d),e.setRenderTarget(f,h,u),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}},Qa=class extends an{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Mh="\\[\\]\\.:\\/",nm=new RegExp("["+Mh+"]","g"),Sh="[^"+Mh+"]",im="[^"+Mh.replace("\\.","")+"]",sm=/((?:WC+[\/:])*)/.source.replace("WC",Sh),rm=/(WCOD+)?/.source.replace("WCOD",im),om=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Sh),am=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Sh),lm=new RegExp("^"+sm+rm+om+am+"$"),cm=["material","materials","bones","map"],Zc=class{constructor(e,t,n){let s=n||$t.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},$t=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(nm,"")}static parseTrackName(e){let t=lm.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);cm.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let c=n(a.children);if(c)return c}return null},s=n(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)e[t++]=n[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,s=t.propertyName,r=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ft("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){mt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){mt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){mt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let d=0;d<e.length;d++)if(e[d].name===l){l=d;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){mt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){mt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){mt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){mt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let o=e[s];if(o===void 0){let l=t.nodeName;mt("PropertyBinding: Trying to update property for track: "+l+"."+s+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){mt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){mt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};$t.Composite=Zc;$t.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};$t.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};$t.prototype.GetterByBindingType=[$t.prototype._getValue_direct,$t.prototype._getValue_array,$t.prototype._getValue_arrayElement,$t.prototype._getValue_toArray];$t.prototype.SetterByBindingTypeAndVersioning=[[$t.prototype._setValue_direct,$t.prototype._setValue_direct_setNeedsUpdate,$t.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[$t.prototype._setValue_array,$t.prototype._setValue_array_setNeedsUpdate,$t.prototype._setValue_array_setMatrixWorldNeedsUpdate],[$t.prototype._setValue_arrayElement,$t.prototype._setValue_arrayElement_setNeedsUpdate,$t.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[$t.prototype._setValue_fromArray,$t.prototype._setValue_fromArray_setNeedsUpdate,$t.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var My=new Float32Array(1);var Ku=new Wt,Ri=class{constructor(e,t,n=0,s=1/0){this.ray=new hs(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new fr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):mt("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Ku.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Ku),this}intersectObject(e,t=!0,n=[]){return Jc(e,this,n,t),n.sort(ju),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)Jc(e[s],this,n,t);return n.sort(ju),n}};function ju(i,e){return i.distance-e.distance}function Jc(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let o=0,a=r.length;o<a;o++)Jc(r[o],e,t,!0)}}var Mr=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=St(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(St(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var Ch=class Ch{constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}};Ch.prototype.isMatrix2=!0;var Kc=Ch;var bo=class extends di{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){ft("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Eh(i,e,t,n){let s=hm(n);switch(t){case ph:return i*e;case gh:return i*e/s.components*s.byteLength;case ll:return i*e/s.components*s.byteLength;case bs:return i*e*2/s.components*s.byteLength;case cl:return i*e*2/s.components*s.byteLength;case mh:return i*e*3/s.components*s.byteLength;case ii:return i*e*4/s.components*s.byteLength;case hl:return i*e*4/s.components*s.byteLength;case Eo:case wo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case To:case Ao:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case dl:case pl:return Math.max(i,16)*Math.max(e,8)/4;case ul:case fl:return Math.max(i,8)*Math.max(e,8)/2;case ml:case gl:case xl:case yl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case _l:case Ro:case vl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case bl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Ml:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Sl:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case El:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case wl:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Tl:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Al:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Rl:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Cl:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Pl:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Il:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Ll:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Dl:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case Nl:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case Ul:case Fl:case Ol:return Math.ceil(i/4)*Math.ceil(e/4)*16;case Bl:case zl:return Math.ceil(i/4)*Math.ceil(e/4)*8;case Co:case kl:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function hm(i){switch(i){case Fn:case hh:return{byteLength:1,components:1};case Er:case uh:case Ii:return{byteLength:2,components:1};case ol:case al:return{byteLength:2,components:4};case xi:case rl:case yi:return{byteLength:4,components:1};case dh:case fh:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?ft("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function hf(){let i=null,e=!1,t=null,n=null;function s(r,o){t(r,o),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function dm(i){let e=new WeakMap;function t(a,c){let l=a.array,d=a.usage,f=l.byteLength,h=i.createBuffer();i.bindBuffer(c,h),i.bufferData(c,l,d),a.onUploadCallback();let u;if(l instanceof Float32Array)u=i.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)u=i.HALF_FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?u=i.HALF_FLOAT:u=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)u=i.SHORT;else if(l instanceof Uint32Array)u=i.UNSIGNED_INT;else if(l instanceof Int32Array)u=i.INT;else if(l instanceof Int8Array)u=i.BYTE;else if(l instanceof Uint8Array)u=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)u=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:h,type:u,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,c,l){let d=c.array,f=c.updateRanges;if(i.bindBuffer(l,a),f.length===0)i.bufferSubData(l,0,d);else{f.sort((u,_)=>u.start-_.start);let h=0;for(let u=1;u<f.length;u++){let _=f[h],y=f[u];y.start<=_.start+_.count+1?_.count=Math.max(_.count,y.start+y.count-_.start):(++h,f[h]=y)}f.length=h+1;for(let u=0,_=f.length;u<_;u++){let y=f[u];i.bufferSubData(l,y.start*d.BYTES_PER_ELEMENT,d,y.start,y.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let c=e.get(a);c&&(i.deleteBuffer(c.buffer),e.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let d=e.get(a);(!d||d.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let l=e.get(a);if(l===void 0)e.set(a,t(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,a,c),l.version=a.version}}return{get:s,remove:r,update:o}}var fm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,pm=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,mm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,gm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,_m=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,xm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ym=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,vm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,bm=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Mm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Sm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Em=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,wm=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Tm=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Am=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Rm=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Cm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Pm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Im=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Lm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Dm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Nm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Um=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Fm=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Om=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Bm=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,zm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,km=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Vm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Hm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Gm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Wm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Xm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,qm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Ym=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,$m=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Zm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Jm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Km=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,jm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Qm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,e0=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,t0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,n0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,i0=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,s0=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,r0=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,o0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,a0=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,l0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,c0=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,h0=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,u0=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,d0=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,f0=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,p0=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,m0=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,g0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,_0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,x0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,y0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,v0=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,b0=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,M0=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,S0=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,E0=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,w0=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,T0=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,A0=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,R0=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,C0=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,P0=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,I0=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,L0=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,D0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,N0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,U0=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,F0=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,O0=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,B0=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,z0=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,k0=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,V0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,H0=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,G0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,W0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,X0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,q0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Y0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,$0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Z0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,J0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,K0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,j0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Q0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,eg=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,tg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,ng=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,ig=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,sg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,rg=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,og=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,ag=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,lg=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,cg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,hg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,ug=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,dg=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,fg=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,pg=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,mg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,gg=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_g=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,xg=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,yg=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,vg=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,bg=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Mg=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Sg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Eg=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wg=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Tg=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ag=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Rg=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Cg=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Pg=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ig=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Lg=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Dg=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Ng=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Ug=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Fg=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Og=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Bg=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zg=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,kg=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Vg=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Hg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Gg=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Wg=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xg=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,qg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Et={alphahash_fragment:fm,alphahash_pars_fragment:pm,alphamap_fragment:mm,alphamap_pars_fragment:gm,alphatest_fragment:_m,alphatest_pars_fragment:xm,aomap_fragment:ym,aomap_pars_fragment:vm,batching_pars_vertex:bm,batching_vertex:Mm,begin_vertex:Sm,beginnormal_vertex:Em,bsdfs:wm,iridescence_fragment:Tm,bumpmap_pars_fragment:Am,clipping_planes_fragment:Rm,clipping_planes_pars_fragment:Cm,clipping_planes_pars_vertex:Pm,clipping_planes_vertex:Im,color_fragment:Lm,color_pars_fragment:Dm,color_pars_vertex:Nm,color_vertex:Um,common:Fm,cube_uv_reflection_fragment:Om,defaultnormal_vertex:Bm,displacementmap_pars_vertex:zm,displacementmap_vertex:km,emissivemap_fragment:Vm,emissivemap_pars_fragment:Hm,colorspace_fragment:Gm,colorspace_pars_fragment:Wm,envmap_fragment:Xm,envmap_common_pars_fragment:qm,envmap_pars_fragment:Ym,envmap_pars_vertex:$m,envmap_physical_pars_fragment:r0,envmap_vertex:Zm,fog_vertex:Jm,fog_pars_vertex:Km,fog_fragment:jm,fog_pars_fragment:Qm,gradientmap_pars_fragment:e0,lightmap_pars_fragment:t0,lights_lambert_fragment:n0,lights_lambert_pars_fragment:i0,lights_pars_begin:s0,lights_toon_fragment:o0,lights_toon_pars_fragment:a0,lights_phong_fragment:l0,lights_phong_pars_fragment:c0,lights_physical_fragment:h0,lights_physical_pars_fragment:u0,lights_fragment_begin:d0,lights_fragment_maps:f0,lights_fragment_end:p0,lightprobes_pars_fragment:m0,logdepthbuf_fragment:g0,logdepthbuf_pars_fragment:_0,logdepthbuf_pars_vertex:x0,logdepthbuf_vertex:y0,map_fragment:v0,map_pars_fragment:b0,map_particle_fragment:M0,map_particle_pars_fragment:S0,metalnessmap_fragment:E0,metalnessmap_pars_fragment:w0,morphinstance_vertex:T0,morphcolor_vertex:A0,morphnormal_vertex:R0,morphtarget_pars_vertex:C0,morphtarget_vertex:P0,normal_fragment_begin:I0,normal_fragment_maps:L0,normal_pars_fragment:D0,normal_pars_vertex:N0,normal_vertex:U0,normalmap_pars_fragment:F0,clearcoat_normal_fragment_begin:O0,clearcoat_normal_fragment_maps:B0,clearcoat_pars_fragment:z0,iridescence_pars_fragment:k0,opaque_fragment:V0,packing:H0,premultiplied_alpha_fragment:G0,project_vertex:W0,dithering_fragment:X0,dithering_pars_fragment:q0,roughnessmap_fragment:Y0,roughnessmap_pars_fragment:$0,shadowmap_pars_fragment:Z0,shadowmap_pars_vertex:J0,shadowmap_vertex:K0,shadowmask_pars_fragment:j0,skinbase_vertex:Q0,skinning_pars_vertex:eg,skinning_vertex:tg,skinnormal_vertex:ng,specularmap_fragment:ig,specularmap_pars_fragment:sg,tonemapping_fragment:rg,tonemapping_pars_fragment:og,transmission_fragment:ag,transmission_pars_fragment:lg,uv_pars_fragment:cg,uv_pars_vertex:hg,uv_vertex:ug,worldpos_vertex:dg,background_vert:fg,background_frag:pg,backgroundCube_vert:mg,backgroundCube_frag:gg,cube_vert:_g,cube_frag:xg,depth_vert:yg,depth_frag:vg,distance_vert:bg,distance_frag:Mg,equirect_vert:Sg,equirect_frag:Eg,linedashed_vert:wg,linedashed_frag:Tg,meshbasic_vert:Ag,meshbasic_frag:Rg,meshlambert_vert:Cg,meshlambert_frag:Pg,meshmatcap_vert:Ig,meshmatcap_frag:Lg,meshnormal_vert:Dg,meshnormal_frag:Ng,meshphong_vert:Ug,meshphong_frag:Fg,meshphysical_vert:Og,meshphysical_frag:Bg,meshtoon_vert:zg,meshtoon_frag:kg,points_vert:Vg,points_frag:Hg,shadow_vert:Gg,shadow_frag:Wg,sprite_vert:Xg,sprite_frag:qg},Qe={common:{diffuse:{value:new _t(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new vt},alphaMap:{value:null},alphaMapTransform:{value:new vt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new vt}},envmap:{envMap:{value:null},envMapRotation:{value:new vt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new vt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new vt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new vt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new vt},normalScale:{value:new ze(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new vt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new vt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new vt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new vt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new _t(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new _t(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new vt},alphaTest:{value:0},uvTransform:{value:new vt}},sprite:{diffuse:{value:new _t(16777215)},opacity:{value:1},center:{value:new ze(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new vt},alphaMap:{value:null},alphaMapTransform:{value:new vt},alphaTest:{value:0}}},Di={basic:{uniforms:An([Qe.common,Qe.specularmap,Qe.envmap,Qe.aomap,Qe.lightmap,Qe.fog]),vertexShader:Et.meshbasic_vert,fragmentShader:Et.meshbasic_frag},lambert:{uniforms:An([Qe.common,Qe.specularmap,Qe.envmap,Qe.aomap,Qe.lightmap,Qe.emissivemap,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,Qe.fog,Qe.lights,{emissive:{value:new _t(0)},envMapIntensity:{value:1}}]),vertexShader:Et.meshlambert_vert,fragmentShader:Et.meshlambert_frag},phong:{uniforms:An([Qe.common,Qe.specularmap,Qe.envmap,Qe.aomap,Qe.lightmap,Qe.emissivemap,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,Qe.fog,Qe.lights,{emissive:{value:new _t(0)},specular:{value:new _t(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Et.meshphong_vert,fragmentShader:Et.meshphong_frag},standard:{uniforms:An([Qe.common,Qe.envmap,Qe.aomap,Qe.lightmap,Qe.emissivemap,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,Qe.roughnessmap,Qe.metalnessmap,Qe.fog,Qe.lights,{emissive:{value:new _t(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Et.meshphysical_vert,fragmentShader:Et.meshphysical_frag},toon:{uniforms:An([Qe.common,Qe.aomap,Qe.lightmap,Qe.emissivemap,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,Qe.gradientmap,Qe.fog,Qe.lights,{emissive:{value:new _t(0)}}]),vertexShader:Et.meshtoon_vert,fragmentShader:Et.meshtoon_frag},matcap:{uniforms:An([Qe.common,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,Qe.fog,{matcap:{value:null}}]),vertexShader:Et.meshmatcap_vert,fragmentShader:Et.meshmatcap_frag},points:{uniforms:An([Qe.points,Qe.fog]),vertexShader:Et.points_vert,fragmentShader:Et.points_frag},dashed:{uniforms:An([Qe.common,Qe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Et.linedashed_vert,fragmentShader:Et.linedashed_frag},depth:{uniforms:An([Qe.common,Qe.displacementmap]),vertexShader:Et.depth_vert,fragmentShader:Et.depth_frag},normal:{uniforms:An([Qe.common,Qe.bumpmap,Qe.normalmap,Qe.displacementmap,{opacity:{value:1}}]),vertexShader:Et.meshnormal_vert,fragmentShader:Et.meshnormal_frag},sprite:{uniforms:An([Qe.sprite,Qe.fog]),vertexShader:Et.sprite_vert,fragmentShader:Et.sprite_frag},background:{uniforms:{uvTransform:{value:new vt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Et.background_vert,fragmentShader:Et.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new vt}},vertexShader:Et.backgroundCube_vert,fragmentShader:Et.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Et.cube_vert,fragmentShader:Et.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Et.equirect_vert,fragmentShader:Et.equirect_frag},distance:{uniforms:An([Qe.common,Qe.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Et.distance_vert,fragmentShader:Et.distance_frag},shadow:{uniforms:An([Qe.lights,Qe.fog,{color:{value:new _t(0)},opacity:{value:1}}]),vertexShader:Et.shadow_vert,fragmentShader:Et.shadow_frag}};Di.physical={uniforms:An([Di.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new vt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new vt},clearcoatNormalScale:{value:new ze(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new vt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new vt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new vt},sheen:{value:0},sheenColor:{value:new _t(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new vt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new vt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new vt},transmissionSamplerSize:{value:new ze},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new vt},attenuationDistance:{value:0},attenuationColor:{value:new _t(0)},specularColor:{value:new _t(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new vt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new vt},anisotropyVector:{value:new ze},anisotropyMap:{value:null},anisotropyMapTransform:{value:new vt}}]),vertexShader:Et.meshphysical_vert,fragmentShader:Et.meshphysical_frag};var Wl={r:0,b:0,g:0},Yg=new Wt,uf=new vt;uf.set(-1,0,0,0,1,0,0,0,1);function $g(i,e,t,n,s,r){let o=new _t(0),a=s===!0?0:1,c,l,d=null,f=0,h=null;function u(S){let E=S.isScene===!0?S.background:null;if(E&&E.isTexture){let b=S.backgroundBlurriness>0;E=e.get(E,b)}return E}function _(S){let E=!1,b=u(S);b===null?g(o,a):b&&b.isColor&&(g(b,1),E=!0);let I=i.xr.getEnvironmentBlendMode();I==="additive"?t.buffers.color.setClear(0,0,0,1,r):I==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||E)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function y(S,E){let b=u(E);b&&(b.isCubeTexture||b.mapping===Mo)?(l===void 0&&(l=new kt(new bn(1,1,1),new Yn({name:"BackgroundCubeMaterial",uniforms:ks(Di.backgroundCube.uniforms),vertexShader:Di.backgroundCube.vertexShader,fragmentShader:Di.backgroundCube.fragmentShader,side:Dn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(I,A,F){this.matrixWorld.copyPosition(F.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=b,l.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Yg.makeRotationFromEuler(E.backgroundRotation)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(uf),l.material.toneMapped=Ct.getTransfer(b.colorSpace)!==zt,(d!==b||f!==b.version||h!==i.toneMapping)&&(l.material.needsUpdate=!0,d=b,f=b.version,h=i.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null)):b&&b.isTexture&&(c===void 0&&(c=new kt(new us(2,2),new Yn({name:"BackgroundMaterial",uniforms:ks(Di.background.uniforms),vertexShader:Di.background.vertexShader,fragmentShader:Di.background.fragmentShader,side:$i,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=b,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.toneMapped=Ct.getTransfer(b.colorSpace)!==zt,b.matrixAutoUpdate===!0&&b.updateMatrix(),c.material.uniforms.uvTransform.value.copy(b.matrix),(d!==b||f!==b.version||h!==i.toneMapping)&&(c.material.needsUpdate=!0,d=b,f=b.version,h=i.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null))}function g(S,E){S.getRGB(Wl,bh(i)),t.buffers.color.setClear(Wl.r,Wl.g,Wl.b,E,r)}function p(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(S,E=1){o.set(S),a=E,g(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(S){a=S,g(o,a)},render:_,addToRenderList:y,dispose:p}}function Zg(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=h(null),r=s,o=!1;function a(U,B,re,se,Z){let ee=!1,ae=f(U,se,re,B);r!==ae&&(r=ae,l(r.object)),ee=u(U,se,re,Z),ee&&_(U,se,re,Z),Z!==null&&e.update(Z,i.ELEMENT_ARRAY_BUFFER),(ee||o)&&(o=!1,b(U,B,re,se),Z!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(Z).buffer))}function c(){return i.createVertexArray()}function l(U){return i.bindVertexArray(U)}function d(U){return i.deleteVertexArray(U)}function f(U,B,re,se){let Z=se.wireframe===!0,ee=n[B.id];ee===void 0&&(ee={},n[B.id]=ee);let ae=U.isInstancedMesh===!0?U.id:0,ye=ee[ae];ye===void 0&&(ye={},ee[ae]=ye);let be=ye[re.id];be===void 0&&(be={},ye[re.id]=be);let O=be[Z];return O===void 0&&(O=h(c()),be[Z]=O),O}function h(U){let B=[],re=[],se=[];for(let Z=0;Z<t;Z++)B[Z]=0,re[Z]=0,se[Z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:B,enabledAttributes:re,attributeDivisors:se,object:U,attributes:{},index:null}}function u(U,B,re,se){let Z=r.attributes,ee=B.attributes,ae=0,ye=re.getAttributes();for(let be in ye)if(ye[be].location>=0){let z=Z[be],ne=ee[be];if(ne===void 0&&(be==="instanceMatrix"&&U.instanceMatrix&&(ne=U.instanceMatrix),be==="instanceColor"&&U.instanceColor&&(ne=U.instanceColor)),z===void 0||z.attribute!==ne||ne&&z.data!==ne.data)return!0;ae++}return r.attributesNum!==ae||r.index!==se}function _(U,B,re,se){let Z={},ee=B.attributes,ae=0,ye=re.getAttributes();for(let be in ye)if(ye[be].location>=0){let z=ee[be];z===void 0&&(be==="instanceMatrix"&&U.instanceMatrix&&(z=U.instanceMatrix),be==="instanceColor"&&U.instanceColor&&(z=U.instanceColor));let ne={};ne.attribute=z,z&&z.data&&(ne.data=z.data),Z[be]=ne,ae++}r.attributes=Z,r.attributesNum=ae,r.index=se}function y(){let U=r.newAttributes;for(let B=0,re=U.length;B<re;B++)U[B]=0}function g(U){p(U,0)}function p(U,B){let re=r.newAttributes,se=r.enabledAttributes,Z=r.attributeDivisors;re[U]=1,se[U]===0&&(i.enableVertexAttribArray(U),se[U]=1),Z[U]!==B&&(i.vertexAttribDivisor(U,B),Z[U]=B)}function S(){let U=r.newAttributes,B=r.enabledAttributes;for(let re=0,se=B.length;re<se;re++)B[re]!==U[re]&&(i.disableVertexAttribArray(re),B[re]=0)}function E(U,B,re,se,Z,ee,ae){ae===!0?i.vertexAttribIPointer(U,B,re,Z,ee):i.vertexAttribPointer(U,B,re,se,Z,ee)}function b(U,B,re,se){y();let Z=se.attributes,ee=re.getAttributes(),ae=B.defaultAttributeValues;for(let ye in ee){let be=ee[ye];if(be.location>=0){let O=Z[ye];if(O===void 0&&(ye==="instanceMatrix"&&U.instanceMatrix&&(O=U.instanceMatrix),ye==="instanceColor"&&U.instanceColor&&(O=U.instanceColor)),O!==void 0){let z=O.normalized,ne=O.itemSize,_e=e.get(O);if(_e===void 0)continue;let Fe=_e.buffer,Ye=_e.type,me=_e.bytesPerElement,V=Ye===i.INT||Ye===i.UNSIGNED_INT||O.gpuType===rl;if(O.isInterleavedBufferAttribute){let ge=O.data,j=ge.stride,Te=O.offset;if(ge.isInstancedInterleavedBuffer){for(let we=0;we<be.locationSize;we++)p(be.location+we,ge.meshPerAttribute);U.isInstancedMesh!==!0&&se._maxInstanceCount===void 0&&(se._maxInstanceCount=ge.meshPerAttribute*ge.count)}else for(let we=0;we<be.locationSize;we++)g(be.location+we);i.bindBuffer(i.ARRAY_BUFFER,Fe);for(let we=0;we<be.locationSize;we++)E(be.location+we,ne/be.locationSize,Ye,z,j*me,(Te+ne/be.locationSize*we)*me,V)}else{if(O.isInstancedBufferAttribute){for(let ge=0;ge<be.locationSize;ge++)p(be.location+ge,O.meshPerAttribute);U.isInstancedMesh!==!0&&se._maxInstanceCount===void 0&&(se._maxInstanceCount=O.meshPerAttribute*O.count)}else for(let ge=0;ge<be.locationSize;ge++)g(be.location+ge);i.bindBuffer(i.ARRAY_BUFFER,Fe);for(let ge=0;ge<be.locationSize;ge++)E(be.location+ge,ne/be.locationSize,Ye,z,ne*me,ne/be.locationSize*ge*me,V)}}else if(ae!==void 0){let z=ae[ye];if(z!==void 0)switch(z.length){case 2:i.vertexAttrib2fv(be.location,z);break;case 3:i.vertexAttrib3fv(be.location,z);break;case 4:i.vertexAttrib4fv(be.location,z);break;default:i.vertexAttrib1fv(be.location,z)}}}}S()}function I(){w();for(let U in n){let B=n[U];for(let re in B){let se=B[re];for(let Z in se){let ee=se[Z];for(let ae in ee)d(ee[ae].object),delete ee[ae];delete se[Z]}}delete n[U]}}function A(U){if(n[U.id]===void 0)return;let B=n[U.id];for(let re in B){let se=B[re];for(let Z in se){let ee=se[Z];for(let ae in ee)d(ee[ae].object),delete ee[ae];delete se[Z]}}delete n[U.id]}function F(U){for(let B in n){let re=n[B];for(let se in re){let Z=re[se];if(Z[U.id]===void 0)continue;let ee=Z[U.id];for(let ae in ee)d(ee[ae].object),delete ee[ae];delete Z[U.id]}}}function m(U){for(let B in n){let re=n[B],se=U.isInstancedMesh===!0?U.id:0,Z=re[se];if(Z!==void 0){for(let ee in Z){let ae=Z[ee];for(let ye in ae)d(ae[ye].object),delete ae[ye];delete Z[ee]}delete re[se],Object.keys(re).length===0&&delete n[B]}}}function w(){T(),o=!0,r!==s&&(r=s,l(r.object))}function T(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:w,resetDefaultState:T,dispose:I,releaseStatesOfGeometry:A,releaseStatesOfObject:m,releaseStatesOfProgram:F,initAttributes:y,enableAttribute:g,disableUnusedAttributes:S}}function Jg(i,e,t){let n;function s(c){n=c}function r(c,l){i.drawArrays(n,c,l),t.update(l,n,1)}function o(c,l,d){d!==0&&(i.drawArraysInstanced(n,c,l,d),t.update(l,n,d))}function a(c,l,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,l,0,d);let h=0;for(let u=0;u<d;u++)h+=l[u];t.update(h,n,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Kg(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){let F=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(F.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(F){return!(F!==ii&&n.convert(F)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(F){let m=F===Ii&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(F!==Fn&&n.convert(F)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&F!==yi&&!m)}function c(F){if(F==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";F="mediump"}return F==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp",d=c(l);d!==l&&(ft("WebGLRenderer:",l,"not supported, using",d,"instead."),l=d);let f=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&ft("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let u=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=i.getParameter(i.MAX_TEXTURE_SIZE),g=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),S=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),E=i.getParameter(i.MAX_VARYING_VECTORS),b=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),I=i.getParameter(i.MAX_SAMPLES),A=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:u,maxVertexTextures:_,maxTextureSize:y,maxCubemapSize:g,maxAttributes:p,maxVertexUniforms:S,maxVaryings:E,maxFragmentUniforms:b,maxSamples:I,samples:A}}function jg(i){let e=this,t=null,n=0,s=!1,r=!1,o=new En,a=new vt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let u=f.length!==0||h||n!==0||s;return s=h,n=f.length,u},this.beginShadows=function(){r=!0,d(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,h){t=d(f,h,0)},this.setState=function(f,h,u){let _=f.clippingPlanes,y=f.clipIntersection,g=f.clipShadows,p=i.get(f);if(!s||_===null||_.length===0||r&&!g)r?d(null):l();else{let S=r?0:n,E=S*4,b=p.clippingState||null;c.value=b,b=d(_,h,E,u);for(let I=0;I!==E;++I)b[I]=t[I];p.clippingState=b,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=S}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function d(f,h,u,_){let y=f!==null?f.length:0,g=null;if(y!==0){if(g=c.value,_!==!0||g===null){let p=u+y*4,S=h.matrixWorldInverse;a.getNormalMatrix(S),(g===null||g.length<p)&&(g=new Float32Array(p));for(let E=0,b=u;E!==y;++E,b+=4)o.copy(f[E]).applyMatrix4(S,a),o.normal.toArray(g,b),g[b+3]=o.constant}c.value=g,c.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,g}}var Ms=4,Vd=[.125,.215,.35,.446,.526,.582],Vs=20,Qg=256,Po=new ms,Hd=new _t,Ph=null,Ih=0,Lh=0,Dh=!1,e_=new L,ql=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){let{size:o=256,position:a=e_}=r;Ph=this._renderer.getRenderTarget(),Ih=this._renderer.getActiveCubeFace(),Lh=this._renderer.getActiveMipmapLevel(),Dh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(e,n,s,c,a),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Xd(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Wd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Ph,Ih,Lh),this._renderer.xr.enabled=Dh,e.scissorTest=!1,Tr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===xs||e.mapping===Bs?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ph=this._renderer.getRenderTarget(),Ih=this._renderer.getActiveCubeFace(),Lh=this._renderer.getActiveMipmapLevel(),Dh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:yn,minFilter:yn,generateMipmaps:!1,type:Ii,format:ii,colorSpace:Kr,depthBuffer:!1},s=Gd(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Gd(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=t_(r)),this._blurMaterial=i_(r,e,t),this._ggxMaterial=n_(r,e,t)}return s}_compileMaterial(e){let t=new kt(new Tn,e);this._renderer.compile(t,Po)}_sceneToCubeUV(e,t,n,s,r){let c=new an(90,1,t,n),l=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,u=f.toneMapping;f.getClearColor(Hd),f.toneMapping=_i,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new kt(new bn,new pi({name:"PMREM.Background",side:Dn,depthWrite:!1,depthTest:!1})));let y=this._backgroundBox,g=y.material,p=!1,S=e.background;S?S.isColor&&(g.color.copy(S),e.background=null,p=!0):(g.color.copy(Hd),p=!0);for(let E=0;E<6;E++){let b=E%3;b===0?(c.up.set(0,l[E],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x+d[E],r.y,r.z)):b===1?(c.up.set(0,0,l[E]),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y+d[E],r.z)):(c.up.set(0,l[E],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y,r.z+d[E]));let I=this._cubeSize;Tr(s,b*I,E>2?I:0,I,I),f.setRenderTarget(s),p&&f.render(y,c),f.render(e,c)}f.toneMapping=u,f.autoClear=h,e.background=S}_textureToCubeUV(e,t){let n=this._renderer,s=e.mapping===xs||e.mapping===Bs;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Xd()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Wd());let r=s?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=e;let c=this._cubeSize;Tr(t,0,0,3*c,2*c),n.setRenderTarget(t),n.render(o,Po)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let s=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let c=o.uniforms,l=n/(this._lodMeshes.length-1),d=t/(this._lodMeshes.length-1),f=Math.sqrt(l*l-d*d),h=0+l*1.25,u=f*h,{_lodMax:_}=this,y=this._sizeLods[n],g=3*y*(n>_-Ms?n-_+Ms:0),p=4*(this._cubeSize-y);c.envMap.value=e.texture,c.roughness.value=u,c.mipInt.value=_-t,Tr(r,g,p,3*y,2*y),s.setRenderTarget(r),s.render(a,Po),c.envMap.value=r.texture,c.roughness.value=0,c.mipInt.value=_-n,Tr(e,g,p,3*y,2*y),s.setRenderTarget(e),s.render(a,Po)}_blur(e,t,n,s,r){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,n,s,"latitudinal",r),this._halfBlur(o,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,o,a){let c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&mt("blur direction must be either latitudinal or longitudinal!");let d=3,f=this._lodMeshes[s];f.material=l;let h=l.uniforms,u=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*u):2*Math.PI/(2*Vs-1),y=r/_,g=isFinite(r)?1+Math.floor(d*y):Vs;g>Vs&&ft(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${Vs}`);let p=[],S=0;for(let F=0;F<Vs;++F){let m=F/y,w=Math.exp(-m*m/2);p.push(w),F===0?S+=w:F<g&&(S+=2*w)}for(let F=0;F<p.length;F++)p[F]=p[F]/S;h.envMap.value=e.texture,h.samples.value=g,h.weights.value=p,h.latitudinal.value=o==="latitudinal",a&&(h.poleAxis.value=a);let{_lodMax:E}=this;h.dTheta.value=_,h.mipInt.value=E-n;let b=this._sizeLods[s],I=3*b*(s>E-Ms?s-E+Ms:0),A=4*(this._cubeSize-b);Tr(t,I,A,3*b,2*b),c.setRenderTarget(t),c.render(f,Po)}};function t_(i){let e=[],t=[],n=[],s=i,r=i-Ms+1+Vd.length;for(let o=0;o<r;o++){let a=Math.pow(2,s);e.push(a);let c=1/a;o>i-Ms?c=Vd[o-i+Ms-1]:o===0&&(c=0),t.push(c);let l=1/(a-2),d=-l,f=1+l,h=[d,d,f,d,f,f,d,d,f,f,d,f],u=6,_=6,y=3,g=2,p=1,S=new Float32Array(y*_*u),E=new Float32Array(g*_*u),b=new Float32Array(p*_*u);for(let A=0;A<u;A++){let F=A%3*2/3-1,m=A>2?0:-1,w=[F,m,0,F+2/3,m,0,F+2/3,m+1,0,F,m,0,F+2/3,m+1,0,F,m+1,0];S.set(w,y*_*A),E.set(h,g*_*A);let T=[A,A,A,A,A,A];b.set(T,p*_*A)}let I=new Tn;I.setAttribute("position",new Wn(S,y)),I.setAttribute("uv",new Wn(E,g)),I.setAttribute("faceIndex",new Wn(b,p)),n.push(new kt(I,null)),s>Ms&&s--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function Gd(i,e,t){let n=new Xn(i,e,t);return n.texture.mapping=Mo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Tr(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function n_(i,e,t){return new Yn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Qg,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:$l(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Pi,depthTest:!1,depthWrite:!1})}function i_(i,e,t){let n=new Float32Array(Vs),s=new L(0,1,0);return new Yn({name:"SphericalGaussianBlur",defines:{n:Vs,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:$l(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Pi,depthTest:!1,depthWrite:!1})}function Wd(){return new Yn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:$l(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Pi,depthTest:!1,depthWrite:!1})}function Xd(){return new Yn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:$l(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Pi,depthTest:!1,depthWrite:!1})}function $l(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var Yl=class extends Xn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new so(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new bn(5,5,5),r=new Yn({name:"CubemapFromEquirect",uniforms:ks(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Dn,blending:Pi});r.uniforms.tEquirect.value=t;let o=new kt(s,r),a=t.minFilter;return t.minFilter===ys&&(t.minFilter=yn),new ja(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,s);e.setRenderTarget(r)}};function s_(i){let e=new WeakMap,t=new WeakMap,n=null;function s(h,u=!1){return h==null?null:u?o(h):r(h)}function r(h){if(h&&h.isTexture){let u=h.mapping;if(u===nl||u===il)if(e.has(h)){let _=e.get(h).texture;return a(_,h.mapping)}else{let _=h.image;if(_&&_.height>0){let y=new Yl(_.height);return y.fromEquirectangularTexture(i,h),e.set(h,y),h.addEventListener("dispose",l),a(y.texture,h.mapping)}else return null}}return h}function o(h){if(h&&h.isTexture){let u=h.mapping,_=u===nl||u===il,y=u===xs||u===Bs;if(_||y){let g=t.get(h),p=g!==void 0?g.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p)return n===null&&(n=new ql(i)),g=_?n.fromEquirectangular(h,g):n.fromCubemap(h,g),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),g.texture;if(g!==void 0)return g.texture;{let S=h.image;return _&&S&&S.height>0||y&&S&&c(S)?(n===null&&(n=new ql(i)),g=_?n.fromEquirectangular(h):n.fromCubemap(h),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),h.addEventListener("dispose",d),g.texture):null}}}return h}function a(h,u){return u===nl?h.mapping=xs:u===il&&(h.mapping=Bs),h}function c(h){let u=0,_=6;for(let y=0;y<_;y++)h[y]!==void 0&&u++;return u===_}function l(h){let u=h.target;u.removeEventListener("dispose",l);let _=e.get(u);_!==void 0&&(e.delete(u),_.dispose())}function d(h){let u=h.target;u.removeEventListener("dispose",d);let _=t.get(u);_!==void 0&&(t.delete(u),_.dispose())}function f(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:f}}function r_(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let s=t(n);return s===null&&Ls("WebGLRenderer: "+n+" extension not supported."),s}}}function o_(i,e,t,n){let s={},r=new WeakMap;function o(f){let h=f.target;h.index!==null&&e.remove(h.index);for(let _ in h.attributes)e.remove(h.attributes[_]);h.removeEventListener("dispose",o),delete s[h.id];let u=r.get(h);u&&(e.remove(u),r.delete(h)),n.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function a(f,h){return s[h.id]===!0||(h.addEventListener("dispose",o),s[h.id]=!0,t.memory.geometries++),h}function c(f){let h=f.attributes;for(let u in h)e.update(h[u],i.ARRAY_BUFFER)}function l(f){let h=[],u=f.index,_=f.attributes.position,y=0;if(_===void 0)return;if(u!==null){let S=u.array;y=u.version;for(let E=0,b=S.length;E<b;E+=3){let I=S[E+0],A=S[E+1],F=S[E+2];h.push(I,A,A,F,F,I)}}else{let S=_.array;y=_.version;for(let E=0,b=S.length/3-1;E<b;E+=3){let I=E+0,A=E+1,F=E+2;h.push(I,A,A,F,F,I)}}let g=new(_.count>=65535?no:to)(h,1);g.version=y;let p=r.get(f);p&&e.remove(p),r.set(f,g)}function d(f){let h=r.get(f);if(h){let u=f.index;u!==null&&h.version<u.version&&l(f)}else l(f);return r.get(f)}return{get:a,update:c,getWireframeAttribute:d}}function a_(i,e,t){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function c(f,h){i.drawElements(n,h,r,f*o),t.update(h,n,1)}function l(f,h,u){u!==0&&(i.drawElementsInstanced(n,h,r,f*o,u),t.update(h,n,u))}function d(f,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,h,0,r,f,0,u);let y=0;for(let g=0;g<u;g++)y+=h[g];t.update(y,n,1)}this.setMode=s,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=d}function l_(i){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case i.TRIANGLES:t.triangles+=a*(r/3);break;case i.LINES:t.lines+=a*(r/2);break;case i.LINE_STRIP:t.lines+=a*(r-1);break;case i.LINE_LOOP:t.lines+=a*r;break;case i.POINTS:t.points+=a*r;break;default:mt("WebGLInfo: Unknown draw mode:",o);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function c_(i,e,t){let n=new WeakMap,s=new Kt;function r(o,a,c){let l=o.morphTargetInfluences,d=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=d!==void 0?d.length:0,h=n.get(a);if(h===void 0||h.count!==f){let w=function(){F.dispose(),n.delete(a),a.removeEventListener("dispose",w)};h!==void 0&&h.texture.dispose();let u=a.morphAttributes.position!==void 0,_=a.morphAttributes.normal!==void 0,y=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],S=a.morphAttributes.color||[],E=0;u===!0&&(E=1),_===!0&&(E=2),y===!0&&(E=3);let b=a.attributes.position.count*E,I=1;b>e.maxTextureSize&&(I=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);let A=new Float32Array(b*I*4*f),F=new Qr(A,b,I,f);F.type=yi,F.needsUpdate=!0;let m=E*4;for(let T=0;T<f;T++){let U=g[T],B=p[T],re=S[T],se=b*I*4*T;for(let Z=0;Z<U.count;Z++){let ee=Z*m;u===!0&&(s.fromBufferAttribute(U,Z),A[se+ee+0]=s.x,A[se+ee+1]=s.y,A[se+ee+2]=s.z,A[se+ee+3]=0),_===!0&&(s.fromBufferAttribute(B,Z),A[se+ee+4]=s.x,A[se+ee+5]=s.y,A[se+ee+6]=s.z,A[se+ee+7]=0),y===!0&&(s.fromBufferAttribute(re,Z),A[se+ee+8]=s.x,A[se+ee+9]=s.y,A[se+ee+10]=s.z,A[se+ee+11]=re.itemSize===4?s.w:1)}}h={count:f,texture:F,size:new ze(b,I)},n.set(a,h),a.addEventListener("dispose",w)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",o.morphTexture,t);else{let u=0;for(let y=0;y<l.length;y++)u+=l[y];let _=a.morphTargetsRelative?1:1-u;c.getUniforms().setValue(i,"morphTargetBaseInfluence",_),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",h.texture,t),c.getUniforms().setValue(i,"morphTargetsTextureSize",h.size)}return{update:r}}function h_(i,e,t,n,s){let r=new WeakMap;function o(l){let d=s.render.frame,f=l.geometry,h=e.get(l,f);if(r.get(h)!==d&&(e.update(h),r.set(h,d)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),r.get(l)!==d&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),r.set(l,d))),l.isSkinnedMesh){let u=l.skeleton;r.get(u)!==d&&(u.update(),r.set(u,d))}return h}function a(){r=new WeakMap}function c(l){let d=l.target;d.removeEventListener("dispose",c),n.releaseStatesOfObject(d),t.remove(d.instanceMatrix),d.instanceColor!==null&&t.remove(d.instanceColor)}return{update:o,dispose:a}}var u_={[ih]:"LINEAR_TONE_MAPPING",[sh]:"REINHARD_TONE_MAPPING",[rh]:"CINEON_TONE_MAPPING",[Ki]:"ACES_FILMIC_TONE_MAPPING",[ah]:"AGX_TONE_MAPPING",[lh]:"NEUTRAL_TONE_MAPPING",[oh]:"CUSTOM_TONE_MAPPING"};function d_(i,e,t,n,s,r){let o=new Xn(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new Ji(e,t):void 0}),a=new Xn(e,t,{type:Ii,depthBuffer:!1,stencilBuffer:!1}),c=new Tn;c.setAttribute("position",new nn([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new nn([0,2,0,0,2,0],2));let l=new za({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new kt(c,l),f=new ms(-1,1,1,-1,0,1),h=null,u=null,_=!1,y,g=null,p=[],S=!1;this.setSize=function(E,b){o.setSize(E,b),a.setSize(E,b);for(let I=0;I<p.length;I++){let A=p[I];A.setSize&&A.setSize(E,b)}},this.setEffects=function(E){p=E,S=p.length>0&&p[0].isRenderPass===!0;let b=o.width,I=o.height;for(let A=0;A<p.length;A++){let F=p[A];F.setSize&&F.setSize(b,I)}},this.begin=function(E,b){if(_||E.toneMapping===_i&&p.length===0)return!1;if(g=b,b!==null){let I=b.width,A=b.height;(o.width!==I||o.height!==A)&&this.setSize(I,A)}return S===!1&&E.setRenderTarget(o),y=E.toneMapping,E.toneMapping=_i,!0},this.hasRenderPass=function(){return S},this.end=function(E,b){E.toneMapping=y,_=!0;let I=o,A=a;for(let F=0;F<p.length;F++){let m=p[F];if(m.enabled!==!1&&(m.render(E,A,I,b),m.needsSwap!==!1)){let w=I;I=A,A=w}}if(h!==E.outputColorSpace||u!==E.toneMapping){h=E.outputColorSpace,u=E.toneMapping,l.defines={},Ct.getTransfer(h)===zt&&(l.defines.SRGB_TRANSFER="");let F=u_[u];F&&(l.defines[F]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=I.texture,E.setRenderTarget(g),E.render(d,f),g=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),c.dispose(),l.dispose()}}var df=new wn,Fh=new Ji(1,1),ff=new Qr,pf=new Aa,mf=new so,qd=[],Yd=[],$d=new Float32Array(16),Zd=new Float32Array(9),Jd=new Float32Array(4);function Rr(i,e,t){let n=i[0];if(n<=0||n>0)return i;let s=e*t,r=qd[s];if(r===void 0&&(r=new Float32Array(s),qd[s]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,i[o].toArray(r,a)}return r}function ln(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function cn(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Zl(i,e){let t=Yd[e];t===void 0&&(t=new Int32Array(e),Yd[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function f_(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function p_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ln(t,e))return;i.uniform2fv(this.addr,e),cn(t,e)}}function m_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(ln(t,e))return;i.uniform3fv(this.addr,e),cn(t,e)}}function g_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ln(t,e))return;i.uniform4fv(this.addr,e),cn(t,e)}}function __(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(ln(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),cn(t,e)}else{if(ln(t,n))return;Jd.set(n),i.uniformMatrix2fv(this.addr,!1,Jd),cn(t,n)}}function x_(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(ln(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),cn(t,e)}else{if(ln(t,n))return;Zd.set(n),i.uniformMatrix3fv(this.addr,!1,Zd),cn(t,n)}}function y_(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(ln(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),cn(t,e)}else{if(ln(t,n))return;$d.set(n),i.uniformMatrix4fv(this.addr,!1,$d),cn(t,n)}}function v_(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function b_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ln(t,e))return;i.uniform2iv(this.addr,e),cn(t,e)}}function M_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ln(t,e))return;i.uniform3iv(this.addr,e),cn(t,e)}}function S_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ln(t,e))return;i.uniform4iv(this.addr,e),cn(t,e)}}function E_(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function w_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ln(t,e))return;i.uniform2uiv(this.addr,e),cn(t,e)}}function T_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ln(t,e))return;i.uniform3uiv(this.addr,e),cn(t,e)}}function A_(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ln(t,e))return;i.uniform4uiv(this.addr,e),cn(t,e)}}function R_(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Fh.compareFunction=t.isReversedDepthBuffer()?Gl:Hl,r=Fh):r=df,t.setTexture2D(e||r,s)}function C_(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||pf,s)}function P_(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||mf,s)}function I_(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||ff,s)}function L_(i){switch(i){case 5126:return f_;case 35664:return p_;case 35665:return m_;case 35666:return g_;case 35674:return __;case 35675:return x_;case 35676:return y_;case 5124:case 35670:return v_;case 35667:case 35671:return b_;case 35668:case 35672:return M_;case 35669:case 35673:return S_;case 5125:return E_;case 36294:return w_;case 36295:return T_;case 36296:return A_;case 35678:case 36198:case 36298:case 36306:case 35682:return R_;case 35679:case 36299:case 36307:return C_;case 35680:case 36300:case 36308:case 36293:return P_;case 36289:case 36303:case 36311:case 36292:return I_}}function D_(i,e){i.uniform1fv(this.addr,e)}function N_(i,e){let t=Rr(e,this.size,2);i.uniform2fv(this.addr,t)}function U_(i,e){let t=Rr(e,this.size,3);i.uniform3fv(this.addr,t)}function F_(i,e){let t=Rr(e,this.size,4);i.uniform4fv(this.addr,t)}function O_(i,e){let t=Rr(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function B_(i,e){let t=Rr(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function z_(i,e){let t=Rr(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function k_(i,e){i.uniform1iv(this.addr,e)}function V_(i,e){i.uniform2iv(this.addr,e)}function H_(i,e){i.uniform3iv(this.addr,e)}function G_(i,e){i.uniform4iv(this.addr,e)}function W_(i,e){i.uniform1uiv(this.addr,e)}function X_(i,e){i.uniform2uiv(this.addr,e)}function q_(i,e){i.uniform3uiv(this.addr,e)}function Y_(i,e){i.uniform4uiv(this.addr,e)}function $_(i,e,t){let n=this.cache,s=e.length,r=Zl(t,s);ln(n,r)||(i.uniform1iv(this.addr,r),cn(n,r));let o;this.type===i.SAMPLER_2D_SHADOW?o=Fh:o=df;for(let a=0;a!==s;++a)t.setTexture2D(e[a]||o,r[a])}function Z_(i,e,t){let n=this.cache,s=e.length,r=Zl(t,s);ln(n,r)||(i.uniform1iv(this.addr,r),cn(n,r));for(let o=0;o!==s;++o)t.setTexture3D(e[o]||pf,r[o])}function J_(i,e,t){let n=this.cache,s=e.length,r=Zl(t,s);ln(n,r)||(i.uniform1iv(this.addr,r),cn(n,r));for(let o=0;o!==s;++o)t.setTextureCube(e[o]||mf,r[o])}function K_(i,e,t){let n=this.cache,s=e.length,r=Zl(t,s);ln(n,r)||(i.uniform1iv(this.addr,r),cn(n,r));for(let o=0;o!==s;++o)t.setTexture2DArray(e[o]||ff,r[o])}function j_(i){switch(i){case 5126:return D_;case 35664:return N_;case 35665:return U_;case 35666:return F_;case 35674:return O_;case 35675:return B_;case 35676:return z_;case 5124:case 35670:return k_;case 35667:case 35671:return V_;case 35668:case 35672:return H_;case 35669:case 35673:return G_;case 5125:return W_;case 36294:return X_;case 36295:return q_;case 36296:return Y_;case 35678:case 36198:case 36298:case 36306:case 35682:return $_;case 35679:case 36299:case 36307:return Z_;case 35680:case 36300:case 36308:case 36293:return J_;case 36289:case 36303:case 36311:case 36292:return K_}}var Oh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=L_(t.type)}},Bh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=j_(t.type)}},zh=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(e,t[a.id],n)}}},Nh=/(\w+)(\])?(\[|\.)?/g;function Kd(i,e){i.seq.push(e),i.map[e.id]=e}function Q_(i,e,t){let n=i.name,s=n.length;for(Nh.lastIndex=0;;){let r=Nh.exec(n),o=Nh.lastIndex,a=r[1],c=r[2]==="]",l=r[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===s){Kd(t,l===void 0?new Oh(a,i,e):new Bh(a,i,e));break}else{let f=t.map[a];f===void 0&&(f=new zh(a),Kd(t,f)),t=f}}}var Ar=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=e.getActiveUniform(t,o),c=e.getUniformLocation(t,a.name);Q_(a,c,this)}let s=[],r=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){let r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){let s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,o=t.length;r!==o;++r){let a=t[r],c=n[a.id];c.needsUpdate!==!1&&a.setValue(e,c.value,s)}}static seqWithValue(e,t){let n=[];for(let s=0,r=e.length;s!==r;++s){let o=e[s];o.id in t&&n.push(o)}return n}};function jd(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var ex=37297,tx=0;function nx(i,e){let t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=s;o<r;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var Qd=new vt;function ix(i){Ct._getMatrix(Qd,Ct.workingColorSpace,i);let e=`mat3( ${Qd.elements.map(t=>t.toFixed(4))} )`;switch(Ct.getTransfer(i)){case jr:return[e,"LinearTransferOETF"];case zt:return[e,"sRGBTransferOETF"];default:return ft("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function ef(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+nx(i.getShaderSource(e),a)}else return r}function sx(i,e){let t=ix(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var rx={[ih]:"Linear",[sh]:"Reinhard",[rh]:"Cineon",[Ki]:"ACESFilmic",[ah]:"AgX",[lh]:"Neutral",[oh]:"Custom"};function ox(i,e){let t=rx[e];return t===void 0?(ft("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Xl=new L;function ax(){Ct.getLuminanceCoefficients(Xl);let i=Xl.x.toFixed(4),e=Xl.y.toFixed(4),t=Xl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function lx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Lo).join(`
`)}function cx(i){let e=[];for(let t in i){let n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function hx(i,e){let t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(e,s),o=r.name,a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:i.getAttribLocation(e,o),locationSize:a}}return t}function Lo(i){return i!==""}function tf(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function nf(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var ux=/^[ \t]*#include +<([\w\d./]+)>/gm;function kh(i){return i.replace(ux,fx)}var dx=new Map;function fx(i,e){let t=Et[e];if(t===void 0){let n=dx.get(e);if(n!==void 0)t=Et[n],ft('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return kh(t)}var px=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function sf(i){return i.replace(px,mx)}function mx(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function rf(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var gx={[gi]:"SHADOWMAP_TYPE_PCF",[Sr]:"SHADOWMAP_TYPE_VSM"};function _x(i){return gx[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var xx={[xs]:"ENVMAP_TYPE_CUBE",[Bs]:"ENVMAP_TYPE_CUBE",[Mo]:"ENVMAP_TYPE_CUBE_UV"};function yx(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":xx[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var vx={[Bs]:"ENVMAP_MODE_REFRACTION"};function bx(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":vx[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Mx={[nh]:"ENVMAP_BLENDING_MULTIPLY",[yd]:"ENVMAP_BLENDING_MIX",[vd]:"ENVMAP_BLENDING_ADD"};function Sx(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Mx[i.combine]||"ENVMAP_BLENDING_NONE"}function Ex(i){let e=i.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function wx(i,e,t,n){let s=i.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,c=_x(t),l=yx(t),d=bx(t),f=Sx(t),h=Ex(t),u=lx(t),_=cx(r),y=s.createProgram(),g,p,S=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Lo).join(`
`),g.length>0&&(g+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Lo).join(`
`),p.length>0&&(p+=`
`)):(g=[rf(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Lo).join(`
`),p=[rf(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+d:"",t.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==_i?"#define TONE_MAPPING":"",t.toneMapping!==_i?Et.tonemapping_pars_fragment:"",t.toneMapping!==_i?ox("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Et.colorspace_pars_fragment,sx("linearToOutputTexel",t.outputColorSpace),ax(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Lo).join(`
`)),o=kh(o),o=tf(o,t),o=nf(o,t),a=kh(a),a=tf(a,t),a=nf(a,t),o=sf(o),a=sf(a),t.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,g=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,p=["#define varying in",t.glslVersion===_h?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===_h?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let E=S+g+o,b=S+p+a,I=jd(s,s.VERTEX_SHADER,E),A=jd(s,s.FRAGMENT_SHADER,b);s.attachShader(y,I),s.attachShader(y,A),t.index0AttributeName!==void 0?s.bindAttribLocation(y,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(y,0,"position"),s.linkProgram(y);function F(U){if(i.debug.checkShaderErrors){let B=s.getProgramInfoLog(y)||"",re=s.getShaderInfoLog(I)||"",se=s.getShaderInfoLog(A)||"",Z=B.trim(),ee=re.trim(),ae=se.trim(),ye=!0,be=!0;if(s.getProgramParameter(y,s.LINK_STATUS)===!1)if(ye=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,y,I,A);else{let O=ef(s,I,"vertex"),z=ef(s,A,"fragment");mt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(y,s.VALIDATE_STATUS)+`

Material Name: `+U.name+`
Material Type: `+U.type+`

Program Info Log: `+Z+`
`+O+`
`+z)}else Z!==""?ft("WebGLProgram: Program Info Log:",Z):(ee===""||ae==="")&&(be=!1);be&&(U.diagnostics={runnable:ye,programLog:Z,vertexShader:{log:ee,prefix:g},fragmentShader:{log:ae,prefix:p}})}s.deleteShader(I),s.deleteShader(A),m=new Ar(s,y),w=hx(s,y)}let m;this.getUniforms=function(){return m===void 0&&F(this),m};let w;this.getAttributes=function(){return w===void 0&&F(this),w};let T=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return T===!1&&(T=s.getProgramParameter(y,ex)),T},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(y),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=tx++,this.cacheKey=e,this.usedTimes=1,this.program=y,this.vertexShader=I,this.fragmentShader=A,this}var Tx=0,Vh=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Hh(e),t.set(e,n)),n}},Hh=class{constructor(e){this.id=Tx++,this.code=e,this.usedTimes=0}};function Ax(i){return i===bs||i===Ro||i===Co}function Rx(i,e,t,n,s,r){let o=new fr,a=new Vh,c=new Set,l=[],d=new Map,f=n.logarithmicDepthBuffer,h=n.precision,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(m){return c.add(m),m===0?"uv":`uv${m}`}function y(m,w,T,U,B,re){let se=U.fog,Z=B.geometry,ee=m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial?U.environment:null,ae=m.isMeshStandardMaterial||m.isMeshLambertMaterial&&!m.envMap||m.isMeshPhongMaterial&&!m.envMap,ye=e.get(m.envMap||ee,ae),be=ye&&ye.mapping===Mo?ye.image.height:null,O=u[m.type];m.precision!==null&&(h=n.getMaxPrecision(m.precision),h!==m.precision&&ft("WebGLProgram.getParameters:",m.precision,"not supported, using",h,"instead."));let z=Z.morphAttributes.position||Z.morphAttributes.normal||Z.morphAttributes.color,ne=z!==void 0?z.length:0,_e=0;Z.morphAttributes.position!==void 0&&(_e=1),Z.morphAttributes.normal!==void 0&&(_e=2),Z.morphAttributes.color!==void 0&&(_e=3);let Fe,Ye,me,V;if(O){let Oe=Di[O];Fe=Oe.vertexShader,Ye=Oe.fragmentShader}else{Fe=m.vertexShader,Ye=m.fragmentShader;let Oe=a.getVertexShaderStage(m),yt=a.getFragmentShaderStage(m);a.update(m,Oe,yt),me=Oe.id,V=yt.id}let ge=i.getRenderTarget(),j=i.state.buffers.depth.getReversed(),Te=B.isInstancedMesh===!0,we=B.isBatchedMesh===!0,Re=!!m.map,Le=!!m.matcap,q=!!ye,he=!!m.aoMap,Me=!!m.lightMap,Ae=!!m.bumpMap&&m.wireframe===!1,Be=!!m.normalMap,ke=!!m.displacementMap,qe=!!m.emissiveMap,$e=!!m.metalnessMap,it=!!m.roughnessMap,X=m.anisotropy>0,gt=m.clearcoat>0,ot=m.dispersion>0,R=m.iridescence>0,x=m.sheen>0,Q=m.transmission>0,ue=X&&!!m.anisotropyMap,xe=gt&&!!m.clearcoatMap,Pe=gt&&!!m.clearcoatNormalMap,Ue=gt&&!!m.clearcoatRoughnessMap,fe=R&&!!m.iridescenceMap,ve=R&&!!m.iridescenceThicknessMap,C=x&&!!m.sheenColorMap,Y=x&&!!m.sheenRoughnessMap,W=!!m.specularMap,K=!!m.specularColorMap,Ie=!!m.specularIntensityMap,Ve=Q&&!!m.transmissionMap,Ge=Q&&!!m.thicknessMap,H=!!m.gradientMap,De=!!m.alphaMap,N=m.alphaTest>0,G=!!m.alphaHash,Se=!!m.extensions,J=_i;m.toneMapped&&(ge===null||ge.isXRRenderTarget===!0)&&(J=i.toneMapping);let He={shaderID:O,shaderType:m.type,shaderName:m.name,vertexShader:Fe,fragmentShader:Ye,defines:m.defines,customVertexShaderID:me,customFragmentShaderID:V,isRawShaderMaterial:m.isRawShaderMaterial===!0,glslVersion:m.glslVersion,precision:h,batching:we,batchingColor:we&&B._colorsTexture!==null,instancing:Te,instancingColor:Te&&B.instanceColor!==null,instancingMorph:Te&&B.morphTexture!==null,outputColorSpace:ge===null?i.outputColorSpace:ge.isXRRenderTarget===!0?ge.texture.colorSpace:Ct.workingColorSpace,alphaToCoverage:!!m.alphaToCoverage,map:Re,matcap:Le,envMap:q,envMapMode:q&&ye.mapping,envMapCubeUVHeight:be,aoMap:he,lightMap:Me,bumpMap:Ae,normalMap:Be,displacementMap:ke,emissiveMap:qe,normalMapObjectSpace:Be&&m.normalMapType===Sd,normalMapTangentSpace:Be&&m.normalMapType===Vl,packedNormalMap:Be&&m.normalMapType===Vl&&Ax(m.normalMap.format),metalnessMap:$e,roughnessMap:it,anisotropy:X,anisotropyMap:ue,clearcoat:gt,clearcoatMap:xe,clearcoatNormalMap:Pe,clearcoatRoughnessMap:Ue,dispersion:ot,iridescence:R,iridescenceMap:fe,iridescenceThicknessMap:ve,sheen:x,sheenColorMap:C,sheenRoughnessMap:Y,specularMap:W,specularColorMap:K,specularIntensityMap:Ie,transmission:Q,transmissionMap:Ve,thicknessMap:Ge,gradientMap:H,opaque:m.transparent===!1&&m.blending===Ds&&m.alphaToCoverage===!1,alphaMap:De,alphaTest:N,alphaHash:G,combine:m.combine,mapUv:Re&&_(m.map.channel),aoMapUv:he&&_(m.aoMap.channel),lightMapUv:Me&&_(m.lightMap.channel),bumpMapUv:Ae&&_(m.bumpMap.channel),normalMapUv:Be&&_(m.normalMap.channel),displacementMapUv:ke&&_(m.displacementMap.channel),emissiveMapUv:qe&&_(m.emissiveMap.channel),metalnessMapUv:$e&&_(m.metalnessMap.channel),roughnessMapUv:it&&_(m.roughnessMap.channel),anisotropyMapUv:ue&&_(m.anisotropyMap.channel),clearcoatMapUv:xe&&_(m.clearcoatMap.channel),clearcoatNormalMapUv:Pe&&_(m.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Ue&&_(m.clearcoatRoughnessMap.channel),iridescenceMapUv:fe&&_(m.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&_(m.iridescenceThicknessMap.channel),sheenColorMapUv:C&&_(m.sheenColorMap.channel),sheenRoughnessMapUv:Y&&_(m.sheenRoughnessMap.channel),specularMapUv:W&&_(m.specularMap.channel),specularColorMapUv:K&&_(m.specularColorMap.channel),specularIntensityMapUv:Ie&&_(m.specularIntensityMap.channel),transmissionMapUv:Ve&&_(m.transmissionMap.channel),thicknessMapUv:Ge&&_(m.thicknessMap.channel),alphaMapUv:De&&_(m.alphaMap.channel),vertexTangents:!!Z.attributes.tangent&&(Be||X),vertexNormals:!!Z.attributes.normal,vertexColors:m.vertexColors,vertexAlphas:m.vertexColors===!0&&!!Z.attributes.color&&Z.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!Z.attributes.uv&&(Re||De),fog:!!se,useFog:m.fog===!0,fogExp2:!!se&&se.isFogExp2,flatShading:m.wireframe===!1&&(m.flatShading===!0||Z.attributes.normal===void 0&&Be===!1&&(m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshStandardMaterial||m.isMeshPhysicalMaterial)),sizeAttenuation:m.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:j,skinning:B.isSkinnedMesh===!0,hasPositionAttribute:Z.attributes.position!==void 0,morphTargets:Z.morphAttributes.position!==void 0,morphNormals:Z.morphAttributes.normal!==void 0,morphColors:Z.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:_e,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:re.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:m.dithering,shadowMapEnabled:i.shadowMap.enabled&&T.length>0,shadowMapType:i.shadowMap.type,toneMapping:J,decodeVideoTexture:Re&&m.map.isVideoTexture===!0&&Ct.getTransfer(m.map.colorSpace)===zt,decodeVideoTextureEmissive:qe&&m.emissiveMap.isVideoTexture===!0&&Ct.getTransfer(m.emissiveMap.colorSpace)===zt,premultipliedAlpha:m.premultipliedAlpha,doubleSided:m.side===Ci,flipSided:m.side===Dn,useDepthPacking:m.depthPacking>=0,depthPacking:m.depthPacking||0,index0AttributeName:m.index0AttributeName,extensionClipCullDistance:Se&&m.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Se&&m.extensions.multiDraw===!0||we)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:m.customProgramCacheKey()};return He.vertexUv1s=c.has(1),He.vertexUv2s=c.has(2),He.vertexUv3s=c.has(3),c.clear(),He}function g(m){let w=[];if(m.shaderID?w.push(m.shaderID):(w.push(m.customVertexShaderID),w.push(m.customFragmentShaderID)),m.defines!==void 0)for(let T in m.defines)w.push(T),w.push(m.defines[T]);return m.isRawShaderMaterial===!1&&(p(w,m),S(w,m),w.push(i.outputColorSpace)),w.push(m.customProgramCacheKey),w.join()}function p(m,w){m.push(w.precision),m.push(w.outputColorSpace),m.push(w.envMapMode),m.push(w.envMapCubeUVHeight),m.push(w.mapUv),m.push(w.alphaMapUv),m.push(w.lightMapUv),m.push(w.aoMapUv),m.push(w.bumpMapUv),m.push(w.normalMapUv),m.push(w.displacementMapUv),m.push(w.emissiveMapUv),m.push(w.metalnessMapUv),m.push(w.roughnessMapUv),m.push(w.anisotropyMapUv),m.push(w.clearcoatMapUv),m.push(w.clearcoatNormalMapUv),m.push(w.clearcoatRoughnessMapUv),m.push(w.iridescenceMapUv),m.push(w.iridescenceThicknessMapUv),m.push(w.sheenColorMapUv),m.push(w.sheenRoughnessMapUv),m.push(w.specularMapUv),m.push(w.specularColorMapUv),m.push(w.specularIntensityMapUv),m.push(w.transmissionMapUv),m.push(w.thicknessMapUv),m.push(w.combine),m.push(w.fogExp2),m.push(w.sizeAttenuation),m.push(w.morphTargetsCount),m.push(w.morphAttributeCount),m.push(w.numDirLights),m.push(w.numPointLights),m.push(w.numSpotLights),m.push(w.numSpotLightMaps),m.push(w.numHemiLights),m.push(w.numRectAreaLights),m.push(w.numDirLightShadows),m.push(w.numPointLightShadows),m.push(w.numSpotLightShadows),m.push(w.numSpotLightShadowsWithMaps),m.push(w.numLightProbes),m.push(w.shadowMapType),m.push(w.toneMapping),m.push(w.numClippingPlanes),m.push(w.numClipIntersection),m.push(w.depthPacking)}function S(m,w){o.disableAll(),w.instancing&&o.enable(0),w.instancingColor&&o.enable(1),w.instancingMorph&&o.enable(2),w.matcap&&o.enable(3),w.envMap&&o.enable(4),w.normalMapObjectSpace&&o.enable(5),w.normalMapTangentSpace&&o.enable(6),w.clearcoat&&o.enable(7),w.iridescence&&o.enable(8),w.alphaTest&&o.enable(9),w.vertexColors&&o.enable(10),w.vertexAlphas&&o.enable(11),w.vertexUv1s&&o.enable(12),w.vertexUv2s&&o.enable(13),w.vertexUv3s&&o.enable(14),w.vertexTangents&&o.enable(15),w.anisotropy&&o.enable(16),w.alphaHash&&o.enable(17),w.batching&&o.enable(18),w.dispersion&&o.enable(19),w.batchingColor&&o.enable(20),w.gradientMap&&o.enable(21),w.packedNormalMap&&o.enable(22),w.vertexNormals&&o.enable(23),m.push(o.mask),o.disableAll(),w.fog&&o.enable(0),w.useFog&&o.enable(1),w.flatShading&&o.enable(2),w.logarithmicDepthBuffer&&o.enable(3),w.reversedDepthBuffer&&o.enable(4),w.skinning&&o.enable(5),w.morphTargets&&o.enable(6),w.morphNormals&&o.enable(7),w.morphColors&&o.enable(8),w.premultipliedAlpha&&o.enable(9),w.shadowMapEnabled&&o.enable(10),w.doubleSided&&o.enable(11),w.flipSided&&o.enable(12),w.useDepthPacking&&o.enable(13),w.dithering&&o.enable(14),w.transmission&&o.enable(15),w.sheen&&o.enable(16),w.opaque&&o.enable(17),w.pointsUvs&&o.enable(18),w.decodeVideoTexture&&o.enable(19),w.decodeVideoTextureEmissive&&o.enable(20),w.alphaToCoverage&&o.enable(21),w.numLightProbeGrids>0&&o.enable(22),w.hasPositionAttribute&&o.enable(23),m.push(o.mask)}function E(m){let w=u[m.type],T;if(w){let U=Di[w];T=zd.clone(U.uniforms)}else T=m.uniforms;return T}function b(m,w){let T=d.get(w);return T!==void 0?++T.usedTimes:(T=new wx(i,w,m,s),l.push(T),d.set(w,T)),T}function I(m){if(--m.usedTimes===0){let w=l.indexOf(m);l[w]=l[l.length-1],l.pop(),d.delete(m.cacheKey),m.destroy()}}function A(m){a.remove(m)}function F(){a.dispose()}return{getParameters:y,getProgramCacheKey:g,getUniforms:E,acquireProgram:b,releaseProgram:I,releaseShaderCache:A,programs:l,dispose:F}}function Cx(){let i=new WeakMap;function e(o){return i.has(o)}function t(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,c){i.get(o)[a]=c}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function Px(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function of(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function af(){let i=[],e=0,t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function o(h){let u=0;return h.isInstancedMesh&&(u+=2),h.isSkinnedMesh&&(u+=1),u}function a(h,u,_,y,g,p){let S=i[e];return S===void 0?(S={id:h.id,object:h,geometry:u,material:_,materialVariant:o(h),groupOrder:y,renderOrder:h.renderOrder,z:g,group:p},i[e]=S):(S.id=h.id,S.object=h,S.geometry=u,S.material=_,S.materialVariant=o(h),S.groupOrder=y,S.renderOrder=h.renderOrder,S.z=g,S.group=p),e++,S}function c(h,u,_,y,g,p){let S=a(h,u,_,y,g,p);_.transmission>0?n.push(S):_.transparent===!0?s.push(S):t.push(S)}function l(h,u,_,y,g,p){let S=a(h,u,_,y,g,p);_.transmission>0?n.unshift(S):_.transparent===!0?s.unshift(S):t.unshift(S)}function d(h,u,_){t.length>1&&t.sort(h||Px),n.length>1&&n.sort(u||of),s.length>1&&s.sort(u||of),_&&(t.reverse(),n.reverse(),s.reverse())}function f(){for(let h=e,u=i.length;h<u;h++){let _=i[h];if(_.id===null)break;_.id=null,_.object=null,_.geometry=null,_.material=null,_.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:c,unshift:l,finish:f,sort:d}}function Ix(){let i=new WeakMap;function e(n,s){let r=i.get(n),o;return r===void 0?(o=new af,i.set(n,[o])):s>=r.length?(o=new af,r.push(o)):o=r[s],o}function t(){i=new WeakMap}return{get:e,dispose:t}}function Lx(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new L,color:new _t};break;case"SpotLight":t={position:new L,direction:new L,color:new _t,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new L,color:new _t,distance:0,decay:0};break;case"HemisphereLight":t={direction:new L,skyColor:new _t,groundColor:new _t};break;case"RectAreaLight":t={color:new _t,position:new L,halfWidth:new L,halfHeight:new L};break}return i[e.id]=t,t}}}function Dx(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}var Nx=0;function Ux(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Fx(i){let e=new Lx,t=Dx(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new L);let s=new L,r=new Wt,o=new Wt;function a(l){let d=0,f=0,h=0;for(let w=0;w<9;w++)n.probe[w].set(0,0,0);let u=0,_=0,y=0,g=0,p=0,S=0,E=0,b=0,I=0,A=0,F=0;l.sort(Ux);for(let w=0,T=l.length;w<T;w++){let U=l[w],B=U.color,re=U.intensity,se=U.distance,Z=null;if(U.shadow&&U.shadow.map&&(U.shadow.map.texture.format===bs?Z=U.shadow.map.texture:Z=U.shadow.map.depthTexture||U.shadow.map.texture),U.isAmbientLight)d+=B.r*re,f+=B.g*re,h+=B.b*re;else if(U.isLightProbe){for(let ee=0;ee<9;ee++)n.probe[ee].addScaledVector(U.sh.coefficients[ee],re);F++}else if(U.isDirectionalLight){let ee=e.get(U);if(ee.color.copy(U.color).multiplyScalar(U.intensity),U.castShadow){let ae=U.shadow,ye=t.get(U);ye.shadowIntensity=ae.intensity,ye.shadowBias=ae.bias,ye.shadowNormalBias=ae.normalBias,ye.shadowRadius=ae.radius,ye.shadowMapSize=ae.mapSize,n.directionalShadow[u]=ye,n.directionalShadowMap[u]=Z,n.directionalShadowMatrix[u]=U.shadow.matrix,S++}n.directional[u]=ee,u++}else if(U.isSpotLight){let ee=e.get(U);ee.position.setFromMatrixPosition(U.matrixWorld),ee.color.copy(B).multiplyScalar(re),ee.distance=se,ee.coneCos=Math.cos(U.angle),ee.penumbraCos=Math.cos(U.angle*(1-U.penumbra)),ee.decay=U.decay,n.spot[y]=ee;let ae=U.shadow;if(U.map&&(n.spotLightMap[I]=U.map,I++,ae.updateMatrices(U),U.castShadow&&A++),n.spotLightMatrix[y]=ae.matrix,U.castShadow){let ye=t.get(U);ye.shadowIntensity=ae.intensity,ye.shadowBias=ae.bias,ye.shadowNormalBias=ae.normalBias,ye.shadowRadius=ae.radius,ye.shadowMapSize=ae.mapSize,n.spotShadow[y]=ye,n.spotShadowMap[y]=Z,b++}y++}else if(U.isRectAreaLight){let ee=e.get(U);ee.color.copy(B).multiplyScalar(re),ee.halfWidth.set(U.width*.5,0,0),ee.halfHeight.set(0,U.height*.5,0),n.rectArea[g]=ee,g++}else if(U.isPointLight){let ee=e.get(U);if(ee.color.copy(U.color).multiplyScalar(U.intensity),ee.distance=U.distance,ee.decay=U.decay,U.castShadow){let ae=U.shadow,ye=t.get(U);ye.shadowIntensity=ae.intensity,ye.shadowBias=ae.bias,ye.shadowNormalBias=ae.normalBias,ye.shadowRadius=ae.radius,ye.shadowMapSize=ae.mapSize,ye.shadowCameraNear=ae.camera.near,ye.shadowCameraFar=ae.camera.far,n.pointShadow[_]=ye,n.pointShadowMap[_]=Z,n.pointShadowMatrix[_]=U.shadow.matrix,E++}n.point[_]=ee,_++}else if(U.isHemisphereLight){let ee=e.get(U);ee.skyColor.copy(U.color).multiplyScalar(re),ee.groundColor.copy(U.groundColor).multiplyScalar(re),n.hemi[p]=ee,p++}}g>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Qe.LTC_FLOAT_1,n.rectAreaLTC2=Qe.LTC_FLOAT_2):(n.rectAreaLTC1=Qe.LTC_HALF_1,n.rectAreaLTC2=Qe.LTC_HALF_2)),n.ambient[0]=d,n.ambient[1]=f,n.ambient[2]=h;let m=n.hash;(m.directionalLength!==u||m.pointLength!==_||m.spotLength!==y||m.rectAreaLength!==g||m.hemiLength!==p||m.numDirectionalShadows!==S||m.numPointShadows!==E||m.numSpotShadows!==b||m.numSpotMaps!==I||m.numLightProbes!==F)&&(n.directional.length=u,n.spot.length=y,n.rectArea.length=g,n.point.length=_,n.hemi.length=p,n.directionalShadow.length=S,n.directionalShadowMap.length=S,n.pointShadow.length=E,n.pointShadowMap.length=E,n.spotShadow.length=b,n.spotShadowMap.length=b,n.directionalShadowMatrix.length=S,n.pointShadowMatrix.length=E,n.spotLightMatrix.length=b+I-A,n.spotLightMap.length=I,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=F,m.directionalLength=u,m.pointLength=_,m.spotLength=y,m.rectAreaLength=g,m.hemiLength=p,m.numDirectionalShadows=S,m.numPointShadows=E,m.numSpotShadows=b,m.numSpotMaps=I,m.numLightProbes=F,n.version=Nx++)}function c(l,d){let f=0,h=0,u=0,_=0,y=0,g=d.matrixWorldInverse;for(let p=0,S=l.length;p<S;p++){let E=l[p];if(E.isDirectionalLight){let b=n.directional[f];b.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(g),f++}else if(E.isSpotLight){let b=n.spot[u];b.position.setFromMatrixPosition(E.matrixWorld),b.position.applyMatrix4(g),b.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(g),u++}else if(E.isRectAreaLight){let b=n.rectArea[_];b.position.setFromMatrixPosition(E.matrixWorld),b.position.applyMatrix4(g),o.identity(),r.copy(E.matrixWorld),r.premultiply(g),o.extractRotation(r),b.halfWidth.set(E.width*.5,0,0),b.halfHeight.set(0,E.height*.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),_++}else if(E.isPointLight){let b=n.point[h];b.position.setFromMatrixPosition(E.matrixWorld),b.position.applyMatrix4(g),h++}else if(E.isHemisphereLight){let b=n.hemi[y];b.direction.setFromMatrixPosition(E.matrixWorld),b.direction.transformDirection(g),y++}}}return{setup:a,setupView:c,state:n}}function lf(i){let e=new Fx(i),t=[],n=[],s=[];function r(h){f.camera=h,t.length=0,n.length=0,s.length=0}function o(h){t.push(h)}function a(h){n.push(h)}function c(h){s.push(h)}function l(){e.setup(t)}function d(h){e.setupView(t,h)}let f={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:l,setupLightsView:d,pushLight:o,pushShadow:a,pushLightProbeGrid:c}}function Ox(i){let e=new WeakMap;function t(s,r=0){let o=e.get(s),a;return o===void 0?(a=new lf(i),e.set(s,[a])):r>=o.length?(a=new lf(i),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var Bx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,zx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,kx=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],Vx=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],cf=new Wt,Io=new L,Uh=new L;function Hx(i,e,t){let n=new mr,s=new ze,r=new ze,o=new Kt,a=new ka,c=new Va,l={},d=t.maxTextureSize,f={[$i]:Dn,[Dn]:$i,[Ci]:Ci},h=new Yn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ze},radius:{value:4}},vertexShader:Bx,fragmentShader:zx}),u=h.clone();u.defines.HORIZONTAL_PASS=1;let _=new Tn;_.setAttribute("position",new Wn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new kt(_,h),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=gi;let p=this.type;this.render=function(A,F,m){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||A.length===0)return;this.type===tl&&(ft("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=gi);let w=i.getRenderTarget(),T=i.getActiveCubeFace(),U=i.getActiveMipmapLevel(),B=i.state;B.setBlending(Pi),B.buffers.depth.getReversed()===!0?B.buffers.color.setClear(0,0,0,0):B.buffers.color.setClear(1,1,1,1),B.buffers.depth.setTest(!0),B.setScissorTest(!1);let re=p!==this.type;re&&F.traverse(function(se){se.material&&(Array.isArray(se.material)?se.material.forEach(Z=>Z.needsUpdate=!0):se.material.needsUpdate=!0)});for(let se=0,Z=A.length;se<Z;se++){let ee=A[se],ae=ee.shadow;if(ae===void 0){ft("WebGLShadowMap:",ee,"has no shadow.");continue}if(ae.autoUpdate===!1&&ae.needsUpdate===!1)continue;s.copy(ae.mapSize);let ye=ae.getFrameExtents();s.multiply(ye),r.copy(ae.mapSize),(s.x>d||s.y>d)&&(s.x>d&&(r.x=Math.floor(d/ye.x),s.x=r.x*ye.x,ae.mapSize.x=r.x),s.y>d&&(r.y=Math.floor(d/ye.y),s.y=r.y*ye.y,ae.mapSize.y=r.y));let be=i.state.buffers.depth.getReversed();if(ae.camera._reversedDepth=be,ae.map===null||re===!0){if(ae.map!==null&&(ae.map.depthTexture!==null&&(ae.map.depthTexture.dispose(),ae.map.depthTexture=null),ae.map.dispose()),this.type===Sr){if(ee.isPointLight){ft("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}ae.map=new Xn(s.x,s.y,{format:bs,type:Ii,minFilter:yn,magFilter:yn,generateMipmaps:!1}),ae.map.texture.name=ee.name+".shadowMap",ae.map.depthTexture=new Ji(s.x,s.y,yi),ae.map.depthTexture.name=ee.name+".shadowMapDepth",ae.map.depthTexture.format=Ai,ae.map.depthTexture.compareFunction=null,ae.map.depthTexture.minFilter=Jt,ae.map.depthTexture.magFilter=Jt}else ee.isPointLight?(ae.map=new Yl(s.x),ae.map.depthTexture=new Ia(s.x,xi)):(ae.map=new Xn(s.x,s.y),ae.map.depthTexture=new Ji(s.x,s.y,xi)),ae.map.depthTexture.name=ee.name+".shadowMap",ae.map.depthTexture.format=Ai,this.type===gi?(ae.map.depthTexture.compareFunction=be?Gl:Hl,ae.map.depthTexture.minFilter=yn,ae.map.depthTexture.magFilter=yn):(ae.map.depthTexture.compareFunction=null,ae.map.depthTexture.minFilter=Jt,ae.map.depthTexture.magFilter=Jt);ae.camera.updateProjectionMatrix()}let O=ae.map.isWebGLCubeRenderTarget?6:1;for(let z=0;z<O;z++){if(ae.map.isWebGLCubeRenderTarget)i.setRenderTarget(ae.map,z),i.clear();else{z===0&&(i.setRenderTarget(ae.map),i.clear());let ne=ae.getViewport(z);o.set(r.x*ne.x,r.y*ne.y,r.x*ne.z,r.y*ne.w),B.viewport(o)}if(ee.isPointLight){let ne=ae.camera,_e=ae.matrix,Fe=ee.distance||ne.far;Fe!==ne.far&&(ne.far=Fe,ne.updateProjectionMatrix()),Io.setFromMatrixPosition(ee.matrixWorld),ne.position.copy(Io),Uh.copy(ne.position),Uh.add(kx[z]),ne.up.copy(Vx[z]),ne.lookAt(Uh),ne.updateMatrixWorld(),_e.makeTranslation(-Io.x,-Io.y,-Io.z),cf.multiplyMatrices(ne.projectionMatrix,ne.matrixWorldInverse),ae._frustum.setFromProjectionMatrix(cf,ne.coordinateSystem,ne.reversedDepth)}else ae.updateMatrices(ee);n=ae.getFrustum(),b(F,m,ae.camera,ee,this.type)}ae.isPointLightShadow!==!0&&this.type===Sr&&S(ae,m),ae.needsUpdate=!1}p=this.type,g.needsUpdate=!1,i.setRenderTarget(w,T,U)};function S(A,F){let m=e.update(y);h.defines.VSM_SAMPLES!==A.blurSamples&&(h.defines.VSM_SAMPLES=A.blurSamples,u.defines.VSM_SAMPLES=A.blurSamples,h.needsUpdate=!0,u.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Xn(s.x,s.y,{format:bs,type:Ii})),h.uniforms.shadow_pass.value=A.map.depthTexture,h.uniforms.resolution.value=A.mapSize,h.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(F,null,m,h,y,null),u.uniforms.shadow_pass.value=A.mapPass.texture,u.uniforms.resolution.value=A.mapSize,u.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(F,null,m,u,y,null)}function E(A,F,m,w){let T=null,U=m.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(U!==void 0)T=U;else if(T=m.isPointLight===!0?c:a,i.localClippingEnabled&&F.clipShadows===!0&&Array.isArray(F.clippingPlanes)&&F.clippingPlanes.length!==0||F.displacementMap&&F.displacementScale!==0||F.alphaMap&&F.alphaTest>0||F.map&&F.alphaTest>0||F.alphaToCoverage===!0){let B=T.uuid,re=F.uuid,se=l[B];se===void 0&&(se={},l[B]=se);let Z=se[re];Z===void 0&&(Z=T.clone(),se[re]=Z,F.addEventListener("dispose",I)),T=Z}if(T.visible=F.visible,T.wireframe=F.wireframe,w===Sr?T.side=F.shadowSide!==null?F.shadowSide:F.side:T.side=F.shadowSide!==null?F.shadowSide:f[F.side],T.alphaMap=F.alphaMap,T.alphaTest=F.alphaToCoverage===!0?.5:F.alphaTest,T.map=F.map,T.clipShadows=F.clipShadows,T.clippingPlanes=F.clippingPlanes,T.clipIntersection=F.clipIntersection,T.displacementMap=F.displacementMap,T.displacementScale=F.displacementScale,T.displacementBias=F.displacementBias,T.wireframeLinewidth=F.wireframeLinewidth,T.linewidth=F.linewidth,m.isPointLight===!0&&T.isMeshDistanceMaterial===!0){let B=i.properties.get(T);B.light=m}return T}function b(A,F,m,w,T){if(A.visible===!1)return;if(A.layers.test(F.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&T===Sr)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(m.matrixWorldInverse,A.matrixWorld);let re=e.update(A),se=A.material;if(Array.isArray(se)){let Z=re.groups;for(let ee=0,ae=Z.length;ee<ae;ee++){let ye=Z[ee],be=se[ye.materialIndex];if(be&&be.visible){let O=E(A,be,w,T);A.onBeforeShadow(i,A,F,m,re,O,ye),i.renderBufferDirect(m,null,re,O,A,ye),A.onAfterShadow(i,A,F,m,re,O,ye)}}}else if(se.visible){let Z=E(A,se,w,T);A.onBeforeShadow(i,A,F,m,re,Z,null),i.renderBufferDirect(m,null,re,Z,A,null),A.onAfterShadow(i,A,F,m,re,Z,null)}}let B=A.children;for(let re=0,se=B.length;re<se;re++)b(B[re],F,m,w,T)}function I(A){A.target.removeEventListener("dispose",I);for(let m in l){let w=l[m],T=A.target.uuid;T in w&&(w[T].dispose(),delete w[T])}}}function Gx(i,e){function t(){let H=!1,De=new Kt,N=null,G=new Kt(0,0,0,0);return{setMask:function(Se){N!==Se&&!H&&(i.colorMask(Se,Se,Se,Se),N=Se)},setLocked:function(Se){H=Se},setClear:function(Se,J,He,Oe,yt){yt===!0&&(Se*=Oe,J*=Oe,He*=Oe),De.set(Se,J,He,Oe),G.equals(De)===!1&&(i.clearColor(Se,J,He,Oe),G.copy(De))},reset:function(){H=!1,N=null,G.set(-1,0,0,0)}}}function n(){let H=!1,De=!1,N=null,G=null,Se=null;return{setReversed:function(J){if(De!==J){let He=e.get("EXT_clip_control");J?He.clipControlEXT(He.LOWER_LEFT_EXT,He.ZERO_TO_ONE_EXT):He.clipControlEXT(He.LOWER_LEFT_EXT,He.NEGATIVE_ONE_TO_ONE_EXT),De=J;let Oe=Se;Se=null,this.setClear(Oe)}},getReversed:function(){return De},setTest:function(J){J?ge(i.DEPTH_TEST):j(i.DEPTH_TEST)},setMask:function(J){N!==J&&!H&&(i.depthMask(J),N=J)},setFunc:function(J){if(De&&(J=Dd[J]),G!==J){switch(J){case ma:i.depthFunc(i.NEVER);break;case ga:i.depthFunc(i.ALWAYS);break;case _a:i.depthFunc(i.LESS);break;case Ns:i.depthFunc(i.LEQUAL);break;case xa:i.depthFunc(i.EQUAL);break;case ya:i.depthFunc(i.GEQUAL);break;case va:i.depthFunc(i.GREATER);break;case ba:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}G=J}},setLocked:function(J){H=J},setClear:function(J){Se!==J&&(Se=J,De&&(J=1-J),i.clearDepth(J))},reset:function(){H=!1,N=null,G=null,Se=null,De=!1}}}function s(){let H=!1,De=null,N=null,G=null,Se=null,J=null,He=null,Oe=null,yt=null;return{setTest:function(P){H||(P?ge(i.STENCIL_TEST):j(i.STENCIL_TEST))},setMask:function(P){De!==P&&!H&&(i.stencilMask(P),De=P)},setFunc:function(P,pt,en){(N!==P||G!==pt||Se!==en)&&(i.stencilFunc(P,pt,en),N=P,G=pt,Se=en)},setOp:function(P,pt,en){(J!==P||He!==pt||Oe!==en)&&(i.stencilOp(P,pt,en),J=P,He=pt,Oe=en)},setLocked:function(P){H=P},setClear:function(P){yt!==P&&(i.clearStencil(P),yt=P)},reset:function(){H=!1,De=null,N=null,G=null,Se=null,J=null,He=null,Oe=null,yt=null}}}let r=new t,o=new n,a=new s,c=new WeakMap,l=new WeakMap,d={},f={},h={},u=new WeakMap,_=[],y=null,g=!1,p=null,S=null,E=null,b=null,I=null,A=null,F=null,m=new _t(0,0,0),w=0,T=!1,U=null,B=null,re=null,se=null,Z=null,ee=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),ae=!1,ye=0,be=i.getParameter(i.VERSION);be.indexOf("WebGL")!==-1?(ye=parseFloat(/^WebGL (\d)/.exec(be)[1]),ae=ye>=1):be.indexOf("OpenGL ES")!==-1&&(ye=parseFloat(/^OpenGL ES (\d)/.exec(be)[1]),ae=ye>=2);let O=null,z={},ne=i.getParameter(i.SCISSOR_BOX),_e=i.getParameter(i.VIEWPORT),Fe=new Kt().fromArray(ne),Ye=new Kt().fromArray(_e);function me(H,De,N,G){let Se=new Uint8Array(4),J=i.createTexture();i.bindTexture(H,J),i.texParameteri(H,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(H,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let He=0;He<N;He++)H===i.TEXTURE_3D||H===i.TEXTURE_2D_ARRAY?i.texImage3D(De,0,i.RGBA,1,1,G,0,i.RGBA,i.UNSIGNED_BYTE,Se):i.texImage2D(De+He,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Se);return J}let V={};V[i.TEXTURE_2D]=me(i.TEXTURE_2D,i.TEXTURE_2D,1),V[i.TEXTURE_CUBE_MAP]=me(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),V[i.TEXTURE_2D_ARRAY]=me(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),V[i.TEXTURE_3D]=me(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ge(i.DEPTH_TEST),o.setFunc(Ns),Ae(!1),Be(jc),ge(i.CULL_FACE),he(Pi);function ge(H){d[H]!==!0&&(i.enable(H),d[H]=!0)}function j(H){d[H]!==!1&&(i.disable(H),d[H]=!1)}function Te(H,De){return h[H]!==De?(i.bindFramebuffer(H,De),h[H]=De,H===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=De),H===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=De),!0):!1}function we(H,De){let N=_,G=!1;if(H){N=u.get(De),N===void 0&&(N=[],u.set(De,N));let Se=H.textures;if(N.length!==Se.length||N[0]!==i.COLOR_ATTACHMENT0){for(let J=0,He=Se.length;J<He;J++)N[J]=i.COLOR_ATTACHMENT0+J;N.length=Se.length,G=!0}}else N[0]!==i.BACK&&(N[0]=i.BACK,G=!0);G&&i.drawBuffers(N)}function Re(H){return y!==H?(i.useProgram(H),y=H,!0):!1}let Le={[cs]:i.FUNC_ADD,[nd]:i.FUNC_SUBTRACT,[id]:i.FUNC_REVERSE_SUBTRACT};Le[sd]=i.MIN,Le[rd]=i.MAX;let q={[od]:i.ZERO,[ad]:i.ONE,[ld]:i.SRC_COLOR,[fa]:i.SRC_ALPHA,[pd]:i.SRC_ALPHA_SATURATE,[dd]:i.DST_COLOR,[hd]:i.DST_ALPHA,[cd]:i.ONE_MINUS_SRC_COLOR,[pa]:i.ONE_MINUS_SRC_ALPHA,[fd]:i.ONE_MINUS_DST_COLOR,[ud]:i.ONE_MINUS_DST_ALPHA,[md]:i.CONSTANT_COLOR,[gd]:i.ONE_MINUS_CONSTANT_COLOR,[_d]:i.CONSTANT_ALPHA,[xd]:i.ONE_MINUS_CONSTANT_ALPHA};function he(H,De,N,G,Se,J,He,Oe,yt,P){if(H===Pi){g===!0&&(j(i.BLEND),g=!1);return}if(g===!1&&(ge(i.BLEND),g=!0),H!==td){if(H!==p||P!==T){if((S!==cs||I!==cs)&&(i.blendEquation(i.FUNC_ADD),S=cs,I=cs),P)switch(H){case Ds:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Qc:i.blendFunc(i.ONE,i.ONE);break;case eh:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case th:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:mt("WebGLState: Invalid blending: ",H);break}else switch(H){case Ds:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Qc:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case eh:mt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case th:mt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:mt("WebGLState: Invalid blending: ",H);break}E=null,b=null,A=null,F=null,m.set(0,0,0),w=0,p=H,T=P}return}Se=Se||De,J=J||N,He=He||G,(De!==S||Se!==I)&&(i.blendEquationSeparate(Le[De],Le[Se]),S=De,I=Se),(N!==E||G!==b||J!==A||He!==F)&&(i.blendFuncSeparate(q[N],q[G],q[J],q[He]),E=N,b=G,A=J,F=He),(Oe.equals(m)===!1||yt!==w)&&(i.blendColor(Oe.r,Oe.g,Oe.b,yt),m.copy(Oe),w=yt),p=H,T=!1}function Me(H,De){H.side===Ci?j(i.CULL_FACE):ge(i.CULL_FACE);let N=H.side===Dn;De&&(N=!N),Ae(N),H.blending===Ds&&H.transparent===!1?he(Pi):he(H.blending,H.blendEquation,H.blendSrc,H.blendDst,H.blendEquationAlpha,H.blendSrcAlpha,H.blendDstAlpha,H.blendColor,H.blendAlpha,H.premultipliedAlpha),o.setFunc(H.depthFunc),o.setTest(H.depthTest),o.setMask(H.depthWrite),r.setMask(H.colorWrite);let G=H.stencilWrite;a.setTest(G),G&&(a.setMask(H.stencilWriteMask),a.setFunc(H.stencilFunc,H.stencilRef,H.stencilFuncMask),a.setOp(H.stencilFail,H.stencilZFail,H.stencilZPass)),qe(H.polygonOffset,H.polygonOffsetFactor,H.polygonOffsetUnits),H.alphaToCoverage===!0?ge(i.SAMPLE_ALPHA_TO_COVERAGE):j(i.SAMPLE_ALPHA_TO_COVERAGE)}function Ae(H){U!==H&&(H?i.frontFace(i.CW):i.frontFace(i.CCW),U=H)}function Be(H){H!==Qu?(ge(i.CULL_FACE),H!==B&&(H===jc?i.cullFace(i.BACK):H===ed?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):j(i.CULL_FACE),B=H}function ke(H){H!==re&&(ae&&i.lineWidth(H),re=H)}function qe(H,De,N){H?(ge(i.POLYGON_OFFSET_FILL),(se!==De||Z!==N)&&(se=De,Z=N,o.getReversed()&&(De=-De),i.polygonOffset(De,N))):j(i.POLYGON_OFFSET_FILL)}function $e(H){H?ge(i.SCISSOR_TEST):j(i.SCISSOR_TEST)}function it(H){H===void 0&&(H=i.TEXTURE0+ee-1),O!==H&&(i.activeTexture(H),O=H)}function X(H,De,N){N===void 0&&(O===null?N=i.TEXTURE0+ee-1:N=O);let G=z[N];G===void 0&&(G={type:void 0,texture:void 0},z[N]=G),(G.type!==H||G.texture!==De)&&(O!==N&&(i.activeTexture(N),O=N),i.bindTexture(H,De||V[H]),G.type=H,G.texture=De)}function gt(){let H=z[O];H!==void 0&&H.type!==void 0&&(i.bindTexture(H.type,null),H.type=void 0,H.texture=void 0)}function ot(){try{i.compressedTexImage2D(...arguments)}catch(H){mt("WebGLState:",H)}}function R(){try{i.compressedTexImage3D(...arguments)}catch(H){mt("WebGLState:",H)}}function x(){try{i.texSubImage2D(...arguments)}catch(H){mt("WebGLState:",H)}}function Q(){try{i.texSubImage3D(...arguments)}catch(H){mt("WebGLState:",H)}}function ue(){try{i.compressedTexSubImage2D(...arguments)}catch(H){mt("WebGLState:",H)}}function xe(){try{i.compressedTexSubImage3D(...arguments)}catch(H){mt("WebGLState:",H)}}function Pe(){try{i.texStorage2D(...arguments)}catch(H){mt("WebGLState:",H)}}function Ue(){try{i.texStorage3D(...arguments)}catch(H){mt("WebGLState:",H)}}function fe(){try{i.texImage2D(...arguments)}catch(H){mt("WebGLState:",H)}}function ve(){try{i.texImage3D(...arguments)}catch(H){mt("WebGLState:",H)}}function C(H){return f[H]!==void 0?f[H]:i.getParameter(H)}function Y(H,De){f[H]!==De&&(i.pixelStorei(H,De),f[H]=De)}function W(H){Fe.equals(H)===!1&&(i.scissor(H.x,H.y,H.z,H.w),Fe.copy(H))}function K(H){Ye.equals(H)===!1&&(i.viewport(H.x,H.y,H.z,H.w),Ye.copy(H))}function Ie(H,De){let N=l.get(De);N===void 0&&(N=new WeakMap,l.set(De,N));let G=N.get(H);G===void 0&&(G=i.getUniformBlockIndex(De,H.name),N.set(H,G))}function Ve(H,De){let G=l.get(De).get(H);c.get(De)!==G&&(i.uniformBlockBinding(De,G,H.__bindingPointIndex),c.set(De,G))}function Ge(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),d={},f={},O=null,z={},h={},u=new WeakMap,_=[],y=null,g=!1,p=null,S=null,E=null,b=null,I=null,A=null,F=null,m=new _t(0,0,0),w=0,T=!1,U=null,B=null,re=null,se=null,Z=null,Fe.set(0,0,i.canvas.width,i.canvas.height),Ye.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:ge,disable:j,bindFramebuffer:Te,drawBuffers:we,useProgram:Re,setBlending:he,setMaterial:Me,setFlipSided:Ae,setCullFace:Be,setLineWidth:ke,setPolygonOffset:qe,setScissorTest:$e,activeTexture:it,bindTexture:X,unbindTexture:gt,compressedTexImage2D:ot,compressedTexImage3D:R,texImage2D:fe,texImage3D:ve,pixelStorei:Y,getParameter:C,updateUBOMapping:Ie,uniformBlockBinding:Ve,texStorage2D:Pe,texStorage3D:Ue,texSubImage2D:x,texSubImage3D:Q,compressedTexSubImage2D:ue,compressedTexSubImage3D:xe,scissor:W,viewport:K,reset:Ge}}function Wx(i,e,t,n,s,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new ze,d=new WeakMap,f=new Set,h,u=new WeakMap,_=!1;try{_=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function y(R,x){return _?new OffscreenCanvas(R,x):cr("canvas")}function g(R,x,Q){let ue=1,xe=ot(R);if((xe.width>Q||xe.height>Q)&&(ue=Q/Math.max(xe.width,xe.height)),ue<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let Pe=Math.floor(ue*xe.width),Ue=Math.floor(ue*xe.height);h===void 0&&(h=y(Pe,Ue));let fe=x?y(Pe,Ue):h;return fe.width=Pe,fe.height=Ue,fe.getContext("2d").drawImage(R,0,0,Pe,Ue),ft("WebGLRenderer: Texture has been resized from ("+xe.width+"x"+xe.height+") to ("+Pe+"x"+Ue+")."),fe}else return"data"in R&&ft("WebGLRenderer: Image in DataTexture is too big ("+xe.width+"x"+xe.height+")."),R;return R}function p(R){return R.generateMipmaps}function S(R){i.generateMipmap(R)}function E(R){return R.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?i.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function b(R,x,Q,ue,xe,Pe=!1){if(R!==null){if(i[R]!==void 0)return i[R];ft("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let Ue;ue&&(Ue=e.get("EXT_texture_norm16"),Ue||ft("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let fe=x;if(x===i.RED&&(Q===i.FLOAT&&(fe=i.R32F),Q===i.HALF_FLOAT&&(fe=i.R16F),Q===i.UNSIGNED_BYTE&&(fe=i.R8),Q===i.UNSIGNED_SHORT&&Ue&&(fe=Ue.R16_EXT),Q===i.SHORT&&Ue&&(fe=Ue.R16_SNORM_EXT)),x===i.RED_INTEGER&&(Q===i.UNSIGNED_BYTE&&(fe=i.R8UI),Q===i.UNSIGNED_SHORT&&(fe=i.R16UI),Q===i.UNSIGNED_INT&&(fe=i.R32UI),Q===i.BYTE&&(fe=i.R8I),Q===i.SHORT&&(fe=i.R16I),Q===i.INT&&(fe=i.R32I)),x===i.RG&&(Q===i.FLOAT&&(fe=i.RG32F),Q===i.HALF_FLOAT&&(fe=i.RG16F),Q===i.UNSIGNED_BYTE&&(fe=i.RG8),Q===i.UNSIGNED_SHORT&&Ue&&(fe=Ue.RG16_EXT),Q===i.SHORT&&Ue&&(fe=Ue.RG16_SNORM_EXT)),x===i.RG_INTEGER&&(Q===i.UNSIGNED_BYTE&&(fe=i.RG8UI),Q===i.UNSIGNED_SHORT&&(fe=i.RG16UI),Q===i.UNSIGNED_INT&&(fe=i.RG32UI),Q===i.BYTE&&(fe=i.RG8I),Q===i.SHORT&&(fe=i.RG16I),Q===i.INT&&(fe=i.RG32I)),x===i.RGB_INTEGER&&(Q===i.UNSIGNED_BYTE&&(fe=i.RGB8UI),Q===i.UNSIGNED_SHORT&&(fe=i.RGB16UI),Q===i.UNSIGNED_INT&&(fe=i.RGB32UI),Q===i.BYTE&&(fe=i.RGB8I),Q===i.SHORT&&(fe=i.RGB16I),Q===i.INT&&(fe=i.RGB32I)),x===i.RGBA_INTEGER&&(Q===i.UNSIGNED_BYTE&&(fe=i.RGBA8UI),Q===i.UNSIGNED_SHORT&&(fe=i.RGBA16UI),Q===i.UNSIGNED_INT&&(fe=i.RGBA32UI),Q===i.BYTE&&(fe=i.RGBA8I),Q===i.SHORT&&(fe=i.RGBA16I),Q===i.INT&&(fe=i.RGBA32I)),x===i.RGB&&(Q===i.UNSIGNED_SHORT&&Ue&&(fe=Ue.RGB16_EXT),Q===i.SHORT&&Ue&&(fe=Ue.RGB16_SNORM_EXT),Q===i.UNSIGNED_INT_5_9_9_9_REV&&(fe=i.RGB9_E5),Q===i.UNSIGNED_INT_10F_11F_11F_REV&&(fe=i.R11F_G11F_B10F)),x===i.RGBA){let ve=Pe?jr:Ct.getTransfer(xe);Q===i.FLOAT&&(fe=i.RGBA32F),Q===i.HALF_FLOAT&&(fe=i.RGBA16F),Q===i.UNSIGNED_BYTE&&(fe=ve===zt?i.SRGB8_ALPHA8:i.RGBA8),Q===i.UNSIGNED_SHORT&&Ue&&(fe=Ue.RGBA16_EXT),Q===i.SHORT&&Ue&&(fe=Ue.RGBA16_SNORM_EXT),Q===i.UNSIGNED_SHORT_4_4_4_4&&(fe=i.RGBA4),Q===i.UNSIGNED_SHORT_5_5_5_1&&(fe=i.RGB5_A1)}return(fe===i.R16F||fe===i.R32F||fe===i.RG16F||fe===i.RG32F||fe===i.RGBA16F||fe===i.RGBA32F)&&e.get("EXT_color_buffer_float"),fe}function I(R,x){let Q;return R?x===null||x===xi||x===wr?Q=i.DEPTH24_STENCIL8:x===yi?Q=i.DEPTH32F_STENCIL8:x===Er&&(Q=i.DEPTH24_STENCIL8,ft("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===xi||x===wr?Q=i.DEPTH_COMPONENT24:x===yi?Q=i.DEPTH_COMPONENT32F:x===Er&&(Q=i.DEPTH_COMPONENT16),Q}function A(R,x){return p(R)===!0||R.isFramebufferTexture&&R.minFilter!==Jt&&R.minFilter!==yn?Math.log2(Math.max(x.width,x.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?x.mipmaps.length:1}function F(R){let x=R.target;x.removeEventListener("dispose",F),w(x),x.isVideoTexture&&d.delete(x),x.isHTMLTexture&&f.delete(x)}function m(R){let x=R.target;x.removeEventListener("dispose",m),U(x)}function w(R){let x=n.get(R);if(x.__webglInit===void 0)return;let Q=R.source,ue=u.get(Q);if(ue){let xe=ue[x.__cacheKey];xe.usedTimes--,xe.usedTimes===0&&T(R),Object.keys(ue).length===0&&u.delete(Q)}n.remove(R)}function T(R){let x=n.get(R);i.deleteTexture(x.__webglTexture);let Q=R.source,ue=u.get(Q);delete ue[x.__cacheKey],o.memory.textures--}function U(R){let x=n.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),n.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let ue=0;ue<6;ue++){if(Array.isArray(x.__webglFramebuffer[ue]))for(let xe=0;xe<x.__webglFramebuffer[ue].length;xe++)i.deleteFramebuffer(x.__webglFramebuffer[ue][xe]);else i.deleteFramebuffer(x.__webglFramebuffer[ue]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[ue])}else{if(Array.isArray(x.__webglFramebuffer))for(let ue=0;ue<x.__webglFramebuffer.length;ue++)i.deleteFramebuffer(x.__webglFramebuffer[ue]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let ue=0;ue<x.__webglColorRenderbuffer.length;ue++)x.__webglColorRenderbuffer[ue]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[ue]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let Q=R.textures;for(let ue=0,xe=Q.length;ue<xe;ue++){let Pe=n.get(Q[ue]);Pe.__webglTexture&&(i.deleteTexture(Pe.__webglTexture),o.memory.textures--),n.remove(Q[ue])}n.remove(R)}let B=0;function re(){B=0}function se(){return B}function Z(R){B=R}function ee(){let R=B;return R>=s.maxTextures&&ft("WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+s.maxTextures),B+=1,R}function ae(R){let x=[];return x.push(R.wrapS),x.push(R.wrapT),x.push(R.wrapR||0),x.push(R.magFilter),x.push(R.minFilter),x.push(R.anisotropy),x.push(R.internalFormat),x.push(R.format),x.push(R.type),x.push(R.generateMipmaps),x.push(R.premultiplyAlpha),x.push(R.flipY),x.push(R.unpackAlignment),x.push(R.colorSpace),x.join()}function ye(R,x){let Q=n.get(R);if(R.isVideoTexture&&X(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&Q.__version!==R.version){let ue=R.image;if(ue===null)ft("WebGLRenderer: Texture marked for update but no image data found.");else if(ue.complete===!1)ft("WebGLRenderer: Texture marked for update but image is incomplete");else{j(Q,R,x);return}}else R.isExternalTexture&&(Q.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,Q.__webglTexture,i.TEXTURE0+x)}function be(R,x){let Q=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&Q.__version!==R.version){j(Q,R,x);return}else R.isExternalTexture&&(Q.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,Q.__webglTexture,i.TEXTURE0+x)}function O(R,x){let Q=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&Q.__version!==R.version){j(Q,R,x);return}t.bindTexture(i.TEXTURE_3D,Q.__webglTexture,i.TEXTURE0+x)}function z(R,x){let Q=n.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&Q.__version!==R.version){Te(Q,R,x);return}t.bindTexture(i.TEXTURE_CUBE_MAP,Q.__webglTexture,i.TEXTURE0+x)}let ne={[Ma]:i.REPEAT,[Ti]:i.CLAMP_TO_EDGE,[Sa]:i.MIRRORED_REPEAT},_e={[Jt]:i.NEAREST,[bd]:i.NEAREST_MIPMAP_NEAREST,[So]:i.NEAREST_MIPMAP_LINEAR,[yn]:i.LINEAR,[sl]:i.LINEAR_MIPMAP_NEAREST,[ys]:i.LINEAR_MIPMAP_LINEAR},Fe={[Ed]:i.NEVER,[Cd]:i.ALWAYS,[wd]:i.LESS,[Hl]:i.LEQUAL,[Td]:i.EQUAL,[Gl]:i.GEQUAL,[Ad]:i.GREATER,[Rd]:i.NOTEQUAL};function Ye(R,x){if(x.type===yi&&e.has("OES_texture_float_linear")===!1&&(x.magFilter===yn||x.magFilter===sl||x.magFilter===So||x.magFilter===ys||x.minFilter===yn||x.minFilter===sl||x.minFilter===So||x.minFilter===ys)&&ft("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(R,i.TEXTURE_WRAP_S,ne[x.wrapS]),i.texParameteri(R,i.TEXTURE_WRAP_T,ne[x.wrapT]),(R===i.TEXTURE_3D||R===i.TEXTURE_2D_ARRAY)&&i.texParameteri(R,i.TEXTURE_WRAP_R,ne[x.wrapR]),i.texParameteri(R,i.TEXTURE_MAG_FILTER,_e[x.magFilter]),i.texParameteri(R,i.TEXTURE_MIN_FILTER,_e[x.minFilter]),x.compareFunction&&(i.texParameteri(R,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(R,i.TEXTURE_COMPARE_FUNC,Fe[x.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===Jt||x.minFilter!==So&&x.minFilter!==ys||x.type===yi&&e.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){let Q=e.get("EXT_texture_filter_anisotropic");i.texParameterf(R,Q.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function me(R,x){let Q=!1;R.__webglInit===void 0&&(R.__webglInit=!0,x.addEventListener("dispose",F));let ue=x.source,xe=u.get(ue);xe===void 0&&(xe={},u.set(ue,xe));let Pe=ae(x);if(Pe!==R.__cacheKey){xe[Pe]===void 0&&(xe[Pe]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,Q=!0),xe[Pe].usedTimes++;let Ue=xe[R.__cacheKey];Ue!==void 0&&(xe[R.__cacheKey].usedTimes--,Ue.usedTimes===0&&T(x)),R.__cacheKey=Pe,R.__webglTexture=xe[Pe].texture}return Q}function V(R,x,Q){return Math.floor(Math.floor(R/Q)/x)}function ge(R,x,Q,ue){let Pe=R.updateRanges;if(Pe.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,x.width,x.height,Q,ue,x.data);else{Pe.sort((Y,W)=>Y.start-W.start);let Ue=0;for(let Y=1;Y<Pe.length;Y++){let W=Pe[Ue],K=Pe[Y],Ie=W.start+W.count,Ve=V(K.start,x.width,4),Ge=V(W.start,x.width,4);K.start<=Ie+1&&Ve===Ge&&V(K.start+K.count-1,x.width,4)===Ve?W.count=Math.max(W.count,K.start+K.count-W.start):(++Ue,Pe[Ue]=K)}Pe.length=Ue+1;let fe=t.getParameter(i.UNPACK_ROW_LENGTH),ve=t.getParameter(i.UNPACK_SKIP_PIXELS),C=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,x.width);for(let Y=0,W=Pe.length;Y<W;Y++){let K=Pe[Y],Ie=Math.floor(K.start/4),Ve=Math.ceil(K.count/4),Ge=Ie%x.width,H=Math.floor(Ie/x.width),De=Ve,N=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Ge),t.pixelStorei(i.UNPACK_SKIP_ROWS,H),t.texSubImage2D(i.TEXTURE_2D,0,Ge,H,De,N,Q,ue,x.data)}R.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,fe),t.pixelStorei(i.UNPACK_SKIP_PIXELS,ve),t.pixelStorei(i.UNPACK_SKIP_ROWS,C)}}function j(R,x,Q){let ue=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(ue=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(ue=i.TEXTURE_3D);let xe=me(R,x),Pe=x.source;t.bindTexture(ue,R.__webglTexture,i.TEXTURE0+Q);let Ue=n.get(Pe);if(Pe.version!==Ue.__version||xe===!0){if(t.activeTexture(i.TEXTURE0+Q),(typeof ImageBitmap<"u"&&x.image instanceof ImageBitmap)===!1){let N=Ct.getPrimaries(Ct.workingColorSpace),G=x.colorSpace===ji?null:Ct.getPrimaries(x.colorSpace),Se=x.colorSpace===ji||N===G?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Se)}t.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment);let ve=g(x.image,!1,s.maxTextureSize);ve=gt(x,ve);let C=r.convert(x.format,x.colorSpace),Y=r.convert(x.type),W=b(x.internalFormat,C,Y,x.normalized,x.colorSpace,x.isVideoTexture);Ye(ue,x);let K,Ie=x.mipmaps,Ve=x.isVideoTexture!==!0,Ge=Ue.__version===void 0||xe===!0,H=Pe.dataReady,De=A(x,ve);if(x.isDepthTexture)W=I(x.format===vs,x.type),Ge&&(Ve?t.texStorage2D(i.TEXTURE_2D,1,W,ve.width,ve.height):t.texImage2D(i.TEXTURE_2D,0,W,ve.width,ve.height,0,C,Y,null));else if(x.isDataTexture)if(Ie.length>0){Ve&&Ge&&t.texStorage2D(i.TEXTURE_2D,De,W,Ie[0].width,Ie[0].height);for(let N=0,G=Ie.length;N<G;N++)K=Ie[N],Ve?H&&t.texSubImage2D(i.TEXTURE_2D,N,0,0,K.width,K.height,C,Y,K.data):t.texImage2D(i.TEXTURE_2D,N,W,K.width,K.height,0,C,Y,K.data);x.generateMipmaps=!1}else Ve?(Ge&&t.texStorage2D(i.TEXTURE_2D,De,W,ve.width,ve.height),H&&ge(x,ve,C,Y)):t.texImage2D(i.TEXTURE_2D,0,W,ve.width,ve.height,0,C,Y,ve.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Ve&&Ge&&t.texStorage3D(i.TEXTURE_2D_ARRAY,De,W,Ie[0].width,Ie[0].height,ve.depth);for(let N=0,G=Ie.length;N<G;N++)if(K=Ie[N],x.format!==ii)if(C!==null)if(Ve){if(H)if(x.layerUpdates.size>0){let Se=Eh(K.width,K.height,x.format,x.type);for(let J of x.layerUpdates){let He=K.data.subarray(J*Se/K.data.BYTES_PER_ELEMENT,(J+1)*Se/K.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,N,0,0,J,K.width,K.height,1,C,He)}x.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,N,0,0,0,K.width,K.height,ve.depth,C,K.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,N,W,K.width,K.height,ve.depth,0,K.data,0,0);else ft("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ve?H&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,N,0,0,0,K.width,K.height,ve.depth,C,Y,K.data):t.texImage3D(i.TEXTURE_2D_ARRAY,N,W,K.width,K.height,ve.depth,0,C,Y,K.data)}else{Ve&&Ge&&t.texStorage2D(i.TEXTURE_2D,De,W,Ie[0].width,Ie[0].height);for(let N=0,G=Ie.length;N<G;N++)K=Ie[N],x.format!==ii?C!==null?Ve?H&&t.compressedTexSubImage2D(i.TEXTURE_2D,N,0,0,K.width,K.height,C,K.data):t.compressedTexImage2D(i.TEXTURE_2D,N,W,K.width,K.height,0,K.data):ft("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ve?H&&t.texSubImage2D(i.TEXTURE_2D,N,0,0,K.width,K.height,C,Y,K.data):t.texImage2D(i.TEXTURE_2D,N,W,K.width,K.height,0,C,Y,K.data)}else if(x.isDataArrayTexture)if(Ve){if(Ge&&t.texStorage3D(i.TEXTURE_2D_ARRAY,De,W,ve.width,ve.height,ve.depth),H)if(x.layerUpdates.size>0){let N=Eh(ve.width,ve.height,x.format,x.type);for(let G of x.layerUpdates){let Se=ve.data.subarray(G*N/ve.data.BYTES_PER_ELEMENT,(G+1)*N/ve.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,G,ve.width,ve.height,1,C,Y,Se)}x.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ve.width,ve.height,ve.depth,C,Y,ve.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,W,ve.width,ve.height,ve.depth,0,C,Y,ve.data);else if(x.isData3DTexture)Ve?(Ge&&t.texStorage3D(i.TEXTURE_3D,De,W,ve.width,ve.height,ve.depth),H&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ve.width,ve.height,ve.depth,C,Y,ve.data)):t.texImage3D(i.TEXTURE_3D,0,W,ve.width,ve.height,ve.depth,0,C,Y,ve.data);else if(x.isFramebufferTexture){if(Ge)if(Ve)t.texStorage2D(i.TEXTURE_2D,De,W,ve.width,ve.height);else{let N=ve.width,G=ve.height;for(let Se=0;Se<De;Se++)t.texImage2D(i.TEXTURE_2D,Se,W,N,G,0,C,Y,null),N>>=1,G>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in i){let N=i.canvas;if(N.hasAttribute("layoutsubtree")||N.setAttribute("layoutsubtree","true"),ve.parentNode!==N){N.appendChild(ve),f.add(x),N.onpaint=G=>{let Se=G.changedElements;for(let J of f)Se.includes(J.image)&&(J.needsUpdate=!0)},N.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,ve);else{let Se=i.RGBA,J=i.RGBA,He=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,Se,J,He,ve)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Ie.length>0){if(Ve&&Ge){let N=ot(Ie[0]);t.texStorage2D(i.TEXTURE_2D,De,W,N.width,N.height)}for(let N=0,G=Ie.length;N<G;N++)K=Ie[N],Ve?H&&t.texSubImage2D(i.TEXTURE_2D,N,0,0,C,Y,K):t.texImage2D(i.TEXTURE_2D,N,W,C,Y,K);x.generateMipmaps=!1}else if(Ve){if(Ge){let N=ot(ve);t.texStorage2D(i.TEXTURE_2D,De,W,N.width,N.height)}H&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,C,Y,ve)}else t.texImage2D(i.TEXTURE_2D,0,W,C,Y,ve);p(x)&&S(ue),Ue.__version=Pe.version,x.onUpdate&&x.onUpdate(x)}R.__version=x.version}function Te(R,x,Q){if(x.image.length!==6)return;let ue=me(R,x),xe=x.source;t.bindTexture(i.TEXTURE_CUBE_MAP,R.__webglTexture,i.TEXTURE0+Q);let Pe=n.get(xe);if(xe.version!==Pe.__version||ue===!0){t.activeTexture(i.TEXTURE0+Q);let Ue=Ct.getPrimaries(Ct.workingColorSpace),fe=x.colorSpace===ji?null:Ct.getPrimaries(x.colorSpace),ve=x.colorSpace===ji||Ue===fe?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ve);let C=x.isCompressedTexture||x.image[0].isCompressedTexture,Y=x.image[0]&&x.image[0].isDataTexture,W=[];for(let J=0;J<6;J++)!C&&!Y?W[J]=g(x.image[J],!0,s.maxCubemapSize):W[J]=Y?x.image[J].image:x.image[J],W[J]=gt(x,W[J]);let K=W[0],Ie=r.convert(x.format,x.colorSpace),Ve=r.convert(x.type),Ge=b(x.internalFormat,Ie,Ve,x.normalized,x.colorSpace),H=x.isVideoTexture!==!0,De=Pe.__version===void 0||ue===!0,N=xe.dataReady,G=A(x,K);Ye(i.TEXTURE_CUBE_MAP,x);let Se;if(C){H&&De&&t.texStorage2D(i.TEXTURE_CUBE_MAP,G,Ge,K.width,K.height);for(let J=0;J<6;J++){Se=W[J].mipmaps;for(let He=0;He<Se.length;He++){let Oe=Se[He];x.format!==ii?Ie!==null?H?N&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He,0,0,Oe.width,Oe.height,Ie,Oe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He,Ge,Oe.width,Oe.height,0,Oe.data):ft("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):H?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He,0,0,Oe.width,Oe.height,Ie,Ve,Oe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He,Ge,Oe.width,Oe.height,0,Ie,Ve,Oe.data)}}}else{if(Se=x.mipmaps,H&&De){Se.length>0&&G++;let J=ot(W[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,G,Ge,J.width,J.height)}for(let J=0;J<6;J++)if(Y){H?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,W[J].width,W[J].height,Ie,Ve,W[J].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Ge,W[J].width,W[J].height,0,Ie,Ve,W[J].data);for(let He=0;He<Se.length;He++){let yt=Se[He].image[J].image;H?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He+1,0,0,yt.width,yt.height,Ie,Ve,yt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He+1,Ge,yt.width,yt.height,0,Ie,Ve,yt.data)}}else{H?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,Ie,Ve,W[J]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Ge,Ie,Ve,W[J]);for(let He=0;He<Se.length;He++){let Oe=Se[He];H?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He+1,0,0,Ie,Ve,Oe.image[J]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,He+1,Ge,Ie,Ve,Oe.image[J])}}}p(x)&&S(i.TEXTURE_CUBE_MAP),Pe.__version=xe.version,x.onUpdate&&x.onUpdate(x)}R.__version=x.version}function we(R,x,Q,ue,xe,Pe){let Ue=r.convert(Q.format,Q.colorSpace),fe=r.convert(Q.type),ve=b(Q.internalFormat,Ue,fe,Q.normalized,Q.colorSpace),C=n.get(x),Y=n.get(Q);if(Y.__renderTarget=x,!C.__hasExternalTextures){let W=Math.max(1,x.width>>Pe),K=Math.max(1,x.height>>Pe);xe===i.TEXTURE_3D||xe===i.TEXTURE_2D_ARRAY?t.texImage3D(xe,Pe,ve,W,K,x.depth,0,Ue,fe,null):t.texImage2D(xe,Pe,ve,W,K,0,Ue,fe,null)}t.bindFramebuffer(i.FRAMEBUFFER,R),it(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ue,xe,Y.__webglTexture,0,$e(x)):(xe===i.TEXTURE_2D||xe>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&xe<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,ue,xe,Y.__webglTexture,Pe),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Re(R,x,Q){if(i.bindRenderbuffer(i.RENDERBUFFER,R),x.depthBuffer){let ue=x.depthTexture,xe=ue&&ue.isDepthTexture?ue.type:null,Pe=I(x.stencilBuffer,xe),Ue=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;it(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,$e(x),Pe,x.width,x.height):Q?i.renderbufferStorageMultisample(i.RENDERBUFFER,$e(x),Pe,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,Pe,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Ue,i.RENDERBUFFER,R)}else{let ue=x.textures;for(let xe=0;xe<ue.length;xe++){let Pe=ue[xe],Ue=r.convert(Pe.format,Pe.colorSpace),fe=r.convert(Pe.type),ve=b(Pe.internalFormat,Ue,fe,Pe.normalized,Pe.colorSpace);it(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,$e(x),ve,x.width,x.height):Q?i.renderbufferStorageMultisample(i.RENDERBUFFER,$e(x),ve,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,ve,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Le(R,x,Q){let ue=x.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,R),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let xe=n.get(x.depthTexture);if(xe.__renderTarget=x,(!xe.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),ue){if(xe.__webglInit===void 0&&(xe.__webglInit=!0,x.depthTexture.addEventListener("dispose",F)),xe.__webglTexture===void 0){xe.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,xe.__webglTexture),Ye(i.TEXTURE_CUBE_MAP,x.depthTexture);let C=r.convert(x.depthTexture.format),Y=r.convert(x.depthTexture.type),W;x.depthTexture.format===Ai?W=i.DEPTH_COMPONENT24:x.depthTexture.format===vs&&(W=i.DEPTH24_STENCIL8);for(let K=0;K<6;K++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,W,x.width,x.height,0,C,Y,null)}}else ye(x.depthTexture,0);let Pe=xe.__webglTexture,Ue=$e(x),fe=ue?i.TEXTURE_CUBE_MAP_POSITIVE_X+Q:i.TEXTURE_2D,ve=x.depthTexture.format===vs?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(x.depthTexture.format===Ai)it(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ve,fe,Pe,0,Ue):i.framebufferTexture2D(i.FRAMEBUFFER,ve,fe,Pe,0);else if(x.depthTexture.format===vs)it(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ve,fe,Pe,0,Ue):i.framebufferTexture2D(i.FRAMEBUFFER,ve,fe,Pe,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function q(R){let x=n.get(R),Q=R.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==R.depthTexture){let ue=R.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),ue){let xe=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,ue.removeEventListener("dispose",xe)};ue.addEventListener("dispose",xe),x.__depthDisposeCallback=xe}x.__boundDepthTexture=ue}if(R.depthTexture&&!x.__autoAllocateDepthBuffer)if(Q)for(let ue=0;ue<6;ue++)Le(x.__webglFramebuffer[ue],R,ue);else{let ue=R.texture.mipmaps;ue&&ue.length>0?Le(x.__webglFramebuffer[0],R,0):Le(x.__webglFramebuffer,R,0)}else if(Q){x.__webglDepthbuffer=[];for(let ue=0;ue<6;ue++)if(t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[ue]),x.__webglDepthbuffer[ue]===void 0)x.__webglDepthbuffer[ue]=i.createRenderbuffer(),Re(x.__webglDepthbuffer[ue],R,!1);else{let xe=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Pe=x.__webglDepthbuffer[ue];i.bindRenderbuffer(i.RENDERBUFFER,Pe),i.framebufferRenderbuffer(i.FRAMEBUFFER,xe,i.RENDERBUFFER,Pe)}}else{let ue=R.texture.mipmaps;if(ue&&ue.length>0?t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),Re(x.__webglDepthbuffer,R,!1);else{let xe=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Pe=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,Pe),i.framebufferRenderbuffer(i.FRAMEBUFFER,xe,i.RENDERBUFFER,Pe)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function he(R,x,Q){let ue=n.get(R);x!==void 0&&we(ue.__webglFramebuffer,R,R.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),Q!==void 0&&q(R)}function Me(R){let x=R.texture,Q=n.get(R),ue=n.get(x);R.addEventListener("dispose",m);let xe=R.textures,Pe=R.isWebGLCubeRenderTarget===!0,Ue=xe.length>1;if(Ue||(ue.__webglTexture===void 0&&(ue.__webglTexture=i.createTexture()),ue.__version=x.version,o.memory.textures++),Pe){Q.__webglFramebuffer=[];for(let fe=0;fe<6;fe++)if(x.mipmaps&&x.mipmaps.length>0){Q.__webglFramebuffer[fe]=[];for(let ve=0;ve<x.mipmaps.length;ve++)Q.__webglFramebuffer[fe][ve]=i.createFramebuffer()}else Q.__webglFramebuffer[fe]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){Q.__webglFramebuffer=[];for(let fe=0;fe<x.mipmaps.length;fe++)Q.__webglFramebuffer[fe]=i.createFramebuffer()}else Q.__webglFramebuffer=i.createFramebuffer();if(Ue)for(let fe=0,ve=xe.length;fe<ve;fe++){let C=n.get(xe[fe]);C.__webglTexture===void 0&&(C.__webglTexture=i.createTexture(),o.memory.textures++)}if(R.samples>0&&it(R)===!1){Q.__webglMultisampledFramebuffer=i.createFramebuffer(),Q.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,Q.__webglMultisampledFramebuffer);for(let fe=0;fe<xe.length;fe++){let ve=xe[fe];Q.__webglColorRenderbuffer[fe]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,Q.__webglColorRenderbuffer[fe]);let C=r.convert(ve.format,ve.colorSpace),Y=r.convert(ve.type),W=b(ve.internalFormat,C,Y,ve.normalized,ve.colorSpace,R.isXRRenderTarget===!0),K=$e(R);i.renderbufferStorageMultisample(i.RENDERBUFFER,K,W,R.width,R.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+fe,i.RENDERBUFFER,Q.__webglColorRenderbuffer[fe])}i.bindRenderbuffer(i.RENDERBUFFER,null),R.depthBuffer&&(Q.__webglDepthRenderbuffer=i.createRenderbuffer(),Re(Q.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Pe){t.bindTexture(i.TEXTURE_CUBE_MAP,ue.__webglTexture),Ye(i.TEXTURE_CUBE_MAP,x);for(let fe=0;fe<6;fe++)if(x.mipmaps&&x.mipmaps.length>0)for(let ve=0;ve<x.mipmaps.length;ve++)we(Q.__webglFramebuffer[fe][ve],R,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+fe,ve);else we(Q.__webglFramebuffer[fe],R,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+fe,0);p(x)&&S(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Ue){for(let fe=0,ve=xe.length;fe<ve;fe++){let C=xe[fe],Y=n.get(C),W=i.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(W=R.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(W,Y.__webglTexture),Ye(W,C),we(Q.__webglFramebuffer,R,C,i.COLOR_ATTACHMENT0+fe,W,0),p(C)&&S(W)}t.unbindTexture()}else{let fe=i.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(fe=R.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(fe,ue.__webglTexture),Ye(fe,x),x.mipmaps&&x.mipmaps.length>0)for(let ve=0;ve<x.mipmaps.length;ve++)we(Q.__webglFramebuffer[ve],R,x,i.COLOR_ATTACHMENT0,fe,ve);else we(Q.__webglFramebuffer,R,x,i.COLOR_ATTACHMENT0,fe,0);p(x)&&S(fe),t.unbindTexture()}R.depthBuffer&&q(R)}function Ae(R){let x=R.textures;for(let Q=0,ue=x.length;Q<ue;Q++){let xe=x[Q];if(p(xe)){let Pe=E(R),Ue=n.get(xe).__webglTexture;t.bindTexture(Pe,Ue),S(Pe),t.unbindTexture()}}}let Be=[],ke=[];function qe(R){if(R.samples>0){if(it(R)===!1){let x=R.textures,Q=R.width,ue=R.height,xe=i.COLOR_BUFFER_BIT,Pe=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Ue=n.get(R),fe=x.length>1;if(fe)for(let C=0;C<x.length;C++)t.bindFramebuffer(i.FRAMEBUFFER,Ue.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+C,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,Ue.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+C,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,Ue.__webglMultisampledFramebuffer);let ve=R.texture.mipmaps;ve&&ve.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ue.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ue.__webglFramebuffer);for(let C=0;C<x.length;C++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(xe|=i.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(xe|=i.STENCIL_BUFFER_BIT)),fe){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Ue.__webglColorRenderbuffer[C]);let Y=n.get(x[C]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Y,0)}i.blitFramebuffer(0,0,Q,ue,0,0,Q,ue,xe,i.NEAREST),c===!0&&(Be.length=0,ke.length=0,Be.push(i.COLOR_ATTACHMENT0+C),R.depthBuffer&&R.resolveDepthBuffer===!1&&(Be.push(Pe),ke.push(Pe),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,ke)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Be))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),fe)for(let C=0;C<x.length;C++){t.bindFramebuffer(i.FRAMEBUFFER,Ue.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+C,i.RENDERBUFFER,Ue.__webglColorRenderbuffer[C]);let Y=n.get(x[C]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,Ue.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+C,i.TEXTURE_2D,Y,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ue.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&c){let x=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function $e(R){return Math.min(s.maxSamples,R.samples)}function it(R){let x=n.get(R);return R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function X(R){let x=o.render.frame;d.get(R)!==x&&(d.set(R,x),R.update())}function gt(R,x){let Q=R.colorSpace,ue=R.format,xe=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||Q!==Kr&&Q!==ji&&(Ct.getTransfer(Q)===zt?(ue!==ii||xe!==Fn)&&ft("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):mt("WebGLTextures: Unsupported texture color space:",Q)),x}function ot(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(l.width=R.naturalWidth||R.width,l.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(l.width=R.displayWidth,l.height=R.displayHeight):(l.width=R.width,l.height=R.height),l}this.allocateTextureUnit=ee,this.resetTextureUnits=re,this.getTextureUnits=se,this.setTextureUnits=Z,this.setTexture2D=ye,this.setTexture2DArray=be,this.setTexture3D=O,this.setTextureCube=z,this.rebindTextures=he,this.setupRenderTarget=Me,this.updateRenderTargetMipmap=Ae,this.updateMultisampleRenderTarget=qe,this.setupDepthRenderbuffer=q,this.setupFrameBufferTexture=we,this.useMultisampledRTT=it,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Xx(i,e){function t(n,s=ji){let r,o=Ct.getTransfer(s);if(n===Fn)return i.UNSIGNED_BYTE;if(n===ol)return i.UNSIGNED_SHORT_4_4_4_4;if(n===al)return i.UNSIGNED_SHORT_5_5_5_1;if(n===dh)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===fh)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===hh)return i.BYTE;if(n===uh)return i.SHORT;if(n===Er)return i.UNSIGNED_SHORT;if(n===rl)return i.INT;if(n===xi)return i.UNSIGNED_INT;if(n===yi)return i.FLOAT;if(n===Ii)return i.HALF_FLOAT;if(n===ph)return i.ALPHA;if(n===mh)return i.RGB;if(n===ii)return i.RGBA;if(n===Ai)return i.DEPTH_COMPONENT;if(n===vs)return i.DEPTH_STENCIL;if(n===gh)return i.RED;if(n===ll)return i.RED_INTEGER;if(n===bs)return i.RG;if(n===cl)return i.RG_INTEGER;if(n===hl)return i.RGBA_INTEGER;if(n===Eo||n===wo||n===To||n===Ao)if(o===zt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Eo)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===wo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===To)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ao)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Eo)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===wo)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===To)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ao)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===ul||n===dl||n===fl||n===pl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===ul)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===dl)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===fl)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===pl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ml||n===gl||n===_l||n===xl||n===yl||n===Ro||n===vl)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ml||n===gl)return o===zt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===_l)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===xl)return r.COMPRESSED_R11_EAC;if(n===yl)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Ro)return r.COMPRESSED_RG11_EAC;if(n===vl)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===bl||n===Ml||n===Sl||n===El||n===wl||n===Tl||n===Al||n===Rl||n===Cl||n===Pl||n===Il||n===Ll||n===Dl||n===Nl)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===bl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ml)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Sl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===El)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===wl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Tl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Al)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Rl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Cl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Pl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Il)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ll)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Dl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Nl)return o===zt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Ul||n===Fl||n===Ol)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===Ul)return o===zt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Fl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Ol)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Bl||n===zl||n===Co||n===kl)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===Bl)return r.COMPRESSED_RED_RGTC1_EXT;if(n===zl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Co)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===kl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===wr?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}var qx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Yx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Gh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new ro(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Yn({vertexShader:qx,fragmentShader:Yx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new kt(new us(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Wh=class extends di{constructor(e,t){super();let n=this,s=null,r=1,o=null,a="local-floor",c=1,l=null,d=null,f=null,h=null,u=null,_=null,y=typeof XRWebGLBinding<"u",g=new Gh,p={},S=t.getContextAttributes(),E=null,b=null,I=[],A=[],F=new ze,m=null,w=new an;w.viewport=new Kt;let T=new an;T.viewport=new Kt;let U=[w,T],B=new Qa,re=null,se=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(me){let V=I[me];return V===void 0&&(V=new pr,I[me]=V),V.getTargetRaySpace()},this.getControllerGrip=function(me){let V=I[me];return V===void 0&&(V=new pr,I[me]=V),V.getGripSpace()},this.getHand=function(me){let V=I[me];return V===void 0&&(V=new pr,I[me]=V),V.getHandSpace()};function Z(me){let V=A.indexOf(me.inputSource);if(V===-1)return;let ge=I[V];ge!==void 0&&(ge.update(me.inputSource,me.frame,l||o),ge.dispatchEvent({type:me.type,data:me.inputSource}))}function ee(){s.removeEventListener("select",Z),s.removeEventListener("selectstart",Z),s.removeEventListener("selectend",Z),s.removeEventListener("squeeze",Z),s.removeEventListener("squeezestart",Z),s.removeEventListener("squeezeend",Z),s.removeEventListener("end",ee),s.removeEventListener("inputsourceschange",ae);for(let me=0;me<I.length;me++){let V=A[me];V!==null&&(A[me]=null,I[me].disconnect(V))}re=null,se=null,g.reset();for(let me in p)delete p[me];e.setRenderTarget(E),u=null,h=null,f=null,s=null,b=null,Ye.stop(),n.isPresenting=!1,e.setPixelRatio(m),e.setSize(F.width,F.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(me){r=me,n.isPresenting===!0&&ft("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(me){a=me,n.isPresenting===!0&&ft("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(me){l=me},this.getBaseLayer=function(){return h!==null?h:u},this.getBinding=function(){return f===null&&y&&(f=new XRWebGLBinding(s,t)),f},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(me){if(s=me,s!==null){if(E=e.getRenderTarget(),s.addEventListener("select",Z),s.addEventListener("selectstart",Z),s.addEventListener("selectend",Z),s.addEventListener("squeeze",Z),s.addEventListener("squeezestart",Z),s.addEventListener("squeezeend",Z),s.addEventListener("end",ee),s.addEventListener("inputsourceschange",ae),S.xrCompatible!==!0&&await t.makeXRCompatible(),m=e.getPixelRatio(),e.getSize(F),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let ge=null,j=null,Te=null;S.depth&&(Te=S.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ge=S.stencil?vs:Ai,j=S.stencil?wr:xi);let we={colorFormat:t.RGBA8,depthFormat:Te,scaleFactor:r};f=this.getBinding(),h=f.createProjectionLayer(we),s.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),b=new Xn(h.textureWidth,h.textureHeight,{format:ii,type:Fn,depthTexture:new Ji(h.textureWidth,h.textureHeight,j,void 0,void 0,void 0,void 0,void 0,void 0,ge),stencilBuffer:S.stencil,colorSpace:e.outputColorSpace,samples:S.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let ge={antialias:S.antialias,alpha:!0,depth:S.depth,stencil:S.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(s,t,ge),s.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),b=new Xn(u.framebufferWidth,u.framebufferHeight,{format:ii,type:Fn,colorSpace:e.outputColorSpace,stencilBuffer:S.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await s.requestReferenceSpace(a),Ye.setContext(s),Ye.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function ae(me){for(let V=0;V<me.removed.length;V++){let ge=me.removed[V],j=A.indexOf(ge);j>=0&&(A[j]=null,I[j].disconnect(ge))}for(let V=0;V<me.added.length;V++){let ge=me.added[V],j=A.indexOf(ge);if(j===-1){for(let we=0;we<I.length;we++)if(we>=A.length){A.push(ge),j=we;break}else if(A[we]===null){A[we]=ge,j=we;break}if(j===-1)break}let Te=I[j];Te&&Te.connect(ge)}}let ye=new L,be=new L;function O(me,V,ge){ye.setFromMatrixPosition(V.matrixWorld),be.setFromMatrixPosition(ge.matrixWorld);let j=ye.distanceTo(be),Te=V.projectionMatrix.elements,we=ge.projectionMatrix.elements,Re=Te[14]/(Te[10]-1),Le=Te[14]/(Te[10]+1),q=(Te[9]+1)/Te[5],he=(Te[9]-1)/Te[5],Me=(Te[8]-1)/Te[0],Ae=(we[8]+1)/we[0],Be=Re*Me,ke=Re*Ae,qe=j/(-Me+Ae),$e=qe*-Me;if(V.matrixWorld.decompose(me.position,me.quaternion,me.scale),me.translateX($e),me.translateZ(qe),me.matrixWorld.compose(me.position,me.quaternion,me.scale),me.matrixWorldInverse.copy(me.matrixWorld).invert(),Te[10]===-1)me.projectionMatrix.copy(V.projectionMatrix),me.projectionMatrixInverse.copy(V.projectionMatrixInverse);else{let it=Re+qe,X=Le+qe,gt=Be-$e,ot=ke+(j-$e),R=q*Le/X*it,x=he*Le/X*it;me.projectionMatrix.makePerspective(gt,ot,R,x,it,X),me.projectionMatrixInverse.copy(me.projectionMatrix).invert()}}function z(me,V){V===null?me.matrixWorld.copy(me.matrix):me.matrixWorld.multiplyMatrices(V.matrixWorld,me.matrix),me.matrixWorldInverse.copy(me.matrixWorld).invert()}this.updateCamera=function(me){if(s===null)return;let V=me.near,ge=me.far;g.texture!==null&&(g.depthNear>0&&(V=g.depthNear),g.depthFar>0&&(ge=g.depthFar)),B.near=T.near=w.near=V,B.far=T.far=w.far=ge,(re!==B.near||se!==B.far)&&(s.updateRenderState({depthNear:B.near,depthFar:B.far}),re=B.near,se=B.far),B.layers.mask=me.layers.mask|6,w.layers.mask=B.layers.mask&-5,T.layers.mask=B.layers.mask&-3;let j=me.parent,Te=B.cameras;z(B,j);for(let we=0;we<Te.length;we++)z(Te[we],j);Te.length===2?O(B,w,T):B.projectionMatrix.copy(w.projectionMatrix),ne(me,B,j)};function ne(me,V,ge){ge===null?me.matrix.copy(V.matrixWorld):(me.matrix.copy(ge.matrixWorld),me.matrix.invert(),me.matrix.multiply(V.matrixWorld)),me.matrix.decompose(me.position,me.quaternion,me.scale),me.updateMatrixWorld(!0),me.projectionMatrix.copy(V.projectionMatrix),me.projectionMatrixInverse.copy(V.projectionMatrixInverse),me.isPerspectiveCamera&&(me.fov=ur*2*Math.atan(1/me.projectionMatrix.elements[5]),me.zoom=1)}this.getCamera=function(){return B},this.getFoveation=function(){if(!(h===null&&u===null))return c},this.setFoveation=function(me){c=me,h!==null&&(h.fixedFoveation=me),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=me)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(B)},this.getCameraTexture=function(me){return p[me]};let _e=null;function Fe(me,V){if(d=V.getViewerPose(l||o),_=V,d!==null){let ge=d.views;u!==null&&(e.setRenderTargetFramebuffer(b,u.framebuffer),e.setRenderTarget(b));let j=!1;ge.length!==B.cameras.length&&(B.cameras.length=0,j=!0);for(let Le=0;Le<ge.length;Le++){let q=ge[Le],he=null;if(u!==null)he=u.getViewport(q);else{let Ae=f.getViewSubImage(h,q);he=Ae.viewport,Le===0&&(e.setRenderTargetTextures(b,Ae.colorTexture,Ae.depthStencilTexture),e.setRenderTarget(b))}let Me=U[Le];Me===void 0&&(Me=new an,Me.layers.enable(Le),Me.viewport=new Kt,U[Le]=Me),Me.matrix.fromArray(q.transform.matrix),Me.matrix.decompose(Me.position,Me.quaternion,Me.scale),Me.projectionMatrix.fromArray(q.projectionMatrix),Me.projectionMatrixInverse.copy(Me.projectionMatrix).invert(),Me.viewport.set(he.x,he.y,he.width,he.height),Le===0&&(B.matrix.copy(Me.matrix),B.matrix.decompose(B.position,B.quaternion,B.scale)),j===!0&&B.cameras.push(Me)}let Te=s.enabledFeatures;if(Te&&Te.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&y){f=n.getBinding();let Le=f.getDepthInformation(ge[0]);Le&&Le.isValid&&Le.texture&&g.init(Le,s.renderState)}if(Te&&Te.includes("camera-access")&&y){e.state.unbindTexture(),f=n.getBinding();for(let Le=0;Le<ge.length;Le++){let q=ge[Le].camera;if(q){let he=p[q];he||(he=new ro,p[q]=he);let Me=f.getCameraImage(q);he.sourceTexture=Me}}}}for(let ge=0;ge<I.length;ge++){let j=A[ge],Te=I[ge];j!==null&&Te!==void 0&&Te.update(j,V,l||o)}_e&&_e(me,V),V.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:V}),_=null}let Ye=new hf;Ye.setAnimationLoop(Fe),this.setAnimationLoop=function(me){_e=me},this.dispose=function(){}}},$x=new Wt,gf=new vt;gf.set(-1,0,0,0,1,0,0,0,1);function Zx(i,e){function t(g,p){g.matrixAutoUpdate===!0&&g.updateMatrix(),p.value.copy(g.matrix)}function n(g,p){p.color.getRGB(g.fogColor.value,bh(i)),p.isFog?(g.fogNear.value=p.near,g.fogFar.value=p.far):p.isFogExp2&&(g.fogDensity.value=p.density)}function s(g,p,S,E,b){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(g,p):p.isMeshLambertMaterial?(r(g,p),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(g,p),f(g,p)):p.isMeshPhongMaterial?(r(g,p),d(g,p),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(g,p),h(g,p),p.isMeshPhysicalMaterial&&u(g,p,b)):p.isMeshMatcapMaterial?(r(g,p),_(g,p)):p.isMeshDepthMaterial?r(g,p):p.isMeshDistanceMaterial?(r(g,p),y(g,p)):p.isMeshNormalMaterial?r(g,p):p.isLineBasicMaterial?(o(g,p),p.isLineDashedMaterial&&a(g,p)):p.isPointsMaterial?c(g,p,S,E):p.isSpriteMaterial?l(g,p):p.isShadowMaterial?(g.color.value.copy(p.color),g.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(g,p){g.opacity.value=p.opacity,p.color&&g.diffuse.value.copy(p.color),p.emissive&&g.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(g.map.value=p.map,t(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.bumpMap&&(g.bumpMap.value=p.bumpMap,t(p.bumpMap,g.bumpMapTransform),g.bumpScale.value=p.bumpScale,p.side===Dn&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,t(p.normalMap,g.normalMapTransform),g.normalScale.value.copy(p.normalScale),p.side===Dn&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,t(p.displacementMap,g.displacementMapTransform),g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,g.emissiveMapTransform)),p.specularMap&&(g.specularMap.value=p.specularMap,t(p.specularMap,g.specularMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest);let S=e.get(p),E=S.envMap,b=S.envMapRotation;E&&(g.envMap.value=E,g.envMapRotation.value.setFromMatrix4($x.makeRotationFromEuler(b)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(gf),g.reflectivity.value=p.reflectivity,g.ior.value=p.ior,g.refractionRatio.value=p.refractionRatio),p.lightMap&&(g.lightMap.value=p.lightMap,g.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,g.lightMapTransform)),p.aoMap&&(g.aoMap.value=p.aoMap,g.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,g.aoMapTransform))}function o(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,p.map&&(g.map.value=p.map,t(p.map,g.mapTransform))}function a(g,p){g.dashSize.value=p.dashSize,g.totalSize.value=p.dashSize+p.gapSize,g.scale.value=p.scale}function c(g,p,S,E){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.size.value=p.size*S,g.scale.value=E*.5,p.map&&(g.map.value=p.map,t(p.map,g.uvTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function l(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.rotation.value=p.rotation,p.map&&(g.map.value=p.map,t(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function d(g,p){g.specular.value.copy(p.specular),g.shininess.value=Math.max(p.shininess,1e-4)}function f(g,p){p.gradientMap&&(g.gradientMap.value=p.gradientMap)}function h(g,p){g.metalness.value=p.metalness,p.metalnessMap&&(g.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,g.metalnessMapTransform)),g.roughness.value=p.roughness,p.roughnessMap&&(g.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,g.roughnessMapTransform)),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)}function u(g,p,S){g.ior.value=p.ior,p.sheen>0&&(g.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),g.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(g.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,g.sheenColorMapTransform)),p.sheenRoughnessMap&&(g.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,g.sheenRoughnessMapTransform))),p.clearcoat>0&&(g.clearcoat.value=p.clearcoat,g.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(g.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,g.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(g.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Dn&&g.clearcoatNormalScale.value.negate())),p.dispersion>0&&(g.dispersion.value=p.dispersion),p.iridescence>0&&(g.iridescence.value=p.iridescence,g.iridescenceIOR.value=p.iridescenceIOR,g.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(g.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,g.iridescenceMapTransform)),p.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),p.transmission>0&&(g.transmission.value=p.transmission,g.transmissionSamplerMap.value=S.texture,g.transmissionSamplerSize.value.set(S.width,S.height),p.transmissionMap&&(g.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,g.transmissionMapTransform)),g.thickness.value=p.thickness,p.thicknessMap&&(g.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=p.attenuationDistance,g.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(g.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(g.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=p.specularIntensity,g.specularColor.value.copy(p.specularColor),p.specularColorMap&&(g.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,g.specularColorMapTransform)),p.specularIntensityMap&&(g.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,g.specularIntensityMapTransform))}function _(g,p){p.matcap&&(g.matcap.value=p.matcap)}function y(g,p){let S=e.get(p).light;g.referencePosition.value.setFromMatrixPosition(S.matrixWorld),g.nearDistance.value=S.shadow.camera.near,g.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Jx(i,e,t,n){let s={},r={},o=[],a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(b,I){let A=I.program;n.uniformBlockBinding(b,A)}function l(b,I){let A=s[b.id];A===void 0&&(g(b),A=d(b),s[b.id]=A,b.addEventListener("dispose",S));let F=I.program;n.updateUBOMapping(b,F);let m=e.render.frame;r[b.id]!==m&&(h(b),r[b.id]=m)}function d(b){let I=f();b.__bindingPointIndex=I;let A=i.createBuffer(),F=b.__size,m=b.usage;return i.bindBuffer(i.UNIFORM_BUFFER,A),i.bufferData(i.UNIFORM_BUFFER,F,m),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,I,A),A}function f(){for(let b=0;b<a;b++)if(o.indexOf(b)===-1)return o.push(b),b;return mt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(b){let I=s[b.id],A=b.uniforms,F=b.__cache;i.bindBuffer(i.UNIFORM_BUFFER,I);for(let m=0,w=A.length;m<w;m++){let T=A[m];if(Array.isArray(T))for(let U=0,B=T.length;U<B;U++)u(T[U],m,U,F);else u(T,m,0,F)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function u(b,I,A,F){if(y(b,I,A,F)===!0){let m=b.__offset,w=b.value;if(Array.isArray(w)){let T=0;for(let U=0;U<w.length;U++){let B=w[U],re=p(B);_(B,b.__data,T),typeof B!="number"&&typeof B!="boolean"&&!B.isMatrix3&&!ArrayBuffer.isView(B)&&(T+=re.storage/Float32Array.BYTES_PER_ELEMENT)}}else _(w,b.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,m,b.__data)}}function _(b,I,A){typeof b=="number"||typeof b=="boolean"?I[0]=b:b.isMatrix3?(I[0]=b.elements[0],I[1]=b.elements[1],I[2]=b.elements[2],I[3]=0,I[4]=b.elements[3],I[5]=b.elements[4],I[6]=b.elements[5],I[7]=0,I[8]=b.elements[6],I[9]=b.elements[7],I[10]=b.elements[8],I[11]=0):ArrayBuffer.isView(b)?I.set(new b.constructor(b.buffer,b.byteOffset,I.length)):b.toArray(I,A)}function y(b,I,A,F){let m=b.value,w=I+"_"+A;if(F[w]===void 0)return typeof m=="number"||typeof m=="boolean"?F[w]=m:ArrayBuffer.isView(m)?F[w]=m.slice():F[w]=m.clone(),!0;{let T=F[w];if(typeof m=="number"||typeof m=="boolean"){if(T!==m)return F[w]=m,!0}else{if(ArrayBuffer.isView(m))return!0;if(T.equals(m)===!1)return T.copy(m),!0}}return!1}function g(b){let I=b.uniforms,A=0,F=16;for(let w=0,T=I.length;w<T;w++){let U=Array.isArray(I[w])?I[w]:[I[w]];for(let B=0,re=U.length;B<re;B++){let se=U[B],Z=Array.isArray(se.value)?se.value:[se.value];for(let ee=0,ae=Z.length;ee<ae;ee++){let ye=Z[ee],be=p(ye),O=A%F,z=O%be.boundary,ne=O+z;A+=z,ne!==0&&F-ne<be.storage&&(A+=F-ne),se.__data=new Float32Array(be.storage/Float32Array.BYTES_PER_ELEMENT),se.__offset=A,A+=be.storage}}}let m=A%F;return m>0&&(A+=F-m),b.__size=A,b.__cache={},this}function p(b){let I={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(I.boundary=4,I.storage=4):b.isVector2?(I.boundary=8,I.storage=8):b.isVector3||b.isColor?(I.boundary=16,I.storage=12):b.isVector4?(I.boundary=16,I.storage=16):b.isMatrix3?(I.boundary=48,I.storage=48):b.isMatrix4?(I.boundary=64,I.storage=64):b.isTexture?ft("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(b)?(I.boundary=16,I.storage=b.byteLength):ft("WebGLRenderer: Unsupported uniform value type.",b),I}function S(b){let I=b.target;I.removeEventListener("dispose",S);let A=o.indexOf(I.__bindingPointIndex);o.splice(A,1),i.deleteBuffer(s[I.id]),delete s[I.id],delete r[I.id]}function E(){for(let b in s)i.deleteBuffer(s[b]);o=[],s={},r={}}return{bind:c,update:l,dispose:E}}var Kx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Li=null;function jx(){return Li===null&&(Li=new Ra(Kx,16,16,bs,Ii),Li.name="DFG_LUT",Li.minFilter=yn,Li.magFilter=yn,Li.wrapS=Ti,Li.wrapT=Ti,Li.generateMipmaps=!1,Li.needsUpdate=!0),Li}var Ni=class{constructor(e={}){let{canvas:t=Pd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:h=!1,outputBufferType:u=Fn}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=n.getContextAttributes().alpha}else _=o;let y=u,g=new Set([hl,cl,ll]),p=new Set([Fn,xi,Er,wr,ol,al]),S=new Uint32Array(4),E=new Int32Array(4),b=new L,I=null,A=null,F=[],m=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=_i,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,U=!1,B=null,re=null,se=null,Z=null;this._outputColorSpace=Zt;let ee=0,ae=0,ye=null,be=-1,O=null,z=new Kt,ne=new Kt,_e=null,Fe=new _t(0),Ye=0,me=t.width,V=t.height,ge=1,j=null,Te=null,we=new Kt(0,0,me,V),Re=new Kt(0,0,me,V),Le=!1,q=new mr,he=!1,Me=!1,Ae=new Wt,Be=new L,ke=new Kt,qe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},$e=!1;function it(){return ye===null?ge:1}let X=n;function gt(M,$){return t.getContext(M,$)}try{let M={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:d,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",yt,!1),t.addEventListener("webglcontextrestored",P,!1),t.addEventListener("webglcontextcreationerror",pt,!1),X===null){let $="webgl2";if(X=gt($,M),X===null)throw gt($)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(M){throw mt("WebGLRenderer: "+M.message),M}let ot,R,x,Q,ue,xe,Pe,Ue,fe,ve,C,Y,W,K,Ie,Ve,Ge,H,De,N,G,Se,J;function He(){ot=new r_(X),ot.init(),G=new Xx(X,ot),R=new Kg(X,ot,e,G),x=new Gx(X,ot),R.reversedDepthBuffer&&h&&x.buffers.depth.setReversed(!0),re=X.createFramebuffer(),se=X.createFramebuffer(),Z=X.createFramebuffer(),Q=new l_(X),ue=new Cx,xe=new Wx(X,ot,x,ue,R,G,Q),Pe=new s_(T),Ue=new dm(X),Se=new Zg(X,Ue),fe=new o_(X,Ue,Q,Se),ve=new h_(X,fe,Ue,Se,Q),H=new c_(X,R,xe),Ie=new jg(ue),C=new Rx(T,Pe,ot,R,Se,Ie),Y=new Zx(T,ue),W=new Ix,K=new Ox(ot),Ge=new $g(T,Pe,x,ve,_,c),Ve=new Hx(T,ve,R),J=new Jx(X,Q,R,x),De=new Jg(X,ot,Q),N=new a_(X,ot,Q),Q.programs=C.programs,T.capabilities=R,T.extensions=ot,T.properties=ue,T.renderLists=W,T.shadowMap=Ve,T.state=x,T.info=Q}He(),y!==Fn&&(w=new d_(y,t.width,t.height,a,s,r));let Oe=new Wh(T,X);this.xr=Oe,this.getContext=function(){return X},this.getContextAttributes=function(){return X.getContextAttributes()},this.forceContextLoss=function(){let M=ot.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=ot.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return ge},this.setPixelRatio=function(M){M!==void 0&&(ge=M,this.setSize(me,V,!1))},this.getSize=function(M){return M.set(me,V)},this.setSize=function(M,$,le=!0){if(Oe.isPresenting){ft("WebGLRenderer: Can't change size while VR device is presenting.");return}me=M,V=$,t.width=Math.floor(M*ge),t.height=Math.floor($*ge),le===!0&&(t.style.width=M+"px",t.style.height=$+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,M,$)},this.getDrawingBufferSize=function(M){return M.set(me*ge,V*ge).floor()},this.setDrawingBufferSize=function(M,$,le){me=M,V=$,ge=le,t.width=Math.floor(M*le),t.height=Math.floor($*le),this.setViewport(0,0,M,$)},this.setEffects=function(M){if(y===Fn){mt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let $=0;$<M.length;$++)if(M[$].isOutputPass===!0){ft("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(z)},this.getViewport=function(M){return M.copy(we)},this.setViewport=function(M,$,le,ce){M.isVector4?we.set(M.x,M.y,M.z,M.w):we.set(M,$,le,ce),x.viewport(z.copy(we).multiplyScalar(ge).round())},this.getScissor=function(M){return M.copy(Re)},this.setScissor=function(M,$,le,ce){M.isVector4?Re.set(M.x,M.y,M.z,M.w):Re.set(M,$,le,ce),x.scissor(ne.copy(Re).multiplyScalar(ge).round())},this.getScissorTest=function(){return Le},this.setScissorTest=function(M){x.setScissorTest(Le=M)},this.setOpaqueSort=function(M){j=M},this.setTransparentSort=function(M){Te=M},this.getClearColor=function(M){return M.copy(Ge.getClearColor())},this.setClearColor=function(){Ge.setClearColor(...arguments)},this.getClearAlpha=function(){return Ge.getClearAlpha()},this.setClearAlpha=function(){Ge.setClearAlpha(...arguments)},this.clear=function(M=!0,$=!0,le=!0){let ce=0;if(M){let pe=!1;if(ye!==null){let je=ye.texture.format;pe=g.has(je)}if(pe){let je=ye.texture.type,tt=p.has(je),Je=Ge.getClearColor(),st=Ge.getClearAlpha(),at=Je.r,xt=Je.g,Mt=Je.b;tt?(S[0]=at,S[1]=xt,S[2]=Mt,S[3]=st,X.clearBufferuiv(X.COLOR,0,S)):(E[0]=at,E[1]=xt,E[2]=Mt,E[3]=st,X.clearBufferiv(X.COLOR,0,E))}else ce|=X.COLOR_BUFFER_BIT}$&&(ce|=X.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),le&&(ce|=X.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),ce!==0&&X.clear(ce)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),B=M},this.dispose=function(){t.removeEventListener("webglcontextlost",yt,!1),t.removeEventListener("webglcontextrestored",P,!1),t.removeEventListener("webglcontextcreationerror",pt,!1),Ge.dispose(),W.dispose(),K.dispose(),ue.dispose(),Pe.dispose(),ve.dispose(),Se.dispose(),J.dispose(),C.dispose(),Oe.dispose(),Oe.removeEventListener("sessionstart",ri),Oe.removeEventListener("sessionend",Es),Rn.stop()};function yt(M){M.preventDefault(),xh("WebGLRenderer: Context Lost."),U=!0}function P(){xh("WebGLRenderer: Context Restored."),U=!1;let M=Q.autoReset,$=Ve.enabled,le=Ve.autoUpdate,ce=Ve.needsUpdate,pe=Ve.type;He(),Q.autoReset=M,Ve.enabled=$,Ve.autoUpdate=le,Ve.needsUpdate=ce,Ve.type=pe}function pt(M){mt("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function en(M){let $=M.target;$.removeEventListener("dispose",en),Nn($)}function Nn(M){mn(M),ue.remove(M)}function mn(M){let $=ue.get(M).programs;$!==void 0&&($.forEach(function(le){C.releaseProgram(le)}),M.isShaderMaterial&&C.releaseShaderCache(M))}this.renderBufferDirect=function(M,$,le,ce,pe,je){$===null&&($=qe);let tt=pe.isMesh&&pe.matrixWorld.determinantAffine()<0,Je=We(M,$,le,ce,pe);x.setMaterial(ce,tt);let st=le.index,at=1;if(ce.wireframe===!0){if(st=fe.getWireframeAttribute(le),st===void 0)return;at=2}let xt=le.drawRange,Mt=le.attributes.position,lt=xt.start*at,Ot=(xt.start+xt.count)*at;je!==null&&(lt=Math.max(lt,je.start*at),Ot=Math.min(Ot,(je.start+je.count)*at)),st!==null?(lt=Math.max(lt,0),Ot=Math.min(Ot,st.count)):Mt!=null&&(lt=Math.max(lt,0),Ot=Math.min(Ot,Mt.count));let jt=Ot-lt;if(jt<0||jt===1/0)return;Se.setup(pe,ce,Je,le,st);let It,Vt=De;if(st!==null&&(It=Ue.get(st),Vt=N,Vt.setIndex(It)),pe.isMesh)ce.wireframe===!0?(x.setLineWidth(ce.wireframeLinewidth*it()),Vt.setMode(X.LINES)):Vt.setMode(X.TRIANGLES);else if(pe.isLine){let dn=ce.linewidth;dn===void 0&&(dn=1),x.setLineWidth(dn*it()),pe.isLineSegments?Vt.setMode(X.LINES):pe.isLineLoop?Vt.setMode(X.LINE_LOOP):Vt.setMode(X.LINE_STRIP)}else pe.isPoints?Vt.setMode(X.POINTS):pe.isSprite&&Vt.setMode(X.TRIANGLES);if(pe.isBatchedMesh)if(ot.get("WEBGL_multi_draw"))Vt.renderMultiDraw(pe._multiDrawStarts,pe._multiDrawCounts,pe._multiDrawCount);else{let dn=pe._multiDrawStarts,Ke=pe._multiDrawCounts,dt=pe._multiDrawCount,At=st?Ue.get(st).bytesPerElement:1,Cn=ue.get(ce).currentProgram.getUniforms();for(let Un=0;Un<dt;Un++)Cn.setValue(X,"_gl_DrawID",Un),Vt.render(dn[Un]/At,Ke[Un])}else if(pe.isInstancedMesh)Vt.renderInstances(lt,jt,pe.count);else if(le.isInstancedBufferGeometry){let dn=le._maxInstanceCount!==void 0?le._maxInstanceCount:1/0,Ke=Math.min(le.instanceCount,dn);Vt.renderInstances(lt,jt,Ke)}else Vt.render(lt,jt)};function gn(M,$,le){M.transparent===!0&&M.side===Ci&&M.forceSinglePass===!1?(M.side=Dn,M.needsUpdate=!0,Kn(M,$,le),M.side=$i,M.needsUpdate=!0,Kn(M,$,le),M.side=Ci):Kn(M,$,le)}this.compile=function(M,$,le=null){le===null&&(le=M),A=K.get(le),A.init($),m.push(A),le.traverseVisible(function(pe){pe.isLight&&pe.layers.test($.layers)&&(A.pushLight(pe),pe.castShadow&&A.pushShadow(pe))}),M!==le&&M.traverseVisible(function(pe){pe.isLight&&pe.layers.test($.layers)&&(A.pushLight(pe),pe.castShadow&&A.pushShadow(pe))}),A.setupLights();let ce=new Set;return M.traverse(function(pe){if(!(pe.isMesh||pe.isPoints||pe.isLine||pe.isSprite))return;let je=pe.material;if(je)if(Array.isArray(je))for(let tt=0;tt<je.length;tt++){let Je=je[tt];gn(Je,le,pe),ce.add(Je)}else gn(je,le,pe),ce.add(je)}),A=m.pop(),ce},this.compileAsync=function(M,$,le=null){let ce=this.compile(M,$,le);return new Promise(pe=>{function je(){if(ce.forEach(function(tt){ue.get(tt).currentProgram.isReady()&&ce.delete(tt)}),ce.size===0){pe(M);return}setTimeout(je,10)}ot.get("KHR_parallel_shader_compile")!==null?je():setTimeout(je,10)})};let si=null;function vi(M){si&&si(M)}function ri(){Rn.stop()}function Es(){Rn.start()}let Rn=new hf;Rn.setAnimationLoop(vi),typeof self<"u"&&Rn.setContext(self),this.setAnimationLoop=function(M){si=M,Oe.setAnimationLoop(M),M===null?Rn.stop():Rn.start()},Oe.addEventListener("sessionstart",ri),Oe.addEventListener("sessionend",Es),this.render=function(M,$){if($!==void 0&&$.isCamera!==!0){mt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(U===!0)return;B!==null&&B.renderStart(M,$);let le=Oe.enabled===!0&&Oe.isPresenting===!0,ce=w!==null&&(ye===null||le)&&w.begin(T,ye);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),$.parent===null&&$.matrixWorldAutoUpdate===!0&&$.updateMatrixWorld(),Oe.enabled===!0&&Oe.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Oe.cameraAutoUpdate===!0&&Oe.updateCamera($),$=Oe.getCamera()),M.isScene===!0&&M.onBeforeRender(T,M,$,ye),A=K.get(M,m.length),A.init($),A.state.textureUnits=xe.getTextureUnits(),m.push(A),Ae.multiplyMatrices($.projectionMatrix,$.matrixWorldInverse),q.setFromProjectionMatrix(Ae,ui,$.reversedDepth),Me=this.localClippingEnabled,he=Ie.init(this.clippingPlanes,Me),I=W.get(M,F.length),I.init(),F.push(I),Oe.enabled===!0&&Oe.isPresenting===!0){let tt=T.xr.getDepthSensingMesh();tt!==null&&ws(tt,$,-1/0,T.sortObjects)}ws(M,$,0,T.sortObjects),I.finish(),T.sortObjects===!0&&I.sort(j,Te,$.reversedDepth),$e=Oe.enabled===!1||Oe.isPresenting===!1||Oe.hasDepthSensing()===!1,$e&&Ge.addToRenderList(I,M),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),he===!0&&Ie.beginShadows();let pe=A.state.shadowsArray;if(Ve.render(pe,M,$),he===!0&&Ie.endShadows(),(ce&&w.hasRenderPass())===!1){let tt=I.opaque,Je=I.transmissive;if(A.setupLights(),$.isArrayCamera){let st=$.cameras;if(Je.length>0)for(let at=0,xt=st.length;at<xt;at++){let Mt=st[at];Bi(tt,Je,M,Mt)}$e&&Ge.render(M);for(let at=0,xt=st.length;at<xt;at++){let Mt=st[at];Oi(I,M,Mt,Mt.viewport)}}else Je.length>0&&Bi(tt,Je,M,$),$e&&Ge.render(M),Oi(I,M,$)}ye!==null&&ae===0&&(xe.updateMultisampleRenderTarget(ye),xe.updateRenderTargetMipmap(ye)),ce&&w.end(T),M.isScene===!0&&M.onAfterRender(T,M,$),Se.resetDefaultState(),be=-1,O=null,m.pop(),m.length>0?(A=m[m.length-1],xe.setTextureUnits(A.state.textureUnits),he===!0&&Ie.setGlobalState(T.clippingPlanes,A.state.camera)):A=null,F.pop(),F.length>0?I=F[F.length-1]:I=null,B!==null&&B.renderEnd()};function ws(M,$,le,ce){if(M.visible===!1)return;if(M.layers.test($.layers)){if(M.isGroup)le=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update($);else if(M.isLightProbeGrid)A.pushLightProbeGrid(M);else if(M.isLight)A.pushLight(M),M.castShadow&&A.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||q.intersectsSprite(M)){ce&&ke.setFromMatrixPosition(M.matrixWorld).applyMatrix4(Ae);let tt=ve.update(M),Je=M.material;Je.visible&&I.push(M,tt,Je,le,ke.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||q.intersectsObject(M))){let tt=ve.update(M),Je=M.material;if(ce&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),ke.copy(M.boundingSphere.center)):(tt.boundingSphere===null&&tt.computeBoundingSphere(),ke.copy(tt.boundingSphere.center)),ke.applyMatrix4(M.matrixWorld).applyMatrix4(Ae)),Array.isArray(Je)){let st=tt.groups;for(let at=0,xt=st.length;at<xt;at++){let Mt=st[at],lt=Je[Mt.materialIndex];lt&&lt.visible&&I.push(M,tt,lt,le,ke.z,Mt)}}else Je.visible&&I.push(M,tt,Je,le,ke.z,null)}}let je=M.children;for(let tt=0,Je=je.length;tt<Je;tt++)ws(je[tt],$,le,ce)}function Oi(M,$,le,ce){let{opaque:pe,transmissive:je,transparent:tt}=M;A.setupLightsView(le),he===!0&&Ie.setGlobalState(T.clippingPlanes,le),ce&&x.viewport(z.copy(ce)),pe.length>0&&tn(pe,$,le),je.length>0&&tn(je,$,le),tt.length>0&&tn(tt,$,le),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function Bi(M,$,le,ce){if((le.isScene===!0?le.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[ce.id]===void 0){let lt=ot.has("EXT_color_buffer_half_float")||ot.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[ce.id]=new Xn(1,1,{generateMipmaps:!0,type:lt?Ii:Fn,minFilter:ys,samples:Math.max(4,R.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ct.workingColorSpace})}let je=A.state.transmissionRenderTarget[ce.id],tt=ce.viewport||z;je.setSize(tt.z*T.transmissionResolutionScale,tt.w*T.transmissionResolutionScale);let Je=T.getRenderTarget(),st=T.getActiveCubeFace(),at=T.getActiveMipmapLevel();T.setRenderTarget(je),T.getClearColor(Fe),Ye=T.getClearAlpha(),Ye<1&&T.setClearColor(16777215,.5),T.clear(),$e&&Ge.render(le);let xt=T.toneMapping;T.toneMapping=_i;let Mt=ce.viewport;if(ce.viewport!==void 0&&(ce.viewport=void 0),A.setupLightsView(ce),he===!0&&Ie.setGlobalState(T.clippingPlanes,ce),tn(M,le,ce),xe.updateMultisampleRenderTarget(je),xe.updateRenderTargetMipmap(je),ot.has("WEBGL_multisampled_render_to_texture")===!1){let lt=!1;for(let Ot=0,jt=$.length;Ot<jt;Ot++){let It=$[Ot],{object:Vt,geometry:dn,material:Ke,group:dt}=It;if(Ke.side===Ci&&Vt.layers.test(ce.layers)){let At=Ke.side;Ke.side=Dn,Ke.needsUpdate=!0,sn(Vt,le,ce,dn,Ke,dt),Ke.side=At,Ke.needsUpdate=!0,lt=!0}}lt===!0&&(xe.updateMultisampleRenderTarget(je),xe.updateRenderTargetMipmap(je))}T.setRenderTarget(Je,st,at),T.setClearColor(Fe,Ye),Mt!==void 0&&(ce.viewport=Mt),T.toneMapping=xt}function tn(M,$,le){let ce=$.isScene===!0?$.overrideMaterial:null;for(let pe=0,je=M.length;pe<je;pe++){let tt=M[pe],{object:Je,geometry:st,group:at}=tt,xt=tt.material;xt.allowOverride===!0&&ce!==null&&(xt=ce),Je.layers.test(le.layers)&&sn(Je,$,le,st,xt,at)}}function sn(M,$,le,ce,pe,je){M.onBeforeRender(T,$,le,ce,pe,je),M.modelViewMatrix.multiplyMatrices(le.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),pe.onBeforeRender(T,$,le,ce,M,je),pe.transparent===!0&&pe.side===Ci&&pe.forceSinglePass===!1?(pe.side=Dn,pe.needsUpdate=!0,T.renderBufferDirect(le,$,ce,pe,M,je),pe.side=$i,pe.needsUpdate=!0,T.renderBufferDirect(le,$,ce,pe,M,je),pe.side=Ci):T.renderBufferDirect(le,$,ce,pe,M,je),M.onAfterRender(T,$,le,ce,pe,je)}function Kn(M,$,le){$.isScene!==!0&&($=qe);let ce=ue.get(M),pe=A.state.lights,je=A.state.shadowsArray,tt=pe.state.version,Je=C.getParameters(M,pe.state,je,$,le,A.state.lightProbeGridArray),st=C.getProgramCacheKey(Je),at=ce.programs;ce.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?$.environment:null,ce.fog=$.fog;let xt=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;ce.envMap=Pe.get(M.envMap||ce.environment,xt),ce.envMapRotation=ce.environment!==null&&M.envMap===null?$.environmentRotation:M.envMapRotation,at===void 0&&(M.addEventListener("dispose",en),at=new Map,ce.programs=at);let Mt=at.get(st);if(Mt!==void 0){if(ce.currentProgram===Mt&&ce.lightsStateVersion===tt)return Ne(M,Je),Mt}else Je.uniforms=C.getUniforms(M),B!==null&&M.isNodeMaterial&&B.build(M,le,Je),M.onBeforeCompile(Je,T),Mt=C.acquireProgram(Je,st),at.set(st,Mt),ce.uniforms=Je.uniforms;let lt=ce.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(lt.clippingPlanes=Ie.uniform),Ne(M,Je),ce.needsLights=bt(M),ce.lightsStateVersion=tt,ce.needsLights&&(lt.ambientLightColor.value=pe.state.ambient,lt.lightProbe.value=pe.state.probe,lt.directionalLights.value=pe.state.directional,lt.directionalLightShadows.value=pe.state.directionalShadow,lt.spotLights.value=pe.state.spot,lt.spotLightShadows.value=pe.state.spotShadow,lt.rectAreaLights.value=pe.state.rectArea,lt.ltc_1.value=pe.state.rectAreaLTC1,lt.ltc_2.value=pe.state.rectAreaLTC2,lt.pointLights.value=pe.state.point,lt.pointLightShadows.value=pe.state.pointShadow,lt.hemisphereLights.value=pe.state.hemi,lt.directionalShadowMatrix.value=pe.state.directionalShadowMatrix,lt.spotLightMatrix.value=pe.state.spotLightMatrix,lt.spotLightMap.value=pe.state.spotLightMap,lt.pointShadowMatrix.value=pe.state.pointShadowMatrix),ce.lightProbeGrid=A.state.lightProbeGridArray.length>0,ce.currentProgram=Mt,ce.uniformsList=null,Mt}function oe(M){if(M.uniformsList===null){let $=M.currentProgram.getUniforms();M.uniformsList=Ar.seqWithValue($.seq,M.uniforms)}return M.uniformsList}function Ne(M,$){let le=ue.get(M);le.outputColorSpace=$.outputColorSpace,le.batching=$.batching,le.batchingColor=$.batchingColor,le.instancing=$.instancing,le.instancingColor=$.instancingColor,le.instancingMorph=$.instancingMorph,le.skinning=$.skinning,le.morphTargets=$.morphTargets,le.morphNormals=$.morphNormals,le.morphColors=$.morphColors,le.morphTargetsCount=$.morphTargetsCount,le.numClippingPlanes=$.numClippingPlanes,le.numIntersection=$.numClipIntersection,le.vertexAlphas=$.vertexAlphas,le.vertexTangents=$.vertexTangents,le.toneMapping=$.toneMapping}function Ee(M,$){if(M.length===0)return null;if(M.length===1)return M[0].texture!==null?M[0]:null;b.setFromMatrixPosition($.matrixWorld);for(let le=0,ce=M.length;le<ce;le++){let pe=M[le];if(pe.texture!==null&&pe.boundingBox.containsPoint(b))return pe}return null}function We(M,$,le,ce,pe){$.isScene!==!0&&($=qe),xe.resetTextureUnits();let je=$.fog,tt=ce.isMeshStandardMaterial||ce.isMeshLambertMaterial||ce.isMeshPhongMaterial?$.environment:null,Je=ye===null?T.outputColorSpace:ye.isXRRenderTarget===!0?ye.texture.colorSpace:Ct.workingColorSpace,st=ce.isMeshStandardMaterial||ce.isMeshLambertMaterial&&!ce.envMap||ce.isMeshPhongMaterial&&!ce.envMap,at=Pe.get(ce.envMap||tt,st),xt=ce.vertexColors===!0&&!!le.attributes.color&&le.attributes.color.itemSize===4,Mt=!!le.attributes.tangent&&(!!ce.normalMap||ce.anisotropy>0),lt=!!le.morphAttributes.position,Ot=!!le.morphAttributes.normal,jt=!!le.morphAttributes.color,It=_i;ce.toneMapped&&(ye===null||ye.isXRRenderTarget===!0)&&(It=T.toneMapping);let Vt=le.morphAttributes.position||le.morphAttributes.normal||le.morphAttributes.color,dn=Vt!==void 0?Vt.length:0,Ke=ue.get(ce),dt=A.state.lights;if(he===!0&&(Me===!0||M!==O)){let Ut=M===O&&ce.id===be;Ie.setState(ce,M,Ut)}let At=!1;ce.version===Ke.__version?(Ke.needsLights&&Ke.lightsStateVersion!==dt.state.version||Ke.outputColorSpace!==Je||pe.isBatchedMesh&&Ke.batching===!1||!pe.isBatchedMesh&&Ke.batching===!0||pe.isBatchedMesh&&Ke.batchingColor===!0&&pe.colorTexture===null||pe.isBatchedMesh&&Ke.batchingColor===!1&&pe.colorTexture!==null||pe.isInstancedMesh&&Ke.instancing===!1||!pe.isInstancedMesh&&Ke.instancing===!0||pe.isSkinnedMesh&&Ke.skinning===!1||!pe.isSkinnedMesh&&Ke.skinning===!0||pe.isInstancedMesh&&Ke.instancingColor===!0&&pe.instanceColor===null||pe.isInstancedMesh&&Ke.instancingColor===!1&&pe.instanceColor!==null||pe.isInstancedMesh&&Ke.instancingMorph===!0&&pe.morphTexture===null||pe.isInstancedMesh&&Ke.instancingMorph===!1&&pe.morphTexture!==null||Ke.envMap!==at||ce.fog===!0&&Ke.fog!==je||Ke.numClippingPlanes!==void 0&&(Ke.numClippingPlanes!==Ie.numPlanes||Ke.numIntersection!==Ie.numIntersection)||Ke.vertexAlphas!==xt||Ke.vertexTangents!==Mt||Ke.morphTargets!==lt||Ke.morphNormals!==Ot||Ke.morphColors!==jt||Ke.toneMapping!==It||Ke.morphTargetsCount!==dn||!!Ke.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(At=!0):(At=!0,Ke.__version=ce.version);let Cn=Ke.currentProgram;At===!0&&(Cn=Kn(ce,$,pe),B&&ce.isNodeMaterial&&B.onUpdateProgram(ce,Cn,Ke));let Un=!1,oi=!1,_n=!1,Ft=Cn.getUniforms(),qt=Ke.uniforms;if(x.useProgram(Cn.program)&&(Un=!0,oi=!0,_n=!0),ce.id!==be&&(be=ce.id,oi=!0),Ke.needsLights){let Ut=Ee(A.state.lightProbeGridArray,pe);Ke.lightProbeGrid!==Ut&&(Ke.lightProbeGrid=Ut,oi=!0)}if(Un||O!==M){x.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),Ft.setValue(X,"projectionMatrix",M.projectionMatrix),Ft.setValue(X,"viewMatrix",M.matrixWorldInverse);let ai=Ft.map.cameraPosition;ai!==void 0&&ai.setValue(X,Be.setFromMatrixPosition(M.matrixWorld)),R.logarithmicDepthBuffer&&Ft.setValue(X,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(ce.isMeshPhongMaterial||ce.isMeshToonMaterial||ce.isMeshLambertMaterial||ce.isMeshBasicMaterial||ce.isMeshStandardMaterial||ce.isShaderMaterial)&&Ft.setValue(X,"isOrthographic",M.isOrthographicCamera===!0),O!==M&&(O=M,oi=!0,_n=!0)}if(Ke.needsLights&&(dt.state.directionalShadowMap.length>0&&Ft.setValue(X,"directionalShadowMap",dt.state.directionalShadowMap,xe),dt.state.spotShadowMap.length>0&&Ft.setValue(X,"spotShadowMap",dt.state.spotShadowMap,xe),dt.state.pointShadowMap.length>0&&Ft.setValue(X,"pointShadowMap",dt.state.pointShadowMap,xe)),pe.isSkinnedMesh){Ft.setOptional(X,pe,"bindMatrix"),Ft.setOptional(X,pe,"bindMatrixInverse");let Ut=pe.skeleton;Ut&&(Ut.boneTexture===null&&Ut.computeBoneTexture(),Ft.setValue(X,"boneTexture",Ut.boneTexture,xe))}pe.isBatchedMesh&&(Ft.setOptional(X,pe,"batchingTexture"),Ft.setValue(X,"batchingTexture",pe._matricesTexture,xe),Ft.setOptional(X,pe,"batchingIdTexture"),Ft.setValue(X,"batchingIdTexture",pe._indirectTexture,xe),Ft.setOptional(X,pe,"batchingColorTexture"),pe._colorsTexture!==null&&Ft.setValue(X,"batchingColorTexture",pe._colorsTexture,xe));let bi=le.morphAttributes;if((bi.position!==void 0||bi.normal!==void 0||bi.color!==void 0)&&H.update(pe,le,Cn),(oi||Ke.receiveShadow!==pe.receiveShadow)&&(Ke.receiveShadow=pe.receiveShadow,Ft.setValue(X,"receiveShadow",pe.receiveShadow)),(ce.isMeshStandardMaterial||ce.isMeshLambertMaterial||ce.isMeshPhongMaterial)&&ce.envMap===null&&$.environment!==null&&(qt.envMapIntensity.value=$.environmentIntensity),qt.dfgLUT!==void 0&&(qt.dfgLUT.value=jx()),oi){if(Ft.setValue(X,"toneMappingExposure",T.toneMappingExposure),Ke.needsLights&&ht(qt,_n),je&&ce.fog===!0&&Y.refreshFogUniforms(qt,je),Y.refreshMaterialUniforms(qt,ce,ge,V,A.state.transmissionRenderTarget[M.id]),Ke.needsLights&&Ke.lightProbeGrid){let Ut=Ke.lightProbeGrid;qt.probesSH.value=Ut.texture,qt.probesMin.value.copy(Ut.boundingBox.min),qt.probesMax.value.copy(Ut.boundingBox.max),qt.probesResolution.value.copy(Ut.resolution)}Ar.upload(X,oe(Ke),qt,xe)}if(ce.isShaderMaterial&&ce.uniformsNeedUpdate===!0&&(Ar.upload(X,oe(Ke),qt,xe),ce.uniformsNeedUpdate=!1),ce.isSpriteMaterial&&Ft.setValue(X,"center",pe.center),Ft.setValue(X,"modelViewMatrix",pe.modelViewMatrix),Ft.setValue(X,"normalMatrix",pe.normalMatrix),Ft.setValue(X,"modelMatrix",pe.matrixWorld),ce.uniformsGroups!==void 0){let Ut=ce.uniformsGroups;for(let ai=0,es=Ut.length;ai<es;ai++){let Fr=Ut[ai];J.update(Fr,Cn),J.bind(Fr,Cn)}}return Cn}function ht(M,$){M.ambientLightColor.needsUpdate=$,M.lightProbe.needsUpdate=$,M.directionalLights.needsUpdate=$,M.directionalLightShadows.needsUpdate=$,M.pointLights.needsUpdate=$,M.pointLightShadows.needsUpdate=$,M.spotLights.needsUpdate=$,M.spotLightShadows.needsUpdate=$,M.rectAreaLights.needsUpdate=$,M.hemisphereLights.needsUpdate=$}function bt(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return ee},this.getActiveMipmapLevel=function(){return ae},this.getRenderTarget=function(){return ye},this.setRenderTargetTextures=function(M,$,le){let ce=ue.get(M);ce.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,ce.__autoAllocateDepthBuffer===!1&&(ce.__useRenderToTexture=!1),ue.get(M.texture).__webglTexture=$,ue.get(M.depthTexture).__webglTexture=ce.__autoAllocateDepthBuffer?void 0:le,ce.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,$){let le=ue.get(M);le.__webglFramebuffer=$,le.__useDefaultFramebuffer=$===void 0},this.setRenderTarget=function(M,$=0,le=0){ye=M,ee=$,ae=le;let ce=null,pe=!1,je=!1;if(M){let Je=ue.get(M);if(Je.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(X.FRAMEBUFFER,Je.__webglFramebuffer),z.copy(M.viewport),ne.copy(M.scissor),_e=M.scissorTest,x.viewport(z),x.scissor(ne),x.setScissorTest(_e),be=-1;return}else if(Je.__webglFramebuffer===void 0)xe.setupRenderTarget(M);else if(Je.__hasExternalTextures)xe.rebindTextures(M,ue.get(M.texture).__webglTexture,ue.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let xt=M.depthTexture;if(Je.__boundDepthTexture!==xt){if(xt!==null&&ue.has(xt)&&(M.width!==xt.image.width||M.height!==xt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");xe.setupDepthRenderbuffer(M)}}let st=M.texture;(st.isData3DTexture||st.isDataArrayTexture||st.isCompressedArrayTexture)&&(je=!0);let at=ue.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(at[$])?ce=at[$][le]:ce=at[$],pe=!0):M.samples>0&&xe.useMultisampledRTT(M)===!1?ce=ue.get(M).__webglMultisampledFramebuffer:Array.isArray(at)?ce=at[le]:ce=at,z.copy(M.viewport),ne.copy(M.scissor),_e=M.scissorTest}else z.copy(we).multiplyScalar(ge).floor(),ne.copy(Re).multiplyScalar(ge).floor(),_e=Le;if(le!==0&&(ce=re),x.bindFramebuffer(X.FRAMEBUFFER,ce)&&x.drawBuffers(M,ce),x.viewport(z),x.scissor(ne),x.setScissorTest(_e),pe){let Je=ue.get(M.texture);X.framebufferTexture2D(X.FRAMEBUFFER,X.COLOR_ATTACHMENT0,X.TEXTURE_CUBE_MAP_POSITIVE_X+$,Je.__webglTexture,le)}else if(je){let Je=$;for(let st=0;st<M.textures.length;st++){let at=ue.get(M.textures[st]);X.framebufferTextureLayer(X.FRAMEBUFFER,X.COLOR_ATTACHMENT0+st,at.__webglTexture,le,Je)}}else if(M!==null&&le!==0){let Je=ue.get(M.texture);X.framebufferTexture2D(X.FRAMEBUFFER,X.COLOR_ATTACHMENT0,X.TEXTURE_2D,Je.__webglTexture,le)}be=-1},this.readRenderTargetPixels=function(M,$,le,ce,pe,je,tt,Je=0){if(!(M&&M.isWebGLRenderTarget)){mt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let st=ue.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&tt!==void 0&&(st=st[tt]),st){x.bindFramebuffer(X.FRAMEBUFFER,st);try{let at=M.textures[Je],xt=at.format,Mt=at.type;if(M.textures.length>1&&X.readBuffer(X.COLOR_ATTACHMENT0+Je),!R.textureFormatReadable(xt)){mt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!R.textureTypeReadable(Mt)){mt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}$>=0&&$<=M.width-ce&&le>=0&&le<=M.height-pe&&X.readPixels($,le,ce,pe,G.convert(xt),G.convert(Mt),je)}finally{let at=ye!==null?ue.get(ye).__webglFramebuffer:null;x.bindFramebuffer(X.FRAMEBUFFER,at)}}},this.readRenderTargetPixelsAsync=async function(M,$,le,ce,pe,je,tt,Je=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let st=ue.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&tt!==void 0&&(st=st[tt]),st)if($>=0&&$<=M.width-ce&&le>=0&&le<=M.height-pe){x.bindFramebuffer(X.FRAMEBUFFER,st);let at=M.textures[Je],xt=at.format,Mt=at.type;if(M.textures.length>1&&X.readBuffer(X.COLOR_ATTACHMENT0+Je),!R.textureFormatReadable(xt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!R.textureTypeReadable(Mt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let lt=X.createBuffer();X.bindBuffer(X.PIXEL_PACK_BUFFER,lt),X.bufferData(X.PIXEL_PACK_BUFFER,je.byteLength,X.STREAM_READ),X.readPixels($,le,ce,pe,G.convert(xt),G.convert(Mt),0);let Ot=ye!==null?ue.get(ye).__webglFramebuffer:null;x.bindFramebuffer(X.FRAMEBUFFER,Ot);let jt=X.fenceSync(X.SYNC_GPU_COMMANDS_COMPLETE,0);return X.flush(),await Ld(X,jt,4),X.bindBuffer(X.PIXEL_PACK_BUFFER,lt),X.getBufferSubData(X.PIXEL_PACK_BUFFER,0,je),X.deleteBuffer(lt),X.deleteSync(jt),je}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,$=null,le=0){let ce=Math.pow(2,-le),pe=Math.floor(M.image.width*ce),je=Math.floor(M.image.height*ce),tt=$!==null?$.x:0,Je=$!==null?$.y:0;xe.setTexture2D(M,0),X.copyTexSubImage2D(X.TEXTURE_2D,le,0,0,tt,Je,pe,je),x.unbindTexture()},this.copyTextureToTexture=function(M,$,le=null,ce=null,pe=0,je=0){let tt,Je,st,at,xt,Mt,lt,Ot,jt,It=M.isCompressedTexture?M.mipmaps[je]:M.image;if(le!==null)tt=le.max.x-le.min.x,Je=le.max.y-le.min.y,st=le.isBox3?le.max.z-le.min.z:1,at=le.min.x,xt=le.min.y,Mt=le.isBox3?le.min.z:0;else{let qt=Math.pow(2,-pe);tt=Math.floor(It.width*qt),Je=Math.floor(It.height*qt),M.isDataArrayTexture?st=It.depth:M.isData3DTexture?st=Math.floor(It.depth*qt):st=1,at=0,xt=0,Mt=0}ce!==null?(lt=ce.x,Ot=ce.y,jt=ce.z):(lt=0,Ot=0,jt=0);let Vt=G.convert($.format),dn=G.convert($.type),Ke;$.isData3DTexture?(xe.setTexture3D($,0),Ke=X.TEXTURE_3D):$.isDataArrayTexture||$.isCompressedArrayTexture?(xe.setTexture2DArray($,0),Ke=X.TEXTURE_2D_ARRAY):(xe.setTexture2D($,0),Ke=X.TEXTURE_2D),x.activeTexture(X.TEXTURE0),x.pixelStorei(X.UNPACK_FLIP_Y_WEBGL,$.flipY),x.pixelStorei(X.UNPACK_PREMULTIPLY_ALPHA_WEBGL,$.premultiplyAlpha),x.pixelStorei(X.UNPACK_ALIGNMENT,$.unpackAlignment);let dt=x.getParameter(X.UNPACK_ROW_LENGTH),At=x.getParameter(X.UNPACK_IMAGE_HEIGHT),Cn=x.getParameter(X.UNPACK_SKIP_PIXELS),Un=x.getParameter(X.UNPACK_SKIP_ROWS),oi=x.getParameter(X.UNPACK_SKIP_IMAGES);x.pixelStorei(X.UNPACK_ROW_LENGTH,It.width),x.pixelStorei(X.UNPACK_IMAGE_HEIGHT,It.height),x.pixelStorei(X.UNPACK_SKIP_PIXELS,at),x.pixelStorei(X.UNPACK_SKIP_ROWS,xt),x.pixelStorei(X.UNPACK_SKIP_IMAGES,Mt);let _n=M.isDataArrayTexture||M.isData3DTexture,Ft=$.isDataArrayTexture||$.isData3DTexture;if(M.isDepthTexture){let qt=ue.get(M),bi=ue.get($),Ut=ue.get(qt.__renderTarget),ai=ue.get(bi.__renderTarget);x.bindFramebuffer(X.READ_FRAMEBUFFER,Ut.__webglFramebuffer),x.bindFramebuffer(X.DRAW_FRAMEBUFFER,ai.__webglFramebuffer);for(let es=0;es<st;es++)_n&&(X.framebufferTextureLayer(X.READ_FRAMEBUFFER,X.COLOR_ATTACHMENT0,ue.get(M).__webglTexture,pe,Mt+es),X.framebufferTextureLayer(X.DRAW_FRAMEBUFFER,X.COLOR_ATTACHMENT0,ue.get($).__webglTexture,je,jt+es)),X.blitFramebuffer(at,xt,tt,Je,lt,Ot,tt,Je,X.DEPTH_BUFFER_BIT,X.NEAREST);x.bindFramebuffer(X.READ_FRAMEBUFFER,null),x.bindFramebuffer(X.DRAW_FRAMEBUFFER,null)}else if(pe!==0||M.isRenderTargetTexture||ue.has(M)){let qt=ue.get(M),bi=ue.get($);x.bindFramebuffer(X.READ_FRAMEBUFFER,se),x.bindFramebuffer(X.DRAW_FRAMEBUFFER,Z);for(let Ut=0;Ut<st;Ut++)_n?X.framebufferTextureLayer(X.READ_FRAMEBUFFER,X.COLOR_ATTACHMENT0,qt.__webglTexture,pe,Mt+Ut):X.framebufferTexture2D(X.READ_FRAMEBUFFER,X.COLOR_ATTACHMENT0,X.TEXTURE_2D,qt.__webglTexture,pe),Ft?X.framebufferTextureLayer(X.DRAW_FRAMEBUFFER,X.COLOR_ATTACHMENT0,bi.__webglTexture,je,jt+Ut):X.framebufferTexture2D(X.DRAW_FRAMEBUFFER,X.COLOR_ATTACHMENT0,X.TEXTURE_2D,bi.__webglTexture,je),pe!==0?X.blitFramebuffer(at,xt,tt,Je,lt,Ot,tt,Je,X.COLOR_BUFFER_BIT,X.NEAREST):Ft?X.copyTexSubImage3D(Ke,je,lt,Ot,jt+Ut,at,xt,tt,Je):X.copyTexSubImage2D(Ke,je,lt,Ot,at,xt,tt,Je);x.bindFramebuffer(X.READ_FRAMEBUFFER,null),x.bindFramebuffer(X.DRAW_FRAMEBUFFER,null)}else Ft?M.isDataTexture||M.isData3DTexture?X.texSubImage3D(Ke,je,lt,Ot,jt,tt,Je,st,Vt,dn,It.data):$.isCompressedArrayTexture?X.compressedTexSubImage3D(Ke,je,lt,Ot,jt,tt,Je,st,Vt,It.data):X.texSubImage3D(Ke,je,lt,Ot,jt,tt,Je,st,Vt,dn,It):M.isDataTexture?X.texSubImage2D(X.TEXTURE_2D,je,lt,Ot,tt,Je,Vt,dn,It.data):M.isCompressedTexture?X.compressedTexSubImage2D(X.TEXTURE_2D,je,lt,Ot,It.width,It.height,Vt,It.data):X.texSubImage2D(X.TEXTURE_2D,je,lt,Ot,tt,Je,Vt,dn,It);x.pixelStorei(X.UNPACK_ROW_LENGTH,dt),x.pixelStorei(X.UNPACK_IMAGE_HEIGHT,At),x.pixelStorei(X.UNPACK_SKIP_PIXELS,Cn),x.pixelStorei(X.UNPACK_SKIP_ROWS,Un),x.pixelStorei(X.UNPACK_SKIP_IMAGES,oi),je===0&&$.generateMipmaps&&X.generateMipmap(Ke),x.unbindTexture()},this.initRenderTarget=function(M){ue.get(M).__webglFramebuffer===void 0&&xe.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?xe.setTextureCube(M,0):M.isData3DTexture?xe.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?xe.setTexture2DArray(M,0):xe.setTexture2D(M,0),x.unbindTexture()},this.resetState=function(){ee=0,ae=0,ye=null,x.reset(),Se.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ui}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ct._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ct._getUnpackColorSpace()}};var Xh=Dt.degToRad;async function Ss({breed:i="orange",outfit:e="none",stage:hostStage="adult"}={}){let t=new TextDecoder("utf-8",{fatal:!0}).decode(Uint8Array.from(atob(window.__CAT_PROJECT_BASE64__),j=>j.charCodeAt(0))),n=JSON.parse(t),s=new Map(n.elements.map(j=>[j.uuid,j])),r=new Map((n.groups||[]).map(j=>[j.uuid,j])),o=new Map,a=new Map,c=new ut;c.name="原始橘白小猫";let l;try{l=await new xo().loadAsync(n.textures[0].source)}catch(j){throw new Error("无法加载小猫的像素贴图："+j.message)}l.colorSpace=Zt,l.magFilter=Jt,l.minFilter=Jt,l.generateMipmaps=!1;let d=new Ln({map:l,roughness:1,transparent:!0,alphaTest:.1}),f=new pi({visible:!1}),h=["orange","silver","tuxedo","siamese","ragdoll","blue","calico","golden","starry"],u=["none","bandana","bow","cap","raincoat","backpack","scarf","sakura","bell","crown","cape"],_=l.image,y=document.createElement("canvas");y.width=_.width,y.height=_.height;let g=y.getContext("2d",{willReadFrequently:!0});g.imageSmoothingEnabled=!1,g.drawImage(_,0,0);let p=g.getImageData(0,0,y.width,y.height),S=new Fs(y);S.colorSpace=Zt,S.magFilter=Jt,S.minFilter=Jt,S.generateMipmaps=!1;let E="orange",b="none",I="",A=[],F=[],m=j=>[j>>16&255,j>>8&255,j&255],w={silver:{fur:12041922,shade:10726577,stripe:5858669,white:16052969,point:5858669},tuxedo:{fur:3160389,shade:2568252,stripe:3160389,white:16315624,point:3160389},siamese:{fur:15062197,shade:14338216,stripe:15062197,white:15062197,point:6639690},ragdoll:{fur:15919840,shade:15195601,stripe:15919840,white:16775404,point:9078158},blue:{fur:8163751,shade:7374235,stripe:8163751,white:9084337,point:8163751},calico:{fur:16248287,shade:15327185,stripe:15106891,white:16774883,point:3487029},golden:{fur:14987362,shade:13342540,stripe:14987362,white:16247244,point:12091451},starry:{fur:3095397,shade:2831189,stripe:3095397,white:4344717,point:3095397}},T=j=>/^(tabby_|white_|soft_belly|muzzle_|ear_(base|step|tip)|tail_|(front|back)_(left|right)_(leg|white_sock|paw))/.test(j);function U(j){let Te=new Uint8ClampedArray(p.data);if(j!=="orange"){let Re=w[j];for(let Le of n.elements){if(!T(Le.name))continue;let q=Le.name;for(let[he,Me]of Object.entries(Le.faces||{})){if(Me.texture===null||!Me.uv)continue;let[Ae,Be,ke,qe]=Me.uv,$e=Math.floor(Math.min(Ae,ke)),it=Math.floor(Math.min(Be,qe)),X=Math.ceil(Math.max(Ae,ke)),gt=Math.ceil(Math.max(Be,qe));for(let ot=it;ot<gt;ot++)for(let R=$e;R<X;R++){let x=(ot*y.width+R)*4;if(!Te[x+3])continue;let Q=(R-$e+.5)/Math.max(1,X-$e),ue=(ot-it+.5)/Math.max(1,gt-it),xe=p.data[x],Pe=p.data[x+1],Ue=/white_|soft_belly|muzzle_|_paw/.test(q),fe=Ue?Re.white:Re.fur;j==="silver"&&!Ue&&xe<190&&Pe<130?fe=Re.stripe:(j==="silver"&&!Ue&&xe<225||j!=="silver"&&!Ue&&(R*3+ot*7)%19===0)&&(fe=Re.shade),j==="tuxedo"&&q==="tabby_head"&&he==="north"&&Math.abs(Q-.5)<.07+ue*.24&&(fe=Re.white),j==="siamese"&&(/^(tabby_head|ear_|tail_|white_chin|muzzle_)|_white_sock|_paw/.test(q)&&(fe=Re.point),/_leg/.test(q)&&he!=="up"&&(he==="down"||ue>.57)&&(fe=10125424),q==="tabby_head"&&he==="north"&&(fe=Math.abs(Q-.5)<.34?5719617:Re.point)),j==="ragdoll"&&(/^(tabby_head|ear_|tail_)/.test(q)&&(fe=Re.point),q==="tabby_head"&&he==="north"&&Math.abs(Q-.5)<.035+ue*.36&&(fe=Re.white),q==="tabby_body"&&he==="up"&&(fe=13156800),q==="tabby_body"&&["east","west"].includes(he)&&ue<.34&&(fe=13880266)),j==="calico"&&!Ue&&(Math.sin(R*.31+ot*.23)+Math.sin(R*.13-ot*.37)>.7?fe=15106891:Math.sin(R*.31+ot*.23)+Math.sin(R*.13-ot*.37)<-.95?fe=3487029:fe=16248287),j==="golden"&&!Ue&&(he==="up"||ue<.3)&&(fe=Re.point),j==="golden"&&!Ue&&/^(tabby_head|ear_tip|tail_)/.test(q)&&ue<.5&&(fe=13342540),j==="starry"&&((R*13+ot*7)%41===0?fe=16774604:(R*5+ot*11)%67===0?fe=10388207:Ue&&(fe=Re.white));let ve=m(fe);Te[x]=ve[0],Te[x+1]=ve[1],Te[x+2]=ve[2]}}}if(j==="starry")for(let Le of n.elements.filter(q=>q.name.startsWith("eye_iris_"))){let cc=/left/.test(Le.name)?[240,190,70]:[96,170,230];for(let q of Object.values(Le.faces||{})){if(!q.uv)continue;let[he,Me,Ae,Be]=q.uv;for(let ke=Math.floor(Math.min(Me,Be));ke<Math.max(Me,Be);ke++)for(let qe=Math.floor(Math.min(he,Ae));qe<Math.max(he,Ae);qe++){let $e=(ke*y.width+qe)*4;Te[$e+1]>Te[$e]*1.05&&Te[$e+1]>Te[$e+2]*1.15&&(Te[$e]=cc[0],Te[$e+1]=cc[1],Te[$e+2]=cc[2])}}}if(j==="siamese"||j==="ragdoll")for(let Le of n.elements.filter(q=>q.name.startsWith("eye_iris_")))for(let q of Object.values(Le.faces)){let[he,Me,Ae,Be]=q.uv;for(let ke=Me;ke<Be;ke++)for(let qe=he;qe<Ae;qe++){let $e=(ke*y.width+qe)*4;Te[$e+1]>Te[$e]*1.05&&Te[$e+1]>Te[$e+2]*1.15&&(Te[$e]=103,Te[$e+1]=174,Te[$e+2]=221)}}}g.putImageData(new ImageData(Te,y.width,y.height),0,0),S.needsUpdate=!0,d.map=j==="orange"?l:S,d.needsUpdate=!0;let we=2166136261;for(let Re of Te)we=Math.imul(we^Re,16777619);I=(we>>>0).toString(16).padStart(8,"0")}let B=(j,Te=[0,0,0])=>new L(...Array.isArray(j)?j:Te);function re(j,Te){let we=B(j.from),Re=B(j.to),Le=B(j.origin||j.from),q=Re.clone().sub(we),he=Re.clone().add(we).multiplyScalar(.5).sub(Le),Me=new bn(q.x,q.y,q.z);Me.translate(he.x,he.y,he.z);let Ae=Me.getAttribute("uv"),Be=n.textures[0].uv_width||n.resolution.width,ke=n.textures[0].uv_height||n.resolution.height,qe=["east","west","up","down","south","north"].map((X,gt)=>{let ot=j.faces[X],R=ot?.uv||[0,0,Be,ke],x=(Number(ot?.rotation)||0)/90%4,Q=[[R[0],R[1]],[R[2],R[1]],[R[0],R[3]],[R[2],R[3]]],xe=[[0,1,2,3],[2,0,3,1],[3,2,1,0],[1,3,0,2]][(x+4)%4];for(let Pe=0;Pe<4;Pe++){let[Ue,fe]=Q[xe[Pe]];Ae.setXY(gt*4+Pe,Ue/Be,1-fe/ke)}return!ot||ot.texture===null?f:d}),$e=new kt(Me,qe);$e.name=j.name,$e.userData.uuid=j.uuid,$e.castShadow=!0,$e.receiveShadow=!0;let it=new ut;return it.name=`${j.name}:pivot`,it.position.copy(Le.clone().sub(Te)),it.rotation.set(...(j.rotation||[0,0,0]).map(Xh),"ZYX"),it.add($e),it}function se(j,Te,we){j.forEach(Re=>{if(typeof Re=="string"){let Me=s.get(Re);Me?.type==="cube"&&Me.visibility!==!1&&Te.add(re(Me,we));return}let Le={...r.get(Re.uuid)||{},...Re};if(Le.visibility===!1)return;let q=B(Le.origin),he=new ut;he.name=Le.name||Le.uuid,he.position.copy(q.clone().sub(we)),he.rotation.set(...(Le.rotation||[0,0,0]).map(Xh),"ZYX"),he.scale.copy(B(Le.scale,[1,1,1])),he.userData={basePosition:he.position.toArray(),baseRotation:he.rotation.toArray().slice(0,3),baseScale:he.scale.toArray()},o.set(Le.uuid,he),a.set(he.name,he),Te.add(he),se(Le.children||[],he,q)})}se(n.outliner||n.elements.map(j=>j.uuid),c,new L);function Z(){for(let j of F)j.removeFromParent(),j.traverse(Te=>{Te.geometry?.dispose(),Te.material&&Te.material.dispose()});F.length=0,A=[]}function ee(j){if(Z(),j==="none")return;let Te=["raincoat","backpack","cape","bandana"].includes(j)?"body":j==="bow"?"ear_left":"head",we=a.get(Te),Re=B([...r.values()].find(he=>he.name===Te)?.origin),Le=new ut;Le.name=`outfit:${j}`,Le.userData={accessory:!0,outfit:j,attachedBone:Te},we.add(Le),F.push(Le);function q(he,Me,Ae,Be){let ke=new kt(new bn(...Me),new Ln({color:Be,roughness:1,flatShading:!0}));return ke.name=`outfit:${j}:${he}`,ke.position.copy(B(Ae).sub(Re)),ke.castShadow=!0,ke.receiveShadow=!0,ke.userData={accessory:!0,outfit:j,attachedBone:Te},Le.add(ke),A.push(ke),ke}function poly(he,pts,depth,Be){let ge=new Tn,vs=[],ix=[],N=pts.length;for(let side of[-1,1])for(let p of pts){let v=B([p[0],p[1],p[2]+side*depth/2]).sub(Re);vs.push(v.x,v.y,v.z)}for(let k=1;k<N-1;k++)ix.push(0,k,k+1,N,N+k+1,N+k);for(let k=0;k<N;k++){let n=(k+1)%N;ix.push(k,n,N+n,k,N+n,N+k)}ge.setAttribute("position",new Wn(new Float32Array(vs),3)),ge.setIndex(ix),ge.computeVertexNormals();let mat=new Ln({color:Be,roughness:1,flatShading:!0});mat.side=2;let m=new kt(ge,mat);return m.name=`outfit:${j}:${he}`,m.castShadow=!0,m.receiveShadow=!0,m.userData={accessory:!0,outfit:j,attachedBone:Te},Le.add(m),A.push(m),m}if(j==="bandana"){for(let z of[-7.8,-1.2])q(`collar-${z}`,[5.8,.52,.32],[0,8.55,z],8221549);for(let x of[-4.55,4.55])q(`collar-side-${x}`,[.32,.52,6.6],[x,8.55,-4.5],8221549);q("collar-piping-front",[5.62,.1,.34],[0,8.85,-7.8],15458777);poly("bib-bridge-cream",[[-2.65,8.55,-7.88],[2.65,8.55,-7.88],[2.38,8.2,-7.82],[-2.38,8.2,-7.82]],.16,15458777);poly("bib-bridge-sage",[[-2.42,8.5,-7.99],[2.42,8.5,-7.99],[2.18,8.05,-7.54],[-2.18,8.05,-7.54]],.16,8221549);poly("bib-cream-edge",[[-2.38,8.2,-7.82],[2.38,8.2,-7.82],[0,6.05,-2.05]],.16,15458777);poly("bib-sage-panel",[[-2.12,8.05,-7.54],[2.12,8.05,-7.54],[0,6.35,-2.98]],.16,8221549);poly("fish-body",[[-.66,7.52,-6.2],[-.25,7.25,-5.47],[.43,7.25,-5.47],[.76,7.52,-6.2],[.43,7.79,-6.92],[-.25,7.79,-6.92]],.08,15458777);poly("fish-tail",[[-.65,7.52,-6.23],[-1.02,7.28,-5.55],[-1.02,7.76,-6.84]],.08,15458777);q("fish-eye",[.12,.12,.08],[.39,7.57,-6.37],8221549)}else if(j==="bow"){poly("left-loop",[[-3.53,15.75,-6.03],[-4.63,16.47,-6.03],[-4.47,15.45,-6.03],[-3.53,15.3,-6.03]],.48,14768472);poly("right-loop",[[-3.25,15.75,-6.03],[-2.08,16.4,-6.03],[-2.25,15.4,-6.03],[-3.22,15.3,-6.03]],.48,14768472);poly("left-fold",[[-3.58,15.72,-6.3],[-4.35,16.2,-6.3],[-3.8,15.54,-6.3]],.07,15360363);poly("right-fold",[[-3.24,15.7,-6.3],[-2.43,16.15,-6.3],[-2.96,15.52,-6.3]],.07,15360363);poly("left-tail-fold",[[-3.58,15.46,-6.08],[-3.05,15.52,-6.08],[-3.16,15.08,-7.54],[-3.65,15.08,-7.54]],.42,14768472);poly("left-tail-end",[[-3.65,15.08,-7.54],[-3.16,15.08,-7.54],[-3.42,14.52,-7.62],[-3.94,14.83,-7.62]],.42,14768472);poly("right-tail-fold",[[-3.3,15.48,-6.08],[-2.83,15.5,-6.08],[-2.96,15.08,-7.54],[-3.42,15.08,-7.54]],.42,14768472);poly("right-tail-end",[[-3.42,15.08,-7.54],[-2.96,15.08,-7.54],[-2.59,14.64,-7.62],[-3.1,14.48,-7.62]],.42,14768472);q("center-knot",[.62,.68,.52],[-3.39,15.72,-6.36],15360363);q("knot-glint",[.17,.4,.07],[-3.53,15.77,-6.67],16088198)}else if(j==="cap")q("crown",[2.8,1.45,2.85],[0,16.03,-4.7],7446442),q("upper-step",[2.15,.42,2.05],[0,16.96,-4.65],8960189),q("brim",[3.5,.24,1.7],[0,15.35,-6.9],5143947),q("cream-badge",[.58,.54,.07],[0,16.15,-6.17],16771e3);else if(j==="raincoat")q("back-panel",[7.22,.13,5],[0,9.85,2.6],15647835),q("left-panel",[.13,1.78,5],[-3.59,8.89,2.6],14265161),q("right-panel",[.13,1.78,5],[3.59,8.89,2.6],14988877),q("top-reflector",[6.5,.06,.55],[0,9.98,3.7],16772278),q("left-reflector",[.06,.4,4.4],[-3.7,8.45,2.6],16772278),q("right-reflector",[.06,.4,4.4],[3.7,8.45,2.6],16772278);else if(j==="backpack"){q("bag",[3.4,1.8,2.65],[0,10.74,1.4],7967098),q("flap",[3.65,.27,1.9],[0,11.8,1.12],10138005),q("front-pocket",[2.22,1.05,.4],[0,10.74,-.23],11256220),q("buckle",[.52,.55,.12],[0,11.28,-.51],15979913);for(let he of[-2.25,2.25])q(`top-strap-${he}`,[.52,.1,4.25],[he,9.9,1.2],11910816);for(let he of[-3.59,3.59])q(`side-strap-${he}`,[.1,1.4,.55],[he,9,1.2],11910816)}else j==="scarf"&&(q("neck-fold",[4.8,.69,.14],[0,9.23,-8.51],7972528),q("lower-fold",[3.8,.38,.14],[0,8.71,-8.51],6458266),q("hanging-end",[.87,.98,.16],[1.35,8.28,-8.53],7972528),q("woven-stripe",[4.6,.17,.06],[0,9.31,-8.65],15265756),q("end-stripe",[.87,.18,.06],[1.35,7.96,-8.68],15265756)),j==="sakura"&&(q("petal-a",[.8,.8,.5],[0.65,16.05,-6.2],16231628),q("petal-b",[.8,.8,.5],[1.35,16.05,-6.2],16231628),q("petal-c",[.8,.8,.5],[1,16.65,-6.2],16494557),q("petal-d",[.8,.8,.5],[1,15.45,-6.2],15442367),q("core",[.42,.42,.62],[1,16.05,-6.3],16768343),q("clip",[1.6,.22,.3],[0.3,15.7,-6],15108229)),j==="bell"&&(q("collar",[4.9,.52,.16],[0,9.32,-8.51],14175569),q("collar-hi",[4.5,.14,.06],[0,9.5,-8.6],15898001),q("bell",[.95,.95,.7],[0,8.62,-8.75],16109390),q("bell-shine",[.32,.3,.06],[-.18,8.82,-9.12],16776416),q("bell-slot",[.5,.14,.06],[0,8.36,-9.12],9132587)),j==="crown"&&(q("band",[2.9,.6,2.6],[0,16.25,-4.7],15911248),q("spike-l",[.55,.75,.55],[-1.05,16.85,-5.8],15911248),q("spike-c",[.6,1.05,.6],[0,17,-5.8],16106832),q("spike-r",[.55,.75,.55],[1.05,16.85,-5.8],15911248),q("gem",[.5,.4,.08],[0,16.3,-6.03],15622248),q("star",[.32,.32,.08],[-.9,16.3,-6.03],7323390),q("star2",[.32,.32,.08],[.9,16.3,-6.03],7323390)),j==="cape"&&(q("cape",[7.6,.16,5.6],[0,9.95,2.4],2834795),q("cape-l",[.14,2.4,5.4],[-3.82,8.8,2.4],2306395),q("cape-r",[.14,2.4,5.4],[3.82,8.8,2.4],2306395),q("clasp",[1.1,.5,.4],[0,9.6,-1.2],15911248),q("star-a",[.4,.06,.4],[-1.6,10.05,1.6],16774604),q("star-b",[.4,.06,.4],[1.4,10.05,3.4],16774604),q("star-c",[.3,.06,.3],[.2,10.05,4.6],13421823))}function ae(j={}){if(j.stage)hostStage=j.stage;let Te=h.includes(j.breed)?j.breed:E,we=j.outfit===null?"none":j.outfit,Re=u.includes(we)?we:b;return(Te!==E||!I)&&(E=Te,U(Te)),Re!==b&&(b=Re,ee(Re)),c.name=`像素小猫:${E}`,V()}let ye=new Map(n.animations.map(j=>[j.name,Object.entries(j.animators||{}).map(([Te,we])=>[Te,{rotation:(we.keyframes||[]).filter(Re=>Re.channel==="rotation").sort((Re,Le)=>Re.time-Le.time),position:(we.keyframes||[]).filter(Re=>Re.channel==="position").sort((Re,Le)=>Re.time-Le.time),scale:(we.keyframes||[]).filter(Re=>Re.channel==="scale").sort((Re,Le)=>Re.time-Le.time)}])])),be=new Map(n.animations.map(j=>[j.name,j]));function O(j,Te){let we=j.data_points?.[0]||j.data_point||{};return["x","y","z"].map((Re,Le)=>Number.isFinite(Number(we[Re]))?Number(we[Re]):Te[Le])}function z(j,Te,we){if(!j.length)return we;if(Te<=j[0].time)return O(j[0],we);if(Te>=j[j.length-1].time)return O(j[j.length-1],we);let Re=1;for(;Re<j.length&&Te>j[Re].time;)Re++;let Le=j[Re-1],q=j[Re],he=Le.interpolation==="step"?0:(Te-Le.time)/(q.time-Le.time),Me=O(Le,we),Ae=O(q,we);return Me.map((Be,ke)=>Be+(Ae[ke]-Be)*he)}let ne="idle",_e=0;function Fe(j,Te){ne=j,_e=Te%(be.get(j)?.length||1),me(0),o.forEach(we=>{we.position.fromArray(we.userData.basePosition),we.rotation.set(...we.userData.baseRotation,"ZYX"),we.scale.fromArray(we.userData.baseScale)});for(let[we,Re]of ye.get(j)||[]){let Le=o.get(we);Le&&(Re.rotation.length&&Le.rotation.set(...z(Re.rotation,_e,[0,0,0]).map((q,he)=>Xh(q)+Le.userData.baseRotation[he]),"ZYX"),Re.position.length&&Le.position.add(B(z(Re.position,_e,[0,0,0]))),Re.scale.length&&Le.scale.multiply(B(z(Re.scale,_e,[1,1,1]))))}window.CatPetGrowth?.apply(a,hostStage)}let Ye=["white_chin","mouth_left","mouth_right"].map(j=>c.getObjectByName(j+":pivot")).filter(Boolean);Ye.forEach(j=>{j.userData.restY=j.position.y});function me(j=0){Ye.forEach(Te=>{Te.position.y=(Te.userData.restY??Te.position.y)-Math.max(0,Math.min(1,j))*.42})}function V(){return{animation:ne,time:_e,boneCount:o.size,elementCount:n.elements.length,animations:[...be.keys()],breed:E,outfit:b,accessoryMeshes:A.length,accessoryParts:A.map(j=>({name:j.name,bone:j.userData.attachedBone})),texture:{width:l.image.width,height:l.image.height,nearest:d.map.magFilter===Jt,paletteHash:I,original:E==="orange"}}}function ge(){Z(),c.traverse(j=>j.geometry?.dispose()),d.dispose(),f.dispose(),l.dispose(),S.dispose()}return Fe("idle",0),ae({breed:i,outfit:e}),{root:c,bones:a,model:n,texture:l,applyAnimation:Fe,setStage:value=>{hostStage=value},setMouth:me,setAppearance:ae,dispose:ge,state:V}}var Cr=720,qh=420,Yh=20,$h={kitten:.64,young:.82,adult:1},Hs=Dt.clamp;function _f({canvas:i,onFinish:e=()=>{},onStatus:t=()=>{}}){let n,s,r,o,a={breed:"orange",outfit:"none"};function c(N={}){return a={...a,...N},o?.setAppearance(a)||{...a,ready:!1}}let l=!1,d=!0,f=null,h=!1,u=!1,_=0,y=null,g=0,p=.22,S=0,E=0,b=!1,I="kitten",A=$h.kitten,F=0,m=0,w=0,T=0,U=0,B=0,re=0,se=0,Z=0,ee=84,ae=49,ye=null,be=[],O=[],z=[],ne=!1,_e=null,Fe=new Set,Ye=new Map,me=new bn(1,1,1),V=new L,ge=new L(0,-1,-5.35),j=new L,Te=new Xt,we=null;i.style.touchAction="none",i.tabIndex=0,i.setAttribute("aria-label","小猫接小鱼。移动鼠标、滑动手指或按左右方向键，让小猫接住橘色小鱼，躲开蓝色水滴。");function Re(N={}){t({score:S,remaining:Math.max(0,Math.ceil(Yh-g)),combo:E,running:u,paused:u&&document.hidden,ready:l,loading:d,error:f,...N})}function Le(N){return Ye.has(N)||Ye.set(N,new Ln({color:N,roughness:.95})),Ye.get(N)}function q(N,G,Se,J){let He=new kt(me,Le(J));return He.scale.set(...G),He.position.set(...Se),He.castShadow=!0,He.receiveShadow=!0,N.add(He),He}function he(){let N=new ut;return N.name="橘色方块小鱼",q(N,[2.5,1.45,.85],[-.25,0,0],"#e9955c"),q(N,[1,.95,.8],[-1.5,0,0],"#e9955c"),q(N,[1.6,.4,.88],[-.45,-.5,0],"#f5c480"),q(N,[.55,1.05,.7],[1.35,0,0],"#e9955c"),q(N,[.6,.75,.7],[1.88,.47,0],"#e9955c"),q(N,[.6,.75,.7],[1.88,-.47,0],"#e9955c"),[-.45,.45].forEach(G=>q(N,[.26,.26,.08],[-1.1,.16,G],"#45655e")),N}function Me(){let N=new ut;return N.name="蓝色方块水滴",q(N,[2.05,1.5,1.1],[0,-.25,0],"#77bfd5"),q(N,[1.3,.65,1],[0,.82,0],"#77bfd5"),q(N,[.55,.7,.7],[0,1.43,0],"#77bfd5"),q(N,[1.35,.45,.9],[0,-1.12,0],"#77bfd5"),q(N,[.3,.6,.12],[-.5,-.1,-.61],"#d8f0f0"),N}function Ae(N,G,Se){let J=new ut;J.name="接鱼爱心",[[1,1,0,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]].forEach((Oe,yt)=>Oe.forEach((P,pt)=>{P&&q(J,[.3,.3,.3],[(pt-2)*.3,(2-yt)*.3,0],"#db928b")})),J.position.set(N,G,Se),s.add(J),O.push({mesh:J,life:.8,duration:.8,rise:2.4})}function Be(){s=new fi,s.background=new _t("#c3e4e4"),r=new ms(-42,42,24.5,-24.5,.1,180),r.position.set(0,32,-64),r.lookAt(0,17,0);let N=new ut;N.name="薄荷色接鱼小房间",s.add(N),q(N,[80,1.2,22],[0,-.6,0],"#bc8d64");let G=["#d3a779","#dcaf82","#d8aa7d","#cfa073"];for(let Oe=0;Oe<4;Oe++)for(let yt=0;yt<10;yt++)q(N,[7.87,.14,5.36],[-35.9+yt*7.98,.01,-8.2+Oe*5.48],G[(yt+Oe*2)%G.length]);q(N,[80,44,.7],[0,21.8,11.4],"#b3ddd8"),q(N,[80,1.05,.5],[0,.55,10.9],"#f5eacb"),q(N,[80,.8,.65],[0,-.35,-11],"#f3e7ce"),q(N,[1.5,2.4,22],[-39.4,.6,0],"#a9d4cf"),q(N,[1.5,2.4,22],[39.4,.6,0],"#a9d4cf");let Se=new ut;Se.position.set(-26,26,10.9),N.add(Se),q(Se,[12,10,.35],[0,0,0],"#8fc5cc"),[[13,.75,0,5.35],[13,.75,0,-5.35],[.75,10.7,-6.12,0],[.75,10.7,6.12,0],[.5,10.3,0,0]].forEach(([Oe,yt,P,pt])=>q(Se,[Oe,yt,.8],[P,pt,-.35],"#fff3d9")),q(Se,[4.2,.8,.22],[-1.8,2,-.3],"#eff9e9"),q(Se,[2.7,.8,.22],[-2.1,2.8,-.3],"#eff9e9"),q(N,[4,.05,3.3],[25,.1,5],"#eecba9"),[[-2.5,-2],[-.9,-3.2],[.9,-3.2],[2.5,-2]].forEach(([Oe,yt])=>q(N,[1.1,.06,1.2],[25+Oe,.1,5+yt],"#eecba9")),s.add(new mi("#fff8e8","#829d93",2.6));let J=new Zn("#fff0d3",3.1);J.position.set(-15,37,-23),J.castShadow=!0,J.shadow.mapSize.set(1024,1024),Object.assign(J.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:140}),J.shadow.normalBias=.055,J.shadow.bias=-18e-5,J.target.position.set(0,5,0),s.add(J,J.target);let He=new Zn("#d8f2ef",1.15);He.position.set(22,19,8),s.add(He)}function ke(N){return Cr*(.5-N/ee)}function qe(N){return(.5-N/Cr)*ee}function $e(){if(!n||!r||h)return;let N=i.getBoundingClientRect(),G=Math.max(1,Math.round(N.width||Cr)),Se=Math.max(1,Math.round(N.height||qh)),J=G/Se;ae=Math.max(49,84/J),ee=ae*J,r.left=-ee/2,r.right=ee/2,r.top=ae/2,r.bottom=-ae/2,r.updateProjectionMatrix(),n.setPixelRatio(Math.min(2,globalThis.devicePixelRatio||1)),n.setSize(G,Se,!1),gt()}function it(){if(!o)return V.set(F,10*A,-3);let N=o.bones.get("head");return N?V.copy(ge).applyMatrix4(N.matrixWorld):V.set(F,10*A,-3),V}function X(N){if(!o)return;let G=Math.abs(U)>.6,Se=G?-Math.sign(U)*Math.PI/2:0;if(w+=Hs(Se-w,-7*N,7*N),o.root.rotation.set(0,w,0),o.root.position.set(F,.1,0),o.root.scale.setScalar(A),o.applyAnimation(G?"walk":"idle",G?T/(4.7*A):g),G){let J=T/(4.7*A)%1,He=o.bones.get("root");He&&(He.position.y=He.userData.basePosition[1]),[["front_left",0],["back_right",0],["front_right",.5],["back_left",.5]].forEach(([yt,P])=>{let pt=o.bones.get(yt);if(!pt)return;let en=(J+P)%1,Nn=en<.6,mn=Nn?en/.6:(en-.6)/.4;pt.position.fromArray(pt.userData.basePosition),pt.rotation.set(...pt.userData.baseRotation,"ZYX"),pt.position.z+=Nn?(mn-.5)*2.82:(.5-mn)*2.82,Nn||(pt.position.y+=Math.sin(Math.PI*mn)*.78,pt.rotation.x+=Math.sin(Math.PI*mn)*.08)});let Oe=o.bones.get("head");Oe&&(Oe.rotation.y-=w*.28)}if(ye){ye.life-=N;let J=1-Math.max(0,ye.life)/ye.duration,He=Math.sin(J*Math.PI),Oe=o.bones.get("head"),yt=o.bones.get("body");if(ye.type==="fish"){o.root.position.y+=He*.82*A;let P=o.bones.get("front_left");P&&(P.rotation.x-=He*.65,P.position.y+=He*.45),Oe&&(Oe.rotation.x-=He*.12),o.setMouth(Math.sin(J*Math.PI*4)**2*He)}else yt&&(yt.rotation.z+=Math.sin(J*Math.PI*8)*.11*He),Oe&&(Oe.rotation.z-=Math.sin(J*Math.PI*8)*.1*He),[o.bones.get("ear_left"),o.bones.get("ear_right")].forEach((pt,en)=>{pt&&(pt.rotation.z+=(en?1:-1)*He*.3)});ye.life<=0&&(ye=null)}o.root.updateMatrixWorld(!0),it()}function gt(){n&&s&&r&&!h&&n.render(s,r)}function ot(){for(let N of[...be,...O,...z])s?.remove(N.mesh);be=[],O=[],z=[],ye=null}function R(){B++;let N=B%6===0?"drop":"fish",G;B===1?G=(Math.random()-.5)*12:N==="drop"?G=Hs(re+(re>0?-1:1)*(14+Math.random()*12),-29,29):G=Hs(re+(Math.random()-.5)*48,-29,29),N==="fish"&&(re=G);let Se=N==="fish"?he():Me();Se.position.set(G,42,-3),s.add(Se),be.push({id:B,type:N,worldX:G,worldY:42,speed:14.5+Math.random()*2.3,mesh:Se,spin:Math.random()*Math.PI*2,done:!1})}function x(N){N.done=!0;let G=S;if(N.type==="fish"){S=Math.min(15,S+1),E++,ye={type:"fish",life:.5,duration:.5};let Se=N.mesh.position.clone();z.push({mesh:N.mesh,start:Se,life:.42,duration:.42}),Ae(F,15*A+1,-4)}else{S=Math.max(0,S-1),E=0,ye={type:"drop",life:.7,duration:.7},s.remove(N.mesh);for(let Se=0;Se<5;Se++){let J=new ut;q(J,[.32,.48,.32],[0,0,0],"#87c5d6"),J.position.set(F+(Se-2)*.85,V.y+.9,-4),s.add(J),O.push({mesh:J,life:.55,duration:.55,rise:1.7,drift:(Se-2)*2.1})}}we={id:++Z,itemId:N.id,type:N.type,elapsed:g,scoreBefore:G,scoreAfter:S,distanceX:Math.abs(N.worldX-V.x),contactHeight:V.y,itemHeight:N.worldY},Re({event:N.type==="fish"?"caught":"splash"})}function Q(N){if(g=Math.min(Yh,g+N),!ne){let J=(Fe.has("ArrowRight")||Fe.has("d")?1:0)-(Fe.has("ArrowLeft")||Fe.has("a")?1:0);m=Hs(m-J*48*N,-30,30)}let G=Hs(m-F,-48*N,48*N);F+=G,U=N>0?G/N:0,T+=Math.abs(G),X(N),p-=N,p<=0&&g<17.3&&(R(),p+=.58+Math.random()*.08);let Se=2.3*A+1.8;for(let J of be){let He=J.worldY;J.worldY-=J.speed*N,J.mesh.position.y=J.worldY,J.mesh.rotation.y=Math.sin(g*1.9+J.spin)*.4,J.mesh.rotation.z=Math.sin(g*2.3+J.spin)*.1,He>=V.y-1.05&&J.worldY<=V.y+1.05&&Math.abs(J.worldX-V.x)<=Se?x(J):J.worldY<-2.5&&(J.done=!0,s.remove(J.mesh),J.type==="fish"&&(E=0))}be=be.filter(J=>!J.done),z.forEach(J=>{J.life-=N;let He=Hs(1-J.life/J.duration,0,1);J.mesh.position.lerpVectors(J.start,V,1-(1-He)**2),J.mesh.scale.setScalar(1-He*.95),J.life<=0&&s.remove(J.mesh)}),z=z.filter(J=>J.life>0),O.forEach(J=>{J.life-=N,J.mesh.position.y+=J.rise*N,J.mesh.position.x+=(J.drift||0)*N,J.mesh.scale.setScalar(Math.min(1,Math.max(0,J.life/.18))),J.life<=0&&s.remove(J.mesh)}),O=O.filter(J=>J.life>0)}function ue(N){if(!(!u||h)){if(document.hidden)y=null;else{let G=y===null?0:Math.min(.05,Math.max(0,(N-y)/1e3));if(y=N,Q(G),gt(),g>=Yh){u=!1,Fe.clear(),ne=!1,U=0,Re({finished:!0}),b||(b=!0,e(S));return}N-se>80&&(Re(),se=N)}_=requestAnimationFrame(ue)}}function xe(){return h||f||u?!1:l?(Pe(),u=!0,b=!1,g=0,p=.22,S=0,E=0,B=0,F=m=w=T=U=0,re=0,y=null,se=0,we=null,ne=!1,ot(),X(0),$e(),Re(),i.focus({preventScroll:!0}),_=requestAnimationFrame(ue),!0):(Re(),!1)}function Pe(){cancelAnimationFrame(_);let N=u;u=!1,y=null,ne=!1,_e=null,Fe.clear(),U=0,w=0,ot(),X(0),N&&Re({cancelled:!0}),gt()}function Ue(N){I=Object.hasOwn($h,N)?N:"kitten",A=$h[I],X(0),gt()}function fe(N){if(!u||N.pointerType!=="mouse"&&_e!==N.pointerId)return;let G=i.getBoundingClientRect();G.width&&(ne=!0,m=Hs(qe((N.clientX-G.left)/G.width*Cr),-30,30))}function ve(N){u&&(_e=N.pointerId,fe(N),i.focus({preventScroll:!0}),i.setPointerCapture?.(N.pointerId))}function C(N){i.hasPointerCapture?.(N.pointerId)&&i.releasePointerCapture(N.pointerId),_e===N.pointerId&&(_e=null)}function Y(N){let G=N.key.length===1?N.key.toLowerCase():N.key;!u||!["ArrowLeft","ArrowRight","a","d"].includes(G)||(N.preventDefault(),ne=!1,Fe.add(G))}function W(N){Fe.delete(N.key.length===1?N.key.toLowerCase():N.key)}function K(){Fe.clear(),y=null}function Ie(){y=null,Fe.clear(),u&&Re()}let Ve=[[i,"pointermove",fe],[i,"pointerdown",ve],[i,"pointerup",C],[i,"pointercancel",C],[window,"keydown",Y],[window,"keyup",W],[window,"blur",K],[window,"resize",$e],[document,"visibilitychange",Ie]];Ve.forEach(([N,G,Se])=>N.addEventListener(G,Se));let Ge=(async()=>{try{let N=i.getContext("webgl2",{antialias:!0,alpha:!1,powerPreference:"default"});if(!N)throw new Error("浏览器无法显示 3D 场景，请启用硬件加速后重新打开。");return n=new Ni({canvas:i,context:N,antialias:!0,alpha:!1,powerPreference:"default"}),n.outputColorSpace=Zt,n.toneMapping=Ki,n.toneMappingExposure=1.22,n.shadowMap.enabled=!0,n.shadowMap.type=gi,Be(),o=await Ss(a),h?(o.dispose(),!1):(s.add(o.root),l=!0,d=!1,X(0),$e(),Re(),!0)}catch(N){return d=!1,f="接鱼房间加载失败："+(N?.message||"浏览器无法显示 3D 场景"),h||Re(),!1}})();function H(){o&&Te.setFromObject(o.root);let N=be.map(G=>(j.copy(G.mesh.position).project(r),{id:G.id,type:G.type,x:(j.x*.5+.5)*Cr,y:(-j.y*.5+.5)*qh,worldX:G.worldX,worldY:G.worldY,speed:G.speed,done:G.done}));return{ready:l,loading:d,error:f,running:u,paused:u&&document.hidden,elapsed:g,score:S,combo:E,stage:I,basketX:ke(F),targetX:ke(m),items:N,canvasWidth:Cr,canvasHeight:qh,cat:o?{...o.state(),worldPosition:o.root.position.toArray(),heading:w,walkDistance:T,velocity:U,mouth:V.toArray(),catchRadius:2.3*A+1.8,bounds:{min:Te.min.toArray(),max:Te.max.toArray()}}:null,reaction:ye?.type||null,lastEvent:we?{...we}:null,renderer:n?{width:i.width,height:i.height,toneMapping:"ACESFilmic",exposure:n.toneMappingExposure}:null}}function De(){Pe(),h=!0,Ve.forEach(([N,G,Se])=>N.removeEventListener(G,Se)),o?.dispose(),me.dispose(),Ye.forEach(N=>N.dispose()),n?.dispose()}return{start:xe,stop:Pe,setStage:Ue,setAppearance:c,resize:$e,dispose:De,ready:Ge,isRunning:()=>u,state:H}}var xf={type:"change"},Jh={type:"start"},vf={type:"end"},Jl=new hs,yf=new En,Qx=Math.cos(70*Dt.DEG2RAD),hn=new L,On=2*Math.PI,Gt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Zh=1e-6,Kl=class extends bo{constructor(e,t=null){super(e,t),this.state=Gt.NONE,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:gs.ROTATE,MIDDLE:gs.DOLLY,RIGHT:gs.PAN},this.touches={ONE:_s.ROTATE,TWO:_s.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new L,this._lastQuaternion=new In,this._lastTargetPosition=new L,this._quat=new In().setFromUnitVectors(e.up,new L(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Mr,this._sphericalDelta=new Mr,this._scale=1,this._panOffset=new L,this._rotateStart=new ze,this._rotateEnd=new ze,this._rotateDelta=new ze,this._panStart=new ze,this._panEnd=new ze,this._panDelta=new ze,this._dollyStart=new ze,this._dollyEnd=new ze,this._dollyDelta=new ze,this._dollyDirection=new L,this._mouse=new ze,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=ty.bind(this),this._onPointerDown=ey.bind(this),this._onPointerUp=ny.bind(this),this._onContextMenu=cy.bind(this),this._onMouseWheel=ry.bind(this),this._onKeyDown=oy.bind(this),this._onTouchStart=ay.bind(this),this._onTouchMove=ly.bind(this),this._onMouseDown=iy.bind(this),this._onMouseMove=sy.bind(this),this._interceptControlDown=hy.bind(this),this._interceptControlUp=uy.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(xf),this.update(),this.state=Gt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;hn.copy(t).sub(this.target),hn.applyQuaternion(this._quat),this._spherical.setFromVector3(hn),this.autoRotate&&this.state===Gt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=On:n>Math.PI&&(n-=On),s<-Math.PI?s+=On:s>Math.PI&&(s-=On),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(hn.setFromSpherical(this._spherical),hn.applyQuaternion(this._quatInverse),t.copy(this.target).add(hn),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=hn.length();o=this._clampDistance(a*this._scale);let c=a-o;this.object.position.addScaledVector(this._dollyDirection,c),this.object.updateMatrixWorld(),r=!!c}else if(this.object.isOrthographicCamera){let a=new L(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let c=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=c!==this.object.zoom;let l=new L(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(a),this.object.updateMatrixWorld(),o=hn.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Jl.origin.copy(this.object.position),Jl.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Jl.direction))<Qx?this.object.lookAt(this.target):(yf.setFromNormalAndCoplanarPoint(this.object.up,this.target),Jl.intersectPlane(yf,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Zh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Zh||this._lastTargetPosition.distanceToSquared(this.target)>Zh?(this.dispatchEvent(xf),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?On/60*this.autoRotateSpeed*e:On/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){hn.setFromMatrixColumn(t,0),hn.multiplyScalar(-e),this._panOffset.add(hn)}_panUp(e,t){this.screenSpacePanning===!0?hn.setFromMatrixColumn(t,1):(hn.setFromMatrixColumn(t,0),hn.crossVectors(this.object.up,hn)),hn.multiplyScalar(e),this._panOffset.add(hn)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;hn.copy(s).sub(this.target);let r=hn.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),s=e-n.left,r=t-n.top,o=n.width,a=n.height;this._mouse.x=s/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(On*this._rotateDelta.x/t.clientHeight),this._rotateUp(On*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(On*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-On*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(On*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-On*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(n,s)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),s=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(On*this._rotateDelta.x/t.clientHeight),this._rotateUp(On*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new ze,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function ey(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function ty(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function ny(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(vf),this.state=Gt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function iy(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case gs.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=Gt.DOLLY;break;case gs.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Gt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Gt.ROTATE}break;case gs.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Gt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Gt.PAN}break;default:this.state=Gt.NONE}this.state!==Gt.NONE&&this.dispatchEvent(Jh)}function sy(i){switch(this.state){case Gt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case Gt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case Gt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function ry(i){this.enabled===!1||this.enableZoom===!1||this.state!==Gt.NONE||(i.preventDefault(),this.dispatchEvent(Jh),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(vf))}function oy(i){this.enabled!==!1&&this._handleKeyDown(i)}function ay(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case _s.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=Gt.TOUCH_ROTATE;break;case _s.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=Gt.TOUCH_PAN;break;default:this.state=Gt.NONE}break;case 2:switch(this.touches.TWO){case _s.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=Gt.TOUCH_DOLLY_PAN;break;case _s.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=Gt.TOUCH_DOLLY_ROTATE;break;default:this.state=Gt.NONE}break;default:this.state=Gt.NONE}this.state!==Gt.NONE&&this.dispatchEvent(Jh)}function ly(i){switch(this._trackPointer(i),this.state){case Gt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case Gt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case Gt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case Gt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=Gt.NONE}}function cy(i){this.enabled!==!1&&i.preventDefault()}function hy(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function uy(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var Pr={kitten:.64,baby:.64,young:.82,adult:1},wt=new L(0,.22,-3),Pt=Dt.clamp,Rt=i=>{let e=Pt(i,0,1);return e*e*(3-2*e)},dy=i=>Rt(i/.18)*Rt((1-i)/.2),fy=Dt.degToRad;async function bf({container:i,onPet:e=()=>{},onAction:t=()=>{},onAmbient:n=()=>{},onInteractionDone:s=()=>{},onProgress:r=()=>{}}){if(!i)throw new Error("没有找到小猫房间。");let o=matchMedia("(prefers-reduced-motion: reduce)"),a;try{a=new Ni({antialias:!0,alpha:!1,powerPreference:"default",preserveDrawingBuffer:!0})}catch{throw new Error("浏览器暂时无法显示 3D 房间，请启用硬件加速后重新打开。")}a.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),a.outputColorSpace=Zt,a.toneMapping=Ki,a.toneMappingExposure=1.22,a.shadowMap.enabled=!0,a.shadowMap.type=gi,a.domElement.setAttribute("aria-label","小猫的家；点击小猫抚摸，拖动查看房间"),a.domElement.setAttribute("role","img"),a.domElement.tabIndex=0,i.append(a.domElement);let c=new fi;c.background=new _t("#c3e4e4");let l=new an(35,1,.1,180);l.position.set(31,26,-43);let d=new Kl(l,a.domElement);d.target.set(0,7,1),d.enableDamping=!0,d.dampingFactor=.085,d.enablePan=!1,d.enableZoom=!0,d.rotateSpeed=.42,d.minDistance=42,d.maxDistance=72,d.minPolarAngle=.85,d.maxPolarAngle=1.32,d.minAzimuthAngle=2.48,d.maxAzimuthAngle=3.5,d.update(),a.domElement.style.touchAction="pan-y";let f=new Map;function h(v,D={}){let k=`${v}:${JSON.stringify(D)}`;return f.has(k)||f.set(k,new Ln({color:v,roughness:.9,...D})),f.get(k)}function u(v,D,k,te,de={}){let ie=new kt(new bn(...D),h(te,de));return ie.position.set(...k),ie.castShadow=!0,ie.receiveShadow=!0,v.add(ie),ie}function _(v,D,k,te,de,ie,Ce=10,et={}){let nt=new kt(new oo(D,k,te,Ce),h(ie,et));return nt.position.set(...de),nt.castShadow=!0,nt.receiveShadow=!0,v.add(nt),nt}let y=new ut;y.name="小猫的家",c.add(y),u(y,[49,1.2,44],[0,-.64,1],"#bc8d64");let g=["#d3a779","#dcaf82","#d8aa7d","#cfa073"];for(let v=0;v<11;v++)for(let D=0;D<4;D++)u(y,[12.03,.16,3.92],[-18.2+D*12.13,0,-19+v*4],g[(v+D*2)%g.length]);u(y,[49,23,.8],[0,11.3,23],"#a9d4cf"),u(y,[.8,23,44],[-24.5,11.3,1],"#b3ddd8"),u(y,[49,1,.5],[0,.55,22.48],"#f5eacb"),u(y,[.5,1,44],[-23.98,.55,1],"#f5eacb");let p=new ut;p.position.set(-10.5,14.5,22.48),y.add(p),u(p,[13.5,11.2,.6],[0,0,-.15],"#74bdcf",{emissive:"#499cac",emissiveIntensity:.1}),u(p,[4,1.05,.22],[-2.4,2.5,-.52],"#f9fff2"),u(p,[2.7,1.05,.22],[-2.7,3.1,-.52],"#f9fff2"),u(p,[2.6,.8,.22],[3.3,-1.5,-.52],"#e9f8e9"),[[15,1,1.5,0,6],[15,1,1.5,0,-6],[1,12,1.5,-7,0],[1,12,1.5,7,0],[.5,11,.75,0,0]].forEach(([v,D,k,te,de])=>u(p,[v,D,k],[te,de,-.65],"#fff3d9")),u(p,[16,.7,3],[0,-6.35,-1],"#f6e8c8");let S=new kt(new us(10,17),new pi({color:"#fff0ae",transparent:!0,opacity:.17,depthWrite:!1}));S.rotation.set(-Math.PI/2,0,-.32),S.position.set(-9,.095,6.6),y.add(S);let E=new ut;y.add(E);let __bed=window.CatOfflineBed.build({group:E,box:u}),b=__bed.frame,I=__bed.mattress,A=__bed.blanket;let F=E.children.flatMap(v=>{let{width:D,height:k,depth:te}=v.geometry.parameters;return[0,-.47,.47].flatMap(de=>[0,-.47,.47].map(ie=>v.position.clone().add(new L(D*de,k/2,te*ie))))}),m=new L(...window.CatOfflineBed.config.landing);function w(){E.updateWorldMatrix(!0,!0);let v=new Xt;return E.children.filter(D=>D.position.y>1.4).forEach(D=>v.union(new Xt().setFromObject(D))),{landing:m.toArray(),surfaceBounds:{min:[v.min.x,new Xt().setFromObject(I).max.y,v.min.z],max:v.max.toArray()}}}u(y,[19,.08,17],[0,.105,-2],"#f0e4ca"),u(y,[18.25,.08,16.25],[0,.15,-2],"#edcead");let T=new ut;T.position.set(-6.8,.205,-7.1),T.rotation.y=-.2,y.add(T),u(T,[2.2,.015,1.7],[0,0,0],"#d9b296"),[[-1.35,-1.2],[-.48,-1.85],[.48,-1.85],[1.35,-1.2]].forEach(([v,D])=>u(T,[.62,.015,.72],[v,0,D],"#d9b296"));function U(v,D,k,te){let de=new ut;return de.position.set(v,.2,D),y.add(de),u(de,[5.8,.38,5.8],[0,.15,0],k),[[5.8,1.3,.55,0,-2.65],[5.8,1.3,.55,0,2.65],[.55,1.3,4.7,-2.65,0],[.55,1.3,4.7,2.65,0]].forEach(([ie,Ce,et,nt,rt])=>u(de,[ie,Ce,et],[nt,.78,rt],k)),u(de,[4.7,.1,4.7],[0,.74,0],te),de}u(y,[13.2,.12,8],[15.4,.1,-12],"#739ea1");let B=U(12.2,-12,"#e79f88","#c78347");for(let v=0;v<10;v++){let D=u(B,[.7,.42,.7],[Math.sin(v*2.4)*1.6,.99+v%2*.1,Math.cos(v*1.8)*1.5],v%2?"#8b572e":"#a96a34");D.rotation.y=v}let re=U(18.8,-13,"#88b8c1","#8ecedc");u(re,[2.2,.025,.28],[-.5,.82,-1.15],"#d5f1f0");let se=re.children[5];se.material.emissive.set("#8ecedc");let Z=new ut;re.add(Z);let ee=[0,1].map(()=>{let v=new ut;return[[2,.025,.1,0,-1],[2,.025,.1,0,1],[.1,.025,2,-1,0],[.1,.025,2,1,0]].forEach(([D,k,te,de,ie])=>u(v,[D,k,te],[de,.82,ie],"#d5f1f0")),Z.add(v),v});Z.visible=!1,_(y,2.5,1.8,4,[-20.7,2.1,-15],"#bd8366",8),_(y,2.7,2.7,.6,[-20.7,4.05,-15],"#d19470",8),_(y,2.28,2.28,.16,[-20.7,4.4,-15],"#765845",8),u(y,[.7,7.5,.7],[-20.7,8,-15],"#639578"),[[-2.1,8.4,-.6,-.52],[2,10.2,.2,.5],[-1.7,12,.5,-.65],[1.4,13.1,-.2,.45]].forEach(([v,D,k,te])=>{let de=u(y,[3.8,1.5,2],[-20.7+v,D,-15+k],D>11?"#92b78c":"#72a786");de.rotation.z=te});let ae=new ut;ae.position.set(-8,1.3,-14),y.add(ae);let ye=new kt(new vr(1.35,0),h("#8ca9cf"));ye.castShadow=!0,ae.add(ye),u(ae,[1.4,.3,1.5],[0,.9,0],"#f0c281"),u(y,[1.65,1.65,1.65],[-17,.95,-13],"#dba78f").rotation.y=.34,u(y,[1.4,1.4,1.4],[-15,.82,-13.5],"#91bcb1").rotation.y=-.2,u(y,[6.3,5.3,.65],[9.7,14.2,22.4],"#f3e7ce"),u(y,[5.3,4.3,.12],[9.7,14.2,21.99],"#7fa6a2"),u(y,[2.2,1.2,.16],[9.3,14.2,21.83],"#f0b383"),u(y,[.9,1.6,.16],[10.9,14.2,21.83],"#f0b383").rotation.z=Math.PI/4,u(y,[.24,.24,.18],[8.7,14.4,21.72],"#48675f"),c.add(new mi("#fff8e8","#829d93",2.6));let be=new Zn("#fff0d3",3.1);be.position.set(-15,37,-23),be.castShadow=!0,be.shadow.mapSize.set(2048,2048),Object.assign(be.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:.5,far:100}),be.shadow.normalBias=.055,be.shadow.bias=-18e-5,be.shadow.radius=3,be.target.position.set(0,5,0),c.add(be,be.target);let O=new Zn("#d8f2ef",1.15);O.position.set(22,19,8),c.add(O);let z=await Ss(),{root:ne,bones:_e,applyAnimation:Fe,model:Ye,texture:me}=z,V=new ut,ge=new ut;c.add(V),V.add(ge),ge.add(ne),V.position.copy(wt);let j=[{id:"platform-1",position:new L(8.8,4.35,13.5),landing:new L(8.8,4.48,11.65),width:10.5},{id:"platform-2",position:new L(19.2,9.35,13.5),landing:new L(19.2,9.48,11.65),width:10.5}],Te=new L(0,.22,-4.5),we=new ut;y.add(we),u(we,[20,.8,14.5],[14,.6,13.5],"#8e7b67"),j.forEach((v,D)=>{let k=v.position.y-.9;for(let te of[8,19]){_(we,.85,.85,k,[v.position.x,.9+k/2,te],"#d4b68b",8);for(let de=1.5;de<k;de+=.7)_(we,.9,.9,.12,[v.position.x,de,te],"#b99771",8)}v.mesh=u(we,[v.width,.65,14],[v.position.x,v.position.y-.325,v.position.z],D?"#bd9275":"#b9947b"),u(we,[v.width-.5,.08,13.5],[v.position.x,v.position.y+.04,v.position.z],"#edd6b4")});let Re=u(we,[.12,4.7,.12],[23.4,16.4,3],"#f3dcb5"),Le=u(we,[3,.12,.12],[21.9,13.95,3],"#f3dcb5"),q=u(we,[1.2,1.2,1.2],[19.7,13.45,6.2],"#d59683");u(q,[.12,.12,.45],[0,.5,-.72],"#f3dcb5"),u(we,[2.2,.35,.7],[23.7,18.6,3],"#a88872"),u(we,[1.8,.4,1.8],[24.2,.4,3],"#8e7b67"),_(we,.42,.42,17.7,[24.2,9.75,3],"#a88872",8),Re.castShadow=!1;let he=new ut,Me=16.3;he.position.set(-15.2,.2,-4.5),he.rotation.y=Math.PI/2;let Ae=he.position.x+Me/2-.35;y.add(he),u(he,[13.5,.65,Me],[0,.375,0],"#eff6eb"),[[13.5,3.1,.65,0,-(Me/2-.35)],[13.5,3.1,.65,0,Me/2-.35],[.65,3.1,Me-1,-6.4,0],[.65,3.1,Me-1,6.4,0]].forEach(([v,D,k,te,de])=>u(he,[v,D,k],[te,1.85,de],"#e5eee5"));let Be=u(he,[12.1,.12,Me-1.8],[0,2.9,0],"#86c9d6",{transparent:!0,opacity:.66,metalness:.03,roughness:.3});u(he,[2.4,.03,.3],[-3.8,2.98,-5.8],"#dcfaf5"),u(he,[1.7,.03,.3],[3.6,2.98,4.7],"#dcfaf5");let ke=new L(-21.7,3.95,-11.1),qe=u(y,[2,.65,1.3],ke.toArray(),"#629f9b");u(qe,[2.02,.16,1.32],[0,-.3,0],"#f5e3b3"),u(qe,[1.15,.08,.75],[0,.37,0],"#bce1d3"),u(y,[1.5,.35,1.4],[-22,.42,-12.5],"#cfad8e"),u(y,[.8,2.5,.8],[-22,1.8,-12.5],"#f1dac6"),u(y,[.7,.45,.7],[-22,3.3,-12.5],"#8fbcb0");let $e=new ut;c.add($e);let it=new xr;[[-3,1],[-3,3],[-1,3],[0,2],[1,3],[3,3],[3,1],[0,-2],[-3,1]].forEach(([v,D],k)=>k?it.lineTo(v,D):it.moveTo(v,D));let X=new go(it,{depth:.4,bevelEnabled:!1}),gt=new pi({color:"#eea18f",transparent:!0}),ot=new vr(.8,0),R=new Ln({color:"#effffc",transparent:!0,opacity:.7,roughness:.35}),x=new ut;x.name="背上的肥皂泡沫",_e.get("body").add(x);let Q=h("#f1fff8",{emissive:"#bfe9e2",emissiveIntensity:.14,roughness:.8}),xe=[10,5,14,3,8,13,0,7,12,1,6,11,4,9,2,15].map((v,D)=>{let k=new kt(ot,Q);return k.position.set((v%4-1.5)*1.5,2.97,(Math.floor(v/4)-1.5)*2.1),k.scale.set(.7+D%3*.13,.55,.7+D%2*.14),k.castShadow=!0,k.visible=!1,x.add(k),k}),Pe=Array.from({length:16},()=>{let v=new kt(X,gt),D=new kt(ot,R);return v.visible=D.visible=!1,$e.add(v,D),{heart:v,bubble:D}}),Ue=new ut;u(Ue,[1.1,.45,.5],[0,0,0],"#efb276"),u(Ue,[.45,.65,.55],[.65,0,0],"#efb276"),u(Ue,[.12,.12,.1],[-.32,.12,-.29],"#5d6554"),Ue.visible=!1,$e.add(Ue);let fe=u($e,[.45,.1,1],[0,0,0],"#e3a19a");fe.visible=!1,fe.castShadow=!1;let ve=new ut;_(ve,.08,.08,5.4,[0,2.6,0],"#a68c73",6),[[0,.35,"#d59c8e",.5],[.55,.25,"#86b6b0",-.4],[-.45,.65,"#e7bc78",.7]].forEach(([v,D,k,te])=>{u(ve,[.6,1.9,.35],[v,D,0],k).rotation.z=te}),ve.visible=!1,$e.add(ve);let C=new ut;[[4,.12,.25,0,-2],[4,.12,.25,0,2],[.25,.12,4,-2,0],[.25,.12,4,2,0]].forEach(([v,D,k,te,de])=>u(C,[v,D,k],[te,0,de],"#f7d58c",{emissive:"#edb55b",emissiveIntensity:.48})),C.visible=!1,c.add(C);let Y=new ut;Y.visible=!1,$e.add(Y);for(let v=0;v<3;v++){let D=new ut;u(D,[2,.35,.35],[0,.8,0],"#799baf"),u(D,[2,.35,.35],[0,-.8,0],"#799baf"),u(D,[.35,2.15,.35],[0,0,0],"#799baf").rotation.z=-.81,Y.add(D)}let W=document.createElement("canvas");W.width=W.height=128;let K=W.getContext("2d"),Ie=K.createRadialGradient(64,64,7,64,64,64);Ie.addColorStop(0,"rgba(71,58,47,.23)"),Ie.addColorStop(.52,"rgba(71,58,47,.12)"),Ie.addColorStop(1,"rgba(71,58,47,0)"),K.fillStyle=Ie,K.fillRect(0,0,128,128);let Ve=new Fs(W),Ge=new kt(new us(13,18),new pi({map:Ve,transparent:!0,depthWrite:!1}));Ge.rotation.x=-Math.PI/2,c.add(Ge);let H=["front_left","front_right","back_left","back_right"],De="kitten",N=Pr.kitten,G=N,Se=null,J=[],He=null,Oe=[],yt=!1,P=null,pt=0,en=0,Nn=0,mn=0,gn=!1,si=0,vi=!0,ri="",Es="",Rn=new Ri;function ws(){E.updateWorldMatrix(!0,!0),ne.updateWorldMatrix(!0,!0);for(let v of F){Rn.set(l.position,v.clone().sub(l.position).normalize());let D=Rn.intersectObject(E,!0)[0];if(D&&!(Rn.intersectObject(ne,!0)[0]?.distance<D.distance)&&![B,re,he,we,ve].some(k=>Rn.intersectObject(k,!0)[0]?.distance<D.distance))return v}return A.position.clone().add(new L(0,.325,0))}let Oi=()=>[{id:"home-food",action:"feed",object:B,point:B.position.clone().add(new L(0,1.5,0))},{id:"home-water",action:"drink",object:re,point:re.position.clone().add(new L(0,1.5,0))},{id:"home-bath",action:"bath",object:he,point:he.position.clone().add(new L(0,3,0))},{id:"home-climb",action:"climb",object:we,point:j[0].position.clone()},{id:"home-feather",action:"tease",object:ve,point:new L(-1.5,.5,-8)},{id:"home-bed",action:"sleep",object:E,point:ws()}],Bi=0,tn=0,sn="idle",Kn="",oe=v=>Math.atan2(Math.sin(v),Math.cos(v)),Ne=v=>{let D=v.clone().project(l);return{x:(D.x+1)/2,y:(1-D.y)/2}};function Ee(v){if(!Object.hasOwn(Pr,v))throw new Error(`未知成长阶段：${v}`);return De=v,z.setStage(v),N=Pr[v],ac()}function We(){Y.visible=C.visible=Ue.visible=ve.visible=!1,fe.visible=Z.visible=!1,se.material.emissiveIntensity=0,Pe.forEach(({heart:v,bubble:D})=>{v.visible=D.visible=!1}),xe.forEach(v=>{v.visible=!1})}function ht(v){for(let D of["eye_left","eye_right"])_e.get(D)?.scale.setY(Dt.lerp(1,.12,v))}function bt(){return ne.updateWorldMatrix(!0,!0),_e.get("head").localToWorld(new L(0,-1,-5.85))}function M(v,D,k){Pe.forEach(({heart:te,bubble:de},ie)=>{let Ce=v==="bubble"?de:te,et=(k*.58+ie/Pe.length)%1;if(Ce.visible=D>.05&&et>.05&&et<.91,v==="bubble"){let nt=_e.get("body"),rt=Math.sign(nt.worldToLocal(l.position.clone()).x)||1,ct=nt.localToWorld(new L(rt*(.5+ie%4*.65),3.1,.8+Math.floor(ie/4)*.8));Ce.position.copy(ct).add(new L(Math.sin(ie*2.1+k)*et*1.8*G,et*8*G,Math.cos(ie*2.7)*et*.8*G))}else{let nt=4.5*G;Ce.position.set(V.position.x+Math.sin(ie*2.1+k)*nt,V.position.y+10*G+et*8*G,V.position.z+Math.cos(ie*2.7)*nt)}Ce.quaternion.copy(l.quaternion),Ce.scale.setScalar(v==="bubble"?(.72+ie%4*.2)*Math.sqrt(D):(.22+ie%3*.055)*D)})}function $(v){xe.forEach((D,k)=>{D.visible=v>(k+.1)/xe.length})}function le(v,D=3.3){let k=_e.get("body");k.position.y-=D*v;for(let te of H){let de=_e.get(te),ie=1-D/5.8*v;de.scale.y=ie,de.position.y-=5.8*(1-ie)}si=v}function ce(v=1,D=0,k=.72,te=2){let de=De==="kitten"||De==="baby"?1.065:1;le(v,te);let ie=_e.get("head");ie.rotation.set(-k*v-D,0,0,"ZYX");let Ce=new L(0,-2.2,.9).multiplyScalar(de);ie.position.add(Ce.clone().sub(Ce.clone().applyEuler(ie.rotation))),_e.get("tail_base").rotation.z+=.16*v,ht(v*.35)}function pe(){return Dt.lerp(.72,.98,Pt((G-Pr.kitten)/(Pr.adult-Pr.kitten),0,1))}function je(v=1,D=0){ce(v,-.007*D,pe(),1.9),z.setMouth(.05*D)}function tt(v=1){le(v,3),_e.get("body").rotation.x+=.08*v,_e.get("head").rotation.x+=.18*v,_e.get("tail_base").rotation.x-=.42*v,ht(v*.3)}function Je(v=1){tt(v),_e.get("head").rotation.x-=.18*v,_e.get("tail_base").rotation.x+=.42*v}function st(v){window.CatOfflineBed.pose({amount:v,bones:_e,model:z,inner:ge,root:ne,scale:G,stage:De,Vector:L,Box:Xt});si=v;sn="sleep"}function at(){if(Math.abs(ge.rotation.z)>.001)return;ne.updateWorldMatrix(!0,!0);let v=E.children.filter(D=>D.position.y>1.4).map(D=>new Xt().setFromObject(D));for(let D of H){let k=_e.get(D),te=new Xt().setFromObject(k),de=v.filter(ie=>te.max.x>ie.min.x&&te.min.x<ie.max.x&&te.max.z>ie.min.z&&te.min.z<ie.max.z);de.length&&(k.position.y+=(Math.max(...de.map(ie=>ie.max.y))+.02-te.min.y)/G)}}function xt(v,D){let k=V.rotation.y,te=oe(v-k);P.sleepTurn={from:k,to:k+te,radius:D,pivot:V.position.clone().add(new L(Math.sin(k)*D,0,Math.cos(k)*D))}}function Mt(v){let D=P.sleepTurn,k=V.rotation.y;return V.rotation.y+=Pt(D.to-k,-v*2.4,v*2.4),V.position.x=D.pivot.x-Math.sin(V.rotation.y)*D.radius,V.position.z=D.pivot.z-Math.cos(V.rotation.y)*D.radius,It(v,!0,Math.abs(V.rotation.y-k)*D.radius),_n(.18),Math.abs(D.to-V.rotation.y)<.025}function lt(v,D,k){let te=V.position.clone(),de=Math.atan2(te.x-v.x,te.z-v.z);P.bedHop={from:te,to:v,angle:D,nextPhase:k,flightAngle:de,fromAngle:V.rotation.y,duration:1.45},dt(v.y>te.y?"上床蓄力":"下床蓄力")}function Ot(){let v=P.bedHop;if(P.phase==="上床蓄力"||P.phase==="下床蓄力"){le(Rt(P.phaseTime/.28),1.8),P.phaseTime>.3&&dt(v.to.y>v.from.y?"轻轻上床":"轻轻下床");return}let D=Pt(P.phaseTime/v.duration,0,1),k=Rt((D-.23)/.6);V.position.copy(v.from).lerp(v.to,k);let te=Math.max(v.from.y,v.to.y,3.8);V.position.y=D<.23?Dt.lerp(v.from.y,te,Rt(D/.23)):D>.83?Dt.lerp(te,v.to.y,Rt((D-.83)/.17)):te+Math.sin((D-.23)/.6*Math.PI)*.55,V.rotation.y=D<.23?v.fromAngle:D<.5?v.fromAngle+oe(v.flightAngle-v.fromAngle)*Rt((D-.23)/.27):v.flightAngle+oe(v.angle-v.flightAngle)*Rt((D-.5)/.33),H.forEach(de=>{_e.get(de).rotation.x+=Math.sin(D*Math.PI)*.45}),sn="jump",D>=1&&(V.position.copy(v.to),V.rotation.y=v.angle,P.bedHop=null,dt(v.nextPhase))}function jt(v){if(P.phaseTime+=v,Fe("idle",0),P.bedHop){Ot();return}P.phase==="走向床边"?Ke(new L(0,wt.y,-5),v,5.5)&&lt(m.clone(),Math.PI/2,"床上入睡"):P.phase==="床上入睡"?(st(Rt(P.phaseTime/.8)),P.phaseTime>.85&&dt("睡着")):P.phase==="睡着"?(st(1),_e.get("body").position.y+=Math.sin(P.phaseTime*2.2)*.055,Y.visible=!0,P.phaseTime>2.8&&dt("醒来起身")):P.phase==="醒来起身"?(st(1-Rt(P.phaseTime/.8)),P.phaseTime>.85&&lt(wt.clone(),0,"回家")):P.phase==="回家"&&Ke(wt,v,4.5)&&Or(!0),P&&["床上入睡","睡着","醒来起身","转向下床"].includes(P.phase)&&at(),Y.visible&&Y.children.forEach((D,k)=>{D.position.set(V.position.x+3*G+k*1.6,8*G+k*1.4,V.position.z-2),D.quaternion.copy(l.quaternion),D.scale.setScalar(.6+k*.16)})}function It(v,D,k=0){Bi+=k,tn=Dt.lerp(tn,D?1:0,Math.min(1,v*12)),Fe("idle",pt),sn=D||tn>.08?"walk":"idle";let te=Bi/(5.1*G)*Math.PI*2;H.forEach((de,ie)=>{let Ce=Math.sin(te+(ie===1||ie===2?Math.PI:0)),et=_e.get(de);et.rotation.x=Ce*.38*tn,et.position.y+=Math.max(0,Ce)*.72*tn}),_e.get("body").rotation.z=Math.sin(te)*.035*tn,_e.get("head").rotation.z-=Math.sin(te)*.024*tn,_e.get("head").rotation.x=-.04*tn}function Vt(v,D){let k=Math.hypot(D.x,D.z),te=V.rotation.y,de=-Math.sin(te)*D.x-Math.cos(te)*D.z,ie=Math.cos(te)*D.x-Math.sin(te)*D.z;It(v,k>.005,k*(de<-k*.2?-1:1));let Ce=k?ie/k:0,et=k?Math.abs(de)/k:0,nt=Bi/(5.1*G)*Math.PI*2;H.forEach((rt,ct)=>{let Tt=_e.get(rt),Bt=Math.sin(nt+(ct===1||ct===2?Math.PI:0));Tt.rotation.x*=et,Tt.rotation.z+=Bt*.22*tn*Ce})}function dn(v,D,k=8){let te=v.x-V.position.x,de=v.z-V.position.z;if(Math.hypot(te,de)<.02)return!0;let ie=Math.atan2(-te,-de),Ce=oe(ie-V.rotation.y);return V.rotation.y+=Pt(Ce,-D*k,D*k),Math.abs(Ce)<.11}function Ke(v,D,k=7.3){let te=v.x-V.position.x,de=v.z-V.position.z,ie=Math.hypot(te,de);if(ie<=.07)return V.position.copy(v),It(D,!1),!0;let Ce=dn(v,D),et=Math.abs(oe(Math.atan2(-te,-de)-V.rotation.y)),nt=ie>.07&&et<.28?Math.min(ie,D*k*Pt(ie/.8,.25,1)):0;return ie>0&&(V.position.x+=te/ie*nt,V.position.z+=de/ie*nt),It(D,nt>0,nt),ie<.07&&Ce}function dt(v){P.phase=v,P.phaseTime=0,Kn=""}function At(v=B,D=.72){let te=-2.4+(De==="kitten"||De==="baby"?1.065:1)*(.9-1.2*Math.sin(D)-6.75*Math.cos(D));return new L(v.position.x,.22,v.position.z-te*G)}function Cn(v=B,D=.72){return At(v,D).add(new L(0,0,2.6*G))}function Un(){let v=At(re,pe()),D=_e.get("head"),k=z.state().outfit;if(Se!==k){D.updateWorldMatrix(!0,!0);let ct=D.matrixWorld.clone().invert();J=[],D.traverse(Tt=>{if(!Tt.isMesh||!Tt.visible)return;Tt.geometry.computeBoundingBox();let{min:Bt,max:Yt}=Tt.geometry.boundingBox,Lt=ct.clone().multiply(Tt.matrixWorld),Ht=[];for(let rn of[Bt.x,Yt.x])for(let Qn of[Bt.y,Yt.y])for(let ki of[Bt.z,Yt.z])Ht.push(new L(rn,Qn,ki).applyMatrix4(Lt));J.push(Ht)}),Se=k}let te=De==="kitten"||De==="baby"?1.065:1,de=pe(),ie=Math.sin(de),Ce=Math.cos(de),et=11-1.9+te*(-2.2+2.2*Ce-.9*ie),nt=-2.4+te*(.9-2.2*ie-.9*Ce),rt=2;for(let ct of J){let Tt=1/0,Bt=1/0;for(let Yt of ct)Tt=Math.min(Tt,wt.y+G*(et+te*(Yt.y*Ce+Yt.z*ie))),Bt=Math.min(Bt,v.z+G*(nt+te*(-Yt.y*ie+Yt.z*Ce)));Tt<1.75&&(rt=Math.max(rt,re.position.z+3.04-Bt))}return v.add(new L(0,0,rt))}function oi(){return Un().add(new L(0,0,.2*G))}function _n(v){let D=Pt(v,0,1);for(let k of H){let te=_e.get(k);te.rotation.x*=D,te.position.y=te.userData.basePosition[1]+(te.position.y-te.userData.basePosition[1])*D}}function Ft(){return new L(Ae+.325+2.12*G+.45,wt.y,he.position.z)}function qt(){let v=_e.get("body"),D=z.state().outfit;if(He!==D){v.updateWorldMatrix(!0,!0);let ie=v.matrixWorld.clone().invert(),Ce=new Set(_e.values());Oe=[],v.traverse(et=>{if(!et.isMesh||!(et.userData.uuid||et.userData.accessory))return;let nt=et.parent;for(;nt&&!Ce.has(nt);)nt=nt.parent;if(nt!==v)return;et.geometry.computeBoundingBox();let{min:rt,max:ct}=et.geometry.boundingBox,Tt=ie.clone().multiply(et.matrixWorld),Bt=[];for(let Yt of[rt.x,ct.x])for(let Lt of[rt.y,ct.y])for(let Ht of[rt.z,ct.z])Bt.push(new L(Yt,Lt,Ht).applyMatrix4(Tt));Oe.push(Bt)}),He=D}let k=(he.position.y+3.4-.91)/G,te=new ni(.08,0,0,"ZYX"),de=7.1;for(let ie of Oe){let Ce=ie.map(et=>et.clone().applyEuler(te).add(new L(...v.userData.basePosition)).sub(new L(0,3,0)));for(let et=0;et<Ce.length;et++){let nt=Ce[et];nt.y<=k&&(de=Math.max(de,nt.z));for(let rt of[1,2,4]){let ct=et^rt;if(ct<=et)continue;let Tt=Ce[ct];(nt.y-k)*(Tt.y-k)<0&&(de=Math.max(de,Dt.lerp(nt.z,Tt.z,(k-nt.y)/(Tt.y-nt.y))))}}}return new L(Math.min(Ae-7.9*G,Ae-.325-.12-de*G),.91,he.position.z)}function bi(v){return H.map((D,k)=>new L(v.x+(k<2?-.86:5.84)*G,v.y,v.z-(k%2?1:-1)*(k<2?2.3:2.35)*G))}function Ut(v,D,k=!1){return H.map((te,de)=>{let ie=k?de<2?1.85:1.9:de<2?2.3:2.35,Ce=k?de<2?-.1:4.5:de<2?-.86:5.84;return new L((de%2?1:-1)*ie,0,Ce).multiplyScalar(G).applyAxisAngle(new L(0,1,0),D).add(v)})}function ai(){qt();let v=(he.position.y+3.4-wt.y)/G,D=7.1;for(let k of Oe){let te=k.map(de=>de.clone().add(new L(..._e.get("body").userData.basePosition)));for(let de=0;de<te.length;de++){let ie=te[de];ie.y<=v&&(D=Math.max(D,ie.z));for(let Ce of[1,2,4]){let et=de^Ce;if(et<=de)continue;let nt=te[et];(ie.y-v)*(nt.y-v)<0&&(D=Math.max(D,Dt.lerp(ie.z,nt.z,(v-ie.y)/(nt.y-ie.y))))}}}return new L(Ae+.325+.2+D*G,wt.y,he.position.z)}function es(){let v=V.position.clone(),D=Ut(v,Math.PI/2),k=Ut(v,Math.PI/2,!0),te=[{position:v,yaw:Math.PI/2,headYaw:0,feet:D,phase:"收拢爪子"}],de=D.map(rt=>rt.clone());for(let rt of[3,2,1,0])de[rt]=k[rt].clone(),te.push({position:v.clone(),yaw:Math.PI/2,headYaw:0,feet:de.map(ct=>ct.clone()),phase:"收拢爪子"});let ie=v.x+3*G,Ce=Ae-.325-.7-5.15*G;for(let rt=1;rt<=8;rt++){let ct=rt/8,Tt=Math.PI/2+Math.PI*ct,Bt=Dt.lerp(ie,Ce,Rt(ct)),Yt=new L(Bt-Math.sin(Tt)*3*G,.91,he.position.z-Math.cos(Tt)*3*G),Lt=Ut(Yt,Tt,!0),Ht=ct<.5?-Math.sin(ct*Math.PI*2)*.3:0,rn=te.at(-1);for(let[Qn,ki]of[1,3,0,2].entries()){de[ki]=Lt[ki].clone();let cc=(Qn+1)/4;te.push({position:rn.position.clone().lerp(Yt,cc),yaw:Dt.lerp(rn.yaw,Tt,cc),headYaw:Dt.lerp(rn.headYaw,Ht,cc),feet:de.map(Vf=>Vf.clone()),phase:"转身朝向出口"})}}let et=te.at(-1),nt=Ut(et.position,et.yaw);for(let rt of[3,2,1,0])de[rt]=nt[rt].clone(),te.push({position:et.position.clone(),yaw:et.yaw,headYaw:0,feet:de.map(ct=>ct.clone()),phase:"站稳准备出盆"});P.bathTurn={knots:te,step:0,feet:D.map(rt=>rt.clone())},dt("收拢爪子")}function Fr(v,D,k=0,te=.6){Fe("idle",0);let de=_e.get("body"),ie=(v[0].y+v[1].y)/2,Ce=(v[2].y+v[3].y)/2,et=(ie+Ce)/2-V.position.y+Math.sin(D*Math.PI)*te;de.position.y+=et/G,de.rotation.set(Pt(Math.atan2(ie-Ce,6.7*G),-.22,.22),0,0,"ZYX");let nt=_e.get("head");nt.rotation.x+=Math.sin(D*Math.PI)*.08-de.rotation.x,nt.rotation.y+=k;let rt=Math.abs(k);nt.position.z-=Math.max(0,.9/Math.cos(rt)+2.51*Math.tan(rt)-1.395),de.rotation.x<0&&nt.position.applyEuler(new ni(-de.rotation.x,0,0,"ZYX")),_e.get("tail_base").rotation.x-=Math.sin(D*Math.PI)*.28,ne.updateWorldMatrix(!0,!0),H.forEach((ct,Tt)=>{let Bt=_e.get(ct),Lt=new L(...Bt.userData.basePosition).sub(new L(...de.userData.basePosition)).applyEuler(de.rotation).add(de.position),Ht=ne.worldToLocal(v[Tt].clone()),rn=Ht.clone().sub(Lt),Qn=Tt<2?5.8:5.9;Bt.position.copy(Lt),Bt.quaternion.setFromUnitVectors(new L(0,-1,0),rn.clone().normalize()),Bt.scale.set(1,rn.length()/Qn,1),ne.updateWorldMatrix(!0,!0);let ki=new Xt().setFromObject(Bt).min.y;Bt.position.y+=(v[Tt].y-ki)/G}),yt=!0,sn="step",si=Math.sin(D*Math.PI)}function Pf(){let v=P.bathTurn,D=v.knots[v.step],k=v.knots[v.step+1],te=Pt(P.phaseTime/(D.phase==="收拢爪子"||k.phase==="站稳准备出盆"?.23:.15),0,1),de=Rt(te);V.position.copy(D.position).lerp(k.position,de),V.rotation.y=Dt.lerp(D.yaw,k.yaw,de),v.feet=D.feet.map((ie,Ce)=>ie.clone().lerp(k.feet[Ce],de).add(new L(0,ie.distanceTo(k.feet[Ce])>.01?Math.sin(te*Math.PI)*.48*G:0,0))),Fr(v.feet,(v.step+de)/(v.knots.length-1),Dt.lerp(D.headYaw,k.headYaw,de),0),te>=1&&(v.step++,v.step>=v.knots.length-1?(P.bathTurn=null,su(!0)):dt(v.knots[v.step+1].phase))}function su(v=!1){if(!v){let k=Ft(),te=qt(),de=bi(k),ie=[{position:k,feet:de.map(Tt=>Tt.clone()),phase:"搭上前爪"}],Ce=Ae,et=3.74,nt=Ce+.325+1.26*G+.25,rt=Ce-.325-1.42*G-.3,ct=(Tt,Bt,Yt,Lt,Ht,rn=wt.y)=>{de[Tt].x=Bt,de[Tt].y=Yt,ie.push({position:new L(Lt,rn,he.position.z),feet:de.map(Qn=>Qn.clone()),phase:Ht})};ct(1,Ce,et,k.x,"搭上前爪"),ct(0,Ce,et,k.x,"搭上前爪"),ct(3,nt,wt.y,Ce+.7,"挪近后爪"),ct(2,nt,wt.y,Ce,"挪近后爪"),ct(1,rt,.91,Ce,"跨入前爪"),ct(0,rt,.91,Ce,"跨入前爪"),ct(1,Ce-4.2*G,.91,Ce-2*G,"挪进身体"),ct(0,Ce-4.2*G,.91,Ce-3*G,"挪进身体"),ct(3,Ce,et,Ce-3.8*G,"搭上后爪"),ct(2,Ce,et,Ce-5.5*G,"搭上后爪"),ct(1,Ce-6.86*G,.91,Ce-6*G,"挪进身体"),ct(0,Ce-7.36*G,.91,Ce-6.5*G,"挪进身体"),ct(3,te.x+5.84*G,.91,Dt.lerp(Ce-6.5*G,te.x,.5),"跨入后爪",.56),ct(2,te.x+5.84*G,.91,te.x,"跨入后爪",te.y),ct(1,te.x-.86*G,.91,te.x,"站稳",te.y),ct(0,te.x-.86*G,.91,te.x,"站稳",te.y),P.bathKnots=ie}let D=P.bathKnots;if(v){V.rotation.y=-Math.PI/2;let k=V.position.clone(),te=ai(),de=Ut(k,-Math.PI/2);D=[{position:k,feet:de.map(ct=>ct.clone()),phase:"前爪搭上出口"}];let ie=Ae,Ce=3.74,et=ie-.325-1.26*G-.25,nt=ie+.325+1.42*G+.3,rt=(ct,Tt,Bt,Yt,Lt,Ht=.91)=>{de[ct].x=Tt,de[ct].y=Bt,D.push({position:new L(Yt,Ht,he.position.z),feet:de.map(rn=>rn.clone()),phase:Lt})};rt(1,ie,Ce,k.x,"前爪搭上出口"),rt(0,ie,Ce,k.x,"前爪搭上出口"),rt(3,et,.91,ie-.7,"后爪跟近出口"),rt(2,et,.91,ie,"后爪跟近出口"),rt(1,nt,wt.y,ie+.45,"前爪跨出浴盆"),rt(0,nt,wt.y,ie+.65,"前爪跨出浴盆"),rt(1,ie+4.2*G,wt.y,ie+2*G,"身体慢慢出盆"),rt(0,ie+4.2*G,wt.y,ie+3*G,"身体慢慢出盆"),rt(3,ie,Ce,ie+3.8*G,"后爪搭上出口"),rt(2,ie,Ce,ie+5.5*G,"后爪搭上出口"),rt(1,ie+6.86*G,wt.y,ie+6*G,"身体慢慢出盆"),rt(0,ie+7.36*G,wt.y,ie+6.5*G,"身体慢慢出盆"),rt(3,te.x-5.84*G,wt.y,Dt.lerp(ie+6.5*G,te.x,.75),"后爪跨出浴盆",.56),rt(2,te.x-5.84*G,wt.y,te.x,"后爪跨出浴盆",te.y),rt(1,te.x+.86*G,wt.y,te.x,"走出浴盆",te.y),rt(0,te.x+.86*G,wt.y,te.x,"走出浴盆",te.y)}P.bathTransfer={outward:v,knots:D,step:0,feet:D[0].feet.map(k=>k.clone())},dt(D[1].phase)}function If(){let v=P.bathTransfer,{knots:D,step:k,outward:te}=v,de=D[k],ie=D[k+1],Ce=Pt(P.phaseTime/.62,0,1),et=Rt(Ce);V.position.copy(de.position).lerp(ie.position,et),V.rotation.y=te?-Math.PI/2:Math.PI/2,v.feet=de.feet.map((nt,rt)=>{let ct=ie.feet[rt];if(!(nt.distanceTo(ct)>.01))return nt.clone();let Bt=Rt((Ce-.24)/.52),Yt=nt.clone().lerp(ct,Bt),Lt=Math.min(nt.x,ct.x)<Ae&&Math.max(nt.x,ct.x)>Ae,Ht=Math.max(nt.y,ct.y,Lt?3.74:0)+.45;return Yt.y=Ce<.24?Dt.lerp(nt.y,Ht,Rt(Ce/.24)):Ce>.76?Dt.lerp(Ht,ct.y,Rt((Ce-.76)/.24)):Ht,Yt}),Fr(v.feet,(k+et)/(D.length-1)),Ce>=1&&(v.step++,v.step>=D.length-1?(P.bathTransfer=null,tn=0,dt(te?"离开浴盆":"擦洗")):dt(D[v.step+1].phase))}function No(v,D,k=4.5){let te=V.position.clone(),de=v.clone(),ie=P.name==="climb"?Math.max(te.y,de.y)+.8:Math.max(te.y,de.y)+k,Ce=Math.hypot(de.x-te.x,de.z-te.z);P.jump={from:te,to:de,height:k,clearance:ie,nextPhase:D,duration:Math.max(1.55,Ce/10+(ie-Math.min(te.y,de.y))/16),takeoffAngle:V.rotation.y},dt("蓄力")}function Lf(v){let D=P.jump;if(Fe("idle",pt),P.phase==="蓄力")le(Rt(P.phaseTime/.3),2.1),P.phaseTime>=.38&&(D.takeoffAngle=V.rotation.y,dt("跳跃"));else if(P.phase==="跳跃"){let k=Pt(P.phaseTime/D.duration,0,1),te=Rt((k-.28)/.44);V.position.copy(D.from).lerp(D.to,te),V.position.y=k<.28?Dt.lerp(D.from.y,D.clearance,Rt(k/.28)):k>.72?Dt.lerp(D.clearance,D.to.y,Rt((k-.72)/.28)):D.clearance+Math.sin((k-.28)/.44*Math.PI)*.45;let de=Math.atan2(D.from.x-D.to.x,D.from.z-D.to.z);V.rotation.y=k<.5?D.takeoffAngle+oe(de-D.takeoffAngle)*Rt((k-.28)/.2):de+oe(-de)*Rt((k-.5)/.22),_e.get("body").rotation.x=Math.sin(k*Math.PI)*.1,H.forEach(ie=>{_e.get(ie).rotation.x+=Math.sin(k*Math.PI)*.72}),sn="jump",k>=1&&(V.position.copy(D.to),dt("落地"))}else{V.position.copy(D.to);let k=Math.sin(Pt(P.phaseTime/.38,0,1)*Math.PI)*.78;if(le(k,1.8),V.rotation.y+=Pt(oe(0-V.rotation.y),-v*8,v*8),P.phaseTime>=.4){let te=D.nextPhase;P.jump=null,dt(te)}}}function Or(v=!0){if(!P)return;let D=P;P=null,V.position.copy(wt),V.rotation.set(0,0,0),ge.position.set(0,0,0),ge.rotation.set(0,0,0),d.enabled=!0,a.domElement.style.touchAction="pan-y",We(),Fe("idle",pt),Kn="",r({action:D.name,phase:v?"完成":"取消",progress:v?1:D.progress,message:v?D.name==="drink"?"小猫喝好水，精神多啦！":"小猫玩得很开心！":"这次先休息一下",targets:[],completed:v}),D.interactive?D.resolve({ok:v,completed:v,score:v?D.hits:0}):D.resolve(v),v&&s(D.name)}function nc(){return P&&Or(!1),ac()}function ru(v){return["feed","drink","bath","climb","tease"].includes(v)?gn||P?Promise.resolve({ok:!1,completed:!1,score:0}):(d.enabled=!1,a.domElement.style.touchAction="none",new Promise(D=>{P={name:v,interactive:!0,resolve:D,elapsed:0,phaseTime:0,phase:v==="tease"?"陪玩":"接近",hits:0,progress:0,scrubDistance:0,recentRub:0,pointerMoves:0,lastCatchMove:0,target:new L(-2.5,.22,-8.5),lastPointer:null,rubPoint:new L(1.8,3.22,1.2)},Kn="",jn(!0)})):Promise.reject(new Error(`未知互动：${v}`))}function Df(v){return["feed","drink","bath","climb","tease"].includes(v)?ru(v):["pet","sleep","play"].includes(v)?gn||P?Promise.resolve(!1):new Promise(D=>{P={name:v,resolve:D,interactive:!1,phase:v==="sleep"?"走向床边":"互动",elapsed:0,phaseTime:0,progress:0,hits:0,duration:2.5}}):Promise.reject(new Error(`未知互动：${v}`))}function ic(){if(!P?.interactive)return[];if(P.name==="feed"&&P.phase==="投喂")return[{id:"food-bowl",kind:"feed",point:B.position.clone().add(new L(0,1.6,0)),object:B}];if(P.name==="drink"&&P.phase==="饮水")return[{id:"water-bowl",kind:"drink",point:re.position.clone().add(new L(1.3,1.1,-1.8)),object:re}];if(P.name==="bath"&&P.phase==="擦洗")return ne.updateWorldMatrix(!0,!0),[{id:"cat-back",kind:"rub",point:_e.get("body").localToWorld(new L(0,2.8,0)),object:ne}];if(P.name==="climb"&&["第一层","第二层"].includes(P.phase)){let v=j[P.phase==="第一层"?0:1];return[{id:v.id,kind:"climb",point:v.position.clone().add(new L(0,.15,0)),object:v.mesh}]}return P.name==="climb"&&P.phase==="吊球"?[{id:"dangling-ball",kind:"toy",point:q.getWorldPosition(new L),object:q}]:P.name==="tease"&&P.phase==="陪玩"?[{id:"feather",kind:"move",point:P.target.clone().add(new L(0,.8,0)),object:ve}]:[]}function Nf(){return P?{接近:"小猫正在走过来…",对准食盆:"小猫转过来，准备吃饭",走向食盆:"轻轻走近食盆…",退开食盆:"吃饱啦，后退两步再回家",投喂:`点橘色食盆，一口一口喂（${P.hits}/3）`,咀嚼:"嚼嚼…小鱼真香！",对准水碗:"小猫转过来，准备喝水",走向水碗:"轻轻走近蓝色水碗…",饮水:`点亮着的蓝色水碗，陪小猫喝三口水（${P.hits}/3）`,舔水:"舔舔…凉凉的水真舒服！",喝好:"喝好水啦，抬起小脑袋",退开水碗:"慢慢退开水碗…",转身回家:"小猫转过身，准备回家",对准浴盆:"转过身，对准浴盆边",走近浴盆:"慢慢走到浴盆边…",搭上前爪:"先搭上一只前爪，再搭另一只…",挪近后爪:"后爪慢慢跟过来…",跨入前爪:"前爪轻轻跨过盆沿，踩进水里",挪进身体:"身体一点点挪进浴盆…",搭上后爪:"后爪也搭上盆沿…",跨入后爪:"最后两只后爪跨进来啦",站稳:"四只爪子站稳，准备洗澡",收拢爪子:"收好爪子，准备转身",转身朝向出口:"一小步一小步，转身看向出口",站稳准备出盆:"站稳啦，准备往前爬出去",前爪搭上出口:"先把前爪搭上盆沿",后爪跟近出口:"后爪跟上来，站稳身体",前爪跨出浴盆:"前爪轻轻跨到地板上",身体慢慢出盆:"身体跟着前爪慢慢爬出去",后爪搭上出口:"后爪依次抬上盆沿",后爪跨出浴盆:"后爪也跨出浴盆啦",走出浴盆:"四只爪子都落地了",离开浴盆:"往前走开盆边，再慢慢回家",绕开浴盆:"站稳转过身，回到小地毯上",擦洗:"按住小猫的背来回擦，泡泡越多越干净",冲水:"冲掉泡泡…",甩水:"甩甩水珠，再擦干！",第一层:"点亮着的小平台，带小猫跳上去",第二层:"点上层平台，继续往上爬",吊球:"点粉色吊球，让小猫伸爪抓住它",蓄力:"蹲下、准备跳！",跳跃:"跳起来！",落地:"稳稳落地",庆祝:"抓到啦！",下架:"小猫准备下来了",陪玩:`在地毯上移动鼠标或手指，带小猫扑羽毛（${P.hits}/5）`,扑击:"扑到了！换个地方继续逗它",回家:"小猫心满意足地回家啦"}[P.phase]||"和小猫一起玩吧":""}function jn(v=!1){if(!P?.interactive)return;let D=ic(),k={action:P.name,phase:P.phase,progress:Pt(P.progress,0,1),message:Nf(),targets:D.map(({id:de,kind:ie,point:Ce})=>({id:de,kind:ie,...Ne(Ce)}))},te=`${k.phase}:${Math.round(k.progress*100)}:${P.hits}`;(v||te!==Kn)&&(Kn=te,r(k)),C.visible=D.length>0&&D[0].kind!=="rub",C.visible&&(C.position.copy(D[0].point),C.position.y+=.16,C.scale.setScalar(D[0].kind==="climb"?1.2:D[0].kind==="move"?.65:.85))}function Uf(v){P.elapsed+=v,P.phaseTime+=v;let D=P.name;if(Fe("idle",D==="bath"?0:pt),sn="idle",P.bathTurn){Pf(),jn();return}if(P.bathTransfer){If(),jn();return}if(P.jump){Lf(v),jn();return}if(D==="drink"&&P.phase==="转身回家"){let{from:k,pivot:te,radius:de}=P.waterTurn,ie=Math.atan2(te.x-wt.x,te.z-wt.z),Ce=V.rotation.y;V.rotation.y+=Pt(oe(ie-Ce),-v*4,v*4),V.position.set(te.x-Math.sin(V.rotation.y)*de,k.y,te.z-Math.cos(V.rotation.y)*de),It(v,!0,Math.abs(V.rotation.y-Ce)*de),_n(.25),Math.abs(oe(ie-V.rotation.y))<.04&&dt("回家"),jn();return}if(P.phase==="回家"){if(V.position.y=.22,D==="tease"){Ke(wt,v,5.5)&&(V.rotation.y+=Pt(oe(-V.rotation.y),-v*4,v*4),Math.abs(oe(V.rotation.y))<.03&&Or(!0)),jn();return}let k=Ke(wt,v);if(D==="bath"&&_n(.18),k){let te=D==="bath"?-V.rotation.y:oe(-V.rotation.y);V.rotation.y+=Pt(te,-v*7,v*7),Math.abs(oe(V.rotation.y))<.08&&Or(!0)}jn();return}if(D==="feed"||D==="drink"){let k=D==="drink",te=k?re:B,de=k?pe():.72,ie=k?Un():At(te,de),Ce=k?oi():Cn(te,de),et=k?"对准水碗":"对准食盆",nt=k?"走向水碗":"走向食盆",rt=k?"饮水":"投喂",ct=k?"舔水":"咀嚼",Tt=k?"喝好":"吃饱",Bt=k?"退开水碗":"退开食盆",Yt=k?je:ce;if(P.phase==="接近")if(P.feedTurned)Ke(Ce,v)&&dt(et);else{let Lt=Ce,Ht=Math.atan2(-(Lt.x-wt.x),-(Lt.z-wt.z)),rn=V.rotation.y;V.rotation.y+=Pt(oe(Ht-rn),-v*8,v*8),V.position.set(wt.x-Math.sin(V.rotation.y)*2.5,wt.y,wt.z+2.5-Math.cos(V.rotation.y)*2.5),It(v,!0,Math.abs(V.rotation.y-rn)*2.5),_n(.25),Math.abs(oe(Ht-V.rotation.y))<.06&&(P.feedTurned=!0)}else if(P.phase===et)It(v,!1),V.rotation.y+=Pt(oe(-V.rotation.y),-v*7,v*7),Math.abs(oe(V.rotation.y))<.06&&(V.rotation.y=0,dt(nt));else if(P.phase===nt){let Lt=Math.max(0,V.position.z-ie.z);Ke(ie,v,4)&&dt("就位"),_n(.25*Rt(Lt/(2.6*G)))}else if(P.phase==="就位")V.rotation.y+=Pt(oe(-V.rotation.y),-v*7,v*7),Yt(Rt(P.phaseTime/.55)),P.phaseTime>.6&&dt(rt);else if(P.phase===rt)Yt(),k&&(se.material.emissiveIntensity=.25+Math.sin(pt*3)*.08);else if(P.phase===ct&&k){let Lt=P.phaseTime,Ht=Math.max(0,Math.sin(Lt/.75*Math.PI*6));je(1,Ht),sn="drink",fe.visible=Ht>.12,Z.visible=!0,ee.forEach((rn,Qn)=>{let ki=.25+(Lt*2+Qn*.45)%1*.75;rn.scale.set(ki,1,ki)}),Lt>=.75&&dt(P.hits>=3?Tt:rt)}else if(P.phase===ct){let Lt=P.phaseTime;if(ce(1,Lt>=.5?Math.sin(Lt*14)*.012:0),sn="eat",Lt<.5){Ue.visible=!0;let Ht=bt();Ue.position.copy(B.position).add(new L(0,1.3,0)).lerp(Ht,Rt(Lt/.5)),Ue.scale.setScalar(1-Rt(Lt/.5)*.5)}else z.setMouth((Math.sin((Lt-.5)*19)+1)*.5),M("heart",.4,Lt);Lt>1.3&&(P.hits>=3?dt(Tt):dt(rt))}else if(P.phase===Tt)Yt(1-Rt(P.phaseTime/.55)),z.setMouth(0),P.phaseTime>.6&&dt(Bt);else if(P.phase===Bt){let Lt=Math.max(0,V.position.z-ie.z),Ht=Math.min(Math.max(0,Ce.z-V.position.z),v*4);if(V.position.z+=Ht,V.rotation.y=0,It(v,Ht>0,-Ht),_n(.25*Rt(Lt/(2.6*G))),Ht<.005)if(tn*=.25,k){let rn=V.position.clone(),Qn=5.5*G;P.waterTurn={from:rn,radius:Qn,pivot:rn.clone().add(new L(0,0,Qn))},dt("转身回家")}else dt("回家")}}else if(D==="bath"){if(P.phase==="接近")Ke(new L(wt.x,wt.y,he.position.z),v,3.6)&&dt("对准浴盆");else if(P.phase==="对准浴盆"){let k=V.rotation.y;V.rotation.y+=Pt(oe(Math.PI/2-k),-v*2.5,v*2.5),It(v,!0,Math.abs(V.rotation.y-k)*2.5),_n(.2),Math.abs(V.rotation.y-Math.PI/2)<.03&&(V.rotation.y=Math.PI/2,dt("走近浴盆"))}else if(P.phase==="走近浴盆"){let k=Ft(),te=Math.max(0,V.position.x-k.x);Ke(k,v,3.6)&&su(),_n(.15+.85*Rt(te/(3.2*G)))}else if(P.phase==="擦洗"){let k=Rt(P.phaseTime/.55);Je(k),ge.rotation.z=Math.sin(pt*4)*.012*Math.min(1,P.recentRub*2),P.recentRub=Math.max(0,P.recentRub-v),$(P.progress),M("bubble",Math.min(1,P.progress*.7+P.recentRub*.6),pt),P.progress>=1&&dt("冲水")}else if(P.phase==="冲水")Je(),$(1-Rt(P.phaseTime/1.2)),M("bubble",1-Rt(P.phaseTime/1.2),pt),P.phaseTime>1.2&&dt("甩水");else if(P.phase==="甩水"){let k=P.phaseTime;Je(1-Rt(k/1.1)),ge.rotation.z=Math.sin(k*28)*.13*Math.sin(Pt(k/1.1,0,1)*Math.PI),M("bubble",.3*(1-Rt(k/1.2)),pt*2),k>1.25&&es()}else if(P.phase==="离开浴盆"){let k=1.2*G-V.position.x,te=Math.min(Math.max(0,k),v*3.6);V.position.x+=te,V.rotation.y=-Math.PI/2,It(v,te>0,te),_n(.25),k<.04&&(V.rotation.y=Math.PI*1.5,dt("绕开浴盆"))}else if(P.phase==="绕开浴盆"){let k=Math.atan2(V.position.x-wt.x,V.position.z-wt.z),te=V.rotation.y;V.rotation.y+=Pt(k-te,-v*2.5,v*2.5),It(v,!0,Math.abs(V.rotation.y-te)*2.5),_n(.12),Math.abs(oe(k-V.rotation.y))<.025&&(V.rotation.y=k,dt("回家"))}}else if(D==="climb")if(P.phase==="接近")Ke(Te,v)&&dt("第一层");else if(P.phase==="第一层"||P.phase==="第二层")_e.get("head").rotation.x+=.08;else if(P.phase==="吊球")tt(.75),V.position.z=j[1].landing.z,P.phaseTime>.3&&(_e.get("head").rotation.x+=.18,_e.get("tail_base").rotation.z+=Math.sin(pt*3)*.15);else if(P.phase==="庆祝"){tt(.7);let k=P.phaseTime,te=Math.sin(Pt(k/.7,0,1)*Math.PI);_e.get("front_right").rotation.x+=te*1.7,_e.get("front_right").scale.y=1,_e.get("front_right").position.y+=(4/G-4.53)*te,q.position.x=j[1].landing.x+2.3*G+Math.sin(k*7)*.8*(1-Rt(k/1.4)),M("heart",.6,k),k>1.45&&No(j[0].landing,"下架",3.7)}else P.phase==="下架"&&No(wt,"回家",3.4);else if(D==="tease"){if(ve.visible=!0,ve.position.copy(P.target).add(new L(0,.5,0)),ve.rotation.z=Math.sin(pt*7)*.1,P.phase==="陪玩"){let k=P.target.clone(),te=P.target.clone().sub(wt);te.y=0,te.length()>.01&&k.sub(te.normalize().multiplyScalar(4.6*G));let de=k.clone().sub(V.position);de.y=0;let ie=de.length(),Ce=Math.min(ie,v*6);ie>0&&V.position.add(de.multiplyScalar(Ce/ie));let et=Pt(Math.atan2(V.position.x-P.target.x,V.position.z-P.target.z),-.2,.2);V.rotation.y+=Pt(oe(et-V.rotation.y),-v*3,v*3),Vt(v,de),_e.get("head").rotation.y+=Pt(Math.atan2(V.position.x-P.target.x,V.position.z-P.target.z)-V.rotation.y,-.4,.4),ie<.07&&P.pointerMoves>P.lastCatchMove+1&&P.target.distanceTo(P.lastCaughtTarget||new L(99,0,99))>2&&(P.hits++,P.progress=P.hits/5,P.lastCatchMove=P.pointerMoves,P.lastCaughtTarget=P.target.clone(),dt("扑击"))}else if(P.phase==="扑击"){let k=P.phaseTime;sn="pounce",le(Math.sin(Pt(k/.6,0,1)*Math.PI),1.4),_e.get("front_right").rotation.x+=Math.sin(Pt(k/.6,0,1)*Math.PI)*.95,V.position.y=.22+Math.sin(Pt(k/.6,0,1)*Math.PI)*.8,M("heart",.5,pt),k>.7&&(V.position.y=.22,dt(P.hits>=5?"回家":"陪玩"))}}jn()}function Ff(v){if(P.elapsed+=v,P.name==="sleep"){jt(v);return}let D=Pt(P.elapsed/P.duration,0,1),k=dy(D);si=k,P.name==="pet"?(sn="paw",Fe("paw",P.elapsed),_e.get("head").rotation.x+=.12*k,ht(k*.8),M("heart",k,P.elapsed)):(sn="paw",Fe("paw",P.elapsed),_e.get("head").rotation.z+=Math.sin(pt*3)*.12*k,ae.rotation.set(P.elapsed*2*k,0,P.elapsed*3*k),M("heart",k*.4,P.elapsed)),D>=1&&Or(!0)}function Of(){ne.updateWorldMatrix(!0,!0);let v=1/0;if(P?.name==="sleep")ne.traverse(D=>{D.isMesh&&D.visible&&(D.userData.uuid||D.userData.accessory)&&(v=Math.min(v,new Xt().setFromObject(D).min.y))});else for(let D of H)v=Math.min(v,new Xt().setFromObject(_e.get(D)).min.y);Number.isFinite(v)&&(ge.position.y+=V.position.y-v)}function ou(v){window.CatOfflineBed.reset(z);if(yt=!1,G=Dt.lerp(G,N,Math.min(1,v*6)),ne.scale.setScalar(G),ge.position.set(0,0,0),ge.rotation.set(0,0,0),We(),si=0,P?.interactive)Uf(v);else if(P)Ff(v);else if(window.CatDialogue?.poseActive){V.position.copy(wt);Fe("idle",pt);window.CatDialogue.pose(_e,z,pt);sn="idle";ri=window.CatDialogue.bubble}else if(window.__pgQuirk?.on){sn="idle",tn=0,window.__pgQuirk.tick(v,pt)}else{V.position.copy(wt),V.position.y=.22,V.rotation.set(0,0,0),sn="idle",tn=0,Fe("idle",o.matches?0:pt);let de=Math.floor(pt/4)%4,ie=Math.sin(pt%4/4*Math.PI);ri=["正在看窗外的鸟儿","低头闻闻自己的爪子","伸个懒腰，抖抖耳朵","自己玩一会儿小羽毛"][de],o.matches||(de===0?_e.get("head").rotation.y+=Math.sin(pt*.55)*.18:de===1?_e.get("head").rotation.x-=ie*.16:de===2?(le(ie*.28,1.2),_e.get("tail_base").rotation.z+=Math.sin(pt*2)*.12):(Fe("paw",pt%1.6),sn="paw")),ve.visible=!0,ve.position.set(-1.5,.5,-8),ri!==Es&&(Es=ri,n({message:ri}))}if((De==="kitten"||De==="baby")&&sn!=="sleep"&&_e.get("head").scale.multiplyScalar(1.065),P?.name==="drink"&&(_e.get("tail_base").rotation.x-=.3*Rt(P.elapsed/.3)*Rt(V.position.distanceTo(wt)/3)),yt||Of(),ne.updateWorldMatrix(!0,!0),P?.name==="bath"&&["擦洗","冲水","甩水"].includes(P.phase)){let de=_e.get("tail_base"),ie=new Xt().setFromObject(de).min.y,Ce=Math.max(0,he.position.y+3.4+.12-ie);de.position.y+=Ce/(G*Math.cos(_e.get("body").rotation.x)),ne.updateWorldMatrix(!0,!0)}if(fe.visible){let de=bt(),ie=re.position.clone().add(new L(0,.815,1.3)),Ce=Math.max(0,Math.sin(P.phaseTime/.75*Math.PI*6)),et=de.clone().lerp(ie,Ce),nt=et.clone().sub(de);fe.position.copy(de).add(et).multiplyScalar(.5),fe.quaternion.setFromUnitVectors(new L(0,0,1),nt.clone().normalize()),fe.scale.set(G,G,nt.length())}if(Ge.position.set(V.position.x,P?.name==="climb"?Math.max(.26,V.position.y-.1):.257,V.position.z+1.5*G),Ge.scale.set(G,G,1),P?.name==="bath"&&P.phase==="擦洗"){let de=Math.max(.78,G),ie=P.rubPoint.clone();ie.y=2.7+.38*de/G,qe.position.copy(_e.get("body").localToWorld(ie)),qe.quaternion.copy(_e.get("body").getWorldQuaternion(new In)),qe.scale.setScalar(de)}else qe.position.copy(ke),qe.quaternion.identity(),qe.scale.setScalar(1);P?.name==="climb"&&["吊球","庆祝"].includes(P.phase)?(P.phase!=="庆祝"&&(q.position.x=j[1].landing.x+2.3*G+Math.sin(pt*.9)*.12),q.position.z=j[1].landing.z-5.85*G):q.position.set(19.7+Math.sin(pt*.9)*.12,13.45,6.2);let D=new L(23.4,13.95,3),k=q.position.clone().add(new L(0,.5,-.9)),te=k.clone().sub(D);Le.position.copy(D).add(k).multiplyScalar(.5),Le.scale.x=te.length()/3,Le.quaternion.setFromUnitVectors(new L(1,0,0),te.normalize()),Be.position.y=2.9+(P?.name==="bath"?Math.sin(pt*3)*.035:0)}let sc=0;function Uo(){if(gn)return;let v=i.getBoundingClientRect();a.setSize(Math.max(1,v.width),Math.max(1,v.height),!1),l.aspect=Math.max(1,v.width)/Math.max(1,v.height),l.fov=l.aspect<1.12?Dt.radToDeg(2*Math.atan(Math.tan(fy(l.aspect<.62?50:60)/2)/l.aspect)):39,(sc===0||sc<1.12!=l.aspect<1.12)&&(l.aspect<1.12?(l.position.set(8,24,-43),d.target.set(0,8.5,1.5)):(l.position.set(10,29,-58),d.target.set(0,8.5,1.5)),d.update()),sc=l.aspect,l.updateProjectionMatrix(),jn(!0)}let au=new ResizeObserver(Uo);au.observe(i);let lu=new ze,zi=new Ri,Bf=new En(new L(0,1,0),-.22),xn=null,Fo=new Set;function rc(v){let D=a.domElement.getBoundingClientRect();return lu.set((v.clientX-D.left)/D.width*2-1,-(v.clientY-D.top)/D.height*2+1),zi.setFromCamera(lu,l),D}function cu(v){if(P?.name!=="tease"||P.phase!=="陪玩")return;rc(v);let D=zi.ray.intersectPlane(Bf,new L);D&&(D.x=Pt(D.x,-2.8,2.8),D.z=Pt(D.z,-10,-7.5),P.target.distanceTo(D)>.16&&(P.target.copy(D),P.pointerMoves++,jn(!0)))}function hu(v){if(!vi||gn)return;if(Fo.add(v.pointerId),Fo.size>1||v.button!==0||v.isPrimary===!1){xn=null;return}xn={x:v.clientX,y:v.clientY,id:v.pointerId,lastX:v.clientX,lastY:v.clientY,travel:0},P?.interactive&&(a.domElement.setPointerCapture?.(v.pointerId),P.lastPointer={x:v.clientX,y:v.clientY},cu(v))}function uu(v){if(!vi||gn)return;if(xn?.id===v.pointerId&&(xn.travel+=Math.hypot(v.clientX-xn.lastX,v.clientY-xn.lastY),xn.lastX=v.clientX,xn.lastY=v.clientY),cu(v),P?.name!=="bath"||P.phase!=="擦洗"||!xn||xn.id!==v.pointerId)return;let D=P.lastPointer;if(P.lastPointer={x:v.clientX,y:v.clientY},!D)return;let k=rc(v),te=zi.intersectObject(ne,!0)[0];if(!te)return;let de=_e.get("body").worldToLocal(te.point.clone()),ie=Math.sign(_e.get("body").worldToLocal(l.position.clone()).x)||1,Ce=Pt((de.x+4.5)/9,0,1),et=Pt((de.z+8)/12,0,1),nt=ie>0?.4+Ce*2.25:-2.65+Ce*2.25;P.rubPoint.set(nt,3.22,.8+et*3);let rt=Math.min(80,Math.hypot(v.clientX-D.x,v.clientY-D.y));P.scrubDistance+=rt*640/Math.max(320,k.width),P.progress=Pt(P.scrubDistance/1050,0,1),P.recentRub=.75,jn()}function du(v){if(!vi||gn)return;if(Fo.delete(v.pointerId),!xn||xn.id!==v.pointerId)return;let D=Math.hypot(v.clientX-xn.x,v.clientY-xn.y),k=xn.travel>10||D>10;if(xn=null,a.domElement.releasePointerCapture?.(v.pointerId),gn||k)return;if(rc(v),!P){let de=Oi().map(Ce=>({entry:Ce,hit:zi.intersectObject(Ce.object,!0)[0]}));de.push({entry:{action:"pet"},hit:zi.intersectObject(ne,!0)[0]});let ie=de.filter(Ce=>Ce.hit).sort((Ce,et)=>Ce.hit.distance-et.hit.distance)[0];ie?.entry.action==="pet"?e():ie&&t(ie.entry.action);return}if(ic().find(de=>zi.intersectObject(de.object,!0).length)){if(P.name==="feed"&&P.phase==="投喂")P.hits++,P.progress=P.hits/3,dt("咀嚼");else if(P.name==="drink"&&P.phase==="饮水"){let de=zi.intersectObject(re,!0)[0];if(Oi().filter(Ce=>Ce.object!==re).some(Ce=>zi.intersectObject(Ce.object,!0)[0]?.distance<de.distance)||zi.intersectObject(ne,!0)[0]?.distance<de.distance)return;P.hits++,P.progress=P.hits/3,dt("舔水")}else P.name==="climb"&&P.phase==="第一层"?(P.hits++,P.progress=1/3,No(j[0].landing,"第二层")):P.name==="climb"&&P.phase==="第二层"?(P.hits++,P.progress=2/3,No(j[1].landing,"吊球",5.2)):P.name==="climb"&&P.phase==="吊球"&&(P.hits++,P.progress=1,dt("庆祝"));jn(!0)}}function oc(){xn=null,Fo.clear(),P&&(P.lastPointer=null)}function fu(v){if(!vi||gn)return;v.key==="Escape"&&P?.interactive?(v.preventDefault(),nc()):(v.key==="Enter"||v.key===" ")&&!P&&(v.preventDefault(),e())}function pu(){Nn=0,oc()}a.domElement.addEventListener("pointerdown",hu),a.domElement.addEventListener("pointermove",uu),a.domElement.addEventListener("pointerup",du),a.domElement.addEventListener("pointercancel",oc),a.domElement.addEventListener("keydown",fu),document.addEventListener("visibilitychange",pu);function ac(){ne.updateWorldMatrix(!0,!0);let v=new Xt().setFromObject(ne),D=v.getCenter(new L),k=z.state(),te=ic().map(({id:ie,kind:Ce,point:et})=>({id:ie,kind:Ce,...Ne(et),world:et.toArray()})),de=H.map(ie=>{let Ce=new Xt().setFromObject(_e.get(ie));return{name:ie,min:Ce.min.toArray(),max:Ce.max.toArray()}});return{ready:!gn,active:vi,ambient:ri,hotspots:Oi().map(({id:ie,action:Ce,point:et})=>({id:ie,action:Ce,...Ne(et)})),stage:De,currentAction:P?.name||null,currentPhase:P?.phase||null,busy:!!P,animation:sn,sleepBed:w(),time:k.time,catPosition:V.position.toArray(),catRotation:V.rotation.y,catScale:G,targetScale:N,boneCount:k.boneCount,elements:Ye.elements.length,elementCount:Ye.elements.length,frames:en,reducedMotion:o.matches,bathVisible:!0,poseAmount:si,camera:l.position.toArray(),catScreen:Ne(D),bounds:{min:v.min.toArray(),max:v.max.toArray()},breed:k.breed,outfit:k.outfit,accessoryMeshes:k.accessoryMeshes,accessoryParts:k.accessoryParts,texture:k.texture,animations:[...k.animations,"eat","drink","step","jump","pounce"],targets:te,bathTransfer:P?.bathTransfer?{direction:P.bathTransfer.outward?"out":"in",step:P.bathTransfer.step,feet:P.bathTransfer.feet.map(ie=>ie.toArray())}:null,bathTurn:P?.bathTurn?{step:P.bathTurn.step,count:P.bathTurn.knots.length-1,yaw:V.rotation.y,feet:P.bathTurn.feet.map(ie=>ie.toArray())}:null,interaction:P?.interactive?{action:P.name,phase:P.phase,progress:P.progress,hits:P.hits,scrubDistance:P.scrubDistance,pointerMoves:P.pointerMoves,target:P.target.toArray(),targets:te}:null,destinations:{home:wt.toArray(),food:At().toArray(),foodApproach:Cn().toArray(),foodBowl:B.position.toArray(),foodSurface:B.position.clone().add(new L(0,1.3,0)).toArray(),water:Un().toArray(),waterApproach:oi().toArray(),waterBowl:re.position.toArray(),waterSurface:re.position.clone().add(new L(0,.79,0)).toArray(),bath:qt().toArray(),bathEntry:Ft().toArray(),bathExit:ai().toArray(),platforms:j.map(ie=>ie.position.toArray())},platformDetails:j.map(ie=>({id:ie.id,landing:ie.landing.toArray(),bounds:{min:[ie.position.x-ie.width/2,ie.position.y,ie.position.z-7],max:[ie.position.x+ie.width/2,ie.position.y+.08,ie.position.z+7]}})),boneWorld:{mouth:bt().toArray(),feet:de,body:_e.get("body").getWorldPosition(new L).toArray(),head:_e.get("head").getWorldPosition(new L).toArray()},effects:{sleepSymbols:Y.visible,drinkingTongue:fe.visible,waterRipples:Z.visible,waterGlow:se.material.emissiveIntensity,attachedFoam:xe.filter(ie=>ie.visible).length,floatingBubbles:Pe.filter(({bubble:ie})=>ie.visible).length,bubbles:Pe.filter(({bubble:ie})=>ie.visible).map(({bubble:ie})=>({world:ie.getWorldPosition(new L).toArray(),screen:Ne(ie.getWorldPosition(new L))})),sponge:{world:qe.getWorldPosition(new L).toArray(),screen:Ne(qe.getWorldPosition(new L)),onBack:P?.name==="bath"&&P.phase==="擦洗"},foam:xe.filter(ie=>ie.visible).map(ie=>({world:ie.getWorldPosition(new L).toArray(),screen:Ne(ie.getWorldPosition(new L))}))}}}function lc(v){if(gn||!vi)return;let D=Nn&&!document.hidden?Math.min((v-Nn)/1e3,.07):0;Nn=v,pt+=D,ou(D),d.update(D),a.render(c,l),en++,mn=requestAnimationFrame(lc)}function zf(v){gn||(vi=!!v,d.enabled=vi,vi||oc(),vi?mn||(Uo(),Nn=0,mn=requestAnimationFrame(lc)):(cancelAnimationFrame(mn),mn=0,Nn=0))}function kf(){if(gn)return;nc(),gn=!0,cancelAnimationFrame(mn),au.disconnect(),d.dispose(),a.domElement.removeEventListener("pointerdown",hu),a.domElement.removeEventListener("pointermove",uu),a.domElement.removeEventListener("pointerup",du),a.domElement.removeEventListener("pointercancel",oc),a.domElement.removeEventListener("keydown",fu),document.removeEventListener("visibilitychange",pu);let v=new Set,D=new Set,k=new Set([me,Ve]);c.traverse(te=>{te.geometry&&v.add(te.geometry),te.material&&(Array.isArray(te.material)?te.material:[te.material]).forEach(de=>{D.add(de),de.map&&k.add(de.map)})}),v.forEach(te=>te.dispose()),D.forEach(te=>te.dispose()),k.forEach(te=>te.dispose()),be.shadow.map?.dispose(),a.dispose(),z.dispose(),a.domElement.remove()}return window.__pgRoom={renderer:a,renderPreviewFrame(){a.render(c,l)},cam:l,ctl:d,cat:V,inner:ge,bones:_e,anim:Fe,crouch:le,eyes:ht,hearts:M,proj:Ne,canvas:a.domElement,get act(){return P},get stage(){return De},home:wt,model:z,scene:c},Uo(),ou(0),a.render(c,l),mn=requestAnimationFrame(lc),{setStage:Ee,setActive:zf,setAppearance:v=>z.setAppearance(v),perform:Df,startInteraction:ru,cancelInteraction:nc,state:ac,resize:Uo,dispose:kf}}var Ir=Dt.clamp,un=(i,e,t)=>new L(i,e,t),jl={kitten:.64,baby:.64,young:.82,adult:1},Kh={garden:{name:"暖阳庭院",grass:"#93b898",earth:"#d3bd8e"},park:{name:"风铃公园",grass:"#89af91",earth:"#dfcba5"},river:{name:"银沙河岸",grass:"#a3bd9b",earth:"#dbc8a6"}},jh={flower:["小花","#edb0ab"],shell:["贝壳","#f1d6b8"],star:["星星石","#e7bd64"],fish:["小鱼","#93bec7"]};window.CatTownEventCatalogue=(n={})=>({butterfly:["蝴蝶停在花上","小猫蹲下看得入神。陪它慢慢看看，还是继续赶路？",[["care","陪它观察 · 心情 +6"],["safe","安静绕过去"],["coins","追着蝴蝶跑 · 精力 -4"]]],"lost-pouch":["路边的小钱袋","长椅旁有一个小钱袋，失主也许正着急。小猫回头望着你。",[["care","帮忙找失主 · 心情 +6"],["safe","留在原处，继续散步"],["coins","送还小包 · 收到 4 金币感谢"]]],rain:["忽然飘来小雨","几滴雨落在小猫的鼻尖。照顾好它，出游回家后会记住这次选择。",[["safe","在树荫旁避雨"],["care","用小毯子擦干 · 健康 +3"],["coins",n.outfit==="raincoat"?"穿雨衣踩水 · 心情 +6，健康 -2":"继续玩水 · 可能着凉，健康 -18"]]]});async function Mf({container:i,onEvent:e=()=>({ok:!0}),onProgress:t=()=>{},profile:n={}}){if(!i)throw new Error("没有找到小猫的户外场景。");let s=new Ni({antialias:!0,alpha:!1,powerPreference:"default"});s.setPixelRatio(Math.min(devicePixelRatio||1,2)),s.outputColorSpace=Zt,s.toneMapping=Ki,s.toneMappingExposure=1.14,s.shadowMap.enabled=!0,s.shadowMap.type=gi;let r=s.domElement;r.setAttribute("aria-label","小猫户外生活：点击地面遛猫，点击物品走近拾取；也可拖动或使用方向键"),r.tabIndex=0,r.style.cssText="width:100%;height:100%;display:block;touch-action:none;outline:none",getComputedStyle(i).position==="static"&&(i.style.position="relative");let o=new fi;o.background=new _t("#c6e3df"),o.fog=new eo("#c6e3df",105,165);let a=new an(38,1,.1,200),c=new mi("#fff7dc","#77998b",2.2);o.add(c);let l=new Zn("#fff1cf",3.2);l.position.set(-28,55,-30),l.castShadow=!0,l.shadow.mapSize.set(1024,1024),Object.assign(l.shadow.camera,{left:-48,right:48,top:46,bottom:-46,near:1,far:130}),l.shadow.bias=-.001,o.add(l);let d=new Map;function f(oe,Ne={}){let Ee=oe+JSON.stringify(Ne);return d.has(Ee)||d.set(Ee,new Ln({color:oe,roughness:1,...Ne})),d.get(Ee)}function h(oe,Ne,Ee,We,ht={}){let bt=new kt(new bn(...Ne),f(We,ht));return bt.position.set(...Ee),bt.castShadow=!0,bt.receiveShadow=!0,oe.add(bt),bt}function u(oe,Ne,Ee,We=2.6){let ht=new ut;return ht.position.copy(Ne),oe.add(ht),[[We*2,.09,.42,0,-We],[We*2,.09,.42,0,We],[.42,.09,We*2,-We,0],[.42,.09,We*2,We,0]].forEach(([bt,M,$,le,ce])=>h(ht,[bt,M,$],[le,.04,ce],Ee)),ht}let _;try{_=await Ss(n)}catch(oe){throw d.forEach(Ne=>Ne.dispose()),l.shadow.map?.dispose(),s.dispose(),r.remove(),oe}i.append(r);let y=new ut,g=new ut;y.add(g),g.add(_.root),o.add(y);let p=new ut;o.add(p);let S=u(o,un(0,.18,0),"#f2d186",1.2);S.visible=!1;let E=new ut;o.add(E),h(E,[.34,.7,.34],[0,0,0],"#775e69");let b=h(E,[1.25,.8,.12],[-.7,.14,0],"#ebbd8a"),I=h(E,[1.25,.8,.12],[.7,.14,0],"#ebbd8a"),A=new ut;o.add(A),A.visible=!1,h(A,[2.2,1.2,.7],[0,0,0],"#91c5cb"),h(A,[.65,1.4,.65],[-1.35,0,0],"#78aebd"),h(A,[.18,.22,.12],[.75,.18,-.39],"#3f5f65");let F=document.createElement("div");F.className="pet-world-ui",F.innerHTML=`<style>
    .pet-world-ui{position:absolute;inset:0;pointer-events:none;font-family:inherit;color:#415b50;font-size:13px}
    .pet-world-ui button{font:inherit;pointer-events:auto;cursor:pointer;border:2px solid #6e9181;border-radius:8px;color:#355249;background:#fff4d8;box-shadow:0 3px 0 #688779;padding:8px 12px;min-height:40px}
    .pet-world-ui button:focus-visible{outline:3px solid #da947a;outline-offset:3px}.pet-world-ui button:disabled{opacity:.58;cursor:default}
    .world-top{position:absolute;left:12px;top:12px;right:12px;display:flex;gap:10px;justify-content:space-between;align-items:flex-start}
    .world-card{background:#fff8e7ed;border:2px solid #a9b6a0;border-radius:10px;padding:9px 12px;max-width:70%;box-shadow:0 3px 0 #90a59055}.world-card strong{display:block;font-size:16px;margin-bottom:3px}
    .world-bottom{position:absolute;bottom:14px;left:12px;right:12px;display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;justify-content:space-between}.world-hint{background:#fff8e7ed;border:2px solid #b3bda5;border-radius:9px;padding:8px 11px;max-width:72%;line-height:1.5;white-space:pre-line}.world-return[hidden],.world-fishing[hidden],.world-event[hidden]{display:none}
    .world-fishing{position:absolute;left:50%;bottom:82px;transform:translateX(-50%);width:min(310px,80%);background:#fff8eaf5;border:2px solid #83a69a;border-radius:12px;padding:10px;pointer-events:auto;text-align:center;box-shadow:0 4px 0 #70998b55}.world-fishing button{width:100%;touch-action:none;margin-top:7px;user-select:none;-webkit-user-select:none}
    .world-tension{height:19px;position:relative;background:#e6dac1;border:2px solid #8eaa94;border-radius:3px;margin-top:7px;overflow:hidden}.world-sweet{position:absolute;left:55%;width:23%;height:100%;background:#96c89b}.world-cursor{position:absolute;top:0;bottom:0;width:5px;background:#547d7b;left:0}.world-fish-label{font-size:12px;margin-top:3px}
    .world-event{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(320px,83%);background:#fff7e9f7;border:3px solid #8f9f87;border-radius:12px;padding:15px;box-shadow:0 5px 0 #71886b77;pointer-events:auto}.world-event strong{display:block;font-size:17px}.world-event p{margin:9px 0;line-height:1.65}.world-event-actions{display:grid;gap:7px}.world-event-actions button{text-align:left;padding:7px 9px}
    @media(max-width:500px){.world-top{left:8px;top:8px;right:8px;gap:5px}.world-card{max-width:70%;font-size:11px;padding:7px 8px}.world-card strong{font-size:13px}.pet-world-ui button{padding:7px 9px;font-size:12px}.world-bottom{left:8px;right:8px;bottom:9px;gap:5px}.world-hint{font-size:11px;max-width:67%;padding:7px 8px}.world-fishing{bottom:77px}.world-event{font-size:12px;padding:12px}}
  </style><div class="world-top"><div class="world-card"><strong class="world-title">暖阳庭院</strong><span class="world-objective">点击地面，带小猫散步</span></div><button type="button" class="world-roam" aria-pressed="false">自由活动</button></div>
  <div class="world-bottom"><div class="world-hint">点击地面或拖动引路；方向键也能走。</div><button type="button" class="world-return" hidden>带小猫回家</button></div>
  <div class="world-fishing" hidden><strong>河边钓鱼</strong><div class="world-tension"><div class="world-sweet"></div><div class="world-cursor"></div></div><div class="world-fish-label">按住鱼竿，绿格内松手提竿</div><button type="button" class="world-rod">走到河边</button></div>
  <div class="world-event" hidden role="dialog" aria-modal="true" aria-label="户外偶遇"><strong class="world-event-title"></strong><p class="world-event-copy"></p><div class="world-event-actions"></div></div>`,i.append(F);let m=Object.fromEntries(["title","objective","hint","return","roam","fishing","rod","cursor","fish-label","event","event-title","event-copy","event-actions"].map(oe=>[oe,F.querySelector(".world-"+oe)])),w=!1,T=!1,U="garden",B="explore",re=null,se=null,Z=0,ee=[],ae=[],ye=[],be=null,O=null,z=!1,ne=0,_e=0,Fe=0,Ye="kitten",me="点击地面或拖动引路；方向键也能走。",V=0,ge=!1,j=null,Te=!1,we=!1,Re=!1,Le=0,q=0,he=-10,Me="idle",Ae=new Set,Be=new Set,ke=new Set,qe=new Ri,$e=new ze,it=new En(un(0,1,0),.18),X=new L,gt=un(-9,.22,-10),ot=[un(-17,.22,-6),un(3,.22,13),un(19,.22,-2)],R=[un(-18,.22,-7),un(15,.22,-8),un(18,.22,11),un(-15,.22,12),un(0,.22,5)],x=["front_left","front_right","back_left","back_right"].map(oe=>_.bones.get(oe)).filter(Boolean),Q=[];_.root.traverse(oe=>{oe.isMesh&&oe.userData.uuid&&Q.push(oe)});function ue(){p.traverse(oe=>oe.geometry?.dispose()),o.remove(p),p=new ut,o.add(p),ae=[],ye=[]}function xe(oe,Ne,Ee=1){let We=new ut;We.position.set(oe,0,Ne),p.add(We),h(We,[2.4*Ee,12*Ee,2.4*Ee],[0,6*Ee,0],"#b0916b"),[[0,13,0,11,7,10],[-3,12,1,7,6,8],[3,15,0,7,6,7],[0,18,0,6,4,6]].forEach(([ht,bt,M,$,le,ce],pe)=>h(We,[$*Ee,le*Ee,ce*Ee],[ht*Ee,bt*Ee,M*Ee],["#729981","#81aa8d","#93b699","#a5c3a3"][pe])),ye.push({x:oe,z:Ne,radius:8*Ee,name:"树木"})}function Pe(oe,Ne,Ee){let We=new ut;We.position.copy(Ne),We.position.y=1.3,We.userData.nodeId=oe.id,p.add(We);let ht=oe.itemId||"star",bt=jh[ht]?.[1]||"#d9c583";if(ht==="flower")h(We,[.35,1.9,.35],[0,0,0],"#799f7b"),[[0,1.3],[.75,1],[-.75,1],[0,.65]].forEach(([le,ce])=>h(We,[.85,.8,.55],[le,ce,0],bt)),h(We,[.55,.55,.6],[0,1.03,-.04],"#eccb87");else if(ht==="shell"){h(We,[2.2,.8,1.5],[0,-.6,0],bt);for(let le=-1;le<=1;le++)h(We,[.2,.18,1.3],[le*.55,-.1,0],"#bd9d84")}else ht==="fish"?(h(We,[2.5,1.2,.75],[0,.1,0],bt),h(We,[.6,1.55,.7],[-1.55,.1,0],"#78aabd"),h(We,[.18,.2,.12],[.85,.25,-.4],"#3e5961")):(h(We,[1,2.4,.9],[0,.4,0],bt),h(We,[2.6,.9,.9],[0,.4,0],bt),h(We,[1.9,.85,.9],[0,-.38,0],bt));let M=h(We,[3.8,4.4,3.8],[0,.4,0],"#ffffff",{transparent:!0,opacity:0,depthWrite:!1});M.userData.nodeId=oe.id;let $=u(p,Ne,"#f5e1a6",2.2);oe.object=We,oe.marker=$,oe.position=Ne.clone(),oe.index=Ee,ae.push(M)}function Ue(){ue();let oe=Kh[U];h(p,[90,1.6,78],[0,-.7,0],"#baa080"),h(p,[90,.2,78],[0,.02,0],window.__pgRecipe?.grassHex||oe.grass);if(!window.__pgRecipe){h(p,[11,.035,58],[0,.15,0],oe.earth),h(p,[58,.035,9],[0,.155,2],oe.earth);for(let Ee=0;Ee<9;Ee++)h(p,[3.2,.03,4.6],[Math.sin(Ee*1.7)*1.1,.19,-22+Ee*5.6],Ee%2?"#e7d6b0":"#d4bc91");xe(-39,24,1),xe(37,27,1.1),xe(-40,-24,.8),xe(42,-15,.75);let Ne=new ut;Ne.position.set(-38,.1,4),p.add(Ne),h(Ne,[4,1,14],[0,4.2,0],"#bd9271"),h(Ne,[.9,6,14],[-2.5,6.8,0],"#c49e78"),[[0,-5],[0,5]].forEach(([Ee,We])=>h(Ne,[1.6,4,1.6],[Ee,2,We],"#6d8e82")),ye.push({x:-38,z:4,radius:8,name:"长椅"});for(let Ee=0;Ee<16;Ee++){let We=(Ee%2?1:-1)*(30+Ee%4*2),ht=-18+Ee*2.6;h(p,[.3,1.7,.3],[We,.95,ht],"#73987c"),h(p,[1.1,.8,.9],[We,1.7,ht],Ee%3?"#deb598":"#e8d59b")}if(U==="garden"){for(let Ee=-43;Ee<=43;Ee+=4.8)h(p,[.8,5.2,.8],[Ee,2.5,37.2],"#eee3c8");h(p,[88,.65,.75],[0,2.2,37.2],"#dbd3b9"),h(p,[88,.65,.75],[0,4,37.2],"#dbd3b9"),h(p,[15,.5,10],[0,.5,33],"#ccab82");for(let Ee=0;Ee<5;Ee++)h(p,[1.1,3.7,1.1],[-5.5+Ee*2.8,2.3,33],"#8ba487")}else if(U==="park"){let Ee=new ut;Ee.position.set(0,0,35),p.add(Ee),h(Ee,[1.2,8,1.2],[0,4,0],"#bd9572"),h(Ee,[11,4,.7],[0,8,0],"#f0deac"),h(Ee,[2.8,1.7,.13],[0,8,-.42],"#7f9c7f"),ye.push({x:0,z:35,radius:3,name:"公园木牌"})}}if((U==="river"&&!window.__pgRecipe)||B==="fish"||window.__pgRecipe?.river){h(p,[89,.12,14],[0,.19,-31],"#83b6c0",{transparent:!0,opacity:.83}),h(p,[89,.08,4],[0,.19,-23.1],"#e8d5ad");for(let Ee=0;Ee<13;Ee++)h(p,[2.1,.025,.28],[-38+Ee*6.3,.28,-27-Ee%3*3],"#c3e0df");if(u(p,gt,"#93b9bb",3.2),h(p,[.25,.8,.25],[-9,.64,-27],"#d4917e"),B==="fish"){let Ee=h(p,[.38,.38,18],[-31,4.4,-24.7],"#aa8866");Ee.rotation.x=.38,h(p,[.5,.5,3],[-31,1.7,-16.6],"#748d7c"),ye.push({x:-31,z:-24,radius:10,name:"河边鱼竿"});let We=new io(new Tn().setFromPoints([un(-31,7.8,-33),un(-9,.9,-27)]),new gr({color:"#eee5ce"}));We.userData.worldFishingLine=!0,p.add(We)}}window.__pgBuild?.({group:p,box:h,Group:ut,obstacles:ye,loc:U,mode:B});B==="walk"?ee.forEach((Ee,We)=>{Ee.position=ot[We%ot.length].clone(),Ee.marker=u(p,Ee.position,We?"#b3bba1":"#f3c68e",3);let ht=new ut;ht.position.copy(Ee.position),p.add(ht),Ee.object=ht,h(ht,[1.6,.025,1.35],[0,0,0],We?"#a4bb9f":"#c79c67"),[[-.9,-.85],[-.3,-1.25],[.3,-1.25],[.9,-.85]].forEach(([M,$])=>h(ht,[.4,.025,.42],[M,0,$],We?"#a4bb9f":"#c79c67"));let bt=h(ht,[4.7,3.5,4.7],[0,1.4,0],"#ffffff",{transparent:!0,opacity:0,depthWrite:!1});bt.userData.nodeId=Ee.id,ae.push(bt)}):B==="explore"&&ee.forEach((Ee,We)=>Pe(Ee,R[We%R.length],We))}function fe(oe){Ye=jl[oe]?oe:"kitten",_.root.scale.setScalar(jl[Ye]);let Ne=_.bones.get("head");Ne&&(Ne.userData.baseScale=Ye==="kitten"||Ye==="baby"?[1.065,1.065,1.065]:[1,1,1])}function ve(oe={}){n={...n,...oe},_.setAppearance?.(n)}function C(){let oe=Math.max(1,i.clientWidth),Ne=Math.max(1,i.clientHeight);a.aspect=oe/Ne,a.aspect<.8?a.position.set(58,68,-83):a.position.set(46,47,-62),a.lookAt(0,6.5,0),a.updateProjectionMatrix(),s.setSize(oe,Ne,!1)}let Y=new ResizeObserver(C);Y.observe(i),C();function W(oe){let Ne=oe.clone();Ne.y=.22,Ne.x=Ir(Ne.x,-24,24),Ne.z=Ir(Ne.z,-17,20);for(let Ee of ye){let We=Ne.x-Ee.x,ht=Ne.z-Ee.z,bt=Math.hypot(We,ht),M=Ee.radius+11.5;if(bt<M){let $=M/Math.max(.01,bt);Ne.x=Ee.x+We*$,Ne.z=Ee.z+ht*$}}return Ne.x=Ir(Ne.x,-24,24),Ne.z=Ir(Ne.z,-17,20),Ne}function K(oe,Ne=null){if(!(!w||Te||!m.event.hidden)){if(be=W(oe),O=Ne,ne=0,Me="idle",Ne&&B==="explore"){let Ee=oe.clone().sub(y.position);Ee.y=0,Ee.length()>.1&&(be=W(oe.clone().addScaledVector(Ee.normalize(),-6.4*jl[Ye])))}if(S.position.copy(be),S.visible=!0,Ne){let Ee=ee.find(We=>We.id===Ne);me=B==="walk"?"带小猫走到这个路标。":`小猫正在走近${jh[Ee?.itemId]?.[0]||"物品"}，到了再拾取。`}N()}}function Ie(oe){return`${re||"world"}:${oe}:${++V}`}async function Ve(oe,Ne={}){let Ee=Ie(oe);if(Be.has(Ee))return{ok:!1};Be.add(Ee);try{return await e({type:oe,id:Ee,token:re,location:U,mode:B,...Ne})||{ok:!0}}catch(We){return{ok:!1,message:We?.message||"这次互动没有保存，请重试。"}}}async function Ge(oe){if(!oe||Ae.has(oe.id)||!re||Te)return;if(B==="walk"&&ee.find(Ee=>!Ae.has(Ee.id))?.id!==oe.id){me="按脚印的顺序，先走到亮着的路标。",N();return}Ae.add(oe.id),oe.object&&(oe.object.visible=!1),oe.marker&&(oe.marker.visible=!1);let Ne=await Ve("world-node",{nodeId:oe.id});if(Ne.ok===!1)Ae.delete(oe.id),oe.object&&(oe.object.visible=!0),oe.marker&&(oe.marker.visible=!0),me=Ne.message||Ne.reason||"这次拾取没有保存，走近后可以再试。";else if(me=B==="walk"?`路标 ${Ae.size} / ${ee.length}：小猫跟上啦。`:`收好了${jh[oe.itemId]?.[0]||"小鱼"}，放在本次出游篮子里。`,B==="walk"){let Ee=ee.find(We=>!Ae.has(We.id));Ee?.marker&&Ee.marker.traverse(We=>{We.isMesh&&(We.material=f("#f3c68e"))})}N()}async function H(){if(Te||!re)return{ok:!1,message:"当前没有进行中的出游。"};if(Ae.size<ee.length)return me=`还差 ${ee.length-Ae.size} 个${B==="walk"?"路标":B==="fish"?"成功提竿":"发现"}，带小猫继续走走吧。`,N(),{ok:!1,message:me};if(De()<(se?.minSeconds||0))return me="小猫还想看看风景，稍等一会儿再回家。",N(),{ok:!1,message:me};Te=!0,N();let oe=await Ve("world-settle");return oe.ok===!1?(Te=!1,me=oe.message||oe.reason||"还没有满足本次出游目标。"):(we=!0,me="出游收获已经带回家。可以回房间看看背包，或开始另一段旅程。"),N(),oe}function De(){return w&&Z?(performance.now()-Z)/1e3:0}function N(){m.title.textContent=window.__pgPlace?.name||Kh[U].name;let oe=se?.name||{walk:"跟着脚印去散步",explore:"走近并拾取自然小物",fish:"看准绿格，松手提竿"}[B];m.objective.textContent=`${oe} · ${Ae.size} / ${ee.length}`,m.hint.textContent=me,m.roam.hidden=B==="fish",m.roam.textContent=z?"召回小猫":"自由活动",m.roam.setAttribute("aria-pressed",String(z)),m.return.hidden=Ae.size<ee.length||!ee.length,m.return.disabled=Te||De()<(se?.minSeconds||0),m.return.textContent=we?"已带回收获":Te?"正在收拾…":De()<(se?.minSeconds||0)?`再陪 ${Math.ceil((se?.minSeconds||0)-De())} 秒`:"带小猫回家",m.fishing.hidden=B!=="fish",m.rod.disabled=Te||q>0||Ae.size>=ee.length,m.rod.textContent=y.position.distanceTo(gt)>1.1?"走到河边":Re?"绿格内松手！":q>0?"鱼儿游过来了…":"按住鱼竿 · 松手提竿",m.cursor.style.left=`${Ir(Le,0,1)*98}%`,Ae.size===ee.length&&ee.length&&(m["fish-label"].textContent="篮子装好啦，可以带小猫回家。")}function G(){if(ge||!re||Re||Te)return;ge=!0;let oe=[...String(re)].reduce((M,$)=>M+$.charCodeAt(0),0),Ne=["butterfly","lost-pouch","rain"][oe%3],Ee={butterfly:["蝴蝶停在花上","小猫蹲下看得入神。陪它慢慢看看，还是继续赶路？",[["care","陪它观察 · 心情 +6"],["safe","安静绕过去"],["coins","追着蝴蝶跑 · 精力 -4"]]],"lost-pouch":["路边的小钱袋","长椅旁有一个小钱袋，失主也许正着急。小猫回头望着你。",[["care","帮忙找失主 · 心情 +6"],["safe","留在原处，继续散步"],["coins","送还小包 · 收到 4 金币感谢"]]],rain:["忽然飘来小雨","几滴雨落在小猫的鼻尖。照顾好它，出游回家后会记住这次选择。",[["safe","在树荫旁避雨"],["care","用小毯子擦干 · 健康 +3"],["coins",n.outfit==="raincoat"?"穿雨衣踩水 · 心情 +6，健康 -2":"继续玩水 · 可能着凉，健康 -18"]]]},[We,ht,bt]=Ee[Ne];m["event-title"].textContent=We,m["event-copy"].textContent=ht,m["event-actions"].replaceChildren(),bt.forEach(([M,$])=>{let le=document.createElement("button");le.type="button",le.textContent=$,le.dataset.choice=M,le.addEventListener("click",async()=>{if(j)return;j={event:Ne,choice:M},m.event.hidden=!0;let ce=await Ve("world-choice",j);me=ce.message||ce.reason||(ce.ok===!1?"这次选择没有保存。":"小猫记住了这次偶遇，回家结算时一起保存。"),N()}),m["event-actions"].append(le)}),ke.clear(),m.event.hidden=!1,window.__pgWorldEvt?.(Ne)}function Se(oe){if(!(!w||B!=="fish"||!m.event.hidden||q>0||Ae.size>=ee.length)){if(oe?.preventDefault(),y.position.distanceTo(gt)>1.1){z=!1,K(gt),me="走到水边的脚印，再按住鱼竿。",N();return}Re||(be=null,O=null,Re=!0,Le=0,y.rotation.y=0,me="盯住绿色格子，指针进入时松手提竿。",m["fish-label"].textContent="按住蓄力，绿格内松手；太早或太晚鱼儿会逃走。",oe?.pointerId!=null&&m.rod.setPointerCapture?.(oe.pointerId),N())}}function J(oe){if(!Re)return;if(oe?.preventDefault(),Re=!1,q=.85,Le>=.55&&Le<=.78){let Ee=ee.find(We=>!Ae.has(We.id));Ge(Ee),he=_e,A.visible=!0,m["fish-label"].textContent="提竿成功！一条小鱼跳进篮子。"}else me=Le<.55?"提得太早，鱼儿溜走了。再试一次！":"提得太晚，鱼线松开了。再试一次！",m["fish-label"].textContent=me;N()}function He(oe){Re&&(oe?.preventDefault(),Re=!1,Le=0,q=.25,me="这次提竿已取消，没有收获。准备好了可以再试一次。",m["fish-label"].textContent=me,N())}m.rod.addEventListener("pointerdown",Se),m.rod.addEventListener("pointerup",J),m.rod.addEventListener("pointercancel",He),m.rod.addEventListener("keydown",oe=>{(oe.code==="Space"||oe.code==="Enter")&&Se(oe)}),m.rod.addEventListener("keyup",oe=>{(oe.code==="Space"||oe.code==="Enter")&&J(oe)}),m.return.addEventListener("click",H),m.roam.addEventListener("click",()=>{!w||!m.event.hidden||(z=!z,be=null,O=null,ne=0,me=z?"小猫会自己闻花、看蝴蝶、休息。你仍可以点地面或物品叫它过去。":"小猫听见你了，点击地面继续带路。",N())});let Oe=null;function yt(oe){let Ne=r.getBoundingClientRect();$e.set((oe.clientX-Ne.left)/Ne.width*2-1,-(oe.clientY-Ne.top)/Ne.height*2+1),qe.setFromCamera($e,a)}function P(oe){yt(oe),qe.ray.intersectPlane(it,X)&&(z=!1,K(X))}function pt(oe){!w||!m.event.hidden||oe.button>0||(r.focus({preventScroll:!0}),Oe={id:oe.pointerId,x:oe.clientX,y:oe.clientY,moved:!1},r.setPointerCapture?.(oe.pointerId))}function en(oe){!Oe||oe.pointerId!==Oe.id||(Math.hypot(oe.clientX-Oe.x,oe.clientY-Oe.y)>7&&(Oe.moved=!0),Oe.moved&&P(oe))}function Nn(oe){if(!Oe||oe.pointerId!==Oe.id)return;let Ne=Oe.moved;if(Oe=null,Ne)return;yt(oe);let Ee=qe.intersectObjects(ae,!1).find(We=>{let ht=ee.find(bt=>bt.id===We.object.userData.nodeId);return ht&&!Ae.has(ht.id)});if(Ee){let We=ee.find(ht=>ht.id===Ee.object.userData.nodeId);z=!1,K(We.position,We.id)}else P(oe)}let mn=oe=>{!w||oe.target!==r||!m.event.hidden||["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD"].includes(oe.code)&&(oe.preventDefault(),ke.add(oe.code),z=!1,be=null,O=null,ne=0)},gn=oe=>{oe.type==="blur"?ke.clear():ke.delete(oe.code)};r.addEventListener("pointerdown",pt),r.addEventListener("pointermove",en),r.addEventListener("pointerup",Nn),r.addEventListener("pointercancel",()=>{Oe=null}),window.addEventListener("keydown",mn),window.addEventListener("keyup",gn),window.addEventListener("blur",gn);function si(oe="garden",Ne={}){return U=Kh[oe]?oe:"garden",B=["walk","explore","fish"].includes(Ne.mode)?Ne.mode:"explore",re=Ne.token||null,se=Ne.activity||null,ee=(Ne.nodes||[]).map(Ee=>({id:Ee.id,itemId:Ee.itemId})),Ae.clear(),Be.clear(),ge=!1,j=null,Te=!1,we=!1,V=0,Re=!1,Le=0,q=0,z=!1,be=null,O=null,ne=0,Z=performance.now(),y.position.set(0,.22,-6),y.rotation.set(0,0,0),g.position.set(0,0,0),g.rotation.set(0,0,0),S.visible=!1,A.visible=!1,m.event.hidden=!0,me=B==="walk"?"点亮着的路标，走近后留下小猫的脚印。也能用方向键或拖动带路。":B==="fish"?"走到水边的脚印，按住鱼竿，在绿格松手。":"点击小花、贝壳或星星石，小猫会走近拾取。也可以让它自由活动。",Ue(),vi(!0),N(),{location:U,mode:B,token:re}}function vi(oe){w=!!oe,r.hidden=!w,F.hidden=!w,w||(ke.clear(),Oe=null,Re=!1),C()}function ri(oe,Ne){let Ee=oe.clone().sub(y.position);Ee.y=0;let We=Ee.length();if(We<.18)return!1;let ht=Ee.divideScalar(We),bt=Math.atan2(-ht.x,-ht.z),M=Math.atan2(Math.sin(bt-y.rotation.y),Math.cos(bt-y.rotation.y));y.rotation.y+=Ir(M,-Ne*3.9,Ne*3.9);let $=Math.abs(M)>.42?0:6.2;if($){let le=Math.min(We,Ne*$);y.position.copy(W(y.position.clone().addScaledVector(ht,le))),Fe+=le/(jl[Ye]*7.9)}return $>0}function Es(){g.position.y=0,y.updateMatrixWorld(!0);let oe=1/0;for(let Ne of x)Ne.traverse(Ee=>{if(!Ee.isMesh||!Ee.userData.uuid)return;Ee.geometry.computeBoundingBox();let We=Ee.geometry.boundingBox.clone().applyMatrix4(Ee.matrixWorld);oe=Math.min(oe,We.min.y)});Number.isFinite(oe)&&(g.position.y+=.22-oe)}function Rn(oe){let Ne=oe.clone().project(a);return{x:(Ne.x+1)/2,y:(1-Ne.y)/2,visible:Ne.z>=-1&&Ne.z<=1&&Math.abs(Ne.x)<=1&&Math.abs(Ne.y)<=1}}function ws(){y.updateMatrixWorld(!0);let oe=new Xt;Q.forEach(Ee=>{Ee.geometry.computeBoundingBox(),oe.union(Ee.geometry.boundingBox.clone().applyMatrix4(Ee.matrixWorld))});let Ne=1/0;return x.forEach(Ee=>Ee.traverse(We=>{We.isMesh&&We.userData.uuid&&(Ne=Math.min(Ne,We.geometry.boundingBox.clone().applyMatrix4(We.matrixWorld).min.y))})),{ready:!0,active:w,location:U,mode:B,token:re,stage:Ye,phase:Te?"settling":m.event.hidden?Re?"fishing":be?"walking":z?"free":"idle":"event",elapsed:De(),minSeconds:se?.minSeconds||0,completed:[...Ae],total:ee.length,position:y.position.toArray(),yaw:y.rotation.y,message:me,roam:z,autonomousPose:Me,eventChoice:j,minFootY:Ne,fishing:{holding:Re,tension:Le,cooldown:q,spot:Rn(gt)},targets:ee.filter(Ee=>!Ae.has(Ee.id)&&Ee.position).map(Ee=>({id:Ee.id,itemId:Ee.itemId,position:Ee.position.toArray(),screen:Rn(Ee.position.clone().add(un(0,1.4,0)))})),colliders:ye,catBounds:{min:oe.min.toArray(),max:oe.max.toArray()},model:_.state()}}let Oi=performance.now(),Bi=0,tn;function sn(oe){if(T)return;tn=requestAnimationFrame(sn);let Ne=Math.min(.05,Math.max(.001,(oe-Oi)/1e3));if(Oi=oe,!w)return;_e+=Ne,q=Math.max(0,q-Ne);let Ee=!1;if(m.event.hidden&&!Te&&!Re){let ht=Number(ke.has("ArrowRight")||ke.has("KeyD"))-Number(ke.has("ArrowLeft")||ke.has("KeyA")),bt=Number(ke.has("ArrowDown")||ke.has("KeyS"))-Number(ke.has("ArrowUp")||ke.has("KeyW"));if(ht||bt){let M=un(ht,0,bt).normalize();Ee=ri(W(y.position.clone().addScaledVector(M,1.3)),Ne)}else if(be){if(Ee=ri(be,Ne),y.position.distanceTo(be)<.25){let M=O;be=null,O=null,S.visible=!1,ne=0,M&&Ge(ee.find($=>$.id===M))}}else if(ne+=Ne,z&&ne>3.8){let M=[un(-14,.22,-4),un(12,.22,8),un(0,.22,13)],$=Math.floor(_e/6)%3;be=W(M[$]),O=null,Me=["sniff","butterfly","rest"][$],ne=0,me=["小猫闻了闻花丛，尾巴轻轻晃着。","小猫抬头望着蝴蝶，想跟它交朋友。","小猫找了一块暖暖的草地，眯着眼睛休息。"][$],N()}}if(_.applyAnimation(Ee?"walk":"idle",Ee?Fe:_e),B==="walk"&&m.event.hidden&&!Te){let ht=ee.find(bt=>!Ae.has(bt.id));ht?.position&&y.position.distanceTo(ht.position)<1.65&&Ge(ht)}if(!Ee&&z){let ht=_.bones.get("head");if(ht&&(Me==="sniff"&&(ht.rotation.x-=.2+Math.sin(_e*2)*.07),Me==="butterfly"&&(ht.rotation.x+=.14,ht.rotation.y+=Math.sin(_e)*.2)),Me==="rest"){let bt=_.bones.get("body");bt&&(bt.position.y-=1),x.forEach(M=>{M.rotation.x+=.2})}}window.__pgWorldPose?.(_,y,_e,Ee),Re&&(Le+=Ne/2.25,_.setMouth?.(Math.sin(_e*6)*.1),Le>=1&&J()),Es(),(window.__pgBf?.(E,y,_e,b,I)||E.position.set(-5+Math.sin(_e*.6)*16,6+Math.sin(_e*1.4)*2,5+Math.cos(_e*.4)*9)),b.rotation.y=Math.sin(_e*9)*.65,I.rotation.y=-b.rotation.y;let We=_e-he;We<1.1?(A.visible=!0,A.position.copy(gt).add(un(0,4+Math.sin(We/1.1*Math.PI)*7,-8+We*7)),A.rotation.z=We*2):A.visible=!1,De()>7.5&&!ge&&Ae.size<ee.length&&G(),oe-Bi>250&&(Bi=oe,N(),t({location:U,mode:B,phase:Te?"settling":m.event.hidden?Re?"fishing":be?"walking":z?"free":"idle":"event",completed:Ae.size,total:ee.length,progress:ee.length?Ae.size/ee.length:0,elapsed:De(),minSeconds:se?.minSeconds||0,message:me})),s.render(o,a)}fe(n.stage||"kitten"),ve(n),vi(!1),tn=requestAnimationFrame(sn),window.__pgWorld={scene:o,cam:a,hemi:c,sun:l,cat:y,model:_,bf:E,canvas:r,proj:Rn,ev:m.event,get pose(){return Me}};function Kn(){T||(T=!0,cancelAnimationFrame(tn),Y.disconnect(),window.removeEventListener("keydown",mn),window.removeEventListener("keyup",gn),window.removeEventListener("blur",gn),o.traverse(oe=>{Q.includes(oe)||oe.geometry?.dispose()}),_.dispose(),d.forEach(oe=>oe.dispose()),s.dispose(),r.remove(),F.remove())}return{enter:si,setAppearance:ve,setStage:fe,setActive:vi,requestSettle:H,state:ws,dispose:Kn}}async function Sf({container:i,profile:e,onProgress:t=()=>{}}){let n=new fi;n.background=new _t("#d9e7df");let s=new Ni({antialias:!0});s.setPixelRatio(Math.min(devicePixelRatio||1,2)),s.outputColorSpace=Zt,s.shadowMap.enabled=!0,s.shadowMap.type=tl,s.domElement.setAttribute("aria-label","按住猫咪身体进行检查"),s.domElement.style.touchAction="none";let r=new an(37,1,.1,150);r.position.set(25,24,-40),r.lookAt(-1,8,1);let o=new Map;function a(z,ne,_e,Fe=n){let Ye=_e;o.has(Ye)||o.set(Ye,new Ln({color:_e,roughness:1}));let me=new kt(new bn(...z),o.get(Ye));return me.position.set(...ne),me.castShadow=!0,me.receiveShadow=!0,Fe.add(me),me}a([48,1,40],[0,-.6,2],"#a7b9a5");for(let z=0;z<8;z++)for(let ne=0;ne<8;ne++)a([5.9,.1,4.9],[-21+ne*6,0,-15+z*5],(z+ne)%2?"#e1e8da":"#d5e0d2");a([48,26,.8],[0,12.5,22],"#b4cec2"),a([.8,26,40],[-24,12.5,2],"#c5d8c8"),a([12,10,.6],[-12,14,21.4],"#e8f1e7"),a([9.8,7.8,.65],[-12,14,21],"#bad7d0"),a([1,5,.1],[-12,14,20.6],"#f6fbec"),a([5,1,.1],[-12,14,20.55],"#f6fbec"),a([13,5,4],[13,2.5,17],"#7d9f92"),a([13.5,.5,4.5],[13,5.25,17],"#e9efe2"),a([1.6,3,1.6],[10,6.8,17],"#dfb397"),a([1.6,2.3,1.6],[14,6.45,17],"#b0cbb4"),a([.35,1.1,.2],[10,6.8,16.1],"#f3ead9"),a([1.1,.35,.2],[10,6.8,16.08],"#f3ead9"),a([20,.8,22],[-5,3.3,0],"#8da99c"),a([19,.2,21],[-5,3.85,0],"#edf0e4");for(let z of[-13,3])for(let ne of[-8,8])a([1.2,3.1,1.2],[z,1.65,ne],"#80978a");let c=new ut;c.position.set(12,0,7),n.add(c),a([5,6,3],[0,7,0],"#e9efe1",c),a([5.3,4.3,4.2],[0,12.4,0],"#d2b593",c),a([5.4,1.2,4.3],[0,14.8,0],"#7fa791",c),a([.35,1.3,.2],[0,14.8,-2.26],"#f4f8e8",c),a([1.3,.35,.2],[0,14.8,-2.28],"#f4f8e8",c),a([.65,.65,.1],[-1.2,12.7,-2.2],"#536b58",c),a([.65,.65,.1],[1.2,12.7,-2.2],"#536b58",c);for(let z of[-1.35,1.35])a([1.6,4,1.8],[z,2.1,0],"#809b86",c);a([1.3,5,1.6],[-3.4,7.3,0],"#d4bf9e",c),a([1.3,5,1.6],[3.4,7.3,0],"#d4bf9e",c),n.add(new mi("#f6fff1","#9bb19e",2.5));let l=new Zn("#fff0d9",2.4);l.position.set(15,30,-20),l.castShadow=!0,n.add(l);let d;try{d=await Ss({breed:e.breed,outfit:e.outfit})}catch(z){throw n.traverse(ne=>ne.geometry?.dispose()),o.forEach(ne=>ne.dispose()),l.shadow.map?.dispose(),s.dispose(),s.domElement.remove(),z}n.add(d.root),i.append(s.domElement);let f=({kitten:.64,young:.82,adult:1}[e.stage]||.64)*.72;d.root.scale.setScalar(f),d.root.position.set(-5,0,0);let h=new ut;n.add(h),h.visible=!1;let u=0,_=null,y=0,g=!1,p=null,S=0,E=0,b=0,I=!1,A=new Ri,F=new ze,m=new L;function w(z){let ne=z.clone().project(r);return{x:(ne.x+1)/2,y:(1-ne.y)/2}}function T(z){d.root.updateWorldMatrix(!0,!0);let ne=d.bones.get("body").localToWorld(new L(0,2,0));t({steps:u,tool:_,progress:y,completed:u===3,message:z||["选体温计，在小猫身上按住，量一量体温。","选听诊器，在小猫身上按住，听听心跳。","选护理棉，在小猫身上按住，完成清洁护理。","检查完成，医生已经准备好护理方案。"][u],target:w(ne)})}function U(z){return z!==u||u>=3?(T("按顺序检查，先完成当前这一步。"),!1):(_=z,h.children.slice().forEach(ne=>{ne.geometry.dispose(),h.remove(ne)}),z===0?(a([.35,2.8,.35],[0,1.4,0],"#f1f4e9",h),a([.2,1.7,.2],[0,1,-.2],"#db9d87",h)):z===1?(a([1.5,.3,1.5],[0,0,0],"#779d9b",h),a([.25,2,.25],[.6,1,.4],"#536d66",h)):(a([1.8,.35,1.3],[0,0,0],"#eef5dc",h),a([1.5,.12,1],[0,.25,0],"#b8d6bd",h)),T(),!0)}function B(z){let ne=s.domElement.getBoundingClientRect();return F.set((z.clientX-ne.left)/ne.width*2-1,-(z.clientY-ne.top)/ne.height*2+1),A.setFromCamera(F,r),p=A.intersectObject(d.root,!0).find(Fe=>Fe.object.userData.uuid)?.point.clone()||null,p}function re(z){_!==u||u===3||(g=!!B(z),s.domElement.setPointerCapture(z.pointerId))}function se(z){g&&B(z)}function Z(){g=!1,p=null,h.visible=!1}s.domElement.addEventListener("pointerdown",re),s.domElement.addEventListener("pointermove",se),s.domElement.addEventListener("pointerup",Z),s.domElement.addEventListener("pointercancel",Z);function ee(){let z=i.getBoundingClientRect();s.setSize(Math.max(1,z.width),Math.max(1,z.height),!1),r.aspect=Math.max(1,z.width)/Math.max(1,z.height),r.fov=r.aspect<1.4?Dt.radToDeg(2*Math.atan(Math.tan(37*Math.PI/360)*1.4/r.aspect)):37,r.updateProjectionMatrix(),T()}let ae=new ResizeObserver(ee);ae.observe(i);function ye(z){if(I)return;let ne=E&&!document.hidden?Math.min(.07,(z-E)/1e3):0;E=z,S+=ne,d.applyAnimation("idle",S),d.root.position.y=0,d.root.updateWorldMatrix(!0,!0),d.root.position.y=4-new Xt().setFromObject(d.root).min.y,g&&p&&_===u&&u<3&&(y=Math.min(1,y+ne/1.2),h.visible=!0,h.position.copy(p).add(new L(.2,.55,-.4)),d.bones.get("head").rotation.x+=.045,T(),y>=1&&(u++,_=null,y=0,Z(),T())),s.render(n,r),b=requestAnimationFrame(ye)}function be(){return d.root.updateWorldMatrix(!0,!0),d.bones.get("body").getWorldPosition(m),{ready:!I,steps:u,tool:_,progress:y,pressed:g,completed:u===3,target:w(m),cat:d.state()}}function O(){if(I)return;I=!0,cancelAnimationFrame(b),ae.disconnect();for(let[Fe,Ye]of[["pointerdown",re],["pointermove",se],["pointerup",Z],["pointercancel",Z]])s.domElement.removeEventListener(Fe,Ye);let z=new Set,ne=new Set,_e=new Set;n.traverse(Fe=>{Fe.geometry&&z.add(Fe.geometry);for(let Ye of(Array.isArray(Fe.material)?Fe.material:[Fe.material]).filter(Boolean))ne.add(Ye),Ye.map&&_e.add(Ye.map)}),z.forEach(Fe=>Fe.dispose()),ne.forEach(Fe=>Fe.dispose()),_e.forEach(Fe=>Fe.dispose()),l.shadow.map?.dispose(),s.dispose(),s.domElement.remove()}return ee(),T(),b=requestAnimationFrame(ye),{setTool:U,state:be,resize:ee,dispose:O}}var Ze=i=>document.getElementById(i),Lr=i=>String(i??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),Ql=i=>({breed:i.breed,outfit:i.outfit,stage:i.stage}),py={fish:"♧",flower:"✿",shell:"◈",star:"✦"};function Ef({engine:i,getRoom:e,getMini:t,say:n,setBusy:s,isBusy:r}){let o="home",a="garden",c="explore",l=null,d=null,f=null,h=null,u=null,_="",y="",g="",p="",S=!1,E=0,b=kn.filter(O=>!O.rare).map(O=>`<option value="${O.id}">${O.name}</option>`).join("");Ze("adopt-breed").innerHTML=b,Ze("partner-breed").innerHTML=b,Ze("adopt-breed").value="silver",Ze("partner-breed").value="ragdoll";function I(O){return n(O.message+(O.ok&&O.coinDelta>0?` · 喵币 +${O.coinDelta}`:"")),m(i.getState()),O}function A(O){let z=Ql(O),ne=JSON.stringify(z);ne!==_&&(_=ne,e()?.setAppearance(z),t()?.setAppearance(z),l&&(l.setAppearance(z),l.setStage(O.stage)))}function F(O){let z=O.id==="tuxedo"?"#f3f0e5":O.id==="siamese"?"#5d4940":"#fff0d8";return`<svg viewBox="0 0 40 34" aria-hidden="true" class="breed-face"><path fill="${O.color}" d="M5 4h8v5h14V4h8v23h-4v5H9v-5H5z"/><path fill="${z}" d="M12 22h16v6H12z"/><path fill="#354638" d="M12 14h4v5h-4zm12 0h4v5h-4z"/><path fill="#ce9385" d="M18 21h4v3h-4z"/></svg>`}function m(O){A(O),Ze("breed-label").textContent=O.breedName,Ze("value-health").textContent=Math.round(O.health)+" / 100",Ze("stat-health").style.width=O.health+"%",Ze("stat-health").setAttribute("aria-valuenow",Math.round(O.health)),Ze("clinic-condition").textContent=O.healthIssue?`${O.name}有点${O.healthIssue.name}`:O.health<65?`${O.name}需要休息和护理`:`${O.name}今天很健康`,Ze("clinic-detail").textContent=O.healthIssue?O.healthIssue.description:`健康 ${Math.round(O.health)} / 100。${O.health<65?"可以到检查台完成护理。":"也可以来做一次温柔的日常体检。"}`,Ze("visit-clinic").textContent=`带小猫看医生 · ${O.healthIssue?8:4} 喵币`,Ze("visit-clinic").disabled=O.busy||r();let z=O.busy||r(),ne=JSON.stringify([O.breed,O.outfit,O.wardrobe,O.inventory,O.world.orders,O.coins,z]);ne!==y&&(y=ne,Ze("breed-list").innerHTML=kn.filter(ge=>!ge.rare||O.breed===ge.id||O.lineage?.rare===ge.id).map(ge=>`<article class="life-card breed-card${O.breed===ge.id?" selected":""}">${F(ge)}<h3>${ge.name}</h3><p>${ge.description}</p><button type="button" data-breed="${ge.id}" class="life-button" ${z?"disabled":""}>${O.breed===ge.id?"当前品种":"选择这个品种"}</button></article>`).join(""),Ze("outfit-list").innerHTML=Mi.map(ge=>{let j=O.wardrobe.includes(ge.id),Te=O.outfit===ge.id;return`<article class="life-card outfit-card${Te?" selected":""}"><span class="outfit-swatch outfit-${ge.id}" aria-hidden="true">${{bandana:"◢",bow:"⋈",cap:"▰",raincoat:"☂",backpack:"▣",scarf:"≋",sakura:"✿",bell:"◉",crown:"♛",cape:"✧"}[ge.id]}</span><h3>${ge.name}</h3><p>${ge.description}</p><button type="button" class="life-button" data-outfit="${ge.id}" ${z||Te||!j&&(ge.gift||O.coins<ge.price)?"disabled":""}>${Te?"正在穿":j?"穿上试试":ge.gift?"🎀 馈赠限定 · 缘分擦肩大礼物":`购买 · ${ge.price} 喵币`}</button></article>`}).join(""),Ze("unequip-outfit").disabled=z||O.outfit==="none",Ze("world-bag").innerHTML=ei.map(ge=>`<div class="life-row"><span class="bag-symbol" aria-hidden="true">${py[ge.id]}</span><div class="life-row-copy"><strong>${ge.name} × ${O.inventory[ge.id]}</strong><span>每个可卖 ${ge.sellPrice} 喵币</span></div><button type="button" class="life-button" data-sell="${ge.id}" ${z||!O.inventory[ge.id]?"disabled":""}>卖一个</button></div>`).join(""),Ze("world-orders").innerHTML=O.world.orders.map(ge=>`<div class="life-row"><span class="bag-symbol" aria-hidden="true">${ge.claimed?"✓":"✧"}</span><div class="life-row-copy"><strong>${ge.name}</strong><span>${ge.description} · ${ge.progress} / ${ge.target}</span></div><span class="order-reward">${ge.claimed?"已收下奖励":`完成后 +${ge.rewardCoins} 喵币`}</span></div>`).join(""));let _e=O.family,Fe=_e.pair,Ye=JSON.stringify([O.cats.map(ge=>[ge.id,ge.name,ge.breed,ge.sex,ge.xp,Math.round(ge.health)]),O.activeCatId,Fe?{...Fe,activeSeconds:Math.floor(Fe.activeSeconds)}:null,z]);if(Ye!==g){g=Ye,Ze("cat-roster").innerHTML=O.cats.map(we=>`<article class="life-card${we.id===O.activeCatId?" selected":""}">${F(kn.find(Re=>Re.id===we.breed))}<h3>${Lr(we.name)}</h3><p class="roster-meta">${we.breedName} · ${we.sexLabel}<br>${we.stageLabel} · 成长 ${we.xp} · 健康 ${Math.round(we.health)}</p><button type="button" class="life-button" data-cat="${Lr(we.id)}" ${z||we.id===O.activeCatId?"disabled":""}>${we.id===O.activeCatId?"正在陪伴":"陪这只小猫"}</button></article>`).join("");let ge=Ze("baby-name"),j=ge?.value||"小奶糖",Te=Fe?O.cats.find(we=>we.id===Fe.parentId):null;Ze("family-pair").innerHTML=Fe?`<div class="family-current"><h3>${Lr(Te.name)}与${Lr(Fe.partnerName)}的小家庭</h3><p class="family-note">成功照料 ${Fe.careProgress} / ${Fe.careTarget} 次 · 实际陪伴 ${Math.min(Fe.requiredSeconds,Math.floor(Fe.activeSeconds))} / ${Fe.requiredSeconds} 秒。${Te.id!==O.activeCatId?"先切回这位猫咪家长，继续陪伴。":"离线不会推进，健康不佳时先看医生。"}</p><div class="family-progress"><div style="width:${Math.min(100,Fe.progress*100)}%"></div></div>${Fe.ready?`<div class="adopt-controls"><input id="baby-name" maxlength="12" aria-label="新生幼猫名字" value="${Lr(j)}"><button type="button" class="life-button" id="claim-baby" ${z?"disabled":""}>迎接新生幼猫</button></div>`:'<p class="family-note">再好好照顾一会儿，准备迎接新生命吧。</p>'}<button type="button" class="life-button" id="cancel-family" ${z?"disabled":""}>${Fe.remote?"收起这颗联机蛋（不退喵币）":"结束这次配对 · 退还 30 喵币"}</button><p class="family-note">结束后取消这次育幼准备，猫咪和已完成的照料都会保留。</p></div>`:""}let me=_e.reservedSlots;Ze("family-capacity").textContent=`小家住着 ${_e.count} / ${_e.maxCats} 只猫${me?" · 已为新生幼猫预留一个位置":""}`,Ze("adopt-cat").disabled=z||O.coins<12||_e.availableSlots===0,Ze("begin-family").disabled=z||O.stage!=="adult"||O.health<65||!!O.healthIssue||O.coins<30||!!Fe||_e.count>=_e.maxCats,Ze("begin-family").title=O.stage!=="adult"?"长成成年猫后可以安排配对":O.healthIssue||O.health<65?"先照顾好健康":Fe?"已经在准备迎接幼猫":"";let V=JSON.stringify(O.journal);V!==p&&(p=V,Ze("life-journal").innerHTML=O.journal.length?O.journal.slice().reverse().map(ge=>`<li class="journal-entry"><span aria-hidden="true">${{world:"✿",clinic:"✚",family:"♡",wardrobe:"⋈",graduate:"✧"}[ge.kind]||"✦"}</span><div><p>${Lr(ge.message)}</p><time>${new Date(ge.at).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</time></div></li>`).join(""):'<li class="journal-entry"><span aria-hidden="true">✦</span><div><p>今天，开始和小猫一起生活。穿一件新衣、出门一次，都会留下真实的小回忆。</p></div></li>')}function w(){E++,S=!1,f&&(i.cancelWorldActivity(f),f=null),l?.setActive(!1)}function T(O,z){Ze("world-entry-status").hidden=!O,Ze("world-scene").setAttribute("aria-busy",String(O==="loading")),O&&(Ze("world-entry-title").textContent={loading:"小猫正在准备出门",blocked:"先照顾好小猫，再出发",error:"这次没有打开小镇"}[O],Ze("world-entry-message").textContent=z,Ze("world-entry-status").dataset.state=O,document.querySelectorAll("[data-world-remedy]").forEach(ne=>{let _e=ne.dataset.worldRemedy;ne.hidden=O==="loading"&&_e!=="home"||_e==="sleep"&&(O!=="blocked"||!!i.getState().healthIssue)||_e==="clinic"&&(O!=="blocked"||!i.getState().healthIssue)}),Ze("world-trip-label").textContent=O==="loading"?"准备出门中…":O==="blocked"?"暂时不能出游":"小镇没有打开",Ze("world-progress").textContent=z)}function U(O){o=O,document.querySelectorAll("[data-view]").forEach(z=>{let ne=z.dataset.view===o;z.classList.toggle("active",ne),ne?z.setAttribute("aria-current","page"):z.removeAttribute("aria-current")}),Ze("home-scene").hidden=o==="world",Ze("world-scene").hidden=o!=="world",Ze("care-shortcuts").hidden=o!=="home";for(let z of["world","shop","clinic","family","journal"])Ze(z+"-panel").hidden=o!==z;e()?.setActive(o!=="world"),l?.setActive(o==="world")}async function B(O){if(r()){n("先完成或结束眼前的互动，再去其他地方吧。");return}if(O===o)return;let z=!!f;o==="world"&&(w(),T(null)),U(O),m(i.getState()),z&&n("这趟先回家，未结算的临时收获没有存入背包。"),O==="world"&&await se(c,a)}async function re(){if(l)return l;if(!d){let O=Mf({container:Ze("world-view"),profile:Ql(i.getState()),onEvent(z){let ne;return z.type==="world-node"?ne=i.collectWorldItem(z.token,z.nodeId):z.type==="world-choice"?ne=i.applyWorldChoice(z.token,z.event,z.choice):z.type==="world-settle"&&(ne=i.settleWorldActivity(z.token),ne.ok&&(f=null,I(ne))),ne||{ok:!1,message:"这次互动已经结束。"}},onProgress(z){Ze("world-trip-label").textContent=`${ts.find(ne=>ne.id===z.mode)?.name||"小镇散步"} · ${z.completed} / ${z.total} · ${Math.floor(z.elapsed)} 秒`,Ze("world-progress").textContent=z.message}}).then(z=>(l=z,l.setAppearance(Ql(i.getState())),l.setStage(i.getState().stage),z)).catch(z=>{throw d===O&&(d=null),z});d=O}return d}async function se(O,z){if(r()||S)return;w(),S=!0;let ne=E;c=O,a=c==="fish"?"river":z;let _e=i.beginWorldActivity(c,a);if(!_e.ok){S=!1,T("blocked",_e.message),n(_e.message),m(i.getState());return}f=_e.token,T("loading","正在打开小镇，准备好后就能带小猫探索。");try{let Fe=await re();if(ne!==E||f!==_e.token||o!=="world")return;Fe.enter(a,{..._e,mode:c}),T(null),Ze("world-label").textContent={garden:"暖爪小庭院",park:"微风小公园",river:"星星河岸"}[a],document.querySelectorAll("[data-location]").forEach(Ye=>{Ye.classList.toggle("active",Ye.dataset.location===a),Ye.setAttribute("aria-pressed",String(Ye.dataset.location===a))}),document.querySelectorAll("[data-world-mode]").forEach(Ye=>{Ye.classList.toggle("active",Ye.dataset.worldMode===c),Ye.setAttribute("aria-pressed",String(Ye.dataset.worldMode===c))}),n(ts.find(Ye=>Ye.id===c).description+" 收获要在回家路标结算。")}catch(Fe){if(ne!==E||f!==_e.token)return;w();let Ye="小镇场景没有加载成功，可以重试，或先回小家陪小猫。";T("error",Ye),n(Ye),console.error(Fe)}finally{ne===E&&(S=!1),m(i.getState())}}document.querySelectorAll("button[data-view]").forEach(O=>O.addEventListener("click",()=>B(O.dataset.view))),document.querySelectorAll("[data-location]").forEach(O=>O.addEventListener("click",()=>se(c,O.dataset.location))),document.querySelectorAll("[data-world-mode]").forEach(O=>O.addEventListener("click",()=>se(O.dataset.worldMode,a))),Ze("world-home").addEventListener("click",()=>B("home")),document.querySelectorAll("[data-world-remedy]").forEach(O=>O.addEventListener("click",async()=>{let z=O.dataset.worldRemedy;if(z==="retry"){await se(c,a);return}await B(z==="clinic"?"clinic":"home"),z==="sleep"&&document.querySelector('[data-action="sleep"]').click()})),Ze("breed-list").addEventListener("click",O=>{let z=O.target.closest("[data-breed]");z&&I(i.chooseBreed(z.dataset.breed))}),Ze("outfit-list").addEventListener("click",O=>{let z=O.target.closest("[data-outfit]");if(!z)return;let ne=z.dataset.outfit;if(!i.getState().wardrobe.includes(ne)){let Fe=i.buyItem(ne);if(!Fe.ok){I(Fe);return}}I(i.equipItem(ne))}),Ze("unequip-outfit").addEventListener("click",()=>I(i.equipItem("none"))),Ze("world-bag").addEventListener("click",O=>{let z=O.target.closest("[data-sell]");z&&I(i.sellItem(z.dataset.sell))}),Ze("cat-roster").addEventListener("click",O=>{let z=O.target.closest("[data-cat]");z&&I(i.switchCat(z.dataset.cat))}),Ze("adopt-cat").addEventListener("click",()=>{let O=i.adoptCat({name:Ze("adopt-name").value.trim()||"小奶糖",breed:Ze("adopt-breed").value,sex:Ze("adopt-sex").value});O.ok&&(Ze("adopt-name").value=""),I(O)}),Ze("begin-family").addEventListener("click",()=>I(i.beginFamily(Ze("partner-breed").value))),Ze("family-pair").addEventListener("click",O=>{O.target.closest("#claim-baby")&&I(i.claimBaby(Ze("baby-name").value)),O.target.closest("#cancel-family")&&I(i.cancelFamily())});function Z(O){Ze("clinic-task").textContent=O.message,Ze("clinic-fill").style.width=(O.steps+O.progress)/3*100+"%",Ze("clinic-steps").textContent=`检查 ${O.steps} / 3`,document.querySelectorAll("[data-clinic-tool]").forEach(z=>{let ne=Number(z.dataset.clinicTool);z.disabled=ne!==O.steps,z.classList.toggle("selected",ne===O.tool),z.setAttribute("aria-pressed",String(ne===O.tool))}),Ze("finish-clinic").hidden=!O.completed,O.completed&&(Ze("clinic-result").hidden=!1,Ze("clinic-result").textContent="三步检查完成，点击完成护理后支付诊费、恢复健康。")}async function ee(){if(r()||u)return;let O=i.beginVisit();if(!O.ok){I(O);return}let z=O.token;u=z,s(!0,"clinic"),Ze("clinic-cost").textContent=`完成后 ${O.cost} 喵币`,Ze("clinic-result").hidden=!0,Ze("finish-clinic").hidden=!0,Ze("clinic-task").textContent="医生正在准备检查台…",Ze("clinic-fill").style.width="0%",Ze("clinic-steps").textContent="检查 0 / 3",document.querySelectorAll("[data-clinic-tool]").forEach(ne=>ne.disabled=!0),Ze("clinic-dialog").showModal(),e()?.setActive(!1);try{let ne=await Sf({container:Ze("clinic-view"),profile:Ql(i.getState()),onProgress:_e=>{u===z&&Ze("clinic-dialog").open&&Z(_e)}});if(u!==z||!Ze("clinic-dialog").open){ne.dispose();return}h=ne}catch(ne){if(console.error(ne),u!==z)return;i.cancelVisit(z),u=null,Ze("clinic-dialog").close(),n("检查台暂时没有打开，未收取诊费。")}}Ze("visit-clinic").addEventListener("click",ee),document.querySelectorAll("[data-clinic-tool]").forEach(O=>O.addEventListener("click",()=>h?.setTool(Number(O.dataset.clinicTool)))),Ze("finish-clinic").addEventListener("click",()=>{if(!u||!h)return;let O=i.finishVisit(u,{steps:h.state().steps});if(!O.ok){I(O);return}u=null,Ze("clinic-dialog").close(),I(O)}),Ze("clinic-dialog").addEventListener("close",()=>{let O=u;u&&i.cancelVisit(u),u=null,h?.dispose(),h=null,s(!1),e()?.setActive(o!=="world"),O&&n("检查中途离开，没有收取诊费。")});function ae(){w(),Ze("clinic-dialog").open&&Ze("clinic-dialog").close(),u&&(i.cancelVisit(u),u=null),e()?.setActive(!1)}function ye(){o==="world"?(U("home"),n("回到小家啦，想出门可以再开始一趟。")):e()?.setActive(!0)}function be(){return{view:o,location:a,mode:c,entering:S,world:l?.state()||null,clinic:h?.state()||null,worldToken:f,visitToken:u}}return Ze("ambient-status").textContent=e()?.state().ambient||"小猫正在熟悉它的小家",m(i.getState()),{render:m,state:be,suspend:ae,resume:ye,onAmbient:O=>{Ze("ambient-status").textContent=O.message}}}var Xe=i=>document.getElementById(i),Tf=[...document.querySelectorAll("[data-action]")],Af={feed:"一起吃饭",drink:"一起喝水",bath:"洗香香",climb:"探索猫爬架",tease:"追逗猫棒",pet:"享受摸摸",play:"小猫接鱼",sleep:"打个小盹",clinic:"看医生"},my=new Set(["feed","drink","bath","climb","tease"]),Bn=null,Jn=null,Dr=null,Qi=!1,zn=!1,Rf={score:0,remaining:20,combo:0,running:!1,ready:!1},Ui=null,Gs=null,Nr=!1,Qh=null,nu=!1,wf="",Nt;function pn(i){Xe("message").textContent=i,Xe("life-toast").textContent=i}function gy(i){Xe("bond-label").textContent=i.bondLabel,Xe("stamp-count").textContent=`${i.goals.filter(n=>n.claimed).length} / ${i.goals.length}`;let e=JSON.stringify([i.goals,zn,i.busy,Qi]);if(e===wf)return;wf=e;let t=i.goals.map(n=>{let s=document.createElement("li");s.className="wish-row"+(n.claimed?" collected":"");let r=document.createElement("span");r.className="wish-stamp",r.textContent=n.claimed?"✓":"✧",r.setAttribute("aria-hidden","true");let o=document.createElement("div");o.className="wish-copy";let a=document.createElement("strong");a.textContent=n.title;let c=document.createElement("span");c.textContent=n.claimed?"这段陪伴，已经收进相册。":n.description,o.append(a,c);let l=document.createElement("button");return l.type="button",l.className="wish-button",l.dataset.goal=n.id,l.textContent=n.claimed?"已收集":n.completed?`收印章 +${n.rewardCoins}`:`${n.progress} / ${n.target}`,l.disabled=n.claimed||!n.completed||zn||i.busy||!Qi,l.setAttribute("aria-label",n.claimed?`${n.title}已收集`:`领取${n.title}印章`),s.append(r,o,l),s});Xe("wish-list").replaceChildren(...t)}function tc(i){Xe("pet-name").textContent=i.name,Xe("stage-label").textContent=i.stageLabel,Xe("coins").textContent=i.coins;for(let t of["food","mood","clean","energy"])Xe("value-"+t).textContent=Math.round(i.stats[t])+" / 100",Xe("stat-"+t).style.width=i.stats[t]+"%",Xe("stat-"+t).setAttribute("aria-valuenow",Math.round(i.stats[t]));Xe("growth-fill").style.width=i.growthProgress+"%",Xe("growth-fill").setAttribute("aria-valuenow",Math.round(i.growthProgress)),Xe("growth-text").textContent=i.stage==="adult"?"已经长大啦":`${i.xp} / ${i.nextStageXp}`,document.querySelectorAll("[data-stage]").forEach(t=>{let n=t.dataset.stage===i.stage;t.classList.toggle("active",n),n?t.setAttribute("aria-current","step"):t.removeAttribute("aria-current")}),Tf.forEach(t=>{t.disabled=!Qi||zn||i.busy}),document.querySelectorAll("[data-view]").forEach(t=>{t.disabled=!Qi}),Xe("rename-button").disabled=zn||i.busy,Xe("save-menu-button").disabled=zn||i.busy;let e=i.storageIssue;Xe("save-status").textContent=e?"请导出存档备份":"进度自动保存",Xe("save-status").title=e||"完成照料后保存；离开不会扣状态",e&&e!==Qh&&(pn(e),Qh=e),e||(Qh=null),Bn&&Bn.state().stage!==i.stage&&Bn.setStage(i.stage),Jn&&Jn.setStage(i.stage),gy(i),Dr?.render(i)}Nt=vu({onChange:tc});function Fi(i,e){zn=i,Xe("action-status").hidden=!i,Xe("ambient-status").hidden=i,Xe("action-status").textContent=i?(Af[e]||"陪你一起玩")+"…":"",document.querySelector('[data-action="sleep"]').setAttribute("aria-pressed",String(i&&e==="sleep")),Xe("room-hint").textContent=i?"跟着提示，与小猫一起完成吧":"点食碗、水碗或小猫 · 拖动看看小家",tc(Nt.getState())}function _y(i){if(i.phase==="完成"||i.phase==="取消"){iu();return}Xe("interaction-panel").hidden=!1,Xe("message").hidden=!0,Xe("interaction-title").textContent=Af[i.action]||"一起玩",Xe("interaction-message").textContent=i.message;let e=Math.round(Math.max(0,Math.min(1,i.progress||0))*100);Xe("interaction-fill").style.width=e+"%",Xe("interaction-fill").setAttribute("aria-valuenow",e),Xe("interaction-percent").textContent=e+"%"}function iu(){Xe("interaction-panel").hidden=!0,Xe("message").hidden=!1}async function Cf(i){if(Bn){Fi(!0,i);try{await Bn.perform(i)}finally{Fi(!1)}}}function eu(i){let e=`成长 +${i.xpGain}${i.coinDelta>0?" · 喵币 +"+i.coinDelta:""}`;pn(i.message+" "+e+(i.stageChanged?" "+Nt.getState().name+"长成"+Nt.getState().stageLabel+"啦！":""))}async function tu(i){if(!Qi||zn)return;if(i==="play"){xy();return}if(my.has(i)){let t=Nt.beginCare(i);if(!t.ok){pn(t.message);return}let n=t.token;Gs=n,Fi(!0,i);try{let s=await Bn.startInteraction(i);if(s.ok&&s.completed){let r=Nt.finishCare(n,{score:s.score});r.ok?eu(r):pn(r.message)}else Nt.cancelCare(n),pn("先休息一下，准备好了再一起玩。")}catch(s){Nt.cancelCare(n),Bn.cancelInteraction(),pn("这次互动没有完成，照料进度已保留。"),console.error(s)}finally{Gs===n&&(Gs=null),iu(),Fi(!1)}return}let e=Nt.act(i);if(!e.ok){pn(e.message);return}eu(e),await Cf(i)}Tf.forEach(i=>i.addEventListener("click",()=>tu(i.dataset.action)));Xe("cancel-interaction").addEventListener("click",()=>Bn?.cancelInteraction());Xe("wish-list").addEventListener("click",i=>{let e=i.target.closest("[data-goal]");if(!e||zn||!Qi)return;let t=Nt.claimGoal(e.dataset.goal);pn(t.message+(t.ok?" 喵币 +"+t.coinsGain:""))});Jn=_f({canvas:Xe("mini-canvas"),onStatus(i){Rf=i,Xe("mini-score").textContent=i.score,Xe("mini-time").textContent=i.remaining+" 秒",Xe("mini-combo").textContent=i.combo?`${i.combo} 连击`:"接住第一条小鱼吧",Xe("start-mini").disabled=!i.ready||i.running,i.error?(Xe("mini-result").hidden=!1,Xe("mini-result").textContent=i.error):i.loading?Xe("start-mini").textContent="小猫准备中…":i.ready&&Xe("start-mini").textContent==="小猫准备中…"&&(Xe("start-mini").textContent="开始游戏")},onFinish(i){let e=Nt.finishPlay(Ui,i);Ui=null,Xe("mini-result").hidden=!1,Xe("mini-result").textContent=e.ok?`${e.message} 成长 +${e.xpGain} · 喵币 +${e.coinDelta}${e.stageChanged?" · 长成"+Nt.getState().stageLabel+"啦！":""}`:e.message,Xe("start-mini").hidden=!1,Xe("start-mini").textContent="再玩一局",e.ok&&(eu(e),Nr=!0),Fi(!1)}});function xy(){zn||!Qi||(Xe("mini-result").hidden=!0,Xe("mini-score").textContent="0",Xe("mini-time").textContent="20 秒",Xe("mini-combo").textContent="左右移动小猫，接住小鱼",Xe("start-mini").hidden=!1,Xe("start-mini").disabled=!Jn.state().ready,Xe("start-mini").textContent=Jn.state().ready?"开始游戏":"小猫准备中…",Xe("game-dialog").showModal(),Jn.resize())}Xe("start-mini").addEventListener("click",()=>{if(!Jn.state().ready||zn)return;let i=Nt.beginPlay();if(!i.ok){Xe("mini-result").hidden=!1,Xe("mini-result").textContent=i.message;return}if(Ui=i.token,!Jn.start()){Nt.cancelPlay(Ui),Ui=null;return}Xe("mini-result").hidden=!0,Xe("start-mini").hidden=!0,Fi(!0,"play")});Xe("game-dialog").addEventListener("close",()=>{Jn.stop(),Nt.cancelPlay(Ui),Ui=null,Fi(!1),Nr&&(Nr=!1,Cf("play"))});document.querySelectorAll("[data-close]").forEach(i=>i.addEventListener("click",()=>Xe(i.dataset.close).close()));Xe("rename-button").addEventListener("click",()=>{Xe("name-input").value=Nt.getState().name,Xe("rename-error").textContent="",Xe("rename-dialog").showModal(),Xe("name-input").select()});Xe("rename-form").addEventListener("submit",i=>{i.preventDefault();let e=Nt.rename(Xe("name-input").value);e.ok?(Xe("rename-dialog").close(),pn(e.message)):Xe("rename-error").textContent=e.message});function Ur(i){nu=i,Xe("save-menu").hidden=!i,Xe("save-menu-button").setAttribute("aria-expanded",String(i))}Xe("save-menu-button").addEventListener("click",()=>Ur(!nu));document.addEventListener("click",i=>{nu&&!Xe("save-menu").contains(i.target)&&!Xe("save-menu-button").contains(i.target)&&Ur(!1)});document.addEventListener("keydown",i=>{i.key==="Escape"&&(Ur(!1),Gs&&Bn?.cancelInteraction())});Xe("export-save").addEventListener("click",()=>{let i=URL.createObjectURL(new Blob([Nt.exportSave()],{type:"application/json;charset=utf-8"})),e=document.createElement("a");e.href=i;let t=Nt.getState().name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,"_");e.download=t+"-电子宠物存档.json",document.body.append(e),e.click(),e.remove(),setTimeout(()=>URL.revokeObjectURL(i),2e3),Ur(!1),pn("存档已导出，留好它就能恢复这段陪伴。")});Xe("import-save").addEventListener("click",()=>{Ur(!1),Xe("import-file").click()});Xe("import-file").addEventListener("change",async i=>{let e=i.target.files[0];if(i.target.value="",!!e){if(zn){pn("先完成这次互动，再恢复存档吧。");return}if(e.size>8e6){pn("存档文件太大，请选择从游戏导出的 JSON 存档。");return}try{let t=await Nt.importSave(await e.text());Nr=!1,pn(t.message)}catch{pn("文件无法读取，当前进度没有改变。")}}});Xe("reset-save").addEventListener("click",()=>{Ur(!1),Xe("reset-dialog").showModal()});Xe("confirm-reset").addEventListener("click",()=>{Nt.reset(),Nr=!1,Xe("reset-dialog").close(),pn("欢迎回家，小橘！一起从小小的幼猫开始吧。")});var ec=performance.now();setInterval(()=>{let i=performance.now(),e=Math.min(2,(i-ec)/1e3);ec=i,!document.hidden&&!zn&&!globalThis.CatOfflineDurable?.transactionPaused&&Nt.tick(e)},1e3);document.addEventListener("visibilitychange",()=>{ec=performance.now(),document.hidden&&Nt.flush()});window.addEventListener("pagehide",()=>{Dr?.suspend(),Gs&&(Nt.cancelCare(Gs),Gs=null,Bn?.cancelInteraction(),iu(),Fi(!1)),(Ui||Jn.isRunning())&&(Jn.stop(),Nt.cancelPlay(Ui),Ui=null,Nr=!1,Xe("start-mini").hidden=!1,Xe("start-mini").textContent="开始游戏",Xe("game-dialog").open&&Xe("game-dialog").close(),Fi(!1)),Nt.flush()});window.addEventListener("pageshow",()=>{ec=performance.now(),Dr?.resume()});window.CatTownTHREE={REVISION:'185',Scene:fi,PerspectiveCamera:an,Mesh:kt,Group:ut,BoxGeometry:bn,MeshStandardMaterial:Ln,MeshBasicMaterial:pi,ShaderMaterial:Yn,Color:_t,Vector3:L,Vector2:ze,Vector4:Kt,Box3:Xt,Ray:hs,Raycaster:Ri,WebGLRenderer:Ni,DirectionalLight:Zn,HemisphereLight:mi,BufferGeometry:Tn,Float32BufferAttribute:nn,Light:yo,LightShadow:Yc,PCFSoftShadowMap:tl,ACESFilmicToneMapping:Ki,BackSide:1,SRGBColorSpace:Zt,CanvasTexture:Fs,createPet:Ss};window.__petGame={store:Nt,hostCreateStore:vu,hostSuspend(){Dr?.suspend(),Gs&&(Nt.cancelCare(Gs),Gs=null,Bn?.cancelInteraction(),iu(),Fi(!1)),(Ui||Jn.isRunning())&&(Jn.stop(),Nt.cancelPlay(Ui),Ui=null,Nr=!1,Xe("start-mini").hidden=!1,Xe("start-mini").textContent="开始游戏",Xe("game-dialog").open&&Xe("game-dialog").close(),Fi(!1)),Nt.flush();Bn?.setActive(false)},hostResume(){ec=performance.now();Dr?.resume()},setRoomActive(value){Bn?.setActive(Boolean(value))},state:()=>({ready:Qi,busy:zn,pet:Nt.getState(),room:Bn?.state()||null,mini:Jn.state(),life:Dr?.state()||null,miniStatus:Rf})};tc(Nt.getState());pn(Nt.getState().storageIssue||"欢迎来到暖爪小镇！点点房间里的东西，也可以选品种、穿新衣、带小猫出门。");bf({container:Xe("room-view"),onPet:()=>tu("pet"),onAction:tu,onAmbient:i=>Dr?.onAmbient(i),onProgress:_y}).then(i=>{Bn=i,Bn.setStage(Nt.getState().stage),Qi=!0,Dr=Ef({engine:Nt,getRoom:()=>Bn,getMini:()=>Jn,say:pn,setBusy:Fi,isBusy:()=>zn}),tc(Nt.getState()),Nt.flush()}).catch(i=>{pn(i.message||"小猫房间无法显示，请换用支持 WebGL 的浏览器。"),Xe("action-status").hidden=!1,Xe("action-status").textContent="房间暂时无法打开",console.error(i)});})();
