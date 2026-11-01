// Ảnh nhỏ (webp 128 px) cho từng emoji động trong kho — vẽ khung giữa bằng chính lottie-web (canvas) trong Chromium.
//   node tools/build-anim-thumbs.cjs   (sau tools/build-anim.mjs)
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.dirname(__dirname);
const dir = path.join(root, 'public/lib/a');
(async () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'public/lib/anim.json'), 'utf8')).items;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<canvas id="c" width="128" height="128"></canvas>');
  await p.addScriptTag({path: path.join(root, 'node_modules/lottie-web/build/player/lottie_light_canvas.min.js')});
  let n = 0;
  for (const [cp] of items) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, cp + '.json'), 'utf8'));
    const url = await p.evaluate((data) => {
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      g.clearRect(0, 0, 128, 128);
      const a = lottie.loadAnimation({renderer: 'canvas', loop: false, autoplay: false, animationData: data, rendererSettings: {context: g, clearCanvas: true}});
      a.resize?.();
      g.setTransform(1, 0, 0, 1, 0, 0);
      a.renderer.updateContainerSize?.();
      const fr = Math.floor((a.totalFrames || 1) * 0.35);
      a.goToAndStop(fr, true);
      const u = c.toDataURL('image/webp', 0.85);
      a.destroy();
      return u;
    }, data);
    fs.writeFileSync(path.join(dir, cp + '.webp'), Buffer.from(url.split(',')[1], 'base64'));
    n++;
  }
  console.log('Ảnh nhỏ emoji động:', n);
  await b.close();
})();
