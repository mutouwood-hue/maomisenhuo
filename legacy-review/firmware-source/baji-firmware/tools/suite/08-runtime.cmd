@echo off
setlocal
if not defined HOST_GCC exit /b 1
if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I "%HOST_ROOT%\tests\host\lvgl_font_stub" ^
  -I "%HOST_ROOT%\tests\host\idf_stub" -I "%HOST_ROOT%\tests\host" ^
  -I "%HOST_ROOT%\main" -I "%HOST_ROOT%\main\ui" ^
  -I "%HOST_ROOT%\main\pet" -I "%HOST_ROOT%\main\net" ^
  -I "%HOST_ROOT%\main\hw" ^
  "%HOST_ROOT%\main\hw\badge_audio_policy.c" ^
  "%HOST_ROOT%\main\ui\badge_tutorial_visual.c" ^
  "%HOST_ROOT%\main\badge_pet_store.c" ^
  "%HOST_ROOT%\main\badge_onboarding_store.c" "%HOST_ROOT%\main\ui\badge_onboarding.c" ^
  "%HOST_ROOT%\main\badge_runtime.c" "%HOST_ROOT%\main\ui\badge_overlay.c" ^
  "%HOST_ROOT%\main\ui\badge_motion.c" "%HOST_ROOT%\main\ui\badge_frame_clock.c" ^
  "%HOST_ROOT%\main\ui\badge_fsm.c" "%HOST_ROOT%\main\ui\badge_geom.c" ^
  "%HOST_ROOT%\main\ui\badge_spec_data.c" "%HOST_ROOT%\main\pet\badge_pet.c" ^
  "%HOST_ROOT%\main\pet\pet_state.c" "%HOST_ROOT%\main\net\app_link.c" ^
  "%HOST_ROOT%\main\net\badge_events.c" "%HOST_ROOT%\main\net\net_social.c" ^
  "%HOST_ROOT%\main\net\net_proto.c" ^
  "%HOST_ROOT%\tests\host\net_test_idf.c" "%HOST_ROOT%\tests\host\net_test_link.c" ^
  "%HOST_ROOT%\tests\host\net_test_support.c" ^
  "%HOST_ROOT%\tests\host\test_badge_runtime.c" ^
  -o "%HOST_BUILD%\badge_runtime_test.exe" -lm
if errorlevel 1 exit /b 1
"%HOST_BUILD%\badge_runtime_test.exe"
if errorlevel 1 exit /b 1
exit /b 0
