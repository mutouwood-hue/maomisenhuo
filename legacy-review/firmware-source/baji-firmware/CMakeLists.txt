# Project entry point for the ESP32-S3-Touch-AMOLED-1.75C pet firmware.
#
# Two build-host quirks are handled here. Both are documented at length because
# neither is guessable from the symptom, and the symptom for both is the same: the
# CMake configure step aborts inside cmake.exe with exit code 0xC0000409
# (STATUS_STACK_BUFFER_OVERRUN) and prints no error message at all.

cmake_minimum_required(VERSION 3.16)

# --------------------------------------------------------------------------------
# 1. Turn off FreeType's PNG support.
#
# FreeType ships optional codecs, and each one is found with a CMake host probe
# (find_package) rather than through a config package. The Espressif component
# already disables HarfBuzz, BZip2 and Brotli in
# managed_components/espressif__freetype/CMakeLists.txt, but it leaves PNG enabled,
# so freetype still calls find_package(PNG) -- and FindPNG.cmake in turn calls
# find_package(ZLIB) for itself.
#
# That nested ZLIB lookup is the problem. Once FindPNG.cmake has been loaded from
# CMake's own module directory, its find_package(ZLIB) resolves against that same
# directory, so it does NOT consult CMAKE_MODULE_PATH and cannot be redirected to the
# IDF zlib component the way libpng's direct lookup is (see
# components/find-zlib-shim). It therefore reaches CMake's stock FindZLIB.cmake,
# which probes the host for a zlib installation and faults inside cmake.exe on this
# machine.
#
# This firmware never uses PNG-encoded OpenType bitmaps -- the UI's only typeface is
# LVGL's Source Han Sans SC subset, which is not a bitmap-strike font -- so switching
# the codec off removes the probe entirely instead of working around it. It is also
# the option the ESP-IDF ecosystem expects: the same switch is what ESP-IDF's own
# freetype component sets for its other three optional codecs.
#
# FT_DISABLE_PNG is declared by freetype with option(), which honours an existing
# cache entry, so setting it before project() (i.e. before any component is
# configured) is what makes it stick. Hence this position in the file.
# --------------------------------------------------------------------------------
set(FT_DISABLE_PNG ON CACHE BOOL "Disable FreeType's PNG codec; see the note in CMakeLists.txt" FORCE)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

project(orange_cat_pet)
