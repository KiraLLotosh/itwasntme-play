'use strict';
/* Generated lo-fi ambient (used by the game via js/music.js, and by the Sound Lab).
   No recordings: electric-piano chords, soft bass, dusty drums, a sparse melody and vinyl crackle, scheduled a little ahead of time.
     const amb = Ambient.create(audioContext, destinationNode);
     amb.start('day' | 'night' | 'play');  amb.setMood(id) (changes at the next bar, no gap);  amb.stop();  amb.set('vol' | 'drums' | 'crackle' | 'melody', value) */
const Ambient = (() => {
  const hz = m => 440*Math.pow(2, (m - 69)/12);                  // MIDI note -> frequency
  const MOODS = {
    day:   {name:'Дневное', bpm:74, swing:0.16, lp:3200, chords:[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]],   // Fmaj7 Em7 Dm7 Cmaj7
            scale:[72,74,76,79,81,84], melody:0.16, kick:[0,5], snare:[2,6], hat:0.8},
    night: {name:'Ночное', bpm:62, swing:0.2, lp:1900, chords:[[45,52,55,60],[41,48,52,57],[43,50,53,58],[40,47,50,55]],     // Am7 Fmaj7 Gm7 Em7
            scale:[69,72,74,76,79], melody:0.09, kick:[0], snare:[4], hat:0.35},
    play:  {name:'Игривое', bpm:86, swing:0.22, lp:4000, chords:[[48,52,55,59],[45,48,52,55],[50,53,57,60],[43,47,50,53]],   // Cmaj7 Am7 Dm7 G7
            scale:[72,76,79,81,84,86], melody:0.34, kick:[0,3,5], snare:[2,6], hat:1},
  };
  function create(ac, dest){
    const opt = {vol:0.5, drums:1, crackle:1, melody:1};
    const out = ac.createGain(), tone = ac.createBiquadFilter(), mix = ac.createGain();
    tone.type = 'lowpass'; tone.Q.value = 0.5; out.gain.value = 0;
    mix.connect(tone); tone.connect(out); out.connect(dest);
    const noise = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
    { const d = noise.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
    // vinyl: one looping buffer with faint hiss and random pops
    const dust = ac.createBuffer(1, ac.sampleRate*7, ac.sampleRate);
    { const d = dust.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.012;
      for (let n=0;n<70;n++){ const p = Math.floor(Math.random()*(d.length-200)), a = 0.08 + Math.pow(Math.random(), 3)*0.6;
        for (let i=0;i<60;i++) d[p+i] += (Math.random()*2-1)*a*Math.exp(-i/9); } }
    // slow tape wobble shared by all pitched voices
    const wob = ac.createOscillator(), wobAmt = ac.createGain(); wob.frequency.value = 0.55; wobAmt.gain.value = 7; wob.connect(wobAmt); wob.start();
    let pending = null, mood = MOODS.day, timer = null, crackleSrc = null, crackleGain = null, step = 0, nextT = 0;

    function env(t, peak, attack, dur){
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(mix); return g;
    }
    function osc(type, f, t, dur, to){
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); wobAmt.connect(o.detune);
      o.connect(to); o.start(t); o.stop(t + dur + 0.05); o.onended = () => { try { wobAmt.disconnect(o.detune); } catch(e){} };
      return o;
    }
    function keys(note, t, dur, vol){                          // soft electric piano: sine + a decaying FM "tine"
      const g = env(t, vol, 0.025, dur), c = osc('sine', hz(note), t, dur, g);
      const m = ac.createOscillator(), mg = ac.createGain(); m.frequency.value = hz(note);
      mg.gain.setValueAtTime(hz(note)*0.9, t); mg.gain.exponentialRampToValueAtTime(hz(note)*0.08, t + 0.5);
      m.connect(mg); mg.connect(c.frequency); m.start(t); m.stop(t + dur + 0.05);
    }
    function hit(t, type, f, q, vol, dur){
      const s = ac.createBufferSource(); s.buffer = noise; const flt = ac.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = env(t, vol*opt.drums, 0.002, dur); s.connect(flt); flt.connect(g); s.start(t, Math.random()*1.5); s.stop(t + dur + 0.02);
    }
    function kick(t){
      if (!opt.drums) return;
      const g = env(t, 0.32*opt.drums, 0.004, 0.28), o = ac.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
      o.connect(g); o.start(t); o.stop(t + 0.32);
    }
    function playStep(i, t){                                   // one eighth note; a bar = 8 steps, one chord per bar
      const beat = 60/mood.bpm, s = i % 8, chord = mood.chords[Math.floor(i/8) % mood.chords.length];
      if (s === 0) chord.forEach((n, k) => keys(n, t + k*0.028, beat*3.8, 0.07));            // rolled chord
      if (s === 5 && Math.random() < 0.6) chord.slice(1).forEach((n, k) => keys(n, t + k*0.015, beat*1.2, 0.035));
      if (s === 0 || s === 4) { const g = env(t, 0.13, 0.02, beat*1.7); osc('triangle', hz(chord[0] - 12), t, beat*1.7, g); }
      if (opt.melody && s % 2 === 0 && Math.random() < mood.melody*opt.melody) keys(mood.scale[Math.floor(Math.random()*mood.scale.length)], t, beat*1.5, 0.045);
      if (mood.kick.includes(s)) kick(t);
      if (opt.drums && mood.snare.includes(s)) hit(t, 'bandpass', 1700, 0.8, 0.09, 0.16);
      if (opt.drums && Math.random() < mood.hat) hit(t, 'highpass', 7000, 0.7, s % 2 ? 0.018 : 0.032, 0.04);
    }
    function schedule(until){
      if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;      // the timer was throttled: skip, don't play a burst of old notes
      while (nextT < until){
        if (pending && step % 8 === 0){ mood = pending; pending = null; step = 0; tone.frequency.setTargetAtTime(mood.lp, nextT, 0.8); }
        playStep(step, nextT + (step % 2 ? 30/mood.bpm*mood.swing : 0)); nextT += 30/mood.bpm; step++; }
    }
    function setCrackle(){ if (crackleGain) crackleGain.gain.value = 0.22*opt.crackle; }
    function start(id, manual){                                // manual = no timer (offline rendering: call schedule() yourself)
      stop();
      mood = MOODS[id] || MOODS.day; pending = null; step = 0; nextT = ac.currentTime + 0.08;
      tone.frequency.value = mood.lp;
      out.gain.cancelScheduledValues(ac.currentTime); out.gain.setValueAtTime(0.0001, ac.currentTime); out.gain.linearRampToValueAtTime(opt.vol, ac.currentTime + 1.2);
      crackleSrc = ac.createBufferSource(); crackleSrc.buffer = dust; crackleSrc.loop = true;
      crackleGain = ac.createGain(); setCrackle(); crackleSrc.connect(crackleGain); crackleGain.connect(out); crackleSrc.start();
      if (!manual){ schedule(ac.currentTime + 0.5); timer = setInterval(() => schedule(ac.currentTime + 0.5), 100); }
    }
    function stop(){
      if (timer){ clearInterval(timer); timer = null; }
      if (!crackleSrc) return;
      const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, 0.08);
      try { crackleSrc.stop(t + 0.5); } catch(e){} crackleSrc = null;
    }
    const setMood = id => { const m = MOODS[id] || MOODS.day; pending = m === mood ? null : m; };
    function set(k, v){ opt[k] = v; if (k === 'vol' && crackleSrc){ out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(v, ac.currentTime, 0.05); } if (k === 'crackle') setCrackle(); }
    return {start, stop, set, setMood, schedule, opt};
  }
  return {create, MOODS};
})();
