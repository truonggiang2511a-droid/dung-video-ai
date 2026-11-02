// node test/recipes.cjs → kiểm công thức dựng theo ngành với lời giả lập (không cần video)
const {chromium} = require('playwright');
const {execSync} = require('child_process');
const fs = require('fs');
execSync('npx esbuild test/tools/recipes-entry.js --bundle --outfile=site/_rec.js --log-level=warning');
const CASES = [
  ['bds', 'bds-mau1', ['Xin chào cả nhà hôm nay mình review căn nhà ở huyện Bình Chánh', 'Nhà một trệt hai lầu, ba phòng ngủ, hai toilet.', 'Diện tích 52m2, mặt tiền 5 mét.', 'Giá bán 3,8 tỷ có thương lượng.', 'Pháp lý sổ hồng riêng, hẻm xe hơi tận nhà.', 'Ai quan tâm nhắn tin cho mình.']],
  ['banhang', 'bh-flash', ['Chào các bạn hôm nay mình giới thiệu nồi chiên không dầu', 'Giá gốc 599 nghìn, hôm nay chỉ còn 399 nghìn.', 'Giảm 30% cho 100 đơn đầu tiên, miễn phí vận chuyển.', 'Nồi chiên chính hãng, bảo hành 12 tháng.', 'Bấm vào giỏ hàng đặt hàng ngay nhé.']],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8790/');
  await p.addScriptTag({url: '/_rec.js'});
  for (const [g, key, ss] of CASES) console.log(g, key, JSON.stringify(await p.evaluate(([a, b, c]) => window.runRecipe(a, c, b), [g, key, ss]), null, 1));
  fs.unlinkSync('site/_rec.js');
  await b.close();
})();
