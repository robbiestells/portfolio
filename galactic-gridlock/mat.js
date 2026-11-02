/* Galactic Gridlock prototype: player mat, physical cards, reveal cards over cars, HUD helpers */
const $ = id => document.getElementById(id);
const DISPLAY_FONT = '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
const BODY_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const ICONS = {
  cruise:  '<path d="M6 20h22M20 10l10 10-10 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  sprint:  '<path d="M4 10l10 10L4 30M18 10l10 10-10 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  boost:   '<path d="M20 3c3 7 10 11 10 20a10 10 0 0 1-20 0c0-4 2-6 4-9 1 3 2 4 3 4 0-4 0-9 3-15z" fill="#ffe27a" stroke="#fff" stroke-width="2"/>',
  swerveL: '<path d="M32 34V18q0-8-8-8H10m0 0l8-7m-8 7l8 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  swerveR: '<path d="M8 34V18q0-8 8-8h14m0 0l-8-7m8 7l-8 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  missile: '<path d="M20 3c5 5 6 14 5 22H15c-1-8 0-17 5-22zM15 25l-6 8 6-2zM25 25l6 8-6-2zM18 27h4l-2 9z" fill="#fff" stroke="#6a1a0a" stroke-width="2"/><circle cx="20" cy="14" r="3" fill="#d22d1a"/>',
  gatling: '<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M4 12h24M4 20h26M4 28h24"/></g><g fill="#ffe27a"><circle cx="34" cy="12" r="2"/><circle cx="36" cy="20" r="2"/><circle cx="34" cy="28" r="2"/></g>',
  mine:    '<circle cx="20" cy="20" r="9" fill="#2a2a2a" stroke="#fff" stroke-width="2.5"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M20 4v6M20 30v6M4 20h6M30 20h6M9 9l4 4M27 27l4 4M31 9l-4 4M9 31l4-4"/></g><circle cx="20" cy="20" r="3" fill="#ff3a24"/>',
  oil:     '<path d="M20 4C14 14 9 19 9 25a11 11 0 0 0 22 0c0-6-5-11-11-21z" fill="#14141c" stroke="#9a9ac0" stroke-width="2.5"/><path d="M15 25a5 5 0 0 0 4 5" stroke="#9a9ac0" stroke-width="2" fill="none"/>',
  ram:     '<path d="M4 20h18M16 10l12 10-12 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 8l6 4M30 32l6-4" stroke="#ffe27a" stroke-width="3.5" stroke-linecap="round"/>',
  shield:  '<path d="M20 3l14 5v10c0 9-6 15-14 19C12 33 6 27 6 18V8z" fill="#8fd0ff" stroke="#fff" stroke-width="2.5"/><path d="M20 10v21" stroke="#fff" stroke-width="2.5" opacity=".7"/>'
};

