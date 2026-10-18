/* global THREE, CANNON */
// surface any script error in the HUD instead of failing silently to a blank screen
addEventListener('error', e => {
  const el = document.querySelector('#levelName');
  if (el) { el.textContent = 'Error: ' + e.message; el.parentElement.style.background = '#b3261e'; }
});
const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7cd1ff);
scene.fog = new THREE.Fog(0x7cd1ff, 30, 90);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8a6fb8, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.position.set(6, 14, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
scene.add(sun);

const mat = (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.8 });
const boxGeo = new THREE.BoxGeometry(2, 2, 2);
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const skirtGeo = new THREE.CylinderGeometry(0.55, 1, 2, 20, 1, true);

function mesh(geo, c, x, y, z, sx, sy, sz, parent = scene) {
  const m = new THREE.Mesh(geo, mat(c));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ===== Procedural squishy sound effects (no audio assets needed) =====
const sfx = (() => {
  let ctx = null, master = null, voice = null, noiseBuf = null, asmrSend = null;
  const state = { enabled: true, last: {} };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    // compressor keeps the mix clean when the whole tower crashes at once
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 9;
    comp.attack.value = .003; comp.release.value = .22;
    comp.connect(master);
    voice = comp;
    // small soft room so the quiet ASMR taps have a little air around them
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
      }
    }
    const convolver = ctx.createConvolver(); convolver.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .5;
    convolver.connect(wet); wet.connect(comp);
    asmrSend = ctx.createGain(); asmrSend.gain.value = 1;
    asmrSend.connect(convolver);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const ready = () => state.enabled && init();
  const gate = (name, ms) => {
    const now = performance.now();
    if (now - (state.last[name] || -1e9) < ms) return false;
    state.last[name] = now; return true;
  };
  // Each costume gets its own little voice so the toy squeaks differently.
  function toneSeed() {
    const id = (playerCostume && playerCostume.id) || 'default';
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return .86 + (h % 7) * .05; // .86 .. 1.16
  }
  function out(node, pan, wet) {
    let tail = node;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); tail = p; }
    tail.connect(voice);
    if (wet && asmrSend) {
      const s = ctx.createGain(); s.gain.value = wet;
      tail.connect(s); s.connect(asmrSend);
    }
  }
  function noise({ dur = .2, f0 = 1200, f1 = 300, q = 1.2, gain = .4, rate = 1, pan = 0, delay = 0, type = 'bandpass', attack = .012, wet = 0 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rate;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(flt).connect(g);
    out(g, pan, wet);
    src.start(t, Math.random() * 1.4); src.stop(t + dur + .05);
  }
  function tone({ type = 'sine', f0 = 300, f1 = 120, dur = .25, gain = .4, delay = 0, pan = 0, wobble = 0, attack = .012, wet = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * .45);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * .75), t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g);
    out(g, pan, wet);
    if (wobble) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = wobble; lg.gain.value = f0 * .06;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t); lfo.stop(t + dur + .05);
    }
    osc.start(t); osc.stop(t + dur + .05);
  }

  // tiny high-frequency crinkle bursts: puffy fabric / hair being brushed
  function crinkle({ count = 3, f = 4200, dur = .035, gain = .02, spread = .09, delay = 0, pan = 0, wet = .6 }) {
    for (let i = 0; i < count; i++) {
      const at = delay + Math.random() * spread;
      const fq = f * (.72 + Math.random() * .6);
      noise({
        type: 'bandpass', dur: dur * (.6 + Math.random() * .9), f0: fq, f1: fq * .55,
        q: 1.1, gain: gain * (.5 + Math.random() * .8), rate: 1.4 + Math.random() * .8,
        attack: .006, pan, delay: at, wet,
      });
    }
  }
  // soft breath / "hmm" swell that trails a sound
  function breath({ dur = .3, f0 = 520, f1 = 300, gain = .02, delay = 0, rate = .6, pan = 0, wet = .7 }) {
    noise({ type: 'bandpass', dur, f0, f1, q: .8, gain, rate, attack: dur * .3, delay, pan, wet });
  }
  // single soft finger/plush tap
  function tap({ f0 = 900, f1 = 480, dur = .045, gain = .03, delay = 0, pan = 0, wet = .35 }) {
    tone({ type: 'sine', f0, f1, dur, gain, attack: .008, delay, pan, wet });
    noise({ type: 'bandpass', dur: dur * .8, f0: f0 * 2.4, f1: f0 * 1.2, q: 1.4, gain: gain * .5, rate: 1.6, attack: .006, delay, pan, wet });
  }

  return {
    unlock() { init(); },
    setEnabled(v) { state.enabled = v; if (v) init(); if (master) master.gain.value = v ? .9 : 0; },
    get enabled() { return state.enabled; },
    // ASMR jump: layered breath + fabric + crinkle + a tiny plush squeak
    jump() {
      if (!ready() || !gate('jump', 90)) return;
      const s = toneSeed() * (.95 + Math.random() * .1);
      const p = (Math.random() - .5) * .4; // gentle stereo drift
      // 1. soft fabric whoosh
      noise({ type: 'lowpass', dur: .34, f0: 780 * s, f1: 220, q: .6, gain: .075, rate: .7, attack: .06, pan: p, wet: .5 });
      // 2. muffled rounded body, like a plush toy lifting off
      tone({ type: 'sine', f0: 148 * s, f1: 250 * s, dur: .2, gain: .075, attack: .045, pan: p, wet: .35 });
      tone({ type: 'sine', f0: 300 * s, f1: 190 * s, dur: .26, gain: .035, attack: .07, delay: .04, pan: p, wet: .4 });
      // 3. skirt / puffy-sleeve crinkle on take-off
      crinkle({ count: 4, f: 4400 * s, dur: .03, gain: .022, spread: .1, delay: .01, pan: p });
      // 4. soft finger tap of a hand pushing off
      tap({ f0: 820 * s, f1: 430, dur: .05, gain: .028, delay: .015, pan: p });
      // 5. breathy exhale that trails away as you rise
      breath({ dur: .34, f0: 660 * s, f1: 300, gain: .024, delay: .03, rate: .5, pan: p, wet: .6 });
      breath({ dur: .42, f0: 420 * s, f1: 240, gain: .016, delay: .12, rate: .4, pan: -p, wet: .7 });
      // 6. the faintest plush squeak
      tone({ type: 'sine', f0: 1150 * s, f1: 780 * s, dur: .09, gain: .014, attack: .02, delay: .06, pan: p, wet: .5 });
    },
    // squishy landing; impact = fall speed, onBlock = softer & wobblier
    land(impact = 6, onBlock = false) {
      if (!ready() || !gate('land', 70)) return;
      const s = toneSeed();
      const k = Math.max(.12, Math.min(1, impact / 12));
      noise({ dur: .16 + .14 * k, f0: (onBlock ? 1700 : 1200) * s, f1: 240, q: 1.5, gain: .16 + .3 * k, rate: onBlock ? .9 : 1.1 });
      tone({ type: 'sine', f0: (onBlock ? 190 : 140) * s, f1: 58, dur: .2 + .1 * k, gain: .16 + .3 * k });
      if (onBlock) tone({ type: 'sine', f0: 260 * s, f1: 120, dur: .22, gain: .1 * k, wobble: 11, delay: .03 });
    },
    // ASMR footstep: cloth brush + tap + crinkle + breath tail (per surface)
    step(kind) {
      if (!ready() || !gate('step', 60)) return;
      const s = toneSeed() * (.92 + Math.random() * .16);
      const p = (Math.random() - .5) * .5;
      const squishy = typeof kind === 'string' ? kind !== 'keycap' : !!kind;
      const bright = kind === 'marsh' ? 1.3 : kind === 'gummy' ? 1.15 : kind === 'knead' ? .9 : 1;
      if (!squishy) {
        // keycap: a quiet plastic tick instead of a soft pat
        noise({ type: 'bandpass', dur: .05, f0: 2600 * s, f1: 1200, q: 1.2, gain: .07, rate: 1.7, attack: .004, pan: p, wet: .25 });
        tone({ type: 'sine', f0: 300 * s, f1: 150, dur: .05, gain: .03, attack: .005, pan: p, wet: .2 });
        return;
      }
      const k = bright;
      // 1. soft cloth / petticoat brush
      noise({ type: 'lowpass', dur: .15, f0: 640 * s * k, f1: 260, q: .5, gain: .045 * k, rate: .8, attack: .035, pan: p, wet: .45 });
      // 2. gentle muffled tap underneath
      tone({ type: 'sine', f0: 118 * s, f1: 62, dur: .11, gain: .042 * k, attack: .03, pan: p, wet: .3 });
      // 3. whispery top layer for that close-mic ASMR texture
      noise({ type: 'bandpass', dur: .1, f0: 1700 * s * k, f1: 900, q: .6, gain: .014, rate: 1.1, attack: .04, pan: p, wet: .6 });
      // 4. hair / lace crinkle as the leg moves
      crinkle({ count: 2, f: 4600 * s, dur: .028, gain: .015 * k, spread: .06, pan: p });
      // 5. tiny fingernail tap on plush
      tap({ f0: 760 * s, f1: 420, dur: .04, gain: .02, delay: .012, pan: p });
      // 6. breathy tail that fades behind you
      breath({ dur: .26, f0: 520 * s, f1: 260, gain: .012, delay: .03, rate: .45, pan: -p, wet: .75 });
    },
    // blocks knocking into each other / the floor
    thud(impact = 4, pan = 0) {
      if (!ready() || !gate('thud', 45)) return;
      const k = Math.max(.1, Math.min(1, impact / 11));
      const s = toneSeed() * (.92 + Math.random() * .16);
      noise({ dur: .1 + .12 * k, f0: 950 * s, f1: 170, q: 1.2, gain: .1 + .26 * k, pan, rate: .8 + Math.random() * .5 });
      tone({ type: 'sine', f0: 110 * s, f1: 48, dur: .12 + .12 * k, gain: .12 + .28 * k, pan });
    },
    // ---- squishy platforms ----
    // gel blorps, dough squelches, marshmallows squeak, gummies boing
    squish(kind = 'gel', power = 1) {
      if (!ready()) return;
      const k = Math.max(.25, Math.min(1, power));
      const s = toneSeed() * (.94 + Math.random() * .12);
      if (kind === 'gel') {
        // wet, sticky, slow blorp
        noise({ type: 'lowpass', dur: .4, f0: 1500 * s, f1: 170, q: .7, gain: .1 * k, rate: .55, attack: .04, wet: .5 });
        noise({ type: 'bandpass', dur: .34, f0: 760 * s, f1: 250, q: 2.6, gain: .07 * k, rate: .85, attack: .03, wet: .55 });
        tone({ type: 'sine', f0: 195 * s, f1: 62, dur: .36, gain: .1 * k, attack: .04, wobble: 6, wet: .4 });
      } else if (kind === 'knead') {
        // thick dough being pressed
        noise({ type: 'lowpass', dur: .44, f0: 900 * s, f1: 130, q: .6, gain: .09 * k, rate: .45, attack: .07, wet: .45 });
        tone({ type: 'sine', f0: 118 * s, f1: 50, dur: .42, gain: .09 * k, attack: .08, wet: .35 });
        noise({ type: 'bandpass', dur: .24, f0: 540 * s, f1: 300, q: 3, gain: .032 * k, rate: 1.2, attack: .02, delay: .13, wet: .6 });
      } else if (kind === 'marsh') {
        // airy rising squeak
        noise({ type: 'bandpass', dur: .28, f0: 640 * s, f1: 1550, q: 1.6, gain: .055 * k, rate: 1.1, attack: .03, wet: .6 });
        tone({ type: 'sine', f0: 430 * s, f1: 780, dur: .22, gain: .032 * k, attack: .04, wet: .5 });
      } else {
        // rubbery gummy boing
        tone({ type: 'triangle', f0: 250 * s, f1: 540, dur: .17, gain: .075 * k, attack: .012, wet: .35, wobble: 15 });
        tone({ type: 'sine', f0: 520 * s, f1: 175, dur: .22, gain: .055 * k, attack: .02, delay: .1, wet: .4 });
        noise({ type: 'bandpass', dur: .1, f0: 1650 * s, f1: 600, q: 1.4, gain: .03 * k, rate: 1.5, attack: .01, wet: .4 });
      }
    },
    // the sticky release pop when the gel springs back
    unstick(kind = 'gel', power = 1) {
      if (!ready()) return;
      const k = Math.max(.2, Math.min(1, power));
      if (kind === 'gel' || kind === 'gummy') {
        tone({ type: 'sine', f0: 300, f1: 880, dur: .13, gain: .035 * k, attack: .01, wet: .4 });
        noise({ type: 'bandpass', dur: .09, f0: 2300, f1: 900, q: 1.2, gain: .02 * k, rate: 1.6, attack: .008, wet: .45 });
      } else if (kind === 'knead') {
        noise({ type: 'lowpass', dur: .22, f0: 620, f1: 150, q: .6, gain: .05 * k, rate: .7, attack: .03, wet: .5 });
      } else {
        noise({ type: 'bandpass', dur: .16, f0: 700, f1: 1650, q: 1.6, gain: .026 * k, rate: 1.2, attack: .02, wet: .5 });
      }
    },
    // quiet continuous kneading while you stand on it
    sticky(kind = 'gel') {
      if (!ready()) return;
      const s = toneSeed();
      if (kind === 'gel') noise({ type: 'bandpass', dur: .3, f0: 880 * s, f1: 290, q: 3.4, gain: .03, rate: .75, attack: .09, wet: .6 });
      else if (kind === 'knead') noise({ type: 'lowpass', dur: .34, f0: 520 * s, f1: 175, q: .7, gain: .028, rate: .5, attack: .11, wet: .55 });
      else if (kind === 'marsh') noise({ type: 'bandpass', dur: .24, f0: 520 * s, f1: 1150, q: 1.8, gain: .015, rate: 1, attack: .07, wet: .6 });
      else noise({ type: 'bandpass', dur: .2, f0: 1320 * s, f1: 700, q: 1.6, gain: .018, rate: 1.3, attack: .05, wet: .5 });
    },
    // keycap click
    click(power = 1) {
      if (!ready() || !gate('click', 40)) return;
      const k = Math.max(.25, Math.min(1, power));
      noise({ type: 'bandpass', dur: .05, f0: 3100, f1: 1100, q: 1.1, gain: .16 * k, rate: 1.8, attack: .004, wet: .3 });
      noise({ type: 'highpass', dur: .03, f0: 4200, f1: 2600, q: .7, gain: .07 * k, rate: 2.2, attack: .003, wet: .25 });
      tone({ type: 'sine', f0: 420, f1: 170, dur: .07, gain: .1 * k, attack: .006, wet: .25 });
    },
    // coin pickup sparkle
    coin() {
      if (!ready() || !gate('coin', 40)) return;
      const s = toneSeed();
      tone({ type: 'sine', f0: 1046 * s, f1: 1046 * s, dur: .07, gain: .09, attack: .004, wet: .3 });
      tone({ type: 'sine', f0: 1568 * s, f1: 1568 * s, dur: .14, gain: .07, attack: .004, delay: .05, wet: .35 });
      noise({ type: 'bandpass', dur: .1, f0: 5200, f1: 3000, q: 1.2, gain: .02, rate: 1.8, attack: .01, wet: .4 });
    },
  };
})();
// browsers only allow audio after a gesture
['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, () => sfx.unlock(), { passive: true }));

// ===== Level system =====
const levelRoot = new THREE.Group();
scene.add(levelRoot);
const rainbow = [[1,.18,.32],[1,.52,.08],[1,.85,.05],[.18,.8,.3],[.05,.67,.92],[.35,.28,.92],[.72,.22,.9],[1,.16,.55]];
const cloudGeo = new THREE.SphereGeometry(1, 14, 10);
const coinGeo = new THREE.CylinderGeometry(.3, .3, .07, 18);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: .18, metalness: .85, emissive: 0x7a5a00, emissiveIntensity: .6 });
const ringGeo = new THREE.TorusGeometry(.9, .09, 10, 28);
let platforms = [], coins = [], blocks = [], goal = null, currentLevel = null;
let levelCoins = 0, levelComplete = false;

