// Không gọi skill: AI dựng theo phong cách khách chọn; dải “Thử phong cách” đổi phong cách ngay
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
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
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
  await p.evaluate(() => { window.__dv.p.pack = 'neon'; window.__dv.p.packBy = 'user'; });
  await p.click('#btnAi');
  await p.waitForFunction(() => window.__dv.p.aiDone && !window.__dv.busy, null, {timeout: 180000});
  await p.waitForTimeout(1200);
  const a = await p.evaluate(() => ({rec: window.__dv.p.recipe, recBy: window.__dv.p.recipeBy, pack: window.__dv.p.pack, gfx: window.__dv.p.stickers.filter((s) => s.kind === 'gfx').map((s) => s.key), vars: [...document.querySelectorAll('#vars [data-pack]')].map((x) => x.dataset.pack), varsHidden: document.querySelector('#vars').hidden}));
  console.log('A', JSON.stringify(a));
  await p.screenshot({path: 'test/vars-pack.png'});
  const k = a.vars.find((x) => x !== 'close' && x !== a.pack);
  await p.click(`#vars [data-pack="${k}"]`);
  await p.waitForTimeout(400);
  console.log('B', JSON.stringify(await p.evaluate(() => ({pack: window.__dv.p.pack, by: window.__dv.p.packBy, on: document.querySelector('#vars .var-it.on')?.dataset.pack}))), 'want', k);
  console.log('LOGS', logs.join(' | ') || 'none');
  await b.close();
})();
