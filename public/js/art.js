/* MALMÖ UNDERGROUND — art module v2.
   All characters, enemies and the rave warehouse are drawn in code.
   Anime cel style: every shape is shaded with a clipped shadow crescent
   (light from upper-left) plus a neon rim light on the enemy-facing edge. */
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

/* cel(build, fill): fill + shadow crescent (bottom-right) + rim light + outline.
   build(ctx) must only construct the path. */
function cel(ctx, build, fill, o) {
  o = o || {};
  build(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  // shade: darken whole shape, then re-fill base shifted up-left → crescent stays dark
  ctx.save();
  build(ctx); ctx.clip();
  build(ctx);
  ctx.fillStyle = `rgba(30,10,60,${o.shade === undefined ? 0.16 : o.shade})`;
  ctx.fill();
  ctx.save();
  ctx.translate(-(o.sx === undefined ? 3 : o.sx), -(o.sy === undefined ? 4 : o.sy));
  build(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.restore();
  if (o.rim) {
    ctx.save();
    build(ctx); ctx.clip();
    ctx.save();
    ctx.translate(-2.5, -0.5);
    build(ctx);
    ctx.strokeStyle = o.rim;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  build(ctx);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = o.lw === undefined ? 3 : o.lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function capsulePath(c, x1, y1, r1, x2, y2, r2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath();
  c.arc(x1, y1, r1, a + Math.PI / 2, a + Math.PI * 1.5);
  c.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  c.closePath();
}

/* tapered limb segment with cel shading */
function limbT(ctx, x1, y1, r1, x2, y2, r2, color, o) {
  cel(ctx, c => capsulePath(c, x1, y1, r1, x2, y2, r2), color,
    Object.assign({ lw: 2.8, sx: 2, sy: 3 }, o));
}

function outFill(ctx, fill, lw) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw || 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/* ================= ANIME FACES ================= */

/* tall anime eye with gradient iris, lash bar and glints.
   o: {iris:[light,base,dark], closed, pain} */
function animeEye(ctx, x, y, w, h, o) {
  o = o || {};
  if (o.closed) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.pain) {
      ctx.moveTo(x - w / 2, y - h / 4); ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x - w / 2, y + h / 4);
    } else {
      ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y + h / 4, x + w / 2, y);
    }
    ctx.stroke();
    return;
  }
  // sclera — flat-ish top, round bottom
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * 0.28);
  ctx.quadraticCurveTo(x, y - h * 0.52, x + w / 2, y - h * 0.3);
  ctx.quadraticCurveTo(x + w * 0.58, y + h * 0.1, x + w * 0.32, y + h * 0.42);
  ctx.quadraticCurveTo(x, y + h * 0.55, x - w * 0.34, y + h * 0.4);
  ctx.quadraticCurveTo(x - w * 0.58, y + h * 0.1, x - w / 2, y - h * 0.28);
  ctx.closePath();
  ctx.fillStyle = '#fdfbf6';
  ctx.fill();
  // iris — vertical ellipse with 3-stop gradient
  const ir = o.iris || ['#bfe8ff', '#5da9dd', '#1d4e7a'];
  const iw = w * 0.34, ih = h * 0.46;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.04, y + h * 0.02, iw, ih, 0, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(x + w * 0.04, y + h * 0.18, ih * 0.1, x + w * 0.04, y, ih * 1.15);
  g.addColorStop(0, ir[0]);
  g.addColorStop(0.55, ir[1]);
  g.addColorStop(1, ir[2]);
  ctx.fillStyle = g;
  ctx.fillRect(x - w, y - h, w * 2, h * 2);
  // pupil
  ctx.beginPath();
  ctx.ellipse(x + w * 0.04, y + h * 0.04, iw * 0.42, ih * 0.46, 0, 0, TAU);
  ctx.fillStyle = '#140e20';
  ctx.fill();
  // lash shadow across iris top
  ctx.fillStyle = 'rgba(35,18,70,0.4)';
  ctx.fillRect(x - w, y - h, w * 2, h - ih * 0.3);
  ctx.restore();
  // glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(x - iw * 0.3, y - ih * 0.35, iw * 0.34, ih * 0.24, -0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + iw * 0.45, y + ih * 0.4, iw * 0.16, 0, TAU); ctx.fill();
  // top lash bar with outer wing
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 1, y - h * 0.22);
  ctx.quadraticCurveTo(x, y - h * 0.6, x + w / 2 + 1, y - h * 0.3);
  ctx.lineTo(x + w / 2 + w * 0.14, y - h * 0.42);
  ctx.stroke();
  // lower lid hint
  ctx.strokeStyle = 'rgba(23,16,40,0.45)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.26, y + h * 0.46);
  ctx.quadraticCurveTo(x + w * 0.1, y + h * 0.56, x + w * 0.36, y + h * 0.44);
  ctx.stroke();
}

function browLine(ctx, x, y, w, angry) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  if (angry) {
    ctx.moveTo(x - w / 2, y + 3);
    ctx.quadraticCurveTo(x + w * 0.1, y - 2, x + w / 2, y - 5);
  } else {
    ctx.moveTo(x - w / 2, y + 1);
    ctx.quadraticCurveTo(x, y - 3, x + w / 2, y - 1);
  }
  ctx.stroke();
}

function mouthShape(ctx, x, y, kind) {
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  if (kind === 'shout') {
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 3);
    ctx.quadraticCurveTo(x + 6, y - 5, x + 7, y + 1);
    ctx.quadraticCurveTo(x + 6, y + 7, x - 1, y + 7);
    ctx.quadraticCurveTo(x - 6, y + 6, x - 5, y - 3);
    ctx.closePath();
    ctx.fillStyle = '#5d2335'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y - 3, 8, 2.6);
  } else if (kind === 'grit') {
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    for (let i = 0; i < 4; i++) ctx.lineTo(x - 7 + (i + 1) * 3.6, y + (i % 2 ? -2.6 : 2.6));
    ctx.stroke();
  } else if (kind === 'grin') {
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 2);
    ctx.quadraticCurveTo(x + 1, y + 7, x + 9, y - 3);
    ctx.quadraticCurveTo(x + 2, y + 2, x - 8, y - 2);
    ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 1);
    ctx.quadraticCurveTo(x + 2, y + 3, x + 7, y - 1);
    ctx.stroke();
  }
}

