/* tslint:disable */
/* eslint-disable */

export class WasmPrinterState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    battery_bars: number;
    battery_percent: number;
    battery_too_hot: boolean;
    buffer_free: number;
    cover_open: boolean;
    download_complete: boolean;
    font_error: boolean;
    high_voltage: boolean;
    hot: boolean;
    jam: boolean;
    knife_error: boolean;
    lack_paper_calibration: boolean;
    lack_paper: boolean;
    low_voltage: boolean;
    no_head: boolean;
    power_off_in_progress: boolean;
    print_complete: boolean;
    printing: boolean;
    psram_error: boolean;
    will_power_off: boolean;
}

export function wasm_apply_state_patch(base: WasmPrinterState, patch: WasmPrinterState): WasmPrinterState;

export function wasm_cmd_get_battery(): Uint8Array;

export function wasm_cmd_print_data_chunks(raster: Uint8Array): Uint8Array[];

export function wasm_cmd_print_finalize(more_pages: boolean): Uint8Array;

export function wasm_cmd_print_start(label_length_dots: number): Uint8Array;

export function wasm_cmd_query_status(): Uint8Array;

export function wasm_cmd_set_connected(): Uint8Array;

export function wasm_cmd_sync_time(epoch_seconds: number): Uint8Array;

export function wasm_crc32_custom(buf: Uint8Array): number;

export function wasm_decrypt_payload(ciphertext: Uint8Array): Uint8Array;

export function wasm_encrypt_payload(payload: Uint8Array): Uint8Array;

export function wasm_frame_command(payload: Uint8Array): Uint8Array;

export function wasm_parse_notification(plain: Uint8Array): WasmPrinterState | undefined;

export function wasm_split_ble_chunks(framed: Uint8Array, max_chunk_len: number): Uint8Array[];

export function wasm_unframe_packet(wire: Uint8Array): Uint8Array | undefined;
