import { connectWebBluetoothPrinter, webBluetoothSupported } from './printer-web-bluetooth.js';

const DOTS_W = 96;              // printer width in dots
const SCALE = 3;                // on-screen px per dot
const MIN_LENGTH_DOTS = 24;
const MAX_LENGTH_DOTS = 2000;
const AUTO_LENGTH_PADDING_DOTS = 16;
const MIN_BARCODE_TEXT_SIZE = 56;
const MATERIAL_ICON_CODEPOINTS_URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints';
const FALLBACK_MATERIAL_ICONS = [
  'add', 'remove', 'close', 'check', 'done', 'star', 'favorite', 'home',
  'search', 'settings', 'menu', 'more_vert', 'delete', 'edit', 'save',
  'print', 'download', 'upload', 'share', 'content_copy', 'qr_code',
  'barcode_reader', 'shopping_cart', 'local_offer', 'label', 'sell',
  'inventory_2', 'all_inbox', 'mail', 'phone', 'place', 'location_on',
  'calendar_today', 'schedule', 'event', 'alarm', 'person', 'group',
  'business', 'store', 'restaurant', 'local_cafe', 'directions_car',
  'flight', 'train', 'pets', 'eco', 'recycling', 'bolt', 'water_drop',
  'thermostat', 'lightbulb', 'wifi', 'bluetooth', 'battery_full',
  'warning', 'info', 'help', 'lock', 'key', 'visibility', 'image',
  'photo_camera', 'music_note', 'mic', 'videocam', 'play_arrow', 'pause',
  'stop', 'volume_up', 'map', 'public', 'language', 'build', 'construction',
  'medical_services', 'school', 'sports_esports', 'cake', 'local_florist',
];
const STATIC_ONLY = document.body.dataset.staticOnly === 'true';
const state = {
  lengthDots: 192,              // label length in dots (auto-fit to content)
  items: [],                    // { id, type, x, y, w, h, props }
  selectedId: null,
  nextId: 1,
  printerConnected: false,
  printerAddress: null,
  webBluetoothPrinter: null,
  webBluetoothName: null,
  webBluetoothDisconnecting: false,
};

const stage = document.getElementById('stage');
const itemsEl = document.getElementById('items');
const bg = document.getElementById('bg');
const previewBitmap = document.getElementById('previewBitmap');
const previewToggle = document.getElementById('togglePreview');
const connectBtn = document.getElementById('btnConnectBackend');
const connectWebBluetoothBtn = document.getElementById('btnConnectWebBluetooth');
const backendStateEl = document.getElementById('backendState');
const webBluetoothStateEl = document.getElementById('webBluetoothState');
const iconGrid = document.getElementById('iconGrid');
const iconSearch = document.getElementById('iconSearch');
let materialIconNames = FALLBACK_MATERIAL_ICONS;
let materialIconCodepoints = new Map();

function toast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' error' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.className = '', 3000);
}

function updateBackendUi() {
  if (STATIC_ONLY) {
    connectBtn.hidden = true;
    backendStateEl.hidden = true;
    return;
  }
  backendStateEl.textContent = state.printerConnected
    ? `Backend printer: connected${state.printerAddress ? ` (${state.printerAddress})` : ''}`
    : 'Backend printer: disconnected';
  backendStateEl.classList.toggle('connected', state.printerConnected);
  connectBtn.textContent = state.printerConnected ? 'Disconnect backend printer' : 'Connect via backend';
}

function updateWebBluetoothUi() {
  const supported = webBluetoothSupported();
  const connected = !!state.webBluetoothPrinter;
  webBluetoothStateEl.textContent = connected
    ? `WebBluetooth: connected${state.webBluetoothName ? ` (${state.webBluetoothName})` : ''}`
    : supported ? 'WebBluetooth: disconnected' : 'WebBluetooth: unavailable';
  webBluetoothStateEl.classList.toggle('connected', connected);
  connectWebBluetoothBtn.disabled = !supported;
  connectWebBluetoothBtn.textContent = connected ? 'Disconnect WebBluetooth' : 'Connect via WebBluetooth...';
  connectWebBluetoothBtn.title = supported
    ? 'Connect directly to the printer from this browser'
    : 'WebBluetooth requires Chrome or Edge on HTTPS or localhost';
}

