'use strict';
/* Input (keys, touch, swipe), menus, pause, sound toggle */

// Arrows / A D, or touch left / right half of the screen: walk (and push what is in front).
// Space or a tap: answer a skill check. Enter or swipe down: throw something at him.
const keys = {L:false, R:false};
const ptrs = new Map();            // active touches: id -> {side, x, y, t}
function moveDir(){
  let l = keys.L, r = keys.R;
  for (const p of ptrs.values()){ if (p.side < 0) l = true; else r = true; }
  return (r?1:0) - (l?1:0);
}
function skillReady(){ return G && G.mode==='play' && !G.paused && !G.tutFreeze && G.skill && G.skill.t >= G.skill.buf; }
wrap.addEventListener('pointerdown', e => {
  if (Poki.busy) return;
  if (e.target.closest('button') || e.target.closest('.screen')) return;
  e.preventDefault(); audio();
  inputMode = e.pointerType === 'touch' ? 'touch' : 'desk';
  if (G && G.tutFreeze){ Tut.advance(); return; }                 // tutorial explanation: any tap continues
  if (skillReady()){ skillPress(); return; }
  const r = wrap.getBoundingClientRect();
  ptrs.set(e.pointerId, {side: e.clientX < r.left + r.width/2 ? -1 : 1, x:e.clientX, y:e.clientY, t:performance.now()});
});
addEventListener('pointermove', e => {                   // swipe down = throw
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dy = e.clientY - p.y, dx = e.clientX - p.x;
  if (performance.now() - p.t > 500){ p.y = e.clientY; p.x = e.clientX; p.t = performance.now(); return; }
  if (dy > wrap.clientHeight*0.07 && dy > Math.abs(dx)*1.2){
    ptrs.delete(e.pointerId);
    throwItem();
  } else if (-dy > wrap.clientHeight*0.07 && -dy > Math.abs(dx)*1.2){      // swipe up = jump
    ptrs.delete(e.pointerId);
    jumpCat();
  }
});
function ptrUp(e){ ptrs.delete(e.pointerId); }
addEventListener('pointerup', ptrUp);
addEventListener('pointercancel', ptrUp);
addEventListener('blur', () => { ptrs.clear(); keys.L = keys.R = false; });
const KEY_L = ['ArrowLeft','KeyA'], KEY_R = ['ArrowRight','KeyD'], KEY_U = ['ArrowUp','KeyW'];
addEventListener('wheel', e => e.preventDefault(), {passive:false});      // keep the portal page from scrolling
addEventListener('keydown', e => {
  if (Poki.busy){ e.preventDefault(); return; }
  inputMode = 'desk';
  if (KEY_L.includes(e.code)){ e.preventDefault(); keys.L = true; audio(); }
  else if (KEY_R.includes(e.code)){ e.preventDefault(); keys.R = true; audio(); }
  else if (KEY_U.includes(e.code)){ e.preventDefault(); audio(); if (!e.repeat) jumpCat(); }
  else if (e.code==='Space' || e.code==='Enter'){
    e.preventDefault(); audio();
    if (e.repeat) return;
    if (G && G.tutFreeze){ Tut.advance(); return; }
    if (!$('menu').classList.contains('hidden')) startRun();
    else if (G && G.mode === 'over' && !$('over').classList.contains('hidden') && performance.now() - (G.overAt || 0) > 700) startRun();   // (not while the player is still mashing the skill-check key)
    else if (e.code==='Space') { if (skillReady()) skillPress(); }
    else throwItem();
  }
  else if (e.code==='Escape' || e.code==='KeyP'){ e.preventDefault(); if (G && G.mode==='play'){ if (G.paused) resumeGame(); else setPause(true); } }
});
addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();                  // a focused button must not be clicked by the key release

  if (KEY_L.includes(e.code)) keys.L = false;
  else if (KEY_R.includes(e.code)) keys.R = false;
});

