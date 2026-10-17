export class ApiError extends Error {
  constructor(message, { status = 0, code = 0, data = null } = {}) { super(message); this.name = 'ApiError'; Object.assign(this, { status, code, data }); }
}
/** endpoint 是运行时用户配置，不随制品编译、不默认使用开发机 localhost。 */
export class ApiClient {
  constructor({ getEndpoint, getToken = () => null, fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = 10000 }) { Object.assign(this, { getEndpoint, getToken, fetchImpl, timeoutMs }); }
  async binary(path, { signal, maxBytes } = {}) {
    const endpoint=this.getEndpoint(); if(!endpoint)throw new ApiError('尚未配置后台地址。');
    const base=new URL(endpoint),url=new URL(path,base);
    if(!['http:','https:'].includes(base.protocol)||base.username||base.password||url.origin!==base.origin||!url.pathname.startsWith('/api/ota-artifacts/'))throw new ApiError('更新制品必须来自已配置后台的受限路径。');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8*1024*1024)throw new ApiError('更新制品大小超出预算。');
    const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,60000),token=this.getToken();
    try {
      const response=await this.fetchImpl(url,{headers:{Accept:'application/octet-stream',...(token?{Authorization:`Bearer ${token}`}:{})},signal:controller.signal,redirect:'error'});
      if(!response.ok)throw new ApiError('更新制品下载失败。',{status:response.status});
      if(Number(response.headers.get('content-length'))>maxBytes)throw new ApiError('制品长度超过已签名大小。');
      const reader=response.body?.getReader();if(!reader)throw new ApiError('当前环境不支持受限流式下载。');
      const chunks=[];let length=0;
      try { while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes)throw new ApiError('制品超过已签名大小。');chunks.push(value);} }finally{await reader.cancel();}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async request(path, { method = 'GET', body, signal, idempotencyKey } = {}) {
    const endpoint = this.getEndpoint();
    if (!endpoint) throw new ApiError('尚未配置后台地址。');
    const base = new URL(endpoint);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new ApiError('后台地址必须是无凭据的 HTTP(S) 地址。');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, this.timeoutMs);
    const headers = { Accept: 'application/json' };
    const token = this.getToken(); if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!['GET', 'DELETE'].includes(method)) headers['Idempotency-Key'] = idempotencyKey ?? crypto.randomUUID();
    try {
      const response = await this.fetchImpl(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      let envelope;
      try { envelope = await response.json(); } catch { throw new ApiError('后台返回了无效响应。', { status: response.status }); }
      if (!response.ok || envelope?.code !== 200) throw new ApiError(envelope?.msg || '请求失败，请重试。', { status: response.status, code: envelope?.code, data: envelope?.data });
      return envelope.data ?? null;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError('请求已取消或超时；未确认写操作不得当作成功。');
      throw new ApiError('无法连接后台，请检查网络与地址。');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
}
