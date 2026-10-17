"""Narrow, asserted presentation hooks around the frozen original renderer.

Original files are never edited. The room hook runs after its original pose;
world choices wait for Native's saved response before hiding their controls.
"""
from pathlib import Path


def instrument_feedback(prefix: str, output: Path) -> str:
    room_frame = 'ou(D),d.update(D),a.render(c,l)'
    assert prefix.count(room_frame) == 1, 'Review original room frame before changing presentation'
    prefix = prefix.replace(room_frame, 'ou(D),window.__catFeedbackPose?.(window.__pgRoom,pt,D),d.update(D),a.render(c,l)')
    choice = 'if(j)return;j={event:Ne,choice:M},m.event.hidden=!0;let ce=await Ve("world-choice",j);'
    assert prefix.count(choice) == 1, 'Review original world choice before changing commit gate'
    guarded = '''if(j||window.__catChoiceBusy)return;window.__catChoiceBusy=!0;
let ce;try{if(Ne==="rain"&&M==="care"){m.event.hidden=!0;let ready=await window.__catPrepareWorldChoice?.();if(!ready){m.event.hidden=!1;return}}
ce=await Ve("world-choice",{event:Ne,choice:M});
if(ce.ok!==!1){j={event:Ne,choice:M};m.event.hidden=!0}}
catch(error){ce={ok:!1,message:"选择尚未保存，请重试。"}}
finally{window.__catChoiceBusy=!1;window.__catWipePending=!1;if(!j)m.event.hidden=!1}'''
    prefix = prefix.replace(choice, guarded)
    movement = 'if(m.event.hidden&&!Te&&!Re){'
    assert prefix.count(movement) == 1, 'Review original world navigation before wipe guard'
    prefix = prefix.replace(movement, 'if(m.event.hidden&&!Te&&!Re&&!window.__catWipePending&&!window.__catEncounterPending){')
    for name in ['phone_feedback.js', 'phone_feedback.css']:
        (output / name.replace('_', '-')).write_bytes((Path(__file__).parent / name).read_bytes())
    return prefix
