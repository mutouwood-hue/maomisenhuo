@echo off
rem ---------------------------------------------------------------------------
rem Phase 04-frame: the repaint plan -- which boxes the next frame has to touch,
rem and the {token} expander that fills the strings on them.
rem
rem WHY THIS PHASE EXISTS
rem ---------------------
rem "A stat arc moving by one point repaints one band of pixels, not 466x466 over
rem QSPI" is a claim about *which boxes changed*, and no screenshot can check it.
rem badge_ui.c clears a box and redraws only the elements that intersect it, so a
rem planner that returns the wrong list is silently either a repaint that never
rem happens (stale pixels on the glass) or a full-panel repaint every tick (the
rem budget the partial path exists to protect). badge_ui_plan.c decides that list
rem with no LVGL in sight, which is exactly what lets this phase drive it on the
rem host: every screen, every painter input, and the box list each one produces.
rem
rem The other half of the phase is the specification's own grammar: `fill()`
rem substitutes {careLabel:<key>} first and then every other {token}, so the
rem venues' own "{name} / office" strings resolve and a "{typo}" becomes a
rem visible bug with no other symptom. Both halves are pure functions, so both
rem are asserted here rather than on a bench with a finger and a stopwatch.
rem
rem WHAT IS BUILT
rem --------------
rem   * badge_ui_plan.c against tests/host/lvgl_plan_stub/lvgl.h, which carries the
rem     four types badge_paint.h names and NO canvas function. badge_ui_plan.c must
rem     keep compiling against it; if it ever needs a widget, a draw buffer or a
rem     canvas call, this build stops being possible and that is the warning.
rem   * badge_geom.c, because badge_ui_plan.c's ui_area() calls badge_el_box() for
rem     every content element. The task that created this phase said not to link it;
rem     verifying the seam showed the call is real (badge_ui_plan.c:570 ->
rem     badge_geom.c:167), and a test-local badge_el_box() stub would make the box
rem     AREA assertions below measure a fiction instead of the real arithmetic. The
rem     seam this phase protects is "no LVGL", not "no badge_geom": badge_geom.c has
rem     no LVGL dependency at all and 01-geometry.cmd already builds it on the host.
rem   * NOT badge_paint.c and NOT badge_ui.c. badge_ui_plan.c never calls a painter.
rem   * badge_pet.c, only so the test can ask the GAME the same care question
rem     (badge_pet_care_allowed) and assert the documented asymmetry with the
rem     painter's subset. It is pure, and needs no badge_geom or LVGL either.
rem
rem Two passes, like 03-paint.cmd:
rem   1. everything above with %HOST_GCC% at -std=c11 -O2 -Wall -Wextra -Werror,
rem      then run. badge_spec_data.c is GENERATED and is not this phase's to fix:
rem      clang's -Wmissing-field-initializers fires on its brace initialisers under
rem      -Wextra, so it is built as its own object with that one warning off and
rem      everything this phase owns is still held to -Werror in full.
rem   2. badge_ui_plan.c alone, rebuilt with the firmware's own xtensa-esp-elf-gcc.
rem      %HOST_GCC% is llvm-mingw's clang and the firmware is GCC 14.2, and the two do
rem      not share every warning -- that gap once shipped a firmware that would not
rem      build (see the note in tools/run-host-tests.cmd). This pass is what makes
rem      "host tests green" mean "the firmware compiles".
rem
rem Owned by this phase: tools/suite/04-frame.cmd, tests/host/test_badge_ui_plan.c.
rem tests/host/lvgl_plan_stub/ belongs to this phase too, and is deliberately not
rem edited by it.
rem
rem ASCII only, like every other file in tools/suite: cmd.exe reads a .cmd in the
rem console's OEM code page, and a UTF-8 comment with CJK in it makes the parser
rem fail on the byte sequences. Badge strings quoted in a comment belong in the
rem source file, which the compiler reads as UTF-8.
rem ---------------------------------------------------------------------------
setlocal

if not exist "%HOST_BUILD%" mkdir "%HOST_BUILD%"

echo badge_ui_plan: building the planner and the frame-diff test with clang-shaped gcc
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror -Wno-missing-field-initializers ^
  -I tests/host/lvgl_plan_stub -I main/ui ^
  -c main/ui/badge_spec_data.c -o "%HOST_BUILD%\badge_spec_data_frame.o"
if errorlevel 1 (
  echo FAILED: main/ui/badge_spec_data.c did not build
  exit /b 1
)

"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror ^
  -I tests/host/lvgl_plan_stub -I main/ui -I main/pet ^
  main/ui/badge_ui_plan.c main/ui/badge_geom.c main/pet/badge_pet.c ^
  tests/host/test_badge_ui_plan.c ^
  "%HOST_BUILD%\badge_spec_data_frame.o" ^
  -o "%HOST_BUILD%\badge_ui_plan_test.exe" -lm
if errorlevel 1 (
  echo FAILED: badge_ui_plan.c / test_badge_ui_plan.c did not build under -Werror
  exit /b 1
)

"%HOST_BUILD%\badge_ui_plan_test.exe"
if errorlevel 1 (
  echo FAILED: badge_ui_plan frame-diff and expander assertions
  exit /b 1
)

if not defined HOST_FW_GCC goto :no_fw
if not exist "%HOST_FW_GCC%" goto :no_fw

echo.
echo badge_ui_plan: recompiling under the firmware's own compiler
"%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
  -Wno-unused-parameter -I tests/host/lvgl_plan_stub -I main/ui ^
  -c main/ui/badge_ui_plan.c -o "%HOST_BUILD%\badge_ui_plan_xtensa.o"
if errorlevel 1 (
  echo FAILED: badge_ui_plan.c under the firmware compiler
  exit /b 1
)
echo   badge_ui_plan.c: no diagnostic from the firmware compiler with -Werror=all
exit /b 0

:no_fw
echo.
echo   [firmware compiler] SKIPPED -- no xtensa-esp-elf-gcc at "%HOST_FW_GCC%"
echo   That pass catches warnings clang does not have. Skipping it means
echo   "host tests green" no longer implies "the firmware compiles".
exit /b 0
