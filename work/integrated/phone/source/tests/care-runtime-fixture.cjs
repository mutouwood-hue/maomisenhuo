/* Production mounted event source + original store; explicit memory authority and ports. */
const {JSDOM}=require('jsdom'),crypto=require('node:crypto');
const base=require('./event-fixture.cjs');
function mounted({clock=()=>base.NOW}={}){
 const h=base.harness({clock}),dom=new JSDOM('<body><button id="write">本地写入</button></body>',{url:'https://appassets.androidplatform.net/offline/index.html'}),w=dom.window,messages=[],lifecycle=[];
 Object.defineProperty(w,'localStorage',{value:h.io});
 w.CatOfflineEventLedger=h.ledger;w.CatOfflineDurable=h.durable;
 w.__petGame={store:h.store,hostCreateStore:base.createStore,state:()=>({ready:true,pet:h.store.getState(),busy:false}),hostSuspend(){lifecycle.push('suspend');h.store.flush();},hostResume(){lifecycle.push('resume');},setRoomActive(){}};
 w.__pgSocial={D:h.social,M:null,saveD(){h.io.setItem(base.db.SOCIAL,JSON.stringify(w.__pgSocial.D));},hostRefresh(){}};
 w.__pgLife={toast:text=>messages.push(text)};w.CatOfflineSceneMap={read:()=>h.source.wire()};
 const api=base.events.mount(w),results=[];
 const makeConsumer=({digest=async text=>crypto.createHash('sha256').update(text).digest('hex'),fault=()=>{}}={})=>base.events.createConsumer({ports:h.ports,ledger:h.ledger,storage:h.io,source:api.source,durable:h.durable,now:clock,digest,fault,onResult:r=>results.push(r)});
 return {...h,w,api,source:api.source,messages,lifecycle,results,makeConsumer,consumer:makeConsumer(),close(){dom.window.close();}};
}
module.exports={...base,mounted};
