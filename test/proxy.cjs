// 4K không phát được bằng thẻ <video> (giả HEVC trên Chrome): bỏ lên là thấy hình (khung tĩnh), bản xem nhanh chạy nền, phát được
// FILE=aroll4k30s.mp4 node test/proxy.cjs [rộng cao]   ·  OLD=1 = cách cũ (đổi định dạng 1080p chặn trước khi vào)
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
const [w, h] = [+process.argv[2] || 1440, +process.argv[3] || 900];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: w, height: h}});
  const p = await ctx.newPage();
  await p.addInitScript((old) => {
    window.DV_NO_VIDEO_TAG = true;
    if (old) window.DV_OLD_IMPORT = true;
  }, !!process.env.OLD);
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  p.on('console', (m) => /xem nhanh|Khung tĩnh|lỗi|Nạp file|Ảnh timeline/i.test(m.text()) && console.log('LOG', m.text()));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(1200);
  const fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  const t0 = Date.now();
  await (await fc).setFiles(M + (process.env.FILE || 'aroll4k30s.mp4'));
  const lit = () => p.evaluate(() => {
    const c = document.querySelector('#cv');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4 * 97) s += d[i] + d[i + 1] + d[i + 2];
    return s / (d.length / (4 * 97)) / 3;
  });
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 600000});
  const tMain = (Date.now() - t0) / 1000;
  let tFrame = null;
  for (let i = 0; i < 300; i++) {
    if ((await lit()) > 8) {
      tFrame = (Date.now() - t0) / 1000;
      break;
    }
    await p.waitForTimeout(100);
  }
  console.log(`vào timeline ${tMain.toFixed(1)} s · thấy hình ${tFrame?.toFixed(1)} s · ảnh timeline ${await p.evaluate(() => window.__dv.p.sources[window.__dv.p.main.src].thumbs.length)}`);
  await p.screenshot({path: 'test/proxy-1.png'});
  console.log('status:', (await p.locator('#status').innerText().catch(() => '')).replace(/\n/g, ' '));
  if (process.env.AI) {
    // AI dựng NGAY khi bản xem nhanh còn đang đổi (chỉ cần tiếng file gốc)
    const ta = Date.now();
    await p.click('#btnAi');
    await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 600000});
    const q = await p.evaluate(() => ({D: window.__dv.player.D.toFixed(1), segs: window.__dv.p.main.segs.length, texts: window.__dv.p.texts.length, px: window.__dv.p.sources[window.__dv.p.main.src].proxy}));
    console.log(`AI dựng xong ${((Date.now() - ta) / 1000).toFixed(1)} s khi bản xem nhanh = ${q.px}: còn ${q.D} s, ${q.segs} đoạn, ${q.texts} chữ`);
    await p.screenshot({path: 'test/proxy-ai.png'});
  }
  // tua khi còn khung tĩnh
  await p.evaluate(() => window.__dv.seek(12));
  await p.waitForTimeout(1500);
  await p.screenshot({path: 'test/proxy-2-seek.png'});
  // bấm phát khi chưa xong bản xem nhanh
  await p.click('#btnPlay');
  await p.waitForTimeout(500);
  console.log('phát khi chưa xong:', await p.evaluate(() => window.__dv.player.playing), '|', (await p.locator('#toast').innerText().catch(() => '')).slice(0, 90));
  await p.waitForFunction(() => {
    const s = window.__dv.p.sources[window.__dv.p.main.src];
    return !s.proxy || s.proxy === 'ready' || s.proxy === 'fail';
  }, null, {timeout: 900000});
  const tProxy = (Date.now() - t0) / 1000;
  const src = await p.evaluate(() => window.__dv.p.sources[window.__dv.p.main.src]);
  console.log(`bản xem nhanh xong ${tProxy.toFixed(1)} s (proxy=${src.proxy}, key=${src.proxyKey}, gốc giữ ${src.fileKey}) w×h ${src.w}×${src.h}`);
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__dv.seek(0));
  await p.click('#btnPlay');
  await p.waitForTimeout(3000);
  console.log('phát sau khi xong:', await p.evaluate(() => [window.__dv.player.playing, window.__dv.player.T.toFixed(2)]), 'sáng', (await lit()).toFixed(0));
  await p.screenshot({path: 'test/proxy-3-play.png'});
  if (process.env.EXPORT) {
    await p.click('#btnPlay');
    await p.click('#btnExport');
    await p.waitForTimeout(300);
    await p.click('#dlg [data-v="1"]').catch(() => {});
    await p.waitForSelector('#xres');
    await p.click('#xres [data-r="720"]');
    await p.click('#exp [data-x="go"]');
    const tx = Date.now();
    await p.waitForSelector('.xvid, .err', {timeout: 900000});
    console.log('XUẤT', (Date.now() - tx) / 1000, 's', (await p.locator('.err').count()) ? await p.locator('.err').innerText() : 'ok');
    if (!(await p.locator('.err').count())) {
      const b64 = await p.evaluate(async () => {
        const a = new Uint8Array(await (await fetch(document.querySelector('.xvid').src)).arrayBuffer());
        let s = '';
        for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
        return btoa(s);
      });
      require('fs').writeFileSync('test/proxy-out.mp4', Buffer.from(b64, 'base64'));
    }
  }
  await b.close();
})();
