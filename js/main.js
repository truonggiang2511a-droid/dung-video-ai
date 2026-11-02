// Điều khiển giao diện: màn Dự án + màn Editor (khung xem nhanh, timeline, sửa tay, AI).
import {loadFonts, duration, COLORS, ICONS, FONTS, W, H, SUB_STYLES, TEXT_STYLES, TEXT_MOTIONS, TEXT_PRESETS, TRANSITIONS, FILTERS, JUMP_TRANS, applyLook, tlOfSrc, srcAt, segStarts as segStartsOf, drawFrame, setFormat, GFX, GFX_MAP, HOOK_VARIANTS} from './render.js';
import {PACKS, packsFor, restyle, gfxStyle, packText} from './styles.js';
import {store} from './store.js';
import {newProject, applyOp, History, find, newText, uid, ITEM_TYPES} from './model.js';
import {SFX, SFX_MAP, playSfx} from './sfx.js';
import {MOTIONS, searchLib, loadIndex, pruneAnims} from './library.js';
import {FONT_CATS, ensureFont, ensureProjectFonts} from './fonts.js';
import {importFile, probeVideo, ensurePlayable, thumbs, CUT_PACE} from './media.js';
import {Player} from './player.js';
import {Timeline} from './timeline.js';
import {Cursor} from './cursor.js';
import {autoEdit, askAi, aiHealth, TEXT_DENSITY, localKeys, keyLockups, timelinePhrases, numberLockups} from './ai.js';
import {installCard, canExport} from './install.js';
import {GENRES, FORMATS, genreOf, migrate, rememberChoice} from './templates.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const icon = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const I = {
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  split: 'M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  plus: 'M12 5v14M5 12h14',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  film: 'M3 5h18v14H3zM3 9h18M8 5v4M16 5v4',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM21 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  sub: 'M3 5h18v14H3zM7 13h4M13 13h4M7 16h10',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  back: 'M15 18l-6-6 6-6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  check: 'M5 12l5 5 9-10',
  zoomIn: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M8 11h6',
  ff: 'M4 5l8 7-8 7zM12 5l8 7-8 7z',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
};

