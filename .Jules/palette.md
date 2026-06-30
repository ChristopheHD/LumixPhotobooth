## 2025-05-24 - Photobooth Async Feedback Pattern
**Learning:** For physical-interaction based apps (like a photobooth), visual and state feedback (countdown, flash, disabled states) are critical to prevent double-triggers and provide user confidence during slow async camera operations.
**Action:** Always implement a clear "in-progress" state and disable trigger elements when performing long-running hardware-interfacing tasks.

## 2025-05-24 - Accessibility and Discoverability in Photobooth UIs
**Learning:** In headless or specialized UI environments like photobooths, visual keyboard shortcut hints (e.g., "Press Space") and `aria-live` announcements for time-sensitive events (like countdowns) significantly improve accessibility and user confidence.
**Action:** Include persistent shortcut hints for primary actions and use `aria-live="assertive"` for countdowns to support screen reader users.
