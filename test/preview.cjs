// Đo độ mượt bản xem nhanh: nạp A-roll nặng (GOP 10 s) → AI cắt khoảng lặng → phát từ đầu → đo khung bị đứng/xám, đồng hồ nhảy cóc
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const file = process.env.FILE || 'speech_mid.mp4';
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const ctx = await b.newContext({viewport: {width: 1440, height: 900}});
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  if (process.env.NO_AD) await p.addInitScript(() => { delete window.AudioDecoder; window.AudioDecoder = undefined; });
  if (process.env.NO_WA) await p.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + file);
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({segsL: window.__dv.p.main.segs.map((x) => x.in.toFixed(2) + '-' + x.out.toFixed(2)).join(' '), segs: window.__dv.p.main.segs.length, D: +window.__dv.player.D.toFixed(2)}));
  // phát từ đầu
  await p.evaluate(() => window.__dv.player.seek(0));
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const pl = window.__dv.player;
    window.__cues = [];
    if (pl._cue) { const oc = pl._cue.bind(pl);
    pl._cue = (el, i, t) => { window.__cues.push([+pl.T.toFixed(2), pl.mains.indexOf(el), i, +t.toFixed(2), +el.currentTime.toFixed(2)]); return oc(el, i, t); }; }
    if (pl._drive) { const od = pl._drive.bind(pl);
    pl._drive = (el, t, play) => { const d = el ? el.currentTime - t : 0; if (play && el && !el.seeking && (d > 0.06 || d < -0.45)) window.__cues.push(['drive', +pl.T.toFixed(2), pl.mains.indexOf(el), +t.toFixed(2), +el.currentTime.toFixed(2)]); return od(el, t, play); }; }
    window.__m = {samples: []};
    let last = performance.now();
    const f = (now) => {
      if (!pl.playing && window.__m.started) return;
      const el = pl.active || pl.els[pl.p.main.src];
      const segs = pl.p.main.segs;
      // nguồn đúng phải đang hiện
      let acc = 0, want = null, wi = -1;
      for (let i = 0; i < segs.length; i++) { const L = segs[i].out - segs[i].in; if (pl.T < acc + L || i === segs.length - 1) { want = segs[i].in + Math.max(0, pl.T - acc); wi = i; break; } acc += L; }
      const fresh = el && el.readyState >= 2 && !el.seeking && (el.seg === undefined || el.seg === wi);
      window.__m.samples.push({now, dt: now - last, T: pl.T, fresh, err: el ? el.currentTime - want : 9, mode: pl.mode, sk: el?.seeking, rs: el?.readyState, seg: el?.seg, wi, pz: el?.paused});
      last = now;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await p.click('#btnPlay');
  await p.evaluate(() => (window.__m.started = true));
  await p.waitForFunction(() => !window.__dv.player.playing, null, {timeout: 120000});
  const r = await p.evaluate(() => {
    const s = window.__m.samples.filter((x) => x.T > 0.05);
    let stale = 0, run = 0, maxRun = 0, big = 0, wallStall = 0;
    for (let i = 1; i < s.length; i++) {
      const dt = s[i].dt / 1000;
      if (!s[i].fresh || Math.abs(s[i].err) > 0.25) { stale += dt; run += dt; maxRun = Math.max(maxRun, run); } else run = 0;
      const dT = s[i].T - s[i - 1].T;
      if (dT > dt + 0.15) big += dT - dt;       // đồng hồ nhảy cóc (mất lời)
      if (dT < dt * 0.2 && dt > 0) wallStall += dt; // đồng hồ đứng (khựng)
    }
    const errs = s.filter((x) => x.fresh).map((x) => Math.abs(x.err)).sort((a, b) => a - b);
    const runs = []; let cur = null;
    for (const x of s) { const bad = !x.fresh || Math.abs(x.err) > 0.25; if (bad) { if (!cur) { cur = {T0: x.T.toFixed(2), n: 0, ct: (x.err).toFixed(2), seg: x.seg, wi: x.wi, why: (x.sk ? 'seek ' : '') + (x.rs < 2 ? 'rs' + x.rs + ' ' : '') + (x.seg !== x.wi ? 'seg' + x.seg + '/' + x.wi + ' ' : '') + 'err' + x.err.toFixed(2) + (x.pz ? ' paused' : '')}; runs.push(cur); } cur.n++; cur.T1 = x.T.toFixed(2); } else cur = null; }
    window.__runs = runs.filter((r) => r.n > 3);
    return {runs: window.__runs.slice(0, 12), wall: ((s[s.length - 1].now - s[0].now) / 1000).toFixed(2), stale: stale.toFixed(2), maxStale: maxRun.toFixed(2), skipped: big.toFixed(2), clockStall: wallStall.toFixed(2), errP50: (errs[Math.floor(errs.length / 2)] || 0).toFixed(3), errP95: (errs[Math.floor(errs.length * 0.95)] || 0).toFixed(3), mode: s[s.length - 1]?.mode};
  });
  console.log(file, JSON.stringify(info), JSON.stringify(r));
  console.log('CUES', JSON.stringify(await p.evaluate(() => window.__cues.slice(0, 40))));
  if (logs.length) console.log('LOGS', logs.slice(0, 5).join(' | '));
  await b.close();
})();
