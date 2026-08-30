# User-supplied temporary app icon

`app-icon-master.png` is the user-maintained source of truth for the installed application icon.
The current 1134px master is intentionally retained byte for byte at its original resolution,
composition, background, safe area and framing.

The browser-facing files are full-canvas, high-quality resamples of that master:

- `icon-192.png` — standard web app icon;
- `icon-512.png` — standard web app icon;
- `icon-maskable-512.png` — maskable icon using the approved safe area unchanged;
- `apple-touch-icon.png` — 180px iOS icon;
- `src/app/icon.png` — Next.js file-based favicon/app icon.

Do not crop, enlarge or reposition the car. Replace this small asset family together
when the definitive name and visual identity are approved. Do not add a service worker
or imply offline support as part of an icon replacement.

Known limitation: browser tabs may reduce `src/app/icon.png` to 16px or 32px, where the
car's fine detail becomes less legible. Keep the same approved image for now; do not
invent a parallel monogram or simplified identity without approval.
