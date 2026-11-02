// KHO MẠNG PIXABAY (2/11, Giang): tìm cảnh trám + ảnh minh hoạ, tải về máy khách rồi dùng như cảnh phụ.
// Key nằm ở máy chủ (Secret PIXABAY_KEY) — app chỉ gọi /api/stock và /api/stock-file (máy chủ tải hộ, chỉ nhận file *.pixabay.com).
// Luật Pixabay: kết quả lưu đệm 24 giờ (máy chủ + ở đây), ghi “nguồn Pixabay” chỗ hiện kết quả, ảnh phải tải về (không nhúng link),
// cấm tải hàng loạt tự động → AI chỉ lấy vài cảnh mỗi video.
import {importFile} from './media.js';

const DAY = 24 * 3600 * 1000;
const mem = new Map();
function cacheGet(k) {
  if (mem.has(k)) return mem.get(k);
  try {
    const j = JSON.parse(localStorage.getItem('dv.stock.' + k) || 'null');
    if (j && Date.now() - j.t < DAY) return j.v;
  } catch (e) {}
  return null;
}
function cachePut(k, v) {
  mem.set(k, v);
  try {
    localStorage.setItem('dv.stock.' + k, JSON.stringify({t: Date.now(), v}));
  } catch (e) {
    // đầy bộ nhớ: xoá các kết quả cũ
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('dv.stock.')) localStorage.removeItem(key);
    } catch (er) {}
  }
}

// type: 'video' | 'image'; orient theo khổ hình (ảnh): 'vertical' | 'horizontal' | ''
export async function stockSearch(q, type = 'video', orient = '') {
  q = String(q || '').trim().slice(0, 60);
  if (!q) return [];
  const k = `${type}|${orient}|${q.toLowerCase()}`;
  const hit = cacheGet(k);
  if (hit) return hit;
  if (inflight.has(k)) return inflight.get(k); // 2 chỗ cùng tìm 1 từ → chỉ 1 lượt gọi (giới hạn 100 lượt/phút cho cả app)
  const job = searchNow(q, type, orient, k);
  inflight.set(k, job);
  try {
    return await job;
  } finally {
    inflight.delete(k);
  }
}
const inflight = new Map();
async function searchNow(q, type, orient, k) {
  const r = await fetch(`api/stock?type=${type}&q=${encodeURIComponent(q)}${orient ? '&orient=' + orient : ''}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Kho Pixabay lỗi ' + r.status);
  cachePut(k, j.items || []);
  return j.items || [];
}

// Tải 1 kết quả về dự án (lưu IndexedDB như cảnh phụ khách tự thêm). q = từ đã tìm → làm nhãn cảnh để AI đặt đúng lúc nói.
const loading = new Map();
export async function stockImport(p, it, q = '', onMsg) {
  const have = Object.values(p.sources).find((s) => s.stockId === it.id);
  if (have) return have;
  const key = p.id + ':' + it.id;
  if (loading.has(key)) return loading.get(key);
  const job = (async () => {
    const r = await fetch('api/stock-file?u=' + encodeURIComponent(it.url));
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không tải được file Pixabay');
    const blob = await r.blob();
    const type = it.type === 'image' ? blob.type || 'image/jpeg' : blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
    const file = new File([blob], `Pixabay ${it.user || ''} ${it.id}.${it.type === 'image' ? 'jpg' : 'mp4'}`, {type});
    const tags = String(it.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
    return importFile(p, file, 'broll', onMsg, {stock: 'pixabay', stockId: it.id, page: it.page, author: it.user || '', tag: q || tags[0] || '', keywords: [...new Set([q, ...tags].filter(Boolean))].slice(0, 8), tagBy: 'stock'});
  })();
  loading.set(key, job);
  try {
    return await job;
  } finally {
    loading.delete(key);
  }
}

// Từ khoá AI muốn tìm, lọc theo luật BĐS: cảnh mạng KHÔNG được làm “căn nhà / phòng đang bán” (gây hiểu lầm cho người mua)
const BDS_BAN = /\b(nha|can ho|phong|bep|toilet|ve sinh|mat tien|noi that|house|home|apartment|room|kitchen|bedroom|bathroom|interior|villa|condo|living)\b/;
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export function stockAllowed(genre, q) {
  if (!q || q.length > 40) return false;
  if (genre === 'bds' && BDS_BAN.test(plain(q))) return false;
  if (genre === 'banhang' && /\b(san pham|product|hang hoa|goods|item)\b/.test(plain(q))) return false; // không giả sản phẩm đang bán
  return true;
}

// CÓ NÊN TRÁM KHÔNG (Giang chốt 2/11 15:05): không phải video nào cũng trám.
// - Review nhà BĐS / bán hàng / ẩm thực / vlog có cảnh quay thật → KHÔNG trám (khách muốn xem nhà / món / hàng thật).
//   Chỉ khi là video NGƯỜI NÓI (talking head, không có cảnh phụ nào) mới trám cảnh chung chung.
// - Kiến thức / chung: thường là người nói → trám khi ít cảnh phụ.
// Trả về số cảnh tối đa AI được lấy (0 = không trám); prefImage = ưu tiên ảnh minh hoạ (video kiến thức).
export function stockWant(p, D) {
  const own = Object.values(p.sources || {}).filter((s) => s.kind === 'broll' && !s.stock).length;
  const g = p.genre || 'chung';
  if (['bds', 'banhang', 'amthuc', 'vlog'].includes(g)) return {n: own ? 0 : Math.max(0, Math.min(3, Math.round(D / 15))), prefImage: false, talking: !own};
  return {n: Math.max(0, Math.min(4, Math.round(D / 12) - own * 2)), prefImage: g === 'kienthuc', talking: !own};
}
