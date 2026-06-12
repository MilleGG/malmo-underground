/* MALMÖ UNDERGROUND — art module.
   All characters, enemies and the rave warehouse are drawn in code:
   cel-shaded vector anime style with dark outlines and neon rim light. */
'use strict';

const MUArt = (() => {

const TAU = Math.PI * 2;
const OUT = '#171028';

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// limb drawn as outlined capsule polyline
function limb(ctx, pts, w, color, hi) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = OUT; ctx.lineWidth = w + 5; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  if (hi) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] - 1.5, pts[0][1] - 1.5);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - 1.5, pts[i][1] - 1.5);
    ctx.strokeStyle = hi; ctx.lineWidth = w * 0.35; ctx.globalAlpha = 0.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function outFill(ctx, fill, lw) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw || 3.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/* ================= FACES ================= */

function eye(ctx, x, y, w, h, o) {
  o = o || {};
  if (o.closed) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.pain) { // > <
      ctx.moveTo(x - w / 2, y - h / 3); ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x - w / 2, y + h / 3);
    } else {
      ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y + h / 3, x + w / 2, y);
    }
    ctx.stroke();
    return;
  }
  // sclera
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y - h / 2, x, y - h / 2);
  ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y);
  ctx.quadraticCurveTo(x + w / 2, y + h / 2, x, y + h / 2);
  ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = '#fdfbf6'; ctx.fill();
  // iris
  const ir = h * 0.42;
  ctx.beginPath(); ctx.arc(x + w * 0.08, y, ir, 0, TAU);
  ctx.fillStyle = o.iris || '#3e7fc1'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.08, y + ir * 0.15, ir * 0.5, 0, TAU);
  ctx.fillStyle = '#141022'; ctx.fill();
  // glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x + w * 0.02 - ir * 0.3, y - ir * 0.35, ir * 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.2 + ir * 0.2, y + ir * 0.3, ir * 0.15, 0, TAU); ctx.fill();
  // top lash
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 1, y - h * 0.1);
  ctx.quadraticCurveTo(x, y - h * 0.75, x + w / 2 + 2, y - h * 0.25);
  ctx.stroke();
}

function brow(ctx, x, y, w, angry) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - (angry ? -3 : 2));
  ctx.lineTo(x + w / 2, y + (angry ? -4 : -1));
  ctx.stroke();
}

function mouth(ctx, x, y, kind) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  if (kind === 'shout') {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 6, 8, 0, 0, TAU);
    ctx.fillStyle = '#5d2335'; ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 4, y - 5, 8, 3);
  } else if (kind === 'grit') {
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    for (let i = 0; i < 4; i++) ctx.lineTo(x - 8 + (i + 1) * 4, y + (i % 2 ? -3 : 3));
    ctx.stroke();
  } else if (kind === 'grin') {
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 2);
    ctx.quadraticCurveTo(x, y + 8, x + 9, y - 3);
    ctx.fillStyle = '#fff';
    ctx.lineTo(x + 9, y - 2); ctx.quadraticCurveTo(x, y + 3, x - 9, y - 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 2);
    ctx.quadraticCurveTo(x, y + 8, x + 9, y - 3);
    ctx.stroke();
  } else { // determined smirk
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 1);
    ctx.quadraticCurveTo(x + 2, y + 3, x + 8, y - 1);
    ctx.stroke();
  }
}

/* head facing right, 3/4 view; center hx,hy; radius r */
function headBase(ctx, hx, hy, r, ch) {
  ctx.beginPath();
  ctx.moveTo(hx - r, hy - r * 0.1);
  ctx.quadraticCurveTo(hx - r, hy - r * 1.15, hx + r * 0.1, hy - r * 1.12);
  ctx.quadraticCurveTo(hx + r * 1.02, hy - r * 1.05, hx + r * 0.98, hy - r * 0.15);
  ctx.quadraticCurveTo(hx + r * 0.96, hy + r * 0.45, hx + r * 0.45, hy + r * 0.92);  // jaw
  ctx.quadraticCurveTo(hx + r * 0.15, hy + r * 1.08, hx - r * 0.1, hy + r * 0.95);   // chin
  ctx.quadraticCurveTo(hx - r * 0.85, hy + r * 0.55, hx - r, hy - r * 0.1);
  ctx.closePath();
  outFill(ctx, ch.skin, 3.2);
  // cheek shade
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.9, hy + r * 0.1);
  ctx.quadraticCurveTo(hx - r * 0.5, hy + r * 0.7, hx - r * 0.05, hy + r * 0.9);
  ctx.quadraticCurveTo(hx - r * 0.7, hy + r * 0.6, hx - r * 0.92, hy + r * 0.12);
  ctx.closePath();
  ctx.fillStyle = 'rgba(40,10,60,0.16)'; ctx.fill();
  // ear
  ctx.beginPath();
  ctx.ellipse(hx - r * 0.72, hy + r * 0.12, r * 0.18, r * 0.26, -0.15, 0, TAU);
  outFill(ctx, ch.skin, 2.4);
  // nose
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.88, hy + r * 0.12);
  ctx.lineTo(hx + r * 0.97, hy + r * 0.3);
  ctx.stroke();
}

