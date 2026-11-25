'use strict';
/* Run state (G), starting a run, spawning items on the shelf */

let G = null;            // current run
 let seedParam = null;

const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); };
const easeOutCubic = x => 1 - Math.pow(1-x, 3);

function newRun(){
  const seed = seedParam !== null ? (parseInt(seedParam,10) >>> 0)
             : (Math.random()*4294967296) >>> 0;
  G = {
    seed,
    itemRng: mulberry32(seed ^ 0x9E3779B9),
    ownerRng: mulberry32(seed ^ 0x85EBCA6B),
    spawnRng: mulberry32(seed ^ 0x27D4EB2F),
    promoRng: mulberry32(seed ^ 0x165667B1),
    skillRng: mulberry32(seed ^ 0xC2B2AE35),
    mode:'play', time:0, damage:0, suspicion:0,
    dropsInWindow:0, combo:1, lastCombo:1, dispDmg:0,
    items:[],               // items on (or falling onto) the shelf
    spawnT:3.5,
    falling:[],             // items knocked off the shelf
    thrown:[], throwCd:5,   // items thrown at the owner
    cat:{x:90, dir:1}, catY:SHELF_Y, catPh:0, catRot:0, catHop:0, walking:false, pushing:false, dash:null, push:null, promoT:0.1, popN:0, chain:[],
    skill:null, jump:null, jumpCd:0, lockT:0, lockShake:0,
    owner:{state:'CALM', t:0, dur:0, anim:0, k0:0, looks:[], idx:0, g:0},
    rises:0, legFrom:0, legTo:0,
    parts:[], ghosts:[], flash:0, flashCol:'#fff', hitstop:0, dustT:0, hop:0, ghostT:0,
    shake:0, catAnim:0, moved:false,
    stepT:0, tapT:1, creakT:0.4, pushH:null,
    charId:SAVE.sel, newCats:[],
    caught:false, reason:'', collapse:null, itemsBroken:0, endDelay:0,
  };
  for (let i=0;i<3;i++) addShelfItem(true);
  promoteOne();
  enterOwner('CALM');
  $('hint').innerHTML = inputMode === 'touch' ? 'TOUCH / ARROWS: WALK<br>BUMP THE GLOWING ITEM' : 'ARROWS: WALK<br>BUMP THE GLOWING ITEM';
  $('hint').classList.remove('hidden');
  Tips.hide(); Stats.begin(); Tut.begin();
}

const SIZES = [[0.7, 22], [1, 38], [1.35, 26], [1.7, 14]];       // small / normal / large / huge (relative weights)
function spawnItem(){
  const total = ITEM_KEYS.reduce((s,k)=>s+ITEMS[k].wt,0);
  let r = G.itemRng()*total, key = ITEM_KEYS[0];
  for (const k of ITEM_KEYS){ r -= ITEMS[k].wt; if (r<=0){ key=k; break; } }
  let q = G.itemRng()*SIZES.reduce((a,b)=>a+b[1],0), sz = 1;
  for (const [z, w] of SIZES){ q -= w; if (q<=0){ sz = z; break; } }
  const b = ITEMS[key];
  const def = Object.assign({}, b, {w:b.w*sz, h:b.h*sz, d:Math.round(b.d*Math.pow(sz,1.3)), t:b.t*Math.pow(sz,0.8), sz});   // bigger = heavier, pricier, slower to push
  return {key, def, w:def.w, h:def.h, landed:false, front:false, pop:0, x:0, y:0, vy:0, sq:0};
}

// Where does a new item land? Prefer a real gap (chosen at random, longer gaps are likelier). If the shelf is crowded
// the item lands partly overlapping others (they sit on different layers anyway). It NEVER fails: the shelf only breaks by the
// visible rule "more than MAX_ITEMS items" (the old random search made it break with 4-7 items about half of the time).
function freeSpot(w){
  const lo = SHELF_L + 10 + w/2, hi = SHELF_R - 10 - w/2;
  const blocks = G.items.map(o => [o.x - (o.w + w)/2 - 1, o.x + (o.w + w)/2 + 1]);
  blocks.push([G.cat.x - CW - w/2 - 2, G.cat.x + CW + w/2 + 2]);
  blocks.sort((a, b) => a[0] - b[0]);
  const gaps = []; let cur = lo;
  for (const [a, b] of blocks){ if (b <= cur) continue; if (a > cur) gaps.push([cur, Math.min(a, hi)]); cur = Math.max(cur, b); if (cur >= hi) break; }
  if (cur < hi) gaps.push([cur, hi]);
  const real = gaps.filter(g => g[1] - g[0] >= 0.5);
  if (real.length){
    let r = G.spawnRng() * real.reduce((s, g) => s + (g[1] - g[0]), 0);
    for (const g of real){ const len = g[1] - g[0]; if (r <= len) return g[0] + r; r -= len; }
    const g = real[real.length - 1]; return g[1];
  }
  let best = (lo + hi)/2, bestD = -1;                                   // crowded: the most open of 24 random tries
  for (let i = 0; i < 24; i++){
    const x = lerp(lo, hi, G.spawnRng());
    let d = Math.abs(x - G.cat.x) < CW + 2 ? -1 : 1e9;
    for (const o of G.items) d = Math.min(d, Math.abs(o.x - x) - (o.w + w)/2);
    if (d > bestD){ bestD = d; best = x; }
  }
  return best;
}
// An item arrives from the sky. No room / too many items -> the shelf breaks.
function addShelfItem(instant){
  if (G.items.length >= MAX_ITEMS){ startCollapse(); return; }
  const it = spawnItem();
  const x = freeSpot(it.w);
  if (x === null){ startCollapse(); return; }                  // (kept as a safety net, freeSpot no longer returns null)
  it.x = x; it.landed = !!instant; it.y = instant ? SHELF_Y : -20;
  G.items.push(it);
  if (!instant) sfx('skyWhistle', {dur:0.5, pan:SFX.panOf(x)});
}