/* anime head, 3/4 facing right: wide cranium → cheek → sharp chin */
function headPath(c, hx, hy, r) {
  c.beginPath();
  c.moveTo(hx - r * 0.98, hy - r * 0.15);
  c.quadraticCurveTo(hx - r * 1.02, hy - r * 1.05, hx - r * 0.15, hy - r * 1.16);
  c.quadraticCurveTo(hx + r * 0.62, hy - r * 1.22, hx + r * 0.88, hy - r * 0.7);
  c.quadraticCurveTo(hx + r * 1.0, hy - r * 0.3, hx + r * 0.95, hy + r * 0.05);
  c.quadraticCurveTo(hx + r * 1.02, hy + r * 0.32, hx + r * 0.82, hy + r * 0.52); // cheek
  c.quadraticCurveTo(hx + r * 0.62, hy + r * 0.92, hx + r * 0.28, hy + r * 1.12); // jaw
  c.lineTo(hx + r * 0.08, hy + r * 1.16); // chin point
  c.quadraticCurveTo(hx - r * 0.42, hy + r * 1.02, hx - r * 0.72, hy + r * 0.55);
  c.quadraticCurveTo(hx - r * 0.98, hy + r * 0.2, hx - r * 0.98, hy - r * 0.15);
  c.closePath();
}

function drawHead(ctx, hx, hy, r, ch, k) {
  cel(ctx, c => headPath(c, hx, hy, r), ch.skin, { lw: 3, rim: ch.rim, sx: 2.5, sy: 3.5 });
  // ear
  cel(ctx, c => {
    c.beginPath();
    c.ellipse(hx - r * 0.6, hy + r * 0.16, r * 0.13, r * 0.21, -0.12, 0, TAU);
  }, ch.skin, { lw: 1.8, shade: 0.1 });
  ctx.strokeStyle = 'rgba(23,16,40,0.35)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(hx - r * 0.61, hy + r * 0.16, r * 0.07, -1, 1.8);
  ctx.stroke();
  // nose: short line + shadow tick
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.84, hy + r * 0.14);
  ctx.lineTo(hx + r * 0.92, hy + r * 0.3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(23,16,40,0.35)';
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.78, hy + r * 0.38);
  ctx.lineTo(hx + r * 0.86, hy + r * 0.36);
  ctx.stroke();
}

function drawFace(ctx, hx, hy, r, ch, k) {
  const pain = k === 'hit' || k === 'ko';
  const ey = hy + r * 0.02;
  if (ch.shades) {
    // small rectangular sunglasses with reflective gradient
    const lg = ctx.createLinearGradient(hx - r * 0.3, ey - 8, hx + r * 0.9, ey + 8);
    lg.addColorStop(0, '#1c2026'); lg.addColorStop(0.5, '#070a0e'); lg.addColorStop(1, '#232a33');
    ctx.fillStyle = lg;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    rr(ctx, hx - r * 0.32, ey - 7, r * 0.52, 14, 3); ctx.fill(); ctx.stroke();
    rr(ctx, hx + r * 0.32, ey - 7, r * 0.55, 14, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + r * 0.2, ey - 2); ctx.lineTo(hx + r * 0.32, ey - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx - r * 0.32, ey - 2); ctx.lineTo(hx - r * 0.6, ey - 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + r * 0.4, ey + 4); ctx.lineTo(hx + r * 0.55, ey - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx - r * 0.24, ey + 4); ctx.lineTo(hx - r * 0.12, ey - 5); ctx.stroke();
    browLine(ctx, hx - r * 0.06, ey - 13, r * 0.42, k === 'punch' || pain);
    browLine(ctx, hx + r * 0.58, ey - 14, r * 0.46, k === 'punch' || pain);
  } else {
    const ew = r * ch.eyeW, eh = r * ch.eyeH;
    animeEye(ctx, hx - r * 0.08, ey, ew * 0.8, eh * 0.92, { iris: ch.iris, closed: pain, pain });
    animeEye(ctx, hx + r * 0.58, ey, ew, eh, { iris: ch.iris, closed: pain, pain });
    browLine(ctx, hx - r * 0.08, ey - eh * 0.72, ew * 0.74, k === 'punch' || pain);
    browLine(ctx, hx + r * 0.6, ey - eh * 0.78, ew * 0.92, k === 'punch' || pain);
  }
  if (ch.blush && k === 'win') {
    ctx.strokeStyle = 'rgba(255,120,130,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + r * (0.62 + i * 0.12), ey + r * 0.42);
      ctx.lineTo(hx + r * (0.54 + i * 0.12), ey + r * 0.58);
      ctx.stroke();
    }
  }
  const mk = k === 'punch' ? 'shout' : pain ? 'grit' : k === 'win' ? 'grin' : 'smirk';
  ctx.save();
  ctx.translate(hx + r * 0.42, hy + r * 0.68);
  ctx.scale(r / 19, r / 19);
  mouthShape(ctx, 0, 0, mk);
  ctx.restore();
}

/* ================= HAIR / HATS ================= */

