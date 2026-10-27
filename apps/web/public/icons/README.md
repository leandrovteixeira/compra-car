# Temporary unbranded icons (2026-10-27)

The `neutral-*` PNG family and `src/app/icon.png` use a generic car pictogram on white, with the same full-canvas composition and safe area for regular, maskable, Apple and browser icons. They contain no wordmark or squircle logo. The prior user-maintained master and its derivatives below remain available for later brand decisions; they are not referenced by the current manifest or metadata.

# Previous user-supplied app icon (retained)

`app-icon-master.png` is the user-maintained source of truth for the installed application icon.
The current 1134px master is intentionally retained byte for byte at its original resolution,
composition, background, safe area and framing.

The previous browser-facing files are full-canvas, high-quality resamples of that master:

- `icon-192.png` — standard web app icon;
- `icon-512.png` — standard web app icon;
- `icon-maskable-512.png` — maskable icon using the approved safe area unchanged;
- `apple-touch-icon.png` — 180px iOS icon;
- the previous `src/app/icon.png` — replaced temporarily by the neutral icon.

Regenerate every derivative directly from the master with full-canvas Lanczos resampling.
For any future restoration, do not crop, enlarge, reposition, sharpen, add transparency or create a separate maskable composition. Keep the output family in opaque RGB PNG and replace it as one unit.

Do not add a service worker or imply offline support as part of an icon replacement.
Browser tabs may reduce `src/app/icon.png` to 16px or 32px; preserve the user-supplied composition if it is restored.
