/* Galactic Gridlock prototype: rules engine. Three laps. Every turn each driver plays one card;
   all cards flip together, then every car moves at the same time. Swerves, weapons and traps
   happen halfway through each car's move. */
const G = { cars: [], tokens: [], turn: 0, over: false, running: false, pick: -1, pickResolve: null, gen: 0, leader: null, lapSeen: 1, lavaCap: 24, placed: 0 };
W.tokens = G.tokens;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
const me = () => G.cars.find(c => c.human);
const wpos = car => poseAt(car.t, car.lane);
const active = () => G.cars.filter(c => !c.down && !c.done);
const finished = c => c.t >= LAPS * laneN(c.lane);
const aheadU = (a, b) => mod(progress(b) - progress(a), N);        // how far b is in front of a, along the track
const occupant = (l, t, self) => active().find(o => o !== self && o.lane === l && tileI(l, o.t) === tileI(l, t));
const lapOf = c => Math.min(LAPS, Math.floor(Math.max(0, progress(c)) / N) + 1);
const txt = (car, s, cls) => { const q = wpos(car); FX.text(q.x, q.z, s, cls, q.y); };
const PICKUPS = ['cash', 'repair', 'nitro', 'shieldp'];
const WEAPONS = ['missile', 'gatling', 'mine', 'oil'];

/* ---------- setup ---------- */
function drawTo5(car) {
  while (car.hand.length < 5) {
    if (!car.deck.length) { car.deck = shuffle(car.discard); car.discard = []; }
    if (!car.deck.length) break;
    car.hand.push(car.deck.pop());
  }
}
function refresh() { setStats(me()); renderRace(G.cars, G.turn); G.cars.forEach(updateLabel); }
function setupGame() {
  for (const c of G.cars) { W.root.remove(c.view.group); c.label && c.label.remove(); }
  for (const t of G.tokens) W.root.remove(t);
  G.tokens.length = 0; FX.wrecks.length = 0; G.turn = 0; G.over = false; G.gen++; G.leader = null; G.lapSeen = 1; G.placed = 0;
  LAVA.clear(); lavaStartKeys().forEach(k => LAVA.add(k));
  W.tiles.forEach(m => W.setTile(m, tileKind(m.userData.lane, m.userData.s)));
  Mat.reset();
  G.cars = CAR_SPECS.map(spec => {
    const car = Object.assign({}, spec, { t: spec.start[0], lane: spec.start[1], hpMax: spec.hp, down: false, shield: false, shieldCard: false, nitro: 0, cash: 0, hand: [], discard: [], deck: [], card: null, lead: 0 });
    for (const [id, n] of Object.entries(DECK_LIST)) for (let i = 0; i < n; i++) car.deck.push(id);
    shuffle(car.deck); drawTo5(car);
    car.view = buildCar(spec); W.root.add(car.view.group); placeCar(car, car.t, car.lane);
    makeLabel(car); return car;
  });
  W.cars = G.cars;
  if (!Mat.group) buildMat(me());
  Mat.hullPegs.forEach(p => { p.visible = true; });
  refresh(); setPhaseUI(-1); renderPicks(G.cars, 'pick'); $('lock').disabled = true;
  hint('Hover or tap any tile to see what it does.');
}

