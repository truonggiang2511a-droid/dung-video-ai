// Kho hiệu ứng âm thanh (SFX) — TỰ TỔNG HỢP bằng Web Audio, không dùng file của bên thứ ba
// → không vướng bản quyền, không tốn dung lượng tải, chạy cả khi mạng yếu.
// Mỗi âm: key, tên tiếng Việt, nhãn (để AI/khách tìm), độ dài, hàm dựng (đồ thị trên OfflineAudioContext).

function noiseSrc(c, len) {
  const n = Math.max(1, Math.ceil(len * c.sampleRate));
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}
function gainEnv(c, pts) {
  const g = c.createGain();
  g.gain.setValueAtTime(pts[0][1], pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const [t, v, kind] = pts[i];
    if (kind === 'exp') g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t);
    else g.gain.linearRampToValueAtTime(v, t);
  }
  return g;
}
function tone(c, out, {type = 'sine', f0, f1, t0 = 0, dur, vol = 0.6, attack = 0.004, curve = 'exp'}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) {
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    else o.frequency.linearRampToValueAtTime(f1, t0 + dur);
  }
  const g = gainEnv(c, [[t0, 0.0001], [t0 + attack, vol, 'exp'], [t0 + dur, 0.0001, 'exp']]);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  return o;
}
function burst(c, out, {t0 = 0, dur = 0.03, type = 'highpass', f = 2500, q = 0.7, vol = 0.6}) {
  const s = noiseSrc(c, dur + 0.02);
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = gainEnv(c, [[t0, 0.0001], [t0 + 0.002, vol, 'exp'], [t0 + dur, 0.0001, 'exp']]);
  s.connect(fl).connect(g).connect(out);
  s.start(t0);
  s.stop(t0 + dur + 0.02);
}
function sweepNoise(c, out, {t0 = 0, dur, f0, f1, f2, q = 1.2, vol = 0.8, peak = 0.45}) {
  const s = noiseSrc(c, dur + 0.05);
  const fl = c.createBiquadFilter();
  fl.type = 'bandpass';
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t0);
  fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur * peak);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = gainEnv(c, [[t0, 0.0001], [t0 + dur * peak, vol, 'exp'], [t0 + dur, 0.0001, 'exp']]);
  s.connect(fl).connect(g).connect(out);
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}
function bell(c, out, {f, t0 = 0, dur = 1.2, vol = 0.45}) {
  [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.93, 0.08]].forEach(([k, a], i) => tone(c, out, {f0: f * k, t0, dur: dur / (1 + i * 0.9), vol: vol * a, attack: 0.002}));
}

