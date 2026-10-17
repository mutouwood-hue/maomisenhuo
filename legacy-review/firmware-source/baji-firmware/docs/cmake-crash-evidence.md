# CMake 配置阶段崩溃：取证记录

这份文档记录 `0xC0000409` 崩溃的**证据**，不是操作指南——修复是什么、怎么构建，看 `build-and-usage.md` 第 2 节。留在这里是因为"排除了什么"和"为什么是这个原因"对下次遇到同类问题的人（或未来的自己）比结论更有用。

> **状态：已修复，记录保留（2026-10-12 复核）。** 仓库内的两处修复都还在位：`components/find-zlib-shim/` 四个文件（`CMakeLists.txt`、`FindZLIB.cmake`、`project_include.cmake`、备用的 `optional-FindPNG.cmake`）都在，根 `CMakeLists.txt:38` 仍是 `set(FT_DISABLE_PNG ON CACHE BOOL ... FORCE)`。本文引用的行号本轮重新核对过：libpng 的 `CMakeLists.txt:125` 是那句 `message(STATUS "Building for target architecture: ...")`、`:141` 是 `find_package(ZLIB REQUIRED)`，freetype 的 `CMakeLists.txt:296` 是 `find_package(PNG)`。**如果将来有人重开 FreeType 的 PNG 支持，第二处会立刻复发**——那正是备用 shim 存在的原因。

## 1. 现象

`idf.py build` 在 CMake **配置**阶段就在 `cmake.exe` 进程内部死掉，退出码 `3221226505` = `0xC0000409`（`STATUS_STACK_BUFFER_OVERRUN` / `__fastfail`）。**没有 CMake 错误信息**，`CMakeFiles/CMakeConfigureLog.yaml` 里也没有对应条目——进程没了，不是报错退出。最后一行正常输出是 libpng 的

```
-- Building for target architecture:
```

即 `managed_components/espressif__libpng/libpng/CMakeLists.txt:125` 的 `message(STATUS ...)`。

## 2. 崩在哪条语句

`cmake --trace` 会**在执行前**回显每条语句，所以最后一条回显就是崩掉的那条：

```
D:/黑客松/managed_components/espressif__libpng/libpng/CMakeLists.txt(141):  find_package(ZLIB REQUIRED )
C:/Espressif/tools/cmake/3.30.2/share/cmake-3.30/Modules/FindZLIB.cmake(87):  cmake_policy(PUSH )
   ... (88, 90, 98, 101, 107, 108, 112, 113, 115, 118, 119, 120, 124)
C:/Espressif/tools/cmake/3.30.2/share/cmake-3.30/Modules/FindZLIB.cmake(125):  find_path(ZLIB_INCLUDE_DIR NAMES zlib.h ${${search}} PATH_SUFFIXES include )
```

`FindZLIB.cmake:125` 是搜索**宿主机** zlib 安装的那次 `find_path`，搜索路径在 108-111 行拼出来：

```cmake
set(_ZLIB_SEARCH_NORMAL
    PATHS "[HKEY_LOCAL_MACHINE\\SOFTWARE\\GnuWin32\\Zlib;InstallPath]"
          "$ENV{ProgramFiles}/zlib"
          "$ENV{ProgramFiles${_ZLIB_x86}}/zlib")
```

崩溃发生在**展开它的参数时**：`CMAKE_FIND_DEBUG_MODE=ON` 下本应出现的 `find_path called ...` 一行都没有打印出来，所以还没开始遍历目录就死了。

**同一个故障还有第二处，独立发生。** 把第一处绕开之后，配置又在另一条语句上死掉：

```
.../Modules/FindPNG.cmake(68):  find_package(ZLIB ${_FIND_ZLIB_ARG} )
.../Modules/FindPNG.cmake(75):  list(APPEND _PNG_INCLUDE_PATH_SUFFIXES include/libpng${v} )
.../Modules/FindPNG.cmake(78):  find_path(PNG_PNG_INCLUDE_DIR png.h PATH_SUFFIXES ${_PNG_INCLUDE_PATH_SUFFIXES} PATHS ${_PNG_INCLUDE_SEARCH_NORMAL} )
```

