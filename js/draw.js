'use strict';
/* Drawing: gaze beam, owner, items, cat, skill ring, menu wallpaper, render(), target reticle */

// Flashlight beam: drawn opaque into one half-resolution sprite (so nothing stacks and no seams appear),
// then composited once with a single alpha. Round spot, swaying a little from side to side.
const beamC = document.createElement('canvas'); beamC.width = W/2; beamC.height = H/2;
const bctx = beamC.getContext('2d');
function drawGaze(){
  const o = G.owner;
  if (o.state!=='AIM' && o.state!=='GAZE') return;
  const gaze = o.state==='GAZE';
  const z = zoneRange(o.looks[o.idx].zone), P = ownerPose();
  const sway = Math.sin(o.anim*(gaze ? 2.6 : 3.4) + o.idx*1.7) * (gaze ? 3.5 : 2.5);
  const cx = ((z[0] + z[1])/2 + sway)/2, cy = (SHELF_Y - 12)/2, rad = Math.max(10, (z[1]-z[0])/2 + 3)/2;
  const ox = (P.headX + 8)/2, oy = (P.headY + 7)/2;
  const draw = (r, col) => {
    const dx = cx-ox, dy = cy-oy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), b = Math.asin(Math.min(0.98, r/d)), L = Math.sqrt(d*d - r*r);
    bctx.fillStyle = col;
    bctx.beginPath(); bctx.moveTo(ox, oy);
    bctx.lineTo(ox + Math.cos(a-b)*L, oy + Math.sin(a-b)*L); bctx.lineTo(ox + Math.cos(a+b)*L, oy + Math.sin(a+b)*L); bctx.closePath(); bctx.fill();
    bctx.beginPath(); bctx.arc(cx, cy, r, 0, Math.PI*2); bctx.fill();
  };
  bctx.clearRect(0, 0, beamC.width, beamC.height);
  draw(rad, gaze ? '#ff4d6d' : '#ffe27a');                  // outer beam
  draw(rad*0.55, gaze ? '#ff8fa3' : '#fff3b0');             // brighter core
  ctx.save();
  ctx.globalAlpha = gaze ? 0.34 + 0.05*Math.sin(o.anim*9) : 0.2 + 0.05*Math.sin(o.anim*14);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(beamC, 0, 0, W, H);
  ctx.restore();
}

