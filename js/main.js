'use strict';
/* Main loop and debug URL switches */

let last = null, errStreak = 0;
function frame(now){
  requestAnimationFrame(frame);                        // schedule FIRST: one exception can never stop the loop again
  try {
    if (last === null) last = now;                     // the first rAF timestamp can be older than load time: never a negative dt
    const dt = Math.max(0, Math.min(0.05, (now-last)/1000)); last = now;
    update(dt); render(); updateHud(); Music.update();
    drawPageBg(now);
    if (!$('menu').classList.contains('hidden')) drawMenuCat(now);
    errStreak = 0;
  } catch (err){
    Stats.error(err);
    if (++errStreak === 1) console.error(err);
    if (errStreak >= 90){ errStreak = 0; try { goMenu(); } catch (e2) {} }   // it keeps failing: fall back to the menu instead of a dead screen
  }
}
requestAnimationFrame(frame);

Poki.init();