function face(ctx, hx, hy, r, ch, k) {
  const pain = k === 'hit' || k === 'ko';
  const ey = hy - r * 0.05;
  if (ch.shades) {
    // small rectangular sunglasses
    ctx.fillStyle = '#0d1014';
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    rr(ctx, hx - r * 0.28, ey - 6, r * 0.5, 12, 3); ctx.fill(); ctx.stroke();
    rr(ctx, hx + r * 0.34, ey - 6, r * 0.5, 12, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + r * 0.22, ey - 2); ctx.lineTo(hx + r * 0.34, ey - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx - r * 0.28, ey - 2); ctx.lineTo(hx - r * 0.68, ey - 4); ctx.stroke();
    // glint
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + r * 0.4, ey + 3); ctx.lineTo(hx + r * 0.52, ey - 4); ctx.stroke();
    brow(ctx, hx - r * 0.05, ey - 11, r * 0.42, k === 'punch' || pain);
    brow(ctx, hx + r * 0.6, ey - 12, r * 0.44, k === 'punch' || pain);
  } else {
    const ew = r * ch.eyeW, eh = r * ch.eyeH;
    eye(ctx, hx - r * 0.06, ey, ew * 0.82, eh * 0.92, { iris: ch.iris, closed: pain, pain: pain });
    eye(ctx, hx + r * 0.6, ey, ew, eh, { iris: ch.iris, closed: pain, pain: pain });
    brow(ctx, hx - r * 0.06, ey - eh * 0.95, ew * 0.8, k === 'punch' || pain);
    brow(ctx, hx + r * 0.62, ey - eh, ew, k === 'punch' || pain);
  }
  const mk = k === 'punch' ? 'shout' : pain ? 'grit' : k === 'win' ? 'grin' : 'smirk';
  mouth(ctx, hx + r * 0.5, hy + r * 0.62, mk);
}

/* ================= HAIR / HATS ================= */

function hairSheriffen(ctx, hx, hy, r) {
  // bald shine
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx - r * 0.1, hy - r * 0.45, r * 0.62, -2.4, -1.6);
  ctx.stroke();
  // viking beard hugging the jaw
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.78, hy + r * 0.2);
  ctx.quadraticCurveTo(hx - r * 0.6, hy + r * 1.0, hx - r * 0.1, hy + r * 1.35);
  // spiky bottom edge
  ctx.lineTo(hx + r * 0.1, hy + r * 1.55);
  ctx.lineTo(hx + r * 0.3, hy + r * 1.3);
  ctx.lineTo(hx + r * 0.5, hy + r * 1.45);
  ctx.quadraticCurveTo(hx + r * 0.95, hy + r * 0.9, hx + r * 1.0, hy + r * 0.3);
  ctx.lineTo(hx + r * 0.72, hy + r * 0.32);
  ctx.quadraticCurveTo(hx + r * 0.6, hy + r * 0.85, hx + r * 0.1, hy + r * 0.88);
  ctx.quadraticCurveTo(hx - r * 0.35, hy + r * 0.85, hx - r * 0.5, hy + r * 0.3);
  ctx.closePath();
  outFill(ctx, '#c4863c', 3);
  ctx.fillStyle = 'rgba(255,220,140,0.3)';
  ctx.beginPath();
  ctx.ellipse(hx + r * 0.4, hy + r * 0.9, r * 0.12, r * 0.3, 0.3, 0, TAU);
  ctx.fill();
  // mustache
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.25, hy + r * 0.52);
  ctx.quadraticCurveTo(hx + r * 0.55, hy + r * 0.42, hx + r * 0.82, hy + r * 0.55);
  ctx.quadraticCurveTo(hx + r * 0.55, hy + r * 0.62, hx + r * 0.25, hy + r * 0.52);
  ctx.closePath();
  outFill(ctx, '#b87a32', 2.2);
  // sheriff hat
  ctx.beginPath();
  ctx.ellipse(hx + r * 0.05, hy - r * 0.78, r * 1.55, r * 0.34, -0.06, 0, TAU);
  outFill(ctx, '#7a5230', 3.2);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.72, hy - r * 0.8);
  ctx.quadraticCurveTo(hx - r * 0.75, hy - r * 1.7, hx - r * 0.2, hy - r * 1.78);
  ctx.quadraticCurveTo(hx + r * 0.05, hy - r * 1.55, hx + r * 0.3, hy - r * 1.8);
  ctx.quadraticCurveTo(hx + r * 0.85, hy - r * 1.68, hx + r * 0.78, hy - r * 0.82);
  ctx.closePath();
  outFill(ctx, '#84592f', 3.2);
  ctx.fillStyle = '#52351c';
  ctx.fillRect(hx - r * 0.72, hy - r * 1.02, r * 1.5, r * 0.22);
  // gold star
  ctx.save();
  ctx.translate(hx + r * 0.1, hy - r * 1.18);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? r * 0.12 : r * 0.26;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd34d'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function hairVilgot(ctx, hx, hy, r) {
  // long curly mane — clusters of curls down to the shoulders
  const curls = [
    [-0.95, -0.5, 0.42], [-0.5, -0.95, 0.45], [0.1, -1.1, 0.42], [0.65, -0.95, 0.38],
    [1.0, -0.55, 0.3], [-1.1, 0.0, 0.38], [-1.15, 0.55, 0.36], [-1.05, 1.1, 0.34],
    [-0.9, 1.6, 0.32], [-0.55, 1.85, 0.3], [1.05, -0.1, 0.24]
  ];
  ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  for (const c of curls) {
    ctx.beginPath();
    ctx.arc(hx + c[0] * r, hy + c[1] * r, c[2] * r, 0, TAU);
    ctx.fillStyle = '#41301f'; ctx.fill(); ctx.stroke();
  }
  for (const c of curls) {
    ctx.beginPath();
    ctx.arc(hx + c[0] * r - 2, hy + c[1] * r - 2, c[2] * r * 0.62, 0, TAU);
    ctx.fillStyle = '#5a432c'; ctx.fill();
  }
  // curl swirl details
  ctx.strokeStyle = '#2c2014'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const c = curls[i * 2];
    ctx.beginPath();
    ctx.arc(hx + c[0] * r, hy + c[1] * r, c[2] * r * 0.4, i, i + 4);
    ctx.stroke();
  }
  // fringe over forehead
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.7, hy - r * 0.55);
  ctx.quadraticCurveTo(hx, hy - r * 1.0, hx + r * 0.85, hy - r * 0.5);
  ctx.quadraticCurveTo(hx + r * 0.4, hy - r * 0.62, hx + r * 0.25, hy - r * 0.4);
  ctx.quadraticCurveTo(hx, hy - r * 0.62, hx - r * 0.25, hy - r * 0.42);
  ctx.quadraticCurveTo(hx - r * 0.5, hy - r * 0.6, hx - r * 0.7, hy - r * 0.55);
  ctx.closePath();
  outFill(ctx, '#4a3624', 2.6);
}

