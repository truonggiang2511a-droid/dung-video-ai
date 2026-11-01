// Gói nặng (Mediabunny + bộ mã hoá AAC WebAssembly) — chỉ tải khi cần phân tích âm thanh hoặc xuất video.
export {
  Input,
  ALL_FORMATS,
  BlobSource,
  AudioBufferSink,
  CanvasSink,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
  canEncodeAudio,
  Conversion,
} from 'mediabunny';
import {registerAacEncoder} from '@mediabunny/aac-encoder';

let aac = false;
export function useAac() {
  if (aac) return;
  // Luôn dùng AAC WebAssembly: iPhone/Android hay thiếu AAC gốc → file mất tiếng (bài học Vị Trí Studio 10/2026)
  registerAacEncoder();
  aac = true;
}
