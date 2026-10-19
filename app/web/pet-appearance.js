/* Native room presentation semantics; read-only projection, no transport. */
(function(w){
 'use strict';
 const breeds=Object.freeze(['orange','silver','tuxedo','siamese','ragdoll','blue','calico','golden','starry']);
 const outfits=Object.freeze(['none','bandana','bow','cap','raincoat','backpack','scarf','sakura','bell','crown','cape','wings','rain_hat','vest','star_collar']);
 const bodies=Object.freeze(['slim','standard','round']);
 function project(state){
  const pet=state?.pet;
  if(!state?.ready||!pet?.id||pet.storageIssue||!['kitten','baby','young','adult'].includes(pet.stage)||!breeds.includes(pet.breed)||!outfits.includes(pet.outfit))return null;
  const bodyShape=bodies.includes(pet.bodyShape)?pet.bodyShape:'standard';
  const growthStage=w.CatPetGrowth.normalize(pet.stage);
  return Object.freeze({petId:String(pet.id),growthStage,breed:pet.breed,outfit:pet.outfit,bodyShape,effectiveBodyShape:growthStage==='adult'?bodyShape:'standard',outfitAssetReady:true});
 }
 w.CatPetAppearance=Object.freeze({breeds,outfits,bodies,project,
  assetStatus:Object.freeze({wings:'authored-five-fits',slim:'explicit-request-only',round:'explicit-request-only'})});
})(window);
