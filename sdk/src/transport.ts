/**
 * @clawkernel/sdk — Transport Abstraction
 *
 * StdioTransport: readline stdin -> handler, JSON.stringify -> stdout.
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
  let writeFailed = false;

  const onStdoutError = (): void => {
    writeFailed = true;
  };

  process.stdout.on("error", onStdoutError);

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
      if (writeFailed) return;

      let payload = "";
      try {
        payload = JSON.stringify(obj) + "\n";
      } catch {
        return;
      }

      try {
        process.stdout.write(payload);
      } catch {
        writeFailed = true;
        try {
          process.stderr.write("[ckp-sdk] transport write failed\n");
        } catch {
          // no-op
        }
      }
    },

    close(): void {
      rl.close();
      process.stdout.off("error", onStdoutError);
    },
  };
}