const PLUM = '#5b3d54';
function roundRect(x,y,w,h,r,c){
  for (let i=0;i<h;i++){ const ins = i<r ? r-i : (i>=h-r ? i-(h-r)+1 : 0); rect(x+ins, y+i, w-2*ins, 1, c); }
}
function hood(x,y,w,h){                                  // rounded hoodie torso
  roundRect(x-1,y-1,w+2,h+2,3,PLUM); roundRect(x,y,w,h,3,'#b9a8ff');
  rect(x+2,y+3,2,Math.max(1,h-7),'#d8ccff'); rect(x+w-5,y+3,3,Math.max(1,h-7),'#9a88f0');
  rect(x+3,y+h-3,w-6,2,'#9a88f0');
  rect(x+w/2-4,y,8,2,'#d8ccff');                          // collar
  if (h >= 14){ rect(x+w/2-3,y+3,1,4,'#fff'); rect(x+w/2+2,y+3,1,4,'#fff'); }   // hood strings
  if (h >= 22){ roundRect(x+5,y+h-10,w-10,6,1,'#9a88f0'); rect(x+6,y+h-10,w-12,1,'#d8ccff'); }   // pocket
}
function limb(x,y,w,h){
  rect(x-1,y-1,w+2,h+2,PLUM); rect(x,y,w,h,'#6c7ab8');
  rect(x,y,1,h,'#8a98d6'); rect(x+w-2,y,2,h,'#5a67a0');
}
// simple straight arms: a sleeve with a hand at the end (they get longer as he grows)
function hangArm(x, y, len){                               // x = left edge of the 5px sleeve, y = shoulder
  rect(x-1, y-1, 7, len+2, PLUM); rect(x, y, 5, len, '#b9a8ff');
  rect(x, y, 1, len, '#d8ccff'); rect(x+3, y, 2, len, '#9a88f0');
  roundRect(x-1, y+len-1, 7, 7, 2, PLUM); roundRect(x, y+len, 5, 5, 1, '#ffe3cf');
}
function raisedArm(x, y, len){                             // fist in the air
  rect(x-1, y-len-1, 7, len+2, PLUM); rect(x, y-len, 5, len, '#b9a8ff');
  rect(x, y-len, 1, len, '#d8ccff'); rect(x+3, y-len, 2, len, '#9a88f0');
  roundRect(x-1, y-len-6, 7, 7, 2, PLUM); roundRect(x, y-len-5, 5, 5, 1, '#ffe3cf');
}
function drawOwner(){
  const o = G.owner, st = o.state, P = ownerPose();
  const k = P.k, ext = P.ext, bx = P.bx;
  const standing = clamp(k,0,1);
  // calm idle: a slow 4-step loop. head dips -> body dips -> head back -> body back
  let headDy = 0, bodyDy = 0;
  if (st==='CALM'){
    const f = Math.floor(G.time/0.5) % 4;
    headDy = (f===1 || f===2) ? 2 : 0;
    bodyDy = (f===2 || f===3) ? 1 : 0;
  }
  const headX = P.headX, headY = P.headY + headDy;
  const bodyY = P.headY + 16 + bodyDy;
  // legs (they keep growing and getting thinner) + shoes. Torso is exactly as wide as the legs.
  const legH = Math.round(lerp(10, 54 + ext, k));
  const legW = Math.max(5, Math.round(9 - ext/14));
  const hipY = Math.round(P.hip);
  const lx = bx+4, rx = bx+24-legW;
  limb(lx, hipY, legW, legH);
  limb(rx, hipY, legW, legH);
  if (standing > 0.9){ spr('shoe', lx+legW/2-6, FLOOR_Y-7); spr('shoe', rx+legW/2-6, FLOOR_Y-7); }
  // arms
  const bent = P.h > 0;
  const shY = bent ? CEIL+17 : bodyY+3;
  const phonePose = (st==='CALM' || st==='SIT' || (st==='RISE' && k < 0.5));
  const armLen = 10 + ext*0.25;
  const up = (st==='STUN' || st==='ANGRY');
  if (!phonePose){
    if (up) raisedArm(bx+24, shY+4, 9); else hangArm(bx+24, shY, armLen);     // far arm (behind the torso)
  }
  // torso (rounded, bends forward under the shelf)
  if (bent){
    hood(bx+4, CEIL+14, 20, hipY-(CEIL+14));
    hood(bx+4, CEIL+14, P.h+18, 14);
  } else spr(k > 0.5 ? 'torso_stand' : 'torso_sit', bx+3, bodyY-1);
  // head
  let hn;
  if (st==='CALM' || st==='SIT' || (st==='RISE' && k < 0.5)) hn = 'head_phone';
  else if (st==='RISE') hn = 'head_rise';
  else if (st==='AIM') hn = 'head_aim' + o.looks[o.idx].zone;
  else if (st==='GAZE') hn = 'head_gaze' + o.looks[o.idx].zone;
  else if (st==='STUN') hn = 'head_stun';
  else hn = 'head_angry';
  spr(hn, headX-2, headY-3);
  if (phonePose) spr('phone_hold', bx+3, bodyY+4);
  else if (up) raisedArm(bx-1, shY+4, 9); else hangArm(bx-1, shY, armLen);    // near arm (in front)
  if (st==='STUN'){
    for (let i=0;i<3;i++){                              // stars orbit his head, slowly
      const a = o.anim*5 + i*2.09;
      rect(headX+8 + Math.cos(a)*12, headY-5 + Math.sin(a)*3, 2, 2, '#ffe27a');
    }
  }
}

