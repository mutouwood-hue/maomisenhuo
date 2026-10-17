@echo off
rem ---------------------------------------------------------------------------
rem Phase 02: the state machine -- screens, gestures, modes, care, quirks, voice.
rem
rem Discovered and called by tools\run-host-tests.cmd, which exports HOST_GCC,
rem HOST_ROOT, HOST_BUILD, HOST_SIZE and HOST_FW_GCC. A non-zero exit here fails
rem the whole suite.
rem
rem What this phase is for. badge_fsm.c is the only place the badge's *behaviour*
rem lives: which screen a gesture reaches, when the modes ladder down, when a care
rem earns its growth, when a quirk is caught, what crosses to the App. None of that
rem is visible on a bench without a finger and a stopwatch, and several of the paths
rem (a care abandoned halfway, the AOD ladder under a silent clock, a quirk caught in
rem the 2.4 s window) cannot be produced by hand at all. So the test drives the state
rem machine from a script: press, move, release, tick, and read back the screen, the
rem mode, the brightness and the events emitted.
rem
rem The LVGL stub: badge_fsm.h's BADGE_SFX_* are built from badge_assets.h's SND_*
rem enum, and badge_assets.h includes lvgl.h for lv_font_t alone. tests\host\
rem lvgl_font_stub\lvgl.h declares that opaque, so the firmware's own headers are
rem compiled unchanged and nothing here links the panel, the codec or an sdkconfig.
rem
rem The module is also compiled by the FIRMWARE's compiler. xtensa-esp-elf-gcc does
rem not share every warning with the clang in llvm-mingw, and that gap once shipped a
rem firmware that would not build while nine host phases were green
rem (tools\run-host-tests.cmd:108-118).
rem ---------------------------------------------------------------------------
setlocal

if not defined HOST_GCC (
  echo ERROR: HOST_GCC is not set -- run this through tools\run-host-tests.cmd
  exit /b 1
)
if not defined HOST_ROOT (
  echo ERROR: HOST_ROOT is not set -- run this through tools\run-host-tests.cmd
  exit /b 1
)

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

rem The firmware's own headers, unchanged: a change to badge_fsm.h or to the generated
rem tables breaks this build rather than going untested.
set "FSM_INC=-I "%HOST_ROOT%\tests\host\lvgl_font_stub" -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main\pet""

echo   badge_fsm on the host (clang, warnings are errors)
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror %FSM_INC% ^
  "%HOST_ROOT%\main\ui\badge_fsm.c" ^
  "%HOST_ROOT%\main\ui\badge_motion.c" ^
  "%HOST_ROOT%\main\ui\badge_onboarding.c" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" ^
  "%HOST_ROOT%\main\ui\badge_geom.c" ^
  "%HOST_ROOT%\main\pet\badge_pet.c" ^
  "%HOST_ROOT%\tests\host\test_badge_fsm.c" ^
  -o "%HOST_BUILD%\badge_fsm_test.exe" -lm
if errorlevel 1 exit /b 1

"%HOST_BUILD%\badge_fsm_test.exe"
if errorlevel 1 exit /b 1

if defined HOST_FW_GCC (
  if exist "%HOST_FW_GCC%" (
    echo   badge_fsm under the firmware compiler
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter %FSM_INC% ^
      -c "%HOST_ROOT%\main\ui\badge_fsm.c" -o "%HOST_BUILD%\badge_fsm_xtensa.o"
    if errorlevel 1 exit /b 1
    rem The test file too: it is the phase's own source, and a warning the test only
    rem earns under GCC's -Wall would otherwise be invisible until someone ran the
    rem firmware build. -c only -- the test still runs against the host binary above.
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter %FSM_INC% ^
      -c "%HOST_ROOT%\tests\host\test_badge_fsm.c" -o "%HOST_BUILD%\test_badge_fsm_xtensa.o"
    if errorlevel 1 exit /b 1
    echo   badge_fsm.c and test_badge_fsm.c: no diagnostic from xtensa-esp-elf-gcc with -Werror=all
  ) else (
    echo   [firmware compiler] SKIPPED -- %HOST_FW_GCC% not found
    echo   That check catches warnings clang does not have.
  )
) else (
  echo   [firmware compiler] SKIPPED -- HOST_FW_GCC is not set
  echo   That check catches warnings clang does not have.
)

endlocal
exit /b 0