/* ---------- damage, wrecks, respawns ---------- */
async function hurt(car, amt, { mit = true, src = '' } = {}) {
  if (car.down || car.done || amt <= 0) return 0;
  const dmg = Math.max(0, amt - (mit ? car.armor : 0));
  if (car.shield) {
    car.shield = false; car.shieldCard = false; car.view.dome.visible = false; txt(car, 'Blocked', 'blk');
    logLine(`${car.name} blocks ${src || 'damage'} with the shield.`); return 0;
  }
  if (dmg === 0) { txt(car, 'Armor', 'arm'); logLine(`${car.name}'s armor absorbs ${src || 'the hit'}.`); return 0; }
  const before = car.hp;
  car.hp = Math.max(0, car.hp - dmg); car.view.hit = 1;
  txt(car, '\u2212' + dmg, 'dmg'); logLine(`${car.name} takes ${dmg} from ${src || 'damage'} (${car.hp}/${car.hpMax}).`);
  refresh();
  if (car.hp <= 0) { await destroy(car); return dmg; }
  const lowLine = car.hpMax * 0.35;
  if (dmg >= 3 || (before > lowLine && car.hp <= lowLine)) Announcer.event('bigHit', car.name);
  return dmg;
}
async function destroy(car) {
  car.down = true; car.respawnTurn = G.turn + 1; const q = wpos(car);
  FX.burst(q.x, q.z, 0xff7a20, 30, 3.4, q.y); FX.burst(q.x, q.z, 0x555555, 14, 2, q.y); FX.shakeBy(0.12);
  car.shield = false; car.view.dome.visible = false;
  wreckCar(car); logLine(`${car.name} is wrecked and loses a turn.`); say(`${car.name} is wrecked!`);
  Announcer.event('wreck', car.name);
  refresh(); renderPicks(G.cars, G.phase === 0 ? 'pick' : 'reveal');
  await sleep(450);
}
async function respawns() {
  const back = G.cars.filter(c => c.down && c.respawnTurn <= G.turn);
  for (const c of back) {
    const u = progress(c), spots = [[c.lane, c.t]];
    for (const l of [0, 1, 2]) spots.push([l, tAt(l, u)]);
    for (const l of [c.lane, 0, 1, 2]) spots.push([l, tAt(l, u) - 1]);
    const [l, t] = spots.find(([l, t]) => !occupant(l, t, c) && tileKind(l, t) !== 'gap') || [c.lane, c.t];
    c.lane = l; c.t = t; c.down = false; c.hp = c.hpMax; reviveCar(c);
    await anim(450, k => placeCar(c, c.t, c.lane, (1 - ease(k)) * 1.4, (1 - k) * 6));
    placeCar(c, c.t, c.lane);
    const q = wpos(c); FX.burst(q.x, q.z, 0x7fdcff, 18, 2.2, q.y);
    logLine(`${c.name} is rebuilt and back on the track.`); Announcer.event('respawn', c.name);
  }
  if (back.length) refresh();
}

/* ---------- tokens: hazards and pickups ---------- */
const tokenAt = (l, t) => G.tokens.find(k => k.userData.lane === l && k.userData.s === tileI(l, t));
function dropToken(type, l, t, extra = {}) {
  if (tokenAt(l, t) || ['gap', 'ramp'].includes(tileKind(l, t))) return null;
  const k = makeToken(type, t, l); Object.assign(k.userData, { s: tileI(l, t), lane: l }, extra); G.tokens.push(k); return k;
}
function removeToken(k) { W.root.remove(k); const i = G.tokens.indexOf(k); if (i >= 0) G.tokens.splice(i, 1); }
async function spinOut(car) {
  const u = progress(car), opts = [car.lane - 1, car.lane + 1].filter(l => l >= 0 && l < LANES && !occupant(l, tAt(l, u), car));
  const from = wpos(car);
  if (!opts.length) { await anim(650, k => placePose(car, from, 0.04, k * Math.PI * 4)); placeCar(car, car.t, car.lane); return; }
  const l2 = opts[Math.floor(Math.random() * opts.length)], t2 = tAt(l2, u), to = poseAt(t2, l2);
  await anim(650, k => placePose(car, lerpPose(from, to, ease(k)), 0.04, k * Math.PI * 4));
  car.lane = l2; car.t = t2; placeCar(car, car.t, car.lane);
}
function collect(car, k) {
  const type = k.userData.type, q = wpos(car);
  removeToken(k); FX.burst(q.x, q.z, type === 'cash' ? 0xffd040 : 0x7fdcff, 12, 1.8, q.y);
  if (type === 'cash') { car.cash += k.userData.amount; txt(car, '+$' + k.userData.amount, 'cash'); logLine(`${car.name} grabs $${k.userData.amount}.`); }
  if (type === 'repair') { const h = Math.min(3, car.hpMax - car.hp); car.hp += h; txt(car, '+' + h + ' health', 'heal'); logLine(`${car.name} grabs a +Health pack: ${h} hull restored.`); }
  if (type === 'nitro') { car.nitro = 2; txt(car, 'Nitro +2', 'info'); logLine(`${car.name} grabs nitro: +2 move next turn.`); }
  if (type === 'shieldp') { car.shield = true; car.shieldCard = false; car.view.dome.visible = true; txt(car, 'Shield', 'blk'); logLine(`${car.name} picks up a shield.`); }
  Announcer.event('pickup', car.name, 0.5);
  refresh(); renderPicks(G.cars, 'reveal');
}
/* Called each time a car enters a tile. Returns 'stop' if the car must end its move here. */
async function passTile(car) {
  const k = tokenAt(car.lane, car.t); if (!k || car.down) return null;
  const type = k.userData.type;
  if (PICKUPS.includes(type)) { collect(car, k); return null; }
  const q = wpos(car);
  if (type === 'mine') {
    if (car.gear === 'hover') { txt(car, 'Glides over', 'info'); return null; }
    removeToken(k); FX.burst(q.x, q.z, 0xff8a30, 22, 3, q.y); FX.shakeBy(0.1); say(`${car.name} drives over a mine!`);
    await hurt(car, 3, { src: 'a mine' }); return null;
  }
  removeToken(k);
  if (car.gear === 'treads') { txt(car, 'Grips', 'info'); logLine(`${car.name}'s treads grip through the oil.`); return null; }
  say(`${car.name} spins out on oil!`); logLine(`${car.name} spins out on oil.`);
  await spinOut(car); return 'stop';
}
async function lavaCheck(car) {
  if (car.down || terrainAt(car.lane, car.t) !== 'lava') return;
  if (car.gear === 'hover') { txt(car, 'Hovers', 'info'); return; }
  const q = wpos(car); FX.burst(q.x, q.z, 0xff9a30, 18, 2.6, q.y);
  await hurt(car, 3, { src: 'lava' });
}

