'use strict';
/* AUDIO:BEGIN ------------------------------------------------------------------
   IT WASN'T ME sound engine. Layered Web Audio synthesis + a few CC0 recordings
   (OpenGameArt: "75 CC0 breaking/falling/hit sfx" and "100 CC0 metal and wood SFX"
   by rubberduck, "Glass Break" by Till Behrend; all CC0).
   Every sound = transient + body + tail, randomised a little so repeats never sound the same.
-------------------------------------------------------------------------------- */
const SFX = (() => {
  const cfg = {master:0.9, punch:1, bass:1, reverb:0.3, bright:1, shards:1, vol:1, samp:1, owner:0.5, gaze:0.35};
  let scale = 1;                                           // temporary volume multiplier (used to make owner sounds quieter)
  let sfxVol, musicIn, sfxLevel = 1, musicLevel = 1;      // the player's two volume sliders
  let ac = null, an, bus, duck, master, comp, lim, rev, revSend, noiseBuf, pinkBuf, muted = false, voices = 0;
  const buffers = {};
  const rnd = (a, b) => a + Math.random()*(b - a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const st = n => Math.pow(2, n/12);                       // semitones -> ratio

  function makeIR(sec, decay){
    const len = Math.floor(ac.sampleRate*sec), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c=0;c<2;c++){
      const d = ir.getChannelData(c); let lp = 0;
      for (let i=0;i<len;i++){
        const t = i/len, w = (Math.random()*2-1) * Math.pow(1-t, decay);
        lp += (w - lp) * (0.55 - 0.45*t);                  // gets darker with time
        d[i] = lp;
      }
    }
    return ir;
  }
  function init(){
    if (ac) { if (ac.state==='suspended') ac.resume(); return ac; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : cfg.master;
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.22;
    lim = ac.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    duck = ac.createGain(); bus = ac.createGain();
    an = ac.createAnalyser(); an.fftSize = 2048; lim.connect(an);
    sfxVol = ac.createGain(); sfxVol.gain.value = sfxLevel; musicIn = ac.createGain(); musicIn.gain.value = musicLevel;
    bus.connect(duck); duck.connect(comp); comp.connect(lim); lim.connect(sfxVol); sfxVol.connect(master); musicIn.connect(master); master.connect(ac.destination);
    // (music skips the effects chain: no ducking / compression from the sounds; mute still covers it through master)
    rev = ac.createConvolver(); rev.buffer = makeIR(1.6, 2.6);
    revSend = ac.createGain(); revSend.gain.value = cfg.reverb; rev.connect(revSend); revSend.connect(duck);
    noiseBuf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;
    pinkBuf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
    const pd = pinkBuf.getChannelData(0); let b0=0,b1=0,b2=0;
    for (let i=0;i<pd.length;i++){ const w = Math.random()*2-1; b0 = 0.997*b0 + w*0.029; b1 = 0.985*b1 + w*0.032; b2 = 0.95*b2 + w*0.048; pd[i] = (b0+b1+b2+w*0.05)*3.2; }
    decodeAll();
    return ac;
  }
  let pendingData = null;
  const failed = [];
  function decodeAll(){
    if (!pendingData || !ac) return;
    for (const [k, b64] of Object.entries(pendingData)){
      if (buffers[k] || decoding[k]) continue;
      decoding[k] = true;
      try {
        const raw = b64.startsWith('data:') ? b64.slice(b64.indexOf(',') + 1) : b64;
        const bin = atob(raw), u8 = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
        const p = ac.decodeAudioData(u8.buffer.slice(0), b => { buffers[k] = b; }, e => { failed.push(k); });
        if (p && p.then) p.then(b => { buffers[k] = b; }).catch(e => { if (!failed.includes(k)) failed.push(k); });
      } catch(e){ failed.push(k); }
    }
  }
  const decoding = {};
  function load(data){ pendingData = data; decodeAll(); }

  /* ---------- plumbing ---------- */
  const shaperCache = {};
  function shaper(k){
    const key = Math.round(k*10);
    if (shaperCache[key]) return shaperCache[key];
    const n = 1024, c = new Float32Array(n), kk = Math.max(0.01, k);
    for (let i=0;i<n;i++){ const x = i/(n-1)*2-1; c[i] = Math.tanh(kk*x)/Math.tanh(kk); }
    const s = ac.createWaveShaper(); s.curve = c; s.oversample = '2x'; return s;
  }
  // connect a node through optional drive / pan to the bus (+ reverb send)
  function out(node, o, endT){
    let n = node;
    if (o.drive){ const s = shaper(o.drive*cfg.punch); n.connect(s); n = s; }
    if (o.pan && ac.createStereoPanner){ const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); n.connect(p); n = p; }
    n.connect(bus);
    if (o.rev){ const g = ac.createGain(); g.gain.value = o.rev; n.connect(g); g.connect(rev); }
    voices++; const dec = () => voices--;
    if (node.onended !== undefined) node.addEventListener('ended', dec); else setTimeout(dec, 1000);
  }
  function filt(type, f, q){ const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }

  /* ---------- primitives ---------- */
  // pitched voice: f -> f2 glide, optional FM / vibrato / lowpass
  function tone(o){
    if (!ac || voices > 60) return;
    const t = o.t || ac.currentTime, dur = o.dur || 0.2, v = (o.vol === undefined ? 0.3 : o.vol) * cfg.vol * scale;
    const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || dur));
    if (o.det) osc.detune.value = o.det;
    const g = ac.createGain(), a = o.a === undefined ? 0.004 : o.a;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) g.gain.setValueAtTime(v, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = osc;
    if (o.fm){ const m = ac.createOscillator(), mg = ac.createGain(); m.frequency.value = o.f*o.fm.ratio; mg.gain.value = o.fm.depth*o.f;
      if (o.fm.decay){ mg.gain.setValueAtTime(o.fm.depth*o.f, t); mg.gain.exponentialRampToValueAtTime(1, t + o.fm.decay); }
      m.connect(mg); mg.connect(osc.frequency); m.start(t); m.stop(t + dur + 0.05); }
    if (o.vib){ const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib.rate; lg.gain.value = o.vib.depth;
      l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + dur + 0.05); }
    if (o.lp){ const f = filt('lowpass', o.lp, o.q || 0.7); n.connect(f); n = f; }
    if (o.hp){ const f = filt('highpass', o.hp, 0.7); n.connect(f); n = f; }
    n.connect(g);
    osc.start(t); osc.stop(t + dur + 0.05);
    out(g, o); return osc;
  }
  // filtered noise burst with optional filter sweep
  function noise(o){
    if (!ac || voices > 60) return;
    const t = o.t || ac.currentTime, dur = o.dur || 0.1, v = (o.vol === undefined ? 0.3 : o.vol) * cfg.vol * scale;
    const s = ac.createBufferSource(); s.buffer = o.pink ? pinkBuf : noiseBuf; s.loop = true;
    const f = filt(o.type || 'bandpass', o.f || 2000, o.q === undefined ? 0.8 : o.q);
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2){ f.frequency.cancelScheduledValues(t); f.frequency.setValueAtTime(o.f || 2000, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur); }
    const g = ac.createGain(), a = o.a === undefined ? 0.002 : o.a;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    if (o.trem){ const l = ac.createOscillator(), lg = ac.createGain(), tg = ac.createGain(); tg.gain.value = 1 - o.trem.depth/2;
      l.frequency.value = o.trem.rate; lg.gain.value = o.trem.depth/2; l.connect(lg); lg.connect(tg.gain); l.start(t); l.stop(t + dur + 0.05);
      g.connect(tg); out(tg, o); } else out(g, o);
    s.start(t, Math.random()*1.5); s.stop(t + dur + 0.05);
  }
  // recorded sample with rate / filters
  function smp(name, o){
    o = o || {};
    if (!ac || !buffers[name] || voices > 60) return false;
    const t = o.t || ac.currentTime, v = (o.vol === undefined ? 0.6 : o.vol) * cfg.vol * cfg.samp * scale;
    const s = ac.createBufferSource(); s.buffer = buffers[name]; s.playbackRate.value = o.rate || 1;
    const g = ac.createGain(); g.gain.value = v;
    let n = s; n.connect(g); n = g;
    if (o.lp){ const f = filt('lowpass', o.lp, 0.7); n.connect(f); n = f; }
    if (o.hp){ const f = filt('highpass', o.hp, 0.7); n.connect(f); n = f; }
    if (o.dur){ g.gain.setValueAtTime(v, t + o.dur - 0.03); g.gain.linearRampToValueAtTime(0, t + o.dur); }
    s.start(t, o.off || 0); if (o.dur) s.stop(t + o.dur + 0.02);
    out(n === g ? g : n, Object.assign({}, o, {}), 0); return true;
  }
  const has = n => !!buffers[n];

  /* ---------- reusable layers ---------- */
  function thump(t, m, pan, vol){        // sub impact (heavier = lower + longer)
    tone({t, f:lerp(170,78,m)*cfg.bass**0.2, f2:lerp(62,34,m), dur:0.1 + 0.22*m, vol:(vol||0.9)*(0.55 + 0.45*m)*cfg.bass, drive:2.2, a:0.002, pan, rev:0.05});
    tone({t, f:lerp(330,150,m), f2:lerp(110,60,m), dur:0.07 + 0.08*m, vol:0.35*(vol||1), type:'triangle', a:0.001, pan});
  }
  const lerp = (a, b, t) => a + (b-a)*t;
  function snap(t, vol, pan, f){          // 3-15 ms transient click that gives the hit its "bite"
    noise({t, type:'highpass', f:f || 2800*cfg.bright, q:0.5, dur:0.014, vol:vol === undefined ? 0.55 : vol, pan, drive:1.5});
    noise({t, f:f ? f*1.6 : 4500, q:0.6, dur:0.03, vol:(vol === undefined ? 0.55 : vol)*0.6, pan});
  }
  function shards(t, n, o){               // scattered glass / ceramic fragments
    n = Math.round(n*cfg.shards);
    for (let i=0;i<n;i++){
      const tt = t + o.t0 + Math.pow(Math.random(), 1.6)*o.span;
      const f = rnd(o.fmin, o.fmax), d = rnd(0.03, 0.11);
      if (o.type === 'glass'){
        tone({t:tt, f, f2:f*rnd(0.97,1.03), dur:d*1.6, vol:rnd(0.04,0.11)*o.vol, a:0.001, pan:(o.pan||0) + rnd(-0.4,0.4), rev:0.35,
              fm:{ratio:rnd(2.4,3.6), depth:0.6, decay:d}});
        if (Math.random() < 0.5) noise({t:tt, type:'highpass', f:5500, dur:0.012, vol:0.05*o.vol, pan:(o.pan||0) + rnd(-0.4,0.4)});
      } else {                           // ceramic: dull clacks
        noise({t:tt, f:rnd(1400,3800), q:rnd(2,6), dur:rnd(0.012,0.03), vol:rnd(0.08,0.2)*o.vol, pan:(o.pan||0) + rnd(-0.4,0.4), rev:0.1});
        if (Math.random() < 0.35) tone({t:tt, f:rnd(900,2200), f2:rnd(500,1200), dur:0.04, vol:0.06*o.vol, type:'triangle', a:0.001, pan:o.pan});
      }
    }
  }
  function bell(f, t, vol, dec, pan){      // inharmonic bell/coin partials
    const parts = [[1, 1], [2.76, 0.5], [5.4, 0.28], [8.93, 0.12]];
    for (const [r, a] of parts) tone({t, f:f*r, dur:dec/(0.6 + r*0.35), vol:vol*a, a:0.001, pan, rev:0.3});
  }
  function ring(f0, t, vol, dec, pan){     // metal ring: inharmonic partials
    for (const [r, a, d] of [[1,1,1],[2.756,0.7,0.8],[5.404,0.5,0.55],[8.933,0.3,0.4],[13.34,0.15,0.3]])
      tone({t, f:f0*r*rnd(0.99,1.01), dur:dec*d, vol:vol*a*0.5, a:0.0008, pan, rev:0.2});
  }
  function scratchy(t, dur, vol){          // vinyl record scratch
    vol *= scale;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(700, t);
    o.frequency.linearRampToValueAtTime(1500, t + dur*0.25); o.frequency.linearRampToValueAtTime(180, t + dur*0.6); o.frequency.linearRampToValueAtTime(900, t + dur);
    const f = filt('bandpass', 1400, 2.2), g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); out(g, {drive:3, rev:0.1}); o.start(t); o.stop(t + dur + 0.05);
    noise({t, f:2200, f2:600, q:1.2, dur, vol:vol*0.8, trem:{rate:34, depth:0.9}});
  }
  // formant voice: saw -> 3 vowel filters, gliding between vowels; for meow / shout
  const V = {a:[800,1200,2800], e:[500,1900,2700], i:[300,2300,3000], o:[450,850,2800], u:[330,700,2500], ae:[690,1700,2600], er:[480,1350,1700]};
  function voice(o){
    if (!ac || voices > 60) return;
    const t = o.t || ac.currentTime, dur = o.dur, vol = (o.vol === undefined ? 0.4 : o.vol) * cfg.vol * scale;
    const src = ac.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(o.f0[0], t);
    o.f0.forEach((f, i) => { if (i) src.frequency.linearRampToValueAtTime(f, t + dur*i/(o.f0.length-1)); });
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = o.vibRate || 6; vg.gain.value = o.vibDepth === undefined ? 14 : o.vibDepth;
    vib.connect(vg); vg.connect(src.detune);
    const sum = ac.createGain(), mix = ac.createGain(); mix.gain.value = 1;
    const sn = ac.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true;
    const ng = ac.createGain(); ng.gain.value = o.breath === undefined ? 0.25 : o.breath;
    sn.connect(ng);
    for (let k=0;k<3;k++){
      const f = filt('bandpass', V[o.vowels[0]][k], k === 0 ? 9 : 12), fg = ac.createGain(); fg.gain.value = [1, 0.6, 0.35][k];
      o.vowels.forEach((vw, i) => { const tt = t + dur*i/Math.max(1, o.vowels.length-1); if (i) f.frequency.linearRampToValueAtTime(V[vw][k], tt); });
      src.connect(f); ng.connect(f); f.connect(fg); fg.connect(sum);
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol*3, t + (o.a || 0.03));
    g.gain.setValueAtTime(vol*3, t + dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sum.connect(g); out(g, {drive:o.drive, pan:o.pan, rev:o.rev === undefined ? 0.12 : o.rev});
    src.start(t); vib.start(t); sn.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); sn.stop(t + dur + 0.05);
  }
  const doDuck = (amt, hold, rel) => {
    if (!ac) return; const t = ac.currentTime;
    duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(duck.gain.value, t);
    duck.gain.linearRampToValueAtTime(amt, t + 0.01); duck.gain.setValueAtTime(amt, t + hold);
    duck.gain.linearRampToValueAtTime(1, t + hold + rel);
  };

  /* ---------- the sounds ---------- */
  const S = {};
  const panOf = x => clamp(((x === undefined ? 90 : x) - 90)/90, -1, 1)*0.75;

  S.step = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0, v = o.vol || 1;
    noise({t, f:rnd(1100,1700), q:1.3, dur:0.03, vol:0.10*v, pan:p});
    tone({t, f:rnd(150,190), f2:70, dur:0.05, vol:0.14*v, a:0.001, pan:p}); };

  S.nope = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;                    // "locked": a dull double bump
    tone({t, f:170, f2:110, dur:0.08, type:'square', lp:700, vol:0.12, a:0.002, pan:p}); tone({t:t+0.09, f:150, f2:95, dur:0.09, type:'square', lp:600, vol:0.1, a:0.002, pan:p}); };
  S.jump = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;                 // Fika's somersault jump: chirp up + spin whoosh
    tone({t, f:320, f2:780, dur:0.16, type:'triangle', vol:0.14, a:0.004, pan:p});
    tone({t:t+0.03, f:640, f2:1500, dur:0.12, type:'sine', vol:0.05, pan:p, rev:0.2});
    noise({t, f:600, f2:2600, q:1.1, dur:0.38, a:0.08, vol:0.14, pan:p, rev:0.1}); };

  // continuous scrape while pushing; returns {stop, set}
  S.pushStart = (weight = 0.5, pan = 0) => {
    if (!ac) return null;
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = pinkBuf; s.loop = true;
    const f = filt('bandpass', lerp(1900, 520, weight), 1.6), g = ac.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.22*cfg.vol, t + 0.05);
    const l = ac.createOscillator(), lg = ac.createGain(), base = ac.createGain();
    l.frequency.value = lerp(15, 7, weight); lg.gain.value = 0.5; base.gain.value = 0.5;
    l.connect(lg); lg.connect(base.gain);                              // rhythmic "scritch scritch"
    s.connect(f); f.connect(g); g.connect(base);
    const rumble = ac.createOscillator(), rg = ac.createGain(); rumble.type = 'triangle'; rumble.frequency.value = lerp(95, 52, weight); rg.gain.value = 0.05*weight*cfg.vol;
    rumble.connect(rg); rg.connect(base);
    out(base, {pan, rev:0.05}); s.start(t); l.start(t); rumble.start(t);
    let stopped = false;
    return {
      stop(){ if (stopped) return; stopped = true; const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.03); rg.gain.setTargetAtTime(0, n, 0.03);
              setTimeout(() => { try { s.stop(); l.stop(); rumble.stop(); } catch(e){} }, 300); },
      set(p){ base.gain.value = 0.5; },
    };
  };

  S.tip = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;
    if (!smp('wood_squeak_0' + pick([1,2]), {vol:0.16, rate:rnd(1.2,1.5), pan:p, hp:500, dur:0.25})) tone({t, f:520, f2:380, dur:0.15, type:'sawtooth', lp:900, vol:0.07, pan:p});
    tone({t:t+0.02, f:rnd(1700,2100), dur:0.05, vol:0.05, pan:p, fm:{ratio:3, depth:0.5, decay:0.04}}); };

  S.fall = (o = {}) => { if (!ac) return; const t = ac.currentTime, d = o.dur || 0.6, p = o.pan || 0, m = o.mass || 0.5;
    noise({t, type:'bandpass', f:lerp(1800,900,m), f2:lerp(500,220,m), q:0.9, dur:d, a:d*0.7, vol:0.2, pan:p});
    tone({t, f:lerp(900,520,m), f2:lerp(260,120,m), dur:d, a:d*0.8, vol:0.05, type:'triangle', pan:p}); };

  // ---- the big one: object-specific smash. kind: ceramic | glass | plastic | metal | pot | laptop | phone | lamp | glasses | vase
  S.impact = (kind, o = {}) => {
    if (!ac) return;
    const t = (o.t || ac.currentTime) + 0.005, m = clamp(o.mass === undefined ? 0.5 : o.mass, 0.1, 1), p = o.pan || 0, big = o.big;
    const glassPick = () => pick(['glass_breaking_01','glass_breaking_06','glass_breaking_02','glass_breaking_05'].filter(has));
    thump(t, m, p, kind === 'glass' || kind === 'glasses' ? 0.45 : 0.9);
    snap(t, 0.5, p);
    if (kind === 'glass'){
      const s = glassPick(); if (s) smp(s, {t, vol:0.75, rate:rnd(0.96,1.12), pan:p, rev:0.2});
      shards(t, 16, {t0:0.05, span:0.6, fmin:3500, fmax:9500, vol:1, type:'glass', pan:p});
      if (has('glass_falling_0' + 1)) smp('glass_falling_0' + pick([1,2,3,4]), {t:t + 0.12, vol:0.35, rate:rnd(1,1.2), pan:p, hp:1500});
      tone({t, f:2600, f2:3100, dur:0.18, vol:0.12, fm:{ratio:3.5, depth:0.7, decay:0.12}, pan:p, rev:0.4});
    } else if (kind === 'glasses'){
      if (has('glass_hit_01')) smp('glass_hit_0' + pick([1,2]), {t, vol:0.8, rate:rnd(1.1,1.3), pan:p, rev:0.15});
      tone({t, f:3200, f2:2900, dur:0.3, vol:0.1, fm:{ratio:2.9, depth:0.5, decay:0.2}, pan:p, rev:0.3});
      shards(t, 7, {t0:0.06, span:0.35, fmin:4200, fmax:9000, vol:0.9, type:'glass', pan:p});
      noise({t:t+0.1, f:1500, q:3, dur:0.03, vol:0.12, pan:p});       // frame rattle
    } else if (kind === 'ceramic' || kind === 'pot' || kind === 'vase'){
      const heavy = kind === 'vase' ? 0.6 : (kind === 'pot' ? 0.85 : 1);
      const src = pick(['glass_breaking_03','glass_breaking_04','glass_breaking_01'].filter(has));
      if (src) smp(src, {t, vol:0.7, rate:rnd(0.62,0.82)*heavy, lp:7000, pan:p, rev:0.18});
      for (const [f, d] of [[rnd(1300,1700), 0.05],[rnd(2100,2700), 0.04],[rnd(800,1100), 0.07]])
        tone({t:t + rnd(0,0.02), f, f2:f*0.55, dur:d, vol:0.22, type:'triangle', a:0.0007, pan:p});
      shards(t, kind === 'vase' ? 26 : 14, {t0:0.04, span:kind === 'vase' ? 0.9 : 0.5, fmin:1500, fmax:4000, vol:1, type:'ceramic', pan:p});
      if (kind === 'pot'){ noise({t:t+0.02, type:'lowpass', f:1400, q:0.7, dur:0.3, vol:0.32, pink:true, a:0.01, pan:p}); noise({t:t+0.06, f:2500, q:1, dur:0.1, vol:0.08, pan:p}); }
    } else if (kind === 'metal' || kind === 'lamp'){
      const base = rnd(520, 760)*(kind === 'lamp' ? 0.8 : 1);
      if (has('metal_hit_0' + 1)) smp('metal_hit_0' + pick([1,2,3,4,5,6]), {t, vol:0.7, rate:rnd(0.9,1.1), pan:p, rev:0.2});
      ring(base, t, 0.5, 0.9 + 0.6*m, p);
      if (kind === 'lamp'){                                                // bulb pop + spring + glass bits
        tone({t:t+0.03, f:2400, f2:700, dur:0.08, type:'square', lp:3500, vol:0.12, pan:p});
        shards(t, 8, {t0:0.05, span:0.3, fmin:4000, fmax:9000, vol:0.8, type:'glass', pan:p});
        tone({t:t+0.1, f:220, f2:520, dur:0.35, type:'triangle', vol:0.07, pan:p, vib:{rate:22, depth:60}});   // sproing
        noise({t:t+0.14, type:'highpass', f:6500, dur:0.25, vol:0.05, trem:{rate:55, depth:0.9}, pan:p});      // electric fizz
      }
    } else if (kind === 'phone' || kind === 'plastic' || kind === 'laptop'){
      const hit = pick(['hit_05','hit_09','hit_10','hit_11','hit_13'].filter(has));
      if (hit) smp(hit, {t, vol:0.6, rate:rnd(kind === 'laptop' ? 0.7 : 1, kind === 'laptop' ? 0.85 : 1.25), pan:p});
      noise({t, f:rnd(1600,2200), q:2.2, dur:0.05, vol:0.3, pan:p});
      tone({t, f:rnd(380,460), f2:170, dur:0.07, type:'square', lp:1800, vol:0.18, pan:p, a:0.001});
      for (let i=1;i<=3;i++){                                              // bouncing rattle
        noise({t:t + 0.07*i*i*0.7, f:rnd(1500,2600), q:3, dur:0.025, vol:0.16/i, pan:p});
        tone({t:t + 0.07*i*i*0.7, f:rnd(300,420)/i, f2:120, dur:0.04, type:'square', lp:1500, vol:0.08/i, pan:p});
      }
      if (kind === 'phone'){                                               // electronic death throes
        tone({t:t+0.04, f:2800, f2:260, dur:0.22, type:'square', lp:4000, vol:0.09, pan:p, vib:{rate:35, depth:300}});
        noise({t:t+0.05, type:'highpass', f:5000, dur:0.18, vol:0.08, trem:{rate:45, depth:1}, pan:p});
        shards(t, 5, {t0:0.04, span:0.25, fmin:4500, fmax:8500, vol:0.7, type:'glass', pan:p});
      }
      if (kind === 'laptop'){
        ring(rnd(300,380), t, 0.35, 0.7, p);                               // metal frame clank
        for (let i=0;i<9;i++) noise({t:t + 0.05 + Math.random()*0.35, f:rnd(2200,4500), q:5, dur:0.012, vol:rnd(0.06,0.15), pan:p});   // keys flying
        tone({t:t+0.1, f:1400, f2:90, dur:0.5, type:'sawtooth', lp:2200, vol:0.07, pan:p, vib:{rate:18, depth:120}});             // power-down whine
        noise({t:t+0.12, type:'highpass', f:6000, dur:0.35, vol:0.07, trem:{rate:60, depth:1}, pan:p});
      }
    }
    // cartoon sweetener on big damage: star twinkle + low "whomp"
    if (big){
      [0, 2, 4, 7, 9].forEach((s, i) => tone({t:t + 0.12 + i*0.06, f:1568*st(s), dur:0.22, vol:0.09, a:0.002, pan:p, rev:0.35, fm:{ratio:2, depth:0.3, decay:0.1}}));
      tone({t, f:70, f2:30, dur:0.5, vol:0.5*cfg.bass, drive:3, pan:p});
      doDuck(0.55, 0.05, 0.28);
    }
    if (kind === 'vase'){
      doDuck(0.4, 0.09, 0.4);
      [0,4,7,12,16,19,24].forEach((s, i) => bell(880*st(s), t + 0.25 + i*0.075, 0.09, 1.1, p + (i-3)*0.1));   // heavenly sparkle
      noise({t:t+0.05, type:'lowpass', f:900, dur:0.9, vol:0.3, pink:true, a:0.02, pan:p, rev:0.3});
    }
  };

  // ---- money: pentatonic ladder rises with combo
  const LAD = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  S.cash = (combo = 1, amount = 20) => {
    if (!ac) return; const t = ac.currentTime + 0.12, lvl = clamp(Math.round((combo - 1)*2) , 0, 8);
    const base = 659*st(LAD[Math.min(8, lvl)]);
    bell(base, t, 0.2, 0.55, 0); bell(base*1.5, t + 0.05, 0.12, 0.5, 0);
    if (amount >= 90){ bell(base*2, t + 0.1, 0.12, 0.6, 0); }
    if (amount >= 300){ [0, 4, 7, 12].forEach((s, i) => bell(base*st(s), t + 0.1 + i*0.06, 0.11, 0.7, (i-1.5)*0.15)); }
    noise({t, type:'highpass', f:7000, dur:0.08, vol:0.05, a:0.001});
  };
  S.comboUp = (level) => { if (!ac) return; const t = ac.currentTime + 0.05, f = 440*st(LAD[clamp(level*2, 0, 8)]);
    tone({t, f:f*0.5, f2:f*2, dur:0.18, type:'sawtooth', lp:3000, vol:0.06, a:0.01});
    bell(f*2, t + 0.12, 0.15, 0.6, 0); };

  S.land = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0, m = o.mass || 0.4;     // sky item lands on the shelf
    if (!smp('wood_hit_0' + pick([1,2,3,4,5]), {vol:0.35 + 0.2*m, rate:rnd(0.95,1.15), pan:p, lp:3500}))
      noise({t, f:900, q:0.8, dur:0.06, vol:0.2, pan:p});
    tone({t, f:lerp(220,120,m), f2:70, dur:0.09, vol:0.3, a:0.001, pan:p, drive:1.5}); };
  S.skyWhistle = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;
    tone({t, f:rnd(1500,1900), f2:rnd(500,700), dur:o.dur || 0.45, a:0.05, type:'sine', vol:0.04, pan:p}); };
  S.promote = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;
    [0, 7, 12].forEach((s, i) => tone({t:t + i*0.055, f:880*st(s), dur:0.2, type:'triangle', vol:0.1, a:0.002, pan:p, rev:0.3}));
    noise({t, type:'highpass', f:7500, dur:0.15, vol:0.04, pan:p}); };

  S.creak = (level = 0.5) => { if (!ac) return; const t = ac.currentTime;                                   // strained shelf
    if (!smp('wood_squeak_0' + pick([1,2]), {vol:0.35 + 0.3*level, rate:rnd(0.55,0.85), lp:2500, dur:0.5})) tone({t, f:90, f2:70, dur:0.4, type:'sawtooth', lp:400, vol:0.15});
    tone({t, f:rnd(60,80), f2:48, dur:0.5, type:'sawtooth', lp:260, vol:0.12*(0.5 + level), vib:{rate:9, depth:30}});
    if (has('wood_cracking_01') && Math.random() < 0.5) smp('wood_cracking_0' + pick([1,2,3,4]), {t:t + 0.15, vol:0.35, rate:rnd(0.9,1.1)}); };
  S.collapse = () => { if (!ac) return; const t = ac.currentTime + 0.01;
    doDuck(0.5, 0.2, 0.7);
    for (const [n, dt, v] of [['wood_breaking_L01',0,0.9],['wood_breaking_01',0.05,0.7],['wood_cracking_03',0.12,0.6],['wood_breaking_L02',0.22,0.6]]) smp(n, {t:t + dt, vol:v, rate:rnd(0.8,1), rev:0.25});
    tone({t, f:80, f2:26, dur:1.1, vol:0.9, drive:3, rev:0.2});
    noise({t, type:'lowpass', f:2500, f2:300, dur:1.0, vol:0.5, pink:true, a:0.01, rev:0.3});
    for (let i=0;i<16;i++) S.impactTick(t + 0.1 + Math.random()*0.9, rnd(-0.6,0.6));                      // debris raining down
    shards(t, 10, {t0:0.1, span:0.8, fmin:2000, fmax:6500, vol:1, type:'ceramic'});
    shards(t, 10, {t0:0.2, span:0.8, fmin:4000, fmax:9000, vol:0.8, type:'glass'});
    tone({t:t + 0.6, f:420, f2:70, dur:0.9, type:'sawtooth', lp:1500, vol:0.12, rev:0.3}); };             // slide-whistle "oh no"
  S.impactTick = (t, p) => { noise({t, f:rnd(900,3000), q:rnd(1,4), dur:0.04, vol:rnd(0.08,0.22), pan:p}); tone({t, f:rnd(120,260), f2:60, dur:0.06, vol:0.15, pan:p}); };

  /* ---- owner ---- */
  S.phoneTap = () => { if (!ac) return; const t = ac.currentTime;
    noise({t, f:rnd(3000,4200), q:2.5, dur:0.012, vol:0.05, pan:0.1}); noise({t:t+0.07, f:rnd(2600,3600), q:2.5, dur:0.012, vol:0.04, pan:0.1}); };
  S.phoneBuzz = () => { if (!ac) return; const t = ac.currentTime;
    for (const d of [0, 0.22]) { tone({t:t+d, f:170, dur:0.16, type:'sawtooth', lp:600, vol:0.12, a:0.005, vib:{rate:60, depth:200}, pan:0.1});
      noise({t:t+d, f:300, q:2, dur:0.16, vol:0.06, trem:{rate:50, depth:1}}); } };
  S.rise = (legs = 0) => { if (!ac) return; const t = ac.currentTime, k = clamp(legs/60, 0, 1);    // creepy stretch: legs getting longer
    tone({t, f:lerp(140,90,k), f2:lerp(300,420,k), dur:0.8, a:0.05, type:'triangle', vol:0.12, vib:{rate:5, depth:40}, rev:0.25, lp:1500});
    tone({t, f:lerp(85,55,k), f2:lerp(160,230,k), dur:0.8, a:0.05, type:'sawtooth', vol:0.07, lp:500, rev:0.2});
    smp('wood_squeak_0' + pick([1,2]), {t, vol:0.3, rate:rnd(0.7,0.95), lp:2200, dur:0.5});
    const pops = 2 + Math.round(k*6);
    for (let i=0;i<pops;i++){ const tt = t + 0.1 + Math.random()*0.65; noise({t:tt, f:rnd(500,1400), q:4, dur:0.02, vol:rnd(0.15,0.3)}); tone({t:tt, f:rnd(110,220), f2:60, dur:0.05, vol:0.15, a:0.001}); }   // knuckle / bone pops
    doDuck(0.8, 0.1, 0.3); };
  S.aim = () => { if (!ac) return; const t = ac.currentTime;
    noise({t, type:'bandpass', f:300, f2:3500, q:1.5, dur:0.55, a:0.4, vol:0.12, rev:0.2});
    tone({t, f:110, f2:220, dur:0.55, a:0.35, type:'sawtooth', lp:900, vol:0.08, det:8}); tone({t, f:110, f2:221, dur:0.55, a:0.35, type:'sawtooth', lp:900, vol:0.08, det:-8});
    S.heart(t + 0.05, 0.6); S.heart(t + 0.45, 0.8); };
  S.heart = (t, v = 1) => { t = t || ac.currentTime; tone({t, f:68, f2:38, dur:0.14, vol:0.5*v*cfg.bass, a:0.003, drive:1.6}); tone({t:t+0.17, f:60, f2:34, dur:0.14, vol:0.34*v*cfg.bass, a:0.003, drive:1.6}); };
  let gazeNodes = null;
  S.gazeStart = () => { if (!ac || gazeNodes) return; const t = ac.currentTime;                                // soft heartbeat + low hum (he is looking: noticeable, not a jump scare)
    S.heart(t, 0.7);
    const g = ac.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.12*cfg.vol*scale, t + 0.5);
    const lp = filt('lowpass', 200, 0.7); lp.frequency.linearRampToValueAtTime(360, t + 1.6);
    const os = [55, 82.5].map(f => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); o.start(t); return o; });
    const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 3; lg.gain.value = 0.025*cfg.vol*scale; l.connect(lg); lg.connect(g.gain); l.start(t);
    lp.connect(g); out(g, {rev:0.15}); gazeNodes = {g, os, l}; };
  S.gazeStop = () => { if (!ac || !gazeNodes) return; const n = ac.currentTime, gn = gazeNodes; gazeNodes = null;
    gn.g.gain.cancelScheduledValues(n); gn.g.gain.setTargetAtTime(0, n, 0.08); setTimeout(() => { try { gn.os.forEach(o => o.stop()); gn.l.stop(); } catch(e){} }, 600); };
  S.shout = () => { if (!ac) return;                                                                            // caught: a surprised little meow (the synthetic "HEY!!" voice sounded fake and creepy)
    S.meow('kitten'); doDuck(0.8, 0.15, 0.3); };
  S.bonk = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;                              // item hits the owner's head
    if (!smp('hit_0' + pick([2,6,7,8]), {vol:0.8, rate:rnd(0.85,1.05), pan:p})) noise({t, f:900, dur:0.08, vol:0.4});
    thump(t, 0.7, p, 1); snap(t, 0.4, p, 2200);
    tone({t:t+0.02, f:520, f2:150, dur:0.5, type:'sine', vol:0.35, vib:{rate:20, depth:80}, pan:p, a:0.002});   // cartoon boing
    tone({t:t+0.02, f:1040, f2:300, dur:0.4, type:'triangle', vol:0.1, vib:{rate:20, depth:100}, pan:p});
    for (let i=0;i<5;i++) tone({t:t + 0.18 + i*0.07, f:rnd(2200,3200), dur:0.12, vol:0.07, vib:{rate:14, depth:150}, rev:0.3, pan:p + rnd(-0.3,0.3)});  // dizzy chirps
    doDuck(0.6, 0.06, 0.25); };
  S.throwWhoosh = (o = {}) => { if (!ac) return; const t = ac.currentTime, p = o.pan || 0;
    noise({t, f:500, f2:4500, q:1.2, dur:0.3, a:0.12, vol:0.28, pan:p, rev:0.1}); tone({t, f:300, f2:1100, dur:0.25, a:0.1, type:'triangle', vol:0.06, pan:p}); };

  /* ---- skill check ---- */
  S.skillAppear = () => { if (!ac) return; const t = ac.currentTime;                                            // two soft notes: "your turn"
    tone({t, f:880, dur:0.12, type:'triangle', vol:0.07, a:0.008});
    tone({t:t+0.09, f:660, dur:0.18, type:'triangle', vol:0.06, a:0.008, rev:0.2});
    S.heart(t + 0.05, 0.3); };
  S.skillTick = (i = 0) => { if (!ac) return; const t = ac.currentTime; noise({t, f:4200 + (i%2)*500, q:4, dur:0.012, vol:0.06}); tone({t, f:i%2 ? 1900 : 1700, dur:0.025, vol:0.04, a:0.001}); };
  S.skillGreat = () => { if (!ac) return; const t = ac.currentTime;
    [0, 4, 7, 12].forEach((s, i) => bell(1046*st(s), t + i*0.045, 0.14, 0.7, (i-1.5)*0.2));
    noise({t, f:400, f2:5000, q:1.1, dur:0.28, a:0.06, vol:0.3, rev:0.1});                                      // dash whoosh
    tone({t, f:200, f2:900, dur:0.22, type:'sawtooth', lp:2500, vol:0.07, a:0.03});
    S.meow('short'); doDuck(0.75, 0.05, 0.2); };
  S.skillFail = () => { if (!ac) return; const t = ac.currentTime;                                              // soft low "bup"
    tone({t, f:180, f2:110, dur:0.25, type:'triangle', vol:0.18, a:0.005});
    doDuck(0.8, 0.1, 0.25); };

  /* ---- cat ---- */
  // real CC0 recordings (OpenGameArt: "meow" by IgnasD, "Kitten Mew", "cat purr meow" by Kerzoven), pitched / shaped per situation
  S.meow = (kind = 'normal', o = {}) => { if (!ac) return; const t = ac.currentTime + 0.01, p = o.pan || 0;
    const R = (a, b) => rnd(a, b);
    const cfgs = {
      normal: ['meow_a',      {vol:0.9,  rate:R(0.94,1.06), rev:0.15}],
      short:  ['meow_a',      {vol:0.75, rate:R(1.22,1.38), rev:0.12, dur:0.38}],
      kitten: ['meow_kitten', {vol:0.7,  rate:R(0.98,1.06), rev:0.15}],
      sad:    ['meow_soft',   {vol:0.8,  rate:R(0.86,0.95), rev:0.25, dur:1.2}],
      yowl:   ['meow_food',   {vol:1,    rate:R(0.66,0.74), rev:0.3, drive:2.2}],
      purr:   ['meow_purr1',  {vol:0.8,  rate:1, rev:0.15}],
    };
    const [name, c] = cfgs[kind] || cfgs.normal;
    if (o.sample) { smp(o.sample, Object.assign({pan:p, vol:0.9, rate:o.rate || 1, rev:0.15}, {})); return; }
    if (!smp(name, Object.assign({pan:p}, c))){                                                              // fallback if samples are missing
      voice({t, f0:[620, 900, 520], dur:0.42, vowels:['i','ae','o'], vol:0.25, vibDepth:14, breath:0.18, pan:p, rev:0.2}); } };

  /* ---- UI / game flow ---- */
  S.click = () => { if (!ac) return; const t = ac.currentTime; tone({t, f:900, f2:1400, dur:0.06, type:'triangle', vol:0.18, a:0.001}); noise({t, f:3500, q:2, dur:0.01, vol:0.08}); };
  S.ready = () => { if (!ac) return; const t = ac.currentTime; tone({t, f:1318, dur:0.1, type:'triangle', vol:0.07}); tone({t:t+0.07, f:1760, dur:0.16, type:'triangle', vol:0.07, rev:0.3}); };
  S.start = () => { if (!ac) return; const t = ac.currentTime; [0, 4, 7, 12].forEach((s, i) => tone({t:t + i*0.07, f:523*st(s), dur:0.2, type:'triangle', vol:0.13, rev:0.3})); S.meow('kitten'); };
  S.bust = () => { if (!ac) return; const t = ac.currentTime + 0.1;                                            // two falling notes, ~0.6 s
    tone({t, f:392, dur:0.22, type:'triangle', vol:0.13, a:0.02, rev:0.25});
    tone({t:t+0.18, f:311, dur:0.42, type:'triangle', vol:0.13, a:0.02, rev:0.3}); };
  S.collapseOver = () => { if (!ac) return; const t = ac.currentTime + 0.1;                                     // the same idea, lower
    tone({t, f:330, dur:0.22, type:'triangle', vol:0.13, a:0.02, rev:0.25});
    tone({t:t+0.18, f:247, dur:0.45, type:'triangle', vol:0.13, a:0.02, rev:0.3}); };
  // everything the owner does is half as loud (cfg.owner)
  for (const n of ['phoneTap', 'phoneBuzz', 'rise', 'aim', 'gazeStart', 'shout']){
    const f = S[n], quiet = (n === 'gazeStart' || n === 'aim');                    // the "he is looking at you" sounds are extra quiet
    S[n] = (...a) => { const old = scale; scale = cfg.owner * (quiet ? cfg.gaze : 1); try { return f(...a); } finally { scale = old; } };
  }

  /* ---------- public ---------- */
  return {
    cfg, S, init, load, buffers, has, panOf,
    get ctx(){ return ac; },
    get failed(){ return failed; },
    peak(){ if (!an) return 0; const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let m = 0; for (const x of d) m = Math.max(m, Math.abs(x)); return m; },
    setMuted(m){ muted = m; if (master) master.gain.value = m ? 0 : cfg.master; },
    get muted(){ return muted; },
    setMaster(v){ cfg.master = v; if (master && !muted) master.gain.value = v; },
    setSfxVol(v){ sfxLevel = v; if (sfxVol) sfxVol.gain.value = v; },
    setMusicVol(v){ musicLevel = v; if (musicIn) musicIn.gain.value = v; },
    get musicIn(){ return musicIn; },
    setReverb(v){ cfg.reverb = v; if (revSend) revSend.gain.value = v; },
    play(name, ...a){ if (!init() || muted) return; try { return S[name](...a); } catch(e){ console.warn('sfx', name, e); } },
    impact(kind, o){ if (!init() || muted) return; try { S.impact(kind, o); } catch(e){ console.warn('sfx impact', e); } },
  };
})();
/* AUDIO:END */