// ---- persistent progress ----
const SAVE_KEY = 'rainbowObby.save.v1';
const save = loadSave();
function loadSave() {
  try { return Object.assign({ coins: 0, maxLevel: 0, outfits: [], best: {} }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch (e) { return { coins: 0, maxLevel: 0, outfits: [], best: {} }; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }
function addOutfitButton(o) {
  if (!o || costumeList.querySelector(`[data-outfit="${o.id}"]`)) return;
  const b = document.createElement('button');
  b.type = 'button'; b.title = o.name; b.dataset.outfit = o.id;
  b.innerHTML = `${o.emoji}<span>${o.name}</span>`;
  b.addEventListener('click', () => { playerCostume = o; playerGender = o.id; buildCharacter(); wardrobe.hidden = true; });
  costumeList.appendChild(b);
}
function addOutfitToWardrobe(outfit) {
  if (save.outfits.includes(outfit.id)) return false;
  save.outfits.push(outfit.id); writeSave();
  addOutfitButton(outfit);
  return true;
}

// Physics world
const blockMaterial = new CANNON.Material('block');
const groundMaterial = new CANNON.Material('ground');
const world = new CANNON.World();
world.gravity.set(0, -22, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;
world.allowSleep = true;
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.add(groundBody);
// Invisible walls keep blocks inside the arena
for (const w of [
  { x: 0, z: -10, sx: 20, sz: 1 }, { x: 0, z: 10, sx: 20, sz: 1 },
  { x: -10, z: 0, sx: 1, sz: 20 }, { x: 10, z: 0, sx: 1, sz: 20 },
]) {
  const wall = new CANNON.Body({ mass: 0 });
  wall.addShape(new CANNON.Box(new CANNON.Vec3(w.sx / 2, 3, w.sz / 2)));
  wall.position.set(w.x, 3, w.z);
  world.add(wall);
}
world.addContactMaterial(new CANNON.ContactMaterial(blockMaterial, groundMaterial, { friction: 0.7, restitution: 0.08 }));
world.addContactMaterial(new CANNON.ContactMaterial(blockMaterial, blockMaterial, { friction: 0.6, restitution: 0.06 }));

// ---- level construction ----
function disposeLevel() {
  levelRoot.traverse(o => { if (o.isMesh && o.material && o.material !== coinMat) o.material.dispose(); });
  levelRoot.clear();
  for (const b of blocks) world.remove(b.body);
  blocks = []; platforms = []; coins = []; goal = null;
}
function makePlatform(def) {
  const kind = def.t;
  const g = new THREE.Group();
  g.position.set(def.x, def.y, def.z);
  levelRoot.add(g);
  const p = { kind, x: def.x, y: def.y, z: def.z, w: def.w, h: def.h, d: def.d, group: g,
              sink: 0, sinkVel: 0, sinkMax: 0, k: 200, damp: 12, pressed: false, pressT: 0, stickyT: 0,
              squishy: false, sound: kind, label: kind, topExtra: 0 };
  if (kind === 'keycap') {
    const tint = new THREE.Color(...(def.c || [1, .6, .8]));
    // the sculpted white top defines the standable surface, so collision uses it too
    const topExtra = p.h * .12;
    p.topExtra = topExtra;
    const peak = p.h / 2 + topExtra;          // walking surface
    const body = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: tint, roughness: .35 }));
    body.scale.set(p.w, p.h, p.d); g.add(body);
    const top = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(1.12), roughness: .25 }));
    top.scale.set(p.w * .82, p.h * .5, p.d * .82);
    top.position.y = peak - p.h * .25; g.add(top);
    // legend sits flush inside the top face (never above the walking surface)
    const legendH = p.h * .05;
    const legend = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4 }));
    legend.scale.set(p.w * .3, legendH, p.d * .3);
    legend.position.y = peak - legendH * .5 - .004; g.add(legend);
  } else if (kind === 'goal') {
    const tint = new THREE.Color(...(def.c || [1, .45, .72]));
    const pad = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, emissive: tint, emissiveIntensity: .35 }));
    pad.scale.set(p.w, p.h, p.d); g.add(pad);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: .5, roughness: .25 }));
    ring.position.y = p.h * .5 + 1.3; g.add(ring);
    const star = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffcc44, emissiveIntensity: .6, roughness: .3 }));
    star.scale.setScalar(.42); star.position.y = p.h * .5 + 1.3; g.add(star);
    goal = { x: def.x, y: def.y + p.h / 2, z: def.z, ring, star, hit: false };
  } else {
    const kd = window.squishyKinds[kind] || window.squishyKinds.gel;
    p.squishy = true; p.sinkMax = kd.sink; p.k = kd.k; p.damp = kd.damp; p.sound = kd.sound; p.label = kd.label;
    const gelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...kd.color), roughness: kd.rough, metalness: 0,
      emissive: new THREE.Color(...kd.color), emissiveIntensity: kd.glow,
      transparent: kd.opacity < 1, opacity: kd.opacity,
    });
    const slab = new THREE.Mesh(boxGeo, gelMat);
    slab.scale.set(p.w, p.h, p.d); g.add(slab);
    // soft mound on top; its peak IS the standing height, so you never sink into it
    const mound = Math.min(kd.mound * Math.min(1, p.w / 3.2), p.h * .45 + .15);
    p.topExtra = mound;
    if (mound > .02) {
      const cap = new THREE.Mesh(cloudGeo, gelMat);
      const r = p.h * .5 + mound;
      cap.scale.set(p.w * .47, r, p.d * .47);
      cap.position.y = p.h * .5 + mound - r;
      g.add(cap);
    }
    if (kind === 'gel' || kind === 'gummy') {  // glossy bubbles
      for (let i = 0; i < 3; i++) {
        const bubble = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({
          color: new THREE.Color(...kd.color).lerp(new THREE.Color(1, 1, 1), .45),
          roughness: .05, transparent: true, opacity: .65 }));
        const a = i * 2.1, r = p.w * .26;
        bubble.scale.setScalar(i === 1 ? .17 : .1);
        bubble.position.set(Math.cos(a) * r, p.h * .48 + .05, Math.sin(a) * r);
        g.add(bubble);
      }
    }
    if (kind === 'marsh') {  // squashed marshmallow corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const nub = new THREE.Mesh(cloudGeo, gelMat);
        nub.scale.set(p.w * .22, p.h * .5, p.d * .22);
        nub.position.set(sx * p.w * .32, p.h * .16, sz * p.d * .32);
        g.add(nub);
      }
    }
    if (kind === 'knead') {  // finger dents pressed into the dough
      for (let i = 0; i < 4; i++) {
        const dent = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(...kd.color).multiplyScalar(.9), roughness: 1 }));
        dent.scale.setScalar(.11);
        dent.position.set((Math.random() - .5) * p.w * .6, p.h * .5 - .01, (Math.random() - .5) * p.d * .6);
        g.add(dent);
      }
    }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return p;
}

