// Máy chủ Cloudflare Worker: phục vụ giao diện (thư mục site/) + 2 route AI.
//  POST /api/transcribe  (audio/wav 16 kHz mono) → Workers AI Whisper → {words:[{w,s,e}]}
//  POST /api/ai          ({mode:'plan'|'edit', ...}) → Claude → {note|reply, ops:[...]}
//  GET  /api/health      → {ai, stt}
// Claude (/api/ai) chỉ chạy khi AI_OPEN = "on" (Cloudflare → Settings → Variables). Chưa có tài khoản/lượt dùng thì để tắt.
// Chép lời (/api/transcribe, Whisper ~0,0005 USD/phút, 10.000 neuron/ngày miễn phí ≈ 214 phút) BẬT sẵn từ 1/11;
// tắt khẩn cấp: đặt biến STT_OFF = "on" trong Cloudflare (wrangler.toml có keep_vars nên deploy không xoá).
// Giới hạn: STT_LIMIT (ratelimits, theo IP) + mỗi lần gửi ≤ ~75 giây âm thanh (máy khách tự chia đoạn ~30 giây).

const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const open = env.AI_OPEN === 'on';
    const stt = env.STT_OFF !== 'on' && !!env.AI;
    try {
      if (url.pathname === '/api/health') return json({ai: open && !!(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY), stt});
      if (url.pathname === '/api/transcribe' && req.method === 'POST') {
        if (!stt) return json({error: 'Chép lời đang tắt'}, 503);
        if (env.STT_LIMIT) {
          const {success} = await env.STT_LIMIT.limit({key: req.headers.get('cf-connecting-ip') || 'x'});
          if (!success) return json({error: 'Gửi quá nhanh — thử lại sau 1 phút'}, 429);
        }
        return json(await transcribe(req, env, url));
      }
      if (url.pathname === '/api/ai' && req.method === 'POST') {
        if (!open) return json({error: 'AI chưa bật'}, 503);
        return json(await ai(await req.json(), env));
      }
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
  font: anton|montserrat|oswald|bvp. style: 3d|flat|outline. color (hex): xoay vòng #ffc61a, #2f8cff, #ff5fb8, #2ad46a, #9a6bff, #ff8a1f; giá → kind "price", #ff2a2a.
  y: 0.12–0.3 (phía trên đầu người nói). icon: ${ICON_LIST}|"" — ưu tiên bộ icon của thể loại: ${(g.icons || []).join(', ')}; mỗi cụm một icon đúng ý, không lặp liền nhau.
  Riêng thể loại này: ${GENRE_RULES[key]}
- {"op":"add","list":"broll","item":{"src","start","dur","in","trans"}} src = id nguồn kind "broll"; dur 2–4 s; in = giây bắt đầu lấy trong nguồn; trans: fade|zoom|slide|none.
- {"op":"add","list":"zooms","item":{"start","dur","scale","kind"}} kind: (bỏ trống) = đẩy vào rồi giữ lúc nhấn ý, dur 2–3 s; "punch" = zoom giật tức thì suốt đoạn (đặt từ chỗ cắt này tới chỗ cắt kế, xen kẽ chặt/rộng để che vết cắt lộ trên mặt người nói); "push" = đẩy máy chậm suốt đoạn nói dài không cắt. scale 1.05–1.12.
- {"op":"update","id","set":{...}} / {"op":"remove","id"} — với texts, broll, zooms đã có.
- {"op":"subs","set":{"on","size","y","color","style","hl"}} (style: karaoke = chữ đang nói đổi màu | box = hộp màu | pop = bật từng chữ | clean = tối giản; hl = màu nhấn hex) · {"op":"cta","set":{"on","text"}} (câu kết mặc định: "${g.cta || 'THEO DÕI ĐỂ XEM THÊM'}") · {"op":"music","set":{"vol"}}

LUẬT BẮT BUỘC:
1. KHÔNG bịa số liệu. Số/giá trên hình phải đúng lời người nói trong words. Không viết "rẻ nhất", "tốt nhất" nếu người nói không nói. Không đưa số điện thoại lên hình.
2. Cụm chữ xuất hiện đúng lúc người nói nói từ khoá đó (start ≈ thời điểm từ), giữ tới ~1 s sau lời, tối thiểu 3 s, không chồng nhau.
3. Video 60 s: 6–8 cụm chữ, 6–8 zoom. B-roll phủ đúng câu có liên quan (đối chiếu tên nguồn với lời nói), tổng ~1/3 thân video, không phủ 3 s đầu và 4 s cuối, không đè lúc đang có cụm chữ.
4. Mục có "locked": true là khách đã sửa tay — KHÔNG update/remove trừ khi khách nhờ sửa đúng mục đó (target).
5. Chế độ "edit": chỉ làm đúng điều khách yêu cầu, ít op nhất; "reply" nói rõ đã sửa gì. Không hiểu thì ops rỗng và hỏi lại trong reply.
Chỉ trả JSON, không giải thích thêm.`;
}

async function ai(body, env) {
  const prompt = body.mode === 'plan'
    ? `Chế độ: plan (dựng từ đầu). Dự án:\n${JSON.stringify(body.project)}`
    : `Chế độ: edit. Khách nhờ: "${String(body.instruction || '').slice(0, 500)}"${body.target ? `\nMục khách đang chọn (target): ${body.target}` : ''}\nDự án:\n${JSON.stringify(body.project)}`;
  let text = '';
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 4000, system: systemPrompt(body.project), messages: [{role: 'user', content: prompt}]}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Claude: ' + (j.error?.message || r.status));
    text = (j.content || []).map((c) => c.text || '').join('');
  } else if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({systemInstruction: {parts: [{text: systemPrompt(body.project)}]}, contents: [{role: 'user', parts: [{text: prompt}]}], generationConfig: {responseMimeType: 'application/json'}}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Gemini: ' + (j.error?.message || r.status));
    text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
  } else throw new Error('Chưa có khoá AI');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI trả lời không đúng dạng');
  const out = JSON.parse(m[0]);
  return {note: out.note || '', reply: out.reply || '', ops: Array.isArray(out.ops) ? out.ops.slice(0, 120) : []};
}
