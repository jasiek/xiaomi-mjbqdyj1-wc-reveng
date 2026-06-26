import { connectWebBluetoothPrinter, webBluetoothSupported } from './printer-web-bluetooth.js';
import Zint from 'https://esm.sh/jsr/@zshzebra/zint-wasm@2.16.1';

const ZINT_WASM_URL = 'https://esm.sh/@jsr/zshzebra__zint-wasm@2.16.1/src/zint.wasm';
const ZINT_SCALE_UNIT = 1;            // zint emits 1 SVG user unit per module at scale=1
const QR_ZINT_SCALE = 4;             // zint scale used when probing QR module layout

const DOTS_W = 96;              // printer width in dots
const SCALE = 3;                // on-screen px per dot
const MIN_LENGTH_DOTS = 24;
const MAX_LENGTH_DOTS = 2000;
const AUTO_LENGTH_PADDING_DOTS = 16;
const MIN_BARCODE_TEXT_SIZE = 56;
const MIN_RECT_SIZE = 8;
const MIN_LINE_LENGTH = 8;
const MIN_ELLIPSE_SIZE = 8;
const MIN_IMAGE_SIZE = 8;
const MIN_QR_SIZE = 32;
const MAX_BARCODE_BAR_WIDTH = 32;
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
const DEFAULT_TEXT_FONTS = [
  'system-ui', 'serif', 'monospace', 'Helvetica', 'Georgia', 'Arial Black',
  'Impact', 'Courier New',
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
const imageUpload = document.getElementById('imageUpload');
let materialIconNames = FALLBACK_MATERIAL_ICONS;
let materialIconCodepoints = new Map();
let textFontFamilies = [...DEFAULT_TEXT_FONTS];
let zintRenderToken = 0;

let zintInstancePromise = null;
function getZint() {
  if (!zintInstancePromise) zintInstancePromise = Zint.init(ZINT_WASM_URL);
  return zintInstancePromise;
}

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
  itemsEl.style.left = '0';
  itemsEl.style.top = '0';
  itemsEl.style.width = wpx + 'px';
  itemsEl.style.height = hpx + 'px';
  refreshInlinePreviewIfActive();
}

function clampLengthDots(v) {
  return Math.max(MIN_LENGTH_DOTS, Math.min(MAX_LENGTH_DOTS, Math.ceil(v)));
}

function getItemSize(item) {
  const el = itemsEl.querySelector(`[data-id="${item.id}"]`);
  if (!el) return { width: 0, height: 0 };
  if (item.type === 'image') {
    normalizeImageProps(item.props);
    const child = el.firstElementChild;
    const offsetX = child instanceof HTMLElement ? child.offsetLeft : 0;
    const offsetY = child instanceof HTMLElement ? child.offsetTop : 0;
    const angle = item.props.rotation * Math.PI / 180;
    const boxWidth = Math.abs(item.props.width * Math.cos(angle)) + Math.abs(item.props.height * Math.sin(angle));
    const boxHeight = Math.abs(item.props.width * Math.sin(angle)) + Math.abs(item.props.height * Math.cos(angle));
    return {
      width: Math.ceil(offsetX + item.props.width / 2 + boxWidth / 2),
      height: Math.ceil(offsetY + item.props.height / 2 + boxHeight / 2),
    };
  }
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

function getItemContentSize(el) {
  const child = el.firstElementChild;
  if (!child) return { width: el.offsetWidth || 0, height: el.offsetHeight || 0 };
  const childRect = child.getBoundingClientRect();
  return {
    width: Math.max(1, childRect.width),
    height: Math.max(1, childRect.height),
  };
}

function getItemPrintOffset(item, el) {
  if (item.type === 'image') {
    const child = el.firstElementChild;
    return {
      x: item.x + (child instanceof HTMLElement ? child.offsetLeft : 0),
      y: item.y + (child instanceof HTMLElement ? child.offsetTop : 0),
    };
  }
  const contentOffset = getItemContentOffset(el);
  return {
    x: item.x + contentOffset.x,
    y: item.y + contentOffset.y,
  };
}

function isResizableItemType(type) {
  return ['barcode', 'qr', 'rect', 'line', 'circle', 'image'].includes(type);
}

function appendResizeHandle(el, title) {
  const handle = document.createElement('div');
  handle.className = 'handle';
  handle.title = title;
  handle.addEventListener('pointerdown', onResizePointerDown);
  el.appendChild(handle);
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
  lines.forEach((line, i) => {
    const text = line || ' ';
    const y = i * item.props.size;
    ctx.fillText(text, 0, y);
    if (item.props.underline) {
      const underlineY = Math.min(height - 1, y + Math.round(item.props.size * 0.88));
      const underlineWidth = Math.ceil(measure.measureText(text).width);
      ctx.fillRect(0, underlineY, underlineWidth, Math.max(1, Math.round(item.props.size / 18)));
    }
  });
  return canvas;
}

const ZINT_BARCODE_FORMATS = {
  CODE128: Zint.CODE128,
  CODE39: Zint.CODE39,
  EAN13: Zint.EANX,
  EAN8: Zint.EANX,
  UPC: Zint.UPCA,
  UPCA: Zint.UPCA,
  UPCE: Zint.UPCE,
  ITF14: Zint.ITF14,
  CODABAR: Zint.CODABAR,
};

const QR_ECL_TO_ZINT = { L: 1, M: 2, Q: 3, H: 4 };

function barcodeFormatForZint(format) {
  return ZINT_BARCODE_FORMATS[String(format || '').toUpperCase()] ?? Zint.CODE128;
}

function zintOptionsForItem(item) {
  if (item.type === 'qr') {
    return {
      symbology: Zint.QRCODE,
      scale: QR_ZINT_SCALE,
      option1: QR_ECL_TO_ZINT[item.props.ecl] ?? 2,
    };
  }
  return {
    symbology: barcodeFormatForZint(item.props.format),
    scale: Math.max(1, parseInt(item.props.width) || 1),
    showHrt: !!item.props.displayValue,
  };
}

function alignToPrinterDot(px) {
  return Math.max(SCALE, Math.round(px / SCALE) * SCALE);
}

function snapToPrinterDot(px) {
  return Math.round(px / SCALE) * SCALE;
}

function normalizeQRProps(props) {
  props.size = Math.max(MIN_QR_SIZE, alignToPrinterDot(parseInt(props.size) || MIN_QR_SIZE));
  props.ecl = ['L', 'M', 'Q', 'H'].includes(props.ecl) ? props.ecl : 'M';
}

function qrModuleAlignedSize(svgText, requestedSize) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  const naturalWidth = parseFloat(svg.getAttribute('width')) || requestedSize || 1;
  const modules = Math.max(1, Math.round(naturalWidth / QR_ZINT_SCALE));
  const requestedDots = Math.max(1, Math.round(requestedSize / SCALE));
  const dotsPerModule = Math.max(1, Math.round(requestedDots / modules));
  return modules * dotsPerModule * SCALE;
}

