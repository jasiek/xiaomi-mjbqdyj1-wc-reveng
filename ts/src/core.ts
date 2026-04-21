import { aes128CbcDecrypt, aes128CbcEncryptZeroPadded } from "./aes.ts";

export const SERVICE_UUID = "0000fe95-0000-1000-8000-00805f9b34fb";
export const WRITE_UUID = "0000001f-0000-1000-8000-00805f9b34fb";
export const NOTIFY_UUID = "00000020-0000-1000-8000-00805f9b34fb";

export const CRC_SEED = 0x76953521;
export const BLE_CHUNK = 204;
export const PIC_CHUNK_MAX = 1800;
export const DOWNLOAD_CHUNK_MAX = 1792;
const DEFAULT_KEY = hexToBytes("99B829436CDD5647AADB8816F73E8644");
const DEFAULT_IV = hexToBytes("0001020F3CF899ABABCD25318DF446B1");

export interface ProtocolOptions {
  key?: Uint8Array;
  iv?: Uint8Array;
  crcSeed?: number;
}

export interface PrinterState {
  bufferFree: number;
  coverOpen: boolean;
  lackPaper: boolean;
  jam: boolean;
  hot: boolean;
  noHead: boolean;
  highVoltage: boolean;
  lowVoltage: boolean;
  printing: boolean;
  knifeError: boolean;
  fontError: boolean;
  psramError: boolean;
  lackPaperCalibration: boolean;
  willPowerOff: boolean;
  powerOffInProgress: boolean;
  batteryTooHot: boolean;
  batteryBars: number;
  batteryPercent: number;
  printComplete: boolean;
  downloadComplete: boolean;
}

export interface ParsedNotification {
  marker: number;
  group: number;
  command: number;
  payloadLength: number;
  body: Uint8Array;
  statePatch?: Partial<PrinterState>;
  event?: PrinterEvent;
}

export interface PrinterTransport {
  write(data: Uint8Array): Promise<void>;
  onData(callback: (data: Uint8Array) => void): void;
  close?(): Promise<void>;
}

export type PrinterEvent = "print_complete" | "download_complete";

export function createInitialState(): PrinterState {
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

export function hexToBytes(hex: string): Uint8Array {
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

export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function u16le(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

export function crc32Custom(buf: Uint8Array, _init = CRC_SEED): number {
  let crc = (~_init) >>> 0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = ((crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1) >>> 0;
    }
  }
  return (~crc) >>> 0;
}

export function encryptPayload(payload: Uint8Array, opts: ProtocolOptions = {}): Uint8Array {
  return aes128CbcEncryptZeroPadded(payload, opts.key ?? DEFAULT_KEY, opts.iv ?? DEFAULT_IV);
}

export function decryptPayload(ciphertext: Uint8Array, opts: ProtocolOptions = {}): Uint8Array {
  return aes128CbcDecrypt(ciphertext, opts.key ?? DEFAULT_KEY, opts.iv ?? DEFAULT_IV);
}

export function frameCommand(payload: Uint8Array, opts: ProtocolOptions = {}): Uint8Array {
  const encrypted = encryptPayload(payload, opts);
  return concatBytes(Uint8Array.of(0xa3, 0x20), u16le(encrypted.length), encrypted, u32le(crc32Custom(encrypted, opts.crcSeed)));
}

export function unframePacket(wire: Uint8Array, opts: ProtocolOptions = {}): Uint8Array | null {
  if (wire.length < 8 || wire[0] !== 0xa3 || (wire[1] !== 0x00 && wire[1] !== 0x20)) {
    return null;
  }
  const bodyLength = new DataView(wire.buffer, wire.byteOffset, wire.byteLength).getUint16(2, true);
  if (wire.length < 4 + bodyLength + 4) {
    return null;
  }
  const body = wire.slice(4, 4 + bodyLength);
  const gotCrc = new DataView(wire.buffer, wire.byteOffset, wire.byteLength).getUint32(4 + bodyLength, true);
  if (crc32Custom(body, opts.crcSeed) !== gotCrc) {
    return null;
  }
  return wire[1] === 0x20 ? decryptPayload(body, opts) : body;
}

export function splitBleChunks(framed: Uint8Array, maxChunkLength = BLE_CHUNK): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let off = 0; off < framed.length; off += maxChunkLength) {
    chunks.push(framed.slice(off, off + maxChunkLength));
  }
  return chunks;
}

