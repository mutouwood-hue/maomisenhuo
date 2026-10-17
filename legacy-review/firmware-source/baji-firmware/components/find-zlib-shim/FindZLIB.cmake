# FindZLIB.cmake -- resolve ZLIB from the ESP-IDF espressif__zlib component instead
# of probing the host machine.
#
# WHY THIS FILE EXISTS
# --------------------
# CMake's stock FindZLIB.cmake looks for a zlib installation on the *build host*:
#
#   FindZLIB.cmake(108): set(_ZLIB_SEARCH_NORMAL
#                           PATHS "[HKEY_LOCAL_MACHINE\\SOFTWARE\\GnuWin32\\Zlib;InstallPath]"
#                                 "$ENV{ProgramFiles}/zlib"
#                                 "$ENV{ProgramFiles${_ZLIB_x86}}/zlib")
#   FindZLIB.cmake(125): find_path(ZLIB_INCLUDE_DIR NAMES zlib.h ${${search}}
#                                  PATH_SUFFIXES include)
#
# On this Windows host that search faults *inside cmake.exe* with 0xC0000409
# (STATUS_STACK_BUFFER_OVERRUN / __fastfail). The process dies, so there is no CMake
# error message and no CMakeConfigureLog entry: the configure step of `idf.py build`
# simply aborts with no explanation. `--trace` is what pins it down, because it
# echoes each statement before executing it and the last line before the process dies
# is the single statement that faulted.
#
# libpng calls find_package(ZLIB REQUIRED) unconditionally
# (managed_components/espressif__libpng/libpng/CMakeLists.txt:141), which is what
# pulls the stock module in. An IDF build does not need a host zlib at all: the
# espressif__zlib component already provides one.
#
# HOW THE SUBSTITUTION WORKS
# --------------------------
# CMake searches CMAKE_MODULE_PATH before its own <CMAKE_ROOT>/Modules, so a module
# named FindZLIB.cmake on that path shadows the stock one and the host probe never
# runs. This component's project_include.cmake puts this directory first on
# CMAKE_MODULE_PATH, and IDF includes every component's project_include.cmake before
# any component's CMakeLists.txt -- so the substitution is already in place by the
# time libpng asks.
#
# A second, independent occurrence of the same probe lives at FindPNG.cmake:68, which
# freetype reaches through find_package(PNG). That one CANNOT be intercepted here:
# once FindPNG.cmake has been loaded from CMake's own module directory, the nested
# find_package(ZLIB) resolves against that same directory rather than through
# CMAKE_MODULE_PATH. It is instead eliminated at the source, by turning off the
# feature that needs it -- see the FT_DISABLE_PNG note in the root CMakeLists.txt.

# Resolve zlib from the IDF component, whatever state the build is in.
if(NOT TARGET ZLIB::ZLIB)

    # The component normally sets these up itself; prefer its answers.
    set(_fzs_lib "${ZLIB_LIBRARY}")
    set(_fzs_inc "${ZLIB_INCLUDE_DIR}")

    if(NOT _fzs_lib OR _fzs_lib MATCHES "-NOTFOUND$")
        if(TARGET idf::espressif__zlib)
            set(_fzs_lib idf::espressif__zlib)
        else()
            # The component has not been processed yet. Its target will exist by the
            # time anything links, so referring to it by name is enough.
            set(_fzs_lib idf::espressif__zlib)
        endif()
    endif()

    if(NOT _fzs_inc OR _fzs_inc MATCHES "-NOTFOUND$")
        # Locate the component on disk so the headers resolve even if the component's
        # own project_include.cmake has not run yet.
        foreach(_fzs_root "${CMAKE_SOURCE_DIR}/managed_components/espressif__zlib"
                          "${CMAKE_CURRENT_LIST_DIR}/../../managed_components/espressif__zlib")
            if(EXISTS "${_fzs_root}/zlib/zlib.h")
                set(_fzs_inc "${_fzs_root}/zlib")
                break()
            endif()
        endforeach()
    endif()

    add_library(ZLIB::ZLIB INTERFACE IMPORTED GLOBAL)
    set_target_properties(ZLIB::ZLIB PROPERTIES
        INTERFACE_LINK_LIBRARIES "${_fzs_lib}"
        INTERFACE_INCLUDE_DIRECTORIES "${_fzs_inc}")
endif()

set(ZLIB_FOUND TRUE)
set(ZLIB_LIBRARIES ZLIB::ZLIB)
if(ZLIB_INCLUDE_DIR)
    set(ZLIB_INCLUDE_DIRS "${ZLIB_INCLUDE_DIR}")
elseif(_fzs_inc)
    set(ZLIB_INCLUDE_DIRS "${_fzs_inc}")
endif()
set(ZLIB_VERSION_STRING "")
