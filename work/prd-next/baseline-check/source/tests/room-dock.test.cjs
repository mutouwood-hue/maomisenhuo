const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),root=path.resolve(__dirname,'..'),assets=root+'/android/app/src/main/assets/';
test('actual mobile route/care DOM restores six dock actions in the same mutation turn, without waiting 400ms or clicking room',async()=>{
 const dom=new JSDOM(fs.readFileSync(assets+'index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document,periods=[];
 try{
  w.matchMedia=()=>({matches:true,addEventListener(){}});w.setInterval=(fn,ms)=>{periods.push(ms);return 1;};w.__petAnalytics={track(){}};
  w.eval(fs.readFileSync(assets+'game-04.js','utf8').split('\n\n(()=>{')[0]);
  const code=fs.readFileSync(assets+'game-03.js','utf8'),start=code.indexOf('function U(O){',code.indexOf('function Ef(')),end=code.indexOf('async function B(O)',start);
  w.eval('let o="home";const Ze=id=>document.getElementById(id),e=()=>null,l=null;'+code.slice(start,end)+';window.routeFixture=U;');
  const flush=()=>new Promise(resolve=>setImmediate(resolve)),dock=d.getElementById('m-dock');
  w.routeFixture('world');await flush();assert.equal(dock.hidden,true);
  w.routeFixture('home');await flush();assert.equal(dock.hidden,false);assert.equal(dock.querySelectorAll('button').length,6);
  d.getElementById('interaction-panel').hidden=false;await flush();assert.equal(dock.hidden,true);
  d.getElementById('interaction-panel').hidden=true;await flush();assert.equal(dock.hidden,false);assert.ok(periods.includes(400),'existing poll remains a fallback');
 }finally{dom.window.close();}
});
