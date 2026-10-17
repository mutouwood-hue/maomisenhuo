#!/usr/bin/env python3
"""Read-only independent audit of owner-frozen frames, not a new render/build."""
from pathlib import Path
import json,hashlib,math,re
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
BASE=ROOT/'artifacts/firmware-local-v3/preview/accepted-ui-v3';m=json.loads((BASE/'manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def radius(a):return max(math.hypot(x-233,y-233) for x in [a[0],a[2]] for y in [a[1],a[3]])
errors=[];counts={'images':0,'logicalTargets':0,'enabledVisualControls':0,'stableLabels':0,'toasts':0};toast_values=[]
source=(ROOT/'artifacts/firmware-local-v3/source/main/badge_pages.c').read_text()
messages=sorted(set(t for call in re.findall(r'announce\((.*?)\);',source) for t in re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"',call)))
for c in m['cases']:
 counts['images']+=1
 if sha(BASE/c['png'])!=c['png_sha256']:errors.append(c['case']+' PNG mismatch')
 for t in c['hit_targets']:
  if t['shape']==2:continue
  counts['logicalTargets']+=1;x,y=t['center'];w,h=t['size'];r=math.hypot(x-233,y-233)+w if t['shape']==1 else radius([x-w//2,y-h//2,x+w//2,y+h//2])
  if r>212:errors.append(c['case']+' unsafe logical '+t['name'])
 for t in c['visual_controls']:
  if t['enabled']:
   counts['enabledVisualControls']+=1
   if radius(t['bounds'])>212:errors.append(c['case']+' unsafe visual '+str(t['bounds']))
 for t in c['labels']:
  if t['text'] and not c['motion_in_progress']:
   counts['stableLabels']+=1
   if radius(t['bounds'])>212:errors.append(c['case']+' unsafe label '+t['text'])
 if c['missing_glyph_count']:errors.append(c['case']+' missing glyph')
 if c['case'].startswith('toast_'):
  i=int(c['case'].split('_')[1]);labels=[t for t in c['labels'] if t['bounds']==[143,44,322,83]]
  if len(labels)!=1 or labels[0]['text']!=messages[i]:errors.append(c['case']+' toast not exact source text')
  else:toast_values.append(labels[0]['text'])
  counts['toasts']+=1
assert counts['images']==76 and counts['toasts']==25
for p,h in m['source_sha256'].items():
 if sha(ROOT/p)!=h:errors.append('source changed '+p)
report={'kind':'independent_recalculation_of_owner_outputs_not_new_render','counts':counts,'errors':errors,'toastSourceLiteralExactMatches':toast_values,'sourceMatchesAcceptedManifest':not any(x.startswith('source changed') for x in errors),'manifestSha256':sha(BASE/'manifest.json'),'independentReportSha256':sha(HERE/'independent-report.json'),'auditScriptSha256':sha(Path(__file__))}
(HERE/'accepted-artifact-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'counts':counts,'errors':errors},ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
