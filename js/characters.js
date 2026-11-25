'use strict';
/* Characters: roster, unlock rules, wallet (saved money) and skins.
   Two groups: SHOP (bought with saved money) and ACHIEVEMENT (unlocked by doing something).
   Each character has an optional `ability` (data-driven, see hasAbility()) and an optional `skin` (palette overrides for the cat sprites).
   Save data lives in localStorage ('iwm_save'): wallet (spendable), peak (highest balance ever, for achievements), owned ids, selected id. */
const CHARACTERS = [
  {id:'fika', name:'Fika', group:'shop', price:0, ability:'jump', info:'JUMP: SOMERSAULT OVER ITEMS (ARROW UP)'},
  {id:'mochi', name:'Mochi', group:'shop', price:5000, ability:'throw', info:'VASE DROP: DROPS AN ITEM ON HIS HEAD',
   skin:{a:'#f6f1fb', b:'#ffffff', c:'#d9d0e6', O:'#7a6a8c', Y:'#7ec8ff'}},                 // white cat, blue eyes
  {id:'lucky', name:'Lucky', group:'achievement', ability:null, info:'NO ABILITY YET', need:'HAVE MORE THAN $7,777 AT ONCE', unlock:{peak:7777},
   skin:{a:'#ffa24f', b:'#ffcd94', c:'#e8772d', O:'#8c4a1f', Y:'#7ddba0'}},                 // ginger cat, green eyes
];
const CHAR_BY_ID = {}; for (const c of CHARACTERS) CHAR_BY_ID[c.id] = c;

const SAVE = {wallet:0, peak:0, owned:['fika'], sel:'fika'};
function loadSave(){
  try {
    const j = JSON.parse(LS.get('iwm_save') || 'null');
    if (j){
      SAVE.wallet = Math.max(0, +j.wallet || 0); SAVE.peak = Math.max(+j.peak || 0, SAVE.wallet);
      if (Array.isArray(j.owned)) SAVE.owned = j.owned.filter(id => CHAR_BY_ID[id]);
      if (!SAVE.owned.includes('fika')) SAVE.owned.unshift('fika');
      SAVE.sel = (CHAR_BY_ID[j.sel] && SAVE.owned.includes(j.sel)) ? j.sel : 'fika';
    }
  } catch (e) {}
}
function saveNow(){ LS.set('iwm_save', JSON.stringify(SAVE)); }
loadSave();
{ const fresh = checkUnlocks(); if (fresh.length) saveNow(); }                      // e.g. a balance that is already above the limit when the game loads

// achievements: returns the characters unlocked right now
function checkUnlocks(){
  const fresh = [];
  for (const c of CHARACTERS){
    if (c.group !== 'achievement' || SAVE.owned.includes(c.id)) continue;
    if (c.unlock.peak !== undefined && SAVE.peak > c.unlock.peak){ SAVE.owned.push(c.id); fresh.push(c); }
  }
  return fresh;
}
// money earned in a run goes straight into the wallet (saved every time, so quitting a run never loses it)
function addMoney(n){
  SAVE.wallet += n; SAVE.peak = Math.max(SAVE.peak, SAVE.wallet);
  const fresh = checkUnlocks(); saveNow();
  if (fresh.length && typeof G !== 'undefined' && G){
    for (const c of fresh){ G.newCats.push(c.name); popup(90, 98, c.name.toUpperCase() + ' UNLOCKED!'); sfx('promote'); }
  }
}
function buyChar(id){
  const c = CHAR_BY_ID[id];
  if (!c || c.group !== 'shop' || SAVE.owned.includes(id) || SAVE.wallet < c.price) return false;
  SAVE.wallet -= c.price; SAVE.owned.push(id); SAVE.sel = id; saveNow(); return true;
}
function selectChar(id){ if (SAVE.owned.includes(id)){ SAVE.sel = id; saveNow(); } }
const curChar = () => CHAR_BY_ID[(typeof G !== 'undefined' && G) ? G.charId : SAVE.sel];
const hasAbility = a => curChar().ability === a;

// skins: re-colour the cat sprites by overriding palette characters
function buildSkins(){
  for (const c of CHARACTERS){
    if (!c.skin) continue;
    for (const [name, packed] of Object.entries(ART.sprites)){
      if (!name.startsWith('cat_')) continue;
      const rows = packed.split('|'), w = rows[0].length, h = rows.length;
      const mk = flip => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        for (let y=0;y<h;y++) for (let i=0;i<w;i++){
          const ch = rows[y][flip ? w-1-i : i], col = c.skin[ch] || ART.pal[ch];
          if (col){ x.fillStyle = col; x.fillRect(i, y, 1, 1); }
        }
        return cv;
      };
      SPR[c.id + ':' + name] = {w, h, n:mk(false), f:mk(true)};
    }
  }
}
buildSkins();
function catSpr(name, id){
  id = id || (typeof G !== 'undefined' && G ? G.charId : SAVE.sel);
  return SPR[(id === 'fika' ? '' : id + ':') + name] || SPR[name];
}
