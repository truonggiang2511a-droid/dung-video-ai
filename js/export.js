// Xuất MP4 ngay trên máy khách: vẽ từng khung bằng render.js → mã hoá WebCodecs → ghép MP4 bằng Mediabunny + AAC WebAssembly.
// Máy không có bộ mã hoá video (iPhone quá cũ) → quay thời gian thực bằng MediaRecorder.
import {W, H, FPS, drawFrame, duration, srcAt, activeBrolls, segStarts} from './render.js';

export class Cancelled extends Error {}

export async function exportVideo(p, getBlob, {res = 1080, onProgress, signal} = {}) {
  const m = await import('./engine.js');
  m.useAac();
  const k = res / 1080;
  const w = Math.round((W * k) / 2) * 2;
  const h = Math.round((H * k) / 2) * 2;
  const D = duration(p);
  const N = Math.max(1, Math.ceil(D * FPS));

  const codec = await m.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {width: w, height: h});
  if (!codec) throw new Error('NO_ENCODER');

  // mở các nguồn video
  const opened = {};
  const open = async (srcId) => {
    if (opened[srcId]) return opened[srcId];
    const s = p.sources[srcId];
    const input = new m.Input({source: new m.BlobSource(await getBlob(s.fileKey)), formats: m.ALL_FORMATS});
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`File “${s.name}” không có hình`);
    if (!(await track.canDecode())) throw new Error(`Máy này không giải mã được “${s.name}”`);
    const dw = track.displayWidth;
    const dh = track.displayHeight;
    const sc = Math.min(1, Math.max(w / dw, h / dh));
    const sink = new m.CanvasSink(track, {width: Math.round(dw * sc), height: Math.round(dh * sc), fit: 'fill', poolSize: 2});
    opened[srcId] = {input, track, sink, w: Math.round(dw * sc), h: Math.round(dh * sc)};
    return opened[srcId];
  };

  // lập kế hoạch từng khung: nguồn nào, ở giây nào
  const lists = {};
  const plan = [];
  const push = (key, t) => {
    (lists[key] ||= []).push(Math.max(0, t));
  };
  for (let i = 0; i < N; i++) {
    const T = i / FPS;
    const fp = {keys: []};
    const at = srcAt(p, T);
    if (at) {
      push('main', at.t);
      fp.keys.push(['main', null]);
    }
    for (const b of activeBrolls(p, T)) {
      const key = 'b:' + b.src;
      push(key, b.in + (T - b.start));
      fp.keys.push([key, b.id]);
    }
    plan.push(fp);
  }
  const iters = {};
  const meta = {};
  for (const key of Object.keys(lists)) {
    const srcId = key === 'main' ? p.main.src : key.slice(2);
    const o = await open(srcId);
    meta[key] = o;
    iters[key] = o.sink.canvasesAtTimestamps(lists[key])[Symbol.asyncIterator]();
  }

  // canvas đích
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', {alpha: false});
  ctx.imageSmoothingQuality = 'high';

  const target = new m.BufferTarget();
  const out = new m.Output({format: new m.Mp4OutputFormat({fastStart: 'in-memory'}), target});
  const vs = new m.CanvasSource(canvas, {codec, bitrate: Math.round(w * h * FPS * 0.2), keyFrameInterval: 2});
  out.addVideoTrack(vs, {frameRate: FPS});

  // âm thanh: ghép lời nói theo các đoạn giữ lại + nhạc nền
  onProgress?.(0, 'Chuẩn bị âm thanh');
  const audio = await buildAudio(p, getBlob, m, D);
  let as = null;
  if (audio) {
    as = new m.AudioBufferSource({codec: 'aac', bitrate: 160000});
    out.addAudioTrack(as);
  }
  await out.start();

  for (let i = 0; i < N; i++) {
    if (signal?.aborted) {
      await out.cancel();
      throw new Cancelled();
    }
    const fr = {main: null, broll: {}};
    for (const [key, id] of plan[i].keys) {
      const r = await iters[key].next();
      const wc = r.value;
      const f = wc ? {img: wc.canvas, w: meta[key].w, h: meta[key].h} : null;
      if (key === 'main') fr.main = f;
      else fr.broll[id] = f;
    }
    ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
    drawFrame(ctx, p, i / FPS, fr);
    await vs.add(i / FPS, 1 / FPS);
    if (i % 5 === 0) onProgress?.(i / N, 'Đang dựng khung hình');
  }
  if (as && audio) {
    onProgress?.(0.97, 'Ghép âm thanh');
    await as.add(audio);
  }
  await out.finalize();
  onProgress?.(1, 'Xong');
  return new Blob([target.buffer], {type: 'video/mp4'});
}

