const BREEDS = [{ id: 'orange', name: '橘白田园猫' }, { id: 'silver', name: '银虎斑' }, { id: 'tuxedo', name: '奶牛猫' }, { id: 'siamese', name: '暹罗猫' }, { id: 'ragdoll', name: '布偶猫' }, { id: 'blue', name: '英短蓝猫' }];
const GOALS = {};
/** 单机基础图鉴是只读派生；社交所有权仅接受服务器结果，不写回游戏或发奖励。 */
export function localCollection(save) {
  const pet = save?.pet ?? save ?? {};
  const cats = Array.isArray(pet.cats) ? pet.cats : [];
  const graduates = Array.isArray(pet.graduates) ? pet.graduates : [];
  const breeds = new Set([...cats, ...graduates].map(cat => cat.breed));
  const goals = new Set(cats.flatMap(cat => cat.claimedGoals ?? []));
  return {
    breeds: BREEDS.map(breed => ({ ...breed, isCollected: breeds.has(breed.id) })),
    goals: [...goals].map(id => ({ id, name: GOALS[id] ?? id, isCollected: true })),
    graduates: graduates.map(record => ({ ...record })),
  };
}

/** 请求与生命周期在controller集中；view只显示快照，不自行请求或结算。 */
export class SocialController {
  constructor({ adapter, getOwner, getSave, onChange = () => {} }) {
    Object.assign(this, { adapter, getOwner, getSave, onChange, generation: 0, pending: null, operation: null });
    this.state = { status: 'idle', error: '', data: null, collection: localCollection(getSave()) };
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }
  invalidate() {
    this.generation++; this.pending?.abort(); this.pending = null; this.operation = null;
    this.emit({ status: 'idle', error: '', data: null, collection: localCollection(this.getSave()) });
  }
  async run(action) {
    if (this.operation) throw new Error('正在等待上次操作，请先确认结果。');
    const owner = this.getOwner(), generation = this.generation;
    if (!owner) { this.emit({ status: 'offline', error: '未登录；单机图鉴仍可查看。', data: null, collection: localCollection(this.getSave()) }); return null; }
    const controller = new AbortController(); this.pending = controller;
    const token = {}; this.operation = token;
    const current = () => owner === this.getOwner() && generation === this.generation;
    this.emit({ status: 'loading', error: '' });
    try {
      const data = await action(this.adapter, controller.signal);
      if (!current()) return null;
      this.emit({ status: 'ready', data, error: '', collection: localCollection(this.getSave()) });
      return data;
    } catch (error) {
      if (current()) this.emit({ status: 'error', error: error.message || '暂时无法确认结果，请刷新后查看。' });
      throw error;
    } finally {
      if (this.operation === token) { this.operation = null; this.pending = null; }
    }
  }
  refresh() { return this.run((adapter, signal) => adapter.load({ signal })); }
}
