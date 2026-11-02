/* Galactic Gridlock prototype: loader. Pulls the newest Three.js as an ES module from cdnjs and exposes it as the
   global THREE the game scripts use; if the module can't load, falls back to the classic r160 build, then starts the game. */
(function () {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/';
  const NEW = '0.186.1', OLD = '0.160.0';
  const APP = ['data.js', 'post.js', 'scene.js', 'track.js', 'cars.js', 'props.js', 'mat.js', 'audio.js', 'announcer.js', 'game.js'];
  const failed = () => { const e = document.getElementById('start'); if (e) e.textContent = 'Could not load'; };
  function runApp() {
    let i = 0;
    (function next() {
      if (i >= APP.length) return;
      const s = document.createElement('script'); s.charset = 'utf-8'; s.src = APP[i++]; s.onload = next; s.onerror = failed; document.body.appendChild(s);
    })();
  }
  function classic() {
    const s = document.createElement('script'); s.src = CDN + OLD + '/three.min.js'; s.onload = runApp; s.onerror = failed; document.head.appendChild(s);
  }
  const src = window.__THREE_URL || (CDN + NEW + '/three.module.min.js');
  import(src).then(m => { window.THREE = Object.assign({}, m); runApp(); }).catch(err => { console.warn('three module failed, using classic build', err); classic(); });
})();