async function buildAudio(p, getBlob, m, D) {
  const src = p.sources[p.main.src];
  const input = new m.Input({source: new m.BlobSource(await getBlob(src.fileKey)), formats: m.ALL_FORMATS});
  const track = await input.getPrimaryAudioTrack();
  let sr = 48000;
  let L = null;
  let R = null;
  if (track) {
    let sink;
    if (await track.canDecode()) sink = new m.AudioBufferSink(track);
    else {
      // iPhone iOS < 26: không có AudioDecoder → giải mã cả file bằng Web Audio rồi cắt theo đoạn
      const {decodeWhole} = await import('./media.js');
      const whole = await decodeWhole(await getBlob(src.fileKey), 48000);
      sink = {
        async *buffers(a, b) {
          const s0 = Math.floor(a * whole.sampleRate);
          const s1 = Math.min(whole.length, Math.ceil(b * whole.sampleRate));
          if (s1 <= s0) return;
          const part = new AudioBuffer({length: s1 - s0, numberOfChannels: whole.numberOfChannels, sampleRate: whole.sampleRate});
          for (let c = 0; c < whole.numberOfChannels; c++) part.copyToChannel(whole.getChannelData(c).subarray(s0, s1), c);
          yield {buffer: part, timestamp: s0 / whole.sampleRate};
        },
      };
    }
    const starts = segStarts(p);
    for (let si = 0; si < p.main.segs.length; si++) {
      const seg = p.main.segs[si];
      for await (const {buffer, timestamp} of sink.buffers(seg.in, seg.out)) {
        if (!L) {
          sr = buffer.sampleRate;
          L = new Float32Array(Math.ceil(D * sr) + sr);
          R = new Float32Array(L.length);
        }
        const c0 = buffer.getChannelData(0);
        const c1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : c0;
        for (let j = 0; j < buffer.length; j++) {
          const st = timestamp + j / sr;
          if (st < seg.in || st >= seg.out) continue;
          const o = Math.round((starts[si] + st - seg.in) * sr);
          if (o < 0 || o >= L.length) continue;
          L[o] = c0[j];
          R[o] = c1[j];
        }
      }
      // làm mềm chỗ nối 8 ms tránh tiếng “bụp”
      const f = Math.round(0.008 * sr);
      const a = Math.round(starts[si] * sr);
      const b = Math.round((starts[si] + seg.out - seg.in) * sr);
      if (L) {
        for (let j = 0; j < f; j++) {
          const g = j / f;
          if (a + j < L.length) {
            L[a + j] *= g;
            R[a + j] *= g;
          }
          if (b - j - 1 >= 0 && b - j - 1 < L.length) {
            L[b - j - 1] *= g;
            R[b - j - 1] *= g;
          }
        }
      }
    }
  }
  if (!L) {
    L = new Float32Array(Math.ceil(D * sr));
    R = new Float32Array(L.length);
  }
  // nhạc nền
  if (p.music && p.sources[p.music.src]) {
    try {
      const mb = await getBlob(p.sources[p.music.src].fileKey);
      const ac = new OfflineAudioContext(2, 1, sr);
      const mu = await ac.decodeAudioData(await mb.arrayBuffer());
      const m0 = mu.getChannelData(0);
      const m1 = mu.numberOfChannels > 1 ? mu.getChannelData(1) : m0;
      const vol = p.music.vol ?? 0.2;
      const n = Math.ceil(D * sr);
      const fadeOut = Math.round(1.5 * sr);
      for (let j = 0; j < n; j++) {
        const q = j % m0.length;
        const g = vol * Math.min(1, (n - j) / fadeOut);
        L[j] += m0[q] * g;
        R[j] += m1[q] * g;
      }
    } catch (e) {
      console.warn('Không ghép được nhạc', e);
    }
  }
  const len = Math.ceil(D * sr);
  const buf = new AudioBuffer({length: len, numberOfChannels: 2, sampleRate: sr});
  buf.copyToChannel(L.subarray(0, len), 0);
  buf.copyToChannel(R.subarray(0, len), 1);
  return buf;
}

// Dự phòng: quay lại bản xem nhanh theo thời gian thực
export async function recordRealtime(player, {onProgress, signal} = {}) {
  const D = player.D;
  const stream = player.canvas.captureStream(FPS);
  // tiếng lấy từ bộ trộn Web Audio của bản xem nhanh (đã cắt liền mạch + nhạc nền)
  try {
    await player.whenAudioReady();
    const as = player.audioStream();
    for (const t of as?.getAudioTracks() || []) stream.addTrack(t);
  } catch (e) {
    /* không lấy được tiếng: vẫn quay hình */
  }
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  if (!type) throw new Error('Trình duyệt này không quay được video. Hãy mở bằng Safari/Chrome bản mới.');
  const rec = new MediaRecorder(stream, {mimeType: type, videoBitsPerSecond: 12_000_000});
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  player.seek(0);
  rec.start(500);
  player.play();
  await new Promise((res) => {
    const iv = setInterval(() => {
      onProgress?.(player.T / D, 'Đang quay thời gian thực');
      if (signal?.aborted || !player.playing) {
        clearInterval(iv);
        res();
      }
    }, 250);
  });
  player.pause();
  rec.stop();
  await done;
  if (signal?.aborted) throw new Cancelled();
  return new Blob(chunks, {type: type.split(';')[0]});
}
