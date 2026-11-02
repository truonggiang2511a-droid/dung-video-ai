// Bản xem nhanh: phát ngay trên trình duyệt (không cần render).
// Cách làm giống phần mềm dựng chuyên nghiệp:
//  - TIẾNG làm đồng hồ chuẩn: giải mã tiếng video chính 1 lần, Web Audio xếp lịch phát từng đoạn giữ lại → chỗ cắt liền mạch, không khựng
//  - HÌNH chạy theo tiếng: 2 thẻ <video> cho video chính, thẻ rảnh luôn tua sẵn tới đầu đoạn kế tiếp → tới chỗ cắt chỉ việc đổi thẻ
//  - Video chưa kịp ra hình thì GIỮ khung cuối (không bao giờ vẽ khung xám), cảnh phụ được tua sẵn trước 2 giây
//  - Chưa giải mã xong tiếng / máy không cho Web Audio → dùng tiếng của thẻ video, đồng hồ dừng chờ khi video đang tua (không nhảy cóc lời)
import {W, H, drawFrame, duration, srcAt, activeBrolls, segStarts, setFormat} from './render.js';
import {sfxBuffer} from './sfx.js';
import {onStickerLoad} from './library.js';
import {ensureProjectFonts} from './fonts.js';

const engine = () => import('./engine.js');
const PREVIEW_RATE = 32000;
const FADE = 0.006; // làm mềm 6 ms ở mỗi chỗ nối tiếng

function makeVideo(url, muted = true) {
  const el = document.createElement('video');
  el.preload = 'auto';
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.muted = muted;
  el.src = url;
  el.seg = -1;
  return el;
}

// KHUNG TĨNH khi trình duyệt không phát được file (4K HEVC iPhone trên Chrome máy tính) và bản xem nhanh còn đang đổi:
// giải mã đúng 1 khung bằng WebCodecs mỗi lần tua (1 yêu cầu một lúc, yêu cầu mới thay yêu cầu cũ) → bỏ video lên là thấy hình
class Still {
  constructor(blob, long, onFrame) {
    this.cv = document.createElement('canvas');
    this.g = this.cv.getContext('2d');
    this.ok = false;
    this.want = null;
    this.busy = false;
    this.onFrame = onFrame;
    this.ready = (async () => {
      const m = await engine();
      const input = new m.Input({source: new m.BlobSource(blob), formats: m.ALL_FORMATS});
      const track = await input.getPrimaryVideoTrack();
      const dw = track.displayWidth || track.codedWidth;
      const dh = track.displayHeight || track.codedHeight;
      const k = Math.min(1, long / Math.max(dw, dh));
      this.cv.width = Math.max(2, Math.round(dw * k));
      this.cv.height = Math.max(2, Math.round(dh * k));
      this.sink = new m.CanvasSink(track, {width: this.cv.width, height: this.cv.height, fit: 'fill', poolSize: 1});
    })().catch((e) => console.warn('Không giải mã được khung tĩnh', e));
  }
  at(t) {
    if (this.shown != null && Math.abs(this.shown - t) < 0.02) return;
    this.want = t;
    if (!this.busy) this._run();
  }
  async _run() {
    this.busy = true;
    try {
      await this.ready;
      while (this.sink && this.want != null && !this.dead) {
        const t = this.want;
        this.want = null;
        const r = await this.sink.getCanvas(Math.max(0, t));
        if (r && !this.dead) {
          this.g.drawImage(r.canvas, 0, 0, this.cv.width, this.cv.height);
          this.ok = true;
          this.shown = t;
          this.onFrame();
        }
      }
    } catch (e) {
      console.warn('Khung tĩnh lỗi', e);
    }
    this.busy = false;
  }
  frame() {
    return this.ok ? {img: this.cv, w: this.cv.width, h: this.cv.height} : null;
  }
}

