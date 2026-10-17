const KEY = 'companion-cloud-save-v1';
export function saveFingerprint(save) { const copy = { ...save }; delete copy.lastSavedAt; return JSON.stringify(copy); }
export class CloudSave {
  constructor({ api, game, storage, reload = () => {} }) {
    Object.assign(this, { api, game, storage, reload, pending: null }); this.meta = { revision: 0, dirty: false };
    const raw = storage.getItem(KEY);
    if (raw) try { const value=JSON.parse(raw);if(!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('云版本缓存非法');this.meta=value; } catch(error){storage.setItem(KEY+'-corrupt',raw);storage.removeItem(KEY);this.restoreError=error;}
  }
  persist() { this.storage.setItem(KEY, JSON.stringify(this.meta)); }
  snapshot() { const save=JSON.parse(this.game.exportSave());if(save.version!==2||!Array.isArray(save.cats))throw new Error('本机存档损坏，原文保持，不上传');return save; }
  async pull() { return this.api.request('/api/pet-saves/current'); }
  async migrate() { const remote=await this.pull();if(remote)return{status:'REMOTE_EXISTS',remote};this.meta.revision=0;this.markDirty();return this.push(); }
  async apply(remote,{shouldReload=true}={}) {
    if(!remote||!Number.isSafeInteger(remote.revision)||!remote.save)throw new Error('云存档响应不合法');
    if(this.pending)await this.pending;
    const local=this.game.exportSave();this.storage.setItem('companion-save-backup-before-apply',local);
    const result=this.game.importSave(JSON.stringify(remote.save));if(!result?.ok)throw new Error(result?.message||'当前游戏忙碌，云存档尚未应用');
    this.meta={revision:remote.revision,dirty:false,lastFingerprint:saveFingerprint(remote.save)};this.persist();
    if(shouldReload)this.reload();return remote;
  }
  markDirty(){this.meta.dirty=true;this.persist();}
  async push(){
    if(this.pending)return this.pending;
    const save=this.snapshot(),fingerprint=saveFingerprint(save);this.markDirty();
    this.pending=this.api.request('/api/pet-saves/current',{method:'PUT',body:{baseRevision:this.meta.revision,save}}).then(remote=>{
      this.meta.revision=remote.revision;this.meta.lastFingerprint=fingerprint;this.meta.dirty=saveFingerprint(this.snapshot())!==fingerprint;delete this.meta.conflict;this.persist();return remote;
    }).catch(error=>{if(error.code===40901){this.storage.setItem('companion-save-conflict-backup',JSON.stringify(save));this.meta.conflict=error.data;this.persist();}throw error;}).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async acceptDeviceSave(remote){this.storage.setItem('companion-save-before-device',this.game.exportSave());return this.apply(remote,{shouldReload:false});}
}
