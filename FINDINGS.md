# MJBQDYJ1-WC — BLE Printing Protocol

Reverse-engineered from the **macOS Xiaomi Home** app (Mac Catalyst). The
Android APK proved opaque (the printer logic isn't in the base APK at all);
on macOS the printer plugin is downloaded as an unobfuscated React Native
bundle that the Xiaomi Home app stores in its sandbox.

## Source

Plugin location on disk:

```
~/Library/Containers/BF8F877D-71AA-4890-BD3B-90C968D08D64/Data/Documents/\
    Plugin/Plugin_1690729/ios/main.bundle
```

`project.json` metadata:

```
package_path:  xiaomi.printer.label
version:       1.1.4
build_time:    2025-03-20
bundle_type:   indexed-ram-bundle  (React Native, magic 0xFB0BD1E5)
bundle_minify: false               ← all symbols intact
```

The bundle is plain JS once you skip the RAM index header — `strings` is
enough to read it. A copy lives at `plugin/main.bundle` for offline analysis.

## GATT topology

| Role          | UUID                                           | Properties               |
|---------------|------------------------------------------------|--------------------------|
| Service       | `0000FE95-0000-1000-8000-00805F9B34FB`         | Xiaomi MiBeacon service  |
| Write (TX)    | `0000001F-0000-1000-8000-00805F9B34FB`         | Write Without Response   |
| Notify (RX)   | `00000020-0000-1000-8000-00805F9B34FB`         | Notify                   |

iOS/macOS code uses the short forms `FE95`, `001F`, `0020`.

## Frame format

Every frame on both directions uses the wrapper:

```
+------+------+----+-------------------+-----------+
| 0xA3 | 0x20 | LL | encrypted payload | CRC32 (4) |
+------+------+----+-------------------+-----------+
        \____ /  \__/                    \________/
        marker   little-endian            little-endian
                 length of                CRC32 of the
                 ENCRYPTED                ENCRYPTED bytes
                 payload, in              (custom init,
                 BYTES (not /16)          see below)
```

The decrypted payload starts with a different marker (`A3 00 00 00`) when
the parser internally re-feeds it. On the wire you see two frame variants:

- `A3 20 …` — **encrypted** command/response. Used for every host→printer
  write and for direct responses to commands (inner marker byte `0x21` for
  responses, `0x11` for commands).
- `A3 00 LL LL <plain-body> CRC32` — **plaintext** spontaneous
  notifications from the printer (inner marker byte `0x10`). Periodic
  status-flag broadcasts (`10 01 1F …`) arrive in this form. Length and
  CRC rules are the same as the encrypted variant; the body is simply not
  encrypted. A client parser has to accept both.

If a logical packet is larger than the GATT MTU, the bundle slices the
**already-framed** bytes into ≤ 204-byte BLE chunks (`sendMaxLength = 204`)
and writes them back-to-back. Image data has its own intermediate
fragmentation (`PicPackageMaxLength = 1800`) before that.

### Encryption

AES-128-CBC, **zero-padded**, with the key and IV hard-coded in the
plugin (`CommandHelper.encrypt`, `CommandHelper.decrypt`):

```
KEY = 99 B8 29 43 6C DD 56 47 AA DB 88 16 F7 3E 86 44
IV  = 00 01 02 0F 3C F8 99 AB AB CD 25 31 8D F4 46 B1
```

`encrypt(hex_payload)` parses the hex as raw bytes and CBC-encrypts them.
Output length is the plaintext length rounded up to the next 16-byte block.

### CRC32

Standard zlib/IEEE-802.3 polynomial table (`0xEDB88320` reflected), but
with a **custom initial register**: `0x76953521` is passed to the underlying
`crc32(buf, previous)` as the previous-CRC seed. The function does
`crc = ~previous` then a normal table walk, then `crc ^ -1` at the end.

The 4-byte result is appended **little-endian** to the encrypted payload.

### Endianness gotcha

`CommandHelper.intToBytesBigEndian(n, len)` is **misnamed** — the code
emits little-endian:

```js
intToBytesBigEndian(number, length) {
  var bytes = [];
  var i = 0;
  do { bytes[i++] = number & 255; number = number >> 8; } while (i < length);
  return bytes;   // [LSB, …, MSB]
}
```

Every multi-byte numeric field the plugin feeds through this helper — the
frame length, the inner-payload length, the head width (`0x0060 = 96`),
the label length, the chunk index / count, and the sync-time epoch — is
therefore **little-endian on the wire**, despite the function's name.
(The companion `intToBytesSmallEndian` is outright broken — it uses
`<<` instead of `>>` — but nothing on the print path calls it.)

Reference Python (matches `client.py`):

```python
KEY = bytes.fromhex("99B829436CDD5647AADB8816F73E8644")
IV  = bytes.fromhex("0001020F3CF899ABABCD25318DF446B1")
CRC_SEED = 0x76953521

def custom_crc32(buf, init=CRC_SEED):
    crc = (~init) & 0xFFFFFFFF
    for b in buf:
        crc = TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
    return (~crc) & 0xFFFFFFFF
```

The framing/CRC/AES path is exercised by `test_protocol.py` (run via
`docker run --rm -v $PWD:/work mjbqdyj1-reveng python3 /work/test_protocol.py`).

## Inner payload format

After decryption the payload is a small TLV-ish command structure:

```
+------+------+------+-----------------+----------------+
| 0x11 | grp  | cmd  | length (LE u16) | command bytes  |
+------+------+------+-----------------+----------------+
```

- `grp == 0x01` — device control / status query
- `grp == 0x02` — RAM image download (large transfers)
- `grp == 0x05` — printing (start / data / finalize)

### Group 0x01 — control & status

| Hex                          | Meaning                                           |
|------------------------------|---------------------------------------------------|
| `11 01 13 00 00`             | Query printer status                              |
| `11 01 1C 00 00`             | Query (variant — used in some flows)              |
| `11 01 1E 01 00 01`          | Mark "client connected"                           |
| `11 01 0E 00 00`             | Get battery                                       |
| `11 01 19 04 00 TT TT TT TT` | Sync time (epoch seconds + 28800, little-endian u32) |

### Status notification (`10 01 1F …` plaintext / `21 01 1F …` encrypted)

All notification offsets below are quoted in plugin coordinates — i.e.
relative to `A3 00 00 00 <marker> <grp> <cmd> <len> <body>`, the synthetic
shape the plugin's parser sees. Subtract 4 to index into the raw inner
payload (`<marker> <grp> <cmd> <len> <body>`).

| Offset | Bytes  | Meaning                                          |
|--------|--------|--------------------------------------------------|
| 12..15 | u32 LE | `printerBufferSize` (free RAM in printer queue)  |
| 19     | u8     | status flags A (see bit table below)             |
| 20     | u8     | status flags B                                   |
| 21     | u8     | battery level (0–4 bars)                         |
| 25..26 | two u8 | battery percent ×10 (concat `[byte25, byte26]` as hex then parseInt) |

Status flags A bits: `0=cover_open, 1=lack_paper, 2=jam, 3=hot, 4=no_head,
5=high_voltage, 6=low_voltage, 7=printing`.
Status flags B bits: `0=knife_err, 1=font_err, 2=psram_err,
3=lack_paper_calibration, 4=will_off, 5=will_off_in_progress,
6=battery_too_hot`.

`11 01 0E/0F …` is a battery-only update; bytes at hex-offsets 34/36 hold
the percent (LE u16, `÷10`).

### Group 0x05 — print job

Print-start (raster bitmap):

```
11 05 0B  07 00            ← length (LE u16)
60 00                      ← width = 96 dots (LE u16; 12mm head, 8 dpmm)
LL LL                      ← label length in dots (LE u16)
01 00 00
```

Image data chunk(s):

```
11 05 0D  <total_len LE u16>
<chunk_idx LE u16>  <total_chunks LE u16>
10 0C 00 00 00 00 00
<raster bytes>             ← packed 1bpp, MSB = leftmost dot
```

Single-chunk frames carry `01 00 / 01 00` (LE u16 `1` / `1`) for idx/total.
Multi-chunk frames repeat the `11 05 0D …` header per chunk; chunks are
≤ `PicPackageMaxLength = 1800` bytes of raster each.

Print-finalize:

```
11 05 0C 09 00 01 02 00 00 00 02 01 00 II
```

`II = 0x00` for "this was the last page" or `0x01` for "more pages follow".

`print_complete` is signalled back as a notify with `[5]=0x05 [6]=0x0C`.

### Group 0x02 — RAM download (resources / fonts / dynamic templates)

Start: `11 02 01 19 00 01 02 00 04 00 02 04 00 <total_len LE u32>
        03 00 00 04 02 00 60 00 05 02 00 <label_len LE u16>`

Data chunks: `11 02 03 <chunk_len LE u16> <chunk_idx LE u16>
              <bytes_in_chunk LE u16> <byte_offset LE u32> <bytes…>`
Chunk size: ≤ `DownloadPackageMaxLength = 1792` bytes.

End: `11 02 02 00 00`. Completion notify: `[5]=0x02 [6]=0x02`.

## Connection sequence

After GATT connect, on the `bluetoothCharacteristicDiscovered` callback for
the notify char (`0020`) the app calls `setNotify(true)` and then, in this
order:

1. `_setConnectedStatus`     → `11 01 1E 01 00 01`
2. `_getBattery`             → `11 01 0E 00 00`
3. `_sendCheckPrinterStatus` → `11 01 13 00 00`
4. `_syncTime`               → `11 01 19 04 00 <LE32 epoch+28800>`
   (the +28800 = +8h CST offset; the printer clock is in Beijing local time)

Each of those is wrapped through `generateCompleteCommand` (encrypt + CRC).

## Pacing rules (from the bundle)

- Don't write the next frame until `printerBufferSize > 500` (peeked
  out of every status notification).
- On iOS, after every 3rd consecutive write insert a 90 ms breather.
- Between fragments of the **same** logical frame, no delay — just splice
  the framed bytes into 204-byte slices and fire them back-to-back via
  Write-Without-Response.

## Practical notes / caveats

- The plugin only exposes a 12 mm wide head (`0x0060 = 96 dots`). That is
  hard-coded in the print-start command.
- Raster bytes are packed 1bpp, 8 dots per byte, **MSB = leftmost dot**.
  One row = 12 bytes (96 / 8). Total length in print-start counts dots,
  not bytes.
- The CRC seed `0x76953521` is unique enough that a wrong value will be
  silently dropped by the printer with no notify back — useful canary.
- The macOS app talks BLE through CoreBluetooth via the MIoT bridge
  (`bleDevice.getService(...).getCharacteristic(...).writeWithoutResponse`),
  which means the framing here is exactly what hits the air.
