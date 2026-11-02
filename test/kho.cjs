// Con trỏ AI vào Kho lấy tài nguyên + tự kiểm (Giang 2/11 12:09). In chú thích từng bước, chụp ảnh từng bước,
// kiểm luật: mỗi chữ ≤ 1 thứ đi kèm (emoji/emoji động/icon gắn chữ HOẶC icon liền chữ), hình gắn sát chữ.
// node test/kho.cjs 390 844   |   node test/kho.cjs 1440 900   (GENRE=bds mặc định; URL=... chạy web thật)
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844);
  const mob = w < 900;
  const tag = `${w}`;
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'warning' && /kitTour|reviewPlan/.test(m.text()) && errs.push(m.text()));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  let fc = p.waitForEvent('filechooser');
  if (await p.locator('#home').isVisible()) {
    await p.click(`[data-hgenre="${process.env.GENRE || 'bds'}"]`);
    await p.click('#btnNew');
  } else await p.click('.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'Phong khach.mp4', M + 'Bep.mp4', M + 'Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  const truth = JSON.parse(fs.readFileSync(M + 'gen/speech_mid.json'));
  const texts = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố', 'ngay trung tâm thành phố', 'Diện tích đất 52m2,', 'một trệt hai lầu.', 'Giá bán 3.800 triệu,', 'có thương lượng.', 'Nhà có 3 phòng ngủ, 2 phòng tắm.', 'Pháp lý sổ hồng riêng,', 'công chứng ngay trong ngày.', 'Ai quan tâm thì nhắn tin cho mình nhé.'];
  const words = [];
  truth.speech.forEach(([a, bb], i) => {
    const ts = (texts[i] || '').split(' ');
    ts.forEach((t, j) => words.push({w: t, s: +(a + ((bb - a) * j) / ts.length).toFixed(2), e: +(a + ((bb - a) * (j + 0.85)) / ts.length).toFixed(2)}));
  });
  await p.evaluate(([ws, g]) => Object.assign(window.__dv.p, {transcript: {words: ws}, genre: g, textDensity: 'nhieu'}), [words, process.env.GENRE || 'bds']);
  await p.click('#btnAi');
  const t0 = Date.now();
  const tips = [];
  const shot = {};
  const keys = [['Phong cách', 'phongcach'], ['Font', 'font'], ['Màu', 'mau'], ['Chữ “', 'chu'], ['Tìm trong kho', 'tim'], ['đặt sát chữ', 'emoji'], ['Âm “', 'am'], ['Tự kiểm', 'tukiem']];
  let tour = null;
  let off = 0;
  const offAt = [];
  while (Date.now() - t0 < 300000) {
    const s = await p.evaluate(() => {
      const c = document.querySelector('.ai-cursor');
      const r = c.getBoundingClientRect();
      const tip = document.querySelector('.ai-tip');
      return {on: c.classList.contains('on'), x: r.left, y: r.top, tip: tip.classList.contains('on') ? tip.textContent : '', busy: window.__dv.busy, done: window.__dv.p.aiDone};
    });
    if (s.on && (s.x < -5 || s.y < -5 || s.x > w || s.y > h)) off++, offAt.push([Math.round(s.x), Math.round(s.y), s.tip.slice(0, 40)]);
    if (s.tip && tips.at(-1) !== s.tip) tips.push(s.tip);
    for (const [k, f] of keys)
      if (s.tip.includes(k) && !shot[f]) {
        shot[f] = 1;
        if (!tour) tour = Date.now();
        await p.waitForTimeout(250);
        await p.screenshot({path: `test/kho-${tag}-${f}.png`});
      }
    if (s.done && !s.busy) break;
    await p.waitForTimeout(150);
  }
  const secs = (Date.now() - t0) / 1000;
  // luật hình đi kèm chữ + khoảng cách hình ↔ chữ đo bằng hộp vẽ thật
  const r = await p.evaluate(() => {
    const pj = window.__dv.p;
    const comp = pj.stickers.filter((s) => s.attach);
    const free = pj.stickers.filter((s) => !s.attach && s.kind !== 'gfx');
    const bad = [];
    const dist = [];
    for (const t of pj.texts) {
      const cs = comp.filter((s) => s.attach === t.id);
      if (cs.length > 1) bad.push(`${t.main}: ${cs.length} hình`);
      window.__dv.seek(t.start + Math.min(1.2, t.dur * 0.6));
    }
    return {texts: pj.texts.map((t) => ({main: t.main, y: t.y, style: t.style, icon: t.icon, comp: comp.filter((s) => s.attach === t.id).map((s) => `${s.kind}:${s.key}`).join(',')})), nComp: comp.length, free: free.map((s) => `${s.kind}:${s.key}`), bad};
  });
  // khoảng cách: tua tới từng chữ có hình, đọc hộp vẽ trên khung xem
  const gaps = [];
  for (const t of r.texts.filter((x) => x.comp)) {
    const g = await p.evaluate(async (main) => {
      const pj = window.__dv.p;
      const tx = pj.texts.find((x) => x.main === main);
      const st = pj.stickers.find((s) => s.attach === tx.id);
      window.__dv.seek(tx.start + Math.min(1.3, tx.dur * 0.6));
      window.__dv.player.dirty = true;
      await new Promise((res) => setTimeout(res, 250));
      const bx = window.__dv.player.boxes;
      const a = bx.find((b) => b.id === tx.id);
      const c = bx.find((b) => b.id === st.id);
      if (!a || !c) return null;
      const dx = Math.max(0, Math.max(a.x, c.x) - Math.min(a.x + a.w, c.x + c.w));
      const dy = Math.max(0, Math.max(a.y, c.y) - Math.min(a.y + a.h, c.y + c.h));
      return Math.round(Math.hypot(dx, dy));
    }, t.main);
    gaps.push(g);
  }
  await p.screenshot({path: `test/kho-${tag}-xong.png`});
  console.log(JSON.stringify({w, secs, tourStartedAt: tour ? (tour - t0) / 1000 : null, offscreen: off, offAt: offAt.slice(0, 6), shots: Object.keys(shot), ...r, gapsPx: gaps, errs}, null, 1));
  console.log('TIPS:\n' + tips.filter((x) => !/Nghe video|Chép lời/.test(x)).slice(0, 40).join('\n'));
  await b.close();
})();
