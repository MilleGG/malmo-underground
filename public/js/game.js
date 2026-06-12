/* MALMÖ UNDERGROUND — game core v2.
   Enemies rush in on four rows carrying D/F/J/K badges; punch them on the beat.
   Timing readability: approach rings close on the badge exactly at the hit
   moment, and a strike zone pulses on the beat at the impact line. */
'use strict';

(() => {

const W = 1280, H = 720;
const LANE_KEYS = ['D', 'F', 'J', 'K'];
const LANE_CODES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const LANE_COL = ['#3ee6ff', '#ff4fd8', '#ffd24a', '#7dff5e'];
const ROW_Y = [398, 452, 506, 560];
const ROW_SC = [0.8, 0.87, 0.94, 1.0];
const PLAYER_X = 285, HIT_X = 430, SPAWN_X = 1370;
const PERF_WIN = 0.085, GOOD_WIN = 0.18;
/* difficulty tiers: hard = charts as authored; normal/easy are thinned */
const DIFFS = [
  { id: 'easy', name: 'EASY', col: '#7dff5e', dmg: 6, scoreMult: 0.8 },
  { id: 'normal', name: 'NORMAL', col: '#3ee6ff', dmg: 9, scoreMult: 1.0 },
  { id: 'hard', name: 'HARD', col: '#ff5d5d', dmg: 12, scoreMult: 1.25 }
];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let scale = 1, ox = 0, oy = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  scale = Math.min(innerWidth / W, innerHeight / H);
  ox = (innerWidth - W * scale) / 2;
  oy = (innerHeight - H * scale) / 2;
}
addEventListener('resize', resize);
resize();

const { CHARS, drawFighter, drawEnemy, drawKeyBadge, drawBG, vignette, lerp, clamp, easeOut } = MUArt;

const S = {
  scene: 'title',
  t: 0,
  selChar: 0,
  selSong: 0,
  selDiff: 1,
  diffOpen: false,
  audioOn: false
};
let P = null;

/* ---------------- helpers ---------------- */

function neon(c, str, x, y, size, col, blur, font) {
  c.font = `${size}px ${font || '"Bungee"'}, Impact, sans-serif`;
  c.textAlign = 'center';
  c.shadowColor = col; c.shadowBlur = blur === undefined ? 18 : blur;
  c.fillStyle = '#fff';
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, size / 30);
  c.strokeText(str, x, y);
  c.fillText(str, x, y);
  c.shadowBlur = 0;
}

function txt(c, str, x, y, size, col, align, font) {
  c.font = `${size}px ${font || '"Russo One"'}, sans-serif`;
  c.textAlign = align || 'center';
  c.fillStyle = col;
  c.fillText(str, x, y);
}

function bestKey(songIdx, diffIdx) {
  return 'mu_best_' + MUAudio.trackInfo(songIdx).id + '_' + DIFFS[diffIdx].id;
}
function loadBest(songIdx, diffIdx) {
  try { return JSON.parse(localStorage.getItem(bestKey(songIdx, diffIdx))); } catch (e) { return null; }
}
function saveBest(songIdx, diffIdx, rec) {
  try { localStorage.setItem(bestKey(songIdx, diffIdx), JSON.stringify(rec)); } catch (e) {}
}
function bestAny(songIdx) {
  let top = null;
  for (let d = 0; d < 3; d++) {
    const b = loadBest(songIdx, d);
    if (b && (!top || b.score > top.score)) top = Object.assign({ diff: DIFFS[d].name }, b);
  }
  return top;
}

/* hard = full chart; normal = 8ths max, no doubles, ≥0.27s between notes;
   easy = quarters only, no doubles, ≥0.55s between notes (scales with BPM) */
function filterNotes(raw, diffId) {
  if (diffId === 'hard') return raw;
  const eighth = diffId === 'normal';
  const minGapT = eighth ? 0.27 : 0.55;
  const out = [];
  let lastT = -9;
  for (const n of raw) {
    const q = Math.round(n.beat * 4);
    if (eighth ? (q % 2 !== 0) : (q % 4 !== 0)) continue;
    if (n.time - lastT < minGapT - 1e-6) continue;
    out.push(n);
    lastT = n.time;
  }
  return out;
}

function ensureAudio() {
  MUAudio.unlock();
  if (!S.audioOn) { S.audioOn = true; MUAudio.playMenu(); }
}

/* ---------------- play state ---------------- */

