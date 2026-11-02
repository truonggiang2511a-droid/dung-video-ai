// Nhập file video/nhạc: đo thời lượng, ảnh nhỏ cho timeline, sóng âm, tìm khoảng lặng.
import {uid} from './model.js';
import {store} from './store.js';

const engine = () => import('./engine.js');

export function probeVideo(blob) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const url = URL.createObjectURL(blob);
    const done = (x, err) => {
      URL.revokeObjectURL(url);
      err ? rej(err) : res(x);
    };
    v.onloadedmetadata = () => done({duration: v.duration, w: v.videoWidth, h: v.videoHeight});
    v.onerror = () => done(null, new Error('Không đọc được file video này'));
    v.src = url;
  });
}

function probeAudio(blob) {
  return new Promise((res, rej) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      res({duration: a.duration});
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error('Không đọc được file nhạc này'));
    };
    a.src = url;
  });
}

// Trình duyệt có hiện được hình của video này không (vd. HEVC/H.265 của iPhone trên Chrome máy tính thường KHÔNG)
function canShow(blob) {
  if (globalThis.DV_NO_VIDEO_TAG) return Promise.resolve(false); // kiểm thử: giả máy không phát được file (như HEVC trên Chrome)
  return new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const url = URL.createObjectURL(blob);
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
      res(ok);
    };
    const t = setTimeout(() => fin(v.videoWidth > 0 && v.readyState >= 2), 6000);
    v.onloadeddata = () => fin(v.videoWidth > 0);
    v.onerror = () => fin(false);
    v.src = url;
  });
}

const CODEC_NAME = {hevc: 'HEVC (H.265)', avc: 'H.264', vp9: 'VP9', av1: 'AV1', prores: 'ProRes'};

