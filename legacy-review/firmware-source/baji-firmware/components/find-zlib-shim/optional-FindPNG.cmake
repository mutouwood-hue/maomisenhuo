# FindPNG.cmake -- OPTIONAL, NOT CURRENTLY INSTALLED.
#
# Answer find_package(PNG) from the espressif__libpng component instead of probing the
# host machine for a libpng installation.
#
# WHY IT EXISTS
# -------------
# CMake's stock FindPNG.cmake searches the build host:
#
#   FindPNG.cmake(57): set(_PNG_INCLUDE_SEARCH_NORMAL "$ENV{ProgramFiles}/libpng" ...)
#   FindPNG.cmake(78): find_path(PNG_PNG_INCLUDE_DIR png.h ... PATHS ${_PNG_INCLUDE_SEARCH_NORMAL})
#
# On this Windows host that call faults inside cmake.exe with 0xC0000409
# (STATUS_STACK_BUFFER_OVERRUN / __fastfail): the process dies, so there is no CMake
# error message and no CMakeConfigureLog entry.
#
# This module answers the request from the values espressif__libpng already provides
# and performs no find_path()/find_library() call at all. Verified working; a probe
# harness reported:
#
#   PNGPROBE OK found=TRUE version=[1.6.58]
#     inc=[.../libpng; .../zlib/zlib]
#     lib=[idf::espressif__libpng; idf::espressif__zlib]
#
# WHY IT IS NOT INSTALLED
# -----------------------
# The firmware does not need FreeType's PNG codec, so the root CMakeLists.txt turns
# that codec off with FT_DISABLE_PNG, and nothing calls find_package(PNG) at all. That
# is the simpler fix: it removes the dependency rather than satisfying it.
#
# HOW TO USE IT IF PNG IS EVER RE-ENABLED
# ---------------------------------------
# Turning FT_DISABLE_PNG back on (removing the line from the root CMakeLists.txt) makes
# FreeType call find_package(PNG) again, and CMake's stock module crashes. To keep PNG,
# install this file as a shim:
#
#   1. copy this file to  managed_components/espressif__libpng/FindPNG.cmake
#   2. append the block below to
#      managed_components/espressif__libpng/project_include.cmake
#   3. repeat both steps after any dependency re-resolve: the component manager owns
#      and regenerates managed_components/, so an unmanaged file in there is deleted
#      by `idf.py reconfigure` / `update` / `fullclean`.
#
# Step 2's block (CMAKE_MODULE_PATH is searched before <CMAKE_ROOT>/Modules, and IDF
# includes every component's project_include.cmake before any component's
# CMakeLists.txt):
#
#     if(EXISTS "${CMAKE_CURRENT_LIST_DIR}/FindPNG.cmake")
#         list(FIND CMAKE_MODULE_PATH "${CMAKE_CURRENT_LIST_DIR}" _png_module_index)
#         if(_png_module_index EQUAL -1)
#             list(INSERT CMAKE_MODULE_PATH 0 "${CMAKE_CURRENT_LIST_DIR}")
#         endif()
#     endif()
#
# Note that this nested lookup is the one case that CANNOT be handled by
# components/find-zlib-shim: FindPNG.cmake:68 calls find_package(ZLIB) for itself, and
# once FindPNG.cmake has been loaded from CMake's own module directory that nested
# lookup resolves against the same directory rather than through CMAKE_MODULE_PATH.
# That is why the zlib shim alone was not enough, and why the codec is disabled here.

if(TARGET PNG::PNG)
    get_target_property(_png_inc_dirs PNG::PNG INTERFACE_INCLUDE_DIRECTORIES)
    if(NOT _png_inc_dirs)
        get_filename_component(_png_component_dir "${CMAKE_CURRENT_LIST_DIR}" DIRECTORY)
        if(EXISTS "${_png_component_dir}/libpng/png.h")
            set_target_properties(PNG::PNG PROPERTIES
                INTERFACE_INCLUDE_DIRECTORIES "${_png_component_dir}/libpng")
        endif()
        unset(_png_component_dir)
    endif()
    unset(_png_inc_dirs)
elseif(DEFINED PNG_LIBRARY AND NOT "${PNG_LIBRARY}" STREQUAL "" AND
       DEFINED PNG_PNG_INCLUDE_DIR AND NOT "${PNG_PNG_INCLUDE_DIR}" STREQUAL "")
    add_library(PNG::PNG INTERFACE IMPORTED)
    set_target_properties(PNG::PNG PROPERTIES
        INTERFACE_LINK_LIBRARIES "${PNG_LIBRARY}"
        INTERFACE_INCLUDE_DIRECTORIES "${PNG_PNG_INCLUDE_DIR}")
else()
    include("${CMAKE_ROOT}/Modules/FindPNG.cmake")
    return()
endif()

set(PNG_FOUND TRUE)
if(NOT DEFINED PNG_PNG_INCLUDE_DIR OR "${PNG_PNG_INCLUDE_DIR}" STREQUAL "")
    get_target_property(PNG_PNG_INCLUDE_DIR PNG::PNG INTERFACE_INCLUDE_DIRECTORIES)
endif()
set(PNG_INCLUDE_DIRS "${PNG_PNG_INCLUDE_DIR}")
if(DEFINED ZLIB_INCLUDE_DIR AND NOT "${ZLIB_INCLUDE_DIR}" STREQUAL "")
    list(APPEND PNG_INCLUDE_DIRS "${ZLIB_INCLUDE_DIR}")
endif()
set(PNG_INCLUDE_DIR "${PNG_INCLUDE_DIRS}")   # backward compatibility
if(NOT DEFINED PNG_LIBRARY OR "${PNG_LIBRARY}" STREQUAL "")
    set(PNG_LIBRARY PNG::PNG)
endif()
set(PNG_LIBRARIES "${PNG_LIBRARY}")
if(DEFINED ZLIB_LIBRARY AND NOT "${ZLIB_LIBRARY}" STREQUAL "")
    list(APPEND PNG_LIBRARIES "${ZLIB_LIBRARY}")
endif()

set(PNG_VERSION_STRING "")
if(EXISTS "${PNG_PNG_INCLUDE_DIR}/png.h")
    file(STRINGS "${PNG_PNG_INCLUDE_DIR}/png.h" _png_version_str
         REGEX "^#define[ \t]+PNG_LIBPNG_VER_STRING[ \t]+\".+\"")
    string(REGEX REPLACE
           "^#define[ \t]+PNG_LIBPNG_VER_STRING[ \t]+\"([^\"]+)\".*" "\\1"
           PNG_VERSION_STRING "${_png_version_str}")
    unset(_png_version_str)
endif()
