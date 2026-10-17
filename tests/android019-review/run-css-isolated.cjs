'use strict';
// Executes the frozen production CSS/input fixture with generated output isolated here.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const script=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui019/source/scripts/check_key_css.cjs');
let code=fs.readFileSync(script,'utf8');
code=code.replace("const out=path.resolve(root,'../evidence/key');",'const out='+JSON.stringify(__dirname)+';');
code=code.replaceAll("'/tmp/cat-key-webkit'",JSON.stringify(path.join(__dirname,'key-webkit')));
code=code.replace("cp.execFileSync('swiftc',[root+", "cp.execFileSync('swiftc',['-module-cache-path',"+JSON.stringify(path.join(__dirname,'swift-module-cache'))+",root+");
new Function('require',code)(createRequire(script));
