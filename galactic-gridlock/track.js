/* Galactic Gridlock prototype: the modular track pieces, overpass, jump and start gantry */
(function buildTrack() {
  const { root, rnd } = W;

  /* ---------- printed tile faces: colour, bump and (for lava) glow ---------- */
  function tileArt(kind) {
    const w = 256, h = 308, K = W.mobile ? 1.5 : 2;          // drawn in 256x308 units, rendered at 2x
    const c = W.canvas(w * K, h * K), g = c.getContext('2d'), b = W.canvas(w * K, h * K), bg = b.getContext('2d');
    g.scale(K, K); bg.scale(K, K);
    bg.fillStyle = '#9a9a9a'; bg.fillRect(0, 0, w, h);
    const chev = (col, dir) => {
      for (const ctx of [g, bg]) {
        ctx.strokeStyle = ctx === g ? col : '#cfcfcf'; ctx.lineWidth = 18; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
        for (const y of [104, 196]) { ctx.beginPath(); ctx.moveTo(66, y + 32 * dir); ctx.lineTo(128, y - 32 * dir); ctx.lineTo(190, y + 32 * dir); ctx.stroke(); }
      }
    };
    if (kind === 'scrap') {
      g.fillStyle = '#4a3a2b'; g.fillRect(0, 0, w, h); W.noise(g, w, h, 1400, 30, 90, 0.5, 3);
      for (let i = 0; i < 70; i++) {
        const x = rnd(0, w), y = rnd(0, h), s = rnd(5, 20), r = rnd(0, 3);
        g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = ['#7a6248', '#2a2018', '#8a7a64', '#5a3a22', '#9a5a2a'][i % 5]; g.fillRect(-s / 2, -s / 3, s, s * 0.6); g.restore();
        bg.save(); bg.translate(x, y); bg.rotate(r); bg.fillStyle = '#e0e0e0'; bg.fillRect(-s / 2, -s / 3, s, s * 0.6); bg.restore();
      }
      for (let i = 0; i < 6; i++) { g.strokeStyle = '#a49276'; g.lineWidth = 4; bg.strokeStyle = '#fff'; bg.lineWidth = 4; const x0 = rnd(20, 236), y0 = rnd(20, 288), x1 = rnd(20, 236), y1 = rnd(20, 288); for (const ctx of [g, bg]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } }
    } else if (kind === 'lava' || kind === 'gap') {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#a01e06'); gr.addColorStop(0.5, '#ff6010'); gr.addColorStop(1, '#b8300a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {         // dark cooling crust plates
        const x = rnd(0, w), y = rnd(0, h), r = rnd(14, 38);
        g.fillStyle = 'rgba(40,8,2,.75)'; bg.fillStyle = '#dcdcdc';
        for (const ctx of [g, bg]) { ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, rr = r * rnd(0.6, 1); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } ctx.fill(); }
      }
      g.fillStyle = 'rgba(255,230,140,.85)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(2, 7), 0, 7); g.fill(); }
      if (kind === 'gap') { const r = g.createRadialGradient(128, 154, 10, 128, 154, 180); r.addColorStop(0, 'rgba(255,220,120,.6)'); r.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }
    } else if (kind === 'bridge') {
      g.fillStyle = '#4e5054'; g.fillRect(0, 0, w, h); W.noise(g, w, h, 900, 50, 120, 0.25, 2);
      for (let y = 6; y < h; y += 24) for (let x = (y / 24) % 2 * 16 + 4; x < w; x += 32) {
        for (const ctx of [g, bg]) { ctx.strokeStyle = ctx === g ? 'rgba(220,220,230,.28)' : '#e8e8e8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 14, y + 16); ctx.stroke(); }
      }
    } else if (kind === 'ramp') {
      g.fillStyle = '#e8b420'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414';
      for (let i = -8; i < 12; i++) { g.beginPath(); g.moveTo(i * 52, h); g.lineTo(i * 52 + 26, h); g.lineTo(i * 52 + 26 + h * 0.6, 0); g.lineTo(i * 52 + h * 0.6, 0); g.fill(); }
      W.noise(g, w, h, 1200, 60, 160, 0.25, 2);
      for (let y = 20; y < h; y += 36) { bg.fillStyle = '#e0e0e0'; bg.fillRect(0, y, w, 6); }
    } else {
      const v = kind === 'uphill' || kind === 'downhill' ? 56 : 46;
      g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(0, 0, w, h);
      W.noise(g, w, h, 5000, 20, 110, 0.45, 2); W.noise(bg, w, h, 5000, 90, 200, 0.5, 2);
      for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(0,0,0,.11)'; g.lineWidth = rnd(10, 24); g.beginPath(); const x = rnd(40, 216); g.moveTo(x, 0); g.lineTo(x + rnd(-30, 30), h); g.stroke(); }  // tyre marks
      g.strokeStyle = 'rgba(240,230,200,.55)'; g.lineWidth = 4; g.setLineDash([20, 18]); g.beginPath(); g.moveTo(4, 0); g.lineTo(4, h); g.moveTo(w - 4, 0); g.lineTo(w - 4, h); g.stroke(); g.setLineDash([]);
      if (kind === 'uphill') chev('#ffb23a', 1);
      if (kind === 'downhill') chev('#7fdc7f', -1);
    }
    // recessed seam around every tile
    bg.strokeStyle = '#202020'; bg.lineWidth = 10; bg.strokeRect(0, 0, w, h);
    g.strokeStyle = kind === 'lava' || kind === 'gap' ? 'rgba(255,220,150,.5)' : 'rgba(225,215,195,.55)'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    // photographic finish at native resolution: fine grit, chipped edges, oil stains
    g.setTransform(1, 0, 0, 1, 0, 0); bg.setTransform(1, 0, 0, 1, 0, 0);
    const hotT = kind === 'lava' || kind === 'gap', X = w * K, Y = h * K;
    W.noise(g, X, Y, hotT ? 5000 : 16000, 10, 170, 0.2, 1); W.noise(bg, X, Y, 14000, 60, 200, 0.45, 1);
    if (!hotT) {
      for (let i = 0; i < 4; i++) { const x = rnd(0, X), y = rnd(0, Y), r = rnd(14, 46) * K / 2, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(8,6,6,.34)'); gr.addColorStop(1, 'rgba(8,6,6,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 90; i++) { const e = i % 4, p = rnd(0, 1), d = rnd(0, 9) * K / 2, x = e === 0 ? p * X : e === 1 ? p * X : e === 2 ? d : X - d, y = e === 0 ? d : e === 1 ? Y - d : p * Y; g.fillStyle = `rgba(${rnd(170, 225) | 0},${rnd(160, 210) | 0},${rnd(140, 190) | 0},${rnd(0.25, 0.6)})`; g.fillRect(x, y, rnd(1, 4) * K / 2, rnd(1, 4) * K / 2); bg.fillStyle = 'rgba(230,230,230,.6)'; bg.fillRect(x, y, 2, 2); }
    }
    const tm = W.texOf(c), tb = W.texOf(b, false); tm.generateMipmaps = tb.generateMipmaps = true;
    return { map: tm, bump: tb };
  }
  const TILE_MATS = {};
  for (const k of ['asphalt', 'scrap', 'lava', 'uphill', 'downhill', 'bridge', 'ramp', 'gap']) {
    const a = tileArt(k), hot = k === 'lava' || k === 'gap';
    TILE_MATS[k] = new THREE.MeshStandardMaterial({ map: a.map, bumpMap: a.bump, bumpScale: k === 'scrap' ? 1.6 : 0.9, roughness: hot ? 0.32 : k === 'bridge' ? 0.5 : 0.82,
      metalness: k === 'bridge' ? 0.55 : 0, side: THREE.DoubleSide, emissiveMap: hot ? a.map : null, emissive: hot ? 0xffffff : 0x000000, emissiveIntensity: hot ? 1.0 : 0, envMapIntensity: 0.6 });
  }
  W.TILE_MATS = TILE_MATS;
  W.setTile = (m, kind) => { m.material = TILE_MATS[kind]; m.userData.kind = kind; };
  W.frameFns.push(() => { const f = 0.5 + 0.5 * Math.sin(W.time * 2.2); TILE_MATS.lava.emissiveIntensity = 0.85 + 0.45 * f; TILE_MATS.gap.emissiveIntensity = 1.2 + 0.5 * f; });

  /* ---------- geometry helpers ---------- */
  function quad(a, b, c, d, mat, uv = [0, 0, 1, 0, 0, 1, 1, 1]) {   // a,b start edge (left,right); c,d end edge
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0, 2, 1, 1, 2, 3]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
  }
  function walls(a, b, c, d, floorY, mat, cast = true) {   // four sides + bottom under a raised top quad
    const lo = p => [p[0], floorY, p[2]], g = new THREE.Group();
    for (const [p, q] of [[a, c], [d, b], [b, a], [c, d]]) g.add(quad(lo(p), p, lo(q), q, mat, [0, 0, 0, 1, 1, 0, 1, 1]));
    g.add(quad(lo(a), lo(b), lo(c), lo(d), mat));
    g.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = true; } });
    return g;
  }
  const inset = (pts, k) => { const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cz = pts.reduce((s, p) => s + p[2], 0) / 4; return pts.map(p => [p[0] + (cx - p[0]) * k, p[1], p[2] + (cz - p[2]) * k]); };
  function beam(p1, p2, r, mat) {
    const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(r, r, len), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b);
    m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  const rockC = W.canvas(512, 512), rg = rockC.getContext('2d'); rg.fillStyle = '#2e2620'; rg.fillRect(0, 0, 512, 512); W.noise(rg, 512, 512, 14000, 20, 100, 0.55, 2); W.noise(rg, 512, 512, 2500, 90, 160, 0.4, 3);
  for (let i = 0; i < 70; i++) { const x0 = rnd(0, 512), y0 = rnd(0, 512), x1 = x0 + rnd(-90, 90), y1 = y0 + rnd(-90, 90); rg.strokeStyle = 'rgba(0,0,0,.55)'; rg.lineWidth = 2.5; rg.beginPath(); rg.moveTo(x0, y0); rg.lineTo(x1, y1); rg.stroke(); rg.strokeStyle = 'rgba(150,120,90,.3)'; rg.lineWidth = 1; rg.beginPath(); rg.moveTo(x0 + 2, y0 + 2); rg.lineTo(x1 + 2, y1 + 2); rg.stroke(); }
  const rockT = W.texOf(rockC); rockT.wrapS = rockT.wrapT = THREE.RepeatWrapping;
  const earth = new THREE.MeshStandardMaterial({ map: rockT, bumpMap: rockT, bumpScale: 2, roughness: 0.95, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide, envMapIntensity: 1 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.7, metalness: 0.5 });
  const tileSide = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.7, side: THREE.DoubleSide });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xc23a1c, roughness: 0.4, metalness: 0.6 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.7 });

  /* ---------- the tiles, lane by lane ---------- */
  const TH = 0.04;                          // modular tile thickness
  for (let l = 0; l < LANES; l++) {
    const { b, n } = LT[l], o0 = (l - 1.5) * TRK.W, o1 = (l - 0.5) * TRK.W;
    for (let i = 0; i < n; i++) {
      const kind = tileKind(l, i), u0 = b[i], u1 = b[i + 1];
      const hot = kind === 'gap';
      const yA = hot ? 0.005 : elevAt(u0) + TH, yB = hot ? 0.005 : (featureAt((u0 + u1) / 2) === 'ramp' ? JUMP.lift : elevAt(u1)) + TH;
      const raw = [edgePoint(u0, o0, yA), edgePoint(u0, o1, yA), edgePoint(u1, o0, yB), edgePoint(u1, o1, yB)];
      const pts = inset(raw, 0.035);
      const m = quad(...pts, TILE_MATS[kind]);
      m.userData = { tile: true, s: i, lane: l, kind, uc: LT[l].c[i] }; root.add(m); W.tiles.push(m);
      const raisedK = elevAt(u0) > 0.02 || elevAt(u1) > 0.02 || featureAt((u0 + u1) / 2) === 'ramp';
      if (!hot) root.add(walls(...pts, raisedK ? (kind === 'bridge' ? Math.min(yA, yB) - 0.2 : 0) : 0, raisedK ? (kind === 'bridge' ? steel : earth) : tileSide, raisedK));
      // guard rails on the outside edges of raised sections
      if (raisedK && (l === 0 || l === 2)) {
        const off = l === 0 ? o0 - 0.07 : o1 + 0.07;
        const p = edgePoint(u0, off, yA + 0.2), q = edgePoint(u1, off, yB + 0.2);
        beam(p, q, 0.06, railMat); beam([p[0], p[1] - 0.1, p[2]], [q[0], q[1] - 0.1, q[2]], 0.035, railMat);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), postMat); post.position.set(p[0], yA + 0.07, p[2]); post.castShadow = true; root.add(post);
      }
    }
  }

  /* ---------- overpass: pillars and steel trusses, kept clear of the road underneath ---------- */
  const half = 1.5 * TRK.W;
  const lower = []; for (let u = 26; u <= 36; u += 0.25) { const q = pathPoint(u * TRK.P / N); lower.push([q.x, q.z]); }
  const clearOf = p => Math.min(...lower.map(([x, z]) => Math.hypot(x - p[0], z - p[2])));
  for (const off of [-half - 0.02, half + 0.02]) {
    let prev = null;
    for (let u = BRIDGE.up1 - 0.6; u <= BRIDGE.dn0 + 0.6; u += 0.4) {
      const top = edgePoint(u, off), y = top[1] + TH - 0.22, bot = Math.max(0.3, y - 0.42);
      if (top[1] < 0.6) { prev = null; continue; }
      const cur = { t: [top[0], y, top[2]], b: [top[0], bot, top[2]] };
      if (prev) { beam(prev.t, cur.t, 0.06, steel); beam(prev.b, cur.b, 0.06, steel); beam(prev.t, cur.b, 0.035, steel); beam(prev.b, cur.t, 0.035, steel); }
      beam(cur.t, cur.b, 0.045, steel);
      if (clearOf(top) > 2.0) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, bot, 12), steel); col.position.set(top[0], bot / 2, top[2]); col.castShadow = true; root.add(col);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12), rust); foot.position.set(top[0], 0.04, top[2]); foot.castShadow = foot.receiveShadow = true; root.add(foot);
      }
      prev = cur;
    }
  }

  /* ---------- jump: chasm rim rocks, bubbling lava, warning sign ---------- */
  {
    for (const off of [-half - 0.12, half + 0.12]) for (let u = JUMP.gap; u <= JUMP.land; u += 0.35) {
      const p = edgePoint(u, off, 0); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(0.12, 0.2), 0), earth);
      r.position.set(p[0], 0.08, p[2]); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); r.castShadow = true; root.add(r);
    }
    const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7020, emissiveIntensity: 2.2, roughness: 0.3 });
    const bubbles = [];
    for (let i = 0; i < 14; i++) {
      const p = edgePoint(rnd(JUMP.gap + 0.1, JUMP.land - 0.1), rnd(-half + 0.2, half - 0.2), 0);
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.04, 0.09), 10, 8), bubbleMat); m.position.set(p[0], 0.01, p[2]); root.add(m); bubbles.push({ m, ph: rnd(0, 6), sp: rnd(0.6, 1.4) });
    }
    W.frameFns.push(() => bubbles.forEach(b => { const k = (W.time * b.sp + b.ph) % 1; b.m.position.y = 0.01 + Math.sin(k * Math.PI) * 0.06; b.m.scale.setScalar(0.4 + k); }));
    const glow = new THREE.PointLight(0xff6a18, 3.8, 4, 2); const gp = edgePoint((JUMP.gap + JUMP.land) / 2, 0, 0.4); glow.position.set(...gp); root.add(glow);
    const sp = edgePoint(JUMP.ramp - 0.5, half + 0.5, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), postMat); pole.position.set(sp[0], 0.37, sp[2]); pole.castShadow = true; root.add(pole);
    const sc = W.canvas(128, 128), sg = sc.getContext('2d');
    sg.fillStyle = '#e8b420'; sg.beginPath(); sg.moveTo(64, 4); sg.lineTo(124, 64); sg.lineTo(64, 124); sg.lineTo(4, 64); sg.fill();
    sg.strokeStyle = '#151515'; sg.lineWidth = 5; sg.stroke();
    sg.fillStyle = '#151515'; sg.font = '900 30px Impact, sans-serif'; sg.textAlign = 'center'; sg.fillText('JUMP', 64, 75);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.02), new THREE.MeshStandardMaterial({ map: W.texOf(sc), roughness: 0.5, metalness: 0.3 }));
    sign.position.set(sp[0], 0.8, sp[2]); sign.rotation.set(0, Math.PI / 4, Math.PI / 4); sign.castShadow = true; root.add(sign);
  }

  /* ---------- start / finish: chequered line and a gantry ---------- */
  {
    const sc = W.canvas(96, 16), sg = sc.getContext('2d');
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { sg.fillStyle = (i + j) % 2 ? '#111' : '#eee'; sg.fillRect(i * 8, j * 8, 8, 8); }
    const t = W.texOf(sc); t.magFilter = THREE.NearestFilter;
    root.add(quad(edgePoint(0, -half, TH + 0.004), edgePoint(0, half, TH + 0.004), edgePoint(0.22, -half, TH + 0.004), edgePoint(0.22, half, TH + 0.004),
      new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.6 })));
    const L = edgePoint(0.11, -half - 0.25, 0), R = edgePoint(0.11, half + 0.25, 0), Hh = 1.25;
    for (const p of [L, R]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, Hh, 0.1), steel); leg.position.set(p[0], Hh / 2, p[2]); leg.castShadow = true; root.add(leg); }
    const bc = W.canvas(512, 64), bg = bc.getContext('2d');
    for (let i = 0; i < 64; i++) for (let j = 0; j < 8; j++) { bg.fillStyle = (i + j) % 2 ? '#111' : '#eee'; bg.fillRect(i * 8, j * 8, 8, 8); }
    bg.fillStyle = '#c4301a'; bg.fillRect(130, 6, 252, 52); bg.fillStyle = '#fff'; bg.font = '900 34px Impact, sans-serif'; bg.textAlign = 'center'; bg.fillText('START \u00b7 FINISH', 256, 45);
    const len = Math.hypot(R[0] - L[0], R[2] - L[2]);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(len, 0.28, 0.04), new THREE.MeshStandardMaterial({ map: W.texOf(bc), roughness: 0.6 }));
    banner.position.set((L[0] + R[0]) / 2, Hh - 0.05, (L[2] + R[2]) / 2); banner.rotation.y = -Math.atan2(R[2] - L[2], R[0] - L[0]); banner.castShadow = true; root.add(banner);
  }
})();
