/**
 * Minimal L1 CKP Agent — ~5 lines of user code.
 * Passes all 13 L1 test vectors.
 */

import { createAgent } from "../src/index.js";

const agent = createAgent({
  name: "l1-test-agent",
  version: "1.0.0",
});

agent.listen();
