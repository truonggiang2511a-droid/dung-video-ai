# CLAUDE.md — Dựng Video AI (app dựng video bất động sản cho môi giới)

Đọc file này trước khi sửa bất cứ thứ gì. Dự án TÁCH RIÊNG khỏi Vị Trí Studio (repo `vi-tri-studio`) — không sửa, không deploy chung,
không đụng tên miền / Pixel / quảng cáo của Vị Trí Studio.

Chủ dự án: Giang (tiếng Việt). Mọi chữ khách nhìn thấy (giao diện, thông báo, lỗi, tooltip): tiếng Việt. Tên biến/hàm: tiếng Anh.
Không tuyên bố "đã build/chạy được" khi chưa thật sự chạy lệnh và thấy kết quả.

---

## 0. Cách làm việc với Giang (áp dụng cho MỌI yêu cầu — lấy từ CLAUDE.md của vi-tri-studio, mục 0)

**Phản biện trước, làm sau.** Mỗi yêu cầu xét theo **mục tiêu thật** (môi giới làm được video đẹp nhanh, chịu trả tiền; app chạy ổn
trên điện thoại cũ) chứ không làm theo nguyên văn.
1. Nêu ngắn mục tiêu thật đằng sau yêu cầu.
2. Đối chiếu repo + file này: cái gì **đã có**, cái gì **xung đột** điều đã chốt (mục 3), cái gì **sai kỹ thuật/dữ liệu** (kiểm tài liệu thật).
3. Nói thẳng chi phí/rủi ro (tiền API, giấy phép, iPhone cũ, quảng cáo) + đề xuất hướng tốt hơn, chia giai đoạn nhỏ, có công tắc bật/tắt.
4. Chỉ hỏi quyết định thật sự thuộc về Giang. Yêu cầu rõ, rẻ để làm lại → làm luôn, ghi đã chọn gì.
5. Giang vẫn chọn hướng của mình sau phản biện → làm theo, ghi vào nhật ký mục 5.

Giang cho phép tự bổ sung/sửa file này khi thấy thiếu/sai so với code thật (kiểm chứng trước khi ghi).

---

## 1. Kiến trúc

| Phần | Ở đâu | Ghi chú |
|---|---|---|
| Giao diện (nguồn) | `index.html`, `css/app.css`, `js/*.js`, `public/` (font, icon, manifest) | JS thuần, không framework |
| Bản chạy | `site/` — tạo bằng `bash build.sh` (esbuild, tách gói `engine` nặng chỉ tải khi phân tích âm thanh/xuất) | KHÔNG sửa tay `site/` |
| Máy chủ | `worker.js` (Cloudflare Worker + assets `./site`), cấu hình `wrangler.toml` | Route: `/api/health`, `/api/transcribe`, `/api/ai` |
| Lưu trữ | IndexedDB trên máy khách (`js/store.js`): dự án + file video | Video KHÔNG gửi lên máy chủ. Chỉ âm thanh 16 kHz gửi đi chép lời |
| **Bản chạy thật** | Cloudflare Worker `dung-video-ai` → https://dung-video-ai.truonggiang2511a.workers.dev (Workers Builds nối repo, nhánh `main`: build `npm ci && bash build.sh`, deploy `npx wrangler deploy`; push `main` là tự deploy ~1 phút) | Tạo 1/11 10:58 trong cùng tài khoản Cloudflare với Vị Trí Studio (Worker riêng, không đụng nhau) |
| Bản thử cũ | Netlify — chỉ giao diện, KHÔNG có /api → app tự chạy "bộ dựng cơ bản". 1/11: tài khoản Netlify của Giang hết credit (deploy bị bỏ qua) → dùng `npx netlify-cli deploy --allow-anonymous --dir site --prod --no-build` (link tạm, có mật khẩu, mất sau 60 phút nếu không nhận) | netlify.toml: build `npm ci && bash build.sh`, publish `site` |

