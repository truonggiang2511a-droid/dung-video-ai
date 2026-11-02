// Chạy AI dựng thật (web thật, có Whisper + Claude) trên 1 video thật của Giang, in lời chép + các đoạn giữ lại
//   URL=https://dung-video-ai.truonggiang2511a.workers.dev/ FILE=/home/claude/nhaxinh/proxy.mp4 GENRE=bds OUT=/home/claude/nhaxinh/run.json node test/real.cjs
const {chromium} = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  p.on('console', (m) => /error|warn/i.test(m.type()) && logs.push(m.text().slice(0, 200)));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(1000);
  const fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(process.env.FILE);
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 120000});
  await p.evaluate((g) => (window.__dv.p.genre = g), process.env.GENRE || 'bds');
  const t0 = Date.now();
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 600000});
  const r = await p.evaluate(() => {
    const pp = window.__dv.p;
    return {segs: pp.main.segs.map((s) => [+s.in.toFixed(2), +s.out.toFixed(2)]), words: (pp.transcript?.words || []).map((w) => [w.w, +w.s.toFixed(2), +w.e.toFixed(2)]), status: document.querySelector('#status')?.innerText, chat: [...document.querySelectorAll('.chatlog .msg, .chatlog p')].map((x) => x.innerText).slice(-20)};
  });
  r.secs = (Date.now() - t0) / 1000;
  r.logs = logs;
  fs.writeFileSync(process.env.OUT || '/tmp/real.json', JSON.stringify(r));
  console.log('xong', r.secs, 's · chữ', r.words.length, '· đoạn giữ', r.segs.length);
  await b.close();
})();
