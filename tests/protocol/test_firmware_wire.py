"""Compile/load actual production UTF-8/string guard, independent expected vectors."""
import ctypes
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from test_contract import ROOT, fixture
from contract import encode


class FirmwareWireTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        compiler = shutil.which("cc")
        if not compiler:
            raise unittest.SkipTest("host C compiler missing: production encoding guard NOT tested")
        cls.temp = tempfile.TemporaryDirectory(prefix="catforest-wire-")
        library = Path(cls.temp.name) / "wire.so"
        build = subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", str(ROOT / "firmware/main/badge_wire.c"), "-o", str(library)], capture_output=True, text=True)
        if build.returncode:
            raise AssertionError("Production wire guard could not compile:\n" + build.stderr)
        cls.library = ctypes.CDLL(str(library))
        cls.guard = cls.library.badge_wire_valid
        cls.guard.argtypes = (ctypes.c_char_p, ctypes.c_size_t)
        cls.guard.restype = ctypes.c_bool

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "temp"):
            cls.temp.cleanup()

    def valid(self, data):
        return self.guard(data, len(data))

    def test_actual_guard_accepts_unicode_boundaries(self):
        for value in ["{}", "猫咪🐈", "\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff\U00010000\U0010ffff"]:
            with self.subTest(value=value):
                self.assertTrue(self.valid(value.encode("utf-8")))
        self.assertTrue(self.valid(encode(dict(fixture("snapshot.json"), note="小橘🐈"))))

    def test_actual_guard_rejects_noncanonical_and_incomplete_utf8(self):
        vectors = [b"", b"\x00", b"a\x00b", b"\x80", b"\xbf", b"\xc0\x80", b"\xc1\xbf", b"\xc2", b"\xc2A", b"\xe0\x80\x80", b"\xed\xa0\x80", b"\xed\xbf\xbf", b"\xe1\x80", b"\xf0\x80\x80\x80", b"\xf4\x90\x80\x80", b"\xf5\x80\x80\x80", b"\xf0\x90\x80", b"\xff", b"\xfe"]
        for data in vectors:
            with self.subTest(data=data.hex()):
                self.assertFalse(self.valid(data))

    def test_actual_guard_rejects_escaped_nul_without_false_positive_on_backslashes(self):
        for data in [br'{"id":"\u0000"}', br'{"id":"uuid\u0000suffix"}', br'{"note":"x\" \u0000"}', br'{"note":"x\\\" \u0000"}']:
            with self.subTest(data=data):
                self.assertFalse(self.valid(data))
        for data in [br'{"note":"\\u0000"}', br'{"note":"\\\\u0000"}', br'{"note":"x\" \\u0000"}']:
            with self.subTest(data=data):
                self.assertTrue(self.valid(data))


if __name__ == "__main__":
    unittest.main()
