# DISABLED DIAGNOSTIC ATTACHMENT: not wired into CMAKE_MODULE_PATH.
# This did not resolve Windows CMake exit 3221226505; do not enable as a fix.
# ESP-IDF already supplies zlib through a component target. Never search host
# registry/libraries when cross-compiling this isolated candidate on Windows.
if(NOT TARGET ZLIB::ZLIB)
    message(FATAL_ERROR "Pinned ESP-IDF ZLIB::ZLIB target is missing")
endif()
set(ZLIB_FOUND TRUE)
set(ZLIB_VERSION_STRING "1.3.2")
set(ZLIB_VERSION "1.3.2")
set(ZLIB_INCLUDE_DIRS "${ZLIB_INCLUDE_DIR}")
set(ZLIB_LIBRARIES ZLIB::ZLIB)
