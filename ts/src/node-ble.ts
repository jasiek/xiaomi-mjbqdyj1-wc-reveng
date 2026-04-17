import noble from "@abandonware/noble";

import { NOTIFY_UUID, SERVICE_UUID, type PrinterTransport, WRITE_UUID } from "./core.ts";

type NoblePeripheral = any;
type NobleCharacteristic = any;

function normalizeUuid(uuid: string): string {
  return uuid.replaceAll("-", "").toLowerCase();
}

function shortUuid(uuid: string): string {
  const normalized = normalizeUuid(uuid);
  if (normalized.length === 4) {
    return normalized;
  }
  if (normalized.length === 32 && normalized.startsWith("0000") && normalized.endsWith("00001000800000805f9b34fb")) {
    return normalized.slice(4, 8);
  }
  return normalized;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DiscoverPrinterOptions {
  address?: string;
  nameIncludes?: string;
  timeoutMs?: number;
}

export interface NodeBleDebugLogger {
  (message: string): void;
}

export interface GattCharacteristicInfo {
  uuid: string;
  properties: string[];
}

export interface GattServiceInfo {
  uuid: string;
  characteristics: GattCharacteristicInfo[];
}

export interface GattSnapshot {
  identifier: string;
  rawAddress: string;
  localName: string;
  services: GattServiceInfo[];
}

export function getPeripheralIdentifier(peripheral: NoblePeripheral): string {
  const address = peripheral.address?.trim();
  if (address && address !== "unknown") {
    return address;
  }
  return peripheral.id;
}

export class NodeBlePrinterTransport implements PrinterTransport {
  private notifyCallback: ((data: Uint8Array) => void) | null = null;
  readonly peripheral: NoblePeripheral;
  readonly writeCharacteristic: NobleCharacteristic;
  readonly notifyCharacteristic: NobleCharacteristic;
  readonly log?: NodeBleDebugLogger;

  constructor(
    peripheral: NoblePeripheral,
    writeCharacteristic: NobleCharacteristic,
    notifyCharacteristic: NobleCharacteristic,
    log?: NodeBleDebugLogger
  ) {
    this.peripheral = peripheral;
    this.writeCharacteristic = writeCharacteristic;
    this.notifyCharacteristic = notifyCharacteristic;
    this.log = log;
  }

  static async discover(options: DiscoverPrinterOptions = {}): Promise<NoblePeripheral> {
    const address = options.address?.toLowerCase();
    const nameIncludes = options.nameIncludes?.toLowerCase() ?? "printer";
    const timeoutMs = options.timeoutMs ?? 15_000;

    await waitForPoweredOn();

    return await new Promise<NoblePeripheral>(async (resolve, reject) => {
      const onDiscover = async (peripheral: NoblePeripheral) => {
        const localName = peripheral.advertisement?.localName?.toLowerCase() ?? "";
        const peripheralIdentifier = getPeripheralIdentifier(peripheral).toLowerCase();
        const matchesAddress = address !== undefined && peripheralIdentifier === address;
        const matchesName = address === undefined && localName.includes(nameIncludes);
        if (!matchesAddress && !matchesName) {
          return;
        }
        cleanup();
        try {
          await noble.stopScanningAsync();
        } catch {
          // Ignore stop failures during discovery teardown.
        }
        resolve(peripheral);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        noble.removeListener("discover", onDiscover);
      };

      const timeout = setTimeout(async () => {
        cleanup();
        try {
          await noble.stopScanningAsync();
        } catch {
          // Ignore stop failures after timeout.
        }
        reject(new Error("No matching BLE printer found"));
      }, timeoutMs);

      noble.on("discover", onDiscover);
      await noble.startScanningAsync([], false);
    });
  }

  static async connect(peripheral: NoblePeripheral, log?: NodeBleDebugLogger): Promise<NodeBlePrinterTransport> {
    log?.(`connecting to ${getPeripheralIdentifier(peripheral)} (${peripheral.advertisement?.localName ?? "<unknown>"})`);
    await peripheral.connectAsync();
    log?.("connected, discovering service FE95");
    const services = await peripheral.discoverServicesAsync([shortUuid(SERVICE_UUID)]);
    const service = services[0];
    if (!service) {
      const snapshot = await snapshotGatt(peripheral);
      throw new Error(
        `Service ${SERVICE_UUID} not found on printer. Discovered services: ${formatServiceList(snapshot)}`
      );
    }
    log?.(`service discovered: ${service.uuid}, discovering characteristics ${shortUuid(WRITE_UUID)} and ${shortUuid(NOTIFY_UUID)}`);
    const characteristics = await service.discoverCharacteristicsAsync([
      shortUuid(WRITE_UUID),
      shortUuid(NOTIFY_UUID)
    ]);
    const writeCharacteristic = characteristics.find(
      (characteristic: NobleCharacteristic) => shortUuid(characteristic.uuid) === shortUuid(WRITE_UUID)
    );
    const notifyCharacteristic = characteristics.find(
      (characteristic: NobleCharacteristic) => shortUuid(characteristic.uuid) === shortUuid(NOTIFY_UUID)
    );
    if (!writeCharacteristic || !notifyCharacteristic) {
      const found = characteristics.map((characteristic: NobleCharacteristic) => characteristic.uuid).sort();
      throw new Error(
        `Printer characteristics not found in ${SERVICE_UUID}. ` +
        `Expected ${shortUuid(WRITE_UUID)} and ${shortUuid(NOTIFY_UUID)}, found: ${found.join(", ") || "<none>"}`
      );
    }
    log?.(
      `characteristics ready: write=${writeCharacteristic.uuid} notify=${notifyCharacteristic.uuid}, subscribing to notifications`
    );
    const transport = new NodeBlePrinterTransport(peripheral, writeCharacteristic, notifyCharacteristic, log);
    await transport.startNotifications();
    log?.("notification subscription active");
    return transport;
  }

  onData(callback: (data: Uint8Array) => void): void {
    this.notifyCallback = callback;
  }

  async write(data: Uint8Array): Promise<void> {
    this.log?.(`write ${data.length} bytes: ${toHexPreview(data)}`);
    await this.writeCharacteristic.writeAsync(Buffer.from(data), true);
  }

  async close(): Promise<void> {
    this.log?.("closing BLE transport");
    try {
      await this.notifyCharacteristic.unsubscribeAsync();
    } catch {
      // Ignore unsubscribe failures on disconnect paths.
    }
    this.notifyCharacteristic.removeAllListeners("data");
    if (this.peripheral.state === "connected") {
      await this.peripheral.disconnectAsync();
    }
  }

  private async startNotifications(): Promise<void> {
    this.notifyCharacteristic.on("data", (data: Buffer, isNotification: boolean) => {
      if (isNotification && this.notifyCallback) {
        this.log?.(`notify ${data.length} bytes: ${toHexPreview(new Uint8Array(data))}`);
        this.notifyCallback(new Uint8Array(data));
      }
    });
    await this.notifyCharacteristic.subscribeAsync();
  }
}

export async function shutdownNodeBle(): Promise<void> {
  try {
    await noble.stopScanningAsync();
  } catch {
    // Ignore shutdown races when scanning is already stopped.
  }
}

export async function snapshotGatt(peripheral: NoblePeripheral): Promise<GattSnapshot> {
  const services = await peripheral.discoverServicesAsync([]);
  const serviceSnapshots: GattServiceInfo[] = [];

  for (const service of services) {
    const characteristics = await service.discoverCharacteristicsAsync([]);
    serviceSnapshots.push({
      uuid: service.uuid,
      characteristics: characteristics.map((characteristic: NobleCharacteristic) => ({
        uuid: characteristic.uuid,
        properties: [...(characteristic.properties ?? [])].sort()
      }))
    });
  }

  return {
    identifier: getPeripheralIdentifier(peripheral),
    rawAddress: peripheral.address ?? "",
    localName: peripheral.advertisement?.localName ?? "",
    services: serviceSnapshots.sort((a, b) => a.uuid.localeCompare(b.uuid))
  };
}

function formatServiceList(snapshot: GattSnapshot): string {
  return snapshot.services.map((service) => service.uuid).join(", ") || "<none>";
}

function toHexPreview(data: Uint8Array, maxBytes = 32): string {
  const bytes = Array.from(data.slice(0, maxBytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return data.length > maxBytes ? `${bytes}...` : bytes;
}

async function waitForPoweredOn(timeoutMs = 10_000): Promise<void> {
  if (noble.state === "poweredOn") {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onStateChange = (state: string) => {
      if (state === "poweredOn") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      noble.removeListener("stateChange", onStateChange);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`BLE adapter not ready, state=${noble.state}`));
    }, timeoutMs);

    noble.on("stateChange", onStateChange);
  });
  await delay(100);
}
