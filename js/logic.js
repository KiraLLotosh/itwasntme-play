'use strict';
/* Game rules: drops, skill checks, cat movement and pushing, throw, collapse, update() */

const massOf = d => clamp(SND[d.id][1]*Math.pow(d.sz, 0.6), 0.1, 1);
function dropItem(it, dir){
  const def = it.def;
  G.dropsInWindow++;
  G.combo = COMBO_ON ? COMBO_MULT[Math.min(G.dropsInWindow-1, COMBO_MULT.length-1)] : 1;
  const gain = Math.round(def.d * G.combo * MONEY_SCALE);
  G.damage += gain; addMoney(gain); G.itemsBroken++;
  G.suspicion = clamp(G.suspicion + 4 + def.d/110, 0, 100);
  G.falling.push({key:it.key, def, x:it.x, y:SHELF_Y-def.h/2, vx:dir*14, vy:-30, r:dir*0.45, gain, combo:G.combo, landed:false});
  sfx('fall', {dur:0.55, mass:massOf(def), pan:SFX.panOf(it.x)});
  popup(90 + (Math.random()-0.5)*24, 150 - (G.popN++ % 3)*13, '+$'+gain + (G.combo>1 ? ' x'+G.combo : ''), gain/MONEY_SCALE);
  burst(it.x, SHELF_Y, 5, def.col, 35, 250, 0.35, 1);
  if (gain >= 300) G.hitstop = Math.max(G.hitstop, 0.06);
}

function popup(cx, cy, text, amount){
  const el = document.createElement('div');
  el.className = 'pop'; el.textContent = text;
  el.style.left = (cx/W*100)+'%'; el.style.top = (cy/H*100)+'%';
  const big = amount ? clamp(amount/400, 0, 1) : 0;
  el.style.fontSize = (1.1 + big*0.9) + 'em';
  if (amount && G.combo >= 3) el.style.color = '#ff9fb8';
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 1200);
}

function endRun(reason){
  G.mode = 'ending'; G.paused = false; show('pause', false);
  G.caught = true; G.reason = reason;
  G.endDelay = 1.0; G.skill = null; G.dash = null; G.push = null;
  const o = G.owner; o.k0 = clamp(standK(o), 0, 1); o.state = 'ANGRY'; o.anim = 0;
  G.shake = 10; G.flash = 0.8; G.flashCol = '#fff';
  G.hitstop = reason==='seen' ? 0.35 : 0.15;
  stopLoops(); Poki.stop(); Stats.end(reason);
  if (reason === 'seen'){ sfx('shout'); vib([80,40,140]); }
}
function startCollapse(){
  G.mode = 'collapse'; G.skill = null; G.dash = null; G.push = null; G.pushing = false; G.walking = false;
  G.collapse = {
    t:0,
    pieces: G.items.map(it => ({key:it.key, def:it.def, x:it.x, y:it.landed ? SHELF_Y : it.y, vy:0, hit:false})),
  };
  G.items = [];
  G.shake = 9; G.hitstop = 0.15;
  burst(SHELF_L+4, SHELF_Y, 12, '#8a5a2b', 90, 450, 0.9, 2, true);
  burst(SHELF_R-4, SHELF_Y, 12, '#8a5a2b', 90, 450, 0.9, 2, true);
  burst(90, SHELF_Y, 18, '#d8d0c0', 60, -20, 0.8, 2);
  stopLoops(); sfx('collapse'); vib([60,30,60,30,220]);
}
function showOver(){
  G.mode = 'over'; G.overAt = performance.now();
  if (G.reason==='collapse'){
    $('overTitle').textContent = 'SHELF COLLAPSED';
    $('overSub').textContent = 'Too much junk. You all landed on his head.';
  } else {
    $('overTitle').textContent = 'BUSTED!';
    $('overSub').textContent = 'His eyes found you.';
  }
  const sec = Math.floor(G.time);
  $('overBreak').innerHTML = 'SURVIVED ' + Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0') + '<br>ITEMS BROKEN ' + G.itemsBroken;
  G.final = G.damage;
  $('overDmg').textContent = '$' + G.damage.toLocaleString();
  const best = parseInt(LS.get('iwm_best2') || '0', 10) || 0;
  if (G.damage > best){ LS.set('iwm_best2', String(G.damage)); $('overBest').textContent = '★ NEW BEST! ★'; }
  else $('overBest').textContent = 'BEST $' + best.toLocaleString();
  $('overBank').textContent = 'BANK $' + SAVE.wallet.toLocaleString();
  $('overNew').textContent = G.newCats.length ? 'NEW CAT: ' + G.newCats.join(', ').toUpperCase() + '!' : '';
  $('over').classList.remove('hidden');
  sfx(G.reason==='collapse' ? 'collapseOver' : 'bust');
}

