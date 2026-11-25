'use strict';
/* Particles, ghost trails, screen flash */

function burst(x, y, n, col, spd, grav, life, size, floor){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, sp = spd*(0.4 + Math.random()*0.8);
    G.parts.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - spd*0.4, g:grav, t:0,
                  life:life*(0.6 + Math.random()*0.8), col, size:size||1, floor:!!floor});
  }
}
function stepParts(dt){
  G.flash = Math.max(0, G.flash - dt*3);
  G.hop = Math.max(0, G.hop - dt);
  for (let i = G.ghosts.length-1; i >= 0; i--){ G.ghosts[i].t += dt; if (G.ghosts[i].t > 0.25) G.ghosts.splice(i,1); }
  for (let i = G.parts.length-1; i >= 0; i--){
    const p = G.parts[i];
    p.t += dt;
    if (p.t >= p.life){ G.parts.splice(i,1); continue; }
    p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt;
    if (p.floor && p.y > FLOOR_Y-1){ p.y = FLOOR_Y-1; p.vy *= -0.35; p.vx *= 0.6; }
  }
}
function drawParts(){
  for (const g of G.ghosts){
    ctx.globalAlpha = 0.4 * (1 - g.t/0.25);
    { const s = catSpr('cat_idle_t0'); ctx.drawImage(g.dir < 0 ? s.f : s.n, Math.round(g.x - 11), Math.round(g.y - 15)); }
  }
  for (const p of G.parts){
    ctx.globalAlpha = 1 - Math.pow(p.t/p.life, 2);
    rect(p.x, p.y, p.size, p.size, p.col);
  }
  ctx.globalAlpha = 1;
}

// One item is on the front layer (lit, pushable); the rest are in the background.
// The longer the game lasts, the more items are in front.
function promoteOne(){
  const back = G.items.filter(i => i.landed && !i.front);
  if (!back.length) return false;
  const it = back[Math.floor(G.promoRng()*back.length)];
  it.front = true; it.pop = 1;
  burst(it.x, SHELF_Y - it.h/2, 8, '#fff6c0', 40, 60, 0.5, 1);
  sfx('promote', {pan:SFX.panOf(it.x)});
  return true;
}
