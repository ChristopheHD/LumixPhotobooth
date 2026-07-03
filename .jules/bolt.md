## 2024-11-20 - Migrate to Async File System Operations for UI Responsiveness
**Learning:** Using synchronous `fs` methods (`fs.writeFileSync`, `fs.mkdirSync`) directly in the main Electron renderer process causes severe UI jank by blocking the event loop.
**Action:** When handling large file writes, like photo downloads, always utilize `fs.promises` combined with `async`/`await` to offload I/O operations and keep the UI responsive.
