"""One-shot local USB provisioning. Never prints key, frames or exception details."""
import argparse
import binascii
import struct
import time
import logging
import uuid
from dataclasses import dataclass, field

LOGGER = logging.getLogger("device_provision")
STAGES = frozenset({"OPEN", "HELLO_SEND", "READY_READ", "READY_VALIDATE", "KEY_READ", "SET_SEND", "RESULT_READ", "RESULT_VALIDATE", "CLOSE", "DONE"})
ERRORS = frozenset({"IO", "TIMEOUT", "SHORT_FRAME", "BAD_MAGIC", "BAD_FIELDS", "BAD_CRC", "MAC_MISMATCH", "NONCE_MISMATCH", "BAD_READY", "PREMATURE_SUCCESS", "KEY_FILE_LENGTH", "ZERO_KEY", "UNEXPECTED_RESULT", "PORT_CLOSE", "SCAN_LIMIT"})

class ProvisionError(Exception):
    def __init__(self, code):
        self.code = code if code in ERRORS else "IO"
        super().__init__(self.code)

@dataclass
class Diagnostics:
    stage: str = "OPEN"
    may_have_written: bool = False
    confirmed_result: int | None = None
    probe_ready: bool = False
    ready_scan_bytes: int = 0
    ready_scan_noise: int = 0
    ready_scan_candidates: int = 0
    failure_stage: str | None = None
    error: str | None = None
    close_failed: bool = False
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    started: float = field(default_factory=time.monotonic)
    emit: bool = False

    def enter(self, stage):
        if stage not in STAGES:
            raise ProvisionError("IO")
        self.stage = stage
        if self.emit:
            LOGGER.info("stage=%s elapsed_ms=%d may_have_written=%s confirmed_result=%s", stage, int((time.monotonic()-self.started)*1000), self.may_have_written, self.confirmed_result, extra={"traceId": self.trace_id})

    def fail(self, error):
        if self.failure_stage is None:
            self.failure_stage = self.stage
            self.error = error.code if isinstance(error, ProvisionError) else "TIMEOUT" if isinstance(error, TimeoutError) else "IO"


MAGIC = b"BJPROV1!"
SIZE = 64
READY_TIMEOUT_SECONDS = 8
READY_BYTE_LIMIT = 4096
STATUS = {0: "OK", 1: "EXISTS_REFUSED", 2: "NVS_INIT_FAILED", 3: "NVS_OPEN_FAILED", 4: "NVS_QUERY_FAILED", 5: "SET_FAILED_PERSISTENCE_UNCERTAIN", 6: "COMMIT_UNCERTAIN", 7: "READBACK_FAILED_UNCERTAIN", 8: "PROTOCOL_REJECTED", 9: "DEVICE_TIMEOUT"}


def wipe(buf):
    for i in range(len(buf)):
        buf[i] = 0


def checksum(frame):
    struct.pack_into("<I", frame, 60, binascii.crc32(memoryview(frame)[:60]) & 0xffffffff)


def frame(kind, mac=b"\0" * 6, nonce=b"\0" * 8):
    result = bytearray(SIZE)
    result[:8] = MAGIC
    result[8] = kind
    result[12:18] = mac
    result[18:26] = nonce
    checksum(result)
    return result


def parse_reply(raw, expected_mac, nonce=None):
    if len(raw) != SIZE:
        raise ProvisionError("SHORT_FRAME")
    if raw[:8] != MAGIC:
        raise ProvisionError("BAD_MAGIC")
    if raw[8] not in (2, 4) or raw[10] or raw[11] or any(raw[26:60]) or raw[9] not in STATUS:
        raise ProvisionError("BAD_FIELDS")
    if struct.unpack_from("<I", raw, 60)[0] != binascii.crc32(memoryview(raw)[:60]) & 0xffffffff:
        raise ProvisionError("BAD_CRC")
    if raw[12:18] != expected_mac:
        raise ProvisionError("MAC_MISMATCH")
    if nonce is not None and raw[18:26] != nonce:
        raise ProvisionError("NONCE_MISMATCH")
    if raw[8] == 2 and (raw[9] != 0 or not any(raw[18:26])):
        raise ProvisionError("BAD_READY")
    return raw[8], raw[9], bytes(raw[18:26])


