/* MALMÖ UNDERGROUND — audio engine v2.
   All music is synthesized live via Web Audio (no audio files).
   Tracks are pattern-sequenced on a 16th-note grid; gameplay notes are
   authored on the same grid so every punch lands on the music. */
'use strict';

const MUAudio = (() => {

let ctx = null, busM = null, busS = null, master = null, comp = null;
let delayNode = null, dSend = null;
let noiseBuf = null;
let cur = null;
let events = [], evPtr = 0, startAt = 0, schedTimer = null;
let playing = false;
let volume = 0.9, muted = false;

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -13; comp.knee.value = 18; comp.ratio.value = 5;
  comp.attack.value = 0.004; comp.release.value = 0.16;
  busM = ctx.createGain(); busM.gain.value = 1;
  busS = ctx.createGain(); busS.gain.value = 1;
  busM.connect(master); busS.connect(master);
  master.connect(comp); comp.connect(ctx.destination);
  delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.36;
  const fb = ctx.createGain(); fb.gain.value = 0.34;
  const tame = ctx.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 3200;
  const wet = ctx.createGain(); wet.gain.value = 0.34;
  dSend = ctx.createGain(); dSend.gain.value = 1;
  dSend.connect(delayNode);
  delayNode.connect(tame); tame.connect(fb); fb.connect(delayNode);
  delayNode.connect(wet); wet.connect(busM);
}

function unlock() { ensure(); if (ctx.state !== 'running') ctx.resume(); }

function getNoise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, (ctx.sampleRate * 1.5) | 0, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/* ---------- instruments ---------- */

function noiseHit(t, dur, freq, type, vol, q, dest) {
  const s = ctx.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
  f.frequency.value = freq; f.Q.value = q || 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || busM);
  s.start(t); s.stop(t + dur + 0.05);
}

function tone(t, f, d, type, v, dest) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(dest || busS);
  o.start(t); o.stop(t + d + 0.03);
}

let distCurveCache = null;
function distCurve() {
  if (!distCurveCache) {
    const n = 256, c = new Float32Array(n), k = 24;
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    distCurveCache = c;
  }
  return distCurveCache;
}

function kick(t, o) {
  o = o || {};
  const v = o.gain || 1.0, d = o.decay || 0.27;
  // pitch-drop body
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(o.drop || 155, t);
  osc.frequency.exponentialRampToValueAtTime(o.tail || 44, t + 0.085);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  osc.connect(g); g.connect(busM);
  osc.start(t); osc.stop(t + d + 0.02);
  // sub layer
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = o.sub || 52;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(v * 0.5, t);
  sg.gain.exponentialRampToValueAtTime(0.001, t + d * 1.1);
  sub.connect(sg); sg.connect(busM);
  sub.start(t); sub.stop(t + d * 1.1 + 0.02);
  // click
  noiseHit(t, 0.014, 4500, 'highpass', 0.5 * v);
  if (o.dist) {
    const o2 = ctx.createOscillator(); o2.type = 'square';
    o2.frequency.setValueAtTime((o.drop || 155) * 0.9, t);
    o2.frequency.exponentialRampToValueAtTime(o.tail || 44, t + 0.1);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve();
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.42 * v, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + d * 0.85);
    o2.connect(ws); ws.connect(g2); g2.connect(busM);
    o2.start(t); o2.stop(t + d);
  }
}

function clap(t, vol) {
  vol = vol || 0.5;
  for (let i = 0; i < 3; i++) noiseHit(t + i * 0.011, 0.024, 1500, 'bandpass', vol * 0.5, 1.4);
  noiseHit(t + 0.03, 0.22, 1700, 'bandpass', vol, 1.1);
}

function hat(t, open, vol) {
  noiseHit(t, open ? 0.24 : 0.045, 8500, 'highpass', vol || 0.2);
}

function shaker(t, acc) {
  noiseHit(t, acc ? 0.07 : 0.035, 6200, 'bandpass', acc ? 0.13 : 0.07, 1.6);
}

function snare(t, vol) {
  vol = vol || 0.6;
  noiseHit(t, 0.16, 1900, 'bandpass', vol, 0.8);
  tone(t, 195, 0.1, 'triangle', vol * 0.6, busM);
}

function crash(t, vol) {
  noiseHit(t, 1.3, 5800, 'highpass', vol || 0.22, 0.6);
  noiseHit(t, 0.5, 3000, 'bandpass', (vol || 0.22) * 0.6, 0.8);
}

function bass(t, f, len, o) {
  o = o || {};
  const acc = o.acc;
  const osc = ctx.createOscillator(); osc.type = o.type || 'sawtooth'; osc.frequency.value = f;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
  flt.Q.value = o.q || 2;
  const c0 = (o.cut || 950) * (acc ? 2.4 : 1);
  flt.frequency.setValueAtTime(Math.min(c0, 9000), t);
  flt.frequency.exponentialRampToValueAtTime(o.cutEnd || 130, t + Math.max(len * 0.9, 0.07));
  const g = ctx.createGain();
  const v = (o.gain || 0.42) * (acc ? 1.3 : 1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.006);
  g.gain.setValueAtTime(v, t + len * 0.65);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(flt); flt.connect(g); g.connect(busM);
  osc.start(t); osc.stop(t + len + 0.04);
  if (o.subOsc) {
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(v * 0.7, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(g2); g2.connect(busM);
    s.start(t); s.stop(t + len + 0.04);
  }
}

function lead(t, f, len, o) {
  o = o || {};
  const voices = o.oct ? [[f, o.gain || 0.13], [f * 2, (o.gain || 0.13) * 0.45]] : [[f, o.gain || 0.13]];
  for (const [vf, vg] of voices) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vg, t + 0.014);
    g.gain.setValueAtTime(vg, t + Math.max(0.02, len - 0.05));
    g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.06);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.value = o.cut || 5200; flt.Q.value = 0.7;
    g.connect(flt); flt.connect(busM);
    const det = o.det || 14;
    [-det, 0, det].forEach(dc => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = vf; osc.detune.value = dc;
      osc.connect(g); osc.start(t); osc.stop(t + len + 0.1);
    });
    if (o.echo) {
      const e = ctx.createGain(); e.gain.value = o.echo;
      flt.connect(e); e.connect(dSend);
    }
  }
}

