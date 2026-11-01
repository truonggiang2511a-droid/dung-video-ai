// Kho font có dấu tiếng Việt: tải font khi cần (khi chữ dùng font đó / khi khách lướt bảng chọn font).
import {FONT_LIB} from './font-list.js';

export {FONT_LIB};
export const FONT_CATS = [...new Set(FONT_LIB.map((f) => f.cat))];
const loading = new Map();
export function ensureFont(key) {
  const f = FONT_LIB.find((x) => x.key === key);
  if (!f) return Promise.resolve(false);
  if (!loading.has(key))
    loading.set(
      key,
      (async () => {
        try {
          const ff = new FontFace(f.family, `url(${new URL('fonts/lib/' + f.file, document.baseURI).href})`, {weight: f.weight, style: 'normal'});
          await ff.load();
          document.fonts.add(ff);
          return true;
        } catch (e) {
          console.warn('Không tải được font', f.label, e);
          return false;
        }
      })(),
    );
  return loading.get(key);
}
// mọi font dự án đang dùng (chữ + mẫu chữ) — gọi trước khi xuất
export function ensureProjectFonts(p) {
  const keys = new Set((p.texts || []).map((t) => t.font).filter(Boolean));
  if (p.subs?.font) keys.add(p.subs.font);
  for (const g of p.stickers || []) if (g.kind === 'gfx' && g.font) keys.add(g.font);
  return Promise.all([...keys].map(ensureFont));
}
