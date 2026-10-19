#!/usr/bin/env python3
"""Package authored rigid GLBs as local data; no Blender/render/test execution."""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import struct


def glb(path):
    data = path.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<I', data, 4)[0] != 2:
        raise ValueError(f'Unsupported authored GLB: {path.name}')
    chunks, offset = {}, 12
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        chunks[kind] = data[offset+8:offset+8+length]
        offset += length + 8
    graph = json.loads(chunks[0x4E4F534A])
    if graph.get('skins') or graph.get('extensionsRequired'):
        raise ValueError('Only the supplied unskinned rigid assets are supported')
    return {'graph': graph, 'binary': base64.b64encode(chunks[0x004E4942]).decode(),
            'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    static = args.asset_root/'cat_growth_and_body_v2/cat-refined-v2'
    animated = args.asset_root/'cat_animation_sources_v3/cat-animated-v3'
    fitted = args.asset_root/'catforest-accessories-40-fits-v3'
    manifest = json.loads((static/'manifest.json').read_text())
    fit = json.loads((fitted/'fit_manifest.json').read_text())
    assets = {'format': 1, 'coordinateBasis': 'glTF (x,y,z) -> room (x,y,-z); meters -> 20 blocks',
              'parameters': manifest['stage_parameters'], 'palettes': manifest['palette_rgb'],
              'models': {}, 'accessories': {}, 'fits': fit}
    for key in manifest['stage_parameters']:
        assets['models'][key] = glb(animated/(key+'_animated.glb'))
        assets['accessories'][key] = {row['accessory']: glb(fitted/row['file']) for row in fit if row['stage'] == key}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('/* Generated from the authorized native asset packages; rigid GLB data only. */\n'
                          'window.CatNativeAssetData='+json.dumps(assets, separators=(',', ':'))+';\n')
    print(json.dumps({'output': str(args.output), 'bytes': args.output.stat().st_size,
                      'models': len(assets['models']), 'fittedAccessories': len(fit)}))


if __name__ == '__main__':
    main()