function hairSheriffen(ctx, hx, hy, r) {
  // bald shine
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx - r * 0.15, hy - r * 0.5, r * 0.55, -2.5, -1.7);
  ctx.stroke();
  // full viking beard with spiky bottom — mouth stays visible
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(hx - r * 0.72, hy + r * 0.08);
    c.quadraticCurveTo(hx - r * 0.75, hy + r * 0.85, hx - r * 0.42, hy + r * 1.28);
    c.lineTo(hx - r * 0.22, hy + r * 1.62);
    c.lineTo(hx - r * 0.02, hy + r * 1.3);
    c.lineTo(hx + r * 0.18, hy + r * 1.68);
    c.lineTo(hx + r * 0.38, hy + r * 1.32);
    c.lineTo(hx + r * 0.55, hy + r * 1.52);
    c.quadraticCurveTo(hx + r * 0.85, hy + r * 0.95, hx + r * 0.92, hy + r * 0.42);
    c.lineTo(hx + r * 0.7, hy + r * 0.38);
    c.quadraticCurveTo(hx + r * 0.68, hy + r * 0.88, hx + r * 0.28, hy + r * 0.98);
    c.quadraticCurveTo(hx - r * 0.18, hy + r * 1.02, hx - r * 0.38, hy + r * 0.6);
    c.quadraticCurveTo(hx - r * 0.48, hy + r * 0.3, hx - r * 0.5, hy + r * 0.1);
    c.closePath();
  }, '#c08438', { lw: 2.8, shade: 0.2 });
  // beard texture
  ctx.strokeStyle = 'rgba(120,70,20,0.5)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - r * (0.5 - i * 0.3), hy + r * 0.55);
    ctx.quadraticCurveTo(hx - r * (0.42 - i * 0.3), hy + r * 0.95, hx - r * (0.5 - i * 0.32), hy + r * 1.25);
    ctx.stroke();
  }
  // braid with gold bead
  ctx.fillStyle = '#a8702c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
  rr(ctx, hx + r * 0.02, hy + r * 1.6, r * 0.18, r * 0.3, r * 0.07); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  rr(ctx, hx, hy + r * 1.88, r * 0.22, r * 0.14, r * 0.05); ctx.fill(); ctx.stroke();
  // mustache — sits just above the mouth, droops at the ends
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(hx + r * 0.2, hy + r * 0.56);
    c.quadraticCurveTo(hx + r * 0.45, hy + r * 0.42, hx + r * 0.72, hy + r * 0.5);
    c.quadraticCurveTo(hx + r * 0.8, hy + r * 0.62, hx + r * 0.74, hy + r * 0.72);
    c.quadraticCurveTo(hx + r * 0.6, hy + r * 0.56, hx + r * 0.42, hy + r * 0.6);
    c.quadraticCurveTo(hx + r * 0.3, hy + r * 0.66, hx + r * 0.2, hy + r * 0.56);
    c.closePath();
  }, '#b87a32', { lw: 2, shade: 0.12 });
  // sheriff hat — brim, pinched crown, band, star
  cel(ctx, c => {
    c.beginPath();
    c.ellipse(hx + r * 0.02, hy - r * 0.74, r * 1.5, r * 0.32, -0.05, 0, TAU);
  }, '#7a5230', { lw: 3, shade: 0.2 });
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(hx - r * 0.7, hy - r * 0.76);
    c.quadraticCurveTo(hx - r * 0.78, hy - r * 1.62, hx - r * 0.3, hy - r * 1.74);
    c.quadraticCurveTo(hx - r * 0.02, hy - r * 1.48, hx + r * 0.26, hy - r * 1.76);
    c.quadraticCurveTo(hx + r * 0.82, hy - r * 1.66, hx + r * 0.76, hy - r * 0.78);
    c.closePath();
  }, '#84592f', { lw: 3, shade: 0.18 });
  ctx.fillStyle = '#52351c';
  ctx.fillRect(hx - r * 0.7, hy - r * 1.0, r * 1.46, r * 0.22);
  // stitch dashes on brim
  ctx.strokeStyle = 'rgba(255,220,150,0.4)'; ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.ellipse(hx + r * 0.02, hy - r * 0.74, r * 1.36, r * 0.24, -0.05, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // gold star
  ctx.save();
  ctx.translate(hx + r * 0.06, hy - r * 1.14);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? r * 0.11 : r * 0.24;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd34d'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.restore();
}

function vilgotHairBack(ctx, hx, hy, r) {
  // chest-length mane falling BEHIND the head and back shoulder
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(hx + r * 0.95, hy - r * 0.4);
    c.quadraticCurveTo(hx + r * 0.7, hy - r * 1.45, hx - r * 0.3, hy - r * 1.4);
    c.quadraticCurveTo(hx - r * 1.6, hy - r * 1.15, hx - r * 1.85, hy - r * 0.1);
    c.quadraticCurveTo(hx - r * 2.35, hy + r * 0.9, hx - r * 2.3, hy + r * 1.9);
    c.quadraticCurveTo(hx - r * 2.3, hy + r * 2.5, hx - r * 2.0, hy + r * 2.95);
    c.quadraticCurveTo(hx - r * 1.75, hy + r * 3.05, hx - r * 1.62, hy + r * 2.5);
    c.quadraticCurveTo(hx - r * 1.42, hy + r * 2.95, hx - r * 1.2, hy + r * 2.4);
    c.quadraticCurveTo(hx - r * 1.05, hy + r * 2.7, hx - r * 0.95, hy + r * 2.05);
    c.quadraticCurveTo(hx - r * 0.95, hy + r * 1.2, hx - r * 0.85, hy + r * 0.6);
    c.quadraticCurveTo(hx + r * 0.3, hy + r * 0.35, hx + r * 0.95, hy - r * 0.4);
    c.closePath();
  }, '#3c2c1d', { lw: 3, shade: 0.24 });
  // strand lines inside the mane
  ctx.strokeStyle = 'rgba(20,12,6,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - r * (1.1 + i * 0.35), hy + r * 0.5);
    ctx.quadraticCurveTo(hx - r * (1.35 + i * 0.35), hy + r * 1.5, hx - r * (1.15 + i * 0.38), hy + r * 2.4);
    ctx.stroke();
  }
}

function vilgotHairFront(ctx, hx, hy, r) {
  // curl lobes hugging the skull, cascading down the BACK side
  const lobes = [
    [-0.9, -0.8, 0.42], [-0.3, -1.18, 0.44], [0.38, -1.12, 0.42], [0.88, -0.72, 0.34],
    [1.02, -0.2, 0.24], [-1.42, -0.35, 0.38], [-1.78, 0.45, 0.35], [-1.95, 1.2, 0.33],
    [-1.9, 1.9, 0.31], [-1.7, 2.55, 0.3], [-1.45, 2.85, 0.26]
  ];
  for (const L of lobes) {
    cel(ctx, c => {
      c.beginPath();
      c.arc(hx + L[0] * r, hy + L[1] * r, L[2] * r, 0, TAU);
    }, '#4a3624', { lw: 2.4, shade: 0.2, sx: 2, sy: 3 });
  }
  // hairline curls over the forehead
  const front = [[0.62, -0.78, 0.27], [0.12, -0.92, 0.3], [-0.45, -0.85, 0.28]];
  for (const L of front) {
    cel(ctx, c => {
      c.beginPath();
      c.arc(hx + L[0] * r, hy + L[1] * r, L[2] * r, 0, TAU);
    }, '#544029', { lw: 2.2, shade: 0.16, sx: 2, sy: 2.5 });
  }
  // highlight crescents
  ctx.strokeStyle = 'rgba(214,176,124,0.55)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < lobes.length; i += 2) {
    const L = lobes[i];
    ctx.beginPath();
    ctx.arc(hx + L[0] * r - 2, hy + L[1] * r - 3, L[2] * r * 0.55, -2.6, -1.2);
    ctx.stroke();
  }
  // curl swirl details
  ctx.strokeStyle = '#2c2014'; ctx.lineWidth = 1.8;
  for (let i = 1; i < lobes.length; i += 3) {
    const L = lobes[i];
    ctx.beginPath();
    ctx.arc(hx + L[0] * r, hy + L[1] * r, L[2] * r * 0.4, i, i + 3.6);
    ctx.stroke();
  }
}

