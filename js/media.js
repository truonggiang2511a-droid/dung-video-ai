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
  if (!(await track.canDecode())) throw new Error('Máy này không giải mã được âm thanh của video');
  const total = await input.computeDuration();
  const sink = new m.AudioBufferSink(track);
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
  for await (const {buffer, timestamp} of sink.buffers()) {
    if (!rate) {
      rate = buffer.sampleRate;
      winLen = Math.round(rate * win);
      rsStep = rate / 16000;
    }
    const chs = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
    const n = buffer.length;
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const ch of chs) v += ch[i];
      v /= chs.length;
      acc += v * v;
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

// Tìm các khoảng lặng cần cắt (giây nguồn). min 0,35 s, chừa 0,1 s mỗi bên (theo skill batdongsan-editor)
export function findSilences(an, {min = 0.35, keep = 0.1} = {}) {
  const {rms, win} = an;
  if (!rms.length) return [];
  const sorted = [...rms].sort((a, b) => a - b);
  const q = (x) => sorted[Math.floor((sorted.length - 1) * x)];
  const noise = q(0.12);
  const speech = q(0.85);
  const thr = Math.max(noise * 2, noise + (speech - noise) * 0.18, 0.004);
  const silent = rms.map((x) => x < thr);
  const out = [];
  let i = 0;
  const N = silent.length;
  while (i < N) {
    if (!silent[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < N && silent[j]) j++;
    const a = i * win;
    const b = j * win;
    const isHead = i === 0;
    const isTail = j >= N;
    if (b - a >= min || isHead || isTail) {
      const ca = isHead ? 0 : a + keep;
      const cb = isTail ? N * win + 1 : b - keep;
      if (cb - ca > 0.15) out.push({a: ca, b: cb});
    }
    i = j;
  }
  return out;
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
export async function importFile(p, file, kind) {
  const isAudio = kind === 'music' || /^audio\//.test(file.type);
  const meta = isAudio ? await probeAudio(file) : await probeVideo(file);
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