def read_reply(port, timeout):
    # No permissive resync after handshake. Startup boot noise is intentionally a
    # failure: operator must open the helper after ROM output has stopped.
    deadline = time.monotonic() + timeout
    raw = bytearray()
    while len(raw) < SIZE and time.monotonic() < deadline:
        raw.extend(port.read(SIZE - len(raw)))
    if len(raw) != SIZE:
        raise TimeoutError("bounded read")
    return raw


def read_ready_reply(port, expected_mac, diagnostics):
    """Pre-key READY sync only; bounded, never logs bytes or sends anything."""
    deadline = time.monotonic() + READY_TIMEOUT_SECONDS
    limit = READY_BYTE_LIMIT
    pending = bytearray()
    diagnostics.ready_scan_bytes = 0
    diagnostics.ready_scan_noise = 0
    diagnostics.ready_scan_candidates = 0
    try:
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError("bounded probe")
            while len(pending) >= len(MAGIC):
                if time.monotonic() >= deadline:
                    raise TimeoutError("bounded probe")
                if pending[:len(MAGIC)] != MAGIC:
                    pending[0] = 0
                    del pending[0]
                    diagnostics.ready_scan_noise += 1
                    continue
                if len(pending) < SIZE:
                    break
                diagnostics.ready_scan_candidates += 1
                candidate = bytearray(pending[:SIZE])
                try:
                    kind, status, _ = parse_reply(candidate, expected_mac)
                except ProvisionError:
                    wipe(candidate)
                    pending[0] = 0
                    del pending[0]
                    diagnostics.ready_scan_noise += 1
                    continue
                # A fully valid RESULT is terminal, including premature OK: the
                # unchanged transfer validator rejects OK before SET.
                wipe(pending)
                return candidate
            if diagnostics.ready_scan_bytes >= limit:
                raise ProvisionError("SCAN_LIMIT")
            if time.monotonic() >= deadline:
                raise TimeoutError("bounded probe")
            chunk = port.read(min(SIZE-len(pending), limit-diagnostics.ready_scan_bytes))
            if len(chunk) > min(SIZE-len(pending), limit-diagnostics.ready_scan_bytes):
                raise ProvisionError("IO")
            diagnostics.ready_scan_bytes += len(chunk)
            pending.extend(chunk)
            # Driver returns immutable bytes; application-owned copies are wiped
            # on all exits. No forensic removal guarantee for OS/Python copies.
    finally:
        wipe(pending)
        if diagnostics.emit:
            LOGGER.info("ready_scan_bytes=%d ready_scan_noise=%d ready_scan_candidates=%d", diagnostics.ready_scan_bytes, diagnostics.ready_scan_noise, diagnostics.ready_scan_candidates, extra={"traceId": diagnostics.trace_id})


def transfer(port, secret_path, mac, diagnostics=None, probe_only=False):
    diagnostics = diagnostics or Diagnostics()
    if probe_only and secret_path is not None:
        raise ProvisionError("IO")
    hello = frame(1)
    payload = bytearray(SIZE)
    key = bytearray(32)
    reply = bytearray()
    try:
        diagnostics.enter("HELLO_SEND")
        if port.write(hello) != SIZE:
            raise ProvisionError("IO")
        diagnostics.enter("READY_READ")
        reply = read_ready_reply(port, mac, diagnostics)
        diagnostics.enter("READY_VALIDATE")
        kind, status, nonce = parse_reply(reply, mac)
        if kind == 4:
            if status == 0:
                raise ProvisionError("PREMATURE_SUCCESS")
            return status
        if probe_only:
            if secret_path is not None:
                raise ProvisionError("IO")
            diagnostics.probe_ready = True
            return None
        diagnostics.enter("KEY_READ")
        with open(secret_path, "rb", buffering=0) as source:
            if source.readinto(key) != 32 or source.read(1):
                raise ProvisionError("KEY_FILE_LENGTH")
        if not any(key):
            raise ProvisionError("ZERO_KEY")
        payload[:] = frame(3, mac, nonce)
        payload[10] = 32
        payload[26:58] = key
        checksum(payload)
        diagnostics.may_have_written = True
        diagnostics.enter("SET_SEND")
        if port.write(payload) != SIZE:
            raise ProvisionError("IO")
        wipe(payload)
        wipe(key)
        wipe(reply)
        diagnostics.enter("RESULT_READ")
        reply = read_reply(port, 8)
        diagnostics.enter("RESULT_VALIDATE")
        kind, status, _ = parse_reply(reply, mac, nonce)
        if kind != 4:
            raise ProvisionError("UNEXPECTED_RESULT")
        diagnostics.confirmed_result = status
        return status
    except Exception as error:
        diagnostics.fail(error)
        raise
    finally:
        wipe(hello)
        wipe(payload)
        wipe(key)
        wipe(reply)


