## 2025-05-24 - Photobooth Async Feedback Pattern
**Learning:** For physical-interaction based apps (like a photobooth), visual and state feedback (countdown, flash, disabled states) are critical to prevent double-triggers and provide user confidence during slow async camera operations.
**Action:** Always implement a clear "in-progress" state and disable trigger elements when performing long-running hardware-interfacing tasks.

## 2025-05-24 - Accessibility and Discoverability in Photobooth UIs
**Learning:** In headless or specialized UI environments like photobooths, visual keyboard shortcut hints (e.g., "Press Space") and `aria-live` announcements for time-sensitive events (like countdowns) significantly improve accessibility and user confidence.
**Action:** Include persistent shortcut hints for primary actions and use `aria-live="assertive"` for countdowns to support screen reader users.

## 2025-05-24 - Aspect Ratio and Visual Comfort
**Learning:** For a photobooth, users expect to see themselves as the camera sees them. Using `object-fit: contain` with a black background ensures that the camera's natural aspect ratio is respected without distortion, even when the container dimensions differ, providing a more professional and visually comfortable experience.
**Action:** Use `object-fit: contain` for camera previews to maintain correct proportions while filling the available viewport.
## 2026-07-01 - Physical Input Visual Feedback
**Learning:** For interfaces where a physical hardware trigger (like a Spacebar) is an alternative to on-screen buttons, adding a visual depressed/pressed state to the on-screen hint when the hardware trigger is used provides a satisfying connection between the physical and digital worlds. Furthermore, wrapping progress states in a visually distinct animation (like a spinner) inside the button ensures users understand the app is working, rather than just changing a flat text string.
**Action:** When adding physical keyboard shortcuts or hardware triggers for primary actions, create a corresponding visual micro-interaction on the UI hint that maps to the physical press.