/* ---------- card textures (canvas, repainted once fonts and icons load) ---------- */
const CARD_W = 1.55, CARD_H = 2.3;
const TEX = {}, ICON_IMG = {};
function wrapText(g, text, x, y, maxW, lh) {
  let line = '', yy = y;
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  if (line) g.fillText(line, x, yy);
}
function paintCard(id) {
  const { canvas: c, tex } = TEX[id], g = c.getContext('2d'), d = CARDS[id];
  g.fillStyle = '#0e0804'; g.fillRect(0, 0, 256, 380);
  g.fillStyle = '#ecdfc4'; g.fillRect(7, 7, 242, 366);
  g.fillStyle = d.c1; g.fillRect(7, 7, 242, 54);
  g.fillStyle = '#fff'; g.font = `900 38px ${DISPLAY_FONT}`; g.textBaseline = 'middle';
  g.fillText(d.name.toUpperCase(), 18, 37);
  const gr = g.createRadialGradient(128, 130, 8, 128, 160, 160); gr.addColorStop(0, d.c2); gr.addColorStop(1, d.c1);
  g.fillStyle = gr; g.fillRect(7, 61, 242, 205);
  if (ICON_IMG[id] && ICON_IMG[id].complete && ICON_IMG[id].naturalWidth) g.drawImage(ICON_IMG[id], 78, 80, 130, 130);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(7, 200, 112, 66);
  g.fillStyle = '#fff'; g.font = `900 66px ${DISPLAY_FONT}`; g.fillText(d.move, 18, 236);
  g.font = `800 20px ${DISPLAY_FONT}`; g.fillText('MOVE', 58, 250);
  g.fillStyle = '#1a0e05'; g.font = `600 28px ${BODY_FONT}`; g.textBaseline = 'top';
  wrapText(g, d.text, 18, 278, 222, 29);
  tex.needsUpdate = true;
}
function cardTex(id) {
  if (!TEX[id]) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 380;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    TEX[id] = { canvas: c, tex };
    const img = new Image();
    img.onload = () => paintCard(id);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="160" height="160">${ICONS[id]}</svg>`);
    ICON_IMG[id] = img; paintCard(id);
  }
  return TEX[id].tex;
}
const BACK_TEX = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 380; const g = c.getContext('2d');
  g.fillStyle = '#0e0804'; g.fillRect(0, 0, 256, 380);
  g.fillStyle = '#3a2616'; g.fillRect(7, 7, 242, 366);
  g.strokeStyle = '#4e3420'; g.lineWidth = 9;
  for (let i = -400; i < 400; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 380, 380); g.stroke(); }
  g.strokeStyle = '#ff8a1f'; g.lineWidth = 5; g.strokeRect(20, 20, 216, 340);
  g.fillStyle = '#1a0e05'; g.beginPath(); g.arc(128, 190, 62, 0, 7); g.fill();
  g.strokeStyle = '#ff8a1f'; g.lineWidth = 6; g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { c, g };
  return t;
})();
function paintBackLogo() {
  const { g } = BACK_TEX.userData;
  g.fillStyle = '#ff8a1f'; g.font = `900 64px ${DISPLAY_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GG', 128, 194); g.textAlign = 'left'; BACK_TEX.needsUpdate = true;
}
paintBackLogo();

const CARD_GEO = new THREE.BoxGeometry(CARD_W, 0.025, CARD_H);
const EDGE_MAT = new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.8 });
const BACK_MAT = new THREE.MeshStandardMaterial({ map: BACK_TEX, roughness: 0.7 });
function cardMesh(id) {
  const face = new THREE.MeshStandardMaterial({ map: cardTex(id), color: 0xd0cac0, roughness: 0.6, envMapIntensity: 0.35, emissive: 0x000000 });
  const m = new THREE.Mesh(CARD_GEO, [EDGE_MAT, EDGE_MAT, face, BACK_MAT, EDGE_MAT, EDGE_MAT]);
  m.castShadow = true; m.userData.id = id; m.userData.face = face;
  return m;
}

/* ---------- the mat ---------- */
const ML = {
  slotsX: [-4.45, -2.7, -0.95, 0.8, 2.55], bayX: 4.5, handZ: 1.3, tilt: 0.35,
  speedX: i => -0.25 + i * 0.97, speedZ: -1.9,
  hullX: i => -4.3 + i * 0.66, hullZ: -0.85
};
const Mat = { group: null, hand: [], bay: null, sel: -1, selectable: false, onTap: null, canvas: null, tex: null, car: null, speedPeg: null, hullPegs: [] };
const PXM = 100, mx = x => (x + MAT.w / 2) * PXM, mz = z => (z + MAT.d / 2) * PXM;

