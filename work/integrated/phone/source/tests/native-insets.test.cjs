const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('actual injected inset script tolerates pre-DOM callback and reapplies all edges after page load',()=>{
  const java=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/com/catforest/htmlcandidate/MainActivity.java'),'utf8');
  const method=java.slice(java.indexOf('private void applyInsets()'),java.indexOf('private void requestMedia('));
  const expression=method.match(/evaluate\("([\s\S]*?)"\);/)[1];
  const edges={Top:24,Right:0,Bottom:28,Left:0};
  const script=expression.replace(/"\+\(inset(Top|Right|Bottom|Left)\/density\)\+"/g,(_,edge)=>String(edges[edge]));
  const document={documentElement:null};
  assert.doesNotThrow(()=>vm.runInNewContext(script,{document}));
  const properties=new Map();
  document.documentElement={style:{setProperty:(name,value)=>properties.set(name,value)}};
  vm.runInNewContext(script,{document});
  assert.deepEqual(Object.fromEntries(properties),{'--safe-area-inset-top':'24px','--safe-area-inset-right':'0px','--safe-area-inset-bottom':'28px','--safe-area-inset-left':'0px'});
  assert.match(java,/onPageFinished\([^\n]+\{\s*applyInsets\(\);/);
});
