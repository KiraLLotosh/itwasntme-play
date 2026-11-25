'use strict';
/* Room background (built once), day / night sky, shelf */

function rect(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }

// static background is painted once into an offscreen canvas
const roomC = document.createElement('canvas'); roomC.width = W; roomC.height = H;
const TOP = 64;                                   // the room starts here; above it is the HUD banner
const WIN = {x:100, y:134, w:62, h:56};            // window position
(function buildRoom(){
  const rx = roomC.getContext('2d');
  const R = (x,y,w,h,c) => { rx.fillStyle = c; rx.fillRect(x,y,w,h); };
  const PLUM = '#5b3d54';
  // wall: soft stripes + tiny hearts
  R(0,TOP,W,FLOOR_Y-TOP,'#ffe6ef');
  for (let x=0;x<W;x+=12) R(x,TOP,6,FLOOR_Y-TOP,'#ffdce8');
  for (let y=TOP+8;y<190;y+=20) for (let x=(((y-TOP)/20)%2 ? 3 : 9);x<W;x+=12) R(x,y,1,1,'#ffb8cf');
  // wainscot + skirting
  R(0,196,W,FLOOR_Y-196,'#f7c6d8'); R(0,196,W,2,'#ffffff'); R(0,198,W,1,'#e8a6bf');
  for (let x=10;x<W;x+=20) R(x,201,1,FLOOR_Y-208,'#eeb3c9');
  R(0,FLOOR_Y-6,W,6,'#ffffff'); R(0,FLOOR_Y-7,W,1,'#e8a6bf');
  // floor planks
  R(0,FLOOR_Y,W,H-FLOOR_Y,'#f2c79a'); R(0,FLOOR_Y,W,2,'#c98a5a');
  for (let y=FLOOR_Y+10;y<H;y+=10) R(0,y,W,1,'#e0ac7c');
  for (let y=FLOOR_Y;y<H;y+=10){ const off = ((y-FLOOR_Y)/10)%2 ? 18 : 48; for (let x=off;x<W;x+=60) R(x,y,1,10,'#e0ac7c'); }
  for (let y=FLOOR_Y+3;y<H;y+=20) R(8,y,26,1,'#f8d9b3');
  // rug
  R(22,276,136,22,PLUM); R(23,277,134,20,'#ffb3c7'); R(26,280,128,14,'#ffd3e0');
  for (let x=30;x<150;x+=8){ R(x,284,2,2,'#ffffff'); R(x+4,289,2,2,'#ffb3c7'); }
  // top banner (HUD lives here) with a scalloped edge + ceiling shadow
  R(0,TOP-7,W,7,'#ffe6ef');                       // wall colour behind the scallops
  R(0,0,W,TOP-7,'#7a5a94'); for (let y=3;y<TOP-7;y+=6) R(0,y,W,1,'#85679f');
  for (let x=0;x<W;x+=12){ R(x+1,TOP-7,10,2,'#7a5a94'); R(x+2,TOP-5,8,2,'#7a5a94'); R(x+4,TOP-3,4,2,'#7a5a94'); }
  for (let x=0;x<W;x+=12) R(x,TOP-1,12,1,'#ffd3e0');
  // string lights
  for (let x=0;x<W;x++) R(x, TOP+6 + Math.round(Math.sin(x/W*Math.PI*4)*3), 1, 1, PLUM);
  const bulbs = ['#ff9fb8','#ffe27a','#7ddba0','#8aa4ff'];
  for (let i=0, x=6;x<W;x+=13, i++){ const y = TOP+6 + Math.round(Math.sin(x/W*Math.PI*4)*3);
    R(x-1,y+1,3,3,PLUM); R(x,y+2,1,1,bulbs[i%4]); R(x-1,y+2,1,1,bulbs[i%4]); R(x,y+3,1,1,bulbs[i%4]); }
  // pictures above the shelf
  R(18,72,24,28,PLUM); R(19,73,22,26,'#ffffff'); R(21,75,18,22,'#ffd3e0');
  R(24,80,4,2,'#ff6b8a'); R(30,80,4,2,'#ff6b8a'); R(23,82,12,3,'#ff6b8a'); R(25,85,8,2,'#ff6b8a'); R(27,87,4,1,'#ff6b8a'); R(28,88,2,1,'#ff6b8a');
  R(26,91,6,1,'#ffffff'); R(27,93,4,1,'#ffffff');
  R(50,76,14,14,PLUM); R(51,77,12,12,'#ffffff'); R(52,78,10,10,'#cdb4ff');
  R(56,80,2,6,'#ffe27a'); R(54,82,6,2,'#ffe27a'); R(55,81,4,4,'#ffe27a');
  R(128,76,18,18,PLUM); R(129,77,16,16,'#ffffff'); R(130,78,14,14,'#fff6ea');                     // wall clock
  R(136,78,1,1,'#ff9fb8'); R(143,84,1,1,'#ff9fb8'); R(136,90,1,1,'#ff9fb8'); R(130,84,1,1,'#ff9fb8');            // clock ticks (the hands are drawn live in drawClock)
  // big painting under the shelf (hills + sun)
  R(22,136,44,48,PLUM); R(23,137,42,46,'#ffffff'); R(25,139,38,42,'#bfeaff');
  R(48,144,8,8,'#ffe27a'); R(46,146,12,4,'#ffe27a'); R(25,164,38,15,'#7ddba0'); R(25,168,38,11,'#a6edc2'); R(30,160,18,6,'#7ddba0'); R(36,157,10,4,'#7ddba0');
  R(31,148,8,3,'#ffffff'); R(34,146,6,3,'#ffffff');
  // window: the panes are HOLES in this layer, the sky behind them is drawn live (day / night)
  const wx = WIN.x, wy = WIN.y, ww = WIN.w, wh = WIN.h;
  R(wx-4,wy-8,ww+8,3,'#c98a5a'); R(wx-6,wy-9,3,5,'#e6aa78'); R(wx+ww+3,wy-9,3,5,'#e6aa78');
  R(wx,wy,ww,wh,PLUM); R(wx+1,wy+1,ww-2,wh-2,'#ffffff');
  rx.clearRect(wx+3,wy+3,ww-6,wh-6);
  R(wx+29,wy+3,2,wh-6,'#ffffff'); R(wx+3,wy+26,ww-6,2,'#ffffff');
  R(wx-2,wy+wh,ww+4,4,PLUM); R(wx-1,wy+wh,ww+2,3,'#ffffff');
  R(wx-6,wy-6,12,wh+6,PLUM); R(wx-5,wy-5,10,wh+5,'#ff9fb8');
  for (let y=wy-4;y<wy+wh;y+=5){ R(wx-3,y,1,3,'#ff7aa8'); R(wx+1,y+1,1,3,'#ffc2d6'); }
  R(wx-6,wy+22,12,3,PLUM); R(wx-5,wy+23,10,1,'#ffffff');
  R(wx+ww-6,wy-6,12,wh+6,PLUM); R(wx+ww-5,wy-5,10,wh+5,'#ff9fb8');
  for (let y=wy-4;y<wy+wh;y+=5){ R(wx+ww-3,y,1,3,'#ff7aa8'); R(wx+ww+1,y+1,1,3,'#ffc2d6'); }
  R(wx+ww-6,wy+22,12,3,PLUM); R(wx+ww-5,wy+23,10,1,'#ffffff');
  // shelf brackets
  for (const bx of [24,150]){ R(bx,SHELF_Y+7,4,9,'#a8683f'); R(bx+1,SHELF_Y+7,2,8,'#d99560'); R(bx-2,SHELF_Y+16,8,2,'#a8683f'); }
  // couch (mint) with outline
  R(26,226,128,40,PLUM); R(27,227,126,38,'#8fd6c4');
  R(34,208,112,32,PLUM); R(35,209,110,30,'#a8e6d4'); R(35,209,110,2,'#c6f2e6');
  for (let x=64;x<=116;x+=26) R(x,211,1,26,'#8fd6c4');
  R(30,238,120,22,PLUM); R(31,239,118,20,'#bdeede'); R(31,239,118,2,'#d9fbf0');
  R(24,222,14,42,PLUM); R(25,223,12,40,'#7cc9b5'); R(25,223,12,3,'#a8e6d4');
  R(142,222,14,42,PLUM); R(143,223,12,40,'#7cc9b5'); R(143,223,12,3,'#a8e6d4');
  R(30,264,8,4,PLUM); R(142,264,8,4,PLUM);
  R(40,226,14,13,PLUM); R(41,227,12,11,'#ffe27a'); R(45,229,2,2,'#ff9fb8'); R(48,229,2,2,'#ff9fb8'); R(44,231,7,2,'#ff9fb8'); R(46,233,3,1,'#ff9fb8');
  // plant with a cute face
  R(160,243,16,25,PLUM); R(161,244,14,23,'#e08a62'); R(161,244,14,3,'#f0a07c'); R(161,262,14,5,'#c26c48');
  R(165,252,2,2,'#5b3d54'); R(170,252,2,2,'#5b3d54'); R(167,256,3,1,'#e45f82'); R(163,255,2,1,'#ff9fb8'); R(172,255,2,1,'#ff9fb8');
  for (const [lx,ly,lw,lh] of [[160,228,6,15],[166,222,6,21],[172,230,6,13],[156,236,5,8]]){ R(lx-1,ly-1,lw+2,lh+1,PLUM); R(lx,ly,lw,lh,'#7ddba0'); R(lx,ly,2,lh,'#a6edc2'); }
})();
/* ----- time of day: the sky behind the window and a night tint over the room ----- */
const DAY_LEN = 74;                                    // seconds for a whole day: dusk ~35 s, full night from ~40 s, dawn ~60 s (0.12 start phase)
 const TOD_DEBUG = NaN;      // ?tod=0.7 pins the time of day (for testing)