// Character rig: character (facing) > lean > body (squash) > limb groups
const character = new THREE.Group();
const lean = new THREE.Group();
const body = new THREE.Group();
character.add(lean); lean.add(body);
scene.add(character);
const rig = { legs: [], arms: [], eyes: [], wings: null, head: null, hair: null, skirt: null };
function group(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
function part(geo, c, x, y, z, sx, sy, sz, parent) {
  const m = mesh(geo, c, x, y, z, sx, sy, sz, parent || body);
  if (geo === skirtGeo) m.material.side = THREE.DoubleSide;
  return m;
}
function makeCoin(x, y, z) {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.position.set(x, y, z); m.rotation.x = Math.PI / 2; m.castShadow = true;
  levelRoot.add(m);
  const c = { mesh: m, x, y, z, phase: Math.random() * 6, taken: false };
  coins.push(c);
  return c;
}
function buildTower(tower) {
  // static base so the blocks have something to rest on (and a bouncy cloud floor for the player)
  const base = new CANNON.Body({ mass: 0, material: groundMaterial });
  base.addShape(new CANNON.Box(new CANNON.Vec3(tower.w / 2, .5, tower.d / 2)));
  base.position.set(tower.x, tower.y - .5, tower.z);
  world.add(base);
  platforms.push(makePlatform({ t: 'marsh', x: tower.x, y: tower.y - .5, z: tower.z, w: tower.w, h: 1, d: tower.d }));
  // low walls so smashed blocks stay on the playground
  for (const w of [
    { x: tower.x, z: tower.z - tower.d / 2, sx: tower.w, sz: .4 },
    { x: tower.x, z: tower.z + tower.d / 2, sx: tower.w, sz: .4 },
    { x: tower.x - tower.w / 2, z: tower.z, sx: .4, sz: tower.d },
    { x: tower.x + tower.w / 2, z: tower.z, sx: .4, sz: tower.d },
  ]) {
    const wall = new CANNON.Body({ mass: 0 });
    wall.addShape(new CANNON.Box(new CANNON.Vec3(w.sx / 2, 2, w.sz / 2)));
    wall.position.set(w.x, tower.y + 1.5, w.z);
    world.add(wall);
  }
  const rowColors = [0, 1, 2, 3, 5, 6, 7], s = .62;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7 - y; x++) {
    const c = rainbow[rowColors[y]];
    const b = { x: tower.x + (x - (3 - y) / 2) * 1.35, y: tower.y + s + y * 1.28, z: tower.z, s, c, vx: 0, vy: 0, vz: 0 };
    b.mesh = mesh(boxGeo, c, b.x, b.y, b.z, s, s, s, levelRoot);
    b.body = new CANNON.Body({ mass: 1, material: blockMaterial });
    b.body.addShape(new CANNON.Box(new CANNON.Vec3(s, s, s)));
    b.body.position.set(b.x, b.y, b.z);
    b.body.linearDamping = .25; b.body.angularDamping = .4;
    b.body.allowSleep = true; b.body.sleepSpeedLimit = .35; b.body.sleepTimeLimit = .6;
    b.body.addEventListener('collide', e => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.4) sfx.thud(v, Math.max(-1, Math.min(1, (b.body.position.x - tower.x) / (tower.w / 2))));
    });
    world.add(b.body);
    blocks.push(b);
  }
}
function buildLevel(index) {
  disposeLevel();
  const def = window.levels[index];
  currentLevel = { def, index };
  levelComplete = false; levelCoins = 0;
  scene.background = new THREE.Color(...(def.sky || [.78, .9, 1]));
  scene.fog.color.set(...(def.sky || [.78, .9, 1]));
  scene.fog.near = 18; scene.fog.far = 95;
  for (const d of [...def.platforms, ...(def.bonus || [])]) platforms.push(makePlatform(d));
  if (def.tower) buildTower(def.tower);
  for (const p of platforms) { if (p.kind !== 'goal') makeCoin(p.x, p.y + p.h / 2 + 1.35, p.z); }
  (def.extraCoins || []).forEach(c => makeCoin(c[0], c[1], c[2]));
  // puffy clouds drifting far away for depth
  for (let i = 0; i < 16; i++) {
    const puff = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .85 }));
    const spread = 30 + Math.random() * 40;
    puff.position.set((Math.random() - .5) * spread, -6 + Math.random() * 16, -10 - Math.random() * 60);
    puff.scale.set(4 + Math.random() * 6, 1.6 + Math.random() * 1.6, 3 + Math.random() * 4);
    levelRoot.add(puff);
  }
  Object.assign(player, { x: def.spawn.x, y: def.spawn.y, z: def.spawn.z, vx: 0, vy: 0, vz: 0, prevY: def.spawn.y,
                          ground: false, airPeak: 0, steps: 0, surface: null, standingOn: null, coyote: 0, jumpBuffer: 0 });
  cameraYaw = 0;
  updateHud();
}