function hairMille(ctx, hx, hy, r, halo) {
  // blonde backslick — swept smoothly from forehead to nape
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.85, hy - r * 0.62);
  ctx.quadraticCurveTo(hx + r * 0.3, hy - r * 1.32, hx - r * 0.45, hy - r * 1.18);
  ctx.quadraticCurveTo(hx - r * 1.18, hy - r * 0.85, hx - r * 1.12, hy + r * 0.1);
  ctx.quadraticCurveTo(hx - r * 1.3, hy + r * 0.45, hx - r * 1.05, hy + r * 0.5);  // nape flick
  ctx.quadraticCurveTo(hx - r * 0.92, hy + r * 0.18, hx - r * 0.85, hy - r * 0.1);
  ctx.quadraticCurveTo(hx - r * 0.8, hy - r * 0.75, hx - r * 0.1, hy - r * 0.85);
  ctx.quadraticCurveTo(hx + r * 0.5, hy - r * 0.85, hx + r * 0.85, hy - r * 0.62);
  ctx.closePath();
  outFill(ctx, '#f0c75e', 3);
  // slick strands
  ctx.strokeStyle = '#d3a53f'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + r * (0.55 - i * 0.12), hy - r * (0.75 + i * 0.12));
    ctx.quadraticCurveTo(hx - r * 0.2, hy - r * (1.05 - i * 0.06), hx - r * (0.85 + i * 0.06), hy - r * (0.4 - i * 0.16));
    ctx.stroke();
  }
  // shine
  ctx.strokeStyle = 'rgba(255,250,220,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.35, hy - r * 0.95);
  ctx.quadraticCurveTo(hx - r * 0.15, hy - r * 1.12, hx - r * 0.6, hy - r * 0.9);
  ctx.stroke();
  // loose angel strand
  ctx.strokeStyle = '#f0c75e'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.4, hy - r * 0.95);
  ctx.quadraticCurveTo(hx + r * 0.55, hy - r * 1.25, hx + r * 0.35, hy - r * 1.35);
  ctx.stroke();
  if (halo) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,225,120,0.9)';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(hx - r * 0.1, hy - r * 1.85, r * 0.75, r * 0.22, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/* ================= CHARACTERS ================= */

const CHARS = [
  {
    id: 'sheriffen', name: 'SHERIFFEN', epithet: 'LAGENS LÄNGSTA ARM',
    perk: 'TÅLIG — +35 HP', hp: 135, winMult: 1, scoreMult: 1,
    h: 1.04, headR: 23,
    skin: '#f0c294', iris: '#5e8fc6', eyeW: 0.42, eyeH: 0.34,
    theme: '#ffd34d'
  },
  {
    id: 'vilgot', name: 'VILGOT', epithet: 'SMOOTH OPERATÖR',
    perk: 'FLOW — snällare timing', hp: 100, winMult: 1.3, scoreMult: 1,
    h: 1.12, headR: 21, shades: true,
    skin: '#edbd92', iris: '#6b4f35', eyeW: 0.4, eyeH: 0.3,
    theme: '#3ee6ff'
  },
  {
    id: 'mille', name: 'MILLE', epithet: 'ÄNGLABARN',
    perk: 'STJÄRNGLANS — +15% poäng', hp: 100, winMult: 1, scoreMult: 1.15,
    h: 0.9, headR: 26,
    skin: '#f6d4ac', iris: '#56b87a', eyeW: 0.5, eyeH: 0.44,
    theme: '#7dff5e'
  }
];

/* drawFighter: origin at feet center, facing +x.
   pose: {kind:'idle'|'punch'|'hit'|'win', t:0..1, beat, aim:-60..60} */