const todP = () => isNaN(TOD_DEBUG) ? (0.12 + (G ? G.time : 0)/DAY_LEN) % 1 : TOD_DEBUG;      // 0 morning .. 0.4 day .. 0.55 sunset .. 0.66-0.88 night .. 1 dawn
const SKYS = [[0,'#8fd2fa','#d6f2ff'],[0.4,'#8fd2fa','#d6f2ff'],[0.5,'#ff9f7a','#ffd9a8'],[0.58,'#6a4a9a','#d98ab0'],
              [0.66,'#141a3c','#2b3166'],[0.88,'#141a3c','#2b3166'],[0.95,'#7a6aa8','#ffb59a'],[1,'#8fd2fa','#d6f2ff']];
const hex3 = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const mix3 = (a, b, t) => a.map((v,i) => Math.round(v + (b[i]-v)*t));
const rgb3 = a => 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
function skyAt(p){
  for (let i=0;i<SKYS.length-1;i++){
    const a = SKYS[i], b = SKYS[i+1];
    if (p <= b[0]){ const t = (p - a[0])/Math.max(1e-6, b[0]-a[0]); return {top:mix3(hex3(a[1]), hex3(b[1]), t), bot:mix3(hex3(a[2]), hex3(b[2]), t)}; }
  }
  return {top:hex3(SKYS[0][1]), bot:hex3(SKYS[0][2])};
}
const nightOf = sky => clamp((0.62 - (0.3*sky.top[0] + 0.59*sky.top[1] + 0.11*sky.top[2])/255)/0.45, 0, 1);
const STARS = [[5,6],[18,12],[33,5],[47,14],[10,26],[26,22],[40,30],[51,9],[8,40],[30,38],[46,42],[20,46],[14,18],[38,20]];
function drawSky(){
  const p = todP(), sky = skyAt(p), nf = nightOf(sky), t = G ? G.time : 0;
  const x0 = WIN.x+3, y0 = WIN.y+3, w = WIN.w-6, h = WIN.h-6;
  for (let i=0;i<5;i++){ ctx.fillStyle = rgb3(mix3(sky.top, sky.bot, i/4)); ctx.fillRect(x0, y0 + Math.floor(h*i/5), w, Math.ceil(h/5)); }
  if (nf > 0.15){                                                      // twinkling stars
    ctx.fillStyle = '#fff';
    STARS.forEach(([sx, sy], i) => { ctx.globalAlpha = nf * ((Math.floor(t*2 + i) % 3) ? 1 : 0.35); ctx.fillRect(x0 + sx, y0 + sy, 1, 1); });
    ctx.globalAlpha = 1;
  }
  if (p < 0.6){                                                        // sun
    const q = p/0.6, sx = x0 + 6 + q*(w-12), sy = y0 + h - 5 - Math.sin(q*Math.PI)*(h-16);
    ctx.fillStyle = q > 0.8 ? '#ff9f5a' : '#ffe27a';
    ctx.fillRect(Math.round(sx)-3, Math.round(sy)-2, 7, 5); ctx.fillRect(Math.round(sx)-2, Math.round(sy)-3, 5, 7);
    ctx.fillStyle = q > 0.8 ? '#ffc08a' : '#fff3b0'; ctx.fillRect(Math.round(sx)-1, Math.round(sy)-1, 3, 3);
  }
  if (p >= 0.55){                                                      // moon (a crescent)
    const q = clamp((p - 0.55)/0.45, 0, 1), mx = Math.round(x0 + 6 + q*(w-12)), my = Math.round(y0 + h - 8 - Math.sin(q*Math.PI)*(h-18));
    ctx.fillStyle = '#f3f0ff'; ctx.fillRect(mx-3, my-2, 7, 5); ctx.fillRect(mx-2, my-3, 5, 7);
    ctx.fillStyle = rgb3(mix3(sky.top, sky.bot, 0.45)); ctx.fillRect(mx, my-3, 4, 4); ctx.fillRect(mx+1, my-2, 4, 6);
  }
  ctx.fillStyle = rgb3(mix3([255,255,255], [92,84,140], nf));          // drifting clouds
  for (const [bx, by] of [[0,16],[30,34]]){
    const cx = x0 + ((bx + t*2.5) % (w + 24)) - 12;
    ctx.fillRect(Math.round(cx), y0+by, 12, 3); ctx.fillRect(Math.round(cx)+2, y0+by-2, 8, 3); ctx.fillRect(Math.round(cx)+4, y0+by-3, 5, 2);
  }
}
// At night a soft round light follows the cat: a warm halo behind the sprite (catLight) + a hole in the night tint (nightTint).
const LIGHT_R = 34;                                    // radius in internal px
const NIGHT_A = 0.32;                                  // darkness of the room at full night
function pixelLight(col){                              // stepped pixel discs, brightest in the middle
  const c = document.createElement('canvas'); c.width = c.height = LIGHT_R*2;
  const x = c.getContext('2d'); x.fillStyle = col;
  for (const [k, a] of [[1,0.25],[0.84,0.3],[0.68,0.4],[0.52,0.6]]){    // alphas stack towards the centre
    const r = Math.round(LIGHT_R*k); x.globalAlpha = a;
    for (let y=-r; y<r; y++){ const half = Math.round(Math.sqrt(r*r - (y+0.5)*(y+0.5))); x.fillRect(LIGHT_R-half, LIGHT_R+y, half*2, 1); }
  }
  return c;
}
const holeC = pixelLight('#000'), warmC = pixelLight('#ffcf6e');
const tintC = document.createElement('canvas'); tintC.width = W; tintC.height = H;
const tctx = tintC.getContext('2d');
const nightNow = () => nightOf(skyAt(todP()));
const lightPos = () => [Math.round(G.cat.x) - LIGHT_R, Math.round(G.catY - catLift() - 7) - LIGHT_R];
function catLight(){                                   // call right before drawCat()
  const nf = nightNow();
  if (nf <= 0.02) return;
  ctx.globalAlpha = 0.5*nf; ctx.drawImage(warmC, ...lightPos()); ctx.globalAlpha = 1;
}
function nightTint(){
  const nf = nightNow();
  if (nf <= 0.02) return;
  tctx.clearRect(0, 0, W, H);
  tctx.globalAlpha = NIGHT_A*nf; tctx.fillStyle = '#14103a'; tctx.fillRect(0, 0, W, H); tctx.globalAlpha = 1;
  tctx.globalCompositeOperation = 'destination-out'; tctx.drawImage(holeC, ...lightPos()); tctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintC, 0, 0);
}
// The wall clock shows the same time of day as the sky: phase 0 = 06:00, 0.25 = 12:00, 0.5 = 18:00 (sunset), 0.75 = 00:00.
const CLOCK = {x:136, y:84};
function drawClock(){
  const hours = (6 + todP()*24) % 24, mins = (hours % 1) * 60;
  const ha = (hours % 12)/12 * Math.PI*2, ma = mins/60 * Math.PI*2;
  const hand = (a, len, col) => { for (let i=0;i<=len;i++) ctx.fillStyle = col, ctx.fillRect(Math.round(CLOCK.x + Math.sin(a)*i), Math.round(CLOCK.y - Math.cos(a)*i), 1, 1); };
  hand(ha, 3, '#c0566a'); hand(ma, 5, '#5b3d54');
  ctx.fillStyle = '#5b3d54'; ctx.fillRect(CLOCK.x, CLOCK.y, 1, 1);
}
function drawRoom(){
  drawSky();
  ctx.drawImage(roomC, 0, 0);
  drawClock();
  drawShelf();
}