function buildCharacter() {
  // drop the old costume (disposing its materials) and rebuild the rig
  body.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); });
  body.clear();
  rig.legs = []; rig.arms = []; rig.eyes = []; rig.wings = null;
  const C = playerCostume;
  const purple = C.dress, deep = C.accent, skin = [1,.74,.66], white = [1,.96,1], dark = [.12,.06,.22];
  const blonde = C.hair, blondeLight = C.hair.map(v => Math.min(1, v + .18));
  const isCloud = C.id === 'cloud', isBoy = playerGender === 'boy', pants = isBoy, shortHair = isBoy;

  // legs, pivoting at the hip (y = .78)
  for (const side of [-1, 1]) {
    const leg = group(body, side * .16, .78, 0);
    part(sphereGeo, pants ? purple : white, 0, -.42, 0, .12, .35, .12, leg);
    part(sphereGeo, deep, 0, -.69, .08, .19, .09, .28, leg);
    part(sphereGeo, deep, 0, -.655, -.10, .075, .12, .075, leg);   // heel tip sits exactly at y = 0
    if (pants) part(sphereGeo, purple, 0, -.06, 0, .17, .22, .17, leg);
    rig.legs.push(leg);
  }
  // bell skirt (or nothing for the boy outfits)
  rig.skirt = group(body, 0, .84, 0);
  if (!pants) {
    part(skirtGeo, white, 0, -.06, 0, .45, .30, .38, rig.skirt);
    part(skirtGeo, purple, 0, 0, 0, .41, .32, .35, rig.skirt);
  }
  // cloud wings
  if (isCloud) rig.wings = [-1, 1].map(side => {
    const w = group(body, side * .38, 1.32, -.24);
    part(sphereGeo, white, 0, 0, 0, .16, .38, .07, w);
    return w;
  });
  // torso
  part(sphereGeo, purple, 0, 1.20, 0, .29, .32, .25);
  part(sphereGeo, white, 0, 1.18, .235, .16, .22, .035);
  part(sphereGeo, deep, 0, 1.03, .31, .10, .10, .06);
  // arms, pivoting at the shoulder (y = 1.22)
  for (const side of [-1, 1]) {
    const arm = group(body, side * .36, 1.22, 0);
    part(sphereGeo, purple, 0, 0, 0, .17, .19, .17, arm);
    part(sphereGeo, skin, 0, -.23, 0, .09, .25, .09, arm);
    part(sphereGeo, skin, 0, -.44, 0, .12, .12, .12, arm);
    rig.arms.push(arm);
  }
  // head, pivoting at the neck (y = 1.32)
  rig.head = group(body, 0, 1.32, 0);
  const head = rig.head;
  part(sphereGeo, blonde, 0, .37, -.035, .37, .37, .35, head);
  part(sphereGeo, skin, 0, .35, .075, .31, .31, .30, head);
  part(sphereGeo, blondeLight, 0, .59, .13, .28, .12, .23, head);
  part(sphereGeo, blondeLight, -.25, .48, .19, .13, .25, .12, head);
  part(sphereGeo, blondeLight,  .25, .48, .19, .13, .25, .12, head);
  for (const side of [-1, 1]) {
    const eye = part(sphereGeo, dark, side * .105, .40, .36, .035, .055, .025, head);
    eye.userData.sy = .055; rig.eyes.push(eye);
  }
  part(sphereGeo, [.8,.16,.35], 0, .28, .365, .055, .025, .022, head);
  // long curls, pivoting higher up so they swing with a delay
  rig.hair = group(body, 0, 1.48, 0);
  if (!shortHair) {
    part(sphereGeo, blonde, -.35, 0, -.01, .13, .29, .14, rig.hair);
    part(sphereGeo, blonde,  .35, 0, -.01, .13, .29, .14, rig.hair);
    part(sphereGeo, blondeLight, -.30, -.28, -.02, .14, .25, .14, rig.hair);
    part(sphereGeo, blondeLight,  .30, -.28, -.02, .14, .25, .14, rig.hair);
    part(sphereGeo, blonde, -.37, -.50, 0, .13, .20, .13, rig.hair);
    part(sphereGeo, blonde,  .37, -.50, 0, .13, .20, .13, rig.hair);
    part(sphereGeo, blondeLight, -.31, -.65, .01, .11, .14, .11, rig.hair);
    part(sphereGeo, blondeLight,  .31, -.65, .01, .11, .14, .11, rig.hair);
  }
}

