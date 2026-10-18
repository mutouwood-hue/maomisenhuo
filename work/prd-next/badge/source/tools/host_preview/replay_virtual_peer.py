#!/usr/bin/env python3
"""Replay actual two-endpoint C peer/core trace into host-only C/LVGL UI.

No production fake completion switch. No radio, device, credentials or network.
The trace's state rows and final actual core event ledger drive every peer field.
The ordinary pet snapshot/BSP remain offline display fixtures, explicitly labeled.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess
from PIL import Image,ImageDraw,ImageFont
import run_preview as preview

PHASES=['disabled','discovering','hello','confirm','exchanging','wait_done','complete','blocked']
STATUSES=['ok','duplicate','invalid','not_ready','storage_error','stale','revision_conflict','pet_mismatch','owner_conflict','request_conflict','sequence_gap','queue_full','peer_full','ack_mismatch','corrupt']
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def row_line(row,endpoint):
    assert row['kind']=='state' and row['endpoint'] in ['A','B']
    receipt=None
    if row['incoming_saved']:
        receipt=next((e for e in endpoint['phone_events'] if e['kind']==2 and e['peer_counter']==row['incoming_counter'] and e['peer_id']==row['peer_id']),None)
        assert receipt is not None,'Saved gift must have a matching actual core event'
    fields=[row['at_ms'],PHASES.index(row['phase'])]
    fields+=[int(row[k]) for k in ['discoverable','connected','local_confirmed','remote_confirmed','incoming_saved','incoming_new','outgoing_acked','complete']]
    fields+=[row[k] for k in ['complete_count','incoming_counter','outgoing_counter','pending_phone_events','gift_change']]
    fields+=[STATUSES.index(row['storage_status']),row['peer_id'] or '-',row['device_id'],receipt['gift_kind'] if receipt else 0,receipt['quantity'] if receipt else 0]
    return ' '.join(map(str,fields))+'\n'

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--trace',type=Path,required=True);ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--final-only',action='store_true');args=ap.parse_args()
    trace=args.trace.resolve();out=args.output.resolve()
    assert out.is_relative_to(preview.ROOT/'artifacts/firmware-local-v3/preview')
    assert not (out/'replay-manifest.json').exists(),'Completed evidence is immutable'
    data=json.loads(trace.read_text());assert data['schema']=='catforest.virtual-peer.trace.v1' and data['passed'] is True
    for name,digest in data['sources']['sha256'].items():assert sha(preview.ROOT/name)==digest,(name,'trace source has changed')
    binary=preview.HERE/'build-v3/badge_host_preview';assert binary.exists()
    tracked=[preview.FIRMWARE/'main/badge_pages.c',preview.FIRMWARE/'main/badge_scene.c',preview.HERE/'preview.c',Path(__file__)]
    source_hashes={str(p.relative_to(preview.ROOT)):sha(p) for p in tracked}
    out.mkdir(parents=True,exist_ok=True)
    states={e:[r for r in data['trace'] if r['kind']=='state' and r['endpoint']==e] for e in ['A','B']}
    assert all(states.values())
    records=[];captures={}
    for endpoint in ['A','B']:
        rows=states[endpoint]
        indices=[len(rows)-1] if args.final_only else list(range(len(rows)))
        for index in indices:
            state=rows[index];stem=out/f'{endpoint}-{index:02d}'
            input_file=stem.with_suffix('.state');input_file.write_text(''.join(row_line(r,data['endpoints'][endpoint]) for r in rows[:index+1]))
            with stem.with_suffix('.log').open('w') as log:
                subprocess.run([str(binary),'peer_replay',str(stem),'--peer-trace',str(input_file)],check=True,timeout=30,stdout=log,stderr=subprocess.STDOUT)
            preview.convert(stem);meta=json.loads(stem.with_suffix('.json').read_text())
            assert meta['peer_trace_replay'] and not meta['missing_glyph_count']
            assert meta['peer_phase']==PHASES.index(state['phase'])
            assert meta['peer_complete_count']==state['complete_count']
            assert meta['gift_popup_visible']==bool(state['complete_count']),'No success before actual C peer completes'
            texts=[label['text'] for label in meta['labels']]
            if state['complete_count'] and not state['incoming_new']:
                assert '又见到朋友啦' in texts and not any('收到野花' in text for text in texts)
            if state['phase']=='exchanging':assert '交换中' in texts
            if state['phase']=='wait_done':assert '等待确认' in texts
            record={'endpoint':endpoint,'trace_state_index':index,'trace_state':state,'png':stem.with_suffix('.png').name,'png_sha256':sha(stem.with_suffix('.png')),'input_sha256':sha(input_file),'metadata':meta}
            records.append(record);captures[(endpoint,index)]=stem.with_suffix('.png')
    font=ImageFont.truetype(str(preview.ROOT/'firmware/managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf'),18)
    title_font=ImageFont.truetype(str(preview.ROOT/'firmware/managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf'),22)
    composites=[]
    # Trace endpoints need not have identical transition counts. Hold each endpoint's
    # latest actual row at that ordered capture step; never invent a transition.
    count=1 if args.final_only else max(len(v) for v in states.values())
    for step in range(count):
        image=Image.new('RGB',(980,600),(22,22,22));draw=ImageDraw.Draw(image)
        draw.text((12,5),'虚拟双端回放 · 真实 C peer/core 轨迹 → C/LVGL 画面',font=title_font,fill='white')
        draw.text((12,36),'无线、用户按键和存储为测试模拟；不是实物照片。猫咪基础数值为显示夹具。',font=font,fill=(210,190,150))
        times=[]
        for e,x in [('A',12),('B',502)]:
            index=len(states[e])-1 if args.final_only else min(step,len(states[e])-1)
            row=states[e][index];times.append(row['at_ms'])
            draw.text((x,64),f"{e} · {row['phase']} · 真实轨迹 {row['at_ms']} ms",font=font,fill='white')
            image.paste(Image.open(captures[(e,index)]).convert('RGB'),(x,92))
        draw.text((12,566),f"场景 {data['scenario']} · 画面放慢回放；只有真实 complete_count 增加后才呈现礼物成功。",font=font,fill=(210,210,210))
        target=out/f'dual-{step:02d}.png';image.save(target);composites.append(image)
    gif=out/'virtual-two-endpoint-replay.gif'
    composites[0].save(gif,save_all=True,append_images=composites[1:],duration=[600]*(len(composites)-1)+[1800],loop=0,comment=b'VIRTUAL peer/core trace -> actual host C/LVGL; not physical badge capture')
    unchanged=all(sha(preview.ROOT/name)==digest for name,digest in source_hashes.items());assert unchanged
    manifest={'scope':'VIRTUAL playback of actual C peer/core state trace into actual C/LVGL UI; not radio/device validation','hardware_capture':False,'trace':str(trace.relative_to(preview.ROOT)),'trace_sha256':sha(trace),'scenario':data['scenario'],'binary_sha256':sha(binary),'ui_source_sha256':source_hashes,'source_unchanged_during_replay':unchanged,'all_peer_rows_from_trace':True,'success_requires_actual_complete_count':True,'glyphs_missing':0,'captures':records,'dual_png_count':len(composites),'gif':gif.name,'gif_sha256':sha(gif)}
    (out/'replay-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'output':str(out),'endpoint_captures':len(records),'dual_frames':len(composites),'glyphs_missing':0}))
if __name__=='__main__':main()