function snapQRItemToPrinterGrid(item) {
  if (item.type !== 'qr') return;
  normalizeQRProps(item.props);
  item.x = Math.max(0, snapToPrinterDot(item.x));
  item.y = Math.max(0, snapToPrinterDot(item.y));
}

function sizedZintSvg(svgText, width, height) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Zint returned invalid SVG');
  }
  const naturalWidth = parseFloat(svg.getAttribute('width')) || width || 1;
  const naturalHeight = parseFloat(svg.getAttribute('height')) || height || 1;
  svg.setAttribute('viewBox', `0 0 ${naturalWidth} ${naturalHeight}`);
  svg.setAttribute('width', Math.max(1, Math.round(width || naturalWidth)));
  svg.setAttribute('height', Math.max(1, Math.round(height || naturalHeight)));
  svg.style.width = `${Math.max(1, Math.round(width || naturalWidth))}px`;
  svg.style.height = `${Math.max(1, Math.round(height || naturalHeight))}px`;
  svg.style.display = 'block';
  svg.style.shapeRendering = 'crispEdges';
  return svg;
}

async function renderZintSvg(item) {
  if (item.type === 'qr') normalizeQRProps(item.props);
  const value = item.props.value || (item.type === 'qr' ? ' ' : '0');
  const opts = zintOptionsForItem(item);
  const zint = await getZint();
  const result = zint.svg(opts.symbology, value, {
    scale: opts.scale,
    option1: opts.option1,
    showHrt: opts.showHrt,
  });
  if (item.type === 'qr') {
    item.props.size = qrModuleAlignedSize(result.svg, item.props.size);
  }
  const width = item.type === 'qr' ? item.props.size : item.type === 'barcode' ? item.props.boxWidth : null;
  const height = item.type === 'qr' ? item.props.size : item.props.height;
  return sizedZintSvg(result.svg, width, height);
}

function showZintPlaceholder(el, text) {
  el.textContent = text;
  el.style.color = '#333';
  el.style.fontSize = '10px';
}