function hairMille(ctx, hx, hy, r, halo) {
  // voluminous golden backslick — lifted quiff at the front, pointed tips at the nape
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(hx + r * 0.88, hy - r * 0.52);
    c.quadraticCurveTo(hx + r * 0.85, hy - r * 1.25, hx + r * 0.15, hy - r * 1.46); // lifted quiff
    c.quadraticCurveTo(hx - r * 0.6, hy - r * 1.52, hx - r * 1.1, hy - r * 1.05);
    c.quadraticCurveTo(hx - r * 1.38, hy - r * 0.6, hx - r * 1.28, hy - r * 0.05);
    c.lineTo(hx - r * 1.62, hy + r * 0.35);  // nape spike 1
    c.lineTo(hx - r * 1.12, hy + r * 0.3);
    c.lineTo(hx - r * 1.38, hy + r * 0.78);  // nape spike 2
    c.lineTo(hx - r * 0.95, hy + r * 0.52);
    c.quadraticCurveTo(hx - r * 0.88, hy + r * 0.1, hx - r * 0.8, hy - r * 0.22);
    c.quadraticCurveTo(hx - r * 0.65, hy - r * 0.78, hx - r * 0.05, hy - r * 0.84);
    c.quadraticCurveTo(hx + r * 0.4, hy - r * 0.86, hx + r * 0.62, hy - r * 0.68);
    c.quadraticCurveTo(hx + r * 0.78, hy - r * 0.58, hx + r * 0.88, hy - r * 0.52);
    c.closePath();
  }, '#f0c75e', { lw: 2.8, shade: 0.18, rim: 'rgba(255,240,180,0.8)' });
  // slick flow strands following the sweep
  ctx.strokeStyle = '#d3a53f'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + r * (0.62 - i * 0.1), hy - r * (0.68 + i * 0.16));
    ctx.quadraticCurveTo(hx - r * 0.3, hy - r * (1.18 - i * 0.1), hx - r * (0.95 + i * 0.06), hy - r * (0.45 - i * 0.18));
    ctx.stroke();
  }
  // zigzag shine band across the crown
  ctx.strokeStyle = 'rgba(255,250,225,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.55, hy - r * 0.98);
  ctx.lineTo(hx + r * 0.25, hy - r * 1.22);
  ctx.lineTo(hx - r * 0.02, hy - r * 1.02);
  ctx.lineTo(hx - r * 0.38, hy - r * 1.24);
  ctx.lineTo(hx - r * 0.68, hy - r * 0.95);
  ctx.stroke();
  // loose angel strand
  ctx.strokeStyle = '#f0c75e'; ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.42, hy - r * 0.92);
  ctx.quadraticCurveTo(hx + r * 0.6, hy - r * 1.28, hx + r * 0.38, hy - r * 1.42);
  ctx.stroke();
  if (halo) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,225,120,0.9)';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(hx - r * 0.1, hy - r * 1.9, r * 0.72, r * 0.2, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/* ================= CHARACTERS ================= */

const CHARS = [
  {
    id: 'sheriffen', name: 'SHERIFFEN', epithet: 'THE LONG ARM OF THE LAW',
    perk: 'TANK — +35 HP', hp: 135, winMult: 1, scoreMult: 1,
    h: 1.02, headR: 21, wide: 1.16,
    skin: '#f4c79b', iris: ['#bfe8ff', '#5da9dd', '#1d4e7a'], eyeW: 0.44, eyeH: 0.4,
    rim: 'rgba(62,230,255,0.4)',
    theme: '#ffd34d'
  },
  {
    id: 'vilgot', name: 'VILGOT', epithet: 'SMOOTH OPERATOR',
    perk: 'FLOW — forgiving timing', hp: 100, winMult: 1.3, scoreMult: 1,
    h: 1.14, headR: 21, wide: 0.97, shades: true,
    skin: '#eebd92', iris: ['#cbb59a', '#8a6a48', '#3c2a18'], eyeW: 0.42, eyeH: 0.36,
    rim: 'rgba(255,79,216,0.4)',
    theme: '#3ee6ff'
  },
  {
    id: 'mille', name: 'MILLE', epithet: 'ANGEL FACE',
    perk: 'STARDUST — +15% score', hp: 100, winMult: 1, scoreMult: 1.15,
    h: 0.88, headR: 24, wide: 1.0, blush: true,
    skin: '#fad7b2', iris: ['#d2f7d9', '#62c98a', '#1f6b46'], eyeW: 0.52, eyeH: 0.5,
    rim: 'rgba(255,210,74,0.45)',
    theme: '#7dff5e'
  }
];

function fistShape(ctx, x, y, r, skin, big) {
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(x - r, y - r * 0.7);
    c.quadraticCurveTo(x - r * 1.1, y + r * 0.5, x - r * 0.3, y + r * 0.85);
    c.quadraticCurveTo(x + r * 0.7, y + r * 1.0, x + r * 1.05, y + r * 0.3);
    c.quadraticCurveTo(x + r * 1.15, y - r * 0.45, x + r * 0.45, y - r * 0.8);
    c.quadraticCurveTo(x - r * 0.3, y - r * 1.0, x - r, y - r * 0.7);
    c.closePath();
  }, skin, { lw: 2.8, shade: 0.14 });
  // knuckles
  ctx.strokeStyle = 'rgba(23,16,40,0.5)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.55, r * 0.3, -2.6, -0.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.62, r * 0.3, -2.6, -0.6); ctx.stroke();
}

/* drawFighter: origin at feet center, facing +x.
   pose: {kind:'idle'|'punch'|'hit'|'win', t:0..1, beat, aim} */