function drawFighter(ctx, idx, pose) {
  const ch = CHARS[idx];
  const k = pose.kind || 'idle';
  const t = clamp(pose.t || 0, 0, 1);
  const beat = pose.beat || 0;
  ctx.save();
  ctx.scale(ch.h, ch.h);

  let ext = 0, shift = 0;
  if (k === 'punch') {
    ext = t < 0.38 ? easeOut(t / 0.38) : 1 - (t - 0.38) / 0.62 * 0.8;
    shift = ext * 26;
  }
  if (k === 'hit') shift = -Math.sin(Math.min(t, 1) * Math.PI) * 26;
  const bob = (k === 'idle' || k === 'win') ? -Math.abs(Math.sin(beat * Math.PI)) * 5 : 0;

  const hipX = shift * 0.45, hipY = -108 + bob * 0.5;
  const shX = shift, shY = -172 + bob;
  const hx = shX + 10 + (k === 'hit' ? -12 : 0), hy = -204 + bob + (k === 'hit' ? 6 : 0);
  const aim = pose.aim || 0;

  // ---- joints
  const win = k === 'win';
  // front (punching) arm
  let fSh = [shX + 16, shY + 8];
  let fFist = [lerp(shX + 36, shX + 132, ext), lerp(shY + 24, shY + 8 + aim * 0.35, ext)];
  let fElb = [lerp(shX + 24, shX + 80, ext), lerp(shY + 30, shY + 18 + aim * 0.2, ext)];
  // back arm
  let bSh = [shX - 14, shY + 10];
  let bFist = [lerp(shX + 6, shX - 38, ext), lerp(shY + 2, shY + 30, ext)];
  let bElb = [lerp(shX - 20, shX - 30, ext), lerp(shY + 26, shY + 24, ext)];
  if (k === 'hit') {
    fFist = [shX + 30, shY + 44]; fElb = [shX + 22, shY + 28];
    bFist = [shX - 34, shY + 38]; bElb = [shX - 26, shY + 22];
  }
  if (win) {
    if (ch.id === 'sheriffen') { fFist = [hx + 26, hy - 30]; fElb = [shX + 36, shY - 4]; }
    else if (ch.id === 'vilgot') { fFist = [shX + 44, shY - 64]; fElb = [shX + 30, shY - 18]; }
    else { fFist = [shX + 40, shY - 58]; fElb = [shX + 28, shY - 12]; bFist = [shX - 36, shY - 56]; bElb = [shX - 26, shY - 10]; }
  }
  // legs
  const fFoot = [34 + shift * 0.7, 0], bFoot = [-32 + shift * 0.25, 0];
  const fKnee = [(hipX + fFoot[0]) / 2 + 7, hipY * 0.48];
  const bKnee = [(hipX + bFoot[0]) / 2 - 2, hipY * 0.48];

  const pantsW = ch.id === 'mille' ? 21 : 24; // all baggy, Mille slightly slimmer
  const pants = ch.id === 'sheriffen' ? '#6b7158' : ch.id === 'vilgot' ? '#4f6e9a' : '#5b7ba6';
  const pantsHi = ch.id === 'sheriffen' ? '#878d70' : '#7591b8';
  const sleeve = ch.id === 'sheriffen';
  const topCol = ch.id === 'sheriffen' ? '#39414e' : ch.id === 'vilgot' ? '#f5f2ea' : '#f8f4e9';

  // ---- back arm (skin or sleeve upper)
  limb(ctx, [bSh, bElb, bFist], 13, ch.skin);
  fist(ctx, bFist[0], bFist[1], 9, ch.skin);

  // ---- back leg
  limb(ctx, [[hipX - 10, hipY], bKnee, [bFoot[0], bFoot[1] - 12]], pantsW, pants);
  shoe(ctx, ch, bFoot[0], bFoot[1], -0.1);

  // ---- torso
  drawTorso(ctx, ch, hipX, hipY, shX, shY, topCol, ext, beat);

  // ---- front leg
  limb(ctx, [[hipX + 10, hipY], fKnee, [fFoot[0], fFoot[1] - 12]], pantsW, pants, pantsHi);
  // cuff bunch
  ctx.beginPath();
  ctx.ellipse(fFoot[0], fFoot[1] - 14, pantsW * 0.62, 7, 0, 0, TAU);
  ctx.fillStyle = pants; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  shoe(ctx, ch, fFoot[0], fFoot[1], 0);

  // ---- head
  headBase(ctx, hx, hy, ch.headR, ch);
  face(ctx, hx, hy, ch.headR, ch, k);
  if (ch.id === 'sheriffen') hairSheriffen(ctx, hx, hy, ch.headR);
  else if (ch.id === 'vilgot') hairVilgot(ctx, hx, hy, ch.headR);
  else hairMille(ctx, hx, hy, ch.headR, win);

  // ---- front arm: ghost trail when punching
  if (k === 'punch' && ext > 0.45) {
    ctx.globalAlpha = 0.22;
    for (let g = 1; g <= 2; g++) {
      const gext = ext - g * 0.3;
      if (gext > 0) {
        const gf = [lerp(shX + 36, shX + 132, gext), lerp(shY + 24, shY + 8 + aim * 0.35, gext)];
        const ge = [lerp(shX + 24, shX + 80, gext), lerp(shY + 30, shY + 18 + aim * 0.2, gext)];
        limb(ctx, [fSh, ge, gf], 13, ch.skin);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (sleeve) {
    // tee sleeve on upper arm
    limb(ctx, [fSh, [lerp(fSh[0], fElb[0], 0.55), lerp(fSh[1], fElb[1], 0.55)]], 17, topCol);
    limb(ctx, [[lerp(fSh[0], fElb[0], 0.4), lerp(fSh[1], fElb[1], 0.4)], fElb, fFist], 13, ch.skin);
  } else if (ch.id === 'mille') {
    // baggy linen sleeve down to elbow
    limb(ctx, [fSh, fElb], 19, topCol);
    limb(ctx, [fElb, fFist], 12, ch.skin);
  } else {
    limb(ctx, [fSh, fElb, fFist], 13, ch.skin, 'rgba(255,255,255,0.5)');
  }
  fist(ctx, fFist[0], fFist[1], k === 'punch' ? 12 : 10, ch.skin);
  if (ch.id === 'vilgot' && win) {
    // shades glint on win
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx + 18, hy - 10); ctx.lineTo(hx + 30, hy - 22); ctx.stroke();
  }

  ctx.restore();
}

function fist(ctx, x, y, r, skin) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  outFill(ctx, skin, 3);
  ctx.strokeStyle = 'rgba(23,16,40,0.5)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.3); ctx.lineTo(x + r * 0.5, y - r * 0.3); ctx.stroke();
}

function drawTorso(ctx, ch, hipX, hipY, shX, shY, topCol, ext, beat) {
  if (ch.id === 'vilgot') {
    // tight white tank — show arms/shoulders skin first
    ctx.beginPath();
    ctx.moveTo(hipX - 19, hipY + 6);
    ctx.quadraticCurveTo(shX - 25, hipY - 30, shX - 23, shY - 6);
    ctx.quadraticCurveTo(shX, shY - 16, shX + 23, shY - 6);
    ctx.quadraticCurveTo(shX + 25, hipY - 30, hipX + 19, hipY + 6);
    ctx.closePath();
    outFill(ctx, ch.skin, 3.4);
    // tank top
    ctx.beginPath();
    ctx.moveTo(hipX - 17, hipY + 8);
    ctx.quadraticCurveTo(shX - 21, hipY - 28, shX - 19, shY + 2);
    ctx.lineTo(shX - 9, shY - 9);
    ctx.quadraticCurveTo(shX, shY + 8, shX + 9, shY - 9);
    ctx.lineTo(shX + 19, shY + 2);
    ctx.quadraticCurveTo(shX + 21, hipY - 28, hipX + 17, hipY + 8);
    ctx.closePath();
    outFill(ctx, topCol, 3);
    ctx.fillStyle = 'rgba(120,110,140,0.25)';
    ctx.beginPath();
    ctx.moveTo(hipX - 15, hipY + 6);
    ctx.quadraticCurveTo(shX - 18, hipY - 26, shX - 16, shY + 4);
    ctx.lineTo(shX - 8, shY + 4);
    ctx.quadraticCurveTo(shX - 10, hipY - 20, hipX - 6, hipY + 6);
    ctx.closePath();
    ctx.fill();
  } else if (ch.id === 'mille') {
    // baggy linen shirt with billowy hem and open collar
    const puff = Math.sin(beat * Math.PI) * 2;
    ctx.beginPath();
    ctx.moveTo(hipX - 30 - puff, hipY + 14);
    ctx.quadraticCurveTo(hipX - 22, hipY + 20, hipX - 8, hipY + 15);
    ctx.quadraticCurveTo(hipX + 4, hipY + 20, hipX + 16, hipY + 15);
    ctx.quadraticCurveTo(hipX + 26, hipY + 19, hipX + 31 + puff, hipY + 12);
    ctx.quadraticCurveTo(shX + 32, hipY - 40, shX + 25, shY - 4);
    ctx.quadraticCurveTo(shX, shY - 15, shX - 25, shY - 4);
    ctx.quadraticCurveTo(shX - 33, hipY - 40, hipX - 30 - puff, hipY + 14);
    ctx.closePath();
    outFill(ctx, topCol, 3.4);
    // open collar V with chest
    ctx.beginPath();
    ctx.moveTo(shX + 2, shY - 10);
    ctx.lineTo(shX + 14, shY + 16);
    ctx.lineTo(shX - 9, shY + 14);
    ctx.closePath();
    ctx.fillStyle = ch.skin; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
    // fabric folds
    ctx.strokeStyle = 'rgba(120,110,90,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hipX - 14 + i * 14, shY + 28);
      ctx.quadraticCurveTo(hipX - 12 + i * 14, hipY - 8, hipX - 16 + i * 15, hipY + 12);
      ctx.stroke();
    }
  } else {
    // sheriffen boxy tee
    ctx.beginPath();
    ctx.moveTo(hipX - 24, hipY + 10);
    ctx.quadraticCurveTo(shX - 30, hipY - 36, shX - 26, shY - 8);
    ctx.quadraticCurveTo(shX, shY - 18, shX + 26, shY - 8);
    ctx.quadraticCurveTo(shX + 30, hipY - 36, hipX + 24, hipY + 10);
    ctx.closePath();
    outFill(ctx, topCol, 3.4);
    // print
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 14px "Russo One", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MMA', shX + 4, shY + 34);
    ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(shX + 4, shY + 30, 14, 0, TAU); ctx.stroke();
    // shade
    ctx.fillStyle = 'rgba(10,8,20,0.25)';
    ctx.beginPath();
    ctx.moveTo(hipX - 22, hipY + 8);
    ctx.quadraticCurveTo(shX - 27, hipY - 32, shX - 24, shY - 4);
    ctx.lineTo(shX - 12, shY - 2);
    ctx.quadraticCurveTo(shX - 16, hipY - 24, hipX - 10, hipY + 8);
    ctx.closePath();
    ctx.fill();
  }
  // belt hint
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(hipX - 16, hipY + 11);
  ctx.lineTo(hipX + 16, hipY + 11);
  ctx.stroke();
}