// ===== Movement tuning (obby feel, in the spirit of Poki's Rainbow Obby) =====
const GRAVITY = 22;          // gravity
const JUMP_POWER = 10.5;     // jump impulse
const COYOTE = .11;          // grace period to jump after walking off a ledge
const JUMP_BUFFER = .13;     // pressing jump slightly early still counts
const EDGE_GRACE = .3;       // landing footprint is wider than the side box (forgiving edges)
const SNAP_DROP = .5;        // snap down small steps instead of falling through
const LAND_GRACE = .12;      // vertical tolerance above a surface that still counts as standing
const LAND_BAND = .6;        // how far below a surface still counts as a landing (before side push)
const DEATH_Y = -12;         // fall below this and you respawn

const player = { x: 0, y: 2.2, z: 7.6, vx: 0, vy: 0, vz: 0, r: .48, half: .55,
                 ground: false, surface: null, standingOn: null, airPeak: 0, steps: 0,
                 prevY: 2.2, coyote: 0, jumpBuffer: 0 };
let playerCostume = window.costumes.girl[0];
let playerGender = 'girl';
buildCharacter();

const keys = {}, touch = { x: 0, y: 0 };
let jumpQueued = false;
let cameraYaw = 0, cameraPitch = .48, cameraPointer = null;
canvas.addEventListener('pointerdown', e => { cameraPointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!cameraPointer || cameraPointer.id !== e.pointerId) return;
  const dx = e.clientX - cameraPointer.x, dy = e.clientY - cameraPointer.y;
  cameraPointer.x = e.clientX; cameraPointer.y = e.clientY;
  cameraYaw -= dx * .008;
  cameraPitch = Math.max(.12, Math.min(1.15, cameraPitch + dy * .006));
});
canvas.addEventListener('pointerup', e => { if (cameraPointer?.id === e.pointerId) cameraPointer = null; });
canvas.addEventListener('pointercancel', () => { cameraPointer = null; });
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); } });
addEventListener('keyup', e => keys[e.code] = false);

const stick = document.querySelector('#stick'), knob = stick.firstElementChild;
function stickMove(e) {
  const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy) || 1, m = Math.min(38, l);
  touch.x = dx / l * m / 38; touch.y = dy / l * m / 38;
  knob.style.transform = `translate(${touch.x * 38}px,${touch.y * 38}px)`;
}
stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', e => { if (stick.hasPointerCapture(e.pointerId)) stickMove(e); });
stick.addEventListener('pointerup', () => { touch.x = touch.y = 0; knob.style.transform = ''; });
document.querySelector('#jump').addEventListener('pointerdown', e => { jumpQueued = true; e.preventDefault(); });

const wardrobe = document.querySelector('#wardrobe');
document.querySelector('#wardrobeButton').addEventListener('click', () => { wardrobe.hidden = !wardrobe.hidden; });
const soundButton = document.querySelector('#soundButton');
soundButton.addEventListener('click', () => {
  const on = soundButton.getAttribute('aria-pressed') !== 'true';
  soundButton.setAttribute('aria-pressed', String(on));
  soundButton.textContent = on ? '🔊' : '🔇';
  sfx.setEnabled(on);
});
const allCostumes = [...window.costumes.girl, ...window.costumes.boy];
const costumeList = document.querySelector('#costumeList'), girlMode = document.querySelector('#girlMode'), boyMode = document.querySelector('#boyMode');
function setGender(gender) { playerGender = gender; girlMode.classList.toggle('active', gender === 'girl'); boyMode.classList.toggle('active', gender === 'boy'); buildCharacter(); }
girlMode.addEventListener('click', () => setGender('girl'));
boyMode.addEventListener('click', () => setGender('boy'));
girlMode.classList.add('active');
allCostumes.forEach(costume => {
  const button = document.createElement('button');
  button.type = 'button'; button.title = costume.name;
  button.innerHTML = `${costume.emoji}<span>${costume.name}</span>`;
  button.addEventListener('click', () => { playerCostume = costume; buildCharacter(); wardrobe.hidden = true; });
  costumeList.appendChild(button);
});