// o: {rot, sx, sy, pv:'b'|'c'}  pivot = bottom centre ('b') or centre ('c'); `bottom` is always the bottom edge
function drawItem(def, cx, bottom, o){
  const s = SPR['item_' + def.id];
  const drawBody = (x, y) => {
    if (def.rare){                                                 // soft pulsing glow + sparkles
      const a = 0.25 + 0.2*Math.sin(G.time*6);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff6c0';
      ctx.fillRect(x-2, y-1, def.w+4, def.h+2); ctx.fillRect(x-1, y-3, def.w+2, def.h+6);
      ctx.globalAlpha = 1;
      const sp = Math.floor(G.time*5)%3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x-3, y+2+sp*3, 1, 1); ctx.fillRect(x+def.w+2, y+9-sp*3, 1, 1); ctx.fillRect(x+def.w/2, y-3-sp, 1, 1);
    }
    ctx.drawImage(o && o.dim ? s.d : s.n, x, y, def.w, def.h);
  };
  if (!o || (!o.rot && !o.sx && !o.sy)){
    drawBody(Math.round(cx - def.w/2), Math.round(bottom - def.h));
    return;
  }
  ctx.save();
  if (o.pv==='c') ctx.translate(cx, bottom - def.h/2); else ctx.translate(cx, bottom);
  ctx.rotate(o.rot || 0); ctx.scale(o.sx || 1, o.sy || 1);
  drawBody(-def.w/2, o.pv==='c' ? -def.h/2 : -def.h);
  ctx.restore();
}

function drawShelfItems(){
  const order = [...G.items].sort((a,b) => (a.front?1:0) - (b.front?1:0));    // background first
  for (const it of order){
    const def = it.def;
    if (!it.landed){
      const prox = clamp(1 - (SHELF_Y - it.y)/130, 0, 1);              // landing shadow grows as it nears
      const sw = def.w*(0.4 + 0.9*prox);
      ctx.globalAlpha = 0.45*prox; rect(it.x - sw/2, SHELF_Y-1, sw, 2, '#000'); ctx.globalAlpha = 1;
      const sy = 1 + Math.min(0.35, it.vy/2500);                       // stretch while falling
      drawItem(def, it.x, it.y + def.h/2, {pv:'c', sx:1/sy, sy, dim:true});
      continue;
    }
    const pushed = G.push && G.push.item === it;
    const dl = it.x - SHELF_L, dr = SHELF_R - it.x, near = Math.min(dl, dr), edgeDir = dl < dr ? -1 : 1;
    let rot = near < 12 ? edgeDir * (1 - near/12) * 0.45 : 0;           // tips toward the edge
    if (near < 12) rot += Math.sin(G.time*12 + it.x) * 0.04;
    let jit = 0;
    if (pushed && G.pushing){ rot += G.push.dir*0.07; jit = (Math.random()-0.5)*0.8; }
    const lift = it.pop * 3;
    if (it.front){                                                     // lit: glow + bobbing arrow
      const bt = G.tut ? performance.now()/1000 : G.time;               // (the tutorial holds G.time: bob on the real clock)
      const a = (pushed ? 0.4 : 0.22) + 0.12*Math.sin(bt*5);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff6c0';
      ctx.fillRect(Math.round(it.x - def.w/2 - 3), SHELF_Y - def.h - 3, def.w + 6, def.h + 3);
      ctx.fillRect(Math.round(it.x - def.w/2 - 1), SHELF_Y - def.h - 5, def.w + 2, def.h + 5);
      ctx.globalAlpha = 1;
      if (!pushed){
        const ay = SHELF_Y - def.h - 10 + Math.round(Math.sin(bt*5)*1.5);
        rect(it.x-3, ay, 7, 1, PLUM); rect(it.x-2, ay+1, 5, 1, PLUM); rect(it.x-1, ay+2, 3, 1, PLUM); rect(it.x, ay+3, 1, 1, PLUM);
        rect(it.x-2, ay, 5, 1, '#ff9fb8'); rect(it.x-1, ay+1, 3, 1, '#ff9fb8'); rect(it.x, ay+2, 1, 1, '#ff9fb8');
      }
    }
    drawItem(def, it.x + jit, SHELF_Y - lift, {rot, sx:(1 + 0.3*it.sq)*(1 + 0.25*it.pop), sy:(1 - 0.3*it.sq)*(1 + 0.25*it.pop), pv:'b', dim:!it.front});
  }
}

