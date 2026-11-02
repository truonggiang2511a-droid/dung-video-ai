// Bố cục kéo giãn + Cài đặt giao diện: kéo vạch chia, nhớ sau khi tải lại, ẩn cột chat, khôi phục mặc định
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 1440), h = +(process.argv[3] || 900);
  const tag = `${w}x${h}`;
  const mob = w < 900;
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob});
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.waitForTimeout(800);
  const m = () =>
    p.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const row = r('.tl-row[data-row="texts"]');
      return {chat: Math.round(r('#chatcol')?.width || 0), side: Math.round(r('#side')?.width || 0), stage: Math.round(r('.e-stage').width), stageH: Math.round(r('.e-stage').height), tl: Math.round(r('#tl').height), row: Math.round(row.height), cv: Math.round(r('#cv').height)};
    });
  const drag = async (sel, dx, dy) => {
    const r = await p.locator(sel).boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x + dx / 2, y + dy / 2, {steps: 4});
    await p.mouse.move(x + dx, y + dy, {steps: 4});
    await p.mouse.up();
    await p.waitForTimeout(250);
  };
  const a0 = await m();
  console.log('0', JSON.stringify(a0));
  await p.screenshot({path: `test/layout-${tag}-0.png`});
  if (!mob) {
    if (w >= 1200) await drag('.split-v[data-split="chat"]', 120, 0);
    await drag('.split-v[data-split="side"]', -100, 0);
  }
  await drag('.split-h', 0, -90);
  const a1 = await m();
  console.log('1 sau khi kéo', JSON.stringify(a1));
  await p.screenshot({path: `test/layout-${tag}-1-keo.png`});
  await p.reload();
  await p.waitForTimeout(1500);
  const a2 = await m();
  console.log('2 tải lại (phải giữ)', JSON.stringify(a2), JSON.stringify(await p.evaluate(() => localStorage.getItem('dv.ui'))));
  // bảng cài đặt
  await p.click('#btnUi');
  await p.waitForTimeout(200);
  await p.screenshot({path: `test/layout-${tag}-2-caidat.png`});
  await p.click('.uiset [data-k="fz"] [data-v="1.12"]');
  if (w >= 1200) await p.click('.uiset [data-k="chat"] [data-v="0"]');
  await p.click('[data-act2="close"]');
  await p.waitForTimeout(300);
  const a3 = await m();
  console.log('3 chữ lớn + ẩn cột chat', JSON.stringify(a3), 'chat ở', await p.evaluate(() => document.querySelector('#chat').parentElement.id || document.querySelector('#chat').parentElement.className));
  await p.screenshot({path: `test/layout-${tag}-3-lon.png`});
  await p.click('#btnUi');
  await p.click('[data-act2="reset"]');
  await p.click('[data-act2="close"]');
  await p.waitForTimeout(300);
  const a4 = await m();
  console.log('4 mặc định (phải = 0)', JSON.stringify(a4), 'chat ở', await p.evaluate(() => document.querySelector('#chat').parentElement.id));
  console.log('LOGS', logs.join(' | ') || 'none');
  await b.close();
})();