/* ----- skill check: starts when his gaze lands on the cat ----- */
function startSkill(){
  const c = lerp(0.35, 0.8, G.skillRng());
  const d = diff(), w = D.skillW(d);
  G.skill = {t:0, buf:D.skillBuf(d), spin:D.skillSpin(d), z0:c - w/2, z1:c + w/2};
  G.chain = []; G.pushing = false; G.walking = false;
  G.shake = Math.max(G.shake, 2);
  sfx('skillAppear');
  if (G.tut){ Tut.skillStart(); return; }
  Tips.times('skill', 3, inputMode === 'touch' ? 'TAP WHEN THE NEEDLE\nHITS THE PINK ZONE' : 'PRESS SPACE WHEN THE\nNEEDLE HITS THE PINK ZONE', 2600);
}
function failSkill(label){
  if (G.tut){ Tut.skillFail(label); return; }
  Stats.skill(false);
  popup(90, 64, label);
  sfx('skillFail');
  G.flashCol = '#f33';
  endRun('seen');
  G.flashCol = '#f33';
}
function skillPress(){
  const sk = G && G.mode==='play' && !G.paused ? G.skill : null;        // (pressing while paused used to resolve the check and soft-lock the pause screen)
  if (!sk || sk.t < sk.buf) return;                    // buffer: presses are ignored
  const p = (sk.t - sk.buf) / sk.spin;
  if (p >= sk.z0 && p <= sk.z1){
    G.skill = null; if (!G.tut) Stats.skill(true);
    popup(90, 64, 'GREAT!');
    sfx('skillGreat'); vib(25);
    burst(90, 88, 18, '#ffd24a', 100, 120, 0.7, 2);
    burst(90, 88, 8, '#fff', 70, 80, 0.5, 1);
    G.flash = 0.35; G.flashCol = '#fff8c0';
    startDash();
    if (G.tut) Tut.skillOk();
  } else failSkill('SLIP!');
}
// smooth dash to the nearest free spot outside the zone he is looking at
const DASH_MIN = 55;                     // px: a successful dash always carries the cat at least this far (when the shelf allows it)
function startDash(){
  const o = G.owner, z = zoneRange(o.looks[o.idx].zone), c = G.cat;
  const landed = G.items.filter(i => i.landed && i.front);
  const spots = [];
  for (let x = SHELF_L+CW+1; x <= SHELF_R-CW-1; x++){
    if (x >= z[0]-3 && x < z[1]+3) continue;
    if (landed.some(i => Math.abs(i.x - x) < i.w/2 + CW + 1)) continue;
    spots.push(x);
  }
  let best = null;
  const far = spots.filter(x => Math.abs(x - c.x) >= DASH_MIN);
  if (far.length) best = far.reduce((a, b) => Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a);          // the nearest spot that is far enough
  else if (spots.length) best = spots.reduce((a, b) => Math.abs(b - c.x) > Math.abs(a - c.x) ? b : a);   // otherwise the farthest there is
  if (best === null){
    const a = z[0]-6, b = z[1]+6;
    best = clamp(Math.abs(c.x-a) < Math.abs(c.x-b) ? a : b, SHELF_L+CW, SHELF_R-CW);
  }
  G.push = null;
  G.dash = {x0:c.x, x1:best, t:0, dur:0.3};
  c.dir = Math.sign(best - c.x) || c.dir;
  G.ghostT = 0;
  burst(c.x, SHELF_Y-2, 6, '#d8d0c0', 40, 0, 0.3, 1);
}

/* ----- cat movement -----
   The cat walks freely along the shelf (background items don't matter).
   Bumping a lit (front) item starts a push; from then on neither the cat nor that
   item can touch anything else until the item is off the shelf. */
/* ----- jump (Fika's ability): a somersault that carries the cat over lit items -----
   Direction = held direction or the way the cat faces. If an item would be under the landing spot, the cat lands just beyond it.
   Jumping out of a push cancels the push. Short cooldown. While airborne a gaze can't start a skill check (it starts on landing). */