function pluck(t, f, len, o) {
  o = o || {};
  const v = o.gain || 0.12;
  const osc = ctx.createOscillator(); osc.type = o.type || 'square'; osc.frequency.value = f;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1;
  flt.frequency.setValueAtTime(o.cut || 4200, t);
  flt.frequency.exponentialRampToValueAtTime(700, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(flt); flt.connect(g); g.connect(busM);
  const e = ctx.createGain(); e.gain.value = o.echo === undefined ? 0.5 : o.echo;
  g.connect(e); e.connect(dSend);
  osc.start(t); osc.stop(t + len + 0.04);
}

function bell(t, f, len, o) {
  o = o || {};
  const v = o.gain || 0.1;
  [[1, 1], [2.01, 0.4], [2.99, 0.15]].forEach(([m, pv]) => {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * pv, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g); g.connect(busM);
    const e = ctx.createGain(); e.gain.value = 0.6;
    g.connect(e); e.connect(dSend);
    osc.start(t); osc.stop(t + len + 0.05);
  });
}

function stab(t, fs, len, o) {
  o = o || {};
  const g = ctx.createGain();
  const v = o.gain || 0.07;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  const flt = ctx.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 280;
  g.connect(flt); flt.connect(busM);
  const e = ctx.createGain(); e.gain.value = 0.7;
  flt.connect(e); e.connect(dSend);
  fs.forEach(f => {
    [-9, 9].forEach(dc => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = f; osc.detune.value = dc;
      osc.connect(g); osc.start(t); osc.stop(t + len + 0.05);
    });
  });
}

/* pad with optional sidechain-style pump (gain ducks on every beat) */
function pad(t, fs, len, o) {
  o = o || {};
  const atk = o.pump ? 0.05 : Math.min(0.5, len * 0.25);
  const v = o.gain || 0.034;
  fs.forEach(f => {
    [-7, 7].forEach(dc => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = f; osc.detune.value = dc;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = o.cut || 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + atk);
      if (o.pump && o.spb) {
        for (let bt = o.spb; bt < len - 0.05; bt += o.spb) {
          g.gain.setValueAtTime(v, t + bt - 0.001);
          g.gain.linearRampToValueAtTime(v * 0.3, t + bt + 0.02);
          g.gain.linearRampToValueAtTime(v, t + bt + o.spb * 0.55);
        }
      }
      g.gain.setValueAtTime(v, t + len * 0.85);
      g.gain.linearRampToValueAtTime(0, t + len);
      osc.connect(flt); flt.connect(g); g.connect(busM);
      osc.start(t); osc.stop(t + len + 0.05);
    });
  });
}

function riser(t, len) {
  const s = ctx.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(7000, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + len);
  g.gain.setValueAtTime(0.28, t + len);
  g.gain.linearRampToValueAtTime(0, t + len + 0.05);
  s.connect(f); f.connect(g); g.connect(busM);
  s.start(t); s.stop(t + len + 0.1);
}

function impact(t) {
  kick(t, { drop: 200, tail: 35, decay: 0.7, gain: 1.1 });
  noiseHit(t, 0.8, 500, 'lowpass', 0.5);
  crash(t, 0.3);
}

/* ---------- track data ---------- */
/* drum patterns: 16 chars/bar ('x' hit, 'o' open hat, '.' rest); string or per-bar array.
   bass/lead/pluck/arp/bellp: per-bar arrays of [step, semitone, lenSteps, accent?].
   stabp: per-bar arrays of [step, [semis], lenSteps].
   pad: per-bar chord arrays (explicit voicings — correct major/minor).
   chordSeq: per-bar semitone offset applied to BASS only.
   notes: gameplay chart, 16ths, chars d/f/j/k; array of strings = stacked doubles. */

const K4 = 'x...x...x...x...';
const CL = '....x.......x...';
const HOFF = '..x...x...x...x.';
const HOPEN = '..o...o...o...o.';
const H8 = 'x.x.x.x.x.x.x.x.';
const H16 = 'xxxxxxxxxxxxxxxx';
const SHK = 'x.xXx.xXx.xXx.xX';
const E16 = '................';

const BOCT = [[0,0,1],[2,12,1],[4,0,1],[6,12,1],[8,0,1],[10,12,1],[12,0,1],[14,12,1]];

/* --- VÄSTRA HAMNEN VICE (A minor synthwave) --- */
// chord voicings (semis from A1)
const vAm = [12,15,19,24], vF = [20,24,27,32], vC = [15,19,22,27], vG = [22,26,29,34];
const VBV = [[0,0,2],[2,0,2],[4,0,2],[6,0,2],[8,0,2],[10,7,2],[12,0,2],[14,12,2]];
const arpOf = (a,b,c,d) => [[0,a,1],[2,b,1],[4,c,1],[6,d,1],[8,c,1],[10,b,1],[12,a,1],[14,b,1]];
const arpAm = arpOf(24,27,31,36), arpF = arpOf(20,24,27,32), arpC = arpOf(27,31,34,39), arpG = arpOf(22,26,29,34);
const arp16Of = (a,b,c,d) => [[0,a,1],[1,b,1],[2,c,1],[3,d,1],[4,c,1],[5,b,1],[6,a,1],[7,b,1],[8,c,1],[9,d,1],[10,c,1],[11,b,1],[12,a,1],[13,b,1],[14,c,1],[15,d,1]];
// VICE lead hook (4 bars)
const VH1 = [[0,43,3],[4,39,3],[8,41,3],[12,43,3]];
const VH2 = [[0,41,4],[6,39,2],[8,36,6]];
const VH3 = [[0,43,3],[4,39,3],[8,41,3],[12,46,3]];
const VH4 = [[0,48,6],[8,46,3],[12,43,3]];
const VBELL = [[0,43,4],[6,48,4],[12,46,3]];
const VBELL2 = [[0,48,4],[6,46,4],[12,43,3]];

