// CÔNG THỨC DỰNG theo ngành (2/11) — kiểu “skill” của HyperFrames: mỗi công thức = một cách dựng trọn vẹn khách bấm chọn
// (phong cách chữ/màu + đồ hoạ đặc trưng ngành + máy quay). Bố cục đồ hoạ chép từ bộ công cụ skill của Giang
// (batdongsan-editor / hook-video-30s / tron-video-aroll-broll / dung-video-da-the-loai: mg_price, mg_specs, mg_pin).
// Luật giữ nguyên: KHÔNG bịa số — mọi thẻ chỉ lấy chữ / số người nói THẬT SỰ nói ra; không số điện thoại trên hình.
import {timelineWords} from './render.js';
import {PACKS, packsFor} from './styles.js';
import {GENRES} from './templates.js';

export const SKILL_NAMES = {'chuyen-gia-noi': 'Chuyên gia nói', 'batdongsan-editor': 'BĐS Editor', 'hook-video-30s': 'Hook 30s', 'tron-video-aroll-broll': 'Trộn A-roll B-roll', 'dung-video-da-the-loai': 'Dựng đa thể loại'};
// mg = đồ hoạ ngành được bật · cam = máy quay chuyển động nhẹ ('drift') / mạnh ('strong')
const BASE = [
  {key: 'bds-mau1', genre: 'bds', name: 'Mẫu 1 · Review nhà', from: 'batdongsan-editor', pack: 'mau1', cam: 'drift',
    desc: 'Bảng giá lăn số, thẻ thông số nhà hiện đúng lúc nói, ghim vị trí, nhãn từng phòng, icon BĐS',
    mg: {price: true, specs: true, pin: true, room: true}},
  {key: 'bds-sang', genre: 'bds', name: 'Sang trọng · Nhà cao cấp', from: 'hook-video-30s', pack: 'sangtrong', cam: 'drift',
    desc: 'Chữ có chân ánh kim, chuyển cảnh mềm, màu điện ảnh — biệt thự, căn hộ cao cấp, dự án',
    mg: {price: true, specs: true, pin: true, room: true}},
  {key: 'bds-nhanh', genre: 'bds', name: 'TikTok nhanh · Nhà phố', from: 'tron-video-aroll-broll', pack: 'nangdong', cam: 'strong',
    desc: 'Cắt gọn, zoom giật, tiêu đề hộp màu, thanh tiến độ — nhà phố, đất nền, video ngắn',
    mg: {price: true, specs: true, pin: true, room: true}},
  {key: 'bds-chuyengia', genre: 'bds', name: 'Chuyên gia nói', from: 'chuyen-gia-noi', pack: 'chuyengia', cam: 'drift',
    desc: 'Khung REC mở đầu, nhãn kính cạnh vai, giá thành số to trên đầu, bảng các bước, sơ đồ lô đất, nút Đăng ký',
    mg: {price: true, specs: true, pin: true, room: true}},
  {key: 'bh-flash', genre: 'banhang', name: 'Flash sale', from: 'dung-video-da-the-loai', pack: 'salesoc', cam: 'strong',
    desc: 'Giá cũ gạch ngang → giá mới, tem giảm %, nút Mua ngay nhấp nháy, pháo giấy',
    mg: {price: true, slash: true, sale: true, buy: true, room: true}},
  {key: 'bh-review', genre: 'banhang', name: 'Review sản phẩm', from: 'dung-video-da-the-loai', pack: 'nangdong', cam: 'drift',
    desc: 'Bảng giá rõ ràng, nhãn từng góc sản phẩm, thanh tiến độ, nút Mua ngay',
    mg: {price: true, slash: true, sale: true, buy: true, room: true}},
  {key: 'bh-sang', genre: 'banhang', name: 'Cao cấp', from: 'dung-video-da-the-loai', pack: 'caocap', cam: 'drift',
    desc: 'Nền trầm, chữ vàng chuyển sắc, bảng giá kính mờ — mỹ phẩm, trang sức, dịch vụ cao cấp',
    mg: {price: true, slash: true, buy: true, room: true}},
];
// Ngành chưa có đồ hoạ riêng (giai đoạn 2): công thức = 3 phong cách hợp ngành + máy quay chuyển động
const BASIC_MG = {amthuc: {price: true, pin: true, room: true}, vlog: {pin: true, room: true}, kienthuc: {room: true}, chung: {room: true}};
function basicFor(g) {
  return packsFor(g).map((x) => ({key: `${g}-${x.key}`, genre: g, name: x.name, from: 'dung-video-da-the-loai', pack: x.key, cam: x.edit?.pace < 3 ? 'strong' : 'drift', desc: x.desc, mg: BASIC_MG[g] || {room: true}}));
}
export function recipesFor(genre) {
  const g = genre || 'chung';
  const own = BASE.filter((r) => r.genre === g);
  return own.length ? own : basicFor(g);
}
export const allRecipes = () => Object.keys(GENRES).flatMap((g) => recipesFor(g));
export function recipeOf(p) {
  const list = recipesFor(p.genre);
  return list.find((r) => r.key === p.recipe) || list.find((r) => r.pack === p.pack) || list[0];
}