function showZintError(el, err) {
  el.textContent = '! ' + err.message;
  el.style.color = '#c00';
  el.style.fontSize = '10px';
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

function fontOptions(selectedFont) {
  return [...new Set([...textFontFamilies, selectedFont].filter(Boolean))];
}

function cssFontFamily(font) {
  const genericFonts = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  ]);
  if (genericFonts.has(font)) return font;
  return `"${String(font).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renderFontPicker(selectedFont) {
  const options = fontOptions(selectedFont);
  return `
    <div class="font-picker" id="fontPicker">
      <button type="button" class="font-picker-button" id="btnFontPicker"
        aria-haspopup="listbox" aria-expanded="false"
        style="font-family:${escapeHtml(cssFontFamily(selectedFont))}">
        <span>${escapeHtml(selectedFont)}</span>
        <span aria-hidden="true">v</span>
      </button>
      <div class="font-picker-list" id="fontPickerList" role="listbox" hidden>
        ${options.map(font => `
          <button type="button" class="font-picker-option" role="option"
            data-font="${escapeHtml(font)}" aria-selected="${font === selectedFont ? 'true' : 'false'}"
            style="font-family:${escapeHtml(cssFontFamily(font))}">
            ${escapeHtml(font)}
          </button>`).join('')}
      </div>
    </div>`;
}

function setFontPickerOpen(open) {
  const btn = document.getElementById('btnFontPicker');
  const list = document.getElementById('fontPickerList');
  if (!btn || !list) return;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  list.hidden = !open;
}

function setupFontPicker(item) {
  const picker = document.getElementById('fontPicker');
  const btn = document.getElementById('btnFontPicker');
  const list = document.getElementById('fontPickerList');
  if (!picker || !btn || !list) return;
  btn.addEventListener('click', () => setFontPickerOpen(list.hidden));
  btn.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setFontPickerOpen(true);
    list.querySelector('.font-picker-option')?.focus();
  });
  list.querySelectorAll('.font-picker-option').forEach(option => {
    option.addEventListener('click', () => {
      item.props.font = option.dataset.font;
      renderItem(item);
      syncLengthToContent();
      renderPanel();
    });
    option.addEventListener('keydown', e => {
      const options = [...list.querySelectorAll('.font-picker-option')];
      const current = options.indexOf(option);
      if (e.key === 'Escape') {
        e.preventDefault();
        setFontPickerOpen(false);
        btn.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        options[Math.min(current + 1, options.length - 1)]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        options[Math.max(current - 1, 0)]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        option.click();
      }
    });
  });
}

async function loadSystemFonts({ silent = false } = {}) {
  const btn = document.getElementById('btnLoadSystemFonts');
  if (!('queryLocalFonts' in window)) {
    if (!silent) toast('System font access is not supported by this browser.', true);
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading fonts...';
  }
  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts.map(font => font.family).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    if (!families.length) {
      toast('No system fonts were found.', true);
      return;
    }
    textFontFamilies = [...new Set([...DEFAULT_TEXT_FONTS, ...families])];
    renderPanel();
    if (!silent) toast(`Loaded ${families.length} system fonts.`);
  } catch (err) {
    const cancelled = err && (err.name === 'AbortError' || err.name === 'NotAllowedError');
    if (!silent) {
      toast(cancelled ? 'System font access was cancelled.' : 'Could not load system fonts.', true);
    }
  } finally {
    if (btn && document.body.contains(btn)) {
      btn.disabled = false;
      btn.textContent = 'Load system fonts';
    }
  }
}

async function loadSystemFontsIfAlreadyPermitted() {
  if (!('queryLocalFonts' in window) || !navigator.permissions?.query) return;
  try {
    const status = await navigator.permissions.query({ name: 'local-fonts' });
    if (status.state === 'granted') await loadSystemFonts({ silent: true });
    status.addEventListener?.('change', () => {
      if (status.state === 'granted') loadSystemFonts({ silent: true });
    });
  } catch {
    // Some browsers reject unknown permission names; the manual button remains available.
  }
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
  el.classList.toggle('rect-item', item.type === 'rect');
  el.classList.toggle('line-item', item.type === 'line');
  el.classList.toggle('circle-item', item.type === 'circle');
  el.classList.toggle('image-item', item.type === 'image');
  el.innerHTML = '';
  el.style.color = '';
  el.style.fontSize = '';
  if (item.type === 'text') {
    el.appendChild(renderTextCanvas(item));
  } else if (item.type === 'barcode') {
    const token = ++zintRenderToken;
    item.zintToken = token;
    showZintPlaceholder(el, 'Rendering barcode...');
    renderZintSvg(item)
      .then(svg => {
        if (item.zintToken !== token || !itemsEl.contains(el)) return;
        el.innerHTML = '';
        el.style.color = '';
        el.style.fontSize = '';
        el.appendChild(svg);
        appendResizeHandle(el, 'Resize barcode');
        syncLengthToContent();
        refreshInlinePreviewIfActive();
      })
      .catch(err => {
        if (item.zintToken !== token || !itemsEl.contains(el)) return;
        showZintError(el, err);
        refreshInlinePreviewIfActive();
      });
  } else if (item.type === 'qr') {
    snapQRItemToPrinterGrid(item);
    const token = ++zintRenderToken;
    item.zintToken = token;
    showZintPlaceholder(el, 'Rendering QR...');
    renderZintSvg(item)
      .then(svg => {
        if (item.zintToken !== token || !itemsEl.contains(el)) return;
        el.innerHTML = '';
        el.style.color = '';
        el.style.fontSize = '';
        el.appendChild(svg);
        appendResizeHandle(el, 'Resize QR code');
        syncLengthToContent();
        refreshInlinePreviewIfActive();
      })
      .catch(err => {
        if (item.zintToken !== token || !itemsEl.contains(el)) return;
        showZintError(el, err);
        refreshInlinePreviewIfActive();
      });
  } else if (item.type === 'icon') {
    const s = document.createElement('span');
    s.className = 'material-icons';
    s.textContent = materialIconGlyph(item.props.name || 'add');
    s.style.fontSize = item.props.size + 'px';
    s.style.color = '#000';
    el.appendChild(s);
  } else if (item.type === 'rect') {
    normalizeRectProps(item.props);
    const rect = document.createElement('div');
    rect.className = 'rect-shape';
    rect.style.width = item.props.width + 'px';
    rect.style.height = item.props.height + 'px';
    rect.style.border = item.props.strokeSize + 'px solid #000';
    rect.style.borderRadius = item.props.radius + 'px';
    rect.style.background = item.props.filled ? '#000' : '#fff';
    rect.style.boxSizing = 'border-box';
    el.appendChild(rect);

    appendResizeHandle(el, 'Resize rectangle');
  } else if (item.type === 'line') {
    normalizeLineProps(item.props);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('line-shape');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(line);
    el.appendChild(svg);
    updateLineShape(svg, item.props);

    appendResizeHandle(el, 'Resize line');
  } else if (item.type === 'circle') {
    normalizeCircleProps(item.props);
    const circle = document.createElement('div');
    circle.className = 'circle-shape';
    circle.style.width = item.props.width + 'px';
    circle.style.height = item.props.height + 'px';
    circle.style.border = item.props.strokeSize + 'px solid #000';
    circle.style.borderRadius = '50%';
    circle.style.background = item.props.filled ? '#000' : '#fff';
    circle.style.boxSizing = 'border-box';
    el.appendChild(circle);

    appendResizeHandle(el, 'Resize circle or ellipse');
  } else if (item.type === 'image') {
    normalizeImageProps(item.props);
    const img = document.createElement('img');
    img.className = 'image-shape';
    img.src = item.props.src;
    img.alt = '';
    img.style.width = item.props.width + 'px';
    img.style.height = item.props.height + 'px';
    img.style.transform = `rotate(${item.props.rotation}deg)`;
    el.appendChild(img);

    appendResizeHandle(el, 'Resize image');
  }
  el.style.left = item.x + 'px';
  el.style.top = item.y + 'px';
  el.classList.toggle('selected', state.selectedId == item.id);
  refreshInlinePreviewIfActive();
}

let drag = null;
function onPointerDown(e) {
  if (e.target instanceof HTMLElement && e.target.classList.contains('handle')) return;
  const el = e.currentTarget;
  const id = +el.dataset.id;
  select(id);
  const item = getItem(id);
  drag = { id, startX: item.x, startY: item.y, px: e.clientX, py: e.clientY };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp, { once: true });
}

let resize = null;
function onResizePointerDown(e) {
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget.closest('.item');
  const id = +el.dataset.id;
  const item = getItem(id);
  if (!item || !isResizableItemType(item.type)) return;
  select(id);
  normalizeResizableProps(item);
  const contentSize = getItemContentSize(el);
  resize = {
    id,
    startWidth: item.type === 'qr' ? item.props.size : contentSize.width,
    startHeight: item.type === 'qr' ? item.props.size : contentSize.height,
    startPropWidth: item.props.width,
    px: e.clientX,
    py: e.clientY,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
  e.currentTarget.addEventListener('pointermove', onResizePointerMove);
  e.currentTarget.addEventListener('pointerup', onResizePointerUp, { once: true });
}

function onResizePointerMove(e) {
  if (!resize) return;
  const item = getItem(resize.id);
  if (!item) return;
  const rect = stage.getBoundingClientRect();
  const el = itemsEl.querySelector(`[data-id="${item.id}"]`);
  const minSize = item.type === 'line' ? 0 : shapeMinSize(item);
  const maxHeight = Math.max(minSize, Math.floor(rect.height - item.y - 4));
  const nextWidth = Math.max(item.type === 'line' ? MIN_LINE_LENGTH : shapeMinSize(item), resize.startWidth + (e.clientX - resize.px));
  const nextHeight = Math.max(minSize, Math.min(maxHeight, resize.startHeight + (e.clientY - resize.py)));
  if (item.type === 'qr') {
    item.props.size = Math.min(Math.max(MIN_QR_SIZE, Math.max(nextWidth, nextHeight)), maxHeight);
    normalizeQRProps(item.props);
  } else if (item.type === 'barcode') {
    const widthScale = nextWidth / Math.max(1, resize.startWidth);
    item.props.width = Math.min(MAX_BARCODE_BAR_WIDTH, Math.max(1, Math.round((resize.startPropWidth || 1) * widthScale)));
    item.props.boxWidth = alignToPrinterDot(nextWidth);
    item.props.height = Math.max(10, alignToPrinterDot(nextHeight));
  } else if (item.type === 'image' && item.props.lockAspect) {
    setImageSizePreservingAspect(item.props, nextWidth, nextHeight, resize, maxHeight);
  } else {
    item.props.width = nextWidth;
    item.props.height = nextHeight;
  }
  if (item.type === 'rect') {
    const shape = el?.querySelector('.rect-shape');
    if (!shape) return;
    shape.style.width = item.props.width + 'px';
    shape.style.height = item.props.height + 'px';
  } else if (item.type === 'line') {
    const shape = el?.querySelector('.line-shape');
    if (!shape) return;
    updateLineShape(shape, item.props);
  } else if (item.type === 'circle') {
    const shape = el?.querySelector('.circle-shape');
    if (!shape) return;
    shape.style.width = item.props.width + 'px';
    shape.style.height = item.props.height + 'px';
  } else if (item.type === 'image') {
    const shape = el?.querySelector('.image-shape');
    if (!shape) return;
    shape.style.width = item.props.width + 'px';
    shape.style.height = item.props.height + 'px';
  } else if (item.type === 'barcode' || item.type === 'qr') {
    const shape = el?.firstElementChild;
    if (!(shape instanceof SVGElement)) return;
    shape.style.width = (item.type === 'qr' ? item.props.size : item.props.boxWidth) + 'px';
    shape.style.height = (item.type === 'qr' ? item.props.size : item.props.height) + 'px';
  }
  syncLengthToContent();
}

function onResizePointerUp(e) {
  e.currentTarget.removeEventListener('pointermove', onResizePointerMove);
  resize = null;
  const item = getItem(state.selectedId);
  if (item?.type === 'barcode' || item?.type === 'qr') renderItem(item);
  if (isResizableItemType(item?.type)) renderPanel();
  refreshInlinePreviewIfActive();
}
function onPointerMove(e) {
  if (!drag) return;
  const item = getItem(drag.id);
  const rect = stage.getBoundingClientRect();
  const el = e.currentTarget;
  const itemHeight = el.offsetHeight || 0;
  item.x = Math.max(0, drag.startX + (e.clientX - drag.px));
  item.y = Math.max(0, Math.min(rect.height - itemHeight, drag.startY + (e.clientY - drag.py)));
  snapQRItemToPrinterGrid(item);
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

document.addEventListener('click', e => {
  const picker = document.getElementById('fontPicker');
  if (picker && !picker.contains(e.target)) setFontPickerOpen(false);
});

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
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
        ${renderFontPicker(item.props.font)}
        <button type="button" class="secondary" id="btnLoadSystemFonts">Load system fonts</button></div>
      <div class="settings-row">
        <div class="row"><label>Size (px)</label>
          <input type="number" min="8" max="200" data-k="size" value="${item.props.size}"></div>
        <div class="row"><label>Style</label>
          <div style="display:flex;gap:.5rem;padding-top:.3rem">
            <label style="display:flex;gap:.25rem;align-items:center;color:var(--text)">
              <input type="checkbox" data-k="bold" ${item.props.bold?'checked':''} style="width:auto">B</label>
            <label style="display:flex;gap:.25rem;align-items:center;color:var(--text)">
              <input type="checkbox" data-k="italic" ${item.props.italic?'checked':''} style="width:auto">I</label>
            <label style="display:flex;gap:.25rem;align-items:center;color:var(--text)">
              <input type="checkbox" data-k="underline" ${item.props.underline?'checked':''} style="width:auto">U</label>
          </div></div>
      </div>`;
  } else if (item.type === 'barcode') {
    const formats = ['CODE128','CODE39','EAN13','EAN8','UPCA','UPCE','ITF14','CODABAR'];
    body.innerHTML = `
      <div class="row"><label>Value</label>
        <input type="text" data-k="value" value="${escapeHtml(item.props.value)}"></div>
      <div class="row"><label>Format</label>
        <select data-k="format">
          ${formats.map(f => `<option ${f===item.props.format?'selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="settings-row">
        <div class="row"><label>Bar width</label>
          <input type="number" min="1" max="${MAX_BARCODE_BAR_WIDTH}" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height</label>
          <input type="number" min="10" max="${DOTS_W * SCALE}" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="row"><label style="display:flex;gap:.4rem;align-items:center;color:var(--text)">
        <input type="checkbox" data-k="displayValue" ${item.props.displayValue?'checked':''} style="width:auto">
        Show value</label></div>`;
  } else if (item.type === 'qr') {
    normalizeQRProps(item.props);
    body.innerHTML = `
      <div class="row"><label>Value</label>
        <textarea rows="3" data-k="value">${escapeHtml(item.props.value)}</textarea></div>
      <div class="settings-row">
        <div class="row"><label>Size (px)</label>
          <input type="number" min="${MIN_QR_SIZE}" max="300" step="${SCALE}" data-k="size" value="${item.props.size}"></div>
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
  } else if (item.type === 'rect') {
    normalizeRectProps(item.props);
    body.innerHTML = `
      <div class="settings-row">
        <div class="row"><label>Width (px)</label>
          <input type="number" min="${MIN_RECT_SIZE}" max="2000" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height (px)</label>
          <input type="number" min="${MIN_RECT_SIZE}" max="${DOTS_W * SCALE}" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="settings-row">
        <div class="row"><label>Stroke (px)</label>
          <input type="number" min="1" max="64" data-k="strokeSize" value="${item.props.strokeSize}"></div>
        <div class="row"><label>Corner radius (px)</label>
          <input type="number" min="0" max="200" data-k="radius" value="${item.props.radius}"></div>
      </div>
      <div class="row"><label style="display:flex;gap:.4rem;align-items:center;color:var(--text)">
        <input type="checkbox" data-k="filled" ${item.props.filled?'checked':''} style="width:auto">
        Fill black</label></div>`;
  } else if (item.type === 'line') {
    normalizeLineProps(item.props);
    body.innerHTML = `
      <div class="settings-row">
        <div class="row"><label>Width (px)</label>
          <input type="number" min="${MIN_LINE_LENGTH}" max="2000" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height (px)</label>
          <input type="number" min="0" max="${DOTS_W * SCALE}" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="row"><label>Stroke (px)</label>
        <input type="number" min="1" max="64" data-k="strokeSize" value="${item.props.strokeSize}"></div>`;
  } else if (item.type === 'circle') {
    normalizeCircleProps(item.props);
    body.innerHTML = `
      <div class="settings-row">
        <div class="row"><label>Width (px)</label>
          <input type="number" min="${MIN_ELLIPSE_SIZE}" max="2000" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height (px)</label>
          <input type="number" min="${MIN_ELLIPSE_SIZE}" max="${DOTS_W * SCALE}" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="settings-row">
        <div class="row"><label>Stroke (px)</label>
          <input type="number" min="1" max="64" data-k="strokeSize" value="${item.props.strokeSize}"></div>
        <div class="row"></div>
      </div>
      <div class="row"><label style="display:flex;gap:.4rem;align-items:center;color:var(--text)">
        <input type="checkbox" data-k="filled" ${item.props.filled?'checked':''} style="width:auto">
        Fill black</label></div>`;
  } else if (item.type === 'image') {
    normalizeImageProps(item.props);
    body.innerHTML = `
      <div class="settings-row">
        <div class="row"><label>Width (px)</label>
          <input type="number" min="${MIN_IMAGE_SIZE}" max="2000" data-k="width" value="${item.props.width}"></div>
        <div class="row"><label>Height (px)</label>
          <input type="number" min="${MIN_IMAGE_SIZE}" max="${DOTS_W * SCALE}" data-k="height" value="${item.props.height}"></div>
      </div>
      <div class="row"><label>Rotation (degrees)</label>
        <input type="number" min="-360" max="360" step="1" data-k="rotation" value="${item.props.rotation}"></div>
      <div class="row"><label style="display:flex;gap:.4rem;align-items:center;color:var(--text)">
        <input type="checkbox" data-k="lockAspect" ${item.props.lockAspect?'checked':''} style="width:auto">
        Preserve aspect ratio</label></div>`;
  }
  body.insertAdjacentHTML('beforeend', `<button class="delete" id="btnDelete">Delete item</button>`);
  body.querySelectorAll('[data-k]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      let v = inp.type === 'checkbox' ? inp.checked
             : inp.type === 'number' ? parseInt(inp.value) || 0
             : inp.value;
      if (item.type === 'image' && item.props.lockAspect && inp.type === 'number' && (k === 'width' || k === 'height')) {
        setImageDimensionPreservingAspect(item.props, k, v);
        renderItem(item);
        renderPanel();
        syncLengthToContent();
        return;
      }
      item.props[k] = v;
      if (item.type === 'barcode' && k === 'width') delete item.props.boxWidth;
      normalizeResizableProps(item);
      renderItem(item);
      syncLengthToContent();
    });
  });
  if (item.type === 'text') setupFontPicker(item);
  const loadSystemFontsBtn = document.getElementById('btnLoadSystemFonts');
  if (loadSystemFontsBtn) loadSystemFontsBtn.addEventListener('click', loadSystemFonts);
  document.getElementById('btnDelete').addEventListener('click', () => removeItem(item.id));
}

