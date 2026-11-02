// Máy chủ Cloudflare Worker: phục vụ giao diện (thư mục site/) + 2 route AI.
//  POST /api/transcribe  (audio/wav 16 kHz mono) → Workers AI Whisper → {words:[{w,s,e}]}
//  POST /api/ai          ({mode:'highlight'|'edit'|'plan', ...}) → Claude / AI Cloudflare → {items} | {note|reply, ops:[...]}
//  POST /api/vision     ({genre, items:[{id, img:'data:image/jpeg;base64,…'}]}) → Workers AI Llama 4 Scout xem cảnh phụ → {tags:{id:{nhan, tu_khoa}}}
//  GET  /api/health      → {ai, stt, vision, stock}
//  GET  /api/stock?q=&type=video|image&orient=   → tìm cảnh / ảnh Pixabay (Secret PIXABAY_KEY; nếu có key video riêng: PIXABAY_VIDEO_KEY; tắt khẩn cấp STOCK_OFF = "on"),
//       kết quả lưu đệm 24 giờ (luật Pixabay), giới hạn chung STT_LIMIT khoá s:<ip>
//  GET  /api/stock-file?u=<url pixabay>          → tải hộ file (chỉ máy chủ *.pixabay.com) để app lưu vào máy khách (ảnh KHÔNG được nhúng link thẳng)
// AI nhìn cảnh phụ (/api/vision, ~0,0003 USD/cảnh, dùng chung 10.000 neuron/ngày miễn phí với Whisper) BẬT sẵn từ 1/11; tắt khẩn cấp: VISION_OFF = "on".
// Chép lời (/api/transcribe, Whisper ~0,0005 USD/phút, 10.000 neuron/ngày miễn phí ≈ 214 phút) BẬT sẵn từ 1/11;
// tắt khẩn cấp: đặt biến STT_OFF = "on" trong Cloudflare (wrangler.toml có keep_vars nên deploy không xoá).
// Giới hạn: STT_LIMIT (ratelimits, theo IP) + mỗi lần gửi ≤ ~75 giây âm thanh (máy khách tự chia đoạn ~30 giây).
// AI hiểu lời (/api/ai, mode highlight | edit | plan): Claude Haiku 5.5 khi AI_OPEN = "on" + Secret ANTHROPIC_API_KEY (Giang chọn
// hướng A 1/11 21:39), gọi qua trạm Mỹ AiGate có giới hạn lượt/IP/ngày + tiền/ngày; chưa bật / lỗi / hết hạn mức → AI miễn phí
// của Cloudflare Workers AI (Llama 4 Scout). Tắt khẩn cấp phần Workers AI: AI_OFF = "on". GET /api/ai-usage = tiền Claude hôm nay.

const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const open = env.AI_OPEN === 'on';
    const stt = env.STT_OFF !== 'on' && !!env.AI;
    const vision = env.VISION_OFF !== 'on' && !!env.AI;
    const claude = open && !!env.ANTHROPIC_API_KEY;
    const cf = env.AI_OFF !== 'on' && !!env.AI; // AI miễn phí của Cloudflare: dùng khi chưa bật Claude, hoặc Claude lỗi / hết hạn mức
    const stock = env.STOCK_OFF !== 'on' && !!(env.PIXABAY_KEY || env.PIXABAY_VIDEO_KEY);
    try {
      if (url.pathname === '/api/health') return json({ai: claude || cf, provider: claude ? 'claude' : cf ? 'cf' : null, stt, vision, stock});
      if (url.pathname === '/api/stock') {
        if (!stock) return json({error: 'Kho Pixabay chưa bật (thiếu PIXABAY_KEY)'}, 503);
        if (env.STT_LIMIT) {
          const {success} = await env.STT_LIMIT.limit({key: 's:' + (req.headers.get('cf-connecting-ip') || 'x')});
          if (!success) return json({error: 'Tìm quá nhanh — thử lại sau 1 phút'}, 429);
        }
        return stockSearch(url, env);
      }
      if (url.pathname === '/api/stock-file') {
        if (!stock) return json({error: 'Kho Pixabay chưa bật'}, 503);
        return stockFile(url);
      }
      if (url.pathname === '/api/vision' && req.method === 'POST') {
        if (!vision) return json({error: 'AI nhìn cảnh đang tắt'}, 503);
        if (env.STT_LIMIT) {
          const {success} = await env.STT_LIMIT.limit({key: 'v:' + (req.headers.get('cf-connecting-ip') || 'x')});
          if (!success) return json({error: 'Gửi quá nhanh — thử lại sau 1 phút'}, 429);
        }
        return json(await see(await req.json(), env));
      }
      if (url.pathname === '/api/transcribe' && req.method === 'POST') {
        if (!stt) return json({error: 'Chép lời đang tắt'}, 503);
        if (env.STT_LIMIT) {
          const {success} = await env.STT_LIMIT.limit({key: req.headers.get('cf-connecting-ip') || 'x'});
          if (!success) return json({error: 'Gửi quá nhanh — thử lại sau 1 phút'}, 429);
        }
        return json(await transcribe(req, env, url));
      }
      if (url.pathname === '/api/ai' && req.method === 'POST') {
        if (!claude && !cf) return json({error: 'AI chưa bật'}, 503);
        if (env.STT_LIMIT) {
          const {success} = await env.STT_LIMIT.limit({key: 'a:' + (req.headers.get('cf-connecting-ip') || 'x')});
          if (!success) return json({error: 'Gửi quá nhanh — thử lại sau 1 phút'}, 429);
        }
        return json(await ai(await req.json(), env, url, req.headers.get('cf-connecting-ip') || 'x', claude, cf));
      }
      // Xem chi tiêu Claude hôm nay (chỉ số tổng, không có dữ liệu khách)
      if (url.pathname === '/api/ai-usage' && env.AI_GATE) return env.AI_GATE.get(env.AI_GATE.idFromName(GATE_NAME), {locationHint: 'enam'}).fetch('https://gate.internal/usage');
      if (url.pathname.startsWith('/api/')) return json({error: 'Không có route này'}, 404);
    } catch (e) {
      return json({error: String(e.message || e).slice(0, 300)}, 500);
    }
    return env.ASSETS.fetch(req);
  },
};