// Bảo đảm video phát được trong trình duyệt này; không được thì tự đổi sang H.264 (nếu máy giải mã được), không thì báo cách xử lý.
// force = true: luôn đổi (nút “Sửa video” cho dự án cũ).
// Bản đổi: khung gốc mỗi 1 giây (mặc định thư viện là 5 giây → tua rất chậm, xem nhanh bị khựng), cạnh dài tối đa 1920 (đủ cho xuất 1080p).
export async function ensurePlayable(file, onMsg, force = false, lazy = false) {
  const meta = await probeVideo(file).catch(() => null);
  if (!force && meta && meta.w > 0 && (await canShow(file))) return {file, meta};
  const m = await engine();
  const input = new m.Input({source: new m.BlobSource(file), formats: m.ALL_FORMATS});
  let track = null;
  try {
    track = await input.getPrimaryVideoTrack();
  } catch (e) {
    track = null;
  }
  const name = file.name || 'video';
  if (!track) throw new Error(`File “${name}” không có hình hoặc định dạng lạ. Hãy chọn file video MP4/MOV.`);
  const codec = CODEC_NAME[track.codec] || track.codec || 'không rõ';
  if (!(await track.canDecode())) {
    let tip = `Trình duyệt này chưa đọc được video định dạng ${codec}. Hãy thử Safari, Edge hoặc Chrome bản mới, hoặc xuất lại video dạng MP4 (H.264).`;
    if (track.codec === 'hevc') {
      // Phân biệt: máy KHÔNG đọc được HEVC nói chung, hay chỉ không đọc được bản HDR 10-bit / 4K của iPhone
      const str = (await track.getCodecParameterString().catch(() => '')) || '';
      const hdr = (await track.hasHighDynamicRange?.().catch(() => false)) || /^(hvc1|hev1)\.2\./.test(str);
      const big = Math.max(track.displayWidth || 0, track.displayHeight || 0) > 2000;
      let basic = false;
      try {
        basic = typeof VideoDecoder !== 'undefined' && (await VideoDecoder.isConfigSupported({codec: 'hvc1.1.6.L120.B0', codedWidth: 1920, codedHeight: 1080})).supported === true;
      } catch (e) {}
      const kind = [hdr && 'HDR 10-bit', big && '4K'].filter(Boolean).join(', ');
      tip = basic && kind
        ? `Video quay iPhone dạng HEVC (H.265) ${kind} — máy này đọc được HEVC thường nhưng chưa đọc được bản ${kind}. Cách nhanh: trên iPhone vào Cài đặt → Camera → Quay video → TẮT “Video HDR” (và chọn 1080p) rồi quay lại cảnh này; hoặc mở app bằng Safari / Microsoft Edge.`
        : `Video quay iPhone dạng HEVC (H.265)${kind ? ' ' + kind : ''} — trình duyệt này chưa đọc được. Cách nhanh: mở app bằng Microsoft Edge hoặc Safari; hoặc trên iPhone vào Cài đặt → Camera → Định dạng → chọn “Tương thích nhất” rồi quay lại.`;
    }
    throw new Error(tip);
  }
  // 2/11 (Giang: “bỏ video 4K HEVC lên là hiện hình luôn”): KHÔNG bắt khách chờ đổi định dạng — giữ FILE GỐC (xuất video lấy file gốc,
  // giữ đủ chất lượng), hình xem trước giải mã từng khung bằng WebCodecs, bản xem nhanh 720p đổi chạy nền (makeProxy)
  if (lazy) {
    const dur = await input.computeDuration().catch(() => 0);
    return {file, meta: {duration: dur || meta?.duration || 0, w: track.displayWidth || track.codedWidth, h: track.displayHeight || track.codedHeight}, proxy: true};
  }
  // giải mã được bằng WebCodecs nhưng thẻ <video> không hiện → đổi sang H.264 ngay trên máy
  m.useAac();
  const dw = track.displayWidth || track.codedWidth;
  const dh = track.displayHeight || track.codedHeight;
  const k = Math.min(1, 1920 / Math.max(dw, dh));
  const even = (x) => Math.max(2, Math.round(x / 2) * 2);
  const target = new m.BufferTarget();
  const output = new m.Output({format: new m.Mp4OutputFormat({fastStart: 'in-memory'}), target});
  const video = {codec: 'avc', quality: m.QUALITY_HIGH, keyFrameInterval: 1};
  if (k < 1) Object.assign(video, {width: even(dw * k), height: even(dh * k), fit: 'contain'});
  const conv = await m.Conversion.init({input, output, video, audio: {codec: 'aac'}});
  if (!conv.isValid) throw new Error(`Không đổi được video ${codec} sang H.264 trên máy này. Hãy mở app bằng Safari hoặc Edge.`);
  conv.onProgress = (x) => onMsg?.(`Video dạng ${codec} — đang đổi sang H.264 để phát mượt… ${Math.round(x * 100)}%`);
  onMsg?.(`Video dạng ${codec} — đang đổi sang H.264 để phát mượt…`);
  await conv.execute();
  const out = new File([target.buffer], name.replace(/\.[^.]+$/, '') + '.mp4', {type: 'video/mp4'});
  const meta2 = await probeVideo(out);
  return {file: out, meta: meta2};
}

