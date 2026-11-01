// Gợi ý cài app lên màn hình chính + kiểm tra máy có xuất được video không.
export function iosVersion() {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) || !m) return null;
  return +m[1] + +m[2] / 10;
}
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const inAppBrowser = () => /FBAN|FBAV|Instagram|Zalo|Line\/|TikTok|musical_ly/i.test(navigator.userAgent);

// Máy có xuất được MP4 không
export function canExport() {
  return 'VideoEncoder' in window || ('MediaRecorder' in window && HTMLCanvasElement.prototype.captureStream);
}

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  document.dispatchEvent(new Event('can-install'));
});

const SHARE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8"/></svg>';

// Trả về nội dung thẻ hướng dẫn (hoặc null nếu không cần)
export function installCard() {
  if (isStandalone()) return null;
  const v = iosVersion();
  if (inAppBrowser()) {
    return {
      title: 'Mở bằng trình duyệt để dùng đầy đủ',
      body: 'Bạn đang mở trong Zalo/Facebook. Bấm nút ⋯ ở góc trên → <b>Mở bằng trình duyệt</b> (Safari hoặc Chrome) để cài app và xuất được video.',
      action: null,
    };
  }
  if (isIOS()) {
    if (v && v < 16.4) {
      return {
        title: 'Cần cập nhật iPhone',
        body: `Máy đang chạy iOS ${v.toFixed(1)}. Để dựng và xuất video, hãy vào <b>Cài đặt → Cài đặt chung → Cập nhật phần mềm</b> (iOS 16.4 trở lên).`,
        action: null,
        block: true,
      };
    }
    return {
      title: 'Cài app lên màn hình chính',
      body: `Mở nhanh như app thật, toàn màn hình: bấm nút <b>Chia sẻ</b> ${SHARE_ICON} ở thanh dưới Safari → kéo xuống chọn <b>Thêm vào MH chính</b> → <b>Thêm</b>.`,
      action: null,
    };
  }
  if (deferred) {
    return {
      title: 'Cài app lên máy',
      body: 'Mở nhanh từ màn hình chính, toàn màn hình, không cần vào trình duyệt.',
      action: {
        label: 'Cài app',
        run: async () => {
          deferred.prompt();
          await deferred.userChoice;
          deferred = null;
        },
      },
    };
  }
  return null;
}
