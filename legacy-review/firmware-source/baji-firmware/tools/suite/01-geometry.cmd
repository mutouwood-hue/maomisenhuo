@echo off
rem Phase 01: every element is on the glass.
rem
rem The badge is a 466x466 panel behind a disc of radius 233. The previous UI put 19
rem of its 20 element boxes at least partly under the bezel -- one of them with 1.8%
rem of its pixels visible -- and its geometry suite still passed, because that suite
rem checked a hand-written list of a few widgets instead of the table the renderer
rem actually draws from. This phase walks all 151 elements of all 23 screens.
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main\pet" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" ^
  "%HOST_ROOT%\main\ui\badge_geom.c" ^
  "%HOST_ROOT%\main\pet\badge_pet.c" ^
  "%HOST_ROOT%\tests\host\test_badge_geom.c" ^
  -o "%HOST_BUILD%\badge_geom_test.exe" -lm
if errorlevel 1 exit /b 1

"%HOST_BUILD%\badge_geom_test.exe"
if errorlevel 1 exit /b 1

if defined HOST_FW_GCC (
  if exist "%HOST_FW_GCC%" (
    echo   badge_pet.c under the firmware compiler
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main\pet" ^
      -c "%HOST_ROOT%\main\pet\badge_pet.c" -o "%HOST_BUILD%\badge_pet_xtensa.o"
    if errorlevel 1 exit /b 1
  )
)

endlocal
exit /b 0
