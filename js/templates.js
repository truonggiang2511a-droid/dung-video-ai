// Thể loại video + khổ hình. Dùng chung MỘT bộ dựng (render.js); thể loại chỉ đổi lời gợi ý, icon, câu kết, cách AI dựng.
// Thêm thể loại mới: thêm 1 mục vào GENRES (và mô tả cho AI ở trường `ai`) — không phải sửa bộ vẽ.
// `edit` = nhịp dựng của bộ dựng chuyên nghiệp (ai.js localPlan): pace = giây giữa 2 lần đổi hình, cover = phần thân video phủ cảnh phụ,
// base/accent = chuyển cảnh giữa câu / đầu câu ('none' = cắt thẳng, xem TRANSITIONS trong render.js), punch = độ zoom giật che chỗ cắt.
// `look` = màu video AI tự chỉnh nhẹ theo thể loại (khách tự chỉnh thì AI không đổi).

export const GENRES = {
  chung: {
    short: 'Chung',
    label: 'Chung',
    desc: 'Mọi video nói trước máy quay',
    cta: 'THEO DÕI ĐỂ XEM THÊM',
    broll: 'Cảnh minh hoạ, sản phẩm, hậu trường…',
    icons: ['star', 'check', 'fire', 'bulb', 'heart', 'chat', 'thumb', 'clock'],
    ai: 'video ngắn nói trước máy quay (talking head) cho mạng xã hội Việt Nam',
    edit: {pace: 3.2, cover: 0.4, base: 'none', accent: 'fade', punch: 1.1},
    tags: ['Cận cảnh sản phẩm', 'Hậu trường', 'Màn hình', 'Ngoài trời', 'Văn phòng', 'Khách hàng'],
    look: null,
  },
  bds: {
    short: 'BĐS',
    label: 'Bất động sản',
    desc: 'Giới thiệu nhà, đất, dự án',
    cta: 'NHẮN TIN XEM NHÀ NGAY',
    broll: 'Phòng khách, bếp, mặt tiền…',
    icons: ['house', 'pin', 'ruler', 'tag', 'doc', 'school', 'sofa', 'car', 'tree', 'bed', 'key', 'star'],
    ai: 'video bất động sản cho môi giới Việt Nam (người dẫn đứng nói giới thiệu nhà/đất), số → vàng 3D, giá → đỏ kèm dòng ký tay',
    edit: {pace: 3.4, cover: 0.5, base: 'fade', accent: 'zoom', punch: 1.08},
    tags: ['Mặt tiền', 'Phòng khách', 'Phòng ngủ', 'Bếp', 'Nhà vệ sinh', 'Sân thượng', 'Ban công', 'Cầu thang', 'Hẻm trước nhà', 'Đường lớn', 'Sổ hồng', 'Tiện ích xung quanh'],
    look: {filter: 'bright', amt: 0.5, vignette: 0.15},
  },
  banhang: {
    short: 'Bán hàng',
    label: 'Bán hàng',
    desc: 'Giới thiệu sản phẩm, khuyến mãi',
    cta: 'NHẮN TIN ĐẶT HÀNG NGAY',
    broll: 'Cận cảnh sản phẩm, đóng gói, khách dùng…',
    icons: ['cart', 'tag', 'gift', 'fire', 'check', 'truck', 'star', 'heart'],
    ai: 'video bán hàng / review sản phẩm cho người bán online Việt Nam, nhấn giá, ưu đãi, công dụng (không hứa hẹn quá sự thật)',
    edit: {pace: 2.6, cover: 0.5, base: 'none', accent: 'whip', punch: 1.12},
    tags: ['Cận cảnh sản phẩm', 'Đóng gói', 'Khách dùng thử', 'Chi tiết', 'Giao hàng', 'Bảng giá', 'Trước sau'],
    look: {filter: 'vivid', amt: 0.45},
  },
  amthuc: {
    short: 'Ẩm thực',
    label: 'Ẩm thực',
    desc: 'Quán ăn, món ngon, công thức',
    cta: 'GHÉ QUÁN NGAY HÔM NAY',
    broll: 'Món ăn cận cảnh, bếp, không gian quán…',
    icons: ['food', 'fire', 'star', 'pin', 'clock', 'heart', 'coffee', 'tag'],
    ai: 'video ẩm thực (review quán, giới thiệu món, công thức nấu) cho mạng xã hội Việt Nam',
    edit: {pace: 3, cover: 0.5, base: 'fade', accent: 'zoom', punch: 1.1},
    tags: ['Món ăn cận cảnh', 'Bếp nấu', 'Không gian quán', 'Thực đơn', 'Khách ăn', 'Nguyên liệu', 'Đồ uống'],
    look: {filter: 'warm', amt: 0.5, vignette: 0.2},
  },
  kienthuc: {
    short: 'Kiến thức',
    label: 'Kiến thức',
    desc: 'Chia sẻ, hướng dẫn, mẹo hay',
    cta: 'LƯU LẠI ĐỂ XEM SAU',
    broll: 'Minh hoạ, màn hình, ví dụ thực tế…',
    icons: ['bulb', 'book', 'check', 'chart', 'clock', 'star', 'chat', 'thumb'],
    ai: 'video chia sẻ kiến thức / hướng dẫn / mẹo cho mạng xã hội Việt Nam, nhấn các bước, con số, ý chính',
    edit: {pace: 3.6, cover: 0.35, base: 'none', accent: 'wipe', punch: 1.1},
    tags: ['Màn hình', 'Minh hoạ', 'Ví dụ thực tế', 'Sách vở', 'Biểu đồ', 'Ghi chú'],
    look: null,
  },
  vlog: {
    short: 'Vlog',
    label: 'Vlog',
    desc: 'Đời sống, du lịch, cá nhân',
    cta: 'THEO DÕI MÌNH NHÉ',
    broll: 'Cảnh đi đường, phong cảnh, khoảnh khắc…',
    icons: ['heart', 'pin', 'camera', 'plane', 'coffee', 'star', 'fire', 'chat'],
    ai: 'vlog đời sống / du lịch cho mạng xã hội Việt Nam, nhịp nhanh, cảm xúc',
    edit: {pace: 2.6, cover: 0.55, base: 'none', accent: 'whip', punch: 1.12},
    tags: ['Đường phố', 'Phong cảnh', 'Đồ ăn', 'Bạn bè', 'Khách sạn', 'Xe cộ', 'Biển', 'Núi'],
    look: {filter: 'film', amt: 0.5, grain: 0.25, vignette: 0.25},
  },
};

