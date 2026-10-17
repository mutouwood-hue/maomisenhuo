#!/usr/bin/env python3
"""Rasterize exported original room triangles offline, with NumPy depth buffers.

Not a browser screenshot or a Three.js WebGL reproduction: original meshes,
linear material colors and lights; Lambert/ACES approximation with real-geometry
directional shadows. No cat, generated furniture, network or device access.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import platform
import numpy as np
import PIL
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/rendering/badge-v2/room'


def unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def view(eye, target):
    eye, target = np.array(eye, float), np.array(target, float)
    f = unit(target - eye)
    r = unit(np.cross(f, [0., 1., 0.]))
    return eye, np.stack([r, np.cross(r, f), f])


def project(vertices, eye, basis, size, fov=None, span=None):
    c = (vertices - eye) @ basis.T
    if fov:
        xy = c[:, :2] / (c[:, 2:3] * math.tan(math.radians(fov/2)))
    else:
        xy = c[:, :2] / span
    return np.column_stack([(xy[:, 0] + 1)*size/2, (1-xy[:, 1])*size/2, c[:, 2]])


def triangles(scene):
    result = []
    for mesh in scene['meshes']:
        m = np.array(mesh['matrixWorld']).reshape(4, 4, order='F')
        p = np.array(mesh['position']).reshape(-1, 3)
        p = (np.column_stack([p, np.ones(len(p))]) @ m.T)[:, :3]
        n = np.array(mesh['normal']).reshape(-1, 3) @ np.linalg.inv(m[:3, :3])
        n = unit(n)
        idx = np.array(mesh['index'] if mesh['index'] else range(len(p))).reshape(-1, 3)
        for ids in idx:
            result.append((p[ids], n[ids], mesh))
    return result


def fragments(screen, size):
    if np.min(screen[:, 2]) <= .05:
        return
    x0, y0 = np.maximum(np.floor(screen[:, :2].min(0)).astype(int), 0)
    x1, y1 = np.minimum(np.ceil(screen[:, :2].max(0)).astype(int), size-1)
    if x1 < x0 or y1 < y0:
        return
    x, y = np.meshgrid(np.arange(x0, x1+1)+.5, np.arange(y0, y1+1)+.5)
    a, b, c = screen[:, :2]
    den = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den) < 1e-8:
        return
    u = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
    v = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
    w = 1-u-v
    mask = (u >= -1e-8) & (v >= -1e-8) & (w >= -1e-8)
    if mask.any():
        yy, xx = np.nonzero(mask)
        yield yy+y0, xx+x0, np.stack([u[mask], v[mask], w[mask]], -1)


def shadow_buffer(tris, eye, target, size=768, span=40):
    eye, basis = view(eye, target)
    depth = np.full((size, size), np.inf)
    for p, normals, mat in tris:
        if not mat['castShadow'] or mat['transparent']:
            continue
        s = project(p, eye, basis, size, span=span)
        for yy, xx, bary in fragments(s, size):
            z = bary @ s[:, 2]
            depth[yy, xx] = np.minimum(depth[yy, xx], z)
    return dict(eye=eye, basis=basis, depth=depth, span=span, size=size)


def shadow_visibility(p, normals, shadow):
    size = shadow['size']
    # Original shadow normalBias=.055; software PCF uses one extra depth bias.
    s = project(p+normals*.055, shadow['eye'], shadow['basis'], size, span=shadow['span'])
    x, y = s[:, 0].astype(int), s[:, 1].astype(int)
    visible = np.zeros(len(p))
    for dy in [-1, 0, 1]:
        for dx in [-1, 0, 1]:
            xx, yy = np.clip(x+dx, 0, size-1), np.clip(y+dy, 0, size-1)
            visible += s[:, 2] <= shadow['depth'][yy, xx]+.12
    return visible/9


def srgb(linear):
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= .0031308, linear*12.92, 1.055*linear**(1/2.4)-.055)


def shade(p, n, material, lights, shadow):
    diffuse = np.zeros((len(p), 3))
    for light in lights:
        color = np.array(light['color'])*light['intensity']
        if light['type'] == 'HemisphereLight':
            weight = (n[:, 1:2]+1)*.5
            ground = np.array(light['groundColor'])*light['intensity']
            diffuse += (weight*color+(1-weight)*ground)/math.pi
        else:
            direction = unit(np.array(light['position'])-np.array(light['target'] or [0,0,0]))
            amount = np.maximum(0, n @ direction)
            if light['intensity'] == 3.1 and material['receiveShadow']:
                amount *= .3+.7*shadow_visibility(p, n, shadow)
            diffuse += amount[:, None]*color/math.pi
    c = np.broadcast_to(np.array(material['color']), diffuse.shape).copy() if material.get('materialType') == 'MeshBasicMaterial' else np.array(material['color'])*diffuse
    c += np.array(material.get('emissive') or [0,0,0])*material['emissiveIntensity']
    c *= 1.22
    # Standard fitted ACES curve; explicit approximation, not exact WebGL PBR.
    return srgb(np.clip((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14), 0, 1))


def render(scene, tris, camera, size, shadow):
    eye, basis = view(camera['position'], camera['target'])
    rgb = np.empty((size, size, 3)); rgb[:] = srgb(np.array(scene['background']))
    depth = np.full((size, size), np.inf)
    opaque = [t for t in tris if not t[2]['transparent']]
    transparent = sorted([t for t in tris if t[2]['transparent']],
                         key=lambda t: -np.linalg.norm(t[0].mean(0)-eye))
    for p, normals, mat in opaque+transparent:
        if mat['side'] == 0 and np.dot(np.cross(p[1]-p[0], p[2]-p[0]), eye-p.mean(0)) <= 0:
            continue
        s = project(p, eye, basis, size, fov=camera['fov'])
        for yy, xx, bary in fragments(s, size):
            corrected = bary/s[:, 2]; corrected /= corrected.sum(1)[:, None]
            z = 1/(bary/s[:, 2]).sum(1)
            hit = z < depth[yy, xx]-1e-7
            yy, xx, z, corrected = yy[hit], xx[hit], z[hit], corrected[hit]
            if not len(yy):
                continue
            color = shade(corrected @ p, unit(corrected @ normals), mat, scene['lights'], shadow)
            alpha = mat['opacity'] if mat['transparent'] else 1.
            rgb[yy, xx] = color*alpha+rgb[yy, xx]*(1-alpha)
            if mat['depthWrite']:
                depth[yy, xx] = z
    return Image.fromarray(np.uint8(np.clip(rgb*255+.5, 0, 255)), 'RGB')


CAMERAS = [
    dict(name='a-original-three-quarter', position=[31,30,-47], target=[0,11,1], fov=48),
    dict(name='b-front-room', position=[8,27,-47], target=[0,11,1.5], fov=52),
    dict(name='c-close-three-quarter', position=[28,25,-42], target=[0,10,1], fov=52),
]


def export_raw(image, filename):
    a = np.array(image.convert('RGB'), dtype=np.uint16)
    ((a[:,:,0]>>3)<<11 | (a[:,:,1]>>2)<<5 | (a[:,:,2]>>3)).astype('<u2').tofile(filename)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--select', choices=[c['name'] for c in CAMERAS], default=None)
    args = ap.parse_args()
    scene = json.loads((OUT/'original-room-scene.json').read_text())
    tris = triangles(scene)
    key = next(x for x in scene['lights'] if x['intensity'] == 3.1)
    shadow = shadow_buffer(tris, key['position'], key['target'])
    records = []
    for camera in CAMERAS:
        name = camera['name']
        full = render(scene, tris, camera, 932, shadow)
        full.save(OUT/f'{name}-full.png')
        small = full.resize((233,233), Image.Resampling.LANCZOS)
        small.save(OUT/f'{name}-233.png')
        export_raw(small, OUT/f'{name}-233-rgb565le.raw')
        preview = full.resize((466,466), Image.Resampling.LANCZOS)
        yy, xx = np.mgrid[:466,:466]
        a = np.array(preview); a[(xx-232.5)**2+(yy-232.5)**2 > 232.5**2] = [18,23,24]
        preview = Image.fromarray(a)
        ImageDraw.Draw(preview).text((153,447), 'OFFLINE PREVIEW', fill=(255,255,255))
        preview.save(OUT/f'{name}-466-circle-preview.png')
        eye, basis = view(camera['position'], camera['target'])
        feet = project(np.array([scene['anchors']['home']]), eye, basis, 466, fov=camera['fov'])[0]
        records.append(dict(**camera, projectedOriginalHomeFeet466=feet[:2].round(2).tolist(),
                            proposedSpriteBox466=[137,142,192,208],
                            images=[f'{name}-233.png',f'{name}-466-circle-preview.png',f'{name}-full.png']))
        if args.select == name:
            small.save(OUT/'room.png'); export_raw(small, OUT/'room-rgb565le.raw')
    provenance=dict(source=scene['source'],counts=scene['counts'],noCat=True,
      status='Optional future room background; not part of current original badge black home-screen restoration; not registered into firmware',
      tools={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),Path(__file__).with_suffix('.mjs')]},
      runtime=dict(python=platform.python_version(),numpy=np.__version__,pillow=PIL.__version__),
      geometrySha256=hashlib.sha256((OUT/'original-room-scene.json').read_bytes()).hexdigest(),
      renderer='Offline NumPy perspective-correct barycentric z-buffer, normal matrices, front-face culling, alpha blend, 3x3 PCF directional depth map; Lambert/pi + fitted ACES/exposure1.22, sRGB output',
      limitations=['Not a browser screenshot or exact Three MeshStandard PBR match; no specular reflections, WebGL PCSS, environment maps or runtime effects',
                   '233px image is opaque RGB; circle previews are labeled non-device and intentionally mask the square outside the physical round screen',
                   'No cat/shadow of cat; animated cat must be composited separately; proposed sprite rectangle is metadata only, not painted into background'],
      cameras=records,originalCamera=scene['originalCamera'],lights=scene['lights'],selected=args.select,
      artifacts={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                 for p in OUT.glob('*') if p.suffix in ['.png','.raw']})
    (OUT/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(cameras=records,selected=args.select),ensure_ascii=False))


if __name__ == '__main__':
    main()
