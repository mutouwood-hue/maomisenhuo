#!/usr/bin/env python3
"""Production asset conversion: authored rigid GLB -> layered indexed RLE.
No app/firmware execution, interaction simulation or acceptance.
"""
from pathlib import Path
import argparse, base64, hashlib, io, json, math, struct
import numpy as np
from PIL import Image
from compress_native_cat import write_assets
from native_cat_color import NativeCatColor

W,H=192,208
CLIPS=[('idle',20,3.2),('paw',24,2.4),('walk',10,1.0),('attention',12,3.2),('sniff',12,2.4),('pounce',24,2.4)]
FRAME_COUNT=sum(row[1] for row in CLIPS)
SHAPES=['01_kitten','02_young','03_adult_slim','04_adult_standard','05_adult_round']
OUTFITS=['01_thick_bib','02_bow','03_mint_backpack','04_cream_wings']
COLOR_PROFILE=Path(__file__).with_name('native_cat_color_profile.json')
color_pipeline=None

def unit(v):
    return v/max(np.linalg.norm(v),1e-12)


def trs(p,q,s):
    x,y,z,w=q
    rotation=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                       [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                       [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    result=np.eye(4);result[:3,:3]=rotation@np.diag(s);result[:3,3]=p
    return result


class GLB:
    def __init__(self,path):
        raw=path.read_bytes();self.sha=hashlib.sha256(raw).hexdigest();chunks={};offset=12
        while offset<len(raw):
            size,kind=struct.unpack_from('<II',raw,offset);chunks[kind]=raw[offset+8:offset+8+size];offset+=8+size
        self.g=json.loads(chunks[0x4e4f534a]);self.data=chunks[0x004e4942];self.arrays={};self.textures=[]
        for image in self.g.get('images',[]):
            view=self.g['bufferViews'][image['bufferView']];b=view.get('byteOffset',0)
            self.textures.append(np.array(Image.open(io.BytesIO(self.data[b:b+view['byteLength']])).convert('RGBA')))
        self.parts=[]
        for ni,node in enumerate(self.g['nodes']):
            if 'mesh' not in node:continue
            for primitive in self.g['meshes'][node['mesh']]['primitives']:
                attributes=primitive['attributes'];positions=self.accessor(attributes['POSITION']);normals=self.accessor(attributes['NORMAL']);uv=self.accessor(attributes['TEXCOORD_0']) if 'TEXCOORD_0' in attributes else np.zeros((len(positions),2))
                indices=self.accessor(primitive['indices']).reshape(-1,3).astype(int)
                info=self.g['materials'][primitive['material']];pbr=info.get('pbrMetallicRoughness',{})
                # glTF factors are linear; base-color texture RGB is encoded sRGB.
                # Decode texture once, multiply factor, light/tone-map, encode once.
                factor=np.array(pbr.get('baseColorFactor',[1,1,1,1])[:3])
                color=np.stack([color_pipeline.shade(factor,level)for level in range(3)])
                texture=None
                if 'baseColorTexture' in pbr:texture=self.textures[self.g['textures'][pbr['baseColorTexture']['index']]['source']]
                shaded_texture=None if texture is None else color_pipeline.srgb_shades(texture[:,:,:3],factor)
                name=info.get('name','');role=1 if 'Warm orange' in name or 'Warm ear orange' in name else 3 if 'Cream edge' in name else 0
                self.parts.append((ni,positions,normals,uv,indices,color,texture,role,shaded_texture))
        self.rest=self.world(None,0)

    def accessor(self,index):
        if index in self.arrays:return self.arrays[index]
        a=self.g['accessors'][index];b=self.g['bufferViews'][a['bufferView']];types={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'};width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dtype=np.dtype(types[a['componentType']]);stride=b.get('byteStride',width*dtype.itemsize)
        values=np.ndarray((a['count'],width),dtype=dtype,buffer=self.data,offset=b.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,dtype.itemsize)).astype(float)
        self.arrays[index]=values;return values

    def world(self,clip,time):
        values=[{'translation':np.array(n.get('translation',[0,0,0]),float),'rotation':np.array(n.get('rotation',[0,0,0,1]),float),'scale':np.array(n.get('scale',[1,1,1]),float)}for n in self.g['nodes']]
        authored={'attention':'idle','sniff':'idle','pounce':'paw'}.get(clip,clip)
        animation=next((a for a in self.g.get('animations',[]) if a['name']==authored),None)
        if animation:
            for channel in animation['channels']:
                sampler=animation['samplers'][channel['sampler']];times=self.accessor(sampler['input']).ravel();outputs=self.accessor(sampler['output']);hi=min(int(np.searchsorted(times,time,side='right')),len(times)-1);lo=max(0,hi-1)
                if time>=times[-1]:lo=hi=len(times)-1
                mix=0 if sampler.get('interpolation')=='STEP' or hi==lo else (time-times[lo])/(times[hi]-times[lo])
                a,b=outputs[lo],outputs[hi];path=channel['target']['path']
                if path=='rotation':
                    dot=float(np.dot(a,b))
                    if dot<0:b=-b;dot=-dot
                    if dot<.9995:
                        angle=math.acos(min(1,max(-1,dot)));q=(math.sin((1-mix)*angle)*a+math.sin(mix*angle)*b)/math.sin(angle)
                    else:q=unit(a+(b-a)*mix)
                    values[channel['target']['node']][path]=q
                else:values[channel['target']['node']][path]=a+(b-a)*mix
        by_name={node.get('name'):i for i,node in enumerate(self.g['nodes']) if node.get('name')}
        def rotate(name,axis,angle):
            index=by_name.get(name)
            if index is None:return
            direction=np.array(axis,float);direction=unit(direction)
            delta=np.r_[direction*math.sin(angle/2),math.cos(angle/2)]
            a=values[index]['rotation'];x1,y1,z1,w1=a;x2,y2,z2,w2=delta
            values[index]['rotation']=np.array([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2])
        if clip=='sniff':
            phase=(time%2.4)/2.4
            sniff=0.5-0.5*math.cos(phase*math.pi*4)
            rotate('head',[1,0,0],math.radians(-24-5*sniff))
            rotate('tail_base',[1,0,0],math.radians(5*math.sin(phase*math.pi*2)))
        elif clip=='pounce':
            phase=(time%2.4)/2.4
            if phase<.18:lift=0.0
            elif phase<.42:lift=.24*(phase-.18)/.24
            elif phase<.63:lift=.24
            elif phase<.80:lift=.24*(.80-phase)/.17
            else:lift=0.0
            root=by_name.get('root')
            if root is not None:values[root]['translation'][1]+=lift
            rotate('head',[1,0,0],math.radians(-12 if phase<.22 or phase>.72 else 11))
            rotate('front_left',[1,0,0],math.radians(-9))
        local=[]
        for i,node in enumerate(self.g['nodes']):
            v=values[i];m=np.array(node['matrix']).reshape(4,4).T if 'matrix' in node else trs(v['translation'],v['rotation'],v['scale'])
            if clip=='attention' and node.get('name')=='head':
                x,y=math.radians(-10)/2,math.radians(32)/2;m=m@trs([0,0,0],[math.sin(x)*math.cos(y),math.cos(x)*math.sin(y),math.sin(x)*math.sin(y),math.cos(x)*math.cos(y)],[1,1,1])
            local.append(m)
        world=[None]*len(local)
        def visit(index,parent):
            world[index]=parent@local[index]
            for child in self.g['nodes'][index].get('children',[]):visit(child,world[index])
        for index in self.g['scenes'][self.g.get('scene',0)]['nodes']:visit(index,np.eye(4))
        return world


yaw,pitch=math.radians(-28),math.radians(14)
target=np.array([0,8.6,2.2]);eye=target+90*np.array([math.sin(yaw)*math.cos(pitch),math.sin(pitch),-math.cos(yaw)*math.cos(pitch)])
forward=unit(target-eye);right=unit(np.array([forward[2],0,-forward[0]]));up=np.cross(forward,right)
camera=np.array([right,up,forward]);focal=233/math.tan(math.radians(13.5));floor=camera@(np.array([0,0,2.2])-eye);floor_ratio=floor[1]/floor[2]
basis=np.diag([20,20,-20,1])


def render(asset,world,colors,depth,roles,shades,stage_palette,accessory=False,delta=None):
    lighting=color_pipeline.lighting;light=unit(np.array(lighting['direction']))
    for ni,pos,normal,uv,indices,color,texture,material_role,shaded_texture in asset.parts:
        m=world[ni] if delta is None else delta@world[ni];m=basis@m
        xyz=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];view=(xyz-eye)@camera.T
        projected=np.c_[96+focal*view[:,0]/view[:,2],196-focal*(view[:,1]/view[:,2]-floor_ratio)]
        normals=normal@np.linalg.inv(m[:3,:3]);normals/=np.maximum(1e-12,np.linalg.norm(normals,axis=1))[:,None]
        for tri in indices:
            p=projected[tri];z=view[tri,2];minx=max(0,int(math.floor(p[:,0].min())));maxx=min(W-1,int(math.ceil(p[:,0].max())));miny=max(0,int(math.floor(p[:,1].min())));maxy=min(H-1,int(math.ceil(p[:,1].max())))
            if minx>maxx or miny>maxy or min(z)<=0:continue
            ax,ay=p[0];bx,by=p[1];cx,cy=p[2];area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
            if abs(area)<1e-8:continue
            yy,xx=np.mgrid[miny:maxy+1,minx:maxx+1];xx=xx+.5;yy=yy+.5
            a=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/area;b=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/area;c=1-a-b
            mask=(a>=-1e-7)&(b>=-1e-7)&(c>=-1e-7);inverse=a/z[0]+b/z[1]+c/z[2];distance=1/np.maximum(inverse,1e-12)
            region=depth[miny:maxy+1,minx:maxx+1];mask&=distance<region+1e-6
            if not mask.any():continue
            face=unit(normals[tri].mean(axis=0));level=min(2,max(0,int(round((lighting['classifierAmbient']+lighting['classifierDiffuse']*max(0,float(face@light))-lighting['classifierOrigin'])/lighting['classifierStep']))))
            rr=np.full(mask.shape,material_role,dtype=np.uint8)
            if texture is not None:
                u=(a*uv[tri[0],0]/z[0]+b*uv[tri[1],0]/z[1]+c*uv[tri[2],0]/z[2])/inverse;v=(a*uv[tri[0],1]/z[0]+b*uv[tri[1],1]/z[1]+c*uv[tri[2],1]/z[2])/inverse
                ty=np.clip((v*texture.shape[0]).astype(int),0,texture.shape[0]-1);tx=np.clip((u*texture.shape[1]).astype(int),0,texture.shape[1]-1)
                sample=texture[ty,tx];rgb=sample[:,:,:3].astype(float);mask&=sample[:,:,3]>0
                if not accessory:
                    d=np.sum((rgb[:,:,None,:]-stage_palette[None,None,:,:])**2,axis=3);closest=d.argmin(axis=2);warm=d.min(axis=2)<80
                    rr=np.where(warm,np.where((closest==1)|(closest==2),2,1),rr).astype(np.uint8)
                    rr=np.where((rgb[:,:,1]>rgb[:,:,0]*1.05)&(rgb[:,:,1]>rgb[:,:,2]*1.15),4,rr).astype(np.uint8)
                    rr=np.where((rgb.min(axis=2)>190)&~warm,3,rr).astype(np.uint8)
                rgb=shaded_texture[level,ty,tx]
            else:rgb=np.broadcast_to(color[level],mask.shape+(3,))
            packed=(255<<24)|(rgb[:,:,0]<<16)|(rgb[:,:,1]<<8)|rgb[:,:,2]
            colors[miny:maxy+1,minx:maxx+1][mask]=packed[mask];roles[miny:maxy+1,minx:maxx+1][mask]=0 if accessory else rr[mask];shades[miny:maxy+1,minx:maxx+1][mask]=level;region[mask]=distance[mask]


def encode(colors,roles,shades):
    keys=(colors.astype(np.uint64)<<16)|(roles.astype(np.uint64)<<8)|shades.astype(np.uint64);keys[colors==0]=0
    palette,indices=np.unique(keys,return_inverse=True)
    if len(palette)>128:raise ValueError('Native indexed layer exceeds its 128-entry palette budget')
    raw=bytearray()
    for value in palette:
        key=int(value);rgb=key>>16;raw.extend(struct.pack('<IBB',rgb,(key>>8)&255,key&255))
    run=bytearray();indices=indices.astype(np.uint8).ravel();start=0
    for stop in np.r_[np.flatnonzero(indices[1:]!=indices[:-1])+1,len(indices)]:
        count=int(stop-start)
        while count:take=min(65535,count);run.extend(struct.pack('<HB',take,int(indices[start])));count-=take
        start=int(stop)
    return struct.pack('<HI',len(palette),len(run))+raw+run


def main():
    global color_pipeline
    parser=argparse.ArgumentParser();parser.add_argument('--asset-root',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--color-profile',type=Path,default=COLOR_PROFILE);args=parser.parse_args()
    color_pipeline=NativeCatColor(args.color_profile)
    static=args.asset_root/'cat_growth_and_body_v2/cat-refined-v2';animated=args.asset_root/'cat_animation_sources_v3/cat-animated-v3';fits=args.asset_root/'catforest-accessories-40-fits-v3';manifest=json.loads((static/'manifest.json').read_text());fit_manifest=json.loads((fits/'fit_manifest.json').read_text())
    payload=bytearray();offsets=np.zeros((5,5,FRAME_COUNT),dtype=np.uint32);sources=[]
    for si,key in enumerate(SHAPES):
        asset=GLB(animated/(key+'_animated.glb'));parts=[GLB(fits/key/(name+'.glb'))for name in OUTFITS];sources.append({'shape':key,'modelSha256':asset.sha,'accessorySha256':dict(zip(OUTFITS,[p.sha for p in parts]))})
        parent_names=[next(f for f in fit_manifest if f['stage']==key and f['accessory']==name)['parent_node']for name in OUTFITS];parents=[next(i for i,n in enumerate(asset.g['nodes'])if n['name']==name)for name in parent_names]
        stage=manifest['stage_parameters'][key]['palette'];palette=np.array(manifest['palette_rgb'][stage],float);frame_index=0
        for clip,count,seconds in CLIPS:
            for index in range(count):
                world=asset.world(clip,index*seconds/count);image=np.zeros((H,W),np.uint32);depth=np.full((H,W),np.inf);roles=np.zeros((H,W),np.uint8);shades=roles.copy();render(asset,world,image,depth,roles,shades,palette)
                offsets[si,0,frame_index]=len(payload);payload.extend(encode(image,roles,shades))
                for oi,part in enumerate(parts):
                    layer=np.zeros((H,W),np.uint32);r=np.zeros((H,W),np.uint8);s=r.copy();bone=parents[oi];delta=world[bone]@np.linalg.inv(asset.rest[bone]);render(part,part.rest,layer,depth.copy(),r,s,palette,True,delta)
                    offsets[si,oi+1,frame_index]=len(payload);payload.extend(encode(layer,r,s))
                frame_index+=1
            print('asset converted',key,clip,count,'frames',flush=True)
    args.output.mkdir(parents=True,exist_ok=True);(args.output/'native_cat.rle').write_bytes(payload)
    with (args.output/'native_cat_data.c').open('w')as f:
        f.write('/* Authored native GLBs, production RLE conversion; no runtime or visual acceptance. */\n#include "native_cat_data.h"\nconst uint8_t badge_native_cat_data[]={\n')
        for i in range(0,len(payload),24):f.write(','.join(str(b)for b in payload[i:i+24])+',\n')
        f.write('};\nconst uint32_t badge_native_cat_offsets[5][5]['+str(FRAME_COUNT)+']='+json.dumps(offsets.tolist()).replace('[','{').replace(']','}')+';\n')
    (args.output/'native_cat_data.h').write_text('#pragma once\n#include <stdint.h>\n#define BADGE_NATIVE_CAT_FRAME_COUNT '+str(FRAME_COUNT)+'u\nextern const uint8_t badge_native_cat_data[];\nextern const uint32_t badge_native_cat_offsets[5][5][BADGE_NATIVE_CAT_FRAME_COUNT];\n#define BADGE_NATIVE_CAT_DATA_BYTES '+str(len(payload))+'u\n')
    packaging=write_assets(args.output,payload,offsets.tolist())
    color_pipeline.write_breed_lookup(args.output)
    (args.output/'color-profile.json').write_bytes(color_pipeline.raw)
    (args.output/'provenance.json').write_text(json.dumps({'productionAssetConversionOnly':True,'sources':sources,'canvas':[W,H],'footAnchor':[96,196],'clips':CLIPS,'baseFrames':FRAME_COUNT,'priorityOutfitLayers':FRAME_COUNT*4,'layerPaletteLimit':128,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'packaging':packaging,'camera':{'yaw':-28,'pitch':14,'distance':90,'focal':focal},'colorPipeline':{'id':color_pipeline.profile['id'],'profileSha256':color_pipeline.sha256,'profileFile':'color-profile.json','runtimeLookup':'native_cat_color.h','acceptedRelease':'068 user visual acceptance; exact profile bytes retained','reference':'phone050; fixed diffuse approximation, not full room PBR equivalence'},'acceptance':'User visual acceptance of the locked 068 color profile is retained; new interaction behavior awaits device acceptance.'},indent=2)+'\n')
    print('production payload bytes',len(payload),flush=True)


if __name__=='__main__':main()
