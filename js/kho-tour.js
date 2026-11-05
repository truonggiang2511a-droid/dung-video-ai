// AI vào KHO lấy tài nguyên như người dựng thật + TỰ KIỂM (chạy ngầm) rồi tự đổi mẫu khi không đẹp (Giang chốt 2/11 12:09).
// 1) reviewPlan: dựng thử từng chữ trên khung nháp (không tốn tiền, không gọi máy chủ) → chữ tràn khung / chồng thẻ /
//    chìm trên nền (đo độ sáng nền bằng ảnh nhỏ timeline) / hình gắn chữ đè thứ khác → sửa ngay trong kế hoạch, ghi lý do.
// 2) kitTour: con trỏ mở Kho (Phong cách → Hiệu ứng → Chữ mẫu → Emoji động/Icon (gõ tìm) → Âm thanh), kéo ra đúng chỗ trên
//    khung hình, chú thích VÌ SAO chọn; rồi diễn lại các chỗ tự kiểm (“thử mẫu này → chìm nền → đổi kiểu viền”).
import {drawFrame, W, H, FONTS, FILTERS, TEXT_PRESETS, GFX_MAP, companionPos, srcAt} from './render.js';
import {applyOp, find} from './model.js';
import {PACKS} from './styles.js';
import {genreOf} from './templates.js';
import {SFX_MAP} from './sfx.js';
import {loadIndex} from './library.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const WEAK = new Set(['3d', 'flat', 'neon', 'gradient']);
const DECOR = new Set(['progress', 'sparkle', 'leak', 'confetti']); // đồ hoạ trang trí mỏng / trong suốt — chồng lên không sao // kiểu chữ không có viền / nền khối → dễ chìm trên nền cùng độ sáng

// ---------- đo nền dưới chữ bằng ảnh nhỏ timeline (14 ảnh / video chính, 1 ảnh / cảnh phụ) ----------
const imgCache = new Map();
function loadImg(url) {
  if (!imgCache.has(url))
    imgCache.set(
      url,
      new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = url;
      }),
    );
  return imgCache.get(url);
}
const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
function lumHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
async function bgLum(p, T, box) {
  let url = null;
  const b = (p.broll || []).find((x) => T >= x.start && T < x.start + x.dur);
  if (b) url = p.sources[b.src]?.thumbs?.[0];
  else if (p.main) {
    const src = p.sources[p.main.src];
    const at = srcAt(p, T);
    const n = src?.thumbs?.length || 0;
    if (n && at) url = src.thumbs[clamp(Math.round((at.t / (src.duration || 1)) * n - 0.5), 0, n - 1)];
  }
  if (!url) return null;
  const im = await loadImg(url);
  if (!im || !im.width) return null;
  const c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const g = c.getContext('2d', {willReadFrequently: true});
  g.drawImage(im, 0, 0);
  // ảnh phủ kín khung (cover)
  const s = Math.max(W / im.width, H / im.height);
  const ox = (W - im.width * s) / 2;
  const oy = (H - im.height * s) / 2;
  const x0 = clamp(Math.floor((box.x - ox) / s), 0, im.width - 1);
  const y0 = clamp(Math.floor((box.y - oy) / s), 0, im.height - 1);
  const x1 = clamp(Math.ceil((box.x + box.w - ox) / s), x0 + 1, im.width);
  const y1 = clamp(Math.ceil((box.y + box.h - oy) / s), y0 + 1, im.height);
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
  return sum / (d.length / 4);
}
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hit = (a, b) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
};
const LABEL = {price: 'bảng giá', specs: 'thẻ thông số', pin: 'ghim vị trí', slash: 'giá gạch ngang', sale: 'tem giảm giá', hook: 'tiêu đề mở đầu', buy: 'nút mua', follow: 'nút theo dõi', room: 'nhãn cảnh'};