/* ---------- the track changes: eruptions and pickups ---------- */
function freeTiles(filter) {
  return W.tiles.filter(m => { const { s, lane, kind, uc } = m.userData; return filter(s, lane, kind, uc) && !occupant(lane, s) && !tokenAt(lane, s); });
}
async function erupt(count) {
  const spots = shuffle(freeTiles((s, lane, kind, uc) => kind === 'asphalt' && !safeZone(lane, s) && (uc < BRIDGE.up0 - 1 || uc > BRIDGE.dn1 + 0.5) && (uc < JUMP.ramp - 1 || uc > JUMP.land + 0.5)
    && [0, 1, 2].filter(l => l !== lane && LAVA.has(keyOf(l, tAt(l, uc)))).length < 2));
  const picks = spots.slice(0, Math.min(count, G.lavaCap - LAVA.size));
  if (!picks.length) return;
  Announcer.event('lava', '', 0.7);
  say('A volcano erupts! The lava spreads.');
  await Promise.all(picks.map(async (m, i) => {
    await sleep(i * 160);
    const { s, lane } = m.userData, end = poseAt(s, lane);
    const v = W.volcanoes.reduce((a, b) => Math.hypot(a[0] - end.x, a[1] - end.z) < Math.hypot(b[0] - end.x, b[1] - end.z) ? a : b);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff5000, emissiveIntensity: 3 }));
    W.root.add(blob); let k = 0;
    FX.burst(v[0], v[1], 0xff8a30, 10, 1.6, 1.2 * v[2]);
    await anim(700, t => {
      blob.position.set(v[0] + (end.x - v[0]) * t, 1.2 * v[2] + (end.y - 1.2 * v[2]) * t + Math.sin(t * Math.PI) * 2.2, v[1] + (end.z - v[1]) * t);
      if (++k % 3 === 0) FX.smoke(blob.position.x, blob.position.y, blob.position.z, 0x3a2a20);
    });
    W.root.remove(blob);
    LAVA.add(keyOf(lane, s)); W.setTile(m, 'lava');
    FX.burst(end.x, end.z, 0xff9a30, 16, 2.4, end.y);
  }));
  FX.shakeBy(0.06);
  logLine(`The lava spreads to ${picks.length} more tile${picks.length > 1 ? 's' : ''}.`);
}
async function spawnPickups() {
  const n = 2 + Math.floor(Math.random() * 2);                       // 2-3 per wave; the first is always a +Health pack
  const racers = G.cars.filter(c => !c.done), last = racers.length ? Math.min(...racers.map(progress)) : 0;
  const ahead = uc => mod(uc - mod(last, N), N);
  const pool = freeTiles((s, lane, kind) => !['gap', 'ramp', 'lava'].includes(kind) && !safeZone(lane, s));
  // favour tiles 1 to 14 units in front of whoever is in last place, so pickups help the car that is behind
  const near = shuffle(pool.filter(m => { const a = ahead(m.userData.uc); return a >= 1 && a <= 14; })), far = shuffle(pool.filter(m => !near.includes(m)));
  const spots = [...near, ...far].slice(0, n);
  const jobs = spots.map((m, i) => {
    const type = i === 0 ? 'repair' : Math.random() < 0.5 ? 'cash' : ['nitro', 'shieldp'][Math.floor(Math.random() * 2)];
    const k = dropToken(type, m.userData.lane, m.userData.s, type === 'cash' ? { amount: [50, 100, 150][Math.floor(Math.random() * 3)] } : {});
    if (!k) return null;
    const by = k.userData.baseY;
    return sleep(i * 140).then(() => anim(500, e => { k.position.y = by + (1 - ease(e)) * 2; }));
  });
  await Promise.all(jobs);
  say(`${spots.length} pickups dropped on the track, including a +Health pack!`);
  logLine(`${spots.length} pickups appear on the track, including +Health.`);
}

