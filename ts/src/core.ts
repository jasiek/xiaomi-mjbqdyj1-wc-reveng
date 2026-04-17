import * as wasm from "../../protocol-core/pkg/mjbqdyj1_protocol.js";

export const SERVICE_UUID = "0000fe95-0000-1000-8000-00805f9b34fb";
export const WRITE_UUID = "0000001f-0000-1000-8000-00805f9b34fb";
export const NOTIFY_UUID = "00000020-0000-1000-8000-00805f9b34fb";

export const CRC_SEED = 0x76953521;
export const BLE_CHUNK = 204;
export const PIC_CHUNK_MAX = 1800;

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
  return wasm.wasm_crc32_custom(buf);
}

export function encryptPayload(payload: Uint8Array, _opts: ProtocolOptions = {}): Uint8Array {
  return wasm.wasm_encrypt_payload(payload);
}

export function decryptPayload(ciphertext: Uint8Array, _opts: ProtocolOptions = {}): Uint8Array {
  return wasm.wasm_decrypt_payload(ciphertext);
}

export function frameCommand(payload: Uint8Array, _opts: ProtocolOptions = {}): Uint8Array {
  return wasm.wasm_frame_command(payload);
}

export function unframePacket(wire: Uint8Array, _opts: ProtocolOptions = {}): Uint8Array | null {
  const result = wasm.wasm_unframe_packet(wire);
  return result === undefined ? null : result;
}

export function splitBleChunks(framed: Uint8Array, maxChunkLength = BLE_CHUNK): Uint8Array[] {
  return wasm.wasm_split_ble_chunks(framed, maxChunkLength);
}

export function cmdSetConnected(_opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_set_connected();
}

export function cmdGetBattery(_opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_get_battery();
}

export function cmdQueryStatus(_opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_query_status();
}

export function cmdSyncTime(epochSeconds = Math.floor(Date.now() / 1000), _opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_sync_time(epochSeconds);
}

export function cmdPrintStart(labelLengthDots: number, _opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_print_start(labelLengthDots);
}

export function cmdPrintFinalize(morePages: boolean, _opts?: ProtocolOptions): Uint8Array {
  return wasm.wasm_cmd_print_finalize(morePages);
}

export function cmdPrintDataChunks(raster: Uint8Array, _opts?: ProtocolOptions): Uint8Array[] {
  return wasm.wasm_cmd_print_data_chunks(raster);
}

function wasmStateToTs(w: wasm.WasmPrinterState): Partial<PrinterState> {
  return {
    bufferFree: w.buffer_free,
    coverOpen: w.cover_open,
    lackPaper: w.lack_paper,
    jam: w.jam,
    hot: w.hot,
    noHead: w.no_head,
    highVoltage: w.high_voltage,
    lowVoltage: w.low_voltage,
    printing: w.printing,
    knifeError: w.knife_error,
    fontError: w.font_error,
    psramError: w.psram_error,
    lackPaperCalibration: w.lack_paper_calibration,
    willPowerOff: w.will_power_off,
    powerOffInProgress: w.power_off_in_progress,
    batteryTooHot: w.battery_too_hot,
    batteryBars: w.battery_bars,
    batteryPercent: w.battery_percent,
    printComplete: w.print_complete,
    downloadComplete: w.download_complete,
  };
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

  // Prefer the Rust parser for state patches, but keep event logic here
  // because wasm_parse_notification only returns WasmPrinterState (no events).
  const wasmPatch = wasm.wasm_parse_notification(plain);
  if (wasmPatch !== undefined) {
    parsed.statePatch = wasmStateToTs(wasmPatch);
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
