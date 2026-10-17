/* Android presentation only. Original model, raycaster and care sessions remain authoritative.
 * Care camera offsets come from the original HTML's life-v5 script. */
(() => {
  const presets = {
    feed: { target: [12.2, 1.5, -10.3], offset: [15, 22, 6.5] },
    drink: { target: [18.8, 1.5, -10.5], offset: [15, 22, 6.5] },
    bath: { target: [-10.8, 2.5, -4.5], offset: [24, 17, -7] },
    climb: { target: [8, 6, 4], offset: [-4, 16, -30] },
    tease: { target: [-1, 3, -5], offset: [7, 13, -25] }
  };
  let room, flight, current = '', saved, viewport = '', suspended = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = t => (t = Math.max(0, Math.min(1, t)), t * t * (3 - 2 * t));
  const vector = values => new room.cam.position.constructor(...values);
  function limits(care) {
    Object.assign(room.ctl, care
      ? { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: .25, maxPolarAngle: 1.5, minDistance: 6, maxDistance: 140 }
      : { minAzimuthAngle: 2.48, maxAzimuthAngle: 3.5, minPolarAngle: .65, maxPolarAngle: 1.32, minDistance: 42, maxDistance: 72 });
  }
  function fly(position, target, done) {
    flight = { from: room.cam.position.clone(), look: room.ctl.target.clone(), position, target, start: performance.now(), duration: reduced.matches ? 1 : 850, done };
  }
  function mark() {
    room.canvas.dataset.immersion = JSON.stringify({ action: current, camera: room.cam.position.toArray(), target: room.ctl.target.toArray(), viewport, suspended });
  }
  function homePose() {
    const portrait = room.cam.aspect < 1.12;
    return { position: vector(portrait ? [8, 25, -43] : [10, 29, -58]), target: vector(portrait ? [0, 4.5, 1.5] : [0, 8.5, 1.5]) };
  }
  function home(animate = true) {
    if (!room || current) return false;
    limits(false);
    const { position, target } = homePose();
    if (animate) fly(position, target);
    else { room.cam.position.copy(position); room.ctl.target.copy(target); room.ctl.update(); mark(); }
    return true;
  }
  function care(name, remember = true) {
    const preset = presets[name];
    if (!preset) return;
    if (remember) saved = { position: room.cam.position.clone(), target: room.ctl.target.clone() };
    limits(true);
    const target = vector(preset.target), offset = vector(preset.offset);
    offset.multiplyScalar(room.cam.aspect < 1.12 ? 1 : 1.75);
    let factor = 1;
    if (target.z + offset.z > 20.5) factor = Math.min(factor, (20.5 - target.z) / offset.z);
    if (target.x + offset.x < -22.5) factor = Math.min(factor, (-22.5 - target.x) / offset.x);
    if (factor < 1) { offset.x *= factor; offset.z *= factor; offset.y *= 1 + (1 - factor) * .9; }
    fly(target.clone().add(offset), target);
  }
  function bind(context) {
    room = context;
    room.canvas.style.touchAction = 'none';
    // A new drag owns the camera; no frame-by-frame idle recentering.
    room.canvas.addEventListener('pointerdown', () => { if (!current) flight = null; }, { passive: true });
    home(false);
  }
  window.CatImmersion = {
    frame(context) {
      if (!context || suspended) return;
      if (room !== context) bind(context);
      const rect = room.canvas.getBoundingClientRect(), key = `${Math.round(rect.width)}:${Math.round(rect.height)}`;
      if (key !== viewport) {
        viewport = key;
        if (!current) home(false);
        else { saved = homePose(); care(current, false); }
      }
      const next = room.act?.interactive ? room.act.name : '';
      if (next !== current) {
        const previous = current; current = next;
        if (next) care(next);
        else if (previous && saved) {
          const restore = saved; saved = null;
          fly(restore.position, restore.target, () => limits(false));
        }
      }
      if (flight) {
        const f = flight, k = ease((performance.now() - f.start) / f.duration);
        room.cam.position.lerpVectors(f.from, f.position, k);
        room.ctl.target.lerpVectors(f.look, f.target, k);
        if (k >= 1) { flight = null; f.done?.(); mark(); }
      }
    },
    reset: () => home(),
    suspend(value) { suspended = Boolean(value); if (room) mark(); },
    state: () => ({ action: current, viewport, flying: Boolean(flight), suspended })
  };
})();