function jumpCat(){
  if (!G || G.mode !== 'play' || G.paused || !hasAbility('jump') || G.jump || G.dash || G.skill || G.jumpCd > 0 || G.tutFreeze) return false;
  const c = G.cat, dir = moveDir() || c.dir || 1;
  let x1 = c.x + dir*JUMP_DIST;
  for (let k = 0; k < 4; k++){                                                // never land inside a lit item
    const hit = G.items.find(i => i.landed && i.front && Math.abs(i.x - x1) < i.w/2 + CW + 1);
    if (!hit) break;
    x1 = hit.x + dir*(hit.w/2 + CW + 2);
  }
  x1 = clamp(x1, SHELF_L + CW, SHELF_R - CW);
  if (Math.abs(x1 - c.x) < 14){                                               // wall in the way: hop the other way instead
    x1 = clamp(c.x - dir*JUMP_DIST, SHELF_L + CW, SHELF_R - CW);
    if (Math.abs(x1 - c.x) < 14) return false;
  }
  G.push = null; G.chain = [];
  G.jump = {x0:c.x, x1, t:0, dur:JUMP_DUR, dir:Math.sign(x1 - c.x) || dir};
  G.jumpCd = JUMP_CD; c.dir = G.jump.dir; G.moved = true; Stats.count('jumps'); if (G.tut) G.tut.used = true;
  burst(c.x, SHELF_Y-1, 5, '#fff6ea', 35, 80, 0.3, 1);
  sfx('jump', {pan:SFX.panOf(c.x)});
  const jb = $('jumpBtn'); jb.classList.remove('down'); void jb.offsetWidth; jb.classList.add('down'); setTimeout(() => jb.classList.remove('down'), 140);
  return true;
}
// Pressing the other way while committed to a push used to be ignored in silence (it looked like broken input).
function lockFeedback(){
  if (G.lockT > 0) return;
  G.lockT = 0.5; G.lockShake = 0.2; Stats.count('locks');
  sfx('nope', {pan:SFX.panOf(G.cat.x)});
  Tips.once('lock', hasAbility('jump') ? 'FINISH THE PUSH!\n(OR JUMP OUT OF IT)' : 'FINISH THE PUSH FIRST!', 2600);
}
function updateCat(dt){
  const c = G.cat;
  G.pushing = false; G.walking = false; G.chain = [];
  if (G.jump){
    const j = G.jump; j.t += dt;
    const p = Math.min(1, j.t/j.dur), e = 1 - Math.pow(1 - p, 3);        // same ease-out as the dash, same duration: a jump is as quick as a dash
    c.x = j.x0 + (j.x1 - j.x0)*e;
    if (p >= 1){ G.jump = null; G.hop = 0.2; burst(c.x, SHELF_Y-1, 6, '#d8d0c0', 35, 100, 0.35, 1); sfx('step', {pan:SFX.panOf(c.x), vol:1.6}); }
    return;
  }
  if (G.dash){
    const d = G.dash; d.t += dt;
    const p = Math.min(1, d.t/d.dur);
    c.x = d.x0 + (d.x1 - d.x0) * (1 - Math.pow(1-p, 3));
    G.ghostT -= dt;
    if (G.ghostT <= 0){ G.ghostT = 0.03; G.ghosts.push({x:c.x, y:G.catY, dir:c.dir, t:0}); }
    if (p >= 1){ G.dash = null; G.hop = 0.2; burst(c.x, SHELF_Y-1, 6, '#d8d0c0', 35, 100, 0.35, 1); }
    return;
  }
  if (G.skill) return;                                   // frozen in his gaze
  const dir = moveDir();
  if (!dir) return;
  G.moved = true;
  let P = G.push;
  if (P && dir !== P.dir){ lockFeedback(); return; }     // committed: only keep pushing the same way (and tell the player so)
  c.dir = dir;
  const dust = (rate) => {                               // dust kicked up by the paws
    G.dustT -= dt;
    if (G.dustT <= 0){
      G.dustT = rate;
      G.parts.push({x:c.x - dir*CW, y:SHELF_Y-1, vx:-dir*(8+Math.random()*10), vy:-10-Math.random()*8, g:20,
                    t:0, life:0.35, col:'#d8d0c0', size:1});
    }
  };
  if (!P){
    const fe = c.x + dir*CW;                             // front edge of the cat
    let best = null, gap = Infinity;
    for (const it of G.items){
      if (!it.landed || !it.front) continue;
      const near = dir>0 ? it.x - it.w/2 : it.x + it.w/2;
      const g = (near - fe) * dir;
      if (g >= -0.5 && g < gap){ gap = g; best = it; }
    }
    const mv = WALK_SPEED*dt;
    if (best && gap <= mv + 0.5){                        // contact: start pushing
      G.push = P = {item:best, dir};
      c.x = best.x - dir*(best.w/2 + CW);
    } else {
      const nx = clamp(c.x + dir*mv, SHELF_L+CW, SHELF_R-CW);
      G.walking = nx !== c.x; c.x = nx;
      if (G.walking) dust(0.12);
      return;
    }
  }
  const it = P.item;
  const v = Math.max(PUSH_MIN, Math.min(WALK_SPEED, PUSH_K / it.def.t));
  it.x += dir * v * dt;
  c.x = it.x - dir*(it.w/2 + CW);
  G.pushing = true; dust(0.07);
  if ((dir<0 && it.x <= SHELF_L) || (dir>0 && it.x >= SHELF_R)){      // center past the edge -> it falls
    G.items.splice(G.items.indexOf(it), 1);
    G.push = null; G.promoT = 0.45;
    dropItem(it, dir);
  }
}

