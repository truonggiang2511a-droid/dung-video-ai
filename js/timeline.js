// Timeline kiểu CapCut: đầu phát cố định ở giữa, kéo timeline để tua. Các làn: Chữ, Phụ đề, Hiệu ứng, Cảnh phụ, Video chính, Nhạc.
import {duration, segStarts, subLines, GFX_MAP} from './render.js';
import {genreOf} from './templates.js';

const ROWS = [
  {key: 'texts', label: 'Chữ', icon: 'M4 7V4h16v3M9 20h6M12 4v16'},
  {key: 'stickers', label: 'Hình', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01'},
  {key: 'subs', label: 'Phụ đề', icon: 'M3 5h18v14H3zM7 13h4M13 13h4M7 16h10'},
  {key: 'zooms', label: 'Hiệu ứng', icon: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M11 8v6M8 11h6'},
  {key: 'broll', label: 'Cảnh phụ', icon: 'M3 5h18v14H3zM3 9h18M8 5v4M16 5v4'},
  {key: 'main', label: 'Video', icon: 'M3 6h13v12H3zM16 10l5-3v10l-5-3'},
  {key: 'music', label: 'Nhạc', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM21 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z'},
  {key: 'sfx', label: 'Âm thanh', icon: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14'},
];

const svg = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

export class Timeline {
  constructor(root, cb) {
    this.root = root;
    this.cb = cb; // {onScrub, onSelect, onDragStart, onDrag, onDragEnd, onAdd, onClipAi}
    // Máy tính: timeline bắt đầu từ mép trái, đầu phát chạy theo thời gian (kiểu Premiere).
    // Điện thoại: đầu phát cố định giữa, kéo timeline để tua (kiểu CapCut).
    this.mq = matchMedia('(min-width: 900px)');
    this.left = this.mq.matches;
    this.pps = this.left ? 70 : 46;
    this.sel = null;
    this.p = null;
    root.innerHTML = `
      <div class="tl-labels">${ROWS.map((r) => `<div class="tl-label" data-row="${r.key}">${svg(r.icon, 15)}<span>${r.label}</span></div>`).join('')}</div>
      <div class="tl-scroll" tabindex="0" aria-label="Timeline, kéo ngang để tua">
        <div class="tl-inner">
          <div class="tl-ruler" title="Bấm hoặc kéo để tua"></div>
          ${ROWS.map((r) => `<div class="tl-row" data-row="${r.key}"></div>`).join('')}
          <div class="tl-ph" aria-hidden="true"><i></i></div>
          <div class="clip-tools" hidden></div>
        </div>
      </div>
      <div class="tl-head" aria-hidden="true"><i></i></div>
      <div class="tl-empty" hidden></div>`;
    this.scroll = root.querySelector('.tl-scroll');
    this.inner = root.querySelector('.tl-inner');
    this.ruler = root.querySelector('.tl-ruler');
    this.rows = Object.fromEntries(ROWS.map((r) => [r.key, root.querySelector(`.tl-row[data-row="${r.key}"]`)]));
    this.empty = root.querySelector('.tl-empty');
    this.ph = root.querySelector('.tl-ph');
    this.tools = root.querySelector('.clip-tools');
    root.classList.toggle('left', this.left);
    this.mq.addEventListener?.('change', () => {
      this.left = this.mq.matches;
      root.classList.toggle('left', this.left);
      this.render(this.p);
      this.setTime(this.T || 0);
    });
    this._prog = false;
    this.scroll.addEventListener('scroll', () => {
      if (this._prog) {
        this._prog = false;
        return;
      }
      if (this.left) {
        if (this.sel) this._tools();
        return; // máy tính: cuộn chỉ để xem, không tua
      }
      this.cb.onScrub?.(this.scroll.scrollLeft / this.pps);
    });
    this.scroll.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        this.scroll.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, {passive: false});
    this.inner.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tl-add')) e.preventDefault(); // không để trình duyệt cuộn timeline tới nút
      this._down(e);
    });
    root.addEventListener('click', (e) => this._click(e));
    new ResizeObserver(() => this.layout()).observe(this.scroll);
  }

  get half() {
    return this.left ? 18 : this.scroll.clientWidth / 2;
  }
  x(T) {
    return this.half + T * this.pps;
  }

  zoom(k) {
    const T = this.T || 0;
    this.pps = Math.max(12, Math.min(260, this.pps * k));
    this.render(this.p);
    this.setTime(T);
    this.cb.onZoom?.(this.pps / (this.left ? 70 : 46));
  }

  setTime(T) {
    this.T = T;
    if (this.left) {
      const x = this.x(T);
      this.ph.style.left = x + 'px';
      const vx = x - this.scroll.scrollLeft;
      const w = this.scroll.clientWidth;
      if (vx < 30 || vx > w - 60) {
        this._prog = true;
        this.scroll.scrollLeft = Math.max(0, x - w * 0.25);
      }
      return;
    }
    const want = T * this.pps;
    if (Math.abs(this.scroll.scrollLeft - want) > 0.5) {
      this._prog = true;
      this.scroll.scrollLeft = want;
    }
  }

  select(sel) {
    this.sel = sel;
    this.render(this.p);
  }

  layout() {
    if (this.p) this.render(this.p);
  }

  render(p) {
    this.p = p;
    if (!p) return;
    const D = duration(p);
    const half = this.half;
    const total = D * this.pps;
    this.inner.style.width = (this.left ? Math.max(this.scroll.clientWidth, total + half + 240) : total + half * 2) + 'px';
    this.inner.style.setProperty('--pad', half + 'px');
    // thước thời gian
    const step = this.pps >= 60 ? 1 : this.pps >= 30 ? 2 : 5;
    let rh = '';
    for (let s = 0; s <= D + 0.01; s += step) rh += `<span style="left:${this.x(s)}px">${fmt(s)}</span>`;
    this.ruler.innerHTML = rh;

    const isSel = (type, id) => this.sel && this.sel.type === type && this.sel.id === id;
    const clip = (type, id, start, dur, cls, inner, style = '') => {
      const s = isSel(type, id);
      return `<div class="clip ${cls}${s ? ' sel' : ''}" data-type="${type}" data-id="${esc(id)}" style="left:${this.x(start)}px;width:${Math.max(6, dur * this.pps)}px;${style}">${inner}${s && type !== 'subs' ? '<b class="h l" data-h="l"></b><b class="h r" data-h="r"></b>' : ''}</div>`;
    };

    // Chữ
    this.rows.texts.innerHTML = (p.texts || []).map((t) => clip('text', t.id, t.start, t.dur, 'c-text', `<span>${t.locked ? '🔒 ' : ''}${esc(t.main)}</span>`, `--c:${t.color}`)).join('');
    // Phụ đề
    const lines = p.subs?.on ? subLines(p) : [];
    this.rows.subs.innerHTML = lines.length
      ? lines.map((l, i) => clip('subs', 'subs', l.s, l.e - l.s, 'c-sub', `<span>${esc(l.ws.map((w) => w.w).join(' '))}</span>`, '')).join('')
      : p.main && p.transcript ? '' : p.main ? `<div class="tl-hint" style="left:${half}px">Phụ đề sẽ có sau khi AI nghe lời nói</div>` : '';
    // Hình minh hoạ / icon động
    this.rows.stickers.innerHTML = (p.stickers || [])
      .map((s) =>
        s.kind === 'gfx'
          ? clip('sticker', s.id, s.start, s.dur, 'c-sticker c-gfx', `<b>✦</b><span>${esc(GFX_MAP[s.key]?.label || 'Đồ hoạ')}${s.label && s.key !== 'progress' ? ' · ' + esc(s.label) : ''}</span>`, `--c:${s.color || '#ffc61a'}`)
          : clip('sticker', s.id, s.start, s.dur, 'c-sticker', `<img src="lib/${s.kind === 'icon' ? 'i' : 'e'}/${esc(s.key)}.svg" alt="" loading="lazy"><span>${esc(s.label || '')}</span>`, s.kind === 'icon' ? `--c:${s.color || '#2f8cff'}` : ''),
      )
      .join('');
    // Âm thanh (SFX)
    this.rows.sfx.innerHTML = (p.sfx || []).map((s) => clip('sfx', s.id, s.start, Math.max(s.dur, 0.5), 'c-sfx', `<span>♪ ${esc(s.name || s.sfx)}</span>`)).join('');
    // Hiệu ứng
    this.rows.zooms.innerHTML = (p.zooms || []).map((z) => clip('zoom', z.id, z.start, z.dur, 'c-zoom', `<span>${z.kind === 'punch' ? 'Zoom giật' : z.kind === 'push' ? 'Đẩy máy' : 'Zoom'}</span>`)).join('');
    // Cảnh phụ
    this.rows.broll.innerHTML =
      (p.broll || [])
        .map((b) => {
          const src = p.sources[b.src];
          const th = src?.thumbs?.[0] ? `background-image:url(${src.thumbs[0]})` : '';
          return clip('broll', b.id, b.start, b.dur, 'c-broll', `<span>${b.locked ? '🔒 ' : ''}${esc(src?.name || 'Cảnh phụ')}</span>`, th);
        })
        .join('') + (p.main ? `<button class="tl-add" data-add="broll" style="left:${this.x(D) + 10}px">+ Cảnh phụ</button>` : '');
    // Video chính
    if (p.main) {
      const src = p.sources[p.main.src];
      const starts = segStarts(p);
      this.rows.main.innerHTML = p.main.segs
        .map((s, i) => {
          const w = (s.out - s.in) * this.pps;
          const n = src.thumbs?.length || 0;
          let tiles = '';
          if (n) {
            const tw = 30;
            for (let x = 0; x < w; x += tw) {
              const t = s.in + (x / w) * (s.out - s.in);
              const k = Math.min(n - 1, Math.floor((t / src.duration) * n));
              tiles += `<i style="left:${x}px;background-image:url(${src.thumbs[k]})"></i>`;
            }
          }
          return clip('seg', String(i), starts[i], s.out - s.in, 'c-main', `<div class="tiles">${tiles}</div>${s.tr && i > 0 ? `<em class="jt" title="Chuyển cảnh">✦</em>` : ''}<span>${i === 0 ? esc(src.name) : ''}</span>`);
        })
        .join('');
    } else this.rows.main.innerHTML = '';
    // Nhạc
    this.rows.music.innerHTML = p.music
      ? clip('music', 'music', 0, D, 'c-music', `<span>♪ ${esc(p.sources[p.music.src]?.name || 'Nhạc nền')}</span>`)
      : p.main
        ? `<button class="tl-add" data-add="music" style="left:${half}px">+ Thêm nhạc nền</button>`
        : '';

    if (this.left) this.ph.style.left = this.x(this.T || 0) + 'px';
    this.ph.hidden = !this.left || !p.main;
    this._tools();

    // màn trống
    if (!p.main) {
      this.empty.hidden = false;
      this.empty.innerHTML = `
        <button class="drop main" data-add="main">${svg('M12 5v14M5 12h14', 22)}<b>Thêm video chính</b><small>Video bạn nói trước máy quay (A-roll)</small></button>
        <button class="drop" data-add="broll">${svg('M12 5v14M5 12h14', 22)}<b>Thêm cảnh phụ</b><small>${genreOf(p).broll} (B-roll)</small></button>`;
    } else this.empty.hidden = true;
  }

  // Thanh công cụ nhỏ nổi trên clip đang chọn (máy tính, kiểu HyperFrames): Nhờ AI · Tách · Xoá
  _tools() {
    const t = this.tools;
    const s = this.sel;
    const el = s && this.left ? this.clipEl(s.type === 'subs' ? 'subs' : s.type, s.id) : null;
    if (!el) {
      t.hidden = true;
      return;
    }
    const ic = (d) => svg(d, 15);
    const AI = 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z';
    const b = [];
    if (s.type !== 'seg') b.push(`<button class="ai" data-act="clipAi" title="Nhờ AI sửa clip này">${ic(AI)}<span>Nhờ AI</span></button>`);
    if (s.type === 'seg') b.push(`<button data-act="split" title="Tách tại đầu phát (S)">${ic('M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4')}<span>Tách</span></button>`);
    if (s.type !== 'subs') b.push(`<button data-act="del" title="Xoá (Delete)">${ic('M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3')}</button>`);
    t.innerHTML = b.join('');
    const row = el.parentElement;
    const first = row.dataset.row === 'texts';
    // clip rộng hơn vùng nhìn → đặt thanh ở giữa phần đang thấy của clip
    const vis0 = Math.max(el.offsetLeft, this.scroll.scrollLeft + 20);
    const vis1 = Math.min(el.offsetLeft + el.offsetWidth, this.scroll.scrollLeft + this.scroll.clientWidth - 20);
    t.style.left = (vis1 > vis0 ? (vis0 + vis1) / 2 : el.offsetLeft + el.offsetWidth / 2) + 'px';
    t.style.top = (first ? row.offsetTop + row.offsetHeight + 2 : row.offsetTop + 2) + 'px';
    t.style.transform = first ? 'translate(-50%,0)' : 'translate(-50%,-100%)';
    t.hidden = false;
  }

  // Cập nhật nhanh một clip khi đang kéo (không dựng lại cả timeline, để giữ thao tác chạm)
  updateClip(type, id, start, dur) {
    const el = this.clipEl(type, id);
    if (!el) return;
    el.style.left = this.x(start) + 'px';
    el.style.width = Math.max(6, dur * this.pps) + 'px';
  }

  // ----- vị trí cho con trỏ AI -----
  rowRect(key) {
    return this.rows[key].getBoundingClientRect();
  }
  pointAt(key, T) {
    const r = this.rowRect(key);
    const sr = this.scroll.getBoundingClientRect();
    return {x: sr.left + this.x(T) - this.scroll.scrollLeft, y: r.top + r.height / 2};
  }
  clipEl(type, id) {
    return this.inner.querySelector(`.clip[data-type="${type}"][data-id="${CSS.escape(String(id))}"]`);
  }

  // ----- chạm/kéo -----
  _click(e) {
    if (e.target.closest('.clip-tools')) return; // nút trên thanh nổi do main.js xử lý (data-act)
    const add = e.target.closest('[data-add]');
    if (add) {
      this.cb.onAdd?.(add.dataset.add);
      return;
    }
    if (this._dragged) {
      this._dragged = false;
      return;
    }
    const c = e.target.closest('.clip');
    if (!c) {
      if (this.sel) {
        this.sel = null;
        this.cb.onSelect?.(null);
        this.render(this.p);
      }
      return;
    }
    const sel = {type: c.dataset.type, id: c.dataset.id};
    this.sel = sel;
    this.cb.onSelect?.(sel);
    this.render(this.p);
  }

  _timeAt(clientX) {
    const r = this.scroll.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + this.scroll.scrollLeft - this.half) / this.pps);
  }

  _down(e) {
    if (this.left && this.p?.main && !e.target.closest('.clip, button') && (e.target.closest('.tl-ruler') || e.target.classList.contains('tl-row') || e.target === this.inner)) {
      // tua bằng chuột trên máy tính
      const el = e.target;
      el.setPointerCapture?.(e.pointerId);
      const go = (ev) => this.cb.onScrub?.(this._timeAt(ev.clientX), true);
      go(e);
      const up = () => {
        el.removeEventListener('pointermove', go);
        el.removeEventListener('pointerup', up);
      };
      el.addEventListener('pointermove', go);
      el.addEventListener('pointerup', up);
      return;
    }
    const c = e.target.closest('.clip.sel');
    if (!c || !['text', 'broll', 'zoom', 'seg', 'sticker', 'sfx'].includes(c.dataset.type)) return;
    let h = e.target.dataset.h;
    if (c.dataset.type === 'sfx') h = undefined; // âm thanh có độ dài cố định: chỉ dời
    if (c.dataset.type === 'seg' && !h) return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    let started = false;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!started && Math.abs(dx) < 4) return;
      if (!started) {
        started = true;
        this._dragged = true;
        this.cb.onDragStart?.(this.sel);
      }
      this.cb.onDrag?.(this.sel, h || 'move', dx / this.pps);
    };
    const up = () => {
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      if (started) this.cb.onDragEnd?.(this.sel);
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }
}
