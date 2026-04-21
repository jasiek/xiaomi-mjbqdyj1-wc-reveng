import {
  NOTIFY_UUID,
  SERVICE_UUID,
  WRITE_UUID,
  type PrinterTransport,
} from "./core.ts";

export class WebBluetoothPrinterTransport implements PrinterTransport {
  private notifyCallback: ((data: Uint8Array) => void) | null = null;
  readonly device: BluetoothDevice;
  readonly server: BluetoothRemoteGATTServer;
  private readonly writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  private readonly notifyCharacteristic: BluetoothRemoteGATTCharacteristic;

  constructor(
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    writeCharacteristic: BluetoothRemoteGATTCharacteristic,
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {
    this.device = device;
    this.server = server;
    this.writeCharacteristic = writeCharacteristic;
    this.notifyCharacteristic = notifyCharacteristic;
  }

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  static async requestAndConnect(): Promise<WebBluetoothPrinterTransport> {
    if (!this.isSupported()) {
      throw new Error("WebBluetooth is not available in this browser. Use Chrome or Edge on HTTPS or localhost.");
    }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("Could not open printer GATT connection");
    }
    const service = await server.getPrimaryService(SERVICE_UUID);
    const writeCharacteristic = await service.getCharacteristic(WRITE_UUID);
    const notifyCharacteristic = await service.getCharacteristic(NOTIFY_UUID);
    const transport = new WebBluetoothPrinterTransport(device, server, writeCharacteristic, notifyCharacteristic);
    await transport.startNotifications();
    return transport;
  }

  onData(callback: (data: Uint8Array) => void): void {
    this.notifyCallback = callback;
  }

  async write(data: Uint8Array): Promise<void> {
    if ("writeValueWithoutResponse" in this.writeCharacteristic) {
      await this.writeCharacteristic.writeValueWithoutResponse(data);
      return;
    }
    await this.writeCharacteristic.writeValue(data);
  }

  async close(): Promise<void> {
    try {
      await this.notifyCharacteristic.stopNotifications();
    } catch {
      // Ignore cleanup failures on disconnect.
    }
    this.notifyCharacteristic.removeEventListener("characteristicvaluechanged", this.onNotify);
    if (this.server.connected) {
      this.device.gatt?.disconnect();
    }
  }

  private async startNotifications(): Promise<void> {
    this.notifyCharacteristic.addEventListener("characteristicvaluechanged", this.onNotify);
    await this.notifyCharacteristic.startNotifications();
  }

  private readonly onNotify = (event: Event): void => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;
    if (!value || !this.notifyCallback) {
      return;
    }
    this.notifyCallback(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)));
  };
}
