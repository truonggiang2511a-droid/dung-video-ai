// Kho Pixabay với máy chủ GIẢ (test/mock-server.cjs): AI tự trám cảnh khi thiếu cảnh phụ (BĐS chặn “house interior”),
// con trỏ vào Kho › Pixabay, chèn ẢNH tay từ tab Pixabay, xem khung cảnh ngang “vừa khung + nền mờ”, xuất thật có ảnh.
// node test/stock.cjs 390 844
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  // URL=… → chạy web thật (Pixabay + Claude thật), GENRE=chung để thử video người nói
  const LIVE = process.env.URL;
  const srv = LIVE ? {kill() {}} : spawn('node', [__dirname + '/mock-server.cjs', '8791'], {stdio: 'ignore'});
  await new Promise((r) => setTimeout(r, 700));
  const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844);
  const mob = w < 900;
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto(LIVE || 'http://localhost:8791/');
    await p.waitForTimeout(800);
    const fc = p.waitForEvent('filechooser');
    if (await p.locator('#home').isVisible()) {
      await p.click(`[data-hgenre="${process.env.GENRE || 'bds'}"]`);
      await p.click('#btnNew');
    } else await p.click('.drop.main');
    await (await fc).setFiles(M + 'speech_mid_g30.mp4');
    await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
    const truth = JSON.parse(fs.readFileSync(M + 'gen/speech_mid.json'));
    const texts = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố', 'ngay trung tâm thành phố', 'Diện tích đất 52m2,', 'một trệt hai lầu.', 'Giá bán 3.800 triệu,', 'có thương lượng.', 'Nhà có 3 phòng ngủ, 2 phòng tắm.', 'Pháp lý sổ hồng riêng,', 'công chứng ngay trong ngày.', 'Ai quan tâm thì nhắn tin cho mình nhé.'];
    const words = [];
    truth.speech.forEach(([a, bb], i) => {
      const ts = (texts[i] || '').split(' ');
      ts.forEach((t, j) => words.push({w: t, s: +(a + ((bb - a) * j) / ts.length).toFixed(2), e: +(a + ((bb - a) * (j + 0.85)) / ts.length).toFixed(2)}));
    });
    await p.evaluate(([ws, g]) => Object.assign(window.__dv.p, {transcript: {words: ws}, genre: g}), [words, process.env.GENRE || 'bds']);
    await p.click('#btnAi');
    let shot = false;
    const tips = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      const s = await p.evaluate(() => ({tip: document.querySelector('.ai-tip.on')?.textContent || '', done: window.__dv.p.aiDone && !window.__dv.busy}));
      if (s.tip && tips.at(-1) !== s.tip) tips.push(s.tip);
      if (!shot && /Câu nói này không có cảnh quay/.test(s.tip)) {
        shot = true;
        await p.waitForTimeout(200);
        await p.screenshot({path: `test/stock-${w}-tour.png`});
      }
      if (s.done) break;
      await p.waitForTimeout(150);
    }
    const r1 = await p.evaluate(() => {
      const pj = window.__dv.p;
      const st = Object.values(pj.sources).filter((s) => s.stock);
      return {stockSources: st.map((s) => `${s.image ? 'ảnh' : 'video'} ${s.tag} ${s.author} ${s.w}x${s.h} at ${s.stockAt}`), brolls: pj.broll.map((x) => `${pj.sources[x.src]?.stock ? 'PIXABAY ' : ''}${pj.sources[x.src]?.name} ${x.start}-${(x.start + x.dur).toFixed(2)}`)};
    });
    // khung có cảnh Pixabay ngang trong khổ dọc → vừa khung + nền mờ
    const bAt = await p.evaluate(() => {
      const pj = window.__dv.p;
      const x = pj.broll.find((y) => pj.sources[y.src]?.stock);
      return x ? x.start + Math.min(1, x.dur / 2) : null;
    });
    if (bAt !== null) {
      await p.evaluate((t) => window.__dv.seek(t), bAt);
      await p.waitForTimeout(900);
      await p.locator('#cv').screenshot({path: `test/stock-${w}-khung.png`});
    }
    // chèn ẢNH tay từ tab Pixabay
    await p.evaluate(() => window.__dv.seek(15));
    await p.evaluate(() => window.__dv.ui.openLib('stock', {q: 'tiền', type: 'image'}));
    await p.waitForTimeout(600);
    await p.screenshot({path: `test/stock-${w}-tab.png`});
    await p.click('#stockGrid [data-stock="0"]');
    await p.waitForFunction(() => Object.values(window.__dv.p.sources).some((s) => s.image), null, {timeout: 20000});
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__dv.seek(16.2));
    await p.waitForTimeout(700);
    await p.locator('#cv').screenshot({path: `test/stock-${w}-anh.png`});
    const r2 = await p.evaluate(() => {
      const pj = window.__dv.p;
      const im = Object.values(pj.sources).find((s) => s.image);
      return {image: `${im.name} ${im.w}x${im.h}`, used: pj.broll.filter((x) => x.src === im.id).map((x) => `${x.start.toFixed(2)}+${x.dur}`)};
    });
    // xuất thật (có cảnh video Pixabay + ảnh Pixabay)
    let exp = null;
    if (process.env.EXPORT) {
      await p.evaluate(() => window.__dv.ui.done());
      await p.click('#btnExport').catch(() => {});
      await p.waitForTimeout(300);
      await p.click('#dlg [data-v="1"]').catch(() => {});
      await p.waitForSelector('#xres');
      await p.click('#xres [data-r="720"]');
      await p.click('#exp [data-x="go"]');
      await p.waitForSelector('.xvid, .err', {timeout: 240000});
      if (await p.locator('.err').count()) exp = 'ERR ' + (await p.locator('.err').innerText());
      else {
        const b64 = await p.evaluate(async () => {
          const a = new Uint8Array(await (await fetch(document.querySelector('.xvid').src)).arrayBuffer());
          let s = '';
          for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
          return btoa(s);
        });
        fs.writeFileSync('test/stock-out.mp4', Buffer.from(b64, 'base64'));
        exp = 'test/stock-out.mp4';
      }
    }
    const log = LIVE ? [] : await (await fetch('http://localhost:8791/api/_log')).json();
    console.log(JSON.stringify({w, ...r1, ...r2, apiLog: log, tips: tips.filter((x) => /Pixabay|cảnh trám|cảnh quay/.test(x)), errs, exp}, null, 1));
  } finally {
    await b.close();
    srv.kill();
  }
})();
