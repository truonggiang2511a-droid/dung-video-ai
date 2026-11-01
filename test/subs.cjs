// Xem 4 kiểu phụ đề: nạp video, gắn lời giả lập (theo đáp án giọng đọc), chụp khung xem từng kiểu
const {chromium} = require('playwright');
const fs = require('fs');
const M = '/home/claude/testmedia/';
(async () => {
  const truth = JSON.parse(fs.readFileSync(M + 'gen/speech_mid.json'));
  const texts = ['Xin chào cả nhà, hôm nay mình giới thiệu căn nhà phố', 'ngay trung tâm thành phố', 'Diện tích đất 52 mét vuông', 'một trệt hai lầu', 'Giá bán 3,8 tỷ'];
  const words = [];
  truth.speech.slice(0, texts.length).forEach(([a, b], i) => {
    const ts = texts[i].split(' ');
    ts.forEach((t, j) => words.push({w: t, s: a + ((b - a) * j) / ts.length, e: a + ((b - a) * (j + 0.85)) / ts.length}));
  });
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click('.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  await p.evaluate((ws) => {
    const ed = window.__dv;
    ed.p.transcript = {words: ws};
    ed.p.subs.on = true;
    ed.changed(false);
  }, words);
  const at = words[5].s + 0.3; // giữa câu đầu
  const at2 = words.find((w) => /3,8/.test(w.w)).s + 0.3;
  for (const st of ['karaoke', 'box', 'pop', 'clean']) {
    await p.evaluate((st) => { const ed = window.__dv; ed.p.subs.style = st; ed.p._rev++; ed.changed(false); }, st);
    for (const [n, T] of [[1, at], [2, at2]]) {
      await p.evaluate((T) => window.__dv.seek(T), T);
      await p.waitForTimeout(900);
      await p.locator('#cv').screenshot({path: `test/sub-${st}-${n}.png`});
    }
  }
  await p.evaluate(() => { window.__dv.sel = null; document.querySelector('.clip[data-type="subs"]')?.click(); });
  await p.waitForTimeout(400);
  await p.screenshot({path: 'test/sub-panel.png'});
  await b.close();
})();