// ---------- đọc lời người nói ----------
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const clean = (s) => String(s || '').replace(/[.,!?…:;"“”()]/g, '');
// tìm cụm (không dấu) trong lời, trả về chữ người nói (có dấu) + giây
function findPhrase(ws, phrase, from = 0, to = 1e9) {
  const toks = plain(phrase).split(/\s+/);
  for (let i = 0; i + toks.length <= ws.length; i++) {
    if (ws[i].s < from || ws[i].s > to) continue;
    if (toks.every((t, j) => plain(clean(ws[i + j].w)) === t)) return {s: ws[i].s, e: ws[i + toks.length - 1].e, text: ws.slice(i, i + toks.length).map((w) => clean(w.w)).join(' ')};
  }
  return null;
}
// nhãn tích dưới bảng giá: chỉ khi người nói nói ra (±8 s quanh giá)
const BADGES = {
  bds: [['so hong rieng', 'Sổ hồng riêng'], ['so rieng', 'Sổ riêng'], ['so do', 'Sổ đỏ'], ['cong chung ngay', 'Công chứng ngay'], ['thuong luong', 'Có thương lượng'], ['tra gop', 'Hỗ trợ trả góp'], ['o lien', 'Dọn vào ở liền'], ['vao o ngay', 'Dọn vào ở ngay']],
  banhang: [['mien phi van chuyen', 'Miễn phí giao hàng'], ['freeship', 'Miễn phí giao hàng'], ['chinh hang', 'Chính hãng'], ['bao hanh', 'Có bảo hành'], ['qua tang', 'Có quà tặng'], ['tang kem', 'Có quà tặng'], ['doi tra', 'Đổi trả dễ dàng']],
};
// thông số nhà nói thành chữ (không có số)
const TEXT_SPECS = [
  ['so hong rieng', 'doc', 'Sổ hồng *riêng*'], ['so do', 'doc', 'Sổ *đỏ*'], ['so rieng', 'doc', 'Sổ *riêng*'],
  ['hem xe hoi', 'car', 'Hẻm *xe hơi*'], ['duong o to', 'car', 'Đường *ô tô*'], ['xe hoi vao tan nha', 'car', 'Xe hơi *tận nhà*'], ['hem o to', 'car', 'Hẻm *ô tô*'],
  ['mat tien duong', 'road', 'Mặt tiền *đường*'], ['noi that day du', 'sofa', 'Nội thất *đầy đủ*'], ['full noi that', 'sofa', 'Full *nội thất*'],
];
// tên cảnh phụ theo tên file không dấu → chữ có dấu
const ROOM_NAMES = [
  ['phong khach', 'Phòng khách'], ['phong ngu', 'Phòng ngủ'], ['phong tam', 'Phòng tắm'], ['nha tam', 'Phòng tắm'], ['wc', 'Phòng tắm'], ['toilet', 'Phòng tắm'],
  ['bep', 'Bếp'], ['phong an', 'Phòng ăn'], ['mat tien', 'Mặt tiền'], ['san thuong', 'Sân thượng'], ['ban cong', 'Ban công'], ['san vuon', 'Sân vườn'],
  ['san truoc', 'Sân trước'], ['gara', 'Gara'], ['garage', 'Gara'], ['cau thang', 'Cầu thang'], ['ho boi', 'Hồ bơi'], ['flycam', 'Toàn cảnh'], ['toan canh', 'Toàn cảnh'],
  ['hem', 'Đường vào'], ['duong vao', 'Đường vào'], ['phong lam viec', 'Phòng làm việc'], ['tang tret', 'Tầng trệt'], ['lau 1', 'Lầu 1'], ['lau 2', 'Lầu 2'],
];
export function roomName(src) {
  if (src?.stock) return ''; // cảnh mạng (Pixabay) không phải phòng của căn nhà → không gắn nhãn phòng
  if (src.tag && src.tagBy) return src.tag;
  const n = ' ' + plain(String(src.name || '').replace(/\.[a-z0-9]+$/i, '')).replace(/[_\-.]+/g, ' ') + ' ';
  const hit = ROOM_NAMES.find(([k]) => n.includes(' ' + k + ' '));
  if (hit) return hit[1];
  return /[^\x00-\x7f]/.test(src.name || '') && !/\d{3,}/.test(src.name) ? String(src.name).replace(/\.[a-z0-9]+$/i, '').slice(0, 22) : '';
}
// vị trí: AI đưa (đã kiểm nguyên văn) hoặc tự tìm cụm “huyện/quận/đường/chợ… + tên riêng” / 2 chữ viết hoa liền nhau
const PLACE_TYPE = /^(quan|huyen|phuong|xa|thi xa|thanh pho|tp|duong|khu|du an|cho|truong|thi tran|tinh|ap|lang|cau|benh vien|nga tu|cong vien|vincom|aeon)$/;
const NEAR = /^(gan|canh|ke ben|ngay|tai|o|thuoc|nam o|cach)$/;
function findPlace(ws, aiPlace) {
  if (aiPlace) {
    const f = findPhrase(ws, aiPlace);
    if (f) return f;
  }
  for (let i = 0; i < ws.length; i++) {
    const w = plain(clean(ws[i].w));
    const two = i + 1 < ws.length ? w + ' ' + plain(clean(ws[i + 1].w)) : '';
    const typeLen = PLACE_TYPE.test(two) ? 2 : PLACE_TYPE.test(w) ? 1 : 0;
    if (typeLen) {
      const name = [];
      for (let j = i + typeLen; j < ws.length && name.length < 4; j++) {
        const t = clean(ws[j].w);
        if (!t || !/^\p{Lu}/u.test(t)) break;
        if (ws[j].s - ws[j - 1].e > 0.25 || /[.,!?…:;]$/.test(ws[j - 1].w)) break; // sang câu mới (chữ hoa đầu câu) thì không phải tên nơi
        name.push(t);
        if (/[.,!?…:;]$/.test(ws[j].w)) break;
      }
      if (name.length) return {s: ws[i].s, e: ws[i + typeLen + name.length - 1].e, text: [...ws.slice(i, i + typeLen).map((x) => clean(x.w)), ...name].join(' ')};
    }
    // “gần Bình Chánh”, “ở Long An”: 2 chữ viết hoa liền nhau ngay sau từ chỉ vị trí
    if (NEAR.test(w) && i + 2 < ws.length) {
      const a = clean(ws[i + 1].w);
      const b = clean(ws[i + 2].w);
      const tight = ws[i + 1].s - ws[i].e < 0.25 && ws[i + 2].s - ws[i + 1].e < 0.25 && !/[.,!?…:;]$/.test(ws[i].w + ws[i + 1].w);
      if (tight && /^\p{Lu}/u.test(a) && /^\p{Lu}/u.test(b)) return {s: ws[i].s, e: ws[i + 2].e, text: `${a} ${b}`, near: w};
    }
  }
  return null;
}
// “3 PHÒNG NGỦ” → “*3* phòng ngủ”; “52 M²” → “*52*m²”; “1 TRỆT 2 LẦU” → “*1* trệt *2* lầu”
// số đọc thành chữ (một… mười) — lời chép có lúc ghi chữ thay vì số
const NUMW = {mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10};
const numOf = (w) => (/^\d+$/.test(w) ? +w : NUMW[w] ?? null);
// thông số nói bằng chữ hoặc số: “một trệt hai lầu”, “3 phòng ngủ”, “hai toilet”, “4 tầng”, “mặt tiền 5 mét”
function spokenSpecs(ws) {
  const out = [];
  const T = ws.map((w) => plain(clean(w.w)));
  for (let i = 0; i < T.length; i++) {
    const n = numOf(T[i]);
    if (n === null || n > 20) continue;
    const a = T[i + 1] || '';
    const b = T[i + 2] || '';
    const n2 = numOf(b);
    const before = T.slice(Math.max(0, i - 3), i).join(' ');
    if (a === 'tret' && n2 !== null && /^(lau|tang)$/.test(T[i + 3] || '')) out.push({t: ws[i].s, icon: 'floors', text: `*${n}* trệt *${n2}* ${T[i + 3] === 'lau' ? 'lầu' : 'tầng'}`});
    else if (a === 'phong' && b === 'ngu') out.push({t: ws[i].s, icon: 'bed', text: `*${n}* phòng ngủ`});
    else if ((a === 'phong' && /^(tam|ve)$/.test(b)) || /^(toilet|wc|toi)$/.test(a)) out.push({t: ws[i].s, icon: 'bath', text: `*${n}* toilet`});
    else if (/^(tang|lau)$/.test(a) && T[i - 1] !== 'tret') out.push({t: ws[i].s, icon: 'floors', text: `*${n}* ${a === 'lau' ? 'lầu' : 'tầng'}`});
    else if (a === 'met' && b !== 'vuong' && /mat tien|ngang/.test(before)) out.push({t: ws[i].s, icon: 'ruler', text: `${/mat tien/.test(before) ? 'Mặt tiền' : 'Ngang'} *${n}*m`});
  }
  return out;
}
function specText(main) {
  let s = String(main).toLowerCase().replace(/\s*m²/, 'm²');
  s = s.replace(/(\d+(?:[.,]\d+)?)/g, '*$1*');
  return s.charAt(0) === '*' ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
function specIcon(main, lead) {
  if (/M²/.test(main)) return 'ruler';
  if (/PHÒNG NGỦ|PHÒNG/.test(main)) return /TẮM|WC|TOILET|VỆ SINH/.test(main) ? 'bath' : 'bed';
  if (/TOILET|WC|VỆ SINH|TẮM/.test(main)) return 'bath';
  if (/TRỆT|LẦU|TẦNG/.test(main)) return 'floors';
  if (/MÉT/.test(main)) return /đường|hẻm/.test(lead || '') ? 'road' : 'ruler';
  return 'check';
}

// ---------- KẾ HOẠCH ĐỒ HOẠ THEO NGÀNH ----------
// Trả về: gfx = đồ hoạ thêm vào làn Hình, drop = cụm chữ số liệu đã được thẻ thay (bỏ cụm chữ trùng ý — luật mg của skill),
// busy = khoảng giờ vùng trên khung đã có thẻ (chữ ý chính tránh), sfx = âm kèm, buy = có nút mua ở đoạn kết
export function industryPlan(p, rec, {nums = [], slots = [], D = 0, ctaLen = 4, hookEnd = 0, place = '', color = '#ffc61a', priceColor = '#ff2a2a', pack = null, steps = null, versus = null} = {}) {
  const ws = timelineWords(p);
  const mg = rec?.mg || {};
  const pg = pack?.gfx || {};
  const g = p.genre || 'chung';
  const gfx = [];
  const drop = new Set();
  const busy = [];
  const sfx = [];
  const end = D - ctaLen - 0.3;
  const free = (s, e) => s >= 0.3 && e <= end + 0.3 && !busy.some(([a, b]) => s < b + 0.15 && e > a - 0.15);
  const take = (s, e) => busy.push([s, e]);
  const badgeNear = (t) => {
    for (const [k, v] of BADGES[g] || []) if (findPhrase(ws, k, t - 6, t + 8)) return v;
    return '';
  };
  const lowerUnit = (s) => String(s).replace(/ TỶ$/, ' tỷ').replace(/ TRIỆU$/, ' triệu');

  // 1. giá cũ → giá mới (bán hàng): 2 giá cách nhau ≤ 6 s, giá sau có “còn / chỉ còn / giảm còn”
  const prices = nums.filter((t) => t.kind === 'price');
  if (mg.slash) {
    for (let i = 0; i + 1 < prices.length; i++) {
      const a = prices[i];
      const b = prices[i + 1];
      if (b.start - a.start > 6 || !/còn/.test(b.lead || '')) continue;
      const s = Math.max(0.3, a.start - 0.25);
      const e = Math.min(end, b.start + 2.6);
      if (e - s < 2.2 || !free(s, e)) continue;
      gfx.push({key: 'slash', start: s, dur: e - s, label: 'CHỈ CÒN', old: a.main, sub: b.main, color: priceColor});
      sfx.push(['swoosh', a.start + 0.35, 0.35], ['cash', b.start + 0.1, 0.45]);
      drop.add(a).add(b);
      take(s, e);
    }
  }
  // 2. bảng giá lăn số: dừng đúng lúc người nói nói con số
  if (mg.price) {
    for (const t of prices) {
      if (drop.has(t)) continue;
      const s = Math.max(0.3, t.start - 0.9);
      const e = Math.min(end, t.start + 2.8);
      if (e - s < 2.4 || !free(s, e)) continue;
      const pre = ws.filter((w) => w.s >= t.start - 3 && w.s < t.start).map((w) => plain(clean(w.w))).join(' ');
      const label = /tra truoc|thanh toan truoc/.test(pre) ? 'THANH TOÁN TRƯỚC' : /thue/.test(pre) ? 'GIÁ THUÊ' : /chi con|con co/.test(pre) ? 'CHỈ CÒN' : /giam/.test(pre) ? 'GIẢM CÒN' : g === 'bds' ? 'GIÁ BÁN' : 'GIÁ';
      if (pg.bignum) gfx.push({key: 'bignum', start: Math.max(0.3, t.start - 0.15), dur: Math.min(3, end - t.start), label: t.main, sub: label, x: 0.5, y: 0.15, color: priceColor});
      else gfx.push({key: 'price', start: s, dur: e - s, label, sub: lowerUnit(t.main), badge: badgeNear(t.start), land: +(t.start - s + 0.35).toFixed(2), color});
      sfx.push(['cash', t.start + 0.3, 0.45]);
      drop.add(t);
      take(s, e);
    }
  }
  const T = ws.map((w) => plain(clean(w.w)));
  // chỗ trống cho thẻ dài `len` quanh lúc nói `at`: thẻ trước còn hiện thì vào ngay sau nó (trễ tối đa `late` giây)
  const fit = (at, lead, len, minLen = 2, late = 1.5) => {
    let s = Math.max(0.3, at - lead);
    const prevEnd = Math.max(0, ...busy.filter(([a, b]) => a <= s + 0.15 && b > s - 0.15).map(([, b]) => b));
    if (prevEnd) {
      if (prevEnd + 0.15 > at + late) return null;
      s = prevEnd + 0.15;
    }
    const nextBusy = busy.map(([a]) => a).filter((a) => a > s).sort((u, v) => u - v)[0] ?? 1e9;
    const e = Math.min(end, s + len, nextBusy - 0.15);
    return e - s >= minLen && free(s, e) ? [s, e] : null;
  };
  // 10. các bước / danh sách người nói liệt kê (AI trả steps, đã kiểm nguyên văn) → bảng các bước / bảng tích / thẻ nguyên liệu / tiêu đề chương
  if (pg.steps && steps?.items?.length >= 2) {
    const its = steps.items.slice(0, 6);
    let kind = pg.steps;
    if (kind === 'ingredients' && steps.kind !== 'nguyenlieu') kind = 'chapter';
    if (steps.kind === 'nguyenlieu' && g === 'amthuc') kind = 'ingredients';
    if (kind === 'chapter') {
      its.forEach((x, i) => {
        const s = Math.max(0.3, x.start - 0.15);
        const e = Math.min(end, s + 2.4);
        if (e - s < 1.6 || !free(s, e)) return;
        gfx.push({key: 'chapter', start: s, dur: e - s, label: `BƯỚC ${i + 1}`, sub: x.text, x: 0.5, y: 0.2, color});
        sfx.push(['page', s, 0.35]);
        take(s, e);
      });
    } else {
      const s = Math.max(0.3, its[0].start - (kind === 'explain' ? 0.8 : 0.5));
      const e = Math.min(end, its[its.length - 1].start + 2.2, s + 12);
      if (e - s >= 2.5 && free(s, e)) {
        const items = its.filter((x) => x.start < e - 0.6).map((x) => ({text: x.text, t: +Math.max(0.35, x.start - s).toFixed(2)}));
        const base = {start: s, dur: e - s, items, color};
        if (kind === 'explain') gfx.push({...base, key: 'explain', label: steps.title || '', sub: '', x: 0.5, y: 0.43, color: '#2fe0c8'});
        else if (kind === 'ingredients') gfx.push({...base, key: 'ingredients', label: steps.title || 'Nguyên liệu', x: 0.06, y: 0.14});
        else gfx.push({...base, key: 'checklist', label: steps.title || '', x: 0.5, y: 0.62});
        items.forEach((x) => sfx.push(['pop', s + x.t, 0.35]));
        take(s, e);
      }
    }
  }
  // 2b. sơ đồ lô đất (trước thẻ thông số: lô đất đã nói diện tích thì thẻ thông số không lặp): “ngang 5 dài 16”, “5 nhân 16”, “5x16” (BĐS)
  if (pg.lot && g === 'bds') {
    let hit = null;
    for (let i = 0; i < T.length && !hit; i++) {
      const m = T[i].match(/^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/);
      if (m) hit = {i, w: m[1], l: m[2]};
      else if (numOf(T[i]) !== null && /^(x|nhan)$/.test(T[i + 1] || '') && numOf(T[i + 2] || '') !== null) hit = {i, w: String(numOf(T[i])), l: String(numOf(T[i + 2]))};
      else if (T[i] === 'ngang' && numOf(T[i + 1] || '') !== null) {
        for (let j = i + 2; j < Math.min(T.length - 1, i + 8); j++) if (/^(dai|sau)$/.test(T[j]) && numOf(T[j + 1]) !== null) hit = {i, w: String(numOf(T[i + 1])), l: String(numOf(T[j + 1]))};
      }
    }
    const wl = hit && +String(hit.w).replace(',', '.');
    const ll = hit && +String(hit.l).replace(',', '.');
    if (hit && wl > 0 && ll > 0 && wl <= 200 && ll <= 300) {
      const at = ws[hit.i].s;
      const area = nums.find((x) => /M²/.test(x.main) && Math.abs(x.start - at) < 8);
      const se = fit(at, 0.2, 3.4, 2.2);
      if (se) {
        const [s, e] = se;
        gfx.push({key: 'lot', start: s, dur: e - s, label: area ? 'DIỆN TÍCH' : 'KÍCH THƯỚC', w: wl, l: ll, area: area ? (area.main.match(/\d+(?:[.,]\d+)?/) || [''])[0] : '', x: 0.5, y: 0.2, size: 0.8, color});
        sfx.push(['whoosh', s, 0.3], ['pop', s + 0.9, 0.35]);
        if (area) drop.add(area);
        take(s, e);
      }
    }
  }
  // 3. tem giảm giá: “giảm 30%”
  if (mg.sale) {
    for (const t of nums.filter((x) => /%$/.test(x.main) && /giảm/.test(x.lead || ''))) {
      const s = Math.max(0.3, t.start - 0.1);
      const y = busy.some(([a, b]) => s < b && s + 3 > a) ? 0.42 : 0.32; // giá gạch ngang đang hiện → tem xuống dưới
      gfx.push({key: 'sale', start: s, dur: Math.min(3, end - s), label: '-' + t.main, sub: 'GIẢM', x: 0.78, y, color: priceColor});
      sfx.push(['impact', s, 0.3]);
      drop.add(t);
    }
  }
  // 4. thẻ thông số nhà (BĐS): diện tích, số phòng, kết cấu, mặt tiền + sổ hồng / hẻm xe hơi… mỗi dòng hiện đúng lúc nói
  if (mg.specs && g === 'bds') {
    // số liệu đã thành cụm chữ (diện tích m², …) + thông số đọc trong lời + sổ hồng / hẻm xe hơi…
    const facts = spokenSpecs(ws);
    for (const t of nums.filter((x) => !drop.has(x) && x.kind !== 'price' && !/%$/.test(x.main))) {
      const same = facts.find((f) => Math.abs(f.t - t.start) < 0.8);
      if (same) same.src = t;
      else if (/M²/.test(t.main)) facts.push({t: t.start, icon: 'ruler', text: specText(t.main), src: t});
    }
    for (const [k, icon, text] of TEXT_SPECS) {
      const f = findPhrase(ws, k);
      if (f && !facts.some((x) => Math.abs(x.t - f.s) < 0.5 || x.icon === icon)) facts.push({t: f.s, icon, text, key: true});
    }
    facts.sort((a, b) => a.t - b.t);
    const groups = [];
    for (const f of facts) {
      const last = groups[groups.length - 1];
      if (last && f.t - last[last.length - 1].t <= 3.5 && last.length < 4 && !busy.some(([a]) => a > last[last.length - 1].t && a < f.t)) last.push(f);
      else groups.push([f]);
    }
    for (const gr of groups) {
      if (gr.length < 2 && !gr[0].key) continue;
      let s = Math.max(0.3, gr[0].t - 0.3);
      // thẻ trước (bảng giá…) còn đang hiện → vào ngay sau nó, miễn là trước khi dòng đầu được nói
      const prevEnd = Math.max(0, ...busy.filter(([a, b]) => a < s && b + 0.15 > s).map(([, b]) => b));
      if (prevEnd && prevEnd + 0.15 <= gr[0].t + 0.6) s = prevEnd + 0.15;
      const lastT = gr[gr.length - 1].t;
      // kết thúc sớm hơn nếu thẻ sau (bảng giá…) sắp vào, nhưng dòng cuối phải đứng yên ≥ 1 s cho kịp đọc
      const nextBusy = busy.map(([a]) => a).filter((a) => a > s).sort((u, v) => u - v)[0] ?? 1e9;
      const e = Math.min(end, lastT + 2.4, nextBusy - 0.15);
      if (e < lastT + 0.8 || e - s < (gr.length > 1 ? 1.8 : 1.0) || !free(s, e)) continue;
      gfx.push({key: 'specs', start: s, dur: e - s, x: 0.06, y: 0.13, color, items: gr.map((f) => ({icon: f.icon, text: f.text, t: +Math.max(0, f.t - s).toFixed(2)}))});
      gr.forEach((f) => {
        sfx.push(['pop', f.t, 0.35]);
        if (f.src) drop.add(f.src);
      });
      take(s, e);
    }
  }
  // 5. ghim vị trí
  if ((mg.pin && (g === 'bds' || g === 'amthuc' || g === 'vlog')) || pg.place) {
    const f = findPlace(ws, place);
    if (f) {
      const s = Math.max(0.3, hookEnd + 0.1, f.s - 0.2);
      const nextBusy = busy.map(([a]) => a).filter((a) => a > s).sort((u, v) => u - v)[0] ?? 1e9;
      const e = Math.min(end, s + 3.3, nextBusy - 0.15);
      if (e - s >= 2.2 && free(s, e)) {
        const label = /gan|canh/.test(f.near || '') ? 'GẦN' : /ke ben/.test(f.near || '') ? 'KẾ BÊN' : 'VỊ TRÍ';
        const name = f.text.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
        if (pg.place) gfx.push({key: 'place', start: s, dur: e - s, label: name, sub: '', x: 0.5, y: 0.28});
        else gfx.push({key: 'pin', start: s, dur: e - s, label, sub: name, x: 0.5, y: 0.15, px: 0.5, py: 0.5, color});
        sfx.push(['thud', s + 0.3, 0.35]);
        take(s, e);
      }
    }
  }
  // 6. nhãn cảnh trên cảnh phụ (tên phòng / góc sản phẩm) — mỗi cảnh 1 lần, lúc đầu tiên xuất hiện
  if (mg.room) {
    const seen = new Set();
    for (const o of slots) {
      const src = o.c?.x || o.src;
      if (!src || seen.has(src.id)) continue;
      seen.add(src.id);
      const name = roomName(src);
      if (!name || o.e - o.s < 1.2) continue;
      // nhãn hiện khi cảnh phụ đã vào hẳn (chuyển cảnh êm 0,55 s), tắt trước khi cảnh hoà ra
      const s = o.s + 0.35;
      const d = Math.min(2.8, o.e - o.s - 0.45);
      if (d < 1) continue;
      if (gfx.some((x) => x.key === 'explain' && s < x.start + x.dur && s + d > x.start)) continue; // bảng các bước phủ cả khung
      // vùng trên đang có thẻ giá / thông số / vị trí → nhãn xuống phía dưới (trên phụ đề)
      const y = busy.some(([a, b]) => s < b && s + d > a) ? 0.6 : 0.09;
      gfx.push({key: 'room', start: +s.toFixed(2), dur: +d.toFixed(2), label: name.toUpperCase(), x: 0.06, y, color});
    }
  }

  // ---------- 7–15. ĐỒ HOẠ RIÊNG THEO PHONG CÁCH NGÀNH (gfx-pro.js) — chỉ từ lời người nói THẬT ----------
  // 7. khung REC mở đầu (“đang quay thật”)
  if (pg.rec && D > 7) {
    gfx.push({key: 'rec', start: 0, dur: Math.min(2.6, end - 0.5), color: '#ff3b3b'});
    sfx.push(['recbeep', 0.05, 0.3]);
  }
  // 8. tem ngày máy quay: ngày của file video chính (không đoán ngày)
  const ms = p.sources?.[p.main?.src]?.mtime;
  if (pg.date && ms && D > 6) {
    const d = new Date(ms);
    gfx.push({key: 'date', start: 0.3, dur: Math.min(3.2, end - 0.3), label: `${String(d.getDate()).padStart(2, '0')} ${String(d.getMonth() + 1).padStart(2, '0')} '${String(d.getFullYear()).slice(2)}`, x: 0.94, y: 0.945, color: '#ff9a3c'});
  }
  // 11. sai / đúng (AI trả versus, đã kiểm nguyên văn)
  if (pg.versus && versus?.sai && versus?.dung) {
    const se = fit(versus.start, 0.2, 4, 2.8);
    if (se) {
      const [s, e] = se;
      gfx.push({key: 'versus', start: s, dur: e - s, old: versus.sai, sub: versus.dung, t2: +Math.min(e - s - 1.5, Math.max(1, (versus.t2 || s + 1.2) - s)).toFixed(2), x: 0.5, y: 0.28, color: '#2ad46a'});
      sfx.push(['wrong', s + 0.1, 0.35], ['success', s + 1.3, 0.35]);
      take(s, e);
    }
  }
  // 12. vòng số liệu: “70%” (không phải % giảm giá)
  if (pg.stat) {
    for (const t of nums.filter((x) => /%$/.test(x.main) && !drop.has(x) && !/giảm/.test(x.lead || ''))) {
      const se = fit(t.start, 0.2, 2.8);
      if (!se) continue;
      const [s, e] = se;
      gfx.push({key: 'stat', start: s, dur: e - s, label: t.main, sub: String(t.lead || '').trim(), x: 0.5, y: 0.2, color});
      sfx.push(['riser', s, 0.3], ['ding', s + 0.9, 0.35]);
      drop.add(t);
      take(s, e);
    }
  }
  // 13. sao đánh giá: “4,9 sao”, “5 sao”
  if (pg.stars) {
    for (let i = 0; i + 1 < T.length; i++) {
      if (T[i + 1] !== 'sao') continue;
      const v = /^\d([.,]\d)?$/.test(T[i]) ? T[i] : numOf(T[i]) !== null && numOf(T[i]) <= 5 ? String(numOf(T[i])) : null;
      if (!v || +v.replace(',', '.') > 5) continue;
      const se = fit(ws[i].s, 0.2, 3);
      if (!se) continue;
      const [s, e] = se;
      gfx.push({key: 'stars', start: s, dur: e - s, label: v.replace('.', ','), sub: '', x: 0.5, y: 0.22, color: '#ffc61a'});
      sfx.push(['sparkle', s + 0.3, 0.3]);
      take(s, e);
      break;
    }
  }
  // 14. đồng hồ nấu: “hầm 15 phút”, “ướp ba mươi phút” (ẩm thực) — bên phải, không chặn vùng trên
  if (pg.timer) {
    let n = 0;
    for (let i = 0; i + 1 < T.length && n < 2; i++) {
      const v = numOf(T[i]);
      if (v === null || v > 240 || T[i + 1] !== 'phut') continue;
      const s = Math.max(0.3, ws[i].s - 0.1);
      if (s > end - 2) continue;
      gfx.push({key: 'timer', start: s, dur: Math.min(2.8, end - s), label: String(v), sub: 'PHÚT', x: 0.78, y: 0.36, color});
      sfx.push(['tick', s + 0.2, 0.35]);
      n++;
    }
  }
  // 15. tem đóng dấu theo chữ khen người nói thật sự nói (“ngon”, “đỉnh”, “hết sẩy”, “chốt đơn”…)
  if (pg.stamp) {
    const WORDS = g === 'banhang' ? ['chot don', 'gia soc', 'chinh hang', 'hot', 'sale'] : ['het say', 'tuyet voi', 'xuat sac', 'qua dinh', 'ngon', 'dinh', 'beo ngay'];
    let f = null;
    for (const k of WORDS) if ((f = findPhrase(ws, k, Math.max(3, hookEnd + 1), end - 2))) break;
    if (f) {
      gfx.push({key: 'stamp', start: f.s, dur: Math.min(2.2, end - f.s), label: f.text.toUpperCase(), x: 0.74, y: 0.34, color: priceColor});
      sfx.push(['stamp', f.s + 0.18, 0.45]);
    }
  }
  // 16. ẩm thực: tiếng xèo khi người nói “chiên / xào / rán / áp chảo” (âm thanh cho tai, không đồ hoạ)
  if (g === 'amthuc') {
    let n = 0;
    for (const k of ['chien', 'xao', 'ran', 'ap chao', 'nuong']) {
      const f = findPhrase(ws, k, 1, end);
      if (f && n < 2) {
        sfx.push(['sizzle', f.s, 0.3]);
        n++;
      }
    }
  }
  return {gfx, drop, busy, sfx, buy: !!mg.buy, social: !!pg.social, chip: !!pg.chip};
}
export const recipePack = (rec) => PACKS[rec?.pack] || null;