function update(dt){
  if (!G || G.mode==='over' || G.paused || Poki.busy || G.tutFreeze) return;      // (tutFreeze: the tutorial explanation is up)
  if (G.hitstop > 0){ G.hitstop -= dt; return; }          // freeze frame on big hits
  stepParts(dt);
  if (G.mode==='ending'){
    G.endDelay -= dt;
    G.owner.anim += dt;
    stepFalling(dt);
    G.shake = Math.max(0, G.shake - dt*20);
    if (G.endDelay <= 0) showOver();
    return;
  }
  if (G.mode==='collapse'){
    const cl = G.collapse; cl.t += dt;
    const tx = headCx(), ty = headTop();
    const fall = o => { o.vy += 600*dt; o.y = Math.min(ty, o.y + o.vy*dt); o.x += (tx - o.x)*Math.min(1, dt*2.5); };
    for (const pc of cl.pieces){
      fall(pc);
      if (!pc.hit && pc.y >= ty - 0.5){
        pc.hit = true; burst(pc.x, pc.y, 5, pc.def.col, 55, 320, 0.5, 1);
        G.shake = Math.max(G.shake, 4); if (SFX.ctx) sfx('impactTick', SFX.ctx.currentTime, SFX.panOf(pc.x));
      }
    }
    const cat = {x:G.cat.x, y:G.catY, vy:G.catVy||0}; fall(cat);
    G.cat.x = cat.x; G.catY = cat.y; G.catVy = cat.vy;
    stepFalling(dt);
    G.shake = Math.max(0, G.shake - dt*8);
    if (cl.t >= 1.1) endRun('collapse');
    return;
  }

  if (!G.tut) G.time += dt;                                  // the tutorial holds the clock: difficulty stays at the very start
  if (Math.floor(G.time) !== G.lastSec){ G.lastSec = Math.floor(G.time); Stats.sync(); }
  if (!G.abilityTip && G.time > 6){                           // once per player: how to use this character's ability
    G.abilityTip = true;
    const touch = inputMode === 'touch';
    if (hasAbility('jump')) Tips.once('ab_jump', touch ? 'SWIPE UP / JUMP BUTTON:\nSOMERSAULT OVER ITEMS' : 'ARROW UP: JUMP\nSOMERSAULT OVER ITEMS', 3400);
    else if (hasAbility('throw')) Tips.once('ab_throw', touch ? 'SWIPE DOWN / BUTTON:\nDROP A VASE ON HIM' : 'ENTER: DROP A VASE\nON HIS HEAD', 3400);
  }
  if (G.tut) Tut.update(dt);
  updateOwner(dt);

  // his gaze lands on the cat -> skill check
  const o = G.owner;
  if (o.state==='GAZE' && !G.skill && !G.dash && !G.jump && inZone(o.looks[o.idx].zone, G.cat.x)) startSkill();
  if (G.skill){
    G.skill.t += dt;
    const sp = (G.skill.t - G.skill.buf) / G.skill.spin;
    if (sp >= 0){ const ti = Math.floor(sp*10); if (ti !== G.skill.lastTick){ G.skill.lastTick = ti; sfx('skillTick', ti); } }
    if (G.skill.t >= G.skill.buf + G.skill.spin){ failSkill('MISS'); return; }
  }

  // new items fall from the sky onto the shelf
  const cdBefore = G.throwCd;
  G.throwCd = Math.max(0, G.throwCd - dt);
  G.jumpCd = Math.max(0, G.jumpCd - dt);
  G.lockT = Math.max(0, G.lockT - dt); G.lockShake = Math.max(0, G.lockShake - dt);
  if (cdBefore > 0 && G.throwCd === 0 && hasAbility('throw')){
    sfx('ready'); popup(90, 232, 'THROW READY!');
    const tb = $('throwBtn'); tb.classList.remove('just'); void tb.offsetWidth; tb.classList.add('just');
  }
  if (o.state === 'CALM'){ G.tapT -= dt; if (G.tapT <= 0){ sfx('phoneTap'); G.tapT = 0.35 + Math.random()*1.1; } }
  G.spawnT -= dt;
  if (G.spawnT <= 0){
    G.spawnT = D.spawnEvery(diff()) * lerp(0.8, 1.25, G.spawnRng()) * (1 - 0.3*overdrive());
    if (!(G.tut && G.items.length >= TUT_MAX_ITEMS)) addShelfItem(false);       // (the tutorial never lets the shelf fill up)
    if (G.mode!=='play') return;
  }
  for (const it of G.items){
    if (it.landed){ it.sq = Math.max(0, it.sq - dt*6); it.pop = Math.max(0, it.pop - dt*4); continue; }
    it.vy += D.gravity(diff()) * (1 + 0.3*overdrive()) * dt; it.y += it.vy*dt;
    if (it.y >= SHELF_Y){
      it.y = SHELF_Y; it.landed = true; it.sq = 1;
      G.shake = Math.max(G.shake, 1.2);
      burst(it.x, SHELF_Y-1, 3, '#d8d0c0', 22, 60, 0.3, 1);
      sfx('land', {mass:massOf(it.def), pan:SFX.panOf(it.x)});
    }
  }

  const fronts = G.items.filter(i => i.landed && i.front).length;
  if (fronts < D.fronts(diff())){                 // more items come to the front as time goes by
    G.promoT -= dt;
    if (G.promoT <= 0){ promoteOne(); G.promoT = D.promoDelay(diff()); }
  } else G.promoT = D.promoDelay(diff());
  updateCat(dt);
  if (G.moved) $('hint').classList.add('hidden');
  {                                                        // OIIA: little hops, tilting left and right while moving
    const mv = G.walking || G.pushing;
    if (mv) G.catPh += dt*12;
    const tr = mv ? Math.sin(G.catPh)*0.32 : 0, th = mv ? Math.abs(Math.sin(G.catPh))*3.5 : 0;
    G.catRot += (tr - G.catRot)*Math.min(1, dt*18); G.catHop += (th - G.catHop)*Math.min(1, dt*22);
  }
  // footsteps, push scrape loop, edge creak
  if (G.walking){ G.stepT -= dt; if (G.stepT <= 0){ sfx('step', {pan:SFX.panOf(G.cat.x)}); G.stepT = 0.2; } } else G.stepT = 0;
  if (G.pushing && G.push){
    const pit = G.push.item;
    if (!G.pushH && !SFX.muted) G.pushH = SFX.S.pushStart(clamp((pit.def.t - 0.3)/2.2, 0, 1), SFX.panOf(G.cat.x));
    const de = Math.min(pit.x - SHELF_L, SHELF_R - pit.x);
    if (de < 14 && !pit.tipped){ pit.tipped = true; sfx('tip', {pan:SFX.panOf(pit.x)}); }
  } else if (G.pushH){ G.pushH.stop(); G.pushH = null; }
  if (G.items.length >= MAX_ITEMS-1){                       // the shelf complains
    G.creakT -= dt;
    if (G.creakT <= 0){ sfx('creak', G.items.length >= MAX_ITEMS ? 1 : 0.6); G.creakT = 1.3 + Math.random()*0.8; }
  } else G.creakT = 0.4;

  stepFalling(dt);
  G.shake = Math.max(0, G.shake - dt*20);
  G.catAnim += dt;
}