export const FORMATS = {
  '9:16': {label: 'Dọc 9:16', note: 'TikTok, Reels, Shorts', w: 1080, h: 1920},
  '4:5': {label: 'Dọc 4:5', note: 'Bài đăng Facebook, Instagram', w: 1080, h: 1350},
  '1:1': {label: 'Vuông 1:1', note: 'Bài đăng, quảng cáo', w: 1080, h: 1080},
  '16:9': {label: 'Ngang 16:9', note: 'YouTube, máy tính', w: 1920, h: 1080},
};

export const genreOf = (p) => GENRES[p?.genre] || GENRES.chung;
export const formatOf = (p) => FORMATS[p?.format] || FORMATS['9:16'];

// Lựa chọn lần trước làm mặc định cho dự án mới
export function lastChoice() {
  try {
    return {genre: localStorage.getItem('dv.genre') || 'chung', format: localStorage.getItem('dv.format') || '9:16'};
  } catch (e) {
    return {genre: 'chung', format: '9:16'};
  }
}
export function rememberChoice(genre, format) {
  try {
    if (genre) localStorage.setItem('dv.genre', genre);
    if (format) localStorage.setItem('dv.format', format);
  } catch (e) {
    /* trình duyệt chặn lưu */
  }
}

// Dự án cũ (trước khi có thể loại): câu kết “xem nhà” → bất động sản
export function migrate(p) {
  if (!p.genre) p.genre = /XEM NHÀ/.test(p.cta?.text || '') ? 'bds' : 'chung';
  if (!p.format) p.format = '9:16';
  if (!p.stickers) p.stickers = [];
  if (!p.sfx) p.sfx = [];
  if (!p.look) p.look = {filter: 'none', amt: 0.6, vignette: 0, grain: 0};
  return p;
}
