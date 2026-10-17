/**
 * Remove the machine-local "host probe guard" that a diagnostic step inserted into
 * CMake's own FindZLIB.cmake.
 *
 * WHY THIS EXISTS
 * ---------------
 * The guard was a local workaround for a genuine crash (see
 * components/find-zlib-shim/CMakeLists.txt for the analysis), but it edited a file
 * belonging to the CMake installation rather than to this project. That makes the
 * build depend on an unrecorded machine-global mutation: it would vanish on a CMake
 * upgrade, and it would not exist at all for anyone else who checks this project out.
 * The crash is fixed inside the repository instead (components/find-zlib-shim plus
 * FT_DISABLE_PNG in the root CMakeLists.txt), so the guard is now dead weight and is
 * removed here.
 *
 * The guard is delimited by two comment markers, so it can be excised without
 * re-downloading CMake. This script is idempotent.
 *
 * Usage: node tools/revert-cmake-hostprobe-guard.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2] ??
  'C:\\Espressif\\tools\\cmake\\3.30.2\\share\\cmake-3.30\\Modules\\FindZLIB.cmake';

const START = '# --- local patch: skip the host probe';
const END = '# --- local patch: end';

const src = readFileSync(target, 'utf8');
const i = src.indexOf(START);

if (i < 0) {
  console.log(`clean (no guard installed): ${target}`);
  process.exit(0);
}

const j = src.indexOf(END, i);
if (j < 0) {
  console.error(`guard start found but no end marker at ${i}; refusing to edit ${target}`);
  process.exit(1);
}

let k = src.indexOf('\n', j);
k = k < 0 ? src.length : k + 1;

// The guard was inserted immediately before this line, so also swallow a blank line
// that the insertion left behind.
let end = k;
if (src.slice(k, k + 2) === '\r\n') end = k + 2;
else if (src[k] === '\n') end = k + 1;

writeFileSync(target, src.slice(0, i) + src.slice(end), 'utf8');
console.log(`reverted ${end - i} bytes in ${target}`);
