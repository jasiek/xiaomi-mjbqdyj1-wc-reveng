"""Offline self-tests for the framing/CRC/encryption layer.

Runnable inside the Docker image; does not touch BLE.
"""
import struct
import sys

import client as c


def test_crc_seed():
    # With no bytes processed: crc starts at ~0x76953521, final XOR -1
    # restores it to 0x76953521.
    assert c._crc(b"") == 0x76953521


def test_frame_round_trip():
    payload = bytes.fromhex("11011E010001")
    fr = c.frame(payload)
    assert fr[0] == 0xA3 and fr[1] == 0x20
    enc_len = struct.unpack_from("<H", fr, 2)[0]
    assert enc_len % 16 == 0          # AES block aligned
    assert len(fr) == 4 + enc_len + 4
    plain = c.unframe(fr)
    assert plain is not None
    assert plain.startswith(payload)


def test_plaintext_notification_frame_round_trip():
    payload = bytes.fromhex("10011F1700000000003930000000008200000000000352")
    fr = b"\xA3\x00" + struct.pack("<H", len(payload)) + payload + struct.pack("<I", c._crc(payload))
    assert c.unframe(fr) == payload


def test_command_builders():
    # set_connected → 11 01 1E 01 00 01 inside the frame
    fr = c.cmd_set_connected()
    plain = c.unframe(fr)
    assert plain[:6] == bytes.fromhex("11011E010001")

    # query_status → 11 01 13 00 00
    plain = c.unframe(c.cmd_query_status())
    assert plain[:5] == bytes.fromhex("1101130000")

    # sync_time encodes (epoch + 28800) little-endian
    fr = c.cmd_sync_time(0)
    plain = c.unframe(fr)
    assert plain[:5] == bytes.fromhex("1101190400")
    t = struct.unpack("<I", plain[5:9])[0]
    assert t == 28800

    # print_start: header + width=0x0060 + label_len LE + tail
    plain = c.unframe(c.cmd_print_start(320))
    assert plain[:5] == bytes.fromhex("11050B0700")
    assert plain[5:7] == b"\x60\x00"
    assert struct.unpack("<H", plain[7:9])[0] == 320
    assert plain[9:12] == bytes.fromhex("010000")

    plain = c.unframe(c.cmd_print_finalize(False))
    assert plain.startswith(bytes.fromhex("11050C0900010200000002010000"))


def test_print_data_chunks_small_and_large():
    # Small (single chunk): 100 bytes raster, fits in one frame
    raster = bytes(range(100))
    frames = c.cmd_print_data_chunks(raster)
    assert len(frames) == 1
    plain = c.unframe(frames[0])
    assert plain[:3] == bytes.fromhex("11050D")
    # idx=1, total=1
    assert plain[5:9] == bytes.fromhex("01000100")
    assert plain[9:16] == bytes.fromhex("100C0000000000")

    # Large: > PIC_CHUNK_MAX (1800) → multiple frames
    big = bytes(5000)
    frames = c.cmd_print_data_chunks(big)
    assert len(frames) == 3            # ceil(5000/1800)
    last = c.unframe(frames[-1])
    # last chunk total length = bytes_in_chunk + 11
    assert struct.unpack("<H", last[3:5])[0] == (5000 - 2 * 1800) + 11


def test_notification_parser():
    state = c.PrinterState()
    # Build a synthetic 21 01 1F status payload (raw inner payload format):
    #   [0]=marker [1]=grp [2]=cmd [3..4]=len [5+]=body
    #   buffer_free at plain[8..11]  (body[3..6] — parser reads at 8)
    #   flags A at plain[15]         (body[10])
    #   battery percent at plain[21..22] (body[16..17])
    plain = bytearray(28)
    plain[0] = 0x21                    # response marker
    plain[1], plain[2] = 0x01, 0x1F    # grp, cmd
    struct.pack_into("<H", plain, 3, 23)  # payload length
    struct.pack_into("<I", plain, 8, 12345)  # buffer_free (parser reads at 8)
    plain[15] = 0b10000010              # flags A: printing + lack_paper
    struct.pack_into(">H", plain, 21, 850)   # battery: 85.0%
    c.parse_notification(bytes(plain), state)
    assert state.buffer_free == 12345
    assert state.lack_paper is True
    assert state.printing is True
    assert state.battery_pct == 85


def main():
    tests = [v for k, v in globals().items() if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  ok  {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
    if failed:
        sys.exit(f"{failed} test(s) failed")
    print(f"all {len(tests)} tests passed")


if __name__ == "__main__":
    main()
