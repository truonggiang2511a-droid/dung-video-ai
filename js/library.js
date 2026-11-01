// KHO TÀI NGUYÊN: hình minh hoạ (Fluent Emoji, MIT), icon động (Lucide, ISC), SFX (tự tổng hợp, sfx.js).
// File hình nằm ở site/lib/e/*.svg và site/lib/i/*.svg (tạo bằng tools/build-lib.mjs) — chỉ tải hình nào đang dùng.
const norm = (s) => plain(s).replace(/[^a-z0-9]+/g, ' ').trim();
// giữ dấu tiếng Việt (để gõ “nhà” không ra “nhân viên”)
const normV = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// ---------- mục lục (tải khi mở kho / khi AI cần) ----------
const idx = {};
export function loadIndex(kind) {
  if (!idx[kind])
    idx[kind] = fetch(`lib/${kind === 'icon' ? 'icons' : 'emoji'}.json`)
      .then((r) => r.json())
      .then((j) => ({groups: j.groups, items: j.items.map(([key, label, tags, g]) => ({key, label, tags, g, l: ' ' + norm(label) + ' ', ts: new Set([label, ...tags.split(',')].map(norm)), qv: ' ' + normV(label + ' ' + tags) + ' ', q: ' ' + norm(key.replace(/-/g, ' ') + ' ' + label + ' ' + tags) + ' '}))}))
      .catch(() => ({groups: [], items: []}));
  return idx[kind];
}
export async function searchLib(kind, q, group = -1, limit = 240) {
  const {items} = await loadIndex(kind);
  const t = plain(q).trim();
  let out = items;
  if (group >= 0) out = out.filter((x) => x.g === group);
  if (t) {
    // khớp theo ĐẦU TỪ (gõ “nha” ra “nhà”, không ra “nhân viên”); nhãn trùng cả từ lên đầu
    const words = norm(t).split(' ').filter(Boolean);
    const full = words.join(' ');
    const score = (x) => (x.ts.has(full) ? 6 : 0) + words.reduce((a, w) => a + (x.l.includes(' ' + w + ' ') ? 4 : x.l.includes(' ' + w) ? 2 : x.q.includes(' ' + w + ' ') ? 1 : 0), 0) - x.l.length / 200;
    const acc = normV(q) !== norm(q) ? normV(q).split(' ').filter(Boolean) : null;
    out = out.filter((x) => words.every((w) => x.q.includes(' ' + w)) && (!acc || acc.every((w) => x.qv.includes(' ' + w))));
    out = out.map((x) => [score(x), x]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }
  return out.slice(0, limit);
}

// ---------- ảnh cho canvas (nhớ sẵn) ----------
const imgs = new Map();
let onLoad = null;
export function onStickerLoad(fn) {
  onLoad = fn;
}
function key(it) {
  return it.kind === 'icon' ? `i:${it.key}` : `e:${it.key}`;
}
function load(it) {
  const k = key(it);
  if (imgs.has(k)) return imgs.get(k);
  const rec = {img: null, p: null};
  rec.p = new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      // vẽ sẵn 1 lần ra canvas 320 px → mỗi khung chỉ chép ảnh (SVG vẽ lại mỗi khung rất chậm trên máy yếu)
      const c = document.createElement('canvas');
      c.width = c.height = 320;
      try {
        c.getContext('2d').drawImage(im, 0, 0, 320, 320);
        rec.img = c;
      } catch (e) {
        rec.img = im;
      }
      onLoad?.();
      res(rec.img);
    };
    im.onerror = () => res(null);
    im.src = `lib/${it.kind === 'icon' ? 'i' : 'e'}/${it.key}.svg`;
  });
  imgs.set(k, rec);
  return rec;
}
// trả ảnh đã tải (hoặc null và bắt đầu tải — khung sau sẽ có)
export function stickerImage(it) {
  return load(it).img;
}
export async function preloadStickers(p) {
  await Promise.all((p.stickers || []).map((s) => load(s).p));
}

