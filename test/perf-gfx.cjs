// đo thời gian vẽ 1 khung (ms) cho từng đồ hoạ, CPU chậm ×4 (giả lập điện thoại)
const pw = require('playwright');
const WK = process.env.BROWSER === 'webkit';
const {execSync} = require('child_process');
const fs = require('fs');
execSync('npx esbuild test/tools/perf-entry.js --bundle --outfile=site/_perf.js --log-level=warning');
(async () => {
  const b = await (WK ? pw.webkit : pw.chromium).launch();
  const p = await b.newPage();
  if (!WK) await (await p.context().newCDPSession(p)).send('Emulation.setCPUThrottlingRate', {rate: +(process.env.SLOW || 4)});
  await p.goto('http://localhost:8790/');
  await p.addScriptTag({url: '/_perf.js'});
  console.log(JSON.stringify(await p.evaluate((ks) => window.perf(ks), (process.env.KEYS || 'none,price,specs,pin,room,slash,sale,buy,hook,follow').split(','))));
  fs.unlinkSync('site/_perf.js');
  await b.close();
})();
