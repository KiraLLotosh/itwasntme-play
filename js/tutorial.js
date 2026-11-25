'use strict';
/* First-run tutorial: a short, scripted walk through every mechanic, played inside the player's very first run.
   Flow (G.tut.step): push -> money -> ability (only for cats that have one) -> rise -> watch -> skill -> (done).
   * While it runs the clock (G.time) is held, so the difficulty stays at the very start; spawns are capped at 5 items (no collapse).
   * The owner is held seated until WE make him stand up; his beam is steered onto the cat so the first skill check is guaranteed.
   * The first skill check freezes the game with an explanation (tap / Space continues), has a wide zone and a slow needle,
     and a miss is only a retry (never BUSTED). Passing it ends the tutorial for good ('iwm_tut' in localStorage).
   * PAUSE shows SKIP TUTORIAL while it runs. Debug: ?tut forces it, ?notut / ?autostart / ?seed switch it off (dev builds only). */
const TUT_KEY = 'iwm_tut';
 const TUT_DEBUG = 0;
const TUT_MAX_ITEMS = 5;                  // the shelf never gets fuller than this while the tutorial runs

const Tut = (() => {
  let shown = '', hideTimer = null;
  const touch = () => inputMode === 'touch';
  const total = () => (hasAbility('jump') || hasAbility('throw')) ? 4 : 3;
  const zoneNow = () => ZONE_KEYS.find(z => inZone(z, G.cat.x)) || (G.cat.x < 90 ? 'L' : 'R');
  const holdOwner = o => { if (o.state === 'CALM') o.dur = 1e9; };      // he stays seated until the tutorial says so

  function panel(title, body, key){
    const sig = title + '|' + body + '|' + (key || '');
    if (sig === shown) return; shown = sig;
    const p = $('tut');
    if (!p) return;
    if (!title){ p.classList.add('hidden'); return; }
    $('tutT').textContent = title; $('tutB').innerHTML = body.split('\n').join('<br>'); $('tutK').textContent = key || '';
    p.classList.remove('hidden');
  }
  function hideLater(ms){ clearTimeout(hideTimer); hideTimer = setTimeout(() => panel('', ''), ms); }
  function reset(){ clearTimeout(hideTimer); shown = ''; panel('', ''); }

  function begin(){
    reset();
    const on = TUT_DEBUG > 0 || (TUT_DEBUG === 0 && LS.get(TUT_KEY) !== '1');
    G.tutFreeze = false;
    G.tut = on ? {step:'push', t:0, tries:0, used:false, freezeAt:0} : null;
    if (on) Stats.tip('tut_start');
  }
  function go(step){
    const T = G.tut; T.step = step; T.t = 0;
    if (step === 'ability' && hasAbility('throw')) G.throwCd = 0;       // the vase drop is ready to be tried right away
  }
  function finish(msg){
    const T = G.tut; if (!T) return;
    G.tut = null; G.tutFreeze = false;
    LS.set(TUT_KEY, '1');
    Tips.mark(['rise', 'skill', 'ab_jump', 'ab_throw']);                 // the tutorial already said all that
    if (msg){
      Stats.tip('tut_done'); Stats.tip('tut_tries' + T.tries);
      shown = ''; panel('NICE ESCAPE!', 'HE SITS BACK DOWN.\nNEXT TIME YOU CAN ALSO\nWALK OUT OF HIS BEAM.\nBREAK EVERYTHING!', '');
      hideLater(5200);
    } else { Stats.tip('tut_skip'); reset(); if (G.owner.state === 'CALM') enterOwner('CALM'); }     // skipped: the owner goes back to his normal rhythm
  }

  function update(dt){
    const T = G.tut; if (!T) return;
    T.t += dt;
    const o = G.owner, n = total();
    switch (T.step){
      case 'push':
        holdOwner(o);
        panel('1/' + n + ' PUSH IT OFF', touch() ? 'HOLD THE LEFT / RIGHT\nSIDE OF THE SCREEN TO\nWALK. BUMP THE GLOWING\nITEM, KEEP PUSHING!' : 'ARROWS: WALK INTO THE\nGLOWING ITEM AND KEEP\nPUSHING UNTIL IT FALLS!');
        if (G.itemsBroken > 0) go('money');
        break;
      case 'money':
        holdOwner(o);
        panel('CASH!', 'EVERY ITEM IS MONEY.\nBUT NEW JUNK KEEPS\nFALLING: 8 ITEMS ON THE\nSHELF AND IT COLLAPSES!');
        if (T.t > 4.4) go((hasAbility('jump') || hasAbility('throw')) ? 'ability' : 'rise');
        break;
      case 'ability': {
        holdOwner(o);
        const jump = hasAbility('jump');
        panel('2/' + n + (jump ? ' JUMP' : ' VASE DROP'), jump
          ? (touch() ? 'SWIPE UP OR PRESS THE\nJUMP BUTTON: SOMERSAULT\nOVER ITEMS. TRY IT!' : 'ARROW UP: SOMERSAULT\nOVER ITEMS.\nTRY IT NOW!')
          : (touch() ? 'SWIPE DOWN OR PRESS THE\nBUTTON: DROP AN ITEM ON\nHIS HEAD. TRY IT!' : 'ENTER: DROP AN ITEM ON\nHIS HEAD AND STUN HIM.\nTRY IT NOW!'));
        if ((T.used && T.t > 1.2) || T.t > 11) go('rise');
        break;
      }
      case 'rise':                                                      // wait until he is seated and calm, then make him stand up
        if (o.state === 'CALM'){
          enterOwner('RISE'); o.looks.length = 1; o.looks[0].zone = zoneNow();
          go('watch');
        }
        break;
      case 'watch':
        panel((n - 1) + '/' + n + ' DANGER!', 'HE IS STANDING UP.\nHIS BEAM WILL FIND YOU!');
        if ((o.state === 'AIM' || o.state === 'GAZE') && !G.skill) o.looks[o.idx].zone = zoneNow();     // the beam tracks the cat
        if (!G.skill && (o.state === 'SIT' || o.state === 'CALM' || o.state === 'STUN')) go('rise');    // he gave up without a check: try again
        break;
      case 'skill':
        if (G.tutFreeze){
          panel(n + '/' + n + ' HE SEES YOU!', 'A NEEDLE SPINS ROUND.\nHIT THE PINK ZONE TO\nDASH AWAY SAFE.\nMISS IT = BUSTED!', touch() ? 'TAP TO START' : 'PRESS SPACE');
        } else if (G.skill){
          panel(T.tries ? 'TRY AGAIN!' : 'NOW!', (touch() ? 'TAP' : 'PRESS SPACE') + ' WHEN THE\nNEEDLE IS IN THE\nPINK ZONE');
        }
        break;
    }
  }

  // a gaze landed on the cat (called from startSkill): easy first check, and the very first one freezes the game with an explanation
  function skillStart(){
    const T = G.tut, sk = G.skill;
    const c = (sk.z0 + sk.z1)/2, w = Math.min(0.5, 0.36 + 0.06*T.tries);
    sk.z0 = c - w/2; sk.z1 = c + w/2; sk.spin = 2.4; sk.buf = 0.5;
    T.step = 'skill'; T.t = 0;
    if (T.tries === 0){ sk.t = 0.2; G.tutFreeze = true; T.freezeAt = performance.now(); sfx('click'); }   // (t = 0.2: the ring is fully popped in while frozen)
    update(0);                                                          // show the explanation now (update() is not called while frozen)
  }
  function skillFail(label){                                            // a miss in the tutorial is only a retry; the next check starts by itself
    const T = G.tut; T.tries++;
    popup(90, 64, label); sfx('skillFail'); G.flash = 0.3; G.flashCol = '#f33'; G.skill = null;
  }
  const skillOk = () => finish(true);
  function advance(){                                                   // tap / Space while the explanation is up
    const T = G && G.tut;
    if (!T || !G.tutFreeze || performance.now() - T.freezeAt < 450) return;
    G.tutFreeze = false; sfx('click');
  }
  function skip(){ if (G && G.tut) finish(false); }

  // drawn just under the skill ring: a dim layer while the explanation is up (the lit item already has its own arrow)
  function draw(){
    const T = G.tut; if (!T) return;
    if (G.tutFreeze){ ctx.globalAlpha = 0.5; rect(0, 0, W, H, '#14103a'); ctx.globalAlpha = 1; }
  }
  return {begin, update, draw, skillStart, skillFail, skillOk, advance, skip};
})();
