// BỘ PHONG CÁCH ("công thức dựng"): mỗi video giữ MỘT phong cách thống nhất (font, kiểu chữ, chuyển động, màu, phụ đề,
// chuyển cảnh, màu video, đồ hoạ), còn giữa các video thì đổi phong cách để video của khách không giống hệt nhau.
// AI (Claude) chọn theo nội dung trong danh sách hợp thể loại; không có AI thì xoay vòng. Khách chọn tay → p.packBy = 'user'.
// Mọi giá trị là khoá có sẵn trong render.js (TEXT_STYLES, TEXT_MOTIONS, TRANSITIONS, JUMP_TRANS, FILTERS, SUB_STYLES) và font kho (font-list.js).
//  font      = font chữ số liệu / giá / ý chính · keyStyle = kiểu chữ cho chữ ý chính (số liệu dùng `style`)
//  num/price = màu chữ số / giá · keys = bảng màu xoay vòng cho chữ ý chính · motions = chuyển động cho chữ ý chính
//  subs      = kiểu phụ đề (style, hl = màu nhấn, color, font) · trans = chuyển cảnh cảnh phụ (base giữa câu, accent đầu câu)
//  jump      = chuyển cảnh ở chỗ cắt video chính · look = màu video · gfx = đồ hoạ tự thêm (hook tiêu đề mở đầu, progress
//              thanh tiến độ, sparkle lấp lánh khi hiện giá, follow nút theo dõi ở đoạn kết, confetti pháo giấy cuối, leak vệt sáng)