/* --- MÖLLAN MASSIV (A minor acid) --- */
const AB1 = [[0,0,1,1],[2,0,1],[3,12,1],[4,0,1],[6,0,1],[7,12,1],[8,0,1,1],[10,15,1],[11,12,1],[12,0,1],[14,12,1],[15,0,1]];
const AB2 = [[0,0,1,1],[2,0,1],[3,12,1],[4,0,1],[6,17,1],[7,15,1],[8,12,1,1],[10,0,1],[12,0,1],[13,12,1],[14,15,1],[15,12,1]];
const AB3 = [[0,0,1,1],[3,12,1],[4,0,1],[6,15,1],[8,0,1,1],[10,12,1],[12,17,1],[13,15,1],[14,12,1],[15,0,1]];
const MST = [[2,[24,27,31],1],[10,[24,27,31],1]];
const MST2 = [[2,[24,27,31],1],[6,[24,27,31],1],[10,[24,27,31],1],[14,[27,31,36],1]];
const MH1 = [[0,36,1],[2,36,1],[4,39,2],[8,41,1],[10,43,2],[14,46,1]];
const MH2 = [[0,48,2],[4,46,1],[6,43,1],[8,41,2],[12,39,2]];

/* --- TRIANGELN OVERDRIVE (F minor hard dance) --- */
const OB = [[2,0,2,1],[6,0,2,1],[10,0,2,1],[14,0,2,1]];
const T3A1 = [[0,36,3],[4,39,3],[8,43,4],[12,41,3]];
const T3A2 = [[0,39,3],[4,43,3],[8,48,6]];
const T3A3 = [[0,43,2],[2,41,1],[4,39,2],[8,36,4],[12,34,2]];
const tFm = [12,15,19], tFm7 = [12,15,19,22], tDb = [13,17,20], tEb = [15,19,22];

/* --- DAVIDSHALL DEEP (G minor deep house) --- */
const gGm = [12,15,19,22], gBb = [15,19,22,27], gEb = [20,24,27,32], gF = [22,26,29,34];
const DB = [[0,0,2],[3,0,1],[6,0,2],[10,12,1],[12,0,2],[15,12,1]];
const DST = [[2,[24,27,31],1],[10,[24,27,31],1]];
const DBELL = [[0,39,3],[6,43,3],[12,41,2]];
const DH1 = [[0,43,2],[4,41,2],[8,39,2],[12,36,3]];
const DH2 = [[0,41,2],[4,39,2],[8,36,5]];

/* --- KIRSEBERG KNUCKLE (E minor electro breaks) --- */
const BKICK = 'x.....x...x.....';
const BSNARE = '....x.......x..x';
const EB1 = [[0,0,1,1],[2,12,1],[4,0,1],[6,0,1],[7,12,1],[8,0,1,1],[10,15,1],[12,0,1],[14,12,1]];
const EB2 = [[0,0,1,1],[2,12,1],[4,15,1],[6,12,1],[8,0,1,1],[10,0,1],[11,12,1],[12,17,1],[14,15,1]];
const KP1 = [[0,36,1],[2,43,1],[4,39,1],[6,46,1],[8,36,1],[10,43,1],[12,41,1],[14,39,1]];
const KST = [[2,[24,28,31],1],[6,[24,28,31],1],[10,[24,28,31],1]];
const KH1 = [[0,39,2],[4,36,2],[8,43,3],[12,41,2]];
const KH2 = [[0,39,2],[4,43,2],[8,48,4],[14,46,1]];

/* --- ROSENGÅRD RUMBLE (D minor halftime bass) --- */
const HKICK = 'x.........x.....';
const HKICK2 = 'x.....x...x.....';
const HSNARE = '........x.......';
const HHAT2 = 'x.x.x.xxx.x.x.xx';
const WB1 = [[0,0,2,1],[2,0,2],[4,0,2,1],[6,0,2],[8,0,2,1],[10,10,2],[12,12,2,1],[14,13,2]];
const WB2 = [[0,0,2,1],[2,0,2],[4,6,2,1],[6,5,2],[8,0,2,1],[10,0,2],[12,15,2,1],[14,12,2]];
const RH1 = [[0,48,2],[3,46,1],[4,43,2],[8,41,3],[12,43,2]];
const RH2 = [[0,46,2],[4,48,2],[8,51,5]];
const dFm = [12,15,19];

const MENU = {
  id: 'menu', name: 'LOBBY', bpm: 106, rootHz: 55.0, loop: true,
  kit: { bass: { cut: 700, gain: 0.28, q: 2 }, pluck: { gain: 0.09 } },
  sections: [{
    bars: 8, energy: 0.15,
    hat: HOFF,
    kick: [E16, E16, E16, E16, K4, K4, K4, K4],
    pad: [vAm, vAm, vF, vF, vC, vC, vG, vG],
    bass: [null, null, null, null, VBV, VBV, VBV, VBV],
    chordSeq: [0,0,8,8,3,3,10,10],
    bellp: [null, VBELL, null, VBELL2, null, VBELL, null, VBELL2],
    notes: [E16]
  }]
};