// ---------- AI chọn hình theo lời nói ----------
// từ khoá (không dấu) → hình Fluent Emoji. Ưu tiên cụm dài trước. Chỉ dùng hình đã kiểm có trong kho.
export const STICKER_WORDS = [
  ['phong khach', 'couch-and-lamp'], ['phong ngu', 'bed'], ['phong tam', 'bathtub'], ['nha ve sinh', 'toilet'], ['so hong', 'page-facing-up'], ['phap ly', 'page-facing-up'], ['giay to', 'page-facing-up'],
  ['chia khoa', 'key'], ['ban giao', 'key'], ['mat tien', 'house-with-garden'], ['can ho', 'office-building'], ['chung cu', 'office-building'], ['nha pho', 'house'], ['dat nen', 'world-map'], ['vi tri', 'round-pushpin'], ['trung tam', 'round-pushpin'],
  ['truong hoc', 'school'], ['benh vien', 'hospital'], ['cho', 'shopping-cart'], ['sieu thi', 'shopping-cart'], ['cong vien', 'deciduous-tree'], ['ho boi', 'person-swimming'], ['bai xe', 'automobile'], ['o to', 'automobile'], ['xe hoi', 'automobile'],
  ['gia', 'money-bag'], ['ty', 'money-bag'], ['trieu', 'money-bag'], ['tien', 'money-bag'], ['thuong luong', 'handshake'], ['giam gia', 'money-with-wings'], ['khuyen mai', 'wrapped-gift'], ['qua tang', 'wrapped-gift'], ['tang kem', 'wrapped-gift'], ['mien phi', 'free-button'], ['freeship', 'delivery-truck'], ['giao hang', 'delivery-truck'], ['dat hang', 'shopping-cart'], ['mua', 'shopping-bags'],
  ['ngon', 'face-savoring-food'], ['pho', 'steaming-bowl'], ['bun', 'steaming-bowl'], ['mi', 'steaming-bowl'], ['com', 'cooked-rice'], ['banh mi', 'baguette-bread'], ['ca phe', 'hot-beverage'], ['tra sua', 'bubble-tea'], ['tra', 'teacup-without-handle'], ['bia', 'beer-mug'], ['cay', 'hot-pepper'], ['lau', 'shallow-pan-of-food'], ['nuong', 'meat-on-bone'], ['banh', 'shortcake'], ['trai cay', 'red-apple'], ['an', 'fork-and-knife-with-plate'],
  ['tang truong', 'chart-increasing'], ['tang', 'chart-increasing'], ['giam', 'chart-decreasing'], ['loi nhuan', 'chart-increasing'], ['dau tu', 'chart-increasing'], ['tiet kiem', 'coin'], ['muc tieu', 'bullseye'], ['thanh cong', 'trophy'], ['top', 'trophy'], ['so 1', '1st-place-medal'],
  ['meo', 'light-bulb'], ['y tuong', 'light-bulb'], ['bi quyet', 'light-bulb'], ['luu y', 'warning'], ['chu y', 'warning'], ['canh bao', 'warning'], ['sai lam', 'cross-mark'], ['dung', 'check-mark-button'], ['buoc', 'footprints'], ['hoc', 'books'], ['kien thuc', 'books'], ['sach', 'books'],
  ['thoi gian', 'alarm-clock'], ['nhanh', 'high-voltage'], ['hot', 'fire'], ['nong', 'fire'], ['moi', 'sparkles'], ['dep', 'sparkles'], ['yeu', 'red-heart'], ['thich', 'red-heart'], ['tuyet voi', 'star-struck'], ['bat ngo', 'astonished-face'], ['vui', 'grinning-face-with-big-eyes'], ['buon', 'crying-face'],
  ['dien thoai', 'mobile-phone'], ['nhan tin', 'speech-balloon'], ['inbox', 'speech-balloon'], ['goi', 'telephone-receiver'], ['lien he', 'telephone-receiver'], ['theo doi', 'bell'], ['dang ky', 'bell'],
  ['du lich', 'airplane'], ['bien', 'water-wave'], ['nui', 'mountain'], ['khach san', 'hotel'], ['gia dinh', 'people-hugging'], ['tre em', 'child'], ['suc khoe', 'flexed-biceps'], ['an toan', 'shield'],
];
export function stickerForPhrase(text) {
  const t = ' ' + plain(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best = null;
  for (const [w, key] of STICKER_WORDS) if (t.includes(' ' + w + ' ') && (!best || w.length > best.w.length)) best = {w, key};
  return best;
}

// chuyển động cho hình / icon
export const MOTIONS = [
  ['pop', 'Bật ra'],
  ['bounce', 'Nảy'],
  ['float', 'Lơ lửng'],
  ['wiggle', 'Lắc lư'],
  ['pulse', 'Nhịp tim'],
  ['spin', 'Xoay vào'],
  ['drop', 'Rơi xuống'],
  ['slide', 'Trượt vào'],
];
