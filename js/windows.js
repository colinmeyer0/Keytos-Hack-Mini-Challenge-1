// DOM renderer for the fake OS windows. Pure view: main.js decides what closing means.

export function createRenderer(layerEl, { onClose = () => {}, onMove = () => {} } = {}) {
  const els = new Map(); // id -> element
  let zCounter = 10;

  function raise(el) {
    zCounter += 1;
    el.style.zIndex = String(zCounter);
  }

  function makeCloseButton(win, which) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'win-close';
    btn.tabIndex = -1; // keep Tab+Enter from bypassing dodgers
    btn.dataset.close = which;
    btn.textContent = which === 'fake' ? '✕' : '×';
    btn.setAttribute('aria-label', 'Close');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClose(win.id, which);
    });
    return btn;
  }

  function attachDrag(el, titlebar, id) {
    let drag = null;
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return;
      drag = {
        pointerId: e.pointerId,
        dx: e.clientX - el.offsetLeft - layerEl.getBoundingClientRect().left,
        dy: e.clientY - el.offsetTop - layerEl.getBoundingClientRect().top,
      };
      try { titlebar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    titlebar.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const rect = layerEl.getBoundingClientRect();
      const maxX = Math.max(0, layerEl.clientWidth - el.offsetWidth);
      const maxY = Math.max(0, layerEl.clientHeight - el.offsetHeight);
      const x = Math.min(maxX, Math.max(0, e.clientX - rect.left - drag.dx));
      const y = Math.min(maxY, Math.max(0, e.clientY - rect.top - drag.dy));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      drag = null;
      try { titlebar.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      onMove(id, el.offsetLeft, el.offsetTop);
    };
    titlebar.addEventListener('pointerup', end);
    titlebar.addEventListener('pointercancel', end);
  }

  function shake(id) {
    const el = els.get(id);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // restart animation
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  }

  function add(win) {
    if (els.has(win.id)) remove(win.id);
    const el = document.createElement('div');
    el.className = 'win';
    el.dataset.id = String(win.id);
    el.dataset.type = win.type;
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
    el.style.width = win.width + 'px';
    el.style.height = win.height + 'px';

    const titlebar = document.createElement('div');
    titlebar.className = 'win-titlebar';
    const title = document.createElement('span');
    title.className = 'win-title';
    title.textContent = win.title;
    const buttons = document.createElement('div');
    buttons.className = 'win-buttons';

    const real = makeCloseButton(win, 'real');
    if (win.type === 'hydra') {
      const fake = makeCloseButton(win, 'fake');
      if (win.fakeSide === 'left') buttons.append(fake, real);
      else buttons.append(real, fake);
    } else {
      buttons.append(real);
    }
    titlebar.append(title, buttons);

    const body = document.createElement('div');
    body.className = 'win-body';
    const text = document.createElement('p');
    text.className = 'win-text';
    text.textContent = win.body;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'win-ok';
    ok.tabIndex = -1;
    ok.textContent = 'OK';
    ok.addEventListener('click', (e) => {
      e.stopPropagation();
      shake(win.id);
    });
    body.append(text, ok);

    el.append(titlebar, body);
    el.addEventListener('pointerdown', () => raise(el));
    attachDrag(el, titlebar, win.id);

    raise(el);
    layerEl.appendChild(el);
    els.set(win.id, el);
    return el;
  }

  function remove(id) {
    const el = els.get(id);
    if (!el) return;
    el.remove();
    els.delete(id);
  }

  function clear() {
    for (const el of els.values()) el.remove();
    els.clear();
  }

  function move(id, x, y, animate = false) {
    const el = els.get(id);
    if (!el) return;
    if (animate) {
      el.classList.add('dodging');
      setTimeout(() => el.classList.remove('dodging'), 170);
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function closeButtonCenter(id) {
    const el = els.get(id);
    if (!el) return null;
    const btn = el.querySelector('.win-close[data-close="real"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  return { add, remove, clear, move, closeButtonCenter, shake };
}