export function cmdSetConnected(opts?: ProtocolOptions): Uint8Array {
  return frameCommand(hexToBytes("11011E010001"), opts);
}

export function cmdGetBattery(opts?: ProtocolOptions): Uint8Array {
  return frameCommand(hexToBytes("11011A0000"), opts);
}

export function cmdQueryStatus(opts?: ProtocolOptions): Uint8Array {
  return frameCommand(hexToBytes("1101130000"), opts);
}

export function cmdSyncTime(epochSeconds = Math.floor(Date.now() / 1000), opts?: ProtocolOptions): Uint8Array {
  return frameCommand(concatBytes(hexToBytes("1101190400"), u32le(epochSeconds + 28800)), opts);
}

export function cmdPrintStart(labelLengthDots: number, opts?: ProtocolOptions): Uint8Array {
  return frameCommand(concatBytes(hexToBytes("11050B0700"), u16le(96), u16le(labelLengthDots), hexToBytes("010000")), opts);
}

export function cmdPrintFinalize(morePages: boolean, opts?: ProtocolOptions): Uint8Array {
  return frameCommand(concatBytes(hexToBytes("11050C09000102000000020100"), Uint8Array.of(morePages ? 1 : 0)), opts);
}

export function cmdPrintDataChunks(raster: Uint8Array, opts?: ProtocolOptions): Uint8Array[] {
  const total = Math.max(1, Math.ceil(raster.length / PIC_CHUNK_MAX));
  const frames: Uint8Array[] = [];
  for (let i = 0; i < total; i += 1) {
    const chunk = raster.slice(i * PIC_CHUNK_MAX, (i + 1) * PIC_CHUNK_MAX);
    const payloadLength = chunk.length + 11;
    const header = concatBytes(hexToBytes("11050D"), u16le(payloadLength), u16le(i + 1), u16le(total), hexToBytes("100C0000000000"));
    frames.push(frameCommand(concatBytes(header, chunk), opts));
  }
  return frames;
}

export function cmdDownloadStart(data: Uint8Array, labelLengthDots: number, opts?: ProtocolOptions): Uint8Array {
  return frameCommand(
    concatBytes(
      hexToBytes("11020119000102000400020400"),
      u32le(data.length),
      hexToBytes("030000040200"),
      u16le(96),
      hexToBytes("050200"),
      u16le(labelLengthDots)
    ),
    opts
  );
}

export function cmdDownloadDataChunks(data: Uint8Array, opts?: ProtocolOptions): Uint8Array[] {
  const total = Math.max(1, Math.ceil(data.length / DOWNLOAD_CHUNK_MAX));
  const frames: Uint8Array[] = [];
  for (let i = 0; i < total; i += 1) {
    const chunk = data.slice(i * DOWNLOAD_CHUNK_MAX, (i + 1) * DOWNLOAD_CHUNK_MAX);
    const payloadLength = chunk.length + 8;
    const header = concatBytes(
      hexToBytes("110203"),
      u16le(payloadLength),
      u16le(i),
      u16le(chunk.length),
      u32le(i * DOWNLOAD_CHUNK_MAX)
    );
    frames.push(frameCommand(concatBytes(header, chunk), opts));
  }
  return frames;
}

export function cmdDownloadFinalize(opts?: ProtocolOptions): Uint8Array {
  return frameCommand(hexToBytes("1102020000"), opts);
}

