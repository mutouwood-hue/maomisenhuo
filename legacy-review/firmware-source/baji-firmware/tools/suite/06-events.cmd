@echo off
rem ---------------------------------------------------------------------------
rem Host phase: the badge's uplink to the App -- wire format, queue, persistence.
rem
rem Discovered and called by tools\run-host-tests.cmd, which exports the
rem toolchain paths below (so a machine with a different gcc has one place to
rem change) and fails the whole suite on a non-zero exit here.
rem
rem What this phase proves, and why it is a phase of its own:
rem   badge_events.c encodes the only bytes this firmware sends to the phone.
rem   The App decodes 8 bytes it did not design, so an endianness mistake, a sign
rem   lost on int16 b, or a queue that forgets a record is a defect no amount of
rem   playing with the badge makes visible. The test pins the encoding byte by
rem   byte (including b = -1 -> FF FF), walks all fourteen types, checks the
rem   ring's drop-the-oldest rule at exactly 200, drives flush against a link
rem   that refuses writes, and round-trips the queue through the NVS stand-in.
rem
rem   This source is also compiled by the FIRMWARE's compiler. xtensa-esp-elf-gcc
rem   does not share every warning with the clang that lives in llvm-mingw, and
rem   that gap once shipped a firmware that would not build while nine host
rem   phases were green (tools\run-host-tests.cmd:108-118). badge_events.c
rem   deliberately depends on no LVGL, no FreeRTOS and no NimBLE -- only ESP-IDF's
rem   nvs.h/esp_log.h -- so the firmware compiler can take it too. The one piece
rem   of the real transport it borrows, net_link_send(), is declared in
rem   main\net\net_link.h and only linked here, never compiled.
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

cd /d "%HOST_ROOT%"
if not exist "build\host" mkdir "build\host"

rem The stand-ins: idf_stub for ESP-IDF (esp_err/esp_log/nvs/esp_timer), tests\host
rem for the two-device link and the storage implementation. The firmware headers
rem come from main\ unchanged, so a change to any production interface breaks this
rem build rather than silently going untested.
set "STUB_INC=-I tests/host/idf_stub -I tests/host -I main/net -I main/pet -I main/ui"

rem ---------------------------------------------------------------------------
rem First, the generated tables. badge_events.c reads its labels out of
rem badge_spec_data.c (badge_event_defs[]/badge_strings[]) rather than restating
rem them, so the table is a dependency here -- and it belongs to the badge-spec
rem generator, not to this phase. It is compiled separately for exactly that
rem reason: the demoted warning below (an aggregate that does not list every field
rem of the struct in badge_spec.h, which is what a header change looks like before
rem the generator is re-run) is the generator's business, and it must not decide
rem whether the event queue's own tests run. The same demotion is what
rem tools\run-host-tests.cmd:138-141 already applies to this file for the firmware
rem compiler's pass, and the diagnostics still print. The file compiles clean under
rem -Werror as the tree stands; the demotion is only about who owns the failure.
rem ---------------------------------------------------------------------------
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror -Wno-error=missing-field-initializers ^
  -I main/ui -c main/ui/badge_spec_data.c -o build/host/badge_spec_data_events.o
if errorlevel 1 exit /b 1

rem ---------------------------------------------------------------------------
rem Then the module under test and its harness, at full strength: every warning
rem is an error, including in the test itself.
rem ---------------------------------------------------------------------------
"%HOST_GCC%" -std=c11 -O2 -Wall -Wextra -Werror %STUB_INC% ^
  main/net/badge_events.c ^
  tests/host/net_test_idf.c tests/host/net_test_link.c ^
  tests/host/test_badge_events.c ^
  build/host/badge_spec_data_events.o ^
  -o build/host/badge_events_test.exe -lm
if errorlevel 1 exit /b 1

build\host\badge_events_test.exe
if errorlevel 1 exit /b 1

rem ---------------------------------------------------------------------------
rem The same source under the compiler the firmware actually uses. Skipping this
rem means "host tests green" no longer implies "the firmware compiles".
rem ---------------------------------------------------------------------------
if defined HOST_FW_GCC (
  if exist "%HOST_FW_GCC%" (
    "%HOST_FW_GCC%" -std=gnu17 -O2 -Wall -Werror=all -Wextra -Wno-error=extra ^
      -Wno-unused-parameter %STUB_INC% ^
      -c main/net/badge_events.c -o build/host/badge_events_xtensa.o
    if errorlevel 1 exit /b 1
    echo   badge_events.c: no diagnostic from xtensa-esp-elf-gcc with -Werror=all
  ) else (
    echo   [firmware compiler] SKIPPED -- %HOST_FW_GCC% not found
    echo   That check catches warnings clang does not have.
  )
) else (
  echo   [firmware compiler] SKIPPED -- HOST_FW_GCC is not set
  echo   That check catches warnings clang does not have.
)

exit /b 0