function startPlay() {
  const songIdx = S.selSong, charIdx = S.selChar;
  const diff = DIFFS[S.selDiff];
  const raw = filterNotes(MUAudio.buildNotes(songIdx), diff.id);
  const info = MUAudio.trackInfo(songIdx);
  const ch = CHARS[charIdx];
  P = {
    songIdx, charIdx, info, diffIdx: S.selDiff, diff,
    notes: raw.map((n, i) => ({
      time: n.time, beat: n.beat, lane: n.lane, state: 'wait',
      v: (i * 7 + n.lane) % 3, seed: i * 1.7,
      px: 0, py: 0, vx: 0, vy: 0, rot: 0, vr: 0
    })),
    spawnIdx: 0, active: [],
    score: 0, combo: 0, maxCombo: 0,
    hp: ch.hp, maxHp: ch.hp,
    counts: { perfect: 0, good: 0, miss: 0 },
    row: 1, rowFrom: 1, rowT: 1,
    pose: { kind: 'idle', t0: -9 },
    parts: [], texts: [],
    shake: 0, flash: 0,
    paused: false, autoplay: false,
    comboPop: 0, newBest: false,
    now: -0.9 // smoothed song clock (drift-corrected toward audio clock)
  };
  MUAudio.play(songIdx);
  S.scene = 'play';
}

const POWS = ['POW!', 'WHAM!', 'SMACK!', 'BOOM!', 'CRACK!'];

function judge(lane) {
  if (!P || P.paused) return;
  const now = MUAudio.time();
  const ch = CHARS[P.charIdx];
  const win = GOOD_WIN * ch.winMult;
  let best = null, bd = 1e9, bdSigned = 0;
  for (const n of P.active) {
    if (n.state !== 'wait' || n.lane !== lane) continue;
    const d = Math.abs(n.time - now);
    if (d < bd) { bd = d; bdSigned = n.time - now; best = n; }
  }
  P.pose = { kind: 'punch', t0: S.t };
  if (P.rowT >= 1) { P.rowFrom = P.row; }
  P.row = lane; P.rowT = 0;
  if (!best || bd > win) {
    MUAudio.sfx('whiff');
    return;
  }
  const perfect = bd <= PERF_WIN * ch.winMult;
  best.state = 'dying';
  best.px = xFor(best, now);
  best.py = 0;
  best.vx = 500 + Math.random() * 400;
  best.vy = -(420 + Math.random() * 380);
  best.vr = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 7);
  P.combo++;
  P.maxCombo = Math.max(P.maxCombo, P.combo);
  P.comboPop = 1;
  const mult = 1 + Math.min(P.combo, 100) * 0.02;
  P.score += Math.round((perfect ? 300 : 120) * mult * ch.scoreMult * P.diff.scoreMult);
  P.hp = Math.min(P.maxHp, P.hp + 0.8);
  if (perfect) P.counts.perfect++; else P.counts.good++;
  const ry = ROW_Y[lane];
  P.texts.push({
    x: HIT_X + 50, y: ry - 195, t0: S.t, size: perfect ? 30 : 24,
    str: perfect ? 'PERFECT!' : 'GOOD', col: perfect ? '#ffd24a' : '#3ee6ff', rot: 0
  });
  if (!perfect) {
    // early/late micro-feedback teaches the timing
    P.texts.push({
      x: HIT_X + 50, y: ry - 165, t0: S.t, size: 14,
      str: bdSigned > 0 ? 'EARLY' : 'LATE', col: 'rgba(255,255,255,0.75)', rot: 0
    });
  }
  if (perfect && Math.random() < 0.55) {
    P.texts.push({
      x: HIT_X + 90 + Math.random() * 60, y: ry - 120, t0: S.t, size: 40,
      str: POWS[(Math.random() * POWS.length) | 0], col: LANE_COL[lane],
      rot: (Math.random() - 0.5) * 0.5, pow: true
    });
  }
  burst(HIT_X + 30, ry - 90 * ROW_SC[lane], LANE_COL[lane], perfect ? 16 : 9);
  P.shake = perfect ? 7 : 4;
  if (perfect) P.flash = 0.12;
  MUAudio.sfx(perfect ? 'punchPerfect' : 'punch');
}

function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 250 + Math.random() * 500;
    P.parts.push({
      x, y, vx: Math.cos(a) * sp + 200, vy: Math.sin(a) * sp - 120,
      life: 0.45 + Math.random() * 0.25, t: 0, col, w: 2 + Math.random() * 3
    });
  }
  P.parts.push({ x, y, ring: true, life: 0.3, t: 0, col, w: 0 });
}

function xFor(n, now) {
  return HIT_X + (n.time - now) / P.info.approach * (SPAWN_X - HIT_X);
}

function finishSong() {
  MUAudio.stop();
  MUAudio.sfx('win');
  const total = P.notes.length;
  const acc = total ? (P.counts.perfect + 0.55 * P.counts.good) / total : 0;
  const rank = (P.counts.miss === 0 && acc >= 0.96) ? 'S'
    : acc >= 0.92 ? 'A' : acc >= 0.84 ? 'B' : acc >= 0.7 ? 'C' : 'D';
  P.acc = acc; P.rank = rank;
  const prev = loadBest(P.songIdx, P.diffIdx);
  if (!prev || P.score > prev.score) {
    P.newBest = true;
    saveBest(P.songIdx, P.diffIdx, { score: P.score, rank, acc: Math.round(acc * 100), charId: CHARS[P.charIdx].id });
  }
  S.scene = 'results';
}