def close_port(port, diagnostics):
    diagnostics.enter("CLOSE")
    try:
        port.close()
    except Exception:
        diagnostics.close_failed = True
        if diagnostics.failure_stage is None:
            diagnostics.failure_stage = "CLOSE"
            diagnostics.error = "PORT_CLOSE"
    # Never overwrite nonce-bound confirmed_result with a close exception.


def dry_run():
    mac = bytes.fromhex("001122334455")
    nonce = b"dryrun01"
    greeting = frame(2, mac, nonce)
    assert parse_reply(greeting, mac) == (2, 0, nonce)
    for offset in range(SIZE):
        bad = bytearray(greeting)
        bad[offset] ^= 1
        try:
            parse_reply(bad, mac)
        except ProvisionError:
            pass
        else:
            raise AssertionError("corrupt frame accepted")
    for length in (0, 1, 63, 65):
        try:
            parse_reply(bytearray(length), mac)
        except ProvisionError:
            pass
        else:
            raise AssertionError("bad length accepted")
    for code in STATUS:
        done = frame(4, mac, nonce)
        done[9] = code
        checksum(done)
        assert parse_reply(done, mac, nonce)[:2] == (4, code)
    class EarlySuccessPort:
        def __init__(self):
            self.writes = []
            self.response = frame(4, mac, nonce)
        def write(self, data):
            self.writes.append(bytes(data))
            return len(data)
        def read(self, length):
            out = self.response[:length]
            del self.response[:length]
            return out
    early = EarlySuccessPort()
    try:
        transfer(early, "DO_NOT_OPEN_NO_SECRET_EXISTS", mac)
    except ProvisionError:
        assert len(early.writes) == 1 and early.writes[0][8] == 1
    else:
        raise AssertionError("premature success accepted")
    # No port import/open and no secret file access on this path.
    print("PASS dry-run: fixed-frame CRC, strict lengths, identity and statuses; no secret or serial access")


