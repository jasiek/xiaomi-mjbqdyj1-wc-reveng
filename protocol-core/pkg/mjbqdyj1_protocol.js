/* @ts-self-types="./mjbqdyj1_protocol.d.ts" */

class WasmPrinterState {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmPrinterState.prototype);
        obj.__wbg_ptr = ptr;
        WasmPrinterStateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPrinterStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmprinterstate_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get battery_bars() {
        const ret = wasm.__wbg_get_wasmprinterstate_battery_bars(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get battery_percent() {
        const ret = wasm.__wbg_get_wasmprinterstate_battery_percent(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get battery_too_hot() {
        const ret = wasm.__wbg_get_wasmprinterstate_battery_too_hot(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get buffer_free() {
        const ret = wasm.__wbg_get_wasmprinterstate_buffer_free(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    get cover_open() {
        const ret = wasm.__wbg_get_wasmprinterstate_cover_open(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get download_complete() {
        const ret = wasm.__wbg_get_wasmprinterstate_download_complete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get font_error() {
        const ret = wasm.__wbg_get_wasmprinterstate_font_error(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get high_voltage() {
        const ret = wasm.__wbg_get_wasmprinterstate_high_voltage(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get hot() {
        const ret = wasm.__wbg_get_wasmprinterstate_hot(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get jam() {
        const ret = wasm.__wbg_get_wasmprinterstate_jam(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get knife_error() {
        const ret = wasm.__wbg_get_wasmprinterstate_knife_error(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get lack_paper_calibration() {
        const ret = wasm.__wbg_get_wasmprinterstate_lack_paper_calibration(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get lack_paper() {
        const ret = wasm.__wbg_get_wasmprinterstate_lack_paper(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get low_voltage() {
        const ret = wasm.__wbg_get_wasmprinterstate_low_voltage(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get no_head() {
        const ret = wasm.__wbg_get_wasmprinterstate_no_head(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get power_off_in_progress() {
        const ret = wasm.__wbg_get_wasmprinterstate_power_off_in_progress(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get print_complete() {
        const ret = wasm.__wbg_get_wasmprinterstate_print_complete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get printing() {
        const ret = wasm.__wbg_get_wasmprinterstate_printing(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get psram_error() {
        const ret = wasm.__wbg_get_wasmprinterstate_psram_error(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get will_power_off() {
        const ret = wasm.__wbg_get_wasmprinterstate_will_power_off(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} arg0
     */
    set battery_bars(arg0) {
        wasm.__wbg_set_wasmprinterstate_battery_bars(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set battery_percent(arg0) {
        wasm.__wbg_set_wasmprinterstate_battery_percent(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set battery_too_hot(arg0) {
        wasm.__wbg_set_wasmprinterstate_battery_too_hot(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set buffer_free(arg0) {
        wasm.__wbg_set_wasmprinterstate_buffer_free(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set cover_open(arg0) {
        wasm.__wbg_set_wasmprinterstate_cover_open(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set download_complete(arg0) {
        wasm.__wbg_set_wasmprinterstate_download_complete(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set font_error(arg0) {
        wasm.__wbg_set_wasmprinterstate_font_error(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set high_voltage(arg0) {
        wasm.__wbg_set_wasmprinterstate_high_voltage(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set hot(arg0) {
        wasm.__wbg_set_wasmprinterstate_hot(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set jam(arg0) {
        wasm.__wbg_set_wasmprinterstate_jam(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set knife_error(arg0) {
        wasm.__wbg_set_wasmprinterstate_knife_error(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set lack_paper_calibration(arg0) {
        wasm.__wbg_set_wasmprinterstate_lack_paper_calibration(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set lack_paper(arg0) {
        wasm.__wbg_set_wasmprinterstate_lack_paper(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set low_voltage(arg0) {
        wasm.__wbg_set_wasmprinterstate_low_voltage(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set no_head(arg0) {
        wasm.__wbg_set_wasmprinterstate_no_head(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set power_off_in_progress(arg0) {
        wasm.__wbg_set_wasmprinterstate_power_off_in_progress(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set print_complete(arg0) {
        wasm.__wbg_set_wasmprinterstate_print_complete(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set printing(arg0) {
        wasm.__wbg_set_wasmprinterstate_printing(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set psram_error(arg0) {
        wasm.__wbg_set_wasmprinterstate_psram_error(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set will_power_off(arg0) {
        wasm.__wbg_set_wasmprinterstate_will_power_off(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) WasmPrinterState.prototype[Symbol.dispose] = WasmPrinterState.prototype.free;
exports.WasmPrinterState = WasmPrinterState;

/**
 * @param {WasmPrinterState} base
 * @param {WasmPrinterState} patch
 * @returns {WasmPrinterState}
 */
function wasm_apply_state_patch(base, patch) {
    _assertClass(base, WasmPrinterState);
    _assertClass(patch, WasmPrinterState);
    const ret = wasm.wasm_apply_state_patch(base.__wbg_ptr, patch.__wbg_ptr);
    return WasmPrinterState.__wrap(ret);
}
exports.wasm_apply_state_patch = wasm_apply_state_patch;

/**
 * @returns {Uint8Array}
 */
function wasm_cmd_get_battery() {
    const ret = wasm.wasm_cmd_get_battery();
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_get_battery = wasm_cmd_get_battery;

/**
 * @param {Uint8Array} raster
 * @returns {Uint8Array[]}
 */
function wasm_cmd_print_data_chunks(raster) {
    const ptr0 = passArray8ToWasm0(raster, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_cmd_print_data_chunks(ptr0, len0);
    var v2 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}
exports.wasm_cmd_print_data_chunks = wasm_cmd_print_data_chunks;

/**
 * @param {boolean} more_pages
 * @returns {Uint8Array}
 */
function wasm_cmd_print_finalize(more_pages) {
    const ret = wasm.wasm_cmd_print_finalize(more_pages);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_print_finalize = wasm_cmd_print_finalize;

/**
 * @param {number} label_length_dots
 * @returns {Uint8Array}
 */
function wasm_cmd_print_start(label_length_dots) {
    const ret = wasm.wasm_cmd_print_start(label_length_dots);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_print_start = wasm_cmd_print_start;

/**
 * @returns {Uint8Array}
 */
function wasm_cmd_query_status() {
    const ret = wasm.wasm_cmd_query_status();
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_query_status = wasm_cmd_query_status;

/**
 * @returns {Uint8Array}
 */
function wasm_cmd_set_connected() {
    const ret = wasm.wasm_cmd_set_connected();
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_set_connected = wasm_cmd_set_connected;

/**
 * @param {number} epoch_seconds
 * @returns {Uint8Array}
 */
function wasm_cmd_sync_time(epoch_seconds) {
    const ret = wasm.wasm_cmd_sync_time(epoch_seconds);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.wasm_cmd_sync_time = wasm_cmd_sync_time;

/**
 * @param {Uint8Array} buf
 * @returns {number}
 */
function wasm_crc32_custom(buf) {
    const ptr0 = passArray8ToWasm0(buf, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_crc32_custom(ptr0, len0);
    return ret >>> 0;
}
exports.wasm_crc32_custom = wasm_crc32_custom;

/**
 * @param {Uint8Array} ciphertext
 * @returns {Uint8Array}
 */
function wasm_decrypt_payload(ciphertext) {
    const ptr0 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_decrypt_payload(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
exports.wasm_decrypt_payload = wasm_decrypt_payload;

/**
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
function wasm_encrypt_payload(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_encrypt_payload(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
exports.wasm_encrypt_payload = wasm_encrypt_payload;

/**
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
function wasm_frame_command(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_frame_command(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
exports.wasm_frame_command = wasm_frame_command;

/**
 * @param {Uint8Array} plain
 * @returns {WasmPrinterState | undefined}
 */
function wasm_parse_notification(plain) {
    const ptr0 = passArray8ToWasm0(plain, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_parse_notification(ptr0, len0);
    return ret === 0 ? undefined : WasmPrinterState.__wrap(ret);
}
exports.wasm_parse_notification = wasm_parse_notification;

/**
 * @param {Uint8Array} framed
 * @param {number} max_chunk_len
 * @returns {Uint8Array[]}
 */
function wasm_split_ble_chunks(framed, max_chunk_len) {
    const ptr0 = passArray8ToWasm0(framed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_split_ble_chunks(ptr0, len0, max_chunk_len);
    var v2 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}
exports.wasm_split_ble_chunks = wasm_split_ble_chunks;

/**
 * @param {Uint8Array} wire
 * @returns {Uint8Array | undefined}
 */
function wasm_unframe_packet(wire) {
    const ptr0 = passArray8ToWasm0(wire, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_unframe_packet(ptr0, len0);
    let v2;
    if (ret[0] !== 0) {
        v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v2;
}
exports.wasm_unframe_packet = wasm_unframe_packet;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6b64449b9b9ed33c: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_length_9f1775224cf1d815: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_with_length_8c854e41ea4dae9b: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_set_3d484eb794afec82: function(arg0, arg1, arg2) {
            arg0.set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mjbqdyj1_protocol_bg.js": import0,
    };
}

const WasmPrinterStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmprinterstate_free(ptr >>> 0, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/mjbqdyj1_protocol_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;
wasm.__wbindgen_start();
