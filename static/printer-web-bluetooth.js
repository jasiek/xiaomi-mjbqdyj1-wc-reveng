// src/aes.ts
var AES_BLOCK_SIZE = 16;
var NB = 4;
var NK = 4;
var NR = 10;
var SBOX = new Uint8Array([
  99,
  124,
  119,
  123,
  242,
  107,
  111,
  197,
  48,
  1,
  103,
  43,
  254,
  215,
  171,
  118,
  202,
  130,
  201,
  125,
  250,
  89,
  71,
  240,
  173,
  212,
  162,
  175,
  156,
  164,
  114,
  192,
  183,
  253,
  147,
  38,
  54,
  63,
  247,
  204,
  52,
  165,
  229,
  241,
  113,
  216,
  49,
  21,
  4,
  199,
  35,
  195,
  24,
  150,
  5,
  154,
  7,
  18,
  128,
  226,
  235,
  39,
  178,
  117,
  9,
  131,
  44,
  26,
  27,
  110,
  90,
  160,
  82,
  59,
  214,
  179,
  41,
  227,
  47,
  132,
  83,
  209,
  0,
  237,
  32,
  252,
  177,
  91,
  106,
  203,
  190,
  57,
  74,
  76,
  88,
  207,
  208,
  239,
  170,
  251,
  67,
  77,
  51,
  133,
  69,
  249,
  2,
  127,
  80,
  60,
  159,
  168,
  81,
  163,
  64,
  143,
  146,
  157,
  56,
  245,
  188,
  182,
  218,
  33,
  16,
  255,
  243,
  210,
  205,
  12,
  19,
  236,
  95,
  151,
  68,
  23,
  196,
  167,
  126,
  61,
  100,
  93,
  25,
  115,
  96,
  129,
  79,
  220,
  34,
  42,
  144,
  136,
  70,
  238,
  184,
  20,
  222,
  94,
  11,
  219,
  224,
  50,
  58,
  10,
  73,
  6,
  36,
  92,
  194,
  211,
  172,
  98,
  145,
  149,
  228,
  121,
  231,
  200,
  55,
  109,
  141,
  213,
  78,
  169,
  108,
  86,
  244,
  234,
  101,
  122,
  174,
  8,
  186,
  120,
  37,
  46,
  28,
  166,
  180,
  198,
  232,
  221,
  116,
  31,
  75,
  189,
  139,
  138,
  112,
  62,
  181,
  102,
  72,
  3,
  246,
  14,
  97,
  53,
  87,
  185,
  134,
  193,
  29,
  158,
  225,
  248,
  152,
  17,
  105,
  217,
  142,
  148,
  155,
  30,
  135,
  233,
  206,
  85,
  40,
  223,
  140,
  161,
  137,
  13,
  191,
  230,
  66,
  104,
  65,
  153,
  45,
  15,
  176,
  84,
  187,
  22
]);
var INV_SBOX = new Uint8Array([
  82,
  9,
  106,
  213,
  48,
  54,
  165,
  56,
  191,
  64,
  163,
  158,
  129,
  243,
  215,
  251,
  124,
  227,
  57,
  130,
  155,
  47,
  255,
  135,
  52,
  142,
  67,
  68,
  196,
  222,
  233,
  203,
  84,
  123,
  148,
  50,
  166,
  194,
  35,
  61,
  238,
  76,
  149,
  11,
  66,
  250,
  195,
  78,
  8,
  46,
  161,
  102,
  40,
  217,
  36,
  178,
  118,
  91,
  162,
  73,
  109,
  139,
  209,
  37,
  114,
  248,
  246,
  100,
  134,
  104,
  152,
  22,
  212,
  164,
  92,
  204,
  93,
  101,
  182,
  146,
  108,
  112,
  72,
  80,
  253,
  237,
  185,
  218,
  94,
  21,
  70,
  87,
  167,
  141,
  157,
  132,
  144,
  216,
  171,
  0,
  140,
  188,
  211,
  10,
  247,
  228,
  88,
  5,
  184,
  179,
  69,
  6,
  208,
  44,
  30,
  143,
  202,
  63,
  15,
  2,
  193,
  175,
  189,
  3,
  1,
  19,
  138,
  107,
  58,
  145,
  17,
  65,
  79,
  103,
  220,
  234,
  151,
  242,
  207,
  206,
  240,
  180,
  230,
  115,
  150,
  172,
  116,
  34,
  231,
  173,
  53,
  133,
  226,
  249,
  55,
  232,
  28,
  117,
  223,
  110,
  71,
  241,
  26,
  113,
  29,
  41,
  197,
  137,
  111,
  183,
  98,
  14,
  170,
  24,
  190,
  27,
  252,
  86,
  62,
  75,
  198,
  210,
  121,
  32,
  154,
  219,
  192,
  254,
  120,
  205,
  90,
  244,
  31,
  221,
  168,
  51,
  136,
  7,
  199,
  49,
  177,
  18,
  16,
  89,
  39,
  128,
  236,
  95,
  96,
  81,
  127,
  169,
  25,
  181,
  74,
  13,
  45,
  229,
  122,
  159,
  147,
  201,
  156,
  239,
  160,
  224,
  59,
  77,
  174,
  42,
  245,
  176,
  200,
  235,
  187,
  60,
  131,
  83,
  153,
  97,
  23,
  43,
  4,
  126,
  186,
  119,
  214,
  38,
  225,
  105,
  20,
  99,
  85,
  33,
  12,
  125
]);
var RCON = new Uint8Array([0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54]);
function xtime(x) {
  return (x << 1 ^ ((x & 128) !== 0 ? 27 : 0)) & 255;
}
function mul(a, b) {
  let result = 0;
  let aa = a;
  let bb = b;
  while (bb > 0) {
    if ((bb & 1) !== 0) {
      result ^= aa;
    }
    aa = xtime(aa);
    bb >>= 1;
  }
  return result & 255;
}
function subWord(word) {
  return Uint8Array.from(word, (b) => SBOX[b]);
}
function rotWord(word) {
  return Uint8Array.of(word[1], word[2], word[3], word[0]);
}
function expandKey(key) {
  if (key.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES-128 requires a 16-byte key, got ${key.length}`);
  }
  const expanded = new Uint8Array(AES_BLOCK_SIZE * (NR + 1));
  expanded.set(key);
  const temp = new Uint8Array(4);
  let i = NK;
  while (i < NB * (NR + 1)) {
    temp.set(expanded.slice((i - 1) * 4, i * 4));
    if (i % NK === 0) {
      temp.set(subWord(rotWord(temp)));
      temp[0] ^= RCON[i / NK];
    }
    for (let j = 0; j < 4; j += 1) {
      expanded[i * 4 + j] = expanded[(i - NK) * 4 + j] ^ temp[j];
    }
    i += 1;
  }
  return expanded;
}
function addRoundKey(state, roundKey) {
  for (let i = 0; i < AES_BLOCK_SIZE; i += 1) {
    state[i] ^= roundKey[i];
  }
}
function subBytes(state) {
  for (let i = 0; i < AES_BLOCK_SIZE; i += 1) {
    state[i] = SBOX[state[i]];
  }
}
function invSubBytes(state) {
  for (let i = 0; i < AES_BLOCK_SIZE; i += 1) {
    state[i] = INV_SBOX[state[i]];
  }
}
function shiftRows(state) {
  const t = state.slice();
  state[1] = t[5];
  state[5] = t[9];
  state[9] = t[13];
  state[13] = t[1];
  state[2] = t[10];
  state[6] = t[14];
  state[10] = t[2];
  state[14] = t[6];
  state[3] = t[15];
  state[7] = t[3];
  state[11] = t[7];
  state[15] = t[11];
}
function invShiftRows(state) {
  const t = state.slice();
  state[1] = t[13];
  state[5] = t[1];
  state[9] = t[5];
  state[13] = t[9];
  state[2] = t[10];
  state[6] = t[14];
  state[10] = t[2];
  state[14] = t[6];
  state[3] = t[7];
  state[7] = t[11];
  state[11] = t[15];
  state[15] = t[3];
}
function mixColumns(state) {
  for (let c = 0; c < 4; c += 1) {
    const i = c * 4;
    const s0 = state[i];
    const s1 = state[i + 1];
    const s2 = state[i + 2];
    const s3 = state[i + 3];
    state[i] = (mul(s0, 2) ^ mul(s1, 3) ^ s2 ^ s3) & 255;
    state[i + 1] = (s0 ^ mul(s1, 2) ^ mul(s2, 3) ^ s3) & 255;
    state[i + 2] = (s0 ^ s1 ^ mul(s2, 2) ^ mul(s3, 3)) & 255;
    state[i + 3] = (mul(s0, 3) ^ s1 ^ s2 ^ mul(s3, 2)) & 255;
  }
}
function invMixColumns(state) {
  for (let c = 0; c < 4; c += 1) {
    const i = c * 4;
    const s0 = state[i];
    const s1 = state[i + 1];
    const s2 = state[i + 2];
    const s3 = state[i + 3];
    state[i] = (mul(s0, 14) ^ mul(s1, 11) ^ mul(s2, 13) ^ mul(s3, 9)) & 255;
    state[i + 1] = (mul(s0, 9) ^ mul(s1, 14) ^ mul(s2, 11) ^ mul(s3, 13)) & 255;
    state[i + 2] = (mul(s0, 13) ^ mul(s1, 9) ^ mul(s2, 14) ^ mul(s3, 11)) & 255;
    state[i + 3] = (mul(s0, 11) ^ mul(s1, 13) ^ mul(s2, 9) ^ mul(s3, 14)) & 255;
  }
}
function encryptBlock(block, expandedKey) {
  const state = block.slice();
  addRoundKey(state, expandedKey.slice(0, AES_BLOCK_SIZE));
  for (let round = 1; round < NR; round += 1) {
    subBytes(state);
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, expandedKey.slice(round * AES_BLOCK_SIZE, (round + 1) * AES_BLOCK_SIZE));
  }
  subBytes(state);
  shiftRows(state);
  addRoundKey(state, expandedKey.slice(NR * AES_BLOCK_SIZE, (NR + 1) * AES_BLOCK_SIZE));
  return state;
}
function decryptBlock(block, expandedKey) {
  const state = block.slice();
  addRoundKey(state, expandedKey.slice(NR * AES_BLOCK_SIZE, (NR + 1) * AES_BLOCK_SIZE));
  for (let round = NR - 1; round > 0; round -= 1) {
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, expandedKey.slice(round * AES_BLOCK_SIZE, (round + 1) * AES_BLOCK_SIZE));
    invMixColumns(state);
  }
  invShiftRows(state);
  invSubBytes(state);
  addRoundKey(state, expandedKey.slice(0, AES_BLOCK_SIZE));
  return state;
}
function zeroPad(data) {
  if (data.length % AES_BLOCK_SIZE === 0) {
    return data.slice();
  }
  const out = new Uint8Array(data.length + (AES_BLOCK_SIZE - data.length % AES_BLOCK_SIZE));
  out.set(data);
  return out;
}
function aes128CbcEncryptZeroPadded(plaintext, key, iv) {
  if (iv.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES-CBC requires a 16-byte IV, got ${iv.length}`);
  }
  const expandedKey = expandKey(key);
  const padded = zeroPad(plaintext);
  const out = new Uint8Array(padded.length);
  let prev = iv.slice();
  for (let off = 0; off < padded.length; off += AES_BLOCK_SIZE) {
    const block = padded.slice(off, off + AES_BLOCK_SIZE);
    for (let i = 0; i < AES_BLOCK_SIZE; i += 1) {
      block[i] ^= prev[i];
    }
    const encrypted = encryptBlock(block, expandedKey);
    out.set(encrypted, off);
    prev = encrypted;
  }
  return out;
}
function aes128CbcDecrypt(ciphertext, key, iv) {
  if (iv.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES-CBC requires a 16-byte IV, got ${iv.length}`);
  }
  if (ciphertext.length % AES_BLOCK_SIZE !== 0) {
    throw new Error(`Ciphertext length must be a multiple of 16, got ${ciphertext.length}`);
  }
  const expandedKey = expandKey(key);
  const out = new Uint8Array(ciphertext.length);
  let prev = iv.slice();
  for (let off = 0; off < ciphertext.length; off += AES_BLOCK_SIZE) {
    const block = ciphertext.slice(off, off + AES_BLOCK_SIZE);
    const decrypted = decryptBlock(block, expandedKey);
    for (let i = 0; i < AES_BLOCK_SIZE; i += 1) {
      out[off + i] = decrypted[i] ^ prev[i];
    }
    prev = block;
  }
  return out;
}

// src/core.ts
var SERVICE_UUID = "0000fe95-0000-1000-8000-00805f9b34fb";
var WRITE_UUID = "0000001f-0000-1000-8000-00805f9b34fb";
var NOTIFY_UUID = "00000020-0000-1000-8000-00805f9b34fb";
var KEY = hexToBytes("99B829436CDD5647AADB8816F73E8644");
var IV = hexToBytes("0001020F3CF899ABABCD25318DF446B1");
var CRC_SEED = 1989489953;
var BLE_CHUNK = 204;
var PIC_CHUNK_MAX = 1800;
var CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let i = 0; i < 8; i += 1) {
    c = (c & 1) !== 0 ? (c >>> 1 ^ 3988292384) >>> 0 : c >>> 1 >>> 0;
  }
  CRC_TABLE[n] = c >>> 0;
}
function createInitialState() {
  return {
    bufferFree: 16384,
    coverOpen: false,
    lackPaper: false,
    jam: false,
    hot: false,
    noHead: false,
    highVoltage: false,
    lowVoltage: false,
    printing: false,
    knifeError: false,
    fontError: false,
    psramError: false,
    lackPaperCalibration: false,
    willPowerOff: false,
    powerOffInProgress: false,
    batteryTooHot: false,
    batteryBars: -1,
    batteryPercent: -1,
    printComplete: false,
    downloadComplete: false
  };
}
function hexToBytes(hex) {
  const normalized = hex.replaceAll(/\s+/g, "");
  if (normalized.length % 2 !== 0) {
    throw new Error(`Hex string must have even length, got ${normalized.length}`);
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    out[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return out;
}
function u16le(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}
function u32le(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}
function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}
function crc32Custom(buf, init = CRC_SEED) {
  let crc = ~init >>> 0;
  for (const byte of buf) {
    crc = (CRC_TABLE[(crc ^ byte) & 255] ^ crc >>> 8) >>> 0;
  }
  return ~crc >>> 0;
}
function encryptPayload(payload, opts = {}) {
  return aes128CbcEncryptZeroPadded(payload, opts.key ?? KEY, opts.iv ?? IV);
}
function decryptPayload(ciphertext, opts = {}) {
  return aes128CbcDecrypt(ciphertext, opts.key ?? KEY, opts.iv ?? IV);
}
function frameCommand(payload, opts = {}) {
  const encrypted = encryptPayload(payload, opts);
  return concatBytes(
    Uint8Array.of(163, 32),
    u16le(encrypted.length),
    encrypted,
    u32le(crc32Custom(encrypted, opts.crcSeed ?? CRC_SEED))
  );
}
function unframePacket(wire, opts = {}) {
  if (wire.length < 8 || wire[0] !== 163) {
    return null;
  }
  const mode = wire[1];
  if (mode !== 32 && mode !== 0) {
    return null;
  }
  const bodyLength = new DataView(wire.buffer, wire.byteOffset, wire.byteLength).getUint16(2, true);
  if (wire.length < 4 + bodyLength + 4) {
    return null;
  }
  const body = wire.slice(4, 4 + bodyLength);
  const gotCrc = new DataView(wire.buffer, wire.byteOffset, wire.byteLength).getUint32(4 + bodyLength, true);
  if (gotCrc !== crc32Custom(body, opts.crcSeed ?? CRC_SEED)) {
    return null;
  }
  return mode === 32 ? decryptPayload(body, opts) : body;
}
function splitBleChunks(framed, maxChunkLength = BLE_CHUNK) {
  const chunks = [];
  for (let off = 0; off < framed.length; off += maxChunkLength) {
    chunks.push(framed.slice(off, off + maxChunkLength));
  }
  return chunks;
}
function cmdSetConnected(opts) {
  return frameCommand(hexToBytes("11011E010001"), opts);
}
function cmdGetBattery(opts) {
  return frameCommand(hexToBytes("11010E0000"), opts);
}
function cmdQueryStatus(opts) {
  return frameCommand(hexToBytes("1101130000"), opts);
}
function cmdSyncTime(epochSeconds = Math.floor(Date.now() / 1e3), opts) {
  return frameCommand(concatBytes(hexToBytes("1101190400"), u32le(epochSeconds + 28800)), opts);
}
function cmdPrintStart(labelLengthDots, opts) {
  return frameCommand(
    concatBytes(hexToBytes("11050B0700"), u16le(96), u16le(labelLengthDots), hexToBytes("010000")),
    opts
  );
}
function cmdPrintFinalize(morePages, opts) {
  return frameCommand(
    Uint8Array.of(17, 5, 12, 9, 0, 1, 2, 0, 0, 0, 2, 1, 0, morePages ? 1 : 0),
    opts
  );
}
function cmdPrintDataChunks(raster, opts) {
  const frames = [];
  const chunkCount = Math.max(1, Math.ceil(raster.length / PIC_CHUNK_MAX));
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const chunk = raster.slice(chunkIndex * PIC_CHUNK_MAX, (chunkIndex + 1) * PIC_CHUNK_MAX);
    const totalLength = chunk.length + 11;
    const body = concatBytes(
      hexToBytes("11050D"),
      u16le(totalLength),
      u16le(chunkIndex + 1),
      u16le(chunkCount),
      hexToBytes("100C0000000000"),
      chunk
    );
    frames.push(frameCommand(body, opts));
  }
  return frames;
}
function batteryPercentFromStatusPayload(plain) {
  if (plain.length < 27) {
    return -1;
  }
  return Number.parseInt(
    plain[25].toString(16).padStart(2, "0") + plain[26].toString(16).padStart(2, "0"),
    16
  ) / 10;
}
function parseNotification(plain) {
  if (plain.length < 5) {
    return null;
  }
  const marker = plain[0];
  const group = plain[1];
  const command = plain[2];
  const payloadLength = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint16(3, true);
  const body = plain.slice(5);
  const parsed = { marker, group, command, payloadLength, body };
  if (group === 1 && command === 31) {
    const patch = {};
    if (plain.length >= 16) {
      patch.bufferFree = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(8, true);
    }
    if (plain.length >= 20) {
      const flagsA = plain[15];
      patch.coverOpen = (flagsA & 1) !== 0;
      patch.lackPaper = (flagsA & 2) !== 0;
      patch.jam = (flagsA & 4) !== 0;
      patch.hot = (flagsA & 8) !== 0;
      patch.noHead = (flagsA & 16) !== 0;
      patch.highVoltage = (flagsA & 32) !== 0;
      patch.lowVoltage = (flagsA & 64) !== 0;
      patch.printing = (flagsA & 128) !== 0;
    }
    if (plain.length >= 21) {
      const flagsB = plain[16];
      patch.knifeError = (flagsB & 1) !== 0;
      patch.fontError = (flagsB & 2) !== 0;
      patch.psramError = (flagsB & 4) !== 0;
      patch.lackPaperCalibration = (flagsB & 8) !== 0;
      patch.willPowerOff = (flagsB & 16) !== 0;
      patch.powerOffInProgress = (flagsB & 32) !== 0;
      patch.batteryTooHot = (flagsB & 64) !== 0;
    }
    if (plain.length >= 22) {
      patch.batteryBars = plain[17];
    }
    const batteryPercent = batteryPercentFromStatusPayload(plain);
    if (batteryPercent >= 0) {
      patch.batteryPercent = batteryPercent;
    }
    parsed.statePatch = patch;
  } else if (group === 1 && (command === 14 || command === 15)) {
    const patch = {};
    if (plain.length >= 23) {
      patch.batteryPercent = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint16(17, true) / 10;
    }
    parsed.statePatch = patch;
  } else if (group === 5 && command === 12) {
    parsed.event = "print_complete";
    parsed.statePatch = { printComplete: true };
  } else if (group === 2 && command === 2) {
    parsed.event = "download_complete";
    parsed.statePatch = { downloadComplete: true };
  }
  return parsed;
}
function applyStatePatch(state, patch) {
  return patch ? { ...state, ...patch } : state;
}
var NotifyFrameAssembler = class {
  chunks = new Uint8Array(0);
  push(data, opts) {
    this.chunks = concatBytes(this.chunks, data);
    const frames = [];
    while (this.chunks.length > 0) {
      if (this.chunks[0] !== 163) {
        this.chunks = this.chunks.slice(1);
        continue;
      }
      if (this.chunks.length < 4) {
        break;
      }
      const mode = this.chunks[1];
      if (mode !== 0 && mode !== 32) {
        this.chunks = this.chunks.slice(1);
        continue;
      }
      const bodyLength = new DataView(this.chunks.buffer, this.chunks.byteOffset, this.chunks.byteLength).getUint16(2, true);
      const totalLength = 4 + bodyLength + 4;
      if (this.chunks.length < totalLength) {
        break;
      }
      const framed = this.chunks.slice(0, totalLength);
      this.chunks = this.chunks.slice(totalLength);
      const plain = unframePacket(framed, opts);
      if (plain !== null) {
        frames.push(plain);
      }
    }
    return frames;
  }
};
var PrinterSession = class {
  transport;
  assembler = new NotifyFrameAssembler();
  state = createInitialState();
  bleChunkSize;
  writesPerBreather;
  breatherMs;
  bufferThreshold;
  statusPollMs;
  logicalWritesSinceBreather = 0;
  protocolOptions;
  eventWaiters = /* @__PURE__ */ new Map();
  constructor(transport, options = {}) {
    this.transport = transport;
    this.protocolOptions = options;
    this.bleChunkSize = options.bleChunkSize ?? BLE_CHUNK;
    this.writesPerBreather = options.writesPerBreather ?? 3;
    this.breatherMs = options.breatherMs ?? 90;
    this.bufferThreshold = options.bufferThreshold ?? 500;
    this.statusPollMs = options.statusPollMs ?? 500;
    this.transport.onData((data) => {
      for (const plain of this.assembler.push(data, this.protocolOptions)) {
        const parsed = parseNotification(plain);
        if (parsed?.statePatch) {
          this.state = applyStatePatch(this.state, parsed.statePatch);
        }
        if (parsed?.event) {
          this.resolveEvent(parsed.event);
        }
      }
    });
  }
  async initialize(epochSeconds = Math.floor(Date.now() / 1e3)) {
    await this.sendLogicalFrame(cmdSetConnected(this.protocolOptions));
    await this.sendLogicalFrame(cmdGetBattery(this.protocolOptions));
    await this.sendLogicalFrame(cmdQueryStatus(this.protocolOptions));
    await this.sendLogicalFrame(cmdSyncTime(epochSeconds, this.protocolOptions));
  }
  async sendLogicalFrame(frame) {
    for (const chunk of splitBleChunks(frame, this.bleChunkSize)) {
      await this.transport.write(chunk);
    }
    this.logicalWritesSinceBreather += 1;
    if (this.logicalWritesSinceBreather >= this.writesPerBreather) {
      await sleep(this.breatherMs);
      this.logicalWritesSinceBreather = 0;
    }
  }
  async waitForBuffer(timeoutMs = 3e4) {
    const deadline = Date.now() + timeoutMs;
    while (this.state.bufferFree < this.bufferThreshold) {
      if (Date.now() > deadline) {
        throw new Error("printer buffer never drained");
      }
      await this.sendLogicalFrame(cmdQueryStatus(this.protocolOptions));
      await sleep(this.statusPollMs);
    }
  }
  async printRaster(raster, labelLengthDots, morePages = false) {
    this.state = { ...this.state, printComplete: false };
    this.logicalWritesSinceBreather = 0;
    await this.sendLogicalFrame(cmdPrintStart(labelLengthDots, this.protocolOptions));
    for (const frame of cmdPrintDataChunks(raster, this.protocolOptions)) {
      await this.waitForBuffer();
      await this.sendLogicalFrame(frame);
    }
    await this.sendLogicalFrame(cmdPrintFinalize(morePages, this.protocolOptions));
    await this.waitForEvent("print_complete", 6e4);
  }
  async waitForEvent(event, timeoutMs) {
    if (event === "print_complete" && this.state.printComplete || event === "download_complete" && this.state.downloadComplete) {
      return;
    }
    await new Promise((resolve, reject) => {
      let onResolve;
      const timeout = setTimeout(() => {
        const waiters2 = this.eventWaiters.get(event);
        if (waiters2 && onResolve) {
          this.eventWaiters.set(event, waiters2.filter((waiter) => waiter !== onResolve));
        }
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);
      onResolve = () => {
        clearTimeout(timeout);
        resolve();
      };
      const waiters = this.eventWaiters.get(event) ?? [];
      waiters.push(onResolve);
      this.eventWaiters.set(event, waiters);
    });
  }
  resolveEvent(event) {
    const waiters = this.eventWaiters.get(event) ?? [];
    this.eventWaiters.delete(event);
    for (const waiter of waiters) {
      waiter();
    }
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/image.ts
function packMonochromeRows(pixels, widthDots, heightDots, bytesPerPixel) {
  if (widthDots % 8 !== 0) {
    throw new Error(`Printer width must be divisible by 8, got ${widthDots}`);
  }
  const bytesPerRow = widthDots / 8;
  const out = new Uint8Array(bytesPerRow * heightDots);
  for (let y = 0; y < heightDots; y += 1) {
    for (let x = 0; x < widthDots; x += 1) {
      const pixel = pixels[(y * widthDots + x) * bytesPerPixel];
      if (pixel < 128) {
        out[y * bytesPerRow + (x >> 3)] |= 128 >> (x & 7);
      }
    }
  }
  return { raster: out, heightDots, widthDots };
}

// src/browser-ble.ts
var WebBluetoothPrinterTransport = class _WebBluetoothPrinterTransport {
  constructor(device, server, writeCharacteristic, notifyCharacteristic) {
    this.device = device;
    this.server = server;
    this.writeCharacteristic = writeCharacteristic;
    this.notifyCharacteristic = notifyCharacteristic;
  }
  device;
  server;
  writeCharacteristic;
  notifyCharacteristic;
  notifyCallback = null;
  static isSupported() {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }
  static async requestAndConnect() {
    if (!this.isSupported()) {
      throw new Error("WebBluetooth is not available in this browser. Use Chrome or Edge on HTTPS or localhost.");
    }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("Could not open printer GATT connection");
    }
    const service = await server.getPrimaryService(SERVICE_UUID);
    const writeCharacteristic = await service.getCharacteristic(WRITE_UUID);
    const notifyCharacteristic = await service.getCharacteristic(NOTIFY_UUID);
    const transport = new _WebBluetoothPrinterTransport(device, server, writeCharacteristic, notifyCharacteristic);
    await transport.startNotifications();
    return transport;
  }
  onData(callback) {
    this.notifyCallback = callback;
  }
  async write(data) {
    if ("writeValueWithoutResponse" in this.writeCharacteristic) {
      await this.writeCharacteristic.writeValueWithoutResponse(data);
      return;
    }
    await this.writeCharacteristic.writeValue(data);
  }
  async close() {
    try {
      await this.notifyCharacteristic.stopNotifications();
    } catch {
    }
    this.notifyCharacteristic.removeEventListener("characteristicvaluechanged", this.onNotify);
    if (this.server.connected) {
      this.device.gatt?.disconnect();
    }
  }
  async startNotifications() {
    this.notifyCharacteristic.addEventListener("characteristicvaluechanged", this.onNotify);
    await this.notifyCharacteristic.startNotifications();
  }
  onNotify = (event) => {
    const value = event.target?.value;
    if (!value || !this.notifyCallback) {
      return;
    }
    this.notifyCallback(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)));
  };
};

// src/browser.ts
var WebBluetoothPrinter = class {
  constructor(session, transport) {
    this.session = session;
    this.transport = transport;
  }
  session;
  transport;
  get deviceName() {
    return this.transport.device.name ?? this.transport.device.id;
  }
  get state() {
    return this.session.state;
  }
  async printCanvas(canvas, morePages = false) {
    const image = canvasToRaster(canvas);
    await this.session.printRaster(image.raster, image.heightDots, morePages);
  }
  async disconnect() {
    await this.transport.close();
  }
};
async function connectWebBluetoothPrinter() {
  const transport = await WebBluetoothPrinterTransport.requestAndConnect();
  const session = new PrinterSession(transport);
  await session.initialize();
  return new WebBluetoothPrinter(session, transport);
}
function webBluetoothSupported() {
  return WebBluetoothPrinterTransport.isSupported();
}
function canvasToRaster(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return packMonochromeRows(image.data, canvas.width, canvas.height, 4);
}
export {
  WebBluetoothPrinter,
  WebBluetoothPrinterTransport,
  canvasToRaster,
  connectWebBluetoothPrinter,
  webBluetoothSupported
};
