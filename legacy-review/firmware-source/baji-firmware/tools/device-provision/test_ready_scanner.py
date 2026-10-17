"""Ordinary READY synchronization, synthetic-only; never opens real secret/serial."""
import io
import logging
import unittest
from unittest.mock import patch
import provision as p
from test_probe_scanner import MAC, NONCE, Port

class ReadyTests(unittest.TestCase):
    def run_transfer(self, stream, port=None):
        diagnostics = p.Diagnostics()
        port = port or Port(stream)
        with patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))) as source:
            result = p.transfer(port, 'synthetic', MAC, diagnostics)
        return result, port, diagnostics
    def test_ordinary_noise_success(self):
        result, port, diagnostics = self.run_transfer(b'ROM noise' + p.frame(2, MAC, NONCE) + p.frame(4, MAC, NONCE))
        self.assertEqual(result, 0)
        self.assertEqual([b[8] for b in port.writes], [1, 3])
        self.assertEqual(diagnostics.confirmed_result, 0)
        self.assertFalse(diagnostics.probe_ready)
    def test_invalid_candidates_never_open_key(self):
        for offset in (11, 12, 18, 60):
            bad = p.frame(2, MAC, NONCE)
            if offset == 18:
                bad[18:26] = bytes(8)
            else:
                bad[offset] ^= 1
            if offset != 60:
                p.checksum(bad)
            port = Port(bad + b'x'*4096)
            diagnostics = p.Diagnostics()
            with patch('builtins.open', side_effect=AssertionError('forbidden')) as source:
                with self.assertRaises(p.ProvisionError):
                    p.transfer(port, 'synthetic', MAC, diagnostics)
            source.assert_not_called()
            self.assertFalse(diagnostics.may_have_written)
            self.assertEqual(len(port.writes), 1)
    def test_all_early_results_terminal(self):
        for status in p.STATUS:
            reply = p.frame(4, MAC)
            reply[9] = status
            p.checksum(reply)
            port = Port(reply + p.frame(2, MAC, NONCE))
            diagnostics = p.Diagnostics()
            with patch('builtins.open', side_effect=AssertionError('forbidden')) as source:
                if status == 0:
                    with self.assertRaises(p.ProvisionError) as caught:
                        p.transfer(port, 'synthetic', MAC, diagnostics)
                    self.assertEqual(caught.exception.code, 'PREMATURE_SUCCESS')
                else:
                    self.assertEqual(p.transfer(port, 'synthetic', MAC, diagnostics), status)
            source.assert_not_called()
            self.assertEqual(diagnostics.ready_scan_bytes, 64)
            self.assertEqual(len(port.writes), 1)
    def test_4097_cannot_complete(self):
        port = Port(b'x'*(4097-64) + p.frame(2, MAC, NONCE))
        diagnostics = p.Diagnostics()
        with self.assertRaises(p.ProvisionError) as caught:
            p.read_ready_reply(port, MAC, diagnostics)
        self.assertEqual(caught.exception.code, 'SCAN_LIMIT')
        self.assertEqual(diagnostics.ready_scan_bytes, 4096)
    def test_deadline_crossing_read_rejected(self):
        clock = [0]
        class SlowPort(Port):
            def read(self, count):
                out = super().read(count)
                clock[0] = 9
                return out
        with patch.object(p.time, 'monotonic', side_effect=lambda: clock[0]):
            with self.assertRaises(TimeoutError):
                p.read_ready_reply(SlowPort(p.frame(2, MAC, NONCE)), MAC, p.Diagnostics())
    def test_results_strict_and_uncertain(self):
        for defect in ('noise', 'crc', 'nonce', 'short'):
            reply = p.frame(4, MAC, NONCE)
            if defect == 'noise':
                reply = b'noise' + reply
            elif defect == 'crc':
                reply[60] ^= 1
            elif defect == 'nonce':
                reply[18] ^= 1
                p.checksum(reply)
            else:
                reply = reply[:63]
            port = Port(p.frame(2, MAC, NONCE) + reply)
            diagnostics = p.Diagnostics()
            clock = [0]
            original_read = port.read
            def read(count):
                out = original_read(count)
                if not out:
                    clock[0] = 10
                return out
            port.read = read
            with patch.object(p.time, 'monotonic', side_effect=lambda: clock[0]), patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))):
                with self.assertRaises((p.ProvisionError, TimeoutError)):
                    p.transfer(port, 'synthetic', MAC, diagnostics)
            self.assertTrue(diagnostics.may_have_written)
            self.assertIsNone(diagnostics.confirmed_result)
            self.assertEqual(len(port.writes), 2)
    def test_set_failure_no_retry(self):
        for raises in (False, True):
            class FailedPort(Port):
                def write(self, payload):
                    count = super().write(payload)
                    if len(self.writes) == 2:
                        if raises:
                            raise IOError('EXCEPTION_SECRET_SENTINEL')
                        return count-1
                    return count
            port = FailedPort(p.frame(2, MAC, NONCE))
            diagnostics = p.Diagnostics()
            with patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))):
                with self.assertRaises((p.ProvisionError, IOError)):
                    p.transfer(port, 'synthetic', MAC, diagnostics)
            self.assertTrue(diagnostics.may_have_written)
            self.assertEqual(len(port.writes), 2)
    def test_close_preserves_confirmed(self):
        _, port, diagnostics = self.run_transfer(p.frame(2, MAC, NONCE) + p.frame(4, MAC, NONCE))
        p.close_port(port, diagnostics)
        self.assertEqual(diagnostics.confirmed_result, 0)
        self.assertTrue(diagnostics.close_failed)
    def test_exception_boundary_logger_safe(self):
        import sys
        from types import SimpleNamespace
        class OpenPort(Port):
            def open(self):
                pass
        port = OpenPort()
        fake_serial = SimpleNamespace(Serial=lambda **unused: port)
        def fail_transfer(port, path, mac, diagnostics, probe_only):
            diagnostics.may_have_written = True
            diagnostics.enter('SET_SEND')
            raise IOError('EXCEPTION_SECRET_SENTINEL')
        with patch.dict(sys.modules, {'serial': fake_serial}), patch.object(sys, 'argv', ['provision', '--port', 'SYNTHETIC_PORT', '--key-file', 'KEY_PATH_SENTINEL', '--expect-mac', '001122334455', '--confirm-local-provision']), patch.object(p, 'transfer', side_effect=fail_transfer), self.assertLogs(p.LOGGER, level=logging.INFO) as captured:
            self.assertEqual(p.main(), 3)
        text = '\n'.join(captured.output)
        for forbidden in ('EXCEPTION_SECRET_SENTINEL', 'UNTRUSTED_SENTINEL_DO_NOT_LOG', 'KEY_PATH_SENTINEL', 'SYNTHETIC_PORT'):
            self.assertNotIn(forbidden, text)
        self.assertIn('may_have_written=True', text)
        self.assertTrue(all(record.exc_info is None for record in captured.records))

    def test_logger_no_sensitive_values(self):
        diagnostics = p.Diagnostics(emit=True)
        noise = b'NOISE_SECRET_SENTINEL'
        with self.assertLogs(p.LOGGER, level=logging.INFO) as captured, patch('builtins.open', return_value=io.BytesIO(bytes(range(32)))):
            p.transfer(Port(noise + p.frame(2, MAC, NONCE) + p.frame(4, MAC, NONCE)), 'KEY_PATH_SENTINEL', MAC, diagnostics)
        text = '\n'.join(captured.output)
        for forbidden in ('NOISE_SECRET_SENTINEL', 'KEY_PATH_SENTINEL', 'EXCEPTION_SECRET_SENTINEL', repr(bytes(range(32))), NONCE.decode()):
            self.assertNotIn(forbidden, text)
        self.assertTrue(all(record.traceId == diagnostics.trace_id and record.exc_info is None for record in captured.records))

if __name__ == '__main__':
    unittest.main()