function activePrinterMode() {
  if (state.webBluetoothPrinter) return 'webbluetooth';
  if (!STATIC_ONLY && state.printerConnected) return 'backend';
  return null;
}

function applyStageSize() {
  const wpx = state.lengthDots * SCALE, hpx = DOTS_W * SCALE;
  bg.width = wpx; bg.height = hpx;
  previewBitmap.width = state.lengthDots;
  previewBitmap.height = DOTS_W;
  previewBitmap.style.width = wpx + 'px';
  previewBitmap.style.height = hpx + 'px';
  const ctx = bg.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, wpx, hpx);
  stage.style.width = wpx + 'px';
  stage.style.height = hpx + 'px';
  itemsEl.style.position = 'absolute';
  itemsEl.style.inset = '0';
  refreshInlinePreviewIfActive();
}

function clampLengthDots(v) {
  return Math.max(MIN_LENGTH_DOTS, Math.min(MAX_LENGTH_DOTS, Math.ceil(v)));
}

function getItemSize(item) {
  const el = itemsEl.querySelector(`[data-id="${item.id}"]`);
  if (!el) return { width: 0, height: 0 };
  return { width: el.offsetWidth || 0, height: el.offsetHeight || 0 };
}

function getItemContentOffset(el) {
  const child = el.firstElementChild;
  if (!child) return { x: 0, y: 0 };
  const itemRect = el.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  return {
    x: childRect.left - itemRect.left,
    y: childRect.top - itemRect.top,
  };
}

function canvasFontForText(props) {
  const family = /\s/.test(props.font) ? `"${props.font}"` : props.font;
  return `${props.italic?'italic ':''}${props.bold?'700 ':'400 '}${props.size}px ${family}`;
}

function renderTextCanvas(item) {
  const canvas = document.createElement('canvas');
  const lines = (item.props.text || '').split('\n');
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = canvasFontForText(item.props);
  const width = Math.max(1, Math.ceil(Math.max(...lines.map(line => measure.measureText(line || ' ').width))));
  const height = Math.max(1, Math.ceil(lines.length * item.props.size));

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.font = canvasFontForText(item.props);
  lines.forEach((line, i) => ctx.fillText(line || ' ', 0, i * item.props.size));
  return canvas;
}

function syncLengthToContent() {
  const rightmost = state.items.reduce((max, item) => {
    const { width } = getItemSize(item);
    return Math.max(max, item.x + width);
  }, 0);
  const nextLength = clampLengthDots(rightmost / SCALE + AUTO_LENGTH_PADDING_DOTS);
  if (nextLength !== state.lengthDots) {
    state.lengthDots = nextLength;
    applyStageSize();
    pollStatus();
  }
}

function select(id) {
  state.selectedId = id;
  [...itemsEl.children].forEach(el => el.classList.toggle('selected', el.dataset.id == id));
  renderPanel();
}

function addItem(type, props) {
  const id = state.nextId++;
  const item = { id, type, x: 10, y: 10, w: 0, h: 0, props };
  state.items.push(item);
  renderItem(item);
  syncLengthToContent();
  select(id);
  return item;
}

function removeItem(id) {
  state.items = state.items.filter(i => i.id != id);
  const el = itemsEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
  syncLengthToContent();
  if (state.selectedId == id) { state.selectedId = null; renderPanel(); }
  refreshInlinePreviewIfActive();
}

function getItem(id) { return state.items.find(i => i.id == id); }

