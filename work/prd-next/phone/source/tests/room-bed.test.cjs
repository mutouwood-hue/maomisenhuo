const {test}=require('node:test'),assert=require('node:assert/strict');
const {createModel}=require('./room-geometry-fixture.cjs');
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);
test('bed support fits adult/kitten side-rest, clears walls and actual bathtub/climbing footprints',async()=>{
 const h=await createModel(),{T,bedApi}=h,c=bedApi.config,bedBox=new T.Box().setFromObject(h.bed);
 assert.ok(c.mattress[0]>=20&&c.mattress[2]>=13);assert.ok(bedBox.min.x>-24.1+.5);assert.ok(bedBox.max.z<22.6-.5);
 assert.ok(bedBox.min.z>2.25+.8,'original rotated bathtub ends at z2.25');assert.ok(bedBox.max.x<4-.8,'climbing base begins at x4');
 for(const stage of ['kitten','baby','young','adult'])for(const outfit of ['none','cap','crown','raincoat','backpack','cape']){
  const r=h.pose(stage,1,outfit),b=r.bounds;near(r.roll,Math.PI/2);near(r.torso.min.y,c.surface);near(r.head.min.y,c.pillowTop);
  assert.ok(b.min.x>c.center[0]-c.mattress[0]/2&&b.max.x<c.center[0]+c.mattress[0]/2,stage+outfit+' bed width');
  assert.ok(b.min.z>c.center[1]-c.mattress[2]/2&&b.max.z<c.center[1]+c.mattress[2]/2,stage+outfit+' bed depth');
  assert.ok(b.min.y>=c.surface-1e-5,'no paw/body below mattress');assert.ok(r.head.getCenter(new T.Vector()).x<r.torso.getCenter(new T.Vector()).x,'face toward left pillow');
 }
});
test('lie/wake pose resets each frame without growing kitten head or accumulating a translation',async()=>{
 const h=await createModel();const a=h.pose('kitten',1);const first={min:a.bounds.min.toArray(),max:a.bounds.max.toArray()};
 for(let i=0;i<120;i++){const p=h.pose('kitten',1);assert.deepEqual(p.bounds.min.toArray(),first.min);assert.deepEqual(p.bounds.max.toArray(),first.max);}
 for(const stage of ['kitten','adult'])for(let n=0;n<=20;n++){const p=h.pose(stage,n/20);assert.ok(p.bounds.min.toArray().every(Number.isFinite));assert.ok(p.bounds.max.toArray().every(Number.isFinite));assert.ok(p.bounds.min.y>=h.bedApi.config.surface-1e-5,'lie/wake cannot enter mattress');}
});
test('resting neck and face follow the torso without the 014 head tower, with original head scale',async()=>{
 const h=await createModel();
 for(const stage of ['kitten','baby','young','adult']){
  const scale={kitten:.64,baby:.64,young:.82,adult:1}[stage],p=h.pose(stage,1);
  const face=p.headCore,torso=p.torso,faceCenter=face.getCenter(new h.T.Vector()),torsoCenter=torso.getCenter(new h.T.Vector());
  // 014's head core stood 2.34 units above a kitten's back; these relational
  // constraints catch that failure rather than just checking mattress contact.
  assert.ok(face.max.y-torso.max.y<1.3*scale,stage+' face towers above resting back');
  assert.ok(Math.abs(faceCenter.z-torsoCenter.z)<2*scale,stage+' neck remains displaced sideways');
  const direction=new h.T.Vector(0,0,-1).transformDirection(h.model.bones.get('head').matrixWorld);
  assert.ok(direction.z<-.95&&direction.y>-.2,'closed face looks into room, not upright into wall');
  near(p.head.min.y,h.bedApi.config.pillowTop);
  assert.deepEqual(Array.from(h.model.bones.get('head').scale.toArray()),Array(3).fill(stage==='kitten'||stage==='baby'?1.065:1));
  h.pose(stage,0);near(h.model.bones.get('head').rotation.z,0);near(h.model.bones.get('head').rotation.y,0);
  for(const name of ['ear_left','ear_right']){const ear=h.model.bones.get(name);near(ear.rotation.x,0);near(ear.rotation.z,0);near(ear.scale.y,1);}
 }
});
