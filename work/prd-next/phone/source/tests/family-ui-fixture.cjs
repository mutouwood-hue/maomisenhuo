/* Real original store + complete original Ef binder; no 3D, device or phone save. */
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fixture(){
 const dom=new JSDOM(read('android/app/src/main/assets/index.html'),{url:'https://appassets.androidplatform.net/offline/index.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,frames=[],messages=[];
 w.setTimeout=w.setInterval=()=>1;w.clearTimeout=w.clearInterval=()=>{};w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
 const source=read('android/app/src/main/assets/game-03.js'),a=source.indexOf('var Ze=i=>'),b=source.indexOf('var Xe=i=>',a);
 if(a<0||b<0)throw Error('original UI anchors changed');
 w.eval(source.slice(0,source.indexOf('/**'))+source.slice(a,b)+';window.__familyReal={createStore:vu,bind:Ef};})();');
 let now=2_000_000_000_000;const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},store=w.__familyReal.createStore({storage,now:()=>now});
 const ui=w.__familyReal.bind({engine:store,getRoom:()=>null,getMini:()=>null,say:x=>messages.push(x),setBusy(){},isBusy:()=>false});
 const presentation=require('../web/offline-family-ui.js').install(w);
 const render=()=>{ui.render(store.getState());presentation.refresh();};
 return{w,d,store,values,messages,ui,presentation,render,clock(ms){now+=ms;},flush(){for(const f of frames.splice(0))f();},close(){dom.window.close();}};
}
module.exports={fixture,root,read};