const TRACKS = [
  {
    id: 'vice', name: 'VÄSTRA HAMNEN VICE', sub: 'neon synthwave · 108 BPM',
    bpm: 108, rootHz: 55.0, hue: 190, approach: 2.1, stars: 1,
    kit: {
      kick: { drop: 145, tail: 46, decay: 0.3, sub: 48 },
      bass: { cut: 900, q: 2, gain: 0.4, subOsc: true },
      lead: { gain: 0.13, cut: 4600, echo: 0.4, det: 12, oct: true },
      pad: { gain: 0.042, cut: 1500 },
      pluck: { gain: 0.085, type: 'sawtooth', cut: 3200, echo: 0.55 },
      bell: { gain: 0.11 }
    },
    sections: [
      { bars: 4, energy: 0.15, hat: HOFF,
        pad: [vAm, vAm, vF, vG],
        bellp: [null, null, VBELL, VBELL2],
        notes: [E16, E16, 'd.......j.......', 'f.......k.......'] },
      { bars: 8, energy: 0.4, kick: K4, snare: CL, hat: HOFF,
        bass: [VBV], chordSeq: [0,0,8,8,3,3,10,10],
        pad: [vAm, null, vF, null, vC, null, vG, null],
        notes: ['d...f...j...k...','k...j...f...d...','d...j...f...k...','f...d...k...j...',
                'd...f...j...k...','j...k...d...f...','f...k...f...k...','d...f...j...k...'] },
      { bars: 4, energy: 0.6, kick: K4, hat: H8,
        clap: [CL, CL, K4, 'x...x...x.x.x.x.'],
        bass: [VBV], chordSeq: [8,8,10,10],
        pad: [vF, vF, vG, vG],
        fx: [['riser', 0, 16]],
        notes: ['d...f...j...k...','k...j...f...d...','d...f...j...k...','d.f.j.k.........'] },
      { bars: 8, energy: 0.85, kick: K4, snare: CL, hat: HOPEN, shakerp: SHK,
        bass: [BOCT], chordSeq: [0,0,8,8,3,3,10,10],
        pad: [vAm, vAm, vF, vF, vC, vC, vG, vG], padPump: true,
        lead: [VH1, VH2, VH3, VH4],
        arp: [arpAm, arpAm, arpF, arpF, arpC, arpC, arpG, arpG],
        fx: [['crash', 0, 0]],
        notes: ['d...f...j...k...','j.....f.d.......','d...f...j...k...','k.......j...f...',
                'f...j...k...j...','k.....j.f.......','d...f...j...k...','d.f.j.k.........'] },
      { bars: 4, energy: 0.25, hat: HOFF,
        pad: [vAm, vF, vC, vG],
        bellp: [VBELL, null, VBELL2, null],
        notes: ['d.......j.......','f.......k.......','d...f...j...k...', E16] },
      { bars: 8, energy: 0.95, kick: K4, snare: CL, hat: HOPEN, shakerp: SHK,
        bass: [BOCT], chordSeq: [0,0,8,8,3,3,10,10],
        pad: [vAm, vAm, vF, vF, vC, vC, vG, vG], padPump: true,
        lead: [VH1, VH2, VH3, VH4],
        arp: [arp16Of(24,27,31,36), arp16Of(24,27,31,36), arp16Of(20,24,27,32), arp16Of(20,24,27,32),
              arp16Of(27,31,34,39), arp16Of(27,31,34,39), arp16Of(22,26,29,34), arp16Of(22,26,29,34)],
        fx: [['crash', 0, 0]],
        notes: ['d...f...j...k...','j.f.d...j.f.d...','d...f...j...k...','k...j...f...d...',
                'd.f.j...k.j.f...','d...f...j...k...','f.j.k...j.f.d...',['d...f...j...k...','k...............']] },
      { bars: 2, energy: 0.15, kick: [K4, 'x...............'],
        pad: [vAm], notes: [E16, E16] }
    ]
  },
  {
    id: 'davidshall', name: 'DAVIDSHALL DEEP', sub: 'deep house · 122 BPM',
    bpm: 122, rootHz: 49.0, hue: 150, approach: 2.0, stars: 1,
    kit: {
      kick: { drop: 140, tail: 45, decay: 0.28, sub: 46 },
      bass: { cut: 750, q: 2, gain: 0.42, subOsc: true },
      lead: { gain: 0.1, cut: 3800, echo: 0.45, det: 10 },
      pad: { gain: 0.04, cut: 1200 },
      pluck: { gain: 0.09, type: 'square', cut: 2800, echo: 0.6 },
      stab: { gain: 0.055 },
      bell: { gain: 0.09 }
    },
    sections: [
      { bars: 4, energy: 0.15, hat: HOFF,
        pad: [gGm],
        bellp: [null, DBELL],
        notes: [E16, E16, 'd.......j.......', 'f.......k.......'] },
      { bars: 8, energy: 0.4, kick: K4, hat: HOPEN, clap: CL, shakerp: SHK,
        bass: [DB], chordSeq: [0,0,3,3,8,8,10,10],
        pad: [gGm, null, gBb, null, gEb, null, gF, null],
        notes: ['d...f...j...k...','k...j...f...d...','d...j...f...k...','j...f...k...d...',
                'd...f...j...k...','f...k...d...j...','d...j...d...j...','f...k...f.k.....'] },
      { bars: 4, energy: 0.55, kick: K4, hat: H8,
        clap: [CL, CL, K4, 'x...x...x.x.x.x.'],
        bass: [DB], chordSeq: [8,8,10,10],
        pad: [gEb, gEb, gF, gF],
        fx: [['riser', 0, 16]],
        notes: ['d...f...j...k...','k...j...f...d...','d...f...j...k...','d.f.j.k.........'] },
      { bars: 8, energy: 0.8, kick: K4, hat: HOPEN, clap: CL, shakerp: SHK,
        bass: [BOCT], chordSeq: [0,0,3,3,8,8,10,10],
        pad: [gGm, gGm, gBb, gBb, gEb, gEb, gF, gF], padPump: true,
        lead: [DH1, DH2],
        stabp: [DST],
        fx: [['crash', 0, 0]],
        notes: ['d...f...j...k...','k...j.f.d.......','d...f...j...k...','j...k...f...d...',
                'd.f.j...k...j...','k...j...f.d.....','d...f...j...k...','d.f.j.k.........'] },
      { bars: 4, energy: 0.25, hat: HOFF,
        pad: [gGm, gBb, gEb, gF],
        bellp: [DBELL],
        notes: ['d.......j.......','f.......k.......','d...f...j...k...', E16] },
      { bars: 8, energy: 0.85, kick: K4, hat: HOPEN, clap: CL, shakerp: SHK,
        bass: [BOCT], chordSeq: [0,0,3,3,8,8,10,10],
        pad: [gGm, gGm, gBb, gBb, gEb, gEb, gF, gF], padPump: true,
        lead: [DH1, DH2],
        stabp: [DST],
        fx: [['crash', 0, 0]],
        notes: ['d...f...j...k...','j.f.d...j.f.d...','d...f...j...k...','k...j...f...d...',
                'd.f.j...k.j.f...','d...f...j...k...','f.k.j...k.f.d...',['d...f...j...k...','k...............']] },
      { bars: 2, energy: 0.15, kick: [K4, 'x...............'],
        pad: [gGm], notes: [E16, E16] }
    ]
  },
  {
    id: 'mollan', name: 'MÖLLAN MASSIV', sub: 'acid techno · 138 BPM',
    bpm: 138, rootHz: 55.0, hue: 315, approach: 1.85, stars: 2,
    kit: {
      kick: { drop: 160, tail: 46, decay: 0.25, sub: 50 },
      bass: { cut: 680, q: 13, gain: 0.34, type: 'sawtooth' },
      lead: { gain: 0.11, cut: 3000, echo: 0.35, det: 8 },
      stab: { gain: 0.06 },
      pad: { gain: 0.04, cut: 1300 },
      pluck: { gain: 0.1 }
    },
    sections: [
      { bars: 4, energy: 0.2, hat: H8,
        kick: [E16, E16, K4, K4],
        bass: [null, null, AB1, AB1],
        notes: [E16, E16, 'd...j...........', 'f...k...........'] },
      { bars: 8, energy: 0.45, kick: K4, hat: HOFF, clap: CL, shakerp: SHK,
        bass: [AB1, AB1, AB1, AB2],
        stabp: [null, MST],
        notes: ['d...d...f...f...','j...j...k...k...','d...f...d...f...','j...k...j.k.....',
                'd...d...f...f...','j...j...k...k...','d...f...j...k...','d.f.d.f.j.k.j.k.'] },
      { bars: 4, energy: 0.65, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [AB1],
        fx: [['riser', 0, 16]],
        notes: ['d...d...f...f...','j...j...k...k...','d.f.j.k.d.f.j.k.','j.k.j.k.........'] },
      { bars: 8, energy: 0.9, kick: K4, hat: HOPEN, clap: CL, shakerp: SHK,
        bass: [AB2, AB2, AB3, AB1],
        stabp: [MST, MST, MST, MST2],
        fx: [['crash', 0, 0]],
        notes: ['d.j.f.k.d.j.f.k.','d...j...f...k...','k.f.j.d.k.f.j.d.','d...f...j...k...',
                'd.d.j.j.f.f.k.k.','k...f...j...d...','d.j.f.k.d.j.f.k.',['d.f.j.k.........','k...............']] },
      { bars: 4, energy: 0.25, hat: HOFF,
        pad: [vAm, vAm, vF, vF],
        pluckp: [[[0,36,1],[4,39,1],[8,43,1],[12,46,1]]],
        notes: ['d.......f.......','j.......k.......','d...f...j...k...', E16] },
      { bars: 8, energy: 1.0, kick: K4, hat: H8, clap: CL, shakerp: SHK,
        bass: [AB2, AB1, AB3, AB1],
        lead: [MH1, MH2],
        fx: [['crash', 0, 0]],
        notes: ['d.j.f.k.j.d.k.f.','d...f...j...k...','df..jk..d...k...','j.k.f.d.j.k.f.d.',
                'd...j...f...k...','df..jk..fd..kj..','d.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...']] },
      { bars: 2, energy: 0.2, kick: [K4, 'x...............'], notes: [E16, E16] }
    ]
  },
  {
    id: 'kirseberg', name: 'KIRSEBERG KNUCKLE', sub: 'electro breaks · 126 BPM',
    bpm: 126, rootHz: 41.2, hue: 270, approach: 1.9, stars: 2,
    kit: {
      kick: { drop: 165, tail: 48, decay: 0.24, sub: 50 },
      bass: { cut: 1300, q: 6, gain: 0.36 },
      lead: { gain: 0.11, cut: 4200, echo: 0.3, det: 16 },
      pluck: { gain: 0.11, type: 'square', cut: 3600, echo: 0.4 },
      pad: { gain: 0.04 },
      stab: { gain: 0.065 }
    },
    sections: [
      { bars: 4, energy: 0.2, hat: H8,
        kick: [E16, E16, BKICK, BKICK],
        snare: [E16, E16, BSNARE, BSNARE],
        notes: [E16, 'd.......j.......', 'f.......k.......', 'd...f...j...k...'] },
      { bars: 8, energy: 0.5, kick: BKICK, snare: BSNARE, hat: H8, shakerp: SHK,
        bass: [EB1, EB1, EB1, EB2],
        notes: ['d...f.f.j...k...','j...k.k.f...d...','d...f...j.j.k...','k...j...f...d.d.',
                'd...f.f.j...k...','j...k.k.f...d...','d.f.....j.k.....','d.f.j.k.j.f.....'] },
      { bars: 4, energy: 0.65, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [EB1],
        fx: [['riser', 0, 16]],
        notes: ['d...d...f...f...','j...j...k...k...','d.f.j.k.d.f.j.k.','j.k.j.k.........'] },
      { bars: 8, energy: 0.9, kick: BKICK, snare: BSNARE, hat: HOPEN, shakerp: SHK,
        bass: [EB1, EB2],
        stabp: [KST, null],
        pluckp: [KP1],
        fx: [['crash', 0, 0]],
        notes: ['d.f.j...k.j.f...','d...j.k.f...k.j.','d.f.j...k.j.f...',['d...f...j...k...','j...............'],
                'k.j.f...d.f.j...','f...j.k.d...j.k.','d.f.j...k.j.f...',['d.f.j.k.........','k.......d.......']] },
      { bars: 4, energy: 0.3, hat: HOFF,
        pad: [[12,15,19,24]],
        pluckp: [[[0,43,2],[6,41,1],[8,39,2],[14,36,1]]],
        notes: ['d.......j.......','f.......k.......','d.f.....j.k.....', E16] },
      { bars: 8, energy: 1.0, kick: BKICK, snare: BSNARE, hat: HOPEN, shakerp: SHK,
        bass: [EB1, EB2],
        stabp: [KST, null],
        lead: [KH1, KH2],
        fx: [['crash', 0, 0]],
        notes: ['d.f.j.k.d.f.j.k.','k.j.f.d.k.j.f.d.','d.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...'],
                'df..jk..d...k...','kj..fd..j...f...','d.f.j.k.j.f.d...',['d.f.j.k.d.f.j.k.','........k.j.f.d.']] },
      { bars: 2, energy: 0.2, kick: ['x...............', 'x...............'], notes: [E16, E16] }
    ]
  },
  {
    id: 'triangeln', name: 'TRIANGELN OVERDRIVE', sub: 'hard dance · 150 BPM',
    bpm: 150, rootHz: 43.65, hue: 25, approach: 1.7, stars: 3,
    kit: {
      kick: { drop: 170, tail: 42, decay: 0.33, dist: true, sub: 46 },
      bass: { cut: 1500, q: 4, gain: 0.36, subOsc: true },
      lead: { gain: 0.15, cut: 6200, echo: 0.25, det: 18, oct: true },
      pad: { gain: 0.05, cut: 1100 },
      pluck: { gain: 0.1, type: 'sawtooth', cut: 3600, echo: 0.55 }
    },
    sections: [
      { bars: 4, energy: 0.25, kick: K4,
        pad: [tFm],
        notes: [E16, 'd.......j.......', 'f.......k.......', 'd...f...j...k...'] },
      { bars: 8, energy: 0.55, kick: K4, hat: HOFF, clap: CL,
        bass: [OB],
        pad: [tFm, null, tDb, null, tEb, null, tFm, null], chordless: true,
        notes: ['d...f...j...k...','d...f...j...k.j.','d.f.....j.k.....','d...j...f...k...',
                'd.f.j.k.d...k...','f.d.k.j.f...j...','d...f.j.k...j.f.','d.f.j.k.j.f.d...'] },
      { bars: 4, energy: 0.7, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [OB],
        fx: [['riser', 0, 16]],
        notes: ['d.d.f.f.j.j.k.k.','k.k.j.j.f.f.d.d.','d.f.j.k.d.f.j.k.','d.f.j.k.........'] },
      { bars: 8, energy: 1.0, kick: K4, hat: HOPEN,
        bass: [OB],
        pad: [tFm7], padPump: true,
        lead: [T3A1, T3A2, T3A1, T3A3],
        fx: [['crash', 0, 0]],
        notes: ['d.f.j.k.d.f.j.k.','k...j...f...d...','d.j.d.j.f.k.f.k.',['d...f...j...k...','j...k...d...f...'],
                'df..jk..df..jk..','k...f...j...d...','d.f.j.k.j.f.d...',['d.f.j.k.d.f.j.k.','............k...']] },
      { bars: 4, energy: 0.3, hat: HOFF,
        pad: [tFm7],
        pluckp: [[[0,36,1],[2,39,1],[4,43,1],[6,46,1],[8,48,1],[10,46,1],[12,43,1],[14,39,1]]],
        notes: ['d...f...j...k...','k...j...f...d...','d.f.....j.k.....', E16] },
      { bars: 8, energy: 1.0, hat: H8, clap: CL,
        kick: [K4, K4, K4, 'x...x...x..xx...'],
        bass: [OB],
        pad: [tFm7], padPump: true,
        lead: [T3A1, T3A2],
        fx: [['crash', 0, 0]],
        notes: ['d.f.j.k.d.f.j.k.','df..jk..df..jk..','k...j...f...d...','jk..df..jk..df..',
                'd.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...'],'d.f.j.k.j.f.d...','dfjk....dfjk....'] },
      { bars: 2, energy: 0.2, kick: [K4, 'x...............'],
        fx: [['impact', 0, 0]], notes: [E16, E16] }
    ]
  },
  {
    id: 'rosengard', name: 'ROSENGÅRD RUMBLE', sub: 'halftime bass · 142 BPM',
    bpm: 142, rootHz: 36.71, hue: 0, approach: 1.65, stars: 3,
    kit: {
      kick: { drop: 180, tail: 40, decay: 0.3, dist: true, sub: 42 },
      bass: { cut: 900, q: 8, gain: 0.4, subOsc: true, cutEnd: 90 },
      lead: { gain: 0.12, cut: 5000, echo: 0.3, det: 20 },
      pad: { gain: 0.05, cut: 1000 },
      pluck: { gain: 0.1, type: 'sawtooth', cut: 4200, echo: 0.5 }
    },
    sections: [
      { bars: 4, energy: 0.25,
        pad: [dFm],
        kick: [E16, E16, HKICK, HKICK],
        snare: [E16, E16, HSNARE, HSNARE],
        hat: [E16, E16, H8, H8],
        notes: [E16, 'd.......j.......', 'f.......k.......', 'd...f...j...k...'] },
      { bars: 8, energy: 0.5, kick: HKICK, snare: HSNARE,
        hat: [H8, HHAT2],
        bass: [WB1],
        notes: ['d.......j.......','f.......k.......','d...f...j.......','k...j...f.......',
                'd.......j...k...','f.......d...j...','d...f...j...k...','d.f.j...k.j.....'] },
      { bars: 4, energy: 0.7, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [WB1],
        fx: [['riser', 0, 16]],
        notes: ['d.d.f.f.j.j.k.k.','k.k.j.j.f.f.d.d.','d.f.j.k.d.f.j.k.','d.f.j.k.........'] },
      { bars: 8, energy: 1.0, snare: HSNARE, hat: HHAT2,
        kick: [HKICK, HKICK2],
        bass: [WB1, WB1, WB2, WB1],
        lead: [RH1, null, RH2, null],
        pad: [dFm], padPump: true,
        fx: [['crash', 0, 0]],
        notes: ['d.f.j.k.d.f.j.k.','k...j...f...d...','d.j.d.j.f.k.f.k.',['d...f...j...k...','j...k...d...f...'],
                'df..jk..df..jk..','k...f...j...d...','d.f.j.k.j.f.d...',['d.f.j.k.d.f.j.k.','............k...']] },
      { bars: 4, energy: 0.3, hat: HOFF,
        pad: [dFm],
        arp: [arp16Of(36,39,41,43)],
        notes: ['d...f...j...k...','k...j...f...d...','d.f.....j.k.....', E16] },
      { bars: 8, energy: 1.0, snare: HSNARE, hat: HHAT2,
        kick: [HKICK, HKICK2],
        bass: [WB2, WB1],
        lead: [RH1, RH2],
        pad: [dFm], padPump: true,
        fx: [['crash', 0, 0]],
        notes: ['d.f.j.k.d.f.j.k.','df..jk..df..jk..','k.j.f.d.k.j.f.d.','jk..df..jk..df..',
                'd.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...'],'df..jk..kj..fd..','dfjk....dfjk....'] },
      { bars: 2, energy: 0.2, kick: ['x...............', 'x...............'],
        fx: [['impact', 0, 0]], notes: [E16, E16] }
    ]
  }
];

