(function (root) {
  "use strict";
  const kinds = new Set(["care", "world_event", "outdoor", "clinic", "milestone", "appearance", "inventory"]);
  const phases = new Set(["committed", "encounter", "choice_saved", "settled", "return"]);
  function validSemantic(e) {
    if (e.settled !== !["encounter", "choice_saved"].includes(e.phase)) return false;
    if (e.kind === "world_event") return ["butterfly", "lost-pouch", "rain"].includes(e.event) &&
      ["encounter", "choice_saved", "settled"].includes(e.phase) && (e.phase === "encounter" || ["safe", "care", "coins"].includes(e.choice));
    if (e.kind === "outdoor") return e.phase === "return";
    const actions = {care: ["pet", "feed", "drink", "bath", "sleep", "play", "climb", "tease"], clinic: ["recover"], milestone: ["goal", "grow"], appearance: ["outfit", "breed"], inventory: ["sell"]};
    return e.phase === "committed" && actions[e.kind] && actions[e.kind].includes(e.action);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  class Gate {
    constructor() { this.pet = null; this.revision = -1; this.seen = new Set(); }
    hydrate(state) {
      if (!state || typeof state.petId !== "string") return;
      if (this.pet !== state.petId) { this.pet = state.petId; this.revision = -1; this.seen.clear(); }
      if (Number.isSafeInteger(state.revision)) this.revision = Math.max(this.revision, state.revision);
    }
    accept(e) {
      if (!e || e.version !== 1 || e.committed !== true || !kinds.has(e.kind) || !phases.has(e.phase) ||
          typeof e.eventId !== "string" || !e.eventId.length || e.eventId.length > 512 ||
          typeof e.petId !== "string" || !Number.isSafeInteger(e.revision) || e.revision < 0 || !validSemantic(e)) return false;
      if (this.pet !== null && e.petId !== this.pet || e.revision < this.revision || this.seen.has(e.eventId)) return false;
      this.pet = e.petId; this.revision = e.revision; this.seen.add(e.eventId);
      while (this.seen.size > 256) this.seen.delete(this.seen.values().next().value);
      return true;
    }
  }
  function semantic(e) {
    if (e.kind === "world_event") {
      if (e.phase === "encounter") return {pose: e.event === "rain" ? "rain-start" : e.event === "butterfly" ? "watch" : "notice", text: e.event === "rain" ? "雨落下来，小猫缩了缩耳朵，寻找遮蔽处…" : e.event === "butterfly" ? "小猫竖起耳朵，目光跟着蝴蝶。" : "小猫停下闻闻小钱袋，又回头看你。", duration: 2200};
      if (e.phase === "settled") return {pose: "nod", text: e.healthIssue === "sniffles" ? "回家后，小猫有点打喷嚏，去诊所看看吧。" : "这次偶遇和照料结果已保存。", duration: 1000};
      if (e.event === "rain") {
        if (e.choice === "care") return {pose: "shake", text: "擦干啦，小猫眯眼、抖抖毛，放松下来。", duration: 1500};
        if (e.choice === "safe") return {pose: "shelter", text: "在遮蔽处歇一歇，不再继续淋雨。", duration: 1900};
        return {pose: "splash", text: e.raincoat ? "穿着雨衣，小猫小心地踩了踩水花。" : "小猫试着踩水花，别忘了留意它的健康。", duration: 1500};
      }
      if (e.event === "butterfly") return {pose: e.choice === "coins" ? "pounce" : e.choice === "care" ? "watch" : "look-back", text: e.choice === "coins" ? "小猫蹦了两步，追着蝴蝶看。" : e.choice === "care" ? "陪小猫静静看一会儿蝴蝶。" : "小猫回头看看，安静地绕过去。", duration: 1500};
      return {pose: e.choice === "safe" ? "look-back" : "lead", text: e.choice === "safe" ? "小猫再看一眼，陪你继续走。" : "小猫轻轻点头，陪你把小包送还。", duration: 1400};
    }
    if (e.kind === "outdoor") return {pose: "return", text: e.wet ? "回家啦，毛毛还有点湿。" : "回家啦，小猫走近你，甩甩尾巴。", duration: 2000};
    if (e.kind === "clinic") return {pose: "relief", text: "护理已保存，小猫放松地蹭了蹭你。", duration: 1500};
    if (e.kind === "milestone") return {pose: "proud", text: e.action === "grow" ? "小猫长大了一点，挺起胸口看着你。" : "愿望完成，小猫高兴地伸出爪爪。", duration: 1800};
    if (e.kind === "appearance") return {pose: "preen", text: "换好啦，小猫低头看看自己的新模样。", duration: 1300};
    if (e.kind === "inventory") return {pose: "nod", text: "收获已经卖好，小猫轻轻点头。", duration: 900};
    const map = {
      pet: ["nuzzle", "呼噜呼噜，小猫眯眼蹭蹭你的手。"],
      feed: ["lick", "吃好啦，小猫舔舔嘴边，抬头看看你。"],
      drink: ["sip", "喝好啦，小猫舔舔鼻尖。"],
      bath: ["shake", "洗好啦，小猫抖抖毛，舒服地眯起眼。"],
      sleep: ["curl", "休息已保存，小猫把脑袋轻轻收进爪边。"],
      play: ["pounce", "这一局已保存，小猫开心地甩甩尾巴。"],
      climb: ["proud", "爬好啦，小猫挺起胸口，抬头望着你。"],
      tease: ["paw", "追到羽毛啦，小猫轻轻挥挥爪。"]
    };
    const row = map[e.action] || ["nod", "这次互动已保存。"];
    return {pose: row[0], text: row[1], duration: 1500};
  }
  function create(container, sceneKind) {
    const gate = new Gate(), reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true, current = null, queue = [], state = {}, rain = null, lastContext = null, replacedVisuals = 0, wipe = null, catVisible = false;
    const layer = document.createElement("div"); layer.className = "cat-feedback"; layer.dataset.scene = sceneKind;
    layer.setAttribute("aria-hidden", "true");
    const rainLayer = document.createElement("div"); rainLayer.className = "cat-feedback-rain";
    for (let i = 0; i < 16; i++) { const drop = document.createElement("i"); drop.style.left = (i * 6.7) + "%"; drop.style.animationDelay = (i % 5 * -0.19) + "s"; rainLayer.appendChild(drop); }
    layer.appendChild(rainLayer);
    const particles = document.createElement("div"); particles.className = "cat-feedback-particles";
    for (let i = 0; i < 6; i++) { const p = document.createElement("span"); p.style.setProperty("--i", i); particles.appendChild(p); }
    layer.appendChild(particles);
    const cloth = document.createElement("div"); cloth.className = "cat-feedback-cloth"; layer.appendChild(cloth);
    const caption = document.createElement("div"); caption.className = "cat-feedback-caption"; layer.appendChild(caption);
    const wipeTarget = document.createElement("div"); wipeTarget.className = "cat-feedback-wipe-target"; layer.appendChild(wipeTarget);
    const cancelWipe = document.createElement("button"); cancelWipe.className = "cat-feedback-wipe-cancel"; cancelWipe.textContent = "先不擦了"; layer.appendChild(cancelWipe);
    container.appendChild(layer);
    function finishWipe(ok) {
      if (!wipe) return;
      const resolve = wipe.resolve; wipe = null; layer.dataset.wiping = "false";
      cloth.style.left = ""; cloth.style.top = ""; cloth.style.transform = "";
      resolve(ok);
    }
    function beginWipe() {
      if (!active || wipe || !state.wet || sceneKind !== "world" || !catVisible) return Promise.resolve(false);
      current = null; queue = []; layer.dataset.pose = "";
      layer.dataset.wiping = "true"; caption.textContent = "按住小猫附近来回擦拭，让毛毛慢慢干起来。";
      return new Promise(resolve => { wipe = {resolve, started: null, distance: 0, pointer: null, last: null}; });
    }
    function wipePoint(e) {
      const bounds = layer.getBoundingClientRect();
      const x = e.clientX - bounds.left, y = e.clientY - bounds.top;
      const cx = parseFloat(layer.style.getPropertyValue("--cat-x") || "50") * bounds.width / 100;
      const cy = parseFloat(layer.style.getPropertyValue("--cat-y") || "48") * bounds.height / 100;
      return {x, y, inside: catVisible && Math.abs(x - cx) <= Math.max(70, bounds.width * .18) && Math.abs(y - cy) <= Math.max(85, bounds.height * .18)};
    }
    wipeTarget.addEventListener("pointerdown", e => {
      if (!wipe || !e.isTrusted) return;
      const p = wipePoint(e); if (!p.inside) return;
      e.preventDefault(); wipe.pointer = e.pointerId; wipe.last = p;
      if (wipe.started === null) wipe.started = performance.now();
      wipeTarget.setPointerCapture?.(e.pointerId);
    });
    wipeTarget.addEventListener("pointermove", e => {
      if (!wipe || !e.isTrusted || wipe.pointer !== e.pointerId) return;
      const p = wipePoint(e); e.preventDefault();
      if (p.inside && wipe.last) wipe.distance += Math.min(45, Math.hypot(p.x - wipe.last.x, p.y - wipe.last.y));
      wipe.last = p.inside ? p : null;
      cloth.style.left = p.x + "px"; cloth.style.top = p.y + "px"; cloth.style.transform = "translate(-50%,-50%)";
      if (wipe.distance >= 100 && performance.now() - wipe.started >= 900) finishWipe(true);
    });
    for (const type of ["pointerup", "pointercancel"]) wipeTarget.addEventListener(type, e => {
      if (wipe && wipe.pointer === e.pointerId) { wipe.pointer = null; wipe.last = null; }
    });
    cancelWipe.addEventListener("click", () => finishWipe(false));
    function restoreContext() {
      const c = lastContext;
      if (c && c.model && c.model.root && c.__feedbackBase) c.model.root.position.copy(c.__feedbackBase);
      if (c && c.__feedbackLight) {
        c.scene.background && c.scene.background.copy(c.__feedbackLight.background);
        c.hemi.intensity = c.__feedbackLight.hemi; c.sun.intensity = c.__feedbackLight.sun;
      }
    }
    function clear() {
      finishWipe(false);
      restoreContext(); current = null; queue = []; rain = null;
      layer.dataset.pose = ""; layer.dataset.rain = "false"; caption.textContent = "";
    }
    function activate(next, now) {
      current = {event: next.event, cue: next.cue, started: now, count: next.count || 1};
      layer.dataset.pose = next.cue.pose;
      caption.textContent = next.cue.text + (current.count > 1 ? "（" + current.count + "次已保存的互动）" : "");
      particles.querySelectorAll("span").forEach(p => { p.textContent = next.cue.pose === "pounce" || next.cue.pose === "proud" ? "✦" : next.cue.pose === "watch" ? "·" : "♡"; });
    }
    function feedback(value) {
      let e; try { e = typeof value === "string" ? JSON.parse(value) : value; } catch (_) { return false; }
      if (!active || !gate.accept(e)) return false;
      applyState(e);
      const now = performance.now(), cue = semantic(e), channel = e.kind + ":" + (e.event || "") + ":" + (e.choice || e.action || "") + ":" + e.phase;
      if (e.kind === "world_event" && e.event === "rain") {
        if (e.phase === "encounter") rain = {started: now, phase: "encounter", choiceAt: 0, offset: null, shelterFound: false};
        else if (rain && (e.phase === "choice_saved" || e.phase === "settled")) { rain.phase = e.phase === "settled" ? "settled" : e.choice; rain.choiceAt = now; }
      }
      if (current && current.channel === channel && now - current.started < 240) {
        current.count++; current.event = e;
        caption.textContent = cue.text + "（" + current.count + "次已保存的互动）";
        return true;
      }
      const queued = queue.find(q => q.channel === channel);
      if (queued) { queued.count++; queued.event = e; return true; }
      const next = {event: e, cue, channel, count: 1};
      if (!current || e.phase === "encounter" || e.kind === "world_event" && e.phase === "choice_saved") { activate(next, now); current.channel = channel; }
      else {
        // Bounded visual work. Actual transactions were already committed by Native.
        // Prefer a recent result under extreme overload; never label another
        // action with the displaced cue or invent its count. Durable facts stay Native.
        if (queue.length >= 12) replacedVisuals += queue.shift().count;
        queue.push(next);
      }
      return true;
    }
    function applyState(value) {
      let s; try { s = typeof value === "string" ? JSON.parse(value) : value; } catch (_) { return false; }
      if (!s || typeof s !== "object") return false;
      if (state.petId && s.petId && s.petId !== state.petId) clear();
      gate.hydrate(s); state = Object.assign({}, state, s);
      if (typeof s.wet === "boolean") state.wet = s.wet;
      else if (s.presentation && typeof s.presentation.wet === "boolean") state.wet = s.presentation.wet;
      layer.dataset.wet = String(state.wet === true);
      return true;
    }
    function bone(model, name, axis, value) { const b = model && model.bones && model.bones.get(name); if (b) b.rotation[axis] += value; }
    function eyes(model, amount) { ["eye_left", "eye_right"].forEach(name => { const b = model && model.bones.get(name); if (b) b.scale.y = Math.max(.12, b.scale.y * (1 - clamp(amount, 0, 1) * .88)); }); }
    function shade(c) {
      let best = null, distance = Infinity;
      c.scene.updateMatrixWorld(true);
      c.scene.traverse(obj => {
        const p = obj.geometry && obj.geometry.parameters, color = obj.material && obj.material.color;
        if (!p || !color || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width < 7 || p.width > 24 || p.height < 3 || p.height > 18 || color.g < color.r * 1.05 || color.g < color.b * 1.05) return;
        const pos = obj.getWorldPosition(c.cat.position.clone());
        if (pos.y < 6) return;
        const dx = pos.x - c.cat.position.x, dz = pos.z - c.cat.position.z, d = Math.hypot(dx, dz);
        if (d >= distance) return;
        const near = Math.max(1.8, Math.min(3.5, p.width * .27));
        const target = c.cat.position.clone().set(pos.x - dx / Math.max(.1, d) * near, 0, pos.z - dz / Math.max(.1, d) * near);
        const baseWorld = c.model.root.getWorldPosition(c.cat.position.clone()); target.y = baseWorld.y;
        const head = c.model.bones.get("head"), sample = target.clone();
        if (head) sample.y += head.getWorldPosition(c.cat.position.clone()).y - baseWorld.y;
        const projected = c.proj(sample);
        if (!projected.visible || projected.x < .12 || projected.x > .88 || projected.y < .16 || projected.y > .78) return;
        distance = d;
        const local = c.model.root.parent.worldToLocal(target);
        local.y = c.__feedbackBase.y; best = local.sub(c.__feedbackBase);
      });
      return best;
    }
    function frame(c, time, walking) {
      if (!c || !c.model || !active) return;
      lastContext = c;
      if (!c.__feedbackBase) c.__feedbackBase = c.model.root.position.clone();
      c.model.root.position.copy(c.__feedbackBase);
      const now = performance.now(), still = reduced && reduced.matches;
      if (current && now - current.started >= current.cue.duration) {
        current = null; layer.dataset.pose = ""; caption.textContent = "";
        if (queue.length) { const q = queue.shift(); activate(q, now); current.channel = q.channel; }
      }
      const cue = current && current.cue, u = current ? clamp((now - current.started) / current.cue.duration, 0, 1) : 0;
      const pulse = still ? .45 : Math.sin(Math.PI * u);
      const model = c.model, busy = sceneKind === "room" && c.act;
      if (rain && sceneKind === "world") {
        if (!c.__feedbackLight) c.__feedbackLight = {background: c.scene.background.clone(), hemi: c.hemi.intensity, sun: c.sun.intensity};
        if (!rain.offset) { rain.offset = shade(c); rain.shelterFound = !!rain.offset; }
        const age = (now - rain.started) / 1000, after = rain.choiceAt ? (now - rain.choiceAt) / 1000 : 0;
        const cover = rain.phase === "encounter" ? ease((age - .35) / .95) : 1 - ease(after / 1.8);
        if (rain.offset && !still) c.model.root.position.addScaledVector(rain.offset, cover);
        const intensity = rain.phase === "encounter" || rain.phase === "coins" ? 1 : 1 - ease(after / 1.9);
        c.scene.background.copy(c.__feedbackLight.background).multiplyScalar(1 - .18 * intensity);
        c.hemi.intensity = c.__feedbackLight.hemi * (1 - .16 * intensity); c.sun.intensity = c.__feedbackLight.sun * (1 - .38 * intensity);
        layer.dataset.rain = String(intensity > .05); layer.style.setProperty("--rain-opacity", intensity);
        if (rain.phase === "encounter") {
          if (age > .35 && age < 1.3 && rain.shelterFound && !still) model.applyAnimation("walk", time * 2.5);
          bone(model, "body", "x", .1); bone(model, "head", "x", .19); bone(model, "ear_left", "z", -.28); bone(model, "ear_right", "z", .28);
        }
      }
      if (!busy && cue) {
        const pose = cue.pose;
        if (["paw", "nuzzle", "proud"].includes(pose)) model.applyAnimation("paw", still ? .4 : time * 1.15);
        if (["pounce", "splash", "return"].includes(pose)) model.applyAnimation("walk", still ? 0 : time * 1.7);
        if (pose === "return" && !still) c.model.root.position.x -= 5 * (1 - ease(u));
        if (pose === "nuzzle" || pose === "relief") { bone(model, "head", "z", .17 * pulse); eyes(model, .8 * pulse); c.hearts && c.hearts("heart", pulse, time); }
        if (pose === "lick" || pose === "sip") { bone(model, "head", "x", .16 * pulse); model.setMouth(still ? .2 : Math.abs(Math.sin(u * Math.PI * (pose === "lick" ? 5 : 3))) * .6); }
        if (pose === "curl") { bone(model, "head", "x", .32 * pulse); bone(model, "body", "x", .09 * pulse); eyes(model, pulse); }
        if (pose === "shake" || pose === "wipe") {
          eyes(model, .9 * pulse);
          bone(model, "body", "z", still ? 0 : Math.sin(u * Math.PI * 14) * .13 * pulse * (pose === "wipe" && u < .58 ? .12 : 1));
          bone(model, "head", "z", still ? 0 : Math.sin(u * Math.PI * 12) * .1 * pulse);
        }
        if (pose === "pounce" || pose === "splash" || pose === "proud") {
          c.model.root.position.y += still ? 0 : Math.max(0, Math.sin(u * Math.PI * 3)) * .65 * pulse;
          bone(model, "tail_base", "z", still ? .1 : Math.sin(time * 7) * .18 * pulse);
        }
        if (pose === "watch") { bone(model, "head", "y", (still ? .1 : Math.sin(time * 1.2) * .2) * pulse); bone(model, "ear_left", "z", .13 * pulse); }
        if (pose === "notice" || pose === "preen") { bone(model, "head", "x", .22 * pulse); bone(model, "front_left", "x", -.19 * pulse); }
        if (pose === "look-back" || pose === "lead") { bone(model, "head", "y", (pose === "lead" ? -.3 : .35) * pulse); bone(model, "tail_tip", "z", .18 * pulse); }
        if (pose === "nod" || pose === "relief" || pose === "shelter") bone(model, "head", "x", (still ? .08 : Math.sin(u * Math.PI * 2) * .12) * pulse);
      } else if (!busy) {
        if (state.stats && state.stats.energy <= 25) { bone(model, "head", "x", .17); eyes(model, .55); }
        if (state.wet && !still) bone(model, "body", "z", Math.sin(time * 17) * .018);
        if (state.healthIssue === "sniffles") { const sneeze = Math.max(0, Math.sin(time * .9)) ** 24; bone(model, "head", "x", sneeze * (still ? .04 : .18)); }
      }
      const head = model.bones.get("head");
      if (head && c.proj) {
        let point = head.getWorldPosition(c.cat.position.clone()), p = c.proj(point);
        if (!p.visible && rain && rain.offset) {
          c.model.root.position.copy(c.__feedbackBase); c.model.root.updateMatrixWorld(true);
          rain.offset = null; rain.shelterFound = false;
          point = head.getWorldPosition(c.cat.position.clone()); p = c.proj(point);
        }
        catVisible = p.visible !== false && Number.isFinite(p.x) && Number.isFinite(p.y);
        layer.style.setProperty("--cat-x", p.x * 100 + "%");
        layer.style.setProperty("--cat-y", p.y * 100 + "%");
      }
      if (wipe) { eyes(model, .65); bone(model, "head", "z", .06); }
      if (!current && !wipe) caption.textContent = state.healthIssue === "sniffles" ? "有点打喷嚏 · 去诊所检查一下" : state.wet ? "毛毛还有点湿" : state.stats && state.stats.energy <= 25 ? "有点困了，陪它休息吧" : "";
    }
    return {
      feedback, applyState, frame, beginWipe,
      clearFeedback: clear,
      pause() { active = false; clear(); layer.dataset.paused = "true"; },
      resume() { active = true; layer.dataset.paused = "false"; },
      dispose() { active = false; clear(); layer.remove(); },
      state() { return {active, current: current && current.cue.pose, count: current ? current.count : 0, queued: queue.length, replacedVisuals, wet: state.wet === true, wiping: !!wipe, shelterFound: !!(rain && rain.shelterFound), seen: gate.seen.size}; }
    };
  }
  root.CatFeedback = {Gate, semantic, create};
})(typeof window === "undefined" ? globalThis : window);
