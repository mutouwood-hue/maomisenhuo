#!/usr/bin/env python3
"""Activate real production C machines over test-only queued virtual radio."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[2]
MAIN=ROOT/'artifacts/firmware-local-v2/source/main'
SCENARIOS=('none','one-sided','loss','disconnect','persist-failure','restart-dedup','same-counter','pending-peer')
def digest(data): return hashlib.sha256(data).hexdigest()
def canonical(value): return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fault',choices=(*SCENARIOS,'all'),default='none')
    parser.add_argument('--out',type=Path,default=ROOT/'artifacts/firmware-local-v2/virtual-peer')
    parser.add_argument('--replay',type=Path,help='Read and print saved state trace only; no machine/device writes.')
    args=parser.parse_args()
    if args.replay:
        trace=json.loads(args.replay.read_text())
        print('VIRTUAL TRACE REPLAY — no live radio/device')
        for row in trace['trace']:
            if row['kind']=='state': print(f"{row['at_ms']:>6}ms {row['endpoint']} {row['phase']:<12} confirmed={row['local_confirmed']}/{row['remote_confirmed']} saved={row['incoming_saved']} acked={row['outgoing_acked']} complete={row['complete']} new={row['incoming_new']}")
        return
    files=[Path(__file__).with_name('virtual_encounter.c'),MAIN/'local2_peer.c',MAIN/'local2_core.c']
    hashes={str(p.relative_to(ROOT)):digest(p.read_bytes()) for p in [*files,MAIN/'local2_peer.h',MAIN/'local2_core.h',Path(__file__)]}
    sources={'compiled':[str(p.relative_to(ROOT)) for p in files], 'sha256':hashes,'store_callback':'test-only atomic memory blob copied by real core commit; final bytes saved verbatim; ESP NVS driver not executed'}
    selected=SCENARIOS if args.fault=='all' else (args.fault,)
    summaries=[]
    with tempfile.TemporaryDirectory(prefix='catforest-virtual-peer-') as tmp:
        exe=Path(tmp)/'encounter'
        compiler=shutil.which('clang') or shutil.which('cc')
        subprocess.run([compiler,'-std=c11','-Wall','-Wextra','-Werror','-I',str(MAIN),*[str(p) for p in files],'-o',str(exe)],check=True)
        for fault in selected:
            out=args.out.resolve()/fault;out.mkdir(parents=True,exist_ok=True)
            result=subprocess.run([str(exe),fault,str(out)],capture_output=True,text=True)
            (out/'trace.jsonl').write_text(result.stdout)
            if result.returncode:
                (out/'failure.txt').write_text(result.stderr)
                raise SystemExit(f'{fault} FAILED: {result.stderr}')
            trace=[json.loads(line) for line in result.stdout.splitlines()]
            assert trace[-1]=={'kind':'verdict','fault':fault,'passed':True}
            endpoints={}
            for row in trace:
                if row['kind']=='state' and row['reason']=='final': endpoints.setdefault(row['endpoint'],{})['state']=row
                if row['kind']=='events':
                    ep=endpoints.setdefault(row['endpoint'],{});ep['phone_events']=row['events'];ep['event_digest_sha256']=digest(canonical(row['events']))
            for name,ep in endpoints.items():
                blob=out/f'{name}.bin';ep['blob']={'path':blob.name,'bytes':blob.stat().st_size,'sha256':digest(blob.read_bytes())}
            report={'schema':'catforest.virtual-peer.trace.v1','scenario':fault,'passed':True,'scope':'VIRTUAL: actual C peer + core; simulated radio/user buttons/atomic store; no BLE air, ESP/NVS or hardware execution','sources':sources,'endpoints':endpoints,'trace':trace}
            (out/'trace.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            summaries.append({'scenario':fault,'passed':True,'trace':str((out/'trace.json').relative_to(ROOT)) if (out/'trace.json').is_relative_to(ROOT) else str(out/'trace.json'),'sha256':digest((out/'trace.json').read_bytes()),'endpoints':{name:{'complete':ep['state']['complete'],'phone_gift_events':len(ep['phone_events']),'blob_sha256':ep['blob']['sha256'],'event_digest_sha256':ep['event_digest_sha256']} for name,ep in endpoints.items()}})
            print(f"PASS {fault}: "+', '.join(f"{name} complete={ep['state']['complete']} gift-events={len(ep['phone_events'])}" for name,ep in endpoints.items()))
    args.out.mkdir(parents=True,exist_ok=True)
    (args.out/'latest-report.json').write_text(json.dumps({'schema':'catforest.virtual-peer.report.v1','sources':sources,'scenarios':summaries,'hardware_verified':False},indent=2)+'\n')
if __name__=='__main__': main()