// BẢN XEM NHANH (proxy) cho video trình duyệt không phát được (4K HEVC HDR iPhone trên Chrome máy tính): H.264 chạy nền, chỉ để XEM —
// xuất video vẫn lấy file gốc. Đo 2/11 (Chromium không GPU, 30 s 4K60): thu đúng 1/2 (cạnh dài 1920) 103 s · 1280 151 s · 960 300 s ·
// ép 30 khung/giây CHẬM hơn (118 s) → 4K thu đúng 1/2, giữ số khung gốc. Thời gian gần như do giải mã 4K quyết định (phải giải mã đủ mọi khung).
export async function makeProxy(blob, kind, onProgress, hold = {}) {
  const m = await engine();
  m.useAac();
  const input = new m.Input({source: new m.BlobSource(blob), formats: m.ALL_FORMATS});
  const track = await input.getPrimaryVideoTrack();
  const dw = track.displayWidth || track.codedWidth;
  const dh = track.displayHeight || track.codedHeight;
  const big = Math.max(dw, dh);
  const long = big >= 2560 ? Math.min(1920, big / 2) : Math.min(1280, big);
  const k = Math.min(1, long / big);
  const even = (x) => Math.max(2, Math.round(x / 2) * 2);
  const video = {codec: 'avc', quality: m.QUALITY_MEDIUM, keyFrameInterval: 1};
  if (k < 1) Object.assign(video, {width: even(dw * k), height: even(dh * k), fit: 'contain'});
  const target = new m.BufferTarget();
  const output = new m.Output({format: new m.Mp4OutputFormat({fastStart: 'in-memory'}), target});
  const conv = await m.Conversion.init({input, output, video, audio: kind === 'main' ? {codec: 'aac'} : {discard: true}});
  if (!conv.isValid) throw new Error('Máy này không tạo được bản xem nhanh');
  conv.onProgress = (x) => onProgress?.(x);
  hold.conv = conv;
  await conv.execute();
  return new File([target.buffer], 'xemnhanh.mp4', {type: 'video/mp4'});
}
// ảnh nhỏ timeline bằng WebCodecs (khi thẻ <video> không đọc được file)
export async function mbThumbs(blob, n, height = 96) {
  const m = await engine();
  const input = new m.Input({source: new m.BlobSource(blob), formats: m.ALL_FORMATS});
  const track = await input.getPrimaryVideoTrack();
  const dur = await input.computeDuration();
  const w = Math.max(2, Math.round((height * (track.displayWidth || 9)) / (track.displayHeight || 16)));
  const sink = new m.CanvasSink(track, {width: w, height, fit: 'fill', poolSize: 1});
  const keys = new m.EncodedPacketSink(track);
  const out = [];
  for (let i = 0; i < n; i++) {
    // lấy đúng khung gốc gần nhất → chỉ giải mã 1 khung/ảnh (4K HEVC: giải mã tới giữa nhóm khung rất chậm)
    let t = Math.min(dur - 0.05, ((i + 0.5) / n) * dur);
    const kp = await keys.getKeyPacket(t, {metadataOnly: true}).catch(() => null);
    if (kp) t = kp.timestamp;
    const r = await sink.getCanvas(t);
    if (r) out.push(r.canvas.toDataURL ? r.canvas.toDataURL('image/jpeg', 0.6) : await blobUrl(await r.canvas.convertToBlob({type: 'image/jpeg', quality: 0.6})));
  }
  return out;
}
const blobUrl = (b) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(b);
});

// Chụp vài khung nhỏ để vẽ dải ảnh trên timeline
export async function thumbs(blob, n, height = 96) {
  try {
    return await Promise.race([videoThumbs(blob, n, height), new Promise((_, j) => setTimeout(() => j(new Error('chậm')), 8000))]);
  } catch (e) {
    return mbThumbs(blob, n, height); // HEVC 4K iPhone trên Chrome máy tính: giải mã bằng WebCodecs
  }
}
async function videoThumbs(blob, n, height = 96) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const url = URL.createObjectURL(blob);
  v.src = url;
  await new Promise((r, j) => {
    v.onloadeddata = r;
    v.onerror = j;
  });
  if (!v.videoWidth) {
    URL.revokeObjectURL(url);
    throw new Error('không có hình');
  }
  const c = document.createElement('canvas');
  const w = Math.round((height * v.videoWidth) / v.videoHeight) || 54;
  c.width = w;
  c.height = height;
  const g = c.getContext('2d');
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(v.duration - 0.05, ((i + 0.5) / n) * v.duration);
    await new Promise((r) => {
      const ok = () => {
        v.removeEventListener('seeked', ok);
        r();
      };
      v.addEventListener('seeked', ok);
      v.currentTime = t;
      setTimeout(ok, 1500);
    });
    g.drawImage(v, 0, 0, w, height);
    out.push(c.toDataURL('image/jpeg', 0.6));
  }
  URL.revokeObjectURL(url);
  return out;
}

