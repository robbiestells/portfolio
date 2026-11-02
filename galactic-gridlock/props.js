/* Galactic Gridlock prototype: scenery on the board and on the table */
(function buildProps() {
  const { root, rnd } = W;
  W.lava = [];
  const centre = []; for (let i = 0; i < 300; i++) { const q = pathPoint(i / 300 * TRK.P); centre.push([q.x, q.z]); }
  const trackDist = (x, z) => Math.min(...centre.map(([a, b]) => Math.hypot(a - x, b - z)));
  W.trackDist = trackDist;
  // cheap smooth 3D value noise for displacing rock
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
    let r = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
      r += hash(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
    return r;
  };
  const fbm = (x, y, z) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.1;
  function displace(geo, amt, freq, seed) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * freq + seed, v.y * freq, v.z * freq - seed); v.multiplyScalar(1 + (n - 0.5) * amt); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return geo;
  }
  const rockC = W.canvas(512, 512), rg = rockC.getContext('2d'); rg.fillStyle = '#5a5048'; rg.fillRect(0, 0, 512, 512); W.noise(rg, 512, 512, 22000, 30, 150, 0.5, 2); W.noise(rg, 512, 512, 3000, 120, 210, 0.35, 3);
  for (let i = 0; i < 60; i++) { const x0 = rnd(0, 512), y0 = rnd(0, 512), x1 = x0 + rnd(-80, 80), y1 = y0 + rnd(-80, 80); rg.strokeStyle = 'rgba(10,6,4,.5)'; rg.lineWidth = 2.5; rg.beginPath(); rg.moveTo(x0, y0); rg.lineTo(x1, y1); rg.stroke(); rg.strokeStyle = 'rgba(190,160,130,.28)'; rg.lineWidth = 1; rg.beginPath(); rg.moveTo(x0 + 2, y0 + 2); rg.lineTo(x1 + 2, y1 + 2); rg.stroke(); }
  const rockT = W.texOf(rockC); rockT.wrapS = rockT.wrapT = THREE.RepeatWrapping;
  const rockMats = [0x3a322c, 0x2c2622, 0x4a4038].map(c => new THREE.MeshStandardMaterial({ color: c, map: rockT, bumpMap: rockT, bumpScale: 2.2, roughness: 0.92 }));
  function rock(x, z, s, parent = root) {
    const geo = displace(new THREE.IcosahedronGeometry(1, 2), 0.7, 1.6, rnd(0, 50));
    const m = new THREE.Mesh(geo, rockMats[Math.floor(Math.random() * 3)]);
    m.scale.set(s * rnd(0.8, 1.3), s * rnd(0.5, 0.9), s * rnd(0.8, 1.3));
    m.position.set(x, s * 0.25, z); m.rotation.set(rnd(-0.3, 0.3), rnd(0, 6), rnd(-0.3, 0.3));
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  W.rock = rock;

  /* ---------- volcanoes ---------- */
  function volcano(x, z, s) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.3 * s, 1.0 * s, 1.2 * s, 48, 14, true);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (fbm(v.x * 3, v.y * 3, v.z * 3) - 0.5) * 0.45; p.setXYZ(i, v.x * k, v.y + (fbm(v.x * 5, 0, v.z * 5) - 0.5) * 0.08, v.z * k); }
    geo.computeVertexNormals();
    // streams of lava running down the slope (emissive map around the cone)
    const ec = W.canvas(512, 256), eg = ec.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, 512, 256);
    const cc = W.canvas(512, 256), cg = cc.getContext('2d'); cg.fillStyle = '#2a221d'; cg.fillRect(0, 0, 512, 256); W.noise(cg, 512, 256, 26000, 15, 110, 0.55, 2); W.noise(cg, 512, 256, 2500, 100, 170, 0.4, 3);
    for (let k = 0; k < 7; k++) {
      let x0 = rnd(0, 512), y0 = 0; const w0 = rnd(5, 12);
      for (const [ctx, col, lw] of [[eg, '#ff5a10', w0 * 1.8], [eg, '#ffd060', w0 * 0.6], [cg, '#e05010', w0]]) {
        let x = x0, y = y0; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 10; j++) { x += rnd(-14, 14); y += rnd(14, 26) * (1 - j * 0.03); ctx.lineTo(x, y); ctx.lineWidth = lw * (1 - j * 0.08); }
        ctx.stroke();
      }
    }
    const cone = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: W.texOf(cc), bumpMap: W.texOf(cc, false), bumpScale: 2.5, emissiveMap: W.texOf(ec), emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.9 }));
    cone.position.y = 0.6 * s; cone.castShadow = cone.receiveShadow = true; g.add(cone);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(0.29 * s, 24), new THREE.MeshStandardMaterial({ color: 0xff8a20, emissive: 0xff5a00, emissiveIntensity: 2.4 }));
    crater.rotation.x = -Math.PI / 2; crater.position.y = 1.16 * s; g.add(crater);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.06 * s, 8, 28), rockMats[0]); rim.rotation.x = Math.PI / 2; rim.position.y = 1.19 * s; g.add(rim);
    const l = new THREE.PointLight(0xff6a18, 5, 6, 2); l.position.y = 1.5 * s; g.add(l);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; rock(Math.cos(a) * 1.05 * s, Math.sin(a) * 1.05 * s, rnd(0.12, 0.24), g); }
    g.position.set(x, 0, z); root.add(g);
    W.lava.push({ light: l, crater, cone, ph: Math.random() * 6, x, z, top: 1.2 * s });
  }
  for (const [x, z, s] of [[-6.1, 0, 1.0], [6.1, 0, 0.9]]) volcano(x, z, s);
  W.volcanoes = [[-6.1, 0, 1.0], [6.1, 0, 0.9]];
  W.frameFns.push(dt => {
    for (const v of W.lava) {
      const f = 0.5 + 0.5 * Math.sin(W.time * 2.2 + v.ph);
      v.light.intensity = 1.3 + 0.6 * f; v.crater.material.emissiveIntensity = 2 + f; v.cone.material.emissiveIntensity = 1.0 + 0.5 * f;
      if (Math.random() < dt * 3) FX.smoke(v.x + rnd(-0.1, 0.1), v.top + 0.1, v.z + rnd(-0.1, 0.1), 0x3a3430);
    }
  });

  /* ---------- rocks, drums, tyres, crates, floodlights ---------- */
  for (let i = 0; i < 90; i++) {
    const x = rnd(-10.4, 10.4), z = rnd(-6.4, 6.4);
    if (trackDist(x, z) > 2.3 && Math.hypot(Math.abs(x) - 6.1, z) > 1.5) rock(x, z, rnd(0.1, 0.36));
  }
  const drumMats = [0xb83a1c, 0xd8a020, 0x3a5a7a, 0x4a5a3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.55 }));
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.5, metalness: 0.7 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const crateC = W.canvas(128, 128), cg = crateC.getContext('2d'); cg.fillStyle = '#7a5a34'; cg.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) { cg.fillStyle = 'rgba(0,0,0,.35)'; cg.fillRect(0, y, 128, 3); } W.noise(cg, 128, 128, 800, 60, 140, 0.3, 2);
  cg.strokeStyle = '#3a2a18'; cg.lineWidth = 10; cg.strokeRect(5, 5, 118, 118); cg.beginPath(); cg.moveTo(8, 8); cg.lineTo(120, 120); cg.stroke();
  const crateMat = new THREE.MeshStandardMaterial({ map: W.texOf(crateC), roughness: 0.85 });
  function drum(x, z, tip) {
    const g = new THREE.Group(), m = drumMats[Math.floor(Math.random() * 4)];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 20), m); g.add(body);
    for (const y of [-0.12, 0.12]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 6, 20), ribMat); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    if (tip) { g.rotation.z = Math.PI / 2; g.position.set(x, 0.13, z); g.rotation.y = rnd(0, 6); } else g.position.set(x, 0.19, z);
    root.add(g);
  }
  function tyres(x, z, n) { for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.065, 10, 20), tyreMat); t.rotation.x = Math.PI / 2; t.position.set(x + rnd(-0.02, 0.02), 0.065 + i * 0.12, z + rnd(-0.02, 0.02)); t.castShadow = t.receiveShadow = true; root.add(t); } }
  function crate(x, z, s) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat); c.position.set(x, s / 2, z); c.rotation.y = rnd(0, 1.5); c.castShadow = c.receiveShadow = true; root.add(c); }
  function flood(x, z) {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 8), ribMat); mast.position.y = 0.75; g.add(mast);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.05), ribMat); bar.position.y = 1.5; g.add(bar);
    for (const dx of [-0.17, 0, 0.17]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), ribMat); lamp.position.set(dx, 1.58, 0); g.add(lamp);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 3 })); lens.position.set(dx, 1.58, 0.031); g.add(lens);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); g.lookAt(0, 0, 0); g.rotation.x = 0; root.add(g);
  }
  const spots = [[-10.2, -6.0], [10.2, -6.0], [-10.2, 6.0], [10.2, 6.0], [0, -6.3], [0, 6.3], [-3.2, -5.6], [3.4, 5.6]];
  spots.forEach(([x, z], i) => {
    if (i < 4) { flood(x * 0.98, z * 0.98); }
    drum(x + rnd(0.3, 0.5) * -Math.sign(x || 1), z + rnd(-0.2, 0.2), i % 3 === 0);
    drum(x + rnd(0.5, 0.8) * -Math.sign(x || 1), z + rnd(0.1, 0.3) * -Math.sign(z), false);
    if (i % 2) tyres(x + 0.2, z - 0.45 * Math.sign(z), 2 + (i % 3)); else crate(x - 0.3 * Math.sign(x || 1), z - 0.4 * Math.sign(z), rnd(0.22, 0.3));
  });

  /* ---------- table dressing beside the player mat ---------- */
  W.buildTableProps = (group) => {
    const pipC = (n) => { const c = W.canvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#20232c'; g.fillRect(0, 0, 128, 128); W.noise(g, 128, 128, 600, 40, 110, 0.35, 3);
      for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(160,170,190,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(rnd(0, 128), 0); g.bezierCurveTo(rnd(0, 128), 40, rnd(0, 128), 90, rnd(0, 128), 128); g.stroke(); }
      g.fillStyle = '#e8c070'; const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] }[n];
      P.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); }); return W.texOf(c); };
    const dieMats = [1, 6, 2, 5, 3, 4].map(n => new THREE.MeshStandardMaterial({ map: pipC(n), roughness: 0.25, metalness: 0.1 }));
    const die = (x, z, s) => { const d = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), dieMats); d.position.set(x, s / 2, z); d.rotation.y = rnd(0, 6); d.castShadow = d.receiveShadow = true; group.add(d); };
    die(-6.4, -1.2, 0.42); die(-6.95, -0.5, 0.42); die(6.6, 1.6, 0.42);
    const d20 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0x5a1e1a, roughness: 0.25, metalness: 0.2, flatShading: true }));
    d20.position.set(-7.0, 0.25, 0.4); d20.rotation.set(0.4, 1, 0.2); d20.castShadow = true; group.add(d20);
    const coinC = W.canvas(128, 128), kg = coinC.getContext('2d'); const gr = kg.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, '#f0d080'); gr.addColorStop(1, '#a87a2a');
    kg.fillStyle = gr; kg.fillRect(0, 0, 128, 128); kg.strokeStyle = '#7a5418'; kg.lineWidth = 6; kg.beginPath(); kg.arc(64, 64, 52, 0, 7); kg.stroke();
    kg.fillStyle = '#7a5418'; kg.font = '900 54px Georgia, serif'; kg.textAlign = 'center'; kg.textBaseline = 'middle'; kg.fillText('G', 64, 68);
    const coinT = W.texOf(coinC), coinMat = new THREE.MeshStandardMaterial({ map: coinT, bumpMap: coinT, bumpScale: 0.01, metalness: 0.9, roughness: 0.3 });
    const coinEdge = new THREE.MeshStandardMaterial({ color: 0xc8962e, metalness: 0.9, roughness: 0.35 });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 28), [coinEdge, coinMat, coinMat]);
      const stack = i < 6; c.position.set(stack ? 6.7 + rnd(-0.02, 0.02) : 6.3 + rnd(-0.5, 0.5), stack ? 0.025 + i * 0.052 : 0.025, stack ? -0.6 : -1.4 + rnd(-0.4, 0.4));
      c.rotation.y = rnd(0, 6); c.castShadow = c.receiveShadow = true; group.add(c);
    }
    // the draw pile
    for (let i = 0; i < 14; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.018, 1.48), [EDGE_MAT, EDGE_MAT, BACK_MAT, BACK_MAT, EDGE_MAT, EDGE_MAT]);
      card.position.set(-6.7 + rnd(-0.02, 0.02), 0.01 + i * 0.019, 1.4); card.rotation.y = 0.08 + rnd(-0.03, 0.03); card.castShadow = card.receiveShadow = true; group.add(card);
    }
  };
})();