function shoe(ctx, ch, x, y, tilt) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  if (ch.id === 'vilgot') {
    // flip flop: sole + bare foot + strap
    ctx.beginPath(); ctx.ellipse(8, -2, 21, 6, 0, 0, TAU);
    outFill(ctx, '#2e2e30', 2.6);
    ctx.beginPath(); ctx.ellipse(7, -7, 17, 6, 0, 0, TAU);
    outFill(ctx, ch.skin, 2.4);
    ctx.strokeStyle = '#15161c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(18, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(6, -4); ctx.stroke();
    // toes
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(20 + i * 1.4, -8 + i * 1.5); ctx.lineTo(23 + i * 1.4, -8 + i * 1.5); ctx.stroke();
    }
  } else if (ch.id === 'mille') {
    // birkenstock loafer — brown suede, strap stitch
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-13, -12, 0, -13);
    ctx.quadraticCurveTo(16, -13, 24, -6);
    ctx.quadraticCurveTo(27, -2, 24, 0);
    ctx.closePath();
    outFill(ctx, '#8a5a33', 2.8);
    ctx.beginPath(); ctx.ellipse(6, 0, 19, 3.5, 0, 0, TAU);
    ctx.fillStyle = '#5e3c20'; ctx.fill();
    ctx.strokeStyle = '#5e3c20'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.quadraticCurveTo(4, -12, 16, -8); ctx.stroke();
  } else {
    // sheriffen boot
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-13, -16);
    ctx.quadraticCurveTo(0, -18, 6, -12);
    ctx.quadraticCurveTo(20, -11, 24, -4);
    ctx.quadraticCurveTo(26, -1, 23, 0);
    ctx.closePath();
    outFill(ctx, '#1d1e26', 2.8);
    ctx.strokeStyle = '#3a3c4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(20, -3); ctx.stroke();
  }
  ctx.restore();
}