export const PACKS = {
  mau1: {
    name: 'Mẫu 1 nổi bật', desc: 'Số vàng 3D, giá đỏ, phụ đề vàng — rõ ràng, dễ đọc',
    font: 'anton', style: '3d', keyStyle: '3d', num: '#ffc61a', price: '#ff2a2a', keys: ['#ffffff', '#ffc61a', '#2ad46a'],
    motions: ['pop', 'rise', 'spread'], subs: {style: 'karaoke', hl: '#ffd21f', color: '#ffffff', font: 'bvp'},
    trans: {base: 'fade', accent: 'zoom'}, jump: ['zoomin', 'flash'], look: {filter: 'bright', amt: 0.45, vignette: 0.12},
    gfx: {hook: 'band', sparkle: true, lot: true, steps: 'checklist'},
    genres: ['bds', 'chung'],
  },
  sangtrong: {
    name: 'Sang trọng', desc: 'Chữ có chân vàng ánh kim, chuyển cảnh mềm — nhà cao cấp, dự án',
    font: 'playfairdisplay900', style: 'gradient', keyStyle: 'shadow', num: '#f3d27a', price: '#f3d27a', keys: ['#f3d27a', '#ffffff'],
    motions: ['rise', 'spread', 'zoom'], subs: {style: 'clean', hl: '#f3d27a', color: '#ffffff', font: 'lora700'},
    trans: {base: 'fade', accent: 'zoomout'}, jump: ['zoomin'], look: {filter: 'film', amt: 0.4, vignette: 0.3},
    gfx: {hook: 'line', leak: true, lot: true, steps: 'chapter'},
    genres: ['bds'],
  },
  nangdong: {
    name: 'Năng động', desc: 'Hộp màu, lia nhanh, thanh tiến độ — bán hàng, review',
    font: 'montserrat900', style: 'box', keyStyle: 'box', num: '#ffc61a', price: '#ff2a2a', keys: ['#2ad46a', '#2f8cff', '#ffc61a'],
    motions: ['slide', 'pop', 'bounce'], subs: {style: 'box', hl: '#ff2a2a', color: '#ffffff', font: 'montserrat900'},
    trans: {base: 'none', accent: 'whip'}, jump: ['whip', 'zoomin', 'flash'], look: {filter: 'vivid', amt: 0.45},
    gfx: {hook: 'box', progress: true, sparkle: true, stars: true, steps: 'checklist'},
    genres: ['banhang', 'chung'],
  },
  salesoc: {
    name: 'Sale sốc', desc: 'Chữ viền dày đóng dấu, nhiễu, loé sáng — khuyến mãi, xả hàng',
    font: 'bangers400', style: 'stroke2', keyStyle: 'tape', num: '#ffe600', price: '#ff2a2a', keys: ['#ffe600', '#ff2a2a', '#ffffff'],
    motions: ['stamp', 'glitch', 'bounce'], subs: {style: 'pop', hl: '#ffe600', color: '#ffffff', font: 'anton'},
    trans: {base: 'flash', accent: 'glitch'}, jump: ['flash', 'shake', 'glitch'], look: {filter: 'vivid', amt: 0.6},
    gfx: {hook: 'burst', sparkle: true, confetti: true, stars: true, stamp: 'SỐC'},
    genres: ['banhang'],
  },
  toigian: {
    name: 'Tối giản', desc: 'Chữ phẳng trắng, phụ đề gọn, cắt thẳng — chuyên gia, tư vấn',
    font: 'inter900', style: 'flat', keyStyle: 'highlight', num: '#ffffff', price: '#ffffff', keys: ['#2f8cff', '#ffffff'],
    motions: ['rise', 'slide'], subs: {style: 'clean', hl: '#ffffff', color: '#ffffff', font: 'inter900'},
    trans: {base: 'none', accent: 'fade'}, jump: ['zoomin'], look: {filter: 'none', amt: 0},
    gfx: {hook: 'line', progress: true, steps: 'checklist', stat: true, versus: true},
    genres: ['chung', 'kienthuc'],
  },
  neon: {
    name: 'Neon đêm', desc: 'Chữ phát sáng xanh hồng, nhiễu — công nghệ, giới trẻ, quán đêm',
    font: 'unbounded800', style: 'neon', keyStyle: 'neon', num: '#2fd2ff', price: '#ff5fb8', keys: ['#2fd2ff', '#ff5fb8', '#b6ff3b'],
    motions: ['glitch', 'zoom', 'type'], subs: {style: 'karaoke', hl: '#2fd2ff', color: '#ffffff', font: 'spacegrotesk700'},
    trans: {base: 'glitch', accent: 'zoom'}, jump: ['glitch', 'shake'], look: {filter: 'moody', amt: 0.5, vignette: 0.3},
    gfx: {hook: 'box', progress: true, place: true},
    genres: ['vlog', 'chung'],
  },
  amap: {
    name: 'Ấm áp viết tay', desc: 'Chữ viết tay, màu cam ấm — món ngon, đời sống',
    font: 'pacifico400', style: 'shadow', keyStyle: 'shadow', num: '#ffb03a', price: '#ff5a36', keys: ['#ffb03a', '#ffffff', '#ff8fb1'],
    motions: ['pop', 'wave', 'bounce'], subs: {style: 'pop', hl: '#ffb03a', color: '#ffffff', font: 'baloo2800'},
    trans: {base: 'fade', accent: 'zoom'}, jump: ['zoomin', 'flash'], look: {filter: 'warm', amt: 0.55, vignette: 0.2},
    gfx: {hook: 'line', sparkle: true, follow: true, steps: 'ingredients', timer: true, stamp: 'NGON'},
    genres: ['amthuc'],
  },
  duongpho: {
    name: 'Đường phố', desc: 'Băng keo màu, chữ to, lia nhanh — ăn vặt, quán xá, trend',
    font: 'bungee400', style: 'tape', keyStyle: 'tape', num: '#ffc61a', price: '#ff2a2a', keys: ['#ff8a1f', '#ffc61a', '#2ad46a'],
    motions: ['slide', 'stamp', 'bounce'], subs: {style: 'box', hl: '#ff8a1f', color: '#ffffff', font: 'anton'},
    trans: {base: 'none', accent: 'whip'}, jump: ['whip', 'shake', 'zoomin'], look: {filter: 'vivid', amt: 0.5},
    gfx: {hook: 'burst', sparkle: true, follow: true, steps: 'ingredients', timer: true, stamp: 'ĐỈNH', stars: true},
    genres: ['amthuc'],
  },
  kienthuc: {
    name: 'Kiến thức gọn', desc: 'Gạch chân màu, thanh tiến độ — mẹo, hướng dẫn, chia sẻ',
    font: 'lexend800', style: 'highlight', keyStyle: 'highlight', num: '#ffc61a', price: '#ff5a36', keys: ['#ffc61a', '#2ad46a', '#5fd3ff'],
    motions: ['slide', 'type', 'rise'], subs: {style: 'karaoke', hl: '#ffc61a', color: '#ffffff', font: 'lexend800'},
    trans: {base: 'none', accent: 'wipe'}, jump: ['zoomin'], look: {filter: 'none', amt: 0},
    gfx: {hook: 'box', progress: true, social: true, steps: 'chapter', stat: true, versus: true},
    genres: ['kienthuc', 'chung'],
  },
  tintuc: {
    name: 'Tin nhanh', desc: 'Hộp đỏ chữ trắng kiểu bản tin, trượt ngang — cập nhật thị trường',
    font: 'robotocondensed800', style: 'box', keyStyle: 'box', num: '#ff2a2a', price: '#ff2a2a', keys: ['#ff2a2a', '#1f2937'],
    motions: ['slide', 'spread'], subs: {style: 'clean', hl: '#ffffff', color: '#ffffff', font: 'robotocondensed800'},
    trans: {base: 'slide', accent: 'wipe'}, jump: ['zoomin', 'whip'], look: {filter: 'cool', amt: 0.35},
    gfx: {hook: 'band', progress: true, steps: 'chapter', stat: true},
    genres: ['bds', 'kienthuc'],
  },
  phim: {
    name: 'Điện ảnh', desc: 'Chữ viền mảnh, viền đen trên dưới, hạt phim — vlog, du lịch, kể chuyện',
    font: 'barlowcondensed800', style: 'outline', keyStyle: 'outline', num: '#ffffff', price: '#ffc61a', keys: ['#ffffff', '#ffc61a'],
    motions: ['spread', 'rise', 'zoom'], subs: {style: 'clean', hl: '#ffffff', color: '#ffffff', font: 'barlowcondensed800'},
    trans: {base: 'fade', accent: 'whip'}, jump: ['whip', 'shake'], look: {filter: 'film', amt: 0.55, grain: 0.3, vignette: 0.3, bars: true},
    gfx: {hook: 'line', leak: true, place: true, date: true},
    genres: ['vlog'],
  },
  dethuong: {
    name: 'Dễ thương', desc: 'Bong bóng chat, màu pastel, nảy nảy — mẹ bé, mỹ phẩm, đồ xinh',
    font: 'baloo2800', style: 'bubble', keyStyle: 'bubble', num: '#ff8fb1', price: '#ff5a8a', keys: ['#ff8fb1', '#7fc8ff', '#ffd36b'],
    motions: ['bounce', 'pop', 'wave'], subs: {style: 'pop', hl: '#ff8fb1', color: '#ffffff', font: 'baloo2800'},
    trans: {base: 'zoom', accent: 'circle'}, jump: ['zoomin'], look: {filter: 'bright', amt: 0.5},
    gfx: {hook: 'bubble', sparkle: true, confetti: true, follow: true, stars: true, stamp: 'XINH'},
    genres: ['banhang'],
  },
  congnghe: {
    name: 'Công nghệ', desc: 'Chữ mảnh xanh lạnh, quét nhiễu — đồ điện tử, phần mềm, số liệu',
    font: 'chakrapetch700', style: 'outline', keyStyle: 'neon', num: '#5fd3ff', price: '#b6ff3b', keys: ['#5fd3ff', '#b6ff3b', '#ffffff'],
    motions: ['type', 'glitch', 'slide'], subs: {style: 'karaoke', hl: '#5fd3ff', color: '#ffffff', font: 'chakrapetch700'},
    trans: {base: 'slide', accent: 'glitch'}, jump: ['glitch', 'zoomin'], look: {filter: 'cool', amt: 0.5, vignette: 0.2},
    gfx: {hook: 'box', progress: true, steps: 'explain', stat: true, versus: true},
    genres: ['kienthuc', 'chung'],
  },
  manhme: {
    name: 'Mạnh mẽ', desc: 'Chữ cao đậm viền dày, rung, loé — thể thao, động lực, sửa xe',
    font: 'bigshouldersdispla900', style: 'stroke2', keyStyle: '3d', num: '#ffc61a', price: '#ff2a2a', keys: ['#ffc61a', '#ffffff', '#ff2a2a'],
    motions: ['stamp', 'zoom', 'pop'], subs: {style: 'karaoke', hl: '#ffc61a', color: '#ffffff', font: 'anton'},
    trans: {base: 'flash', accent: 'whip'}, jump: ['shake', 'whip', 'flash'], look: {filter: 'vivid', amt: 0.5, vignette: 0.25},
    gfx: {hook: 'burst', progress: true, place: true},
    genres: ['vlog', 'chung'],
  },
  caocap: {
    name: 'Cao cấp tối', desc: 'Nền trầm, chữ vàng chuyển sắc, phụ đề tối giản — dịch vụ cao cấp',
    font: 'bevietnampro900', style: 'gradient', keyStyle: 'gradient', num: '#f3d27a', price: '#f3d27a', keys: ['#f3d27a', '#ffffff'],
    motions: ['rise', 'spread'], subs: {style: 'clean', hl: '#f3d27a', color: '#ffffff', font: 'bevietnampro900'},
    trans: {base: 'fade', accent: 'zoomout'}, jump: ['zoomin'], look: {filter: 'moody', amt: 0.45, vignette: 0.35},
    gfx: {hook: 'line', leak: true, stars: true},
    genres: ['banhang'],
  },
  // ---- 2/11 chiều: phong cách RIÊNG từng ngành (mỗi ngành có bộ đồ hoạ, nhịp dựng, chữ, màu khác hẳn ngành khác) ----
  //  edit = nhịp dựng riêng (ghi đè nhịp thể loại): pace giây/lần đổi hình, cover phần phủ cảnh phụ, punch độ zoom giật
  //  gfx mở rộng: rec khung REC mở đầu · chip chữ ý chính thành nhãn kính cạnh vai · bignum giá thành số to trên đầu ·
  //  steps (explain/checklist/chapter/ingredients) cách hiện các bước · lot sơ đồ lô đất · social Đăng ký·Thích·Chia sẻ cuối ·
  //  timer đồng hồ nấu · stamp tem đóng dấu (chữ mặc định) · stat vòng % · versus sai/đúng · stars sao đánh giá · place tên địa điểm · date tem ngày
  chuyengia: {
    name: 'Chuyên gia BĐS', desc: 'Khung REC, nhãn kính cạnh vai, số to trên đầu, bảng các bước, nút Đăng ký — môi giới, chuyên gia nói',
    font: 'anton', style: '3d', keyStyle: '3d', num: '#ffc61a', price: '#ff3b3b', keys: ['#ffc61a', '#2f8cff', '#ff5fb8', '#2ad46a', '#9a6bff'],
    motions: ['pop', 'rise'], subs: {style: 'pop', hl: '#ffffff', color: '#ffffff', font: 'bvp', y: 0.6},
    trans: {base: 'none', accent: 'zoom'}, jump: ['zoomin'], look: {filter: 'bright', amt: 0.3, vignette: 0.1},
    gfx: {hook: 'line', rec: true, chip: true, bignum: true, steps: 'explain', social: true, lot: true},
    edit: {pace: 4.2, cover: 0.3, punch: 1.1},
    genres: ['bds'],
  },
  livestream: {
    name: 'Live chốt đơn', desc: 'Hộp đỏ vàng, sao đánh giá, tem CHỐT, loé sáng liên tục — bán hàng nhanh, livestream',
    font: 'bevietnampro900', style: 'box', keyStyle: 'stroke2', num: '#ffe600', price: '#ff2a2a', keys: ['#ffe600', '#ff2a2a', '#ffffff'],
    motions: ['stamp', 'bounce', 'pop'], subs: {style: 'box', hl: '#ffe600', color: '#ffffff', font: 'bevietnampro900'},
    trans: {base: 'flash', accent: 'zoom'}, jump: ['flash', 'zoomin', 'shake'], look: {filter: 'vivid', amt: 0.55},
    gfx: {hook: 'burst', sparkle: true, confetti: true, stars: true, stamp: 'CHỐT', steps: 'checklist'},
    edit: {pace: 2.0, cover: 0.6, punch: 1.15},
    genres: ['banhang'],
  },
  bepnha: {
    name: 'Bếp nhà', desc: 'Thẻ nguyên liệu giấy, đồng hồ nấu, tem NGON, chữ viết tay ấm — công thức, nấu ăn tại nhà',
    font: 'sriracha400', style: 'shadow', keyStyle: 'tape', num: '#ff8a1f', price: '#e8261a', keys: ['#ff8a1f', '#ffffff', '#7bd88f'],
    motions: ['pop', 'wave', 'rise'], subs: {style: 'pop', hl: '#ffb03a', color: '#ffffff', font: 'mali700'},
    trans: {base: 'fade', accent: 'zoom'}, jump: ['zoomin'], look: {filter: 'warm', amt: 0.6, vignette: 0.25, grain: 0.12},
    gfx: {hook: 'line', steps: 'ingredients', timer: true, stamp: 'NGON', follow: true},
    edit: {pace: 2.8, cover: 0.6, punch: 1.1},
    genres: ['amthuc'],
  },
  bangtrang: {
    name: 'Bảng trắng', desc: 'Bảng các bước, vòng số liệu, sai/đúng, nhãn cạnh vai — giải thích, dạy học, tài chính',
    font: 'itim400', style: 'highlight', keyStyle: 'highlight', num: '#ff8a1f', price: '#ff3b3b', keys: ['#2f8cff', '#ff5fb8', '#2ad46a'],
    motions: ['type', 'slide'], subs: {style: 'clean', hl: '#ffd21f', color: '#ffffff', font: 'lexend800'},
    trans: {base: 'none', accent: 'wipe'}, jump: ['zoomin'], look: {filter: 'bright', amt: 0.25},
    gfx: {hook: 'box', progress: true, steps: 'explain', stat: true, versus: true, chip: true, social: true},
    edit: {pace: 4.0, cover: 0.3, punch: 1.12},
    genres: ['kienthuc'],
  },
  nhatky: {
    name: 'Nhật ký du lịch', desc: 'Tên địa điểm chữ giãn, tem ngày máy quay, khung REC, hạt phim, vệt sáng — vlog, du lịch',
    font: 'dancingscript700', style: 'shadow', keyStyle: 'flat', num: '#ffd36b', price: '#ffd36b', keys: ['#ffffff', '#ffd36b', '#ff8fb1'],
    motions: ['rise', 'spread', 'wave'], subs: {style: 'clean', hl: '#ffd36b', color: '#ffffff', font: 'quicksand700'},
    trans: {base: 'fade', accent: 'whip'}, jump: ['whip', 'zoomin'], look: {filter: 'film', amt: 0.5, grain: 0.3, leak: 0.3, vignette: 0.2},
    gfx: {hook: 'line', place: true, date: true, rec: true, leak: true, social: true},
    edit: {pace: 2.6, cover: 0.6, punch: 1.1},
    genres: ['vlog'],
  },
};
for (const [k, v] of Object.entries(PACKS)) v.key = k;