// how high above its shelf position the cat is drawn right now (hop / dash / somersault); the night light follows it
function catLift(){
  if (G.dash) return Math.sin(Math.min(1, G.dash.t/G.dash.dur)*Math.PI)*7;
  if (G.jump) return Math.sin(Math.min(1, G.jump.t/G.jump.dur)*Math.PI)*JUMP_H;
  return G.catHop + (G.hop > 0 ? Math.sin(G.hop/0.2*Math.PI)*3 : 0);
}
function drawCat(){
  const c = G.cat, d = c.dir;
  const moving = G.walking || G.pushing;
  const idle = !moving && !G.skill && !G.dash && !G.jump && !G.caught;
  const breathe = idle ? Math.round(Math.sin(G.catAnim*3)*0.6) : 0;
  const trem = G.skill ? Math.round((Math.random()-0.5)*2) : (G.lockShake > 0 ? Math.round((Math.random()-0.5)*3) : 0);
  let rot = G.catRot*d;
  const hop = catLift();
  if (G.dash){ const p = Math.min(1, G.dash.t/G.dash.dur); rot = Math.sign(G.dash.x1 - G.dash.x0 || 1) * p * Math.PI*4; }   // two full OIIA spins
  if (G.jump){ const p = Math.min(1, G.jump.t/G.jump.dur); rot = G.jump.dir * p * Math.PI*2; }                              // one somersault
  let fr;
  if (G.caught) fr = 'dead';
  else if (G.skill) fr = 'wide';
  else if (G.dash || G.jump) fr = 'oiia';
  else if (G.pushing) fr = 'push';
  else if (G.walking) fr = Math.sin(G.catPh) >= 0 ? 'oiia' : 'oiia2';
  else fr = (Math.floor(G.catAnim*1.2)%3===0 && (G.catAnim*1.2)%1 < 0.25) ? 'blink' : 'idle';
  const tail = (((Math.floor(G.catAnim*(moving ? 8 : 3)))%2)+2)%2;
  const s = catSpr('cat_' + fr + '_t' + tail);
  ctx.save();
  ctx.translate(Math.round(c.x + trem), Math.round(G.catY - hop + breathe));
  ctx.rotate(rot);
  ctx.drawImage(d > 0 ? s.n : s.f, -11, -15);
  ctx.restore();
}

function drawSkill(){
  const sk = G.skill;
  if (!sk) return;
  const x = 90, y = 88, r = 17, a0 = -Math.PI/2;
  const ang = p => a0 + p*Math.PI*2;
  const sc = easeOutBack(Math.min(1, sk.t/0.2));                       // pops in
  ctx.save();
  ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.lineWidth = 6; ctx.strokeStyle = '#5b3d54';
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  const inBuf = sk.t < sk.buf;
  ctx.lineWidth = 5; ctx.strokeStyle = inBuf || Math.floor(sk.t*16)%2 ? '#ff7aa8' : '#ffc2d6';
  ctx.beginPath(); ctx.arc(0,0,r,ang(sk.z0),ang(sk.z1)); ctx.stroke();
  const p = inBuf ? 0 : Math.min(1, (sk.t-sk.buf)/sk.spin);
  ctx.lineWidth = 2; ctx.strokeStyle = inBuf && Math.floor(sk.t*30)%2 ? '#fff' : '#5b3d54';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang(p))*(r+3), Math.sin(ang(p))*(r+3)); ctx.stroke();
  ctx.restore();
}

