# User-supplied app icon

`app-icon-master.png` is the user-maintained source of truth for the installed application icon.
The current 1134px master is intentionally retained byte for byte at its original resolution,
composition, background, safe area and framing.

The browser-facing files are full-canvas, high-quality resamples of that master:

- `icon-192.png` — standard web app icon;
- `icon-512.png` — standard web app icon;
- `icon-maskable-512.png` — maskable icon using the approved safe area unchanged;
- `apple-touch-icon.png` — 180px iOS icon;
- `src/app/icon.png` — Next.js file-based favicon/app icon.

Regenerate every derivative directly from the master with full-canvas Lanczos resampling.
Do not crop, enlarge, reposition, sharpen, add transparency or create a separate maskable
composition. Keep the output family in opaque RGB PNG and replace it as one unit.

Do not add a service worker or imply offline support as part of an icon replacement.
Browser tabs may reduce `src/app/icon.png` to 16px or 32px; keep the same user-supplied
composition rather than inventing a parallel simplified identity.
