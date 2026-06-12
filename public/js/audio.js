/* MALMÖ UNDERGROUND — audio engine.
   All music is synthesized live via Web Audio (no audio files).
   Tracks are pattern-sequenced on a 16th-note grid; gameplay notes are
   authored on the same grid so every punch lands on the music. */
'use strict';

const MUAudio = (() => {

let ctx = null, busM = null, busS = null, master = null, comp = null;
let delayNode = null, dSend = null;
let noiseBuf = null;
let cur = null;        // currently playing track object
let events = [], evPtr = 0, startAt = 0, schedTimer = null;
let playing = false;
let volume = 0.85, muted = false;

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5;
  comp.attack.value = 0.004; comp.release.value = 0.16;
  busM = ctx.createGain(); busM.gain.value = 1;
  busS = ctx.createGain(); busS.gain.value = 1;
  busM.connect(master); busS.connect(master);
  master.connect(comp); comp.connect(ctx.destination);
  // feedback delay for leads/plucks
  delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.36;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const tame = ctx.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 3000;
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  dSend = ctx.createGain(); dSend.gain.value = 1;
  dSend.connect(delayNode);
  delayNode.connect(tame); tame.connect(fb); fb.connect(delayNode);
  delayNode.connect(wet); wet.connect(busM);
}

function unlock() { ensure(); if (ctx.state !== 'running') ctx.resume(); }

function getNoise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, (ctx.sampleRate * 1.2) | 0, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/* ---------- instruments (scheduled at absolute ctx time t) ---------- */

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
  o.connect(g); g.connect(dest || busM);
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
  const v = o.gain || 1.0, d = o.decay || 0.26;
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(o.drop || 150, t);
  osc.frequency.exponentialRampToValueAtTime(o.tail || 44, t + 0.085);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  osc.connect(g); g.connect(busM);
  osc.start(t); osc.stop(t + d + 0.02);
  noiseHit(t, 0.012, 4200, 'highpass', 0.45 * v);
  if (o.dist) {
    const o2 = ctx.createOscillator(); o2.type = 'square';
    o2.frequency.setValueAtTime((o.drop || 150) * 0.9, t);
    o2.frequency.exponentialRampToValueAtTime(o.tail || 44, t + 0.1);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve();
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.4 * v, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + d * 0.85);
    o2.connect(ws); ws.connect(g2); g2.connect(busM);
    o2.start(t); o2.stop(t + d);
  }
}

function clap(t, vol) {
  vol = vol || 0.55;
  for (let i = 0; i < 3; i++) noiseHit(t + i * 0.011, 0.024, 1500, 'bandpass', vol * 0.5, 1.4);
  noiseHit(t + 0.03, 0.2, 1700, 'bandpass', vol, 1.1);
}

function hat(t, open, vol) {
  noiseHit(t, open ? 0.22 : 0.045, 8500, 'highpass', vol || 0.22);
}

function snare(t, vol) {
  vol = vol || 0.6;
  noiseHit(t, 0.15, 1900, 'bandpass', vol, 0.8);
  tone(t, 200, 0.1, 'triangle', vol * 0.6);
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
  if (o.sub) {
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
  const v = o.gain || 0.13;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.014);
  g.gain.setValueAtTime(v, t + Math.max(0.02, len - 0.05));
  g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.06);
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
  flt.frequency.value = o.cut || 5200; flt.Q.value = 0.7;
  g.connect(flt); flt.connect(busM);
  const det = o.det || 14;
  [-det, 0, det].forEach(dc => {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.value = f; osc.detune.value = dc;
    osc.connect(g); osc.start(t); osc.stop(t + len + 0.1);
  });
  if (o.echo) {
    const e = ctx.createGain(); e.gain.value = o.echo;
    flt.connect(e); e.connect(dSend);
  }
}

