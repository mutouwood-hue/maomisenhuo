@echo off
rem ---------------------------------------------------------------------------
rem Phase 05: the specification's assets -- icons, prompt sounds and the four fonts.
rem
rem Discovered and called by tools\run-host-tests.cmd, which exports HOST_GCC,
rem HOST_ROOT, HOST_BUILD, HOST_SIZE and HOST_FW_GCC. A non-zero exit here fails
rem the whole suite.
rem
rem What this phase is for. The layout half has its own phase that proves the
rem generated tables match badge_spec.json. These assets are the other half, and
rem they fail differently: a 16x16 PNG exported with its layer hidden is still a
rem valid PNG, a WAV that lost its tail is still a valid WAV, and a font id that
rem falls back to the wrong face still draws something. Every one of those is a
rem blank or wrong pixel on the glass and a green build.
rem
rem   1. tools\gen-badge-assets.mjs --check
rem      the generated pixels and samples are current with the package, and the
rem      package's WAVs still agree sample for sample with its badge_sounds.c.
rem   2. the real badge_assets.c + badge_assets_data.c on the host, against the
rem      content checks in tests\host\test_badge_assets.c.
rem   3. the same two generated files under xtensa-esp-elf-gcc, which has warnings
rem      clang does not (see run-host-tests.cmd) and which is what the generated
rem      megabyte initialisers actually have to survive.
rem   4. tools\check-font-coverage.mjs
rem      every character in badge_spec.json and in the firmware's own strings has
rem      a glyph in main\ui\fonts. The fonts are subsets; a character outside the
rem      subset is a blank box, per string, with no other symptom.
rem
rem Step 4 runs last and its failure is remembered rather than returned
rem immediately, so a missing glyph still leaves the rest of this phase's output
rem on the screen. It is a real failure: see docs\badge-assets-integration.md.
rem
rem The LVGL stub: badge_assets.h includes "lvgl.h" for the lv_font_t type only.
rem tests\host\lvgl_font_stub\lvgl.h declares it opaque and tests\host\
rem badge_font_stub.c defines the four faces, so the host build links the real
rem module without the panel, the codec or the sdkconfig.
rem ---------------------------------------------------------------------------
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

set "FAILED="

rem --- 1. generated assets are current -----------------------------------------
echo   generated assets vs the specification package
node "%HOST_ROOT%\tools\gen-badge-assets.mjs" --check
if errorlevel 1 (
  echo FAILED: main\ui\badge_assets.c / badge_assets_data.c are stale.
  echo   Run: node tools\gen-badge-assets.mjs
  exit /b 1
)

rem --- 2. the real module, on the host -----------------------------------------
echo   badge_assets on the host
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I "%HOST_ROOT%\tests\host\lvgl_font_stub" -I "%HOST_ROOT%\main\ui" ^
  -I "%HOST_ROOT%\main" ^
  "%HOST_ROOT%\main\ui\badge_assets.c" ^
  "%HOST_ROOT%\main\ui\badge_assets_data.c" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" ^
  "%HOST_ROOT%\main\ui\badge_geom.c" ^
  "%HOST_ROOT%\tests\host\badge_font_stub.c" ^
  "%HOST_ROOT%\tests\host\test_badge_assets.c" ^
  -o "%HOST_BUILD%\test_badge_assets.exe" -lm
if errorlevel 1 exit /b 1

"%HOST_BUILD%\test_badge_assets.exe"
if errorlevel 1 exit /b 1

rem --- 3. the same generated files under the firmware's own compiler -----------
if defined HOST_FW_GCC (
  if exist "%HOST_FW_GCC%" (
    echo   generated assets under the firmware compiler
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter -I "%HOST_ROOT%\tests\host\lvgl_font_stub" ^
      -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main" ^
      -c "%HOST_ROOT%\main\ui\badge_assets.c" -o "%HOST_BUILD%\badge_assets_xtensa.o"
    if errorlevel 1 exit /b 1
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter -I "%HOST_ROOT%\tests\host\lvgl_font_stub" ^
      -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main" ^
      -c "%HOST_ROOT%\main\ui\badge_assets_data.c" -o "%HOST_BUILD%\badge_assets_data_xtensa.o"
    if errorlevel 1 exit /b 1
    echo   badge_assets.c and badge_assets_data.c: no diagnostic from xtensa-esp-elf-gcc
  )
)

rem --- 4. every character has a glyph ------------------------------------------
echo   font coverage over badge_spec.json and main\
node "%HOST_ROOT%\tools\check-font-coverage.mjs"
if errorlevel 1 (
  set "FAILED=1"
  echo.
  echo FAILED: at least one character the firmware can draw is not in main\ui\fonts.
  echo   The fonts are subsets: regenerate them with the missing characters, or
  echo   stop shipping the string. Do not narrow the check.
  echo   docs\badge-assets-integration.md lists what is missing and why.
)

if defined FAILED exit /b 1

endlocal
exit /b 0
