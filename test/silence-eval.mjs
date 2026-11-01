// Chấm thuật toán cắt khoảng lặng bằng giọng nói tổng hợp có đáp án (test/../testmedia/gen)
import fs from 'fs';
import {findSilences, voiceFilter} from '../js/media.js';
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
  const cuts = findSilences({rms, win}, process.env.OPT ? JSON.parse(process.env.OPT) : undefined);
  // lời thật: khung 10 ms có năng lượng lời sạch > -55 dBFS
  const fl = Math.round(sr * 0.01);
  let clipped = 0, voiced = 0;
  const clipList = [];
  for (let i = 0; i + fl <= clean.length; i += fl) {
    let a = 0;
    for (let j = i; j < i + fl; j++) a += clean[j] * clean[j];
    const v = Math.sqrt(a / fl) > 0.0018;
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
    leftover += Math.max(0, kept - 0.3);
  }
  const cutTotal = cuts.reduce((s, c) => s + Math.min(c.b, x.length / sr) - c.a, 0);
  console.log(`${name}: ${cuts.length} chỗ cắt, bỏ ${cutTotal.toFixed(2)} s | LỜI BỊ CẮT MẤT ${clipped.toFixed(2)} s / ${voiced.toFixed(1)} s ${clipList.length ? '@' + [...new Set(clipList.map((t) => Math.floor(t * 2) / 2))].join(',') : ''} | khoảng nghỉ dài còn sót ${leftover.toFixed(2)} s`);
}
