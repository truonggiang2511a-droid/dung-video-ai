// Chụp giao diện mới (kiểu HyperFrames + màu Higgsfield) ở nhiều khổ màn hình
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 1440), h = +(process.argv[3] || 900);
  const tag = `${w}x${h}`;
  const mob = w < 900;
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: mob ? 2 : 1, hasTouch: mob, isMobile: mob})).newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  await p.screenshot({path: `test/ui-${tag}-0-empty.png`});
  let fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'Phong khach.mp4', M + 'Bep.mp4', M + 'Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  // lời giả lập (theo đáp án giọng đọc) để có phụ đề + lời thoại khi chạy cục bộ không có máy chủ
  const truth = JSON.parse(fs.readFileSync(M + 'gen/speech_mid.json'));
  const texts = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố', 'ngay trung tâm thành phố', 'Diện tích đất 52m2,', 'một trệt hai lầu.', 'Giá bán 3.800 triệu,', 'có thương lượng.', 'Nhà có 3 phòng ngủ, 2 phòng tắm.', 'Pháp lý sổ hồng riêng,', 'công chứng ngay trong ngày.', 'Ai quan tâm thì nhắn tin cho mình nhé.'];
  const words = [];
  truth.speech.forEach(([a, bb], i) => {
    const ts = (texts[i] || '').split(' ');
    ts.forEach((t, j) => words.push({w: t, s: +(a + ((bb - a) * j) / ts.length).toFixed(2), e: +(a + ((bb - a) * (j + 0.85)) / ts.length).toFixed(2)}));
  });
  await p.evaluate((ws) => (window.__dv.p.transcript = {words: ws}), words);
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  await p.evaluate(() => window.__dv.seek(1.2));
  await p.waitForTimeout(900);
  await p.screenshot({path: `test/ui-${tag}-1-done.png`});
  // chọn cảnh phụ → thanh nổi + thẻ ngữ cảnh
  await p.locator('.clip[data-type="broll"]').first().click();
  await p.waitForTimeout(500);
  await p.screenshot({path: `test/ui-${tag}-2-sel.png`});
  if (!mob) {
    await p.click('#side [data-tab="script"]');
    await p.waitForTimeout(300);
    await p.locator('.w').nth(12).click();
    await p.locator('.w').nth(15).click({modifiers: ['Shift']});
    await p.waitForTimeout(300);
    await p.screenshot({path: `test/ui-${tag}-3-script.png`});
    await p.click('#side [data-tab="media"]');
    await p.waitForTimeout(300);
    await p.screenshot({path: `test/ui-${tag}-4-media.png`});
    await p.click('[data-tool="note"]');
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await p.waitForTimeout(400);
    await p.screenshot({path: `test/ui-${tag}-5-note.png`});
  }
  console.log(tag, 'LOGS', logs.join(' | ') || 'none');
  await b.close();
})();
