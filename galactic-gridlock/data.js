/* Galactic Gridlock prototype: static data (track, lanes, cars, cards)
   Positions: every car sits on a lane tile. Each lane is cut into its own tiles of roughly equal
   physical length, so the inside of a turn has fewer tiles than the outside. "u" is distance along
   the centerline in reference units (N per lap); it ranks cars and lines lanes up for lane changes. */
const N = 46;            // centerline reference units per lap
const LANES = 3;
const LAPS = 3;
const PRIZES = [500, 300, 150, 0];     // finishing place 1st to 4th
const DRAFT = [5, 10, 16];             // tiles behind the leader that earn +1, +2, +3 move
// Figure-8 (lemniscate of Gerono): x = a cos t, z = b sin 2t. Travel starts at t0 on the near-right side.
const TRK = { a: 9.0, b: 5.0, t0: 0.55, W: 1.05, H: 1.15 };
const BOARD = { w: 22, d: 14 };
const MAT = { w: 11, d: 5.2 };
const mod = (a, n) => ((a % n) + n) % n;

(function samplePath() {
  const M = 3000, xs = [], zs = [], ss = [];
  let L = 0, px = 0, pz = 0;
  for (let i = 0; i <= M; i++) {
    const t = TRK.t0 + 2 * Math.PI * i / M, x = TRK.a * Math.cos(t), z = TRK.b * Math.sin(2 * t);
    if (i) L += Math.hypot(x - px, z - pz);
    xs.push(x); zs.push(z); ss.push(L); px = x; pz = z;
  }
  Object.assign(TRK, { xs, zs, ss, P: L, M });
})();

/* Point on the centerline at arc length s: position, unit tangent, right-hand normal */
function pathPoint(s) {
  const { P, xs, zs, ss } = TRK;
  s = mod(s, P);
  let lo = 0, hi = ss.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] <= s) lo = m; else hi = m; }
  const f = (s - ss[lo]) / ((ss[hi] - ss[lo]) || 1);
  const x = xs[lo] + (xs[hi] - xs[lo]) * f, z = zs[lo] + (zs[hi] - zs[lo]) * f;
  const a = Math.max(0, lo - 3), b = Math.min(ss.length - 1, hi + 3);
  let tx = xs[b] - xs[a], tz = zs[b] - zs[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  return { x, z, tx, tz, nx: -tz, nz: tx };
}

/* ---------- elevation: an overpass (u 3-13) and a jump ramp (u 35-36) ---------- */
const BRIDGE = { up0: 3, up1: 6, dn0: 10, dn1: 13 };
const JUMP = { ramp: 35, gap: 36, land: 38, lift: 0.42 };
const smooth = t => t * t * (3 - 2 * t);
function elevAt(u) {
  u = mod(u, N);
  const B = BRIDGE;
  if (u >= JUMP.ramp && u <= JUMP.gap) return JUMP.lift * (u - JUMP.ramp);
  if (u < B.up0 || u > B.dn1) return 0;
  if (u < B.up1) return TRK.H * smooth((u - B.up0) / (B.up1 - B.up0));
  if (u <= B.dn0) return TRK.H;
  return TRK.H * smooth(1 - (u - B.dn0) / (B.dn1 - B.dn0));
}
/* Point on a lane edge: u along the track, off across it (world units) */
function edgePoint(u, off, yOverride) {
  const q = pathPoint(u * TRK.P / N);
  return [q.x + q.nx * off, yOverride !== undefined ? yOverride : elevAt(u), q.z + q.nz * off];
}

