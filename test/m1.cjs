// KIỂM 4 THỨ CHUYỂN TỪ MÁY DỰNG HYPERFRAMES SANG CANVAS (5/11): âm thanh bộ mẫu 1, cảnh phụ quay chậm + chuyển cảnh êm + dài hơn,
// chữ đứng lâu hơn, thẻ chương + nhãn phòng. Chạy bản cục bộ (không /api → bộ dựng trên máy, chương tự đoán theo lời).
// URL=http://localhost:8795/ node test/m1.cjs   · EXPORT=1 xuất thật test/m1-out.mp4 · SHOTS=1 chụp khung chuyển cảnh test/m1-tr-*.png
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
const ok = (c, m) => console.log(c ? '✅' : '❌', m);
(async () => {
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8795/');
  await p.waitForTimeout(800);
  let fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'main62.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'm1/Phong khach.mp4', M + 'm1/Bep.mp4', M + 'm1/Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  // lời giả lập BĐS 10 câu, mỗi câu trong 5,2 s có tiếng của mỗi chu kỳ 6,2 s (khớp tiếng sine của main62.mp4)
  const S = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố đẹp', 'Căn nhà nằm ở xã Phước Lý giáp ranh Bình Chánh,', 'cách chợ Bình Chánh chỉ hai cây số rất tiện.', 'Diện tích 80 mét vuông, chiều ngang 5 mét,', 'kết cấu một trệt hai lầu chắc chắn.', 'Phòng khách rộng rãi thoáng mát, bếp hiện đại,', 'phòng ngủ có ban công đón nắng.', 'Pháp lý sổ hồng riêng, công chứng ngay.', 'Giá bán 3 tỷ 990 triệu, có thương lượng.', 'Ai quan tâm thì nhắn tin cho mình nhé.'];
  const words = [];
  S.forEach((t, i) => {
    const a = i * 6.2 + 0.1;
    const bb = i * 6.2 + 5.1;
    const ts = t.split(' ');
    ts.forEach((w, j) => words.push({w, s: +(a + ((bb - a) * j) / ts.length).toFixed(2), e: +(a + ((bb - a) * (j + 0.85)) / ts.length).toFixed(2)}));
  });
  await p.evaluate(([ws, g]) => {
    window.__dv.p.transcript = {words: ws};
    window.__dv.p.genre = g;
  }, [words, process.env.GENRE || 'bds']);
  const t0 = Date.now();
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 240000});
  console.log('AI dựng xong sau', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const r = await p.evaluate(async () => {
    const q = window.__dv.p;
    const D = q.main.segs.reduce((a, s) => a + s.out - s.in, 0);
    return {
      D: +D.toFixed(2),
      pack: q.pack,
      fps: Object.values(q.sources).filter((s) => s.kind === 'broll').map((s) => [s.name, s.fps]),
      broll: q.broll.map((x) => ({name: q.sources[x.src].name, s: x.start, dur: x.dur, in: x.in, rate: x.rate || 1, trans: x.trans, srcDur: q.sources[x.src].duration})),
      texts: q.texts.map((t) => ({s: t.start, dur: t.dur, main: t.main})),
      sfx: q.sfx.map((s) => ({k: s.sfx, s: s.start, vol: s.vol})),
      gfx: q.stickers.filter((s) => s.kind === 'gfx').map((s) => ({key: s.key, s: s.start, dur: s.dur, label: s.label, sub: s.sub})),
      subsOn: q.subs?.on,
      keysLocal: window.__ai.localKeys(q).map((t) => `${t.start} ${t.main}`),
      nums: window.__ai.numberLockups(q).map((t) => `${t.start} ${t.main}`),
      density: q.textDensity,
    };
  });
  console.log('Phong cách:', r.pack, '· dài', r.D, 's · khung/giây cảnh phụ', JSON.stringify(r.fps));
  console.log('Cảnh phụ:', r.broll.map((x) => `${x.name} ${x.s}+${x.dur}s ×${x.rate} ${x.trans}`).join(' | '));
  console.log('Chữ:', r.texts.map((t) => `${t.s}+${t.dur} ${t.main}`).join(' | '));
  console.log('Đồ hoạ:', r.gfx.map((g) => `${g.s} ${g.key}${g.label ? ' ' + g.label : ''}${g.sub ? ' · ' + g.sub : ''}`).join(' | '));
  console.log('Chữ ý chính tự tìm:', r.keysLocal.join(' | '), '· số liệu:', r.nums.join(' | '), '· mật độ', r.density);
  console.log('Thẻ:', r.gfx.map((g) => `${g.key} ${g.s}+${g.dur}`).join(' | '));
  console.log('Âm:', r.sfx.map((s) => `${s.s} ${s.k}`).join(' '));
  // 1. quay chậm đúng theo khung/giây
  const rateOf = (n) => r.broll.filter((x) => x.name === n).map((x) => x.rate);
  ok(rateOf('Phong khach').every((x) => x === 0.6) && rateOf('Phong khach').length, `cảnh 50 khung/giây chạy 0,6× (${rateOf('Phong khach')})`);
  ok(rateOf('Bep').every((x) => x === 0.5) && rateOf('Bep').length, `cảnh 60 khung/giây chạy 0,5× (${rateOf('Bep')})`);
  ok(rateOf('Mat tien').every((x) => x === 1), `cảnh 30 khung/giây giữ tốc độ thường (${rateOf('Mat tien')})`);
  ok(r.broll.every((x) => x.in + x.dur * x.rate <= x.srcDur + 0.01), 'đoạn lấy trong file cảnh không vượt độ dài cảnh (tính cả quay chậm)');
  // 2. chuyển cảnh êm + cảnh dài hơn
  ok(r.broll.every((x) => ['soft', 'push', 'blurin'].includes(x.trans)), `chuyển cảnh êm: ${[...new Set(r.broll.map((x) => x.trans))].join(', ')}`);
  ok(r.broll.every((x) => x.dur >= 2.4), `mỗi cảnh phụ ≥ 2,4 s (ngắn nhất ${Math.min(...r.broll.map((x) => x.dur)).toFixed(2)} s)`);
  // 3. chữ đứng lâu hơn, không chồng nhau
  const ts = [...r.texts].sort((u, v) => u.s - v.s);
  ok(ts.every((t, i) => i === ts.length - 1 || t.s + t.dur <= ts[i + 1].s + 0.01), 'chữ không chồng nhau');
  const short = ts.filter((t, i) => t.dur < 2.95 && (i === ts.length - 1 || ts[i + 1].s - t.s > 3.3));
  ok(!short.length, `chữ đứng ≥ 3 s khi còn chỗ (ngắn: ${short.map((t) => t.main + ' ' + t.dur).join(', ') || 'không'})`);
  // 4. âm thanh bộ mẫu 1
  const old = r.sfx.filter((s) => !/^m1/.test(s.k));
  ok(!old.length, `chỉ dùng âm mẫu 1 (âm khác: ${old.map((s) => s.k).join(', ') || 'không'})`);
  const keys = r.sfx.filter((s) => /^m1key/.test(s.k)).map((s) => s.s).sort((u, v) => u - v);
  ok(keys.every((t, i) => !i || t - keys[i - 1] >= 3.49), `gõ phím đầu dòng phụ đề cách ≥ 3,5 s (${keys.length} lần)`);
  const per = (r.sfx.length / r.D) * 60;
  ok(per <= 32 && per >= 10, `mật độ âm ${per.toFixed(1)}/phút (mẫu 1 duyệt ≈ 26)`);
  const nLk = r.sfx.filter((s) => /^m1lk/.test(s.k)).length;
  ok(nLk >= Math.min(ts.length, 3), `mỗi cụm chữ 1 tiếng chạm (${nLk} tiếng / ${ts.length} chữ + thẻ)`);
  // 5. thẻ chương + nhãn phòng
  const ch = r.gfx.filter((g) => g.key === 'chapter');
  ok(ch.length >= (process.env.GENRE && process.env.GENRE !== 'bds' ? 0 : 1), `thẻ chương: ${ch.map((g) => g.label + ' ' + g.sub + ' @' + g.s).join(', ') || 'không'}`);
  const cards = r.gfx.filter((g) => ['price', 'specs', 'pin', 'slash', 'sale'].includes(g.key));
  ok(!ch.some((g) => cards.some((c) => g.s < c.s + c.dur && g.s + g.dur > c.s)), 'thẻ chương không trùng lúc thẻ ngành (giá, thông số, vị trí)');
  ok(ch.every((g, i) => !i || g.s - ch[i - 1].s >= 12), 'các chương cách nhau ≥ 12 s');
  const rooms = r.gfx.filter((g) => g.key === 'room');
  ok(rooms.length >= 2, `nhãn phòng: ${rooms.map((g) => g.label).join(', ')}`);
  const clash = ch.filter((g) => ts.some((t) => g.s < t.s + t.dur && g.s + g.dur > t.s));
  ok(!clash.length, 'thẻ chương không trùng lúc chữ điểm nhấn');
  ok(!errs.length, 'không lỗi JS' + (errs.length ? ': ' + errs.join(' | ') : ''));

  if (process.env.SHOTS) {
    for (const x of r.broll.slice(0, 3)) {
      for (const dt of [0.1, 0.3, 0.6]) {
        await p.evaluate((t) => window.__dv.player.seek(t), x.s + dt);
        await p.waitForTimeout(700);
        await p.locator('#cv').screenshot({path: `test/m1-tr-${x.trans}-${dt}.png`});
      }
    }
    const c = ch[0];
    if (c) {
      await p.evaluate((t) => window.__dv.player.seek(t), c.s + 0.8);
      await p.waitForTimeout(700);
      await p.locator('#cv').screenshot({path: 'test/m1-chapter.png'});
    }
  }
  if (process.env.EXPORT) {
    await p.click('#btnExport').catch(() => {});
    await p.waitForTimeout(300);
    await p.click('#dlg [data-v="1"]');
    await p.waitForSelector('#xres');
    await p.click('#xres [data-r="720"]');
    await p.click('#exp [data-x="go"]');
    const e0 = Date.now();
    await p.waitForSelector('.xvid, .err', {timeout: 400000});
    console.log('Xuất mất', ((Date.now() - e0) / 1000).toFixed(1), 's');
    if (await p.locator('.err').count()) console.log('❌ lỗi xuất', await p.locator('.err').innerText());
    else {
      const b64 = await p.evaluate(async () => {
        const a = new Uint8Array(await (await fetch(document.querySelector('.xvid').src)).arrayBuffer());
        let s = '';
        for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
        return btoa(s);
      });
      fs.writeFileSync('test/m1-out.mp4', Buffer.from(b64, 'base64'));
      fs.writeFileSync('test/m1-plan.json', JSON.stringify(r, null, 1));
      console.log('Đã lưu test/m1-out.mp4');
    }
  }
  await b.close();
})();