function normalizeRectProps(props) {
  props.width = Math.max(MIN_RECT_SIZE, parseInt(props.width) || MIN_RECT_SIZE);
  props.height = Math.max(MIN_RECT_SIZE, parseInt(props.height) || MIN_RECT_SIZE);
  props.strokeSize = Math.max(1, parseInt(props.strokeSize) || 1);
  props.radius = Math.max(0, parseInt(props.radius) || 0);
  props.filled = !!props.filled;
}

function normalizeLineProps(props) {
  props.width = Math.max(MIN_LINE_LENGTH, parseInt(props.width) || MIN_LINE_LENGTH);
  props.height = Math.max(0, parseInt(props.height) || 0);
  props.strokeSize = Math.max(1, parseInt(props.strokeSize) || 1);
}

function normalizeCircleProps(props) {
  const legacySize = parseInt(props.size) || MIN_ELLIPSE_SIZE;
  props.width = Math.max(MIN_ELLIPSE_SIZE, parseInt(props.width) || legacySize);
  props.height = Math.max(MIN_ELLIPSE_SIZE, parseInt(props.height) || legacySize);
  delete props.size;
  props.strokeSize = Math.max(1, parseInt(props.strokeSize) || 1);
  props.filled = !!props.filled;
}

function normalizeImageProps(props) {
  props.width = Math.max(MIN_IMAGE_SIZE, parseInt(props.width) || MIN_IMAGE_SIZE);
  props.height = Math.max(MIN_IMAGE_SIZE, parseInt(props.height) || MIN_IMAGE_SIZE);
  props.rotation = parseFloat(props.rotation) || 0;
  props.lockAspect = props.lockAspect !== false;
}