// ---- HUD ----
const levelNameEl = document.querySelector('#levelName'), levelDotEl = document.querySelector('#levelChip .dot');
const coinCountEl = document.querySelector('#coinCount');
const overlay = document.querySelector('#overlay'), overlayTitle = document.querySelector('#overlayTitle');
const overlayBody = document.querySelector('#overlayBody'), overlayReward = document.querySelector('#overlayReward');
function closeOverlay() { overlay.hidden = true; }
document.querySelector('#overlayPlay').addEventListener('click', closeOverlay);
document.querySelector('#overlayRestart').addEventListener('click', () => { closeOverlay(); buildLevel(currentLevel.index); });
// clicking the backdrop (but not the card) or pressing Escape also dismisses it
overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeOverlay(); });
addEventListener('keydown', e => { if (e.code === 'Escape') closeOverlay(); });
function updateHud() {
  if (currentLevel) {
    levelNameEl.textContent = `Level ${currentLevel.index + 1} · ${currentLevel.def.name}`;
    const c = currentLevel.def.color;
    levelDotEl.style.background = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  }
  coinCountEl.textContent = `${save.coins} 🪙`;
}
function showComplete(unlocked) {
  overlayTitle.textContent = currentLevel.def.name + ' complete!';
  overlayBody.textContent = `Coins this run: ${levelCoins} · Total: ${save.coins}`;
  if (unlocked) {
    overlayReward.hidden = false;
    overlayReward.innerHTML = `New outfit unlocked! <span class="emoji">${unlocked.emoji}</span> ${unlocked.name}`;
    playerCostume = unlocked; playerGender = unlocked.id; buildCharacter();
  } else {
    overlayReward.hidden = true;
    overlayReward.textContent = '';
  }
  overlay.hidden = false;
}