### Bản đồ mã nguồn
| File | Việc |
|---|---|
| `js/render.js` | **Bộ dựng khung hình** (dùng chung xem nhanh + xuất): video chính + zoom, B-roll + chuyển cảnh, cụm chữ 3 tầng mẫu 1 (dẫn / từ khoá 3D + vệt sáng / ký tay), icon động (Path2D), phụ đề bật từng từ, đoạn kết CTA. Toạ độ gốc 1080×1920 |
| `js/model.js` | Mô hình dự án + **op** (`cut`, `split`, `deleteSeg`, `trimSeg`, `add`, `update`, `remove`, `subs`, `cta`, `music`, `transcript`) + hoàn tác (ảnh chụp JSON) |
| `js/player.js` | Bản xem nhanh: thẻ `<video>` ẩn + vẽ canvas mỗi khung, đồng hồ tường, lệch > 0,3 s thì tua |
| `js/timeline.js` | Timeline kiểu CapCut: đầu phát cố định giữa, kéo để tua; 6 làn Chữ/Phụ đề/Hiệu ứng/Cảnh phụ/Video/Nhạc; chọn → hiện tay nắm 2 đầu; kéo clip đã chọn để dời |
| `js/media.js` | Nhập file, ảnh nhỏ timeline, phân tích âm thanh (Mediabunny, cửa sổ 20 ms) → khoảng lặng (min 0,35 s, chừa 0,1 s), WAV 16 kHz |
| `js/ai.js` | AI dựng A–Z (`autoEdit`), sửa theo lời (`askAi`), **con trỏ diễn từng op** (`animateOps`), bộ dựng cơ bản khi không có AI (`localPlan`, `localCommand`), lọc op AI (`sanitizeOps`) |
| `js/cursor.js` | Con trỏ AI: điện thoại = ngón tay, máy tính = mũi tên; di chuyển cong, bấm có vòng sóng, kéo, chú thích |
| `js/export.js` | Xuất MP4: Mediabunny `CanvasSink` (giải mã đúng khung) → vẽ `render.js` → `CanvasSource` (H.264/VP9/AV1) + AAC **WebAssembly**; không có bộ mã hoá → `recordRealtime` (MediaRecorder) |
| `js/install.js` | Thẻ "Cài app lên màn hình chính" (iOS: Chia sẻ → Thêm vào MH chính; Android: nút Cài app), nhắc mở bằng trình duyệt khi ở Zalo/Facebook, iOS < 16.4 thì nhắc cập nhật |
| `js/main.js` | Giao diện: màn Dự án, Editor, bảng sửa tay, chat, duyệt → xuất |

### Biến môi trường (Cloudflare → Settings → Variables and Secrets) — không ghi khoá vào code / chat
`AI_OPEN` = `on` mới bật AI (mặc định tắt cho tới khi có tài khoản + lượt dùng) · `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` (mặc định `claude-haiku-5-5`) ·
`GEMINI_API_KEY` / `GEMINI_MODEL` (dự phòng) · binding `AI` (Workers AI, Whisper `@cf/openai/whisper-large-v3-turbo`, ~0,0005 USD/phút âm thanh).

### Bắt đầu nhanh
```bash
npm ci && bash build.sh
python3 -m http.server 8790 --directory site      # mở http://127.0.0.1:8790 (không có /api → chế độ cơ bản)
URL=https://dung-video-ai.truonggiang2511a.workers.dev/ node test/flow.cjs 390 844   # chạy trên web thật; bỏ URL= để chạy bản cục bộ
node test/pc.cjs                                   # máy tính 1600×900: mở thẳng timeline, file HEVC báo lỗi rõ, AI dựng, bấm thước để tua
node test/flow.cjs 390 844                         # kiểm thử luồng chính trên khổ điện thoại (cần playwright + file trong /home/claude/testmedia)
```
Font: `public/fonts/*.woff2` là bản GỘP 3 bộ chữ latin + latin-ext + vietnamese từ @fontsource (gộp bằng fontTools — xem nhật ký 1/11).

---

## 2. Quy trình cập nhật an toàn
1. Đọc chỗ gọi tới phần sắp sửa (grep `applyOp(`, `drawFrame(`, `api(`).
2. Sửa nguồn → `bash build.sh` → chạy `test/flow.cjs` (luồng: tạo dự án → thêm A-roll + 3 B-roll → AI dựng → chọn clip → chat → duyệt → xuất 720p) và xem ảnh `test/s*.png`.
3. Xuất thật phải kiểm: `ffprobe` có `h264` + `aac`, `ffmpeg -af volumedetect` mean_volume khác -91 dB.
4. Route AI mới: gọi thật 1 lần sau deploy (test fetch giả không bắt được lỗi tham số API thật — bài học Vị Trí Studio 25/10).
5. Đổi một thứ một lần. Khi app đã có khách + quảng cáo: không đổi luồng đăng ký/xuất/thanh toán/sự kiện khi chưa hỏi Giang.

