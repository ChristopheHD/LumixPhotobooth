## 2026-06-30 - Render Loop Efficiency
**Learning:** Frequent allocations in high-frequency loops (like `requestAnimationFrame`) can cause unnecessary GC pressure. Binding methods once in the constructor is a better pattern. Additionally, matching the UI render rate to the actual source data rate (camera frames) significantly reduces CPU/GPU overhead without affecting perceived smoothness.
**Action:** Always check if a new data frame is available before triggering expensive canvas redraws.

## 2024-05-15 - [WifiSetup Overlapping Scans]
**Learning:** Naively polling an OS-level operation (like `wifi.scan` using native networking commands) with `setInterval` without waiting for the promise/callback to complete can lead to massive CPU lockups and overlapping child processes, especially on weaker hardware like a Raspberry Pi.
**Action:** For all slow or child-process-spawning async operations, use recursive/chained scheduling (`setTimeout` inside the callback/promise `.then()`) instead of open-loop polling via `setInterval`.