function pluck(t, f, len, o) {
  o = o || {};
  const v = o.gain || 0.12;
  const osc = ctx.createOscillator(); osc.type = o.type || 'square'; osc.frequency.value = f;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1;
  flt.frequency.setValueAtTime(4200, t);
  flt.frequency.exponentialRampToValueAtTime(700, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(flt); flt.connect(g); g.connect(busM);
  const e = ctx.createGain(); e.gain.value = 0.5;
  g.connect(e); e.connect(dSend);
  osc.start(t); osc.stop(t + len + 0.04);
}

function pad(t, fs, len, o) {
  o = o || {};
  const atk = Math.min(0.5, len * 0.25);
  fs.forEach(f => {
    [-7, 7].forEach(dc => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = f; osc.detune.value = dc;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1300;
      const g = ctx.createGain();
      const v = o.gain || 0.035;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + atk);
      g.gain.setValueAtTime(v, t + len * 0.8);
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
  g.gain.exponentialRampToValueAtTime(0.3, t + len);
  g.gain.setValueAtTime(0.3, t + len);
  g.gain.linearRampToValueAtTime(0, t + len + 0.05);
  s.connect(f); f.connect(g); g.connect(busM);
  s.start(t); s.stop(t + len + 0.1);
}

function impact(t) {
  kick(t, { drop: 200, tail: 35, decay: 0.7, gain: 1.1 });
  noiseHit(t, 0.8, 500, 'lowpass', 0.5);
}

/* ---------- track data ---------- */
/* drum patterns: 16 chars per bar ('x' hit, 'o' open hat, '.' rest); string or per-bar array.
   bass/lead/pluck: per-bar arrays of [step, semitone, lenSteps, accent?]; null bar = silence.
   pad: per-bar array of semitone chords (held one bar); null = none.
   chordSeq: per-bar semitone offset applied to bass + pad.
   notes: per-bar gameplay chart, 16ths, chars d/f/j/k; array of strings = overlay (doubles). */

const K4 = 'x...x...x...x...';
const CL = '....x.......x...';
const HOFF = '..x...x...x...x.';
const HOPEN = '..o...o...o...o.';
const H8 = 'x.x.x.x.x.x.x.x.';
const H16 = 'xxxxxxxxxxxxxxxx';
const E16 = '................';

const BOCT = [[0,0,1],[2,12,1],[4,0,1],[6,12,1],[8,0,1],[10,12,1],[12,0,1],[14,12,1]];
const B16A = [[0,0,1,1],[2,0,1],[4,12,1],[6,0,1],[8,0,1,1],[10,12,1],[12,0,1],[14,12,1]];

// acid bars (track 2)
const AB1 = [[0,0,1,1],[2,0,1],[3,12,1],[4,0,1],[6,0,1],[7,12,1],[8,0,1,1],[10,15,1],[11,12,1],[12,0,1],[14,12,1],[15,0,1]];
const AB2 = [[0,0,1,1],[2,0,1],[3,12,1],[4,0,1],[6,17,1],[7,15,1],[8,12,1,1],[10,0,1],[12,0,1],[13,12,1],[14,15,1],[15,12,1]];
const ST  = [[2,24,1],[2,27,1],[2,31,1],[10,24,1],[10,27,1],[10,31,1]];

// offbeat hardstyle bass (track 3)
const OB = [[2,0,2,1],[6,0,2,1],[10,0,2,1],[14,0,2,1]];

// track 1 lead phrases (E minor pentatonic)
const T1LA = [[0,36,2],[2,39,1],[4,43,2],[8,46,2],[10,43,1],[12,41,2],[14,39,1]];
const T1LB = [[0,41,2],[4,39,2],[8,36,4],[12,34,2]];
const T1LC = [[0,41,2],[4,43,2],[8,46,4],[12,48,2]];

// track 3 anthem phrases (F minor pentatonic)
const T3A1 = [[0,36,3],[4,39,3],[8,43,4],[12,41,3]];
const T3A2 = [[0,39,3],[4,43,3],[8,48,6]];
const T3A3 = [[0,43,2],[2,41,1],[4,39,2],[8,36,4],[12,34,2]];

const MENU = {
  name: 'LOBBY', bpm: 104, rootHz: 41.2, loop: true,
  kit: { bass: { cut: 700, gain: 0.3, q: 2 } },
  sections: [{
    bars: 4, energy: 0.15,
    hat: HOFF,
    kick: ['................','................', K4, K4],
    pad: [[12,19,27,34], null, [8+12,8+19,8+27], null],
    pluck: [null, [[0,36,2],[6,39,1],[8,43,2]], null, [[0,43,2],[6,41,1],[8,39,2],[12,36,2]]],
    notes: [E16, E16, E16, E16]
  }]
};

const TRACKS = [
  {
    id: 'neon', name: 'NEON TUNNELBANA', sub: 'deep rave · 124 BPM',
    bpm: 124, rootHz: 41.2, hue: 195, approach: 1.9, stars: 1,
    kit: {
      kick: { drop: 150, tail: 44, decay: 0.27 },
      bass: { cut: 1100, q: 3, gain: 0.4, sub: true },
      lead: { gain: 0.12, cut: 4800, echo: 0.35 }
    },
    sections: [
      { bars: 4, energy: 0.15, hat: HOFF,
        pad: [[12,19,27,34]],
        pluck: [null, null, [[0,36,2],[4,43,2],[8,39,2],[12,46,2]], [[0,36,2],[4,43,2],[8,39,2],[12,46,2]]],
        notes: [E16, E16, 'd.......f.......', 'j.......k.......'] },
      { bars: 8, energy: 0.4, kick: K4, hat: HOFF, clap: CL,
        bass: [BOCT], chordSeq: [0,0,8,8,3,3,10,10],
        pad: [[12,19,27], null],
        notes: ['d...f...j...k...','f...j...k...j...','d...f...j...k...','k...j...f...d...',
                'd...f...j...k.j.','f...j...k.j.f...','d...f...j...k...','d.f.j.k.j.f.d...'] },
      { bars: 4, energy: 0.6, kick: K4, hat: H8,
        clap: [CL, CL, K4, H8],
        bass: [BOCT], chordSeq: [0,0,10,10],
        fx: [['riser', 0, 16]],
        notes: ['d...d...f...f...','j...j...k...k...','d.d.f.f.j.j.k.k.','d.f.j.k.........'] },
      { bars: 8, energy: 0.9, kick: K4, hat: HOPEN, clap: CL,
        bass: [B16A], chordSeq: [0,0,8,8,3,3,10,10],
        lead: [T1LA, T1LB],
        notes: ['d.f.j...k.j.f...','d...f.j.k...j.f.','j.k.f...d.f.j...',['d...f...j...k...','............d...'],
                'k.j.f...d.f.j...','f...j.k.d...f.j.','d.f.j...k.j.f...',['d.f.j.k.........','k.......d.......']] },
      { bars: 4, energy: 0.3, hat: CL,
        pad: [[12,19,27,34]], chordSeq: [0,8,3,10],
        pluck: [[[0,43,2],[6,41,1],[8,39,2],[14,36,1]]],
        notes: ['d.......j.......','f.......k.......','d.....f.........','j.....k.........'] },
      { bars: 8, energy: 1.0, kick: K4, hat: H16, clap: CL,
        bass: [B16A], chordSeq: [0,0,8,8,3,3,10,10],
        lead: [T1LA, T1LB, T1LA, T1LC],
        notes: ['d.f.j.k.d.f.j.k.','k.j.f.d.k.j.f.d.','d.f.j...k.j.f...',['d...j...f...k...','f...........d...'],
                'd.j.d.j.f.k.f.k.','j.f.k.d.j.f.k.d.','d.f.j.k.j.f.d...',['d.f.j.k.........','k.j.f.d.........']] },
      { bars: 2, energy: 0.2, kick: [K4, 'x...............'],
        pad: [[12,19,27]], notes: [E16, E16] }
    ]
  },
  {
    id: 'mollan', name: 'MÖLLAN MASSIV', sub: 'acid techno · 138 BPM',
    bpm: 138, rootHz: 55.0, hue: 315, approach: 1.75, stars: 2,
    kit: {
      kick: { drop: 160, tail: 46, decay: 0.24 },
      bass: { cut: 680, q: 13, gain: 0.34, type: 'sawtooth' },
      lead: { gain: 0.1, cut: 3600, echo: 0.3, det: 10 }
    },
    sections: [
      { bars: 4, energy: 0.2, hat: H8,
        kick: [E16.replace(/x/g,'.'), E16, K4, K4],
        bass: [null, null, AB1, AB1],
        notes: [E16, E16, 'd...j...........', 'f...k...........'] },
      { bars: 8, energy: 0.45, kick: K4, hat: HOFF, clap: CL,
        bass: [AB1, AB1, AB1, AB2],
        notes: ['d..d....f..f....','j..j....k..k....','d..d....f..f....','j...k...j.k.f...',
                'd..d..f.j..j..k.','f..f..d.k..k..j.','d...f...j...k...','d.f.d.f.j.k.j.k.'] },
      { bars: 4, energy: 0.65, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [AB1],
        fx: [['riser', 0, 16]],
        notes: ['d...d...f...f...','j...j...k...k...','d.f.j.k.d.f.j.k.','j.k.j.k.........'] },
      { bars: 8, energy: 0.95, kick: K4, hat: HOPEN, clap: CL,
        bass: [AB2, AB2, AB2, AB1], chordSeq: [0,0,0,0,8,8,0,0],
        lead: [ST],
        notes: ['d.j.f.k.d.j.f.k.','d.j.f.k.d.f.j.k.','k.f.j.d.k.f.j.d.',['d...f...j...k...','j...........f...'],
                'd.d.j.j.f.f.k.k.','k.k.f.f.j.j.d.d.','d.j.f.k.d.j.f.k.',['d.f.j.k.d.f.j.k.','............k.d.']] },
      { bars: 4, energy: 0.25, hat: HOFF,
        pad: [[12,15,19,24]], chordSeq: [0,0,8,8],
        pluck: [[[0,36,1],[4,39,1],[8,43,1],[12,46,1]]],
        notes: ['d.......f.......','j.......k.......','d...f...j...k...', E16] },
      { bars: 8, energy: 1.0, kick: K4, hat: H8, clap: CL,
        bass: [AB2, AB1, AB2, AB1],
        lead: [ST],
        notes: ['d.j.f.k.j.d.k.f.','df..jk..df..jk..','d.j.f.k.j.d.k.f.','jk..df..jk..df..',
                'd.f.j.k.k.j.f.d.','df..jk..fd..kj..','d.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...']] },
      { bars: 2, energy: 0.2, kick: [K4, 'x...............'], notes: [E16, E16] }
    ]
  },
  {
    id: 'triangeln', name: 'TRIANGELN OVERDRIVE', sub: 'hard dance · 150 BPM',
    bpm: 150, rootHz: 43.65, hue: 25, approach: 1.6, stars: 3,
    kit: {
      kick: { drop: 170, tail: 42, decay: 0.32, dist: true },
      bass: { cut: 1500, q: 4, gain: 0.36, sub: true },
      lead: { gain: 0.15, cut: 6000, echo: 0.25, det: 18 }
    },
    sections: [
      { bars: 4, energy: 0.25, kick: K4,
        pad: [[12,15,19]],
        notes: [E16, 'd.......j.......', 'f.......k.......', 'd...f...j...k...'] },
      { bars: 8, energy: 0.55, kick: K4, hat: HOFF, clap: CL,
        bass: [OB],
        notes: ['d...f...j...k...','d...f...j...k.j.','d.f.....j.k.....','d...j...f...k...',
                'd.f.j.k.d...k...','f.d.k.j.f...j...','d...f.j.k...j.f.','d.f.j.k.j.f.d...'] },
      { bars: 4, energy: 0.7, kick: K4, hat: H8,
        snare: [CL, '....x...x...x...', H8, H16],
        bass: [OB],
        fx: [['riser', 0, 16]],
        notes: ['d.d.f.f.j.j.k.k.','k.k.j.j.f.f.d.d.','d.f.j.k.d.f.j.k.','df..jk..........'] },
      { bars: 8, energy: 1.0, kick: K4, hat: HOPEN,
        bass: [OB],
        lead: [T3A1, T3A2, T3A1, T3A3],
        notes: ['d.f.j.k.d.f.j.k.','k.j.f.d.k.j.f.d.','d.j.d.j.f.k.f.k.',['d...f...j...k...','j...k...d...f...'],
                'df..jk..df..jk..','kj..fd..kj..fd..','d.f.j.k.j.f.d.f.',['d.f.j.k.d.f.j.k.','........k.j.f.d.']] },
      { bars: 4, energy: 0.3, hat: HOFF,
        pad: [[12,15,19,22]],
        pluck: [[[0,36,1],[2,39,1],[4,43,1],[6,46,1],[8,48,1],[10,46,1],[12,43,1],[14,39,1]]],
        notes: ['d...f...j...k...','k...j...f...d...','d.f.....j.k.....', E16] },
      { bars: 8, energy: 1.0, hat: H8, clap: CL,
        kick: [K4, K4, K4, 'x...x...x..xx...'],
        bass: [OB],
        lead: [T3A1, T3A2],
        notes: ['d.f.j.k.d.f.j.k.','df..jk..df..jk..','k.j.f.d.k.j.f.d.','jk..df..jk..df..',
                'd.j.f.k.d.j.f.k.',['d...f...j...k...','k...j...f...d...'],'df..jk..kj..fd..','dfjk....dfjk....'] },
      { bars: 2, energy: 0.2, kick: [K4, 'x...............'],
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
      const kp = barPat(sec.kick, b);
      if (kp) for (let s = 0; s < 16; s++) if (kp[s] === 'x') ev.push({ b: base + s / 4, f: 'kick' });
      const cp = barPat(sec.clap, b);
      if (cp) for (let s = 0; s < 16; s++) if (cp[s] === 'x') ev.push({ b: base + s / 4, f: 'clap' });
      const sp = barPat(sec.snare, b);
      if (sp) for (let s = 0; s < 16; s++) if (sp[s] === 'x') ev.push({ b: base + s / 4, f: 'snare' });
      const hp = barPat(sec.hat, b);
      if (hp) for (let s = 0; s < 16; s++) {
        if (hp[s] === 'x') ev.push({ b: base + s / 4, f: 'hat', open: false });
        else if (hp[s] === 'o') ev.push({ b: base + s / 4, f: 'hat', open: true });
      }
      const bb = sec.bass ? sec.bass[b % sec.bass.length] : null;
      if (bb) for (const e of bb) ev.push({ b: base + e[0] / 4, f: 'bass', semi: e[1] + chord, len: e[2], acc: !!e[3] });
      const lb = sec.lead ? sec.lead[b % sec.lead.length] : null;
      if (lb) for (const e of lb) ev.push({ b: base + e[0] / 4, f: 'lead', semi: e[1], len: e[2] });
      const pb = sec.pluck ? sec.pluck[b % sec.pluck.length] : null;
      if (pb) for (const e of pb) ev.push({ b: base + e[0] / 4, f: 'pluck', semi: e[1], len: e[2] });
      const pd = sec.pad ? sec.pad[b % sec.pad.length] : null;
      if (pd) ev.push({ b: base, f: 'pad', semis: pd.map(s => s + chord), len: 16 });
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
          const c = pat[s];
          const lane = 'dfjk'.indexOf(c);
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
    name: tr.name, sub: tr.sub, bpm: tr.bpm, hue: tr.hue,
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
    case 'bass': bass(t, hz(e.semi), e.len * spb / 4 * 0.95, Object.assign({ acc: e.acc }, kit.bass)); break;
    case 'lead': lead(t, hz(e.semi), e.len * spb / 4 * 0.95, kit.lead); break;
    case 'pluck': pluck(t, hz(e.semi), Math.max(0.25, e.len * spb / 4) , kit.pluck); break;
    case 'pad': pad(t, e.semis.map(hz), e.len * spb / 4, kit.pad); break;
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
      tone(t, 84, 0.09, 'sine', 0.9, busS);
      break;
    case 'punchPerfect':
      noiseHit(t, 0.06, 1400, 'bandpass', 0.85, 0.8, busS);
      tone(t, 90, 0.1, 'sine', 1.0, busS);
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
    case 'uiMove': tone(t, 520, 0.05, 'square', 0.1, busS); break;
    case 'uiSel':
      tone(t, 660, 0.07, 'square', 0.12, busS);
      tone(t + 0.07, 880, 0.11, 'square', 0.12, busS);
      break;
    case 'uiBack': tone(t, 392, 0.09, 'square', 0.1, busS); break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.22, 'square', 0.12, busS));
      break;
    case 'lose':
      [330, 277, 220, 165].forEach((f, i) => tone(t + i * 0.14, f, 0.3, 'sawtooth', 0.14, busS));
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