function drawShelf(){
  if (G && G.collapse){
    const a = Math.min(1.25, easeOutCubic(Math.min(1, G.collapse.t*1.6)) * 1.25);
    ctx.save(); ctx.translate(SHELF_L, SHELF_Y); ctx.rotate(a);
    rect(0,0,80,5,'#d99560'); rect(0,0,80,1,'#f5c598'); rect(0,5,80,2,'#a8683f'); ctx.restore();
    ctx.save(); ctx.translate(SHELF_R, SHELF_Y); ctx.rotate(-a);
    rect(-80,0,80,5,'#d99560'); rect(-80,0,80,1,'#f5c598'); rect(-80,5,80,2,'#a8683f'); ctx.restore();
    return;
  }
  const n = G ? G.items.length : 0;
  const strain = n >= MAX_ITEMS-1;                   // creaking: one more and it breaks
  const full = n >= MAX_ITEMS;                       // exactly at the limit: the next arrival breaks it
  const jx = strain ? Math.round((Math.random()-0.5)*(full ? 3 : 1.5)) : 0;
  const sag = strain ? 1 : 0;
  rect(SHELF_L+jx,SHELF_Y+sag,SHELF_R-SHELF_L,5,strain ? '#e8907a' : '#d99560');
  rect(SHELF_L+jx,SHELF_Y+sag,SHELF_R-SHELF_L,1,strain ? '#f8b4a2' : '#f5c598');
  rect(SHELF_L+jx,SHELF_Y+5+sag,SHELF_R-SHELF_L,2,'#a8683f');
  if (strain && Math.floor((G.time||0)*6)%2===0){      // little stress cracks
    rect(60+jx,SHELF_Y+1,1,3,'#5b3d54'); rect(115+jx,SHELF_Y+2,1,3,'#5b3d54');
  }
  if (G){                                              // shelf load: one pip per item, the shelf breaks when the row is full and another arrives
    for (let i = 0; i < MAX_ITEMS; i++){
      const on = i < n, col = !on ? '#c9a07a' : (n >= MAX_ITEMS ? '#ff5a73' : n >= MAX_ITEMS-1 ? '#ffb347' : '#7ddba0');
      rect(40 + i*7, SHELF_Y + 9, 5, 3, '#5b3d54'); rect(41 + i*7, SHELF_Y + 10, 3, 1, col);
    }
  }
}