function imageAspectRatio(props) {
  const natural = props.naturalWidth && props.naturalHeight
    ? props.naturalWidth / props.naturalHeight
    : props.width / props.height;
  return Number.isFinite(natural) && natural > 0 ? natural : 1;
}

function setImageSizePreservingAspect(props, nextWidth, nextHeight, resizeState, maxHeight = Infinity) {
  const widthDelta = Math.abs(nextWidth - resizeState.startWidth);
  const heightDelta = Math.abs(nextHeight - resizeState.startHeight);
  if (heightDelta > widthDelta) {
    setImageDimensionPreservingAspect(props, 'height', Math.min(nextHeight, maxHeight));
    return;
  }
  setImageDimensionPreservingAspect(props, 'width', nextWidth);
  if (props.height > maxHeight) {
    setImageDimensionPreservingAspect(props, 'height', maxHeight);
  }
}

function setImageDimensionPreservingAspect(props, key, value) {
  const ratio = imageAspectRatio(props);
  if (key === 'width') {
    props.width = Math.max(MIN_IMAGE_SIZE, parseInt(value) || MIN_IMAGE_SIZE);
    props.height = Math.max(MIN_IMAGE_SIZE, Math.round(props.width / ratio));
  } else {
    props.height = Math.max(MIN_IMAGE_SIZE, parseInt(value) || MIN_IMAGE_SIZE);
    props.width = Math.max(MIN_IMAGE_SIZE, Math.round(props.height * ratio));
  }
  normalizeImageProps(props);
}

