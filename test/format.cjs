// Kiểm: chọn thể loại + khổ hình → khung xem đổi, câu kết đổi, AI dựng, xuất đúng kích thước
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const fmt = process.env.FMT || '16:9', genre = process.env.GENRE || 'banhang';
  const w = +(process.argv[2] || 1440), h = +(process.argv[3] || 900);
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: w < 900 ? 2 : 1, hasTouch: w < 900, isMobile: w < 900, acceptDownloads: true});
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.waitForTimeout(600);
  if (w < 900) { await p.click('[data-act="project"]'); await p.waitForTimeout(400); }
  await p.click(`[data-genre="${genre}"]`);
  await p.click(`[data-format="${fmt}"]`);
  await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({genre: window.__dv.p.genre, format: window.__dv.p.format, cta: window.__dv.p.cta.text, cv: [document.querySelector('#cv').width, document.querySelector('#cv').height]}));
  await p.screenshot({path: `test/fmt-${fmt.replace(':', 'x')}-1.png`});
  await p.evaluate(() => document.querySelector('[data-act="closeSheet"]')?.click());
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__dv.seek(2.5));
  await p.waitForTimeout(800);
  await p.screenshot({path: `test/fmt-${fmt.replace(':', 'x')}-2.png`});
  // xuất 720p
  await p.click('#btnExport');
  await p.waitForTimeout(300);
  if (await p.locator('#dlg [data-v="1"]').count()) await p.click('#dlg [data-v="1"]');
  await p.waitForSelector('#xres');
  await p.click('#xres [data-r="720"]');
  await p.click('#exp [data-x="go"]');
  await p.waitForSelector('.xvid, .err', {timeout: 240000});
  const b64 = await p.evaluate(async () => {
    const u = document.querySelector('.xvid')?.src;
    if (!u) return '';
    const a = new Uint8Array(await (await fetch(u)).arrayBuffer());
    let s = '';
    for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
    return btoa(s);
  });
  fs.writeFileSync('/tmp/fmt-out.mp4', Buffer.from(b64, 'base64'));
  console.log('FORMAT', JSON.stringify(st), 'texts', await p.evaluate(() => window.__dv.p.texts.map((t) => t.main).join(' | ')), logs.join(' | '));
  await b.close();
})();
