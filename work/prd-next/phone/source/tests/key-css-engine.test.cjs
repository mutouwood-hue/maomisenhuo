const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
test('production CSS, active cascade, actual WebKit geometry and original input combine correctly;018 negative control fails',()=>{
 const root=path.resolve(__dirname,'..');cp.execFileSync(process.execPath,[root+'/scripts/check_key_css.cjs'],{cwd:root,timeout:60000,stdio:'pipe'});
 const report=JSON.parse(fs.readFileSync(root+'/../evidence/key/production-css-input.json'));assert.equal(report.pass,true);assert.equal(report.tests.length,11);assert.ok(report.tests.every(x=>x.pass));
 for(const entry of report.metadata.productionStyles)assert.equal(entry.sha256,crypto.createHash('sha256').update(fs.readFileSync(root+'/web/'+entry.file)).digest('hex'));
 assert.equal(report.metadata.inputSha256,crypto.createHash('sha256').update(fs.readFileSync(root+'/web/offline-meet-key.js')).digest('hex'));
});