function gameOver() {
  MUAudio.stop(true);
  MUAudio.sfx('lose');
  S.scene = 'gameover';
}

/* ---------------- update ---------------- */

function update(dt) {
  S.t += dt;
  if (S.scene !== 'play' || !P || P.paused) return;
  const audioNow = MUAudio.time();
  // smooth clock: advance by frame dt, gently steered toward the audio clock
  P.now += dt;
  const drift = audioNow - P.now;
  if (Math.abs(drift) > 0.1) P.now = audioNow;
  else P.now += drift * 0.08;
  const now = audioNow; // judging always uses the raw audio clock

  if (P.autoplay) {
    for (const n of P.active) {
      if (n.state === 'wait' && now >= n.time - 0.004) judge(n.lane);
    }
  }

  while (P.spawnIdx < P.notes.length && P.notes[P.spawnIdx].time - now <= P.info.approach + 0.05) {
    P.active.push(P.notes[P.spawnIdx]);
    P.spawnIdx++;
  }

  const ch = CHARS[P.charIdx];
  for (const n of P.active) {
    if (n.state === 'wait' && now > n.time + GOOD_WIN * ch.winMult) {
      n.state = 'passed';
      P.combo = 0;
      P.counts.miss++;
      P.hp -= P.diff.dmg;
      P.texts.push({ x: HIT_X + 50, y: ROW_Y[n.lane] - 195, t0: S.t, size: 26, str: 'MISS', col: '#ff5d5d', rot: 0 });
      P.pose = { kind: 'hit', t0: S.t };
      P.shake = 5;
      MUAudio.sfx('hurt');
    }
    if (n.state === 'dying') {
      n.px += n.vx * dt; n.py += n.vy * dt;
      n.vy += 2300 * dt;
      n.rot += n.vr * dt;
    }
  }
  P.active = P.active.filter(n => {
    if (n.state === 'dying') return n.py < 600 && n.px < 1600;
    if (n.state === 'passed') return xFor(n, P.now) > -180;
    return true;
  });

  for (const p of P.parts) {
    p.t += dt;
    if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; }
  }
  P.parts = P.parts.filter(p => p.t < p.life);
  P.texts = P.texts.filter(t => S.t - t.t0 < 0.8);

  P.rowT = Math.min(1, P.rowT + dt * 7);
  P.shake = Math.max(0, P.shake - dt * 30);
  P.flash = Math.max(0, P.flash - dt * 1.4);
  P.comboPop = Math.max(0, P.comboPop - dt * 4);

  if (P.hp <= 0) { gameOver(); return; }
  if (now > P.info.duration + 1.0) finishSong();
}

/* ---------------- render ---------------- */

function energyNow(beat) {
  if (!P) return 0.3;
  let e = 0.3;
  for (const s of P.info.sections) {
    if (beat >= s.startBeat && beat < s.endBeat) { e = s.energy; break; }
  }
  return Math.min(1, e + Math.min(P.combo / 120, 0.25));
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05030a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

  switch (S.scene) {
    case 'title': renderTitle(); break;
    case 'char': renderChar(); break;
    case 'song': renderSong(); break;
    case 'play': renderPlay(); break;
    case 'results': renderResults(); break;
    case 'gameover': renderGameOver(); break;
  }
}

function menuBeat() {
  const b = MUAudio.beat();
  return b > 0 ? b : S.t * 1.7;
}

function renderTitle() {
  drawBG(ctx, { t: S.t, beat: menuBeat(), energy: 0.45, hue: 265, flash: 0 });
  [[470, 0], [640, 1], [810, 2]].forEach(([x, i]) => {
    ctx.save();
    ctx.translate(x, 668);
    ctx.scale(0.74, 0.74);
    drawFighter(ctx, i, { kind: 'idle', beat: menuBeat() + i * 0.33 });
    ctx.restore();
  });
  const hueShift = (S.t * 40) % 360;
  neon(ctx, 'MALMÖ', W / 2, 220, 116, `hsl(${265 + Math.sin(S.t) * 20}, 100%, 65%)`, 30);
  neon(ctx, 'UNDERGROUND', W / 2, 295, 56, `hsl(${(hueShift + 180) % 360}, 100%, 60%)`, 24);
  txt(ctx, 'FIGHT TO THE BEAT', W / 2, 345, 22, 'rgba(255,255,255,0.75)');
  if (Math.sin(S.t * 4) > -0.3) txt(ctx, '— PRESS ENTER OR CLICK —', W / 2, 430, 24, '#fff');
  txt(ctx, 'D  F  J  K  =  STRIKE       M = MUTE', W / 2, 470, 15, 'rgba(255,255,255,0.45)');
  vignette(ctx);
}

const CHAR_PANELS = [[145, 110, 330, 500], [475, 110, 330, 500], [805, 110, 330, 500]];