/* ---------- lane tiles ---------- */
// Features line up across lanes at these anchors; between anchors each lane gets its own tile count.
const ANCHORS = [0, 3, 6, 10, 13, 35, 36, 38, N];
const FORCE = { 35: 1, 36: 2 };            // one ramp tile, two chasm tiles in every lane
const TILE_LEN = 1.26;
const LT = [];
for (let l = 0; l < LANES; l++) {
  const off = (l - 1) * TRK.W, b = [0];
  for (let a = 0; a < ANCHORS.length - 1; a++) {
    const u0 = ANCHORS[a], u1 = ANCHORS[a + 1], S = 160, cum = [0];
    let prev = edgePoint(u0, off, 0);
    for (let i = 1; i <= S; i++) { const p = edgePoint(u0 + (u1 - u0) * i / S, off, 0); cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[2] - prev[2])); prev = p; }
    const k = FORCE[u0] || Math.max(1, Math.round(cum[S] / TILE_LEN));
    for (let j = 1; j < k; j++) {
      const target = cum[S] * j / k; let i = 1; while (cum[i] < target) i++;
      const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1]);
      b.push(u0 + (u1 - u0) * (i - 1 + f) / S);
    }
    b.push(u1);
  }
  const n = b.length - 1, c = [];
  for (let i = 0; i < n; i++) c.push((b[i] + b[i + 1]) / 2);
  LT.push({ b, c, n });
}
const laneN = l => LT[l].n;
const tileI = (l, t) => mod(t, LT[l].n);
/* absolute centerline progress of lane tile t (t counts tiles from the start line, laps included) */
const uOf = (l, t) => Math.floor(t / LT[l].n) * N + LT[l].c[tileI(l, t)];
/* the lane-l tile that contains absolute progress u */
function tAt(l, u) {
  const lap = Math.floor(u / N), r = u - lap * N, b = LT[l].b;
  let i = 0; while (i < LT[l].n - 1 && b[i + 1] <= r) i++;
  return lap * LT[l].n + i;
}
/* where a car stepping forward one tile while changing to lane l2 ends up */
const diagT = (l, t, l2) => tAt(l2, uOf(l, t + 1));
/* World pose at a (fractional) tile position in a lane */
function poseAt(tf, lane) {
  const t0 = Math.floor(tf), f = tf - t0, u0 = uOf(lane, t0), u1 = uOf(lane, t0 + 1), u = u0 + (u1 - u0) * f;
  const q = pathPoint(u * TRK.P / N), o = (lane - 1) * TRK.W;
  const du = 0.06, dy = (elevAt(u + du) - elevAt(u - du)) / (2 * du * TRK.P / N);
  return { x: q.x + q.nx * o, y: elevAt(u), z: q.z + q.nz * o, yaw: Math.atan2(-q.tz, q.tx), pitch: Math.atan(dy), tx: q.tx, tz: q.tz, u };
}
const progress = c => uOf(c.lane, c.t);

/* ---------- terrain ---------- */
function featureAt(u) {
  u = mod(u, N); const B = BRIDGE;
  if (u >= JUMP.ramp && u < JUMP.gap) return 'ramp';
  if (u >= JUMP.gap && u < JUMP.land) return 'gap';
  if (u >= B.up0 && u < B.up1) return 'uphill';
  if (u >= B.up1 && u < B.dn0) return 'bridge';
  if (u >= B.dn0 && u < B.dn1) return 'downhill';
  return null;
}
// lava starts sparse and spreads as the volcanoes erupt during the race; given as [u, lane]
const LAVA_START_U = [[16.5, 0], [22.5, 2], [27.5, 1], [41.5, 0]];
const SCRAP_U = [[18.5, 1], [19.6, 1], [24.5, 0], [25.6, 0], [39.5, 2], [40.6, 2]];
const keyOf = (l, t) => l + ':' + tileI(l, t);
const LAVA = new Set();
const SCRAP = new Set(SCRAP_U.map(([u, l]) => keyOf(l, tAt(l, u))));
const lavaStartKeys = () => LAVA_START_U.map(([u, l]) => keyOf(l, tAt(l, u)));
// no hazards in the run-up to the line or the first tiles after it
const safeZone = (l, t) => { const u = LT[l].c[tileI(l, t)]; return u <= 4.5 || u >= N - 4; };
function tileKind(l, t) {
  const f = featureAt(LT[l].c[tileI(l, t)]); if (f) return f;
  const k = keyOf(l, t);
  return LAVA.has(k) ? 'lava' : SCRAP.has(k) ? 'scrap' : 'asphalt';
}
const SURFACE = { lava: 'lava', gap: 'lava', scrap: 'scrap' };
const terrainAt = (l, t) => SURFACE[tileKind(l, t)] || 'asphalt';
const SLOPE = { uphill: -1, downhill: 1 };
const slopeAt = (l, t) => SLOPE[tileKind(l, t)] || 0;

const TILE_INFO = {
  asphalt:  { name: 'Asphalt',      text: ['Racing Slicks +1 move, Tank Treads \u22121 when a move starts here.'] },
  lava:     { name: 'Lava Flow',    text: ['Driving in costs 1 extra move.', 'End a move here: take 3 damage.', 'Hover Pods ignore both.'] },
  scrap:    { name: 'Scrap Field',  text: ['Spiked Tires +1 move, Racing Slicks \u22121 when a move starts here.'] },
  uphill:   { name: 'Incline',      text: ['Climbing: \u22121 move when a move starts here.'] },
  downhill: { name: 'Decline',      text: ['Downhill run: +1 move when a move starts here.'] },
  bridge:   { name: 'Overpass',     text: ['Plain asphalt, high above the crossing below.'] },
  ramp:     { name: 'Jump Ramp',    text: ['Flying the chasm costs 2 moves for 3 tiles: a free tile.', 'With only 1 move left you fall short into the lava.', 'A car on the landing stops you here.'] },
  gap:      { name: 'Lava Chasm',   text: ['Jump it from the ramp.', 'Fall short and you land in lava: 3 damage, and driving out costs extra.'] },
  mine:     { name: 'Mine',         text: ['3 damage to the first car that drives over it (armor reduces it).', 'Hover Pods glide over.'] },
  oil:      { name: 'Oil Slick',    text: ['Driving over it spins you one lane over and ends your move.', 'Tank Treads grip through it.'] },
  cash:     { name: 'Cash Stack',   text: ['Drive over it to grab the money. Spend it on upgrades between races.'] },
  repair:   { name: '+Health',      text: ['Drive over it to restore 3 hull.'] },
  nitro:    { name: 'Nitro',        text: ['Drive over it: +2 move on your next turn.'] },
  shieldp:  { name: 'Shield Orb',   text: ['Drive over it: a shield that blocks the next hit, however long it takes.'] }
};