export const packsFor = (genre) => Object.values(PACKS).filter((x) => x.genres.includes(genre || 'chung'));
export const packOf = (p) => PACKS[p.pack] || null;

// Không có AI: xoay vòng phong cách hợp thể loại qua từng lần dựng (nhớ trên máy) để video sau khác video trước
export function rotatePack(genre) {
  const list = packsFor(genre);
  let n = 0;
  try {
    n = +(localStorage.getItem('dv.packN.' + genre) || 0);
    localStorage.setItem('dv.packN.' + genre, String(n + 1));
  } catch (e) {}
  return list[n % list.length]?.key || 'mau1';
}

// Màu chữ theo phong cách: giá / số / ý chính (xoay vòng)
export function packText(pack, t, i) {
  const out = {font: pack.font};
  if (t.kind === 'price') Object.assign(out, {color: pack.price, style: pack.style, motion: 'stamp'});
  else if (t.kind === 'key') Object.assign(out, {color: pack.keys[i % pack.keys.length], style: pack.keyStyle, motion: pack.motions[i % pack.motions.length]});
  else Object.assign(out, {color: pack.num, style: pack.style});
  return out;
}

// Áp phong cách cho dự án ĐÃ dựng (khách bấm đổi phong cách): chữ / chuyển cảnh / phụ đề / màu video / đồ hoạ do AI làm;
// chỗ khách đã sửa tay (locked) giữ nguyên, màu video khách tự chỉnh giữ nguyên
export function restyle(p, key, by = 'user') {
  const pack = PACKS[key];
  if (!pack) return;
  p.pack = key;
  p.packBy = by;
  let ki = 0;
  for (const t of p.texts || []) {
    if (t.locked) continue;
    const s = packText(pack, t, t.kind === 'key' ? ki++ : 0);
    if (t.kind !== 'key' && t.kind !== 'price') delete s.motion;
    Object.assign(t, s);
  }
  let bi = 0;
  for (const b of p.broll || []) if (!b.locked) b.trans = bi++ % 3 === 0 ? pack.trans.accent : pack.trans.base;
  let ji = 0;
  for (const s of p.main?.segs || []) if (s.tr) s.tr = pack.jump[ji++ % pack.jump.length];
  if (p.subs && p.subs.by !== 'user') Object.assign(p.subs, pack.subs);
  if (p.look?.by !== 'user') p.look = {filter: 'none', amt: 0.6, vignette: 0, grain: 0, leak: 0, bars: false, ...pack.look, by: 'ai'};
  for (const g of p.stickers || []) if (g.kind === 'gfx' && !g.locked) Object.assign(g, gfxStyle(pack, g.key));
}

// Màu / font / kiểu cho đồ hoạ theo phong cách
export function gfxStyle(pack, key) {
  const c = key === 'hook' ? (pack.keys[0] === '#ffffff' ? pack.num : pack.keys[0]) : key === 'slash' || key === 'sale' || key === 'stamp' || key === 'rec' ? pack.price : key === 'chip' || key === 'checklist' || key === 'versus' ? pack.keys[1] || pack.num : pack.num;
  return {font: pack.font, color: c, variant: key === 'hook' ? pack.gfx.hook || 'band' : undefined};
}