---

## 3. Điều Giang đã chốt (đừng làm ngược)
- 1/11/2026: **Tự vẽ canvas** (giống phần xuất video Vị Trí Studio), KHÔNG dùng Remotion cho app này — Remotion web-renderer bắt buộc Safari 26, iPhone iOS 18 (như máy Giang) không render được.
  Không chặn khách iOS cũ; chỉ hiện thẻ gợi ý cài app lên màn hình chính, iOS < 16.4 mới nhắc cập nhật.
- 1/11 11:03 (Giang góp ý PC): **mở app là vào thẳng timeline** (dự án gần nhất, chưa có thì tạo mới; nút ô lưới góc trái = danh sách dự án). **KHÔNG có thẻ/nút che giữa khung xem**: nút AI dựng nằm trên thanh trên cùng, tiến độ AI + nhắc duyệt nằm ở thanh trạng thái `#status` giữa khung xem và timeline. Máy tính: timeline bắt đầu từ mép trái, đầu phát chạy theo thời gian, bấm/kéo thước để tua; ô chat AI nằm dưới bảng bên phải. Kéo thả file vào app (video dài nhất = video chính).
- Mục dự án **chỉ có timeline**: khách thả video chính (A-roll) + cảnh phụ (B-roll) lên timeline; AI cắt/xếp/hậu kỳ A–Z.
- 3 cách sửa: (1) sửa tay (chữ, font, màu, kiểu, cỡ, icon, vị trí kéo trên khung, chuyển cảnh, cắt/tách/kéo đầu clip), (2) chạm clip → **Nhờ AI sửa**, (3) chat ô dưới cùng.
- **Chỗ khách đã sửa tay tự khoá** (`locked: true`) — AI không ghi đè trừ khi khách nhờ sửa đúng chỗ đó.
- Con trỏ AI diễn thao tác như người dựng (ngón tay trên điện thoại, mũi tên trên máy tính), có nút "Tua nhanh".
- **Bản xem nhanh trước, khách duyệt rồi mới render** (`p.approved`; sửa nội dung sau khi duyệt → phải duyệt lại).
- Phong cách mặc định "mẫu 1" (skill batdongsan-editor): số → vàng 3D, giá → đỏ + dòng ký tay, chữ dẫn nhỏ, icon động mỗi cụm, phụ đề 3 từ/dòng ≤ 16 ký tự, khoảng lặng ≥ 0,35 s chừa 0,1 s, CTA "NHẮN TIN XEM NHÀ NGAY", **không bịa số, không số điện thoại trên hình**.
- Tối đa miễn phí: render trên máy khách, lưu trên máy khách; tiền chỉ tốn cho AI (Claude Haiku + Whisper).

---

## 4. Việc còn lại (theo thứ tự)
1. ~~Tạo Worker Cloudflare~~ (xong 1/11). Còn: đặt `ANTHROPIC_API_KEY` (Secret) + `AI_OPEN=on` khi đã có giới hạn lượt; gọi thật `/api/transcribe` + `/api/ai` 1 lần để kiểm dạng trả về Whisper.
2. Tài khoản + lượt dùng thử + thanh toán (Supabase + SePay, theo cẩm nang mục 4 Vị Trí Studio); máy chủ kiểm lượt trước khi gọi AI.
3. Chữ sau đầu người dẫn (tách nền người) — chưa có; hiện chữ nằm phía trên đầu (y 0,12–0,3).
4. Thêm mẫu 2–5, nhạc nền có sẵn, SFX theo mẫu 1, dựng trên máy chủ cho máy không xuất được.
5. Trang giới thiệu, chính sách, Pixel + CAPI trước khi chạy quảng cáo.

---