// Phân tích âm thanh: độ lớn mỗi 20 ms (tìm khoảng lặng), sóng âm 10 điểm/giây, âm 16 kHz mono cho phiên âm
export async function analyzeAudio(blob, onProgress) {
  const m = await engine();
  const input = new m.Input({source: new m.BlobSource(blob), formats: m.ALL_FORMATS});
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const total = await input.computeDuration();
  // iPhone iOS < 26 chưa có AudioDecoder (WebCodecs) → giải mã cả file bằng Web Audio
  const sink = (await track.canDecode()) ? new m.AudioBufferSink(track) : {buffers: async function* () {
    yield {buffer: await decodeWhole(blob, 16000), timestamp: 0};
  }};
  const win = 0.02;
  const rms = [];
  const pcm16 = [];
  let acc = 0;
  let cnt = 0;
  let winLen = 0;
  let rate = 0;
  let rsAcc = 0;
  let rsCnt = 0;
  let rsStep = 1;
  let vf = null;
  for await (const {buffer, timestamp} of sink.buffers()) {
    if (!rate) {
      rate = buffer.sampleRate;
      winLen = Math.round(rate * win);
      rsStep = rate / 16000;
    }
    if (!vf) vf = voiceFilter(rate);
    const chs = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
    const n = buffer.length;
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const ch of chs) v += ch[i];
      v /= chs.length;
      const fv = vf(v);
      acc += fv * fv;
      cnt++;
      if (cnt >= winLen) {
        rms.push(Math.sqrt(acc / cnt));
        acc = 0;
        cnt = 0;
      }
      rsAcc += v;
      rsCnt++;
      if (rsCnt >= rsStep) {
        pcm16.push(rsAcc / rsCnt);
        rsAcc = 0;
        rsCnt -= rsStep;
        if (rsCnt < 0) rsCnt = 0;
      }
    }
    if (onProgress && total) onProgress(Math.min(1, (timestamp + buffer.duration) / total));
  }
  const peaks = [];
  for (let i = 0; i < rms.length; i += 5) peaks.push(Math.max(...rms.slice(i, i + 5)));
  const mx = Math.max(0.0001, ...peaks);
  return {
    rms,
    win,
    peaks: peaks.map((x) => Math.round((x / mx) * 100)),
    pcm16: Float32Array.from(pcm16),
    voi: voicing(pcm16, win),
    duration: total,
  };
}

// Lọc dải tiếng nói (bỏ ù gió/xe dưới 180 Hz và xì trên 5 kHz) trước khi đo độ lớn → nhận lời chuẩn hơn ở ngoài trời
export function voiceFilter(sr) {
  const bq = (type, f0, q) => {
    const w = (2 * Math.PI * f0) / sr;
    const al = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    let b0, b1, b2;
    if (type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    const a0 = 1 + al;
    const k = [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => {
      const y = k[0] * x + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    };
  };
  const hp = bq('hp', 180, 0.707);
  const lp = bq('lp', Math.min(5000, sr * 0.45), 0.707);
  return (x) => lp(hp(x));
}

// Mức âm (dB) của video: ồn nền, lời nói, 2 ngưỡng VAD — dùng chung cho cắt khoảng lặng & lọc lời chép
export function levels(an, {hiK = [3.5, 8, 0.2], loK = [2, 4, 0.08]} = {}) {
  const db = an.rms.map((x) => 20 * Math.log10(x + 1e-7));
  const sorted = [...db].sort((a, b) => a - b);
  const q = (x) => sorted[Math.floor((sorted.length - 1) * x)] ?? -100;
  const noise = q(0.1);
  const speech = q(0.92);
  const range = speech - noise;
  return {db, noise, speech, range, hi: noise + Math.max(hiK[0], Math.min(hiK[1], range * hiK[2])), lo: noise + Math.max(loK[0], Math.min(loK[1], range * loK[2]))};
}

// Độ "có giọng" từng khung 20 ms (0…1): tự tương quan chuẩn hoá lớn nhất trong dải cao độ giọng người 70–400 Hz.
// Tiếng Việt là tiếng có thanh điệu — MỌI âm tiết đều có nguyên âm hữu thanh → khung có cao độ rõ = có người nói,
// còn xe chạy, gió, quạt, tiếng xì… gần như không có cao độ → không bị nhận nhầm là lời dù to.
export function voicing(pcm16, win = 0.02) {
  const n = Math.floor(pcm16.length / 2);
  const x = new Float32Array(n);
  let prev = 0;
  let hp = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const v = (pcm16[2 * i] + pcm16[2 * i + 1]) / 2; // 8 kHz
    hp = 0.92 * (hp + v - prev); // bỏ ù dưới ~100 Hz
    prev = v;
    lp += 0.5 * (hp - lp); // giữ phần dưới ~900 Hz (cao độ + formant 1)
    x[i] = lp;
  }
  const hop = Math.round(8000 * win);
  const M = 240;
  const L0 = 20; // 400 Hz
  const L1 = 114; // 70 Hz
  const sq = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sq[i + 1] = sq[i] + x[i] * x[i];
  const F = Math.floor(n / hop);
  const out = new Float32Array(F);
  for (let f = 0; f < F; f++) {
    const s = Math.max(0, f * hop + hop / 2 - (M + L1) / 2) | 0;
    if (s + M + L1 >= n) break;
    const e0 = sq[s + M] - sq[s];
    if (e0 < 1e-9) continue;
    let best = 0;
    for (let L = L0; L <= L1; L++) {
      let c = 0;
      for (let k = 0; k < M; k++) c += x[s + k] * x[s + k + L];
      if (c <= 0) continue;
      const e1 = sq[s + L + M] - sq[s + L];
      const r = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r > best) best = r;
    }
    out[f] = best;
  }
  return out;
}