/* ---------- sequencing ---------- */

function barPat(p, b) {
  if (!p) return null;
  return Array.isArray(p) ? p[b % p.length] : p;
}

function buildEvents(tr) {
  const ev = [];
  let bar = 0;
  for (const sec of tr.sections) {
    for (let b = 0; b < sec.bars; b++) {
      const base = (bar + b) * 4;
      const chord = sec.chordSeq ? sec.chordSeq[b % sec.chordSeq.length] : 0;
      const drum = (pat, f) => {
        const p = barPat(pat, b);
        if (!p) return;
        for (let s = 0; s < 16; s++) {
          if (p[s] === 'x') ev.push({ b: base + s / 4, f });
          else if (p[s] === 'o' && f === 'hat') ev.push({ b: base + s / 4, f, open: true });
          else if (p[s] === 'X' && f === 'shaker') ev.push({ b: base + s / 4, f, acc: true });
          else if (p[s] === 'x' && f === 'shaker') ev.push({ b: base + s / 4, f });
        }
      };
      drum(sec.kick, 'kick'); drum(sec.clap, 'clap'); drum(sec.snare, 'snare');
      drum(sec.hat, 'hat'); drum(sec.shakerp, 'shaker');
      const mel = (pat, f) => {
        const p = pat ? pat[b % pat.length] : null;
        if (!p) return;
        for (const e of p) ev.push({ b: base + e[0] / 4, f, semi: e[1] + (f === 'bass' ? chord : 0), len: e[2], acc: !!e[3] });
      };
      mel(sec.bass, 'bass'); mel(sec.lead, 'lead'); mel(sec.pluckp, 'pluck');
      mel(sec.arp, 'arp'); mel(sec.bellp, 'bell');
      const st = sec.stabp ? sec.stabp[b % sec.stabp.length] : null;
      if (st) for (const e of st) ev.push({ b: base + e[0] / 4, f: 'stab', semis: e[1], len: e[2] });
      const pd = sec.pad ? sec.pad[b % sec.pad.length] : null;
      if (pd) ev.push({ b: base, f: 'pad', semis: pd, len: 16, pump: !!sec.padPump });
      if (sec.fx && b === 0) for (const fx of sec.fx) ev.push({ b: base + fx[1], f: fx[0], len: fx[2] });
    }
    bar += sec.bars;
  }
  ev.sort((a, c) => a.b - c.b);
  return { ev, totalBeats: bar * 4 };
}

