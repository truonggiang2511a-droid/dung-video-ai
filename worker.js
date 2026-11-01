// Máy chủ Cloudflare Worker: phục vụ giao diện (thư mục site/) + 2 route AI.
//  POST /api/transcribe  (audio/wav 16 kHz mono) → Workers AI Whisper → {words:[{w,s,e}]}
//  POST /api/ai          ({mode:'plan'|'edit', ...}) → Claude → {note|reply, ops:[...]}
//  GET  /api/health      → {ai, stt}
// AI chỉ chạy khi AI_OPEN = "on" (đặt trong Cloudflare → Settings → Variables). Chưa có tài khoản/lượt dùng thì để tắt.

const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const open = env.AI_OPEN === 'on';
    try {
      if (url.pathname === '/api/health') return json({ai: open && !!(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY), stt: open && !!env.AI});
      if (url.pathname === '/api/transcribe' && req.method === 'POST') {
        if (!open || !env.AI) return json({error: 'AI chưa bật'}, 503);
        return json(await transcribe(req, env));
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
async function transcribe(req, env) {
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 24 * 1024 * 1024) throw new Error('Âm thanh quá dài (tối đa ~12 phút)');
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {audio: btoa(bin), language: 'vi', vad_filter: true});
  const words = [];
  for (const seg of r.segments || []) {
    if (seg.words?.length) for (const w of seg.words) words.push({w: String(w.word).trim(), s: +w.start, e: +w.end});
    else if (seg.text) {
      const ts = seg.text.trim().split(/\s+/);
      const d = (seg.end - seg.start) / Math.max(1, ts.length);
      ts.forEach((t, i) => words.push({w: t, s: seg.start + i * d, e: seg.start + (i + 1) * d}));
    }
  }
  if (!words.length && r.words) for (const w of r.words) words.push({w: String(w.word).trim(), s: +w.start, e: +w.end});
  return {words: words.filter((w) => w.w), text: r.text || ''};
}

// ---------- Claude dựng / sửa ----------
const SYSTEM = `Bạn là thợ dựng video bất động sản cho môi giới Việt Nam, phong cách "mẫu 1" (video dọc 9:16, người dẫn đứng nói).
Bạn nhận JSON dự án (thời gian tính bằng giây trên timeline đã cắt khoảng lặng; words = lời người dẫn [từ, bắt đầu, kết thúc]) và trả về DUY NHẤT một JSON:
{"note": "1 câu tiếng Việt", "reply": "1–2 câu tiếng Việt trả lời khách", "ops": [ ... ]}

Các op được phép:
- {"op":"add","list":"texts","item":{"start","dur","lead","main","sign","color","font","style","size","y","icon","kind"}}
  Cụm chữ 3 tầng: lead = chữ dẫn nhỏ (vd "diện tích"), main = TỪ KHOÁ/SỐ in hoa ngắn (≤ 18 ký tự), sign = chữ ký tay nghiêng (vd "sổ hồng riêng"), có thể để trống.
  font: anton|montserrat|oswald|bvp. style: 3d|flat|outline. color (hex): số → #ffc61a vàng 3D; giá → kind "price", #ff2a2a đỏ; còn lại xoay vòng #2f8cff, #ff5fb8, #2ad46a, #9a6bff, #ff8a1f.
  y: 0.12–0.3 (phía trên đầu người dẫn). icon: house|pin|ruler|tag|doc|school|sofa|car|tree|star|bed|key|"" — mỗi cụm một icon đúng ý, không lặp.
- {"op":"add","list":"broll","item":{"src","start","dur","in","trans"}} src = id nguồn kind "broll"; dur 2–4 s; in = giây bắt đầu lấy trong nguồn; trans: fade|zoom|slide|none.
- {"op":"add","list":"zooms","item":{"start","dur","scale"}} zoom đẩy máy lúc nhấn ý, scale 1.05–1.12, dur 2–3 s.
- {"op":"update","id","set":{...}} / {"op":"remove","id"} — với texts, broll, zooms đã có.
- {"op":"subs","set":{"on","size","y","color"}} · {"op":"cta","set":{"on","text"}} · {"op":"music","set":{"vol"}}

LUẬT BẮT BUỘC:
1. KHÔNG bịa số liệu. Số/giá/diện tích trên hình phải đúng lời người dẫn trong words. Không viết "rẻ nhất". Không đưa số điện thoại lên hình.
2. Cụm chữ xuất hiện đúng lúc người dẫn nói từ khoá đó (start ≈ thời điểm từ), giữ tới ~1 s sau lời, tối thiểu 3 s, không chồng nhau.
3. Video 60 s: 6–8 cụm chữ, 6–8 zoom. B-roll phủ đúng câu nhắc tới phòng/vị trí (đối chiếu tên nguồn với lời nói), tổng ~1/3 thân video, không phủ 3 s đầu và 4 s cuối, không đè lúc đang có cụm chữ.
4. Mục có "locked": true là khách đã sửa tay — KHÔNG update/remove trừ khi khách nhờ sửa đúng mục đó (target).
5. Chế độ "edit": chỉ làm đúng điều khách yêu cầu, ít op nhất; "reply" nói rõ đã sửa gì. Không hiểu thì ops rỗng và hỏi lại trong reply.
Chỉ trả JSON, không giải thích thêm.`;

async function ai(body, env) {
  const prompt = body.mode === 'plan'
    ? `Chế độ: plan (dựng từ đầu theo mẫu 1). Dự án:\n${JSON.stringify(body.project)}`
    : `Chế độ: edit. Khách nhờ: "${String(body.instruction || '').slice(0, 500)}"${body.target ? `\nMục khách đang chọn (target): ${body.target}` : ''}\nDự án:\n${JSON.stringify(body.project)}`;
  let text = '';
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 4000, system: SYSTEM, messages: [{role: 'user', content: prompt}]}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Claude: ' + (j.error?.message || r.status));
    text = (j.content || []).map((c) => c.text || '').join('');
  } else if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({systemInstruction: {parts: [{text: SYSTEM}]}, contents: [{role: 'user', parts: [{text: prompt}]}], generationConfig: {responseMimeType: 'application/json'}}),
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
