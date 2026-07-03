## 2025-05-24 - Photobooth Async Feedback Pattern
**Learning:** For physical-interaction based apps (like a photobooth), visual and state feedback (countdown, flash, disabled states) are critical to prevent double-triggers and provide user confidence during slow async camera operations.
**Action:** Always implement a clear "in-progress" state and disable trigger elements when performing long-running hardware-interfacing tasks.

## 2025-05-24 - Accessibility and Discoverability in Photobooth UIs
**Learning:** In headless or specialized UI environments like photobooths, visual keyboard shortcut hints (e.g., "Press Space") and `aria-live` announcements for time-sensitive events (like countdowns) significantly improve accessibility and user confidence.
**Action:** Include persistent shortcut hints for primary actions and use `aria-live="assertive"` for countdowns to support screen reader users.

## 2025-05-24 - Aspect Ratio and Visual Comfort
**Learning:** For a photobooth, users expect to see themselves as the camera sees them. Using `object-fit: contain` with a black background ensures that the camera's natural aspect ratio is respected without distortion, even when the container dimensions differ, providing a more professional and visually comfortable experience.
**Action:** Use `object-fit: contain` for camera previews to maintain correct proportions while filling the available viewport.

## 2025-05-24 - Semantic Roles and Dynamic Status
**Learning:** Custom interactive elements (like `<li>` elements acting as buttons) require `role="button"` and `tabIndex=0` to be fully accessible to screen readers, preventing them from being read as generic list items. Furthermore, wrapping dynamic status changes in a container with `aria-live="polite"` ensures visually impaired users are kept informed of background updates automatically.
**Action:** Always verify custom interactive elements have correct semantic roles and use `aria-live` for status text that updates dynamically without user interaction.

## 2026-07-01 - Correlating UI Hints with ARIA Shortcuts
**Learning:** If the visual UI displays keyboard shortcut hints (like "Press Space for new photo"), screen reader users miss out on this discoverability if the programmatic `aria-keyshortcuts` attribute is absent on the corresponding interactive elements.
**Action:** Always ensure that buttons with visible keyboard shortcut hints in the UI have a corresponding `aria-keyshortcuts` attribute to ensure parity between visual and auditory accessibility.
## 2025-05-24 - Visual Async Feedback in Photobooth UIs
**Learning:** In highly physical or constrained environments, textual status updates (like "Searching..." or "Capturing...") may not provide enough visual feedback that an application is actively working, potentially leading to user frustration.
**Action:** When a button or container goes into a loading or waiting state for a hardware/network action, provide a continuously animated visual cue (like a `.spinner`) alongside the text to clearly indicate ongoing background processing.
