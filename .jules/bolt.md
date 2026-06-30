## 2026-06-30 - Render Loop Efficiency
**Learning:** Frequent allocations in high-frequency loops (like `requestAnimationFrame`) can cause unnecessary GC pressure. Binding methods once in the constructor is a better pattern. Additionally, matching the UI render rate to the actual source data rate (camera frames) significantly reduces CPU/GPU overhead without affecting perceived smoothness.
**Action:** Always check if a new data frame is available before triggering expensive canvas redraws.