// ---------- 1) TỰ KIỂM kế hoạch dựng ----------
// Trả về danh sách sửa {id, T, x, y, say, before, after} — đã áp “after” vào kế hoạch; tour diễn lại before → after.
export async function reviewPlan(p, ops) {
  const fixes = [];
  const clone = JSON.parse(JSON.stringify(p));
  for (const o of ops) {
    try {
      applyOp(clone, JSON.parse(JSON.stringify(o)));
    } catch (e) {}
  }
  const cv = document.createElement('canvas');
  cv.width = 270;
  cv.height = Math.round((270 * H) / W);
  const g = cv.getContext('2d');
  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  const boxesAt = (T) => drawFrame(g, clone, T, {main: null, broll: {}}, {placeholder: true}) || [];
  const texts = ops.filter((o) => o.op === 'add' && o.list === 'texts').map((o) => o.item);
  for (const t of texts.slice(0, 14)) {
    const ct = clone.texts.find((x) => x.id === t.id);
    if (!ct) continue;
    const T = t.start + Math.min(1.1, t.dur * 0.55);
    let bx = boxesAt(T);
    let tb = bx.find((b) => b.id === t.id);
    if (!tb) continue;
    const before = {size: t.size, y: t.y, style: t.style};
    const notes = [];
    // a) tràn khung → thu nhỏ
    if (tb.x < 8 || tb.x + tb.w > W - 8) {
      const k = clamp(((W - 40) / tb.w) * 0.97, 0.5, 1);
      t.size = ct.size = +((t.size || 1) * k).toFixed(2);
      notes.push(`chữ dài tràn mép khung → thu còn ${Math.round(t.size * 100)}%`);
      bx = boxesAt(T);
      tb = bx.find((b) => b.id === t.id) || tb;
    }
    // b) chồng lên thẻ / đồ hoạ khác → dời chỗ trống gần nhất (tránh vùng mặt ~0,32–0,5 chiều cao)
    const comp = clone.stickers.find((s) => s.attach === t.id);
    const others = (list) => list.filter((b) => b.id !== t.id && b.id !== comp?.id && !(b.type === 'sticker' && DECOR.has(clone.stickers.find((s) => s.id === b.id)?.key)));
    let over = others(bx).find((b) => hit(tb, b) > tb.w * tb.h * 0.12);
    if (over) {
      const y0 = t.y ?? 0.2;
      const cands = [0.14, 0.2, 0.26, 0.56, 0.62].filter((y) => Math.abs(y - y0) > 0.03).sort((a, b) => Math.abs(a - y0) - Math.abs(b - y0));
      for (const y of cands) {
        ct.y = y;
        const bb = boxesAt(T);
        const nb = bb.find((b) => b.id === t.id);
        if (nb && !others(bb).some((b) => hit(nb, b) > nb.w * nb.h * 0.12)) {
          const what = clone.stickers.find((s) => s.id === over.id);
          notes.push(`chữ chồng lên ${LABEL[what?.key] || (over.type === 'text' ? 'chữ khác' : 'hình khác')} → dời ${y < y0 ? 'lên' : 'xuống'}`);
          t.y = y;
          bx = bb;
          tb = nb;
          over = null;
          break;
        }
      }
      if (over) ct.y = t.y;
    }
    // c) chìm trên nền: màu chữ gần độ sáng nền mà kiểu chữ không có viền → đổi kiểu viền đôi (giữ màu, giữ font)
    if (WEAK.has(t.style || '3d')) {
      const L = await bgLum(p, T, tb).catch(() => null);
      if (L !== null) {
        const r = ratio(lumHex(t.color), L);
        if (r < 1.8) {
          t.style = ct.style = 'stroke2';
          notes.push(`chữ ${L > 0.4 ? 'sáng trên nền sáng' : 'tối trên nền tối'} (tương phản ${r.toFixed(1).replace('.', ',')}) → đổi kiểu viền đôi cho dễ đọc`);
        }
      }
    }
    // d) hình gắn chữ đè lên thứ khác → đổi bên; vẫn đè → bỏ hình, chữ gọn hơn
    if (comp) {
      const op = ops.find((o) => o.item?.id === comp.id);
      const cb = boxesAt(T).find((b) => b.id === comp.id);
      const bad = (b2, list) => b2 && others(list).some((b) => hit(b2, b) > b2.w * b2.h * 0.2);
      if (cb && bad(cb, bx)) {
        comp.side = op.item.side = comp.side === 'left' ? 'right' : 'left';
        const bb = boxesAt(T);
        if (bad(bb.find((b) => b.id === comp.id), bb)) {
          const i = ops.indexOf(op);
          if (i >= 0) ops.splice(i, 1);
          clone.stickers = clone.stickers.filter((s) => s.id !== comp.id);
          notes.push('emoji đè lên đồ hoạ khác → bỏ emoji cho khung gọn');
        } else notes.push(`emoji đè lên đồ hoạ khác → chuyển sang ${comp.side === 'left' ? 'trái' : 'phải'} chữ`);
      }
    }
    if (notes.length) fixes.push({id: t.id, T, x: tb.x + tb.w / 2, y: tb.y + tb.h / 2, w: tb.w, h: tb.h, say: notes.join(' · '), before, after: {size: t.size, y: t.y, style: t.style}});
  }
  return fixes;
}

