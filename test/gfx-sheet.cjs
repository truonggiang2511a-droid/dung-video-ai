// node test/gfx-sheet.cjs → test/gfx-nganh.png (đồ hoạ theo ngành ở 3 thời điểm)
const {chromium} = require('playwright');
const {execSync} = require('child_process');
const fs = require('fs');
execSync('npx esbuild test/tools/gfx-sheet-entry.js --bundle --outfile=site/_gfx.js --log-level=warning');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8790/');
  await p.addScriptTag({url: '/_gfx.js'});
  const keys = (process.env.KEYS || 'price,specs,pin,room,slash,sale,buy').split(',');
  const times = (process.env.TIMES || '0.5,1.6,3').split(',').map(Number);
  const url = await p.evaluate(([k, t]) => window.sheet(k, t), [keys, times]);
  fs.writeFileSync('test/gfx-nganh.png', Buffer.from(url.split(',')[1], 'base64'));
  fs.unlinkSync('site/_gfx.js');
  console.log('ok', keys.length, 'loai');
  await b.close();
})();
