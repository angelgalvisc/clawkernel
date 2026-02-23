/**
 * @clawkernel/sdk — Transport Abstraction
 *
 * StdioTransport: readline stdin → handler, JSON.stringify → stdout.
 */

import { createInterface } from "node:readline";

export interface Transport {
  onMessage(handler: (raw: string) => void): void;
  send(obj: Record<string, unknown>): void;
  close(): void;
}

export function createStdioTransport(): Transport {
  const rl = createInterface({ input: process.stdin, terminal: false });
  let messageHandler: ((raw: string) => void) | null = null;

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (trimmed && messageHandler) {
      messageHandler(trimmed);
    }
  });

  return {
    onMessage(handler: (raw: string) => void): void {
      messageHandler = handler;
    },

    send(obj: Record<string, unknown>): void {
      process.stdout.write(JSON.stringify(obj) + "\n");
    },

    close(): void {
      rl.close();
    },
  };
}
