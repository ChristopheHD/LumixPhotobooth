## 2025-05-14 - Optimized Livestream Pipeline
**Learning:** Base64 conversion of binary image data for high-frequency updates (livestreaming) is extremely inefficient due to the encoding overhead and subsequent decoding by the browser. Moving to a binary-first pipeline using `createImageBitmap` significantly reduces main-thread latency and memory churn. Pre-allocating buffers for UDP packet handling further reduces GC pressure in long-running sessions.
**Action:** Always prefer binary formats (`ArrayBuffer`, `Blob`) over Base64 for data-intensive real-time applications. Use `createImageBitmap` for off-main-thread image decoding in Electron/browser environments.

## 2025-05-24 - Hardware-Accelerated Image Rendering on Legacy GPUs
**Learning:** For low-power legacy GPUs (like AMD RV710), standard `Canvas2D` rendering can still be sluggish due to internal API overhead. Switching to an `<img>` tag updated with `URL.createObjectURL(blob)` leverages browser-internal multi-threaded image pipelines and GPU optimizations better than canvas. Forcing hardware acceleration via `--ignore-gpu-blocklist` is also essential for older hardware typically blacklisted by Chromium.
**Action:** Prioritize `<img>` over `<canvas>` for simple high-frequency livestream displays on constrained hardware. Always explicitly revoke object URLs to prevent memory leaks.
