// Bố cục kéo giãn + Cài đặt giao diện (2/11): khách tự đổi bề rộng cột chat / bảng sửa,
// độ cao làn timeline, cỡ chữ bảng sửa, ẩn/hiện cột Trợ lý AI. Nhớ trên máy (localStorage dv.ui).
const KEY = 'dv.ui';
const $ = (s) => document.querySelector(s);

export const ui = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
})();

export function saveUi() {
  try {
    localStorage.setItem(KEY, JSON.stringify(ui));
  } catch {}
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TK = [0.8, 2.2];

export function applyUi() {
  const ed = $('#editor');
  if (!ed) return;
  const set = (k, v) => (v ? ed.style.setProperty(k, v) : ed.style.removeProperty(k));
  set('--chatw', ui.chatw ? ui.chatw + 'px' : '');
  set('--sidew', ui.sidew ? ui.sidew + 'px' : '');
  set('--fz', ui.fz && ui.fz !== 1 ? String(ui.fz) : '');
  const tl = $('#tl');
  if (tl) ui.tk && ui.tk !== 1 ? tl.style.setProperty('--tk', String(ui.tk)) : tl.style.removeProperty('--tk');
  ed.classList.toggle('nochatcol', ui.chat === false);
}

// Kéo vạch chia. onLayout() được gọi khi bố cục đổi (để placeChat / vẽ lại timeline).
export function bindSplitters(onLayout = () => {}) {
  for (const el of document.querySelectorAll('[data-split]')) {
    const kind = el.dataset.split;
    el.addEventListener('dblclick', () => {
      if (kind === 'chat') delete ui.chatw;
      if (kind === 'side') delete ui.sidew;
      if (kind === 'tl') delete ui.tk;
      applyUi();
      saveUi();
      onLayout();
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('drag');
      const x0 = e.clientX;
      const y0 = e.clientY;
      const fz = ui.fz || 1;
      const chat = $('#chatcol');
      const side = $('#side');
      const stage = $('.e-stage');
      const w0 = kind === 'chat' ? chat.getBoundingClientRect().width : side.getBoundingClientRect().width;
      const st0 = stage.getBoundingClientRect();
      const tk0 = ui.tk || 1;
      const tlEl = $('#tl');
      const tlH0 = tlEl.getBoundingClientRect().height;
      const rowsH = Math.max(80, tlH0 - 24); // phần làn (trừ thước)
      const move = (ev) => {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (kind === 'chat' || kind === 'side') {
          // khung xem giữ tối thiểu 360 px
          const grow = kind === 'chat' ? dx : -dx;
          const max = w0 + Math.max(0, st0.width - 360);
          const w = clamp(w0 + grow, 260, Math.min(640, max));
          ui[kind === 'chat' ? 'chatw' : 'sidew'] = Math.round(w * fz) / fz;
        } else {
          // kéo lên = timeline cao hơn; khung xem giữ tối thiểu 160 px
          const maxGrow = Math.max(0, st0.height - 160);
          const want = clamp(-dy, -rowsH, maxGrow);
          ui.tk = Math.round(clamp(tk0 * (1 + want / rowsH), TK[0], TK[1]) * 100) / 100;
        }
        applyUi();
      };
      const up = () => {
        el.classList.remove('drag');
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        saveUi();
        onLayout();
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    });
  }
}

// Bảng Cài đặt giao diện (dùng modal #dlg).
export function openUiSettings(onLayout = () => {}) {
  const d = $('#dlg');
  const wide = matchMedia('(min-width: 1200px)').matches;
  const desk = matchMedia('(min-width: 900px)').matches;
  const seg = (key, opts, cur) =>
    `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const render = () => {
    const tkPct = Math.round((ui.tk || 1) * 100);
    d.innerHTML = `<div class="dlg-card uiset" role="dialog" aria-modal="true" aria-labelledby="uiT">
      <h3 id="uiT">Cài đặt giao diện</h3>
      <p style="margin:0;color:var(--mu);font-size:12.5px">${desk ? 'Mẹo: kéo các vạch chia giữa các cột và trên timeline để đổi kích thước; bấm đúp vạch chia để về mặc định.' : 'Mẹo: kéo vạch nhỏ phía trên timeline lên / xuống để đổi độ cao timeline.'}</p>
      <div class="us-row"><b>Cỡ chữ bảng sửa và trò chuyện</b>${seg('fz', [[0.9, 'Nhỏ'], [1, 'Vừa'], [1.12, 'Lớn']], ui.fz || 1)}</div>
      <div class="us-row"><b>Độ cao làn timeline: ${tkPct}%</b><input type="range" min="${TK[0] * 100}" max="${TK[1] * 100}" step="5" value="${tkPct}" data-k="tk" aria-label="Độ cao làn timeline"><small>Làn cao hơn dễ chạm và kéo clip hơn; khung xem sẽ nhỏ lại.</small></div>
      ${desk ? `<div class="us-row"><b>Cột Trợ lý AI bên trái</b>${seg('chat', [[1, 'Hiện'], [0, 'Ẩn (vào tab)']], ui.chat === false ? 0 : 1)}<small>${wide ? 'Ẩn để khung xem rộng hơn; trò chuyện vẫn ở tab “Trợ lý AI” của bảng phải.' : 'Chỉ có tác dụng khi màn hình rộng từ 1200 px.'}</small></div>` : ''}
      <div class="us-foot"><button type="button" class="btn ghost" data-act2="reset">Khôi phục mặc định</button><span class="sp" style="flex:1"></span><button type="button" class="btn primary" data-act2="close">Xong</button></div>
    </div>`;
  };
  const change = () => {
    applyUi();
    saveUi();
    onLayout();
  };
  render();
  d.hidden = false;
  d.onclick = (e) => {
    if (e.target === d || e.target.closest('[data-act2="close"]')) {
      d.hidden = true;
      return;
    }
    if (e.target.closest('[data-act2="reset"]')) {
      for (const k of Object.keys(ui)) delete ui[k];
      change();
      render();
      return;
    }
    const b = e.target.closest('.seg button');
    if (!b) return;
    const k = b.parentElement.dataset.k;
    const v = Number(b.dataset.v);
    if (k === 'fz') v === 1 ? delete ui.fz : (ui.fz = v);
    if (k === 'chat') v ? delete ui.chat : (ui.chat = false);
    change();
    render();
  };
  d.oninput = (e) => {
    if (e.target.dataset.k !== 'tk') return;
    const v = Number(e.target.value) / 100;
    v === 1 ? delete ui.tk : (ui.tk = v);
    applyUi();
    saveUi();
    const lab = e.target.previousElementSibling;
    if (lab) lab.textContent = `Độ cao làn timeline: ${Math.round(v * 100)}%`;
  };
  d.onchange = () => onLayout();
}