/* ---------- picking ---------- */
function cpuPick(car) {
  const others = active().filter(o => o !== car), u = progress(car);
  const nearAhead = others.filter(o => aheadU(car, o) > 0.2 && aheadU(car, o) <= 5.5);
  const blocker = others.some(o => o.lane === car.lane && aheadU(car, o) > 0.2 && aheadU(car, o) <= 4.5);
  const behind = others.some(o => aheadU(o, car) > 0.2 && aheadU(o, car) <= 4.5);
  const lavaIn = l => car.gear !== 'hover' && [1.5, 2.5, 3.5, 4.5, 5.5].some(k => terrainAt(l, tAt(l, u + k)) === 'lava');
  const prizeIn = l => [1, 2, 3, 4, 5].some(k => { const t = tokenAt(l, tAt(l, u + k)); return t && PICKUPS.includes(t.userData.type); });
  const tilesTo = l => tAt(l, u + 10) - tAt(l, u);                    // shorter inside line = fewer tiles
  const scored = car.hand.map((id, i) => {
    const c = CARDS[id]; let s = c.move * 1.1 + Math.random() * 1.4;
    if (id === 'boost') s -= car.hp <= 3 ? 4 : 0.6;
    if (id === 'ram') s += blocker ? 2 : 0;
    if (id === 'missile') s += nearAhead.length ? 3.2 : -2;
    if (id === 'gatling') s += blocker ? 3 : -1;
    if (id === 'mine' || id === 'oil') s += behind ? 1.8 : -0.5;
    if (id === 'shield') s += others.filter(o => Math.min(aheadU(car, o), aheadU(o, car)) < 5).length >= 2 && !car.shield ? 1.6 : -1;
    if (c.lane) {
      const to = car.lane + c.lane;
      s += (to < 0 || to >= LANES) ? -5 : (lavaIn(car.lane) && !lavaIn(to) ? 3.5 : 0) - (lavaIn(to) ? 3 : 0) + (blocker ? 1.5 : 0)
        + (prizeIn(to) && !prizeIn(car.lane) ? 2 : 0) + (tilesTo(car.lane) - tilesTo(to)) * 0.7;
    }
    return { i, s };
  }).sort((a, b) => b.s - a.s);
  return car.hand.splice(scored[0].i, 1)[0];
}
function humanPick() {
  if (me().down) { say('Your crew is rebuilding the car. You sit this turn out.'); hint('Rebuilding. Back next turn.'); return sleep(900); }
  return new Promise(res => {
    G.pick = -1; G.pickResolve = res; Mat.selectable = true; $('lock').disabled = true;
    hint('Tap a card in your rack, then <b>Lock In</b>. Hover a card to read it.');
  });
}
Mat.onTap = i => {
  if (!Mat.selectable) return;
  G.pick = G.pick === i ? -1 : i; Mat.select(G.pick);
  if (G.pick >= 0) { const c = CARDS[me().hand[i]]; hint(`<b>${c.name}</b> Move ${c.move} + Base ${me().bs}. ${c.text}`); }
  else hint('Tap a card in your rack, then <b>Lock In</b>.');
  $('lock').disabled = G.pick < 0;
};
async function lockIn() {
  if (!Mat.selectable || G.pick < 0) return;
  Mat.selectable = false; $('lock').disabled = true;
  const m = me(), i = G.pick; G.pick = -1;
  m.card = m.hand.splice(i, 1)[0];
  renderPicks(G.cars, 'pick');
  hint('Locked in. Waiting for the reveal.');
  await Mat.playToBay(i);
  G.pickResolve && G.pickResolve();
}
$('lock').onclick = lockIn;
document.addEventListener('keydown', e => {
  if (!Mat.selectable) return;
  if (e.key >= '1' && e.key <= '5' && +e.key <= Mat.hand.length) Mat.onTap(+e.key - 1);
  if (e.key === 'Enter') lockIn();
});

