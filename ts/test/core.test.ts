import test from "node:test";
import assert from "node:assert/strict";

import {
  NotifyFrameAssembler,
  applyStatePatch,
  cmdPrintDataChunks,
  cmdPrintStart,
  cmdQueryStatus,
  cmdSetConnected,
  cmdSyncTime,
  crc32Custom,
  createInitialState,
  frameCommand,
  hexToBytes,
  parseNotification,
  splitBleChunks,
  unframePacket
} from "../src/index.ts";

test("crc32 seed matches findings", () => {
  assert.equal(crc32Custom(new Uint8Array()), 0x76953521);
});

test("frame round-trip", () => {
  const payload = hexToBytes("11011E010001");
  const framed = frameCommand(payload);
  assert.equal(framed[0], 0xa3);
  assert.equal(framed[1], 0x20);
  const inner = unframePacket(framed);
  assert.ok(inner);
  assert.equal(Buffer.from(inner!).subarray(0, payload.length).toString("hex"), Buffer.from(payload).toString("hex"));
});

test("command builders use little-endian numeric fields", () => {
  const setConnected = unframePacket(cmdSetConnected());
  assert.equal(Buffer.from(setConnected!.subarray(0, 6)).toString("hex"), "11011e010001");

  const status = unframePacket(cmdQueryStatus());
  assert.equal(Buffer.from(status!.subarray(0, 5)).toString("hex"), "1101130000");

  const sync = unframePacket(cmdSyncTime(0));
  assert.equal(Buffer.from(sync!.subarray(0, 5)).toString("hex"), "1101190400");
  assert.equal(new DataView(sync!.buffer, sync!.byteOffset, sync!.byteLength).getUint32(5, true), 28800);

  const start = unframePacket(cmdPrintStart(320));
  assert.equal(Buffer.from(start!.subarray(0, 5)).toString("hex"), "11050b0700");
  assert.equal(new DataView(start!.buffer, start!.byteOffset, start!.byteLength).getUint16(5, true), 96);
  assert.equal(new DataView(start!.buffer, start!.byteOffset, start!.byteLength).getUint16(7, true), 320);
});

test("print data chunking", () => {
  const small = cmdPrintDataChunks(Uint8Array.from({ length: 100 }, (_, i) => i));
  assert.equal(small.length, 1);
  const plainSmall = unframePacket(small[0]!);
  assert.equal(Buffer.from(plainSmall!.subarray(0, 3)).toString("hex"), "11050d");
  assert.equal(new DataView(plainSmall!.buffer, plainSmall!.byteOffset, plainSmall!.byteLength).getUint16(5, true), 1);
  assert.equal(new DataView(plainSmall!.buffer, plainSmall!.byteOffset, plainSmall!.byteLength).getUint16(7, true), 1);

  const large = cmdPrintDataChunks(new Uint8Array(5000));
  assert.equal(large.length, 3);
  const last = unframePacket(large[2]!);
  assert.equal(new DataView(last!.buffer, last!.byteOffset, last!.byteLength).getUint16(3, true), (5000 - 2 * 1800) + 11);
});

test("notification parser decodes status flags", () => {
  const plain = new Uint8Array(27);
  plain[0] = 0x10;
  plain[1] = 0x01;
  plain[2] = 0x1f;
  new DataView(plain.buffer).setUint16(3, 22, true);
  new DataView(plain.buffer).setUint32(8, 12345, true);
  plain[15] = 0b11110010;
  plain[16] = 0b01111111;
  plain[17] = 4;
  plain[25] = 0x03;
  plain[26] = 0x52;

  const parsed = parseNotification(plain);
  const state = applyStatePatch(createInitialState(), parsed?.statePatch);
  assert.equal(state.bufferFree, 12345);
  assert.equal(state.lackPaper, true);
  assert.equal(state.printing, true);
  assert.equal(state.noHead, true);
  assert.equal(state.highVoltage, true);
  assert.equal(state.lowVoltage, true);
  assert.equal(state.knifeError, true);
  assert.equal(state.fontError, true);
  assert.equal(state.psramError, true);
  assert.equal(state.lackPaperCalibration, true);
  assert.equal(state.willPowerOff, true);
  assert.equal(state.powerOffInProgress, true);
  assert.equal(state.batteryTooHot, true);
  assert.equal(state.batteryBars, 4);
  assert.equal(state.batteryPercent, 85);
});

test("assembler reconstructs split notifications", () => {
  const framed = frameCommand(hexToBytes("1101130000"));
  const parts = splitBleChunks(framed, 7);
  const assembler = new NotifyFrameAssembler();
  const out = parts.flatMap((part) => assembler.push(part));
  assert.equal(out.length, 1);
  assert.equal(Buffer.from(out[0]!).subarray(0, 5).toString("hex"), "1101130000");
});
