# Offline v3 C/LVGL harness

Run `python3 artifacts/firmware-local-v3/source/tools/host_preview/run_preview.py --output artifacts/firmware-local-v3/preview/NEW_UNIQUE_NAME --jobs 2`. Uses local LVGL and actual production UI/scene/gesture C. Uses synthetic memory domain/peer/NVS/BSP adapters. Never accesses hardware, network, browser, or GUI.

Build cache is `build-v3`; cloned `build` belongs to baseline v2 and is not usable here. Current acceptance and limits: `artifacts/firmware-local-v3/docs/UI-HANDOFF.md`. Current standalone classifier: `source/tools/test_gesture_v3.py`.
