use wasm_bindgen::prelude::*;

use crate::*;

#[wasm_bindgen]
pub fn wasm_encrypt_payload(payload: &[u8]) -> Vec<u8> {
    encrypt_payload(payload)
}

#[wasm_bindgen]
pub fn wasm_decrypt_payload(ciphertext: &[u8]) -> Vec<u8> {
    decrypt_payload(ciphertext)
}

#[wasm_bindgen]
pub fn wasm_crc32_custom(buf: &[u8]) -> u32 {
    crc32_custom(buf)
}

#[wasm_bindgen]
pub fn wasm_frame_command(payload: &[u8]) -> Vec<u8> {
    frame_command(payload)
}

#[wasm_bindgen]
pub fn wasm_unframe_packet(wire: &[u8]) -> Option<Vec<u8>> {
    unframe_packet(wire)
}

#[wasm_bindgen]
pub fn wasm_split_ble_chunks(framed: &[u8], max_chunk_len: usize) -> Vec<js_sys::Uint8Array> {
    split_ble_chunks(framed, max_chunk_len)
        .into_iter()
        .map(|v| {
            let arr = js_sys::Uint8Array::new_with_length(v.len() as u32);
            arr.copy_from(&v);
            arr
        })
        .collect()
}

#[wasm_bindgen]
pub fn wasm_cmd_set_connected() -> Vec<u8> {
    cmd_set_connected()
}

#[wasm_bindgen]
pub fn wasm_cmd_get_battery() -> Vec<u8> {
    cmd_get_battery()
}

#[wasm_bindgen]
pub fn wasm_cmd_query_status() -> Vec<u8> {
    cmd_query_status()
}

#[wasm_bindgen]
pub fn wasm_cmd_sync_time(epoch_seconds: u32) -> Vec<u8> {
    cmd_sync_time(epoch_seconds)
}

#[wasm_bindgen]
pub fn wasm_cmd_print_start(label_length_dots: u16) -> Vec<u8> {
    cmd_print_start(label_length_dots)
}

#[wasm_bindgen]
pub fn wasm_cmd_print_finalize(more_pages: bool) -> Vec<u8> {
    cmd_print_finalize(more_pages)
}

#[wasm_bindgen]
pub fn wasm_cmd_print_data_chunks(raster: &[u8]) -> Vec<js_sys::Uint8Array> {
    cmd_print_data_chunks(raster)
        .into_iter()
        .map(|v| {
            let arr = js_sys::Uint8Array::new_with_length(v.len() as u32);
            arr.copy_from(&v);
            arr
        })
        .collect()
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct WasmPrinterState {
    pub buffer_free: u32,
    pub cover_open: bool,
    pub lack_paper: bool,
    pub jam: bool,
    pub hot: bool,
    pub no_head: bool,
    pub high_voltage: bool,
    pub low_voltage: bool,
    pub printing: bool,
    pub knife_error: bool,
    pub font_error: bool,
    pub psram_error: bool,
    pub lack_paper_calibration: bool,
    pub will_power_off: bool,
    pub power_off_in_progress: bool,
    pub battery_too_hot: bool,
    pub battery_bars: u8,
    pub battery_percent: u16,
    pub print_complete: bool,
    pub download_complete: bool,
}

impl From<PrinterState> for WasmPrinterState {
    fn from(s: PrinterState) -> Self {
        WasmPrinterState {
            buffer_free: s.buffer_free,
            cover_open: s.cover_open,
            lack_paper: s.lack_paper,
            jam: s.jam,
            hot: s.hot,
            no_head: s.no_head,
            high_voltage: s.high_voltage,
            low_voltage: s.low_voltage,
            printing: s.printing,
            knife_error: s.knife_error,
            font_error: s.font_error,
            psram_error: s.psram_error,
            lack_paper_calibration: s.lack_paper_calibration,
            will_power_off: s.will_power_off,
            power_off_in_progress: s.power_off_in_progress,
            battery_too_hot: s.battery_too_hot,
            battery_bars: s.battery_bars,
            battery_percent: s.battery_percent,
            print_complete: s.print_complete,
            download_complete: s.download_complete,
        }
    }
}

#[wasm_bindgen]
pub fn wasm_parse_notification(plain: &[u8]) -> Option<WasmPrinterState> {
    parse_notification(plain).and_then(|parsed| parsed.state_patch.map(|s| s.into()))
}

#[wasm_bindgen]
pub fn wasm_apply_state_patch(base: &WasmPrinterState, patch: &WasmPrinterState) -> WasmPrinterState {
    let base_rs = printer_state_from_wasm(base);
    let patch_rs = printer_state_from_wasm(patch);
    apply_state_patch(&base_rs, &patch_rs).into()
}

fn printer_state_from_wasm(s: &WasmPrinterState) -> PrinterState {
    PrinterState {
        buffer_free: s.buffer_free,
        cover_open: s.cover_open,
        lack_paper: s.lack_paper,
        jam: s.jam,
        hot: s.hot,
        no_head: s.no_head,
        high_voltage: s.high_voltage,
        low_voltage: s.low_voltage,
        printing: s.printing,
        knife_error: s.knife_error,
        font_error: s.font_error,
        psram_error: s.psram_error,
        lack_paper_calibration: s.lack_paper_calibration,
        will_power_off: s.will_power_off,
        power_off_in_progress: s.power_off_in_progress,
        battery_too_hot: s.battery_too_hot,
        battery_bars: s.battery_bars,
        battery_percent: s.battery_percent,
        print_complete: s.print_complete,
        download_complete: s.download_complete,
    }
}
