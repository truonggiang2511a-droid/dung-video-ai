// Máy tính: vào thẳng timeline, thả HEVC (báo lỗi rõ), thêm A-roll, AI dựng, chụp màn hình
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 1600, height: 900}});
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(1200);
  await p.screenshot({path: 'test/pc1-open.png'});
  // HEVC
  let fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'IMG_HEVC.mov');
  await p.waitForSelector('#dlg:not([hidden])', {timeout: 60000}).catch(() => {});
  await p.waitForTimeout(500);
  console.log('HEVC:', (await p.locator('#dlg').innerText().catch(() => 'no dialog')).replace(/\n/g, ' | '));
  await p.screenshot({path: 'test/pc2-hevc.png'});
  await p.click('#dlg [data-v="1"]').catch(() => {});
  fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'aroll.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 30000});
  await p.waitForTimeout(1500);
  await p.screenshot({path: 'test/pc3-main.png'});
  await p.click('#btnAi');
  await p.waitForTimeout(2500);
  await p.screenshot({path: 'test/pc4-ai.png'});
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 90000});
  await p.waitForTimeout(800);
  // tua bằng bấm thước
  const r = await p.locator('.tl-ruler').boundingBox();
  await p.mouse.click(r.x + 400, r.y + 10);
  await p.waitForTimeout(600);
  console.log('T after ruler click', await p.evaluate(() => window.__dv.player.T.toFixed(2)));
  await p.screenshot({path: 'test/pc5-done.png'});
  await b.close();
})();