// Giải mã tiếng video chính thành 1 kênh 32 kHz để xem nhanh (xuất video vẫn dùng tiếng gốc chất lượng đầy đủ)
async function decodePreviewAudio(blob) {
  const m = await engine();
  const input = new m.Input({source: new m.BlobSource(blob), formats: m.ALL_FORMATS});
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  if (!(await track.canDecode())) {
    const {decodeWhole} = await import('./media.js');
    return decodeWhole(blob, PREVIEW_RATE);
  }
  const total = await input.computeDuration();
  const out = new Float32Array(Math.ceil(total * PREVIEW_RATE) + PREVIEW_RATE);
  for await (const {buffer, timestamp} of new m.AudioBufferSink(track).buffers()) {
    const sr = buffer.sampleRate;
    const n = buffer.length;
    const chs = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
    const k0 = Math.max(0, Math.ceil(timestamp * PREVIEW_RATE));
    const k1 = Math.min(out.length, Math.floor((timestamp + n / sr) * PREVIEW_RATE));
    for (let k = k0; k < k1; k++) {
      const pos = (k / PREVIEW_RATE - timestamp) * sr;
      const j = Math.floor(pos);
      const f = pos - j;
      const j2 = Math.min(n - 1, j + 1);
      let v = 0;
      for (const ch of chs) v += ch[j] * (1 - f) + ch[j2] * f;
      out[k] = v / chs.length;
    }
  }
  const ab = new AudioBuffer({length: out.length, numberOfChannels: 1, sampleRate: PREVIEW_RATE});
  ab.copyToChannel(out, 0);
  return ab;
}

async function decodeFile(blob) {
  const ac = new OfflineAudioContext(2, 1, 44100);
  const buf = await blob.arrayBuffer();
  return new Promise((res, rej) => {
    const pr = ac.decodeAudioData(buf, res, rej);
    if (pr && pr.then) pr.then(res, rej);
  });
}

