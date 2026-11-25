'use strict';
/* Constants and tuning knobs: sizes, speeds, difficulty ramp, item table */

const W = 180, H = 320;
const SHELF_Y = 120, FLOOR_Y = 268;
const SHELF_L = 10, SHELF_R = 170;     // shelf edges
const MAX_ITEMS = 8;                     // too much junk on the shelf -> it breaks
const CW = 10;                           // cat half-length (loaf)
const WALK_SPEED = 80;
const PUSH_K = 45;                       // push speed = PUSH_K / item push time (px/s)
const PUSH_MIN = 22;                     // ...but never slower than this, so even a huge vase commits the cat for ~6 s at most (it used to be up to 12 s)
// where the owner can look on the shelf
const ZONES = {L:[SHELF_L, 65], C:[65, 115], R:[115, SHELF_R]};
const ZONE_KEYS = ['L','C','R'];
/* ---------------- DIFFICULTY CURVE (tune here) ----------------
   Goal: an average run lasts about 2 minutes (bot medians: casual ~90 s, good / pro ~135 s; nobody goes much beyond ~3 min).
   * 0-GRACE s: nothing but a few slow items (the owner stays seated, his first check comes after GRACE).
   * d = diff() goes 0 -> 1 over DIFF_TIME s; everything below is a function of d. After DIFF_TIME an "overdrive" keeps
     tightening things for another 25 s (items arrive ~30% faster).
   * He checks rarely at first (calmScale) and then almost non-stop; each check has more looks, shorter warnings, wider beams;
     the skill needle gets faster and its zone narrower; items fall faster and faster until the shelf collapses.
   tools/dev/sim.js plays hundreds of simulated runs with bots to measure how long runs last: re-run it after any change here. */
const DIFF_TIME = 240, GRACE = 15;
const ease = (x, p) => Math.pow(clamp(x, 0, 1), p);
const diff = () => clamp(G.time / DIFF_TIME, 0, 1);
const overdrive = () => clamp((G.time - DIFF_TIME) / 25, 0, 1);
const SPAWN_RATE = 1.0;                  // global multiplier for how often new items fall onto the shelf (1 = the original pace)
const D = {
  spawnEvery: d => lerp(5.6, 1.8, ease(d, 1.2)) / SPAWN_RATE,   // seconds between new items on the shelf (x random 0.8..1.25)
  gravity:    d => lerp(520, 2200, d),               // how fast items fall from the sky
  calmScale: d => lerp(2.0, 0.4, ease(d, 0.85)),    // multiplies his seated time between checks (2.3-5 s base)
  riseTime:   d => lerp(0.9, 0.5, d),
  aimTime:    d => lerp(1.0, 0.28, ease(d, 0.9)),    // warning before the beam lands
  gazeTime:   d => lerp(1.3, 0.8, d),
  sitTime:    d => lerp(0.5, 0.3, d),
  zoneGrow:   d => lerp(0, 38, ease(d, 0.8)),        // px added to both sides of each gaze zone
  skillSpin: d => lerp(1.9, 0.6, ease(d, 1.0)),    // seconds for one needle turn
  skillW: d => lerp(0.32, 0.10, ease(d, 1.0)),  // success zone, fraction of a turn
  skillBuf:   d => lerp(0.42, 0.22, d),              // needle waits before spinning
  lookChance: [d => 0.08 + 0.8*d, d => 0.9*ease(d, 1.3), d => 0.85*ease(d, 2)],   // chance of a 2nd / 3rd / 4th look per check
  promoDelay: d => lerp(0.1, 0.45, ease(d*2.5, 1)),     // pause before the next item lights up after one was pushed off: short early on (the first 20 s used to have no lit item 18% of the time), the old 0.45 s from d=0.4
  fronts:     d => 1 + Math.floor(d*3.4),            // lit (pushable) items at once
};
const LEG_STEP = 5.5, LEG_MAX = 76;
function zoneRange(z, g){
  if (g === undefined) g = G.owner.g || 0;
  return [Math.max(SHELF_L, ZONES[z][0] - g), Math.min(SHELF_R, ZONES[z][1] + g)];
}
const inZone = (z, x) => { const r = zoneRange(z); return x >= r[0] && x < r[1]; };
const JUMP_DIST = 46, JUMP_DUR = 0.3, JUMP_CD = 0.9, JUMP_H = 14;     // Fika's jump: horizontal reach, airtime, cooldown (s), arc height (px)
const THROW_CD = 12;                     // seconds between throws
const STUN_TIME = 1.0;                   // how long a hit distracts the owner
const CEIL = 132;                        // underside of the shelf: he can't straighten above this

// push time (s), damage ($), size, color. Order = spawn weights.
const ITEMS = {
  mug:    {name:'Mug',    t:0.3, d:20,   w:9,  h:9,  col:'#ffb3c7', wt:14},
  remote: {name:'Remote', t:0.4, d:40,   w:12, h:6,  col:'#8f8fb8', wt:12},
  glass:  {name:'Glass',  t:0.5, d:90,   w:8,  h:12, col:'#bfeaff', wt:10},
  flower: {name:'Flower', t:0.6, d:60,   w:10, h:13, col:'#e08a62', wt:10},
  glasses:{name:'Glasses',t:0.8, d:120,  w:12, h:6,  col:'#bfeaff', wt:9},
  phone:  {name:'Phone',  t:1.0, d:300,  w:8,  h:12, col:'#8aa4ff', wt:7},
  lamp:   {name:'Lamp',   t:1.4, d:250,  w:11, h:17, col:'#ffe27a', wt:6},
  laptop: {name:'Laptop', t:2.0, d:900,  w:17, h:10, col:'#d9e7ff', wt:4},
  vase:   {name:"Grandma's vase", t:2.5, d:2000, w:12, h:17, col:'#c9a0ff', wt:2, rare:true},
};
for (const k in ITEMS) ITEMS[k].id = k;
const ITEM_KEYS = Object.keys(ITEMS);
const MONEY_SCALE = 0.4;                 // money earned = item price x this (economy tuning: 1.0 -> 0.5 -> 0.6 -> 0.4 = /1.5 when runs got longer; item prices below stay as designed)
const COMBO_MULT = [1, 1.5, 2, 3];
const COMBO_ON = false;                  // the combo multiplier is hidden for now; set to true (and unhide #comboBox) to bring it back