function normalizeResizableProps(item) {
  if (item.type === 'rect') normalizeRectProps(item.props);
  if (item.type === 'line') normalizeLineProps(item.props);
  if (item.type === 'circle') normalizeCircleProps(item.props);
  if (item.type === 'image') normalizeImageProps(item.props);
  if (item.type === 'qr') normalizeQRProps(item.props);
}

function shapeMinSize(item) {
  if (item.type === 'image') return MIN_IMAGE_SIZE;
  return item.type === 'circle' ? MIN_ELLIPSE_SIZE : MIN_RECT_SIZE;
}

function getLineRenderSize(props) {
  return {
    width: Math.max(1, props.width + props.strokeSize),
    height: Math.max(1, props.height + props.strokeSize),
  };
}

function updateLineShape(svg, props) {
  const size = getLineRenderSize(props);
  svg.setAttribute('width', size.width);
  svg.setAttribute('height', size.height);
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.style.width = size.width + 'px';
  svg.style.height = size.height + 'px';

  const line = svg.querySelector('line');
  line.setAttribute('x1', props.strokeSize / 2);
  line.setAttribute('y1', props.strokeSize / 2);
  line.setAttribute('x2', props.width + props.strokeSize / 2);
  line.setAttribute('y2', props.height + props.strokeSize / 2);
  line.setAttribute('stroke', '#000');
  line.setAttribute('stroke-width', props.strokeSize);
  line.setAttribute('stroke-linecap', 'butt');
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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

function imageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    });
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