function drawFighter(ctx, idx, pose) {
  const ch = CHARS[idx];
  const k = pose.kind || 'idle';
  const t = clamp(pose.t || 0, 0, 1);
  const beat = pose.beat || 0;
  ctx.save();
  ctx.scale(ch.h, ch.h);

  let ext = 0, shift = 0;
  if (k === 'punch') {
    ext = t < 0.34 ? easeOut(t / 0.34) : 1 - (t - 0.34) / 0.66 * 0.75;
    shift = ext * 30;
  }
  if (k === 'hit') shift = -Math.sin(Math.min(t, 1) * Math.PI) * 28;
  const win = k === 'win';
  const bob = (k === 'idle' || win) ? -Math.abs(Math.sin(beat * Math.PI)) * 5 : 0;
  const sway = k === 'idle' ? Math.sin(beat * Math.PI / 2) * 2.5 : 0;

  const wf = ch.wide;
  const hipY = -126 + bob * 0.5, shY = -208 + bob;
  const hipX = shift * 0.45 + sway * 0.4;
  const shX = shift + sway;
  const hx = shX + 11 + (k === 'hit' ? -14 : 0);
  const hy = -246 + bob + (k === 'hit' ? 7 : 0);
  const r = ch.headR;
  const aim = pose.aim || 0;
  const orb = Math.sin(beat * TAU) * 2.5;

  // boxing guard: vertical forearms, fists up at chin height
  let fSh = [shX + 20 * wf, shY + 6];
  let bSh = [shX - 18 * wf, shY + 8];
  let fFist = [lerp(shX + 44, shX + 150, ext), lerp(shY - 4 + orb, shY + 14 + aim * 0.3, ext)];
  let fElb = [lerp(shX + 34, shX + 94, ext), lerp(shY + 40, shY + 22 + aim * 0.18, ext)];
  let bFist = [lerp(shX + 12, shX - 42, ext), lerp(shY + orb * 0.6, shY + 36, ext)];
  let bElb = [lerp(shX - 12, shX - 34, ext), lerp(shY + 42, shY + 26, ext)];
  if (k === 'hit') {
    fFist = [shX + 36, shY + 54]; fElb = [shX + 28, shY + 30];
    bFist = [shX - 38, shY + 48]; bElb = [shX - 30, shY + 26];
  }
  if (win) {
    if (ch.id === 'sheriffen') { fFist = [hx + 22, hy - r * 1.15]; fElb = [shX + 40, shY - 10]; }
    else if (ch.id === 'vilgot') { fFist = [shX + 48, shY - 70]; fElb = [shX + 34, shY - 22]; }
    else {
      fFist = [shX + 42, shY - 62]; fElb = [shX + 30, shY - 14];
      bFist = [shX - 40, shY - 60]; bElb = [shX - 28, shY - 12];
    }
  }

  const fFootX = 40 + shift * 0.75, bFootX = -36 + shift * 0.2;
  const fKnee = [(hipX + 10 + fFootX) / 2 + 9 + ext * 7, -64 + bob * 0.25];
  const bKneeBend = 8 * (1 - ext);
  const bKnee = [(hipX - 10 + bFootX) / 2 - bKneeBend * 0.4, -64 + bob * 0.25];

  const pants = ch.id === 'sheriffen' ? '#6b7158' : ch.id === 'vilgot' ? '#4f6e9a' : '#5b7ba6';
  const topCol = ch.id === 'sheriffen' ? '#39414e' : ch.id === 'vilgot' ? '#f5f2ea' : '#f8f4e9';
  const thighW = ch.id === 'mille' ? 12 : 13.5;
  const calfW = ch.id === 'mille' ? 9 : 10;

  // ---- hair behind everything
  if (ch.id === 'vilgot') vilgotHairBack(ctx, hx, hy, r);

  // ---- back arm
  drawArm(ctx, ch, bSh, bElb, bFist, topCol, false);

  // ---- back leg
  limbT(ctx, hipX - 10, hipY + 4, thighW + 7, bKnee[0], bKnee[1], calfW + 5, pants, { shade: 0.22 });
  limbT(ctx, bKnee[0], bKnee[1], calfW + 5, bFootX, -14, calfW + 3, pants, { shade: 0.22 });
  shoe(ctx, ch, bFootX, 0, -ext * 0.5);

  // ---- torso
  drawTorso(ctx, ch, hipX, hipY, shX, shY, topCol, wf, beat, k);

  // ---- front leg
  limbT(ctx, hipX + 10, hipY + 4, thighW + 7, fKnee[0], fKnee[1], calfW + 5, pants, { rim: ch.rim });
  limbT(ctx, fKnee[0], fKnee[1], calfW + 5, fFootX, -14, calfW + 3, pants, {});
  // cuff bunch
  cel(ctx, c => {
    c.beginPath();
    c.ellipse(fFootX, -15, calfW + 8, 7, 0, 0, TAU);
  }, pants, { lw: 2.2, shade: 0.18 });
  shoe(ctx, ch, fFootX, 0, 0);

  // ---- neck + head
  limbT(ctx, shX + 6, shY - 2, 7.5, hx - 2, hy + r * 0.85, 7, ch.skin, { lw: 2.4 });
  drawHead(ctx, hx, hy, r, ch, k);
  drawFace(ctx, hx, hy, r, ch, k);
  if (ch.id === 'sheriffen') hairSheriffen(ctx, hx, hy, r);
  else if (ch.id === 'vilgot') vilgotHairFront(ctx, hx, hy, r);
  else hairMille(ctx, hx, hy, r, win);

  // ---- front arm with ghost trail / speedlines
  if (k === 'punch' && ext > 0.45) {
    ctx.globalAlpha = 0.2;
    for (let g = 1; g <= 2; g++) {
      const gext = ext - g * 0.3;
      if (gext > 0) {
        const gf = [lerp(shX + 46, shX + 150, gext), lerp(shY + 26, shY + 14 + aim * 0.3, gext)];
        const ge = [lerp(shX + 30, shX + 94, gext), lerp(shY + 36, shY + 22 + aim * 0.18, gext)];
        limbT(ctx, fSh[0], fSh[1], 11, ge[0], ge[1], 9.5, ch.skin, { lw: 0.1, shade: 0 });
        limbT(ctx, ge[0], ge[1], 9.5, gf[0], gf[1], 8, ch.skin, { lw: 0.1, shade: 0 });
      }
    }
    ctx.globalAlpha = 1;
  }
  drawArm(ctx, ch, fSh, fElb, fFist, topCol, true);
  if (k === 'punch' && ext > 0.7) {
    // anime speedlines behind the fist
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.lineWidth = i === 0 ? 3 : 1.8;
      ctx.beginPath();
      ctx.moveTo(fFist[0] - 36, fFist[1] + i * 10);
      ctx.lineTo(fFist[0] - 120 - Math.abs(i) * 18, fFist[1] + i * 13);
      ctx.stroke();
    }
    if (ext > 0.85) {
      // impact star at the fist
      ctx.translate(fFist[0] + 10, fFist[1]);
      ctx.rotate(ext * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        const rad = i % 2 ? 6 : 18;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (ch.id === 'vilgot' && win) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx + 16, hy - 8); ctx.lineTo(hx + 28, hy - 20); ctx.stroke();
  }

  ctx.restore();
}