// ---------- thông báo nhỏ ----------
let toastT = null;
function toast(msg, ms = 4200) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms);
}
function dialog({title, body, ok = 'Đồng ý', cancel = 'Huỷ', danger = false}) {
  return new Promise((res) => {
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-card" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">${title}</h3><div class="dlg-body">${body}</div><div class="dlg-act">${cancel ? `<button class="btn ghost" data-v="0">${cancel}</button>` : ''}<button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${ok}</button></div></div>`;
    d.hidden = false;
    d.onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (!b && e.target !== d) return;
      d.hidden = true;
      res(b ? b.dataset.v === '1' : false);
    };
  });
}

// ---------- trạng thái editor ----------
const ed = {
  p: null,
  history: new History(),
  player: null,
  tl: null,
  cur: null,
  sel: null,
  busy: false,
  getBlob: (k) => store.getFile(k),
  seek(T) {
    ed.player.seek(T);
    ed.tl.setTime(T);
    updateTime();
  },
  changed(save = true, contentEdit = false) {
    const p = ed.p;
    p._rev = (p._rev || 0) + 1;
    if (contentEdit && p.approved) p.approved = false;
    ed.tl.render(p);
    ed.tl.setTime(ed.player.T);
    ed.player.dirty = true;
    ensureProjectFonts(p).then(() => (ed.player.dirty = true));
    pruneAnims(p);
    updateStage();
    renderBin();
    if (ed.sel && !selItem()) select(null);
    else renderInspector();
    renderScript();
    renderMedia();
    renderCtx();
    if (save) queueSave();
  },
};
let saveT = null;
function queueSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => store.saveProject(ed.p).catch((e) => toast('Không lưu được: ' + e.message)), 600);
}

function selItem() {
  const s = ed.sel;
  if (!s) return null;
  if (ITEM_TYPES.includes(s.type)) return find(ed.p, s.id)?.item || null;
  if (s.type === 'seg') return ed.p.main?.segs[+s.id] || null;
  if (s.type === 'subs') return ed.p.subs;
  if (s.type === 'music') return ed.p.music;
  return null;
}

// Sửa tay: lưu bước hoàn tác rồi khoá chỗ khách đã sửa
function manual(fn, {lock = true} = {}) {
  ed.history.push(ed.p);
  fn();
  const it = selItem();
  if (lock && it && 'locked' in it) it.locked = true;
  ed.changed(true, true);
}

// ---------- MÀN DỰ ÁN ----------
async function renderHome() {
  const list = await store.listProjects();
  const box = $('#plist');
  if (!list.length) {
    box.innerHTML = `<div class="empty-home">
      <div class="eh-art" aria-hidden="true"><i></i><i></i><i></i></div>
      <h3>Chưa có video nào</h3>
      <p>Tải video bạn nói trước máy quay và vài cảnh phụ lên timeline — AI cắt, ghép, thêm chữ từ A–Z. Bạn xem bản nháp, ưng rồi mới xuất.</p>
    </div>`;
    return;
  }
  box.innerHTML = list
    .map((p) => {
      const m = p.main ? p.sources[p.main.src] : null;
      const th = m?.thumbs?.[0];
      const D = p.main ? duration(p) : 0;
      const st = !p.main ? ['Chưa có video', 'muted'] : !p.aiDone ? ['Chưa dựng', 'muted'] : p.approved ? ['Đã duyệt', 'ok'] : ['Chờ bạn duyệt', 'warn'];
      return `<div class="pcard" data-id="${p.id}">
        <button class="pcard-open" data-open="${p.id}" aria-label="Mở ${esc(p.name)}">
          <span class="pthumb" style="${th ? `background-image:url(${th})` : ''}"></span>
          <span class="pinfo"><b>${esc(p.name)}</b><small>${D ? fmt(D) + ' · ' : ''}${new Date(p.updated).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'})}</small><em class="chip ${st[1]}">${st[0]}</em></span>
        </button>
        <button class="icon-btn" data-del="${p.id}" aria-label="Xoá dự án ${esc(p.name)}">${icon(I.trash, 18)}</button>
      </div>`;
    })
    .join('');
}

async function newProj() {
  const p = newProject();
  await store.saveProject(p);
  openEditor(p);
}

// ---------- MỞ EDITOR ----------
async function openEditor(p) {
  migrate(p);
  p._rev = 1;
  ed.p = p;
  ed.sel = null;
  ed.mainBad = false;
  ed.history = new History();
  $('#home').hidden = true;
  $('#editor').hidden = false;
  document.body.classList.add('in-editor');
  $('#pname').value = p.name;
  ed.player.detach();
  await ed.player.attach(p, ed.getBlob);
  ed.player.T = 0;
  ed.tl.render(p);
  ed.tl.setTime(0);
  updateStage();
  renderBin();
  renderInspector();
  updateTime();
  history.replaceState(null, '', '#' + p.id);
}
async function closeEditor() {
  ed.player.pause();
  if (ed.p && !ed.p.main && !Object.keys(ed.p.sources).length) await store.deleteProject(ed.p);
  else if (ed.p) await store.saveProject(ed.p);
  ed.player.detach();
  ed.p = null;
  $('#editor').hidden = true;
  $('#home').hidden = false;
  document.body.classList.remove('in-editor');
  history.replaceState(null, '', location.pathname);
  renderHome();
}

// ---------- THANH TRẠNG THÁI (không che khung xem) ----------
let aiSteps = null;
function updateStage() {
  const p = ed.p;
  $('#fmtLabel').textContent = `${GENRES[p.genre]?.short || 'Chung'} · ${p.format || '9:16'}`;
  const D = p.main ? duration(p) : 0;
  $('#tDur').textContent = fmt(D);
  const ai = $('#btnAi');
  ai.disabled = !p.main || ed.busy;
  ai.querySelector('span').textContent = p.aiDone ? 'Dựng lại' : 'AI dựng';
  ai.classList.toggle('glow', !!p.main && !p.aiDone && !ed.busy);
  ai.title = p.main ? 'AI cắt khoảng lặng, ghép cảnh, thêm chữ và hiệu ứng' : 'Thêm video chính trước';
  const ex = $('#btnExport');
  ex.disabled = !p.main || ed.busy;
  ex.textContent = p.aiDone && !p.approved ? 'Duyệt & xuất' : 'Xuất video';
  $('#btnUndo').disabled = !ed.history.undo.length || ed.busy;
  $('#btnRedo').disabled = !ed.history.redo.length || ed.busy;
  $$('[data-act="undo"]').forEach((b) => (b.disabled = $('#btnUndo').disabled));
  $$('[data-act="redo"]').forEach((b) => (b.disabled = $('#btnRedo').disabled));
  $$('#dockTools .dk').forEach((b) => (b.disabled = ed.busy || (!p.main && b.dataset.act !== 'project')));
  renderStatus();
}
function renderStatus() {
  const p = ed.p;
  const st = $('#status');
  let h = '';
  if (ed.busy && aiSteps) {
    const cur = aiSteps.findIndex((x) => x.st === 'run');
    const k = cur < 0 ? aiSteps.length : cur;
    h = `<span class="st-ic spin" aria-hidden="true"></span><span class="st-t"><b>AI đang dựng</b> · ${esc(aiSteps[Math.min(k, aiSteps.length - 1)].text)}</span>
      <span class="st-dots" aria-hidden="true">${aiSteps.map((x) => `<i class="${x.st}"></i>`).join('')}</span>
      <button class="btn ghost xs" data-act="skip">${icon(I.ff, 14)} Tua nhanh</button><i class="st-bar" style="width:${Math.round((k / aiSteps.length) * 100 + 100 / aiSteps.length / 2)}%"></i>`;
  } else if (p.main && ed.mainBad) {
    h = `<span class="st-ic warn" aria-hidden="true">!</span><span class="st-t"><b>Video chính chưa hiện hình</b> (thường do video iPhone dạng HEVC).</span><button class="btn ai xs" data-act="fixMain">Sửa video</button>`;
  } else if (!p.main) {
    h = `<span class="st-t">Kéo thả video vào timeline, hoặc bấm <b>Thêm video chính</b> bên dưới.</span>`;
  } else if (!p.aiDone) {
    h = `<span class="st-ic" aria-hidden="true">${icon(I.sparkle, 15)}</span><span class="st-t">Sẵn sàng — bấm <b>AI dựng</b>: cắt lặng, ghép cảnh, thêm chữ, hiệu ứng.</span>`;
  } else if (!p.approved) {
    h = `<span class="st-ic ok" aria-hidden="true">${icon(I.check, 15)}</span><span class="st-t">Bản nháp xong — xem lại rồi bấm <b>Duyệt &amp; xuất</b>.</span><button class="btn ghost xs" data-act="preview">${icon(I.play, 13)} Xem từ đầu</button>`;
  }
  st.hidden = !h;
  st.innerHTML = h;
}
function updateTime() {
  $('#tNow').textContent = fmt(ed.player.T);
  scriptNow();
}

// ---------- KHO CẢNH PHỤ CHỜ XẾP ----------
function renderBin() {
  const p = ed.p;
  const used = new Set(p.broll.map((b) => b.src));
  const wait = Object.values(p.sources).filter((s) => s.kind === 'broll' && !used.has(s.id));
  const bin = $('#bin');
  if (!wait.length || !p.main) {
    bin.hidden = true;
    return;
  }
  bin.hidden = false;
  bin.innerHTML = `<span class="bin-t">${p.aiDone ? 'Cảnh chưa dùng — chạm để chèn tại đầu phát' : 'Cảnh phụ chờ AI xếp'}</span>` + wait.map((s) => `<button class="bin-item" data-src="${s.id}" style="${s.thumbs?.[0] ? `background-image:url(${s.thumbs[0]})` : ''}" title="${esc(s.name)}"><span>${esc(s.name)}</span></button>`).join('');
}

// ---------- THÊM FILE ----------
async function addFiles(kind, files) {
  const p = ed.p;
  if (!files?.length) return;
  if (kind === 'main' && p.main) {
    const ok = await dialog({title: 'Thay video chính?', body: 'Video chính hiện tại và mọi chỗ đã cắt sẽ được thay bằng video mới.', ok: 'Thay video'});
    if (!ok) return;
  }
  ed.busy = true;
  updateStage();
  const bad = [];
  let ok = 0;
  try {
    for (const f of files) {
      toast(`Đang nạp “${esc(f.name)}”…`, 120000);
      let src;
      try {
        src = await importFile(p, f, kind, (m) => toast(esc(m), 120000));
      } catch (e) {
        // 1 file lỗi không làm hỏng cả lượt: các file khác vẫn được thêm
        bad.push([f.name, e.message]);
        if (kind === 'main') throw e;
        continue;
      }
      ok++;
      if (kind === 'main') {
        ed.mainBad = false;
        p.main = {src: src.id, segs: [{in: 0, out: src.duration}]};
        p.transcript = null;
        p.aiDone = false;
        p.approved = false;
        p.broll = [];
        p.texts = [];
        p.zooms = [];
      } else if (kind === 'music') {
        p.music = {src: src.id, vol: 0.2};
      } else if (kind === 'broll' && p.aiDone) {
        const dur = Math.min(3, src.duration);
        p.broll.push({id: uid('b'), src: src.id, start: Math.min(ed.player.T, Math.max(0, duration(p) - dur)), dur, in: Math.max(0, src.duration / 2 - dur / 2), trans: 'fade', locked: true});
      }
    }
    await ed.player.attach(p, ed.getBlob);
    if (!bad.length) toast(kind === 'main' ? 'Đã thêm video chính.' : kind === 'music' ? 'Đã thêm nhạc nền.' : `Đã thêm ${ok} cảnh phụ.`);
  } catch (e) {
    if (!bad.length) bad.push([files[0]?.name || 'video', e.message]);
  }
  if (bad.length) {
    $('#toast').classList.remove('on');
    const head = ok ? `<p>Đã thêm ${ok} file. Chưa thêm được ${bad.length} file:</p>` : '';
    dialog({title: bad.length > 1 || ok ? `Chưa thêm được ${bad.length} file` : 'Chưa thêm được video', body: head + bad.map(([n, m]) => `<p><b>${esc(n)}</b><br>${esc(m)}</p>`).join(''), ok: 'Đã hiểu', cancel: ''});
  }
  ed.busy = false;
  ed.changed(true, true);
}

// Xoá hẳn video chính (cảnh phụ vẫn giữ trong kho để dùng lại)
async function removeMain() {
  const p = ed.p;
  if (!p.main) return;
  const ok = await dialog({title: 'Xoá video chính?', body: 'Video chính, các chỗ đã cắt, chữ và hiệu ứng sẽ bị xoá. Cảnh phụ vẫn còn trong kho để dùng lại. Bấm Hoàn tác nếu đổi ý.', ok: 'Xoá video', danger: true});
  if (!ok) return;
  ed.player.pause();
  ed.history.push(p);
  p.main = null;
  p.transcript = null;
  p.aiDone = false;
  p.approved = false;
  p.broll = [];
  p.texts = [];
  p.zooms = [];
  ed.mainBad = false;
  select(null);
  await ed.player.attach(p, ed.getBlob);
  ed.seek(0);
  ed.changed(true, true);
}

// Dự án cũ có video chưa hiện được hình → đổi định dạng ngay trên máy, giữ nguyên các chỗ đã cắt
async function fixMain() {
  const p = ed.p;
  const src = p.main && p.sources[p.main.src];
  if (!src || ed.busy) return;
  ed.busy = true;
  updateStage();
  try {
    const blob = await ed.getBlob(src.fileKey);
    const {file, meta} = await ensurePlayable(blob, (m) => toast(esc(m), 120000), true);
    await store.putFile(src.fileKey, file);
    Object.assign(src, {w: meta.w, h: meta.h});
    try {
      src.thumbs = await thumbs(file, 14);
    } catch (e) {
      /* giữ ảnh cũ */
    }
    ed.mainBad = false;
    ed.player._drop(src.id);
    await ed.player.attach(p, ed.getBlob);
    toast('Đã sửa video — phát được rồi.');
  } catch (e) {
    $('#toast').classList.remove('on');
    dialog({title: 'Chưa sửa được video', body: `<p>${esc(e.message)}</p>`, ok: 'Đã hiểu', cancel: ''});
  }
  ed.busy = false;
  ed.changed(true);
}

// Kéo thả file từ máy tính vào app
function bindDrop() {
  const ov = $('#dropov');
  let depth = 0;
  const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', (e) => {
    if (!isFiles(e) || $('#editor').hidden) return;
    depth++;
    ov.hidden = false;
  });
  document.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) ov.hidden = true;
  });
  document.addEventListener('dragover', (e) => {
    if (isFiles(e)) e.preventDefault();
  });
  document.addEventListener('drop', async (e) => {
    if (!isFiles(e)) return;
    e.preventDefault();
    depth = 0;
    ov.hidden = true;
    if ($('#editor').hidden || ed.busy) return;
    const fs = [...e.dataTransfer.files];
    const vids = fs.filter((f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    const auds = fs.filter((f) => /^audio\//.test(f.type));
    if (!ed.p.main && vids.length) {
      // video dài nhất là video chính, còn lại là cảnh phụ
      const metas = await Promise.all(vids.map((f) => probeVideo(f).then((m) => m.duration).catch(() => 0)));
      const i = metas.indexOf(Math.max(...metas));
      await addFiles('main', [vids[i]]);
      const rest = vids.filter((_, j) => j !== i);
      if (rest.length) await addFiles('broll', rest);
    } else if (vids.length) await addFiles('broll', vids);
    if (auds.length) await addFiles('music', [auds[0]]);
  });
}

function pick(kind) {
  const inp = $('#file');
  inp.accept = kind === 'music' ? 'audio/*' : 'video/*';
  inp.multiple = kind === 'broll';
  inp.onchange = () => {
    const fs = [...inp.files];
    inp.value = '';
    addFiles(kind, fs);
  };
  inp.click();
}

// ---------- CHỌN & BẢNG SỬA ----------
function select(sel) {
  if (JSON.stringify(sel) !== JSON.stringify(ed.sel)) ed.ctxOff = false;
  ed.sel = sel;
  ed.tl.sel = sel;
  ed.player.highlight = sel?.type === 'text' ? sel.id : null;
  ed.player.dirty = true;
  ed.tl.render(ed.p);
  renderSelBar();
  renderInspector();
  renderCtx();
  if (sel && ITEM_TYPES.includes(sel.type)) {
    const it = selItem();
    if (it && (ed.player.T < it.start || ed.player.T > it.start + it.dur)) ed.seek(it.start + Math.min(0.8, it.dur / 2));
  }
}

function renderSelBar() {
  const s = ed.sel;
  const bar = $('#selbar');
  const dc = $('#dockClip');
  const dt = $('#dockTools');
  if (!s) {
    bar.hidden = true;
    dc.hidden = true;
    dt.hidden = false;
    return;
  }
  bar.hidden = false;
  const canAi = ['text', 'broll', 'zoom', 'sticker', 'subs', 'music'].includes(s.type);
  const canDel = ['text', 'broll', 'zoom', 'seg', 'music', 'sticker', 'sfx'].includes(s.type);
  bar.innerHTML = `
    ${canAi ? `<button class="sb ai" data-act="clipAi">${icon(I.sparkle, 17)}<span>Nhờ AI sửa</span></button>` : ''}
    <button class="sb" data-act="sheet">${icon(I.edit, 17)}<span>Sửa tay</span></button>
    ${s.type === 'seg' ? `<button class="sb" data-act="split">${icon(I.split, 17)}<span>Tách</span></button>` : ''}
    ${canDel ? `<button class="sb" data-act="del">${icon(I.trash, 17)}<span>Xoá</span></button>` : ''}`;
  // điện thoại: thanh công cụ đáy đổi sang thao tác cho clip đang chọn (kiểu CapCut)
  const name = {text: 'Chữ', broll: 'Cảnh phụ', zoom: 'Hiệu ứng', seg: 'Đoạn video', music: 'Nhạc nền', sticker: 'Hình', sfx: 'Âm thanh', subs: 'Phụ đề'}[s.type] || 'Clip';
  const dk = (act, ic, label, cls = '') => `<button class="dk${cls}" data-act="${act}">${icon(ic, 21)}<span>${label}</span></button>`;
  dc.innerHTML = `<button class="dk back" data-act="deselect" aria-label="Bỏ chọn">${icon(I.back, 21)}<span>${name}</span></button><i class="dk-sep" aria-hidden="true"></i>
    ${canAi ? dk('clipAi', I.sparkle, 'Nhờ AI', ' ai') : ''}
    ${dk('sheet', I.edit, 'Sửa')}
    ${s.type === 'sticker' && selItem()?.kind !== 'gfx' ? dk('libReplace', I.swap, 'Đổi hình') : ''}
    ${s.type === 'seg' ? dk('split', I.split, 'Tách') : ''}
    ${canDel ? dk('del', I.trash, 'Xoá', ' del') : ''}`;
  dc.hidden = false;
  dt.hidden = true;
}

const TRANS = TRANSITIONS;

function renderInspector() {
  const box = $('#insp');
  const p = ed.p;
  if (!p) return;
  const s = ed.sel;
  const it = selItem();
  let h = '';
  if (s?.type === 'text' && it) {
    h = `<h4>Cụm chữ</h4>
      ${it.locked ? `<p class="lockn">${icon(I.lock, 15)} Bạn đã sửa tay — AI sẽ không ghi đè chỗ này.</p>` : ''}
      <label class="fl">Dòng dẫn nhỏ<input data-k="lead" value="${esc(it.lead)}" maxlength="30" placeholder="vd: diện tích"></label>
      <label class="fl">Chữ chính<input data-k="main" value="${esc(it.main)}" maxlength="40"></label>
      <label class="fl">Dòng ký tay<input data-k="sign" value="${esc(it.sign)}" maxlength="40" placeholder="vd: chỉ hôm nay"></label>
      <div class="fl"><span>Font <small class="fcount">${Object.keys(FONTS).length} font có dấu</small></span>${fontPicker(it.font)}</div>
      <div class="fl"><span>Màu</span><div class="swatches">${COLORS.map((c) => `<button class="sw${it.color === c.hex ? ' on' : ''}" data-set="color" data-v="${c.hex}" style="background:${c.hex}" aria-label="Màu ${c.name}"></button>`).join('')}</div></div>
      <div class="fl"><span>Kiểu chữ</span><div class="chips">${TEXT_STYLES.map(([k, l]) => `<button class="chip-b${(it.style || '3d') === k ? ' on' : ''}" data-set="style" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="fl"><span>Chuyển động chữ</span><div class="chips">${TEXT_MOTIONS.map(([k, l]) => `<button class="chip-b${(it.motion || 'pop') === k ? ' on' : ''}" data-set="motion" data-v="${k}">${l}</button>`).join('')}</div></div>
      <label class="fl">Cỡ chữ <output>${Math.round((it.size || 1) * 100)}%</output><input type="range" min="0.5" max="1.8" step="0.05" value="${it.size || 1}" data-num="size"></label>
      <div class="fl"><span>Icon động</span><div class="chips">${[['', 'Không'], ...Object.entries(ICONS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="chip-b${(it.icon || '') === k ? ' on' : ''}" data-set="icon" data-v="${k}">${l}</button>`).join('')}</div></div>
      <p class="hint">Kéo chữ trên khung xem để đổi vị trí. Kéo hai đầu clip trên timeline để đổi lúc hiện / ẩn.</p>`;
  } else if (s?.type === 'broll' && it) {
    const src = p.sources[it.src];
    const others = Object.values(p.sources).filter((x) => x.kind === 'broll');
    h = `<h4>Cảnh phụ · ${esc(src?.name)}</h4>
      <div class="fl"><span>Cảnh này là</span><button class="mtag${src?.tag ? '' : ' none'}" data-tagsrc="${src?.id}">${src?.tag ? `${esc(src.tag)}${src.tagBy === 'ai' ? ' · AI đoán' : ''}` : 'Đặt nhãn cảnh'}</button></div>
      ${it.locked ? `<p class="lockn">${icon(I.lock, 15)} Bạn đã sửa tay — AI sẽ không ghi đè chỗ này.</p>` : ''}
      <div class="fl"><span>Chuyển cảnh</span><div class="chips">${TRANS.map(([k, l]) => `<button class="chip-b${(it.trans || 'fade') === k ? ' on' : ''}" data-set="trans" data-v="${k}">${l}</button>`).join('')}</div></div>
      <label class="fl">Lấy đoạn nào của cảnh <output>${it.in.toFixed(1).replace('.', ',')} s</output><input type="range" min="0" max="${Math.max(0, (src?.duration || 0) - it.dur).toFixed(2)}" step="0.1" value="${it.in}" data-num="in"></label>
      <div class="fl"><span>Đổi sang cảnh khác</span><div class="chips">${others.map((o) => `<button class="chip-b${o.id === it.src ? ' on' : ''}" data-set="src" data-v="${o.id}">${esc(o.name)}</button>`).join('')}</div></div>
      <p class="hint">Kéo clip trên timeline để dời, kéo hai đầu để dài/ngắn.</p>`;
  } else if (s?.type === 'sticker' && it?.kind === 'gfx') {
    const hasText = ['hook', 'lower', 'follow'].includes(it.key);
    h = `<h4>Đồ hoạ · ${esc(GFX_MAP[it.key]?.label || '')}</h4>
      ${hasText ? `<label class="fl">${it.key === 'lower' ? 'Tên' : 'Chữ'}<input data-k="label" value="${esc(it.label || '')}" maxlength="40"></label>` : ''}
      ${it.key === 'lower' ? `<label class="fl">Dòng phụ<input data-k="sub" value="${esc(it.sub || '')}" maxlength="50"></label>` : ''}
      ${it.key === 'hook' ? `<div class="fl"><span>Kiểu tiêu đề</span><div class="chips">${HOOK_VARIANTS.map(([k, l]) => `<button class="chip-b${(it.variant || 'band') === k ? ' on' : ''}" data-set="variant" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      <div class="fl"><span>Màu</span><div class="swatches">${['#ffc61a', '#ff2a2a', '#2ad46a', '#2f8cff', '#ff5fb8', '#ffffff', '#f3d27a', '#2fd2ff'].map((c) => `<button class="sw${it.color === c ? ' on' : ''}" data-set="color" data-v="${c}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('')}</div></div>
      ${it.key !== 'progress' && it.key !== 'confetti' && it.key !== 'leak' ? `<label class="fl">Cỡ <output>${Math.round((it.size || 1) * 100)}%</output><input type="range" min="0.5" max="1.8" step="0.05" value="${it.size || 1}" data-num="size"></label>` : ''}
      ${it.locked ? `<p class="lockn">${icon(I.lock, 15)} Bạn đã sửa tay — AI sẽ không ghi đè chỗ này.</p>` : ''}
      <p class="hint">${['progress', 'confetti', 'leak'].includes(it.key) ? 'Kéo hai đầu clip trên timeline để đổi lúc hiện / ẩn.' : 'Kéo trên khung xem để đổi vị trí. Kéo hai đầu clip trên timeline để đổi lúc hiện / ẩn.'}</p>`;
  } else if (s?.type === 'sticker' && it) {
    h = `<h4>${it.kind === 'icon' ? 'Icon động' : it.kind === 'anim' ? 'Emoji động' : 'Hình minh hoạ'}${it.label ? ' · ' + esc(it.label) : ''}</h4>
      <div class="stk-prev${it.kind === 'icon' ? ' ic' : ''}" style="${it.kind === 'icon' ? `--c:${it.color || '#2f8cff'}` : ''}"><img src="${it.kind === 'anim' ? `lib/a/${esc(it.key)}.webp` : `lib/${it.kind === 'icon' ? 'i' : 'e'}/${esc(it.key)}.svg`}" alt=""><button class="btn ghost sm" data-act="libReplace">Đổi hình khác</button></div>
      <div class="fl"><span>Chuyển động</span><div class="chips">${MOTIONS.map(([k, l]) => `<button class="chip-b${(it.motion || 'pop') === k ? ' on' : ''}" data-set="motion" data-v="${k}">${l}</button>`).join('')}</div></div>
      <label class="fl">Cỡ <output>${Math.round((it.size || 1) * 100)}%</output><input type="range" min="0.4" max="2.2" step="0.05" value="${it.size || 1}" data-num="size"></label>
      ${it.kind === 'icon' ? `<div class="fl"><span>Màu nền icon</span><div class="swatches">${COLORS.map((c) => `<button class="sw${it.color === c.hex ? ' on' : ''}" data-set="color" data-v="${c.hex}" style="background:${c.hex}" aria-label="Màu ${c.name}"></button>`).join('')}</div></div>` : ''}
      <p class="hint">Kéo hình trên khung xem để đổi vị trí. Kéo hai đầu clip trên timeline để đổi lúc hiện / ẩn.</p>`;
  } else if (s?.type === 'sfx' && it) {
    h = `<h4>Âm thanh · ${esc(it.name || it.sfx)}</h4>
      <button class="btn ghost wide" data-playsfx="${esc(it.sfx)}">${icon(I.play, 15)} Nghe thử</button>
      <label class="fl">Âm lượng <output>${Math.round((it.vol ?? 0.5) * 100)}%</output><input type="range" min="0.05" max="1.2" step="0.05" value="${it.vol ?? 0.5}" data-num="vol"></label>
      <div class="fl"><span>Đổi âm khác</span><div class="chips">${SFX.map((x) => `<button class="chip-b${it.sfx === x.key ? ' on' : ''}" data-set="sfx" data-v="${x.key}">${x.name}</button>`).join('')}</div></div>
      <p class="hint">Kéo clip trên timeline để dời âm thanh tới đúng lúc.</p>`;
  } else if (s?.type === 'zoom' && it) {
    h = `<h4>${it.kind === 'punch' ? 'Zoom giật (che chỗ cắt)' : it.kind === 'push' ? 'Đẩy máy chậm' : 'Zoom đẩy máy'}</h4><label class="fl">Độ phóng <output>${Math.round((it.scale - 1) * 100)}%</output><input type="range" min="1.02" max="1.25" step="0.01" value="${it.scale}" data-num="scale"></label>`;
  } else if (s?.type === 'seg' && it) {
    const si = +s.id;
    h = `<h4>Đoạn video chính</h4><p class="hint">Kéo hai đầu đoạn để lấy thêm / bớt hình. Bấm Tách để cắt tại đầu phát.</p>
      ${si > 0 ? `<div class="fl"><span>Chuyển cảnh vào đoạn này</span><div class="chips">${JUMP_TRANS.map(([k, l]) => `<button class="chip-b${(it.tr || 'none') === k ? ' on' : ''}" data-segfx="${k}">${l}</button>`).join('')}</div></div>` : ''}
      <button class="btn ghost wide" data-act="split">${icon(I.split, 17)} Tách tại đầu phát</button>
      <button class="btn ghost wide" data-act="restore">Khôi phục mọi đoạn đã cắt</button>
      <div class="row2"><button class="btn ghost" data-act="replaceMain">${icon(I.film, 16)} Thay video</button><button class="btn ghost danger" data-act="removeMain">${icon(I.trash, 16)} Xoá video</button></div>`;
  } else if (s?.type === 'subs') {
    h = subsPanel();
  } else if (s?.type === 'music' && it) {
    h = `<h4>Nhạc nền</h4><label class="fl">Âm lượng nhạc <output>${Math.round(it.vol * 100)}%</output><input type="range" min="0.02" max="0.8" step="0.01" value="${it.vol}" data-music="vol"></label>
      <button class="btn ghost wide" data-act="addMusic">Đổi bài nhạc</button>`;
  } else {
    h = `<h4>Video</h4>
      <div class="quick">
        <button class="qa" data-act="addText">${icon(I.text)}<span>Thêm chữ</span></button>
        <button class="qa" data-act="addBroll">${icon(I.film)}<span>Thêm cảnh</span></button>
        <button class="qa" data-act="addMusic">${icon(I.music)}<span>${p.music ? 'Đổi nhạc' : 'Thêm nhạc'}</span></button>
        <button class="qa" data-act="subs">${icon(I.sub)}<span>Phụ đề</span></button>
      </div>
      <div class="fl"><span>Thể loại video <small class="muted">— AI dựng theo kiểu này</small></span><div class="chips">${Object.entries(GENRES).map(([k, g]) => `<button class="chip-b${p.genre === k ? ' on' : ''}" data-genre="${k}" title="${esc(g.desc)}">${g.label}</button>`).join('')}</div></div>
      <div class="fl"><span>Phong cách <small class="fcount">${p.pack ? (p.packBy === 'user' ? 'bạn chọn' : 'AI chọn') + ' · ' + esc(PACKS[p.pack]?.name || '') : 'AI chọn khi dựng'}</small></span>
        <div class="pk-grid">${packsFor(p.genre).map((x) => `<button class="pk-it${p.pack === x.key ? ' on' : ''}" data-pack="${x.key}" title="${esc(x.desc)}"><canvas width="120" height="${Math.round((120 * H) / W)}" data-pkp="${x.key}"></canvas><small>${esc(x.name)}</small></button>`).join('')}</div>
        ${p.packBy === 'user' ? '<button class="lnk" data-pack="auto">Để AI chọn phong cách</button>' : ''}</div>
      <div class="fl"><span>Nhịp cắt khoảng lặng <small class="fcount">AI cắt chỗ ngừng nói</small></span><div class="seg">${Object.entries(CUT_PACE).map(([k, v]) => `<button class="${(p.cutPace || 'tight') === k ? 'on' : ''}" data-pace="${k}">${v.label}</button>`).join('')}</div></div>
      <div class="fl"><span>Chữ điểm nhấn <small class="fcount">số liệu, giá, ý chính</small></span><div class="seg">${Object.entries(TEXT_DENSITY).map(([k, v]) => `<button class="${(p.textDensity || 'vua') === k ? 'on' : ''}" data-density="${k}">${v.label}</button>`).join('')}</div></div>
      <div class="fl"><span>Khổ hình</span><div class="fmts">${Object.entries(FORMATS).map(([k, f]) => `<button class="fmt${p.format === k ? ' on' : ''}" data-format="${k}" title="${esc(f.note)}"><i style="aspect-ratio:${f.w}/${f.h}"></i><b>${k}</b><small>${esc(f.note.split(',')[0])}</small></button>`).join('')}</div></div>
      <label class="fl tog"><input type="checkbox" data-cta="on" ${p.cta?.on ? 'checked' : ''}> Đoạn kết kêu gọi (4 giây cuối)</label>
      ${p.cta?.on ? `<label class="fl">Chữ đoạn kết<input data-cta="text" value="${esc(p.cta.text)}" maxlength="30" placeholder="${esc(genreOf(p).cta)}"></label>` : ''}
      <p class="hint">Chạm vào một clip trên timeline để sửa, hoặc nhắn AI ở ô bên dưới.</p>
      <p class="hint kbd-hint">Phím tắt: <kbd>Space</kbd> phát/dừng · <kbd>←</kbd><kbd>→</kbd> từng khung (<kbd>Shift</kbd> 1 giây) · <kbd>S</kbd> tách · <kbd>Delete</kbd> xoá · <kbd>Ctrl</kbd>+<kbd>Z</kbd> hoàn tác · <kbd>+</kbd><kbd>−</kbd> phóng timeline</p>`;
  }
  box.innerHTML = h;
  if (h.includes('data-fload')) watchFontPreviews();
  if (h.includes('data-pkp')) drawPackThumbs();
}
function subsPanel() {
  const st = ed.p.subs;
  const style = SUB_STYLES[st.style] ? st.style : 'karaoke';
  return `<h4>Phụ đề</h4>
    <label class="fl tog"><input type="checkbox" data-subs="on" ${st.on ? 'checked' : ''}> Hiện phụ đề</label>
    ${ed.p.transcript ? '' : '<p class="hint">Phụ đề có sau khi bấm <b>AI dựng</b> (AI nghe và chép lời).</p>'}
    <div class="fl"><span>Kiểu phụ đề</span><div class="substyles">${Object.entries(SUB_STYLES).map(([k, v]) => `<button class="sst sst-${k}${style === k ? ' on' : ''}" data-subs-style="${k}"><i>${k === 'clean' ? 'Xin chào' : k === 'pop' ? 'Xin <u>chào</u>' : 'XIN <u>CHÀO</u>'}</i><small>${v.label}</small></button>`).join('')}</div></div>
    ${style !== 'clean' && style !== 'pop' ? `<div class="fl"><span>Màu nhấn (chữ đang nói, con số)</span><div class="swatches">${['#ffd21f', '#2ad46a', '#5fd3ff', '#ff5fb8', '#ff7a1a', '#ffffff'].map((c) => `<button class="sw${(st.hl || '#ffd21f') === c ? ' on' : ''}" data-subs-hl="${c}" style="background:${c}" aria-label="Màu nhấn ${c}"></button>`).join('')}</div></div>` : ''}
    <label class="fl">Cỡ chữ <output>${Math.round((st.size || 1) * 100)}%</output><input type="range" min="0.6" max="1.6" step="0.05" value="${st.size || 1}" data-subs="size"></label>
    <label class="fl">Vị trí (cao ↔ thấp)<input type="range" min="0.3" max="0.9" step="0.01" value="${st.y ?? 0.7}" data-subs="y"></label>
    <div class="fl"><span>Màu chữ</span><div class="swatches">${['#ffffff', '#ffc61a', '#2ad46a', '#5fd3ff'].map((c) => `<button class="sw${(st.color || '#ffffff') === c ? ' on' : ''}" data-subs-color="${c}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('')}</div></div>`;
}

// Bảng chọn font: chia nhóm, mỗi font hiện bằng chính nó (tải khi lướt tới)
function fontPicker(cur) {
  const base = Object.entries(FONTS).filter(([, f]) => !f.lib);
  const groups = [['Mẫu 1', base], ...FONT_CATS.map((c) => [c, Object.entries(FONTS).filter(([, f]) => f.cat === c)])];
  return `<div class="fpick">${groups
    .map(([g, list]) => `<b class="fg">${g}</b>${list.map(([k, f]) => `<button class="fopt${(cur || 'anton') === k ? ' on' : ''}" data-set="font" data-v="${k}" data-fload="${f.lib ? k : ''}" style="font-family:${esc(f.family)},sans-serif;font-weight:${f.weight}">${esc(f.label)} <span>Chữ Việt đẹp</span></button>`).join('')}`)
    .join('')}</div>`;
}
let fontIO = null;
function watchFontPreviews() {
  if (!('IntersectionObserver' in window)) return $$('[data-fload]').forEach((b) => b.dataset.fload && ensureFont(b.dataset.fload));
  fontIO = fontIO || new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.dataset.fload && (ensureFont(e.target.dataset.fload), fontIO.unobserve(e.target))), {rootMargin: '120px'});
  $$('[data-fload]').forEach((b) => b.dataset.fload && fontIO.observe(b));
  $('.fopt.on')?.scrollIntoView({block: 'nearest'});
}

// ---------- bảng sửa: sự kiện ----------
function bindInspector() {
  const box = $('#insp');
  let pushed = false;
  box.addEventListener('focusin', () => (pushed = false));
  box.addEventListener('input', (e) => {
    const el = e.target;
    const it = selItem();
    const p = ed.p;
    if (!pushed) {
      ed.history.push(p);
      pushed = true;
    }
    if (el.dataset.k && it) {
      it[el.dataset.k] = el.value;
      it.locked = true;
    } else if (el.dataset.num && it) {
      it[el.dataset.num] = +el.value;
      if ('locked' in it) it.locked = true;
      const o = el.closest('label')?.querySelector('output');
      if (o) o.textContent = el.dataset.num === 'in' ? (+el.value).toFixed(1).replace('.', ',') + ' s' : el.dataset.num === 'scale' ? Math.round((+el.value - 1) * 100) + '%' : Math.round(+el.value * 100) + '%';
    } else if (el.dataset.subs) {
      const k = el.dataset.subs;
      p.subs[k] = el.type === 'checkbox' ? el.checked : +el.value;
    } else if (el.dataset.music && p.music) {
      p.music.vol = +el.value;
      const o = el.closest('label')?.querySelector('output');
      if (o) o.textContent = Math.round(+el.value * 100) + '%';
    } else if (el.dataset.cta) {
      const k = el.dataset.cta;
      p.cta[k] = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'on') renderInspector();
    } else return;
    p._rev++;
    if (p.approved) p.approved = false;
    ed.player.dirty = true;
    ed.player.refresh();
    ed.tl.render(p);
    updateStage();
    queueSave();
  });
  box.addEventListener('change', () => (pushed = false));
  box.addEventListener('click', (e) => {
    const g = e.target.closest('[data-genre]');
    if (g) return setGenre(g.dataset.genre);
    const fm = e.target.closest('[data-format]');
    if (fm) return setFormatOf(fm.dataset.format);
    const sf = e.target.closest('[data-segfx]');
    if (sf && ed.sel?.type === 'seg') return manual(() => applyOp(ed.p, {op: 'segfx', i: +ed.sel.id, tr: sf.dataset.segfx}), {lock: false});
    const pc = e.target.closest('[data-pace]');
    if (pc) {
      manual(() => (ed.p.cutPace = pc.dataset.pace), {lock: false});
      return toast(`Nhịp cắt: ${CUT_PACE[pc.dataset.pace].label}${ed.p.aiDone ? ' — bấm Dựng lại để AI cắt lại (không tốn lượt chép lời)' : ''}`);
    }
    const pk = e.target.closest('[data-pack]');
    if (pk) {
      const k = pk.dataset.pack;
      if (k === 'auto') {
        manual(() => (ed.p.packBy = null), {lock: false});
        return toast('AI sẽ tự chọn phong cách ở lần dựng sau');
      }
      manual(() => restyle(ed.p, k, 'user'), {lock: false});
      ensureProjectFonts(ed.p).then(() => (ed.player.dirty = true));
      return toast(`Phong cách: ${PACKS[k].name}${ed.p.aiDone ? ' — đã áp cho chữ, phụ đề, chuyển cảnh, màu (chỗ bạn sửa tay giữ nguyên)' : ' — AI sẽ dựng theo kiểu này'}`);
    }
    const dn = e.target.closest('[data-density]');
    if (dn) {
      manual(() => (ed.p.textDensity = dn.dataset.density), {lock: false});
      return toast(`Chữ điểm nhấn: ${TEXT_DENSITY[dn.dataset.density].label}${ed.p.aiDone ? ' — bấm Dựng lại để AI làm lại chữ' : ''}`);
    }
    const ps = e.target.closest('[data-playsfx]');
    if (ps) return playSfx(ps.dataset.playsfx, selItem()?.vol ?? 0.6);
    const b = e.target.closest('[data-set],[data-subs-color],[data-subs-style],[data-subs-hl]');
    if (!b) return;
    if (b.dataset.subsColor) {
      manual(() => Object.assign(ed.p.subs, {color: b.dataset.subsColor, by: 'user'}), {lock: false});
      return;
    }
    if (b.dataset.subsStyle) {
      manual(() => Object.assign(ed.p.subs, {style: b.dataset.subsStyle, on: true, by: 'user'}), {lock: false});
      return;
    }
    if (b.dataset.subsHl) {
      manual(() => Object.assign(ed.p.subs, {hl: b.dataset.subsHl, by: 'user'}), {lock: false});
      return;
    }
    const k = b.dataset.set;
    manual(() => {
      const it = selItem();
      if (!it) return;
      if (k === 'src') {
        const src = ed.p.sources[b.dataset.v];
        it.src = src.id;
        it.dur = Math.min(it.dur, src.duration);
        it.in = Math.max(0, Math.min(it.in, src.duration - it.dur));
      } else if (k === 'sfx') {
        const d = SFX_MAP[b.dataset.v];
        if (!d) return;
        Object.assign(it, {sfx: d.key, name: d.name, dur: d.len});
        playSfx(d.key, it.vol ?? 0.5);
      } else it[k] = b.dataset.v;
    });
  });
}

// Đổi thể loại: câu kết mặc định đổi theo (nếu khách chưa tự sửa câu kết)
function setGenre(k) {
  const p = ed.p;
  if (!GENRES[k] || p.genre === k) return;
  const wasDefault = !p.cta?.text || Object.values(GENRES).some((g) => g.cta === p.cta.text);
  manual(() => {
    p.genre = k;
    if (wasDefault) p.cta.text = GENRES[k].cta;
  }, {lock: false});
  rememberChoice(k, null);
  toast(`Thể loại: ${GENRES[k].label}${p.aiDone ? ' — bấm Dựng lại để AI dựng theo kiểu mới' : ''}`);
}
// Đổi khổ hình: chữ/phụ đề giữ vị trí tương đối, video tự phủ kín khung
function setFormatOf(k) {
  const p = ed.p;
  if (!FORMATS[k] || p.format === k) return;
  manual(() => (p.format = k), {lock: false});
  ed.player.setFormat(k);
  rememberChoice(null, k);
}

// ---------- hành động ----------
async function act(a, el) {
  const p = ed.p;
  switch (a) {
    case 'addMain':
      return pick('main');
    case 'addBroll':
      return pick('broll');
    case 'addMusic':
      return pick('music');
    case 'ai':
      return runAuto();
    case 'addText': {
      const t = newText(ed.player.T, {main: 'CHỮ MỚI', lead: '', locked: true});
      manual(() => p.texts.push(t));
      select({type: 'text', id: t.id});
      openSheet(true);
      return;
    }
    case 'subs':
      select({type: 'subs', id: 'subs'});
      openSheet(true);
      return;
    case 'project':
      select(null);
      openSheet(true);
      return;
    case 'split':
      manual(() => applyOp(p, {op: 'split', T: ed.player.T}), {lock: false});
      return;
    case 'replaceMain':
      return pick('main');
    case 'removeMain':
      return removeMain();
    case 'fixMain':
      return fixMain();
    case 'restore': {
      const src = p.sources[p.main.src];
      manual(() => (p.main.segs = [{in: 0, out: src.duration}]), {lock: false});
      select(null);
      return;
    }
    case 'del': {
      const s = ed.sel;
      if (!s) return;
      if (s.type === 'seg' && p.main.segs.length <= 1) return removeMain();
      if (s.type === 'seg') manual(() => applyOp(p, {op: 'deleteSeg', i: +s.id}), {lock: false});
      else if (s.type === 'music') manual(() => (p.music = null), {lock: false});
      else manual(() => applyOp(p, {op: 'remove', id: s.id}), {lock: false});
      select(null);
      return;
    }
    case 'sheet':
      return openSheet(true);
    case 'undo':
      return undoRedo(-1);
    case 'redo':
      return undoRedo(1);
    case 'deselect':
      return select(null);
    case 'packs':
      select(null);
      openSheet(true);
      requestAnimationFrame(() => $('#insp .pk-grid')?.closest('.fl')?.scrollIntoView({block: 'start'}));
      return;
    case 'lib':
      ed.libTab = el.dataset.lib;
      return openPane('media');
    case 'pane':
      return openPane(el.dataset.pane2);
    case 'note':
      setTool(ed.tool === 'note' ? 'select' : 'note');
      if (ed.tool === 'note') toast('Chạm lên khung hình chỗ muốn sửa, rồi nhắn AI.', 3500);
      return;
    case 'closeSheet':
      return openSheet(false);
    case 'clipAi':
      // máy tính: gõ thẳng vào ô chat (clip đã gắn thẻ); điện thoại: hộp thoại gợi ý
      if (matchMedia('(min-width: 900px)').matches) {
        ed.ctxOff = false;
        renderCtx();
        if (!matchMedia('(min-width: 1200px)').matches) $('#side [data-tab="chat"]')?.click();
        $('#chatIn').focus();
        return;
      }
      return openClipAi();
    case 'ctxOff':
      ed.ctxOff = true;
      renderCtx();
      return;
    case 'undoMsg':
      el.disabled = true;
      undoRedo(-1);
      return;
    case 'libReplace': {
      const it = selItem();
      if (!it || ed.sel?.type !== 'sticker') return;
      ed.libReplace = it.id;
      ed.libTab = it.kind === 'icon' ? 'icon' : it.kind === 'anim' ? 'anim' : 'emoji';
      openPane('media');
      return;
    }
    case 'libCancel':
      ed.libReplace = null;
      renderMedia();
      return;
    case 'home':
      return closeEditor();
    case 'scCut': {
      if (scriptSel.a < 0) return;
      const {a, b} = scriptRange();
      manual(() => applyOp(p, {op: 'cut', a, b}), {lock: false});
      scriptSel.a = scriptSel.b = -1;
      renderScript();
      return;
    }
    case 'scUncut': {
      if (scriptSel.a < 0) return;
      const {a, b} = scriptRange();
      manual(() => applyOp(p, {op: 'uncut', a, b}), {lock: false});
      scriptSel.a = scriptSel.b = -1;
      renderScript();
      return;
    }
    case 'scClear':
      scriptSel.a = scriptSel.b = -1;
      renderScript();
      return;
    case 'play':
      ed.player.toggle();
      return;
    case 'tlIn':
      return ed.tl.zoom(1.3);
    case 'tlOut':
      return ed.tl.zoom(1 / 1.3);
    case 'preview':
      ed.seek(0);
      ed.player.play();
      return;
    case 'approve':
      return openExport();
    case 'export':
      return openExport();
    case 'skip':
      ed.cur.skip = true;
      return;
    case 'install':
      return;
  }
}

// ---------- tấm sửa trên điện thoại ----------
function openSheet(on) {
  $('#side').classList.toggle('open', on);
  if (on) $('#side').querySelector('[data-tab="edit"]')?.click();
}
function openPane(pane) {
  $('#side').classList.add('open');
  $(`#side [data-tab="${pane}"]`)?.click();
}

// ---------- AI dựng từ A–Z ----------
const STEPS = [
  ['nghe', 'Nghe video'],
  ['nghe2', 'Chép lời làm phụ đề'],
  ['cat', 'Cắt khoảng lặng'],
  ['ke', 'Lên kịch bản dựng'],
  ['dung', 'Ghép cảnh, chữ, hiệu ứng'],
];
async function runAuto() {
  const p = ed.p;
  if (!p.main || ed.busy) return;
  if (p.aiDone) {
    const ok = await dialog({title: 'Dựng lại từ đầu?', body: 'AI sẽ dựng lại toàn bộ: cảnh phụ, chữ và hiệu ứng hiện tại được thay mới. Chỗ bạn muốn giữ thì nhờ AI sửa từng chỗ sẽ an toàn hơn.', ok: 'Dựng lại'});
    if (!ok) return;
    const src = p.sources[p.main.src];
    p.main.segs = [{in: 0, out: src.duration}];
    p.broll = [];
    p.texts = [];
    p.zooms = [];
    p.stickers = [];
    p.sfx = [];
    p.aiDone = false;
  }
  ed.busy = true;
  ed.history.push(p);
  select(null);
  openSheet(false);
  aiSteps = STEPS.map(([k, l]) => ({k, text: l, st: ''}));
  updateStage();
  const log = (k, st, text) => {
    const s = aiSteps.find((x) => x.k === k);
    if (!s) return;
    s.st = st;
    s.text = text;
    renderStatus();
  };
  ed.cur.skip = false;
  try {
    await autoEdit(ed, log);
    ed.seek(0);
  } catch (e) {
    console.error(e);
    toast('AI dựng bị lỗi: ' + esc(e.message), 8000);
  }
  ed.cur.skip = false;
  ed.busy = false;
  aiSteps = null;
  ed.changed(true, true);
}

// ---------- Nhờ AI sửa clip / chat ----------
const CLIP_HINTS = {
  text: ['Đổi sang màu vàng', 'Chữ to hơn', 'Dời lên trên', 'Kiểu có viền', 'Hiện dài thêm 1 giây'],
  broll: ['Dài thêm 1 giây', 'Chuyển cảnh trượt', 'Ngắn lại 1 giây', 'Xoá cảnh này'],
  zoom: ['Xoá hiệu ứng này'],
  sticker: ['To hơn', 'Dời lên trên', 'Hiện dài thêm 1 giây', 'Xoá hình này'],
  subs: ['Phụ đề to hơn', 'Dời phụ đề lên trên', 'Tắt phụ đề'],
  music: ['Nhạc nhỏ lại', 'Nhạc to hơn', 'Bỏ nhạc'],
};
function openClipAi() {
  const s = ed.sel;
  if (!s) return;
  const d = $('#clipAi');
  d.hidden = false;
  d.innerHTML = `<form class="dlg-card"><h3>${icon(I.sparkle, 18)} Nhờ AI sửa ${s.type === 'text' ? 'cụm chữ' : s.type === 'broll' ? 'cảnh này' : s.type === 'sticker' ? 'hình này' : s.type === 'subs' ? 'phụ đề' : s.type === 'music' ? 'nhạc' : 'hiệu ứng'}</h3>
    <label class="fl"><span>Bạn muốn sửa thế nào?</span><textarea rows="2" name="q" placeholder="vd: đổi sang màu vàng, to hơn một chút"></textarea></label>
    <div class="chips">${(CLIP_HINTS[s.type] || []).map((x) => `<button type="button" class="chip-b" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="dlg-act"><button type="button" class="btn ghost" data-close>Huỷ</button><button class="btn primary">${icon(I.send, 16)} Gửi cho AI</button></div></form>`;
  const f = d.querySelector('form');
  f.q.focus();
  d.onclick = (e) => {
    if (e.target === d || e.target.closest('[data-close]')) d.hidden = true;
    const q = e.target.closest('[data-q]');
    if (q) f.q.value = q.dataset.q;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const q = f.q.value.trim();
    if (!q) return;
    d.hidden = true;
    await sendAi(q, s.type === 'subs' || s.type === 'music' ? null : s.id, s.type === 'subs' ? 'phụ đề ' : s.type === 'music' ? 'nhạc ' : '');
  };
}
async function sendAi(q, target, prefix = '', ctxLabel = '') {
  if (ed.busy) return;
  addMsg('me', (ctxLabel ? `<span class="ctx">${esc(ctxLabel)}</span><br>` : '') + esc(q), true);
  ed.busy = true;
  updateStage();
  const typing = addMsg('ai', '<span class="dots"><i></i><i></i><i></i></span>');
  const before = ed.history.undo.length;
  try {
    const r = await askAi(ed, prefix + q, target);
    const changed = ed.history.undo.length > before;
    $$('.msg-act [data-act="undoMsg"]').forEach((b) => (b.disabled = true));
    typing.innerHTML = esc(r.reply) + (changed ? `<div class="msg-act"><span>${r.ops?.length || 1} thay đổi</span><button class="btn ghost xs" data-act="undoMsg">${icon(I.undo, 13)} Hoàn tác</button></div>` : '');
    toast(esc(r.reply), 6000);
  } catch (e) {
    typing.textContent = 'Lỗi: ' + e.message;
  }
  ed.busy = false;
  ed.changed(true, true);
}
function addMsg(who, html, safe = false) {
  const log = $('#chatlog');
  log.querySelector('.chat-empty')?.remove();
  const m = document.createElement('div');
  m.className = 'msg ' + who;
  m.innerHTML = who === 'me' && !safe ? esc(html) : html;
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
  return m;
}


// ---------- THẺ NGỮ CẢNH TRONG Ô CHAT (chọn clip → AI hiểu đang nói về clip đó, kiểu HyperFrames) ----------
function ctxTarget() {
  const s = ed.sel;
  if (!s || ed.ctxOff || !ed.p) return null;
  const p = ed.p;
  if (s.type === 'text') {
    const it = find(p, s.id)?.item;
    return it ? {target: s.id, label: `Chữ “${it.main}”`, prefix: ''} : null;
  }
  if (s.type === 'broll') {
    const it = find(p, s.id)?.item;
    return it ? {target: s.id, label: `Cảnh phụ ${p.sources[it.src]?.name || ''}`, prefix: ''} : null;
  }
  if (s.type === 'zoom') return {target: s.id, label: 'Hiệu ứng zoom', prefix: ''};
  if (s.type === 'sticker') {
    const it = find(p, s.id)?.item;
    return it ? {target: s.id, label: it.kind === 'gfx' ? `Đồ hoạ ${GFX_MAP[it.key]?.label || ''}` : `Hình ${it.label || ''}`, prefix: ''} : null;
  }
  if (s.type === 'sfx') {
    const it = find(p, s.id)?.item;
    return it ? {target: s.id, label: `Âm thanh ${it.name || it.sfx}`, prefix: ''} : null;
  }
  if (s.type === 'subs') return {target: null, label: 'Phụ đề', prefix: 'phụ đề '};
  if (s.type === 'music') return {target: null, label: 'Nhạc nền', prefix: 'nhạc '};
  if (s.type === 'seg') return {target: null, label: `Đoạn video ${+s.id + 1}`, prefix: ''};
  return null;
}
function renderCtx() {
  const box = $('#chatCtx');
  if (!box) return;
  const c = ctxTarget();
  box.hidden = !c;
  box.innerHTML = c ? `<span class="ctx-chip">${icon(I.sparkle, 12)}<span>${esc(c.label)}</span><button type="button" data-act="ctxOff" aria-label="Bỏ gắn clip">✕</button></span>` : '';
  $('#chatIn').placeholder = c ? `Nhờ AI sửa ${c.label.toLowerCase()}…` : 'Nhắn AI sửa: “đổi chữ giá sang vàng”';
}

// ---------- BẢNG PHẢI: LỜI THOẠI (sửa video bằng chữ) ----------
const scriptSel = {a: -1, b: -1};
function renderScript() {
  const box = $('#script');
  if (!box || $('[data-pane="script"]').hidden) return;
  const p = ed.p;
  const ws = p?.transcript?.words || [];
  if (!p?.main || !ws.length) {
    box.innerHTML = `<p class="sc-empty">${p?.main ? 'Lời thoại có sau khi bấm <b>AI dựng</b> — AI nghe và chép lời người nói.' : 'Thêm video chính trước đã nhé.'}</p><p class="hint">Có lời thoại rồi: bấm một chữ để tua tới đó; bấm chữ đầu rồi <b>Shift + bấm</b> chữ cuối để chọn cả đoạn, rồi bấm <b>Cắt đoạn</b> — video cắt theo.</p>`;
    return;
  }
  const lo = Math.min(scriptSel.a, scriptSel.b);
  const hi = Math.max(scriptSel.a, scriptSel.b);
  const html = ws
    .map((w, i) => {
      const t = tlOfSrc(p, (w.s + w.e) / 2);
      const cls = ['w'];
      if (t === null) cls.push('cut');
      if (lo >= 0 && i >= lo && i <= hi) cls.push('pick');
      if (/\d/.test(w.w)) cls.push('num');
      return `<span class="${cls.join(' ')}" data-w="${i}">${esc(w.w)}</span>`;
    })
    .join(' ');
  const picked = lo >= 0;
  const allCut = picked && ws.slice(lo, hi + 1).every((w) => tlOfSrc(p, (w.s + w.e) / 2) === null);
  box.innerHTML = `<div class="sc-head"><b>Lời thoại · ${ws.length} chữ</b><span class="hint">${p.subs?.on ? 'Phụ đề đang bật' : 'Phụ đề đang tắt'}</span></div>
    <div class="sc-text">${html}</div>
    <div class="sc-bar">${picked ? `<small>Đã chọn ${hi - lo + 1} chữ</small>${allCut ? `<button class="btn ghost xs" data-act="scUncut">Khôi phục đoạn</button>` : `<button class="btn primary xs" data-act="scCut">${icon(I.trash, 13)} Cắt đoạn</button>`}<button class="btn ghost xs" data-act="scClear">Bỏ chọn</button>` : `<small>Bấm chữ để tua · Shift + bấm để chọn đoạn rồi cắt. Chữ gạch ngang là đoạn đã cắt.</small>`}</div>`;
  scriptNow(true);
}
let scriptLast = -1;
function scriptNow(force) {
  const p = ed.p;
  const box = $('#script');
  if (!p?.transcript || !box || $('[data-pane="script"]').hidden) return;
  const at = srcAt(p, ed.player.T);
  if (!at) return;
  const ws = p.transcript.words;
  let k = -1;
  for (let i = 0; i < ws.length; i++) {
    if (ws[i].s <= at.t + 0.02) k = i;
    else break;
  }
  if (k === scriptLast && !force) return;
  box.querySelector('.w.now')?.classList.remove('now');
  scriptLast = k;
  const el = k >= 0 ? box.querySelector(`.w[data-w="${k}"]`) : null;
  if (el) {
    el.classList.add('now');
    if (ed.player.playing) el.scrollIntoView({block: 'nearest'});
  }
}
function scriptClick(e) {
  const w = e.target.closest('.w');
  if (!w) return;
  const i = +w.dataset.w;
  const p = ed.p;
  const word = p.transcript.words[i];
  if (e.shiftKey && scriptSel.a >= 0) scriptSel.b = i;
  else {
    scriptSel.a = scriptSel.b = i;
    const t = tlOfSrc(p, (word.s + word.e) / 2);
    if (t !== null) ed.seek(Math.max(0, tlOfSrc(p, word.s) ?? t - 0.05));
  }
  renderScript();
}
function scriptRange() {
  const ws = ed.p.transcript.words;
  const lo = Math.min(scriptSel.a, scriptSel.b);
  const hi = Math.max(scriptSel.a, scriptSel.b);
  // không lấn sang chữ bên cạnh
  const a = Math.max(ws[lo].s - 0.05, lo > 0 ? ws[lo - 1].e + 0.01 : 0);
  const b = Math.min(ws[hi].e + 0.08, hi < ws.length - 1 ? ws[hi + 1].s - 0.01 : ws[hi].e + 0.3);
  return {a, b};
}

// ---------- BẢNG PHẢI: KHO (mọi file của dự án) ----------
// ---------- KHO: video của khách + kho hình / icon / âm thanh / chữ mẫu / hiệu ứng / font ----------
const LIB_TABS = [
  ['video', 'Video'],
  ['text', 'Chữ mẫu'],
  ['emoji', 'Hình'],
  ['anim', 'Emoji động'],
  ['icon', 'Icon'],
  ['gfx', 'Đồ hoạ'],
  ['sfx', 'Âm thanh'],
  ['fx', 'Hiệu ứng'],
];
function renderMedia() {
  const box = $('#media');
  if (!box || $('[data-pane="media"]').hidden) return;
  const p = ed.p;
  const tab = ed.libTab || 'video';
  const head = `<div class="lib-tabs" role="tablist">${LIB_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-libtab="${k}">${l}</button>`).join('')}</div>${ed.libReplace ? `<p class="lib-note">Chọn hình để thay cho hình đang chọn · <button class="lnk" data-act="libCancel">Huỷ</button></p>` : ''}`;
  if (tab === 'emoji' || tab === 'icon' || tab === 'anim') {
    box.innerHTML = `${head}<input class="inp lib-q" id="libQ" type="search" placeholder="${tab === 'icon' ? 'Tìm: nhà, sổ hồng, hồ bơi, giỏ hàng…' : 'Tìm: nhà, tiền, ngon, tim, cười…'}" value="${esc(ed.libQ || '')}" autocomplete="off">
      <div class="lib-groups" id="libGroups"></div><div class="lib-grid${tab === 'icon' ? ' ic' : ''}" id="libGrid"></div>
      <p class="hint lib-lic">${tab === 'emoji' ? 'Hình Fluent Emoji (Microsoft, giấy phép MIT) — dùng thương mại thoải mái.' : tab === 'anim' ? 'Emoji động: Noto Emoji Animation © Google, giấy phép CC BY 4.0 (googlefonts.github.io/noto-emoji-animation) — dùng thương mại được, app đã ghi công.' : 'Bộ BĐS mẫu 1 (tự vẽ) + icon Lucide (giấy phép ISC) — dùng thương mại thoải mái.'}</p>`;
    fillLib();
    return;
  }
  if (tab === 'text') {
    box.innerHTML = `${head}<p class="hint" style="margin:2px 0 10px">Bấm để chèn tại đầu phát, rồi sửa chữ ở bảng Chỉnh sửa. ${TEXT_STYLES.length} kiểu chữ × ${TEXT_MOTIONS.length} chuyển động × ${Object.keys(FONTS).length} font.</p>
      <div class="tp-grid">${TEXT_PRESETS.map((pr, i) => `<button class="tp-it" data-preset="${i}"><canvas width="240" height="132" data-tp="${i}"></canvas><small>${esc(pr.name)}</small></button>`).join('')}</div>`;
    drawPresetThumbs();
    return;
  }
  if (tab === 'fx') {
    const lk = p.look || {};
    const sl = (k, l) => `<label class="fl">${l} <output>${Math.round((lk[k] || 0) * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${lk[k] || 0}" data-look="${k}"></label>`;
    box.innerHTML = `${head}<h5>Màu video</h5><div class="fx-grid">${FILTERS.map(([k, l]) => `<button class="fx-it${(lk.filter || 'none') === k ? ' on' : ''}" data-lookf="${k}"><canvas width="96" height="${Math.round((96 * H) / W)}" data-fxp="${k}"></canvas><small>${l}</small></button>`).join('')}</div>
      ${sl('amt', 'Độ mạnh màu')}
      <h5>Lớp phủ</h5>${sl('vignette', 'Tối 4 góc')}${sl('grain', 'Hạt phim')}${sl('leak', 'Loé sáng trôi')}
      <label class="fl tog"><input type="checkbox" data-look="bars" ${lk.bars ? 'checked' : ''}> Viền điện ảnh (2 dải đen)</label>
      <h5>Chuyển cảnh ở chỗ cắt video chính</h5><div class="chips">${JUMP_TRANS.map(([k, l]) => `<button class="chip-b" data-alljump="${k}">${l}</button>`).join('')}<button class="chip-b" data-alljump="mix">Đa dạng</button></div>
      <p class="hint" style="margin:-4px 0 12px">Áp mỗi ~5 giây một lần, chỗ cắt không bị cảnh phụ che.</p>
      <h5>Chuyển cảnh cho mọi cảnh phụ</h5><div class="chips">${TRANSITIONS.map(([k, l]) => `<button class="chip-b" data-alltrans="${k}">${l}</button>`).join('')}<button class="chip-b" data-alltrans="mix">Đa dạng</button></div>
      <p class="hint">${lk.by === 'ai' ? 'Màu hiện tại do AI chọn theo thể loại — bạn chỉnh thì AI không đổi nữa.' : 'Màu áp cho cả video chính và cảnh phụ, chữ giữ nguyên màu.'}</p>`;
    drawFxThumbs();
    return;
  }
  if (tab === 'gfx') {
    box.innerHTML = `${head}<p class="hint" style="margin:2px 0 10px">Đồ hoạ động vẽ ngay trong app — bấm để chèn tại đầu phát, rồi sửa chữ / màu / vị trí ở bảng Chỉnh sửa. Màu và font theo phong cách đang chọn.</p>
      <div class="gfx-grid">${GFX.map(([k, l]) => `<button class="gfx-it" data-addgfx="${k}"><canvas width="120" height="${Math.round((120 * H) / W)}" data-gfxp="${k}"></canvas><small>${esc(l)}</small></button>`).join('')}</div>`;
    drawGfxThumbs();
    return;
  }
  if (tab === 'sfx') {
    box.innerHTML = `${head}<p class="hint" style="margin:2px 0 10px">Bấm ▶ để nghe, bấm + để chèn tại đầu phát. Âm thanh tự tạo trong app — không lo bản quyền.</p>
      <div class="sfx-list">${SFX.map((x) => `<div class="sfx-i"><button class="icon-btn" data-playsfx2="${x.key}" aria-label="Nghe ${esc(x.name)}">${icon(I.play, 15)}</button><b>${esc(x.name)}</b><small>${x.len.toFixed(1).replace('.', ',')} s</small><button class="tag" data-addsfx="${x.key}">+ Chèn</button></div>`).join('')}</div>`;
    return;
  }
  const all = Object.values(p.sources);
  const used = new Set(p.broll.map((b) => b.src));
  const item = (s) => {
    const th = s.thumbs?.[0] ? `style="background-image:url(${s.thumbs[0]})"` : '';
    const isMain = p.main?.src === s.id;
    const tag = s.kind === 'broll' ? (used.has(s.id) ? '<span class="tag dim">Đã dùng</span>' : `<button class="tag" data-insert="${s.id}" title="Chèn tại đầu phát">+ Chèn</button>`) : isMain ? '<span class="tag">Đang dùng</span>' : s.kind === 'music' && p.music?.src === s.id ? '<span class="tag">Đang dùng</span>' : '';
    const lab = s.kind === 'broll' ? `<button class="mtag${s.tag ? '' : ' none'}" data-tagsrc="${s.id}" title="Cho AI biết cảnh này là gì để đặt đúng lúc nói">${s.tag ? `${esc(s.tag)}${s.tagBy === 'ai' ? ' · AI đoán' : ''}` : 'Đặt nhãn cảnh'}</button>` : '';
    return `<div class="mi"><i ${th}>${s.kind === 'music' ? icon(I.music, 20) : ''}</i><div><b>${esc(s.name)}</b><small>${fmt(s.duration)}${s.w ? ` · ${s.w}×${s.h}` : ''}</small>${lab}</div>${tag}</div>`;
  };
  const group = (title, list, act, label) => `<h5>${title}</h5><div class="mlist">${list.map(item).join('') || '<p class="hint">Chưa có.</p>'}</div>${act ? `<button class="btn ghost wide" data-act="${act}" style="margin:-8px 0 16px">${icon(I.plus, 16)} ${label}</button>` : ''}`;
  box.innerHTML =
    head +
    group('Video chính', all.filter((s) => s.kind === 'main' && p.main?.src === s.id), p.main ? 'replaceMain' : 'addMain', p.main ? 'Thay video chính' : 'Thêm video chính') +
    group('Cảnh phụ', all.filter((s) => s.kind === 'broll'), 'addBroll', 'Thêm cảnh phụ') +
    group('Nhạc nền', all.filter((s) => s.kind === 'music'), 'addMusic', p.music ? 'Đổi bài nhạc' : 'Thêm nhạc nền');
}
// lưới hình / icon: tìm theo nhãn tiếng Việt, lọc theo nhóm
async function fillLib() {
  const kind = ed.libTab;
  const grid = $('#libGrid');
  if (!grid) return;
  const {groups} = await loadIndex(kind);
  const g = ed.libGroup?.[kind] ?? -1;
  const gb = $('#libGroups');
  if (gb) gb.innerHTML = [[-1, 'Tất cả'], ...groups.map((x, i) => [i, x]).filter(([, x]) => x)].map(([i, x]) => `<button class="chip-b${g === i ? ' on' : ''}" data-libgroup="${i}">${esc(x)}</button>`).join('');
  const list = await searchLib(kind, ed.libQ || '', g, 300);
  if (ed.libTab !== kind || !$('#libGrid')) return;
  const src = (k) => (kind === 'anim' ? `lib/a/${k}.webp` : `lib/${kind === 'icon' ? 'i' : 'e'}/${k}.svg`);
  grid.innerHTML = list.length
    ? list.map((x) => `<button class="lib-it${String(x.key).startsWith('bds-') ? ' bds' : ''}" data-libadd="${x.key}" data-label="${esc(x.label)}" title="${esc(x.label)}"><img src="${src(x.key)}" alt="${esc(x.label)}" loading="lazy" width="48" height="48"></button>`).join('')
    : '<p class="hint">Không tìm thấy — thử từ khác (vd: “nhà”, “tiền”, “tim”).</p>';
}
// ảnh xem trước màu video: chụp khung đang xem rồi áp từng màu
function drawFxThumbs() {
  if (!ed.player?.p) return;
  // vẽ khung đang xem KHÔNG kèm màu/chữ hiện tại (để so các màu cho công bằng)
  const fr = ed.player.frames();
  const bare = {...ed.p, look: null, texts: [], stickers: [], subs: {on: false}, cta: {on: false}};
  for (const c of $$('canvas[data-fxp]')) {
    const g = c.getContext('2d');
    g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
    drawFrame(g, bare, ed.player.T, fr, {placeholder: true});
    applyLook(g, {filter: c.dataset.fxp, amt: Math.max(0.5, ed.p.look?.amt ?? 0.6)}, ed.player.T);
  }
}
function setLook(set) {
  const p = ed.p;
  manual(() => (p.look = {...(p.look || {}), ...set, by: 'user'}), {lock: false});
}
// ảnh xem trước mẫu chữ: vẽ bằng chính bộ dựng khung hình (giống hệt trên video)
function drawPresetThumbs() {
  for (const c of $$('canvas[data-tp]')) {
    const pr = TEXT_PRESETS[+c.dataset.tp];
    const go = () => {
      const g = c.getContext('2d');
      const s = 0.2;
      g.setTransform(s, 0, 0, s, 120 - (s * W) / 2, 66 - s * H * 0.5);
      const fake = {main: {src: 'x', segs: [{in: 0, out: 10}]}, sources: {x: {duration: 10}}, texts: [{...newText(0, pr), id: 'tp', x: 0.5, y: 0.5, size: Math.min(1, pr.size || 1) * 1.15, dur: 9}], broll: [], zooms: [], stickers: [], sfx: [], subs: {on: false}, cta: {on: false}};
      drawFrame(g, fake, pr.motion === 'type' ? 2.5 : 1.8, {main: null});
    };
    go();
    ensureFont(pr.font).then(go);
  }
}
function insertPreset(i) {
  const p = ed.p;
  const pr = TEXT_PRESETS[i];
  if (!p.main || !pr) return toast('Thêm video chính trước');
  const D = duration(p);
  const it = newText(Math.max(0, Math.min(ed.player.T, D - 3)), {...pr, locked: true});
  delete it.name;
  it.dur = Math.min(3.5, D);
  manual(() => p.texts.push(it), {lock: false});
  select({type: 'text', id: it.id});
  if (matchMedia('(min-width: 900px)').matches) $('#side [data-tab="edit"]')?.click();
  setTimeout(() => $('#insp [data-k="main"]')?.select(), 60);
}
function insertSticker(kind, key, label) {
  const p = ed.p;
  if (!p.main) return toast('Thêm video chính trước');
  if (ed.libReplace) {
    const f = find(p, ed.libReplace);
    ed.libReplace = null;
    if (f) {
      manual(() => Object.assign(f.item, {kind, key, label}));
      select({type: 'sticker', id: f.item.id});
      return;
    }
  }
  const D = duration(p);
  const it = {id: uid('s'), kind, key, label, start: Math.max(0, Math.min(ed.player.T, D - 2.5)), dur: Math.min(2.5, D), x: 0.78, y: 0.3, size: 1, motion: kind === 'icon' ? 'pop' : 'bounce', locked: true};
  if (kind === 'icon') it.color = String(key).startsWith('bds-') ? '#ff6a3d' : '#2f8cff';
  manual(() => p.stickers.push(it), {lock: false});
  select({type: 'sticker', id: it.id});
}
// ảnh xem trước phong cách / đồ hoạ: vẽ bằng chính bộ dựng khung hình trên nền xám (giống hệt trên video)
function fakeProject(extra) {
  return {main: {src: 'x', segs: [{in: 0, out: 10}]}, sources: {x: {duration: 10}}, broll: [], zooms: [], stickers: [], sfx: [], texts: [], subs: {on: false}, cta: {on: false}, ...extra};
}
let thumbBg = null;
function thumbDraw(c, fake, T) {
  // nền thử: ảnh khung đang xem nếu có, không thì nền xám chuyển sắc (thay cho hình video)
  if (!thumbBg || thumbBg.width !== W) {
    thumbBg = document.createElement('canvas');
    thumbBg.width = W;
    thumbBg.height = H;
    const bg = thumbBg.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#5b6a80');
    gr.addColorStop(1, '#232a35');
    bg.fillStyle = gr;
    bg.fillRect(0, 0, W, H);
  }
  const g = c.getContext('2d');
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  const fr = ed.player?.frames?.();
  drawFrame(g, fake, T, {main: fr?.main?.img ? fr.main : {img: thumbBg, w: W, h: H}});
}
function drawPackThumbs() {
  const words = ['Pháp', 'lý', 'sổ', 'hồng', 'riêng'].map((w, i) => ({w, s: 0.4 + i * 0.35, e: 0.7 + i * 0.35}));
  for (const c of $$('canvas[data-pkp]')) {
    const pack = PACKS[c.dataset.pkp];
    const t = newText(0, {kind: 'key', main: 'SỔ HỒNG RIÊNG', lead: 'pháp lý', dur: 9, y: 0.3, ...packText(pack, {kind: 'key'}, 0), motion: 'pop'});
    const fake = fakeProject({texts: [t], transcript: {words}, subs: {on: true, y: 0.72, size: 1.15, ...pack.subs}, look: pack.look});
    const go = () => thumbDraw(c, fake, 1.25);
    go();
    Promise.all([ensureFont(pack.font), ensureFont(pack.subs.font)]).then(go);
  }
}
function drawGfxThumbs() {
  const pack = PACKS[ed.p.pack] || PACKS.mau1;
  for (const c of $$('canvas[data-gfxp]')) {
    const k = c.dataset.gfxp;
    const def = GFX_MAP[k].def;
    const it = {id: 'g', kind: 'gfx', key: k, start: 0, ...def, ...gfxStyle(pack, k), dur: k === 'progress' ? 10 : def.dur};
    if (k !== 'hook') delete it.variant;
    if (k === 'hook') it.y = 0.4;
    const T = {hook: 1.2, lower: 1.4, progress: 6, arrow: 1, circle: 1.2, sparkle: 0.45, confetti: 1.3, leak: 0.45, follow: 0.7}[k] ?? 1;
    const go = () => thumbDraw(c, fakeProject({stickers: [it]}), T);
    go();
    if (it.font) ensureFont(it.font).then(go);
  }
}
function insertGfx(key) {
  const p = ed.p;
  if (!p.main) return toast('Thêm video chính trước');
  const pack = PACKS[p.pack] || PACKS.mau1;
  const D = duration(p);
  const def = GFX_MAP[key].def;
  const start = key === 'progress' ? 0 : Math.max(0, Math.min(ed.player.T, D - 1));
  const it = {id: uid('g'), kind: 'gfx', key, ...def, ...gfxStyle(pack, key), start, dur: key === 'progress' ? D : Math.min(def.dur, D - start), locked: true};
  if (key !== 'hook') delete it.variant;
  manual(() => p.stickers.push(it), {lock: false});
  ensureProjectFonts(p).then(() => (ed.player.dirty = true));
  select({type: 'sticker', id: it.id});
  if (matchMedia('(min-width: 900px)').matches) $('#side [data-tab="edit"]')?.click();
}
function insertSfx(key) {
  const p = ed.p;
  const d = SFX_MAP[key];
  if (!p.main || !d) return toast('Thêm video chính trước');
  const it = {id: uid('a'), sfx: key, name: d.name, start: Math.max(0, Math.min(ed.player.T, duration(p) - 0.2)), dur: d.len, vol: 0.6, locked: true};
  manual(() => p.sfx.push(it), {lock: false});
  select({type: 'sfx', id: it.id});
  playSfx(key, 0.6);
}
// Nhãn cảnh phụ: khách gắn tay (ưu tiên hơn AI đoán, AI không ghi đè)
async function tagSource(srcId) {
  const p = ed.p;
  const s = p.sources[srcId];
  if (!s) return;
  const sug = genreOf(p).tags || [];
  const ok = await dialog({
    title: 'Cảnh này là gì?',
    body: `<p class="hint" style="margin:0 0 10px">AI dựa vào nhãn để đặt cảnh “${esc(s.name)}” đúng lúc bạn nói tới.${s.tagBy === 'ai' ? ` AI đang đoán: <b>${esc(s.tag)}</b>.` : ''}</p>
      <input id="tagIn" class="inp" maxlength="30" value="${esc(s.tag || '')}" placeholder="Ví dụ: phòng khách, món phở, đóng gói…">
      <div class="chips" style="margin-top:10px">${sug.map((t) => `<button type="button" class="chip-b" data-tagchip="${esc(t)}">${esc(t)}</button>`).join('')}</div>`,
    ok: 'Lưu nhãn',
  });
  if (!ok) return;
  const v = ($('#tagIn')?.value || '').trim().slice(0, 30);
  if (!v) {
    delete s.tag;
    delete s.keywords;
    delete s.tagBy;
  } else {
    if (s.tagBy === 'ai' && v.toLowerCase() !== String(s.tag || '').toLowerCase()) s.keywords = [];
    s.tag = v.toLowerCase();
    s.tagBy = 'user';
  }
  ed.changed(true);
  renderMedia();
  toast(v ? `Đã đặt nhãn “${esc(v)}” — bấm Dựng lại để AI xếp lại cảnh.` : 'Đã bỏ nhãn.');
}
function insertBroll(srcId) {
  const p = ed.p;
  const src = p.sources[srcId];
  if (!src || !p.main) return;
  const dur = Math.min(3, src.duration);
  const b = {id: uid('b'), src: src.id, start: Math.min(ed.player.T, Math.max(0, duration(p) - dur)), dur, in: Math.max(0, src.duration / 2 - dur / 2), trans: 'fade', locked: true};
  manual(() => p.broll.push(b), {lock: false});
  select({type: 'broll', id: b.id});
}

// ---------- GHI CHÚ LÊN HÌNH (kiểu HyperFrames): bấm vào khung xem → ghim + hỏi AI sửa chỗ đó ----------
function setTool(t) {
  ed.tool = t;
  $$('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  $$('[data-tool2]').forEach((b) => b.classList.toggle('on', b.dataset.tool2 === t));
  $('#cv').classList.toggle('noting', t === 'note');
  if (t !== 'note') closeNote();
}
function closeNote() {
  $('#note').hidden = true;
  $('.note-pin')?.remove();
}
function openNote(e) {
  const cv = $('#cv');
  const wrap = cv.parentElement;
  const r = cv.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const pt = ed.player.toComp(e.clientX, e.clientY);
  const hitId = ed.player.hit(pt.x, pt.y);
  const T = ed.player.T;
  const bro = !hitId && ed.p.broll.find((b) => T >= b.start && T < b.start + b.dur);
  const target = hitId || bro?.id || null;
  const what = hitId ? `chữ “${find(ed.p, hitId)?.item?.main || ''}”` : bro ? `cảnh phụ ${ed.p.sources[bro.src]?.name || ''}` : 'khung hình này';
  const where = pt.y < H * 0.33 ? 'phía trên' : pt.y > H * 0.66 ? 'phía dưới' : 'giữa';
  closeNote();
  const pin = document.createElement('div');
  pin.className = 'note-pin';
  pin.textContent = '+';
  pin.style.left = e.clientX - wr.left + 'px';
  pin.style.top = e.clientY - wr.top + 'px';
  wrap.appendChild(pin);
  const n = $('#note');
  const hints = hitId ? ['Đổi sang màu vàng', 'Chữ to hơn', 'Dời lên trên', 'Xoá cụm chữ này'] : bro ? ['Dài thêm 1 giây', 'Chuyển cảnh trượt', 'Xoá cảnh này'] : ['Thêm chữ ở đây', 'Phụ đề to hơn'];
  n.innerHTML = `<div class="note-h"><b>${fmt(T)}</b><span>${esc(what)} · ${where}</span></div>
    <textarea placeholder="Muốn sửa gì ở đây?" aria-label="Muốn sửa gì ở đây?"></textarea>
    <div class="chips">${hints.map((x) => `<button type="button" class="chip-b" data-nq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="note-act"><small>Enter để gửi</small><button type="button" class="btn ghost xs" data-nx="0">Huỷ</button><button type="button" class="btn primary xs" data-nx="1">Gửi cho AI</button></div>`;
  n.hidden = false;
  const x = Math.min(wr.width - n.offsetWidth - 8, Math.max(8, e.clientX - wr.left - n.offsetWidth / 2));
  const below = e.clientY - wr.top < wr.height / 2;
  n.style.left = x + 'px';
  n.style.top = (below ? e.clientY - wr.top + 18 : Math.max(8, e.clientY - wr.top - n.offsetHeight - 18)) + 'px';
  const ta = n.querySelector('textarea');
  ta.focus();
  const send = () => {
    const q = ta.value.trim();
    if (!q) return;
    closeNote();
    // “thêm chữ ở đây” → đặt cụm chữ đúng chỗ vừa bấm, mở bảng sửa để gõ nội dung
    if (!hitId && /th[eê]m ch[uữ]/i.test(q)) {
      const t = newText(T, {main: 'CHỮ MỚI', lead: '', x: Math.max(0.15, Math.min(0.85, pt.x / W)), y: Math.max(0.08, Math.min(0.9, pt.y / H)), locked: true});
      manual(() => ed.p.texts.push(t));
      select({type: 'text', id: t.id});
      openSheet(true);
      setTimeout(() => $('#insp [data-k="main"]')?.select(), 50);
      return;
    }
    sendAi(q, target, '', `${what} · ${where} · ${fmt(T)}`);
  };
  n.onclick = (ev) => {
    const c = ev.target.closest('[data-nq]');
    if (c) {
      ta.value = c.dataset.nq;
      ta.focus();
    }
    const x2 = ev.target.closest('[data-nx]');
    if (x2) x2.dataset.nx === '1' ? send() : closeNote();
  };
  ta.onkeydown = (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      send();
    }
    if (ev.key === 'Escape') closeNote();
  };
}

// ---------- XUẤT VIDEO (sau khi duyệt) ----------
async function openExport() {
  const p = ed.p;
  if (!p.main) return;
  ed.player.pause();
  if (!p.approved) {
    const ok = await dialog({
      title: 'Duyệt bản nháp',
      body: `<p>Bạn đã xem hết bản xem nhanh và ưng ý chưa?</p><p class="hint">Đồng ý thì app mới dựng file video chất lượng cao. Muốn sửa thêm cứ bấm <b>Xem lại</b>.</p>`,
      ok: 'Đồng ý, xuất video',
      cancel: 'Xem lại',
    });
    if (!ok) {
      ed.seek(0);
      ed.player.play();
      return;
    }
    p.approved = true;
    queueSave();
    updateStage();
  }
  if (!canExport()) {
    dialog({title: 'Máy chưa xuất được video', body: 'Trình duyệt này thiếu bộ dựng video. Hãy cập nhật iPhone lên iOS 16.4 trở lên, hoặc mở bằng Chrome/Safari bản mới trên máy tính.', ok: 'Đã hiểu', cancel: ''});
    return;
  }
  const d = $('#exp');
  d.hidden = false;
  const D = duration(p);
  d.innerHTML = `<div class="dlg-card"><h3>Xuất video</h3>
    <div class="fl"><span>Chất lượng</span><div class="seg" id="xres"><button data-r="720">720p · nhẹ</button><button class="on" data-r="1080">1080p · nét</button></div></div>
    <p class="hint">Video dài ${fmt(D)}. Dựng ngay trên máy bạn — giữ màn hình sáng, không chuyển app trong lúc dựng.</p>
    <div class="dlg-act"><button class="btn ghost" data-x="close">Để sau</button><button class="btn primary" data-x="go">Bắt đầu xuất</button></div></div>`;
  let res = 1080;
  d.querySelector('#xres').onclick = (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    res = +b.dataset.r;
    $$('#xres button').forEach((x) => x.classList.toggle('on', x === b));
  };
  d.onclick = async (e) => {
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'close') d.hidden = true;
    if (x === 'go') doExport(res);
  };
}

async function doExport(res) {
  const d = $('#exp');
  const p = ed.p;
  const ac = new AbortController();
  d.innerHTML = `<div class="dlg-card"><h3>Đang xuất video</h3><div class="xbig" id="xpct">0%</div><div class="bar"><i id="xbar"></i></div><p class="hint" id="xmsg">Chuẩn bị…</p><div class="dlg-act"><button class="btn ghost" id="xcancel">Huỷ</button></div></div>`;
  $('#xcancel').onclick = () => ac.abort();
  let wake = null;
  try {
    wake = await navigator.wakeLock?.request('screen');
  } catch (e) {
    wake = null;
  }
  const t0 = performance.now();
  const prog = (k, msg) => {
    $('#xpct').textContent = Math.round(k * 100) + '%';
    $('#xbar').style.width = k * 100 + '%';
    const el = (performance.now() - t0) / 1000;
    $('#xmsg').textContent = msg + (k > 0.05 && k < 1 ? ` · còn khoảng ${Math.max(1, Math.round((el / k) * (1 - k)))} giây` : '');
  };
  let blob = null;
  try {
    const X = await import('./export.js');
    try {
      blob = await X.exportVideo(p, ed.getBlob, {res, onProgress: prog, signal: ac.signal});
    } catch (e) {
      if (e instanceof X.Cancelled) throw e;
      if (e.message === 'NO_ENCODER') {
        prog(0, 'Máy không có bộ mã hoá — chuyển sang quay thời gian thực');
        blob = await X.recordRealtime(ed.player, {onProgress: prog, signal: ac.signal});
      } else throw e;
    }
  } catch (e) {
    try {
      await wake?.release();
    } catch (x) {
      /* bỏ qua */
    }
    if (e.name === 'Cancelled' || ac.signal.aborted) {
      d.hidden = true;
      toast('Đã huỷ xuất video.');
      return;
    }
    console.error(e);
    d.innerHTML = `<div class="dlg-card"><h3>Xuất video bị lỗi</h3><p class="err">${esc(e.message)}</p><div class="dlg-act"><button class="btn primary" data-x="close">Đóng</button></div></div>`;
    d.onclick = (ev) => ev.target.closest('[data-x]') && (d.hidden = true);
    return;
  }
  try {
    await wake?.release();
  } catch (x) {
    /* bỏ qua */
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(0);
  const url = URL.createObjectURL(blob);
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
  const name = (p.name || 'video').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') + '.' + ext;
  const file = new File([blob], name, {type: blob.type});
  const canShare = navigator.canShare?.({files: [file]});
  d.innerHTML = `<div class="dlg-card"><h3>${icon(I.check, 20)} Video đã xong</h3>
    <video src="${url}" controls playsinline class="xvid"></video>
    <p class="hint">${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB · dựng trong ${secs} giây</p>
    <div class="dlg-act">${canShare ? '<button class="btn ghost" data-x="share">Chia sẻ / Lưu vào Ảnh</button>' : ''}<a class="btn primary" href="${url}" download="${esc(name)}">Tải về máy</a></div>
    <button class="btn ghost wide" data-x="close">Đóng</button></div>`;
  d.onclick = async (e) => {
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'close') d.hidden = true;
    if (x === 'share') {
      try {
        await navigator.share({files: [file], title: p.name});
      } catch (err) {
        /* khách huỷ */
      }
    }
  };
}

// ---------- kéo chữ trên khung xem ----------
function bindStageDrag() {
  const cv = $('#cv');
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (!ed.p?.main || ed.busy) return;
    if (ed.tool === 'note') {
      ed.player.pause();
      openNote(e);
      return;
    }
    const pt = ed.player.toComp(e.clientX, e.clientY);
    const box = ed.player.hitBox(pt.x, pt.y);
    const id = box?.id;
    if (!id) {
      if (ed.sel?.type === 'text' || ed.sel?.type === 'sticker') select(null);
      return;
    }
    const it = find(ed.p, id)?.item;
    if (!it) return;
    if (ed.sel?.id !== id) select({type: box.type || 'text', id});
    ed.player.pause();
    cv.setPointerCapture(e.pointerId);
    drag = {id, x0: pt.x, y0: pt.y, ix: it.x ?? (box.type === 'sticker' ? 0.78 : 0.5), iy: it.y ?? (box.type === 'sticker' ? 0.3 : 0.2), moved: false};
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = ed.player.toComp(e.clientX, e.clientY);
    const it = find(ed.p, drag.id)?.item;
    if (!it) return;
    if (!drag.moved) {
      if (Math.hypot(pt.x - drag.x0, pt.y - drag.y0) < 12) return;
      drag.moved = true;
      ed.history.push(ed.p);
    }
    it.x = Math.max(0.1, Math.min(0.9, drag.ix + (pt.x - drag.x0) / W));
    it.y = Math.max(0.06, Math.min(0.94, drag.iy + (pt.y - drag.y0) / H));
    ed.player.dirty = true;
  });
  const end = () => {
    if (drag?.moved) {
      const it = find(ed.p, drag.id)?.item;
      if (it) it.locked = true;
      ed.changed(true, true);
    }
    drag = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

// ---------- kéo / cắt trên timeline ----------
let dragOrig = null;
const tlCb = {
  onZoom(k) {
    const z = $('#tlZoom');
    if (z) z.textContent = Math.round(k * 100) + '%';
  },
  onScrub(T, fromPointer) {
    if (ed.player.playing) ed.player.pause();
    ed.player.seek(T);
    if (fromPointer) ed.tl.setTime(ed.player.T);
    updateTime();
  },
  onSelect(sel) {
    select(sel);
  },
  onAdd(kind) {
    if (kind === 'main' || kind === 'broll' || kind === 'music') pick(kind);
  },
  onDragStart(sel) {
    ed.history.push(ed.p);
    ed.player.pause();
    const it = selItem();
    dragOrig = it ? {...it} : null;
  },
  onDrag(sel, mode, dt) {
    const it = selItem();
    if (!it || !dragOrig) return;
    const p = ed.p;
    const D = duration(p);
    if (sel.type === 'seg') {
      const src = p.sources[p.main.src];
      if (mode === 'l') it.in = Math.max(0, Math.min(dragOrig.out - 0.2, dragOrig.in + dt));
      if (mode === 'r') it.out = Math.min(src.duration, Math.max(dragOrig.in + 0.2, dragOrig.out + dt));
      const starts = p.main.segs.slice(0, +sel.id).reduce((a, s) => a + s.out - s.in, 0);
      ed.tl.updateClip('seg', sel.id, starts, it.out - it.in);
      p._rev++;
      ed.player.seek(starts + (mode === 'l' ? 0 : it.out - it.in - 0.05));
      return;
    }
    if (mode === 'move') it.start = Math.max(0, Math.min(D - it.dur, dragOrig.start + dt));
    if (mode === 'l') {
      const ns = Math.max(0, Math.min(dragOrig.start + dragOrig.dur - 0.3, dragOrig.start + dt));
      it.start = ns;
      it.dur = dragOrig.dur - (ns - dragOrig.start);
      if (sel.type === 'broll') it.in = Math.max(0, dragOrig.in + (ns - dragOrig.start));
    }
    if (mode === 'r') {
      let maxD = D - it.start;
      if (sel.type === 'broll') maxD = Math.min(maxD, p.sources[it.src].duration - it.in);
      it.dur = Math.max(0.3, Math.min(maxD, dragOrig.dur + dt));
    }
    p._rev++;
    ed.tl.updateClip(sel.type, sel.id, it.start, it.dur);
    ed.player.seek(mode === 'r' ? it.start + it.dur - 0.05 : it.start + 0.05);
    updateTime();
  },
  onDragEnd(sel) {
    const it = selItem();
    if (it && 'locked' in it) it.locked = true;
    dragOrig = null;
    ed.changed(true, true);
  },
};

// ---------- thẻ hướng dẫn cài app ----------
function showInstall() {
  const c = installCard();
  const box = $('#install');
  if (!c) {
    box.hidden = true;
    return;
  }
  let dismissed = false;
  try {
    dismissed = localStorage.getItem('dv.install.later') === '1';
  } catch (e) {
    dismissed = false;
  }
  if (dismissed && !c.block) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `<div class="inst-card"><b>${c.title}</b><p>${c.body}</p><div class="inst-act">${c.action ? `<button class="btn primary sm" data-inst="go">${c.action.label}</button>` : ''}${c.block ? '' : '<button class="btn ghost sm" data-inst="later">Để sau</button>'}</div></div>`;
  box.onclick = async (e) => {
    const k = e.target.closest('[data-inst]')?.dataset.inst;
    if (k === 'go') {
      await c.action.run();
      showInstall();
    }
    if (k === 'later') {
      try {
        localStorage.setItem('dv.install.later', '1');
      } catch (err) {
        /* bỏ qua */
      }
      box.hidden = true;
    }
  };
}

// ---------- KHỞI ĐỘNG ----------
async function boot() {
  store.persist();
  await loadFonts();
  ed.player = new Player($('#cv'), $('#vids'));
  ed.player.setScale(matchMedia('(min-width: 900px)').matches ? 1280 : 960);
  ed.player.onTime = (T) => {
    if (ed.player.playing || ed.tl.left) ed.tl.setTime(T);
    updateTime();
  };
  ed.player.onState = (on) => {
    $('#btnPlay').innerHTML = icon(on ? I.pause : I.play, 22);
    $('#btnPlay').setAttribute('aria-label', on ? 'Tạm dừng' : 'Phát');
  };
  ed.player.onEnd = () => renderStatus();
  ed.player.onMainError = () => {
    ed.mainBad = true;
    renderStatus();
  };
  ed.tl = new Timeline($('#tl'), tlCb);
  ed.cur = new Cursor();
  // điện thoại: chú thích từng bước nằm gọn trong thanh trạng thái, ngón tay tự do thao tác trên timeline
  ed.cur.dockEl = () => (matchMedia('(max-width: 899px)').matches ? $('#status') : null);
  window.__dv = ed; // để kiểm thử (xem CLAUDE.md)
  window.__render = {drawFrame, TEXT_STYLES, TEXT_MOTIONS, setFormat};
  window.__ai = {localKeys, keyLockups, timelinePhrases, numberLockups};
  bindInspector();
  bindStageDrag();
  bindDrop();
  placeChat();
  matchMedia('(min-width: 900px)').addEventListener?.('change', placeChat);
  matchMedia('(min-width: 1200px)').addEventListener?.('change', placeChat);
  $('#script').addEventListener('click', scriptClick);
  setTool('select');

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a) act(a.dataset.act, a);
    const o = e.target.closest('[data-open]');
    if (o) store.getProject(o.dataset.open).then(openEditor);
    const del = e.target.closest('[data-del]');
    if (del) {
      dialog({title: 'Xoá dự án?', body: 'Video và mọi chỉnh sửa của dự án này sẽ bị xoá khỏi máy.', ok: 'Xoá', danger: true}).then(async (ok) => {
        if (!ok) return;
        const p = await store.getProject(del.dataset.del);
        if (p) await store.deleteProject(p);
        renderHome();
      });
    }
    const bi = e.target.closest('.bin-item');
    if (bi && ed.p?.aiDone) {
      const src = ed.p.sources[bi.dataset.src];
      const dur = Math.min(3, src.duration);
      const b = {id: uid('b'), src: src.id, start: Math.min(ed.player.T, Math.max(0, duration(ed.p) - dur)), dur, in: Math.max(0, src.duration / 2 - dur / 2), trans: 'fade', locked: true};
      manual(() => ed.p.broll.push(b), {lock: false});
      select({type: 'broll', id: b.id});
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      $$('[data-tab]').forEach((t) => t.classList.toggle('on', t === tab));
      $$('.side-pane').forEach((x) => (x.hidden = x.dataset.pane !== tab.dataset.tab));
      if (tab.dataset.tab === 'script') renderScript();
      if (tab.dataset.tab === 'media') renderMedia();
    }
    const ins = e.target.closest('[data-insert]');
    if (ins) insertBroll(ins.dataset.insert);
    const tg = e.target.closest('[data-tagsrc]');
    if (tg) tagSource(tg.dataset.tagsrc);
    const lt = e.target.closest('[data-libtab]');
    if (lt) {
      ed.libTab = lt.dataset.libtab;
      renderMedia();
    }
    const lg = e.target.closest('[data-libgroup]');
    if (lg) {
      ed.libGroup = {...(ed.libGroup || {}), [ed.libTab]: +lg.dataset.libgroup};
      fillLib();
    }
    const la = e.target.closest('[data-libadd]');
    if (la) insertSticker(ed.libTab === 'icon' ? 'icon' : ed.libTab === 'anim' ? 'anim' : 'emoji', la.dataset.libadd, la.dataset.label);
    const ag = e.target.closest('[data-addgfx]');
    if (ag) insertGfx(ag.dataset.addgfx);
    const ps2 = e.target.closest('[data-playsfx2]');
    if (ps2) playSfx(ps2.dataset.playsfx2, 0.7);
    const as = e.target.closest('[data-addsfx]');
    if (as) insertSfx(as.dataset.addsfx);
    const tp = e.target.closest('[data-preset]');
    if (tp) insertPreset(+tp.dataset.preset);
    const lf = e.target.closest('[data-lookf]');
    if (lf) setLook({filter: lf.dataset.lookf});
    const aj = e.target.closest('[data-alljump]');
    if (aj && ed.p.main) {
      const p = ed.p;
      const st = segStartsOf(p);
      const all = JUMP_TRANS.filter(([k]) => k !== 'none').map(([k]) => k);
      let last = -9;
      let n = 0;
      manual(() => {
        p.main.segs.forEach((s, i) => {
          delete s.tr;
          if (i === 0 || aj.dataset.alljump === 'none' || st[i] - last < 5 || p.broll.some((b) => st[i] > b.start - 0.1 && st[i] < b.start + b.dur + 0.1)) return;
          s.tr = aj.dataset.alljump === 'mix' ? all[n % all.length] : aj.dataset.alljump;
          last = st[i];
          n++;
        });
      }, {lock: false});
      toast(aj.dataset.alljump === 'none' ? 'Đã bỏ chuyển cảnh ở chỗ cắt' : `Đã thêm ${n} chuyển cảnh ở chỗ cắt`);
    }
    const at = e.target.closest('[data-alltrans]');
    if (at && ed.p.broll.length) {
      const all = TRANSITIONS.filter(([k]) => k !== 'none' && k !== 'fade').map(([k]) => k);
      manual(() => ed.p.broll.forEach((b, i) => (b.trans = at.dataset.alltrans === 'mix' ? all[i % all.length] : at.dataset.alltrans)), {lock: false});
      toast(`Đã đổi chuyển cảnh cho ${ed.p.broll.length} cảnh phụ`);
    }
    const chip = e.target.closest('[data-tagchip]');
    if (chip && $('#tagIn')) $('#tagIn').value = chip.dataset.tagchip;
    const tool = e.target.closest('[data-tool]');
    if (tool) setTool(tool.dataset.tool);
  });
  // tìm trong kho hình / icon (gõ tới đâu lọc tới đó)
  let libT = null;
  let lookPushed = false;
  document.addEventListener('change', (e) => {
    if (e.target.dataset?.look) lookPushed = false;
  });
  document.addEventListener('input', (e) => {
    const lk = e.target.dataset?.look;
    if (lk) {
      const p = ed.p;
      if (!lookPushed) ed.history.push(p), (lookPushed = true);
      p.look = {...(p.look || {}), [lk]: e.target.type === 'checkbox' ? e.target.checked : +e.target.value, by: 'user'};
      const o = e.target.closest('label')?.querySelector('output');
      if (o) o.textContent = Math.round(+e.target.value * 100) + '%';
      p._rev++;
      ed.player.dirty = true;
      queueSave();
      if (lk === 'amt') drawFxThumbs();
      return;
    }
    if (e.target.id !== 'libQ') return;
    ed.libQ = e.target.value;
    clearTimeout(libT);
    libT = setTimeout(fillLib, 160);
  });
  $('#btnNew').onclick = newProj;
  $('#btnBack').onclick = closeEditor;
  $('#btnPlay').onclick = () => ed.player.toggle();
  $('#btnUndo').onclick = () => undoRedo(-1);
  $('#btnRedo').onclick = () => undoRedo(1);
  $('#btnExport').onclick = openExport;
  $('#btnAi').onclick = runAuto;
  $('#pname').addEventListener('change', (e) => {
    ed.p.name = e.target.value.trim() || ed.p.name;
    queueSave();
  });
  $('#chat').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#chatIn').value.trim();
    if (!q || !ed.p?.main) {
      if (!ed.p?.main) toast('Thêm video chính trước đã nhé.');
      return;
    }
    $('#chatIn').value = '';
    const c = ctxTarget();
    sendAi(q, c?.target || null, c?.prefix || '', c?.label || '');
  });
  // Phím tắt máy tính (giống phần mềm dựng): Space phát/dừng · ←/→ 1 khung (Shift: 1 giây) · Home/End · S tách · Delete xoá
  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y hoàn tác/làm lại · + / − phóng timeline · Esc bỏ chọn · Ctrl+S lưu
  document.addEventListener('keydown', (e) => {
    if (!ed.p || $('#editor').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || !$('#dlg')?.hidden) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (e.code === 'Space') {
      e.preventDefault();
      ed.player.toggle();
    } else if ((k === 'Delete' || k === 'Backspace') && ed.sel) {
      e.preventDefault();
      act('del');
    } else if (mod && k.toLowerCase() === 'z') {
      e.preventDefault();
      undoRedo(e.shiftKey ? 1 : -1);
    } else if (mod && k.toLowerCase() === 'y') {
      e.preventDefault();
      undoRedo(1);
    } else if (mod && k.toLowerCase() === 's') {
      e.preventDefault();
      store.saveProject(ed.p).then(() => toast('Đã lưu dự án.'));
    } else if (!mod && (k === 'ArrowLeft' || k === 'ArrowRight') && ed.p.main) {
      e.preventDefault();
      if (ed.player.playing) ed.player.pause();
      ed.seek(ed.player.T + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30));
    } else if (!mod && (k === 'Home' || k === 'End') && ed.p.main) {
      e.preventDefault();
      ed.seek(k === 'Home' ? 0 : ed.player.D);
    } else if (!mod && (k === 's' || k === 'S') && ed.p.main && !ed.busy) {
      e.preventDefault();
      act('split');
    } else if (!mod && (k === '+' || k === '=')) ed.tl.zoom(1.3);
    else if (!mod && (k === '-' || k === '_')) ed.tl.zoom(1 / 1.3);
    else if (!mod && (k === 'v' || k === 'V')) setTool('select');
    else if (!mod && (k === 'c' || k === 'C')) setTool('note');
    else if (k === 'Escape' && ed.tool === 'note') setTool('select');
    else if (k === 'Escape' && ed.sel) select(null);
  });
  document.addEventListener('can-install', showInstall);
  showInstall();
  aiHealth().then((h) => {
    $('#aiState').textContent = h.ai ? 'AI máy chủ: đang bật' : 'AI máy chủ: chưa bật — đang dùng bộ dựng cơ bản';
    $('#aiState').classList.toggle('ok', !!h.ai);
  });

  // Vào app là vào thẳng timeline: mở dự án gần nhất, chưa có thì tạo mới
  const id = location.hash.slice(1);
  let p = id ? await store.getProject(id) : null;
  if (!p) p = (await store.listProjects())[0] || null;
  if (!p) {
    p = newProject();
    await store.saveProject(p);
  }
  openEditor(p);
}

// Ô chat + nhật ký chat: ≥ 1200px ở cột trái (kiểu HyperFrames), 900–1199 trong bảng phải, điện thoại ở đáy màn hình
function placeChat() {
  const wide = matchMedia('(min-width: 1200px)').matches;
  const desk = matchMedia('(min-width: 900px)').matches;
  const chat = $('#chat');
  const log = $('#chatlog');
  if (wide) {
    if (log.parentElement !== $('#chatcol')) $('#chatcol').appendChild(log);
    if (chat.parentElement !== $('#chatcol')) $('#chatcol').appendChild(chat);
    if (!$('[data-pane="chat"]').hidden) $('#side [data-tab="edit"]')?.click();
  } else {
    if (log.parentElement !== $('[data-pane="chat"]')) $('[data-pane="chat"]').appendChild(log);
    if (desk && chat.parentElement !== $('#side')) $('#side').appendChild(chat);
    if (!desk && chat.parentElement !== $('#editor')) $('#editor').appendChild(chat);
  }
}

function undoRedo(dir) {
  if (ed.busy) return;
  const snap = dir < 0 ? ed.history.back(ed.p) : ed.history.fwd(ed.p);
  if (!snap) return;
  for (const k of Object.keys(ed.p)) if (!k.startsWith('_')) delete ed.p[k];
  Object.assign(ed.p, snap);
  select(null);
  ed.player.attach(ed.p, ed.getBlob); // video chính có thể vừa được khôi phục / gỡ
  ed.changed(true);
}

boot();