/* ---------- Cars ---------- */
const GEAR = {
  slicks:  { label: 'Racing Slicks',  mods: { asphalt: 1, scrap: -1, lava: 0 }, note: '+1 on asphalt, \u22121 on scrap' },
  spiked:  { label: 'Spiked Tires',   mods: { asphalt: 0, scrap: 1, lava: 0 },  note: '+1 on scrap, +1 ram damage' },
  treads:  { label: 'Tank Treads',    mods: { asphalt: -1, scrap: 0, lava: 0 }, note: 'Grips through oil slicks' },
  hover:   { label: 'Hover Pods',     mods: { asphalt: 0, scrap: 0, lava: 1 },  note: 'Immune to lava and mines' }
};
// bs = Base Speed, added to every move; start = [tiles before the line (negative), lane]
const CAR_SPECS = [
  { id: 0, name: 'Ember',        gear: 'slicks', tier: 1, human: true,  bs: 4, hp: 9,  armor: 0, mass: 1, color: 0xd9722b, trim: 0x3a3a3f, start: [-2, 1] },
  { id: 1, name: 'Gravel Ghost', gear: 'treads', tier: 3, human: false, bs: 3, hp: 14, armor: 1, mass: 3, color: 0x6b7a4a, trim: 0x2d3326, start: [-1, 0] },
  { id: 2, name: 'Spike',        gear: 'spiked', tier: 2, human: false, bs: 3, hp: 12, armor: 1, mass: 2, color: 0x8f3b32, trim: 0x2a2a2a, start: [-1, 2] },
  { id: 3, name: 'Scorch',       gear: 'hover',  tier: 2, human: false, bs: 4, hp: 10, armor: 0, mass: 1, color: 0x4d7ea8, trim: 0x22262e, start: [-1, 1] }
];

/* ---------- Cards ---------- */
// move = tiles of movement, lane = lane shift (-1 left, +1 right, from the driver's seat), made halfway through the move
const CARDS = {
  cruise:  { name: 'Cruise',    move: 2, text: 'Steady drive.',              c1: '#3f8f5a', c2: '#9bd36a' },
  sprint:  { name: 'Sprint',    move: 3, text: 'Hard on the throttle.',      c1: '#3f8f5a', c2: '#d4e26a' },
  boost:   { name: 'Boost',     move: 5, text: 'Take 1 damage.',             c1: '#d99a1e', c2: '#ffd95a' },
  swerveL: { name: 'Swerve L',  move: 1, lane: -1, text: 'Cut one lane left halfway through your move.',  c1: '#2f7f9c', c2: '#7fd0e0' },
  swerveR: { name: 'Swerve R',  move: 1, lane: 1,  text: 'Cut one lane right halfway through your move.', c1: '#2f7f9c', c2: '#7fd0e0' },
  missile: { name: 'Missile',   move: 1, text: 'Fires mid-move. Homes on a car up to 5 ahead: 3 dmg.', c1: '#c4412a', c2: '#ff9a4a' },
  gatling: { name: 'Gatling',   move: 2, text: 'Fires mid-move, straight ahead. 2 dmg.', c1: '#a8552a', c2: '#e6b25a' },
  mine:    { name: 'Mine',      move: 2, text: 'Drop it mid-move. 3 dmg.',   c1: '#6a3a3a', c2: '#c46a4a' },
  oil:     { name: 'Oil Slick', move: 2, text: 'Drop it mid-move. Spin-out.', c1: '#2a2a33', c2: '#6a6a88' },
  ram:     { name: 'Ram',       move: 3, text: '+2 damage when you rear-end a car.', c1: '#b8501f', c2: '#f0a040' },
  shield:  { name: 'Shield Up', move: 1, text: 'Block the next hit.',        c1: '#2a5fb0', c2: '#6ab8ff' }
};
const DECK_LIST = { cruise: 4, sprint: 3, boost: 2, swerveL: 2, swerveR: 2, missile: 2, gatling: 2, mine: 2, oil: 1, ram: 2, shield: 2 };
const DIE_FACES = [-1, 0, 0, 1, 1, 2];
const PHASES = ['Pick', 'Reveal', 'Race'];
