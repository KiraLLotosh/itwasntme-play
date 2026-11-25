'use strict';
/* Playtest statistics + onboarding tips.
   STATS: everything stays in THIS browser (localStorage 'iwm_stats', last 60 runs); nothing is ever sent anywhere.
   It exists to see, in a playtest, where people get lost: how long runs last, what ends them, whether the first skill check is passed,
   how often abilities / pauses / push-lock bumps happen. The viewer (menu button STATS) is dev / playtest only (stripped from release builds).
   TIPS: short on-screen messages shown once (or a few times) per player, remembered in localStorage 'iwm_tips'. */
const Stats = (() => {
  const KEY = 'iwm_stats', MAX = 60;
  let log = []; try { log = JSON.parse(LS.get(KEY) || '[]'); if (!Array.isArray(log)) log = []; } catch (e) { log = []; }
  let cur = null, errors = 0;
  const save = () => LS.set(KEY, JSON.stringify(log.slice(-MAX)));
  function finish(why){ if (!cur) return; cur.why = why; cur.err = errors; log.push(cur); cur = null; if (log.length > MAX) log = log.slice(-MAX); save(); }
  function begin(){
    if (cur) finish('restart');                                   // a run that was abandoned by restarting
    cur = {at: Date.now(), ch: G.charId, dev: inputMode, win: innerWidth + 'x' + innerHeight, sk: [], jumps: 0, throws: 0, pauses: 0, locks: 0, tips: [], dur: 0, money: 0, items: 0, rises: 0};
  }
  function sync(){ if (cur && G){ cur.dur = Math.round(G.time); cur.money = G.damage; cur.items = G.itemsBroken; cur.rises = G.rises; } }
  function end(why){ sync(); finish(why); }
  function count(k){ if (cur) cur[k] = (cur[k] || 0) + 1; }
  function skill(ok){ if (cur) cur.sk.push(ok ? 1 : 0); }
  function tip(k){ if (cur) cur.tips.push(k); }
  function error(e){ errors++; }
  const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p*a.length))] : 0;
  function summary(){
    const done = log.filter(r => r.dur !== undefined);
    const n = done.length, times = done.map(r => r.dur).sort((a, b) => a - b);
    const why = {}; done.forEach(r => why[r.why] = (why[r.why] || 0) + 1);
    const firsts = done.map(r => r.sk[0]).filter(v => v !== undefined), allsk = done.flatMap(r => r.sk);
    const diedFirst = done.filter(r => r.sk.length === 1 && r.sk[0] === 0 && r.why === 'seen').length;
    const per = k => n ? (done.reduce((s, r) => s + (r[k] || 0), 0) / n).toFixed(1) : '0';
    return {n, touch: done.filter(r => r.dev === 'touch').length,
      times: n ? {p25: pct(times, .25), median: pct(times, .5), p75: pct(times, .75), max: times[times.length - 1]} : null,
      why, firstCheckPass: firsts.length ? Math.round(100*firsts.filter(v => v).length/firsts.length) : null, firstCheckN: firsts.length,
      checkPass: allsk.length ? Math.round(100*allsk.filter(v => v).length/allsk.length) : null, checkN: allsk.length,
      diedAtFirstCheck: diedFirst, jumps: per('jumps'), throws: per('throws'), pauses: per('pauses'), locks: per('locks'), errors: done.reduce((s, r) => s + (r.err || 0), 0) + (cur ? 0 : 0),
      last: done.slice(-8).reverse()};
  }
  return {begin, end, sync, count, skill, tip, error, summary, all: () => log.slice(), clear(){ log = []; save(); }};
})();

const Tips = (() => {
  let seen = {}; try { seen = JSON.parse(LS.get('iwm_tips') || '{}') || {}; } catch (e) { seen = {}; }
  let timer = null;
  const remember = () => LS.set('iwm_tips', JSON.stringify(seen));
  function hide(){ const e = $('tip'); if (e) e.classList.add('hidden'); }
  function show(text, ms){
    const e = $('tip'); if (!e) return;
    e.innerHTML = String(text).split('\n').join('<br>'); e.classList.remove('hidden');
    if (timer) clearTimeout(timer); timer = setTimeout(hide, ms || 2500);
  }
  const busy = () => typeof G !== 'undefined' && G && G.tut;                 // the tutorial has its own panel: no tips meanwhile
  function mark(keys){ for (const k of keys) seen[k] = 1; remember(); }
  function once(key, text, ms){ if (seen[key] || busy()) return false; seen[key] = 1; remember(); show(text, ms); Stats.tip(key); return true; }
  function times(key, n, text, ms){ const c = seen[key] || 0; if (c >= n || busy()) return false; seen[key] = c + 1; remember(); show(text, ms); Stats.tip(key); return true; }
  return {show, hide, once, times, mark};
})();