/* ================= ENEMIES ================= */
/* origin at feet, facing LEFT (toward the player).
   e: {v:0..2, color}  pose: {kind:'run'|'attack'|'die', ph, t} */
function drawEnemy(ctx, e, pose) {
  const k = pose.kind || 'run';
  const ph = pose.ph || 0;
  const col = e.color;
  ctx.save();

  const run = k === 'run';
  const sw = run ? Math.sin(ph) : 0;
  const bob = run ? -Math.abs(Math.cos(ph)) * 4 : 0;
  const lean = k === 'die' ? 0.35 : -0.13;
  ctx.rotate(lean);

  const hipY = -88 + bob, shY = -138 + bob, hy = -162 + bob;
  const skin = e.v === 2 ? '#9aa3b8' : '#dca97c';
  const cloth = e.v === 0 ? '#23252e' : e.v === 1 ? '#262b36' : '#3c4254';
  const pant = e.v === 0 ? '#3c465c' : e.v === 1 ? '#31394a' : '#2c3140';

  // legs (scissor when running, splayed when dying)
  const fFoot = k === 'die' ? [-30, -10] : [-20 + sw * 16, 0];
  const bFoot = k === 'die' ? [26, -6] : [16 - sw * 16, 0];
  limb(ctx, [[6, hipY], [(6 + bFoot[0]) / 2 + 4, hipY * 0.5], [bFoot[0], bFoot[1] - 8]], 16, pant);
  enemyShoe(ctx, e, bFoot[0], bFoot[1]);
  // back arm
  const bArm = k === 'attack' ? [26, shY + 6] : k === 'die' ? [30, shY - 26] : [10 - sw * 12, shY + 30];
  limb(ctx, [[10, shY + 4], [16, shY + 18], bArm], 11, e.v === 2 ? '#4a5263' : cloth);
  fist(ctx, bArm[0], bArm[1], 7, skin);

  // torso
  ctx.beginPath();
  ctx.moveTo(-16, hipY + 6);
  ctx.quadraticCurveTo(-24, shY + 20, -19, shY - 6);
  ctx.quadraticCurveTo(0, shY - 14, 19, shY - 6);
  ctx.quadraticCurveTo(24, shY + 20, 16, hipY + 6);
  ctx.closePath();
  outFill(ctx, cloth, 3);
  if (e.v === 0) {
    // ripped vest edge + skin
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-6, shY - 8); ctx.lineTo(2, shY + 16); ctx.lineTo(-12, shY + 14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  }
  if (e.v === 2) {
    // chest core
    ctx.beginPath(); ctx.arc(-2, shY + 22, 8, 0, TAU);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    // plate lines
    ctx.strokeStyle = '#262b38'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, shY + 36); ctx.lineTo(14, shY + 36); ctx.stroke();
  }

  // front leg
  limb(ctx, [[-6, hipY], [(-6 + fFoot[0]) / 2 - 6, hipY * 0.5], [fFoot[0], fFoot[1] - 8]], 16, pant, 'rgba(255,255,255,0.25)');
  enemyShoe(ctx, e, fFoot[0], fFoot[1]);

  // head per variant
  if (e.v === 0) {
    enemyHeadBase(ctx, hy, skin, k);
    // mohawk in lane color
    ctx.beginPath();
    ctx.moveTo(14, hy - 16);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(10 - i * 7, hy - 34 - Math.sin(i) * 4);
      ctx.lineTo(6 - i * 7, hy - 16 + i * 1.5);
    }
    ctx.closePath();
    outFill(ctx, col, 2.6);
  } else if (e.v === 1) {
    // hood
    ctx.beginPath();
    ctx.arc(0, hy, 21, 0, TAU);
    outFill(ctx, cloth, 3);
    ctx.beginPath();
    ctx.arc(-3, hy + 1, 14, 0, TAU);
    ctx.fillStyle = '#0c0e14'; ctx.fill();
    // glowing visor
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
    rr(ctx, -15, hy - 4, 18, 6, 3); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // robot box head
    rr(ctx, -16, hy - 14, 30, 27, 5);
    outFill(ctx, '#4a5263', 3);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
    rr(ctx, -13, hy - 4, 16, 5, 2); ctx.fill();
    ctx.shadowBlur = 0;
    // antenna
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(8, hy - 14); ctx.lineTo(12, hy - 26); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, hy - 28, 3, 0, TAU);
    ctx.fillStyle = col; ctx.fill();
  }

  // front arm (attack swing toward player)
  const aT = k === 'attack' ? clamp(pose.t || 0, 0, 1) : 0;
  const fArm = k === 'die' ? [-32, shY - 22]
    : k === 'attack' ? [lerp(-14, -52, easeOut(aT)), lerp(shY + 26, shY + 6, easeOut(aT))]
    : [-12 + sw * 12, shY + 28];
  limb(ctx, [[-10, shY + 4], [-18, shY + 16], fArm], 11, e.v === 2 ? '#4a5263' : cloth);
  fist(ctx, fArm[0], fArm[1], k === 'attack' ? 9 : 7, skin);

  ctx.restore();
}

