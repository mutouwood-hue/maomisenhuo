const DAY = 86400000, MINUTE = 60000, RETENTION = 7 * DAY, VISIT = 15 * MINUTE, MAX_GAP = 5 * MINUTE;
const KEY = 'companion-life-v1';
export const TIME_ZONE = 'Asia/Shanghai';
function timeParts(time) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(time));
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
export function dateKey(time) { const p = timeParts(time); return `${p.year}-${p.month}-${p.day}`; }
export function apiTime(time) { const p = timeParts(time); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`; }
export function parseApiTime(value) { return Date.parse(value.replace(' ', 'T') + '+08:00'); }
function distance(a, b) {
  const r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
/** 本机原始轨迹与上传摘要隔离；summary 是唯一网络出口且显式白名单。 */
export class LifeProvider {
  constructor({ storage, now = () => Date.now(), createId = () => crypto.randomUUID() } = {}) {
    Object.assign(this, { storage, now, createId, samples: [], places: [], visits: [], moments: [], motion: {}, active: null, baseline: null, isLocationGranted: false, isMotionGranted: false });
    const raw = storage?.getItem(KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !['samples', 'places', 'visits', 'moments'].every(k => Array.isArray(saved[k]))) throw new Error('生活缓存格式错误');
        this.continuityBarrier=saved.continuityBarrier||0;
        for (const key of ['samples', 'places', 'visits', 'moments', 'motion']) this[key] = saved[key] ?? {};
      } catch (error) { storage?.setItem(KEY + '-corrupt', raw); storage?.removeItem(KEY); this.restoreError = error; }
    }
    this.prune();
  }
  persist() { this.storage?.setItem(KEY, JSON.stringify({ version: 1, continuityBarrier:this.continuityBarrier||0, samples: this.samples, places: this.places, visits: this.visits, moments: this.moments, motion: this.motion })); }
  prune() {
    const cutoff = this.now() - RETENTION;
    this.samples = this.samples.filter(s => s.time >= cutoff).slice(-3000);
    this.visits = this.visits.filter(v => v.start >= cutoff && v.end <= this.now() + MINUTE);
    if (this.active && this.active.start < cutoff) this.active = null;
    this.moments = this.moments.filter(m => m.time >= cutoff);
    const retained = new Set(this.samples.map(s => s.placeId));
    this.places = this.places.filter(p => retained.has(p.id));
    for (const date of Object.keys(this.motion)) if (this.motion[date].coverageStart < cutoff) delete this.motion[date];
    this.persist();
  }
  setConsent({ isLocationGranted, isMotionGranted }) {
    if (typeof isLocationGranted !== 'boolean' || typeof isMotionGranted !== 'boolean') throw new Error('授权必须为布尔值');
    this.isLocationGranted = isLocationGranted; this.isMotionGranted = isMotionGranted;
    if (!isLocationGranted) { this.samples = []; this.places = []; this.visits = []; this.active = null; this.moments = this.moments.filter(m => m.type !== 'ARRIVE_HOME'); }
    if (!isMotionGranted) { this.motion = {}; this.baseline = null; }
    this.prune();
  }
  restoreActive(nextTime) {
    const last=this.samples.at(-1);if(!last||last.time<=(this.continuityBarrier||0)||nextTime-last.time>MAX_GAP||nextTime<=last.time||dateKey(nextTime)!==dateKey(last.time))return;
    const visit=this.visits.find(v=>v.placeId===last.placeId&&v.end===last.time);
    if(visit){this.active={...visit};return;}
    const contiguous=[];for(let i=this.samples.length-1;i>=0;i--){const sample=this.samples[i],newer=contiguous.at(-1);if(sample.time<=(this.continuityBarrier||0)||sample.placeId!==last.placeId||dateKey(sample.time)!==dateKey(last.time)||(newer&&newer.time-sample.time>MAX_GAP))break;contiguous.push(sample);}
    this.active={id:this.createId(),placeId:last.placeId,start:contiguous.at(-1).time,end:last.time,isIndependent:!this.visits.some(v=>v.placeId===last.placeId)};
  }
  breakContinuity(time=this.samples.at(-1)?.time||0){this.active=null;this.continuityBarrier=Math.max(this.continuityBarrier||0,time);this.persist();}
  stopSampling() { this.active = null; this.baseline = null; }
  addPosition(position) {
    if (!this.isLocationGranted) return false;
    const c = position?.coords, time = position?.timestamp ?? this.now();
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180 || !Number.isFinite(time) || time > this.now() + MINUTE || time < this.now() - RETENTION) throw new Error('定位样本非法');
    if (!Number.isFinite(c.accuracy) || c.accuracy < 0 || c.accuracy > 150) { this.breakContinuity(time); return false; }
    const last = this.samples.at(-1);
    if (last && (time <= last.time || time - last.time < MINUTE)) return false;
    const sample = { time, lat: Number(c.latitude.toFixed(4)), lon: Number(c.longitude.toFixed(4)), accuracy: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null };
    let place = this.places.find(p => distance(p, sample) < 150);
    if (!place) { place = { id: this.createId(), lat: sample.lat, lon: sample.lon, alias: `常去地点 ${this.places.length + 1}`, type: 'OTHER' }; this.places.push(place); }
    sample.placeId = place.id; this.samples.push(sample);
    const active = this.active;
    if (!active || active.placeId !== place.id || time - active.end > MAX_GAP || dateKey(active.start) !== dateKey(time)) this.active = { id: this.createId(), placeId: place.id, start: time, end: time, isIndependent: !this.visits.some(v => v.placeId === place.id) || (!!last && last.placeId !== place.id) };
    else {
      active.end = time;
      if (active.end - active.start >= VISIT) {
        const visit = this.visits.find(v => v.id === active.id);
        if (visit) visit.end = time; else this.visits.push({ ...active });
      }
    }
    this.prune(); return true;
  }
  renamePlace(id, alias, type = 'OTHER') {
    const place = this.places.find(p => p.id === id);
    if (!place || typeof alias !== 'string' || !alias.trim() || alias.length > 20 || !['HOME', 'WORK', 'CAFE', 'MEAL', 'PARK', 'OTHER'].includes(type)) throw new Error('地点名称或类型非法');
    place.alias = alias.trim(); place.type = type; this.persist();
  }
  addSteps({ cumulativeSteps, bootId, time = this.now() }) {
    if (!this.isMotionGranted) return false;
    if (!Number.isSafeInteger(cumulativeSteps) || cumulativeSteps < 0 || !bootId || !Number.isFinite(time) || time > this.now() + MINUTE || time < this.now() - RETENTION || (this.baseline && time <= this.baseline.time)) throw new Error('步数样本非法');
    const date = dateKey(time), previous = this.baseline;
    const day = this.motion[date] ?? { stepCount: 0, coverageStart: time };
    this.motion[date] = day;
    if (previous && previous.date === date && previous.bootId === bootId && time > previous.time && cumulativeSteps >= previous.count) {
      const delta = cumulativeSteps - previous.count;
      if (delta > Math.ceil((time - previous.time) / 1000 * 5) + 10) { this.baseline = { date, bootId, time, count: cumulativeSteps }; throw new Error('计步增量异常，本次增量未纳入摘要'); }
      day.stepCount += delta;
    }
    // 首读、重启、日界或重新授权仅建基线，不能把开机累计量当今天全天步数。
    this.baseline = { date, bootId, time, count: cumulativeSteps }; this.prune(); return true;
  }
  addMoment({ id = this.createId(), type, heart, time = this.now() }) {
    if (!Number.isFinite(time) || time > this.now() + MINUTE || time < this.now() - RETENTION || !Number.isInteger(heart) || heart < 0 || heart > 100 || !['CARE', 'QUIRK', 'ARRIVE_HOME', 'VOICE', 'ENCOUNTER', 'GRADUATE', 'OTHER'].includes(type)) throw new Error('心动事件非法');
    if (!this.moments.some(m => m.id === id)) this.moments.push({ id, type, heart, time });
    this.prune();
  }
  summary(date = dateKey(this.now())) {
    this.prune();
    const visits = this.isLocationGranted ? this.visits.filter(v => dateKey(v.start) === date) : [];
    const ids = new Set(visits.map(v => v.placeId)), places = this.places.filter(p => ids.has(p.id));
    const motion = this.isMotionGranted ? this.motion[date] : null;
    return { timeZone: TIME_ZONE, source: 'NATIVE',
      segments: visits.map(v => { const p = places.find(p => p.id === v.placeId); return { id: v.id, startAt: apiTime(v.start), endAt: apiTime(v.end), type: p?.type ?? 'OTHER', placeId: p?.id ?? null, placeAlias: p?.alias ?? null }; }),
      places: places.map(p => ({ id: p.id, alias: p.alias, type: p.type, visitIds: visits.filter(v => v.placeId === p.id && v.isIndependent !== false).map(v => v.id) })),
      motion: motion ? { source: 'ANDROID_STEP_COUNTER', stepCount: motion.stepCount, walkingSeconds: null, vehicleSeconds: null, coverageStartAt: apiTime(motion.coverageStart) } : null,
      moments: this.moments.filter(m => dateKey(m.time) === date).map(m => ({ id: m.id, occurredAt: apiTime(m.time), type: m.type, heart: m.heart })) };
  }
  clear() { this.samples = []; this.places = []; this.visits = []; this.moments = []; this.motion = {}; this.stopSampling(); this.isLocationGranted = false; this.isMotionGranted = false; this.storage?.removeItem(KEY); }
}
