import { PrinterSession, type PrinterState } from "./core.ts";
import { packMonochromeRows, type RasterImage } from "./image.ts";
import { WebBluetoothPrinterTransport } from "./browser-ble.ts";

export class WebBluetoothPrinter {
  readonly session: PrinterSession;
  readonly transport: WebBluetoothPrinterTransport;

  constructor(
    session: PrinterSession,
    transport: WebBluetoothPrinterTransport
  ) {
    this.session = session;
    this.transport = transport;
  }

  get deviceName(): string {
    return this.transport.device.name ?? this.transport.device.id;
  }

  get state(): PrinterState {
    return this.session.state;
  }

  async printCanvas(canvas: HTMLCanvasElement, morePages = false): Promise<void> {
    const image = canvasToRaster(canvas);
    await this.session.printRaster(image.raster, image.heightDots, morePages);
  }

  async downloadCanvas(canvas: HTMLCanvasElement): Promise<void> {
    const image = canvasToRaster(canvas);
    await this.session.downloadRaster(image.raster, image.heightDots);
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
  }
}

export async function connectWebBluetoothPrinter(): Promise<WebBluetoothPrinter> {
  const transport = await WebBluetoothPrinterTransport.requestAndConnect();
  const session = new PrinterSession(transport);
  await session.initialize();
  return new WebBluetoothPrinter(session, transport);
}

export function webBluetoothSupported(): boolean {
  return WebBluetoothPrinterTransport.isSupported();
}

export function canvasToRaster(canvas: HTMLCanvasElement): RasterImage {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return packMonochromeRows(image.data, canvas.width, canvas.height, 4);
}

export { WebBluetoothPrinterTransport };
