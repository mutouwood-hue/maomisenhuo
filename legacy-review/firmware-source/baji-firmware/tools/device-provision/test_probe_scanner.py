"""Synthetic-only scanner regressions: no serial import or real key access."""
import io
import unittest
from unittest.mock import patch
import provision as p

MAC = bytes.fromhex('001122334455')
NONCE = b'probe001'

class Port:
    def __init__(self, stream=b'', fragment=64):
        self.stream = bytearray(stream)
        self.fragment = fragment
        self.writes = []
        self.read_count = 0
    def read(self, count):
        self.read_count += 1
        count = min(count, self.fragment)
        result = bytes(self.stream[:count])
        del self.stream[:count]
        return result
    def write(self, payload):
        self.writes.append(bytes(payload))
        return len(payload)
    def close(self):
        raise IOError('UNTRUSTED_SENTINEL_DO_NOT_LOG')

class ScannerTests(unittest.TestCase):
    def ready(self):
        return p.frame(2, MAC, NONCE)
    def probe(self, stream, fragment=64):
        port = Port(stream, fragment)
        diagnostics = p.Diagnostics()
        with patch('builtins.open', side_effect=AssertionError('key access forbidden')):
            result = p.transfer(port, None, MAC, diagnostics, True)
        self.assertEqual(len(port.writes), 1)
        self.assertEqual(port.writes[0][8], 1)
        self.assertFalse(diagnostics.may_have_written)
        return result, port, diagnostics
    def test_fragmented_magic_and_noise(self):
        for size in (1, 3, 7, 64):
            result, port, diagnostics = self.probe(b'ROM startup\r\n' + self.ready(), size)
            self.assertIsNone(result)
            self.assertTrue(diagnostics.probe_ready)
            self.assertEqual(diagnostics.ready_scan_noise, 13)
            self.assertEqual(diagnostics.ready_scan_candidates, 1)
    def test_bad_candidates_then_ready(self):
        for mutate in (lambda b: b.__setitem__(60, b[60]^1),
                       lambda b: (b.__setitem__(12, b[12]^1), p.checksum(b)),
                       lambda b: (b.__setitem__(11, 1), p.checksum(b)),
                       lambda b: (b.__setitem__(slice(18,26), bytes(8)), p.checksum(b))):
            bad = self.ready()
            mutate(bad)
            _, _, diagnostics = self.probe(bad + self.ready())
            self.assertTrue(diagnostics.probe_ready)
            self.assertEqual(diagnostics.ready_scan_candidates, 2)
    def test_rejection_terminal(self):
        for status in range(1, 10):
            rejected = p.frame(4, MAC)
            rejected[9] = status
            p.checksum(rejected)
            result, _, diagnostics = self.probe(rejected + self.ready(), 1)
            self.assertEqual(result, status)
            self.assertFalse(diagnostics.probe_ready)
            self.assertIsNone(diagnostics.confirmed_result)
            self.assertEqual(diagnostics.ready_scan_bytes, 64)
    def test_early_ok_terminal(self):
        diagnostics = p.Diagnostics()
        port = Port(p.frame(4, MAC) + self.ready())
        with self.assertRaises(p.ProvisionError) as caught:
            p.transfer(port, None, MAC, diagnostics, True)
        self.assertEqual(caught.exception.code, 'PREMATURE_SUCCESS')
        self.assertEqual(len(port.writes), 1)
        self.assertFalse(diagnostics.probe_ready)
    def test_byte_limit(self):
        diagnostics = p.Diagnostics()
        port = Port(b'x'*4096 + self.ready())
        with self.assertRaises(p.ProvisionError) as caught:
            p.read_ready_reply(port, MAC, diagnostics)
        self.assertEqual(caught.exception.code, 'SCAN_LIMIT')
        self.assertEqual(diagnostics.ready_scan_bytes, 4096)
        self.assertLessEqual(diagnostics.ready_scan_candidates, 4096)
    def test_frame_at_exact_limit(self):
        _, _, diagnostics = self.probe(b'x'*(4096-64) + self.ready())
        self.assertEqual(diagnostics.ready_scan_bytes, 4096)
        self.assertTrue(diagnostics.probe_ready)
    def test_deadline(self):
        diagnostics = p.Diagnostics()
        port = Port()
        with patch.object(p.time, 'monotonic', side_effect=(0, 9)):
            with self.assertRaises(TimeoutError):
                p.read_ready_reply(port, MAC, diagnostics)
        self.assertEqual(port.read_count, 0)
    def test_close_preserves_probe(self):
        _, port, diagnostics = self.probe(self.ready())
        p.close_port(port, diagnostics)
        self.assertTrue(diagnostics.probe_ready)
        self.assertTrue(diagnostics.close_failed)
        self.assertEqual(diagnostics.error, 'PORT_CLOSE')
    def test_normal_ready_allows_scanner(self):
        port = Port(b'noise' + self.ready() + p.frame(4, MAC, NONCE))
        diagnostics = p.Diagnostics()
        with patch.object(p, 'read_ready_reply', wraps=p.read_ready_reply) as scanner, patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))):
            self.assertEqual(p.transfer(port, 'synthetic', MAC, diagnostics), 0)
        self.assertEqual(scanner.call_count, 1)
        self.assertEqual(len(port.writes), 2)
        self.assertFalse(diagnostics.probe_ready)
    def test_result_still_strict(self):
        ready = self.ready()
        port = Port(ready + b'noise' + p.frame(4, MAC, NONCE))
        diagnostics = p.Diagnostics()
        with patch.object(p, 'read_ready_reply', wraps=p.read_ready_reply), patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))):
            with self.assertRaises(p.ProvisionError) as caught:
                p.transfer(port, 'synthetic', MAC, diagnostics)
        self.assertEqual(caught.exception.code, 'BAD_MAGIC')
        self.assertTrue(diagnostics.may_have_written)
        self.assertIsNone(diagnostics.confirmed_result)
    def test_owned_buffers_wiped(self):
        observed = []
        original = p.wipe
        def observe(buf):
            original(buf)
            observed.append(buf)
        with patch.object(p, 'wipe', side_effect=observe):
            self.probe(b'noise' + self.ready())
        self.assertTrue(observed)
        self.assertTrue(all(not any(buf) for buf in observed))

if __name__ == '__main__':
    unittest.main()
