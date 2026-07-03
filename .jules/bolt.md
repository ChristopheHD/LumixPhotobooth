## 2023-10-27 - [High-Frequency UDP Packet Parsing]
**Learning:** In high-frequency Node.js loops (like parsing UDP video streams at 60fps), iterating byte-by-byte using V8 JavaScript `for` loops is a measurable bottleneck.
**Action:** Replace JS loops with `Buffer.prototype.indexOf(Buffer.from(...))` to push the work down to optimized C++ native code, pre-allocating the search buffer outside the hot path to avoid GC churn.

## 2023-10-27 - [Network Polling on Constrained Hardware]
**Learning:** Using `setInterval` for open-loop network requests (like a 1s camera heartbeat) can cause overlapping execution, request stacking, and CPU lockups if the network is slow or the hardware is constrained.
**Action:** Replace `setInterval` with chained `setTimeout` that only schedules the next execution *after* the callbacks/promises from the current network requests have resolved.
## 2024-05-24 - Implicit String Concatenation overhead on Network Streams
**Learning:** Node.js stream chunks are `Buffer` objects. Using `str += chunk` inside `.on('data')` forces V8 to convert the buffer to a string and allocate a new string in memory for every single chunk, creating immense GC pressure on slow, constrained hardware (like the Raspberry Pi this app targets).
**Action:** Use an array `data.push(chunk)` and concatenate at the end with `Buffer.concat(data).toString('utf8')` to reduce memory allocations and GC thrashing.

## 2024-05-24 - Unused UI libraries in constrained environments
**Learning:** Having `var $ = require('jquery');` in a file like `Controller.js`, even if totally unused, forces Electron/Node to read, parse, and execute the entire library synchronously during app startup, causing measurable delay on constrained hardware.
**Action:** Always manually audit `require()` statements to ensure no unused large libraries are included, even if a tree-shaker isn't present to do it automatically.

## 2024-05-25 - [Image Rendering Backpressure on Constrained Hardware]
**Learning:** Pushing high-frequency UDP frames (e.g. 60fps) into `img.src` synchronously via `URL.createObjectURL` without waiting for the browser to decode/paint causes severe queueing, memory churn (from unreleased Blobs/URLs), and CPU spikes as the browser struggles to keep up.
**Action:** Use `img.onload` and `img.onerror` to defer setting the lock flag (`isUpdating = false`) and revoking the old object URL. This naturally throttles the render loop to the browser's actual decoding capability, dropping unneeded intermediate frames.
## 2024-05-24 - Avoid Redundant String Methods in Loops
**Learning:** Calling `.toLowerCase()` repeatedly on the same string within a tight loop creates unnecessary string allocations and CPU overhead, especially when short-circuiting logical operators still evaluate the method multiple times.
**Action:** When evaluating multiple conditions against a transformed string (e.g., lowercased values), cache the transformed result in a local variable before performing the comparisons.
