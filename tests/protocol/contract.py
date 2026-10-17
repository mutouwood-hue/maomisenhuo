"""Independent v1 contract oracle; this is not a production endpoint."""
import copy
import json
import math
import uuid

MAX_FRAME_BYTES = 2048  # includes LF
MAX_INT = 2**53 - 1
STATS = ("food", "mood", "clean", "energy", "health")


class StorageUnavailable(OSError):
    """Temporary receiver failure: sender must retain/replay; no ACK is emitted."""


def integer(value, low=0, high=MAX_INT):
    if type(value) not in (int, float) or not math.isfinite(value) or value != math.floor(value) or not low <= value <= high:
        raise ValueError("invalid_integer")
    return int(value)


def identifier(value, maximum):
    if not isinstance(value, str) or not 1 <= len(value) <= maximum:
        raise ValueError("invalid_id")
    return value


def validate(message):
    if not isinstance(message, dict):
        raise ValueError("object_required")
    if integer(message.get("protocolVersion"), 1, 1) != 1:
        raise ValueError("protocol_version")
    kind = message.get("kind")
    if kind == "snapshot":
        pet = identifier(message.get("petId"), 64)
        if str(uuid.UUID(pet)) != pet.lower():
            raise ValueError("invalid_pet_uuid")
        integer(message.get("revision"))
        integer(message.get("updatedAtMs"))
        integer(message.get("coins"))
        for key in STATS:
            integer(message.get(key), 0, 100)
    elif kind == "event":
        identifier(message.get("petId"), 64)
        identifier(message.get("deviceId"), 64)
        identifier(message.get("eventId"), 128)
        if message.get("type") != "pet":
            raise ValueError("unsupported_event")
        integer(message.get("timestampMs"))
    elif kind == "ack":
        identifier(message.get("eventId"), 128)
        integer(message.get("revision"))
        if message.get("status") not in ("applied", "duplicate", "rejected"):
            raise ValueError("ack_status")
    elif kind == "status":
        integer(message.get("revision"))
        # Unbound badge may send an empty petId with an error status.
        pet = message.get("petId")
        if pet != "":
            identifier(pet, 64)
        if message.get("status") not in ("synced", "stale", "revision_conflict", "pet_mismatch", "error"):
            raise ValueError("status")
    else:
        raise ValueError("unknown_kind")
    return message


def encode(message):
    validate(message)
    line = (json.dumps(message, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
    if len(line) > MAX_FRAME_BYTES:
        raise ValueError("frame_too_large")
    return line


class Decoder:
    """Chunking-independent bounded oracle with rejection/resynchronization."""
    def __init__(self):
        self.pending = bytearray()
        self.discard = False
        self.errors = []

    def feed(self, chunk):
        messages = []
        for byte in chunk:
            if byte == 10:
                if self.pending and not self.discard:
                    try:
                        text = self.pending.decode("utf-8", errors="strict")
                        parsed = json.loads(text, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
                        messages.append(validate(parsed))
                    except (ValueError, TypeError, KeyError, UnicodeError):
                        self.errors.append("invalid_frame")
                self.pending.clear()
                self.discard = False
            elif not self.discard:
                if byte == 0 or len(self.pending) >= MAX_FRAME_BYTES - 1:
                    self.pending.clear()
                    self.discard = True
                    self.errors.append("frame_too_large_or_nul")
                else:
                    self.pending.append(byte)
        return messages


class AppOracle:
    """Transactional expectation for a durable event receiver, with fault injection."""
    def __init__(self, snapshot, durable=None):
        self.durable = durable if durable is not None else {"snapshot": copy.deepcopy(snapshot), "seen": []}
        self.state = copy.deepcopy(self.durable)

    def event(self, event, fail_commit=False):
        result = {"protocolVersion": 1, "kind": "ack", "eventId": event.get("eventId", ""), "revision": self.state["snapshot"]["revision"]}
        try:
            validate(event)
            if event["petId"] != self.state["snapshot"]["petId"]:
                raise ValueError("pet_mismatch")
            key = (event["deviceId"], event["eventId"])
            if key in self.state["seen"]:
                return dict(result, status="duplicate")
            next_state = copy.deepcopy(self.state)
            next_state["snapshot"]["mood"] = min(100, next_state["snapshot"]["mood"] + 9)
            next_state["snapshot"]["revision"] += 1
            next_state["seen"].append(key)
            if fail_commit:
                raise StorageUnavailable("storage_unavailable")
            self.durable.clear()
            self.durable.update(copy.deepcopy(next_state))
            self.state = next_state
            return dict(result, status="applied", revision=next_state["snapshot"]["revision"])
        except ValueError as error:
            return dict(result, status="rejected", reason=str(error))
