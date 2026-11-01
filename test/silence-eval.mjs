// Chấm thuật toán cắt khoảng lặng bằng giọng nói tổng hợp có đáp án (test/../testmedia/gen)
import fs from 'fs';
import {findSilences, voiceFilter, voicing, CUT_PACE} from '../js/media.js';
import {retakeCuts, fillerCuts, mergeRanges} from '../js/ai.js';
const G = '/home/claude/testmedia/gen/';
function readWav(f) {
  const b = fs.readFileSync(f);
  const sr = b.readUInt32LE(24);
  let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
  return {x, sr};
}
function npy(f) {
  const b = fs.readFileSync(f);
  const hl = b.readUInt16LE(8);
  return new Float32Array(b.buffer.slice(b.byteOffset + 10 + hl));
}
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['speech_quiet', 'speech_noisy']) {
  const {x, sr} = readWav(G + name + '.wav');
  const clean = npy(G + name + '_clean.npy');
  const win = 0.02, wl = Math.round(sr * win);
  const rms = [];
  const vf = process.env.RAW ? (v) => v : voiceFilter(sr);
  const fx = x.map((v) => vf(v));
  for (let i = 0; i + wl <= x.length; i += wl) {
    let a = 0;
    for (let j = i; j < i + wl; j++) a += fx[j] * fx[j];
    rms.push(Math.sqrt(a / wl));
  }
  // 16 kHz mono như app (lấy trung bình 3 mẫu 48 kHz) → độ có giọng
  const pcm16 = new Float32Array(Math.floor(x.length / 3));
  for (let i = 0; i < pcm16.length; i++) pcm16[i] = (x[3 * i] + x[3 * i + 1] + x[3 * i + 2]) / 3;
  const voi = process.env.OLD ? null : voicing(pcm16, win);
  // WORDS=1: giả lập lời chép Whisper từ đáp án (mỗi câu = 1 “chữ”, đầu chữ sớm 0,3 s như Whisper hay lệch)
  const t0 = JSON.parse(fs.readFileSync(G + name + '.json'));
  // WORDS=2: chữ thật của từng câu (cả câu nói lại) rải đều theo thời gian câu → thử phát hiện câu nói lại
  let words = process.env.WORDS ? t0.speech.map(([a, b]) => ({w: 'x', s: Math.max(0, a - 0.3), e: b})) : null;
  if (process.env.WORDS === '2' && t0.all) {
    words = [];
    for (const [a, b, , txt] of t0.all) {
      const ws = String(txt).split(/\s+/);
      ws.forEach((w, i) => words.push({w, s: a + ((b - a) * i) / ws.length - (i === 0 ? 0.25 : 0), e: a + ((b - a) * (i + 0.85)) / ws.length}));
    }
  }
  const pace = CUT_PACE[process.env.PACE || 'tight'];
  const opt = {...pace, ...(process.env.OPT ? JSON.parse(process.env.OPT) : {}), words};
  let cuts = findSilences({rms, win, voi}, process.env.OLD ? {} : opt);
  if (words && process.env.WORDS === '2') cuts = mergeRanges([...cuts, ...retakeCuts(words, pace), ...fillerCuts(words, pace)]);
  // lời thật: khung 10 ms có năng lượng lời sạch > ngưỡng (giọng máy: -55 dBFS; giọng người thật InfoRe có ồn phòng thu ~-50 dB → -42 dBFS)
  const truth0 = JSON.parse(fs.readFileSync(G + name + '.json'));
  const thr = Math.pow(10, (truth0.th ?? -55) / 20);
  const fl = Math.round(sr * 0.01);
  let clipped = 0, voiced = 0;
  const clipList = [];
  for (let i = 0; i + fl <= clean.length; i += fl) {
    let a = 0;
    for (let j = i; j < i + fl; j++) a += clean[j] * clean[j];
    const v = Math.sqrt(a / fl) > thr;
    if (!v) continue;
    voiced += 0.01;
    const t = i / sr;
    if (cuts.some((c) => t >= c.a && t < c.b)) {
      clipped += 0.01;
      clipList.push(t.toFixed(2));
    }
  }
  // khoảng nghỉ dài (≥0,35 s) còn sót: tính phần nghỉ thật bị giữ lại vượt quá 0,1 s mỗi bên
  const truth = JSON.parse(fs.readFileSync(G + name + '.json'));
  let leftover = 0;
  const sp = truth.speech;
  for (let k = 0; k < sp.length - 1; k++) {
    const a = sp[k][1], b = sp[k + 1][0];
    if (b - a < 0.35) continue;
    let kept = 0;
    for (let t = a; t < b; t += 0.01) if (!cuts.some((c) => t >= c.a && t < c.b)) kept += 0.01;
    leftover += Math.max(0, kept - (process.env.OLD ? 0.3 : pace.pre + pace.post + 0.05));
    if (process.env.DETAIL) console.log(`   nghỉ ${a.toFixed(2)}–${b.toFixed(2)} (${(b - a).toFixed(2)} s) giữ ${kept.toFixed(2)} s`);
  }
  const inCut = (a, b) => {
    let k = 0;
    for (let t = a; t < b; t += 0.01) if (cuts.some((c) => t >= c.a && t < c.b)) k += 0.01;
    return k / Math.max(0.01, b - a);
  };
  const br = (truth.breaths || []).map(([a, b]) => inCut(a, b));
  const rt = (truth.retakes || []).map(([a, b]) => inCut(a, b));
  const extra = (rt.length ? ` | câu nói lại bị bỏ ${Math.round((rt.reduce((p, q) => p + q, 0) / rt.length) * 100)}%` : '') + (truth.breaths ? ` | tiếng thở bị cắt ${Math.round((br.reduce((p, q) => p + q, 0) / Math.max(1, br.length)) * 100)}%` : '');
  const cutTotal = cuts.reduce((s, c) => s + Math.min(c.b, x.length / sr) - c.a, 0);
  console.log(`${name}: ${cuts.length} chỗ cắt, bỏ ${cutTotal.toFixed(2)} s | LỜI BỊ CẮT MẤT ${clipped.toFixed(2)} s / ${voiced.toFixed(1)} s ${clipList.length ? '@' + [...new Set(clipList.map((t) => Math.floor(t * 2) / 2))].join(',') : ''} | khoảng nghỉ dài còn sót ${leftover.toFixed(2)} s${extra}`);
}
