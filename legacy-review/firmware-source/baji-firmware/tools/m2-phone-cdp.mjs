// Real connected Android WebView CDP; no browser/hardware substitutes.
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = (Array.isArray(list) ? list : list.value).find(p => p.type === 'page' && p.url === 'https://localhost/');
if (!page) throw Error('Real phone WebView not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
try {
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('CDP timed out')), 15000);
    socket.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.id === 1) { clearTimeout(timer); resolve(msg); } });
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.env.M2_PHONE_EXPRESSION || "({title:document.title,ready:!!window.__petGame?.state()?.ready,companion:!!window.__companion,body:document.body.innerText.slice(-3500)})", returnByValue: true, awaitPromise: true } }));
  });
  if (result.error || result.result.exceptionDetails) throw Error(JSON.stringify(result.error || result.result.exceptionDetails));
  console.log(JSON.stringify(result.result.result.value, null, 2));
} finally { socket.close(); }
