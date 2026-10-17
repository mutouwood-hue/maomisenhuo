"""Compile the production RX loop with host I/O only; no ESP SDK required.

This deliberately extracts, rather than reimplements, the loop in badge_ble.c.
It does not exercise NimBLE callbacks, radio security, cJSON or hardware.
"""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
import unittest

from test_contract import ROOT, fixture
from contract import encode


def balanced_block(source, marker):
    start = source.index(marker)
    opening = source.index("{", start)
    depth = 1
    cursor = opening + 1
    quote = None
    escaped = False
    while depth:
        c = source[cursor]
        if quote:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        cursor += 1
    return source[start:cursor]


class FirmwareFramingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        compiler = shutil.which("cc")
        if not compiler:
            raise unittest.SkipTest("host C compiler unavailable; production RX loop NOT tested")
        cls.temp = tempfile.TemporaryDirectory(prefix="catforest-framing-")
        source = (ROOT / "firmware/main/badge_ble.c").read_text()
        header = (ROOT / "firmware/main/badge.h").read_text()
        maximum = re.search(r"#define\s+BADGE_FRAME_MAX\s+(\d+)", header)
        if not maximum:
            raise AssertionError("Cannot locate production frame limit; update harness explicitly")
        loop = balanced_block(source, "for (unsigned i=0;i<length;i++)")
        harness = r'''
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define BADGE_FRAME_MAX FRAME_LIMIT
static char rx[BADGE_FRAME_MAX+1];
static size_t rx_length;
static bool discarding;
static void badge_receive_line(const char *line) {
    printf("LINE ");
    for (const unsigned char *p=(const unsigned char *)line; *p; p++) printf("%02x",*p);
    printf("\n");
}
void badge_ble_status(const char *line) { (void)line; puts("ERROR"); }
void badge_protocol_error(const char *line) { (void)line; puts("ERROR"); }
static void feed(unsigned char *bytes, unsigned length) { PRODUCTION_LOOP }
int main(void) {
    char input[262145]; unsigned char bytes[131072];
    while (fgets(input,sizeof(input),stdin)) {
        size_t n=strcspn(input,"\r\n");
        if (n%2) return 2;
        for (size_t i=0;i<n;i+=2) { unsigned value; if (sscanf(input+i,"%2x",&value)!=1) return 3; bytes[i/2]=(unsigned char)value; }
        feed(bytes,(unsigned)(n/2));
    }
    return 0;
}
'''.replace("FRAME_LIMIT", maximum.group(1)).replace("PRODUCTION_LOOP", loop)
        c_file = Path(cls.temp.name) / "rx.c"
        cls.executable = Path(cls.temp.name) / "rx"
        c_file.write_text(harness)
        build = subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", str(c_file), "-o", str(cls.executable)], capture_output=True, text=True)
        if build.returncode:
            raise AssertionError("Production RX harness could not compile:\n" + build.stderr)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "temp"):
            cls.temp.cleanup()

    def received(self, chunks):
        result = subprocess.run([str(self.executable)], input="".join(chunk.hex() + "\n" for chunk in chunks), text=True, capture_output=True, check=True)
        return [bytes.fromhex(line[5:]) for line in result.stdout.splitlines() if line.startswith("LINE ")]

    def test_actual_rx_handles_every_split_and_coalesced_lines(self):
        line = encode(dict(fixture("snapshot.json"), note="小橘🐈"))
        for split in range(len(line) + 1):
            with self.subTest(split=split):
                self.assertEqual(self.received([line[:split], line[split:]]), [line[:-1]])
        self.assertEqual(self.received([line + line + line]), [line[:-1]] * 3)

    def test_actual_rx_accepts_maximum_including_lf(self):
        line = b" " * 2047 + b"\n"
        self.assertEqual(self.received([line]), [line[:-1]])

    def test_actual_rx_rejects_one_byte_over_limit_and_recovers(self):
        good = encode(fixture("snapshot.json"))
        for payload_size in [2048, 2049, 8192]:
            with self.subTest(payload_size=payload_size):
                invalid = b"x" * payload_size + b"\n"
                self.assertEqual(self.received([invalid + good]), [good[:-1]])

    def test_actual_rx_discards_nul_through_lf(self):
        good = encode(fixture("snapshot.json"))
        self.assertEqual(self.received([b"abc\0" + good[:-1], b"\n" + good]), [good[:-1]])

    def test_actual_rx_does_not_forward_incomplete_or_blank_frames(self):
        self.assertEqual(self.received([b"\n\n{}"]), [])


if __name__ == "__main__":
    unittest.main()
