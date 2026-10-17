"""Host-execute production notify_line with controlled mbuf failure; no BLE."""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/protocol"))
from test_firmware_framing import balanced_block


class NotifyAbortTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cc = shutil.which("cc")
        if not cc:
            raise unittest.SkipTest("existing cc unavailable")
        cls.temp = tempfile.TemporaryDirectory(prefix="catforest-notify-review-")
        source = (ROOT / "firmware/main/badge_ble.c").read_text()
        function = balanced_block(re.sub(r"/\*.*?\*/", "", source, flags=re.S), "static bool notify_line(")
        harness = r'''
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static uint16_t connection=1, tx_handle=2;
static uint32_t link_generation;
static bool authenticated=true, subscribed=true;
static unsigned calls, fail_call, terminations, length;
static char stream[2048];
struct os_mbuf { char data[600]; unsigned length; };
static struct os_mbuf buffers[100];
#define BLE_ERR_REM_USER_CONN_TERM 0x13
#define pdMS_TO_TICKS(x) (x)
static void vTaskDelay(unsigned ticks) { (void)ticks; }
static unsigned ble_att_mtu(uint16_t h) { (void)h; return 23; }
static struct os_mbuf *ble_hs_mbuf_from_flat(const void *data,unsigned n) {
    calls++;
    if(calls==fail_call) return NULL;
    struct os_mbuf *b=&buffers[calls]; memcpy(b->data,data,n); b->length=n; return b;
}
static int ble_gatts_notify_custom(uint16_t h,uint16_t attr,struct os_mbuf *b) {
    (void)h; (void)attr; memcpy(stream+length,b->data,b->length); length+=b->length; return 0;
}
static int ble_gap_terminate(uint16_t h,unsigned reason) {
    (void)h; (void)reason; terminations++; authenticated=false; return 0;
}
PRODUCTION
int main(int argc,char **argv) {
    (void)argc; fail_call=(unsigned)atoi(argv[1]);
    bool ok=notify_line("{\"protocolVersion\":1,\"kind\":\"status\",\"revision\":7}");
    if(!ok && !terminations) notify_line("{\"protocolVersion\":1,\"kind\":\"status\",\"revision\":8}");
    printf("%u %u %u\n",ok,terminations,length);
    fwrite(stream,1,length,stdout); return 0;
}
'''.replace("PRODUCTION", function)
        file = Path(cls.temp.name) / "notify.c"
        file.write_text(harness)
        cls.executable = Path(cls.temp.name) / "notify"
        build = subprocess.run([cc, "-std=c11", "-Wall", "-Wextra", "-Werror", str(file), "-o", str(cls.executable)], capture_output=True, text=True, timeout=20)
        if build.returncode:
            raise AssertionError(build.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_probe(self, failure):
        run = subprocess.run([str(self.executable), str(failure)], capture_output=True, check=True, timeout=10)
        header, stream = run.stdout.split(b"\n", 1)
        ok, terminations, length = map(int, header.split())
        self.assertEqual(length, len(stream))
        return ok, terminations, stream

    def test_successful_fragmented_notify_keeps_frame_intact(self):
        ok, terminations, stream = self.run_probe(0)
        self.assertEqual(ok, 1)
        self.assertEqual(terminations, 0)
        self.assertEqual(json.loads(stream)["revision"], 7)

    def test_partial_allocation_failure_does_not_poison_next_frame(self):
        ok, terminations, stream = self.run_probe(2)
        print("NOTIFY_ABORT_OBSERVATION", {"firstSuccess": ok, "terminations": terminations, "wire": stream.decode()}, flush=True)
        self.assertEqual(ok, 0)
        self.assertGreater(terminations, 0, "Partial frame allocation failure must close/reset the byte stream before another frame")


if __name__ == "__main__":
    unittest.main(verbosity=2)
