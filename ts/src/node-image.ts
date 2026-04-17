import sharp from "sharp";

import { packMonochromeRows, type RasterImage } from "./image.ts";

export async function imageFileToRaster(path: string, widthDots = 96): Promise<RasterImage> {
  const { data, info } = await sharp(path)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .resize({ width: widthDots })
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return packMonochromeRows(new Uint8Array(data), info.width, info.height, info.channels);
}
