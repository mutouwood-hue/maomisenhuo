export class BackgroundLocation {
  constructor({ native, getSession, getProvider, getConsent, onStatus = () => {} }) {
    Object.assign(this, { native, getSession, getProvider, getConsent, onStatus, epoch: 0, pending: null, state: null });
  }
  async refresh() { const epoch=this.epoch,owner=this.getSession()?.userId;const state=await this.native.status();if(epoch!==this.epoch||owner!==this.getSession()?.userId)throw new Error('旧定位状态已失效');this.state=state;this.onStatus(state);return state; }
  async reconcile() {
    const epoch=this.epoch, initialOwner=this.getSession()?.userId,revision=this.getConsent().revision;
    const state = await this.refresh(), owner = this.getSession()?.userId;
    if(epoch!==this.epoch||owner!==initialOwner||revision!==this.getConsent().revision)throw new Error('旧定位状态已失效');
    if (!owner || state.owner && state.owner !== owner || !this.getConsent().isLocationGranted) { await this.stop(); return false; }
    if (state.isRunning && state.isEnabled && state.owner === owner) { await this.drain(); return true; }
    return false; // Never restart merely because an old checkbox is checked.
  }
  async start(isBackgroundAllowed) {
    const owner = this.getSession()?.userId;
    if (!owner || !isBackgroundAllowed || !this.getConsent().isLocationGranted) throw new Error('后台记录需要登录、位置授权与单独明确同意');
    const epoch = this.epoch;
    await this.native.start({ owner, isBackgroundAllowed: true });
    if (epoch !== this.epoch || owner !== this.getSession()?.userId) { await this.native.stop({ clear: true }); throw new Error('后台启动已取消'); }
    return this.refresh();
  }
  async stop() {
    this.epoch++; this.state = null;
    try { await this.native.stop({ clear: true }); } finally { this.getProvider()?.stopSampling(); }
  }
  async drain() {
    if (this.pending) return this.pending;
    const epoch = this.epoch, owner = this.getSession()?.userId, provider = this.getProvider();
    if (!owner || !this.getConsent().isLocationGranted) return;
    const check = () => { if (epoch !== this.epoch || owner !== this.getSession()?.userId || provider !== this.getProvider() || !this.getConsent().isLocationGranted) throw new Error('旧定位队列已失效'); };
    this.pending = (async () => {
      for (let round = 0; round < 51; round++) {
        check(); const batch = await this.native.readBatch({ owner, limit: 200 }); check();
        if (batch.owner !== owner || !Array.isArray(batch.samples)) throw new Error('定位队列归属或格式非法');
        if (!batch.samples.length) break;
        const ids = [];
        for (const sample of batch.samples) {
          check();
          if (sample.isMock === true || sample.isContinuityBreak === true) { provider.breakContinuity?.(sample.timestamp); provider.stopSampling(); ids.push(sample.id); continue; }
          // Restore only continuity proven by adjacent real timestamps; retries are timestamp-idempotent.
          if (!provider.active && provider.restoreActive) provider.restoreActive(sample.timestamp);
          try { provider.addPosition(sample); } catch (error) { if (!/定位样本非法/.test(error.message)) throw error; }
          ids.push(sample.id);
        }
        provider.persist(); check();
        await this.native.ack({ owner, generation: batch.generation, ids }); check();
        if (batch.samples.length < 200) break;
      }
      return this.refresh();
    })().finally(() => { this.pending = null; });
    return this.pending;
  }
}
