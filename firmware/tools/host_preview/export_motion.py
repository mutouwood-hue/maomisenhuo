#!/usr/bin/env python3
"""Export real host C/LVGL drag/guide frames. Test fixtures, never panel captures."""
from pathlib import Path
import hashlib,json,subprocess
from PIL import Image,ImageDraw
import run_preview as preview

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    out=preview.ROOT/'artifacts/firmware-local-v3/preview/motion-v3-phase-fix'
    assert not (out/'manifest.json').exists(),'Immutable evidence already exists'
    out.mkdir(parents=True,exist_ok=True)
    binary=preview.HERE/'build-v3/badge_host_preview'
    sources=[preview.FIRMWARE/'main/badge_pages.c',preview.FIRMWARE/'main/badge_scene.c',preview.FIRMWARE/'main/badge_gesture.c',preview.HERE/'preview.c',Path(__file__)]
    hashes={str(p.relative_to(preview.ROOT)):sha(p) for p in sources}
    records=[]
    for case in ['drag_commit','drag_rebound','drag_no_target','guide_1','guide_wrong','guide_success','guide_hold','guide_4']:
        times=list(range(40,2441,100)) if case=='guide_4' else [0,30,60,90,120,150,180,200,220,260] if case.startswith('drag') else [0,100,200,300,400,500,600,800,1000,1200]
        frames=[];rows=[]
        for ms in times:
            stem=out/f'{case}-{ms:04d}'
            with stem.with_suffix('.log').open('w') as log:subprocess.run([str(binary),case,str(stem),'--elapsed-ms',str(ms)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=30)
            preview.convert(stem);meta=json.loads(stem.with_suffix('.json').read_text());assert not meta['missing_glyph_count']
            image=Image.new('RGB',(466,510),(20,20,20));image.paste(Image.open(stem.with_suffix('.png')),(0,0));draw=ImageDraw.Draw(image)
            draw.text((10,472),'OFFLINE C/LVGL FIXTURE - NOT PANEL CAPTURE',fill='white');draw.text((10,491),f'{case} +{ms} ms',fill=(220,200,160));frames.append(image)
            rows.append({'elapsedMs':ms,'png':stem.with_suffix('.png').name,'sha256':sha(stem.with_suffix('.png')),'motionInProgress':meta['motion_in_progress'],'page':meta['page_index'],'emittedCareFixtureCount':meta['mock_pet_calls']})
            assert meta['mock_pet_calls']==0,'Teaching/navigation must never manufacture care'
        dest=out/(case+'.gif');dur=[max(30,times[i+1]-t) for i,t in enumerate(times[:-1])]+[700]
        frames[0].save(dest,save_all=True,append_images=frames[1:],duration=dur,loop=0,comment=b'Actual offline C/LVGL execution; synthetic display domain; NOT hardware')
        records.append({'case':case,'frames':rows,'gif':dest.name,'gifSha256':sha(dest)})
    assert all(sha(preview.ROOT/p)==v for p,v in hashes.items())
    (out/'manifest.json').write_text(json.dumps({'offline':True,'hardwareCapture':False,'method':'Each frame executes production C with real LVGL pointer/timers; same fixture starting conditions and elapsed ticks. GIF captions are outside unmodified 466x466 capture.','sourceSha256':hashes,'binarySha256':sha(binary),'sourceUnchanged':True,'guideHoldScope':'guide_hold starts explicitly at step5 as a display fixture, then performs a real held pointer; it does not claim steps1-4 occurred in this clip. Full sequence is separately tested in input_test.','cases':records},ensure_ascii=False,indent=2)+'\n')
    print(out)
if __name__=='__main__':main()