由 `espressif__freetype/freetype/CMakeLists.txt:296` 的 `find_package(PNG)` 触发。

## 3. 排除了什么（每条都有命令输出支撑）

- **不是 libpng，也不是 `CMAKE_SYSTEM_PROCESSOR`/架构判断。** 那行空的 `-- Building for target architecture: ` 是真的（`CMAKE_SYSTEM_NAME` 是 `Generic`、`CMAKE_SYSTEM_PROCESSOR` 为空，trace 里可见 `CMakeSystem.cmake(11): set(CMAKE_SYSTEM_PROCESSOR )`），但 libpng 紧接着的语句（`option(PNG_BUILD_ZLIB ...)`）正常执行，该文件的架构检查只有 `if()`/`string()`。崩溃在后面一条语句，在 `find_package(ZLIB)` 里面。
- **不是宿主机的 GnuWin32 zlib 或注册表。** `HKLM\SOFTWARE\GnuWin32\Zlib` 不存在；相关变量是 `M1_INCLUDE_DIR-NOTFOUND`。
- **不是非 ASCII 构建目录。** 在 ASCII 构建目录（`D:\orangecat-build`、`D:\orangecat-trace*`）里做同样的配置，崩得一模一样；而失败的编译命令行里可以看到编译器**正确**收到了 `D:/黑客松/...` 和 `-ID:/黑客松/...`。这个路径只坑 ccache（见 `build-and-usage.md` 2.2）和 Xtensa 的 ld/objdump（2.1），不坑 CMake 的配置阶段。
- **不是 CMake 3.30.2 `find_path` 本身的 bug。** 单独建一个 CMake 工程，做完全一样的 `find_path(... PATHS "[HKEY_LOCAL_MACHINE\\SOFTWARE\\GnuWin32\\Zlib;InstallPath]" "$ENV{ProgramFiles}/zlib" ...)`，甚至直接 `find_package(ZLIB REQUIRED)` 并在真实的 `toolchain-esp32s3.cmake` 下跑，都**不崩**。这个故障需要本次配置的状态才会触发；`--trace` 显示它发生在 CMake 的 C++ 代码里而不是脚本里，所以触发点在 CMake 内部，不在模块的逻辑里。
- **预先设好 `ZLIB_INCLUDE_DIR`/`ZLIB_LIBRARY` 绕不过去。** 普通变量不会让 `find_path`/`find_library` 跳过搜索，**只有 cache 值才会**（两种方式都用 `CMAKE_FIND_DEBUG_MODE=ON` 验证过）。这一条很关键：`espressif__zlib/project_include.cmake` 设的正是那些**普通**变量，所以 libpng 的 `find_package(ZLIB)` 照样会去做宿主机探测。

## 4. 定位工具

`tools/trace-cmake.ps1`：用 `cmake --trace` 跑配置并把语句回显写进日志。`--debug-output` 对这种情况没用——进程崩了，什么都不输出。

诊断过程中还给本机的 `C:\Espressif\...\Modules\FindZLIB.cmake` 打过一个临时补丁验证假设。**该补丁已还原**，`tools/revert-cmake-hostprobe-guard.mjs` 就是干这个的（幂等，跑一下输出 `clean` 表示本机 cmake 是干净的）。仓库里的修复必须自足，不能依赖机器上的改动。

## 5. 修复

见 `build-and-usage.md` 2.3。一句话版：

- `components/find-zlib-shim/` 用自己的 `FindZLIB.cmake` 回答 `find_package(ZLIB)`，路径来自 `espressif__zlib` 组件，因此宿主机探测根本不执行。
- 根 `CMakeLists.txt` 的 `FT_DISABLE_PNG` 消除第二处：那处嵌套的 `find_package(ZLIB)` **拦不住**（`FindPNG.cmake` 已从 CMake 自己的模块目录加载，嵌套查找也在那里解析），只能从源头去掉。备用 shim 见 `components/find-zlib-shim/optional-FindPNG.cmake`。
