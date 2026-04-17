use pyo3::prelude::*;
use pyo3::types::PyBytes;

use crate::*;

#[pyclass]
#[derive(Clone, Debug)]
pub struct PyPrinterState {
    #[pyo3(get)]
    pub buffer_free: u32,
    #[pyo3(get)]
    pub cover_open: bool,
    #[pyo3(get)]
    pub lack_paper: bool,
    #[pyo3(get)]
    pub jam: bool,
    #[pyo3(get)]
    pub hot: bool,
    #[pyo3(get)]
    pub no_head: bool,
    #[pyo3(get)]
    pub high_voltage: bool,
    #[pyo3(get)]
    pub low_voltage: bool,
    #[pyo3(get)]
    pub printing: bool,
    #[pyo3(get)]
    pub knife_error: bool,
    #[pyo3(get)]
    pub font_error: bool,
    #[pyo3(get)]
    pub psram_error: bool,
    #[pyo3(get)]
    pub lack_paper_calibration: bool,
    #[pyo3(get)]
    pub will_power_off: bool,
    #[pyo3(get)]
    pub power_off_in_progress: bool,
    #[pyo3(get)]
    pub battery_too_hot: bool,
    #[pyo3(get)]
    pub battery_bars: u8,
    #[pyo3(get)]
    pub battery_percent: u16,
    #[pyo3(get)]
    pub print_complete: bool,
    #[pyo3(get)]
    pub download_complete: bool,
}

impl From<PrinterState> for PyPrinterState {
    fn from(s: PrinterState) -> Self {
        PyPrinterState {
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

fn vec_to_pybytes<'py>(py: Python<'py>, data: Vec<u8>) -> Bound<'py, PyBytes> {
    PyBytes::new_bound(py, &data)
}

#[pymodule]
fn mjbqdyj1_protocol(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("SERVICE_UUID", SERVICE_UUID)?;
    m.add("WRITE_UUID", WRITE_UUID)?;
    m.add("NOTIFY_UUID", NOTIFY_UUID)?;
    m.add("CRC_SEED", CRC_SEED)?;
    m.add("BLE_CHUNK", BLE_CHUNK)?;
    m.add("PIC_CHUNK_MAX", PIC_CHUNK_MAX)?;

    m.add_wrapped(wrap_pyfunction!(encrypt_payload_py))?;
    m.add_wrapped(wrap_pyfunction!(decrypt_payload_py))?;
    m.add_wrapped(wrap_pyfunction!(crc32_custom_py))?;
    m.add_wrapped(wrap_pyfunction!(frame_command_py))?;
    m.add_wrapped(wrap_pyfunction!(unframe_packet_py))?;
    m.add_wrapped(wrap_pyfunction!(split_ble_chunks_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_set_connected_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_get_battery_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_query_status_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_sync_time_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_print_start_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_print_finalize_py))?;
    m.add_wrapped(wrap_pyfunction!(cmd_print_data_chunks_py))?;
    m.add_wrapped(wrap_pyfunction!(parse_notification_py))?;
    m.add_wrapped(wrap_pyfunction!(apply_state_patch_py))?;

    Ok(())
}

#[pyfunction(name = "encrypt_payload")]
fn encrypt_payload_py<'py>(py: Python<'py>, payload: &[u8]) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, encrypt_payload(payload))
}

#[pyfunction(name = "decrypt_payload")]
fn decrypt_payload_py<'py>(py: Python<'py>, ciphertext: &[u8]) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, decrypt_payload(ciphertext))
}

#[pyfunction(name = "crc32_custom")]
fn crc32_custom_py(buf: &[u8]) -> u32 {
    crc32_custom(buf)
}

#[pyfunction(name = "frame_command")]
fn frame_command_py<'py>(py: Python<'py>, payload: &[u8]) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, frame_command(payload))
}

#[pyfunction(name = "unframe_packet")]
fn unframe_packet_py<'py>(py: Python<'py>, wire: &[u8]) -> Option<Bound<'py, PyBytes>> {
    unframe_packet(wire).map(|v| vec_to_pybytes(py, v))
}

#[pyfunction(name = "split_ble_chunks")]
fn split_ble_chunks_py<'py>(py: Python<'py>, framed: &[u8], max_chunk_len: usize) -> Vec<Bound<'py, PyBytes>> {
    split_ble_chunks(framed, max_chunk_len)
        .into_iter()
        .map(|v| vec_to_pybytes(py, v))
        .collect()
}

#[pyfunction(name = "cmd_set_connected")]
fn cmd_set_connected_py<'py>(py: Python<'py>) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_set_connected())
}

#[pyfunction(name = "cmd_get_battery")]
fn cmd_get_battery_py<'py>(py: Python<'py>) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_get_battery())
}

#[pyfunction(name = "cmd_query_status")]
fn cmd_query_status_py<'py>(py: Python<'py>) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_query_status())
}

#[pyfunction(name = "cmd_sync_time")]
fn cmd_sync_time_py<'py>(py: Python<'py>, epoch_seconds: u32) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_sync_time(epoch_seconds))
}

#[pyfunction(name = "cmd_print_start")]
fn cmd_print_start_py<'py>(py: Python<'py>, label_length_dots: u16) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_print_start(label_length_dots))
}

#[pyfunction(name = "cmd_print_finalize")]
fn cmd_print_finalize_py<'py>(py: Python<'py>, more_pages: bool) -> Bound<'py, PyBytes> {
    vec_to_pybytes(py, cmd_print_finalize(more_pages))
}

#[pyfunction(name = "cmd_print_data_chunks")]
fn cmd_print_data_chunks_py<'py>(py: Python<'py>, raster: &[u8]) -> Vec<Bound<'py, PyBytes>> {
    cmd_print_data_chunks(raster)
        .into_iter()
        .map(|v| vec_to_pybytes(py, v))
        .collect()
}

#[pyfunction(name = "parse_notification")]
fn parse_notification_py(plain: &[u8]) -> Option<PyPrinterState> {
    parse_notification(plain).and_then(|parsed| parsed.state_patch.map(|s| s.into()))
}

#[pyfunction(name = "apply_state_patch")]
fn apply_state_patch_py(base: PyPrinterState, patch: PyPrinterState) -> PyPrinterState {
    let base_rs = printer_state_from_py(base);
    let patch_rs = printer_state_from_py(patch);
    apply_state_patch(&base_rs, &patch_rs).into()
}

fn printer_state_from_py(s: PyPrinterState) -> PrinterState {
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
