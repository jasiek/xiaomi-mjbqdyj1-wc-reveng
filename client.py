#!/usr/bin/env python3
"""
Xiaomi MJBQDYJ1-WC Label Printer — BLE client (bleak).

Protocol core lives in protocol-core/ (Rust, shared with TS via WASM).
This file is the Python host: BLE I/O, image conversion, CLI, HTTP server.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import struct
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

import mjbqdyj1_protocol as _proto


# ── GATT topology (from shared Rust core) ─────────────────────────────────────

SERVICE_UUID = _proto.SERVICE_UUID
WRITE_UUID   = _proto.WRITE_UUID
NOTIFY_UUID  = _proto.NOTIFY_UUID


# ── Protocol helpers forwarded to Rust ────────────────────────────────────────

frame_command      = _proto.frame_command
unframe_packet     = _proto.unframe_packet
split_ble_chunks   = _proto.split_ble_chunks
encrypt_payload    = _proto.encrypt_payload
decrypt_payload    = _proto.decrypt_payload
crc32_custom       = _proto.crc32_custom

cmd_set_connected   = _proto.cmd_set_connected
cmd_get_battery     = _proto.cmd_get_battery
cmd_query_status    = _proto.cmd_query_status
cmd_sync_time       = _proto.cmd_sync_time
cmd_print_start     = _proto.cmd_print_start
cmd_print_finalize  = _proto.cmd_print_finalize
cmd_print_data_chunks = _proto.cmd_print_data_chunks

BLE_CHUNK      = _proto.BLE_CHUNK
PIC_CHUNK_MAX  = _proto.PIC_CHUNK_MAX

# Backward-compatible aliases for test_protocol.py
frame = frame_command
unframe = unframe_packet
encrypt = encrypt_payload
decrypt = decrypt_payload
_crc = crc32_custom


# ── BLE-side helpers ──────────────────────────────────────────────────────────

DEBUG = False


@dataclass
class PrinterState:
    buffer_free: int = 16384
    cover_open: bool = False
    lack_paper: bool = False
    jam: bool = False
    hot: bool = False
    printing: bool = False
    battery_pct: int = -1
    print_complete: asyncio.Event | None = None
    download_complete: asyncio.Event | None = None


def parse_notification(plain: bytes, state: PrinterState) -> None:
    # `plain` is the inner payload: marker(1) grp(1) cmd(1) lenLE(2) body(...).
    if len(plain) < 3:
        return
    grp, cmd = plain[1], plain[2]
    if grp == 0x01 and cmd == 0x1F:
        if len(plain) >= 12:
            state.buffer_free = struct.unpack_from("<I", plain, 8)[0]
        if len(plain) >= 17:
            f = plain[15]
            state.cover_open = bool(f & 1)
            state.lack_paper = bool(f & 2)
            state.jam        = bool(f & 4)
            state.hot        = bool(f & 8)
            state.printing   = bool(f & 0x80)
        if len(plain) >= 23:
            state.battery_pct = struct.unpack_from(">H", plain, 21)[0] // 10
    elif grp == 0x01 and cmd in (0x12, 0x13):
        if len(plain) >= 10:
            f = plain[8]
            state.cover_open = bool(f & 1)
            state.lack_paper = bool(f & 2)
            state.jam        = bool(f & 4)
            state.hot        = bool(f & 8)
            state.printing   = bool(f & 0x80)
    elif grp == 0x05 and cmd == 0x0C:
        if state.print_complete: state.print_complete.set()
    elif grp == 0x02 and cmd == 0x02:
        if state.download_complete: state.download_complete.set()


class Printer:
    def __init__(self, address: str):
        self.address = address
        self.client = BleakClient(address, timeout=20.0)
        self.state = PrinterState()
        self._rx_buf = bytearray()

    async def __aenter__(self) -> "Printer":
        await self.client.connect()
        await self.client.start_notify(NOTIFY_UUID, self._on_notify)
        self._writes_since_breather = 0
        await self._send_logical(cmd_set_connected())
        await self._send_logical(cmd_get_battery())
        await self._send_logical(cmd_query_status())
        await self._send_logical(cmd_sync_time())
        return self

    async def __aexit__(self, *exc):
        try:
            await self.client.stop_notify(NOTIFY_UUID)
        finally:
            await self.client.disconnect()

    def _on_notify(self, _sender, data: bytearray) -> None:
        if DEBUG:
            print(f"← {bytes(data).hex()}", file=sys.stderr)
        self._rx_buf.extend(data)
        while len(self._rx_buf) >= 4 and self._rx_buf[0] == 0xA3 and self._rx_buf[1] in (0x00, 0x20):
            body_len = struct.unpack_from("<H", self._rx_buf, 2)[0]
            total = 4 + body_len + 4
            if len(self._rx_buf) < total:
                return
            frm = bytes(self._rx_buf[:total])
            del self._rx_buf[:total]
            plain = unframe_packet(frm)
            if plain is not None:
                if DEBUG:
                    print(f"   plain={plain.hex()}", file=sys.stderr)
                parse_notification(plain, self.state)
        while self._rx_buf and self._rx_buf[0] != 0xA3:
            del self._rx_buf[0]

    async def _send_logical(self, framed: bytes) -> None:
        if DEBUG:
            print(f"→ {framed.hex()}", file=sys.stderr)
        for off in range(0, len(framed), BLE_CHUNK):
            if self._writes_since_breather >= 3:
                await asyncio.sleep(0.09)
                self._writes_since_breather = 0
            chunk = framed[off:off + BLE_CHUNK]
            await self.client.write_gatt_char(WRITE_UUID, chunk, response=False)
            self._writes_since_breather += 1

    async def _wait_buffer(self, threshold: int = 500, timeout: float = 30.0) -> None:
        deadline = time.monotonic() + timeout
        while self.state.buffer_free < threshold:
            if time.monotonic() > deadline:
                raise TimeoutError("printer buffer never drained")
            await self._send_logical(cmd_query_status())
            await asyncio.sleep(0.5)

    async def print_raster(self, raster: bytes, label_length_dots: int,
                           more_pages: bool = False) -> None:
        self.state.print_complete = asyncio.Event()
        self._writes_since_breather = 0
        await self._send_logical(cmd_print_start(label_length_dots))
        for fr in cmd_print_data_chunks(raster):
            await self._wait_buffer()
            await self._send_logical(fr)
        await self._send_logical(cmd_print_finalize(more_pages))
        try:
            await asyncio.wait_for(self.state.print_complete.wait(), timeout=60)
        except asyncio.TimeoutError:
            print("warning: no print_complete notification received", file=sys.stderr)


# ── Discovery ─────────────────────────────────────────────────────────────────

async def find_printer(timeout: float = 10.0) -> Optional[BLEDevice]:
    devices = await BleakScanner.discover(timeout=timeout)
    for d in devices:
        if d.name and "printer" in d.name.lower():
            return d
    return None


CACHED_PRINTERS_FILE = Path(__file__).parent / ".cached-printers"


def load_cached_printers() -> list[str]:
    try:
        return [line.strip() for line in CACHED_PRINTERS_FILE.read_text().splitlines() if line.strip()]
    except FileNotFoundError:
        return []


def save_cached_printers(addresses: list[str]) -> None:
    unique = list(dict.fromkeys(addresses))
    CACHED_PRINTERS_FILE.write_text("".join(f"{address}\n" for address in unique))


def cache_printer(address: str) -> None:
    save_cached_printers([address, *load_cached_printers()])


async def _close_failed_printer(printer: Printer) -> None:
    try:
        if printer.client.is_connected:
            try:
                await printer.client.stop_notify(NOTIFY_UUID)
            except Exception:
                pass
            await printer.client.disconnect()
    except Exception:
        pass


async def _connect_printer(address: str) -> Printer:
    printer = Printer(address)
    try:
        await printer.__aenter__()
    except Exception:
        await _close_failed_printer(printer)
        raise
    return printer


async def _discover_printer_address() -> str:
    d = await find_printer(timeout=15.0)
    if d is None:
        raise RuntimeError("no printer found")
    print(f"discovered {d.address}  name={d.name}")
    cache_printer(d.address)
    return d.address


async def _open_printer() -> tuple[Printer, str]:
    cached = load_cached_printers()
    last_error: Exception | None = None
    for address in cached:
        try:
            printer = await _connect_printer(address)
        except Exception as exc:
            last_error = exc
            continue
        cache_printer(address)
        print(f"connected using cached printer {address}")
        return printer, address

    address = await _discover_printer_address()
    try:
        printer = await _connect_printer(address)
    except Exception as exc:
        raise RuntimeError(f"failed to connect to discovered printer {address}: {exc}") from exc
    return printer, address


# ── Image → raster ────────────────────────────────────────────────────────────

def image_to_raster(source, width_dots: int = 96) -> tuple[bytes, int]:
    """Convert PNG/JPG (path or file-like) to packed 1bpp raster (MSB = leftmost dot)."""
    from PIL import Image
    img = Image.open(source).convert("L")
    w, h = img.size
    new_h = int(h * width_dots / w)
    img = img.resize((width_dots, new_h)).convert("1")
    pixels = img.load()
    assert pixels is not None
    bytes_per_row = width_dots // 8
    out = bytearray(bytes_per_row * new_h)
    for y in range(new_h):
        for x in range(width_dots):
            if pixels[x, y] == 0:                # black
                out[y * bytes_per_row + (x >> 3)] |= 0x80 >> (x & 7)
    return bytes(out), new_h


# ── CLI ───────────────────────────────────────────────────────────────────────

async def _cmd_scan(_args):
    d = await find_printer(timeout=15.0)
    if d:
        cache_printer(d.address)
    print(d if d else "no device")


async def _cmd_status(args):
    printer, _address = await _open_printer()
    try:
        await asyncio.sleep(2)
        print(printer.state)
    finally:
        await printer.__aexit__(None, None, None)


async def _cmd_print(args):
    raster, h = image_to_raster(args.image)
    print(f"raster: {len(raster)} bytes, {h} dot rows")
    printer, _address = await _open_printer()
    try:
        await asyncio.sleep(1)
        await printer.print_raster(raster, h)
    finally:
        await printer.__aexit__(None, None, None)


# ── HTTP server ───────────────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"


@dataclass
class PrinterSession:
    printer: Printer | None = None
    address: str | None = None
    last_error: str | None = None

    @property
    def connected(self) -> bool:
        return bool(self.printer is not None and self.printer.client.is_connected)

    @property
    def state(self) -> PrinterState:
        if self.printer is not None:
            return self.printer.state
        return PrinterState()

    async def connect(self) -> str:
        if self.connected:
            self.last_error = None
            return self.address or ""
        if self.printer is not None:
            await self.disconnect()
        try:
            printer, address = await _open_printer()
        except Exception as exc:
            self.last_error = str(exc)
            raise
        self.printer = printer
        self.address = address
        self.last_error = None
        return address

    async def disconnect(self) -> None:
        if self.printer is None:
            self.last_error = None
            return
        printer = self.printer
        self.printer = None
        self.last_error = None
        try:
            await printer.__aexit__(None, None, None)
        finally:
            self.address = None


async def _cmd_serve(args):
    from aiohttp import web

    lock = asyncio.Lock()
    session = PrinterSession()

    async def index(_req):
        return web.FileResponse(STATIC_DIR / "index.html")

    async def connect_printer(_req):
        async with lock:
            if session.connected:
                return web.json_response({
                    "connected": True,
                    "address": session.address,
                    "message": "already connected",
                })
            try:
                address = await session.connect()
            except Exception as e:
                return web.json_response({
                    "connected": False,
                    "error": f"connect failed: {e}",
                }, status=500)
        print(f"printer connected: {address}")
        return web.json_response({
            "connected": True,
            "address": address,
            "message": "connected",
        })

    async def disconnect_printer(_req):
        async with lock:
            was_connected = session.connected
            await session.disconnect()
        if was_connected:
            print("printer disconnected")
        return web.json_response({
            "connected": False,
            "message": "disconnected",
        })

    async def do_print(req):
        ctype = req.headers.get("Content-Type", "")
        if ctype.startswith("multipart/"):
            reader = await req.multipart()
            data = None
            async for part in reader:
                if part.name == "image":
                    data = await part.read(decode=False)
                    break
            if not data:
                return web.Response(status=400, text="no image field")
        else:
            data = await req.read()
            if not data:
                return web.Response(status=400, text="empty body")

        try:
            raster, h = image_to_raster(io.BytesIO(data))
        except Exception as e:
            return web.Response(status=400, text=f"image decode failed: {e}")

        async with lock:
            printer = session.printer
            if printer is None:
                return web.Response(status=409, text="printer not connected")
            try:
                await printer.print_raster(raster, h)
            except Exception as e:
                return web.Response(status=500, text=f"print failed: {e}")

        msg = f"printed {len(data)} bytes, {h} dot rows\n"
        if ctype.startswith("multipart/"):
            return web.Response(text=f"<p>{msg}</p><p><a href=\"/\">back</a></p>",
                                content_type="text/html")
        return web.Response(text=msg)

    async def status(_req):
        s = session.state
        return web.json_response({
            "connected": session.connected,
            "address": session.address,
            "last_error": session.last_error,
            "buffer_free": s.buffer_free, "cover_open": s.cover_open,
            "lack_paper": s.lack_paper, "jam": s.jam, "hot": s.hot,
            "printing": s.printing, "battery_pct": s.battery_pct,
        })

    app = web.Application(client_max_size=16 * 1024 * 1024)
    app.router.add_get("/", index)
    app.router.add_post("/connect", connect_printer)
    app.router.add_post("/disconnect", disconnect_printer)
    app.router.add_post("/print", do_print)
    app.router.add_get("/status", status)
    app.router.add_static("/static/", path=str(STATIC_DIR), show_index=False)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, args.host, args.port)
    await site.start()
    print(f"listening on http://{args.host}:{args.port}")
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await runner.cleanup()
        async with lock:
            await session.disconnect()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("scan")
    sub.add_parser("status")
    sp = sub.add_parser("print"); sp.add_argument("image")
    ss = sub.add_parser("serve")
    ss.add_argument("--host", default="0.0.0.0")
    ss.add_argument("--port", type=int, default=8071)
    args = ap.parse_args()
    global DEBUG
    DEBUG = args.debug
    asyncio.run({"scan": _cmd_scan, "status": _cmd_status,
                 "print": _cmd_print, "serve": _cmd_serve}[args.cmd](args))


if __name__ == "__main__":
    main()