// ---------- Phiên âm ----------
// Câu Whisper hay "bịa" ở đoạn im lặng / nhạc (tiếng Việt)
const HALLU = /(subscribe|đăng ký kênh|ghiền mì gõ|like và share|bấm chuông|cảm ơn các bạn đã (theo dõi|xem)|hẹn gặp lại các bạn trong (những|các) video|vietsub|phụ đề (bởi|được))/i;
async function transcribe(req, env, url) {
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 2.6 * 1024 * 1024) throw new Error('Đoạn âm thanh quá dài (tối đa ~75 giây mỗi lần)');
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const input = {audio: btoa(bin), task: 'transcribe', language: 'vi', vad_filter: true};
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 200).trim();
  if (prompt) input.initial_prompt = prompt;
  let r;
  try {
    r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', input);
  } catch (e) {
    // phòng khi tham số tuỳ chọn bị từ chối: thử lại tối giản
    r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {audio: input.audio, language: 'vi'});
  }
  const words = [];
  let dropped = 0;
  for (const seg of r.segments || []) {
    const text = String(seg.text || '').trim();
    const nsp = +seg.no_speech_prob || 0;
    if (nsp > 0.75 || (HALLU.test(text) && (nsp > 0.15 || (+seg.avg_logprob || 0) < -0.5))) {
      dropped++;
      continue;
    }
    if (seg.words?.length) for (const w of seg.words) words.push({w: String(w.word).trim(), s: +w.start, e: +w.end});
    else if (text) {
      const ts = text.split(/\s+/);
      const d = (seg.end - seg.start) / Math.max(1, ts.length);
      ts.forEach((t, i) => words.push({w: t, s: seg.start + i * d, e: seg.start + (i + 1) * d}));
    }
  }
  if (!words.length && !(r.segments || []).length && r.words) for (const w of r.words) words.push({w: String(w.word).trim(), s: +w.start, e: +w.end});
  return {words: words.filter((w) => w.w && isFinite(w.s) && isFinite(w.e)), text: r.text || '', dropped, info: r.transcription_info || null};
}

