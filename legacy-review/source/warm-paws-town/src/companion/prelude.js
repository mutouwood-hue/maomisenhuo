// 真实provider在原作脚本之后接线，先关闭旧演示授权与匿名上报，避免旧本机设置启动采集。
(() => {
  const raw = localStorage.getItem('pg-life-cfg');
  let cfg = {}; if (raw) try { cfg = JSON.parse(raw); } catch { localStorage.setItem('companion-legacy-cfg-backup', raw); }
  localStorage.setItem('pg-life-cfg', JSON.stringify({ ...cfg, sync:false,geo:false,motion:false,voice:false,scene:false,demo:false,keepDays:7 }));
  localStorage.removeItem('pg_bk_key');sessionStorage.removeItem('pg_bk_key');
  localStorage.removeItem('pet-ana-endpoint');
  const url = new URL(location.href); if (url.searchParams.has('ep')) { url.searchParams.delete('ep'); history.replaceState(history.state,'',url); }
  const samples = localStorage.getItem('pg-life-geo');
  if (samples) try { localStorage.setItem('pg-life-geo', JSON.stringify(JSON.parse(samples).filter(s => s.t >= Date.now() - 7 * 86400000))); } catch { localStorage.removeItem('pg-life-geo'); }
})();