function batteryPercentFromStatusPayload(plain: Uint8Array): number {
  if (plain.length < 27) {
    return -1;
  }
  return Number.parseInt(
    plain[25]!.toString(16).padStart(2, "0") + plain[26]!.toString(16).padStart(2, "0"),
    16
  ) / 10;
}

export function parseNotification(plain: Uint8Array): ParsedNotification | null {
  if (plain.length < 5) {
    return null;
  }
  const marker = plain[0]!;
  const group = plain[1]!;
  const command = plain[2]!;
  const payloadLength = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint16(3, true);
  const body = plain.slice(5);
  const parsed: ParsedNotification = { marker, group, command, payloadLength, body };

  if (group === 0x01 && command === 0x1f) {
    const patch: Partial<PrinterState> = {};
    if (plain.length >= 12) {
      patch.bufferFree = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(8, true);
    }
    if (plain.length >= 18) {
      const flagsA = plain[15]!;
      const flagsB = plain[16]!;
      patch.coverOpen = (flagsA & 1) !== 0;
      patch.lackPaper = (flagsA & 2) !== 0;
      patch.jam = (flagsA & 4) !== 0;
      patch.hot = (flagsA & 8) !== 0;
      patch.noHead = (flagsA & 16) !== 0;
      patch.highVoltage = (flagsA & 32) !== 0;
      patch.lowVoltage = (flagsA & 64) !== 0;
      patch.printing = (flagsA & 128) !== 0;
      patch.knifeError = (flagsB & 1) !== 0;
      patch.fontError = (flagsB & 2) !== 0;
      patch.psramError = (flagsB & 4) !== 0;
      patch.lackPaperCalibration = (flagsB & 8) !== 0;
      patch.willPowerOff = (flagsB & 16) !== 0;
      patch.powerOffInProgress = (flagsB & 32) !== 0;
      patch.batteryTooHot = (flagsB & 64) !== 0;
    }
    if (plain.length >= 18) {
      patch.batteryBars = plain[17]!;
    }
    if (plain.length >= 27) {
      patch.batteryPercent = batteryPercentFromStatusPayload(plain);
    }
    parsed.statePatch = patch;
  } else if (group === 0x01 && (command === 0x12 || command === 0x13)) {
    if (plain.length >= 10) {
      const flags = plain[8]!;
      parsed.statePatch = {
        coverOpen: (flags & 1) !== 0,
        lackPaper: (flags & 2) !== 0,
        jam: (flags & 4) !== 0,
        hot: (flags & 8) !== 0,
        printing: (flags & 128) !== 0,
      };
    }
  }

  if (group === 0x05 && command === 0x0c) {
    parsed.event = "print_complete";
    parsed.statePatch = { ...(parsed.statePatch ?? {}), printComplete: true };
  } else if (group === 0x02 && command === 0x02) {
    parsed.event = "download_complete";
    parsed.statePatch = { ...(parsed.statePatch ?? {}), downloadComplete: true };
  }

  return parsed;
}

export function applyStatePatch(state: PrinterState, patch?: Partial<PrinterState>): PrinterState {
  return patch ? { ...state, ...patch } : state;
}

export class NotifyFrameAssembler {
  private chunks = new Uint8Array(0);

  push(data: Uint8Array, _opts?: ProtocolOptions): Uint8Array[] {
    this.chunks = concatBytes(this.chunks, data);
    const frames: Uint8Array[] = [];

    while (this.chunks.length > 0) {
      if (this.chunks[0] !== 0xa3) {
        this.chunks = this.chunks.slice(1);
        continue;
      }
      if (this.chunks.length < 4) {
        break;
      }
      const mode = this.chunks[1];
      if (mode !== 0x00 && mode !== 0x20) {
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
      const plain = unframePacket(framed);
      if (plain !== null) {
        frames.push(plain);
      }
    }
    return frames;
  }
}

export interface PrinterSessionOptions extends ProtocolOptions {
  bleChunkSize?: number;
  writesPerBreather?: number;
  breatherMs?: number;
  bufferThreshold?: number;
  statusPollMs?: number;
}

export class PrinterSession {
  readonly transport: PrinterTransport;
  readonly assembler = new NotifyFrameAssembler();
  state = createInitialState();