/* ---------- weapons and traps: fired halfway through each car's move ---------- */
const GUN_RANGE = 3.8;
async function fireWeapons(list) {
  if (!list.length) return;
  const cars = active(), anims = [], hits = [];
  for (const c of list) {
    if (c.down) continue;
    const q = wpos(c);
    if (c.card === 'missile') {
      // homes on the nearest car in front, any lane, up to 5 tiles ahead; never behind
      const t = cars.filter(o => o !== c && aheadU(c, o) > 0.2 && aheadU(c, o) <= 6.5)
        .sort((a, b) => aheadU(c, a) - aheadU(c, b) || Math.abs(a.lane - c.lane) - Math.abs(b.lane - c.lane))[0];
      if (t) { anims.push(fireMissile(q, () => wpos(t)).then(() => { const tq = wpos(t); FX.burst(tq.x, tq.z, 0xff8a30, 20, 3, tq.y); hits.push(hurt(t, 3, { mit: false, src: `${c.name}'s missile` })); })); }
      else { const to = { x: q.x + q.tx * 3, y: q.y, z: q.z + q.tz * 3 }; txt(c, 'No target', 'info'); logLine(`${c.name}'s missile fizzles out.`); anims.push(fireMissile(q, to, true)); }
    } else if (c.card === 'gatling') {
      // straight out of the barrel along the car's heading
      let best = null, bd = GUN_RANGE;
      for (const o of cars) {
        if (o === c) continue;
        const p = wpos(o), dx = p.x - q.x, dz = p.z - q.z, along = dx * q.tx + dz * q.tz, side = Math.abs(dx * q.tz - dz * q.tx);
        if (along > 0.3 && along < bd && side < 0.55 && Math.abs(p.y - q.y) < 0.5) { best = o; bd = along; }
      }
      const to = best ? wpos(best) : { x: q.x + q.tx * GUN_RANGE, y: q.y, z: q.z + q.tz * GUN_RANGE };
      anims.push(fireGatling(q, to).then(() => { if (best) { FX.sparks(to.x, to.z, to.y); hits.push(hurt(best, 2, { mit: false, src: `${c.name}'s gatling` })); } else logLine(`${c.name}'s gatling sprays empty track.`); }));
    } else if (c.card === 'mine' || c.card === 'oil') {
      const k = dropToken(c.card, c.lane, c.t);
      if (k) { logLine(`${c.name} drops ${c.card === 'mine' ? 'a mine' : 'an oil slick'}.`); const by = k.userData.baseY; anims.push(anim(380, e => { k.position.y = by + (1 - ease(e)) * 1.0; })); }
      else txt(c, 'No room', 'info');
    }
    c.fired = true;
  }
  await Promise.all(anims);
  if (hits.length) FX.shakeBy(0.08);
  await Promise.all(hits);
}

/* ---------- finishing: a car that crosses the line takes the next place and leaves the track ---------- */
function markFinishers(bg) {
  const fresh = G.cars.filter(c => finished(c) && !c.done && !c.down).sort((a, b) => (b.lead || 0) - (a.lead || 0) || progress(b) - progress(a));
  for (const c of fresh) { c.done = true; c.place = ++G.placed; bg.push(celebrate(c)); }
}
async function celebrate(c) {
  const q = wpos(c), t0 = c.t;
  logLine(`${c.human ? 'You finish' : c.name + ' finishes'} ${ORD[c.place]}.`, true); say(c.human ? `You cross the line in ${ORD[c.place]}!` : `${c.name} finishes ${ORD[c.place]}.`);
  txt(c, ORD[c.place] + '!', 'cash'); FX.burst(q.x, q.z, 0xffe080, 26, 3.2, q.y); refresh(); renderPicks(G.cars, 'reveal');
  if (c.place === 1) Announcer.event('win', c.name);
  await anim(950, k => placeCar(c, t0 + ease(k) * 2.6, c.lane));
  c.view.group.visible = false; refresh();
}

