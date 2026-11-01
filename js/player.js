// Bản xem nhanh: phát ngay trên trình duyệt bằng thẻ <video> + vẽ canvas (không cần render).
import {W, H, drawFrame, duration, srcAt, activeBrolls} from './render.js';

export class Player {
  constructor(canvas, holder) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.holder = holder; // div ẩn chứa các thẻ video
    this.p = null;
    this.urls = {};
    this.els = {};
    this.T = 0;
    this.playing = false;
    this.boxes = [];
    this.onTime = null;
    this.onState = null;
    this.highlight = null;
    this.setScale(540);
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  setScale(w) {
    this.canvas.width = w;
    this.canvas.height = Math.round((w * H) / W);
    this.k = w / W;
    this.dirty = true;
  }

  // Gắn file của dự án vào các thẻ video
  async attach(p, getBlob) {
    this.p = p;
    for (const [id, src] of Object.entries(p.sources)) {
      if (this.els[id]) continue;
      const blob = await getBlob(src.fileKey);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      this.urls[id] = url;
      const el = document.createElement(src.kind === 'music' ? 'audio' : 'video');
      el.preload = 'auto';
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.muted = src.kind === 'broll';
      el.src = url;
      el.addEventListener('seeked', () => (this.dirty = true));
      el.addEventListener('loadeddata', () => (this.dirty = true));
      this.holder.appendChild(el);
      this.els[id] = el;
    }
    this.dirty = true;
  }

  detach() {
    this.pause();
    for (const el of Object.values(this.els)) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    for (const u of Object.values(this.urls)) URL.revokeObjectURL(u);
    this.els = {};
    this.urls = {};
    this.p = null;
  }

  get D() {
    return this.p ? duration(this.p) : 0;
  }

  play() {
    if (!this.p || !this.p.main) return;
    if (this.T >= this.D - 0.05) this.T = 0;
    this.playing = true;
    this.t0 = this.T;
    this.n0 = performance.now();
    this._sync(true);
    this.onState?.(true);
  }

  pause() {
    this.playing = false;
    for (const el of Object.values(this.els)) el.pause();
    this.onState?.(false);
    this.dirty = true;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  seek(T) {
    this.T = Math.max(0, Math.min(this.D, T));
    if (this.playing) {
      this.t0 = this.T;
      this.n0 = performance.now();
    }
    this._sync(true);
    this.dirty = true;
    this.onTime?.(this.T);
  }

  _want(el, t, play, force) {
    if (!el || isNaN(el.duration)) return;
    if (force || Math.abs(el.currentTime - t) > (play ? 0.3 : 0.04)) {
      try {
        el.currentTime = t;
      } catch (e) {
        /* chưa sẵn sàng */
      }
    }
    if (play && el.paused) el.play().catch(() => {});
    if (!play && !el.paused) el.pause();
  }

  _sync(force) {
    const p = this.p;
    if (!p || !p.main) return;
    const at = srcAt(p, this.T);
    const main = this.els[p.main.src];
    if (main && at) {
      main.muted = false;
      main.volume = 1;
      this._want(main, at.t, this.playing, force);
    }
    const act = new Set();
    for (const b of activeBrolls(p, this.T)) {
      const el = this.els[b.src];
      act.add(b.src);
      this._want(el, Math.min((el?.duration || 99) - 0.05, b.in + (this.T - b.start)), this.playing, force);
    }
    for (const [id, el] of Object.entries(this.els)) {
      const src = p.sources[id];
      if (!src || src.kind !== 'broll' || act.has(id)) continue;
      if (!el.paused) el.pause();
    }
    if (p.music && this.els[p.music.src]) {
      const a = this.els[p.music.src];
      a.volume = Math.max(0, Math.min(1, p.music.vol ?? 0.2));
      a.loop = true;
      const md = p.sources[p.music.src]?.duration || 1;
      this._want(a, this.T % md, this.playing, force);
    }
  }

  frames() {
    const p = this.p;
    const fr = {main: null, broll: {}};
    const mk = (el) => (el && el.readyState >= 2 && el.videoWidth ? {img: el, w: el.videoWidth, h: el.videoHeight} : null);
    if (p.main) fr.main = mk(this.els[p.main.src]);
    for (const b of activeBrolls(p, this.T)) fr.broll[b.id] = mk(this.els[b.src]);
    return fr;
  }

  _tick(now) {
    requestAnimationFrame(this._tick);
    if (!this.p) return;
    if (this.playing) {
      this.T = this.t0 + (now - this.n0) / 1000;
      if (this.T >= this.D) {
        this.T = this.D;
        this.pause();
        this.onEnd?.();
      } else this._sync(false);
      this.onTime?.(this.T);
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.ctx;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    if (!this.p.main) {
      g.fillStyle = '#12151b';
      g.fillRect(0, 0, W, H);
      return;
    }
    this.boxes = drawFrame(g, this.p, this.T, this.frames(), {placeholder: true});
    if (this.highlight) {
      const b = this.boxes.find((x) => x.id === this.highlight);
      if (b) {
        g.save();
        g.strokeStyle = '#4da3ff';
        g.lineWidth = 5;
        g.strokeRect(b.x, b.y, b.w, b.h);
        g.fillStyle = '#ffffff';
        for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) g.fillRect(x - 9, y - 9, 18, 18);
        g.restore();
      }
    }
  }

  // Toạ độ chạm trên canvas → toạ độ khung gốc
  toComp(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H};
  }
  hit(x, y) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }
}
