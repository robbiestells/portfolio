/* Galactic Gridlock prototype: camera post-processing for a "photo of a miniature" look.
   Scene renders in linear HDR into a multisampled target with a depth texture; then screen-space ambient occlusion
   (contact darkening where parts meet the board), bloom (lava glow), tilt-shift depth of field (far table falls out of
   focus like a macro lens), ACES tone mapping, vignette, warm grade and grain.
   If the browser/Three.js build can't resolve MSAA depth, it falls back to MSAA colour only (no AO). */
const Post = { on: false, ao: false };
(function () {
  let R, rtMain, rtHalf, qA, qB, bA, bB, aoA, aoB, quad, ortho, qscene, M = {};
  const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const DEPTH_FN = `
    uniform sampler2D tD; uniform mat4 projInv;
    vec3 vpos(vec2 uv){ float d = texture2D(tD, uv).x; vec4 c = projInv * vec4(uv*2.-1., d*2.-1., 1.); return c.xyz / c.w; }`;
  Post.init = (renderer) => {
    if (renderer.capabilities.isWebGL2 === false || !THREE.WebGLRenderTarget) return;
    try {
      R = renderer;
      const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      const canDepth = 'resolveDepthBuffer' in new THREE.WebGLRenderTarget(1, 1);     // MSAA depth resolve exists in newer Three.js
      const mopt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: 4 };
      if (canDepth) { mopt.depthBuffer = true; mopt.depthTexture = new THREE.DepthTexture(4, 4); mopt.depthTexture.type = THREE.UnsignedIntType; mopt.depthTexture.minFilter = mopt.depthTexture.magFilter = THREE.NearestFilter; }
      rtMain = new THREE.WebGLRenderTarget(4, 4, mopt);
      Post.ao = canDepth;
      rtHalf = new THREE.WebGLRenderTarget(4, 4, opt); qA = new THREE.WebGLRenderTarget(4, 4, opt); qB = new THREE.WebGLRenderTarget(4, 4, opt);
      bA = new THREE.WebGLRenderTarget(4, 4, opt); bB = new THREE.WebGLRenderTarget(4, 4, opt);
      aoA = new THREE.WebGLRenderTarget(4, 4, opt); aoB = new THREE.WebGLRenderTarget(4, 4, opt);
      ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qscene = new THREE.Scene();
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qscene.add(quad);
      M.down = mk(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
        void main(){ vec3 c = texture2D(t, vUv + px*vec2(-.5,-.5)).rgb + texture2D(t, vUv + px*vec2(.5,-.5)).rgb + texture2D(t, vUv + px*vec2(-.5,.5)).rgb + texture2D(t, vUv + px*vec2(.5,.5)).rgb;
        gl_FragColor = vec4(c*.25, 1.); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
      M.bright = mk(`uniform sampler2D t; varying vec2 vUv;
        void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(.2126,.7152,.0722)); float k = smoothstep(1.15, 2.6, l);
        gl_FragColor = vec4(c*k, 1.); }`, { t: { value: null } });
      M.blur = mk(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(t, vUv).rgb*.227;
        c += (texture2D(t, vUv+dir*1.384).rgb + texture2D(t, vUv-dir*1.384).rgb)*.316;
        c += (texture2D(t, vUv+dir*3.230).rgb + texture2D(t, vUv-dir*3.230).rgb)*.070;
        gl_FragColor = vec4(c, 1.); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
      // screen-space ambient occlusion from the depth buffer (normals rebuilt from depth)
      M.ao = mk(`${DEPTH_FN}
        uniform mat4 proj; uniform vec2 res; uniform float radius, power, time; varying vec2 vUv;
        float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
        void main(){
          float d0 = texture2D(tD, vUv).x;
          if (d0 > .99999) { gl_FragColor = vec4(1.); return; }
          vec3 P = vpos(vUv); vec2 px = 1. / res;
          vec3 Pr = vpos(vUv + vec2(px.x, 0.)), Pl = vpos(vUv - vec2(px.x, 0.)), Pu = vpos(vUv + vec2(0., px.y)), Pd = vpos(vUv - vec2(0., px.y));
          vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
          vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
          vec3 N = normalize(cross(dx, dy)); if (dot(N, P) > 0.) N = -N;
          float rot = ign(gl_FragCoord.xy) * 6.2831853;
          float rUv = radius * proj[1][1] * .5 / max(-P.z, .1);
          float occ = 0.; const int NS = 14;
          for (int i = 0; i < NS; i++) {
            float fi = float(i) + .5, a = fi * 2.39996 + rot, rr = sqrt(fi / float(NS));
            vec2 off = vec2(cos(a), sin(a)) * rr * rUv * vec2(res.y / res.x, 1.);
            vec2 uv = vUv + off;
            if (texture2D(tD, uv).x > .99999) continue;
            vec3 v = vpos(uv) - P; float vv = dot(v, v);
            float fall = max(1. - vv / (radius * radius), 0.);
            occ += max(dot(v, N) * inversesqrt(vv + 1e-5) - .12, 0.) * fall;
          }
          float ao = clamp(1. - power * occ / float(NS), 0., 1.);
          gl_FragColor = vec4(ao, ao, ao, 1.); }`,
        { tD: { value: null }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2() }, radius: { value: 0.45 }, power: { value: 2.4 }, time: { value: 0 } });
      M.aoBlur = mk(`${DEPTH_FN}
        uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
        void main(){
          float z0 = vpos(vUv).z, sum = texture2D(t, vUv).r * .25, wsum = .25;
          for (int i = -3; i <= 3; i++) { if (i == 0) continue; vec2 uv = vUv + dir * float(i);
            float w = (1. - abs(float(i)) / 4.) * exp(-abs(vpos(uv).z - z0) * 10.); sum += texture2D(t, uv).r * w; wsum += w; }
          float a = sum / wsum; gl_FragColor = vec4(a, a, a, 1.); }`,
        { t: { value: null }, tD: { value: null }, projInv: { value: new THREE.Matrix4() }, dir: { value: new THREE.Vector2() } });
      M.comp = mk(`uniform sampler2D tS, tB, tG, tA; uniform vec2 res; uniform float time, focusY, focusW, expo, aoOn;
        varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec3 s = texture2D(tS, vUv).rgb, b = texture2D(tB, vUv).rgb;
          float lum = dot(s, vec3(.2126,.7152,.0722));
          float ao = mix(1., texture2D(tA, vUv).r, aoOn);
          s *= mix(ao, 1., smoothstep(.8, 2.4, lum));                 // glowing lava isn't occluded
          float dy = vUv.y - focusY;
          float coc = dy > 0. ? smoothstep(focusW, focusW + .3, dy) * .85 : 0.;
          vec3 c = mix(s, b, coc) + texture2D(tG, vUv).rgb * .55;
          c *= expo; c = aces(c);
          c = pow(c, vec3(1./2.2));
          c *= vec3(1.03, 1.0, .95);
          vec2 q = vUv - .5; c *= 1. - dot(q*vec2(1.1, 1.3), q*vec2(1.1, 1.3)) * .85;
          c += (h(vUv*res + fract(time)*91.) - .5) * .022;
          gl_FragColor = vec4(c, 1.); }`,
        { tS: { value: null }, tB: { value: null }, tG: { value: null }, tA: { value: null }, res: { value: new THREE.Vector2() }, time: { value: 0 }, focusY: { value: 0.5 }, focusW: { value: 0.22 }, expo: { value: 0.88 }, aoOn: { value: canDepth ? 1 : 0 } });
      renderer.toneMapping = THREE.NoToneMapping;
      Post.M = M;
      Post.on = true;
    } catch (e) { console.warn('post-processing disabled', e); Post.on = false; }
  };
  Post.resize = (w, h, pr) => {
    if (!Post.on) return;
    const W2 = Math.max(4, Math.round(w * pr)), H2 = Math.max(4, Math.round(h * pr));
    rtMain.setSize(W2, H2); rtHalf.setSize(W2 >> 1, H2 >> 1);
    if (rtMain.depthTexture && rtMain.depthTexture.image) { rtMain.depthTexture.image.width = W2; rtMain.depthTexture.image.height = H2; }
    for (const r of [qA, qB, bA, bB]) r.setSize(Math.max(2, W2 >> 2), Math.max(2, H2 >> 2));
    for (const r of [aoA, aoB]) r.setSize(Math.max(2, W2 >> 1), Math.max(2, H2 >> 1));
    M.comp.uniforms.res.value.set(W2, H2); M.ao.uniforms.res.value.set(W2 >> 1, H2 >> 1);
  };
  Post.focus = (y, w) => { if (Post.on) { M.comp.uniforms.focusY.value = y; M.comp.uniforms.focusW.value = w; } };
  function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(qscene, ortho); }
  function blur(src, tmp, times) {
    for (let i = 0; i < times; i++) {
      M.blur.uniforms.t.value = src.texture; M.blur.uniforms.dir.value.set((1 + i) / src.width, 0); pass(M.blur, tmp);
      M.blur.uniforms.t.value = tmp.texture; M.blur.uniforms.dir.value.set(0, (1 + i) / src.height); pass(M.blur, src);
    }
  }
  Post.render = (scene, camera, time) => {
    R.setRenderTarget(rtMain); R.clear(); R.render(scene, camera);
    M.down.uniforms.t.value = rtMain.texture; M.down.uniforms.px.value.set(1 / rtMain.width, 1 / rtMain.height); pass(M.down, rtHalf);
    M.down.uniforms.t.value = rtHalf.texture; M.down.uniforms.px.value.set(1 / rtHalf.width, 1 / rtHalf.height); pass(M.down, qA);
    blur(qA, qB, 2);
    M.bright.uniforms.t.value = rtHalf.texture; pass(M.bright, bA);
    blur(bA, bB, 3);
    const u = M.comp.uniforms;
    if (Post.ao && u.aoOn.value) {
      camera.updateProjectionMatrix();
      const a = M.ao.uniforms; a.tD.value = rtMain.depthTexture; a.projInv.value.copy(camera.projectionMatrixInverse); a.proj.value.copy(camera.projectionMatrix); a.time.value = time;
      pass(M.ao, aoA);
      const b = M.aoBlur.uniforms; b.tD.value = rtMain.depthTexture; b.projInv.value.copy(camera.projectionMatrixInverse);
      b.t.value = aoA.texture; b.dir.value.set(1.4 / aoA.width, 0); pass(M.aoBlur, aoB);
      b.t.value = aoB.texture; b.dir.value.set(0, 1.4 / aoA.height); pass(M.aoBlur, aoA);
      u.tA.value = aoA.texture;
    }
    u.tS.value = rtMain.texture; u.tB.value = qA.texture; u.tG.value = bA.texture; u.time.value = time;
    pass(M.comp, null);
  };
})();
