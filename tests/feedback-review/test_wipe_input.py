"""Execute production wipe input with a tiny DOM; no browser/touch/Android claim."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
PROBE = r"""
const vm=require('node:vm');let input='';
process.stdin.on('data',x=>input+=x);process.stdin.on('end',async()=>{
 const {source,mode}=JSON.parse(input);let now=0;
 class El{
  constructor(){this.children=[];this.dataset={};this.listeners={};this.properties={};
   this.style={setProperty:(k,v)=>this.properties[k]=v,getPropertyValue:k=>this.properties[k]||''};}
  appendChild(e){this.children.push(e)}
  addEventListener(k,fn){this.listeners[k]=fn}
  querySelectorAll(){return this.children}
  getBoundingClientRect(){return {left:0,top:0,width:400,height:500}}
  setAttribute(){}setPointerCapture(){}remove(){}
 }
 const root=new El(),window={matchMedia:()=>({matches:false})};
 vm.runInNewContext(source,{window,document:{createElement:()=>new El()},performance:{now:()=>now},console});
 const fx=window.CatFeedback.create(root,'world');
 fx.applyState({petId:'pet',revision:1,wet:true});
 class Vec{
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
  clone(){return new Vec(this.x,this.y,this.z)}
  copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this}
 }
 const position=new Vec(),cat={position:new Vec()},head={rotation:{x:0,y:0,z:0},getWorldPosition:v=>v.copy(position)};
 const body={rotation:{x:0,y:0,z:0}},bones=new Map([['head',head],['body',body]]);
 const model={root:{position,updateMatrixWorld(){}},bones};
 // Execute the production frame to obtain the ROI/visibility; never inject
 // private catVisible or rely on its former default screen coordinates.
 fx.frame({model,cat,proj:()=>({x:.5,y:.48,visible:mode!=='invisible'})},.25,false);
 const layer=root.children[0],target=layer.children.find(e=>e.className==='cat-feedback-wipe-target');
 let settled=false;const pending=fx.beginWipe().then(x=>{settled=true;return x});
 const event=(x,trusted=true)=>({clientX:x,clientY:240,pointerId:1,isTrusted:trusted,preventDefault(){}});
 target.listeners.pointerdown(event(200,false));
 now=2000;target.listeners.pointermove(event(240,false));
 await Promise.resolve();const forgedSettled=settled;
 now=0;target.listeners.pointerdown(event(200));
 now=100;target.listeners.pointermove(event(240));
 now=200;target.listeners.pointermove(event(200));
 if(mode==='invisible'){
  now=900;target.listeners.pointermove(event(240));
  console.log(JSON.stringify({forgedSettled,result:await pending,state:fx.state()}));
 }else if(mode==='complete'){
  await Promise.resolve();const early=settled;
  now=900;target.listeners.pointermove(event(240));
  console.log(JSON.stringify({forgedSettled,early,result:await pending,state:fx.state()}));
 }else{
  fx.pause();now=2000;target.listeners.pointermove(event(240));
  console.log(JSON.stringify({forgedSettled,result:await pending,state:fx.state()}));
 }
});
"""


class WipeInputTests(unittest.TestCase):
    def probe(self, mode):
        node = shutil.which('node')
        if not node:
            self.skipTest('existing Node.js unavailable')
        source = (ROOT / 'scripts/phone_feedback.js').read_text()
        generated = (ROOT / 'app/android/app/src/main/assets/phone-feedback.js').read_text()
        self.assertEqual(source, generated, 'generated feedback must match source')
        result = subprocess.run([node, '-e', PROBE], input=json.dumps({'source': source, 'mode': mode}),
                                text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_input_threshold_does_not_itself_dry_or_reward(self):
        actual = self.probe('complete')
        self.assertFalse(actual['forgedSettled'])
        self.assertFalse(actual['early'])
        self.assertTrue(actual['result'])
        self.assertTrue(actual['state']['wet'])  # only Native's later commit may dry
        self.assertFalse(actual['state']['wiping'])

    def test_pause_cancels_partial_wipe_and_late_input(self):
        actual = self.probe('cancel')
        self.assertFalse(actual['forgedSettled'])
        self.assertFalse(actual['result'])
        self.assertTrue(actual['state']['wet'])
        self.assertFalse(actual['state']['active'])
        self.assertFalse(actual['state']['wiping'])

    def test_invisible_frame_cannot_start_or_finish_wipe(self):
        actual = self.probe('invisible')
        self.assertFalse(actual['result'])
        self.assertTrue(actual['state']['wet'])
        self.assertFalse(actual['state']['wiping'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
