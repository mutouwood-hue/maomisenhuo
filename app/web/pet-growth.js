/* Native geometry and orange palettes come from authored assets. Preserve the legacy factory outside the room; tint only existing alternate-breed palettes. */
(function(w){
 'use strict';
 const stages=Object.freeze({kitten:Object.freeze({light:.24}),young:Object.freeze({light:.09}),adult:Object.freeze({light:-.06})});
 const normalize=value=>value==='baby'?'kitten':Object.hasOwn(stages,value)?value:'adult';
 const fur=/^(tabby_|white_|soft_belly|muzzle_|ear_(base|step|tip)|tail_|(front|back)_(left|right)_(leg|white_sock|paw))/;
 function applyLegacy(bones,stage){
  // Preserve the pre-existing shared factory behavior outside the room.
  const legacy={baby:{head:1.22,body:[.90,.84,.90],leg:.82},kitten:{head:1.22,body:[.90,.84,.90],leg:.82},young:{head:1.09,body:[.98,.94,1.02],leg:.94},adult:{head:1,body:[1.02,1.02,1.08],leg:1}};
  const p=legacy[stage]||legacy.adult;
  for(const [name,bone]of bones){
   if(name==='head')bone.scale.multiplyScalar(p.head);
   else if(name==='body')bone.scale.multiply({x:p.body[0],y:p.body[1],z:p.body[2]});
   else if(/^(front|back)_(left|right)$/.test(name))bone.scale.y*=p.leg;
  }
 }
 function tint(data,{elements,width,stage}){
  const strength=stages[normalize(stage)].light,mask=new Uint8Array(data.length/4);
  const mark=(element,value)=>{for(const face of Object.values(element.faces||{})){
   if(face.texture===null||!face.uv)continue;
   const [x0,y0,x1,y1]=face.uv;
   for(let y=Math.max(0,Math.floor(Math.min(y0,y1)));y<Math.ceil(Math.max(y0,y1));y++)
    for(let x=Math.max(0,Math.floor(Math.min(x0,x1)));x<Math.min(width,Math.ceil(Math.max(x0,x1)));x++){
     const index=y*width+x;if(index<mask.length)mask[index]=value;
    }
  }};
  for(const element of elements)if(fur.test(element.name))mark(element,1);
  // Shared UVs used by eyes, nose, mouth and whiskers retain their identity.
  for(const element of elements)if(!fur.test(element.name))mark(element,0);
  for(let i=0;i<mask.length;i++)if(mask[i]&&data[i*4+3]){
   const offset=i*4,white=Math.min(data[offset],data[offset+1],data[offset+2])>205;
   const amount=strength*(white ? .30 : 1);
   for(let channel=0;channel<3;channel++){
    const c=data[offset+channel];
    data[offset+channel]=Math.round(amount>=0?c+(255-c)*amount:c*(1+amount));
   }
  }
  return data;
 }
 w.CatPetGrowth=Object.freeze({normalize,apply:applyLegacy,applyLegacy,tint,stages});
})(window);
