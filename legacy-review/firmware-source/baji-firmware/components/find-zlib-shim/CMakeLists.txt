# find-zlib-shim -- replaces CMake's stock FindZLIB with the IDF zlib component.
#
# WHY THIS COMPONENT EXISTS
# -------------------------
# On this Windows host, CMake's stock `FindZLIB.cmake` faults *inside cmake.exe*
# while probing the host for a zlib installation:
#
#     FindZLIB.cmake(108): set(_ZLIB_SEARCH_NORMAL
#                             PATHS "[HKEY_LOCAL_MACHINE\\SOFTWARE\\GnuWin32\\Zlib;InstallPath]"
#                                   "$ENV{ProgramFiles}/zlib"
#                                   "$ENV{ProgramFiles${_ZLIB_x86}}/zlib")
#     FindZLIB.cmake(125): find_path(ZLIB_INCLUDE_DIR NAMES zlib.h ${${search}}
#                                    PATH_SUFFIXES include)
#
# The process dies with 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN / __fastfail) and
# exits, so there is no CMake error message and nothing in CMakeConfigureLog: the
# configure step of `idf.py build` simply aborts. libpng calls
# `find_package(ZLIB REQUIRED)` unconditionally
# (managed_components/espressif__libpng/libpng/CMakeLists.txt:141), which is what
# drags the stock module in.
#
# CMake always searches CMAKE_MODULE_PATH *before* <CMAKE_ROOT>/Modules, so a module
# named FindZLIB.cmake placed on that path replaces the stock one entirely and the
# host probe never runs. The espressif__zlib component already sets ZLIB_INCLUDE_DIR
# and ZLIB_LIBRARY, so the replacement has everything it needs to answer
# find_package(ZLIB).
#
# WHY IT IS A PROJECT COMPONENT RATHER THAN A PATCH TO managed_components/
# -----------------------------------------------------------------------
# managed_components/ is owned by the ESP-IDF component manager and is regenerated
# whenever dependencies are re-resolved, which would silently delete a patched file
# and bring the crash back. A component inside this repository is in version control,
# is not managed, and survives.
#
# This component is also independent of which component pulls zlib in: it does not
# care why `find_package(ZLIB)` is called, only that it resolves to the IDF copy.

idf_component_register()
