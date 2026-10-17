/* Strip only the exact newly embedded hooks, then compare every remaining byte to a frozen baseline. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function withoutRuntime(game){
 const embedded=fs.readFileSync(path.resolve(__dirname,'../scripts/care-runtime.cjs'),'utf8').split('// END EMBEDDED INSTALL')[0];
 const tail='adoptCat:$e};'+embedded+'return __hostInstallCareRuntime(__hostApi,{identity:()=>JSON.stringify([o.createdAt,o.activeCatId,o.cats.map(C=>[C.id,C.joinedAt])]),read:()=>p,replace:value=>{p=value},clock:e,cooldowns:Hf,activeCatId:()=>o.activeCatId,keys:()=>o.cats.flatMap(C=>[...Bo,"clinic"].map(Y=>C.id+":"+Y)),hydrate:Ue,seed:hostRuntime});}/**';
 const changes=[['function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{},hostRuntime}={})','function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{}}={})'],['const __hostApi={hostDeviceCare:','return{hostDeviceCare:'],[tail,'adoptCat:$e}}/**']];
 for(const [before,after]of changes){assert.equal(game.split(before).length-1,1,'runtime parity hook must be unique');game=game.replace(before,after);}return game;
}
module.exports={withoutRuntime};
