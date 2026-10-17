"""Execute real world bridge JS with controlled clock/native response, no renderer/device."""
import ast
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
NODE_PROBE = r'''
const vm=require('node:vm');
let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',async()=>{
 const {source,mode}=JSON.parse(input);
 let onEvent;const timers=new Map(),requests=[];let nextTimer=0;
 const error={hidden:false,textContent:''},panel={hidden:false};
 const context={console,Promise,Map,Number,String,JSON,
  // Optional presentation is inert here; this test still executes the real
  // bridge and retains its original late-response/cancellation assertions.
  window:{__pgWorld:{ev:panel},CatFeedback:{create(){return {frame(){},applyState(){},feedback(){return true},clearFeedback(){},pause(){}}}},
   CatNative:{worldReady(){},worldProgress(){},worldEvent(id,event){requests.push({id,event})}}},
  document:{getElementById(){return error},body:{dataset:{}}},
  setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id},
  clearTimeout(id){timers.delete(id)},
  Mf(options){onEvent=options.onEvent;return Promise.resolve({setAppearance(){},setStage(){},setActive(){},state(){return{token:'native-token'}},enter(){},requestSettle(){}})}
 };
 vm.runInNewContext('(()=>{'+source,context,{timeout:1000});
 await Promise.resolve();await Promise.resolve();
 if(mode.startsWith('encounter')){
  context.window.__pgWorldEvt('rain');const id=requests[0].id;
  const before={hidden:panel.hidden,pending:context.window.__catEncounterPending,timers:timers.size};
  if(mode==='encounter-late'){
   context.window.CatWorld.resolve(id,{ok:true});await Promise.resolve();await Promise.resolve();
   const delays=[...timers.values()].map(t=>t.delay);
   for(const timer of [...timers.values()])timer.fn();
   console.log(JSON.stringify({before,delays,hidden:panel.hidden,pending:context.window.__catEncounterPending}));
  }else{
   let lateCallback=null;
   if(mode==='encounter-timer-stop'){
    context.window.CatWorld.resolve(id,{ok:true});await Promise.resolve();await Promise.resolve();
    lateCallback=[...timers.values()][0].fn;
   }
   context.window.CatWorld.stop();await Promise.resolve();await Promise.resolve();
   const lateAccepted=context.window.CatWorld.resolve(id,{ok:true});
   if(lateCallback)lateCallback();
   console.log(JSON.stringify({before,lateAccepted,hidden:panel.hidden,pending:context.window.__catEncounterPending,timers:timers.size}));
  }
  return;
 }
 let settled=false;
 const pending=onEvent({type:'world-node',token:'native-token',nodeId:'walk-1'}).then(value=>{settled=true;return value});
 const id=requests[0].id;
 if(mode==='late'){
  // Simulate a 20s native disk delay without waiting or creating a real timer.
  for(const [key,timer] of [...timers])if(timer.delay<=20000){timers.delete(key);timer.fn()}
  await Promise.resolve();await Promise.resolve();
  const settledBeforeNative=settled;
  const accepted=context.window.CatWorld.resolve(id,{ok:true,message:'native committed',collected:1});
  const response=await pending;
  const acceptedTwice=context.window.CatWorld.resolve(id,{ok:true});
  console.log(JSON.stringify({settledBeforeNative,accepted,acceptedTwice,response}));
 }else{
  context.window.CatWorld.stop();
  const response=await pending;
  const acceptedAfterStop=context.window.CatWorld.resolve(id,{ok:true});
  console.log(JSON.stringify({response,acceptedAfterStop}));
 }
});
'''


class WorldResponseTests(unittest.TestCase):
    def sources(self):
        parsed = ast.parse((ROOT / "scripts/prepare_life_assets.py").read_text())
        worlds = [node.value.value for node in ast.walk(parsed)
                  if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant)
                  and isinstance(node.value.value, str)
                  and any(isinstance(target, ast.Name) and target.id == "world" for target in node.targets)]
        self.assertEqual(len(worlds), 1)
        generator = worlds[0]
        generated = (ROOT / "app/android/app/src/main/assets/world-core.js").read_text()
        self.assertTrue(generated.endswith(generator), "APK world bridge must match its reproducible generator")
        return {"generator": generator, "generated": generated[-len(generator):]}

    def probe(self, source, mode):
        node = shutil.which("node")
        if not node:
            self.skipTest("existing Node.js unavailable; no runtime downloaded")
        run = subprocess.run([node, "-e", NODE_PROBE], input=json.dumps({"source": source, "mode": mode}),
                             text=True, capture_output=True, check=True, timeout=10)
        return json.loads(run.stdout.strip())

    def test_native_response_after_twenty_seconds_is_not_replaced_by_failure(self):
        for name, source in self.sources().items():
            with self.subTest(source=name):
                result = self.probe(source, "late")
                print("WORLD_LATE_RESPONSE", name, json.dumps(result, sort_keys=True), flush=True)
                self.assertFalse(result["settledBeforeNative"])
                self.assertTrue(result["accepted"])
                self.assertTrue(result["response"]["ok"])
                self.assertEqual(result["response"]["collected"], 1)
                self.assertFalse(result["acceptedTwice"])

    def test_explicit_stop_cancels_pending_request_and_ignores_stale_response(self):
        for name, source in self.sources().items():
            with self.subTest(source=name):
                result = self.probe(source, "stop")
                self.assertFalse(result["response"]["ok"])
                self.assertFalse(result["acceptedAfterStop"])

    def test_encounter_panel_waits_for_native_then_full_reaction_interval(self):
        for name, source in self.sources().items():
            with self.subTest(source=name):
                result = self.probe(source, "encounter-late")
                self.assertEqual(result["before"], {"hidden": True, "pending": True, "timers": 0})
                self.assertEqual(result["delays"], [2200])
                self.assertFalse(result["hidden"])
                self.assertFalse(result["pending"])

    def test_stop_prevents_late_encounter_response_and_timer_from_reopening_panel(self):
        for name, source in self.sources().items():
            for mode in ("encounter-rpc-stop", "encounter-timer-stop"):
                with self.subTest(source=name, mode=mode):
                    result = self.probe(source, mode)
                    self.assertFalse(result["lateAccepted"])
                    self.assertTrue(result["hidden"])
                    self.assertFalse(result["pending"])
                    self.assertEqual(result["timers"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