function drawArm(ctx, ch, sh, elb, fist, topCol, front) {
  const upperW = 11, lowerW = 9.5;
  if (ch.id === 'sheriffen') {
    // tee sleeve over the upper arm
    const mid = [lerp(sh[0], elb[0], 0.55), lerp(sh[1], elb[1], 0.55)];
    limbT(ctx, sh[0], sh[1], upperW + 4, mid[0], mid[1], upperW + 2, topCol, { shade: 0.2 });
    limbT(ctx, mid[0], mid[1], upperW - 1, elb[0], elb[1], lowerW, ch.skin, {});
    limbT(ctx, elb[0], elb[1], lowerW, fist[0], fist[1], lowerW - 1.5, ch.skin, { rim: front ? ch.rim : null });
  } else if (ch.id === 'mille') {
    // baggy linen sleeve to the elbow
    limbT(ctx, sh[0], sh[1], upperW + 6, elb[0], elb[1], upperW + 3, topCol, { shade: 0.14 });
    limbT(ctx, elb[0], elb[1], lowerW - 1, fist[0], fist[1], lowerW - 2, ch.skin, { rim: front ? ch.rim : null });
  } else {
    // bare arms — wider at the shoulder reads as muscle
    limbT(ctx, sh[0], sh[1] - 1, upperW + 2.5, elb[0], elb[1], lowerW - 0.5, ch.skin, { shade: 0.18 });
    limbT(ctx, elb[0], elb[1], lowerW - 0.5, fist[0], fist[1], lowerW - 2, ch.skin, { rim: front ? ch.rim : null });
  }
  fistShape(ctx, fist[0], fist[1], 10, ch.skin);
}

function drawTorso(ctx, ch, hipX, hipY, shX, shY, topCol, wf, beat, k) {
  if (ch.id === 'vilgot') {
    // skin shoulders/chest first
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(hipX - 17, hipY + 8);
      c.quadraticCurveTo(shX - 22 * wf - 4, hipY - 36, shX - 24 * wf, shY - 6);
      c.quadraticCurveTo(shX, shY - 16, shX + 24 * wf, shY - 6);
      c.quadraticCurveTo(shX + 22 * wf + 4, hipY - 36, hipX + 17, hipY + 8);
      c.closePath();
    }, ch.skin, { lw: 3 });
    // tight tank
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(hipX - 15, hipY + 10);
      c.quadraticCurveTo(shX - 19 * wf, hipY - 32, shX - 18 * wf, shY + 2);
      c.lineTo(shX - 9, shY - 8);
      c.quadraticCurveTo(shX, shY + 9, shX + 9, shY - 8);
      c.lineTo(shX + 18 * wf, shY + 2);
      c.quadraticCurveTo(shX + 19 * wf, hipY - 32, hipX + 15, hipY + 10);
      c.closePath();
    }, topCol, { lw: 2.8, rim: ch.rim, shade: 0.13 });
    // rib lines
    ctx.strokeStyle = 'rgba(120,110,140,0.4)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hipX - 8 + i * 8, shY + 24);
      ctx.lineTo(hipX - 9 + i * 8, hipY + 4);
      ctx.stroke();
    }
    // collarbone hint
    ctx.strokeStyle = 'rgba(120,80,60,0.5)'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(shX - 10, shY - 4);
    ctx.quadraticCurveTo(shX + 2, shY - 1, shX + 12, shY - 5);
    ctx.stroke();
  } else if (ch.id === 'mille') {
    // billowy linen shirt
    const puff = Math.sin(beat * Math.PI) * 2;
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(hipX - 30 - puff, hipY + 14);
      c.quadraticCurveTo(hipX - 22, hipY + 20, hipX - 8, hipY + 15);
      c.quadraticCurveTo(hipX + 4, hipY + 20, hipX + 16, hipY + 15);
      c.quadraticCurveTo(hipX + 26, hipY + 19, hipX + 31 + puff, hipY + 12);
      c.quadraticCurveTo(shX + 32, hipY - 42, shX + 25, shY - 4);
      c.quadraticCurveTo(shX, shY - 15, shX - 25, shY - 4);
      c.quadraticCurveTo(shX - 33, hipY - 42, hipX - 30 - puff, hipY + 14);
      c.closePath();
    }, topCol, { lw: 3, rim: ch.rim, shade: 0.12 });
    // open collar V
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(shX + 2, shY - 10);
      c.lineTo(shX + 14, shY + 17);
      c.lineTo(shX - 9, shY + 15);
      c.closePath();
    }, ch.skin, { lw: 2.2, shade: 0.1 });
    // fabric folds
    ctx.strokeStyle = 'rgba(120,110,90,0.4)'; ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hipX - 14 + i * 14, shY + 30);
      ctx.quadraticCurveTo(hipX - 12 + i * 14, hipY - 8, hipX - 16 + i * 15, hipY + 12);
      ctx.stroke();
    }
  } else {
    // sheriffen boxy tee on a stocky frame
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(hipX - 22, hipY + 10);
      c.quadraticCurveTo(shX - 26 * wf, hipY - 38, shX - 24 * wf, shY - 8);
      c.quadraticCurveTo(shX, shY - 20, shX + 24 * wf, shY - 8);
      c.quadraticCurveTo(shX + 26 * wf, hipY - 38, hipX + 22, hipY + 10);
      c.closePath();
    }, topCol, { lw: 3, rim: ch.rim, shade: 0.16 });
    // print
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 13px "Russo One", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MMA', shX + 4, shY + 36);
    ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(shX + 4, shY + 32, 13, 0, TAU); ctx.stroke();
    // wrinkles
    ctx.strokeStyle = 'rgba(15,12,28,0.4)'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(hipX - 16, hipY - 4);
    ctx.quadraticCurveTo(hipX, hipY + 2, hipX + 14, hipY - 6);
    ctx.stroke();
  }
  // belt hint
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(hipX - 14, hipY + 12);
  ctx.lineTo(hipX + 14, hipY + 12);
  ctx.stroke();
}