function scaledImageSize(width, height) {
  const maxWidth = 180;
  const maxHeight = DOTS_W * SCALE - 20;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(MIN_IMAGE_SIZE, Math.round(width * scale)),
    height: Math.max(MIN_IMAGE_SIZE, Math.round(height * scale)),
  };
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
  text: 'Text', font: 'system-ui', size: 200, bold: false, italic: false, underline: false });
document.getElementById('btnAddDate').onclick = () => addItem('text', {
  text: formatCurrentDate(), font: 'system-ui', size: 200, bold: false, italic: false, underline: false });
document.getElementById('btnAddBarcode').onclick = () => addItem('barcode', {
  value: '123456789012', format: 'CODE128', width: 5, height: 200,
  fontSize: MIN_BARCODE_TEXT_SIZE, displayValue: true });
document.getElementById('btnAddQR').onclick = () => addItem('qr', {
  value: 'https://example.com', size: 260, ecl: 'M' });
document.getElementById('btnAddRect').onclick = () => addItem('rect', {
  width: 180, height: 120, strokeSize: 6, radius: 0, filled: false });
document.getElementById('btnAddLine').onclick = () => addItem('line', {
  width: 180, height: 0, strokeSize: 6 });
document.getElementById('btnAddCircle').onclick = () => addItem('circle', {
  width: 120, height: 120, strokeSize: 6, filled: false });
