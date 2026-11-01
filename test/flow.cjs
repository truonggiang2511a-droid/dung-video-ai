// Kiểm thử luồng chính: tạo dự án → thêm A-roll + B-roll → AI dựng → duyệt → xuất 720p
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844);
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 2, hasTouch: w < 900, isMobile: w < 900});
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  if (process.env.NO_AD) await p.addInitScript(() => { delete window.AudioDecoder; window.AudioDecoder = undefined; });
  await p.goto('http://localhost:8790/');
  await p.waitForTimeout(800);
  await p.screenshot({path: 'test/s0-home.png'});
  await p.click('#btnNew');
  await p.waitForTimeout(500);
  await p.screenshot({path: 'test/s1-empty.png'});
  let fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + 'aroll.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 30000});
  await p.waitForTimeout(800);
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'Phong khach.mp4', M + 'Bep.mp4', M + 'Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  await p.waitForTimeout(800);
  await p.screenshot({path: 'test/s2-ready.png'});
  await p.click('[data-act="ai"]');
  await p.waitForTimeout(2500);
  await p.screenshot({path: 'test/s3-ai-cut.png'});
  // chờ tới lúc ghép cảnh để chụp con trỏ đang kéo
  await p.waitForFunction(() => document.querySelector('[data-step="dung"]')?.className === 'run', null, {timeout: 60000});
  await p.waitForTimeout(700);
  await p.screenshot({path: 'test/s4-ai-broll.png'});
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 90000});
  await p.waitForTimeout(2200);
  await p.screenshot({path: 'test/s5-review.png'});
  const st = await p.evaluate(() => {
    const q = window.__dv.p;
    return {segs: q.main.segs.length, broll: q.broll.map((x) => [x.src.slice(0, 4), +x.start.toFixed(2), +x.dur.toFixed(2), x.trans]), texts: q.texts.length, zooms: q.zooms.length, D: q.main.segs.reduce((a, s) => a + s.out - s.in, 0).toFixed(2)};
  });
  console.log('STATE', JSON.stringify(st));
  // chọn một cảnh phụ → mở sửa tay
  const clip = p.locator('.clip[data-type="broll"]').first();
  await clip.click();
  await p.waitForTimeout(400);
  await p.screenshot({path: 'test/s6-select.png'});
  // chat lệnh cơ bản
  await p.fill('#chatIn', 'cảnh này dài thêm 1 giây');
  await p.press('#chatIn', 'Enter');
  await p.waitForFunction(() => !window.__dv.busy, null, {timeout: 20000});
  await p.waitForTimeout(500);
  // thêm chữ
  await p.evaluate(() => document.querySelector('.clip.sel')?.click());
  await p.click('[data-act="approve"]').catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({path: 'test/s7-approve.png'});
  await p.click('#dlg [data-v="1"]');
  await p.waitForSelector('#xres');
  await p.click('#xres [data-r="720"]');
  await p.click('#exp [data-x="go"]');
  const t0 = Date.now();
  await p.waitForSelector('.xvid, .err', {timeout: 240000});
  console.log('EXPORT_SEC', (Date.now() - t0) / 1000);
  await p.screenshot({path: 'test/s8-done.png'});
  const err = await p.locator('.err').count();
  if (!err) {
    const b64 = await p.evaluate(async () => {
      const u = document.querySelector('.xvid').src;
      const a = new Uint8Array(await (await fetch(u)).arrayBuffer());
      let s = '';
      for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
      return btoa(s);
    });
    fs.writeFileSync('test/out.mp4', Buffer.from(b64, 'base64'));
  } else console.log('ERR', await p.locator('.err').innerText());
  console.log(logs.slice(0, 20).join('\n'));
  await b.close();
})();