function shoe(ctx, ch, x, y, tilt) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  if (ch.id === 'vilgot') {
    cel(ctx, c => { c.beginPath(); c.ellipse(8, -2, 21, 6, 0, 0, TAU); }, '#2e2e30', { lw: 2.2, shade: 0.2 });
    cel(ctx, c => { c.beginPath(); c.ellipse(7, -7, 17, 6, 0, 0, TAU); }, ch.skin, { lw: 2, shade: 0.1 });
    ctx.strokeStyle = '#15161c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(18, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(6, -4); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(20 + i * 1.4, -8 + i * 1.5); ctx.lineTo(23 + i * 1.4, -8 + i * 1.5); ctx.stroke();
    }
  } else if (ch.id === 'mille') {
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(-12, 0);
      c.quadraticCurveTo(-13, -12, 0, -13);
      c.quadraticCurveTo(16, -13, 24, -6);
      c.quadraticCurveTo(27, -2, 24, 0);
      c.closePath();
    }, '#8a5a33', { lw: 2.4, shade: 0.2 });
    ctx.beginPath(); ctx.ellipse(6, 0, 19, 3.5, 0, 0, TAU);
    ctx.fillStyle = '#5e3c20'; ctx.fill();
    ctx.strokeStyle = '#5e3c20'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.quadraticCurveTo(4, -12, 16, -8); ctx.stroke();
  } else {
    cel(ctx, c => {
      c.beginPath();
      c.moveTo(-13, 0);
      c.lineTo(-13, -16);
      c.quadraticCurveTo(0, -18, 6, -12);
      c.quadraticCurveTo(20, -11, 24, -4);
      c.quadraticCurveTo(26, -1, 23, 0);
      c.closePath();
    }, '#1d1e26', { lw: 2.4, shade: 0.25 });
    ctx.strokeStyle = '#3a3c4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(20, -3); ctx.stroke();
  }
  ctx.restore();
}

/* ================= ENEMIES ================= */
/* origin at feet, facing LEFT toward the player.
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

  const fFoot = k === 'die' ? [-30, -10] : [-20 + sw * 16, 0];
  const bFoot = k === 'die' ? [26, -6] : [16 - sw * 16, 0];
  // back leg
  limbT(ctx, 6, hipY, 10, (6 + bFoot[0]) / 2 + 4, hipY * 0.5, 8.5, pant, { shade: 0.24, lw: 2.4 });
  limbT(ctx, (6 + bFoot[0]) / 2 + 4, hipY * 0.5, 8.5, bFoot[0], bFoot[1] - 8, 7, pant, { shade: 0.24, lw: 2.4 });
  enemyShoe(ctx, e, bFoot[0], bFoot[1]);
  // back arm
  const bArm = k === 'attack' ? [26, shY + 6] : k === 'die' ? [30, shY - 26] : [10 - sw * 12, shY + 30];
  limbT(ctx, 10, shY + 4, 7.5, 16, shY + 18, 6.5, e.v === 2 ? '#4a5263' : cloth, { lw: 2.4, shade: 0.2 });
  limbT(ctx, 16, shY + 18, 6.5, bArm[0], bArm[1], 5.5, e.v === 2 ? '#4a5263' : cloth, { lw: 2.4, shade: 0.2 });
  cel(ctx, c => { c.beginPath(); c.arc(bArm[0], bArm[1], 6.5, 0, TAU); }, skin, { lw: 2, shade: 0.1 });

  // torso
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(-16, hipY + 6);
    c.quadraticCurveTo(-24, shY + 20, -19, shY - 6);
    c.quadraticCurveTo(0, shY - 14, 19, shY - 6);
    c.quadraticCurveTo(24, shY + 20, 16, hipY + 6);
    c.closePath();
  }, cloth, { lw: 2.8, shade: 0.2 });
  if (e.v === 0) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-6, shY - 8); ctx.lineTo(2, shY + 16); ctx.lineTo(-12, shY + 14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  }
  if (e.v === 2) {
    ctx.beginPath(); ctx.arc(-2, shY + 22, 8, 0, TAU);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#262b38'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, shY + 36); ctx.lineTo(14, shY + 36); ctx.stroke();
  }

  // front leg
  limbT(ctx, -6, hipY, 10, (-6 + fFoot[0]) / 2 - 6, hipY * 0.5, 8.5, pant, { lw: 2.4 });
  limbT(ctx, (-6 + fFoot[0]) / 2 - 6, hipY * 0.5, 8.5, fFoot[0], fFoot[1] - 8, 7, pant, { lw: 2.4 });
  enemyShoe(ctx, e, fFoot[0], fFoot[1]);

  // head per variant
  if (e.v === 0) {
    enemyHeadBase(ctx, hy, skin, k);
    ctx.beginPath();
    ctx.moveTo(14, hy - 16);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(10 - i * 7, hy - 34 - Math.sin(i) * 4);
      ctx.lineTo(6 - i * 7, hy - 16 + i * 1.5);
    }
    ctx.closePath();
    outFill(ctx, col, 2.6);
  } else if (e.v === 1) {
    cel(ctx, c => { c.beginPath(); c.arc(0, hy, 21, 0, TAU); }, cloth, { lw: 2.8, shade: 0.2 });
    ctx.beginPath();
    ctx.arc(-3, hy + 1, 14, 0, TAU);
    ctx.fillStyle = '#0c0e14'; ctx.fill();
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
    rr(ctx, -15, hy - 4, 18, 6, 3); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    cel(ctx, c => { rr(c, -16, hy - 14, 30, 27, 5); }, '#4a5263', { lw: 2.8, shade: 0.2 });
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
    rr(ctx, -13, hy - 4, 16, 5, 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(8, hy - 14); ctx.lineTo(12, hy - 26); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, hy - 28, 3, 0, TAU);
    ctx.fillStyle = col; ctx.fill();
  }

  // front arm
  const aT = k === 'attack' ? clamp(pose.t || 0, 0, 1) : 0;
  const fArm = k === 'die' ? [-32, shY - 22]
    : k === 'attack' ? [lerp(-14, -52, easeOut(aT)), lerp(shY + 26, shY + 6, easeOut(aT))]
    : [-12 + sw * 12, shY + 28];
  limbT(ctx, -10, shY + 4, 7.5, -18, shY + 16, 6.5, e.v === 2 ? '#4a5263' : cloth, { lw: 2.4 });
  limbT(ctx, -18, shY + 16, 6.5, fArm[0], fArm[1], 5.5, e.v === 2 ? '#4a5263' : cloth, { lw: 2.4 });
  cel(ctx, c => { c.beginPath(); c.arc(fArm[0], fArm[1], k === 'attack' ? 8 : 6.5, 0, TAU); }, skin, { lw: 2, shade: 0.1 });

  ctx.restore();
}

function enemyHeadBase(ctx, hy, skin, k) {
  cel(ctx, c => {
    c.beginPath();
    c.moveTo(16, hy - 14);
    c.quadraticCurveTo(20, hy + 6, 10, hy + 15);
    c.quadraticCurveTo(-2, hy + 20, -12, hy + 12);
    c.quadraticCurveTo(-20, hy + 2, -16, hy - 12);
    c.quadraticCurveTo(-4, hy - 20, 16, hy - 14);
    c.closePath();
  }, skin, { lw: 2.6, shade: 0.16 });
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
    ctx.beginPath(); ctx.moveTo(-15, hy - 7); ctx.lineTo(-7, hy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, hy - 5); ctx.lineTo(3, hy - 7); ctx.stroke();
  }
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
  ctx.textBaseline = 'alphabetic';
}

/* ================= BACKGROUND ================= */

