#!/usr/bin/env node
/**
 * Verify that every setting in sdkconfig.defaults actually reached the build.
 *
 * WHY THIS EXISTS
 * ---------------
 * ESP-IDF applies sdkconfig.defaults only to values that are NOT already present in
 * the root sdkconfig file. The root sdkconfig is a generated file, but it is also
 * user-editable and it survives across builds, so it silently wins forever after it
 * is created. Adding a line to sdkconfig.defaults therefore changes nothing on any
 * machine that already has an sdkconfig, and there is no warning: the build just
 * uses the old value.
 *
 * That is not a hypothetical. It cost a full debug cycle here: a CJK font option was
 * added to sdkconfig.defaults, the stale sdkconfig kept it disabled, and the only
 * symptom was a compile error about an undeclared font symbol deep inside the UI --
 * which points at the font table rather than at the configuration that decides
 * whether the font exists. The font decision now lives in sdkconfig.defaults and the
 * vendored faces under main/ui/fonts/, so there is no longer a UI source that names
 * such a symbol; the failure mode is unchanged for every other setting. On a board
 * it would have been worse: the same mistake with a font that *did* compile would
 * show up as blank Chinese labels, which looks like a rendering bug.
 *
 * WHERE THE FILES ARE
 * -------------------
 * Not necessarily next to this script. The project lives on a path containing
 * non-ASCII characters, so it is built from an ASCII mirror; the generated sdkconfig
 * is written into that mirror and the build tree is elsewhere again. tools/
 * build-firmware.ps1 records where in tools/.last-build.json, and this script reads
 * that record. Without it, the check used to look only at <project>/sdkconfig and
 * <project>/build/... -- neither of which ever exists in a staged build -- so it
 * printed "not generated yet" and passed **while checking nothing at all**. A guard
 * that silently succeeds when it cannot find its input is worse than no guard, so
 * once a build record exists, missing files are now a failure rather than a skip.
 *
 * TWO CHECKS, because they catch different moments:
 *
 *   1. the generated sdkconfig           -- is it consistent with sdkconfig.defaults?
 *                                           This is the file that overrides the
 *                                           defaults.
 *   2. build/config/sdkconfig.h          -- the header the compiler actually consumes.
 *                                           The sdkconfig is an input, not a guarantee.
 *
 * Usage:
 *   node tools/check-sdkconfig.mjs
 *   node tools/check-sdkconfig.mjs --sdkconfig <path> --header <path>
 *
 * Exit code 0 = consistent, 1 = a default was dropped (or could not be checked).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = parseCli(process.argv.slice(2));

const DEFAULTS = join(root, 'sdkconfig.defaults');
const BUILD_RECORD = join(root, 'tools', '.last-build.json');

/** Parse `--name value` / `--name=value` into a plain object. */
function parseCli(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

/**
 * Read the paths recorded by the last build-firmware.ps1 run. Returns null when no
 * build has been run through that script yet.
 */
function readBuildRecord() {
  if (!existsSync(BUILD_RECORD)) return null;
  try {
    // PowerShell 5.1 writes UTF-8 *with* a BOM for `-Encoding UTF8`, and
    // JSON.parse rejects a leading U+FEFF. Strip it rather than depending on how
    // the writer happened to encode the file.
    const text = readFileSync(BUILD_RECORD, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** First existing path, else null. Reports every path considered when it fails. */
function locate(explicit, candidates) {
  if (explicit) return existsSync(explicit) ? explicit : null;
  for (const c of candidates) if (c && existsSync(c)) return c;
  return null;
}

/** Parse `name=value` lines, ignoring comments and blanks. */
function parseAssignments(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    if (!name.startsWith('CONFIG_')) continue;
    out.set(name, line.slice(eq + 1).trim());
  }
  return out;
}

/**
 * Parse the generated header into the same shape, so the two can be compared.
 * sdkconfig.h expresses booleans as `#define X 1` and leaves disabled options out
 * entirely; the root sdkconfig spells them `CONFIG_X=y` / `# CONFIG_X is not set`.
 */
function parseHeader(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^#define\s+(CONFIG_\w+)\s+(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    out.set(m[1], value);
  }
  return out;
}

const failures = [];
const notes = [];

if (!existsSync(DEFAULTS)) {
  console.error(`ERROR: ${DEFAULTS} is missing; there is nothing to verify against.`);
  process.exit(1);
}
const defaults = parseAssignments(readFileSync(DEFAULTS, 'utf8'));
if (defaults.size === 0) {
  console.error(`ERROR: ${DEFAULTS} contains no CONFIG_ assignments; refusing to report success.`);
  process.exit(1);
}

const record = readBuildRecord();
if (record?.isM2) {
  const m2DefaultsPath = join(root, 'sdkconfig.m2.defaults');
  if (!existsSync(m2DefaultsPath)) {
    console.error('ERROR: M2 build recorded but sdkconfig.m2.defaults is missing.');
    process.exit(1);
  }
  for (const [name, value] of parseAssignments(readFileSync(m2DefaultsPath, 'utf8'))) defaults.set(name, value);
}

/*
 * Tolerate a build that is running right now.
 *
 * tools/build-firmware.ps1 re-stages the ASCII mirror with `robocopy /MIR`, which wipes
 * the destination and re-copies it. During that window the mirror's sdkconfig genuinely
 * does not exist, so this check failed intermittently with "no generated sdkconfig found,
 * though a build was recorded" -- for a reason that had nothing to do with the
 * configuration. A guard that fails spuriously is one people learn to ignore, which is
 * the exact failure mode the header of this file warns about.
 *
 * So a missing file is retried briefly before it is called a real failure. The guard's
 * promise is unchanged: if a build was recorded and the files are still absent after the
 * retry window, that is a failure, not a skip.
 */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const locateRetrying = (explicit, candidates, attempts = 6, delayMs = 1500) => {
  for (let i = 0; i < attempts; i++) {
    const found = locate(explicit, candidates);
    if (found || i === attempts - 1) return found;
    sleepSync(delayMs);
  }
  return null;
};

// Where the generated files should be. A staged build puts them in the mirror and in
// the build tree; a build in place puts them next to the project. The record wins when
// it exists, because it describes an actual build rather than a guess.
const sdkconfigCandidates = record
  ? [record.sdkconfig, record.projectDir && join(record.projectDir, record.isM2 ? 'sdkconfig.m2' : 'sdkconfig'), join(root, record.isM2 ? 'sdkconfig.m2' : 'sdkconfig')]
  : [join(root, 'sdkconfig')];
const headerCandidates = record
  ? [record.buildDir && join(record.buildDir, 'config', 'sdkconfig.h'),
     join(root, 'build', 'config', 'sdkconfig.h')]
  : [join(root, 'build', 'config', 'sdkconfig.h')];

// Retry only in the recorded case: without a build record there is nothing that was
// supposed to exist yet, and waiting would just make the no-build path slow.
const sdkconfigPath = record
  ? locateRetrying(cli.sdkconfig, sdkconfigCandidates)
  : locate(cli.sdkconfig, sdkconfigCandidates);
const headerPath = record
  ? locateRetrying(cli.header, headerCandidates)
  : locate(cli.header, headerCandidates);

// A build happened, so its outputs must exist. Not finding them means this check
// cannot see what it is supposed to verify -- which must not pass quietly.
if (record && !sdkconfigPath) {
  failures.push(`no generated sdkconfig found, though a build was recorded. Looked at:\n      ${sdkconfigCandidates.filter(Boolean).join('\n      ')}`);
}
if (record && !headerPath) {
  failures.push(`no sdkconfig.h found, though a build was recorded. Looked at:\n      ${headerCandidates.filter(Boolean).join('\n      ')}`);
}

// ---- check 1: the generated sdkconfig, which overrides the defaults ------------
if (sdkconfigPath) {
  const text = readFileSync(sdkconfigPath, 'utf8');
  const current = parseAssignments(text);
  for (const [name, want] of defaults) {
    const got = current.get(name);
    if (got === undefined) {
      // `# CONFIG_X is not set` means the option exists but is disabled.
      const disabled = new RegExp(`^#\\s*${name} is not set`, 'm').test(text);
      failures.push(
        disabled
          ? `${name}: sdkconfig.defaults wants "${want}" but sdkconfig explicitly disables it`
          : `${name}: sdkconfig.defaults wants "${want}" but sdkconfig has no such entry`);
    } else if (got !== want) {
      failures.push(`${name}: sdkconfig.defaults wants "${want}" but sdkconfig has "${got}"`);
    }
  }
  notes.push(`checked ${current.size} settings in ${sdkconfigPath}`);
} else if (!record) {
  notes.push('no generated sdkconfig yet (no build recorded), nothing to compare');
}

// ---- check 2: the header the compiler actually reads --------------------------
if (headerPath) {
  const header = parseHeader(readFileSync(headerPath, 'utf8'));
  for (const [name, want] of defaults) {
    const got = header.get(name);
    const expectedHeaderValue = want === 'y' ? '1' : want;
    // Boolean enabled options use 1; numeric 1 must remain numeric rather than y.
    if (got === undefined) {
      if (want === 'y') failures.push(`${name}: absent from sdkconfig.h (expected enabled)`);
    } else if (got !== expectedHeaderValue) {
      failures.push(`${name}: sdkconfig.h has "${got}", defaults wants "${want}"`);
    }
  }
  notes.push(`checked ${header.size} defines in ${headerPath}`);
} else if (!record) {
  notes.push('no sdkconfig.h yet (no build recorded), nothing to compare');
}

for (const n of notes) console.log(n);

if (failures.length) {
  console.error('');
  console.error('sdkconfig drift detected:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  console.error('A setting in sdkconfig.defaults is not in effect. ESP-IDF only applies the');
  console.error('defaults to options that are absent from the generated sdkconfig, so a stale');
  console.error('sdkconfig silently wins. Delete it and rebuild:');
  console.error('');
  console.error('    Remove-Item sdkconfig; tools\\build-firmware.ps1 build');
  console.error('');
  process.exit(1);
}

console.log('sdkconfig is consistent with sdkconfig.defaults');