function enemyHeadBase(ctx, hy, skin, k) {
  ctx.beginPath();
  ctx.moveTo(16, hy - 14);
  ctx.quadraticCurveTo(20, hy + 6, 10, hy + 15);
  ctx.quadraticCurveTo(-2, hy + 20, -12, hy + 12);
  ctx.quadraticCurveTo(-20, hy + 2, -16, hy - 12);
  ctx.quadraticCurveTo(-4, hy - 20, 16, hy - 14);
  ctx.closePath();
  outFill(ctx, skin, 2.8);
  // angry eyes / X eyes
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  if (k === 'die') {
    [-10, 0].forEach(ex => {
      ctx.beginPath();
      ctx.moveTo(ex - 3, hy - 4); ctx.lineTo(ex + 3, hy + 2);
      ctx.moveTo(ex + 3, hy - 4); ctx.lineTo(ex - 3, hy + 2);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = '#fff';
    [-11, -1].forEach(ex => {
      ctx.beginPath(); ctx.ellipse(ex, hy - 1, 4, 2.6, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1320';
      ctx.beginPath(); ctx.arc(ex - 1.4, hy - 1, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
    });
    // brows down
    ctx.beginPath(); ctx.moveTo(-15, hy - 7); ctx.lineTo(-7, hy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, hy - 5); ctx.lineTo(3, hy - 7); ctx.stroke();
  }
  // snarl
  ctx.beginPath();
  ctx.moveTo(-12, hy + 9);
  ctx.quadraticCurveTo(-6, hy + 7, 0, hy + 10);
  ctx.stroke();
}

function enemyShoe(ctx, e, x, y) {
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 10, y - 9);
  ctx.quadraticCurveTo(x - 2, y - 11, x - 8, y - 6);
  ctx.quadraticCurveTo(x - 18, y - 5, x - 20, y - 1);
  ctx.lineTo(x - 20, y);
  ctx.closePath();
  outFill(ctx, e.v === 1 ? '#c8ccd4' : '#15161c', 2.4);
}

/* key badge shown on incoming enemies */
function drawKeyBadge(ctx, x, y, letter, color, pulse) {
  const r = 19 * (1 + pulse * 0.12);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * TAU / 6;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,5,16,0.82)';
  ctx.fill();
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 1.05)}px "Russo One", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, 0, 2);
  ctx.restore();
}

/* ================= BACKGROUND ================= */

const FLOOR_Y = 370;
let wallCache = null, wallHue = -1;
let signCache = null, signHue = -1;

