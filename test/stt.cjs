// Kiểm chép lời thật trên web: AI dựng có Whisper → lời chép, phụ đề, chữ số liệu → chụp → xuất 720p
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true})).newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && logs.push(m.text().slice(0, 160)));
  await p.goto(process.env.URL || 'https://dung-video-ai.truonggiang2511a.workers.dev/');
  await p.waitForTimeout(1000);
  const fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + (process.env.FILE || 'speech_mid_g30.mp4'));
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.click('[data-act="project"]');
  await p.click('[data-genre="bds"]');
  await p.evaluate(() => document.querySelector('[data-act="closeSheet"]')?.click());
  const t0 = Date.now();
  // mốc thời gian từng bước (đổi chữ ở thanh trạng thái) + thời gian từng lần gửi chép lời
  const net = [];
  p.on('request', (r) => r.url().includes('/api/transcribe') && net.push({u: r, t: Date.now() - t0}));
  p.on('requestfinished', (r) => { const x = net.find((n) => n.u === r); if (x) x.d = Date.now() - t0 - x.t; });
  await p.evaluate(() => {
    window.__steps = [];
    let last = '';
    const t = performance.now();
    setInterval(() => {
      const s = (document.querySelector('#status')?.textContent || '').replace(/\d+%/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (s !== last) window.__steps.push([((performance.now() - t) / 1000).toFixed(1), (last = s)]);
    }, 200);
  });
  await p.click('#btnAi');
  await p.waitForFunction(() => /Chép lời/.test(document.querySelector('#status')?.textContent || ''), null, {timeout: 60000}).catch(() => {});
  await p.screenshot({path: 'test/stt-1-chep.png'});
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 240000});
  const st = await p.evaluate(() => {
    const q = window.__dv.p;
    return {words: q.transcript?.words?.length || 0, segs: q.main.segs.length, texts: q.texts.map((t) => (t.lead ? t.lead + ': ' : '') + t.main), subsOn: q.subs.on, style: q.subs.style, sample: (q.transcript?.words || []).slice(0, 12).map((w) => w.w).join(' ')};
  });
  fs.writeFileSync('/tmp/stt-proj.json', JSON.stringify(await p.evaluate(() => ({genre: window.__dv.p.genre, main: window.__dv.p.main, transcript: window.__dv.p.transcript, sources: {[window.__dv.p.main.src]: {duration: window.__dv.p.sources[window.__dv.p.main.src].duration}}}))));
  console.log('STEPS', JSON.stringify(await p.evaluate(() => window.__steps)));
  console.log('TRANSCRIBE', JSON.stringify(net.map((n) => [(n.t / 1000).toFixed(1), ((n.d || 0) / 1000).toFixed(1)])));
  console.log('AI_SEC', ((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(st));
  // chụp lúc có phụ đề
  for (const [i, T] of [[2, 1.6], [3, 8.2]]) {
    await p.evaluate((T) => window.__dv.seek(T), T);
    await p.waitForTimeout(900);
    await p.screenshot({path: `test/stt-${i}.png`});
  }
  console.log('LOGS', logs.slice(0, 5).join(' | '));
  await b.close();
})();
