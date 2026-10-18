const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
test('production Android canonical strings match JS including slash and surrogates',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/com/catforest/htmlcandidate/EventDurableBridge.java'),'utf8');
 const start=source.indexOf('    private static String canonicalString('),end=source.indexOf('    private static String canonical(Object',start);assert.ok(start>=0&&end>start);
 const values=['毕业/小猫','quote" slash\\ /','\b\f\n\r\t\u0001','猫🐱','\ud800','\udfff','\u2028\u2029'];
 const expressions=values.map(value=>'canonicalString(new String(new char[]{'+Array.from({length:value.length},(_,i)=>'(char)'+value.charCodeAt(i)).join(',')+'}))');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'prd-native-canonical-'));fs.writeFileSync(path.join(temporary,'CanonicalProbe.java'),'public class CanonicalProbe {\n'+source.slice(start,end)+'\npublic static void main(String[] args){'+expressions.map(x=>'System.out.println(java.util.Base64.getEncoder().encodeToString(('+x+').getBytes(java.nio.charset.StandardCharsets.UTF_8)));').join('')+'}}');
 const javaHome=process.env.JAVA_HOME||'D:/黑客松/mobile-pet/.toolchain/jdk/jdk-21.0.12.1+1';
 const compile=cp.spawnSync(path.join(javaHome,'bin/javac.exe'),['-encoding','UTF-8',path.join(temporary,'CanonicalProbe.java')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
 const run=cp.spawnSync(path.join(javaHome,'bin/java.exe'),['-Dfile.encoding=UTF-8','-cp',temporary,'CanonicalProbe'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(run.stdout.trimEnd().split(/\r?\n/).map(x=>Buffer.from(x,'base64').toString('utf8')),values.map(JSON.stringify));
});