// ---------- AI nhìn cảnh phụ ----------
// Mỗi cảnh: 1 ảnh ghép 3 khung (đầu · giữa · cuối) ≤ ~150 KB. Trả nhãn tiếng Việt + từ khoá người nói hay dùng khi nhắc tới cảnh đó.
const VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const VISION_SCHEMA = {
  type: 'object',
  properties: {nhan: {type: 'string'}, tu_khoa: {type: 'array', items: {type: 'string'}}},
  required: ['nhan', 'tu_khoa'],
};
async function see(body, env) {
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 8);
  const genre = String(body.genre || '').slice(0, 160);
  const tags = {};
  await Promise.all(
    items.map(async (it) => {
      const img = String(it.img || '');
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 220000) return;
      const prompt = `Ảnh này ghép 3 khung hình (đầu, giữa, cuối) của MỘT cảnh quay phụ (B-roll) trong ${genre || 'video ngắn mạng xã hội Việt Nam'}.
Trả JSON: {"nhan": "tên cảnh 1–4 chữ tiếng Việt có dấu, cụ thể (vd: phòng khách, bếp, mặt tiền nhà, phòng ngủ, nhà vệ sinh, sân thượng, hẻm trước nhà, bát phở cận cảnh, đóng gói sản phẩm, màn hình điện thoại)", "tu_khoa": ["5–8 từ/cụm từ tiếng Việt có dấu mà người nói hay dùng khi nhắc tới thứ trong cảnh này, ưu tiên cụm 2 chữ cụ thể (vd: phòng khách, sofa, bếp, tủ lạnh, bồn rửa), KHÔNG dùng từ chung chung như nhà, đẹp, rộng, cái này"]}`;
      try {
        const r = await env.AI.run(VISION_MODEL, {
          messages: [{role: 'user', content: [{type: 'text', text: prompt}, {type: 'image_url', image_url: {url: img}}]}],
          response_format: {type: 'json_schema', json_schema: VISION_SCHEMA},
          max_tokens: 160,
          temperature: 0.2,
        });
        let o = r.response;
        if (typeof o === 'string') {
          const m = o.match(/\{[\s\S]*\}/);
          o = m ? JSON.parse(m[0]) : null;
        }
        if (!o || typeof o !== 'object') return;
        const clean = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
        const nhan = clean(o.nhan);
        const tu = [...new Set((Array.isArray(o.tu_khoa) ? o.tu_khoa : []).map(clean).filter((x) => x.length > 1))].slice(0, 10);
        if (nhan) tags[String(it.id).slice(0, 40)] = {nhan, tu_khoa: tu};
      } catch (e) {
        tags[String(it.id).slice(0, 40)] = {error: String(e.message || e).slice(0, 120)};
      }
    }),
  );
  return {tags};
}