## 5. Nhật ký bài học
- 2026-11-01: Khởi tạo. Kiểm thử Playwright khổ 390×844: A-roll thử 30 s (tiếng ngắt quãng) → AI tìm 7 khoảng lặng 8,4 s, còn 21,6 s, ghép 2 cảnh phụ, 1 zoom, CTA; xuất 720p trong ~23 s trên máy thử 2 nhân → MP4 h264 + aac, có tiếng (mean -16 dB).
- 2026-11-01: Nút trong `.tl-empty` nằm NGOÀI `.tl-inner` → bắt sự kiện click ở `root` của timeline, không ở `inner`. Bấm nút `.tl-add` làm trình duyệt cuộn timeline tới nút (= tua) → chặn `pointerdown` mặc định.
- 2026-11-01: Đang kéo clip KHÔNG được dựng lại cả timeline (mất pointer capture) → dùng `timeline.updateClip()`, dựng lại khi thả tay.
- 2026-11-01: Gộp font @fontsource bằng `fontTools.merge` cần `pip install brotli` để đọc/ghi woff2.
- 2026-11-01: Không có `/api` (Netlify/tĩnh) → `aiHealth()` trả tắt → `localPlan` (ghép cảnh theo tên file khớp lời / rải đều, zoom ~7 s, chữ số liệu chỉ khi có lời) + `localCommand` (đổi màu, cỡ, font, kiểu, dời, dài/ngắn, xoá, phụ đề, nhạc).

- 2026-11-01: iPhone iOS < 26 KHÔNG có `AudioDecoder` (WebCodecs âm thanh) → Mediabunny `canDecode()` = false. Dự phòng: `decodeWhole()` (Web Audio `decodeAudioData` cả file) cho cả phân tích khoảng lặng lẫn xuất âm thanh. Kiểm bằng `NO_AD=1 node test/flow.cjs` (xoá `window.AudioDecoder`) → vẫn cắt đúng 7 chỗ, file xuất có tiếng.
- 2026-11-01: GitHub MCP KHÔNG tạo được repo (403 "Resource not accessible by integration") → Giang tạo repo trống `dung-video-ai` trên GitHub, rồi thêm repo vào GitHub App **Claude** (github.com/apps/claude → Configure → Repository access) mới đẩy được (trước đó push bị 403). Đã đẩy `main` 1/11 10:50.

- 2026-11-01 10:58: Tạo Worker Cloudflare từ repo (Claude bấm trong trình duyệt của app Claude, Giang tự đăng nhập). Build 59 s OK; `/api/health` → `{"ai":false,"stt":false}` (đúng, AI chưa bật); chạy `test/flow.cjs` trên web thật: cắt 7 khoảng lặng, ghép 2 cảnh, xuất 720p h264+aac trong 23 s.

- 2026-11-01 11:03: Giang tải video iPhone `IMG_8415` trên PC → không hiện hình, timeline không có ảnh (thời lượng vẫn đọc được 1:13) — dấu hiệu video HEVC (H.265) mà trình duyệt không giải mã được hình. Sửa: `ensurePlayable()` (media.js) thử phát bằng thẻ `<video>`; không hiện → nếu WebCodecs giải mã được thì tự đổi sang H.264 bằng Mediabunny `Conversion` ngay trên máy; không thì báo rõ cách xử lý (mở bằng Safari/Edge, hoặc iPhone: Cài đặt → Camera → Định dạng → Tương thích nhất). Kiểm thử: `test/pc.cjs` với file HEVC tạo bằng `ffmpeg -c:v libx265 -tag:v hvc1` (Chromium Linux không có HEVC → ra đúng thông báo).

## 6. Công nghệ đã cân nhắc
| Thứ | Kết luận |
|---|---|
| Remotion (+ web-renderer) | Không dùng: cần Safari 26, telemetry mỗi lần render, giấy phép công ty ≥ 4 người. Đã thử 1/11: Chromium 2 nhân render 60 s 1080p mất 110 s |
| Claude Code / Codex chạy trong app bằng tài khoản khách | Không được: Anthropic không cho bên thứ ba dùng đăng nhập claude.ai/gói thuê bao của khách → dùng API key (của Giang hoặc khách tự dán) |
| Workers AI Whisper large-v3-turbo | Chép lời tiếng Việt, rẻ; dạng trả về: `segments[].words[{word,start,end}]` (worker xử lý cả dạng không có words) — kiểm lại khi gọi thật lần đầu |