function makeWall(hue) {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  // wall
  const grad = g.createLinearGradient(0, 0, 0, FLOOR_Y);
  grad.addColorStop(0, `hsl(${hue}, 28%, 5%)`);
  grad.addColorStop(1, `hsl(${hue}, 32%, 11%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, FLOOR_Y);
  // concrete panels
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3;
  for (let x = 80; x < 1280; x += 170) {
    g.beginPath(); g.moveTo(x, 30); g.lineTo(x, FLOOR_Y); g.stroke();
  }
  g.beginPath(); g.moveTo(0, 190); g.lineTo(1280, 190); g.stroke();
  // pipes
  g.strokeStyle = `hsl(${hue}, 15%, 16%)`; g.lineWidth = 12;
  g.beginPath(); g.moveTo(0, 34); g.lineTo(1280, 34); g.stroke();
  g.beginPath(); g.moveTo(0, 58); g.lineTo(1280, 58); g.stroke();
  g.fillStyle = `hsl(${hue}, 15%, 22%)`;
  for (let x = 100; x < 1280; x += 240) { g.fillRect(x, 24, 14, 44); }
  // hanging cables
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const x0 = 150 + i * 300;
    g.beginPath();
    g.moveTo(x0, 64);
    g.quadraticCurveTo(x0 + 70, 64 + 60 + i * 12, x0 + 150, 64);
    g.stroke();
  }
  // graffiti
  const tags = [
    ['SKÅNE', 130, 290, -0.06, 'rgba(255,79,216,0.4)', 44],
    ['BASS', 1010, 160, 0.05, 'rgba(62,230,255,0.35)', 38],
    ['MÖLLAN', 870, 300, -0.04, 'rgba(255,210,74,0.32)', 40],
    ['UNDERJORD', 420, 330, 0.03, 'rgba(125,255,94,0.3)', 30]
  ];
  g.textAlign = 'center';
  for (const tg of tags) {
    g.save();
    g.translate(tg[1], tg[2]); g.rotate(tg[3]);
    g.font = `${tg[5]}px "Bungee", Impact, sans-serif`;
    g.fillStyle = tg[4];
    g.fillText(tg[0], 0, 0);
    g.restore();
  }
  // crown doodle
  g.strokeStyle = 'rgba(255,210,74,0.4)'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(640, 120); g.lineTo(648, 100); g.lineTo(656, 114); g.lineTo(664, 96);
  g.lineTo(672, 114); g.lineTo(680, 100); g.lineTo(688, 120);
  g.closePath(); g.stroke();
  // speaker stacks
  for (const sx of [30, 1130]) {
    for (let row = 0; row < 3; row++) {
      const y = FLOOR_Y - 100 - row * 88;
      g.fillStyle = '#0e0a18';
      g.fillRect(sx, y, 120, 84);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
      g.strokeRect(sx + 3, y + 3, 114, 78);
    }
  }
  // floor base
  const fg = g.createLinearGradient(0, FLOOR_Y, 0, 720);
  fg.addColorStop(0, `hsl(${hue}, 30%, 13%)`);
  fg.addColorStop(0.25, `hsl(${hue}, 25%, 7%)`);
  fg.addColorStop(1, '#05030a');
  g.fillStyle = fg;
  g.fillRect(0, FLOOR_Y, 1280, 720 - FLOOR_Y);
  // floor seams (perspective)
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = FLOOR_Y + 30 + i * i * 16;
    g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke();
  }
  // horizon rim
  g.strokeStyle = `hsla(${hue}, 90%, 60%, 0.35)`; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, FLOOR_Y); g.lineTo(1280, FLOOR_Y); g.stroke();
  return c;
}

function makeSign(hue) {
  const c = document.createElement('canvas');
  c.width = 620; c.height = 170;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  const neon = `hsl(${(hue + 140) % 360}, 100%, 65%)`;
  g.font = '64px "Bungee", Impact, sans-serif';
  g.shadowColor = neon; g.shadowBlur = 26;
  g.strokeStyle = neon; g.lineWidth = 2.5;
  g.fillStyle = '#fff';
  g.strokeText('MALMÖ', 310, 70);
  g.fillText('MALMÖ', 310, 70);
  g.font = '34px "Bungee", Impact, sans-serif';
  const neon2 = `hsl(${hue}, 100%, 65%)`;
  g.shadowColor = neon2;
  g.strokeStyle = neon2;
  g.strokeText('UNDERGROUND', 310, 124);
  g.fillText('UNDERGROUND', 310, 124);
  return c;
}

/* dynamic background. o: {t, beat, energy, hue, flash} */
function drawBG(ctx, o) {
  const { t, beat, energy, hue } = o;
  if (!wallCache || wallHue !== hue) { wallCache = makeWall(hue); wallHue = hue; }
  if (!signCache || signHue !== hue) { signCache = makeSign(hue); signHue = hue; }
  ctx.drawImage(wallCache, 0, 0);

  const bph = beat - Math.floor(beat); // beat phase 0..1
  const pump = Math.max(0, 1 - bph * 3);

  // crowd silhouettes along the back wall
  ctx.fillStyle = 'rgba(6,4,12,0.95)';
  for (let i = 0; i < 16; i++) {
    const cx = 50 + i * 80 + Math.sin(i * 7.3) * 18;
    const bobY = Math.abs(Math.sin(beat * Math.PI + i * 1.3)) * 7 * (0.4 + energy);
    const cy = FLOOR_Y - 4 - bobY;
    ctx.beginPath(); ctx.arc(cx, cy - 46, 11, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.quadraticCurveTo(cx, cy - 44, cx + 16, cy);
    ctx.closePath(); ctx.fill();
    if (i % 3 === 0) { // arms up
      ctx.strokeStyle = 'rgba(6,4,12,0.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 36); ctx.lineTo(cx - 20, cy - 58 - bobY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 10, cy - 36); ctx.lineTo(cx + 22, cy - 56 - bobY); ctx.stroke();
    }
  }

  // neon sign with flicker
  const flick = 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 7.7);
  ctx.globalAlpha = clamp(flick, 0.55, 1);
  ctx.drawImage(signCache, 330, 66);
  // floor reflection of sign
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.translate(330, FLOOR_Y * 2 - 66 - 40);
  ctx.scale(1, -0.45);
  ctx.drawImage(signCache, 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;

  // lasers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const nLas = Math.round(2 + energy * 4);
  for (const em of [[260, 70], [1020, 70]]) {
    for (let i = 0; i < nLas; i++) {
      const a = Math.PI / 2 + Math.sin(t * (0.7 + i * 0.13) + i * 2.1 + em[0]) * 0.55;
      const lx = em[0] + Math.cos(a) * 900;
      const ly = em[1] + Math.sin(a) * 900;
      const lcol = `hsla(${(hue + i * 42) % 360}, 100%, 62%`;
      ctx.strokeStyle = `${lcol}, ${0.05 + pump * 0.06})`;
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(em[0], em[1]); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.strokeStyle = `${lcol}, ${0.22 + pump * 0.2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(em[0], em[1]); ctx.lineTo(lx, ly); ctx.stroke();
    }
    // emitter glow
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${0.5 + pump * 0.4})`;
    ctx.beginPath(); ctx.arc(em[0], em[1], 7, 0, TAU); ctx.fill();
  }
  // woofer pulse rings on the speaker stacks
  for (const sx of [90, 1190]) {
    for (let row = 0; row < 3; row++) {
      const y = FLOOR_Y - 58 - row * 88;
      ctx.strokeStyle = `hsla(${hue}, 80%, 55%, ${0.3 + pump * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, y, 26 + pump * 5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, y, 10 + pump * 3, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();

  // drifting fog
  for (let i = 0; i < 3; i++) {
    const fx = ((t * (12 + i * 6) + i * 500) % 1700) - 200;
    const fy = FLOOR_Y - 30 + i * 80;
    const fr = 260 + i * 60;
    const fog = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fog.addColorStop(0, `hsla(${hue}, 60%, 50%, 0.05)`);
    fog.addColorStop(1, 'transparent');
    ctx.fillStyle = fog;
    ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
  }

  // strobe on the beat at high energy
  if (energy > 0.7 && bph < 0.09) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 * energy * (1 - bph / 0.09)})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
  if (o.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${o.flash * 0.35})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
}

function vignette(ctx) {
  const v = ctx.createRadialGradient(640, 340, 320, 640, 360, 760);
  v.addColorStop(0, 'transparent');
  v.addColorStop(1, 'rgba(2,1,6,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 1280, 720);
}

function resetCache() { wallCache = null; signCache = null; wallHue = -1; signHue = -1; }

return { CHARS, drawFighter, drawEnemy, drawKeyBadge, drawBG, vignette, resetCache, FLOOR_Y, rr, lerp, clamp, easeOut };

})();
