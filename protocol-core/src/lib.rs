use std::convert::TryInto;

pub const SERVICE_UUID: &str = "0000fe95-0000-1000-8000-00805f9b34fb";
pub const WRITE_UUID: &str = "0000001f-0000-1000-8000-00805f9b34fb";
pub const NOTIFY_UUID: &str = "00000020-0000-1000-8000-00805f9b34fb";

pub const KEY: [u8; 16] = hex_bytes("99B829436CDD5647AADB8816F73E8644");
pub const IV: [u8; 16] = hex_bytes("0001020F3CF899ABABCD25318DF446B1");
pub const CRC_SEED: u32 = 0x76953521;
pub const BLE_CHUNK: usize = 204;
pub const PIC_CHUNK_MAX: usize = 1800;
pub const DOWNLOAD_CHUNK_MAX: usize = 1792;

const CRC_TABLE: [u32; 256] = generate_crc_table();

const fn generate_crc_table() -> [u32; 256] {
    let mut table = [0u32; 256];
    let mut n = 0usize;
    while n < 256 {
        let mut c = n as u32;
        let mut i = 0usize;
        while i < 8 {
            c = if (c & 1) != 0 {
                (c >> 1) ^ 0xedb88320
            } else {
                c >> 1
            };
            i += 1;
        }
        table[n] = c;
        n += 1;
    }
    table
}

const fn hex_bytes<const N: usize>(hex: &str) -> [u8; N] {
    let bytes = hex.as_bytes();
    let mut out = [0u8; N];
    let mut i = 0usize;
    while i < N {
        let hi = hex_nibble(bytes[i * 2]);
        let lo = hex_nibble(bytes[i * 2 + 1]);
        out[i] = (hi << 4) | lo;
        i += 1;
    }
    out
}

const fn hex_nibble(b: u8) -> u8 {
    match b {
        b'0'..=b'9' => b - b'0',
        b'a'..=b'f' => b - b'a' + 10,
        b'A'..=b'F' => b - b'A' + 10,
        _ => 0,
    }
}