// BỘ MẪU 1 (skill batdongsan-editor, Giang duyệt 4/11 19:41 ở máy dựng HyperFrames): file thật trong public/sfx/ (~380 KB, tải khi dùng)
// gõ phím = đầu dòng phụ đề · chữ chạm A/B = mỗi cụm chữ 1 tiếng, đổi A ↔ B · vút êm / hơi thở = cảnh phụ vào · bụp nhẹ
const M1 = [
  {key: 'm1lka', name: 'Chữ chạm A (mẫu 1)', tags: ['chu', 'xuat hien', 'mau 1', 'nhan'], len: 0.3, file: 'sfx/m1-lk-a.wav'},
  {key: 'm1lkb', name: 'Chữ chạm B (mẫu 1)', tags: ['chu', 'xuat hien', 'mau 1', 'ting'], len: 0.82, file: 'sfx/m1-lk-b.wav'},
  {key: 'm1whoosh', name: 'Vút êm (mẫu 1)', tags: ['chuyen canh', 'vut', 'mau 1', 'canh phu'], len: 1.01, file: 'sfx/m1-whoosh.wav'},
  {key: 'm1air', name: 'Hơi thở (mẫu 1)', tags: ['chuyen canh', 'nhe', 'mau 1', 'hoa'], len: 1.21, file: 'sfx/m1-air.wav'},
  {key: 'm1thud', name: 'Bụp nhẹ (mẫu 1)', tags: ['nhan manh', 'tram', 'mau 1'], len: 0.3, file: 'sfx/m1-thud.wav'},
  ...[1, 2, 3, 4, 5, 6].map((n) => ({key: 'm1key' + n, name: 'Gõ phím (mẫu 1)', tags: ['go chu', 'phu de', 'mau 1'], len: 0.05, file: `sfx/m1-key${n}.wav`, hidden: n > 1})),
];
export const SFX = [
  ...M1,
  {key: 'whoosh', name: 'Vút', tags: ['chuyen canh', 'vut', 'luot'], len: 0.7, gen: (c, o) => sweepNoise(c, o, {dur: 0.68, f0: 250, f1: 2600, f2: 600, vol: 0.9})},
  {key: 'whip', name: 'Lia nhanh', tags: ['chuyen canh', 'lia', 'nhanh'], len: 0.35, gen: (c, o) => sweepNoise(c, o, {dur: 0.32, f0: 1200, f1: 6500, f2: 2500, q: 0.9, vol: 0.8, peak: 0.3})},
  {key: 'swoosh', name: 'Vút xuống', tags: ['chuyen canh', 'roi', 'xuong'], len: 0.55, gen: (c, o) => sweepNoise(c, o, {dur: 0.52, f0: 4000, f1: 900, f2: 250, vol: 0.85, peak: 0.25})},
  {key: 'riser', name: 'Dồn lên', tags: ['hoi hop', 'tang dan', 'mo man'], len: 1.6, gen: (c, o) => {
    sweepNoise(c, o, {dur: 1.55, f0: 200, f1: 5000, q: 2, vol: 0.55, peak: 0.97});
    tone(c, o, {type: 'sawtooth', f0: 110, f1: 880, dur: 1.55, vol: 0.12, attack: 1.4});
  }},
  {key: 'impact', name: 'Bùm', tags: ['nhan manh', 'bum', 'manh'], len: 1, gen: (c, o) => {
    tone(c, o, {f0: 130, f1: 38, dur: 0.6, vol: 1});
    burst(c, o, {dur: 0.35, type: 'lowpass', f: 500, vol: 0.7});
  }},
  {key: 'thud', name: 'Bụp trầm', tags: ['nhan manh', 'tram', 'xuat hien'], len: 0.4, gen: (c, o) => tone(c, o, {f0: 95, f1: 45, dur: 0.36, vol: 1})},
  {key: 'pop', name: 'Bụp', tags: ['xuat hien', 'chu', 'bat'], len: 0.16, gen: (c, o) => {
    tone(c, o, {f0: 950, f1: 180, dur: 0.1, vol: 0.9, attack: 0.002});
    burst(c, o, {dur: 0.012, f: 3000, vol: 0.35});
  }},
  {key: 'bubble', name: 'Bong bóng', tags: ['xuat hien', 'de thuong', 'hinh'], len: 0.2, gen: (c, o) => tone(c, o, {f0: 300, f1: 1300, dur: 0.14, vol: 0.8})},
  {key: 'ding', name: 'Ting', tags: ['y chinh', 'dung', 'meo'], len: 1.3, gen: (c, o) => bell(c, o, {f: 1318, dur: 1.25})},
  {key: 'cash', name: 'Tiền về (ka-ching)', tags: ['gia', 'tien', 'ban hang', 'khuyen mai'], len: 1, gen: (c, o) => {
    burst(c, o, {dur: 0.04, f: 3500, vol: 0.5});
    burst(c, o, {t0: 0.05, dur: 0.03, f: 4500, vol: 0.4});
    bell(c, o, {f: 2093, t0: 0.08, dur: 0.85, vol: 0.38});
    bell(c, o, {f: 2637, t0: 0.15, dur: 0.8, vol: 0.32});
  }},
  {key: 'coin', name: 'Đồng xu', tags: ['gia', 'tien', 'giam gia'], len: 0.45, gen: (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000;
    lp.connect(o);
    tone(c, lp, {type: 'square', f0: 988, dur: 0.08, vol: 0.25});
    tone(c, lp, {type: 'square', f0: 1319, t0: 0.08, dur: 0.36, vol: 0.25});
  }},
  {key: 'sparkle', name: 'Lấp lánh', tags: ['dep', 'lung linh', 'moi'], len: 1, gen: (c, o) => {
    for (let i = 0; i < 9; i++) tone(c, o, {f0: 2200 + Math.random() * 3200, t0: i * 0.075 + Math.random() * 0.03, dur: 0.18, vol: 0.22});
  }},
  {key: 'success', name: 'Thành công', tags: ['xong', 'dung', 'ket'], len: 0.8, gen: (c, o) => {
    [523, 659, 784, 1046].forEach((f, i) => tone(c, o, {type: 'triangle', f0: f, t0: i * 0.09, dur: 0.4, vol: 0.45}));
  }},
  {key: 'notify', name: 'Thông báo', tags: ['nhac', 'thong bao', 'theo doi'], len: 0.55, gen: (c, o) => {
    tone(c, o, {type: 'triangle', f0: 880, dur: 0.16, vol: 0.5});
    tone(c, o, {type: 'triangle', f0: 1318, t0: 0.13, dur: 0.4, vol: 0.5});
  }},
  {key: 'wrong', name: 'Sai rồi', tags: ['sai', 'loi', 'khong nen'], len: 0.6, gen: (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.connect(o);
    tone(c, lp, {type: 'square', f0: 311, dur: 0.22, vol: 0.35});
    tone(c, lp, {type: 'square', f0: 208, t0: 0.2, dur: 0.38, vol: 0.35});
  }},
  {key: 'click', name: 'Bấm', tags: ['bam', 'chon', 'nut'], len: 0.06, gen: (c, o) => burst(c, o, {dur: 0.045, f: 2500, vol: 0.8})},
  {key: 'typing', name: 'Gõ phím', tags: ['go chu', 'ban phim', 'chu chay'], len: 0.85, gen: (c, o) => {
    let t = 0;
    for (let i = 0; i < 8; i++) {
      burst(c, o, {t0: t, dur: 0.035, type: 'bandpass', f: 1800 + Math.random() * 1600, q: 1.5, vol: 0.5 + Math.random() * 0.3});
      t += 0.07 + Math.random() * 0.05;
    }
  }},
  {key: 'shutter', name: 'Chụp ảnh', tags: ['anh', 'chup', 'khoanh khac'], len: 0.25, gen: (c, o) => {
    burst(c, o, {dur: 0.04, type: 'bandpass', f: 3000, q: 1, vol: 0.8});
    burst(c, o, {t0: 0.09, dur: 0.06, type: 'bandpass', f: 2200, q: 1, vol: 0.7});
  }},
  {key: 'glitch', name: 'Nhiễu', tags: ['loi', 'nhieu', 'cong nghe'], len: 0.4, gen: (c, o) => {
    const osc = c.createOscillator();
    osc.type = 'square';
    for (let t = 0; t < 0.38; t += 0.02) osc.frequency.setValueAtTime(100 + Math.random() * 1900, t);
    const g = c.createGain();
    for (let t = 0; t < 0.38; t += 0.02) g.gain.setValueAtTime(Math.random() > 0.3 ? 0.22 : 0, t);
    g.gain.setValueAtTime(0, 0.38);
    osc.connect(g).connect(o);
    osc.start(0);
    osc.stop(0.4);
  }},
  {key: 'heartbeat', name: 'Tim đập', tags: ['hoi hop', 'tim', 'cam xuc'], len: 0.9, gen: (c, o) => {
    tone(c, o, {f0: 70, f1: 42, dur: 0.14, vol: 1});
    tone(c, o, {f0: 64, f1: 40, t0: 0.24, dur: 0.16, vol: 0.85});
  }},
  {key: 'boing', name: 'Lò xo', tags: ['vui', 'hai huoc', 'nay'], len: 0.6, gen: (c, o) => {
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(180, 0);
    osc.frequency.exponentialRampToValueAtTime(420, 0.55);
    const lfo = c.createOscillator();
    lfo.frequency.value = 16;
    const lg = c.createGain();
    lg.gain.setValueAtTime(90, 0);
    lg.gain.exponentialRampToValueAtTime(2, 0.55);
    lfo.connect(lg).connect(osc.frequency);
    const g = gainEnv(c, [[0, 0.0001], [0.01, 0.6, 'exp'], [0.58, 0.0001, 'exp']]);
    osc.connect(g).connect(o);
    osc.start(0);
    lfo.start(0);
    osc.stop(0.6);
    lfo.stop(0.6);
  }},
  {key: 'tick', name: 'Tích tắc', tags: ['dong ho', 'thoi gian', 'dem nguoc'], len: 0.55, gen: (c, o) => {
    tone(c, o, {f0: 1900, dur: 0.035, vol: 0.6, attack: 0.001});
    tone(c, o, {f0: 1400, t0: 0.27, dur: 0.035, vol: 0.6, attack: 0.001});
  }},
  // 2/11 chiều — thêm âm theo ngành (vẫn tự tổng hợp)
  {key: 'sizzle', name: 'Xèo xèo', tags: ['chien', 'xao', 'nau an', 'nong', 'am thuc'], len: 1.4, gen: (c, o) => {
    for (let i = 0; i < 26; i++) burst(c, o, {t0: i * 0.05 + Math.random() * 0.03, dur: 0.02 + Math.random() * 0.03, type: 'highpass', f: 4000 + Math.random() * 3000, vol: 0.25 + Math.random() * 0.35});
    sweepNoise(c, o, {dur: 1.35, f0: 5000, f1: 7000, f2: 4500, q: 0.6, vol: 0.35, peak: 0.2});
  }},
  {key: 'pour', name: 'Rót nước', tags: ['rot', 'do uong', 'nuoc', 'cafe'], len: 1.1, gen: (c, o) => {
    for (let i = 0; i < 18; i++) tone(c, o, {f0: 500 + i * 40 + Math.random() * 80, f1: 900 + i * 50, t0: i * 0.055, dur: 0.06, vol: 0.18, attack: 0.003});
    sweepNoise(c, o, {dur: 1.05, f0: 900, f1: 2200, f2: 1500, q: 2, vol: 0.4, peak: 0.6});
  }},
  {key: 'page', name: 'Lật trang', tags: ['trang sach', 'kien thuc', 'chuong', 'buoc'], len: 0.5, gen: (c, o) => {
    sweepNoise(c, o, {dur: 0.42, f0: 1200, f1: 5000, f2: 2500, q: 0.8, vol: 0.7, peak: 0.35});
    burst(c, o, {t0: 0.36, dur: 0.05, type: 'bandpass', f: 1800, vol: 0.4});
  }},
  {key: 'marker', name: 'Bút dạ', tags: ['viet', 'bang trang', 'gach chan', 'ghi chu'], len: 0.6, gen: (c, o) => {
    sweepNoise(c, o, {dur: 0.28, f0: 2500, f1: 3600, f2: 2800, q: 6, vol: 0.5, peak: 0.5});
    sweepNoise(c, o, {t0: 0.3, dur: 0.24, f0: 2800, f1: 3900, f2: 3000, q: 6, vol: 0.45, peak: 0.5});
  }},
  {key: 'stamp', name: 'Đóng dấu', tags: ['tem', 'dau', 'chot', 'xac nhan'], len: 0.45, gen: (c, o) => {
    tone(c, o, {f0: 140, f1: 55, dur: 0.3, vol: 1});
    burst(c, o, {dur: 0.06, type: 'lowpass', f: 900, vol: 0.9});
    burst(c, o, {t0: 0.02, dur: 0.04, type: 'highpass', f: 3000, vol: 0.3});
  }},
  {key: 'chime', name: 'Chuông gió', tags: ['nhe nhang', 'mo dau', 'dep', 'thu gian'], len: 2.2, gen: (c, o) => {
    [1568, 1976, 2349, 2637, 3136].forEach((f, i) => bell(c, o, {f, t0: i * 0.11 + Math.random() * 0.04, dur: 1.8, vol: 0.22}));
  }},
  {key: 'recbeep', name: 'Bíp máy quay', tags: ['rec', 'quay', 'bat dau', 'may quay'], len: 0.5, gen: (c, o) => {
    tone(c, o, {type: 'square', f0: 2093, dur: 0.09, vol: 0.25, attack: 0.002});
    tone(c, o, {type: 'square', f0: 2093, t0: 0.16, dur: 0.12, vol: 0.25, attack: 0.002});
  }},
  {key: 'drumhit', name: 'Trống chốt', tags: ['chot', 'manh', 'ket', 'nhan'], len: 0.7, gen: (c, o) => {
    tone(c, o, {f0: 180, f1: 45, dur: 0.5, vol: 1});
    burst(c, o, {dur: 0.18, type: 'bandpass', f: 2200, q: 0.5, vol: 0.55});
    burst(c, o, {t0: 0.01, dur: 0.4, type: 'highpass', f: 6000, vol: 0.18});
  }},
  {key: 'cheer', name: 'Vỗ tay', tags: ['vo tay', 'chuc mung', 'hoan ho', 'thanh cong'], len: 1.6, gen: (c, o) => {
    for (let i = 0; i < 60; i++) burst(c, o, {t0: Math.random() * 1.35, dur: 0.015 + Math.random() * 0.02, type: 'bandpass', f: 1200 + Math.random() * 1800, q: 1.2, vol: 0.25 + Math.random() * 0.3});
  }},
  {key: 'swishup', name: 'Vút lên', tags: ['len', 'tang', 'xuat hien', 'bay'], len: 0.55, gen: (c, o) => sweepNoise(c, o, {dur: 0.5, f0: 400, f1: 6000, q: 1.6, vol: 0.85, peak: 0.85})},
];
export const SFX_MAP = Object.fromEntries(SFX.map((s) => [s.key, s]));