function paintMat() {
  const car = Mat.car, g = Mat.canvas.getContext('2d'), W2 = MAT.w * PXM, H2 = MAT.d * PXM;
  const wood = g.createLinearGradient(0, 0, 0, H2); wood.addColorStop(0, '#7a4d2b'); wood.addColorStop(1, '#5a3720');
  g.fillStyle = wood; g.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(30,14,4,${0.06 + ((i * 37) % 10) / 70})`; g.lineWidth = 1 + (i % 3);
    const y = (i * 53) % H2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W2 * 0.3, y + 4, W2 * 0.7, y - 4, W2, y + 2); g.stroke();
  }
  // brushed metal plate
  const px0 = mx(-5.4), pz0 = mz(-2.5), pw = 10.8 * PXM, ph = 2.1 * PXM;
  const metal = g.createLinearGradient(0, pz0, 0, pz0 + ph); metal.addColorStop(0, '#5a5757'); metal.addColorStop(1, '#3a3838');
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(px0 + 4, pz0 + 6, pw, ph);
  g.fillStyle = metal; g.fillRect(px0, pz0, pw, ph);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.008})`; g.beginPath(); const y = pz0 + (i * 7) % ph; g.moveTo(px0, y); g.lineTo(px0 + pw, y); g.stroke(); }
  g.fillStyle = '#8a8580'; for (const [x, z] of [[-5.28, -2.38], [5.28, -2.38], [-5.28, -0.52], [5.28, -0.52]]) { g.beginPath(); g.arc(mx(x), mz(z), 6, 0, 7); g.fill(); }
  // name plaque
  g.fillStyle = '#231a14'; g.fillRect(mx(-5.1), mz(-2.35), 4.2 * PXM, 1.15 * PXM);
  g.strokeStyle = '#ff8a1f'; g.lineWidth = 3; g.strokeRect(mx(-5.1), mz(-2.35), 4.2 * PXM, 1.15 * PXM);
  g.fillStyle = '#ff8a1f'; g.font = `900 46px ${DISPLAY_FONT}`; g.textBaseline = 'top';
  g.fillText(car.name.toUpperCase(), mx(-4.95), mz(-2.3));
  g.fillStyle = '#ecdfc4'; g.font = `700 25px ${BODY_FONT}`;
  g.fillText(`${GEAR[car.gear].label} \u00b7 ${GEAR[car.gear].note}`, mx(-4.95), mz(-1.78));
  g.fillStyle = '#b9a888'; g.font = `600 21px ${BODY_FONT}`;
  g.fillText(`Armor ${car.armor} \u00b7 Mass ${car.mass}`, mx(-4.95), mz(-1.5));
  // engraved labels
  const engrave = (txt, x, z, size = 22) => { g.font = `800 ${size}px ${DISPLAY_FONT}`; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(txt, x + 1, z + 2); g.fillStyle = '#d9d0bf'; g.fillText(txt, x, z); };
  engrave('BASE SPEED', mx(-0.55), mz(-2.32));
  for (let i = 0; i <= 5; i++) {
    const x = mx(ML.speedX(i)), z = mz(ML.speedZ);
    g.fillStyle = '#141414'; g.beginPath(); g.arc(x, z, 14, 0, 7); g.fill();
    g.strokeStyle = '#767270'; g.lineWidth = 2; g.stroke();
    engrave(String(i), x - 6, z + 30, 22);
  }
  engrave('HULL', mx(-5.25), mz(ML.hullZ), 24);
  for (let i = 0; i < car.hpMax; i++) {
    const x = mx(ML.hullX(i)), z = mz(ML.hullZ);
    g.fillStyle = '#141414'; g.beginPath(); g.arc(x, z, 12, 0, 7); g.fill(); g.strokeStyle = '#767270'; g.lineWidth = 2; g.stroke();
  }
  // card slots and play bay
  const sd = CARD_H * Math.cos(ML.tilt);
  for (const x of ML.slotsX) {
    g.fillStyle = 'rgba(20,10,4,.35)'; g.fillRect(mx(x - CARD_W / 2 - 0.05), mz(ML.handZ - sd / 2 - 0.05), (CARD_W + 0.1) * PXM, (sd + 0.1) * PXM);
  }
  g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(mx(ML.bayX - 0.82), mz(ML.handZ - 1.2), 1.64 * PXM, 2.4 * PXM);
  g.setLineDash([12, 8]); g.strokeStyle = '#ff8a1f'; g.lineWidth = 4;
  g.strokeRect(mx(ML.bayX - 0.82), mz(ML.handZ - 1.2), 1.64 * PXM, 2.4 * PXM); g.setLineDash([]);
  g.save(); g.translate(mx(ML.bayX), mz(ML.handZ)); g.fillStyle = '#ff8a1f'; g.font = `900 52px ${DISPLAY_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PLAY', 0, 0); g.restore();
  Mat.tex.needsUpdate = true;
}

function buildMat(car) {
  Mat.car = car;
  const grp = new THREE.Group();
  Mat.canvas = document.createElement('canvas'); Mat.canvas.width = MAT.w * PXM; Mat.canvas.height = MAT.d * PXM;
  Mat.tex = new THREE.CanvasTexture(Mat.canvas); Mat.tex.colorSpace = THREE.SRGBColorSpace; Mat.tex.anisotropy = 8;
  const side = new THREE.MeshStandardMaterial({ color: 0x3a2314, roughness: 0.8 });
  const top = new THREE.MeshStandardMaterial({ map: Mat.tex, bumpMap: Mat.tex, bumpScale: 0.004, color: 0xd8d2c8, roughness: 0.65, envMapIntensity: 0.5 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(MAT.w, 0.12, MAT.d), [side, side, top, side, side, side]);
  slab.position.y = -0.06; slab.receiveShadow = true; slab.castShadow = true; grp.add(slab);
  // rack lip that holds the hand upright
  const lipZ = ML.handZ + CARD_H / 2 * Math.cos(ML.tilt) + 0.07;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.14, 0.12), new THREE.MeshStandardMaterial({ color: 0x2e1a0e, roughness: 0.7 }));
  lip.position.set(-0.95, 0.07, lipZ); lip.castShadow = true; grp.add(lip);
  // pegs
  const pegMat = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.6 });
  Mat.speedPeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 14), pegMat);
  Mat.speedPeg.castShadow = true; grp.add(Mat.speedPeg);
  const red = new THREE.MeshStandardMaterial({ color: 0xc0302a, roughness: 0.5 });
  const pegG = new THREE.CylinderGeometry(0.08, 0.095, 0.3, 12);
  for (let i = 0; i < car.hpMax; i++) {
    const p = new THREE.Mesh(pegG, red); p.position.set(ML.hullX(i), 0.15, ML.hullZ); p.castShadow = true; grp.add(p); Mat.hullPegs.push(p);
  }
  W.scene.add(grp); W.mat = grp; Mat.group = grp;
  if (W.buildTableProps) W.buildTableProps(grp);
  paintMat();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paintMat(); paintBackLogo(); Object.keys(TEX).forEach(paintCard); });
  W.layout();
}
function setStats(car) {
  const x = ML.speedX(car.bs), p = Mat.speedPeg.position;
  if (Math.abs(p.x - x) > 0.01 || !p.y) p.set(x, 0.21, ML.speedZ);
  Mat.hullPegs.forEach((peg, i) => {
    const on = i < car.hp;
    if (on !== peg.visible) {
      if (!on) { const q = peg; anim(380, t => { q.position.y = 0.15 + Math.sin(t * Math.PI) * 0.5; q.rotation.z = t * 2; q.scale.setScalar(1 - t); }).then(() => { q.visible = false; q.scale.setScalar(1); q.rotation.z = 0; q.position.y = 0.15; }); }
      else peg.visible = true;
    }
  });
}

/* ---------- hand cards ---------- */
function slotPose(i, n = Mat.hand.length) {
  const x = ML.slotsX[i] !== undefined ? ML.slotsX[i] : ML.slotsX[4];
  return { x, y: CARD_H / 2 * Math.sin(ML.tilt) + 0.03, z: ML.handZ, rx: ML.tilt, rz: 0 };
}
function tweenCard(m, to, ms, arc = 0) {
  const f = { x: m.position.x, y: m.position.y, z: m.position.z, rx: m.rotation.x, rz: m.rotation.z, s: m.scale.x }, ts = to.s || 1;
  const id = (m.userData.tw = (m.userData.tw || 0) + 1);
  return anim(ms, t => {
    if (m.userData.tw !== id) return;               // a newer tween took over this card
    const e = ease(t);
    m.position.set(f.x + (to.x - f.x) * e, f.y + (to.y - f.y) * e + Math.sin(t * Math.PI) * arc, f.z + (to.z - f.z) * e);
    m.rotation.x = f.rx + (to.rx - f.rx) * e; m.rotation.z = f.rz + (to.rz - f.rz) * e; m.scale.setScalar(f.s + (ts - f.s) * e);
  });
}
function setPose(m, p) { m.position.set(p.x, p.y, p.z); m.rotation.set(p.rx, 0, p.rz); m.scale.setScalar(p.s || 1); }
/* hovering (or, on touch screens, selecting) a card stands it up and enlarges it so it can be read */
Mat.hov = -1; Mat.touch = false; Mat.busy = false;
function restPose(k) {
  const p = slotPose(k);
  if (k === Mat.hov || (Mat.touch && k === Mat.sel)) return { x: Math.max(-3.9, Math.min(3.9, p.x)), y: p.y + 1.3, z: p.z - 0.55, rx: 0.72, rz: 0, s: 1.9 };
  if (k === Mat.sel) return { x: p.x, y: p.y + 0.42, z: p.z - 0.18, rx: p.rx + 0.12, rz: 0 };
  return p;
}
Mat.layout = (ms = 170) => Mat.hand.forEach((m, k) => { m.userData.face.emissive.setHex(k === Mat.sel ? 0x3a2000 : 0); tweenCard(m, restPose(k), ms); });
Mat.setHover = i => { if (i === Mat.hov) return; Mat.hov = i; if (!Mat.busy) Mat.layout(); };
Mat.deal = async function (ids, newFrom = 0) {
  for (const m of Mat.hand) Mat.group.remove(m);
  Mat.hand = ids.map(id => cardMesh(id)); Mat.sel = -1; Mat.hov = -1; Mat.busy = true;
  const jobs = [];
  Mat.hand.forEach((m, i) => {
    Mat.group.add(m);
    const p = slotPose(i);
    if (i < newFrom) { setPose(m, p); return; }
    setPose(m, { x: 7.5, y: 0.6, z: ML.handZ - 0.6, rx: 0, rz: Math.PI });
    jobs.push(sleep((i - newFrom) * 110).then(() => tweenCard(m, p, 420, 0.9)));
  });
  await Promise.all(jobs); Mat.busy = false;
};
Mat.select = function (i) { Mat.sel = i; Mat.layout(); };
Mat.playToBay = async function (i) {
  const m = Mat.hand.splice(i, 1)[0]; Mat.sel = -1; Mat.hov = -1; Mat.bay = m; Mat.busy = true;
  m.userData.face.emissive.setHex(0);
  const slide = Mat.hand.map((h, k) => tweenCard(h, slotPose(k), 260));
  await Promise.all([tweenCard(m, { x: ML.bayX, y: 0.03, z: ML.handZ, rx: 0, rz: Math.PI, s: 1 }, 480, 1.1), ...slide]);
  Mat.busy = false;
};
Mat.flipBay = function (ms) {
  if (!Mat.bay) return Promise.resolve();
  return tweenCard(Mat.bay, { x: ML.bayX, y: 0.03, z: ML.handZ, rx: 0, rz: 0 }, ms, 0.7);
};
Mat.clearBay = async function () {
  const m = Mat.bay; if (!m) return; Mat.bay = null;
  await tweenCard(m, { x: 7.8, y: 0.03, z: ML.handZ + 0.4, rx: 0, rz: 0.4 }, 380, 0.4);
  Mat.group.remove(m);
};
Mat.reset = function () {
  for (const m of Mat.hand) Mat.group.remove(m); Mat.hand = [];
  if (Mat.bay) Mat.group.remove(Mat.bay); Mat.bay = null; Mat.sel = -1; Mat.selectable = false;
};

/* tap a card on the mat; hover or tap the board for info */
(function picking() {
  const ray = new THREE.Raycaster(), v = new THREE.Vector2(), el = W.renderer.domElement;
  const aim = e => { const r = el.getBoundingClientRect(); v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v, W.camera); return r; };
  const handHit = () => { const h = ray.intersectObjects(Mat.hand, false)[0]; return h ? Mat.hand.indexOf(h.object) : -1; };
  const boardHit = () => {
    const things = [...W.tiles, ...(W.tokens || []), ...(W.cars || []).map(c => c.view && c.view.group).filter(Boolean)];
    return ray.intersectObjects(things, true)[0];
  };
  el.addEventListener('pointerdown', e => {
    const r = aim(e); Mat.touch = e.pointerType !== 'mouse';
    if (Mat.selectable) { const i = handHit(); if (i >= 0 && Mat.onTap) { showTip(null); return Mat.onTap(i); } }
    const h = boardHit(); showTip(h ? tipFor(h) : null, e.clientX - r.left, e.clientY - r.top); Tip.pinned = !!h && e.pointerType !== 'mouse';
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = aim(e), hi = handHit(), overCard = hi >= 0;
    Mat.setHover(hi);
    el.style.cursor = overCard && Mat.selectable ? 'pointer' : 'default';
    if (overCard) return showTip(null);
    const h = boardHit(); showTip(h ? tipFor(h) : null, e.clientX - r.left, e.clientY - r.top);
  });
  el.addEventListener('pointerleave', () => { Mat.setHover(-1); if (!Tip.pinned) showTip(null); });
})();

/* ---------- picks panel: who played what ---------- */
const ORD = ['', '1st', '2nd', '3rd', '4th'];
const byRank = (a, b) => ((a.place || 99) - (b.place || 99)) || (progress(b) - progress(a));
function renderPicks(cars, mode) {
  // mode: 'pick' (face down once chosen), 'reveal' (show cards)
  const el = $('picks'); el.innerHTML = '';
  for (const c of cars) {
    const d = document.createElement('div'), card = c.card && CARDS[c.card];
    d.className = 'pk' + (c.human ? ' me' : '') + (c.down ? ' out' : '');
    d.style.setProperty('--car', '#' + c.color.toString(16).padStart(6, '0'));
    let slot;
    if (c.done) slot = `<em class="none">${ORD[c.place] || ''} place</em>`;
    else if (c.down) slot = '<em class="none">Rebuilding</em>';
    else if (!card) slot = `<em class="wait">${c.human ? 'Your pick' : 'Choosing'}</em>`;
    else if (mode === 'reveal') slot = `<em class="cd" style="--c1:${card.c1};--c2:${card.c2}"><b>${card.move}</b>${card.name}</em>`;
    else slot = '<em class="back">Locked</em>';
    d.innerHTML = `<span>${c.human ? 'You' : c.name.split(' ').pop()}<i>$${c.cash || 0}</i></span>${slot}`;
    el.appendChild(d);
  }
}

/* ---------- hover / tap popups for tiles, hazards and cars ---------- */
const Tip = { el: null, pinned: false };
function tipFor(hit) {
  let o = hit.object;
  while (o && !o.userData.tile && !o.userData.type && !o.userData.carId && o.parent) o = o.parent;
  if (!o) return null;
  if (o.userData.type) { const k = o.userData.type, t = TILE_INFO[k]; return { title: t.name + (o.userData.amount ? ` ($${o.userData.amount})` : ''), lines: t.text, tag: k === 'mine' || k === 'oil' ? 'Hazard' : 'Pickup' }; }
  if (o.userData.carId !== undefined) {
    const c = (W.cars || []).find(k => k.id === o.userData.carId); if (!c) return null;
    return { title: c.human ? 'Ember (you)' : c.name, tag: GEAR[c.gear].label,
      lines: [`${['', 'Stock chassis', 'Upgraded chassis', 'Juggernaut'][c.tier || 1]} (tier ${c.tier || 1})`, `Hull ${c.hp}/${c.hpMax} \u00b7 Armor ${c.armor} \u00b7 Base Speed ${c.bs}`, GEAR[c.gear].note, `Cash $${c.cash || 0}`, c.down ? 'Wrecked. Back in the race after one turn.' : ''].filter(Boolean) };
  }
  const { s, lane, kind } = o.userData, info = TILE_INFO[kind];
  return { title: info.name, tag: `Tile ${s + 1} \u00b7 Lane ${lane + 1}`, lines: info.text };
}
function showTip(t, x, y) {
  const el = Tip.el || (Tip.el = $('tip'));
  if (!t) { el.hidden = true; return; }
  el.innerHTML = `<small>${t.tag}</small><b>${t.title}</b>${t.lines.map(l => `<p>${l}</p>`).join('')}`;
  el.hidden = false;
  const r = $('stage').getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.max(8, Math.min(r.width - w - 8, x + 14)) + 'px';
  el.style.top = Math.max(8, Math.min(r.height - h - 8, y - h - 12)) + 'px';
}

/* ---------- HUD ---------- */
function buildPhases() { $('phases').innerHTML = PHASES.map((p, i) => `<div class="ph" id="ph${i}">${i + 1} ${p}</div>`).join(''); }
function setPhaseUI(i) { PHASES.forEach((_, k) => { $('ph' + k).className = 'ph' + (k === i ? ' on' : k < i ? ' done' : ''); }); }
function renderRace(cars, turn) {
  const meCar = cars.find(c => c.human), lap = Math.min(LAPS, Math.floor(Math.max(0, progress(meCar)) / N) + 1);
  $('rnd').innerHTML = `Lap ${lap}/${LAPS}<small>T${Math.max(1, turn)}</small>`;
  const bar = $('bar'); bar.innerHTML = '';
  for (const c of cars) {
    const i = document.createElement('i'); i.style.left = Math.max(0, Math.min(1, (progress(c) + 2) / (LAPS * N + 2))) * 100 + '%';
    i.style.background = '#' + c.color.toString(16).padStart(6, '0'); i.title = c.name;
    if (c.human) i.className = 'me'; if (c.down) i.style.opacity = 0.35;
    bar.appendChild(i);
  }
  const order = [...cars].sort(byRank), me = meCar;
  $('pos').innerHTML = `Pos <b>${order.indexOf(me) + 1}</b>/${cars.length}`;
}
function say(text) { $('toast').textContent = text; }
function hint(html) { $('hint').innerHTML = html; }
function logLine(text, head) {
  const p = document.createElement('p'); if (head) p.className = 'h'; p.textContent = text;
  const l = $('log'); l.appendChild(p); l.scrollTop = l.scrollHeight;
}
function makeLabel(car) {
  const d = document.createElement('div'); d.className = 'label' + (car.human ? ' me' : '');
  d.innerHTML = `<span>${car.human ? 'You' : car.name.split(' ').pop()}</span><div class="pips"></div>`;
  car.view.group.userData.carId = car.id;
  $('stage').appendChild(d); car.label = d;
}
function updateLabel(car) {
  const l = car.label; if (!l) return;
  l.style.display = car.done ? 'none' : '';
  l.classList.toggle('dead', !!car.down);
  const pips = l.querySelector('.pips'); pips.innerHTML = '';
  const low = !car.down && car.hp <= Math.max(3, Math.ceil(car.hpMax * 0.35));
  pips.hidden = !low; l.querySelector('span').textContent = car.down ? 'Rebuilding' : (car.human ? 'You' : car.name.split(' ').pop());
  if (low) for (let i = 0; i < car.hpMax; i++) { const s = document.createElement('s'); if (i < car.hp) s.className = car.hp <= 3 ? 'low' : 'on'; pips.appendChild(s); }
}
W.frameFns.push(() => {
  for (const c of (W.cars || [])) {
    if (!c.label || !c.view) continue;
    const p = c.view.group.position, s = W.project(p.x, p.y + 0.45, p.z);
    c.label.style.left = s.x + 'px'; c.label.style.top = s.y + 'px';
  }
});
