@echo off
rem Build and run the host-side tests.
rem
rem Everything in here runs on a PC with no board attached. The phases in
rem tools/suite/*.cmd are DISCOVERED by a glob, not listed -- here or anywhere. A new
rem test is one new file, tools/suite/NN-name.cmd, where the numeric prefix is the run
rem order: nothing else needs editing. The areas of the badge firmware are developed in
rem parallel, and a shared, hand-edited manifest is how parallel work loses its tests.
rem
rem Phases:
rem   cat3d rasteriser  -- renders fixed poses and compares them byte for byte
rem     against the reference images the JavaScript prototype produces
rem     (tools/compare-render.mjs). This is what proves the ported renderer is
rem     pixel-identical to the original.
rem   cat3d dirty rect  -- the incremental path, which the golden stage never
rem     reaches because it forces a full repaint before every frame.
rem   net proto         -- the pure core of the BLE social layer.
rem   net social        -- the real net_social.c compiled against stand-ins for
rem     ESP-IDF, FreeRTOS, NVS, mbedTLS and the radio, with two instances wired to
rem     each other.
rem   sdkconfig         -- a stale generated sdkconfig silently overrides
rem     sdkconfig.defaults.
rem   tools/suite/*     -- the badge-spec phases: the generated tables are current
rem     and faithful to badge_spec.json, every element is inside the glass, the
rem     state machine honours every gesture and timing in the specification, the
rem     painters agree with the reference's own rules, the assets cover every icon
rem     and character, and frame scheduling stays inside the budget.
rem
rem Usage:  tools\run-host-tests.cmd  [size]
setlocal enabledelayedexpansion

set "GCC=C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260908-ucrt-x86_64\bin\gcc.exe"
if not exist "%GCC%" (
  echo ERROR: gcc not found at %GCC%
  exit /b 1
)

set "ROOT=%~dp0.."
cd /d "%ROOT%"
if not exist "build\host" mkdir "build\host"

rem Published for the manifest phases in tools\suite\, so each of them does not
rem restate the toolchain path (and so a machine with a different gcc has one place
rem to change).
set "HOST_GCC=%GCC%"
set "HOST_BUILD=%ROOT%\build\host"
set "HOST_ROOT=%ROOT%"
set "HOST_SIZE=%~1"

echo.
echo === cat3d rasteriser ===
"%GCC%" -std=c11 -O2 -Wall -Wextra -Wno-unused-parameter ^
  -I components/cat3d/include -I components/cat3d/data ^
  components/cat3d/src/cat3d.c tests/host/cat_assets_host.c tests/host/test_render.c ^
  -o build/host/cat_render_test.exe -lm
if errorlevel 1 exit /b 1

if not exist "build\host\frames" mkdir "build\host\frames"
build\host\cat_render_test.exe "components\cat3d\data" "build\host\frames" %1

if errorlevel 1 exit /b 1
rem compare-render.mjs reads the canvas size from the CAT_SIZE environment variable,
rem while the C test takes it as argv[3]. Passing it on the command line alone
rem therefore desynchronised the two: the C side rendered at the requested size and
rem the JS side still assumed 466, so "run-host-tests.cmd 300" died in the compare
rem step with ERR_OUT_OF_RANGE. Forward the argument to the variable as well.
rem
rem Only when an argument was actually given: "set CAT_SIZE=" would otherwise leave
rem it defined-but-empty, and Number("") is 0 -- the checker coalesces with ??,
rem which does not catch an empty string, so the default path would break.
if not "%~1"=="" set CAT_SIZE=%~1
node tools\compare-render.mjs "build/host/frames" "components/cat3d/data"
if errorlevel 1 exit /b 1

echo.
echo === cat3d dirty rect (incremental path) ===
"%GCC%" -std=c11 -O2 -Wall -Wextra -Wno-unused-parameter ^
  -I components/cat3d/include -I components/cat3d/data ^
  components/cat3d/src/cat3d.c tests/host/cat_assets_host.c tests/host/test_cat3d_dirty.c ^
  -o build/host/cat3d_dirty_test.exe -lm
if errorlevel 1 exit /b 1

build\host\cat3d_dirty_test.exe "components\cat3d\data" %1
if errorlevel 1 exit /b 1

rem ---------------------------------------------------------------------------
rem The phases above compile with %GCC%, which lives in llvm-mingw and is really
rem clang. The firmware does not: it uses xtensa-esp-elf-gcc, and the two do not
rem share every warning. This gap shipped a broken firmware once: a compound
rem literal used to default a parameter was clean under clang (no
rem -Wdangling-pointer at all) and a hard error under GCC 14.2 with -Werror=all.
rem Nine green phases, and the firmware would not build.
rem
rem The badge-spec sources are written with the same discipline: the ones with no
rem ESP-IDF, LVGL or FreeRTOS dependency (badge_spec, badge_fsm, badge_paint) are
rem compiled here by both compilers.
rem ---------------------------------------------------------------------------
set "XTENSA=%ESP_IDF_XTENSA_GCC%"
if not defined XTENSA set "XTENSA=C:\Espressif\tools\xtensa-esp-elf\esp-14.2.0_20260121\xtensa-esp-elf\bin\xtensa-esp32s3-elf-gcc.exe"
set "FIRMWARE_GCC=%XTENSA%"
rem Published for the tools/suite/ phases, for the same reason HOST_GCC is: so a
rem machine with a different toolchain has one place to change. A phase that finds it
rem unset (or the file missing) skips its second-compiler pass and says so.
set "HOST_FW_GCC=%XTENSA%"
if exist "%XTENSA%" (
  echo.
  echo === badge spec tables, under the firmware's own compiler ===
  "%XTENSA%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
    -Wno-unused-parameter -I main/ui ^
    -c main/ui/badge_spec_data.c -o build/host/badge_spec_data_xtensa.o
  if errorlevel 1 exit /b 1
  echo   badge_spec_data.c: no diagnostic from xtensa-esp-elf-gcc 14.2 with -Werror=all
) else (
  echo.
  echo   [firmware compiler] SKIPPED -- xtensa-esp-elf-gcc not found at %XTENSA%
  echo   That check catches warnings clang does not have. Skipping it means
  echo   "host tests green" no longer implies "the firmware compiles".
)

echo.
echo === net proto (pure BLE social core) ===
"%GCC%" -std=c11 -O2 -Wall -Wextra -Wno-unused-parameter ^
  -I main/net -I main/pet ^
  main/net/net_proto.c main/pet/pet_state.c tests/host/test_net_proto.c ^
  -o build/host/net_proto_test.exe -lm
if errorlevel 1 exit /b 1

build\host\net_proto_test.exe
if errorlevel 1 exit /b 1

echo.
echo === net social handshake (two devices, one PC) ===
"%GCC%" -std=c11 -O2 -Wall -Wextra -Wno-unused-parameter ^
  -I tests/host/idf_stub -I tests/host -I main/net -I main/pet ^
  main/net/net_social.c main/net/net_proto.c main/pet/pet_state.c ^
  tests/host/net_test_idf.c tests/host/net_test_support.c tests/host/net_test_link.c ^
  tests/host/test_net_social.c ^
  -o build/host/net_social_test.exe -lm
if errorlevel 1 exit /b 1

build\host\net_social_test.exe
if errorlevel 1 exit /b 1

echo.
echo === sdkconfig consistency ===
node tools\check-sdkconfig.mjs
if errorlevel 1 exit /b 1

rem ---------------------------------------------------------------------------
rem The badge-spec phases. Every tools/suite/NN-name.cmd is run in the directory's
rem (alphabetical) order, so the numeric prefix is the run order. A phase exits
rem non-zero to fail the suite.
rem
rem They are discovered rather than listed: the phases are developed in parallel
rem and a hand-edited shared list is exactly how one of them gets dropped. Each
rem phase owns its own file and nothing else.
rem
rem THE FAILURE PATH USES goto, NOT `exit /b 1`, AND THAT IS LOAD BEARING.
rem An `exit /b 1` inside this `for ( ... )` block terminates the script but the
rem process still exits 0 -- measured, not assumed: with the phase failure below
rem the runner printed "FAILED: 02-fsm" and `Start-Process -Wait` reported
rem ExitCode 0. A caller that checks only the exit code therefore read a failing
rem suite as a passing one, which makes "host tests green" meaningless. Jumping
rem out of the block to a top-level `exit /b 1` propagates properly (verified
rem against a scratch copy that reported 1 on the same failure) and keeps the
rem suite fail-fast, so the later phases still do not run.
rem ---------------------------------------------------------------------------
set "PHASES_RUN=0"
for %%F in ("tools\suite\*.cmd") do (
  echo.
  echo === %%~nF ===
  call "%%~fF"
  if errorlevel 1 (
    echo FAILED: %%~nF
    goto :phase_failed
  )
  set /a PHASES_RUN+=1
)

if "%PHASES_RUN%"=="0" (
  echo ERROR: no phases found in tools\suite\
  goto :phase_failed
)

echo.
echo ALL HOST TESTS PASSED
endlocal
exit /b 0

:phase_failed
echo.
echo SUITE FAILED
endlocal
exit /b 1