// Tìm các khoảng lặng cần cắt (giây nguồn).
// Có độ "có giọng" (an.voi) → VAD theo cao độ + ồn nền CỤC BỘ (±1,5 s): đúng cả ngoài đường, quán ồn, có quạt/ù điện.
// Không có → VAD 2 ngưỡng theo dB như cũ.
// words (lời chép Whisper, giây nguồn) nếu có: chữ được giữ chắc chắn; khoảng không có chữ ≥ 0,5 s thì bỏ qua tiếng nền có cao độ
// (người khác nói, nhạc) nhỏ hơn giọng chính ≥ 8 dB.
// pre/post: phần nghỉ giữ lại trước/sau lời (nhịp cắt: tự nhiên 0,12/0,18 · gọn 0,08/0,12 · rất gọn 0,05/0,08).
export const CUT_PACE = {
  natural: {label: 'Tự nhiên', min: 0.45, pre: 0.12, post: 0.18},
  tight: {label: 'Gọn', min: 0.3, pre: 0.08, post: 0.12},
  snappy: {label: 'Rất gọn', min: 0.22, pre: 0.05, post: 0.08},
};
export function findSilences(an, {min = 0.3, pre = 0.08, post = 0.12, hiK = [3.5, 8, 0.2], loK = [2, 4, 0.08], words = null, vt = 0.5, dbg = null} = {}) {
  const {rms, win} = an;
  const N = rms.length;
  if (!N) return [];
  const {db, hi, lo, noise, speech} = levels(an, {hiK, loK});
  const sp = new Uint8Array(N);
  let voiOk = !!an.voi && an.voi.length > N * 0.8;
  if (voiOk) {
    const voi = an.voi;
    // ồn nền cục bộ: phân vị 10% trong cửa sổ ±1,5 s (tính mỗi 5 khung)
    const nl = new Float32Array(N);
    const half = Math.round(1.5 / win);
    for (let c = 0; c < N; c += 5) {
      const arr = Array.from(db.slice(Math.max(0, c - half), Math.min(N, c + half))).sort((p, q) => p - q);
      const v = Math.min(arr[Math.floor(arr.length * 0.1)] ?? noise, noise + 12);
      nl.fill(v, c, Math.min(N, c + 5));
    }
    if (dbg) dbg.nl = nl;
    // 1) lõi lời: cao độ rõ (≥ 0,62) chỉ cần to hơn ồn cục bộ 2,5 dB (câu nói nhỏ vẫn giữ);
    //    cao độ vừa (≥ vt) phải to hơn ồn cục bộ 6 dB (tránh nhận nhầm tiếng nền)
    const core = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const v = voi[i] || 0;
      if ((v >= 0.62 && db[i] >= Math.max(nl[i] + 2.5, noise + 2)) || (v >= vt && db[i] >= Math.max(nl[i] + 6, noise + 4))) core[i] = 1;
    }
    // 2) nới hai đầu lõi cho phụ âm đầu (≤ 0,2 s) và đuôi chữ xuống giọng (≤ 0,25 s) khi còn to hơn ồn cục bộ 3 dB
    sp.set(core);
    for (let i = 0; i < N; i++) {
      if (!core[i] || (i > 0 && core[i - 1])) continue;
      for (let k = 1; k <= Math.round(0.2 / win) && i - k >= 0 && !sp[i - k] && db[i - k] >= nl[i - k] + 3; k++) sp[i - k] = 1;
    }
    for (let i = N - 1; i >= 0; i--) {
      if (!core[i] || (i < N - 1 && core[i + 1])) continue;
      for (let k = 1; k <= Math.round(0.25 / win) && i + k < N && !sp[i + k] && db[i + k] >= nl[i + k] + 3; k++) sp[i + k] = 1;
    }
    // bỏ đốm "lời" lẻ < 0,1 s mà nhỏ hơn giọng chính ≥ 15 dB (tiếng động có cao độ thoáng qua)
    for (let i = 0; i < N; ) {
      if (!sp[i]) {
        i++;
        continue;
      }
      let j = i;
      let pk = -999;
      while (j < N && sp[j]) pk = Math.max(pk, db[j++]);
      if ((j - i) * win < 0.1 && pk < speech - 15) sp.fill(0, i, j);
      i = j;
    }
    // An toàn: phần to rõ của file mà phần lớn KHÔNG có cao độ giọng nói (nhạc, tiếng máy, giọng thì thầm, file thử) →
    // không tin bộ nghe cao độ, quay về cách cắt theo độ lớn âm (không bao giờ cắt mất cả đoạn to)
    let A = 0;
    let S = 0;
    for (let i = 0; i < N; i++) if (db[i] >= hi) A++, sp[i] && S++;
    if (A * win > 1 && S < 0.5 * A) {
      voiOk = false;
      sp.fill(0);
    }
    if (dbg) dbg.voiced = A ? S / A : 1;
  }
  if (voiOk) {
    // 3) có lời chép: khoảng trống ≥ 0,5 s giữa 2 chữ → xoá "lời" nhỏ hơn giọng chính ≥ 8 dB (người khác nói, nhạc nền)
    if (words?.length > 3) {
      for (let k = -1; k < words.length; k++) {
        const ga = k < 0 ? 0 : words[k].e;
        const gb = k + 1 < words.length ? words[k + 1].s : N * win;
        if (gb - ga < 0.5) continue;
        // lề nhỏ vì bước cắt còn chừa đệm trước/sau lời (mốc Whisper hay SỚM ở đầu chữ → đã an toàn phía sau)
        const i0 = Math.ceil((ga + 0.05) / win);
        const i1 = Math.floor((gb - 0.02) / win);
        for (let i = i0; i < i1; ) {
          if (!sp[i]) {
            i++;
            continue;
          }
          let j = i;
          let pk = -999;
          while (j < i1 && sp[j]) pk = Math.max(pk, db[j++]);
          if (pk < speech - 8) sp.fill(0, i, j);
          i = j;
        }
      }
      // chữ Whisper chắc chắn là lời (giữ phần lõi giữa chữ — mốc Whisper có thể lệch 0,3 s nên không nới)
      for (const w of words) {
        const m = (w.s + w.e) / 2;
        const i0 = Math.floor(Math.max(w.s, m - 0.08) / win);
        const i1 = Math.ceil(Math.min(w.e, m + 0.08) / win);
        for (let i = Math.max(0, i0); i < Math.min(N, i1); i++) sp[i] = 1;
      }
    }
    // 4) gộp lỗ < 0,15 s trong lời (âm tắc giữa chữ)
    for (let i = 0; i < N; ) {
      if (sp[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < N && !sp[j]) j++;
      if (i > 0 && j < N && (j - i) * win < 0.15) sp.fill(1, i, j);
      i = j;
    }
  }
  if (!voiOk) {
    // 1) vùng chắc chắn có lời: vượt ngưỡng cao; lan ra hai bên khi còn trên ngưỡng thấp
    for (let i = 0; i < N; i++) if (db[i] >= hi) sp[i] = 1;
    for (let i = 1; i < N; i++) if (!sp[i] && sp[i - 1] && db[i] >= lo) sp[i] = 1;
    for (let i = N - 2; i >= 0; i--) if (!sp[i] && sp[i + 1] && db[i] >= lo) sp[i] = 1;
    // 2) bỏ mẩu "lời" quá ngắn mà không đủ to (tiếng gõ, lách cách): < 0,1 s và đỉnh < ngưỡng cao + 6 dB
    for (let i = 0; i < N; ) {
      if (!sp[i]) {
        i++;
        continue;
      }
      let j = i;
      let peak = -999;
      while (j < N && sp[j]) peak = Math.max(peak, db[j++]);
      if ((j - i) * win < 0.1 && peak < hi + 6) sp.fill(0, i, j);
      i = j;
    }
  }
  if (dbg) dbg.sp = sp;
  // khoảng không lời ≥ min → cắt, chừa đệm hai bên
  const out = [];
  for (let i = 0; i < N; ) {
    if (sp[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < N && !sp[j]) j++;
    const a = i * win;
    const b = j * win;
    const isHead = i === 0;
    const isTail = j >= N;
    if (b - a >= min || isHead || isTail) {
      const ca = isHead ? 0 : a + post;
      const cb = isTail ? N * win + 1 : b - pre;
      // bỏ quá ít (< 0,18 s) thì không cắt: được chẳng bao nhiêu mà thêm 1 cú nhảy hình
      if (cb - ca >= (isHead || isTail ? 0.08 : 0.18)) out.push({a: ca, b: cb});
    }
    i = j;
  }
  return out;
}

// Giải mã cả file bằng Web Audio (dự phòng cho máy thiếu AudioDecoder)
export async function decodeWhole(blob, sampleRate) {
  const ac = new OfflineAudioContext(1, 1, sampleRate);
  const buf = await blob.arrayBuffer();
  return await new Promise((res, rej) => {
    const pr = ac.decodeAudioData(buf, res, rej);
    if (pr && pr.then) pr.then(res, rej);
  });
}

// WAV 16 kHz mono 16-bit để gửi phiên âm
export function wav16(pcm) {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([buf], {type: 'audio/wav'});
}

// Thêm một file vào dự án
export async function importFile(p, file, kind, onMsg, extra = {}) {
  // ảnh (Pixabay / ảnh khách) làm cảnh phụ: không có thời lượng thật → cho dài tối đa 60 s, cắt bao nhiêu cũng được
  if (/^image\//.test(file.type)) {
    const bm = await createImageBitmap(file);
    const id = uid('s');
    const fileKey = p.id + '/' + id;
    await store.putFile(fileKey, file);
    const c = document.createElement('canvas');
    c.height = 96;
    c.width = Math.max(2, Math.round((96 * bm.width) / bm.height));
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    const src = {id, kind: 'broll', image: true, name: (file.name || 'anh').replace(/\.[^.]+$/, ''), fileKey, duration: 60, w: bm.width, h: bm.height, thumbs: [c.toDataURL('image/jpeg', 0.7)], peaks: null, mtime: file.lastModified || 0, ...extra};
    bm.close?.();
    p.sources[id] = src;
    return src;
  }
  const isAudio = kind === 'music' || /^audio\//.test(file.type);
  let meta;
  if (isAudio) meta = await probeAudio(file);
  let proxy = false;
  const _t0 = performance.now();
  if (!isAudio) ({file, meta, proxy} = await ensurePlayable(file, onMsg, false, !globalThis.DV_OLD_IMPORT));
  const id = uid('s');
  const fileKey = p.id + '/' + id;
  const _t1 = performance.now();
  await store.putFile(fileKey, file);
  if (proxy) console.info(`Nạp file: kiểm ${((_t1 - _t0) / 1000).toFixed(1)} s, lưu ${((performance.now() - _t1) / 1000).toFixed(1)} s`);
  const src = {id, kind, name: (file.name || 'video').replace(/\.[^.]+$/, ''), fileKey, duration: meta.duration, w: meta.w || 0, h: meta.h || 0, thumbs: [], peaks: null, mtime: file.lastModified || 0, ...extra};
  if (proxy) src.proxy = 'pending';
  const _t = performance.now(); // bản xem nhanh đổi chạy nền (main.js runProxies), file gốc giữ để xuất
  if (!isAudio) {
    try {
      src.thumbs = proxy ? await mbThumbs(file, kind === 'main' ? 14 : 1) : await thumbs(file, kind === 'main' ? 14 : 1);
    } catch (e) {
      src.thumbs = [];
    }
    if (proxy) console.info(`Ảnh timeline (WebCodecs): ${((performance.now() - _t) / 1000).toFixed(1)} s`);
  }
  p.sources[id] = src;
  return src;
}
