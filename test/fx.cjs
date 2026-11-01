// Tab Hiệu ứng: 9 màu video (ảnh xem trước từ khung đang xem), lớp phủ, chuyển cảnh cho mọi cảnh phụ
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
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
  await p.evaluate(() => (window.__dv.p.genre = 'vlog'));
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  const ai = await p.evaluate(() => ({look: window.__dv.p.look, trans: window.__dv.p.broll.map((x) => x.trans), sfx: window.__dv.p.sfx.map((x) => x.sfx)}));
  await p.evaluate(() => window.__dv.seek(1.5));
  await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#side [data-tab="media"]').click());
  await p.evaluate(() => document.querySelector('[data-libtab="fx"]').click());
  await p.waitForTimeout(600);
  await p.screenshot({path: 'test/fx-1440.png'});
  // đổi màu Đen trắng + mọi chuyển cảnh = Lia nhanh
  await p.locator('[data-lookf="bw"]').click();
  await p.evaluate(() => document.querySelector('[data-libtab="fx"]').click());
  await p.locator('[data-alltrans="mix"]').click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({look: window.__dv.p.look, trans: window.__dv.p.broll.map((x) => x.trans)}));
  // khung có cảnh phụ đang chuyển cảnh
  const b0 = await p.evaluate(() => window.__dv.p.broll[0].start);
  for (const dt of [0.06, 0.15]) {
    await p.evaluate((T) => window.__dv.seek(T), b0 + dt);
    await p.waitForTimeout(700);
    await p.locator('#cv').screenshot({path: `test/fx-tr-${dt}.png`});
  }
  console.log(JSON.stringify({ai, after, errs}));
  await b.close();
})();