// WAV im lặng ngắn: phát lặp trong lúc xem để iPhone gạt nút im lặng vẫn nghe được tiếng Web Audio
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export class Player {
  constructor(canvas, holder) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.holder = holder; // div ẩn chứa các thẻ video
    this.p = null;
    this.sfxBufs = {}; // key SFX → AudioBuffer đã dựng
    onStickerLoad(() => (this.dirty = true));
    this.urls = {};
    this.els = {}; // cảnh phụ + nhạc (thẻ dự phòng); els[mainId] = thẻ video chính đầu tiên
    this.mains = [];
    this.mainId = null;
    this.bufs = {}; // id nguồn → AudioBuffer (null = không có tiếng), undefined = đang giải mã
    this.holds = {}; // id nguồn → canvas giữ khung cuối
    this.imgs = {}; // id nguồn ảnh → {img: canvas đã thu nhỏ, w, h}
    this.stills = {}; // id nguồn chưa có bản xem nhanh → Still (khung tĩnh WebCodecs)
    this.onNeedProxy = null; // bấm phát khi video chính còn đang đổi bản xem nhanh
    this.T = 0;
    this.playing = false;
    this.boxes = [];
    this.onTime = null;
    this.onState = null;
    this.onMainError = null;
    this.highlight = null;
    this.nodes = [];
    this.mode = 'el';
    this._n = 0;
    this.setScale(540);
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  // long = số điểm ảnh của cạnh dài khung xem (máy tính 1280, điện thoại 960)
  setScale(long) {
    this.long = long;
    this._resize();
  }
  _resize() {
    const k = this.long / Math.max(W, H);
    this.canvas.width = Math.round(W * k);
    this.canvas.height = Math.round(H * k);
    this.canvas.style.aspectRatio = `${W} / ${H}`;
    this.canvas.classList.toggle('land', W > H);
    this.k = k;
    this.holds = {};
    this.dirty = true;
  }
  // Đổi khổ hình (9:16 / 4:5 / 1:1 / 16:9)
  setFormat(key) {
    setFormat(key);
    this._resize();
  }

  // ---------- gắn / gỡ file ----------
  async attach(p, getBlob) {
    this.p = p;
    if (setFormat(p.format)) this._resize();
    ensureProjectFonts(p).then(() => (this.dirty = true));
    const want = new Set(Object.keys(p.sources));
    for (const id of Object.keys(this.urls)) if (!want.has(id)) this._drop(id);
    this.getBlob = getBlob;
    for (const [id, src] of Object.entries(p.sources)) {
      if (this.urls[id]) continue;
      if (src.proxy === 'pending' && src.kind !== 'music') {
        // trình duyệt không phát được file gốc, bản xem nhanh đang đổi chạy nền → khung tĩnh giải mã từng khung
        const blob = await getBlob(src.fileKey);
        if (!blob || this.urls[id]) continue;
        this.urls[id] = 'still';
        this.stills[id] = new Still(blob, Math.max(W, H) * this.k * 1.2, () => (this.dirty = true));
        continue;
      }
      const blob = await getBlob(src.proxyKey || src.fileKey);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      this.urls[id] = url;
      if (src.kind === 'music') {
        const a = document.createElement('audio');
        a.preload = 'auto';
        a.src = url;
        a.loop = true;
        this.holder.appendChild(a);
        this.els[id] = a;
        decodeFile(blob).then((b) => this._audioReady(id, b), () => this._audioReady(id, null));
      } else if (src.kind === 'broll' && src.image) {
        // ảnh làm cảnh phụ (Pixabay / ảnh khách): giải mã 1 lần ra canvas cỡ khung xem, vẽ mỗi khung rất rẻ
        const im = new Image();
        im.onload = () => {
          const s = Math.min(1, Math.max((W * this.k * 1.3) / im.naturalWidth, (H * this.k * 1.3) / im.naturalHeight));
          const cv = document.createElement('canvas');
          cv.width = Math.max(2, Math.round(im.naturalWidth * s));
          cv.height = Math.max(2, Math.round(im.naturalHeight * s));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          this.imgs[id] = {img: cv, w: cv.width, h: cv.height};
          this.dirty = true;
        };
        im.src = url;
      } else if (src.kind === 'broll') {
        const el = makeVideo(url);
        el.addEventListener('seeked', () => (this.dirty = true));
        el.addEventListener('loadeddata', () => (this.dirty = true));
        this.holder.appendChild(el);
        this.els[id] = el;
      }
    }
    if (p.main && p.main.src !== this.mainId) this._attachMain(p.main.src, getBlob);
    if (!p.main && this.mainId) this._dropMain();
    this.dirty = true;
  }

  async _attachMain(id, getBlob) {
    this._dropMain();
    const url = this.urls[id];
    if (!url) return;
    this.mainId = id;
    if (url === 'still') {
      // chưa có bản xem nhanh: không tạo thẻ video, không giải mã tiếng (đợi bản xem nhanh rồi reload)
      this.mainOk = true;
      this.mainErr = false;
      return;
    }
    this.mainOk = false;
    this.mainErr = false;
    this.mains = [makeVideo(url), makeVideo(url), makeVideo(url)];
    for (const el of this.mains) {
      el.seekCost = 0.25;
      el.addEventListener('seeking', () => (el.seekT = performance.now()));
      el.addEventListener('seeked', () => {
        if (el.seekT) el.seekCost = el.seekCost * 0.5 + ((performance.now() - el.seekT) / 1000) * 0.5;
        el.seekT = 0;
      });
      el.addEventListener('seeked', () => {
        this.dirty = true;
        if (!this.playing && el === this.active) this._sync(false);
      });
      el.addEventListener('loadedmetadata', () => !this.playing && this._sync(true));
      el.addEventListener('loadeddata', () => {
        this.dirty = true;
        if (el.videoWidth) this.mainOk = true;
      });
      el.addEventListener('error', () => this._mainFail());
      this.holder.appendChild(el);
    }
    this.els[id] = this.mains[0];
    clearTimeout(this._okTimer);
    this._okTimer = setTimeout(() => {
      if (this.mainId === id && !this.mainOk) this._mainFail();
    }, 8000);
    this.bufs[id] = undefined;
    try {
      const src = this.p.sources[id];
      const blob = await getBlob(src.proxyKey || src.fileKey);
      const b = await decodePreviewAudio(blob);
      this._audioReady(id, b);
    } catch (e) {
      console.warn('Không giải mã được tiếng để xem nhanh, dùng tiếng của thẻ video', e);
      this._audioReady(id, null, true);
    }
  }

  _mainFail() {
    if (this.mainErr) return;
    this.mainErr = true;
    this.dirty = true;
    this.onMainError?.();
  }

  _audioReady(id, buf, failed) {
    if (!this.urls[id]) return;
    this.bufs[id] = buf;
    if (failed) this.bufs[id] = 'fail';
    if (this.playing) this._restart();
  }

  _drop(id) {
    if (id === this.mainId) this._dropMain();
    const el = this.els[id];
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    if (this.urls[id] && this.urls[id] !== 'still') URL.revokeObjectURL(this.urls[id]);
    if (this.stills[id]) this.stills[id].dead = true;
    delete this.stills[id];
    delete this.els[id];
    delete this.urls[id];
    delete this.bufs[id];
    delete this.holds[id];
    delete this.imgs[id];
  }

  _dropMain() {
    for (const el of this.mains) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    this.mains = [];
    this.active = null; // thẻ cũ đã gỡ src — giữ lại thì dự án mở sau đứng ở “Chưa có video” (lỗi 2/11)
    if (this.mainId) {
      delete this.els[this.mainId];
      delete this.holds[this.mainId];
    }
    this.mainId = null;
  }

  // bản xem nhanh của 1 nguồn vừa xong → gỡ khung tĩnh, gắn lại bằng bản xem nhanh (giữ nguyên vị trí đang xem)
  async reload(id) {
    if (!this.p || !this.getBlob) return;
    const wasMain = id === this.mainId;
    this._drop(id);
    if (wasMain) this.mainId = null;
    await this.attach(this.p, this.getBlob);
    this.dirty = true;
  }
  // video chính còn ở khung tĩnh (chưa có bản xem nhanh) → chưa phát được
  get stillMain() {
    return !!(this.mainId && this.stills[this.mainId]);
  }

  detach() {
    this.pause();
    for (const id of Object.keys(this.urls)) this._drop(id);
    this._dropMain();
    this.els = {};
    this.urls = {};
    this.bufs = {};
    this.holds = {};
    this.imgs = {};
    this.stills = {};
    this.p = null;
  }

  get D() {
    return this.p ? duration(this.p) : 0;
  }

  // ---------- âm thanh ----------
  _ctx() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch (e) {
        /* bỏ qua */
      }
      this.ac = new AC({latencyHint: 'interactive'});
      this.master = this.ac.createGain();
      this.master.connect(this.ac.destination);
      this.ac.onstatechange = () => {
        if (this.playing && this.ac.state === 'running' && this.mode !== 'wa') this._restart();
      };
    }
    return this.ac;
  }

  // Luồng tiếng để quay màn hình (máy không có bộ mã hoá video)
  audioStream() {
    const ac = this._ctx();
    if (!ac) return null;
    if (!this.dest) {
      this.dest = ac.createMediaStreamDestination();
      this.master.connect(this.dest);
    }
    return this.dest.stream;
  }

  // Chờ giải mã xong tiếng (dùng trước khi quay màn hình)
  async whenAudioReady(ms = 15000) {
    const t0 = performance.now();
    while (this.p?.main && this.bufs[this.p.main.src] === undefined && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 100));
  }

  _waReady() {
    if (!this.ac || this.ac.state !== 'running' || !this.p?.main) return false;
    const b = this.bufs[this.p.main.src];
    if (b === undefined || b === 'fail') return false;
    if (this.p.music && this.p.sources[this.p.music.src]) {
      const mb = this.bufs[this.p.music.src];
      if (mb === undefined) return false;
    }
    return true;
  }

  _stopNodes() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch (e) {
        /* đã dừng */
      }
      try {
        n.disconnect();
      } catch (e) {
        /* bỏ qua */
      }
    }
    this.nodes = [];
    this.musicGain = null;
  }

  _schedule() {
    const p = this.p;
    const ac = this.ac;
    this._stopNodes();
    const T0 = this.T;
    const a0 = ac.currentTime + 0.05;
    this.a0 = a0;
    this.aT0 = T0;
    const main = this.bufs[p.main.src];
    if (main) {
      const starts = segStarts(p);
      p.main.segs.forEach((s, i) => {
        const len = s.out - s.in;
        const end = starts[i] + len;
        if (end <= T0 + 0.01) return;
        const off = Math.max(0, T0 - starts[i]);
        const when = a0 + Math.max(0, starts[i] - T0);
        const dur = len - off;
        const node = ac.createBufferSource();
        node.buffer = main;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(1, when + FADE);
        g.gain.setValueAtTime(1, Math.max(when + FADE, when + dur - FADE));
        g.gain.linearRampToValueAtTime(0, when + dur);
        node.connect(g).connect(this.master);
        node.start(when, s.in + off, dur + 0.002);
        this.nodes.push(node, g);
      });
    }
    const mb = p.music && this.bufs[p.music.src];
    if (mb && mb !== 'fail') {
      const D = duration(p);
      const node = ac.createBufferSource();
      node.buffer = mb;
      node.loop = true;
      const g = ac.createGain();
      g.gain.value = Math.max(0, Math.min(1, p.music.vol ?? 0.2));
      node.connect(g).connect(this.master);
      node.start(a0, T0 % mb.duration);
      node.stop(a0 + Math.max(0, D - T0));
      this.nodes.push(node, g);
      this.musicGain = g;
    }
    // hiệu ứng âm thanh (SFX)
    for (const s of p.sfx || []) {
      const b = this.sfxBufs[s.sfx];
      if (b === undefined) {
        this.sfxBufs[s.sfx] = null;
        sfxBuffer(s.sfx, ac.sampleRate).then((buf) => {
          this.sfxBufs[s.sfx] = buf || 'fail';
          if (this.playing && this.mode === 'wa' && s.start > this.T + 0.15) this._restart();
        });
        continue;
      }
      if (!b || b === 'fail' || s.start + b.duration <= T0) continue;
      const off = Math.max(0, T0 - s.start);
      const node = ac.createBufferSource();
      node.buffer = b;
      const g = ac.createGain();
      g.gain.value = Math.max(0, Math.min(1.5, s.vol ?? 0.5));
      node.connect(g).connect(this.master);
      node.start(a0 + Math.max(0, s.start - T0), off);
      this.nodes.push(node, g);
    }
    this.sig = this._sig();
  }

  _sig() {
    const p = this.p;
    return JSON.stringify([p.main?.src, p.main?.segs, p.music?.src, (p.sfx || []).map((s) => [s.sfx, s.start, s.vol])]);
  }

  _latency() {
    const ac = this.ac;
    return (ac.outputLatency || 0) + (ac.baseLatency || 0);
  }

  // (Re)bắt đầu phát từ this.T theo chế độ phù hợp
  _restart() {
    if (!this.playing) return;
    if (this._waReady()) {
      this.mode = 'wa';
      this._schedule();
      for (const el of this.mains) el.muted = true;
      const mu = this.p.music && this.els[this.p.music.src];
      if (mu && !mu.paused) mu.pause();
    } else {
      this.mode = 'el';
      this._stopNodes();
      this.t0 = this.T;
      this.n0 = performance.now();
    }
    this._sync(true);
  }

  // ---------- điều khiển ----------
  play() {
    if (!this.p || !this.p.main) return;
    if (this.stillMain) {
      this.onNeedProxy?.();
      return;
    }
    if (this.T >= this.D - 0.05) this.T = 0;
    const ac = this._ctx();
    if (ac && ac.state !== 'running') ac.resume().catch(() => {});
    if (!this.silent) {
      this.silent = new Audio(SILENT_WAV);
      this.silent.loop = true;
    }
    this.silent.play().catch(() => {});
    this.playing = true;
    this._restart();
    this.onState?.(true);
  }

  pause() {
    this.playing = false;
    this._stopNodes();
    for (const el of this.mains) el.pause();
    for (const el of Object.values(this.els)) el.pause();
    this.silent?.pause();
    this.onState?.(false);
    this.dirty = true;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  seek(T) {
    this.T = Math.max(0, Math.min(this.D, T));
    if (this.playing) this._restart();
    else this._sync(true);
    this.dirty = true;
    this.onTime?.(this.T);
  }

  // Dự án vừa đổi (cắt/tách/xoá/nhạc…): phát lại lịch tiếng nếu cần
  refresh() {
    this.dirty = true;
    if (!this.p) return;
    ensureProjectFonts(this.p).then(() => (this.dirty = true));
    if (this.T > this.D) this.T = this.D;
    if (this.playing && this.mode === 'wa') {
      if (this._sig() !== this.sig) this._restart();
      else if (this.musicGain && this.p.music) this.musicGain.gain.value = Math.max(0, Math.min(1, this.p.music.vol ?? 0.2));
    } else this._sync(true);
  }

  // ---------- đồng bộ hình ----------
  _cue(el, i, t) {
    el.seg = i;
    el.cueT = t;
    if (!el.paused) el.pause();
    if (el.readyState >= 1 && Math.abs(el.currentTime - t) > 0.02) {
      try {
        el.currentTime = t;
      } catch (e) {
        /* chưa sẵn sàng */
      }
    } else if (el.readyState < 1) {
      el.addEventListener('loadedmetadata', () => el.seg === i && (el.currentTime = t), {once: true});
    }
  }

  _drive(el, t, play) {
    if (!el || el.readyState < 1) return;
    const d = el.currentTime - t;
    if (!play) {
      el.playbackRate = 1;
      if (!el.paused) el.pause();
      if (Math.abs(d) > 0.03 && !el.seeking) el.currentTime = t;
      return;
    }
    if (el.seeking) return;
    if (d > 0.06) {
      // hình đi trước tiếng → đứng chờ (giữ khung), không tua
      if (!el.paused) el.pause();
      if (d > 3) el.currentTime = t;
      return;
    }
    if (d < -0.45) {
      // hình tụt sau quá xa → tua VƯỢT LÊN đúng bằng thời gian tua đo được rồi chờ tiếng đuổi kịp (không tua đuổi mãi)
      el.playbackRate = 1;
      el.pause();
      el.currentTime = t + Math.max(0.15, Math.min(1.2, (el.seekCost || 0.25) * 1.3));
      return;
    }
    el.playbackRate = d < -0.04 ? Math.min(1.25, 1 - d * 1.5) : 1;
    if (el.paused) el.play().catch(() => {});
  }

  _sync(force) {
    const p = this.p;
    if (!p || !p.main || !this.mains.length) return;
    const segs = p.main.segs;
    const at = srcAt(p, this.T);
    if (!at) return;
    const i = at.i;
    const need = [i, i + 1, i + 2].filter((k) => k < segs.length);
    // thẻ “đã tua sẵn đúng đầu đoạn k” (đang tua thì xét điểm đích)
    const okCue = (e, k) => e.seg === k && Math.abs((e.seeking ? e.cueT : e.currentTime) - segs[k].in) < 0.08;
    let act = this.active && this.active.seg === i ? this.active : this.mains.find((e) => okCue(e, i));
    if (!act && this.active && this.active.seg === i - 1 && i > 0 && Math.abs(segs[i].in - segs[i - 1].out) < 0.06 && Math.abs(this.active.currentTime - at.t) < 0.3) {
      // đoạn nối liền đoạn trước (vd. chỉ tách) → giữ nguyên thẻ đang chạy
      act = this.active;
      act.seg = i;
    }
    const reserved = (e) => e === act || need.slice(1).some((k) => okCue(e, k));
    if (!act) {
      act = this.mains.find((e) => !reserved(e)) || this.mains[0];
      this._cue(act, i, at.t);
    }
    if (this.active && this.active !== act) this.active.seg = -1; // thẻ vừa phát xong đứng giữa đoạn → trả về làm thẻ rảnh
    this.active = act;
    // tua sẵn 2 đoạn kế tiếp vào các thẻ rảnh → tới chỗ cắt chỉ việc đổi thẻ
    for (const k of need.slice(1)) {
      if (this.mains.some((e) => e !== act && okCue(e, k))) continue;
      const el = this.mains.find((e) => !reserved(e));
      if (el) this._cue(el, k, segs[k].in);
    }
    for (const el of this.mains) {
      if (el === act) continue;
      if (!el.paused) el.pause();
      el.muted = true;
    }
    act.muted = !(this.playing && this.mode === 'el');
    this._drive(act, at.t, this.playing);
    if (force && !this.playing && Math.abs(act.currentTime - at.t) > 0.01 && !act.seeking) act.currentTime = at.t;

    // cảnh phụ: tua sẵn trước 2 giây, chạy khi tới lượt
    const act2 = new Set();
    for (const b of activeBrolls(p, this.T)) {
      const el = this.els[b.src];
      if (!el) continue;
      act2.add(b.src);
      this._drive(el, Math.min((el.duration || 99) - 0.05, b.in + (this.T - b.start)), this.playing);
    }
    for (const b of p.broll || []) {
      if (act2.has(b.src)) continue;
      const el = this.els[b.src];
      if (!el) continue;
      if (this.T < b.start && b.start - this.T < 2) {
        act2.add(b.src);
        this._cue(el, -1, b.in);
      }
    }
    for (const [id, el] of Object.entries(this.els)) {
      const src = p.sources[id];
      if (!src || src.kind !== 'broll' || act2.has(id)) continue;
      if (!el.paused) el.pause();
    }
    // nhạc nền chế độ dự phòng
    if (p.music && this.els[p.music.src]) {
      const a = this.els[p.music.src];
      if (this.playing && this.mode === 'el') {
        a.volume = Math.max(0, Math.min(1, p.music.vol ?? 0.2));
        const md = p.sources[p.music.src]?.duration || 1;
        const t = this.T % md;
        if (Math.abs(a.currentTime - t) > 0.4) a.currentTime = t;
        if (a.paused) a.play().catch(() => {});
      } else if (!a.paused) a.pause();
    }
  }

  // ---------- khung hình ----------
  // Khung giữ (holds): bản chép khung gần nhất, THU NHỎ đúng cỡ khung xem — vừa để khi video đang tua vẫn có hình
  // (không bao giờ vẽ khung xám), vừa rẻ hơn vẽ thẳng thẻ video 1080p/4K (đã đo 2/11: vẽ thẳng 12 khung/giây,
  // qua khung giữ 21 khung/giây khi CPU chậm ×4) → giữ cách chép mỗi khung.
  _hold(id, el, ok) {
    let h = this.holds[id];
    if (ok && el.videoWidth) {
      if (!h || h.vw !== el.videoWidth || h.vh !== el.videoHeight) {
        const cv = document.createElement('canvas');
        const s = Math.min(1, Math.max((W * this.k) / el.videoWidth, (H * this.k) / el.videoHeight) * 1.3);
        cv.width = Math.max(2, Math.round(el.videoWidth * s));
        cv.height = Math.max(2, Math.round(el.videoHeight * s));
        h = this.holds[id] = {cv, g: cv.getContext('2d'), vw: el.videoWidth, vh: el.videoHeight, ok: false};
      }
      try {
        h.g.drawImage(el, 0, 0, h.cv.width, h.cv.height);
        h.ok = true;
      } catch (e) {
        /* khung chưa sẵn */
      }
    }
    return h && h.ok ? {img: h.cv, w: h.cv.width, h: h.cv.height} : null;
  }

  frames() {
    const p = this.p;
    const fr = {main: null, broll: {}};
    const st = p.main && this.stills[p.main.src];
    if (st) {
      const at = srcAt(p, this.T);
      if (at) st.at(at.t);
      fr.main = st.frame();
    } else if (p.main && this.active) {
      const el = this.active;
      const at = srcAt(p, this.T);
      const ok = el.readyState >= 2 && !el.seeking && at && el.seg === at.i;
      fr.main = this._hold(p.main.src, el, ok);
    }
    for (const b of activeBrolls(p, this.T)) {
      if (this.imgs[b.src]) {
        fr.broll[b.id] = this.imgs[b.src];
        continue;
      }
      if (this.stills[b.src]) {
        this.stills[b.src].at(b.in + (this.T - b.start));
        fr.broll[b.id] = this.stills[b.src].frame();
        continue;
      }
      const el = this.els[b.src];
      if (!el) continue;
      fr.broll[b.id] = this._hold(b.src, el, el.readyState >= 2 && !el.seeking);
    }
    return fr;
  }
  // khung đang giữ, KHÔNG chép lại từ video (cho ảnh xem trước phong cách / công thức — rẻ)
  snap() {
    const p = this.p;
    const fr = {main: null, broll: {}};
    const h = p?.main && this.holds[p.main.src];
    if (h?.ok) fr.main = {img: h.cv, w: h.cv.width, h: h.cv.height};
    else if (p?.main && this.stills[p.main.src]?.ok) fr.main = this.stills[p.main.src].frame();
    if (!fr.main && p?.main) return this.frames();
    return fr;
  }

  _clock(now) {
    if (this.mode === 'wa' && this.ac) {
      const t = this.aT0 + Math.max(0, this.ac.currentTime - this.a0 - this._latency());
      return t;
    }
    // chế độ dự phòng: dừng đồng hồ khi video đang tua / chưa có hình → không nhảy cóc lời
    const el = this.active;
    const dt = (now - (this.nLast || now)) / 1000;
    if (el && (el.seeking || el.readyState < 3)) this.n0 += dt * 1000;
    return this.t0 + (now - this.n0) / 1000;
  }

  _tick(now) {
    requestAnimationFrame(this._tick);
    if (!this.p) return;
    if (this.p.main && !this.active && this.mains.length) this._sync(true);
    // dự án đổi đoạn cắt / nhạc trong lúc đang phát → xếp lại lịch tiếng
    if (this.playing && this.mode === 'wa' && ++this._n % 10 === 0 && this._sig() !== this.sig) this._restart();
    if (this.playing) {
      this.T = this._clock(now);
      if (this.T >= this.D) {
        this.T = this.D;
        this.pause();
        this.onEnd?.();
      } else this._sync(false);
      this.onTime?.(this.T);
      this.dirty = true;
    }
    this.nLast = now;
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.ctx;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    if (!this.p.main) {
      this._message('Chưa có video', 'Thêm video chính ở timeline bên dưới');
      return;
    }
    const fr = this.frames();
    if (!fr.main && this.mainErr) {
      this._message('Video chưa hiện được hình', 'Bấm “Sửa video” ở thanh trạng thái');
      return;
    }
    if (!fr.main) {
      // chưa có khung nào: chờ, không vẽ khung xám
      this.dirty = true;
      return;
    }
    this.boxes = drawFrame(g, this.p, this.T, fr);
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

  _message(a, b) {
    const g = this.ctx;
    g.fillStyle = '#12151b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5d6675';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 46px BVP, sans-serif';
    g.fillText(a, W / 2, H / 2 - 30);
    g.font = '500 34px BVP, sans-serif';
    g.fillText(b, W / 2, H / 2 + 34);
  }

  // Toạ độ chạm trên canvas → toạ độ khung gốc
  toComp(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H};
  }
  hitBox(x, y) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
  hit(x, y) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }
}
