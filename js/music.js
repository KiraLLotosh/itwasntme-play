'use strict';
/* Music glue: decides when the lo-fi ambient (js/ambient.js) plays, which mood, and how loud it is next to the game sounds.
   Mood: day / night follows the sky during a run, "play" between runs (game over, characters).
   Ducked while the owner looks and when the run ends; silent when sound is muted (also during ads) and in a hidden tab.
   It keeps playing on the pause screen so the MUSIC slider can be heard. The two volume sliders are saved (iwm_vsfx, iwm_vmus). */
const Music = (() => {
  const DEF = 0.7;                       // default MUSIC slider position = the level tuned in the Sound Lab
  const SFX_MIX = 0.85, MUS_MIX = 1.05;  // overall balance (user's ear): game sounds -15%, music +5%; the sliders scale on top of this
  const read = (k, d) => { const v = parseFloat(LS.get(k)); return isNaN(v) ? d : clamp(v, 0, 1); };
  const vol = {sfx:read('iwm_vsfx', 1), music:read('iwm_vmus', DEF)};
  let amb = null, duck = null, playing = null, level = 1;
  const apply = kind => { if (kind === 'sfx') SFX.setSfxVol(vol.sfx*SFX_MIX); else SFX.setMusicVol(vol.music/DEF*MUS_MIX); };
  apply('sfx'); apply('music');
  function set(kind, v){
    vol[kind] = v; LS.set(kind === 'sfx' ? 'iwm_vsfx' : 'iwm_vmus', String(v));
    apply(kind);
  }
  function wantedMood(){
    if (!G || G.mode === 'over') return 'play';
    return nightNow() > 0.5 ? 'night' : 'day';
  }
  function wantedLevel(){
    if (!G || G.paused || G.mode === 'over') return 1;
    if (G.mode !== 'play') return 0.25;                                          // caught / collapsing: let the ending be heard
    const o = G.owner.state;
    return (G.skill || o === 'AIM' || o === 'GAZE') ? 0.35 : o === 'RISE' ? 0.6 : 1;
  }
  function stop(){ if (playing){ amb.stop(); playing = null; } }
  function update(){                                                             // called every frame
    const ac = SFX.ctx;
    if (!ac || ac.state !== 'running' || SFX.muted || vol.music <= 0 || document.hidden){ stop(); return; }   // (browsers allow sound only after the first tap / key)
    if (!amb){ duck = ac.createGain(); duck.connect(SFX.musicIn); amb = Ambient.create(ac, duck); }
    const mood = wantedMood(), l = wantedLevel();
    if (l !== level){ duck.gain.setTargetAtTime(l, ac.currentTime, l < level ? 0.08 : 0.5); level = l; }     // down fast, back up slowly
    if (!playing) amb.start(mood); else if (playing !== mood) amb.setMood(mood);
    playing = mood;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return {update, set, vol, get playing(){ return playing; }};
})();
