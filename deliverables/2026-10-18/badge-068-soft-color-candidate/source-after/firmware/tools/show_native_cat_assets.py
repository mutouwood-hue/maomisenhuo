#!/usr/bin/env python3
"""Display stored production pixels as contact sheets for human selection.

Reads existing generated C/RLE resources only. Does not run the renderer,
firmware, animation logic, or any acceptance/diagnostic operation.
"""
from pathlib import Path
import argparse
import json
import re
import struct
import zlib
from PIL import Image, ImageDraw, ImageFont


class StoredFrames:
    def __init__(self, folder):
        source = (folder / 'native_cat_data.c').read_text()
        data = source.split('badge_native_cat_data[]={', 1)[1].split('};', 1)[0]
        self.data = bytes(int(x) for x in re.findall(r'\d+', data))
        table = source.split('badge_native_cat_offsets[5][5][66]=', 1)[1].split(';', 1)[0]
        self.offsets = json.loads(table.replace('{', '[').replace('}', ']'))

    def layer(self, shape, outfit, frame):
        offset = self.offsets[shape][outfit][frame]
        decoded, size = struct.unpack_from('<II', self.data, offset)
        raw = zlib.decompress(self.data[offset + 8:offset + 8 + size])
        count, runs = struct.unpack_from('<HI', raw)
        palette = []
        for i in range(count):
            color = struct.unpack_from('<I', raw, 6 + i * 6)[0]
            palette.append(bytes([(color >> 16) & 255, (color >> 8) & 255, color & 255, color >> 24]))
        pixels = bytearray()
        start = 6 + count * 6
        for i in range(start, start + runs, 3):
            length, index = struct.unpack_from('<HB', raw, i)
            pixels.extend(palette[index] * length)
        return Image.frombytes('RGBA', (192, 208), bytes(pixels))

    def worn(self, shape, frame):
        return Image.alpha_composite(self.layer(shape, 0, frame), self.layer(shape, 1, frame))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', type=Path, required=True)
    parser.add_argument('--after', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--before-version', default='066')
    parser.add_argument('--after-version', default='067')
    parser.add_argument('--candidate-caption', default='线性光照 + ACES / 曝光1.22')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    before, after = StoredFrames(args.before), StoredFrames(args.after)
    font = ImageFont.truetype('/Library/Fonts/Arial Unicode.ttf', 22)
    small = ImageFont.truetype('/Library/Fonts/Arial Unicode.ttf', 18)
    for name, rows in [
        ('comparison-growth', [(i, 0, title) for i, title in enumerate(['幼猫', '少年猫', '成年·纤细', '成年·标准', '成年·圆润'])]),
        ('comparison-adult-poses', [(3, 0, '待机·首帧'), (3, 26, '抬爪·第7帧'), (3, 48, '行走·第5帧')])
    ]:
        sheet = Image.new('RGB', (920, 142 + len(rows) * 466), '#edf0f2')
        draw = ImageDraw.Draw(sheet)
        draw.text((24, 15), '生产素材对照 / 口水巾 / 原始帧 2×最近邻展示', font=font, fill='#25313b')
        draw.text((24, 47), '仅供用户肉眼选择候选规则；不是手机或吧唧屏幕截图。', font=small, fill='#46525d')
        draw.text((24, 82), '上一版：' + args.before_version, font=small, fill='#25313b')
        draw.text((476, 82), '候选：' + args.after_version + ' / ' + args.candidate_caption, font=small, fill='#25313b')
        for row, (shape, frame, label) in enumerate(rows):
            y = 130 + row * 466
            draw.text((24, y), label, font=font, fill='#25313b')
            for column, (title, stored) in enumerate([('before' + args.before_version, before), ('candidate' + args.after_version, after)]):
                image = stored.worn(shape, frame)
                filename = f'{title}-shape{shape}-frame{frame}-bandana.png'
                image.save(args.output / filename)
                sheet.paste(image.resize((384, 416), Image.Resampling.NEAREST), (34 + column * 452, y + 33),
                            image.resize((384, 416), Image.Resampling.NEAREST))
        sheet.save(args.output / (name + '.png'))
    (args.output / 'README.md').write_text(
        '# 生产素材展示\n\n'
        '左右分别来自已部署' + args.before_version + '的资源和' + args.after_version + '候选资源；读取现有压缩资源并导出静态像素，'
        '不执行应用、固件、动画或交互。固定中性底色，2倍最近邻展示，无照片调色或锐化。'
        '随附PNG是192×208原始透明生产帧，按原生产遮挡层叠加口水巾。'
        '这不是两端截图，也不证明实机一致性；最终观感由用户决定。\n')
    print('Stored production frames displayed in', args.output)


if __name__ == '__main__':
    main()
