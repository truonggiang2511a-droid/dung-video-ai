// CÔNG THỨC DỰNG theo ngành (2/11) — kiểu “skill” của HyperFrames: mỗi công thức = một cách dựng trọn vẹn khách bấm chọn
// (phong cách chữ/màu + đồ hoạ đặc trưng ngành + máy quay). Bố cục đồ hoạ chép từ bộ công cụ skill của Giang
// (batdongsan-editor / hook-video-30s / tron-video-aroll-broll / dung-video-da-the-loai: mg_price, mg_specs, mg_pin).
// Luật giữ nguyên: KHÔNG bịa số — mọi thẻ chỉ lấy chữ / số người nói THẬT SỰ nói ra; không số điện thoại trên hình.
import {timelineWords} from './render.js';
import {PACKS, packsFor} from './styles.js';
import {GENRES} from './templates.js';

export const SKILL_NAMES = {'batdongsan-editor': 'BĐS Editor', 'hook-video-30s': 'Hook 30s', 'tron-video-aroll-broll': 'Trộn A-roll B-roll', 'dung-video-da-the-loai': 'Dựng đa thể loại'};
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
function basicFor(g) {
  return packsFor(g).slice(0, 3).map((x) => ({key: `${g}-${x.key}`, genre: g, name: x.name, from: 'dung-video-da-the-loai', pack: x.key, cam: 'drift', desc: x.desc, mg: {room: true}}));
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
export function industryPlan(p, rec, {nums = [], slots = [], D = 0, ctaLen = 4, hookEnd = 0, place = '', color = '#ffc61a', priceColor = '#ff2a2a'} = {}) {
  const ws = timelineWords(p);
  const mg = rec?.mg || {};
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
      gfx.push({key: 'price', start: s, dur: e - s, label, sub: lowerUnit(t.main), badge: badgeNear(t.start), land: +(t.start - s + 0.35).toFixed(2), color});
      sfx.push(['cash', t.start + 0.3, 0.45]);
      drop.add(t);
      take(s, e);
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
  if (mg.pin && (g === 'bds' || g === 'amthuc' || g === 'vlog')) {
    const f = findPlace(ws, place);
    if (f) {
      const s = Math.max(0.3, hookEnd + 0.1, f.s - 0.2);
      const nextBusy = busy.map(([a]) => a).filter((a) => a > s).sort((u, v) => u - v)[0] ?? 1e9;
      const e = Math.min(end, s + 3.3, nextBusy - 0.15);
      if (e - s >= 2.2 && free(s, e)) {
        const label = /gan|canh/.test(f.near || '') ? 'GẦN' : /ke ben/.test(f.near || '') ? 'KẾ BÊN' : 'VỊ TRÍ';
        gfx.push({key: 'pin', start: s, dur: e - s, label, sub: f.text.replace(/^\p{Ll}/u, (c) => c.toUpperCase()), x: 0.5, y: 0.15, px: 0.5, py: 0.5, color});
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
      const s = o.s + 0.1;
      const d = Math.min(2.6, o.e - o.s - 0.15);
      // vùng trên đang có thẻ giá / thông số / vị trí → nhãn xuống phía dưới (trên phụ đề)
      const y = busy.some(([a, b]) => s < b && s + d > a) ? 0.6 : 0.09;
      gfx.push({key: 'room', start: +s.toFixed(2), dur: +d.toFixed(2), label: name.toUpperCase(), x: 0.06, y, color});
    }
  }
  return {gfx, drop, busy, sfx, buy: !!mg.buy};
}
export const recipePack = (rec) => PACKS[rec?.pack] || null;