const show = (id, on) => { const e = $(id); if (e) e.classList.toggle('hidden', !on); };       // (null-safe: the stats screen does not exist in release builds)
// pixel icons: drawn from sprites into small canvases, sized in internal pixels (x2)
function icon(canvas, name, scale){
  const sp = SPR[name]; canvas.width = sp.w; canvas.height = sp.h;
  const x = canvas.getContext('2d'); x.clearRect(0, 0, sp.w, sp.h); x.drawImage(sp.n, 0, 0);
  canvas.style.width = 'calc(var(--u) * ' + (sp.w*scale) + ')'; canvas.style.height = 'calc(var(--u) * ' + (sp.h*scale) + ')';
}
icon($('jmIc'), 'ico_jump', 2); icon($('pauseIc'), 'ico_pause', 2); icon($('arrLc'), 'ico_left', 2); icon($('arrRc'), 'ico_right', 2); icon($('thIc'), 'ico_throw', 2);
const arrowOn = {L:false, R:false};
function setArrow(side, on){
  if (arrowOn[side] === on) return;
  arrowOn[side] = on;
  $(side === 'L' ? 'arrL' : 'arrR').classList.toggle('down', on);
  icon($(side === 'L' ? 'arrLc' : 'arrRc'), side === 'L' ? (on ? 'ico_left_d' : 'ico_left') : (on ? 'ico_right_d' : 'ico_right'), 2);
}
for (const [id, side] of [['arrL', -1], ['arrR', 1]]){           // the on-screen arrows work like the screen halves
  $(id).addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); audio();
    inputMode = e.pointerType === 'touch' ? 'touch' : 'desk';
    if (G && G.tutFreeze){ Tut.advance(); return; }
    if (skillReady()){ skillPress(); return; }
    ptrs.set(e.pointerId, {side, x:e.clientX, y:e.clientY, t:performance.now()});
  });
}
// start screen: pictograms for the controls, worded for the device in use
const kIc = (id, name) => { const c = $(id), sp = SPR[name]; c.width = sp.w; c.height = sp.h; c.getContext('2d').drawImage(sp.n, 0, 0); c.style.width = 'calc(var(--u) * ' + sp.w*2 + ')'; c.style.height = 'calc(var(--u) * ' + sp.h*2 + ')'; };
function refreshKeys(){
  const touch = inputMode === 'touch', ab = curChar().ability;
  kIc('kL', 'ico_left'); kIc('kR', 'ico_right'); kIc('kAb', ab === 'throw' ? 'ico_throw' : 'ico_jump');
  $('kWalk').textContent = touch ? 'TOUCH' : 'ARROWS';
  $('kAbil').textContent = ab === 'throw' ? (touch ? 'SWIPE DOWN' : 'ENTER') : (touch ? 'SWIPE UP' : 'UP');
  $('kKey').textContent = touch ? 'TAP' : 'SPACE';
}
function refreshBest(){
  $('best').textContent = 'BEST $' + (parseInt(LS.get('iwm_best2') || '0', 10) || 0).toLocaleString();
  $('catName').textContent = curChar().name.toUpperCase();
  $('overCat').textContent = 'CAT: ' + curChar().name.toUpperCase();
  refreshKeys();
  $('saveNote').classList.toggle('hidden', LS.ok);
  $('fxBtn').textContent = 'EFFECTS: ' + (FX.low ? 'LOW' : 'FULL');
}
function beginRun(){
  audio(); sfx('start');
  for (const id of ['menu', 'over', 'pause', 'chars', 'statsScr', 'credits']) show(id, false);
  wrap.classList.add('inGame');
  ptrs.clear(); keys.L = keys.R = false;
  newRun();
  Poki.start();
}
// the very first run starts at once; every later start / restart goes through a (possible) ad break first
let starting = false;                                               // one start at a time (a double tap must not start two runs / two ad breaks)
function startRun(){
  if (starting || Poki.busy) return; starting = true;
  const go = () => { starting = false; beginRun(); };
  if (Poki.takeFirst()) go(); else Poki.commercialBreak().then(go);
}
function goMenu(){
  stopLoops(); Poki.stop(); if (G && G.mode === 'play') Stats.end('quit'); G = null;
  ptrs.clear(); keys.L = keys.R = false;
  for (const id of ['over', 'pause', 'chars', 'statsScr', 'credits']) show(id, false);
  show('menu', true); wrap.classList.remove('inGame'); refreshBest();
}
function setPause(p){
  if (!G || (p && G.mode !== 'play')) return;
  G.paused = p; show('pause', p); show('skipTut', p && !!G.tut);
  ptrs.clear(); keys.L = keys.R = false;
  if (p){ stopLoops(); Poki.stop(); Stats.count('pauses'); }
}
function resumeGame(){ Poki.commercialBreak().then(() => { setPause(false); Poki.start(); }); }
const muteBtn = $('muteBtn');
const showMute = () => {
  const t = SFX.muted ? 'OFF' : 'ON';
  icon($('muteIc'), SFX.muted ? 'ico_mute' : 'ico_snd', 2);
};
const toggleSound = () => {
  SFX.setMuted(!SFX.muted); LS.set('iwm_mute', SFX.muted ? '1' : '0'); showMute();
  if (SFX.muted) stopLoops(); else { audio(); sfx('click'); }
};
showMute();
muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
muteBtn.addEventListener('click', toggleSound);
// ---- characters screen (SHOP: buy with saved money, ACHIEVEMENTS: unlocked by playing)
function charCard(c){
  const owned = SAVE.owned.includes(c.id), sel = SAVE.sel === c.id;
  const el = document.createElement('div'); el.className = 'card ui pxb' + (sel ? ' sel' : '');
  const row = document.createElement('div'); row.className = 'row';
  const cv = document.createElement('canvas'); const sp = catSpr('cat_idle_t0', c.id);
  cv.width = sp.w; cv.height = sp.h; cv.getContext('2d').drawImage(sp.n, 0, 0);
  const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name.toUpperCase();
  row.appendChild(cv); row.appendChild(nm); el.appendChild(row);
  const inf = document.createElement('div'); inf.className = 'inf'; inf.textContent = c.info; el.appendChild(inf);
  const act = (label, fn, enabled) => {
    const b = document.createElement('button'); b.className = 'ui'; b.textContent = label; b.disabled = !enabled;
    b.addEventListener('click', fn); el.appendChild(b);
  };
  const tag = text => { const t = document.createElement('div'); t.className = 'state'; t.textContent = text; el.appendChild(t); };
  if (owned && sel) tag('SELECTED');
  else if (owned) act('SELECT', () => { selectChar(c.id); sfx('click'); renderChars(); refreshBest(); }, true);
  else if (c.group === 'shop') act('BUY $' + c.price.toLocaleString(), () => { if (buyChar(c.id)){ sfx('cash', 3, 900); renderChars(); refreshBest(); } }, SAVE.wallet >= c.price);
  else tag('LOCKED: ' + c.need);
  return el;
}
function renderChars(){
  const list = $('charList'); list.innerHTML = '';
  $('bankLine').textContent = 'BANK $' + SAVE.wallet.toLocaleString();
  for (const [title, g] of [['SHOP', 'shop'], ['ACHIEVEMENTS', 'achievement']]){
    const h = document.createElement('div'); h.className = 'grp'; h.textContent = title; list.appendChild(h);
    for (const c of CHARACTERS.filter(c => c.group === g)) list.appendChild(charCard(c));
  }
}
$('charBtn').addEventListener('click', () => { audio(); sfx('click'); renderChars(); show('over', false); show('chars', true); });
$('charsBack').addEventListener('click', () => { sfx('click'); show('chars', false); show('over', true); refreshBest(); });
$('creditsBtn').addEventListener('click', e => { e.stopPropagation(); sfx('click'); show('menu', false); show('credits', true); });     // (stopPropagation: a click on the title screen starts the run)
$('creditsBack').addEventListener('click', () => { sfx('click'); show('credits', false); show('menu', true); });
$('fxBtn').addEventListener('click', () => { FX.low = !FX.low; LS.set('iwm_fx', FX.low ? 'low' : 'full'); sfx('click'); refreshBest(); });