// ---------- lý do chọn (ngắn, tiếng Việt) ----------
const LOOK_WHY = {bright: 'sáng, sạch — nhà cửa / sản phẩm nhìn rõ', vivid: 'màu rực, bắt mắt khi khách lướt', warm: 'tông ấm làm món ăn / không gian ấm cúng hơn', cool: 'tông mát, hiện đại', film: 'tông điện ảnh, sang', vintage: 'tông cổ điển, hoài niệm', moody: 'tông trầm, có chiều sâu', bw: 'đen trắng nghệ thuật', none: 'giữ màu gốc của video'};
function fontWhy(key) {
  const f = FONTS[key];
  if (!f) return '';
  const serif = /playfair|lora|serif|merriweather|cormorant|dancing|pacifico/i.test(key + (f.cat || ''));
  return `Font “${f.label || key}”: đủ dấu tiếng Việt, ${serif ? 'có chân, sang trọng' : 'nét đậm, đọc rõ trên điện thoại'}`;
}
function textWhy(t) {
  if (t.kind === 'price') return 'giá là điều khách muốn biết nhất → chữ to, hiện đúng lúc nói';
  if (t.kind === 'key') return 'ý chính của câu nói → nhấn chữ cho người xem nhớ';
  return 'con số cụ thể → chữ nổi bật đúng lúc nói';
}
function presetFor(t) {
  // giá → “Giá sốc”; số liệu → “Số liệu”; ý chính → mẫu cùng kiểu chữ (không lấy mẫu giá cho chữ thường)
  const by = (name) => TEXT_PRESETS.findIndex((x) => x.name === name);
  if (t.kind === 'price') return Math.max(0, by('Giá sốc'));
  const same = TEXT_PRESETS.findIndex((x) => x.style === t.style && x.kind !== 'price');
  if (t.kind !== 'key' && /\d/.test(t.main || '')) return same >= 0 && TEXT_PRESETS[same].name === 'Số liệu' ? same : Math.max(0, by('Số liệu'));
  return same >= 0 ? same : Math.max(0, by('Nhấn mạnh'));
}

