from pathlib import Path
import re, zipfile, json
root=Path(__file__).resolve().parents[1]
archive=root/'artifacts/firmware-visual-delivery053/deliverables/cat-forest-badge-0.5.3-day-startup-source.zip'
with zipfile.ZipFile(archive) as z:
    print('ZIP entries:',len(z.namelist()),'managed entries:',sum('managed_components/' in n for n in z.namelist()))
source=root/'work/prd-next/badge/source'
text=(source/'CMakeLists.txt').read_text(encoding='utf-8')
checks=re.findall(r'set\(local2_dir[^\n]*?/managed_components/([^"\n]+)"\).*?if\(NOT local2_hash STREQUAL "([^"\n]+)"\)',text,re.S)
results=[]
for name,expected in checks:
    marker=Path('D:/黑客松/managed_components')/name/'.component_hash'
    actual=marker.read_text(encoding='utf-8').strip() if marker.exists() else None
    results.append(dict(component=name,expected=expected,actual=actual,match=actual==expected))
print(json.dumps(results,ensure_ascii=False,indent=2))
(root/'work/prd-next/dependency-boundary.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
