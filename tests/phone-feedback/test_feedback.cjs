const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
let now = 1000;
class Element {
  constructor() { this.dataset = {}; this.style = {setProperty(){},getPropertyValue(){return "50"}}; this.children = []; this.textContent = ""; this.handlers = {}; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  getBoundingClientRect() { return {left:0,top:0,width:400,height:600}; }
  setAttribute() {}
  appendChild(c) { this.children.push(c); }
  remove() { this.removed = true; }
  querySelectorAll(tag) { return this.children; }
}
const sandbox = {document: {createElement: () => new Element()}, performance: {now: () => now}, matchMedia: () => ({matches: false})};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../scripts/phone_feedback.js"), "utf8"), sandbox);
const {Gate, create, semantic} = sandbox.CatFeedback;
function projectCat(engine, visible=true) {
  const vector = {clone(){return Object.assign({},this)},copy(){return this}};
  const head = {getWorldPosition(){return {x:0,y:1,z:0}},scale:{y:1},rotation:{x:0,y:0,z:0}};
  engine.frame({model:{root:{position:vector},bones:new Map([["head",head]])},cat:{position:vector},proj(){return {x:.5,y:.5,visible}}},1,false);
}
let checks = 0;
function test(name, f) { f(); checks++; console.log("PASS " + name); }
const event = (revision, extra = {}) => Object.assign({version: 1, petId: "pet-a", revision, eventId: "event-" + revision, committed: true, settled: !["encounter", "choice_saved"].includes(extra.phase), kind: "care", phase: "committed", action: "pet", wet: false, stats: {energy: 70}}, extra);
test("failed malformed unknown-kind/action/phase have no cue", () => {
  const g = new Gate();
  for (const e of [null, {}, event(1, {committed: false}), event(1, {settled: false}), event(1, {action: "unknown"}), event(1, {phase: "return"}), event(1, {kind: "cloud"})]) assert.equal(g.accept(e), false);
});
test("actual distinct same-millisecond commits accepted; exact duplicate rejected", () => {
  const g = new Gate(); assert(g.accept(event(1))); assert(g.accept(event(2))); assert(!g.accept(event(2)));
});
test("restore baseline refuses old revisions but permits distinct same-revision cues", () => {
  const g = new Gate(); g.hydrate({petId: "pet-a", revision: 8});
  assert(!g.accept(event(7))); assert(g.accept(event(8))); assert(g.accept(event(8, {eventId: "grow-8", kind: "milestone", action: "grow"})));
});
test("bounded exact-ID cache cannot resurrect old-revision cues after eviction", () => {
  const g = new Gate(); for (let n = 0; n < 300; n++) assert(g.accept(event(n)));
  assert.equal(g.seen.size, 256); assert(!g.accept(event(0)));
});
test("hydrate wet/health state does not fabricate success", () => {
  const e = create(new Element(), "room"); e.applyState({petId: "pet-a", revision: 9, wet: true, healthIssue: "sniffles"});
  assert.equal(e.state().current, null); assert.equal(e.state().wet, true);
});
test("burst coalesces actual committed count without restarting or losing transactions", () => {
  const e = create(new Element(), "room"); for (let n = 1; n <= 20; n++) { now++; assert(e.feedback(event(n))); }
  assert.equal(e.state().count, 20); assert.equal(e.state().seen, 20); assert.equal(e.state().queued, 0);
});
test("pause clears transient work; resume never replays it", () => {
  const e = create(new Element(), "room"); assert(e.feedback(event(1))); e.pause();
  assert.equal(e.state().current, null); assert(!e.feedback(event(2))); e.resume(); assert.equal(e.state().current, null); assert(!e.feedback(event(1)));
});
test("cross-pet input refused unless explicitly hydrated as new authoritative state", () => {
  const e = create(new Element(), "room"); e.applyState({petId: "pet-a", revision: 1});
  assert(!e.feedback(event(2, {petId: "pet-b"}))); e.applyState({petId: "pet-b", revision: 2}); assert(e.feedback(event(2, {petId: "pet-b"})));
});
test("eight original care results have semantic variety", () => {
  const names = ["pet", "feed", "drink", "bath", "sleep", "play", "climb", "tease"];
  assert.equal(new Set(names.map(action => semantic(event(1, {action})).pose)).size, 8);
});
test("three encounters and all nine choices map to explicit reactions", () => {
  for (const story of ["rain", "butterfly", "lost-pouch"]) {
    const g = new Gate(); assert(g.accept(event(1, {kind: "world_event", phase: "encounter", event: story})));
    for (const choice of ["care", "safe", "coins"]) {
      const e = event(2, {eventId: story + choice, kind: "world_event", event: story, phase: "choice_saved", choice});
      assert(g.accept(e)); assert(semantic(e).text.length > 10); assert.notEqual(semantic(e).pose, "nod");
    }
  }
});
test("persisted wipe result immediately preempts initial rain; no premature health grant", () => {
  const e = create(new Element(), "world");
  e.feedback(event(1, {kind: "world_event", phase: "encounter", event: "rain", wet: true}));
  assert.equal(e.state().current, "rain-start"); assert.equal(e.state().wet, true);
  now += 10;
  e.feedback(event(2, {kind: "world_event", phase: "choice_saved", event: "rain", choice: "care", wet: false, settled: false}));
  assert.equal(e.state().current, "shake"); assert.equal(e.state().wet, false);
});
test("settlement never replays the wipe choreography or diagnoses an uncommitted illness", () => {
  assert.equal(semantic(event(2, {kind: "world_event", event: "rain", phase: "settled", choice: "care"})).pose, "nod");
  const pending = semantic(event(2, {kind: "world_event", event: "rain", phase: "choice_saved", choice: "coins"}));
  assert(!pending.text.includes("打喷嚏")); assert(!pending.text.includes("金币"));
});
test("wipe requires actual pointer scrub and elapsed time; synthetic or short input does not commit", () => {
  const container = new Element(), e = create(container, "world");
  e.applyState({petId:"pet-a",revision:1,wet:true}); projectCat(e); e.beginWipe();
  const target = container.children[0].children.find(c => c.className === "cat-feedback-wipe-target");
  const pointer = (type,x,trusted=true) => target.handlers[type]({pointerId:1,clientX:x,clientY:300,isTrusted:trusted,preventDefault(){}});
  pointer("pointerdown",180,false); now += 1000; pointer("pointermove",240,false);
  assert(e.state().wiping); assert(e.state().wet);
  pointer("pointerdown",170); pointer("pointermove",220); pointer("pointermove",170); pointer("pointermove",230);
  assert(e.state().wiping); now += 901; pointer("pointermove",175);
  assert(!e.state().wiping); assert(e.state().wet); // Native alone commits dry later.
});
test("interrupted scrub resolves without dry state or a success cue", () => {
  const e = create(new Element(), "world"); e.applyState({petId:"pet-a",revision:1,wet:true}); projectCat(e); e.beginWipe();
  assert(e.state().wiping); e.pause(); assert(!e.state().wiping); assert(e.state().wet); assert.equal(e.state().current,null);
});
console.log("RESULT " + checks + " passed");