// ---------- AI miễn phí của Cloudflare (Workers AI) ----------
// mode 'highlight': chọn CỤM CHỮ ĐIỂM NHẤN từ lời nói (máy khách kiểm lại: chữ phải có trong lời, số do bộ dựng tự làm)
// mode 'edit': hiểu câu nhắn sửa → ops (cùng luật với Claude)
const CF_MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/openai/gpt-oss-120b', '@cf/qwen/qwen3-30b-a3b-fp8', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it'];
const CF_DEFAULT = '@cf/meta/llama-4-scout-17b-16e-instruct';
async function cfChat(env, model, system, user, max = 1600) {
  let text = '';
  if (model.includes('gpt-oss')) {
    const r = await env.AI.run(model, {instructions: system, input: user, reasoning: {effort: 'low'}, max_output_tokens: max});
    text = (r.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).map((c) => c.text || '').join('') || r.output_text || r.response || '';
  } else {
    const r = await env.AI.run(model, {messages: [{role: 'system', content: system}, {role: 'user', content: user}], max_tokens: max, temperature: 0.25, response_format: {type: 'json_object'}});
    text = typeof r.response === 'string' ? r.response : JSON.stringify(r.response || '');
  }
  text = String(text).replace(/<think>[\s\S]*?<\/think>/g, '');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI trả lời không đúng dạng');
  return JSON.parse(m[0]);
}
const HL_SYS = `Bạn là biên tập viên video ngắn (TikTok/Reels) tiếng Việt. Từ lời người nói (mỗi dòng: [giây] câu), chọn các CỤM CHỮ ĐIỂM NHẤN để hiện to trên video.
LUẬT:
- "main": lấy NGUYÊN VĂN 1–4 từ có trong lời nói (được bỏ từ đệm), tối đa 18 ký tự, VIẾT HOA. Ưu tiên: lợi ích chính, đặc điểm nổi bật, từ gây tò mò, lời kêu gọi. KHÔNG chọn con số/giá (đã có bộ khác làm). KHÔNG bịa chữ không có trong lời.
- "lead": 1–3 từ nhỏ phía trên, lấy từ ngay trước cụm trong lời nói (có thể để trống "").
- "start": số giây của câu chứa cụm (lấy đúng số trong ngoặc vuông của câu đó).
- Các cụm cách nhau tối thiểu GAP giây; chọn tối đa COUNT cụm; không chọn ở 2 giây đầu và 4 giây cuối.
NGOÀI RA:
- "hook": tiêu đề mở đầu hiện 2–3 giây đầu, VIẾT HOA, tối đa 24 ký tự, gây tò mò, đúng nội dung video. Chỉ dùng con số nếu con số đó có trong lời nói. Không hứa hẹn quá sự thật, không ghi số điện thoại.
- "pack": khoá phong cách hợp nội dung nhất trong danh sách PHONG CÁCH bên dưới.
- "pics": hình minh hoạ (emoji) cho những câu có hình ảnh cụ thể — tối đa PICS hình, cách nhau ≥ 5 giây: "start" = giây của câu, "tu" = 1–2 từ tiếng Việt chỉ đồ vật/con vật/cảm xúc để tìm emoji (vd "ngôi nhà", "tiền", "đồng hồ", "trái tim", "xe hơi", "cây", "bánh mì", "cười", "ngạc nhiên").
- "place": tên địa điểm/vị trí người nói nhắc tới, lấy NGUYÊN VĂN trong lời (vd "Bình Chánh", "chợ Bình Điền", "quận 7"); không có thì "".
- "sfx": âm thanh nhấn theo nghĩa câu nói, tối đa SFXN cái: "start" = giây của câu, "key" một trong: ding (ý hay, mẹo), success (kết quả tốt), wrong (sai lầm, cảnh báo), heartbeat (hồi hộp), tick (thời gian, hạn chót), coin (tiết kiệm, tiền nhỏ), riser (sắp tiết lộ), boing (vui, hài hước).
- "stock": cảnh trám từ kho video mạng (Pixabay) cho những câu có ý nói về thứ CHUNG CHUNG không có trong cảnh quay — tối đa STOCKN cảnh, cách nhau ≥ 6 giây: "start" = giây của câu, "q" = 1–3 từ TIẾNG ANH để tìm video (vd "city skyline", "money counting", "family happy", "handshake", "traffic road", "calendar"). TUYỆT ĐỐI KHÔNG tìm chính căn nhà / căn hộ / phòng / món ăn / sản phẩm đang review hoặc đang bán hay người nói (cảnh mạng mà giả làm hàng thật là lừa khách). Không chắc thì để [].
Chỉ trả JSON: {"items":[{"start":0,"lead":"","main":""}],"hook":"","pack":"","pics":[{"start":0,"tu":""}],"place":"","sfx":[{"start":0,"key":""}],"stock":[{"start":0,"q":""}]}`;
// ---------- Claude dựng / sửa ----------
const ICON_LIST = 'house|pin|ruler|tag|doc|school|sofa|car|tree|star|bed|key|heart|fire|check|bulb|chat|thumb|clock|cart|gift|truck|food|coffee|book|chart|camera|plane';
const GENRE_RULES = {
  bds: 'Số → #ffc61a vàng 3D; giá → kind "price", #ff2a2a đỏ, kèm dòng ký tay (vd "sổ hồng riêng"). B-roll phủ đúng câu nhắc tới phòng/vị trí.',
  banhang: 'Nhấn giá (kind "price", #ff2a2a), ưu đãi/giảm giá (#ffc61a), công dụng chính. Không hứa hẹn quá sự thật, không "rẻ nhất". B-roll phủ đúng câu nhắc tới sản phẩm/chi tiết.',
  amthuc: 'Nhấn tên món, giá, địa điểm, điểm ngon nổi bật. B-roll món ăn cận cảnh đúng lúc nói tới món.',
  kienthuc: 'Mỗi ý/bước chính một cụm chữ ngắn (vd "BƯỚC 1", "MẸO HAY"), con số nổi bật. B-roll minh hoạ đúng ý đang nói.',
  vlog: 'Cụm chữ ít, đúng khoảnh khắc cảm xúc/địa điểm. B-roll nhiều hơn (khoảng 40–50% thân video), nhịp nhanh.',
  chung: 'Nhấn từ khoá, con số, ý chính. B-roll minh hoạ đúng câu đang nói.',
};
function systemPrompt(project) {
  const g = project?.genre || {};
  const key = GENRE_RULES[g.key] ? g.key : 'chung';
  const fmt = project?.format || '9:16';
  return `Bạn là thợ dựng video ngắn chuyên nghiệp cho người Việt. Thể loại: ${g.style || 'video nói trước máy quay cho mạng xã hội'}. Khổ hình ${fmt}${fmt === '16:9' ? ' (ngang)' : fmt === '1:1' ? ' (vuông)' : ' (dọc)'}, người nói trước máy quay.
Bạn nhận JSON dự án (thời gian tính bằng giây trên timeline đã cắt khoảng lặng; words = lời người nói [từ, bắt đầu, kết thúc]) và trả về DUY NHẤT một JSON:
{"note": "1 câu tiếng Việt", "reply": "1–2 câu tiếng Việt trả lời khách", "ops": [ ... ]}

Các op được phép:
- {"op":"add","list":"texts","item":{"start","dur","lead","main","sign","color","font","style","size","y","icon","kind"}}
  Cụm chữ 3 tầng: lead = chữ dẫn nhỏ, main = TỪ KHOÁ/SỐ in hoa ngắn (≤ 18 ký tự), sign = chữ ký tay nghiêng, có thể để trống.
  font: anton|montserrat|oswald|bvp (hoặc khoá kho font: bevietnampro900, montserrat900, bungee400, paytoneone400, kanit800, playfairdisplay900, dancingscript700, pattaya400, baloo2800, unbounded800…).
  style: 3d|flat|outline|stroke2|shadow|box|highlight|neon|gradient|tape|bubble. motion: pop|zoom|stamp|slide|rise|bounce|type|wave|flip|glitch|spread (giá → stamp). color (hex): xoay vòng #ffc61a, #2f8cff, #ff5fb8, #2ad46a, #9a6bff, #ff8a1f; giá → kind "price", #ff2a2a.
  y: 0.12–0.3 (phía trên đầu người nói). icon: ${ICON_LIST}|"" — ưu tiên bộ icon của thể loại: ${(g.icons || []).join(', ')}; mỗi cụm một icon đúng ý, không lặp liền nhau.
  Riêng thể loại này: ${GENRE_RULES[key]}
- {"op":"add","list":"broll","item":{"src","start","dur","in","trans"}} src = id nguồn kind "broll"; dur 2–4 s; in = giây bắt đầu lấy trong nguồn; trans: fade|none|zoom|zoomout|slide|up|whip|wipe|circle|spin|flash|glitch.
- {"op":"add","list":"stickers","item":{"kind":"emoji","key","label","start","dur","x","y","size","motion"}} hình minh hoạ Fluent Emoji (key tiếng Anh dạng gạch nối, vd money-bag, house, steaming-bowl, face-savoring-food, chart-increasing, red-heart, fire, light-bulb, wrapped-gift, delivery-truck), đúng lúc nói từ đó, 1 hình / ≥ 4 s, x 0.2 hoặc 0.8, y 0.4–0.55. motion: pop|bounce|float|wiggle|pulse|spin|drop|slide.
- {"op":"add","list":"stickers","item":{"kind":"gfx","key","label","sub","start","dur","x","y","color","variant","size"}} ĐỒ HOẠ ĐỘNG tự vẽ: key hook (tiêu đề mở đầu, label ≤ 24 ký tự, variant band|box|line|burst|bubble, y 0.15–0.2) | lower (thanh tên người nói: label = tên, sub = chức danh — CHỈ khi khách cho tên) | progress (thanh tiến độ suốt video: start 0, dur = duration) | arrow (mũi tên chỉ vào điểm x,y) | circle (vòng khoanh quanh điểm x,y) | sparkle (lấp lánh) | confetti (pháo giấy) | leak (vệt sáng lướt qua, dur 0.8) | follow (nút "THEO DÕI" bấm, thường ở đoạn kết, y 0.8). color hex.
- {"op":"pack","key"} đổi PHONG CÁCH cả video (font, kiểu chữ, màu, phụ đề, chuyển cảnh, màu video) — key trong project.packs.
- {"op":"add","list":"sfx","item":{"sfx","start","vol"}} âm thanh: whoosh|whip|swoosh (chuyển cảnh, đặt trước chuyển cảnh 0,1–0,3 s), pop (hiện số), cash (hiện giá), coin, ding (ý chính), bubble (hiện hình), notify (câu kết), impact, riser, sparkle, success, wrong, click, typing, shutter, glitch, heartbeat, boing, tick. vol 0.3–0.5, không dày quá 1 âm / 1,5 s.
- {"op":"look","set":{"filter","amt","vignette","grain","leak","bars"}} màu video: none|bright|vivid|warm|cool|film|vintage|moody|bw, amt 0.3–0.7 (nhẹ tay; khách tự chỉnh — "by":"user" — thì không đổi).
- {"op":"add","list":"zooms","item":{"start","dur","scale","kind"}} kind: (bỏ trống) = đẩy vào rồi giữ lúc nhấn ý, dur 2–3 s; "punch" = zoom giật tức thì suốt đoạn (đặt từ chỗ cắt này tới chỗ cắt kế, xen kẽ chặt/rộng để che vết cắt lộ trên mặt người nói); "push" = đẩy máy chậm suốt đoạn nói dài không cắt. scale 1.05–1.12.
- {"op":"update","id","set":{...}} / {"op":"remove","id"} — với texts, broll, zooms đã có.
- {"op":"subs","set":{"on","size","y","color","style","hl"}} (style: karaoke = chữ đang nói đổi màu | box = hộp màu | pop = bật từng chữ | clean = tối giản; hl = màu nhấn hex) · {"op":"cta","set":{"on","text"}} (câu kết mặc định: "${g.cta || 'THEO DÕI ĐỂ XEM THÊM'}") · {"op":"music","set":{"vol"}}

LUẬT BẮT BUỘC:
1. KHÔNG bịa số liệu. Số/giá trên hình phải đúng lời người nói trong words. Không viết "rẻ nhất", "tốt nhất" nếu người nói không nói. Không đưa số điện thoại lên hình.
2. Cụm chữ xuất hiện đúng lúc người nói nói từ khoá đó (start ≈ thời điểm từ), giữ tới ~1 s sau lời, tối thiểu 3 s, không chồng nhau.
3. Video 60 s: 6–8 cụm chữ, 6–8 zoom. B-roll phủ đúng câu có liên quan (đối chiếu tag/keywords/tên nguồn với lời nói), tổng ~1/3 thân video, không phủ 3 s đầu và 4 s cuối, không đè lúc đang có cụm chữ.
4. Mục có "locked": true là khách đã sửa tay — KHÔNG update/remove trừ khi khách nhờ sửa đúng mục đó (target).
5. Chế độ "edit": chỉ làm đúng điều khách yêu cầu, ít op nhất; "reply" nói rõ đã sửa gì. Không hiểu thì ops rỗng và hỏi lại trong reply.
Chỉ trả JSON, không giải thích thêm.`;
}

