# Put this component's directory on CMAKE_MODULE_PATH so that its FindZLIB.cmake
# shadows CMake's stock module.
#
# IDF includes every component's project_include.cmake during idf_build_process,
# *before* any component's CMakeLists.txt is processed. That ordering is what makes
# this work: by the time libpng's CMakeLists.txt runs find_package(ZLIB REQUIRED), the
# shim is already the FindZLIB that CMake will find.
#
# See CMakeLists.txt in this directory for why the shim is needed at all.

if(EXISTS "${CMAKE_CURRENT_LIST_DIR}/FindZLIB.cmake")
    list(FIND CMAKE_MODULE_PATH "${CMAKE_CURRENT_LIST_DIR}" _fzs_index)
    if(_fzs_index EQUAL -1)
        # Prepend, not append: it must win over the stock module.
        list(INSERT CMAKE_MODULE_PATH 0 "${CMAKE_CURRENT_LIST_DIR}")
    endif()
endif()
