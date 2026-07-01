## 2023-10-27 - [High-Frequency UDP Packet Parsing]
**Learning:** In high-frequency Node.js loops (like parsing UDP video streams at 60fps), iterating byte-by-byte using V8 JavaScript `for` loops is a measurable bottleneck.
**Action:** Replace JS loops with `Buffer.prototype.indexOf(Buffer.from(...))` to push the work down to optimized C++ native code, pre-allocating the search buffer outside the hot path to avoid GC churn.

## 2023-10-27 - [Network Polling on Constrained Hardware]
**Learning:** Using `setInterval` for open-loop network requests (like a 1s camera heartbeat) can cause overlapping execution, request stacking, and CPU lockups if the network is slow or the hardware is constrained.
**Action:** Replace `setInterval` with chained `setTimeout` that only schedules the next execution *after* the callbacks/promises from the current network requests have resolved.