// volume sliders on the pause screen
for (const [id, kind] of [['volSfx', 'sfx'], ['volMus', 'music']]){
  const el = $(id); el.value = Math.round(Music.vol[kind]*100);
  el.addEventListener('input', () => { audio(); Music.set(kind, el.value/100); });
  el.addEventListener('change', () => { if (kind === 'sfx') sfx('click'); el.blur(); });          // (a focused slider must not eat the game keys)
}
$('menu').addEventListener('click', startRun);                    // tap anywhere on the title screen (a real click: iOS unlocks audio on it)
$('againBtn').addEventListener('click', startRun);
$('restartBtn').addEventListener('click', startRun);
$('skipTut').addEventListener('click', () => { sfx('click'); Tut.skip(); resumeGame(); });
$('resumeBtn').addEventListener('click', () => { sfx('click'); resumeGame(); });
$('pauseBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); setPause(true); });
$('throwBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); audio(); throwItem(); });
$('jumpBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); audio(); jumpCat(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });   // keep keyboard focus off buttons: Space / Enter belong to the game
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play') setPause(true); });
refreshBest();

// menu cat: the loaf does its OIIA hop
const mcv = $('menuCat'), mctx = mcv.getContext('2d'); mctx.imageSmoothingEnabled = false;
function drawMenuCat(t){
  mctx.clearRect(0, 0, mcv.width, mcv.height);
  const ph = t*0.011, rot = Math.sin(ph)*0.3, hop = Math.abs(Math.sin(ph))*4;
  const s = catSpr('cat_' + (Math.sin(ph) >= 0 ? 'oiia' : 'oiia2') + '_t' + (Math.floor(t/250)%2));
  mctx.save(); mctx.translate(mcv.width/2, mcv.height - 3 - hop); mctx.rotate(rot); mctx.drawImage(s.n, -11, -15); mctx.restore();
}