/* ---------- movement: all cars step together, one tile per tick ---------- */
async function movePhase() {
  const strain = active().filter(c => c.card === 'boost');
  if (strain.length) await Promise.all(strain.map(c => hurt(c, 1, { mit: false, src: 'boost strain' })));
  const movers = active().filter(c => c.card);
  if (!movers.length) return;
  const rolls = await Promise.all(movers.map((c, i) => { const q = wpos(c); return rollDie(q.x + (i % 2 ? 0.55 : -0.55), q.z - 0.55, q.y); }));
  const plan = new Map(), bg = [];                                       // bg: weapon shots and finish parties run alongside the movement
  const leaderU = Math.min(LAPS * N, Math.max(...G.cars.map(progress)));
  movers.forEach((c, i) => {
    const terr = terrainAt(c.lane, c.t), mod_ = GEAR[c.gear].mods[terr], slope = slopeAt(c.lane, c.t), card = CARDS[c.card];
    const gap = leaderU - progress(c), draft = gap >= DRAFT[2] ? 3 : gap >= DRAFT[1] ? 2 : gap >= DRAFT[0] ? 1 : 0;
    const total = Math.max(1, card.move + c.bs + rolls[i].val + mod_ + slope + c.nitro + draft), mid = Math.ceil(total / 2);
    plan.set(c, { rem: total, done: 0, swerveAt: card.lane ? mid : 0, dir: card.lane || 0, fireAt: WEAPONS.includes(c.card) ? mid : 0 });
    c.fired = false; c.lead = 0;
    txt(c, String(total), 'info'); if (draft) setTimeout(() => txt(c, 'Draft +' + draft, 'heal'), 350);
    logLine(`${c.name} moves ${total}: card ${card.move}, base ${c.bs}, die ${fmt(rolls[i].val)}, ${terr} ${fmt(mod_)}${slope ? `, ${slope > 0 ? 'downhill' : 'uphill'} ${fmt(slope)}` : ''}${c.nitro ? `, nitro +${c.nitro}` : ''}${draft ? `, draft +${draft} (${Math.round(gap)} tiles behind the leader)` : ''}.`);
    c.nitro = 0;
  });
  say('All cars move together.');
  await sleep(750); rolls.forEach(r => dropDie(r.die));

  const swiped = new Set();
  for (let guard = 0; guard < 80; guard++) {
    let go = movers.filter(c => !c.down && plan.get(c).rem > 0);
    for (const c of go) if (finished(c)) { c.lead = plan.get(c).rem; plan.get(c).rem = 0; }
    markFinishers(bg);
    go = go.filter(c => plan.get(c).rem > 0 && !c.done);
    if (!go.length) break;
    // work out where each car wants to go this tick
    const want = c => {
      const P = plan.get(c), step = P.done + 1, kind = tileKind(c.lane, c.t);
      if (kind === 'ramp') { if (P.swerveAt === step) P.swerveAt++; return P.rem >= 2 ? { l: c.lane, t: c.t + 3, cost: 2, jump: true } : { l: c.lane, t: c.t + 1, cost: 1, fall: true }; }
      if (P.swerveAt === step && P.dir) {
        const l2 = c.lane + P.dir;
        if (l2 >= 0 && l2 < LANES) {
          const t2 = diagT(c.lane, c.t, l2), occ = occupant(l2, t2, c);
          if (!occ) return { l: l2, t: t2, cost: 1, swerve: true };
          if (!swiped.has(c)) { swiped.add(c); P.swipe = occ; }            // blocked: rub doors and carry straight on
        }
      }
      return { l: c.lane, t: c.t + 1, cost: 1 };
    };
    const steps = [], hits = [], pending = [...go].sort((a, b) => progress(b) - progress(a));
    for (let progressMade = true; progressMade && pending.length;) {
      progressMade = false;
      for (const c of [...pending]) {
        const w = want(c), occ = occupant(w.l, w.t, c);
        if (occ && pending.includes(occ)) continue;                         // wait and see if it moves away
        pending.splice(pending.indexOf(c), 1); progressMade = true;
        const P = plan.get(c);
        if (occ) { hits.push([c, occ]); P.rem = 0; continue; }
        const extra = !w.jump && !w.fall && c.gear !== 'hover' && terrainAt(w.l, w.t) === 'lava' ? 1 : 0;
        steps.push({ c, from: wpos(c), w, extra });
        c.lane = w.l; c.t = w.t; P.rem = Math.max(0, P.rem - w.cost - extra); P.done++;
        if (w.swerve) P.swerveAt = 0;
      }
    }
    for (const c of pending) { const w = want(c); hits.push([c, occupant(w.l, w.t, c)]); plan.get(c).rem = 0; }
    for (const s of steps) s.to = wpos(s.c);
    const flying = steps.some(s => s.w.jump || s.w.fall);
    const DUR = flying ? 560 : 175;
    await anim(DUR, t => {
      steps.forEach(s => {
        if (s.w.jump || s.w.fall) {
          const k = s.w.fall ? Math.min(1, t * 1.1) : t, base = s.from.y + (s.to.y - s.from.y) * k;
          placePose(s.c, lerpPose(s.from, s.to, k), 0, 0, base + Math.sin(k * Math.PI) * (s.w.fall ? 0.6 : 1.3));
        } else { const k = Math.min(1, t * DUR / 175); placePose(s.c, lerpPose(s.from, s.to, ease(k)), Math.sin(k * Math.PI) * 0.14, s.w.swerve ? Math.sin(k * Math.PI) * 0.25 * -Math.sign(s.c.lane - 1 || 1) : 0); }
      });
      hits.forEach(([c]) => { const k = Math.min(1, t * DUR / 175); placeCar(c, c.t + Math.sin(k * Math.PI) * 0.3, c.lane); });
    });
    steps.forEach(s => {
      placeCar(s.c, s.c.t, s.c.lane);
      const q = s.to;
      if (s.w.jump) { FX.burst(q.x, q.z, 0xc8b8a0, 10, 1.6, q.y); FX.shakeBy(0.05); txt(s.c, 'Air!', 'info'); logLine(`${s.c.name} jumps the chasm.`); Announcer.event('jump', s.c.name, 0.35); }
      if (s.w.fall) { FX.burst(q.x, q.z, 0xff8a20, 22, 2.6, q.y); FX.shakeBy(0.08); txt(s.c, 'Falls short!', 'dmg'); logLine(`${s.c.name} falls short into the lava.`); }
      if (s.extra) txt(s.c, 'Slowed', 'info');
    });
    renderRace(G.cars, G.turn);
    const jobs = hits.filter(([, f]) => f).map(([c, f]) => {
      const q = wpos(f), dmg = 2 + (c.card === 'ram' ? 2 : 0) + (c.gear === 'spiked' ? 1 : 0);
      FX.sparks(q.x, q.z, q.y); FX.burst(q.x, q.z, 0xffd080, 10, 2, q.y); FX.shakeBy(0.09);
      say(`${c.name} rear-ends ${f.name}!`); txt(c, 'Stopped', 'info');
      return hurt(f, dmg, { src: `a rear-end hit from ${c.name}` });
    });
    for (const c of movers) { const P = plan.get(c); if (P.swipe) { const o = P.swipe; P.swipe = null; const q = wpos(o); FX.sparks(q.x, q.z, q.y); txt(c, 'Blocked', 'info'); jobs.push(hurt(o, 1, { src: `a side-swipe from ${c.name}` })); } }
    const res = await Promise.all([...steps.map(s => passTile(s.c)), ...jobs]);
    steps.forEach((s, i) => { if (res[i] === 'stop' || s.c.down) plan.get(s.c).rem = 0; });
    // halfway through (or when stopped early) each armed car fires
    const shoot = movers.filter(c => !c.down && !c.done && !c.fired && plan.get(c).fireAt && (plan.get(c).done >= plan.get(c).fireAt || plan.get(c).rem === 0));
    if (shoot.length) { say(shoot.length > 1 ? 'Weapons fire mid-move!' : `${shoot[0].name} fires mid-move!`); bg.push(fireWeapons(shoot)); }   // fire and keep rolling
  }
  markFinishers(bg);
  const late = movers.filter(c => !c.down && !c.done && !c.fired && plan.get(c).fireAt);
  if (late.length) bg.push(fireWeapons(late));
  await Promise.all(bg);
  const lava = active().filter(c => terrainAt(c.lane, c.t) === 'lava');
  if (lava.length) { say(lava.length > 1 ? 'Cars stop on lava!' : `${lava[0].name} stops on lava!`); await Promise.all(lava.map(lavaCheck)); await sleep(300); }
}

