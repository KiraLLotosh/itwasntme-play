'use strict';
/* Poki integration shim (https://developers.poki.com/guide/sdk-html5).
   Works with and without the SDK: when PokiSDK is missing (local dev, itch.io, GitHub Pages) every call is a safe no-op.
   Rules it follows:
   - gameplayStart() on the player's first input (starting / resuming a run), never on load, never twice in a row
   - gameplayStop() on ANY interruption: pause, menu, run over
   - commercialBreak() only when the player asks to continue: AGAIN / PLAY (not the very first one) / RESUME.
     Sequence: gameplayStop -> mute + block input -> commercialBreak -> unmute -> gameplayStart
   - no SDK events while an ad is showing */
const Poki = (() => {
  const sdk = () => (typeof PokiSDK !== 'undefined' && PokiSDK) || null;
  const safe = f => { try { return f(); } catch (e) { console.warn('poki', e); } };
  let playing = false, busy = false, first = true;
  function init(done){
    const go = () => { safe(() => { const s = sdk(); if (s) s.gameLoadingFinished(); }); pill(); if (done) done(); };
    const s = sdk();
    if (!s){ go(); return; }
    safe(() => s.init().then(go).catch(go));
  }
  // Poki's overlay pill sits in a top corner of the page (default 24 px from the top) = on top of our pause / mute buttons on a phone.
  // On a narrow (portrait) page push it below the HUD row; on a wide page the pill is beside the phone-shaped game, so keep the default.
  let pillTop = -1;
  function pill(){
    const s = sdk(); if (!s || !s.movePill || typeof wrap === 'undefined') return;
    const narrow = innerWidth <= wrap.clientWidth + 10, top = narrow ? Math.round(wrap.getBoundingClientRect().top + UPX*32) : 24;
    if (top === pillTop) return; pillTop = top;
    safe(() => s.movePill(0, top));
  }
  function start(){ if (playing || busy) return; playing = true; safe(() => { const s = sdk(); if (s) s.gameplayStart(); }); }
  function stop(){ if (!playing) return; playing = false; safe(() => { const s = sdk(); if (s) s.gameplayStop(); }); }
  function commercialBreak(){
    stop();
    const s = sdk();
    if (!s) return Promise.resolve();
    busy = true; const wasMuted = SFX.muted; SFX.setMuted(true); stopLoops();
    const shield = document.getElementById('adShield'); if (shield) shield.classList.remove('hidden');
    return new Promise(resolve => {
      let done = false;
      const end = () => { if (done) return; done = true; busy = false; SFX.setMuted(wasMuted); if (shield) shield.classList.add('hidden'); resolve(); };
      try { s.commercialBreak(() => {}).then(end).catch(end); } catch (e) { end(); }
    });
  }
  return {
    init, pill, start, stop, commercialBreak,
    get busy(){ return busy; },
    takeFirst(){ const f = first; first = false; return f; },
  };
})();