fn aes_cbc_encrypt(plaintext: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Vec<u8> {
    let block_size = 16usize;
    let padded_len = ((plaintext.len() + block_size - 1) / block_size) * block_size;
    let mut out = vec![0u8; padded_len];
    out[..plaintext.len()].copy_from_slice(plaintext);
    for i in plaintext.len()..padded_len {
        out[i] = 0;
    }
    let mut prev = *iv;
    for block in out.chunks_exact_mut(block_size) {
        for i in 0..block_size {
            block[i] ^= prev[i];
        }
        let mut state = [[0u8; 4]; 4];
        for i in 0..16 {
            state[i / 4][i % 4] = block[i];
        }
        let round_keys = key_expansion(key);
        add_round_key(&mut state, &round_keys[0]);
        for r in 1..10 {
            sub_bytes(&mut state);
            shift_rows(&mut state);
            mix_columns(&mut state);
            add_round_key(&mut state, &round_keys[r]);
        }
        sub_bytes(&mut state);
        shift_rows(&mut state);
        add_round_key(&mut state, &round_keys[10]);
        for i in 0..16 {
            block[i] = state[i / 4][i % 4];
        }
        prev.copy_from_slice(block);
    }
    out
}

fn aes_cbc_decrypt(ciphertext: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Vec<u8> {
    let block_size = 16usize;
    let mut out = ciphertext.to_vec();
    let mut prev = *iv;
    for (block_idx, block) in out.chunks_exact_mut(block_size).enumerate() {
        let mut state = [[0u8; 4]; 4];
        for i in 0..16 {
            state[i / 4][i % 4] = block[i];
        }
        let round_keys = key_expansion(key);
        add_round_key(&mut state, &round_keys[10]);
        for r in (1..10).rev() {
            inv_shift_rows(&mut state);
            inv_sub_bytes(&mut state);
            add_round_key(&mut state, &round_keys[r]);
            inv_mix_columns(&mut state);
        }
        inv_shift_rows(&mut state);
        inv_sub_bytes(&mut state);
        add_round_key(&mut state, &round_keys[0]);
        for i in 0..16 {
            block[i] = state[i / 4][i % 4];
        }
        for i in 0..block_size {
            block[i] ^= prev[i];
        }
        let cipher_offset = block_idx * block_size;
        prev.copy_from_slice(&ciphertext[cipher_offset..cipher_offset + block_size]);
    }
    out
}

fn key_expansion(key: &[u8; 16]) -> [[[u8; 4]; 4]; 11] {
    let mut w = [[0u8; 4]; 44];
    for i in 0..4 {
        w[i] = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
    }
    for i in 4..44 {
        let mut temp = w[i - 1];
        if i % 4 == 0 {
            temp = sub_word(rot_word(temp));
            temp[0] ^= RCON[i / 4 - 1];
        }
        for j in 0..4 {
            temp[j] ^= w[i - 4][j];
        }
        w[i] = temp;
    }
    let mut rk = [[[0u8; 4]; 4]; 11];
    for i in 0..11 {
        for j in 0..4 {
            rk[i][j] = w[4 * i + j];
        }
    }
    rk
}

const RCON: [u8; 10] = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

fn rot_word(w: [u8; 4]) -> [u8; 4] {
    [w[1], w[2], w[3], w[0]]
}

fn sub_word(w: [u8; 4]) -> [u8; 4] {
    [SBOX[w[0] as usize], SBOX[w[1] as usize], SBOX[w[2] as usize], SBOX[w[3] as usize]]
}

const SBOX: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

const INV_SBOX: [u8; 256] = [
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
    0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
    0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
    0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
    0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
    0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
    0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
    0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
    0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
    0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
    0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
];

fn add_round_key(state: &mut [[u8; 4]; 4], rk: &[[u8; 4]; 4]) {
    for i in 0..4 {
        for j in 0..4 {
            state[i][j] ^= rk[i][j];
        }
    }
}

fn sub_bytes(state: &mut [[u8; 4]; 4]) {
    for i in 0..4 {
        for j in 0..4 {
            state[i][j] = SBOX[state[i][j] as usize];
        }
    }
}

fn inv_sub_bytes(state: &mut [[u8; 4]; 4]) {
    for i in 0..4 {
        for j in 0..4 {
            state[i][j] = INV_SBOX[state[i][j] as usize];
        }
    }
}

fn shift_rows(state: &mut [[u8; 4]; 4]) {
    let mut tmp = [0u8; 4];
    for i in 1..4 {
        for j in 0..4 {
            tmp[j] = state[i][(j + i) % 4];
        }
        state[i].copy_from_slice(&tmp);
    }
}

fn inv_shift_rows(state: &mut [[u8; 4]; 4]) {
    let mut tmp = [0u8; 4];
    for i in 1..4 {
        for j in 0..4 {
            tmp[j] = state[i][(j + 4 - i) % 4];
        }
        state[i].copy_from_slice(&tmp);
    }
}

fn mix_columns(state: &mut [[u8; 4]; 4]) {
    for i in 0..4 {
        let a = state[0][i];
        let b = state[1][i];
        let c = state[2][i];
        let d = state[3][i];
        state[0][i] = gm2(a) ^ gm3(b) ^ c ^ d;
        state[1][i] = a ^ gm2(b) ^ gm3(c) ^ d;
        state[2][i] = a ^ b ^ gm2(c) ^ gm3(d);
        state[3][i] = gm3(a) ^ b ^ c ^ gm2(d);
    }
}

fn inv_mix_columns(state: &mut [[u8; 4]; 4]) {
    for i in 0..4 {
        let a = state[0][i];
        let b = state[1][i];
        let c = state[2][i];
        let d = state[3][i];
        state[0][i] = gm14(a) ^ gm11(b) ^ gm13(c) ^ gm9(d);
        state[1][i] = gm9(a) ^ gm14(b) ^ gm11(c) ^ gm13(d);
        state[2][i] = gm13(a) ^ gm9(b) ^ gm14(c) ^ gm11(d);
        state[3][i] = gm11(a) ^ gm13(b) ^ gm9(c) ^ gm14(d);
    }
}

fn gm2(x: u8) -> u8 {
    let y = (x as u16) << 1;
    if y > 0xff { (y ^ 0x1b) as u8 } else { y as u8 }
}

fn gm3(x: u8) -> u8 { gm2(x) ^ x }
fn gm9(x: u8) -> u8 { gm2(gm2(gm2(x))) ^ x }
fn gm11(x: u8) -> u8 { gm2(gm2(gm2(x))) ^ gm2(x) ^ x }
fn gm13(x: u8) -> u8 { gm2(gm2(gm2(x))) ^ gm2(gm2(x)) ^ x }
fn gm14(x: u8) -> u8 { gm2(gm2(gm2(x))) ^ gm2(gm2(x)) ^ gm2(x) }

pub fn encrypt_payload(payload: &[u8]) -> Vec<u8> {
    aes_cbc_encrypt(payload, &KEY, &IV)
}

pub fn decrypt_payload(ciphertext: &[u8]) -> Vec<u8> {
    aes_cbc_decrypt(ciphertext, &KEY, &IV)
}

pub fn crc32_custom(buf: &[u8]) -> u32 {
    let mut crc = (!CRC_SEED) & 0xffffffff;
    for &byte in buf {
        crc = CRC_TABLE[((crc ^ (byte as u32)) & 0xff) as usize] ^ (crc >> 8);
    }
    (!crc) & 0xffffffff
}

pub fn frame_command(payload: &[u8]) -> Vec<u8> {
    let encrypted = encrypt_payload(payload);
    let mut out = Vec::with_capacity(4 + encrypted.len() + 4);
    out.push(0xa3);
    out.push(0x20);
    out.extend_from_slice(&(encrypted.len() as u16).to_le_bytes());
    out.extend_from_slice(&encrypted);
    out.extend_from_slice(&crc32_custom(&encrypted).to_le_bytes());
    out
}

pub fn unframe_packet(wire: &[u8]) -> Option<Vec<u8>> {
    if wire.len() < 8 || wire[0] != 0xa3 {
        return None;
    }
    let mode = wire[1];
    if mode != 0x20 && mode != 0x00 {
        return None;
    }
    let body_len = u16::from_le_bytes([wire[2], wire[3]]) as usize;
    if wire.len() < 4 + body_len + 4 {
        return None;
    }
    let body = &wire[4..4 + body_len];
    let got_crc = u32::from_le_bytes([
        wire[4 + body_len],
        wire[4 + body_len + 1],
        wire[4 + body_len + 2],
        wire[4 + body_len + 3],
    ]);
    if got_crc != crc32_custom(body) {
        return None;
    }
    Some(if mode == 0x20 { decrypt_payload(body) } else { body.to_vec() })
}

pub fn split_ble_chunks(framed: &[u8], max_chunk_len: usize) -> Vec<Vec<u8>> {
    let mut chunks = Vec::new();
    let mut off = 0usize;
    while off < framed.len() {
        let end = (off + max_chunk_len).min(framed.len());
        chunks.push(framed[off..end].to_vec());
        off = end;
    }
    chunks
}

pub fn cmd_set_connected() -> Vec<u8> {
    frame_command(&[0x11, 0x01, 0x1e, 0x01, 0x00, 0x01])
}

pub fn cmd_get_battery() -> Vec<u8> {
    frame_command(&[0x11, 0x01, 0x0e, 0x00, 0x00])
}

pub fn cmd_query_status() -> Vec<u8> {
    frame_command(&[0x11, 0x01, 0x13, 0x00, 0x00])
}

pub fn cmd_sync_time(epoch_seconds: u32) -> Vec<u8> {
    let t = epoch_seconds + 28800;
    frame_command(&[
        0x11, 0x01, 0x19, 0x04, 0x00,
        (t & 0xff) as u8,
        ((t >> 8) & 0xff) as u8,
        ((t >> 16) & 0xff) as u8,
        ((t >> 24) & 0xff) as u8,
    ])
}

pub fn cmd_print_start(label_length_dots: u16) -> Vec<u8> {
    let w = 96u16;
    frame_command(&[
        0x11, 0x05, 0x0b, 0x07, 0x00,
        (w & 0xff) as u8, ((w >> 8) & 0xff) as u8,
        (label_length_dots & 0xff) as u8, ((label_length_dots >> 8) & 0xff) as u8,
        0x01, 0x00, 0x00,
    ])
}

pub fn cmd_print_finalize(more_pages: bool) -> Vec<u8> {
    frame_command(&[
        0x11, 0x05, 0x0c, 0x09, 0x00, 0x01, 0x02, 0x00,
        0x00, 0x00, 0x02, 0x01, 0x00,
        if more_pages { 0x01 } else { 0x00 },
    ])
}

pub fn cmd_print_data_chunks(raster: &[u8]) -> Vec<Vec<u8>> {
    let chunk_count = ((raster.len() + PIC_CHUNK_MAX - 1) / PIC_CHUNK_MAX).max(1);
    let mut frames = Vec::with_capacity(chunk_count);
    for chunk_index in 0..chunk_count {
        let start = chunk_index * PIC_CHUNK_MAX;
        let end = ((chunk_index + 1) * PIC_CHUNK_MAX).min(raster.len());
        let chunk = &raster[start..end];
        let total_len = chunk.len() + 11;
        let mut body = Vec::with_capacity(5 + 2 + 2 + 2 + 7 + chunk.len());
        body.extend_from_slice(&[0x11, 0x05, 0x0d]);
        body.extend_from_slice(&(total_len as u16).to_le_bytes());
        body.extend_from_slice(&((chunk_index + 1) as u16).to_le_bytes());
        body.extend_from_slice(&(chunk_count as u16).to_le_bytes());
        body.extend_from_slice(&[0x10, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00]);
        body.extend_from_slice(chunk);
        frames.push(frame_command(&body));
    }
    frames
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PrinterState {
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

#[derive(Debug, Clone, PartialEq)]
pub enum PrinterEvent {
    PrintComplete,
    DownloadComplete,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedNotification {
    pub marker: u8,
    pub group: u8,
    pub command: u8,
    pub payload_length: u16,
    pub body: Vec<u8>,
    pub state_patch: Option<PrinterState>,
    pub event: Option<PrinterEvent>,
}

fn battery_percent_from_status_payload(plain: &[u8]) -> u16 {
    if plain.len() < 27 {
        return 0;
    }
    let hi = plain[25] as u16;
    let lo = plain[26] as u16;
    ((hi << 8) | lo) / 10
}

pub fn parse_notification(plain: &[u8]) -> Option<ParsedNotification> {
    if plain.len() < 5 {
        return None;
    }
    let marker = plain[0];
    let group = plain[1];
    let command = plain[2];
    let payload_length = u16::from_le_bytes([plain[3], plain[4]]);
    let body = plain[5..].to_vec();
    let mut parsed = ParsedNotification {
        marker,
        group,
        command,
        payload_length,
        body,
        state_patch: None,
        event: None,
    };

    if group == 0x01 && command == 0x1f {
        let mut patch = PrinterState::default();
        if plain.len() >= 16 {
            patch.buffer_free = u32::from_le_bytes([plain[8], plain[9], plain[10], plain[11]]);
        }
        if plain.len() >= 20 {
            let flags_a = plain[15];
            patch.cover_open = (flags_a & 0x01) != 0;
            patch.lack_paper = (flags_a & 0x02) != 0;
            patch.jam = (flags_a & 0x04) != 0;
            patch.hot = (flags_a & 0x08) != 0;
            patch.no_head = (flags_a & 0x10) != 0;
            patch.high_voltage = (flags_a & 0x20) != 0;
            patch.low_voltage = (flags_a & 0x40) != 0;
            patch.printing = (flags_a & 0x80) != 0;
        }
        if plain.len() >= 21 {
            let flags_b = plain[16];
            patch.knife_error = (flags_b & 0x01) != 0;
            patch.font_error = (flags_b & 0x02) != 0;
            patch.psram_error = (flags_b & 0x04) != 0;
            patch.lack_paper_calibration = (flags_b & 0x08) != 0;
            patch.will_power_off = (flags_b & 0x10) != 0;
            patch.power_off_in_progress = (flags_b & 0x20) != 0;
            patch.battery_too_hot = (flags_b & 0x40) != 0;
        }
        if plain.len() >= 22 {
            patch.battery_bars = plain[17];
        }
        let bp = battery_percent_from_status_payload(plain);
        if bp > 0 {
            patch.battery_percent = bp;
        }
        parsed.state_patch = Some(patch);
    } else if group == 0x01 && (command == 0x0e || command == 0x0f) {
        let mut patch = PrinterState::default();
        if plain.len() >= 23 {
            patch.battery_percent = u16::from_le_bytes([plain[17], plain[18]]) / 10;
        }
        parsed.state_patch = Some(patch);
    } else if group == 0x05 && command == 0x0c {
        parsed.event = Some(PrinterEvent::PrintComplete);
        parsed.state_patch = Some(PrinterState { print_complete: true, ..PrinterState::default() });
    } else if group == 0x02 && command == 0x02 {
        parsed.event = Some(PrinterEvent::DownloadComplete);
        parsed.state_patch = Some(PrinterState { download_complete: true, ..PrinterState::default() });
    }

    Some(parsed)
}

#[cfg(feature = "python")]
pub mod python;

#[cfg(feature = "wasm")]
pub mod wasm;

pub fn apply_state_patch(state: &PrinterState, patch: &PrinterState) -> PrinterState {
    let mut s = state.clone();
    if patch.buffer_free != 0 { s.buffer_free = patch.buffer_free; }
    if patch.cover_open { s.cover_open = true; }
    if patch.lack_paper { s.lack_paper = true; }
    if patch.jam { s.jam = true; }
    if patch.hot { s.hot = true; }
    if patch.no_head { s.no_head = true; }
    if patch.high_voltage { s.high_voltage = true; }
    if patch.low_voltage { s.low_voltage = true; }
    if patch.printing { s.printing = true; }
    if patch.knife_error { s.knife_error = true; }
    if patch.font_error { s.font_error = true; }
    if patch.psram_error { s.psram_error = true; }
    if patch.lack_paper_calibration { s.lack_paper_calibration = true; }
    if patch.will_power_off { s.will_power_off = true; }
    if patch.power_off_in_progress { s.power_off_in_progress = true; }
    if patch.battery_too_hot { s.battery_too_hot = true; }
    if patch.battery_bars != 0 { s.battery_bars = patch.battery_bars; }
    if patch.battery_percent != 0 { s.battery_percent = patch.battery_percent; }
    if patch.print_complete { s.print_complete = true; }
    if patch.download_complete { s.download_complete = true; }
    s
}