document.getElementById('btnAddImage').onclick = () => imageUpload.click();
imageUpload.addEventListener('change', async () => {
  const file = imageUpload.files?.[0];
  imageUpload.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Please choose an image file', true);
    return;
  }
  try {
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('image could not be read'));
      reader.readAsDataURL(file);
    });
    const natural = await imageDimensions(src);
    const size = scaledImageSize(natural.width, natural.height);
    addItem('image', {
      src,
      width: size.width,
      height: size.height,
      naturalWidth: natural.width,
      naturalHeight: natural.height,
      rotation: 0,
      lockAspect: true,
    });
  } catch (err) {
    toast('Image insert failed: ' + err.message, true);
  }
});
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
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, logical.width, logical.height);
  ctx.save();
  ctx.scale(1 / SCALE, 1 / SCALE);
  for (const item of state.items) {
    const el = itemsEl.querySelector(`[data-id="${item.id}"]`);
    if (!el) continue;
    const { x: dx, y: dy } = getItemPrintOffset(item, el);
    if (item.type === 'text') {
      const c = el.querySelector('canvas');
      if (c) ctx.drawImage(c, dx, dy);
    } else if (item.type === 'icon') {
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'top';
      ctx.font = `400 ${item.props.size}px "Material Icons"`;
      ctx.fillText(materialIconGlyph(item.props.name || 'add'), dx, dy);
    } else if (item.type === 'barcode') {
      const svg = await renderZintSvg(item);
      const s = new XMLSerializer().serializeToString(svg);
      const img = await loadImg('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))));
      ctx.drawImage(img, dx, dy, img.naturalWidth || img.width, img.naturalHeight || img.height);
    } else if (item.type === 'qr') {
      const svg = await renderZintSvg(item);
      const s = new XMLSerializer().serializeToString(svg);
      const img = await loadImg('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))));
      const px = alignToPrinterDot(item.props.size);
      const x = snapToPrinterDot(dx);
      const y = snapToPrinterDot(dy);
      ctx.drawImage(img, x, y, px, px);
    } else if (item.type === 'rect') {
      normalizeRectProps(item.props);
      ctx.save();
      ctx.fillStyle = item.props.filled ? '#000' : '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = item.props.strokeSize;
      const inset = item.props.strokeSize / 2;
      drawRoundedRect(
        ctx,
        dx + inset,
        dy + inset,
        Math.max(1, item.props.width - item.props.strokeSize),
        Math.max(1, item.props.height - item.props.strokeSize),
        Math.max(0, item.props.radius - inset)
      );
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'line') {
      normalizeLineProps(item.props);
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = item.props.strokeSize;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(dx + item.props.strokeSize / 2, dy + item.props.strokeSize / 2);
      ctx.lineTo(
        dx + item.props.width + item.props.strokeSize / 2,
        dy + item.props.height + item.props.strokeSize / 2
      );
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'circle') {
      normalizeCircleProps(item.props);
      ctx.save();
      ctx.fillStyle = item.props.filled ? '#000' : '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = item.props.strokeSize;
      const inset = item.props.strokeSize / 2;
      const rx = Math.max(0.5, (item.props.width - item.props.strokeSize) / 2);
      const ry = Math.max(0.5, (item.props.height - item.props.strokeSize) / 2);
      ctx.beginPath();
      ctx.ellipse(dx + inset + rx, dy + inset + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'image') {
      normalizeImageProps(item.props);
      const img = await loadImg(item.props.src);
      ctx.save();
      ctx.translate(dx + item.props.width / 2, dy + item.props.height / 2);
      ctx.rotate(item.props.rotation * Math.PI / 180);
      ctx.drawImage(
        img,
        -item.props.width / 2,
        -item.props.height / 2,
        item.props.width,
        item.props.height
      );
      ctx.restore();
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
addItem('text', { text: 'Text', font: 'system-ui', size: 200, bold: false, italic: false, underline: false });
renderPanel();
updateBackendUi();
updateWebBluetoothUi();
loadSystemFontsIfAlreadyPermitted();
loadMaterialIconNames();
