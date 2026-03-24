# CKP-A2A Compatibility Report

Target: node /Users/agc/Documents/clawkernel/reference/nanoclaw-bridge/dist/bridge.js
Date: 2026-03-24T06:49:35.514Z

PASS: 0
FAIL: 8
SKIP: 0
ERROR: 0
Overall: A2A-NON-COMPATIBLE

## Detailed Results

- [FAIL] TV-A2A-01 Task Create — Expected success but got error: Method not found: claw.task.create
- [FAIL] TV-A2A-02 Task Get — Expected success but got error: Method not found: claw.task.get
- [FAIL] TV-A2A-03 Task List — Expected success but got error: Method not found: claw.task.list
- [FAIL] TV-A2A-04 Task Subscribe — Expected success but got error: Method not found: claw.task.subscribe
- [FAIL] TV-A2A-05 Task Cancel — Expected success but got error: Method not found: claw.task.cancel
- [FAIL] TV-A2A-06 Task Create Missing Payload — Expected error code -32602 but got -32601
- [FAIL] TV-A2A-07 Task Get Missing task_id — Expected error code -32602 but got -32601
- [FAIL] TV-A2A-08 Task Unknown ID — Expected error code -32602 but got -32601
