@echo off
rem Phase 00: the generated spec tables are current, faithful and self-consistent.
rem
rem Three separate things are checked, because they fail differently:
rem   1. the generator has been re-run since badge_spec.json last changed (--check);
rem   2. the generator's own self-check of the JSON (tools/check-badge-spec.mjs) --
rem      every key modelled, nothing silently dropped;
rem   3. the tables the firmware links (tests/host/test_badge_spec.c) -- counts,
rem      colours, timings, the care arithmetic, the event numbering and the hardware
rem      facts the M1 board actually has.
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

echo   generated tables current
node "%HOST_ROOT%\tools\gen-badge-ui.mjs" --check
if errorlevel 1 exit /b 1

if exist "%HOST_ROOT%\tools\check-badge-spec.mjs" (
  echo   spec JSON self-check
  node "%HOST_ROOT%\tools\check-badge-spec.mjs"
  if errorlevel 1 exit /b 1
)

echo   tables under the host compiler
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main\net" -I "%HOST_ROOT%\main\pet" ^
  -I "%HOST_ROOT%\tests\host\idf_stub" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" ^
  "%HOST_ROOT%\main\ui\badge_geom.c" ^
  "%HOST_ROOT%\tests\host\test_badge_spec.c" ^
  -o "%HOST_BUILD%\badge_spec_test.exe" -lm
if errorlevel 1 exit /b 1

"%HOST_BUILD%\badge_spec_test.exe"
if errorlevel 1 exit /b 1

rem The generated tables are also compiled by the firmware's own compiler, because
rem clang and GCC 14.2 do not share every warning: this exact gap once shipped a
rem firmware that would not build (tools/run-host-tests.cmd explains it).
if defined HOST_FW_GCC (
  if exist "%HOST_FW_GCC%" (
    echo   generated tables under the firmware compiler
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter -I "%HOST_ROOT%\main\ui" ^
      -c "%HOST_ROOT%\main\ui\badge_spec_data.c" -o "%HOST_BUILD%\badge_spec_data_xtensa.o"
    if errorlevel 1 exit /b 1
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter -I "%HOST_ROOT%\main\ui" ^
      -c "%HOST_ROOT%\main\ui\badge_geom.c" -o "%HOST_BUILD%\badge_geom_xtensa.o"
    if errorlevel 1 exit /b 1
  )
)

endlocal
exit /b 0