/* ---------- a turn ---------- */
function phase(i, text) { G.phase = i; setPhaseUI(i); logLine(`Turn ${G.turn} \u00b7 ${PHASES[i]}`, true); say(text); }
async function playTurn() {
  G.turn++; refresh();
  phase(0, 'Everyone picks one card.');
  renderPicks(G.cars, 'pick');
  const gen = G.gen;
  active().filter(c => !c.human).forEach(c => {
    c.pending = cpuPick(c);
    sleep(400 + Math.random() * 1200).then(() => { if (G.gen === gen && G.phase === 0 && !c.down) { c.card = c.pending; renderPicks(G.cars, 'pick'); } });
  });
  await humanPick();
  active().forEach(c => { if (!c.human) c.card = c.pending; });
  renderPicks(G.cars, 'pick');
  await sleep(300);

  phase(1, 'Reveal! All cards flip at once.');
  hint('All cards flip together.');
  renderPicks(G.cars, 'reveal');
  await Mat.flipBay(520);
  active().filter(c => c.card).forEach(c => logLine(`${c.name} plays ${CARDS[c.card].name}.`));
  active().filter(c => c.card === 'shield').forEach(c => { c.shield = true; c.shieldCard = true; c.view.dome.visible = true; txt(c, 'Shield up', 'blk'); });
  await sleep(1000);

  phase(2, 'Everyone moves. Swerves and weapons happen halfway.'); hint('Card + base + die + surface + slope.');
  await movePhase();

  // standings, laps and a changing track
  const lead = [...active()].sort((a, b) => progress(b) - progress(a))[0];
  if (lead && lead !== G.leader) { if (G.leader) Announcer.event('leader', lead.name); G.leader = lead; }
  const lap = lead ? lapOf(lead) : 1;
  if (lap > G.lapSeen && !raceOver()) {
    G.lapSeen = lap;
    Announcer.event(lap === LAPS ? 'final' : 'lap2');
    logLine(lap === LAPS ? 'Final lap!' : `Lap ${lap}!`, true);
    await spawnPickups();
    await erupt(2);
  } else if (G.turn >= 3 && !raceOver() && Math.random() < 0.7) await erupt(1);

  for (const c of G.cars) {
    if (c.card) c.discard.push(c.card); c.card = null;
    if (c.shieldCard) { c.shield = false; c.shieldCard = false; c.view.dome.visible = false; }
    if (!c.down) drawTo5(c);
  }
  await Mat.clearBay();
  await respawns();
  refresh(); setPhaseUI(-1); renderPicks(G.cars, 'pick');
  if (!me().down && !raceOver() && Mat.hand.length < me().hand.length) await Mat.deal(me().hand, Mat.hand.length);
}
function standings() { return [...G.cars].sort((a, b) => byRank(a, b) || (b.lead || 0) - (a.lead || 0) || (b.hp - a.hp)); }
const raceOver = () => !!me().done;                               // the race runs until you cross the line
async function raceLoop() {
  if (G.running) return; G.running = true;
  Announcer.event('start');
  await Mat.deal(me().hand, 0);
  while (!G.over) { await playTurn(); if (raceOver()) G.over = true; }
  G.running = false; await sleep(600); showEnd();
}
function showEnd() {
  const st = standings(), mine = st.indexOf(me()) + 1, pickups = me().cash;
  st.forEach((c, i) => { c.finalPlace = i + 1; c.prize = PRIZES[i] || 0; });
  me().cash += me().prize; refresh();
  const sub = c => c.done ? 'Finished' : `Lap ${lapOf(c)}, ${Math.round(mod(progress(c), N) / N * 100)}%`;
  $('endp').innerHTML = `<h1>${mine === 1 ? 'You <em>win</em>' : `You take <em>${ORD[mine]}</em>`}</h1>` +
    st.map((c, i) => `<div class="rank${c.human ? ' me' : ''}"><i>${i + 1}</i><span>${c.human ? 'You' : c.name}</span><small>${sub(c)} \u00b7 prize $${c.prize}</small></div>`).join('') +
    `<p>${G.turn} turns. You banked $${me().prize} prize + $${pickups} from pickups = <b>$${me().cash}</b> for upgrades between races.</p><button class="go" id="again">Race Again</button>`;
  $('end').classList.add('show');
  $('again').onclick = () => { $('end').classList.remove('show'); $('log').innerHTML = ''; setupGame(); raceLoop(); };
}

/* ---------- boot ---------- */
buildPhases(); setupGame(); W.warmUp(); W.start();
$('start').onclick = () => { $('intro').classList.remove('show'); Music.start(); raceLoop(); };
$('speed').onclick = () => { SPEED = SPEED === 1 ? 2 : SPEED === 2 ? 3 : 1; $('speed').textContent = SPEED + '\u00d7'; };
$('logbtn').onclick = () => $('log').classList.toggle('show');
$('music').onclick = () => { Music.toggle(); $('music').classList.toggle('off', !Music.on); $('music').setAttribute('aria-pressed', String(Music.on)); };
