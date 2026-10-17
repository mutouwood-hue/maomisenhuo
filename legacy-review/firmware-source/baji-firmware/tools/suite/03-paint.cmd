@echo off
rem ---------------------------------------------------------------------------
rem Phase 03-paint: badge_paint's pixels, and the firmware compiler's opinion of
rem them.
rem
rem This is the phase the whole host-test seam in badge_paint.c exists for. The
rem painter is the one module in the badge UI that has to be judged by what ends up
rem on the glass -- an arc that stops five degrees early, a ring whose segments
rem leave a lit pixel in every gap, a battery fill that is one pixel too wide, a
rem 24-hour ring whose cat band uses Sleep where Work belongs: all of those pass a
rem "did it draw anything" check and all of them are visible defects on a 466x466
rem AMOLED. So the test binds badge_paint's canvas shims to a uint32_t[466*466]
rem (badge_paint_priv.h, badge_paint_host_bind) and asserts on real pixels.
rem
rem Two passes:
rem   1. the painter, the generated tables, the test and the icon stand-in built
rem      with $HOST_GCC at -std=c11 -O2 -Wall -Wextra -Werror, then run. The icon
rem      data comes from tests/host/badge_icon_test_stub.c, NOT from
rem      main/ui/badge_assets_data.c: the paint test must not depend on the
rem      generated assets, which another agent owns.
rem   2. badge_paint.c alone, rebuilt with the firmware's own xtensa-esp-elf-gcc.
rem      $HOST_GCC is llvm-mingw's clang and the firmware is GCC 14.2, and the two
rem      do not share every warning -- that gap once shipped a firmware that would
rem      not build (see the note in tools/run-host-tests.cmd). This pass is what
rem      makes "host tests green" mean "the firmware compiles".
rem
rem The LVGL stand-in is tests/host/lvgl_paint_stub/lvgl.h, which belongs to this
rem phase. It carries only what badge_paint names, at the same shapes LVGL 9.5
rem uses, so a signature drift is a compile error rather than a different pixel.
rem
rem Owned by this phase: tools/suite/03-paint.cmd, main/ui/badge_paint.c,
rem main/ui/badge_paint_priv.h, tests/host/test_badge_paint.c,
rem tests/host/badge_icon_test_stub.c, tests/host/lvgl_paint_stub/.
rem ---------------------------------------------------------------------------
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

echo badge_paint: building the painter and the pixel test with clang-shaped gcc
rem badge_spec_data.c is GENERATED and is not this phase's to fix: clang's
rem -Wmissing-field-initializers fires on its brace initialisers under -Wextra, which
rem the runner's own build of the same file avoids by compiling it only with the
rem firmware compiler. It is therefore built as its own object with that one warning
rem off, and everything this phase owns is still held to -Werror in full.
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror -Wno-missing-field-initializers -DBADGE_PAINT_HOST ^
  -I tests/host/lvgl_paint_stub -I main/ui ^
  -c main/ui/badge_spec_data.c -o "%HOST_BUILD%\badge_spec_data_host.o"
if errorlevel 1 (
  echo FAILED: main/ui/badge_spec_data.c did not build
  exit /b 1
)

"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror -DBADGE_PAINT_HOST ^
  -I tests/host/lvgl_paint_stub -I main/ui ^
  main/ui/badge_paint.c main/ui/badge_geom.c tests/host/test_badge_paint.c tests/host/badge_icon_test_stub.c ^
  "%HOST_BUILD%\badge_spec_data_host.o" ^
  -o "%HOST_BUILD%\badge_paint_test.exe" -lm
if errorlevel 1 (
  echo FAILED: badge_paint.c / test_badge_paint.c did not build under -Werror
  exit /b 1
)

"%HOST_BUILD%\badge_paint_test.exe"
if errorlevel 1 (
  echo FAILED: badge_paint pixel assertions
  exit /b 1
)

echo badge_paint: executing the production direct-buffer branch
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I tests/host/lvgl_paint_stub -I main/ui ^
  main/ui/badge_paint.c main/ui/badge_geom.c tests/host/test_badge_paint_production.c tests/host/badge_icon_test_stub.c ^
  "%HOST_BUILD%\badge_spec_data_host.o" ^
  -o "%HOST_BUILD%\badge_paint_production_test.exe" -lm
if errorlevel 1 exit /b 1
"%HOST_BUILD%\badge_paint_production_test.exe"
if errorlevel 1 exit /b 1

if not defined HOST_FW_GCC goto :no_fw
if not exist "%HOST_FW_GCC%" goto :no_fw

echo.
echo badge_paint: recompiling under the firmware's own compiler
"%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
  -Wno-unused-parameter -I tests/host/lvgl_paint_stub -I main/ui ^
  -c main/ui/badge_paint.c -o "%HOST_BUILD%\badge_paint_xtensa.o"
if errorlevel 1 (
  echo FAILED: badge_paint.c under the firmware compiler
  exit /b 1
)
echo   badge_paint.c: no diagnostic from the firmware compiler with -Werror=all
exit /b 0

:no_fw
echo.
echo   [firmware compiler] SKIPPED -- no xtensa-esp-elf-gcc at "%HOST_FW_GCC%"
echo   That pass catches warnings clang does not have. Skipping it means
echo   "host tests green" no longer implies "the firmware compiles".
exit /b 0