// sliding wallpaper of lilac item silhouettes (main menu + the page around the phone on desktop)
function drawWallpaper(c, w, h, t){
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#6f56a8'; c.fillRect(0, 0, w, h);
  const cw = 52, ch = 44, off = (t*0.012) % (cw*2);              // the pattern slides diagonally
  for (let row = -2; row < Math.ceil(h/ch) + 2; row++){
    for (let col = -2; col < Math.ceil(w/cw) + 2; col++){
      const key = ITEM_KEYS[(((row*3 + col*2) % 9) + 9) % 9];
      const sp = SPR['item_' + key];
      const x = col*cw + (row & 1 ? cw/2 : 0) + off, y = row*ch + off*0.7;
      c.drawImage(sp.t, Math.round(x - sp.w), Math.round(y - sp.h), sp.w*2, sp.h*2);
    }
  }
}
function drawMenuBg(t){ drawWallpaper(ctx, W, H, t); }
// the area around the phone-shaped game on a wide screen
const bgc = document.getElementById('bgc'), bgx = bgc.getContext('2d');
let lastBgDraw = -1e9;
function drawPageBg(t){
  const wideEnough = innerWidth > wrap.clientWidth + 10;
  bgc.style.display = wideEnough ? 'block' : 'none';
  if (!wideEnough) return;
  const cw = Math.ceil(innerWidth/UPX) + 1, chh = Math.ceil(innerHeight/UPX) + 1;
  const resized = bgc.width !== cw || bgc.height !== chh;
  if (resized){ bgc.width = cw; bgc.height = chh; }
  else if (t - lastBgDraw < 45) return;                                  // the wallpaper only needs ~20 fps (it was the most expensive part of a frame)
  lastBgDraw = t;
  drawWallpaper(bgx, cw, chh, t);
  const g = bgx.createRadialGradient(cw/2, chh/2, Math.min(cw, chh)*0.25, cw/2, chh/2, Math.max(cw, chh)*0.75);   // soft vignette
  g.addColorStop(0, 'rgba(30,18,60,0)'); g.addColorStop(1, 'rgba(30,18,60,0.5)');
  bgx.fillStyle = g; bgx.fillRect(0, 0, cw, chh);
}
function render(){
  if (!G){ drawMenuBg(performance.now()); return; }
  ctx.save();
  if (G && G.shake > 0){
    const sk = G.shake * (FX.low ? 0.25 : 1);
    ctx.translate(Math.round((Math.random()-0.5)*sk), Math.round((Math.random()-0.5)*sk));
  }
  drawRoom();
  if (G){
    drawGaze();
    drawOwner();
    drawReticle();
    if (!G.collapse) drawShelfItems();
    else for (const pc of G.collapse.pieces) drawItem(pc.def, pc.x, pc.y + pc.def.h/2);
    catLight();
    drawCat();
    for (const f of G.thrown) drawItem(f.def, f.x, f.y + f.def.h/2, {pv:'c', rot:f.r});
    for (const f of G.falling){
      const def = f.def;
      if (f.landed){
        rect(f.x-def.w/2, FLOOR_Y-2, def.w, 2, def.col);       // debris on the floor
        rect(f.x-def.w/2+2, FLOOR_Y-3, 2, 1, def.col);
      } else drawItem(def, f.x, f.y + def.h/2, {pv:'c', rot:f.r});
    }
    Tut.draw();
    drawSkill();
    drawParts();
    nightTint();
    if (G.flash > 0 && !FX.low){ ctx.globalAlpha = G.flash*0.6; rect(0,0,W,H,G.flashCol); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

// pulsing target brackets on his head while the throw is ready
function drawReticle(){
  if (G.mode !== 'play' || !hasAbility('throw') || G.throwCd > 0 || G.owner.state === 'STUN' || !G.items.some(i => i.landed)) return;
  const P = ownerPose(), cx = P.headX + 8, cy = P.headY + 8;
  const r = 13 + Math.round(Math.sin(G.time*6)*1.5);
  ctx.save(); ctx.globalAlpha = 0.6 + 0.35*Math.sin(G.time*6);
  for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const x = cx + sx*r, y = cy + sy*r, hx = sx < 0 ? x : x-3, vy = sy < 0 ? y : y-3;
    rect(hx-0, y-(sy<0?0:0), 4, 1, '#ffe27a'); rect(x, vy, 1, 4, '#ffe27a');
    rect(hx, y+(sy<0?-1:1), 4, 1, PLUM); rect(x+(sx<0?-1:1), vy, 1, 4, PLUM);
  }
  ctx.restore();
}