function renderChar() {
  drawBG(ctx, { t: S.t, beat: menuBeat(), energy: 0.4, hue: 265, flash: 0 });
  ctx.fillStyle = 'rgba(3,2,8,0.55)';
  ctx.fillRect(0, 0, W, H);
  neon(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 80, 40, '#ff4fd8', 18);
  CHAR_PANELS.forEach((p, i) => {
    const sel = i === S.selChar;
    const c = CHARS[i];
    ctx.save();
    if (sel) ctx.translate(0, -6 + Math.sin(S.t * 5) * 3);
    MUArt.rr(ctx, p[0], p[1], p[2], p[3], 18);
    ctx.fillStyle = sel ? 'rgba(28,16,52,0.92)' : 'rgba(12,8,24,0.85)';
    ctx.fill();
    ctx.strokeStyle = sel ? c.theme : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = sel ? 4 : 2;
    if (sel) { ctx.shadowColor = c.theme; ctx.shadowBlur = 18; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    const cx = p[0] + p[2] / 2;
    ctx.save();
    ctx.translate(cx, p[1] + 400);
    ctx.scale(1.06, 1.06);
    drawFighter(ctx, i, { kind: sel ? 'win' : 'idle', beat: menuBeat() + i * 0.5, t: 1 });
    ctx.restore();
    neon(ctx, c.name, cx, p[1] + 440, 30, c.theme, sel ? 14 : 6);
    txt(ctx, c.epithet, cx, p[1] + 466, 13, 'rgba(255,255,255,0.7)');
    txt(ctx, c.perk, cx, p[1] + 488, 13, c.theme);
    ctx.restore();
  });
  txt(ctx, '←  →  SELECT      ENTER  GO      ESC  BACK', W / 2, 680, 16, 'rgba(255,255,255,0.55)');
  vignette(ctx);
}

const SONG_CARDS = [];
for (let i = 0; i < 6; i++) {
  SONG_CARDS.push([160 + (i % 3) * 315, 118 + Math.floor(i / 3) * 252, 300, 236]);
}
const DIFF_ROWS = [0, 1, 2].map(i => [400, 296 + i * 62, 480, 54]);

function renderSong() {
  drawBG(ctx, { t: S.t, beat: menuBeat(), energy: 0.4, hue: 265, flash: 0 });
  ctx.fillStyle = 'rgba(3,2,8,0.55)';
  ctx.fillRect(0, 0, W, H);
  neon(ctx, 'PICK YOUR TRACK', W / 2, 78, 36, '#3ee6ff', 18);
  SONG_CARDS.forEach((p, i) => {
    if (i >= MUAudio.trackCount()) return;
    const sel = i === S.selSong;
    const info = MUAudio.trackInfo(i);
    ctx.save();
    if (sel) ctx.translate(0, -4 + Math.sin(S.t * 5) * 2);
    MUArt.rr(ctx, p[0], p[1], p[2], p[3], 14);
    const hcol = `hsl(${info.hue}, 95%, 60%)`;
    ctx.fillStyle = sel ? 'rgba(28,16,52,0.92)' : 'rgba(12,8,24,0.85)';
    ctx.fill();
    ctx.strokeStyle = sel ? hcol : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = sel ? 3.5 : 2;
    if (sel) { ctx.shadowColor = hcol; ctx.shadowBlur = 16; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    const cx = p[0] + p[2] / 2;
    ctx.save();
    ctx.translate(cx, p[1] + 58);
    ctx.rotate(sel ? S.t * 1.8 : 0.4);
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0a14'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.4;
    for (let r = 12, n = 0; n < 4; r += 6, n++) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = hcol; ctx.fill();
    ctx.restore();
    const words = info.name.split(' ');
    neon(ctx, words.slice(0, words.length - 1).join(' '), cx, p[1] + 122, 16, hcol, sel ? 10 : 4);
    neon(ctx, words[words.length - 1], cx, p[1] + 144, 16, hcol, sel ? 10 : 4);
    txt(ctx, info.sub, cx, p[1] + 166, 11, 'rgba(255,255,255,0.7)');
    let stars = '';
    for (let s = 0; s < 3; s++) stars += s < info.stars ? '★' : '☆';
    txt(ctx, stars, cx, p[1] + 190, 16, '#ffd24a');
    const best = bestAny(i);
    txt(ctx, best ? `BEST ${best.score} [${best.rank}·${best.diff}]` : 'NO RECORD YET', cx, p[1] + 216, 11,
      best ? '#7dff5e' : 'rgba(255,255,255,0.4)');
    ctx.restore();
  });
  txt(ctx, `FIGHTER: ${CHARS[S.selChar].name}`, W / 2, 648, 16, CHARS[S.selChar].theme);
  txt(ctx, '←  →  ↑  ↓  SELECT      ENTER  GO      ESC  BACK', W / 2, 684, 14, 'rgba(255,255,255,0.55)');
  vignette(ctx);

  if (S.diffOpen) {
    const info = MUAudio.trackInfo(S.selSong);
    ctx.fillStyle = 'rgba(3,2,8,0.78)';
    ctx.fillRect(0, 0, W, H);
    MUArt.rr(ctx, 360, 178, 560, 322, 18);
    ctx.fillStyle = 'rgba(18,10,34,0.97)'; ctx.fill();
    ctx.strokeStyle = `hsl(${info.hue}, 95%, 60%)`; ctx.lineWidth = 3;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    neon(ctx, info.name, W / 2, 226, 22, `hsl(${info.hue}, 95%, 60%)`, 10);
    txt(ctx, 'SELECT DIFFICULTY', W / 2, 258, 15, 'rgba(255,255,255,0.7)');
    DIFF_ROWS.forEach((r, i) => {
      const d = DIFFS[i];
      const sel = i === S.selDiff;
      MUArt.rr(ctx, r[0], r[1], r[2], r[3], 10);
      ctx.fillStyle = sel ? 'rgba(40,24,70,0.95)' : 'rgba(10,6,20,0.9)';
      ctx.fill();
      ctx.strokeStyle = sel ? d.col : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 3 : 1.5;
      if (sel) { ctx.shadowColor = d.col; ctx.shadowBlur = 12; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      txt(ctx, d.name, r[0] + 24, r[1] + 34, 19, d.col, 'left');
      const b = loadBest(S.selSong, i);
      txt(ctx, b ? `BEST ${b.score} [${b.rank}]` : '—', r[0] + r[2] - 24, r[1] + 33, 13,
        b ? '#7dff5e' : 'rgba(255,255,255,0.35)', 'right');
    });
    txt(ctx, '↑  ↓  SELECT      ENTER  FIGHT      ESC  BACK', W / 2, 488, 13, 'rgba(255,255,255,0.55)');
  }
}

function renderPlay() {
  const now = P.now;
  const beat = Math.max(0, MUAudio.beat());
  const energy = energyNow(beat);

  ctx.save();
  if (P.shake > 0) ctx.translate((Math.random() - 0.5) * P.shake, (Math.random() - 0.5) * P.shake);

  drawBG(ctx, { t: S.t, beat, energy, hue: P.info.hue, flash: P.flash });

  const bph = beat - Math.floor(beat);
  const pulse = Math.max(0, 1 - bph * 2.5);

  // strike zone — vertical glow band where punches land
  ctx.save();
  const zoneW = 64;
  const zg = ctx.createLinearGradient(HIT_X - zoneW / 2, 0, HIT_X + zoneW / 2, 0);
  zg.addColorStop(0, 'transparent');
  zg.addColorStop(0.5, `rgba(255,255,255,${0.05 + pulse * 0.07})`);
  zg.addColorStop(1, 'transparent');
  ctx.fillStyle = zg;
  ctx.fillRect(HIT_X - zoneW / 2, ROW_Y[0] - 215, zoneW, ROW_Y[3] - ROW_Y[0] + 250);
  ctx.strokeStyle = `rgba(255,255,255,${0.16 + pulse * 0.22})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(HIT_X, ROW_Y[0] - 215);
  ctx.lineTo(HIT_X, ROW_Y[3] + 35);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // hit rings
  for (let l = 0; l < 4; l++) {
    const ry = ROW_Y[l];
    ctx.strokeStyle = LANE_COL[l];
    ctx.globalAlpha = 0.4 + pulse * 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(HIT_X, ry, 46 + pulse * 6, 15 + pulse * 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    txt(ctx, LANE_KEYS[l], HIT_X, ry + 6, 17, LANE_COL[l]);
    ctx.globalAlpha = 1;
  }

  const py = lerp(ROW_Y[P.rowFrom], ROW_Y[P.row], easeOut(P.rowT));
  const psc = lerp(ROW_SC[P.rowFrom], ROW_SC[P.row], easeOut(P.rowT));
  const poseT = clamp((S.t - P.pose.t0) / (P.pose.kind === 'punch' ? 0.22 : 0.4), 0, 1);
  const poseKind = poseT >= 1 ? 'idle' : P.pose.kind;

  for (let l = 0; l < 4; l++) {
    for (const n of P.active) {
      if (n.lane !== l) continue;
      const ry = ROW_Y[l], rsc = ROW_SC[l];
      if (n.state === 'dying') {
        ctx.save();
        ctx.translate(n.px, ry + n.py);
        ctx.rotate(n.rot);
        ctx.scale(rsc, rsc);
        drawEnemy(ctx, { v: n.v, color: LANE_COL[l] }, { kind: 'die' });
        ctx.restore();
      } else {
        const x = xFor(n, now);
        if (x > W + 150) continue;
        ctx.save();
        ctx.translate(x, ry);
        ctx.scale(rsc, rsc);
        const kind = (n.state === 'passed' && x < PLAYER_X + 110) ? 'attack' : 'run';
        // stride locked to the beat so enemies march in time
        drawEnemy(ctx, { v: n.v, color: LANE_COL[l] },
          { kind, ph: beat * Math.PI + (n.seed % 0.6), t: clamp((PLAYER_X + 110 - x) / 90, 0, 1) });
        ctx.restore();
        if (n.state === 'wait') {
          const tLeft = n.time - now;
          const bp = Math.max(0, 1 - Math.abs(tLeft) / 0.25);
          const by = ry - 185 * rsc;
          drawKeyBadge(ctx, x, by, LANE_KEYS[l], LANE_COL[l], bp);
          // approach ring closes onto the badge exactly at the hit moment
          const avis = Math.min(P.info.approach, 1.3);
          if (tLeft <= avis && tLeft > -0.05) {
            const k = Math.max(0, tLeft / avis);
            ctx.strokeStyle = LANE_COL[l];
            ctx.globalAlpha = 0.85 * (1 - k * 0.65);
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(x, by, 22 + k * 58, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          // white flash when inside the perfect window
          if (Math.abs(tLeft) <= PERF_WIN) {
            ctx.strokeStyle = '#fff';
            ctx.globalAlpha = 0.9;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, by, 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    if (Math.round(lerp(P.rowFrom, P.row, easeOut(P.rowT))) === l) {
      if (P.rowT < 0.45) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.translate(PLAYER_X, ROW_Y[P.rowFrom]);
        ctx.scale(ROW_SC[P.rowFrom], ROW_SC[P.rowFrom]);
        drawFighter(ctx, P.charIdx, { kind: poseKind, t: poseT, beat });
        ctx.restore();
      }
      ctx.save();
      ctx.translate(PLAYER_X, py);
      ctx.scale(psc, psc);
      drawFighter(ctx, P.charIdx, { kind: poseKind, t: poseT, beat });
      ctx.restore();
    }
  }

  // particles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of P.parts) {
    const a = 1 - p.t / p.life;
    if (p.ring) {
      ctx.strokeStyle = p.col;
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = 4 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14 + (p.t / p.life) * 70, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = p.col;
      ctx.globalAlpha = a;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // floating texts
  for (const t of P.texts) {
    const age = (S.t - t.t0) / 0.8;
    ctx.save();
    ctx.translate(t.x, t.y - age * 36);
    ctx.rotate(t.rot || 0);
    ctx.globalAlpha = 1 - age * age;
    if (t.pow) {
      neon(ctx, t.str, 0, 0, t.size * (1 + age * 0.3), t.col, 14);
    } else {
      ctx.font = `${t.size}px "Russo One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#10081c';
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, 0, 0);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  renderHUD(now, beat);
  vignette(ctx);
  ctx.restore();

  if (P.paused) {
    ctx.fillStyle = 'rgba(3,2,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    neon(ctx, 'PAUSED', W / 2, 330, 60, '#3ee6ff', 20);
    txt(ctx, 'ESC  RESUME       Q  QUIT', W / 2, 400, 20, 'rgba(255,255,255,0.7)');
  }
}

function renderHUD(now, beat) {
  const ch = CHARS[P.charIdx];
  const hpw = 300, hpf = clamp(P.hp / P.maxHp, 0, 1);
  MUArt.rr(ctx, 28, 24, hpw, 22, 11);
  ctx.fillStyle = 'rgba(8,5,16,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  if (hpf > 0) {
    MUArt.rr(ctx, 31, 27, (hpw - 6) * hpf, 16, 8);
    ctx.fillStyle = hpf > 0.5 ? '#7dff5e' : hpf > 0.25 ? '#ffd24a' : '#ff5d5d';
    ctx.fill();
  }
  txt(ctx, ch.name, 30, 66, 15, ch.theme, 'left');
  ctx.font = '30px "Russo One", sans-serif';
  ctx.textAlign = 'right';
  ctx.shadowColor = '#3ee6ff'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#fff';
  ctx.fillText(String(P.score).padStart(7, '0'), W - 30, 50);
  ctx.shadowBlur = 0;
  if (P.combo >= 5) {
    const pop = 1 + P.comboPop * 0.25;
    ctx.save();
    ctx.translate(W / 2, 120);
    ctx.scale(pop, pop);
    neon(ctx, `${P.combo} COMBO`, 0, 0, 38, P.combo >= 50 ? '#ffd24a' : '#ff4fd8', 16);
    ctx.restore();
  }
  const prog = clamp(now / P.info.duration, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, H - 6, W, 6);
  ctx.fillStyle = `hsl(${P.info.hue}, 95%, 60%)`;
  ctx.fillRect(0, H - 6, W * prog, 6);
  txt(ctx, P.info.name, 28, H - 18, 14, 'rgba(255,255,255,0.5)', 'left');
  const nw = ctx.measureText(P.info.name).width;
  txt(ctx, P.diff.name, 28 + nw + 16, H - 18, 14, P.diff.col, 'left');
}

function renderResults() {
  drawBG(ctx, { t: S.t, beat: S.t * 1.8, energy: 0.5, hue: P.info.hue, flash: 0 });
  ctx.fillStyle = 'rgba(3,2,8,0.7)';
  ctx.fillRect(0, 0, W, H);
  const rankCol = { S: '#ffd24a', A: '#7dff5e', B: '#3ee6ff', C: '#ff4fd8', D: '#ff5d5d' }[P.rank];
  neon(ctx, 'TRACK CLEAR!', W / 2, 95, 46, '#3ee6ff', 18);
  ctx.save();
  ctx.translate(330, 330);
  ctx.rotate(-0.06);
  ctx.scale(1 + Math.sin(S.t * 3) * 0.02, 1 + Math.sin(S.t * 3) * 0.02);
  neon(ctx, P.rank, 0, 60, 190, rankCol, 38);
  ctx.restore();
  txt(ctx, 'RANK', 330, 430, 20, 'rgba(255,255,255,0.6)');
  const lx = 560, vx = 880;
  const rows = [
    ['DIFFICULTY', P.diff.name, P.diff.col],
    ['SCORE', String(P.score).padStart(7, '0'), '#fff'],
    ['PERFECT', P.counts.perfect, '#ffd24a'],
    ['GOOD', P.counts.good, '#3ee6ff'],
    ['MISS', P.counts.miss, '#ff5d5d'],
    ['MAX COMBO', P.maxCombo, '#ff4fd8'],
    ['ACCURACY', Math.round(P.acc * 100) + '%', '#7dff5e']
  ];
  rows.forEach((r, i) => {
    const y = 196 + i * 42;
    txt(ctx, r[0], lx, y, 19, 'rgba(255,255,255,0.65)', 'left');
    txt(ctx, String(r[1]), vx, y, 21, r[2], 'right');
  });
  if (P.newBest) neon(ctx, 'NEW RECORD!', 720, 510, 30, '#ffd24a', 16);
  ctx.save();
  ctx.translate(1080, 600);
  ctx.scale(1.1, 1.1);
  drawFighter(ctx, P.charIdx, { kind: 'win', t: 1, beat: S.t * 1.8 });
  ctx.restore();
  txt(ctx, 'R  RETRY       ENTER  TRACKS', W / 2, 672, 19, 'rgba(255,255,255,0.7)');
  vignette(ctx);
}

function renderGameOver() {
  drawBG(ctx, { t: S.t, beat: S.t, energy: 0.15, hue: 0, flash: 0 });
  ctx.fillStyle = 'rgba(20,2,8,0.78)';
  ctx.fillRect(0, 0, W, H);
  neon(ctx, 'KNOCKED OUT!', W / 2, 270, 76, '#ff5d5d', 26);
  txt(ctx, `${CHARS[P.charIdx].name} hit the floor on ${P.info.name}`, W / 2, 330, 19, 'rgba(255,255,255,0.7)');
  ctx.save();
  ctx.translate(W / 2, 580);
  drawFighter(ctx, P.charIdx, { kind: 'hit', t: 0.5, beat: 0 });
  ctx.restore();
  txt(ctx, 'R  RETRY       ENTER  TRACKS', W / 2, 660, 19, 'rgba(255,255,255,0.8)');
  vignette(ctx);
}

/* ---------------- input ---------------- */

addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyM') { MUAudio.setMuted(!MUAudio.getMuted()); return; }
  switch (S.scene) {
    case 'title':
      if (e.code === 'Enter' || e.code === 'Space') { ensureAudio(); MUAudio.sfx('uiSel'); S.scene = 'char'; }
      break;
    case 'char':
      if (e.code === 'ArrowLeft') { S.selChar = (S.selChar + 2) % 3; MUAudio.sfx('uiMove'); }
      else if (e.code === 'ArrowRight') { S.selChar = (S.selChar + 1) % 3; MUAudio.sfx('uiMove'); }
      else if (e.code === 'Enter') { MUAudio.sfx('uiSel'); S.scene = 'song'; }
      else if (e.code === 'Escape') { MUAudio.sfx('uiBack'); S.scene = 'title'; }
      break;
    case 'song': {
      const n = MUAudio.trackCount();
      if (S.diffOpen) {
        if (e.code === 'ArrowUp') { S.selDiff = (S.selDiff + 2) % 3; MUAudio.sfx('uiMove'); }
        else if (e.code === 'ArrowDown') { S.selDiff = (S.selDiff + 1) % 3; MUAudio.sfx('uiMove'); }
        else if (e.code === 'Enter') { S.diffOpen = false; MUAudio.sfx('uiSel'); startPlay(); }
        else if (e.code === 'Escape') { S.diffOpen = false; MUAudio.sfx('uiBack'); }
      } else {
        if (e.code === 'ArrowLeft') { S.selSong = (S.selSong + n - 1) % n; MUAudio.sfx('uiMove'); }
        else if (e.code === 'ArrowRight') { S.selSong = (S.selSong + 1) % n; MUAudio.sfx('uiMove'); }
        else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { S.selSong = (S.selSong + 3) % n; MUAudio.sfx('uiMove'); }
        else if (e.code === 'Enter') { S.diffOpen = true; MUAudio.sfx('uiSel'); }
        else if (e.code === 'Escape') { MUAudio.sfx('uiBack'); S.scene = 'char'; }
      }
      break;
    }
    case 'play':
      if (e.code in LANE_CODES && !P.paused) judge(LANE_CODES[e.code]);
      else if (e.code === 'Escape') {
        P.paused = !P.paused;
        if (P.paused) MUAudio.pause(); else MUAudio.resume();
      }
      else if (e.code === 'KeyQ' && P.paused) {
        MUAudio.resume(); MUAudio.stop(true);
        S.audioOn = false; ensureAudio();
        S.scene = 'song';
      }
      break;
    case 'results':
    case 'gameover':
      if (e.code === 'KeyR') { MUAudio.sfx('uiSel'); startPlay(); }
      else if (e.code === 'Enter' || e.code === 'Escape') {
        MUAudio.sfx('uiBack');
        S.audioOn = false; ensureAudio();
        S.scene = 'song';
      }
      break;
  }
});

