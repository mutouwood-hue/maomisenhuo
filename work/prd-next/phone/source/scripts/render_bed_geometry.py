"""Software textured mesh review. No app/screen/renderer or image editing."""
from pathlib import Path
import json,base64,io
import numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]/'evidence/bed'
W,H=900,700
# One fixed crop per stage for the whole transition; do not hide movement by
# re-centering each frame. Original camera projection, enlarged for inspection.
app_bounds={}
for source in sorted(root.glob('*-meshes.json')):
 data=json.loads(source.read_text());stage=data['stage'];pr=np.concatenate([np.array(m['projected']) for m in data['meshes']]);pr[:,0]*=data['camera']['aspect']
 lo=pr[:,:2].min(axis=0);hi=pr[:,:2].max(axis=0)
 if stage in app_bounds:lo=np.minimum(lo,app_bounds[stage][0]);hi=np.maximum(hi,app_bounds[stage][1])
 app_bounds[stage]=(lo,hi)
for source in sorted(root.glob('*-meshes.json')):
 stage=source.name.removesuffix('-meshes.json');data=json.loads(source.read_text());tex=np.asarray(Image.open(io.BytesIO(base64.b64decode(data['texture'].split(',')[1]))).convert('RGBA'))
 for view,camera in [('front',[15,17,-25]),('side',[-39,12,-8]),('app-camera',[8,24,-43])]:
  target=np.array([-12.4,5.3,12.4]);eye=np.array(camera);forward=(target-eye);forward=forward/np.linalg.norm(forward);right=np.cross(forward,[0,1,0]);right=right/np.linalg.norm(right);up=np.cross(right,forward)
  if view=='app-camera':
   lo,hi=app_bounds[data['stage']];factor=min((W-100)/(hi[0]-lo[0]),(H-100)/(hi[1]-lo[1]));mid=(lo+hi)/2
  zbuf=np.full((H,W),np.inf);pixels=np.empty((H,W,3),np.uint8);pixels[:]=[222,236,231]
  for mesh in data['meshes']:
   vertices=np.array(mesh['verts']);relative=vertices-target;screen=np.stack([W/2+relative@right*24,H/2-relative@up*24,(vertices-eye)@forward],axis=1)
   if view=='app-camera':
    pr=np.array(mesh['projected']);pr[:,0]*=data['camera']['aspect'];screen=np.stack([W/2+(pr[:,0]-mid[0])*factor,H/2-(pr[:,1]-mid[1])*factor,pr[:,2]],axis=1)
   for triangle in mesh['triangles']:
    ids=triangle['ids'];p=screen[ids];world=vertices[ids];n=np.cross(world[1]-world[0],world[2]-world[0]);norm=np.linalg.norm(n)
    if norm<1e-9:continue
    shade=.72+.28*abs(np.dot(n/norm,np.array([-.4,.8,-.4])))
    x0=max(0,int(np.floor(p[:,0].min())));x1=min(W-1,int(np.ceil(p[:,0].max())));y0=max(0,int(np.floor(p[:,1].min())));y1=min(H-1,int(np.ceil(p[:,1].max())))
    if x1<x0 or y1<y0:continue
    x,y=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5);den=(p[1,1]-p[2,1])*(p[0,0]-p[2,0])+(p[2,0]-p[1,0])*(p[0,1]-p[2,1])
    if abs(den)<1e-8:continue
    a=((p[1,1]-p[2,1])*(x-p[2,0])+(p[2,0]-p[1,0])*(y-p[2,1]))/den;b=((p[2,1]-p[0,1])*(x-p[2,0])+(p[0,0]-p[2,0])*(y-p[2,1]))/den;c=1-a-b
    depth=a*p[0,2]+b*p[1,2]+c*p[2,2];dest=zbuf[y0:y1+1,x0:x1+1];mask=(a>=-1e-6)&(b>=-1e-6)&(c>=-1e-6)&(depth<dest)
    if triangle['texture']:
     uv=np.array(triangle['uv']);u=a*uv[0,0]+b*uv[1,0]+c*uv[2,0];v=a*uv[0,1]+b*uv[1,1]+c*uv[2,1];color=tex[np.clip(((1-v)*tex.shape[0]).astype(int),0,tex.shape[0]-1),np.clip((u*tex.shape[1]).astype(int),0,tex.shape[1]-1)];mask&=color[:,:,3]>25;color=color[:,:,:3]
    else:color=np.broadcast_to(np.array(triangle['color']),(*mask.shape,3))
    pixels[y0:y1+1,x0:x1+1][mask]=np.clip(color[mask]*shade,0,255).astype(np.uint8);dest[mask]=depth[mask]
  image=Image.fromarray(pixels);draw=ImageDraw.Draw(image);draw.rectangle([0,0,W,43],fill='#fffaf2');draw.text((18,14),f'SOFTWARE / {stage} / {view} - not Android screenshot',fill='#3c5147');image.save(root/f'{stage}-{view}.png')

for stage in ['kitten','adult']:
 labels=['lie-00','lie-25','lie-50','lie-75','sleep','wake-25','wake-50','wake-75','wake-100']
 sheet=Image.new('RGB',(1350,1050),'white')
 for i,label in enumerate(labels):
  frame=Image.open(root/f'{stage}-{label}-app-camera.png').resize((450,350))
  sheet.paste(frame,((i%3)*450,(i//3)*350))
 sheet.save(root/f'{stage}-transition-sheet.png')