/* ----- throw an item at the owner ----- */
function throwItem(){
  if (!G || G.mode!=='play' || G.paused || G.tutFreeze || !hasAbility('throw') || G.throwCd > 0 || G.owner.state==='STUN') return;
  let best = null;
  for (const it of G.items)
    if (it.landed && (!best || Math.abs(it.x-94) < Math.abs(best.x-94))) best = it;
  if (!best) return;
  if (G.push && G.push.item === best) G.push = null;
  G.items.splice(G.items.indexOf(best), 1);
  G.thrown.push({key:best.key, def:best.def, x:best.x, y:SHELF_Y - best.h/2, vy:-70, r:0});
  G.throwCd = THROW_CD; Stats.count('throws'); if (G.tut) G.tut.used = true;
  burst(best.x, SHELF_Y, 5, '#d8d0c0', 30, 50, 0.3, 1);
  sfx('throwWhoosh', {pan:SFX.panOf(best.x)});
}
function stepThrown(dt){
  for (let i = G.thrown.length-1; i >= 0; i--){
    const f = G.thrown[i], def = f.def;
    f.vy += 650*dt; f.y += f.vy*dt; f.r += dt*11;
    f.x += (headCx() - f.x) * Math.min(1, dt*4);
    if (f.y + def.h/2 < headTop()) continue;
    G.thrown.splice(i,1);                                  // impact on the owner's head
    const bonk = Math.round(def.d * MONEY_SCALE);
    G.damage += bonk; addMoney(bonk); G.itemsBroken++;
    G.suspicion = clamp(G.suspicion + 2 + def.d/220, 0, 100);
    G.shake = Math.max(G.shake, 7); G.hitstop = Math.max(G.hitstop, 0.1);
    G.flash = 0.3; G.flashCol = '#fff';
    popup(headCx(), headTop()-34, 'BONK +$' + bonk, def.d + 200);
    burst(f.x, headTop(), 10, def.col, 80, 300, 0.5, 2);
    burst(f.x, headTop()-2, 6, '#ffd24a', 60, 100, 0.5, 2);
    sfx('bonk', {pan:SFX.panOf(f.x)}); vib(40);
    G.falling.push({key:f.key, def, x:f.x, y:FLOOR_Y-def.h/2, landed:true, life:6, r:0});
    if (G.mode==='play'){                                  // he's distracted, any gaze is cancelled
      const o = G.owner, k = clamp(standK(o), 0, 1);
      o.state = 'STUN'; o.t = 0; o.dur = STUN_TIME; o.anim = 0; o.k0 = k;
      G.skill = null;
      sfx('gazeStop');                                    // his stare is interrupted: the drone must stop too
      G.dropsInWindow = 0; G.combo = 1;
    }
  }
}

