"""确定性体验补丁：原型只读，既有诊疗规则不变。"""

def instrument_experience(js, once, root):
    if 'function Be(C,{steps:Y=0}={})' in js:
        feedback = (root / 'web/clinic-feedback.inc.js').read_text(encoding='utf-8')
        js = once(js, 'function Ae(){let C=se("clinic");', feedback + 'function Ae(){let C=se("clinic");', 'clinic-existing-disease-feedback-catalogue')
        js = once(js, 'U("clinic","先量体温，再完成医生的三个检查步骤。检查完成才收费。",', 'U("clinic",__hostClinicFeedback(Y,S().name,"start"),', 'clinic-start-identifies-existing-symptom')
        js = once(js, 'Ie?`${K.name}完成诊疗，打喷嚏已经好啦。`:`${K.name}完成了一次健康体检。`', '__hostClinicFeedback(Ie,K.name,"journal")', 'clinic-journal-matches-actual-disease')
        js = once(js, 'Ie?"医生开好了药，小猫恢复健康啦。":"检查结束，小猫很健康，继续一起生活吧。"', '__hostClinicFeedback(Ie,K.name,"result")', 'clinic-recovery-matches-actual-disease')
    if 'function openRecord(id)' in js:
        js = once(js, "const a=e.target.closest('[data-a]')?.dataset.a;if(!a||!cur) return;", "const a=e.target.closest('[data-a]')?.dataset.a;if(a==='close'){close();return;}if(!a||!cur) return;", 'read-only-graduate-album-close-before-live-cat-guard')
    if '/* 31-life-ui.js */' in js:
        start = js.index('function summary(day){')
        end = js.index('/* ---------- 心动轨迹 ---------- */', start)
        original_summary = js[start:end]
        assert 'const now=L.nowMin(),sum=k=>day.segs.filter' in original_summary, 'Original summary contract changed'
        js = once(js, original_summary, (root / 'web/life-summary.inc.js').read_text(encoding='utf-8'), 'life-summary-records-not-inferred-experiences')
        js = once(js, '<h4>每日总结</h4>', '<h4>今日记录摘要 <small>截至此刻 · 仅供主动查看</small></h4>', 'daily-summary-is-not-weekly-travel-review')
    return js
