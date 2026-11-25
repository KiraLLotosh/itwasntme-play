'use strict';
/* Seeded RNG, math helpers, DOM references, canvas scaling */

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const lerp = (a,b,t) => a + (b-a)*t;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// last input kind decides the wording of hints ("TAP" vs "PRESS SPACE")
let inputMode = 'desk';
try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) inputMode = 'touch'; } catch (e) {}
// "EFFECTS: LOW" (menu): no full-screen flashes, much weaker screen shake (accessibility)
const FX = {low: LS.get('iwm_fx') === 'low'};

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const wrap = $('wrap'), cv = $('c'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
let UPX = 2.5;                                                    // css px per internal pixel (set in resize)
function resize(){
  let h = innerHeight, w = h*9/16;
  if (w > innerWidth){ w = innerWidth; h = w*16/9; }
  wrap.style.width = w+'px'; wrap.style.height = h+'px';
  wrap.style.setProperty('--u', (w/180) + 'px'); UPX = w/180; if (typeof Poki !== 'undefined') Poki.pill();          // one internal pixel in screen px; all UI sizes are multiples of it
}
addEventListener('resize', resize); resize();