function buildNotes(i) {
  const tr = TRACKS[i];
  const spb = 60 / tr.bpm;
  const notes = [];
  let bar = 0;
  for (const sec of tr.sections) {
    for (let b = 0; b < sec.bars; b++) {
      const base = (bar + b) * 4;
      let pats = sec.notes ? sec.notes[b % sec.notes.length] : null;
      if (!pats) continue;
      if (typeof pats === 'string') pats = [pats];
      for (const pat of pats) {
        for (let s = 0; s < 16; s++) {
          const lane = 'dfjk'.indexOf(pat[s]);
          if (lane >= 0) {
            const beat = base + s / 4;
            notes.push({ beat, time: beat * spb, lane });
          }
        }
      }
    }
    bar += sec.bars;
  }
  notes.sort((a, c) => a.time - c.time);
  return notes;
}

function trackInfo(i) {
  const tr = TRACKS[i];
  let bars = 0;
  const secs = tr.sections.map(s => {
    const o = { startBeat: bars * 4, endBeat: (bars + s.bars) * 4, energy: s.energy || 0.3 };
    bars += s.bars;
    return o;
  });
  return {
    id: tr.id, name: tr.name, sub: tr.sub, bpm: tr.bpm, hue: tr.hue,
    approach: tr.approach, stars: tr.stars,
    duration: bars * 4 * 60 / tr.bpm, sections: secs
  };
}