// ---- squishy + keycap platforms ----
function pressSquishy(p, impact) {
  p.pressed = true;
  p.pressT = Math.min(1.5, p.pressT + .35);
  sfx.squish(p.sound, Math.max(.35, Math.min(1, impact / 9)));
}
function releaseSquishy(p) {
  p.pressed = false;
  if (p.sink > .06) sfx.unstick(p.sound, Math.min(1, p.sink / p.sinkMax));
  p.stickyT = 0;
}
function updatePlatforms(dt) {
  for (const p of platforms) {
    if (!p.squishy) continue;
    const maxSink = p.h * .55;  // never sink past the bottom of the slab
    const target = Math.min(maxSink, p.pressed ? p.sinkMax * (.4 + .6 * Math.min(1, p.pressT)) : 0);
    p.sinkVel += (-(p.sink - target) * p.k - p.sinkVel * p.damp) * dt;
    p.sink += p.sinkVel * dt;
    if (p.sink > maxSink) { p.sink = maxSink; p.sinkVel = Math.min(0, p.sinkVel); }
    if (!p.pressed) p.pressT = Math.max(0, p.pressT - dt * 1.6);
    // deform: compress vertically (base stays put), bulge outward, wobble as it recovers
    const halfH = p.h / 2;
    const sy = Math.max(.3, 1 - p.sink / (p.h + p.topExtra));
    p.group.scale.y = sy;
    p.group.position.y = p.y - halfH + sy * halfH;
    const bulge = 1 + p.sink * .18;
    p.group.scale.x = bulge; p.group.scale.z = bulge;
    p.group.rotation.x = Math.sin(performance.now() * .006) * p.sink * .05;
    p.group.rotation.z = Math.cos(performance.now() * .005) * p.sink * .05;
    // quiet sticky kneading while you stand on it
    if (p.pressed) {
      p.stickyT -= dt;
      if (p.stickyT <= 0) { p.stickyT = .26 + Math.random() * .2; sfx.sticky(p.sound); }
    }
  }
}
function platformTop(p) { return p.y + p.h / 2 + p.topExtra - p.sink; }
function landOn(p, impact, dt) {
  player.y = platformTop(p) + player.half + player.r;
  player.vy = 0; player.ground = true; player.surface = p;
  if (p.squishy) {
    if (!p.pressed) pressSquishy(p, impact);
    else p.pressT = Math.min(1.5, p.pressT + dt);
  } else if (!p.wasLanded) {
    sfx.click(Math.max(.3, Math.min(1, impact / 8)));
  }
  p.wasLanded = true;
}
// keep the character's feet exactly on the surface it is standing on (no sinking, no hovering)
function pinFeetToSurface() {
  if (!player.ground || !player.surface) return;
  const t = platformTop(player.surface);
  const feet = player.y - player.half - player.r;
  if (feet < t) player.y = t + player.half + player.r;
}
// find a platform just below the feet so small steps down never clip through
function snapDownPlatform(maxDrop) {
  let bestTop = -Infinity, bestP = null;
  for (const p of platforms) {
    const top = platformTop(p);
    const hx = p.w / 2 + player.r * .5, hz = p.d / 2 + player.r * .5;
    if (player.x < p.x - hx || player.x > p.x + hx || player.z < p.z - hz || player.z > p.z + hz) continue;
    const drop = (player.y - player.half - player.r) - top;
    if (drop > 0 && drop <= maxDrop && top > bestTop) { bestTop = top; bestP = p; }
  }
  return bestP;
}
function collidePlatforms(dt) {
  const feet = player.y - player.half - player.r;
  const prevFeet = player.prevY - player.half - player.r;
  let bestTop = -Infinity, bestP = null, bonkY = -Infinity;
  for (const p of platforms) {
    const top = platformTop(p);
    const slabBottom = p.y - p.h / 2;
    // the landing footprint is wider than the side-collision box: forgiving obby edges
    const fx = p.w / 2 + player.r + EDGE_GRACE, fz = p.d / 2 + player.r + EDGE_GRACE;
    if (player.x > p.x - fx && player.x < p.x + fx && player.z > p.z - fz && player.z < p.z + fz) {
      const wasAbove = prevFeet >= top - LAND_BAND;
      const deepInside = feet < top && feet > slabBottom - .5;
      // swept test: catches fast falls that would otherwise tunnel through a slab
      if (player.vy <= 0 && feet <= top + LAND_GRACE && (wasAbove || deepInside) && top > bestTop) {
        bestTop = top; bestP = p;
      } else if (player.vy > 0 && player.y + player.half > slabBottom && player.y + player.half < top && slabBottom > bonkY) {
        bonkY = slabBottom;   // head bonk from underneath
      }
    }
    // side collision only once the body is clearly inside the slab, so grazing an edge never shoves you off
    const hx = p.w / 2 + player.r, hz = p.d / 2 + player.r;
    if (feet < top - LAND_BAND && player.y + player.half > slabBottom &&
        player.x > p.x - hx && player.x < p.x + hx && player.z > p.z - hz && player.z < p.z + hz) {
      const dx = Math.min(p.x + hx - player.x, player.x - (p.x - hx));
      const dz = Math.min(p.z + hz - player.z, player.z - (p.z - hz));
      if (dx < dz) { player.x += (player.x >= p.x ? 1 : -1) * dx; player.vx = 0; }
      else { player.z += (player.z >= p.z ? 1 : -1) * dz; player.vz = 0; }
    }
  }
  if (bonkY > -Infinity) { player.y = bonkY - player.half - player.r; player.vy = Math.min(0, player.vy); }
  // never let a squishy spring up through the player and leave them inside the slab
  if (player.standingOn && player.standingOn.squishy) {
    const sTop = platformTop(player.standingOn);
    if (player.y - player.half - player.r < sTop) { player.y = sTop + player.half + player.r; player.vy = Math.max(0, player.vy); }
  }
  if (!bestP && player.vy <= 0 && Math.hypot(player.vx, player.vz) > .4) {
    const snap = snapDownPlatform(SNAP_DROP);   // walk down small steps instead of falling through
    if (snap) bestP = snap;
  }
  if (bestP) landOn(bestP, player.airPeak, dt);
  // release any squishy we are no longer standing on
  for (const p of platforms) {
    if (p.wasLanded && p !== player.surface) {
      p.wasLanded = false;
      if (p.squishy && p.pressed) releaseSquishy(p);
    }
  }
  // the visible surface and the collision surface are the same number by construction
  if (player.ground && player.surface) {
    const t = platformTop(player.surface);
    if (player.y - player.half - player.r < t) {
      player.y = t + player.half + player.r;
      player.vy = Math.max(0, player.vy);
    }
  }
}
// Player vs physics blocks (bonus tower): world AABB, knock them flying.
function collideBlocks() {
  for (const b of blocks) {
    const aabb = b.body.aabb;   // refreshed once per frame in updateBlocks()
    const minX = aabb.lowerBound.x - player.r, maxX = aabb.upperBound.x + player.r;
    const minZ = aabb.lowerBound.z - player.r, maxZ = aabb.upperBound.z + player.r;
    const bottom = player.y - player.half - player.r, top = player.y + player.half + player.r;
    const boxTop = aabb.upperBound.y;
    if (player.x > minX && player.x < maxX && player.z > minZ && player.z < maxZ && bottom < boxTop && top > aabb.lowerBound.y) {
      const prevBottom = bottom - player.vy / 60;
      if (player.vy <= 0 && prevBottom >= boxTop - .15 && bottom > aabb.lowerBound.y + (aabb.upperBound.y - aabb.lowerBound.y) * .4) {
        player.y = boxTop + player.half + player.r; player.vy = 0; player.ground = true;
        // ride / push gently
        b.body.wakeUp();
        b.body.velocity.x += player.vx * 0.06; b.body.velocity.z += player.vz * 0.06;
        continue;
      }
      const dx = Math.min(maxX - player.x, player.x - minX), dz = Math.min(maxZ - player.z, player.z - minZ);
      if (dx < dz) {
        const dir = player.x > b.body.position.x ? 1 : -1;
        b.body.wakeUp();
        b.body.velocity.x += -dir * Math.max(1.5, Math.abs(player.vx)) * 1.1;
        b.body.angularVelocity.z += -dir * Math.abs(player.vx) * 0.6;
        player.x += dir * dx; player.vx *= 0.3;
      } else {
        const dir = player.z > b.body.position.z ? 1 : -1;
        b.body.wakeUp();
        b.body.velocity.z += -dir * Math.max(1.5, Math.abs(player.vz)) * 1.1;
        b.body.angularVelocity.x += dir * Math.abs(player.vz) * 0.6;
        player.z += dir * dz; player.vz *= 0.3;
      }
    }
  }
}
function updateBlocks(dt) {
  if (!blocks.length) return;
  world.step(1 / 60, dt, 3);
  for (const b of blocks) {
    b.x = b.body.position.x; b.y = b.body.position.y; b.z = b.body.position.z;
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.quaternion.set(b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w);
    b.body.computeAABB();
  }
}
function respawn() {
  const sp = currentLevel ? currentLevel.def.spawn : { x: 0, y: 2.2, z: 7.6 };
  Object.assign(player, {
    x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 0, prevY: sp.y,
    ground: false, airPeak: 0, steps: 0, surface: null, standingOn: null,
    coyote: 0, jumpBuffer: 0,
  });
  anim.squash = 0; anim.squashVel = 0;
}
function updateCoins(dt) {
  const px = player.x, py = player.y, pz = player.z;
  for (const c of coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2.4;
    c.mesh.position.y = c.y + Math.sin(performance.now() * .002 + c.phase) * .12;
    const dx = c.x - px, dy = c.y - py, dz = c.z - pz;
    if (dx * dx + dy * dy + dz * dz < .85 * .85) {
      c.taken = true;
      c.mesh.visible = false;
      levelCoins++; save.coins++; writeSave();
      sfx.coin();
      updateHud();
    }
  }
}
function updateGoal(dt) {
  if (!goal || goal.hit || levelComplete) return;
  goal.ring.rotation.y += dt * 1.6;
  goal.ring.rotation.x = Math.sin(performance.now() * .0015) * .4;
  goal.star.rotation.y -= dt * 2.2;
  goal.star.position.y = goal.y + 1.3 + Math.sin(performance.now() * .002) * .16;
  const dx = goal.x - player.x, dz = goal.z - player.z, dy = (goal.y + .8) - player.y;
  if (dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(dy) < 3) completeLevel();
}
function completeLevel() {
  levelComplete = true;
  goal.hit = true;
  const def = currentLevel.def;
  const reward = window.rainbowOutfits.find(o => o.id === def.reward);
  let unlocked = null;
  if (reward && addOutfitToWardrobe(reward)) {
    unlocked = reward;
    if (save.maxLevel <= currentLevel.index) save.maxLevel = currentLevel.index + 1;
    writeSave();
  }
  syncUnlockedOutfits();
  sfx.coin(); setTimeout(() => sfx.coin(), 120); setTimeout(() => sfx.coin(), 240);
  showComplete(unlocked);
}
function update(dt) {
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.x;
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + touch.y;
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const strafe = ix, forward = -iz, cs = Math.cos(cameraYaw), sn = Math.sin(cameraYaw);
  ix = strafe * cs - forward * sn;
  iz = -strafe * sn - forward * cs;
  // jump buffering: pressing slightly early still jumps
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  if (jumpQueued) player.jumpBuffer = JUMP_BUFFER;
  jumpQueued = false;

  // substepped integration so fast falls and long jumps cannot tunnel through platforms
  const wasGround = player.ground;
  const steps = 4, h = dt / steps;
  for (let s = 0; s < steps; s++) {
    const accel = player.ground ? 44 : 16, drag = Math.exp(-(player.ground ? 9 : 2.4) * h);
    player.vx = (player.vx + ix * accel * h) * drag;
    player.vz = (player.vz + iz * accel * h) * drag;
    if (player.jumpBuffer > 0 && (player.ground || player.coyote > 0)) {
      player.jumpBuffer = 0; player.coyote = 0;
      player.vy = JUMP_POWER; player.ground = false; player.airPeak = 0; player.surface = null;
      if (player.standingOn && player.standingOn.squishy) releaseSquishy(player.standingOn);
      anim.stretch = Math.max(anim.stretch, .35); anim.stretchVel += 1.6;
      sfx.jump();
    }
    player.coyote = Math.max(0, player.coyote - h);
    player.vy -= GRAVITY * h;
    player.prevY = player.y;
    player.y += player.vy * h;
    player.x += player.vx * h; player.z += player.vz * h;
    player.ground = false; player.surface = null;
    updateBlocks(h);
    collideBlocks();
    updatePlatforms(h);
    collidePlatforms(h);
    player.standingOn = player.surface;
    if (player.ground) player.coyote = COYOTE;
    if (!player.ground) player.airPeak = Math.max(player.airPeak, -player.vy);
  }
  pinFeetToSurface();   // feet never sink below the surface we are standing on
  // landing feedback, scaled by fall speed and by what you landed on
  if (player.ground && !wasGround) {    const p = player.surface;
    if (p && p.kind === 'keycap') { /* the click already played */ }
    else sfx.land(player.airPeak, !!p);
    anim.squash = Math.min(.55, .12 + player.airPeak / 16); anim.squashVel = -1.2;
    anim.stretch = -.18; anim.stretchVel = 0;
    player.airPeak = 0; player.steps = 0;
  }
  // squishy footsteps while walking, coloured by the surface underfoot
  if (player.ground) {
    player.steps += Math.hypot(player.vx, player.vz) * dt;
    if (player.steps > .62) { player.steps = 0; sfx.step(player.surface ? player.surface.kind : null); }
  } else player.steps = .45;
  updateCoins(dt);
  updateGoal(dt);
  if (player.y < DEATH_Y) respawn();
}

