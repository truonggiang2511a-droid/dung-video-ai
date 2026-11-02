import {numberLockups} from '../../js/ai.js';
import {industryPlan, recipesFor} from '../../js/recipes.js';
window.runRecipe = (genre, sentences, recKey) => {
  const words = [];
  let t = 0.3;
  for (const s of sentences) {
    for (const w of s.split(' ')) {
      words.push({w, s: t, e: t + 0.28});
      t += 0.32;
    }
    t += 0.5;
  }
  const D = t + 5;
  const p = {genre, main: {src: 'm', segs: [{in: 0, out: D}]}, sources: {m: {id: 'm', kind: 'main', duration: D}}, transcript: {words}, cta: {len: 4}, broll: [], texts: [], stickers: []};
  const rec = recipesFor(genre).find((r) => r.key === recKey) || recipesFor(genre)[0];
  const nums = numberLockups(p, true);
  const r = industryPlan(p, rec, {nums, D, ctaLen: 4});
  return {D, ws: (window.__ws = 0), nums: nums.map((n) => `${n.start.toFixed(1)} ${n.kind || ''} ${n.lead || ''}·${n.main}`), gfx: r.gfx.map((g) => `${g.start.toFixed(1)}–${(g.start + g.dur).toFixed(1)} ${g.key} ${g.label || ''} ${g.old || ''} ${g.sub || ''} ${g.badge || ''} ${(g.items || []).map((i) => i.text).join(' | ')}`), drop: r.drop.size, buy: r.buy};
};
