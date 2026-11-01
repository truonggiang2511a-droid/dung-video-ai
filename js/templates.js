// Thể loại video + khổ hình. Dùng chung MỘT bộ dựng (render.js); thể loại chỉ đổi lời gợi ý, icon, câu kết, cách AI dựng.
// Thêm thể loại mới: thêm 1 mục vào GENRES (và mô tả cho AI ở trường `ai`) — không phải sửa bộ vẽ.

export const GENRES = {
  chung: {
    short: 'Chung',
    label: 'Chung',
    desc: 'Mọi video nói trước máy quay',
    cta: 'THEO DÕI ĐỂ XEM THÊM',
    broll: 'Cảnh minh hoạ, sản phẩm, hậu trường…',
    icons: ['star', 'check', 'fire', 'bulb', 'heart', 'chat', 'thumb', 'clock'],
    ai: 'video ngắn nói trước máy quay (talking head) cho mạng xã hội Việt Nam',
  },
  bds: {
    short: 'BĐS',
    label: 'Bất động sản',
    desc: 'Giới thiệu nhà, đất, dự án',
    cta: 'NHẮN TIN XEM NHÀ NGAY',
    broll: 'Phòng khách, bếp, mặt tiền…',
    icons: ['house', 'pin', 'ruler', 'tag', 'doc', 'school', 'sofa', 'car', 'tree', 'bed', 'key', 'star'],
    ai: 'video bất động sản cho môi giới Việt Nam (người dẫn đứng nói giới thiệu nhà/đất), số → vàng 3D, giá → đỏ kèm dòng ký tay',
  },
  banhang: {
    short: 'Bán hàng',
    label: 'Bán hàng',
    desc: 'Giới thiệu sản phẩm, khuyến mãi',
    cta: 'NHẮN TIN ĐẶT HÀNG NGAY',
    broll: 'Cận cảnh sản phẩm, đóng gói, khách dùng…',
    icons: ['cart', 'tag', 'gift', 'fire', 'check', 'truck', 'star', 'heart'],
    ai: 'video bán hàng / review sản phẩm cho người bán online Việt Nam, nhấn giá, ưu đãi, công dụng (không hứa hẹn quá sự thật)',
  },
  amthuc: {
    short: 'Ẩm thực',
    label: 'Ẩm thực',
    desc: 'Quán ăn, món ngon, công thức',
    cta: 'GHÉ QUÁN NGAY HÔM NAY',
    broll: 'Món ăn cận cảnh, bếp, không gian quán…',
    icons: ['food', 'fire', 'star', 'pin', 'clock', 'heart', 'coffee', 'tag'],
    ai: 'video ẩm thực (review quán, giới thiệu món, công thức nấu) cho mạng xã hội Việt Nam',
  },
  kienthuc: {
    short: 'Kiến thức',
    label: 'Kiến thức',
    desc: 'Chia sẻ, hướng dẫn, mẹo hay',
    cta: 'LƯU LẠI ĐỂ XEM SAU',
    broll: 'Minh hoạ, màn hình, ví dụ thực tế…',
    icons: ['bulb', 'book', 'check', 'chart', 'clock', 'star', 'chat', 'thumb'],
    ai: 'video chia sẻ kiến thức / hướng dẫn / mẹo cho mạng xã hội Việt Nam, nhấn các bước, con số, ý chính',
  },
  vlog: {
    short: 'Vlog',
    label: 'Vlog',
    desc: 'Đời sống, du lịch, cá nhân',
    cta: 'THEO DÕI MÌNH NHÉ',
    broll: 'Cảnh đi đường, phong cảnh, khoảnh khắc…',
    icons: ['heart', 'pin', 'camera', 'plane', 'coffee', 'star', 'fire', 'chat'],
    ai: 'vlog đời sống / du lịch cho mạng xã hội Việt Nam, nhịp nhanh, cảm xúc',
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
  return p;
}
