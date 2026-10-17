import copy
import json
from pathlib import Path
import random
import unittest

from contract import AppOracle, Decoder, MAX_FRAME_BYTES, STATS, StorageUnavailable, encode, validate

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "protocol/v1/fixtures"


def fixture(name):
    return json.loads((FIXTURES / name).read_text())


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = fixture("snapshot.json")
        self.event = fixture("pet-event.json")
        self.event["petId"] = self.snapshot["petId"]

    def test_frozen_fixtures_are_wire_valid(self):
        for path in sorted(FIXTURES.glob("*.json")):
            with self.subTest(path=path.name):
                self.assertEqual(Decoder().feed(encode(json.loads(path.read_text()))), [json.loads(path.read_text())])

    def test_every_split_and_coalescing_preserve_utf8_bytes(self):
        message = dict(self.snapshot, label="小橘🐈")  # unknown fields are allowed
        line = encode(message)
        for split in range(len(line) + 1):
            decoder = Decoder()
            self.assertEqual(decoder.feed(line[:split]) + decoder.feed(line[split:]), [message])
        stream = line + encode(self.event) + line
        for seed in range(25):
            decoder, messages = Decoder(), []
            rng, pos = random.Random(seed), 0
            while pos < len(stream):
                width = rng.randrange(1, 33)
                messages.extend(decoder.feed(stream[pos:pos + width]))
                pos += width
            self.assertEqual(messages, [message, self.event, message])

    def test_limit_counts_utf8_and_lf(self):
        base = encode(dict(self.snapshot, pad=""))
        exact = dict(self.snapshot, pad="x" * (MAX_FRAME_BYTES - len(base)))
        self.assertEqual(len(encode(exact)), MAX_FRAME_BYTES)
        self.assertEqual(Decoder().feed(encode(exact)), [exact])
        with self.assertRaises(ValueError):
            encode(dict(exact, pad=exact["pad"] + "x"))
        # 3-byte character consumes three bytes, not one character.
        with self.assertRaises(ValueError):
            encode(dict(exact, pad=exact["pad"][:-1] + "猫"))

    def test_bad_frames_recover_at_next_lf(self):
        good = encode(self.snapshot)
        cases = [b"{bad}\n", b"[]\n", b'{"a":NaN}\n', b'{"x":"\xff"}\n', b'{"x":"a\x00b"}\n', b"x" * 2048 + b"\n", b"x" * 65536 + b"\n"]
        for invalid in cases:
            with self.subTest(prefix=invalid[:30]):
                decoder = Decoder()
                self.assertEqual(decoder.feed(invalid + good), [self.snapshot])
                self.assertTrue(decoder.errors)
                self.assertEqual(len(decoder.pending), 0)

    def test_ranges_types_and_versions(self):
        for key in (*STATS, "revision", "coins", "updatedAtMs"):
            values = [-1, True, 0.5, "1", None, float("inf"), float("nan")]
            if key in STATS:
                values.append(101)
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    validate(dict(self.snapshot, **{key: value}))
        for version in [0, 2, True, "1"]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                validate(dict(self.snapshot, protocolVersion=version))
        with self.assertRaises(ValueError):
            validate(dict(self.snapshot, kind="reset"))

    def test_missing_snapshot_fields_reject(self):
        for key in self.snapshot:
            mutated = copy.deepcopy(self.snapshot)
            del mutated[key]
            with self.subTest(key=key), self.assertRaises((ValueError, TypeError)):
                validate(mutated)

    def test_event_once_after_lost_ack_and_restart(self):
        app = AppOracle(self.snapshot)
        first = app.event(self.event)
        self.assertEqual(first["status"], "applied")
        self.assertEqual(app.state["snapshot"]["mood"], min(100, self.snapshot["mood"] + 9))
        self.assertEqual(first["revision"], self.snapshot["revision"] + 1)
        restarted = AppOracle(self.snapshot, app.durable)
        self.assertEqual(restarted.event(self.event)["status"], "duplicate")
        self.assertEqual(restarted.state, app.state)

    def test_pet_event_always_clamps_to_100(self):
        for mood in [0, 90, 91, 97, 98, 99, 100]:
            with self.subTest(mood=mood):
                app = AppOracle(dict(self.snapshot, mood=mood))
                self.assertEqual(app.event(self.event)["status"], "applied")
                self.assertEqual(app.state["snapshot"]["mood"], min(100, mood + 9))

    def test_failed_commit_cannot_ack_or_consume_event(self):
        app = AppOracle(self.snapshot)
        before = copy.deepcopy(app.state)
        with self.assertRaises(StorageUnavailable):
            app.event(self.event, fail_commit=True)
        self.assertEqual(app.state, before)
        self.assertEqual(app.durable, before)
        self.assertEqual(app.event(self.event)["status"], "applied")

    def test_mismatched_pet_and_invalid_event_do_not_mutate(self):
        app = AppOracle(self.snapshot)
        before = copy.deepcopy(app.state)
        for change in [{"petId": "00000000-0000-4000-8000-000000000000"}, {"type": "feed"}, {"timestampMs": -1}, {"timestampMs": True}, {"eventId": ""}, {"deviceId": ""}]:
            with self.subTest(change=change):
                self.assertEqual(app.event(dict(self.event, **change))["status"], "rejected")
                self.assertEqual(app.state, before)
        self.assertEqual(app.event(dict(self.event, timestampMs=0))["status"], "applied")


if __name__ == "__main__":
    unittest.main()