function fire(e, t, tr) {
  const kit = tr.kit || {};
  const spb = 60 / tr.bpm;
  const root = tr.rootHz;
  const hz = s => root * Math.pow(2, s / 12);
  switch (e.f) {
    case 'kick': kick(t, kit.kick); break;
    case 'clap': clap(t); break;
    case 'snare': snare(t); break;
    case 'hat': hat(t, e.open); break;
    case 'shaker': shaker(t, e.acc); break;
    case 'crash': crash(t); break;
    case 'bass': bass(t, hz(e.semi), e.len * spb / 4 * 0.95, Object.assign({ acc: e.acc }, kit.bass)); break;
    case 'lead': lead(t, hz(e.semi), e.len * spb / 4 * 0.95, kit.lead); break;
    case 'pluck': case 'arp': pluck(t, hz(e.semi), Math.max(0.22, e.len * spb / 4), kit.pluck); break;
    case 'bell': bell(t, hz(e.semi), Math.max(0.5, e.len * spb / 4), kit.bell); break;
    case 'stab': stab(t, e.semis.map(hz), Math.max(0.18, e.len * spb / 4), kit.stab); break;
    case 'pad': pad(t, e.semis.map(hz), e.len * spb / 4, Object.assign({ pump: e.pump, spb }, kit.pad)); break;
    case 'riser': riser(t, e.len * spb); break;
    case 'impact': impact(t); break;
  }
}

