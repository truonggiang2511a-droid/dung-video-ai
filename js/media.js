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
    const t = setTimeout(() => fin(v.videoWidth > 0 && v.readyState >= 2), 12000);
    v.onloadeddata = () => fin(v.videoWidth > 0);
    v.onerror = () => fin(false);
    v.src = url;
  });
}

const CODEC_NAME = {hevc: 'HEVC (H.265)', avc: 'H.264', vp9: 'VP9', av1: 'AV1', prores: 'ProRes'};

// Bảo đảm video phát được trong trình duyệt này; không được thì tự đổi sang H.264 (nếu máy giải mã được), không thì báo cách xử lý.
// force = true: luôn đổi (nút “Sửa video” cho dự án cũ).
// Bản đổi: khung gốc mỗi 1 giây (mặc định thư viện là 5 giây → tua rất chậm, xem nhanh bị khựng), cạnh dài tối đa 1920 (đủ cho xuất 1080p).
export async function ensurePlayable(file, onMsg, force = false) {
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
    const tip = track.codec === 'hevc'
      ? 'Video quay iPhone dạng HEVC (H.265) — trình duyệt này chưa đọc được. Cách nhanh: mở app bằng Safari hoặc Microsoft Edge; hoặc trên iPhone vào Cài đặt → Camera → Định dạng → chọn “Tương thích nhất” rồi quay lại.'
      : `Trình duyệt này chưa đọc được video định dạng ${codec}. Hãy thử Safari, Edge hoặc Chrome bản mới, hoặc xuất lại video dạng MP4 (H.264).`;
    throw new Error(tip);
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

// Chụp vài khung nhỏ để vẽ dải ảnh trên timeline
export async function thumbs(blob, n, height = 96) {
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

// Tìm các khoảng lặng cần cắt (giây nguồn) — kiểu VAD 2 ngưỡng:
//  - đo theo dB so với tiếng ồn nền của CHÍNH video này (yên tĩnh hay ngoài trời đều đúng)
//  - ngưỡng cao để nhận chắc chắn có lời, ngưỡng thấp để nới hai đầu lời (âm đầu nhẹ, cuối câu xuống giọng không bị mất)
//  - giữ 0,1 s trước lời và 0,15 s sau lời; chỉ cắt khoảng nghỉ ≥ 0,35 s (theo skill batdongsan-editor); bỏ tiếng lách cách lẻ
export function findSilences(an, {min = 0.35, pre = 0.1, post = 0.15, hiK = [3.5, 8, 0.2], loK = [2, 4, 0.08]} = {}) {
  const {rms, win} = an;
  const N = rms.length;
  if (!N) return [];
  const db = rms.map((x) => 20 * Math.log10(x + 1e-7));
  const sorted = [...db].sort((a, b) => a - b);
  const q = (x) => sorted[Math.floor((N - 1) * x)];
  const noise = q(0.1);
  const speech = q(0.92);
  const range = speech - noise;
  // video gần như không có chỗ nghỉ rõ (ồn lớn / nhạc nền to) → chỉ cắt đầu/cuối thật sự im
  const hi = noise + Math.max(hiK[0], Math.min(hiK[1], range * hiK[2]));
  const lo = noise + Math.max(loK[0], Math.min(loK[1], range * loK[2]));
  // 1) vùng chắc chắn có lời: vượt ngưỡng cao; lan ra hai bên khi còn trên ngưỡng thấp
  const sp = new Uint8Array(N);
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
  // 3) khoảng không lời ≥ min → cắt, chừa đệm hai bên
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
      if (cb - ca > 0.12) out.push({a: ca, b: cb});
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
export async function importFile(p, file, kind, onMsg) {
  const isAudio = kind === 'music' || /^audio\//.test(file.type);
  let meta;
  if (isAudio) meta = await probeAudio(file);
  else ({file, meta} = await ensurePlayable(file, onMsg));
  const id = uid('s');
  const fileKey = p.id + '/' + id;
  await store.putFile(fileKey, file);
  const src = {id, kind, name: (file.name || 'video').replace(/\.[^.]+$/, ''), fileKey, duration: meta.duration, w: meta.w || 0, h: meta.h || 0, thumbs: [], peaks: null};
  if (!isAudio) {
    try {
      src.thumbs = await thumbs(file, kind === 'main' ? 14 : 1);
    } catch (e) {
      src.thumbs = [];
    }
  }
  p.sources[id] = src;
  return src;
}