def diagnostic_tests():
    from unittest.mock import patch
    import io
    mac = bytes.fromhex("001122334455")
    nonce = b"dryrun01"
    sentinel = "SECRET_SENTINEL_NEVER_LOG"

    class FakePort:
        def __init__(self, fail=None):
            self.fail = fail
            self.writes = 0
        def write(self, payload):
            self.writes += 1
            if (self.writes == 1 and self.fail == "HELLO_SEND") or (self.writes == 2 and self.fail == "SET_SEND"):
                raise IOError(sentinel)
            return SIZE
        def close(self):
            raise IOError(sentinel)

    def responses(port, timeout):
        if port.fail == ("READY_READ" if port.writes == 1 else "RESULT_READ"):
            raise TimeoutError(sentinel)
        result = frame(2 if port.writes == 1 else 4, mac, nonce)
        if port.fail == ("READY_VALIDATE" if port.writes == 1 else "RESULT_VALIDATE"):
            result[0] ^= 1
        return result

    for stage in ("HELLO_SEND", "READY_READ", "READY_VALIDATE", "KEY_READ", "SET_SEND", "RESULT_READ", "RESULT_VALIDATE"):
        diagnostics = Diagnostics()
        port = FakePort(stage)
        source = io.BytesIO(bytes(range(32)))
        with patch("builtins.open", side_effect=IOError(sentinel) if stage == "KEY_READ" else None, return_value=source), patch(__name__ + ".read_reply", side_effect=responses), patch(__name__ + ".read_ready_reply", side_effect=lambda port, mac, diagnostics: responses(port, 8)):
            try:
                transfer(port, "synthetic-only", mac, diagnostics)
            except Exception:
                assert diagnostics.failure_stage == stage
                assert diagnostics.may_have_written == (stage in ("SET_SEND", "RESULT_READ", "RESULT_VALIDATE"))
                assert diagnostics.confirmed_result is None
                assert diagnostics.error in ERRORS and sentinel not in diagnostics.error
            else:
                raise AssertionError("injected error accepted")

    diagnostics = Diagnostics()
    port = FakePort()
    with patch("builtins.open", side_effect=AssertionError("probe must not open key")), patch(__name__ + ".read_reply", side_effect=responses), patch(__name__ + ".read_ready_reply", side_effect=lambda port, mac, diagnostics: responses(port, 8)):
        assert transfer(port, None, mac, diagnostics, True) is None
        assert diagnostics.probe_ready and port.writes == 1 and not diagnostics.may_have_written
    diagnostics = Diagnostics()
    with patch("builtins.open", return_value=io.BytesIO(bytes(range(32)))), patch(__name__ + ".read_reply", side_effect=responses), patch(__name__ + ".read_ready_reply", side_effect=lambda port, mac, diagnostics: responses(port, 8)):
        assert transfer(FakePort(), "synthetic-only", mac, diagnostics) == 0
    close_port(FakePort(), diagnostics)
    assert diagnostics.confirmed_result == 0 and diagnostics.may_have_written
    assert diagnostics.error == "PORT_CLOSE" and diagnostics.failure_stage == "CLOSE"

    for code, mutate in (
        ("SHORT_FRAME", lambda b: b.pop()),
        ("BAD_MAGIC", lambda b: b.__setitem__(0, 0)),
        ("BAD_FIELDS", lambda b: b.__setitem__(11, 1)),
        ("BAD_CRC", lambda b: b.__setitem__(60, b[60] ^ 1)),
        ("MAC_MISMATCH", lambda b: (b.__setitem__(12, b[12] ^ 1), checksum(b))),
        ("NONCE_MISMATCH", lambda b: (b.__setitem__(18, b[18] ^ 1), checksum(b))),
        ("BAD_READY", lambda b: (b.__setitem__(9, 1), checksum(b))),
    ):
        response = frame(2, mac, nonce)
        mutate(response)
        try:
            parse_reply(response, mac, nonce)
        except ProvisionError as error:
            assert error.code == code
        else:
            raise AssertionError("injected parser error accepted")
    for raw_key, expected in ((b"a"*31, "KEY_FILE_LENGTH"), (b"a"*33, "KEY_FILE_LENGTH"), (bytes(32), "ZERO_KEY")):
        diagnostics = Diagnostics()
        with patch("builtins.open", return_value=io.BytesIO(raw_key)), patch(__name__ + ".read_reply", side_effect=responses), patch(__name__ + ".read_ready_reply", side_effect=lambda port, mac, diagnostics: responses(port, 8)):
            try:
                transfer(FakePort(), "synthetic-only", mac, diagnostics)
            except ProvisionError as error:
                assert error.code == expected and not diagnostics.may_have_written
            else:
                raise AssertionError("bad synthetic key accepted")
    for phase in ("HELLO_SEND", "SET_SEND"):
        diagnostics = Diagnostics()
        class ShortWritePort(FakePort):
            def write(self, payload):
                self.writes += 1
                return SIZE-1 if self.writes == (1 if phase == "HELLO_SEND" else 2) else SIZE
        with patch("builtins.open", return_value=io.BytesIO(bytes(range(32)))), patch(__name__ + ".read_reply", side_effect=responses), patch(__name__ + ".read_ready_reply", side_effect=lambda port, mac, diagnostics: responses(port, 8)):
            try:
                transfer(ShortWritePort(), "synthetic-only", mac, diagnostics)
            except ProvisionError:
                assert diagnostics.failure_stage == phase and diagnostics.may_have_written == (phase == "SET_SEND")
            else:
                raise AssertionError("short write accepted")
    diagnostics = Diagnostics()
    with patch("builtins.open", return_value=io.BytesIO(bytes(range(32)))), patch(__name__ + ".read_reply", side_effect=lambda *unused: frame(2, mac, nonce)), patch(__name__ + ".read_ready_reply", side_effect=lambda *unused: frame(2, mac, nonce)):
        try:
            transfer(FakePort(), "synthetic-only", mac, diagnostics)
        except ProvisionError as error:
            assert error.code == "UNEXPECTED_RESULT" and diagnostics.may_have_written
        else:
            raise AssertionError("wrong result kind accepted")
    for code in range(1, 10):
        rejected = frame(4, mac, nonce)
        rejected[9] = code
        checksum(rejected)
        diagnostics = Diagnostics()
        with patch("builtins.open", side_effect=AssertionError("no key access")), patch(__name__ + ".read_reply", return_value=rejected), patch(__name__ + ".read_ready_reply", return_value=rejected):
            assert transfer(FakePort(), None, mac, diagnostics, True) == code
            assert not diagnostics.probe_ready and not diagnostics.may_have_written
    with patch("time.monotonic", side_effect=(0, 9)):
        try:
            read_reply(FakePort(), 8)
        except TimeoutError:
            pass
        else:
            raise AssertionError("timeout accepted")
    diagnostics = Diagnostics()
    diagnostics.fail(IOError(sentinel))
    assert diagnostics.failure_stage == "OPEN" and diagnostics.error == "IO"
    print("PASS synthetic diagnostic branches: stage/uncertainty/probe/close/parser; no real secret, file or serial access")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--probe-only", action="store_true", help="HELLO/expected READY only; never reads key or sends SET. NVS init/open may change metadata; fresh backup and operator approval required.")
    parser.add_argument("--port")
    parser.add_argument("--key-file", help="private binary file of exactly 32 bytes, never a key value")
    parser.add_argument("--expect-mac")
    parser.add_argument("--confirm-local-provision", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        if args.port or args.key_file or args.expect_mac or args.confirm_local_provision or args.probe_only:
            parser.error("dry-run accepts no device/secret parameters")
        dry_run()
        diagnostic_tests()
        return 0
    if not (args.port and args.expect_mac and args.confirm_local_provision):
        parser.error("explicit port/expect-mac/local confirmation required")
    if args.probe_only and args.key_file:
        parser.error("probe-only forbids key-file")
    if not args.probe_only and not args.key_file:
        parser.error("provisioning requires key-file")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(threadName)s] %(name)s [%(traceId)s] %(message)s")
    diagnostics = Diagnostics(emit=True)
    port = None
    status = None
    try:
        diagnostics.enter("OPEN")
        mac = bytes.fromhex(args.expect_mac.replace(":", ""))
        if len(mac) != 6:
            raise ProvisionError("MAC_MISMATCH")
        import serial
        port = serial.Serial(port=None, baudrate=115200, timeout=0.1, write_timeout=2)
        port.dtr = False
        port.rts = False
        port.port = args.port
        port.open()
        status = transfer(port, args.key_file, mac, diagnostics, args.probe_only)
    except Exception as error:
        diagnostics.fail(error)
    finally:
        if port is not None:
            close_port(port, diagnostics)
    # Boundary logs enum-only summary once, without exception/traceback/frame data.
    # Secret safety overrides generic stack logging: external exception strings may
    # contain payload bytes. No exception object enters the logger.
    level = logging.ERROR if diagnostics.failure_stage else logging.INFO
    LOGGER.log(level, "stage=%s error=%s may_have_written=%s confirmed_result=%s close_failed=%s probe_ready=%s result=%s; no automatic retry", diagnostics.failure_stage or diagnostics.stage, diagnostics.error, diagnostics.may_have_written, diagnostics.confirmed_result, diagnostics.close_failed, diagnostics.probe_ready, STATUS.get(status, "NONE"), extra={"traceId": diagnostics.trace_id})
    if diagnostics.failure_stage:
        return 3
    if args.probe_only:
        return 0 if diagnostics.probe_ready else 2
    return 0 if status == 0 and diagnostics.confirmed_result == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
