"""Reuse the original daily badge page; presentation/navigation changes only."""
def instrument_device_page(js, once):
    if 'function badge(){' not in js or "let tab='today'" not in js:
        return js
    js=once(js,"['badge','吧唧'],['privacy','授权与隐私']","['badge','吧唧']",'one-badge-page-owns-privacy-navigation')
    js=once(js,"function open(t='today'){tab=t;ov.classList.add('on');render();track('life_open',{tab:t,demo:L.cfg.demo,sync:L.cfg.sync})}","function open(t='today'){const privacy=t==='privacy';tab=privacy?'badge':t;ov.classList.add('on');render();if(privacy){const node=$('lf-badge-privacy');if(node)node.open=true}track('life_open',{tab,demo:L.cfg.demo,sync:L.cfg.sync})}",'privacy-deep-links-still-open-existing-controls')
    js=once(js,"function stopBadge(){cancelAnimationFrame(braf);braf=0}","function stopBadge(){cancelAnimationFrame(braf);braf=0}\nL.hostBadgeState=connected=>{const preview=$('lf-body')?.querySelector('.lf-badge');if(preview)preview.hidden=!connected;if(connected){if(!braf)startBadge()}else stopBadge()};",'badge-preview-only-after-current-session-handshake')
    js=once(js,'return `<section class="lf-sec lf-badge">','return `<section class="lf-sec" id="lf-badge-connection"></section><section class="lf-sec lf-badge" hidden>','mount-connection-in-existing-daily-badge-page')
    js=once(js,"  ${L.env?.badgeHtml?.()||''}`;","  ${L.env?.badgeHtml?.()||''}<details class=\"lf-badge-privacy\" id=\"lf-badge-privacy\"><summary>隐私与授权</summary>${privacy()}</details>`;",'reuse-original-privacy-controls-inside-badge')
    js=once(js,"if(tab==='badge')startBadge();","if(tab==='badge')window.CatOfflineSceneSync?.mountBadgePage();",'reuse-live-device-panel-instead-of-second-dialog')
    js=once(js,"  ov.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));","  ov.querySelector('.lf-head b').textContent=tab==='badge'?'我的吧唧':'今日生活';$('lf-mode').hidden=tab==='badge';\n  ov.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));",'badge-title-without-demo-connection-claim')
    return js