function stepFalling(dt){
  stepThrown(dt);
  for (const f of G.falling){
    if (f.landed) continue;
    f.vy += 520*dt; f.y += f.vy*dt; f.x += f.vx*dt; f.r += Math.sign(f.vx||1)*dt*9;
    const h = f.def.h;
    if (f.y + h/2 >= FLOOR_Y){
      f.y = FLOOR_Y - h/2; f.landed = true; f.life = 6;
      const def = f.def;
      G.shake = Math.max(G.shake, 2 + Math.min(8, def.d/150));
      burst(f.x, FLOOR_Y-2, 7 + Math.min(14, Math.round(def.d/120)), def.col, 70 + Math.min(60, def.d/20), 380, 0.8, 1, true);
      burst(f.x, FLOOR_Y-2, 3, '#fff', 50, 300, 0.4, 1, true);
      const kind = SND[f.key][0], mass = massOf(def), pan = SFX.panOf(f.x);       // the smash itself, then the money
      SFX.impact(kind, {mass, pan, big:def.d >= 250});
      sfx('cash', f.combo || 1, (f.gain || 0) / MONEY_SCALE);
      const lvl = COMBO_MULT.indexOf(f.combo); if (lvl >= 1) sfx('comboUp', lvl);
      vib(def.d >= 250 ? 45 : 18);
      if (def.d >= 250) G.hitstop = Math.max(G.hitstop, 0.05);
    }
  }
}