// ---------- 2) CON TRỎ VÀO KHO ----------
// ed.ui (main.js): showPacks(), openLib(tab), query(q), done(). Trả về các op đã áp trong tour (bỏ khỏi danh sách diễn sau).
export async function kitTour(ed, ops, {fixes = [], packBy = 'ai', budget = 16, stock = []} = {}) {
  const {p, cur, ui} = ed;
  const done = new Set();
  if (!ui || !p.main) return done;
  const t0 = performance.now();
  const late = () => (performance.now() - t0) / 1000 > budget;
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const shown = (el) => {
    if (!el) return false;
    let r = el.getBoundingClientRect();
    if (r.width <= 0) return false;
    if (r.bottom > innerHeight - 4 || r.top < 0) el.scrollIntoView({block: 'center'});
    r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  };
  const onCanvas = (x, y) => {
    const r = ed.player.canvas.getBoundingClientRect();
    return [r.left + (x / W) * r.width, r.top + (y / H) * r.height];
  };
  const apply = (o) => {
    if (!o || done.has(o)) return;
    applyOp(p, o);
    done.add(o);
    ed.changed(false);
  };
  const ghostOf = (html, cls = '') => {
    const g = document.createElement('div');
    g.className = 'ai-ghost kho ' + cls;
    g.innerHTML = html;
    document.body.appendChild(g);
    return g;
  };
  const dragGhost = async (g, x, y, ms = 700) => {
    const x0 = cur.x;
    const y0 = cur.y;
    const put = (k) => (g.style.transform = `translate(${x0 + (x - x0) * k - 22}px, ${y0 + (y - y0) * k - 22}px) scale(${1 + 0.15 * Math.sin(k * Math.PI)})`);
    put(0);
    await cur.drag(x, y, ms, put);
    g.classList.add('drop');
    setTimeout(() => g.remove(), 260);
  };
  const shownFix = new Set();
  // TỰ KIỂM: thử mẫu ban đầu → thấy không đẹp → đổi (diễn trên khung hình)
  const demoFix = async (f) => {
    const o = ops.find((x) => x.item?.id === f.id);
    if (!o || shownFix.has(f)) return;
    shownFix.add(f);
    const it = done.has(o) ? find(p, f.id)?.item : o.item;
    if (!it) return;
    Object.assign(it, f.before);
    if (!done.has(o)) apply(o);
    else ed.changed(false);
    ed.seek(f.T);
    await cur.pause(150);
    await cur.moveTo(...onCanvas(f.x + f.w * 0.42, f.y + f.h * 0.25), 480); // chỉ vào góc chữ, không che chữ
    cur.say('Tự kiểm: ' + f.say);
    await cur.pause(1000);
    await cur.click();
    Object.assign(it, f.after);
    ed.changed(false);
    await cur.pause(900);
  };
  cur.show();
  cur.speed = 1.15;
  const genre = genreOf(p);
  const pack = PACKS[p.pack] || PACKS.mau1;
  try {
    // 1. Phong cách (+ font của phong cách)
    await ui.showPacks();
    const pk = document.querySelector(`#insp [data-pack="${p.pack}"]`);
    if (shown(pk)) {
      await cur.moveTo(...center(pk), 560);
      cur.say(`Phong cách “${pack.name}”: ${pack.desc}${packBy === 'user' ? ' (bạn đã chọn)' : ` — hợp video ${genre.label.toLowerCase()}`}`);
      await cur.click();
      await cur.pause(1100);
      cur.say(fontWhy(pack.font));
      await cur.pause(1000);
    }
    // 2. Hiệu ứng màu video
    const lookOp = ops.find((o) => o.op === 'look');
    if (lookOp && !late()) {
      await ui.openLib('fx');
      const el = document.querySelector(`#media [data-lookf="${lookOp.set.filter || 'none'}"]`);
      if (shown(el)) {
        el.scrollIntoView({block: 'nearest'});
        await cur.moveTo(...center(el), 520);
        cur.say(`Màu “${(FILTERS.find(([k]) => k === lookOp.set.filter) || [, 'Gốc'])[1]}”: ${LOOK_WHY[lookOp.set.filter] || ''}`);
        await cur.click();
        apply(lookOp);
        await cur.pause(900);
      }
    }
    // 3. Chữ (từ Chữ mẫu) + hình đi kèm (Emoji động / Icon / Hình — gõ tìm trong kho) — diễn kỹ 2 chữ đầu có hình
    const textOps = ops.filter((o) => o.op === 'add' && o.list === 'texts');
    const compOf = (t) => ops.find((o) => o.op === 'add' && o.list === 'stickers' && o.item.attach === t.id);
    const show = [...textOps.filter((o) => compOf(o.item)), ...textOps.filter((o) => !compOf(o.item))].slice(0, 2).sort((a, b) => a.item.start - b.item.start);
    for (const [n, o] of show.entries()) {
      if (late()) break;
      if (n) cur.speed = 1.7;
      const t = o.item;
      ed.seek(t.start + 0.05);
      await ui.openLib('text');
      const fx0 = fixes.find((f) => f.id === t.id);
      if (fx0) Object.assign(t, fx0.before); // hiện mẫu ban đầu trước, tự kiểm xong mới đổi
      const pi = presetFor(t);
      const pel = document.querySelector(`#media [data-preset="${pi}"]`);
      if (shown(pel)) {
        pel.scrollIntoView({block: 'nearest'});
        await cur.moveTo(...center(pel), 520);
        cur.say(`Chữ “${t.main}”: ${textWhy(t)} — lấy mẫu “${TEXT_PRESETS[pi].name}”, đổi theo phong cách`);
        await cur.pause(500);
        const [tx, ty] = onCanvas((t.x ?? 0.5) * W, (t.y ?? 0.2) * H);
        await dragGhost(ghostOf(`<b>${t.main}</b>`, 'txt'), tx, ty, 700);
      }
      apply(o);
      ed.seek(t.start + 0.9);
      await cur.pause(650);
      const c = compOf(t);
      if (c && !late()) {
        const tab = c.item.kind === 'anim' ? 'anim' : c.item.kind === 'icon' ? 'icon' : 'emoji';
        await ui.openLib(tab);
        const inp = document.querySelector('#libQ');
        // gõ đúng NHÃN trong kho (tiếng Việt có dấu) để ra đúng hình
        let q = String(c.item.label || '');
        try {
          const lab = (await loadIndex(tab)).items.find((x) => x.key === c.item.key)?.label;
          if (lab) q = lab;
        } catch (e) {}
        q = q.split(' ').slice(0, 3).join(' ').slice(0, 22);
        if (inp && q) {
          await cur.moveTo(...center(inp), 420);
          await cur.click();
          cur.say(`Tìm trong kho ${tab === 'anim' ? 'Emoji động' : tab === 'icon' ? 'Icon' : 'Hình'}: “${q}”`);
          for (let i = 1; i <= q.length; i++) {
            inp.value = q.slice(0, i);
            await cur.pause(55);
          }
          await ui.query(q);
        }
        const el = document.querySelector(`#libGrid [data-libadd="${c.item.key}"]`);
        if (shown(el)) {
          el.scrollIntoView({block: 'nearest'});
          await cur.moveTo(...center(el), 480);
          cur.say(`${c.why || 'hình hợp nghĩa câu nói'} — đặt sát chữ, mỗi chữ chỉ 1 hình`);
          await cur.pause(450);
          const img = el.querySelector('img')?.getAttribute('src') || '';
          // đích: đúng chỗ hình sẽ nằm cạnh chữ (tính như bộ vẽ)
          await cur.pause(60);
          const tb = (ed.player.boxes || []).find((b) => b.id === t.id);
          const base = Math.min(W, H) * 0.24 * (c.item.size || 0.6);
          const pos = tb ? companionPos(tb, base, c.item.side) : {x: 0.82 * W, y: (t.y ?? 0.2) * H};
          await dragGhost(ghostOf(`<img src="${img}" alt="">`, 'pic'), ...onCanvas(pos.x, pos.y), 750);
        }
        apply(c);
        ed.seek(t.start + 1.1);
        await cur.pause(800);
      }
      const fx = fixes.find((f) => f.id === t.id);
      if (fx) {
        await ui.done();
        await demoFix(fx);
      }
    }
    // 3a. Cảnh trám Pixabay: gõ từ khoá trong Kho › Pixabay, chọn cảnh, kéo xuống làn Cảnh phụ đúng câu nói
    const sp = stock[0];
    const bop = sp && ops.find((o) => o.op === 'add' && o.list === 'broll' && o.item.src === sp.src.id);
    if (bop) {
      cur.speed = Math.max(cur.speed, 1.3);
      ed.seek(bop.item.start + 0.05);
      await ui.openLib('stock', {q: sp.q, type: sp.it.type});
      const inp = document.querySelector('#stockQ');
      if (shown(inp)) {
        await cur.moveTo(...center(inp), 420);
        await cur.click();
        cur.say(`Tìm cảnh trám trên Pixabay: “${sp.q}”`);
        for (let i = 1; i <= sp.q.length; i++) {
          inp.value = sp.q.slice(0, i);
          await cur.pause(45);
        }
      }
      const el = document.querySelector(`#stockGrid [data-stockid="${sp.it.id}"]`);
      if (shown(el)) {
        await cur.moveTo(...center(el), 480);
        cur.say(`Câu nói này không có cảnh quay → lấy ${sp.it.type === 'image' ? 'ảnh' : 'cảnh'} chung minh hoạ “${sp.q}” ${{bds: ' (không dùng làm căn nhà đang bán)', banhang: ' (không dùng làm hàng đang bán)', amthuc: ' (không dùng làm món đang review)'}[p.genre] || ''} · nguồn Pixabay`);
        await cur.pause(600);
        const img = el.querySelector('img')?.getAttribute('src') || '';
        const to = ed.tl.pointAt('broll', bop.item.start + 0.2);
        await dragGhost(ghostOf(`<img src="${img}" alt="">`, 'pic'), to.x, to.y, 750);
      }
      apply(bop);
      ed.seek(bop.item.start + 0.8);
      await cur.pause(900);
    }
    // 3b. Đồ hoạ ngành (bảng giá, thẻ thông số, ghim vị trí…) — lấy từ Kho › Đồ hoạ, kéo ra đúng chỗ
    const CARD_WHY = {price: 'lời nói có giá → bảng giá lăn số, dừng đúng lúc nói', specs: 'lời nói có diện tích, số phòng → thẻ thông số hiện từng dòng đúng lúc nói', pin: 'nhắc tên nơi → ghim vị trí', slash: 'nói giá cũ → giá mới → gạch giá cũ cho thấy rẻ hơn', sale: 'nói giảm % → tem giảm giá', room: 'cảnh phụ là phòng nào → nhãn tên phòng', rec: 'mở đầu video chuyên gia → khung REC cho cảm giác quay thật', chip: 'ý chính ngắn → nhãn kính cạnh vai, không che mặt', bignum: 'nói giá → số to trên đầu kiểu chuyên gia', explain: 'người nói liệt kê từng bước → bảng các bước, mỗi mốc sáng đúng lúc nói', checklist: 'người nói liệt kê điều cần có → bảng tích từng dòng', lot: 'nói ngang × dài → sơ đồ lô đất vẽ theo đúng tỉ lệ', social: 'đoạn kết → nhắc Đăng ký · Thích · Chia sẻ', stars: 'nói số sao đánh giá → sao điền dần', timer: 'nói số phút nấu → đồng hồ chạy', stamp: 'người nói khen → tem đóng dấu đúng chữ đó', ingredients: 'kể nguyên liệu → thẻ giấy ghi lần lượt', chapter: 'chuyển sang bước mới → tiêu đề chương', versus: 'so sánh cách sai với cách đúng → thẻ Sai / Đúng', quote: 'câu nói đáng nhớ → khung trích dẫn', stat: 'nói tỉ lệ % → vòng số liệu chạy tới đúng %', place: 'nhắc nơi đang đến → tên địa điểm kiểu phim du lịch', date: 'vlog → tem ngày kiểu máy quay'};
    const cards = ops.filter((o) => o.op === 'add' && o.list === 'stickers' && o.item.kind === 'gfx' && CARD_WHY[o.item.key] && !['room', 'date', 'social'].includes(o.item.key));
    for (const o of cards.slice(0, Math.max(0, 2 - show.length))) {
      if (late()) break;
      const g = o.item;
      ed.seek(g.start + 0.05);
      await ui.openLib('gfx');
      const el = document.querySelector(`#media [data-addgfx="${g.key}"]`);
      if (shown(el)) {
        await cur.moveTo(...center(el), 520);
        cur.say(`${GFX_MAP[g.key]?.label || 'Đồ hoạ'}: ${CARD_WHY[g.key]}`);
        await cur.pause(600);
        const [tx, ty] = onCanvas((g.x ?? 0.5) * W, (g.y ?? 0.2) * H);
        await dragGhost(ghostOf(`<b>${GFX_MAP[g.key]?.label || ''}</b>`, 'txt'), tx, ty, 700);
      }
      apply(o);
      ed.seek(g.start + Math.min(2.2, g.dur * 0.6));
      await cur.pause(900);
    }
    cur.speed = 1.3;
    // 4. Âm thanh: âm đi kèm chữ đầu tiên đã diễn
    const first = show[0]?.item || cards[0]?.item;
    const near = first ? ops.filter((o) => o.op === 'add' && o.list === 'sfx' && Math.abs(o.item.start - first.start) < 1.2) : [];
    const sOp = near.find((o) => /^m1lk/.test(o.item.sfx) || o.item.sfx === 'cash') || near[0];
    if (sOp && (!late() || cur.skip === false && (performance.now() - t0) / 1000 < budget + 4)) {
      await ui.openLib('sfx');
      const el = document.querySelector(`#media [data-addsfx="${sOp.item.sfx}"]`);
      if (shown(el)) {
        el.scrollIntoView({block: 'nearest'});
        await cur.moveTo(...center(el), 500);
        cur.say(`Âm “${SFX_MAP[sOp.item.sfx]?.name || ''}” đúng lúc ${sOp.item.sfx === 'cash' ? 'hiện giá' : 'chữ chạm'} — mỗi cụm chữ 1 tiếng nhẹ, không ồn`);
        await cur.click();
        apply(sOp);
        await cur.pause(600);
      }
    }
    // 5. TỰ KIỂM: thử mẫu → thấy không đẹp → đổi (diễn trên khung hình)
    await ui.done();
    // còn chỗ tự kiểm chưa diễn: diễn thêm 1 chỗ (kể cả khi đã hết giờ — khách cần thấy AI tự soát)
    const left = fixes.filter((f) => !shownFix.has(f));
    for (const f of left.slice(0, shownFix.size ? 1 : 2)) await demoFix(f);
  } catch (e) {
    console.warn('kitTour', e);
  }
  await ui.done();
  cur.say('');
  cur.speed = 1;
  // chữ đã áp thì hình gắn với nó cũng phải có (khi tour dừng giữa chừng): để animateOps áp tiếp
  return done;
}
