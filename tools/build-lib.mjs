// Dựng KHO HÌNH cho app (chạy khi cần cập nhật kho, kết quả commit vào public/lib/):
//   node tools/build-lib.mjs
// • Hình minh hoạ: Fluent Emoji Flat của Microsoft (giấy phép MIT) — nhãn tiếng Việt lấy từ emojibase-data/vi (CLDR, MIT)
// • Icon: Lucide (giấy phép ISC) — nhãn tiếng Anh của Lucide dịch sang tiếng Việt bằng từ điển bên dưới
// Mỗi hình 1 file SVG (tải khi dùng), kèm 1 file mục lục JSON nhỏ để tìm kiếm.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = path.join(root, 'public/lib');
// chỉ xoá phần do file này dựng (giữ a/ = emoji động do tools/build-anim.mjs dựng)
for (const d of ['e', 'i']) fs.rmSync(path.join(out, d), {recursive: true, force: true});
fs.mkdirSync(path.join(out, 'e'), {recursive: true});
fs.mkdirSync(path.join(out, 'i'), {recursive: true});

const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const slug = (s) => String(s).toLowerCase().replace(/[’'“”".,!():]/g, '').replace(/&/g, 'and').replace(/\s+/g, '-').replace(/-+/g, '-');

// ---------- Emoji ----------
const fe = require('@iconify-json/fluent-emoji-flat/icons.json');
const en = require('emojibase-data/en/data.json');
const vi = require('emojibase-data/vi/data.json');
const viBy = Object.fromEntries(vi.map((x) => [x.hexcode, x]));
const enBySlug = {};
for (const e of en) {
  enBySlug[slug(e.label)] = e;
  if (e.label.startsWith('flag:')) enBySlug['flag-' + slug(e.label.slice(5).trim())] = e;
}
const SKIN = /-(light|medium-light|medium|medium-dark|dark)(-|$)/;
const GROUPS = ['Mặt cười & cảm xúc', 'Người & cử chỉ', '', 'Động vật & thiên nhiên', 'Đồ ăn & thức uống', 'Du lịch & nơi chốn', 'Hoạt động & lễ hội', 'Đồ vật', 'Biểu tượng', 'Cờ'];
const emoji = [];
let matched = 0;
for (const name of Object.keys(fe.icons)) {
  if (SKIN.test(name) && !/^(.*-)?(light|dark)-(bulb|skin)/.test(name)) {
    // bỏ biến thể màu da (giữ bản mặc định)
    const base = name.replace(SKIN, (m, a, b) => b);
    if (fe.icons[base]) continue;
  }
  const e = enBySlug[name];
  const v = e && viBy[e.hexcode];
  if (v) matched++;
  const label = v?.label || name.replace(/-/g, ' ');
  const tags = [...new Set([label, ...(v?.tags || [])])].join(',');
  const g = e ? e.group ?? 7 : 7;
  if (g === 2) continue;
  fs.writeFileSync(path.join(out, 'e', name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 ${fe.width || 32} ${fe.height || 32}">${fe.icons[name].body}</svg>`);
  emoji.push([name, label, tags, g]);
}
// sắp: có nhãn tiếng Việt trước, rồi theo nhóm
emoji.sort((a, b) => a[3] - b[3]);
fs.writeFileSync(path.join(out, 'emoji.json'), JSON.stringify({groups: GROUPS, items: emoji}));
console.log(`Emoji: ${emoji.length} hình (${matched} có nhãn tiếng Việt)`);

// ---------- Icon Lucide ----------
const lu = require('@iconify-json/lucide/icons.json');
const ltags = require('lucide-static/tags.json');
// từ điển Anh → Việt cho nhãn icon (đủ dùng cho tìm kiếm + AI chọn theo lời nói)
const DICT = {
  home: 'nhà', house: 'nhà', building: 'tòa nhà', residence: 'nhà ở', apartment: 'căn hộ', hotel: 'khách sạn', bed: 'giường,phòng ngủ', sofa: 'sofa,phòng khách', armchair: 'ghế,phòng khách', bath: 'bồn tắm,phòng tắm', bathtub: 'bồn tắm', shower: 'vòi sen,phòng tắm', toilet: 'nhà vệ sinh', door: 'cửa', key: 'chìa khoá', lock: 'khoá,an toàn', fence: 'hàng rào', warehouse: 'kho', factory: 'nhà máy', store: 'cửa hàng', shop: 'cửa hàng', school: 'trường học', university: 'đại học', hospital: 'bệnh viện', church: 'nhà thờ', castle: 'lâu đài', tent: 'lều,cắm trại', lamp: 'đèn', sun: 'nắng,mặt trời', moon: 'trăng,ban đêm', tree: 'cây xanh', trees: 'cây xanh', leaf: 'lá,xanh', flower: 'hoa', sprout: 'mầm,phát triển', mountain: 'núi', waves: 'sóng,biển', water: 'nước', droplet: 'giọt nước', cloud: 'mây', rain: 'mưa', snow: 'tuyết', wind: 'gió', fire: 'lửa,hot', flame: 'lửa,hot',
  money: 'tiền', cash: 'tiền mặt', currency: 'tiền tệ', banknote: 'tiền giấy', coins: 'tiền xu', wallet: 'ví', payment: 'thanh toán', bank: 'ngân hàng', banking: 'ngân hàng', finance: 'tài chính', price: 'giá', pricing: 'giá', cost: 'chi phí', tag: 'nhãn giá,giá', discount: 'giảm giá', sale: 'khuyến mãi', percent: 'phần trăm,giảm giá', receipt: 'hoá đơn', invoice: 'hoá đơn', cart: 'giỏ hàng,mua sắm', shopping: 'mua sắm', bag: 'túi', basket: 'giỏ', gift: 'quà tặng', package: 'gói hàng,đơn hàng', box: 'hộp,gói hàng', truck: 'xe tải,giao hàng', delivery: 'giao hàng', shipping: 'vận chuyển', credit: 'thẻ', card: 'thẻ', income: 'thu nhập', revenue: 'doanh thu', profit: 'lợi nhuận', investment: 'đầu tư', piggy: 'heo đất,tiết kiệm', savings: 'tiết kiệm', calculator: 'máy tính,tính toán', scale: 'cân',
  food: 'đồ ăn', restaurant: 'nhà hàng,quán ăn', meal: 'bữa ăn', breakfast: 'bữa sáng', dinner: 'bữa tối', utensils: 'dao nĩa,ăn uống', coffee: 'cà phê', cup: 'cốc', tea: 'trà', beer: 'bia', wine: 'rượu vang', pizza: 'pizza', soup: 'súp,canh', cake: 'bánh', cookie: 'bánh quy', fish: 'cá', egg: 'trứng', apple: 'táo', cherry: 'anh đào', grape: 'nho', citrus: 'cam chanh', carrot: 'cà rốt', salad: 'rau,salad', ice: 'đá,kem', chef: 'đầu bếp', cooking: 'nấu ăn', kitchen: 'bếp',
  car: 'ô tô,xe hơi', bike: 'xe đạp', bus: 'xe buýt', train: 'tàu hoả', plane: 'máy bay', ship: 'tàu thuỷ', map: 'bản đồ', pin: 'vị trí,ghim', location: 'vị trí', navigation: 'chỉ đường', route: 'lộ trình', road: 'đường', parking: 'bãi đỗ xe', fuel: 'xăng', travel: 'du lịch', luggage: 'hành lý', globe: 'thế giới', compass: 'la bàn',
  phone: 'điện thoại', smartphone: 'điện thoại', call: 'gọi điện', message: 'tin nhắn', chat: 'trò chuyện,nhắn tin', mail: 'thư,email', email: 'email', send: 'gửi', share: 'chia sẻ', user: 'người dùng', users: 'nhiều người', people: 'mọi người', person: 'người', contact: 'liên hệ', bell: 'chuông,thông báo', notification: 'thông báo', heart: 'tim,yêu thích', like: 'thích', thumbs: 'like', star: 'ngôi sao,đánh giá', rating: 'đánh giá', award: 'giải thưởng', trophy: 'cúp,chiến thắng', medal: 'huy chương', crown: 'vương miện,vip', badge: 'huy hiệu', smile: 'cười,vui', laugh: 'cười', frown: 'buồn', angry: 'giận',
  clock: 'đồng hồ,thời gian', time: 'thời gian', timer: 'hẹn giờ', calendar: 'lịch,ngày', alarm: 'báo thức', hourglass: 'đồng hồ cát,chờ', history: 'lịch sử',
  chart: 'biểu đồ', graph: 'đồ thị', trending: 'xu hướng,tăng trưởng', increase: 'tăng', decrease: 'giảm', statistics: 'thống kê', analytics: 'phân tích', target: 'mục tiêu', rocket: 'tên lửa,bứt phá', zap: 'tia chớp,nhanh', lightning: 'nhanh', sparkles: 'lấp lánh,mới', sparkle: 'lấp lánh', lightbulb: 'ý tưởng,bóng đèn', idea: 'ý tưởng', brain: 'trí não,thông minh', book: 'sách', library: 'thư viện', education: 'giáo dục', learning: 'học tập', student: 'học sinh', graduation: 'tốt nghiệp', pencil: 'bút chì,viết', pen: 'bút', notebook: 'sổ tay', clipboard: 'danh sách', list: 'danh sách', note: 'ghi chú', file: 'tài liệu', document: 'tài liệu,giấy tờ', folder: 'thư mục', search: 'tìm kiếm', question: 'câu hỏi', info: 'thông tin', alert: 'cảnh báo', warning: 'cảnh báo', shield: 'bảo vệ,an toàn', security: 'bảo mật', safety: 'an toàn', check: 'đúng,xong', checkmark: 'đúng', done: 'xong', cancel: 'huỷ,sai', close: 'đóng', plus: 'thêm', minus: 'bớt', arrow: 'mũi tên', up: 'lên', down: 'xuống', right: 'phải', left: 'trái', play: 'phát,video', video: 'video', camera: 'máy ảnh,quay phim', image: 'hình ảnh', music: 'âm nhạc', mic: 'micro', microphone: 'micro', headphones: 'tai nghe', speaker: 'loa', volume: 'âm lượng', tv: 'tivi', monitor: 'màn hình', laptop: 'laptop', computer: 'máy tính', wifi: 'wifi', battery: 'pin', power: 'nguồn,điện', settings: 'cài đặt', gear: 'bánh răng', tool: 'công cụ', wrench: 'cờ lê,sửa chữa', hammer: 'búa,xây dựng', construction: 'xây dựng', ruler: 'thước,đo', measure: 'đo đạc', baby: 'em bé', dog: 'chó', cat: 'mèo', bird: 'chim', paw: 'thú cưng', gamepad: 'chơi game', dumbbell: 'tập gym', bicycle: 'xe đạp', medical: 'y tế', stethoscope: 'bác sĩ', pill: 'thuốc', handshake: 'bắt tay,hợp tác', briefcase: 'công việc', work: 'công việc', office: 'văn phòng', calendar_days: 'lịch',
};
// nhóm icon theo TỪ TIẾNG ANH trong tên/nhãn (chính xác hơn khớp tiếng Việt không dấu)
const CATS = [
  ['Nhà & bất động sản', 'home house building door key bed sofa armchair bath bathtub shower toilet fence warehouse hotel apartment lamp castle tent hospital church landmark construction factory blinds lamp-ceiling'],
  ['Tiền & mua bán', 'money cash currency banknote coins wallet payment bank finance price tag discount percent receipt cart shopping bag gift package truck delivery credit card piggy calculator store shop dollar euro badge-dollar handbag barcode'],
  ['Ăn uống', 'food restaurant meal utensils coffee cup tea beer wine pizza soup cake cookie fish egg apple cherry grape citrus carrot salad chef cooking kitchen drink sandwich croissant popcorn ham beef milk candy ice-cream dessert fruit vegetable wheat cooking-pot chef-hat martini glass-water'],
  ['Liên hệ & mạng xã hội', 'phone message chat mail send share user users contact bell notification heart like thumbs smile laugh social at-sign comment messages-square handshake'],
  ['Thời gian', 'clock time timer calendar alarm hourglass history watch'],
  ['Số liệu & ý tưởng', 'chart graph trending statistics analytics target rocket zap sparkles lightbulb brain gauge activity trophy award medal crown star'],
  ['Học tập & tài liệu', 'book library education school graduation pencil pen notebook clipboard list note file document folder paperclip'],
  ['Đi lại & du lịch', 'car bike bus train plane ship map pin navigation route road parking fuel travel luggage globe compass sailboat tram'],
  ['Thiên nhiên & thời tiết', 'sun moon tree leaf flower mountain waves water droplet cloud rain snow wind fire flame sprout palm dog cat bird rabbit'],
  ['Dấu & mũi tên', 'arrow check x plus minus chevron alert info help question ban octagon triangle-alert'],
  ['Công nghệ & media', 'video camera image music mic headphones speaker volume tv monitor laptop computer wifi battery power settings cpu smartphone film clapperboard'],
].map(([n, w]) => [n, new Set(w.split(' '))]);
const icons = [];
for (const name of Object.keys(lu.icons)) {
  const words = [...new Set([...name.split('-'), ...(ltags[name] || []).flatMap((t) => String(t).toLowerCase().split(/[^a-z]+/))])].filter(Boolean);
  const vn = [...new Set(words.flatMap((w) => (DICT[w] ? DICT[w].split(',') : [])))];
  // nhãn hiển thị: dịch từ TÊN icon (chính xác hơn nhãn phụ); không dịch được thì giữ tên tiếng Anh
  const nameVn = name.split('-').flatMap((w) => (DICT[w] ? DICT[w].split(',') : []));
  const label = nameVn[0] || name.replace(/-/g, ' ');
  const nameWords = name.split('-');
  let cat = CATS.findIndex(([, set]) => nameWords.some((w) => set.has(w)) || set.has(name));
  if (cat < 0) cat = CATS.findIndex(([, set]) => words.some((w) => set.has(w)));
  const body = lu.icons[name].body.replace(/currentColor/g, '#ffffff');
  fs.writeFileSync(path.join(out, 'i', name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 ${lu.icons[name].width || lu.width || 24} ${lu.icons[name].height || lu.height || 24}">${body}</svg>`);
  icons.push([name, label, [...vn, ...words].join(','), cat < 0 ? CATS.length : cat]);
}
icons.sort((a, b) => a[3] - b[3]);
// Bộ icon BĐS "mẫu 1" của Giang (skill batdongsan-editor) → nhóm đầu tiên; vẽ bằng tools/build-bds-icons.py
execFileSync('python3', [path.join(root, 'tools/build-bds-icons.py')], {stdio: 'inherit'});
const bds = JSON.parse(fs.readFileSync(path.join(root, 'tools/bds-icons.json'), 'utf8')).map(([k, l, t]) => [k, l, t, 0]);
for (const it of icons) it[3] += 1;
fs.writeFileSync(path.join(out, 'icons.json'), JSON.stringify({groups: ['Bộ BĐS mẫu 1', ...CATS.map((c) => c[0]), 'Khác'], items: [...bds, ...icons]}));
console.log(`Icon: ${icons.length} (${icons.filter((x) => !/^[a-z0-9 ]+$/.test(x[1])).length} có nhãn tiếng Việt, ${icons.filter((x) => x[3] < CATS.length).length} có nhóm)`);

fs.writeFileSync(
  path.join(out, 'GIAY-PHEP.txt'),
  `Kho hình của Dựng Video AI
- Hình minh hoạ (thư mục e/): Fluent Emoji (Flat) — Copyright (c) Microsoft Corporation — giấy phép MIT: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE
- Nhãn tiếng Việt của hình: emojibase-data (MIT) dựa trên Unicode CLDR.
- Icon (thư mục i/): Lucide — Copyright (c) Lucide Contributors — giấy phép ISC: https://github.com/lucide-icons/lucide/blob/main/LICENSE
- Icon bds-*.svg: bộ icon bất động sản "mẫu 1" do Dựng Video AI tự vẽ (tools/build-bds-icons.py).
- Emoji động (thư mục a/): Noto Emoji Animation — Copyright Google — giấy phép CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ (nguồn: https://googlefonts.github.io/noto-emoji-animation/). Ghi công bắt buộc: giữ dòng này + dòng ghi công trong app.
Cả hai giấy phép cho phép dùng thương mại, kể cả trong video khách xuất ra; chỉ cần giữ thông báo bản quyền này trong phần mềm.
`,
);
