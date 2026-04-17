export interface RasterImage {
  raster: Uint8Array;
  heightDots: number;
  widthDots: number;
}

export function packMonochromeRows(
  pixels: Uint8Array,
  widthDots: number,
  heightDots: number,
  bytesPerPixel: number
): RasterImage {
  if (widthDots % 8 !== 0) {
    throw new Error(`Printer width must be divisible by 8, got ${widthDots}`);
  }
  const bytesPerRow = widthDots / 8;
  const out = new Uint8Array(bytesPerRow * heightDots);
  for (let y = 0; y < heightDots; y += 1) {
    for (let x = 0; x < widthDots; x += 1) {
      const pixel = pixels[(y * widthDots + x) * bytesPerPixel]!;
      if (pixel < 128) {
        out[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { raster: out, heightDots, widthDots };
}
