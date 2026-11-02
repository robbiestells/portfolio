/* Galactic Gridlock prototype: monster-truck-rally race announcer.
   Deep, slow, booming delivery with an echoing tagline, air horns and crowd roars.
   Voice is switched off for now: it shows the on-screen callout and plays the air horn and crowd. */
const Announcer = (() => {
  // [line, echoed tagline]
  const LINES = {
    start:   [['Tonight! Tonight! Tonight! Four monster machines! Three laps of molten mayhem at the Inferno Figure Eight!', 'Be there!'],
              ['Fire up your engines! The Inferno opens its gates! Three laps! No mercy!', 'No mercy!']],
    leader:  [['{n} seizes the lead!', 'The lead!'], ['{n} roars into first place!', 'First place!'], ['New leader! It\u2019s {n}!', '{n}!']],
    bigHit:  [['{n} gets smashed!', 'Smashed!'], ['Brutal hit on {n}!', 'Brutal!'], ['{n} is getting crushed out there!', 'Crushed!']],
    wreck:   [['Kaboom! {n} is scrap metal!', 'Scrap metal!'], ['{n} goes up in flames!', 'Flames!'], ['{n} is destroyed! Total destruction!', 'Destruction!']],
    respawn: [['{n} rises from the ashes!', 'The ashes!'], ['The pit crew rebuilds {n}! It\u2019s back!', 'It\u2019s back!']],
    lap2:    [['Lap two! The lava is rising!', 'Rising!'], ['One lap down! Two to go!', 'Two to go!']],
    final:   [['Final lap! Winner takes all!', 'Takes all!'], ['Last lap! Hold on to your helmets!', 'Helmets!']],
    lava:    [['The volcano erupts! More lava!', 'Lava!'], ['The track is melting!', 'Melting!']],
    jump:    [['Monster air for {n}!', 'Air!'], ['{n} flies over the inferno!', 'Inferno!']],
    pickup:  [['{n} grabs the loot!', 'Loot!']],
    win:     [['{n} conquers the Inferno! What a night!', 'What a night!'], ['{n} takes the checkered flag! Champion!', 'Champion!']]
  };
  const PRIO = { win: 5, wreck: 4, final: 4, leader: 3, start: 3, lap2: 3, bigHit: 2, respawn: 2, lava: 1, jump: 0, pickup: 0 };
  const FX_FOR = { start: 'horn', win: 'horn', wreck: 'crowd', leader: 'crowd', bigHit: 'crowd', jump: 'crowd', final: 'horn', lap2: 'crowd' };
  const A = { on: true };
  let busyUntil = 0, banner = null, hideT = 0;
  function show(text) {
    banner = banner || document.getElementById('announce');
    banner.innerHTML = `<small>Announcer</small><span>${text}</span>`;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
    clearTimeout(hideT); hideT = setTimeout(() => banner.classList.remove('show'), 3000);
  }
  /* kind: a LINES key; name: driver name; chance: 0..1 for chatty events */
  A.event = (kind, name = '', chance = 1) => {
    const now = performance.now(), p = PRIO[kind] || 0;
    if (Math.random() > chance) return;
    if (now < busyUntil && p < 3) return;          // don't talk over ourselves for small stuff
    const pool = LINES[kind]; if (!pool) return;
    const [line, tag] = pool[Math.floor(Math.random() * pool.length)].map(s => s.replace(/\{n\}/g, name));
    busyUntil = now + 3200 + line.length * 45;
    show(line);
    if (A.on && FX_FOR[kind] && window.Music) Music.sfx(FX_FOR[kind]);
  };
  A.toggle = () => { A.on = !A.on; return A.on; };
  return A;
})();