const cache = new Map();
// file âm thanh (bộ mẫu 1) → đổi về đúng tần số lấy mẫu của nơi phát / xuất (Safari cũ: decodeAudioData kiểu gọi lại)
async function fileBuffer(def, sr) {
  const ab = await (await fetch(def.file)).arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const c = new Ctx(1, 1, sr);
  return await new Promise((res, rej) => {
    const pr = c.decodeAudioData(ab, res, rej);
    if (pr && pr.then) pr.then(res, rej);
  });
}
// Dựng 1 lần rồi nhớ (theo tần số lấy mẫu). Âm tự tổng hợp: chuẩn hoá đỉnh 0,85; file mẫu 1: giữ nguyên mức của bộ mẫu.
export function sfxBuffer(key, sr = 48000) {
  const def = SFX_MAP[key];
  if (!def) return Promise.resolve(null);
  const id = key + '@' + sr;
  if (!cache.has(id)) {
    if (def.file) {
      cache.set(id, fileBuffer(def, sr).catch(() => null));
      return cache.get(id);
    }
    cache.set(
      id,
      (async () => {
        const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const c = new Ctx(1, Math.ceil((def.len + 0.05) * sr), sr);
        const out = c.createGain();
        out.connect(c.destination);
        def.gen(c, out);
        const buf = await c.startRendering();
        const d = buf.getChannelData(0);
        let pk = 0;
        for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
        if (pk > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.85 / pk;
        return buf;
      })().catch(() => null),
    );
  }
  return cache.get(id);
}
// Nghe thử trong bảng sửa / kho
let ac0 = null;
export async function playSfx(key, vol = 0.8) {
  ac0 = ac0 || new (window.AudioContext || window.webkitAudioContext)();
  if (ac0.state !== 'running') await ac0.resume();
  const b = await sfxBuffer(key, ac0.sampleRate);
  if (!b) return;
  const s = ac0.createBufferSource();
  s.buffer = b;
  const g = ac0.createGain();
  g.gain.value = vol;
  s.connect(g).connect(ac0.destination);
  s.start();
}
