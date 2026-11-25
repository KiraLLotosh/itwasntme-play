'use strict';
/* Sound glue: loads the recordings into the engine, mute state, sfx() helper, which item sounds like what */


SFX.load(SAMPLE_DATA);
const LS = {get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }};
LS.ok = (() => { try { localStorage.setItem('iwm_t', '1'); localStorage.removeItem('iwm_t'); return true; } catch (e) { return false; } })();     // false in private mode
SFX.setMuted(LS.get('iwm_mute') === '1');
SFX.init();                                   // creates the context early (suspended) so recordings are decoded before the first tap
function audio(){ return SFX.init(); }
function beep(){}                             // legacy placeholder, real sounds are SFX.play(...)
// vibration only after the player has touched the page (browsers refuse it before that and log a warning)
const vib = p => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch(e){} };
const sfx = (name, ...a) => SFX.play(name, ...a);
const SND = {mug:['ceramic',0.25], remote:['plastic',0.3], glass:['glass',0.3], flower:['pot',0.45], glasses:['glasses',0.25],
             phone:['phone',0.35], lamp:['lamp',0.6], laptop:['laptop',0.85], vase:['vase',1]};
function stopLoops(){ if (G && G.pushH){ G.pushH.stop(); G.pushH = null; } sfx('gazeStop'); }