const FLOOR_Y = 370;
let wallCache = null, wallHue = -1;
let signCache = null, signHue = -1;

function makeWall(hue) {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, FLOOR_Y);
  grad.addColorStop(0, `hsl(${hue}, 28%, 5%)`);
  grad.addColorStop(1, `hsl(${hue}, 32%, 11%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, FLOOR_Y);
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3;
  for (let x = 80; x < 1280; x += 170) {
    g.beginPath(); g.moveTo(x, 30); g.lineTo(x, FLOOR_Y); g.stroke();
  }
  g.beginPath(); g.moveTo(0, 190); g.lineTo(1280, 190); g.stroke();
  g.strokeStyle = `hsl(${hue}, 15%, 16%)`; g.lineWidth = 12;
  g.beginPath(); g.moveTo(0, 34); g.lineTo(1280, 34); g.stroke();
  g.beginPath(); g.moveTo(0, 58); g.lineTo(1280, 58); g.stroke();
  g.fillStyle = `hsl(${hue}, 15%, 22%)`;
  for (let x = 100; x < 1280; x += 240) { g.fillRect(x, 24, 14, 44); }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const x0 = 150 + i * 300;
    g.beginPath();
    g.moveTo(x0, 64);
    g.quadraticCurveTo(x0 + 70, 64 + 60 + i * 12, x0 + 150, 64);
    g.stroke();
  }
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
  g.strokeStyle = 'rgba(255,210,74,0.4)'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(640, 120); g.lineTo(648, 100); g.lineTo(656, 114); g.lineTo(664, 96);
  g.lineTo(672, 114); g.lineTo(680, 100); g.lineTo(688, 120);
  g.closePath(); g.stroke();
  for (const sx of [30, 1130]) {
    for (let row = 0; row < 3; row++) {
      const y = FLOOR_Y - 100 - row * 88;
      g.fillStyle = '#0e0a18';
      g.fillRect(sx, y, 120, 84);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
      g.strokeRect(sx + 3, y + 3, 114, 78);
    }
  }
  const fg = g.createLinearGradient(0, FLOOR_Y, 0, 720);
  fg.addColorStop(0, `hsl(${hue}, 30%, 13%)`);
  fg.addColorStop(0.25, `hsl(${hue}, 25%, 7%)`);
  fg.addColorStop(1, '#05030a');
  g.fillStyle = fg;
  g.fillRect(0, FLOOR_Y, 1280, 720 - FLOOR_Y);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = FLOOR_Y + 30 + i * i * 16;
    g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke();
  }
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

function drawBG(ctx, o) {
  const { t, beat, energy, hue } = o;
  if (!wallCache || wallHue !== hue) { wallCache = makeWall(hue); wallHue = hue; }
  if (!signCache || signHue !== hue) { signCache = makeSign(hue); signHue = hue; }
  ctx.drawImage(wallCache, 0, 0);

  const bph = beat - Math.floor(beat);
  const pump = Math.max(0, 1 - bph * 3);

  ctx.fillStyle = 'rgba(6,4,12,0.95)';
  for (let i = 0; i < 16; i++) {
    const cx = 50 + i * 80 + Math.sin(i * 7.3) * 18;
    const bobY = Math.abs(Math.sin(beat * Math.PI + i * 1.3)) * 7 * (0.4 + energy);
    const cy = FLOOR_Y - 4 - bobY;
    ctx.beginPath(); ctx.arc(cx, cy - 46, 11, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.quadraticCurveTo(cx, cy - 44, cx + 16, cy);
    ctx.closePath(); ctx.fill();
    if (i % 3 === 0) {
      ctx.strokeStyle = 'rgba(6,4,12,0.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 36); ctx.lineTo(cx - 20, cy - 58 - bobY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 10, cy - 36); ctx.lineTo(cx + 22, cy - 56 - bobY); ctx.stroke();
    }
  }

  const flick = 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 7.7);
  ctx.globalAlpha = clamp(flick, 0.55, 1);
  ctx.drawImage(signCache, 330, 66);
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.translate(330, FLOOR_Y * 2 - 66 - 40);
  ctx.scale(1, -0.45);
  ctx.drawImage(signCache, 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;

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
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${0.5 + pump * 0.4})`;
    ctx.beginPath(); ctx.arc(em[0], em[1], 7, 0, TAU); ctx.fill();
  }
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
