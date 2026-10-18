const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'web/life-summary.inc.js'),'utf8');
function summarize(day,{demo=false,now=600,quirks=[]}={}){
 const context={L:{cfg:{demo},nowMin:()=>now,fmtDur:x=>x+'分钟',quirksToday:()=>quirks},petName:()=> '小橘'};
 vm.runInNewContext(source+';globalThis.summarize=summary;',context);return context.summarize(day);
}
test('no location and inferred schedule never become confirmed shared experiences',()=>{
 const result=summarize({segs:[{start:0,end:420,kind:'sleep',guess:true},{start:420,end:1440,kind:'home',guess:true}]});
 assert.match(result.life,/暂无可确认.*虚线.*推测/);assert.match(result.work,/不据此判断/);assert.match(result.cat,/暂无已记录/);
 assert.doesNotMatch(JSON.stringify(result),/目送|冲到门口|公司楼下|一直在家等你/);assert.equal(result.nums.sleep,0);assert.equal(result.nums.home,0);
});
test('confirmed segments clamp at now and exclude guessed gaps and future time',()=>{
 const result=summarize({segs:[{start:0,end:100,kind:'sleep',guess:true},{start:100,end:200,kind:'home',guess:false},{start:200,end:900,kind:'work',guess:false},{start:1000,end:1100,kind:'out',guess:false}]});
 assert.equal(result.nums.home,100);assert.equal(result.nums.work,400);assert.match(result.life,/记录为工作.*400分钟/);assert.doesNotMatch(result.life,/外出/);assert.match(result.life,/缺口按作息推测/);
});
test('demo is explicitly fictional and existing quirk records are distinct from simulated owner actions',()=>{
 const result=summarize({segs:[{start:0,end:1440,kind:'work'}]},{demo:true,quirks:[{icon:'♥'}]});
 assert.match(result.life,/虚构日程/);assert.match(result.work,/非实际/);assert.equal(result.nums.work,0);assert.match(result.cat,/已记录 1 次/);
});
test('generated asset wires truthful summary and leaves original action point formula unchanged',()=>{
 const built=fs.readFileSync(path.join(root,'android/app/src/main/assets/game-06.js'),'utf8');
 assert.ok(built.replace(/\r\n/g,'\n').includes(source.replace(/\r\n/g,'\n').trim()));assert.ok(built.includes('今日记录摘要 <small>截至此刻 · 仅供主动查看</small>'));assert.ok(!built.includes('<h4>每日总结</h4>'));
 const original=fs.readFileSync(path.join(root,'original/game.html'),'utf8');
 const a=original.indexOf('L.points='),b=original.indexOf('\n',a);assert.ok(a>=0);assert.ok(built.includes(original.slice(a,b).trim()));
});