function gamePoint(e) {
  const cx = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
  const cy = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
  return [(cx - ox) / scale, (cy - oy) / scale];
}
function inRect(p, r) { return p[0] >= r[0] && p[0] <= r[0] + r[2] && p[1] >= r[1] && p[1] <= r[1] + r[3]; }

function pointerDown(e) {
  const p = gamePoint(e);
  switch (S.scene) {
    case 'title': ensureAudio(); MUAudio.sfx('uiSel'); S.scene = 'char'; break;
    case 'char':
      CHAR_PANELS.forEach((r, i) => {
        if (inRect(p, r)) {
          if (S.selChar === i) { MUAudio.sfx('uiSel'); S.scene = 'song'; }
          else { S.selChar = i; MUAudio.sfx('uiMove'); }
        }
      });
      break;
    case 'song':
      if (S.diffOpen) {
        let hitRow = false;
        DIFF_ROWS.forEach((r, i) => {
          if (inRect(p, r)) {
            hitRow = true;
            if (S.selDiff === i) { S.diffOpen = false; MUAudio.sfx('uiSel'); startPlay(); }
            else { S.selDiff = i; MUAudio.sfx('uiMove'); }
          }
        });
        if (!hitRow && !inRect(p, [360, 178, 560, 322])) { S.diffOpen = false; MUAudio.sfx('uiBack'); }
      } else {
        SONG_CARDS.forEach((r, i) => {
          if (i < MUAudio.trackCount() && inRect(p, r)) {
            if (S.selSong === i) { S.diffOpen = true; MUAudio.sfx('uiSel'); }
            else { S.selSong = i; MUAudio.sfx('uiMove'); }
          }
        });
      }
      break;
    case 'play':
      if (!P.paused) judge(clamp(Math.floor(p[0] / W * 4), 0, 3));
      break;
    case 'results':
    case 'gameover':
      MUAudio.sfx('uiBack');
      S.audioOn = false; ensureAudio();
      S.scene = 'song';
      break;
  }
}
canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('touchstart', e => { e.preventDefault(); ensureAudio(); pointerDown(e); }, { passive: false });