// ---------- Gọi AI hiểu lời: Claude (qua trạm Mỹ, có giới hạn) → không được thì AI miễn phí của Cloudflare ----------
function buildPrompt(body) {
  if (body.mode === 'highlight') {
    const lines = (Array.isArray(body.phrases) ? body.phrases : []).slice(0, 150).map(([s, t]) => `[${(+s).toFixed(1)}] ${String(t).slice(0, 200)}`).join('\n');
    const count = Math.max(1, Math.min(20, +body.count || 5));
    const gap = Math.max(1.5, Math.min(10, +body.gap || 4));
    const dur = Math.max(5, +body.dur || 60);
    const packs = (Array.isArray(body.packs) ? body.packs : []).slice(0, 20).map((x) => `- ${String(x.key).slice(0, 30)}: ${String(x.name).slice(0, 40)} — ${String(x.desc).slice(0, 120)}`).join('\n');
    const system = HL_SYS.replace('COUNT', count).replace('GAP', gap).replace('PICS', Math.max(1, Math.round(dur / 6))).replace('SFXN', Math.max(1, Math.round(dur / 12))).replace('STOCKN', Math.max(1, Math.min(4, Math.round(dur / 15)))) + (body.genre ? `\nThể loại video: ${String(body.genre).slice(0, 200)}.` : '') + (packs ? `\nPHONG CÁCH:\n${packs}` : '');
    return {system, user: `Lời người nói:\n${lines}`, max: 1600, count};
  }
  const proj = JSON.stringify(body.project).slice(0, 120000); // giữ prompt < 100k token (Haiku 5.5 trên 100k token giá ×5)
  const user = body.mode === 'plan'
    ? `Chế độ: plan (dựng từ đầu). Dự án:\n${proj}`
    : `Chế độ: edit. Khách nhờ: "${String(body.instruction || '').slice(0, 500)}"${body.target ? `\nMục khách đang chọn (target): ${body.target}` : ''}\nDự án:\n${proj}`;
  return {system: systemPrompt(body.project), user, max: 4000};
}
async function ai(body, env, url, ip, claude, cf) {
  const {system, user, max, count} = buildPrompt(body);
  let out = null;
  let provider = '';
  let note = '';
  if (claude) {
    try {
      out = await claudeJson(env, system, user, max, ip);
      provider = 'claude';
    } catch (e) {
      note = String(e.message || e).slice(0, 200);
      console.log('Claude không dùng được, chuyển AI Cloudflare:', note);
    }
  }
  if (!out && cf) {
    const model = CF_MODELS.includes(url.searchParams.get('model')) ? url.searchParams.get('model') : CF_DEFAULT;
    out = await cfChat(env, model, system, user, Math.min(max, 2500));
    provider = model;
  }
  if (!out) throw new Error(note || 'AI chưa bật');
  if (body.mode === 'highlight') {
    const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
    return {items: arr(out.items, count + 3), hook: String(out.hook || '').slice(0, 40), pack: String(out.pack || '').slice(0, 30), place: String(out.place || '').slice(0, 40), pics: arr(out.pics, 30), sfx: arr(out.sfx, 15), stock: arr(out.stock, 6), provider, fallback: note || undefined};
  }
  return {note: out.note || '', reply: out.reply || '', ops: Array.isArray(out.ops) ? out.ops.slice(0, 120) : [], provider, fallback: note || undefined};
}
async function claudeJson(env, system, user, max, ip) {
  const req = {system, user, max, ip};
  let j;
  if (env.AI_GATE) {
    const stub = env.AI_GATE.get(env.AI_GATE.idFromName(GATE_NAME), {locationHint: 'enam'});
    const r = await stub.fetch('https://gate.internal/', {method: 'POST', body: JSON.stringify(req)});
    j = await r.json();
  } else j = await callClaude(env, req);
  if (j.error) throw new Error(j.error);
  const m = String(j.text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Claude trả lời không đúng dạng');
  return JSON.parse(m[0]);
}
async function callClaude(env, {system, user, max}) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
    // Haiku 5.5: KHÔNG gửi temperature/top_p/top_k (bị từ chối), không điền sẵn lượt trả lời.
    // Mặc định có "suy nghĩ" (adaptive thinking) và token suy nghĩ tính vào max_tokens → effort thấp + nới max_tokens (gọi thật 1/11: max 1200 hết sạch, không có chữ)
    body: JSON.stringify({model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: max * 3, output_config: {effort: env.AI_EFFORT || 'low'}, system, messages: [{role: 'user', content: user}]}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return {error: 'Claude: ' + (j.error?.message || r.status)};
  if (j.stop_reason === 'refusal') return {error: 'Claude từ chối yêu cầu này', usage: j.usage};
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  if (!text) return {error: j.stop_reason === 'max_tokens' ? 'Claude trả lời quá dài' : 'Claude không trả lời', usage: j.usage};
  return {text, usage: j.usage};
}

// Trạm gọi Claude CỐ ĐỊNH ở Mỹ (Durable Object, locationHint 'enam') + sổ chi tiêu:
//  • mạng Việt Nam hay đi qua điểm Cloudflare Hồng Kông, Anthropic chặn yêu cầu từ đó (bài học Vị Trí Studio 25/10)
//  • đếm lượt mỗi IP mỗi ngày (AI_IP_DAY, mặc định 40) và tiền cả ngày (AI_DAY_USD, mặc định 1 USD) — vượt thì trả lỗi,
//    máy chủ tự chuyển sang AI miễn phí của Cloudflare. Giá Haiku 5.5: 0,10 / 0,50 USD mỗi triệu token vào/ra (prompt ≤ 100k token).
//  • Chặn cứng cuối cùng vẫn là hạn mức chi tiêu đặt trong tài khoản Anthropic (Giang tự đặt).
const GATE_NAME = 'ai-gate-us-1';
export class AiGate {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(req) {
    const url = new URL(req.url);
    const st = this.state.storage;
    const today = new Date().toISOString().slice(0, 10);
    let day = (await st.get('day')) || {d: today, usd: 0, n: 0};
    if (day.d !== today) {
      await st.deleteAll(); // sang ngày mới: xoá sổ ngày cũ (cả số lượt từng IP)
      day = {d: today, usd: 0, n: 0};
    }
    if (url.pathname === '/usage') return json({...day, limitUsd: +this.env.AI_DAY_USD || 1});
    const body = await req.json();
    const ipKey = 'ip:' + (body.ip || 'x');
    const ipN = (await st.get(ipKey)) || 0;
    if (day.usd >= (+this.env.AI_DAY_USD || 1)) return json({error: 'Hết hạn mức Claude hôm nay'});
    if (ipN >= (+this.env.AI_IP_DAY || 40)) return json({error: 'Máy này đã dùng hết lượt Claude hôm nay'});
    // giữ chỗ trước khi gọi (các yêu cầu chạy song song không vượt lượt)
    await st.put(ipKey, ipN + 1);
    day.n++;
    await st.put('day', day);
    const out = await callClaude(this.env, body);
    const u = out.usage || {};
    const big = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) > 100000;
    const pin = +this.env.AI_PRICE_IN || (big ? 0.5 : 0.1);
    const pout = +this.env.AI_PRICE_OUT || (big ? 2.5 : 0.5);
    const cost = ((u.input_tokens || 0) * pin + (u.cache_creation_input_tokens || 0) * pin * 1.25 + (u.cache_read_input_tokens || 0) * pin * 0.1 + (u.output_tokens || 0) * pout) / 1e6;
    const now = (await st.get('day')) || day;
    now.usd = +(now.usd + cost).toFixed(6);
    await st.put('day', now);
    return json({...out, cost});
  }
}

