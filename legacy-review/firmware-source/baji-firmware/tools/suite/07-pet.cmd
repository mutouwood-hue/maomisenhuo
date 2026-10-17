@echo off
rem Phase 07: the care kernel.
rem
rem The badge is not authoritative about the pet: the App settles the numbers and the
rem badge reports what the owner did. So the kernel is small -- the specification's five
rem care actions, their deltas, their growth, their coins and their refusal rules -- and
rem there is deliberately no decay. This phase pins all of that, including the rule most
rem likely to be "helpfully fixed" later: growth is earned once per care action, not once
rem per step, so an abandoned 喂食 leaves the food moved and the growth unearned.
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I "%HOST_ROOT%\main\ui" -I "%HOST_ROOT%\main\net" -I "%HOST_ROOT%\main\pet" ^
  -I "%HOST_ROOT%\tests\host\idf_stub" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" ^
  "%HOST_ROOT%\main\pet\badge_pet.c" ^
  "%HOST_ROOT%\tests\host\test_badge_pet.c" ^
  -o "%HOST_BUILD%\badge_pet_test.exe" -lm
if errorlevel 1 exit /b 1

"%HOST_BUILD%\badge_pet_test.exe"
if errorlevel 1 exit /b 1

endlocal
exit /b 0
