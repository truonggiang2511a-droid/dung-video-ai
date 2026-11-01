// Kiểm: nút “Sửa video” (đổi định dạng, khung gốc 1 s), thay/xoá video chính, hoàn tác
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + 'speech_mid.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.waitForTimeout(800);
  // giả lập dự án cũ có video không hiện hình
  await p.evaluate(() => window.__dv.player.onMainError());
  await p.waitForSelector('[data-act="fixMain"]');
  await p.screenshot({path: 'test/f1-bad.png'});
  const t0 = Date.now();
  await p.click('[data-act="fixMain"]');
  await p.waitForFunction(() => !window.__dv.busy && !document.querySelector('[data-act="fixMain"]'), null, {timeout: 300000});
  console.log('FIX_SEC', ((Date.now() - t0) / 1000).toFixed(1));
  const b64 = await p.evaluate(async () => {
    const ed = window.__dv;
    const blob = await ed.getBlob(ed.p.sources[ed.p.main.src].fileKey);
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync('/tmp/fixed.mp4', Buffer.from(b64, 'base64'));
  await p.screenshot({path: 'test/f2-fixed.png'});
  // chọn đoạn video chính → bảng có Thay / Xoá
  await p.click('.clip[data-type="seg"]');
  await p.waitForTimeout(300);
  await p.screenshot({path: 'test/f3-seg.png'});
  await p.click('#side [data-act="removeMain"]');
  await p.click('#dlg [data-v="1"]');
  await p.waitForTimeout(500);
  const gone = await p.evaluate(() => window.__dv.p.main === null);
  await p.screenshot({path: 'test/f4-removed.png'});
  await p.click('#btnUndo');
  await p.waitForTimeout(1500);
  const back = await p.evaluate(() => !!window.__dv.p.main && !!window.__dv.player.mains.length && window.__dv.player.mains[0].readyState >= 1);
  await p.screenshot({path: 'test/f5-undo.png'});
  console.log('REMOVED', gone, 'UNDO_BACK', back, logs.join(' | '));
  await b.close();
})();
