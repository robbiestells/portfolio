/* Galactic Gridlock prototype: tabletop world core (renderer, lighting, table, printed board, camera) */
const W = { frameFns: [], time: 0, tiles: [], mobile: Math.min(screen.width, screen.height) < 700 };

(function buildWorld() {
  const host = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio || 1, W.mobile ? 1.75 : 2);
  renderer.setPixelRatio(PR);
  renderer.shadowMap.enabled = true;
  W.rev = parseInt(THREE.REVISION, 10);
  renderer.shadowMap.type = W.rev >= 182 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0805);
  scene.fog = new THREE.Fog(0x0d0805, 34, 80);
  const root = new THREE.Group();             // the board; turns with screen orientation
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 300);
  Object.assign(W, { renderer, scene, root, camera, host });

  /* ---------- shared helpers ---------- */
  W.rnd = (a, b) => a + Math.random() * (b - a);
  W.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  W.texOf = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  W.noise = (g, w, h, n, a, b, alpha = 0.5, sz = 2) => { for (let i = 0; i < n; i++) { const v = Math.floor(W.rnd(a, b)); g.fillStyle = `rgba(${v},${v},${v},${alpha})`; g.fillRect(Math.random() * w, Math.random() * h, sz, sz); } };
  const rnd = W.rnd;

  /* ---------- reflections: a dim games room with a warm lamp and a cool window ---------- */
  (function env() {
    const pm = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(60, 24, 60), new THREE.MeshBasicMaterial({ color: 0x1c120a, side: THREE.BackSide })));
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 6.5, 4), side: THREE.DoubleSide }));
    lamp.position.set(-4, 11.5, 4); lamp.rotation.x = Math.PI / 2; room.add(lamp);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.0, 2.6), side: THREE.DoubleSide }));
    win.position.set(29, 4, -6); win.rotation.y = -Math.PI / 2; room.add(win);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x3a2414 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6; room.add(floor);
    scene.environment = pm.fromScene(room, 0.03).texture;
    pm.dispose();
  })();

  /* ---------- lights: overhead games-room lamp, cool window fill ---------- */
  scene.add(new THREE.HemisphereLight(0xffe0bc, 0x24160c, 0.8));
  const key = new THREE.SpotLight(0xffd6a0, 3.9, 0, 0.56, 0.85, 0);
  key.position.set(-7, 30, 14); key.target.position.set(0, 0, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(W.mobile ? 2048 : 4096, W.mobile ? 2048 : 4096);
  key.shadow.camera.near = 12; key.shadow.camera.far = 70; key.shadow.bias = -0.00012; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x9fc0ff, 1.1); fill.position.set(20, 10, -14); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffb070, 0.8); rim.position.set(-12, 6, -20); scene.add(rim);
  W.key = key;

  /* ---------- the wooden games table ---------- */
  (function table() {
    const S = W.mobile ? 1024 : 2048, c = W.canvas(S, S), g = c.getContext('2d'), bc = W.canvas(S, S), bg = bc.getContext('2d'), Q = S / 1024;
    const planks = 6, ph = S / planks;
    bg.fillStyle = '#808080'; bg.fillRect(0, 0, S, S);
    for (let i = 0; i < planks; i++) {
      const y = i * ph, hue = 27 + rnd(-4, 4), l = 33 + rnd(-5, 6);
      g.fillStyle = `hsl(${hue}, 36%, ${l}%)`; g.fillRect(0, y, S, ph);
      for (let k = 0; k < 260 * Q; k++) {
        const yy = y + Math.random() * ph, dl = rnd(-10, 5), w = (0.4 + Math.random() * 2.0) * Q;
        g.strokeStyle = `hsla(${hue - 4}, 42%, ${l + dl}%, ${0.15 + Math.random() * 0.35})`; g.lineWidth = w;
        bg.strokeStyle = `rgba(${dl < 0 ? 90 : 160},${dl < 0 ? 90 : 160},${dl < 0 ? 90 : 160},.5)`; bg.lineWidth = w;
        const wob = rnd(-8, 8);
        for (const ctx of [g, bg]) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(S * 0.3, yy + wob, S * 0.7, yy - wob, S, yy + rnd(-3, 3)); ctx.stroke(); }
      }
      for (let k = 0; k < 2; k++) {                // knots
        const kx = rnd(60, S - 60), ky = y + rnd(20, ph - 20);
        for (let r = 22; r > 2; r -= 3) { g.strokeStyle = `hsla(20, 50%, ${l - 14 + r * 0.25}%, .5)`; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, r * 2.2, r * 0.7, 0, 0, 7); g.stroke(); }
      }
      g.fillStyle = 'rgba(10,5,2,.85)'; g.fillRect(0, y, S, 4); bg.fillStyle = '#101010'; bg.fillRect(0, y, S, 5);
      const seam = rnd(100, S - 100); g.fillRect(seam, y, 3, ph); bg.fillRect(seam, y, 4, ph);
    }
    const t = W.texOf(c), b = W.texOf(bc, false);
    for (const x of [t, b]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(5, 5); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: t, bumpMap: b, bumpScale: 1.4, roughness: 0.55, metalness: 0, envMapIntensity: 0.7 }));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.42; m.receiveShadow = true; scene.add(m);
  })();

  /* ---------- the printed game board ---------- */
  const PX = W.mobile ? 96 : 128, bx = x => (x + BOARD.w / 2) * PX, bz = z => (z + BOARD.d / 2) * PX;
  W.boardPx = { PX, bx, bz };
  function paintBoard() {
    const w = BOARD.w * PX, h = BOARD.d * PX;
    const c = W.canvas(w, h), g = c.getContext('2d');
    const e = W.canvas(w, h), eg = e.getContext('2d');
    const k = W.canvas(w, h), kg = k.getContext('2d');
    // basalt ground
    const gr = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#2a211b'); gr.addColorStop(1, '#16110e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    kg.fillStyle = '#808080'; kg.fillRect(0, 0, w, h);
    eg.fillStyle = '#000'; eg.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000 * (PX / 96) * (PX / 96); i++) {
      const v = Math.floor(rnd(14, 70)), x = Math.random() * w, y = Math.random() * h, s = rnd(1, 4.5);
      g.fillStyle = `rgba(${v + 8},${v + 2},${v - 4},${rnd(0.2, 0.7)})`; g.fillRect(x, y, s, s * rnd(0.5, 1.2));
      kg.fillStyle = `rgba(${v * 2.4},${v * 2.4},${v * 2.4},.5)`; kg.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 160 * (PX / 96); i++) {                  // cracked rock plates
      let x = Math.random() * w, y = Math.random() * h; g.strokeStyle = 'rgba(5,3,2,.55)'; kg.strokeStyle = 'rgba(20,20,20,.7)';
      g.lineWidth = kg.lineWidth = rnd(1, 2.5) * PX / 96; g.beginPath(); kg.beginPath(); g.moveTo(x, y); kg.moveTo(x, y);
      const pts = [[x, y]]; for (let j = 0; j < 6; j++) { x += rnd(-40, 40); y += rnd(-40, 40); g.lineTo(x, y); kg.lineTo(x, y); pts.push([x, y]); }
      g.stroke(); kg.stroke();
      g.strokeStyle = 'rgba(150,125,100,.22)'; g.lineWidth = 1; g.beginPath(); pts.forEach((q, j) => j ? g.lineTo(q[0] + 2, q[1] + 2) : g.moveTo(q[0] + 2, q[1] + 2)); g.stroke();
    }
    // lava rivers: painted, glowing (emissive map) and sunken (bump)
    const wander = (x0, z0, x1, z1, n, amp) => { const p = []; for (let i = 0; i <= n; i++) { const t = i / n; p.push([x0 + (x1 - x0) * t + rnd(-amp, amp), z0 + (z1 - z0) * t + rnd(-amp, amp)]); } return p; };
    const rivers = [[wander(-8.5, -0.4, -3.6, 0.5, 9, 0.3), 0.34], [wander(3.6, -0.5, 8.5, 0.3, 9, 0.3), 0.3], [wander(-10.6, -6.2, -7.5, -6.5, 6, 0.2), 0.18],
      [wander(10.6, 6.2, 7.5, 6.6, 6, 0.2), 0.2], [wander(-1.5, -6.6, 1.2, -5.8, 5, 0.2), 0.16], [wander(-1.2, 6.6, 1.5, 6.0, 5, 0.2), 0.16]];
    const stroke = (ctx, pts, lw, col, blur) => {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw * PX; ctx.shadowColor = col; ctx.shadowBlur = blur;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(bx(p[0]), bz(p[1])) : ctx.moveTo(bx(p[0]), bz(p[1]))); ctx.stroke(); ctx.restore();
    };
    for (const [pts, wd] of rivers) {
      stroke(g, pts, wd * 2.2, 'rgba(60,14,2,.9)', 10); stroke(g, pts, wd, '#e8500e', 14); stroke(g, pts, wd * 0.45, '#ffc040', 8);
      stroke(eg, pts, wd * 1.4, 'rgba(255,80,10,.5)', 30); stroke(eg, pts, wd, '#ff6a14', 10); stroke(eg, pts, wd * 0.45, '#ffd060', 6);
      stroke(kg, pts, wd * 1.3, '#303030', 4);
    }
    for (let i = 0; i < 900; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = `rgba(${rnd(150, 210) | 0},${rnd(130, 170) | 0},${rnd(100, 140) | 0},${rnd(0.1, 0.35)})`; g.fillRect(x, y, rnd(1, 2.5), rnd(1, 2.5)); }   // dry-brushed highlights
    for (let i = 0; i < 700; i++) { const x = Math.random() * w, y = Math.random() * h; eg.fillStyle = `rgba(255,${rnd(80, 170) | 0},20,${rnd(0.15, 0.5)})`; eg.fillRect(x, y, 1.5, 1.5); }   // stray embers
    // printed border band with title, like a real board's frame
    const band = 0.42 * PX;
    g.fillStyle = '#100b08'; g.fillRect(0, 0, w, band); g.fillRect(0, h - band, w, band); g.fillRect(0, 0, band, h); g.fillRect(w - band, 0, band, h);
    g.strokeStyle = '#c98a2a'; g.lineWidth = 4; g.strokeRect(band - 8, band - 8, w - 2 * band + 16, h - 2 * band + 16);
    g.strokeStyle = 'rgba(201,138,42,.5)'; g.lineWidth = 2; g.strokeRect(band - 16, band - 16, w - 2 * band + 32, h - 2 * band + 32);
    g.save(); g.beginPath(); g.rect(0, 0, w, band - 20); g.rect(0, h - band + 20, w, band - 20); g.clip();
    for (let x = -60; x < w + 60; x += 46) { g.fillStyle = 'rgba(232,160,32,.16)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 22 + h, h); g.lineTo(x + h, h); g.fill(); }
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const title = (txt, y, rot) => { g.save(); g.translate(w / 2, y); g.rotate(rot); g.font = '900 30px "Big Shoulders Display", Impact, sans-serif';
      const tw = g.measureText(txt).width + 40; g.fillStyle = '#100b08'; g.fillRect(-tw / 2, -18, tw, 36); g.fillStyle = '#e8a020'; g.fillText(txt, 0, 1); g.restore(); };
    title('GALACTIC  GRIDLOCK  \u00b7  INFERNO  FIGURE-8', h - band / 2, 0);
    title('LAVA  WORLD  \u00b7  CIRCUIT  01', band / 2, Math.PI);
    // faint printed grid
    g.strokeStyle = 'rgba(220,200,170,.05)'; g.lineWidth = 1;
    for (let x = 1; x < BOARD.w; x++) { g.beginPath(); g.moveTo(x * PX, band); g.lineTo(x * PX, h - band); g.stroke(); }
    for (let z = 1; z < BOARD.d; z++) { g.beginPath(); g.moveTo(band, z * PX); g.lineTo(w - band, z * PX); g.stroke(); }
    W.paintBoardTitle = () => { title('GALACTIC  GRIDLOCK  \u00b7  INFERNO  FIGURE-8', h - band / 2, 0); title('LAVA  WORLD  \u00b7  CIRCUIT  01', band / 2, Math.PI); };
    return { map: W.texOf(c), emissive: W.texOf(e), bump: W.texOf(k, false), canvas: c };
  }
  const B = paintBoard();
  W.boardTex = B;
  const edgeC = W.canvas(512, 64), eg = edgeC.getContext('2d');
  eg.fillStyle = '#141018'; eg.fillRect(0, 0, 512, 64); W.noise(eg, 512, 64, 3000, 20, 60, 0.4, 1);
  eg.fillStyle = '#c98a2a'; eg.fillRect(0, 6, 512, 3); eg.fillRect(0, 55, 512, 3);
  const edgeT = W.texOf(edgeC); edgeT.wrapS = THREE.RepeatWrapping; edgeT.repeat.set(6, 1);
  const edge = new THREE.MeshStandardMaterial({ map: edgeT, roughness: 0.8 });
  const top = new THREE.MeshStandardMaterial({ map: B.map, emissiveMap: B.emissive, emissive: 0xffffff, emissiveIntensity: 1.1, bumpMap: B.bump, bumpScale: 2.2, roughness: 0.78, envMapIntensity: 0.4 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w, 0.36, BOARD.d), [edge, edge, top, edge, edge, edge]);
  board.position.y = -0.2; board.receiveShadow = true; board.castShadow = true; root.add(board);
  W.boardTop = top;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { W.paintBoardTitle(); B.map.needsUpdate = true; });

  /* ---------- sizing: seated view from the player's side, mat on the table in front ---------- */
  W.HUD = { top: 132, bottom: 66 };
  function resize() {
    const w = host.clientWidth || 360, h = host.clientHeight || 640;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    Post.resize(w, h, renderer.getPixelRatio());
    camera.aspect = w / h; camera.clearViewOffset();
    const portrait = h > w * 1.05; W.portrait = portrait;
    root.rotation.y = portrait ? Math.PI / 2 : 0;
    root.updateMatrixWorld(true);
    const bw = portrait ? BOARD.d : BOARD.w, bd = portrait ? BOARD.w : BOARD.d;
    const matZ = bd / 2 + 0.6 + MAT.d / 2;
    if (W.mat) W.mat.position.set(0, -0.3, matZ);
    const pts = [];
    for (const x of [-bw / 2 - 0.25, bw / 2 + 0.25]) for (const z of [-bd / 2 - 0.25, bd / 2 + 0.25]) pts.push(new THREE.Vector3(x, 0, z));
    for (const x of [-MAT.w / 2, MAT.w / 2]) for (const z of [-MAT.d / 2, MAT.d / 2]) pts.push(new THREE.Vector3(x, -0.3, matZ + z));
    pts.push(new THREE.Vector3(0, 1.2, -bd / 2 + 1));
    const elev = THREE.MathUtils.degToRad(portrait ? 58 : 50);
    const target = new THREE.Vector3(0, 0, portrait ? 3 : 2);
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    const yMin = -1 + 2 * W.HUD.bottom / h, yMax = 1 - 2 * W.HUD.top / h;
    const availX = 1.94, availY = (yMax - yMin) * 0.98;
    const place = D => { camera.position.copy(target).addScaledVector(dir, D); camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
    const bounds = () => {
      let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
      for (const p of pts) { const v = p.clone().project(camera); a = Math.min(a, v.x); b = Math.max(b, v.x); c = Math.min(c, v.y); d = Math.max(d, v.y); }
      return [a, b, c, d];
    };
    let lo = 4, hi = 400;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; place(m); const [a, b, c, d] = bounds(); if (b - a <= availX && d - c <= availY) hi = m; else lo = m; }
    place(hi);
    const [a, b, c, d] = bounds();
    camera.setViewOffset(w, h, (a + b) / 2 * w / 2, -((c + d) / 2 - (yMin + yMax) / 2) * h / 2, w, h);
    camera.updateProjectionMatrix();
    // keep the board and mat in focus; the far edge of the table falls away
    const boardTopY = new THREE.Vector3(0, 0, -bd / 2).project(camera).y, matY = new THREE.Vector3(0, 0, matZ).project(camera).y;
    const fy = ((boardTopY + matY) / 2 + 1) / 2, fw = Math.abs(boardTopY - matY) / 4 + 0.04;
    Post.focus(fy, fw);
  }
  W.layout = resize;

  Post.init(renderer);
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(host);
  resize();

  W.project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
    return { x: (v.x * 0.5 + 0.5) * host.clientWidth, y: (-v.y * 0.5 + 0.5) * host.clientHeight };
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; W.time += dt;
    root.updateMatrixWorld(true);
    top.emissiveIntensity = 0.9 + 0.35 * Math.sin(W.time * 1.7);
    for (const fn of W.frameFns) fn(dt, now);
    if (Post.on) Post.render(scene, camera, W.time); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  W.start = () => requestAnimationFrame(frame);
})();
