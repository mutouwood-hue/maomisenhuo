from pathlib import Path
import json
source=Path('work/prd-next/phone/source/original/game.html').read_text(encoding='utf-8')
anchors=['function Be(', 'function ke(', 'function openRecord(', 'if(!cur)', '打喷嚏已经好', 'function __pgG', 'beginVisit:', 'function Ae(']
result={}
for anchor in anchors:
 pos=source.find(anchor)
 result[anchor]={'offset':pos,'text':source[max(0,pos-300):pos+2300] if pos>=0 else ''}
Path('work/prd-next/experience-anchors.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
