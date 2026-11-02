// Điện thoại: vuốt xuống đóng tấm sửa, chọn công thức giữ chỗ cuộn + nhanh, gọi skill bằng @ và nút sổ xuống trong ô chat
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
const URL = process.env.URL || 'http://localhost:8790/';
const W = +(process.argv[2] || 390), Hh = +(process.argv[3] || 844);
(async () => {
  const b = await chromium.launch();
  const mob = W < 900;
  const p = await (await b.newContext({viewport: {width: W, height: Hh}, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(900);
  const fc = p.waitForEvent('filechooser');
  if (await p.locator('#btnNew').isVisible()) {
    await p.click('[data-hgenre="bds"]');
    await p.click('#btnNew');
  } else await p.click('.drop.main');
  await (await fc).setFiles([M + 'speech_mid_g30.mp4']);
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.evaluate(() => (window.__dv.p.genre = 'bds'));
  await p.waitForTimeout(1200);
  const out = {};
  if (mob) {
    await p.tap('.dk[data-act="recipes"]');
    await p.waitForTimeout(700);
    out.sheetOpen = await p.evaluate(() => document.querySelector('#side').classList.contains('open'));
    // cuộn hàng thẻ sang phải rồi chọn thẻ cuối
    await p.evaluate(() => (document.querySelector('#insp .rc-grid').scrollLeft = 400));
    const before = await p.evaluate(() => document.querySelector('#insp .rc-grid').scrollLeft);
    const t0 = Date.now();
    await p.tap('#insp [data-recipe="bds-nhanh"]');
    out.tapMs = Date.now() - t0;
    out.after = await p.evaluate(() => ({sl: document.querySelector('#insp .rc-grid').scrollLeft, on: document.querySelector('#insp .rc-it.on')?.dataset.recipe, rec: window.__dv.p.recipe}));
    out.scrollKept = Math.abs(out.after.sl - before) < 2;
    await p.screenshot({path: 'test/sheet-chon.png'});
    // vuốt xuống từ thanh nắm (chạm thật bằng CDP)
    const cdp = await p.context().newCDPSession(p);
    const g = await p.locator('.side-grab').boundingBox();
    const x = g.x + g.width / 2, y = g.y + g.height / 2;
    const tp = (type, yy) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y: yy}]});
    await tp('touchStart', y);
    for (let i = 1; i <= 8; i++) { await tp('touchMove', y + i * 22); await p.waitForTimeout(16); }
    out.midDrag = await p.evaluate(() => document.querySelector('#side').style.transform);
    await tp('touchEnd');
    await p.waitForTimeout(450);
    out.closedBySwipe = await p.evaluate(() => !document.querySelector('#side').classList.contains('open'));
    // mở lại, vuốt ngang trong hàng thẻ → KHÔNG được đóng
    await p.tap('.dk[data-act="recipes"]');
    await p.waitForTimeout(600);
    const r = await p.locator('#insp .rc-grid').boundingBox();
    const hx = r.x + r.width * 0.8, hy = r.y + 40;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: hx, y: hy}]});
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: hx - i * 25, y: hy + i * 2}]}); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await p.waitForTimeout(400);
    out.openAfterHorizontal = await p.evaluate(() => document.querySelector('#side').classList.contains('open'));
    await p.tap('[data-act="closeSheet"]');
    await p.waitForTimeout(400);
  }
  // gõ @ trong ô chat
  await p.click('#chatIn');
  await p.keyboard.type('làm chữ to hơn @sang');
  await p.waitForTimeout(250);
  out.popItems = await p.evaluate(() => [...document.querySelectorAll('#skillPop [data-skill]')].map((x) => x.dataset.skill));
  await p.screenshot({path: `test/sheet-at-${W}.png`});
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  out.afterAt = await p.evaluate(() => ({val: document.querySelector('#chatIn').value, rec: window.__dv.p.recipe, by: window.__dv.p.recipeBy, btn: document.querySelector('#skillName').textContent, pop: !document.querySelector('#skillPop').hidden}));
  // nút sổ xuống
  await p.click('#btnSkill');
  await p.waitForTimeout(250);
  out.dropCount = await p.evaluate(() => document.querySelectorAll('#skillPop [data-skill]').length);
  await p.screenshot({path: `test/sheet-drop-${W}.png`});
  await p.click('#skillPop [data-skill="bh-flash"]');
  await p.waitForTimeout(300);
  out.cross = await p.evaluate(() => ({genre: window.__dv.p.genre, rec: window.__dv.p.recipe, btn: document.querySelector('#skillName').textContent}));
  out.errs = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