// ===== Character animation: walk cycle, jump/fall poses, squash & stretch =====
const anim = {
  phase: 0, squash: 0, squashVel: 0, stretch: 0, stretchVel: 0,
  yaw: 0, blink: 0, nextBlink: 1.5 + Math.random() * 3, landImpulse: 0,
};
function spring(value, vel, k, damp, dt) {
  vel += (-value * k - vel * damp) * dt;
  return [value + vel * dt, vel];
}
function animateCharacter(dt, time) {
  const speed = Math.hypot(player.vx, player.vz);
  const walkAmt = Math.min(1, speed / 5.5);
  const air = player.ground ? 0 : 1;
  const rise = Math.max(0, Math.min(1, player.vy / 9));
  const fall = player.ground ? 0 : Math.max(0, Math.min(1, -player.vy / 15));

  // smooth turning toward the movement direction
  const targetYaw = speed > .15 ? Math.atan2(player.vx / speed, player.vz / speed) : anim.yaw;
  let dyaw = targetYaw - anim.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const turn = dyaw;
  anim.yaw += dyaw * Math.min(1, dt * 11);
  character.rotation.y = anim.yaw;

  // walk cycle only rolls along the ground
  anim.phase += dt * (1.4 + speed * 1.8) * (player.ground ? 1 : .2);
  const lp = Math.sin(anim.phase), idle = player.ground && speed < .2;
  const breathe = idle ? Math.sin(time * 1.6) : 0;

  [anim.squash, anim.squashVel] = spring(anim.squash, anim.squashVel, 300, 16, dt);
  [anim.stretch, anim.stretchVel] = spring(anim.stretch, anim.stretchVel, 320, 15, dt);

  // squash on impact, stretch while rising / falling
  const sq = Math.max(0, anim.squash);
  const st = anim.stretch + rise * .16 + fall * .12;
  body.scale.set(1 + sq * .2 - st * .08, 1 - sq * .3 + st * .16 + breathe * .014, 1 + sq * .2 - st * .08);
  body.position.y = (player.ground ? Math.abs(lp) * .05 * walkAmt : rise * .04 - fall * .03) + breathe * .012;

  // lean into the run and into turns
  lean.rotation.x = -.05 * walkAmt - fall * .12 + st * .22;
  lean.rotation.z = THREE.MathUtils.clamp(-turn * 2.4, -.35, .35);

  // legs: swing while walking, tuck on the way up, trailing on the way down
  const [legL, legR] = rig.legs;
  const swing = lp * .85 * walkAmt;
  legL.rotation.x = swing - rise * 1.15 + fall * .5;
  legR.rotation.x = -swing + rise * .25 - fall * .15;
  legL.rotation.z = -fall * .14; legR.rotation.z = fall * .14;

  // arms: counter-swing, then float up on the jump and out on the fall
  const [armL, armR] = rig.arms;
  const armSwing = -swing * .8;
  const splay = .12 + walkAmt * .1 + fall * .8 + rise * .2;
  armL.rotation.x = armSwing - rise * 2.1 - fall * .3;
  armR.rotation.x = -armSwing - rise * 2.1 - fall * .3;
  armL.rotation.z = -splay; armR.rotation.z = splay;

  // head leads the turn a little, hair follows a beat later
  rig.head.rotation.y = lp * .13 * walkAmt - turn * .3;
  rig.head.rotation.z = -lp * .05 * walkAmt + breathe * .02;
  rig.head.rotation.x = fall * .14;
  rig.hair.rotation.z = -Math.sin(anim.phase - .9) * .2 * walkAmt + fall * .2;
  rig.hair.rotation.x = -.14 * air + rise * .1;
  rig.skirt.rotation.x = -lp * .12 * walkAmt - rise * .12;
  rig.skirt.rotation.z = Math.sin(anim.phase - .4) * .1 * walkAmt;

  // wings idle-flutter, flap hard in the air
  if (rig.wings) rig.wings.forEach((w, i) => {
    const s = i ? 1 : -1;
    w.rotation.z = s * (.25 + Math.sin(time * (air ? 9 : 3) + i) * (.15 + air * .35));
    w.rotation.x = Math.sin(time * (air ? 7 : 2) + i * 1.3) * .1 * (air ? 1 : .3);
  });

  // blink
  anim.blink -= dt;
  if (anim.blink < -.1) {
    anim.nextBlink -= dt;
    if (anim.nextBlink <= 0) { anim.blink = .1; anim.nextBlink = 1.8 + Math.random() * 4; }
  }
  rig.eyes.forEach(e => { e.scale.y = (anim.blink > 0 ? .12 : 1) * e.userData.sy; });
}

function syncUnlockedOutfits() {
  save.outfits.forEach(id => addOutfitButton(window.rainbowOutfits.find(x => x.id === id)));
}
buildLevel(Math.min(save.maxLevel, window.levels.length - 1));
syncUnlockedOutfits();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  update(dt);
  const w = innerWidth, h = innerHeight;
  if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const distance = 10.5, eye = [
    player.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * distance,
    player.y + Math.sin(cameraPitch) * distance,
    player.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * distance
  ];
  camera.position.set(...eye);
  camera.lookAt(player.x, player.y + .45, player.z);
  const bottom = player.y - player.half - player.r;
  character.position.set(player.x, bottom, player.z);
  animateCharacter(dt, now / 1000);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