// ---------- Kho cảnh / ảnh Pixabay (key giữ ở máy chủ, KHÔNG gửi về máy khách) ----------
// Luật Pixabay (pixabay.com/api/docs, đọc 2/11): kết quả phải lưu đệm 24 giờ; ảnh phải tải về (không nhúng link lâu dài);
// hiện “nguồn Pixabay” chỗ có kết quả; 100 lượt/60 giây cho mỗi key; cấm tải hàng loạt tự động.
async function stockSearch(url, env) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const type = url.searchParams.get('type') === 'image' ? 'image' : 'video';
  const orient = ['vertical', 'horizontal'].includes(url.searchParams.get('orient')) ? url.searchParams.get('orient') : 'all';
  const page = Math.max(1, Math.min(5, +url.searchParams.get('page') || 1));
  if (!q) return json({items: []});
  const lang = /[^\x00-\x7f]/.test(q) ? 'vi' : 'en';
  const cacheKey = new Request(`https://stock-cache.dung-video-ai/${type}?q=${encodeURIComponent(q.toLowerCase())}&o=${orient}&p=${page}&l=${lang}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey).catch(() => null);
  if (hit) return hit;
  const api = new URL(type === 'image' ? 'https://pixabay.com/api/' : 'https://pixabay.com/api/videos/');
  // Pixabay dùng CHUNG 1 key cho ảnh và video; nếu Giang đặt riêng key video thì dùng PIXABAY_VIDEO_KEY cho video
  const key = type === 'video' ? env.PIXABAY_VIDEO_KEY || env.PIXABAY_KEY : env.PIXABAY_KEY || env.PIXABAY_VIDEO_KEY;
  api.searchParams.set('key', key);
  api.searchParams.set('q', q);
  api.searchParams.set('lang', lang);
  api.searchParams.set('safesearch', 'true');
  api.searchParams.set('per_page', '24');
  api.searchParams.set('page', String(page));
  if (type === 'image') {
    api.searchParams.set('image_type', 'photo');
    if (orient !== 'all') api.searchParams.set('orientation', orient);
  }
  const r = await fetch(api.toString());
  if (r.status === 429) return json({error: 'Kho Pixabay đang bận — thử lại sau 1 phút'}, 429);
  if (!r.ok) return json({error: 'Pixabay lỗi ' + r.status + ': ' + (await r.text()).slice(0, 120)}, 502);
  const d = await r.json();
  const items = (d.hits || []).map((h) =>
    type === 'image'
      ? {id: h.id, type: 'image', page: h.pageURL, user: h.user, tags: h.tags, thumb: h.previewURL, view: h.webformatURL, url: h.largeImageURL, w: h.imageWidth, h: h.imageHeight}
      : (() => {
          const v = h.videos || {};
          const pick = v.small?.url ? v.small : v.tiny?.url ? v.tiny : v.medium;
          return pick?.url ? {id: h.id, type: 'video', page: h.pageURL, user: h.user, tags: h.tags, dur: h.duration, thumb: (v.tiny || pick).thumbnail || '', url: pick.url, w: pick.width, h: pick.height, size: pick.size} : null;
        })(),
  ).filter(Boolean);
  const res = new Response(JSON.stringify({items, total: d.totalHits || 0, source: 'Pixabay'}), {headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400'}});
  await cache.put(cacheKey, res.clone()).catch(() => {});
  return res;
}
async function stockFile(url) {
  let u;
  try {
    u = new URL(url.searchParams.get('u') || '');
  } catch (e) {
    return json({error: 'Link không hợp lệ'}, 400);
  }
  if (u.protocol !== 'https:' || !/(^|\.)pixabay\.com$/.test(u.hostname)) return json({error: 'Chỉ tải được file của Pixabay'}, 400);
  const r = await fetch(u.toString(), {cf: {cacheTtl: 86400, cacheEverything: true}});
  if (!r.ok) return json({error: 'Không tải được file (' + r.status + ')'}, 502);
  const len = +(r.headers.get('content-length') || 0);
  if (len > 80 * 1024 * 1024) return json({error: 'File quá lớn'}, 413);
  const h = {'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'private, max-age=86400'};
  if (len) h['content-length'] = String(len);
  return new Response(r.body, {headers: h});
}
