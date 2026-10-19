#!/usr/bin/env python3
"""Compile the supplied SVG's three 22px icons to native LVGL RGB565A8.

Asset compilation only; no firmware execution, screenshots or UI simulation.
The SVG is authoritative. No preview percentages are read into game values.
"""
from pathlib import Path
import math
import re
import hashlib
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / '.reference/060-status-elements.svg'
TARGET = ROOT / 'firmware/main/assets/status_icons_060.inc'
SCALE = 8


def outline(data):
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)', data)
    index = 0
    command = None
    point = start = (0.0, 0.0)
    points = []

    def take(count):
        nonlocal index
        result = list(map(float, tokens[index:index + count]))
        index += count
        return result

    while index < len(tokens):
        if tokens[index].isalpha():
            command = tokens[index]
            index += 1
        if command == 'Z':
            points.append(start)
            point = start
            command = None
            continue
        if command == 'M':
            point = tuple(take(2))
            start = point
            points.append(point)
            command = 'L'
        elif command == 'L':
            point = tuple(take(2))
            points.append(point)
        elif command == 'H':
            point = (take(1)[0], point[1])
            points.append(point)
        elif command == 'V':
            point = (point[0], take(1)[0])
            points.append(point)
        elif command in ('Q', 'C'):
            old = point
            values = take(4 if command == 'Q' else 6)
            control = [tuple(values[i:i + 2]) for i in range(0, len(values), 2)]
            for step in range(1, 25):
                t = step / 24
                u = 1 - t
                if command == 'Q':
                    points.append(tuple(u*u*old[j]+2*u*t*control[0][j]+t*t*control[1][j] for j in (0, 1)))
                else:
                    points.append(tuple(u**3*old[j]+3*u*u*t*control[0][j]+3*u*t*t*control[1][j]+t**3*control[2][j] for j in (0, 1)))
            point = control[-1]
        elif command == 'A':
            rx, ry, rotation, large, sweep, x, y = take(7)
            if rx != ry or rotation != 0:
                raise ValueError('This supplied icon compiler accepts circular unrotated SVG arcs only')
            end = (x, y)
            dx, dy = x-point[0], y-point[1]
            chord = math.hypot(dx, dy)
            height = math.sqrt(rx*rx-chord*chord/4)
            middle = ((x+point[0])/2, (y+point[1])/2)
            for sign in (1, -1):
                center = (middle[0]-sign*dy*height/chord, middle[1]+sign*dx*height/chord)
                angle = math.atan2(point[1]-center[1], point[0]-center[0])
                end_angle = math.atan2(y-center[1], x-center[0])
                delta = (end_angle-angle) % (2*math.pi) if sweep else -((angle-end_angle) % (2*math.pi))
                if (abs(delta) > math.pi) == bool(large):
                    break
            steps = max(16, math.ceil(abs(delta)*24))
            points.extend((center[0]+rx*math.cos(angle+delta*i/steps), center[1]+ry*math.sin(angle+delta*i/steps)) for i in range(1, steps+1))
            point = end
        else:
            raise ValueError('Unexpected SVG path command '+str(command))
    return [(round(x*SCALE), round(y*SCALE)) for x, y in points]


tree = ET.fromstring(SOURCE.read_bytes())
lines = ['/* Generated from the user-supplied SVG, SHA256 '+hashlib.sha256(SOURCE.read_bytes()).hexdigest()+'.',
         ' * Native 22x22 HUD icons only; no example fill percentages or game values. */']
for semantic in ('satiety', 'mood', 'energy'):
    group = next(g for g in tree.iter() if g.get('id') == semantic+'-icon')
    image = Image.new('RGBA', (22*SCALE, 22*SCALE))
    draw = ImageDraw.Draw(image)
    for path in group:
        points = outline(path.get('d'))
        fill = path.get('fill', group.get('fill'))
        if fill and fill != 'none':
            draw.polygon(points, fill=fill)
        stroke = path.get('stroke')
        if stroke and stroke != 'none':
            width = round(float(path.get('stroke-width', 1))*SCALE)
            draw.line(points, fill=stroke, width=width, joint='curve')
            if path.get('stroke-linecap') == 'round':
                for x, y in (points[0], points[-1]):
                    r = width/2
                    draw.ellipse((x-r, y-r, x+r, y+r), fill=stroke)
    image = image.resize((22, 22), Image.Resampling.LANCZOS)
    color, alpha = bytearray(), bytearray()
    for r, g, b, a in image.getdata():
        rgb = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
        color += rgb.to_bytes(2, 'little')
        alpha.append(a)
    data = color+alpha
    symbol = 'status_'+semantic+'_060'
    lines.append('static const uint8_t '+symbol+'_pixels[] = {')
    lines.extend('    '+','.join('0x%02x' % b for b in data[i:i+24])+',' for i in range(0, len(data), 24))
    lines.append('};')
    lines.append('static const lv_image_dsc_t '+symbol+' = {.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_RGB565A8,.w=22,.h=22,.stride=44},.data_size=1452,.data='+symbol+'_pixels};')
TARGET.write_text('\n'.join(lines)+'\n')
print('Compiled supplied SVG icons:', TARGET, 'RGBA-compatible RGB565A8; 3 x 22 x 22')
