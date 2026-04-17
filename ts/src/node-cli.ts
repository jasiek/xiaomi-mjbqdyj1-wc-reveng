#!/usr/bin/env node

import process from "node:process";

import { cmdQueryStatus, PrinterSession } from "./core.ts";
import { getPeripheralIdentifier, NodeBlePrinterTransport, shutdownNodeBle, snapshotGatt } from "./node-ble.ts";
import { imageFileToRaster } from "./node-image.ts";

interface CliArgs {
  command: "scan" | "status" | "print" | "gatt";
  imagePath?: string;
  address?: string;
  nameIncludes?: string;
  debug: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const log = args.debug ? (message: string) => console.error(`[ble] ${message}`) : undefined;

  if (args.command === "scan") {
    try {
      const peripheral = await NodeBlePrinterTransport.discover({
        address: args.address,
        nameIncludes: args.nameIncludes
      });
      console.log(`found ${peripheral.advertisement?.localName ?? "<unknown>"} id=${getPeripheralIdentifier(peripheral)} raw_address=${peripheral.address ?? ""}`);
      return;
    } finally {
      await shutdownNodeBle();
    }
  }

  const peripheral = await NodeBlePrinterTransport.discover({
    address: args.address,
    nameIncludes: args.nameIncludes
  });

  if (args.command === "gatt") {
    try {
      await peripheral.connectAsync();
      const snapshot = await snapshotGatt(peripheral);
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    } finally {
      if (peripheral.state === "connected") {
        await peripheral.disconnectAsync();
      }
      await shutdownNodeBle();
    }
  }

  const transport = await NodeBlePrinterTransport.connect(peripheral, log);
  const session = new PrinterSession(transport);

  try {
    await session.initialize();

    if (args.command === "status") {
      await session.sendLogicalFrame(cmdQueryStatus());
      await sleep(1500);
      console.log(JSON.stringify(session.state, null, 2));
      return;
    }

    const imagePath = args.imagePath ?? "../lolz.png";
    const image = await imageFileToRaster(imagePath);
    console.log(`printing ${imagePath}: ${image.raster.length} bytes, ${image.heightDots} rows`);
    await session.printRaster(image.raster, image.heightDots);
    console.log("print_complete received");
  } finally {
    await transport.close();
    await shutdownNodeBle();
    if (args.debug) {
      logActiveResources();
    }
  }
}

function parseArgs(argv: string[]): CliArgs {
  let address: string | undefined;
  let nameIncludes: string | undefined;
  let debug = false;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--address" || arg === "-a") {
      address = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--name" || arg === "-n") {
      nameIncludes = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--debug") {
      debug = true;
      continue;
    }
    positional.push(arg);
  }

  const command = (positional[0] ?? "print") as CliArgs["command"];
  if (command !== "scan" && command !== "status" && command !== "print" && command !== "gatt") {
    throw new Error(`Unknown command: ${command}`);
  }

  return {
    command,
    imagePath: positional[1],
    address,
    nameIncludes,
    debug
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logActiveResources(): void {
  const resources = typeof process.getActiveResourcesInfo === "function"
    ? process.getActiveResourcesInfo()
    : [];
  const handles = typeof (process as any)._getActiveHandles === "function"
    ? (process as any)._getActiveHandles().map((handle: { constructor?: { name?: string } }) => handle?.constructor?.name ?? "<unknown>")
    : [];
  console.error(`[ble] active resources after shutdown: ${JSON.stringify(resources)}`);
  console.error(`[ble] active handles after shutdown: ${JSON.stringify(handles)}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