  private readonly bleChunkSize: number;
  private readonly writesPerBreather: number;
  private readonly breatherMs: number;
  private readonly bufferThreshold: number;
  private readonly statusPollMs: number;
  private logicalWritesSinceBreather = 0;
  private readonly protocolOptions: ProtocolOptions;
  private readonly eventWaiters = new Map<PrinterEvent, Array<() => void>>();

  constructor(transport: PrinterTransport, options: PrinterSessionOptions = {}) {
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

  async initialize(epochSeconds = Math.floor(Date.now() / 1000)): Promise<void> {
    await this.sendLogicalFrame(cmdSetConnected(this.protocolOptions));
    await this.sendLogicalFrame(cmdGetBattery(this.protocolOptions));
    await this.sendLogicalFrame(cmdQueryStatus(this.protocolOptions));
    await this.sendLogicalFrame(cmdSyncTime(epochSeconds, this.protocolOptions));
  }

  async sendLogicalFrame(frame: Uint8Array): Promise<void> {
    for (const chunk of splitBleChunks(frame, this.bleChunkSize)) {
      await this.transport.write(chunk);
    }
    this.logicalWritesSinceBreather += 1;
    if (this.logicalWritesSinceBreather >= this.writesPerBreather) {
      await sleep(this.breatherMs);
      this.logicalWritesSinceBreather = 0;
    }
  }

  async waitForBuffer(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.state.bufferFree < this.bufferThreshold) {
      if (Date.now() > deadline) {
        throw new Error("printer buffer never drained");
      }
      await this.sendLogicalFrame(cmdQueryStatus(this.protocolOptions));
      await sleep(this.statusPollMs);
    }
  }

  async printRaster(raster: Uint8Array, labelLengthDots: number, morePages = false): Promise<void> {
    this.state = { ...this.state, printComplete: false };
    this.logicalWritesSinceBreather = 0;
    await this.sendLogicalFrame(cmdPrintStart(labelLengthDots, this.protocolOptions));
    for (const frame of cmdPrintDataChunks(raster, this.protocolOptions)) {
      await this.waitForBuffer();
      await this.sendLogicalFrame(frame);
    }
    await this.sendLogicalFrame(cmdPrintFinalize(morePages, this.protocolOptions));
    await this.waitForEvent("print_complete", 60_000);
  }

  async downloadRaster(raster: Uint8Array, labelLengthDots: number): Promise<void> {
    this.state = { ...this.state, downloadComplete: false };
    this.logicalWritesSinceBreather = 0;
    await this.sendLogicalFrame(cmdDownloadStart(raster, labelLengthDots, this.protocolOptions));
    for (const frame of cmdDownloadDataChunks(raster, this.protocolOptions)) {
      await this.waitForBuffer();
      await this.sendLogicalFrame(frame);
    }
    await this.sendLogicalFrame(cmdDownloadFinalize(this.protocolOptions));
    await this.waitForEvent("download_complete", 60_000);
  }

  async waitForEvent(event: PrinterEvent, timeoutMs: number): Promise<void> {
    if ((event === "print_complete" && this.state.printComplete) || (event === "download_complete" && this.state.downloadComplete)) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      let onResolve: (() => void) | undefined;
      const timeout = setTimeout(() => {
        const waiters = this.eventWaiters.get(event);
        if (waiters && onResolve) {
          this.eventWaiters.set(event, waiters.filter((waiter) => waiter !== onResolve));
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

  private resolveEvent(event: PrinterEvent): void {
    const waiters = this.eventWaiters.get(event) ?? [];
    this.eventWaiters.delete(event);
    for (const waiter of waiters) {
      waiter();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
