// Kiểm BỘ DỰNG CHUYÊN NGHIỆP (localPlan): nhịp đổi hình, dùng hết cảnh phụ, cảnh khớp lời, che chỗ cắt, zoom giật
// node test/plan.cjs [thể loại]   — chạy bản cục bộ, lời giả lập theo đáp án giọng đọc (có nhắc "phòng khách", "bếp", "mặt tiền")
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const genre = process.argv[2] || 'bds';
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  let fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'Phong khach.mp4', M + 'Bep.mp4', M + 'Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  const truth = JSON.parse(fs.readFileSync(M + 'gen/speech_mid.json'));
  const texts = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố', 'ngay trung tâm thành phố', 'Mặt tiền rộng 5 mét,', 'một trệt hai lầu.', 'Giá bán 3.800 triệu,', 'có thương lượng.', 'Phòng khách rộng, bếp thoáng.', 'Pháp lý sổ hồng riêng,', 'công chứng ngay trong ngày.', 'Ai quan tâm thì nhắn tin cho mình nhé.'];
  const words = [];
  truth.speech.forEach(([a, bb], i) => {
    const ts = (texts[i] || '').split(' ');
    ts.forEach((t, j) => words.push({w: t, s: +(a + ((bb - a) * j) / ts.length).toFixed(2), e: +(a + ((bb - a) * (j + 0.85)) / ts.length).toFixed(2)}));
  });
  await p.evaluate(([ws, g]) => {
    if (ws.length) window.__dv.p.transcript = {words: ws};
    window.__dv.p.genre = g;
  }, [process.env.NOWORDS ? [] : words, genre]);
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  const r = await p.evaluate(() => {
    const pp = window.__dv.p;
    const D = pp.main.segs.reduce((a, s) => a + s.out - s.in, 0);
    let acc = 0;
    const cuts = pp.main.segs.slice(0, -1).map((s) => +(acc += s.out - s.in).toFixed(2));
    return {
      D: +D.toFixed(2),
      cuts,
      broll: pp.broll.map((x) => ({name: pp.sources[x.src].name, s: x.start, e: +(x.start + x.dur).toFixed(2), in: x.in, trans: x.trans})),
      zooms: pp.zooms.map((z) => `${z.kind || 'ramp'} ${z.start}–${+(z.start + z.dur).toFixed(2)} ×${z.scale}`),
      texts: pp.texts.map((t) => `${t.start} ${t.main}`),
      stickers: (pp.stickers || []).map((t) => `${t.start} ${t.key} (${t.label}) ${t.motion}`),
      sfx: (pp.sfx || []).map((t) => `${t.start} ${t.sfx}`),
    };
  });
  // phân tích: khoảng không đổi hình dài nhất (người nói không zoom, không cảnh phụ)
  const ev = [0, r.D, ...r.cuts, ...r.broll.flatMap((x) => [x.s, x.e]), ...r.zooms.flatMap((z) => z.split(' ')[1].split('–').map(Number))].sort((a, b) => a - b);
  let still = 0;
  for (let i = 1; i < ev.length; i++) still = Math.max(still, ev[i] - ev[i - 1]);
  const usedClips = new Set(r.broll.map((x) => x.name)).size;
  const hidden = r.cuts.filter((c) => r.broll.some((x) => c > x.s - 0.15 && c < x.e + 0.15)).length;
  const zs = r.zooms.map((z) => z.split(' ')[1].split('–').map(Number));
  const shown = r.cuts.filter((c) => !r.broll.some((x) => c > x.s - 0.15 && c < x.e + 0.15)).filter((c) => !zs.some(([a, b]) => Math.abs(a - c) < 0.06 || Math.abs(b - c) < 0.06)).length;
  console.log(JSON.stringify(r, null, 1));
  console.log(`THỂ LOẠI ${genre} · D ${r.D}s · cảnh phụ ${r.broll.length} cú / ${usedClips} cảnh · chỗ cắt ${r.cuts.length} (che bằng cảnh phụ ${hidden}, lộ mà không có zoom giật ${shown}) · zoom ${r.zooms.length} · hình ${r.stickers.length} · âm thanh ${r.sfx.length} · đoạn đứng hình lâu nhất ${still.toFixed(2)}s · lỗi ${errs.length ? errs : 0}`);
  if (process.env.SHOT) {
    // ảnh khung có hình minh hoạ / chữ số liệu
    for (const t of String(process.env.SHOT).split(',')) {
      await p.evaluate((T) => window.__dv.seek(T), +t);
      await p.waitForTimeout(900);
      await p.locator('#cv').screenshot({path: `test/plan-${t}.png`});
    }
  }
  if (process.env.EXPORT) {
    await p.click('#btnExport');
    await p.waitForTimeout(300);
    await p.click('#dlg [data-v="1"]');
    await p.waitForSelector('#xres');
    await p.click('#xres [data-r="720"]');
    await p.click('#exp [data-x="go"]');
    const t0 = Date.now();
    await p.waitForSelector('.xvid, .err', {timeout: 240000});
    console.log('EXPORT_SEC', (Date.now() - t0) / 1000, (await p.locator('.err').count()) ? await p.locator('.err').innerText() : 'ok');
    const b64 = await p.evaluate(async () => {
      const u = document.querySelector('.xvid')?.src;
      if (!u) return '';
      const a = new Uint8Array(await (await fetch(u)).arrayBuffer());
      let s = '';
      for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
      return btoa(s);
    });
    if (b64) fs.writeFileSync('test/plan-out.mp4', Buffer.from(b64, 'base64'));
  }
  await b.close();
})();