function start(tr) {
  unlock();
  stopInternal();
  const built = buildEvents(tr);
  cur = tr;
  cur._events = built.ev;
  cur._totalBeats = built.totalBeats;
  evPtr = 0;
  startAt = ctx.currentTime + 0.9;
  playing = true;
  busM.gain.cancelScheduledValues(ctx.currentTime);
  busM.gain.setValueAtTime(1, ctx.currentTime);
  delayNode.delayTime.value = 60 / tr.bpm * 0.75;
  schedTimer = setInterval(schedule, 25);
  schedule();
}

function schedule() {
  if (!playing || !cur) return;
  const spb = 60 / cur.bpm;
  const horizon = ctx.currentTime + 0.14;
  while (true) {
    if (evPtr >= cur._events.length) {
      if (cur.loop) {
        startAt += cur._totalBeats * spb;
        evPtr = 0;
      } else break;
    }
    const e = cur._events[evPtr];
    const t = startAt + e.b * spb;
    if (t > horizon) break;
    if (t >= ctx.currentTime - 0.02) fire(e, Math.max(t, ctx.currentTime + 0.001), cur);
    evPtr++;
  }
}

function stopInternal() {
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  playing = false;
  cur = null;
}

function stop(fade) {
  if (!ctx) return;
  if (fade && busM) {
    busM.gain.cancelScheduledValues(ctx.currentTime);
    busM.gain.setValueAtTime(busM.gain.value, ctx.currentTime);
    busM.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  }
  stopInternal();
}

/* ---------- SFX (immediate) ---------- */

function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.001;
  switch (name) {
    case 'punch':
      noiseHit(t, 0.07, 1100, 'bandpass', 0.8, 0.8, busS);
      tone(t, 84, 0.09, 'sine', 0.9);
      break;
    case 'punchPerfect':
      noiseHit(t, 0.06, 1400, 'bandpass', 0.85, 0.8, busS);
      tone(t, 90, 0.1, 'sine', 1.0);
      noiseHit(t, 0.03, 5200, 'highpass', 0.4, 1, busS);
      break;
    case 'whiff':
      noiseHit(t, 0.09, 2400, 'bandpass', 0.16, 2.2, busS);
      break;
    case 'hurt': {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(65, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(busS); o.start(t); o.stop(t + 0.28);
      noiseHit(t, 0.12, 700, 'lowpass', 0.3, 1, busS);
      break;
    }
    case 'uiMove': tone(t, 520, 0.05, 'square', 0.1); break;
    case 'uiSel':
      tone(t, 660, 0.07, 'square', 0.12);
      tone(t + 0.07, 880, 0.11, 'square', 0.12);
      break;
    case 'uiBack': tone(t, 392, 0.09, 'square', 0.1); break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.22, 'square', 0.12));
      break;
    case 'lose':
      [330, 277, 220, 165].forEach((f, i) => tone(t + i * 0.14, f, 0.3, 'sawtooth', 0.14));
      break;
  }
}

/* ---------- public API ---------- */

return {
  unlock,
  play: i => start(TRACKS[i]),
  playMenu: () => start(MENU),
  stop,
  sfx,
  buildNotes,
  trackInfo,
  trackCount: () => TRACKS.length,
  time: () => (playing && ctx) ? ctx.currentTime - startAt : -999,
  beat: () => (playing && cur && ctx) ? (ctx.currentTime - startAt) * cur.bpm / 60 : 0,
  isPlaying: () => playing,
  pause: () => { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume: () => { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  setMuted: m => { muted = m; if (master) master.gain.value = muted ? 0 : volume; },
  getMuted: () => muted
};

})();