/* ---------------- debug handle ---------------- */

window.__MU = {
  version: '2.1.0',
  scene: () => S.scene,
  start: (c, s, d) => {
    S.selChar = c || 0; S.selSong = s || 0;
    S.selDiff = d === undefined ? 1 : d;
    MUAudio.unlock(); startPlay();
  },
  hit: l => judge(l),
  autoplay: v => { if (P) P.autoplay = v !== false; },
  state: () => P ? {
    scene: S.scene, score: P.score, combo: P.combo, maxCombo: P.maxCombo,
    hp: P.hp, counts: P.counts, time: MUAudio.time(), diff: P.diff.id,
    active: P.active.length, spawned: P.spawnIdx, total: P.notes.length
  } : { scene: S.scene },
  finish: () => { if (P && S.scene === 'play') finishSong(); },
  kill: () => { if (P && S.scene === 'play') { P.hp = 0; } },
  mute: v => MUAudio.setMuted(v !== false),
  goto: s => { S.scene = s; },
  // headless helpers: drive a frame manually and export the canvas
  tick: ms => { update((ms || 16.7) / 1000); render(); },
  shot: q => canvas.toDataURL('image/jpeg', q || 0.55)
};

/* ---------------- main loop ---------------- */

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (MUArt.resetCache) MUArt.resetCache(); });
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();
