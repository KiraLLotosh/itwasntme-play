'use strict';
/* Turns the ART strings into canvases (SPR), dim / tinted copies, spr() helper */

// Sprites are arrays of strings (rows joined by |), one palette char per pixel.
const SPR = {};
(function buildSprites(){
  const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const dimCol = h => { const [r,g,b] = hex(h); return 'rgb(' + Math.round(r*0.6+12) + ',' + Math.round(g*0.58+8) + ',' + Math.round(b*0.7+30) + ')'; };
  for (const [name, packed] of Object.entries(ART.sprites)){
    const rows = packed.split('|'), w = rows[0].length, h = rows.length;
    const mk = (flip, dim) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      for (let y=0;y<h;y++) for (let i=0;i<w;i++){
        const col = ART.pal[rows[y][flip ? w-1-i : i]];
        if (col){ x.fillStyle = dim ? dimCol(col) : col; x.fillRect(i, y, 1, 1); }
      }
      return c;
    };
    SPR[name] = {w, h, n:mk(false), f:mk(true)};
    if (name.startsWith('item_')){
      SPR[name].d = mk(false, true);                                      // darkened copy for the background layer
      const t = document.createElement('canvas'); t.width = w; t.height = h;
      const tx = t.getContext('2d'); tx.drawImage(SPR[name].n, 0, 0);
      tx.globalCompositeOperation = 'source-atop'; tx.globalAlpha = 0.78; tx.fillStyle = '#7f67b8'; tx.fillRect(0, 0, w, h);
      SPR[name].t = t;                                                    // lilac-washed copy for the menu wallpaper (details stay faintly visible)
    }
  }
})();
function spr(name, x, y, flip){ const s = SPR[name]; if (s) ctx.drawImage(flip ? s.f : s.n, Math.round(x), Math.round(y)); }
