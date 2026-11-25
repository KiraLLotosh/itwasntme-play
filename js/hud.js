'use strict';
/* HTML HUD updates: money plate, throw button, arrow highlight */

let lastReady = null, lastJumpReady = null;
function updateHud(){
  if (!G){ return; }
  $('hint').classList.toggle('hidden', !(G.mode === 'play' && !G.moved && !G.paused && !G.tut));      // tutorial lines only while playing
  const tb = $('throwBtn'), ready = G.throwCd <= 0;
  tb.classList.toggle('hidden', !hasAbility('throw'));                    // only characters with the VASE DROP ability get the button
  tb.classList.toggle('ready', ready);
  $('thFill').style.height = (ready ? 100 : (1 - G.throwCd/THROW_CD)*100) + '%';
  $('thLbl').textContent = ready ? 'THROW' : String(Math.ceil(G.throwCd));
  if (ready !== lastReady){ lastReady = ready; icon($('thIc'), ready ? 'ico_throw_r' : 'ico_throw', 2); }
  const jb = $('jumpBtn'), canJump = hasAbility('jump'), jr = G.jumpCd <= 0;
  jb.classList.toggle('hidden', !canJump);                              // Fika's JUMP button (Mochi has the VASE DROP button instead)
  if (canJump){
    jb.classList.toggle('ready', jr);
    $('jmFill').style.height = (jr ? 100 : (1 - G.jumpCd/JUMP_CD)*100) + '%';
    $('jmLbl').textContent = 'JUMP';
    if (jr !== lastJumpReady){ lastJumpReady = jr; icon($('jmIc'), jr ? 'ico_jump_r' : 'ico_jump', 2); }
  }
  const sl = $('skillLbl');                                              // inside the skill ring: what to do, and when
  sl.classList.toggle('hidden', !G.skill);
  if (G.skill){ const wait = G.skill.t < G.skill.buf; sl.textContent = wait ? 'WAIT' : 'HIT!'; sl.classList.toggle('wait', wait); }
  setArrow('L', keys.L || [...ptrs.values()].some(p => p.side < 0));      // arrows light up for keys and for touches
  setArrow('R', keys.R || [...ptrs.values()].some(p => p.side > 0));
  G.dispDmg += (G.damage - G.dispDmg) * 0.2;                       // rolling counter
  if (Math.abs(G.damage - G.dispDmg) < 1) G.dispDmg = G.damage;
  $('dmg').textContent = '$' + Math.round(G.dispDmg).toLocaleString();
  if (G.damage > (G.lastDmg || 0)){                                // the money plate pops on every gain
    const mp = $('moneyPlate'); mp.classList.remove('bump'); void mp.offsetWidth; mp.classList.add('bump');
  }
  G.lastDmg = G.damage;
  $('combo').textContent = 'x' + G.combo;                          // hidden for now
}
