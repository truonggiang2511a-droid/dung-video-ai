// Con trỏ AI: di chuyển, bấm, kéo trên timeline như người dựng thật. Điện thoại hiện ngón tay, máy tính hiện mũi tên.
// mũi tên xanh chanh + thẻ "AI" kiểu con trỏ cộng tác (Figma) cho dễ thấy trên nền tối
const ARROW = '<svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5v17.2l4.6-4.3 3 6.6 2.9-1.3-3-6.5 6.3-.3z" fill="#d1fe17" stroke="#0b0d10" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const FINGER = '<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V8.5a1.5 1.5 0 0 1 3 0V10h.5V9.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.3 15a1.6 1.6 0 0 1 2.4-2L9 15z" fill="#ffe3cc" stroke="#0b0d10" stroke-width="1.1" stroke-linejoin="round"/></svg>';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cursor {
  constructor() {
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.el = document.createElement('div');
    this.el.className = 'ai-cursor' + (this.touch ? ' touch' : '');
    this.el.innerHTML = (this.touch ? FINGER : ARROW) + '<span class="ai-ring"></span><span class="ai-name">AI</span>';
    this.step = '';
    this.tip = document.createElement('div');
    this.tip.className = 'ai-tip';
    document.body.append(this.el, this.tip);
    this.x = innerWidth * 0.5;
    this.y = innerHeight * 0.6;
    this.speed = 1;
    this.skip = false;
    this._place();
  }
  _place() {
    // đầu ngón tay / mũi tên chạm đúng điểm
    const ox = this.touch ? 10 : 4;
    const oy = this.touch ? 4 : 2;
    this.el.style.transform = `translate(${this.x - ox}px, ${this.y - oy}px)`;
    // điện thoại: chú thích gắn vào thanh trạng thái (không che làn đang sửa); không có thanh thì nằm TRÊN ngón tay
    const d = this.dockEl?.();
    if (d && !d.hidden && d.offsetParent) {
      const r = d.getBoundingClientRect();
      const skip = d.querySelector('[data-act="skip"]');
      const right = skip ? skip.getBoundingClientRect().left - 6 : r.right - 8;
      this.tip.classList.add('docked');
      this.tip.style.maxWidth = this.tip.style.width = Math.max(160, right - r.left - 8) + 'px';
      const th = this.tip.offsetHeight || 30;
      this.tip.style.transform = `translate(${r.left + 6}px, ${r.top + (r.height - th) / 2}px)`;
      return;
    }
    this.tip.classList.remove('docked');
    this.tip.style.maxWidth = this.tip.style.width = '';
    // điện thoại: chú thích nằm TRÊN ngón tay (ngón tay che phía dưới); máy tính: dưới mũi tên, sát đáy thì lật lên
    const tw = this.tip.offsetWidth || 260;
    const below = this.y + 38;
    const ty = this.touch || below > innerHeight - 56 ? this.y - 52 : below;
    this.tip.style.transform = `translate(${Math.min(innerWidth - tw - 8, Math.max(8, this.x - 40))}px, ${Math.max(8, ty)}px)`;
  }
  show() {
    this.el.classList.add('on');
  }
  hide() {
    this.el.classList.remove('on');
    this.tip.classList.remove('on');
  }
  say(text) {
    if (!text) {
      this.tip.classList.remove('on');
      return;
    }
    this.tip.innerHTML = (this.step ? `<b>${this.step}</b>` : '<i></i>') + text;
    this.tip.classList.add('on');
    this._place();
  }
  async moveTo(x, y, ms = 500) {
    if (this.skip) {
      this.x = x;
      this.y = y;
      this._place();
      return;
    }
    ms /= this.speed;
    const x0 = this.x;
    const y0 = this.y;
    const lift = Math.min(60, Math.hypot(x - x0, y - y0) * 0.15);
    const t0 = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = ease(k);
        this.x = x0 + (x - x0) * e;
        this.y = y0 + (y - y0) * e - Math.sin(k * Math.PI) * lift;
        this._place();
        if (k < 1 && !this.skip) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
    this.x = x;
    this.y = y;
    this._place();
  }
  async click() {
    if (this.skip) return;
    this.el.classList.remove('tap');
    void this.el.offsetWidth;
    this.el.classList.add('tap');
    await wait(220 / this.speed);
  }
  async press(on) {
    this.el.classList.toggle('down', on);
    if (!this.skip) await wait(120 / this.speed);
  }
  // Kéo từ điểm hiện tại tới (x, y); onK(k) để vật thể chạy theo
  async drag(x, y, ms = 650, onK) {
    await this.press(true);
    if (this.skip) {
      onK?.(1);
      this.x = x;
      this.y = y;
      this._place();
      await this.press(false);
      return;
    }
    const x0 = this.x;
    const y0 = this.y;
    const t0 = performance.now();
    ms /= this.speed;
    await new Promise((res) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = ease(k);
        this.x = x0 + (x - x0) * e;
        this.y = y0 + (y - y0) * e;
        this._place();
        onK?.(e);
        if (k < 1 && !this.skip) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
    onK?.(1);
    await this.press(false);
  }
  // đặt ngay (không hoạt ảnh) — dùng khi quét theo tiến độ nghe/chép lời
  jump(x, y) {
    this.x = x;
    this.y = y;
    this._place();
  }
  pause(ms) {
    return this.skip ? Promise.resolve() : wait(ms / this.speed);
  }
}
