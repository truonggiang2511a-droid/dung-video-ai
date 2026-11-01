// EMOJI ĐỘNG cho kho (chạy khi cần cập nhật, kết quả commit vào public/lib/a/ + public/lib/anim.json):
//   NOTO_ANIM=<thư mục lottie> node tools/build-anim.mjs && node tools/build-anim-thumbs.cjs
// Nguồn: Noto Emoji Animation của Google (giấy phép CC BY 4.0 — BẮT BUỘC ghi công: GIAY-PHEP.txt + dòng ghi công trong app).
// Lấy bản lottie đã gom sẵn trong repo GitHub rbozan/animated-emojis-rs (static/noto_animated_emoji/lottie/<mã>/lottie.json),
// bỏ biến thể màu da. Nhãn tiếng Việt từ emojibase-data/vi (CLDR). Mỗi hình nối với hình tĩnh Fluent cùng emoji (để AI chọn chung).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = process.env.NOTO_ANIM || '/tmp/aer/static/noto_animated_emoji/lottie';
const out = path.join(root, 'public/lib/a');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const en = require('emojibase-data/en/data.json');
const vi = require('emojibase-data/vi/data.json');
const fe = require('@iconify-json/fluent-emoji-flat/icons.json');
const norm = (h) => String(h).toUpperCase().split(/[-_]/).filter((x) => x !== 'FE0F').join('-');
const enBy = Object.fromEntries(en.map((x) => [norm(x.hexcode), x]));
const viBy = Object.fromEntries(vi.map((x) => [norm(x.hexcode), x]));
const slug = (s) => String(s).toLowerCase().replace(/[’'“”".,!():]/g, '').replace(/&/g, 'and').replace(/\s+/g, '-').replace(/-+/g, '-');
// làm gọn số thực (3 chữ số sau dấu phẩy) → nhẹ hơn mà không thấy khác
const trim = (o) => (Array.isArray(o) ? o.map(trim) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, trim(v)])) : typeof o === 'number' ? Math.round(o * 1000) / 1000 : o);
const items = [];
let bytes = 0;
let skipped = 0;
for (const cp of fs.readdirSync(src).sort()) {
  if (/_1f3f[b-f]/.test(cp)) continue; // màu da
  const f = path.join(src, cp, 'lottie.json');
  if (!fs.existsSync(f)) continue;
  const h = norm(cp);
  const e = enBy[h];
  const v = viBy[h];
  if (!e || e.group === 2) continue; // không rõ nhãn / nhóm “thành phần”
  let data;
  try {
    data = JSON.stringify(trim(JSON.parse(fs.readFileSync(f, 'utf8'))));
  } catch (err) {
    skipped++;
    continue;
  }
  if (data.length > 420000) {
    skipped++;
    continue;
  }
  fs.writeFileSync(path.join(out, cp + '.json'), data);
  bytes += data.length;
  const label = v?.label || e.label;
  const tags = [...new Set([label, ...(v?.tags || []), e.label])].join(',');
  const fk = fe.icons[slug(e.label)] ? slug(e.label) : '';
  items.push([cp, label, tags, e.group ?? 7, fk]);
}
items.sort((a, b) => a[3] - b[3]);
const GROUPS = ['Mặt cười & cảm xúc', 'Người & cử chỉ', '', 'Động vật & thiên nhiên', 'Đồ ăn & thức uống', 'Du lịch & nơi chốn', 'Hoạt động & lễ hội', 'Đồ vật', 'Biểu tượng', 'Cờ'];
fs.writeFileSync(path.join(root, 'public/lib/anim.json'), JSON.stringify({groups: GROUPS, items}));
console.log(`Emoji động: ${items.length} (${(bytes / 1e6).toFixed(1)} MB, bỏ ${skipped} file quá nặng), ${items.filter((x) => x[4]).length} nối được hình Fluent`);
