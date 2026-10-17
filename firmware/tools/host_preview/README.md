# Production LVGL offline preview

This harness renders the current candidate's real `badge_pages.c` (included
unchanged) and links its original `badge_scene.c`, gesture code, four fonts,
recovery images and full 66-frame I8 registry against the installed LVGL 9.5
software renderer. It does not repaint mock pages or execute HTML/HTTP/browser
content. No network, device, serial or ADB is used.

BSP, NVS preferences, app description, pet state and bond interfaces are explicit
memory-only stubs. Synthetic IDs/statuses/passkey are not real hardware data.
Unknown clock and battery remain the production `--` placeholders. Hardware
brightness is recorded, not applied to framebuffer pixels. No durable storage,
security, touch route, electrical properties, real-panel color or boot behavior
is validated. Static production navigation helpers select layout states; this is
not a full input or gameplay integration test.

Run only in the coordinator's host-build window:

```sh
python3 firmware/tools/host_preview/run_preview.py \
  --cases pair,guide_1,main_a,care_menu,settings \
  --output artifacts/firmware-game-preview/NEW-UNIQUE-RUN
```

Only this directory's `build/` and the allowed artifacts directory receive output.
No downloads/system packages are needed. Build concurrency is capped at two.
Each renderer subprocess is bounded by 30 seconds. Reuse an existing build with
`--no-build` only if its source manifest is known unchanged. Completed runs refuse
to overwrite their manifest. Images are 466x466 RGB565 flushes converted to PNG,
with pixels outside the physical circular aperture blacked out; the untouched
square RGB565 flush and visible label bounds/glyph diagnostics are retained.

The script supports 23 *fixture states*, which are not the reference's 23 screens.
Current production represents 12/23 reference screen classes, with qualified
voice/AOD/day-ring behavior; eleven have no production page. Only five initial
fixtures were requested for this delivery. The manifest distinguishes production
representations from actual PNG count. The contact sheet order is in the manifest.
No screenshot is generated for an absent page. No exact reference-match claim or
user approval to replace their original firmware is implied. Original source
arrival/comparison takes priority over expanding this candidate.
