/* Galactic Gridlock prototype: miniatures, tokens, dice, projectiles, effects */
let SPEED = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms / SPEED));
function anim(ms, fn) {
  return new Promise(res => {
    const t0 = performance.now(), d = ms / SPEED;
    (function f(now) { const t = Math.min(1, (now - t0) / d); fn(t); t < 1 ? requestAnimationFrame(f) : res(); })(t0);
  });
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rr = (a, b) => a + Math.random() * (b - a);

const FX = { parts: [], wrecks: [], shake: 0 };
const matCache = {};
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.2 }, o));
function box(w, h, d, m, x, y, z, parent) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b;
}
function cyl(r, h, m, x, y, z, parent, axisZ, seg = 14) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); c.position.set(x, y, z);
  if (axisZ) c.rotation.x = Math.PI / 2; c.castShadow = true; parent.add(c); return c;
}

/* ---------- miniature ---------- */
const FLOCK = (() => {
  const c = W.canvas(256, 256), g = c.getContext('2d'); g.fillStyle = '#6a5a44'; g.fillRect(0, 0, 256, 256);
  W.noise(g, 256, 256, 9000, 50, 150, 0.6, 2); W.noise(g, 256, 256, 600, 20, 40, 0.7, 4);
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,24,18,.8)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, rr(2, 5), 0, 7); g.fill(); }
  return W.texOf(c);
})();
function numberTex(n, col) {
  const c = W.canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#efe6d0'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
  g.strokeStyle = '#' + col.toString(16).padStart(6, '0'); g.lineWidth = 10; g.stroke();
  g.fillStyle = '#141414'; g.font = '900 76px Impact, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70);
  return W.texOf(c);
}
/* ---------- shared miniature parts: bevelled blocks, tubes, weathering ---------- */
const GEO = {};
function rboxGeo(w, h, d, r = 0.03) {
  const k = 'b' + [w, h, d, r].join(','); if (GEO[k]) return GEO[k];
  const b = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), iw = w - 2 * b, ih = h - 2 * b, id = Math.max(0.002, d - 2 * b);
  const s = new THREE.Shape(); s.moveTo(-iw / 2, -ih / 2); s.lineTo(iw / 2, -ih / 2); s.lineTo(iw / 2, ih / 2); s.lineTo(-iw / 2, ih / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: id, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -id / 2); return (GEO[k] = g);
}
function cylGeo(r0, r1, h, seg) { const k = 'c' + [r0, r1, h, seg].join(','); return GEO[k] || (GEO[k] = new THREE.CylinderGeometry(r0, r1, h, seg)); }
function put(geo, m, x, y, z, parent, rot) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); parent.add(o); return o; }
const RB = (w, h, d, m, x, y, z, p, rot, r) => put(rboxGeo(w, h, d, r), m, x, y, z, p, rot);
const CY = (r, h, m, x, y, z, p, rot, seg = 14, r1) => put(cylGeo(r, r1 === undefined ? r : r1, h, seg), m, x, y, z, p, rot);
const UPV = new THREE.Vector3(0, 1, 0);
function tube(ax, ay, az, bx, by, bz, r, m, p, seg = 8) {
  const a = new THREE.Vector3(ax, ay, az), d = new THREE.Vector3(bx - ax, by - ay, bz - az), len = d.length();
  const o = new THREE.Mesh(cylGeo(r, r, len, seg), m); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UPV, d.normalize()); p.add(o); return o;
}
// paint chips, scratches and grime shared by every painted part
const GRUNGE = (() => {
  const S = 256, c = W.canvas(S, S), g = c.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
  W.noise(g, S, S, 2600, 150, 235, 0.55, 2); W.noise(g, S, S, 700, 60, 120, 0.7, 1.5);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rr(40, 90) | 0},${rr(40, 90) | 0},${rr(40, 90) | 0},${rr(0.25, 0.6)})`; g.lineWidth = rr(0.6, 1.4); g.beginPath(); const x = rr(0, S), y = rr(0, S), a = rr(0, 6.28), l = rr(6, 26); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(30,24,20,.55)'; g.beginPath(); g.ellipse(rr(0, S), rr(0, S), rr(1, 3.5), rr(1, 3), rr(0, 3), 0, 7); g.fill(); }
  const t = W.texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
})();
const HULL = (() => {        // painted tub: flat fenders, sloped bonnet
  const s = new THREE.Shape();
  s.moveTo(-1.0, 0.28); s.lineTo(1.04, 0.28); s.lineTo(1.1, 0.4); s.lineTo(1.08, 0.52); s.lineTo(0.56, 0.6); s.lineTo(0.3, 0.64); s.lineTo(-0.94, 0.64); s.lineTo(-1.04, 0.52); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -0.4); return g;
})();
/* merge every static piece of a car that shares a material into one mesh: ~250 parts become a handful of draw calls */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map(), tmp = new THREE.Matrix4();
  root.traverse(o => { if (o.isMesh && !o.userData.keep) { if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(o); } });
  for (const [m, list] of buckets) {
    const geos = list.map(o => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(tmp.multiplyMatrices(inv, o.matrixWorld)); return g; });
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let a = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, a * 3); nor.set(g.attributes.normal.array, a * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, a * 2); a += g.attributes.position.count; g.dispose(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(mg, m); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    for (const o of list) o.parent.remove(o);
  }
}

/* ---------- miniature: modular chassis (tier 1 stock, tier 2 upgraded, tier 3 juggernaut) ---------- */
function buildCar(spec) {
  const tier = spec.tier || 1;
  const g = new THREE.Group(), body = new THREE.Group();
  body.scale.setScalar(0.41); body.position.y = 0.075; g.add(body);
  const weather = (o) => Object.assign({ map: GRUNGE, bumpMap: GRUNGE, bumpScale: 0.25 }, o);
  const paint = new THREE.MeshPhysicalMaterial(weather({ color: spec.color, roughness: 0.46, metalness: 0.12, clearcoat: 0.55, clearcoatRoughness: 0.35 }));
  const trim = mat(spec.trim, weather({ roughness: 0.5, metalness: 0.55 }));
  const resin = mat(0x888b8f, weather({ roughness: 0.62, metalness: 0.05 }));      // grey bolt-on module plastic
  const rust = mat(0x6e4026, { roughness: 0.9, metalness: 0.2 });
  const tire = mat(0x161616, { roughness: 0.94, metalness: 0 });
  const chrome = mat(0xd0d3d8, { roughness: 0.18, metalness: 1 });
  const dark = mat(0x0b0b0d, { roughness: 0.7, metalness: 0.2 });
  const seatM = mat(0x2a2623, { roughness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2733, roughness: 0.04, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.7, transparent: true, opacity: 0.55 });
  const lift = spec.gear === 'hover' ? 0.2 : spec.gear === 'treads' ? 0.05 : 0;

  // painted miniature base: bevelled plinth, flocked top, team-colour rim
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.05, 40), mat(0x111114, { roughness: 0.35, metalness: 0.1 }));
  plinth.position.y = 0.025; plinth.receiveShadow = true; plinth.castShadow = true; g.add(plinth);
  const flock = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.025, 40), new THREE.MeshStandardMaterial({ map: FLOCK, bumpMap: FLOCK, bumpScale: 0.6, roughness: 1 }));
  flock.position.y = 0.062; flock.receiveShadow = true; g.add(flock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.014, 8, 48), mat(spec.color, { emissive: spec.color, emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.4 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  for (let i = 0; i < 4; i++) { const pb = new THREE.Mesh(new THREE.DodecahedronGeometry(rr(0.03, 0.06), 0), mat(0x3a3028, { roughness: 1 })); const a = rr(0, 6.28), r = rr(0.25, 0.42); pb.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r); g.add(pb); }

  const Y = lift, wheeled = spec.gear !== 'treads' && spec.gear !== 'hover';
  const R = spec.gear === 'spiked' ? 0.4 : tier >= 2 ? 0.34 : 0.3, Wd = spec.gear === 'spiked' ? 0.34 : tier >= 2 ? 0.28 : 0.24, WZ = 0.6, WX = 0.64;

  // tub, bonnet details
  put(HULL, paint, 0, Y, 0, body);
  RB(1.9, 0.05, 0.8, dark, 0, 0.27 + Y, 0, body);                                              // chassis pan
  RB(0.44, 0.09, 0.34, trim, 0.62, 0.64 + Y, 0, body, [0, 0, -0.1]); RB(0.04, 0.06, 0.28, dark, 0.84, 0.63 + Y, 0, body, [0, 0, -0.1]);   // bonnet scoop + intake
  for (const x of [0.4, 0.9]) for (const z of [-0.3, 0.3]) CY(0.022, 0.03, chrome, x, x > 0.6 ? 0.58 + Y : 0.63 + Y, z, body, null, 8);
  for (const z of [-0.405, 0.405]) for (let x = -0.8; x <= 0.8; x += 0.2) put(new THREE.SphereGeometry(0.016, 6, 4), chrome, x, 0.36 + Y, z, body);
  for (let k = 0; k < 5; k++) { const r = RB(rr(0.12, 0.28), 0.01, rr(0.08, 0.2), rust, rr(-0.8, 0.8), 0.655 + Y, rr(-0.3, 0.3), body, [0, rr(0, 3), 0]); }

  // roll cage, roof with plugged mounting hole, windscreen, interior
  const cageY0 = 0.64 + Y, cageY1 = 1.14 + Y;
  for (const z of [-0.37, 0.37]) {
    tube(-0.6, cageY0, z, -0.6, cageY1, z, 0.028, resin, body); tube(0.3, cageY0, z, 0.03, cageY1, z, 0.028, resin, body);
    tube(-0.6, cageY1, z, 0.03, cageY1, z, 0.026, resin, body); tube(-0.6, 0.9 + Y, z, 0.17, 0.9 + Y, z, 0.02, resin, body);
    tube(-0.6, cageY0, z, 0.03, cageY1, z, 0.016, resin, body);
  }
  tube(-0.6, cageY1, -0.37, -0.6, cageY1, 0.37, 0.026, resin, body); tube(0.03, cageY1, -0.37, 0.03, cageY1, 0.37, 0.026, resin, body); tube(-0.6, 0.98 + Y, -0.37, -0.6, 0.98 + Y, 0.37, 0.02, resin, body);
  RB(0.86, 0.045, 0.9, paint, -0.28, cageY1 + 0.03, 0, body, null, 0.02);
  for (const x of [-0.5, -0.28, -0.06]) for (const z of [-0.3, 0.3]) CY(0.02, 0.012, dark, x, cageY1 + 0.058, z, body, null, 8);
  if (tier === 1) CY(0.07, 0.012, dark, -0.28, cageY1 + 0.058, 0, body, null, 14);                  // plugged hole for a weapon module
  RB(0.02, 0.42, 0.74, glass, 0.165, 0.9 + Y, 0, body, [0, 0, 0.52], 0.008);
  RB(0.24, 0.13, 0.72, dark, 0.2, 0.7 + Y, 0, body, [0, 0, -0.1]);                               // dash
  CY(0.1, 0.014, dark, 0.12, 0.8 + Y, 0.17, body, [0, 0, 1.0], 12);                             // steering wheel
  for (const z of [-0.18, 0.18]) { RB(0.3, 0.1, 0.3, seatM, -0.1, 0.7 + Y, z, body); RB(0.08, 0.42, 0.3, seatM, -0.28, 0.9 + Y, z, body, [0, 0, 0.12]); }
  RB(0.2, 0.3, 0.26, paint, -0.15, 0.9 + Y, 0.18, body, [0, 0, 0.1]);                          // driver torso
  put(new THREE.SphereGeometry(0.105, 14, 10), chrome, -0.13, 1.08 + Y, 0.18, body);              // helmet
  RB(0.06, 0.07, 0.15, dark, -0.045, 1.085 + Y, 0.18, body);                                      // visor
  RB(0.22, 0.2, 0.22, rust, -0.1, 0.85 + Y, -0.18, body, [0, 0.4, 0]);                           // crate on the passenger seat

  // nose: bumper, bull bar, grille, lights; tail: bumper, spare, exhausts
  RB(0.12, 0.17, 0.92, trim, 1.16, 0.35 + Y, 0, body);
  for (const z of [-0.3, 0.3]) tube(1.2, 0.4 + Y, z, 1.2, 0.8 + Y, z, 0.026, resin, body);
  tube(1.2, 0.8 + Y, -0.3, 1.2, 0.8 + Y, 0.3, 0.026, resin, body); tube(1.2, 0.6 + Y, -0.3, 1.2, 0.6 + Y, 0.3, 0.02, resin, body);
  for (let k = -3; k <= 3; k++) RB(0.03, 0.12, 0.028, chrome, 1.13, 0.5 + Y, k * 0.09, body, null, 0.008);
  RB(0.04, 0.16, 0.66, dark, 1.11, 0.5 + Y, 0, body);
  const head = mat(0xfff0c8, { emissive: 0xffe0a0, emissiveIntensity: 2.2, roughness: 0.2 }), tail = mat(0xff2a1a, { emissive: 0xff2010, emissiveIntensity: 1.6 });
  for (const z of [-0.36, 0.36]) { CY(0.075, 0.05, head, 1.1, 0.5 + Y, z, body, [0, 0, Math.PI / 2], 14); CY(0.095, 0.02, chrome, 1.085, 0.5 + Y, z, body, [0, 0, Math.PI / 2], 14); RB(0.03, 0.07, 0.15, tail, -1.1, 0.5 + Y, z * 0.9, body); }
  CY(0.045, 0.1, chrome, 1.2, 0.36 + Y, 0, body, [0, 0, Math.PI / 2], 12);                          // winch drum
  RB(0.12, 0.13, 1.0, trim, -1.1, 0.34 + Y, 0, body);
  CY(0.26, 0.15, tire, -1.28, 0.7 + Y, 0, body, [0, 0, Math.PI / 2], 22); CY(0.16, 0.17, chrome, -1.28, 0.7 + Y, 0, body, [0, 0, Math.PI / 2], 14);   // spare
  RB(0.14, 0.26, 0.2, rust, -1.1, 0.7 + Y, 0.34, body);                                                // fuel can
  for (const z of [-0.2, 0.2]) { tube(-0.92, 0.55 + Y, z, -1.0, 0.95 + Y, z, 0.05, chrome, body, 12); CY(0.062, 0.05, dark, -1.02, 1.0 + Y, z, body, [0, 0, 0.35], 12); }

  // number decals (kept as their own meshes: transparent)
  for (const z of [-0.455, 0.455]) {
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: numberTex(spec.id + 1, spec.color), roughness: 0.5, transparent: true, alphaTest: 0.5 }));
    dec.position.set(-0.28, 0.46 + Y, z + Math.sign(z) * 0.008); if (z < 0) dec.rotation.y = Math.PI; dec.userData.keep = true; body.add(dec);
  }
  tube(-0.9, 1.0 + Y, 0.34, -0.98, 1.6 + Y, 0.34, 0.01, trim, body, 6); RB(0.16, 0.1, 0.01, paint, -0.98, 1.58 + Y, 0.34, body);   // whip aerial + pennant

  // running gear
  const wheel = (x, z, rad, wd, spikes) => {
    const s = Math.sign(z), n = rad > 0.33 ? 14 : 10;
    CY(rad, wd, tire, x, rad, z, body, [Math.PI / 2, 0, 0], 28);
    for (let k = 0; k < n; k++) { const a = k / n * 6.2832; RB(0.075, 0.1, wd * 0.98, tire, x + Math.cos(a) * rad, rad + Math.sin(a) * rad, z, body, [0, 0, a], 0.015); }
    CY(rad * 0.6, wd + 0.02, chrome, x, rad, z, body, [Math.PI / 2, 0, 0], 20);
    CY(rad * 0.46, wd + 0.035, dark, x, rad, z, body, [Math.PI / 2, 0, 0], 20);
    CY(rad * 0.2, wd + 0.06, trim, x, rad, z, body, [Math.PI / 2, 0, 0], 10);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.2832; put(new THREE.SphereGeometry(0.018, 6, 4), chrome, x + Math.cos(a) * rad * 0.38, rad + Math.sin(a) * rad * 0.38, z + s * (wd / 2 + 0.035), body); }
    if (spikes) for (let k = 0; k < 10; k++) { const a = k / 10 * 6.2832; put(cylGeo(0.0, 0.05, 0.16, 6), chrome, x + Math.cos(a) * (rad + 0.02), rad + Math.sin(a) * (rad + 0.02), z + s * (wd / 2 + 0.07), body, [0, 0, a - Math.PI / 2 + 0], null).rotation.set(0, 0, a - Math.PI / 2); }
  };
  if (spec.gear === 'treads') {
    const treadMat = mat(0x1c1c1c, { roughness: 0.85, metalness: 0.4 });
    for (const z of [-0.64, 0.64]) {
      put(new THREE.CylinderGeometry(0.17, 0.17, 1.64, 18), treadMat, 0, 0.26, z, body, [0, 0, Math.PI / 2]).scale.z = 0.95;
      for (let x = -0.84; x <= 0.84; x += 0.1) RB(0.05, 0.36, 0.34, treadMat, x, 0.26, z, body, null, 0.01);
      for (const x of [-0.7, -0.24, 0.24, 0.7]) { CY(0.14, 0.38, chrome, x, 0.26, z, body, [Math.PI / 2, 0, 0], 16); CY(0.06, 0.42, dark, x, 0.26, z, body, [Math.PI / 2, 0, 0], 8); }
      RB(1.6, 0.06, 0.4, resin, 0, 0.5, z, body);
    }
  } else if (spec.gear === 'hover') {
    for (const x of [-0.62, 0.62]) for (const z of [-0.6, 0.6]) {
      CY(0.31, 0.12, trim, x, 0.24, z, body, null, 28); CY(0.25, 0.14, chrome, x, 0.24, z, body, null, 28);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 28), mat(0x4fd0ff, { emissive: 0x2fb8ff, emissiveIntensity: 3 }));
      r.rotation.x = Math.PI / 2; r.position.set(x, 0.14, z); r.userData.keep = true; body.add(r);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshBasicMaterial({ color: 0x66d8ff, transparent: true, opacity: 0.6 }));
      glow.rotation.x = Math.PI / 2; glow.position.set(x, 0.15, z); glow.userData.keep = true; body.add(glow);
    }
  } else {
    for (const x of [-WX, WX]) for (const z of [-WZ, WZ]) wheel(x, z, R, Wd, spec.gear === 'spiked');
    for (const x of [-WX, WX]) for (const z of [-WZ, WZ]) { RB(0.72, 0.06, Wd + 0.1, paint, x, 2 * R + 0.02, z, body, null, 0.02); RB(0.06, 0.2, Wd + 0.1, paint, x + 0.33, 2 * R - 0.08, z, body, [0, 0, -0.35], 0.02); RB(0.06, 0.2, Wd + 0.1, paint, x - 0.33, 2 * R - 0.08, z, body, [0, 0, 0.35], 0.02); }   // flared fenders
    for (const x of [-WX - 0.38, WX + 0.38]) for (const z of [-WZ, WZ]) RB(0.04, 0.22, Wd + 0.06, dark, x, R * 0.9, z, body);          // mud flaps
  }

  // tier 2: roof machine gun, spiked side armour. tier 3: missile pods, thick armour, boosters
  if (tier >= 2) {
    for (const z of [-0.5, 0.5]) { RB(0.62, 0.26, 0.06, resin, 0.0, 0.5 + Y, z, body); for (let k = -1; k <= 1; k += 0.5) put(cylGeo(0.0, 0.045, 0.2, 6), chrome, k * 0.2, 0.5 + Y, z + Math.sign(z) * 0.12, body, [Math.sign(z) * Math.PI / 2, 0, 0]); }
  }
  if (tier === 2) {
    CY(0.065, 0.1, resin, -0.28, cageY1 + 0.14, 0, body, null, 12); RB(0.4, 0.11, 0.12, resin, -0.22, cageY1 + 0.25, 0, body);
    CY(0.026, 0.62, trim, 0.2, cageY1 + 0.25, 0, body, [0, 0, Math.PI / 2], 10); CY(0.042, 0.1, dark, 0.52, cageY1 + 0.25, 0, body, [0, 0, Math.PI / 2], 8);
    RB(0.16, 0.14, 0.1, rust, -0.34, cageY1 + 0.22, -0.16, body); RB(0.04, 0.24, 0.34, resin, 0.0, cageY1 + 0.28, 0, body);
  }
  if (tier === 3) {
    for (const z of [-0.5, 0.5]) { RB(0.98, 0.36, 0.1, resin, -0.02, 0.5 + Y, z, body, null, 0.03); for (let k = 0; k < 4; k++) put(new THREE.SphereGeometry(0.02, 6, 4), chrome, -0.4 + k * 0.27, 0.62 + Y, z + Math.sign(z) * 0.055, body); RB(0.34, 0.2, 0.012, paint, 0.08, 0.5 + Y, z + Math.sign(z) * 0.06, body); }
    RB(1.7, 0.05, 0.72, resin, 0, 0.24 + Y, 0, body); RB(0.16, 0.2, 1.0, resin, 1.22, 0.36 + Y, 0, body, null, 0.04);
    RB(0.3, 0.14, 0.34, resin, -0.38, cageY1 + 0.16, 0, body);
    for (const z of [-0.23, 0.23]) {
      RB(0.86, 0.3, 0.3, resin, -0.1, cageY1 + 0.36, z, body, [0, 0, -0.12], 0.03); RB(0.8, 0.04, 0.3, paint, -0.1, cageY1 + 0.53, z, body, [0, 0, -0.12], 0.015);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const oz = z + (col - 1) * 0.085, oy = cageY1 + 0.3 + row * 0.1;
        CY(0.038, 0.03, dark, 0.34, oy + 0.04, oz, body, [0, 0, Math.PI / 2], 10);
        put(new THREE.ConeGeometry(0.03, 0.09, 8), paint, 0.37, oy + 0.04, oz, body, [0, 0, -Math.PI / 2]);
      }
    }
    for (const z of [-0.3, 0.3]) {
      CY(0.14, 0.7, resin, -1.42, 0.78 + Y, z, body, [0, 0, Math.PI / 2], 20); CY(0.19, 0.08, dark, -1.82, 0.78 + Y, z, body, [0, 0, Math.PI / 2], 20, 0.14);
      CY(0.16, 0.05, chrome, -1.12, 0.78 + Y, z, body, [0, 0, Math.PI / 2], 20); RB(0.1, 0.3, 0.06, resin, -1.2, 0.58 + Y, z, body);
      const fl = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
      fl.rotation.y = -Math.PI / 2; fl.position.set(-1.855, 0.78 + Y, z); fl.userData.keep = true; body.add(fl);
    }
  }

  mergeStatic(body);
  // shield dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x5ab4ff, emissive: 0x2a70c0, emissiveIntensity: 0.6, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, roughness: 0.1 }));
  dome.visible = false; dome.position.y = 0.06; g.add(dome);
  g.traverse(o => { if (o.isMesh && o !== dome) { o.castShadow = true; o.receiveShadow = true; } });
  // silhouette that shows only where the car is hidden (under the overpass, behind a volcano)
  const ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.85, 24), new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth }));
  ghost.position.y = 0.42; ghost.renderOrder = 10; ghost.castShadow = false; ghost.raycast = () => {}; g.add(ghost);
  return { group: g, body, paint, trim, rust, dome, wheels: [], hit: 0, tilt: 0, mats: [paint, trim, rust, tire, resin] };
}

function lerpPose(a, b, k) {
  let d = b.yaw - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + d * k, pitch: a.pitch + (b.pitch - a.pitch) * k };
}
function placePose(car, q, lift = 0, spin = 0, yOverride) {
  const v = car.view;
  v.group.position.set(q.x, (yOverride !== undefined ? yOverride : q.y) + lift, q.z);
  v.group.rotation.order = 'YZX';
  v.group.rotation.set(0, q.yaw + spin, yOverride !== undefined ? 0 : q.pitch);
}
function placeCar(car, t, lane, lift = 0, spin = 0, yOverride) { placePose(car, poseAt(t, lane), lift, spin, yOverride); }
function wreckCar(car) {
  const v = car.view; car.wreck = true;
  v.orig = v.mats.map(m => m.color.getHex());
  for (const m of v.mats) { m.color.multiplyScalar(0.28); m.emissive && m.emissive.set(0x000000); }
  v.dome.visible = false; v.body.rotation.z = 0.22; v.body.rotation.x = 0.1; v.body.position.y = 0.02;
  FX.wrecks.push(car);
}
function reviveCar(car) {
  const v = car.view; car.wreck = false;
  if (v.orig) v.mats.forEach((m, i) => m.color.setHex(v.orig[i]));
  v.body.rotation.set(0, 0, 0); v.body.position.y = 0.075;
  const i = FX.wrecks.indexOf(car); if (i >= 0) FX.wrecks.splice(i, 1);
}

/* ---------- particles ---------- */
const sphereG = new THREE.SphereGeometry(1, 6, 5);
function part(x, y, z, vx, vy, vz, size, color, life, o = {}) {
  const m = new THREE.Mesh(sphereG, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o.op || 1, depthWrite: false }));
  m.position.set(x, y, z); m.scale.setScalar(size); W.root.add(m);
  FX.parts.push({ m, floor: y > 0.3 ? y - 0.2 : 0.02, vx, vy, vz, g: o.g === undefined ? -6 : o.g, life, max: life, grow: o.grow || 0, size, op: o.op || 1 });
}
FX.burst = (x, z, color = 0xffa030, n = 14, sp = 2.4, y = 0) => {
  for (let i = 0; i < n; i++) { const a = rr(0, 6.28), s = rr(0.4, 1) * sp; part(x, y + 0.2, z, Math.cos(a) * s, rr(1.2, 3), Math.sin(a) * s, rr(0.02, 0.05), color, rr(0.35, 0.8)); }
  part(x, y + 0.25, z, 0, 0, 0, 0.12, 0xfff0b0, 0.25, { grow: 5, g: 0, op: 0.9 });
};
FX.smoke = (x, y, z, c = 0x2a2a2a) => part(x + rr(-0.05, 0.05), y, z + rr(-0.05, 0.05), rr(-0.1, 0.1), rr(0.4, 0.8), rr(-0.1, 0.1), rr(0.05, 0.09), c, rr(0.8, 1.4), { g: 0, grow: 0.7, op: 0.55 });
FX.sparks = (x, z, y = 0) => FX.burst(x, z, 0xffe080, 8, 1.8, y);
FX.shakeBy = a => { FX.shake = Math.max(FX.shake, a); };
FX.text = (x, z, str, cls = '', y = 0) => {
  const p = W.project(x, y + 0.7, z), d = document.createElement('div');
  d.className = 'float ' + cls; d.textContent = str; d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  document.getElementById('stage').appendChild(d); setTimeout(() => d.remove(), 1400 / SPEED);
};
W.frameFns.push((dt) => {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const q = FX.parts[i]; q.life -= dt;
    if (q.life <= 0) { W.root.remove(q.m); q.m.material.dispose(); FX.parts.splice(i, 1); continue; }
    q.vy += q.g * dt; q.m.position.x += q.vx * dt; q.m.position.y = Math.max(q.floor || 0.02, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt;
    const k = q.life / q.max; q.m.material.opacity = q.op * k; q.m.scale.setScalar(q.size * (1 + q.grow * (1 - k)));
  }
  for (const c of FX.wrecks) if (Math.random() < dt * 5) { const p = c.view.group.position; FX.smoke(p.x, p.y + 0.3, p.z); }
  FX.shake *= Math.pow(0.002, dt);
  W.root.position.set(rr(-1, 1) * FX.shake, 0, rr(-1, 1) * FX.shake);
  for (const c of (W.cars || [])) {
    const v = c.view; if (!v) continue;
    v.hit = Math.max(0, v.hit - dt * 2.5); v.paint.emissive.setRGB(v.hit, v.hit * 0.15, 0);
  }
});

/* ---------- map tokens ---------- */
function makeToken(type, p, lane) {
  const g = new THREE.Group(), q = poseAt(p, lane);
  if (type === 'mine') {
    cyl(0.2, 0.06, mat(0x2b2b30, { metalness: 0.6 }), 0, 0.04, 0, g, false, 16);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat(0x555555)); const a = i / 6 * 6.28; s.position.set(Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17); g.add(s); }
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); l.position.y = 0.1; g.add(l); g.userData.blink = l;
  } else if (type !== 'oil') {
    const inner = new THREE.Group(); g.add(inner); g.userData.spin = inner;
    if (type === 'cash') {
      const gold = mat(0xe8b830, { metalness: 0.85, roughness: 0.3 });
      for (let i = 0; i < 3; i++) { const c = cyl(0.16, 0.05, gold, (i - 1) * 0.06, 0.05 + i * 0.055, 0, inner, false, 16); c.rotation.z = (i - 1) * 0.08; }
      const bill = box(0.34, 0.02, 0.2, mat(0x3f8f4a), 0, 0.22, 0, inner); bill.rotation.y = 0.5;
    } else if (type === 'repair') {
      box(0.32, 0.24, 0.32, mat(0xe8e2d0), 0, 0.14, 0, inner);
      const red = mat(0xc4302a, { emissive: 0x601010, emissiveIntensity: 0.6 });
      box(0.06, 0.25, 0.2, red, 0, 0.15, 0.06, inner); box(0.2, 0.25, 0.06, red, 0, 0.15, 0.06, inner);
      box(0.06, 0.2, 0.25, red, 0, 0.15, 0.03, inner).rotation.y = Math.PI / 2;
    } else if (type === 'nitro') {
      cyl(0.1, 0.36, mat(0x2a6fd0, { metalness: 0.6, roughness: 0.3, emissive: 0x103070, emissiveIntensity: 0.6 }), 0, 0.22, 0, inner, false, 14);
      cyl(0.05, 0.08, mat(0xcccccc, { metalness: 0.8 }), 0, 0.44, 0, inner, false, 10);
    } else {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5ab4ff, emissive: 0x2a7fd0, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }));
      orb.position.y = 0.24; inner.add(orb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 24), mat(0xbfe4ff, { emissive: 0x5ab4ff, emissiveIntensity: 0.8 }));
      ring.position.y = 0.24; ring.rotation.x = 1.2; inner.add(ring);
    }
  } else {
    const o = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), mat(0x050508, { roughness: 0.08, metalness: 0.9 }));
    o.rotation.x = -Math.PI / 2; o.position.y = 0.014; g.add(o);
    const o2 = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), mat(0x2a2848, { roughness: 0.05, metalness: 1 })); o2.rotation.x = -Math.PI / 2; o2.position.set(0.12, 0.016, -0.05); g.add(o2);
  }
  const gc = type === 'mine' ? 0xff3a2a : type === 'oil' ? 0x9a7aff : 0xffd060;
  const ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 20), new THREE.MeshBasicMaterial({ color: gc, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth }));
  ghost.position.y = 0.25; ghost.renderOrder = 10; ghost.raycast = () => {}; g.add(ghost);
  g.traverse(o => { if (o.isMesh && o !== ghost) o.castShadow = true; });
  g.position.set(q.x, q.y + 0.04, q.z); W.root.add(g); g.userData.type = type; g.userData.baseY = q.y + 0.04;
  return g;
}
W.frameFns.push(() => { for (const t of (W.tokens || [])) { if (t.userData.blink) t.userData.blink.visible = Math.sin(W.time * 8) > -0.2; if (t.userData.spin) { t.userData.spin.rotation.y = W.time * 2; t.userData.spin.position.y = 0.06 + Math.sin(W.time * 3 + t.id) * 0.05; } } });

/* ---------- dice ---------- */
const dieFaces = DIE_FACES.map(v => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a89a78'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  g.fillStyle = v < 0 ? '#a5301f' : '#1d1a16'; g.font = 'bold 78px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(v > 0 ? '+' + v : String(v), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 });
});
const UP_FOR_FACE = [  // quaternion that brings material index i (+x,-x,+y,-y,+z,-z) to the top
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  new THREE.Quaternion(),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
];
async function rollDie(x, z, y0 = 0) {
  const idx = Math.floor(Math.random() * 6), val = DIE_FACES[idx];
  const order = [0, 1, 2, 3, 4, 5];  // material index i shows DIE_FACES[i]
  const die = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), dieFaces);
  die.castShadow = true; W.root.add(die);
  const axis = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), turns = 5 + rr(0, 2) * Math.PI;
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(rr(0, 4)) * Math.PI / 2 + rr(-0.3, 0.3));
  const fin = yaw.clone().multiply(UP_FOR_FACE[idx]), q = new THREE.Quaternion();
  await anim(900, t => {
    const e = 1 - Math.pow(1 - t, 2.2), h = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 0.9;
    die.position.set(x + (1 - e) * 0.6, y0 + 0.18 + h, z - (1 - e) * 0.5);
    q.setFromAxisAngle(axis, (1 - e) * turns); die.quaternion.copy(q).multiply(fin);
  });
  die.quaternion.copy(fin); die.position.set(x, y0 + 0.17, z);
  W.dieHold = die;
  return { val, die };
}
function dropDie(die) { W.root.remove(die); }

/* ---------- weapons ---------- */
async function fireMissile(from, to, fizzle) {
  // `to` is a point, or a function returning the target's current point (the missile chases a car that keeps moving)
  const T = typeof to === 'function' ? to : () => to;
  const m = new THREE.Group();
  const body = cyl(0.04, 0.26, mat(0xdddddd, { metalness: 0.5 }), 0, 0, 0, m, false, 8);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), mat(0xd22d1a)); nose.position.y = 0.18; m.add(nose);
  const fl = new THREE.Mesh(sphereG, new THREE.MeshBasicMaterial({ color: 0xffb040 })); fl.scale.setScalar(0.05); fl.position.y = -0.15; m.add(fl);
  W.root.add(m); const up = new THREE.Vector3(0, 1, 0), prev = new THREE.Vector3(from.x, 0.5 + (from.y || 0), from.z);
  let tick = 0, last = T();
  await anim(500, t => {
    last = T();
    const e = ease(t), x = from.x + (last.x - from.x) * e, z = from.z + (last.z - from.z) * e, y = 0.45 + (from.y || 0) + ((last.y || 0) - (from.y || 0)) * e + Math.sin(e * Math.PI) * (fizzle ? 0.5 : 0.9) - (fizzle ? e * e * 0.4 : 0);
    const pos = new THREE.Vector3(x, y, z), d = pos.clone().sub(prev); if (d.lengthSq() > 1e-6) m.quaternion.setFromUnitVectors(up, d.normalize());
    m.position.copy(pos); prev.copy(pos);
    if (++tick % 2 === 0) FX.smoke(x, y, z, 0xb8b0a8);
  });
  W.root.remove(m);
  if (fizzle) { FX.burst(last.x, last.z, 0xa09080, 12, 1.4, (last.y || 0) + 0.2); FX.burst(last.x, last.z, 0xff9a40, 6, 1, (last.y || 0) + 0.2); }
}
async function fireGatling(from, to) {
  const flash = new THREE.Mesh(sphereG, new THREE.MeshBasicMaterial({ color: 0xffe080 })); flash.scale.setScalar(0.1); flash.position.set(from.x, 0.45 + (from.y || 0), from.z); W.root.add(flash);
  const tr = []; for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(sphereG, new THREE.MeshBasicMaterial({ color: 0xfff0a0 })); t.scale.set(0.05, 0.03, 0.03); W.root.add(t); tr.push(t); }
  await anim(300, t => {
    flash.visible = Math.sin(t * 60) > 0;
    tr.forEach((s, i) => { const k = Math.min(1, Math.max(0, t * 1.5 - i * 0.09)); s.visible = k > 0 && k < 1; s.position.set(from.x + (to.x - from.x) * k, 0.45 + (from.y || 0) + ((to.y || 0) - (from.y || 0)) * k, from.z + (to.z - from.z) * k); });
  });
  W.root.remove(flash); tr.forEach(s => W.root.remove(s));
}

/* Compile every weapon, pickup and dice material once at startup. Without this the first missile, mine or die of a
   session makes the browser stop to build its shader, which shows up as a hitch right when a weapon fires. */
W.warmUp = () => {
  const g = new THREE.Group(); g.scale.setScalar(0.0001); g.position.set(0, 0.5, 0); W.root.add(g);
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), mat(0xdddddd, { metalness: 0.5 })); add(new THREE.ConeGeometry(0.04, 0.1, 8), mat(0xd22d1a));
  for (const col of [0xffb040, 0xffe080, 0xfff0a0, 0xff8a30, 0xa09080, 0x555555]) add(sphereG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
  add(new THREE.BoxGeometry(0.3, 0.3, 0.3), dieFaces);
  const toks = ['mine', 'oil', 'cash', 'repair', 'nitro', 'shieldp'].map(t => makeToken(t, 1, 1)); toks.forEach(k => { k.scale.setScalar(0.0001); k.traverse(o => { o.frustumCulled = false; }); });
  setTimeout(() => { W.root.remove(g); toks.forEach(k => W.root.remove(k)); }, 700);
};
