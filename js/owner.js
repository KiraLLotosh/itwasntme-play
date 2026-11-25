'use strict';
/* Owner state machine (CALM -> RISE -> AIM -> GAZE -> SIT), pose and body geometry */

// CALM (sitting, phone) -> RISE (stands up: DANGER tell) -> [AIM (head turns, zone
// faintly lit) -> GAZE (zone lit red)] x 1..3 -> SIT -> CALM.
// Random numbers are always drawn in the same amount per state entry.
function enterOwner(st, k0){
  const o = G.owner, s = G.suspicion/100;
  o.state = st; o.t = 0; o.anim = 0;
  if (st !== 'GAZE') sfx('gazeStop');
  if (st==='CALM'){
    const u = G.ownerRng();
    // the first check comes only after the grace period, later ones get more and more frequent
    o.dur = G.rises === 0 ? lerp(GRACE, GRACE + 3, u) : lerp(2.3, 5.0, u) * D.calmScale(diff()) * lerp(1, 0.75, s);
  } else if (st==='RISE'){
    const d = diff();
    o.dur = D.riseTime(d);
    const u1 = G.ownerRng(), u2 = G.ownerRng(), u3 = G.ownerRng();
    const n = 1 + (u1 < D.lookChance[0](d) + 0.15*s ? 1 : 0) + (u2 < D.lookChance[1](d) + 0.1*s ? 1 : 0) + (u3 < D.lookChance[2](d) ? 1 : 0);
    o.looks = []; let prev = null;
    for (let i=0;i<4;i++){
      const zu = G.ownerRng(), du = G.ownerRng();
      let zi = Math.floor(zu*3);
      if (ZONE_KEYS[zi]===prev) zi = (zi + 1 + (du<0.5 ? 0 : 1)) % 3;
      prev = ZONE_KEYS[zi];
      o.looks.push({zone:prev, gu:du});
    }
    o.looks.length = n; o.idx = 0;
    o.g = D.zoneGrow(d);                                    // wider gaze as time goes by
    G.rises++; G.legFrom = G.legTo; G.legTo = Math.min(LEG_MAX, G.rises * LEG_STEP);
    sfx('phoneBuzz'); sfx('rise', G.legTo);
    Tips.once('rise', 'HE IS STANDING UP!\nSTAY OUT OF HIS BEAM', 3200);                  // phone buzzes, he stands up, legs creak and stretch
    G.dropsInWindow = 0; G.combo = 1;
  } else if (st==='AIM'){
    o.dur = Math.max(0.26, D.aimTime(diff()) * lerp(1, 0.85, s));
    sfx('aim');
  } else if (st==='GAZE'){
    o.dur = D.gazeTime(diff()) * lerp(0.85, 1.25, o.looks[o.idx].gu) * lerp(1, 0.85, s);
    G.shake = Math.max(G.shake, 1.5);
    sfx('gazeStart');
  } else if (st==='SIT'){
    o.dur = D.sitTime(diff()); o.k0 = k0===undefined ? 1 : k0;
  }
}
function updateOwner(dt){
  const o = G.owner; o.anim += dt;
  if (o.state==='GAZE' && G.skill) return;     // he keeps staring while you are being checked
  o.t += dt;
  if (o.t < o.dur) return;
  switch (o.state){
    case 'CALM': enterOwner('RISE'); break;
    case 'RISE': enterOwner('AIM'); break;
    case 'AIM':  enterOwner('GAZE'); break;
    case 'GAZE':
      if (o.idx + 1 < o.looks.length){ o.idx++; enterOwner('AIM'); } else enterOwner('SIT');
      break;
    case 'SIT':  enterOwner('CALM'); break;
    case 'STUN': if (o.k0 > 0.05) enterOwner('SIT', o.k0); else enterOwner('CALM'); break;
  }
}
// 0 = sitting on the couch, 1 = standing. Raw value: squats below 0 before rising, overshoots above 1.
function standK(o){
  switch (o.state){
    case 'RISE': {
      const u = o.t / o.dur;
      return u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3)/2;       // smooth ease in-out
    }
    case 'AIM': case 'GAZE': return 1;
    case 'SIT': return o.k0 * (1 - easeOutCubic(o.t/o.dur));
    case 'STUN': case 'ANGRY': return o.k0;
    default: return 0;
  }
}
// current extra leg length (px): stretches out while he rises
function legExtra(){
  const o = G.owner;
  return o.state==='RISE' ? lerp(G.legFrom, G.legTo, easeOutCubic(Math.min(1, o.t/o.dur))) : G.legTo;
}
// Body geometry. When he is too tall for the shelf, the spine bends forward under it.
function ownerPose(){
  const o = G.owner, k = standK(o), ext = legExtra();
  const bx = 78, by = 214;
  const bodyH = Math.round(lerp(22, 26, clamp(k,0,1)));
  const spine = 16 + bodyH;
  const natHead = by - (46 + ext)*k;
  const hip = natHead + spine;
  const r = hip - CEIL;
  const h = (k > 0.05 && r < spine) ? spine - r : 0;       // horizontal part of the spine
  const headY = Math.round(h > 0 ? CEIL : natHead);
  return {k, ext, bodyH, spine, hip, h:Math.round(h), headY, headX: bx + 8 + Math.round(h), bx, by};
}
const headTop = () => ownerPose().headY;
const headCx = () => ownerPose().headX + 8;