function renderItem(item) {
  let el = itemsEl.querySelector(`[data-id="${item.id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'item';
    el.dataset.id = item.id;
    el.addEventListener('pointerdown', onPointerDown);
    itemsEl.appendChild(el);
  }
  el.classList.toggle('icon-item', item.type === 'icon');
  el.innerHTML = '';
  if (item.type === 'text') {
    el.appendChild(renderTextCanvas(item));
  } else if (item.type === 'barcode') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.appendChild(svg);
    try {
      JsBarcode(svg, item.props.value || '0', {
        format: item.props.format, displayValue: item.props.displayValue,
        width: item.props.width, height: item.props.height,
        fontSize: Math.max(item.props.fontSize || 0, MIN_BARCODE_TEXT_SIZE), margin: 0,
      });
    } catch (e) { el.textContent = '⚠ ' + e.message; el.style.color = '#c00'; el.style.fontSize = '10px'; }
  } else if (item.type === 'qr') {
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    if (!window.QRCode || typeof window.QRCode.toCanvas !== 'function') {
      el.textContent = 'QR library failed to load';
      el.style.color = '#c00';
      el.style.fontSize = '10px';
      return;
    }
    QRCode.toCanvas(canvas, item.props.value || ' ',
      { width: item.props.size, margin: 0, errorCorrectionLevel: item.props.ecl },
      err => { if (err) console.error(err); });
  } else if (item.type === 'icon') {
    const s = document.createElement('span');
    s.className = 'material-icons';
    s.textContent = materialIconGlyph(item.props.name || 'add');
    s.style.fontSize = item.props.size + 'px';
    s.style.color = '#000';
    el.appendChild(s);
  }
  el.style.left = item.x + 'px';
  el.style.top = item.y + 'px';
  el.classList.toggle('selected', state.selectedId == item.id);
  refreshInlinePreviewIfActive();
}

let drag = null;
function onPointerDown(e) {
  const el = e.currentTarget;
  const id = +el.dataset.id;
  select(id);
  const item = getItem(id);
  drag = { id, startX: item.x, startY: item.y, px: e.clientX, py: e.clientY };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp, { once: true });
}
function onPointerMove(e) {
  if (!drag) return;
  const item = getItem(drag.id);
  const rect = stage.getBoundingClientRect();
  const el = e.currentTarget;
  const itemHeight = el.offsetHeight || 0;
  item.x = Math.max(0, drag.startX + (e.clientX - drag.px));
  item.y = Math.max(0, Math.min(rect.height - itemHeight, drag.startY + (e.clientY - drag.py)));
  el.style.left = item.x + 'px';
  el.style.top = item.y + 'px';
  syncLengthToContent();
}
function onPointerUp(e) {
  e.currentTarget.removeEventListener('pointermove', onPointerMove);
  drag = null;
  refreshInlinePreviewIfActive();
}

stage.addEventListener('pointerdown', e => {
  if (e.target === stage || e.target === bg) select(null);
});

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

window.addEventListener('keydown', e => {
  const isDeleteKey =
    e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace';
  if (!isDeleteKey || state.selectedId == null) return;
  if (isEditableTarget(e.target)) return;
  e.preventDefault();
  removeItem(state.selectedId);
});

// ── Properties panel ───────────────────────────────────────────────────────
function renderPanel() {
  const body = document.getElementById('panelBody');
  const item = state.items.find(i => i.id == state.selectedId);
  if (!item) {
    body.innerHTML = `
      <h2 style="margin-top:0;font-size:.85rem;color:var(--muted);font-weight:500">Label</h2>
      <div class="row">
        <label>Length (dots)</label>
        <input type="number" id="labelLen" value="${state.lengthDots}" readonly>
      </div>
      <p class="empty">Length auto-fits to the rightmost content. The fixed top-to-bottom width is ${DOTS_W} dots.</p>
      <p class="empty">Select an item to edit its properties.</p>`;
    return;
  }
  if (item.type === 'text') {
    body.innerHTML = `
      <div class="row"><label>Text</label>
        <textarea rows="2" data-k="text">${escapeHtml(item.props.text)}</textarea></div>
      <div class="row"><label>Font</label>
        <select data-k="font">
          ${['system-ui','serif','monospace','Helvetica','Georgia','Arial Black','Impact','Courier New']
            .map(f => `<option ${f===item.props.font?'selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="settings-row">
        <div class="row"><label>Size (px)</label>
          <input type="number" min="8" max="200" data-k="size" value="${item.props.size}"></div>
        <div class="row"><label>Style</label>
          <div style="display:flex;gap:.5rem;padding-top:.3rem">
            <label style="display:flex;gap:.25rem;align-items:center;color:var(--text)">
              <input type="checkbox" data-k="bold" ${item.props.bold?'checked':''} style="width:auto">B</label>
            <label style="display:flex;gap:.25rem;align-items:center;color:var(--text)">
              <input type="checkbox" data-k="italic" ${item.props.italic?'checked':''} style="width:auto">I</label>
          </div></div>
      </div>`;
  } else if (item.type === 'barcode') {
    const formats = ['CODE128','CODE39','EAN13','EAN8','UPC','ITF14','MSI','pharmacode','codabar'];
    body.innerHTML = `
      <div class="row"><label>Value</label>
        <input type="text" data-k="value" value="${escapeHtml(item.props.value)}"></div>
      <div class="row"><label>Format</label>
        <select data-k="format">
          ${formats.map(f => `<option ${f===item.props.format?'selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="settings-row">
        <div class="row"><label>Bar width</label>
          <input type="number" min="1" max="6" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height</label>
          <input type="number" min="10" max="200" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="row"><label style="display:flex;gap:.4rem;align-items:center;color:var(--text)">
        <input type="checkbox" data-k="displayValue" ${item.props.displayValue?'checked':''} style="width:auto">
        Show value</label></div>`;
  } else if (item.type === 'qr') {
    body.innerHTML = `
      <div class="row"><label>Value</label>
        <textarea rows="3" data-k="value">${escapeHtml(item.props.value)}</textarea></div>
      <div class="settings-row">
        <div class="row"><label>Size (px)</label>
          <input type="number" min="32" max="300" data-k="size" value="${item.props.size}"></div>
        <div class="row"><label>Error correction</label>
          <select data-k="ecl">
            ${['L','M','Q','H'].map(e => `<option ${e===item.props.ecl?'selected':''}>${e}</option>`).join('')}
          </select></div>
      </div>`;
  } else if (item.type === 'icon') {
    body.innerHTML = `
      <div class="row"><label>Icon name</label>
        <input type="text" list="materialIconNames" data-k="name" value="${escapeHtml(item.props.name)}"></div>
      <datalist id="materialIconNames">
        ${materialIconNames.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}
      </datalist>
      <div class="row"><label>Size (px)</label>
        <input type="number" min="16" max="300" data-k="size" value="${item.props.size}"></div>`;
  }
  body.insertAdjacentHTML('beforeend', `<button class="delete" id="btnDelete">Delete item</button>`);
  body.querySelectorAll('[data-k]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      let v = inp.type === 'checkbox' ? inp.checked
             : inp.type === 'number' ? parseInt(inp.value) || 0
             : inp.value;
      item.props[k] = v;
      renderItem(item);
      syncLengthToContent();
    });
  });
  document.getElementById('btnDelete').addEventListener('click', () => removeItem(item.id));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function formatCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMaterialIconCodepoints(text) {
  return text.split('\n')
    .map(line => line.trim().match(/^(\S+)\s+([0-9a-f]+)$/i))
    .filter(Boolean)
    .map(match => ({ name: match[1], codepoint: match[2] }));
}

function materialIconGlyph(name) {
  const codepoint = materialIconCodepoints.get(name);
  return codepoint ? String.fromCodePoint(parseInt(codepoint, 16)) : name;
}

function renderIconGrid() {
  const q = iconSearch.value.trim().toLowerCase();
  const names = q
    ? materialIconNames.filter(name => name.includes(q))
    : materialIconNames;
  iconGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const name of names) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-choice';
    btn.title = name;
    btn.setAttribute('aria-label', `Add ${name} icon`);
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = materialIconGlyph(name);
    btn.appendChild(icon);
    btn.addEventListener('click', () => addItem('icon', { name, size: 260 }));
    frag.appendChild(btn);
  }
  iconGrid.appendChild(frag);
}

async function loadMaterialIconNames() {
  renderIconGrid();
  try {
    const res = await fetch(MATERIAL_ICON_CODEPOINTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entries = parseMaterialIconCodepoints(await res.text());
    if (entries.length) {
      materialIconNames = entries.map(entry => entry.name);
      materialIconCodepoints = new Map(entries.map(entry => [entry.name, entry.codepoint]));
      renderIconGrid();
      state.items.filter(item => item.type === 'icon').forEach(renderItem);
      if (getItem(state.selectedId)?.type === 'icon') renderPanel();
    }
  } catch (err) {
    console.warn('Using fallback Material Icons list:', err);
  }
}

function ensureMaterialIconsFont(size = 260) {
  if (!document.fonts || typeof document.fonts.load !== 'function') {
    return Promise.resolve();
  }
  return document.fonts.load(`400 ${size}px "Material Icons"`);
}

// ── Toolbar ───────────────────────────────────────────────────────────────
document.getElementById('btnAddText').onclick = () => addItem('text', {
  text: 'Text', font: 'system-ui', size: 200, bold: false, italic: false });
document.getElementById('btnAddDate').onclick = () => addItem('text', {
  text: formatCurrentDate(), font: 'system-ui', size: 200, bold: false, italic: false });
document.getElementById('btnAddBarcode').onclick = () => addItem('barcode', {
  value: '123456789012', format: 'CODE128', width: 5, height: 200,
  fontSize: MIN_BARCODE_TEXT_SIZE, displayValue: true });
document.getElementById('btnAddQR').onclick = () => addItem('qr', {
  value: 'https://example.com', size: 260, ecl: 'M' });
iconSearch.addEventListener('input', renderIconGrid);
document.getElementById('btnClear').onclick = () => {
  if (state.items.length && !confirm('Clear all items?')) return;
  state.items = []; itemsEl.innerHTML = ''; state.selectedId = null; renderPanel();
  syncLengthToContent();
  refreshInlinePreviewIfActive();
};
if (!STATIC_ONLY) {
  connectBtn.onclick = async () => {
    const wantConnect = !state.printerConnected;
    connectBtn.disabled = true;
    try {
      const r = await fetch(wantConnect ? '/connect' : '/disconnect', { method: 'POST' });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error || payload.message || 'request failed');
      state.printerConnected = !!payload.connected;
      state.printerAddress = payload.address || null;
      updateBackendUi();
      await pollStatus();
      toast(wantConnect ? 'Printer connected via backend' : 'Printer disconnected');
    } catch (e) {
      toast((wantConnect ? 'Connect failed: ' : 'Disconnect failed: ') + e.message, true);
    } finally {
      connectBtn.disabled = false;
      updateBackendUi();
    }
  };
}

connectWebBluetoothBtn.onclick = async () => {
  const wantConnect = !state.webBluetoothPrinter;
  connectWebBluetoothBtn.disabled = true;
  try {
    if (wantConnect) {
      const printer = await connectWebBluetoothPrinter();
      state.webBluetoothPrinter = printer;
      state.webBluetoothName = printer.deviceName;
      printer.transport.device.addEventListener('gattserverdisconnected', () => {
        state.webBluetoothPrinter = null;
        state.webBluetoothName = null;
        updateWebBluetoothUi();
        updateStatusLine();
        if (!state.webBluetoothDisconnecting) toast('WebBluetooth printer disconnected');
      });
      toast('Printer connected via WebBluetooth');
    } else {
      const printer = state.webBluetoothPrinter;
      state.webBluetoothDisconnecting = true;
      state.webBluetoothPrinter = null;
      state.webBluetoothName = null;
      await printer.disconnect();
      toast('WebBluetooth printer disconnected');
    }
    updateWebBluetoothUi();
    updateStatusLine();
  } catch (e) {
    toast((wantConnect ? 'WebBluetooth connect failed: ' : 'WebBluetooth disconnect failed: ') + e.message, true);
  } finally {
    state.webBluetoothDisconnecting = false;
    connectWebBluetoothBtn.disabled = false;
    updateWebBluetoothUi();
  }
};

// ── Render to printer-resolution PNG ──────────────────────────────────────
async function renderPrintBitmaps() {
  syncLengthToContent();
  const maxIconSize = state.items.reduce((max, item) =>
    item.type === 'icon' ? Math.max(max, item.props.size || 0) : max, 0);
  if (maxIconSize) await ensureMaterialIconsFont(maxIconSize);
  // Compose in editor orientation first: X = feed direction, Y = paper width.
  const logical = document.createElement('canvas');
  logical.width = state.lengthDots;
  logical.height = DOTS_W;
  const ctx = logical.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, logical.width, logical.height);
  ctx.save();
  ctx.scale(1 / SCALE, 1 / SCALE);
  for (const item of state.items) {
    const el = itemsEl.querySelector(`[data-id="${item.id}"]`);
    if (!el) continue;
    const contentOffset = getItemContentOffset(el);
    const dx = item.x + contentOffset.x, dy = item.y + contentOffset.y;
    if (item.type === 'text') {
      const c = el.querySelector('canvas');
      if (c) ctx.drawImage(c, dx, dy);
    } else if (item.type === 'icon') {
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'top';
      ctx.font = `400 ${item.props.size}px "Material Icons"`;
      ctx.fillText(materialIconGlyph(item.props.name || 'add'), dx, dy);
    } else if (item.type === 'barcode') {
      const svg = el.querySelector('svg');
      if (svg) {
        const s = new XMLSerializer().serializeToString(svg);
        const img = await loadImg('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))));
        ctx.drawImage(img, dx, dy);
      }
    } else if (item.type === 'qr') {
      const c = el.querySelector('canvas');
      if (c) ctx.drawImage(c, dx, dy);
    }
  }
  ctx.restore();
  // Threshold to pure black/white for crisp 1bpp raster.
  const img = ctx.getImageData(0, 0, logical.width, logical.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = 0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2];
    const v = lum < 160 ? 0 : 255;
    img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Rotate clockwise so the uploaded bitmap matches the printer raster
  // orientation expected by the server: width = 96 dots, height = label length.
  const rotated = document.createElement('canvas');
  rotated.width = DOTS_W;
  rotated.height = state.lengthDots;
  const rctx = rotated.getContext('2d');
  rctx.fillStyle = '#fff';
  rctx.fillRect(0, 0, rotated.width, rotated.height);
  rctx.translate(rotated.width, 0);
  rctx.rotate(Math.PI / 2);
  rctx.drawImage(logical, 0, 0);
  return { logical, rotated };
}

async function renderForPrint() {
  const { rotated } = await renderPrintBitmaps();
  return rotated;
}
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}

async function showInlinePreview(token) {
  const { logical } = await renderPrintBitmaps();
  if (!previewToggle.checked || token !== previewRenderToken) return;
  previewBitmap.width = logical.width;
  previewBitmap.height = logical.height;
  const ctx = previewBitmap.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, previewBitmap.width, previewBitmap.height);
  ctx.drawImage(logical, 0, 0);
  previewBitmap.style.display = 'block';
  itemsEl.classList.add('preview-source-hidden');
}

function hideInlinePreview() {
  previewBitmap.style.display = 'none';
  itemsEl.classList.remove('preview-source-hidden');
}

let previewRenderToken = 0;

async function setInlinePreviewActive(active) {
  const token = ++previewRenderToken;
  if (!active) {
    hideInlinePreview();
    return;
  }
  itemsEl.classList.add('preview-source-hidden');
  try {
    await showInlinePreview(token);
    if (!previewToggle.checked) hideInlinePreview();
  } catch (err) {
    if (token !== previewRenderToken) return;
    previewToggle.checked = false;
    toast('Preview failed: ' + err.message, true);
    hideInlinePreview();
  }
}

function refreshInlinePreviewIfActive() {
  if (!previewToggle.checked) return;
  setInlinePreviewActive(true);
}

previewToggle.addEventListener('change', () => setInlinePreviewActive(previewToggle.checked));

document.getElementById('btnPrint').onclick = async () => {
  const btn = document.getElementById('btnPrint');
  btn.disabled = true; btn.textContent = '… printing';
  try {
    const c = await renderForPrint();
    if (state.webBluetoothPrinter) {
      await state.webBluetoothPrinter.printCanvas(c);
      toast('Sent to printer via WebBluetooth');
    } else {
      if (STATIC_ONLY) throw new Error('connect with WebBluetooth first');
      if (!state.printerConnected) throw new Error('printer not connected');
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const fd = new FormData(); fd.append('image', blob, 'label.png');
      const r = await fetch('/print', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      toast('Sent to printer via backend');
    }
  } catch (e) { toast('Print failed: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = '🖨 Print'; }
};

document.getElementById('btnDownloadLabel').onclick = async () => {
  const btn = document.getElementById('btnDownloadLabel');
  btn.disabled = true; btn.textContent = '… saving';
  try {
    const c = await renderForPrint();
    if (state.webBluetoothPrinter) {
      await state.webBluetoothPrinter.downloadCanvas(c);
      toast('Label transferred for double-press printing via WebBluetooth');
    } else {
      if (STATIC_ONLY) throw new Error('connect with WebBluetooth first');
      if (!state.printerConnected) throw new Error('printer not connected');
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const fd = new FormData(); fd.append('image', blob, 'label.png');
      const r = await fetch('/download-label', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      toast('Label transferred for double-press printing via backend');
    }
  } catch (e) { toast('Transfer failed: ' + e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = '⇩ Save Macro'; }
};

// ── Status poll ───────────────────────────────────────────────────────────
function updateStatusLine(backendStatus = null) {
  const parts = [`${state.lengthDots}×${DOTS_W} dots`];
  if (state.webBluetoothPrinter) {
    const s = state.webBluetoothPrinter.state;
    if (s.batteryPercent >= 0) parts.push(`web bt bat ${s.batteryPercent}%`);
    parts.push('web bt connected');
    if (s.coverOpen) parts.push('cover open');
    if (s.lackPaper) parts.push('no paper');
    if (s.jam) parts.push('jam');
    if (s.printing) parts.push('printing');
  }
  if (backendStatus) {
    if (backendStatus.battery_pct >= 0) parts.push(`backend bat ${backendStatus.battery_pct}%`);
    parts.push(state.printerConnected ? 'backend connected' : 'backend disconnected');
    if (!state.webBluetoothPrinter) {
      if (backendStatus.cover_open) parts.push('cover open');
      if (backendStatus.lack_paper) parts.push('no paper');
      if (backendStatus.jam) parts.push('jam');
      if (backendStatus.printing) parts.push('printing');
      if (backendStatus.last_error) parts.push(`err ${backendStatus.last_error}`);
    }
  } else if (!state.webBluetoothPrinter) {
    parts.push(state.printerConnected ? 'backend connected' : 'backend disconnected');
  }
  const mode = activePrinterMode();
  if (mode) parts.push(`print via ${mode === 'webbluetooth' ? 'WebBluetooth' : 'backend'}`);
  document.getElementById('status').textContent = parts.join(' · ');
}

async function pollStatus() {
  if (STATIC_ONLY) {
    updateStatusLine();
    return;
  }
  try {
    const r = await fetch('/status');
    const s = await r.json();
    state.printerConnected = !!s.connected;
    state.printerAddress = s.address || null;
    updateBackendUi();
    updateStatusLine(s);
  } catch {
    updateStatusLine();
  }
}
if (!STATIC_ONLY) setInterval(pollStatus, 2000);
pollStatus();

applyStageSize();
syncLengthToContent();
renderPanel();
updateBackendUi();
updateWebBluetoothUi();
loadMaterialIconNames();
