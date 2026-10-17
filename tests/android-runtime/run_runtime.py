"""Actual API35 UI/AtomicFile acceptance. Does not inject JS or mutate saves."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import time
import traceback
from adb_harness import AdbHarness, PACKAGE, SERIAL
from v02_cases import V02Cases, V02_CASES
from v03_cases import V03Cases, V03_CASES


class Blocked(RuntimeError):
    pass


def unchanged_business(before, after):
    for key in ("petId", "name", "counts", "coins", "xp", "processedEvents", "claimedGoals"):
        assert before[key] == after[key], f"Canceled/rejected operation changed {key}"


class RuntimeSuite(V02Cases, V03Cases):
    def __init__(self, harness, upgrade_apk=None):
        self.h = harness
        self.upgrade_apk = upgrade_apk

    def launch(self):
        self.h.start()
        time.sleep(1.5)
        state = self.h.read_state()
        self.h.capture("launch")
        return {"petId": state["petId"], "revision": state["revision"], "permissions": self.h.permissions()}

    def touch_pet(self):
        before = self.h.read_state()
        if before["stats"]["mood"] >= 98:
            raise Blocked("Real saved mood is at cap; no replacement/injected save permitted")
        self.h.tap_label("摸摸，幸福加一")
        after = self.h.read_state()
        assert after["petId"] == before["petId"]
        assert after["counts"]["pet"] == before["counts"]["pet"] + 1
        assert after["xp"] == before["xp"] + 3 and after["coins"] == before["coins"]
        target = min(100, before["stats"]["mood"] + 9)
        assert target - .3 <= after["stats"]["mood"] <= target
        assert after["revision"] > before["revision"]
        self.h.capture("real-touch-pet")
        return {"revision": after["revision"], "mood": after["stats"]["mood"]}

    def cancel_care(self):
        before = self.h.read_state()
        self.h.tap_label("小鱼干，3 枚喵币")
        self.h.tap_label("取消照料互动，不消耗或结算", scroll=False)
        after = self.h.read_state()
        unchanged_business(before, after)
        self.h.capture("feed-canceled")
        return {"feedCount": after["counts"]["feed"], "coins": after["coins"]}

    def cancel_game(self):
        before = self.h.read_state()
        self.h.tap_label("接小鱼，赚取喵币")
        time.sleep(1)
        self.h.capture("game-before-cancel", include_ui=False)
        self.h.tap_label("取消这局", scroll=False)
        after = self.h.read_state()
        unchanged_business(before, after)
        self.h.capture("game-canceled")
        return {"playCount": after["counts"]["play"]}

    def background_game(self):
        before = self.h.read_state()
        self.h.tap_label("接小鱼，赚取喵币")
        time.sleep(1)
        self.h.key("KEYCODE_HOME")
        time.sleep(2)
        self.h.start()
        time.sleep(1)
        after = self.h.read_state()
        unchanged_business(before, after)
        assert not self.h.find("取消这局"), "Canceled background game must not resume"
        self.h.capture("background-game-canceled")
        return {"playCount": after["counts"]["play"]}

    def full_twenty_second_game(self):
        before = self.h.read_state()
        if before["stats"]["energy"] < 10:
            raise Blocked("Real saved energy is too low; no injected state permitted")
        self.h.tap_label("接小鱼，赚取喵币")
        started = time.monotonic()
        self.h.capture("game-start", include_ui=False)
        settled, direction, captured = None, False, False
        while time.monotonic() - started < 30:
            elapsed = time.monotonic() - started
            state = self.h.read_state()
            if state["counts"]["play"] != before["counts"]["play"]:
                assert elapsed >= 18, f"20-second game settled too early: {elapsed:.2f}s"
                settled = state
                break
            # Actual platform gestures in the game surface; no forged score or JS.
            x1, x2 = self.h.width * .18, self.h.width * .82
            if direction:
                x1, x2 = x2, x1
            self.h.swipe(x1, self.h.height * .57, x2, self.h.height * .57, 650)
            direction = not direction
            if elapsed > 7 and not captured:
                self.h.capture("game-live-touches", include_ui=False)
                captured = True
            time.sleep(.15)
        assert settled is not None, "No real game settlement after 30s of real touches"
        assert settled["counts"]["play"] == before["counts"]["play"] + 1
        messages = [row["message"] for row in settled["journal"] if re.search(r"接住了 \d+ 条小鱼", row["message"])]
        assert messages, "Actual saved journal has no game result"
        score = int(re.search(r"接住了 (\d+) 条小鱼", messages[-1]).group(1))
        assert 0 <= score <= 15
        assert settled["coins"] == before["coins"] + 3 + round(score * 9 / 15)
        assert settled["xp"] == before["xp"] + 10 + round(score * 10 / 15)
        self.h.capture("game-real-settlement")
        assert score > 0, "Elapsed game saved, but positive touch/collision acceptance not proven"
        return {"elapsedSeconds": round(time.monotonic() - started, 3), "score": score, "coins": settled["coins"]}

    def touch_sleep(self):
        before = self.h.read_state()
        if before["stats"]["energy"] >= 95:
            raise Blocked("Real saved energy already full; positive sleep unavailable")
        self.h.tap_label("睡觉，晚安好梦")
        after = self.h.read_state()
        assert after["counts"]["sleep"] == before["counts"]["sleep"] + 1
        assert after["xp"] == before["xp"] + 6 and after["coins"] == before["coins"]
        target = min(100, before["stats"]["energy"] + 35)
        assert target - .3 <= after["stats"]["energy"] <= target
        self.h.capture("real-touch-sleep")
        return {"energy": after["stats"]["energy"]}

    def reject_invalid_name(self):
        self.h.scroll_top()
        before = self.h.read_state()
        self.h.tap_label("小猫名字，点击修改", scroll=False)
        tree, _ = self.h.dump()
        editors = [node for node in tree.iter("node") if node.attrib.get("class") == "android.widget.EditText" and node.attrib.get("package") == PACKAGE]
        assert len(editors) == 1, "Name dialog must expose one real EditText"
        x1, y1, x2, y2 = self.h.bounds(editors[0])
        self.h.tap((x1 + x2) // 2, (y1 + y2) // 2)
        self.h.key("KEYCODE_MOVE_END")
        for _ in range(len(before["name"]) + 3):
            self.h.key("KEYCODE_DEL")
        self.h.shell("input", "text", "Q")
        self.h.tap_label("保存", scroll=False)
        after = self.h.read_state()
        unchanged_business(before, after)
        assert self.h.find("名字需要", contains=True), "Rejection must be visible"
        self.h.capture("invalid-name-rejected")
        return {"retainedName": after["name"]}

    def reject_search_without_permission(self):
        self.h.scroll_top()
        permissions = self.h.permissions()
        if any(permissions[key] is True for key in ("BLUETOOTH_SCAN", "BLUETOOTH_CONNECT")):
            raise Blocked("Permission already granted; this harness never revokes or grants it")
        self.h.tap_label("连接与管理电子吧唧", scroll=False)
        self.h.tap_label("搜索附近可连接的猫咪吧唧", scroll=False)
        assert self.h.find("请先通过", contains=True), "Permission refusal must be visible"
        assert self.h.permissions() == permissions
        self.h.capture("search-refused-no-permission")
        self.h.tap_label("回到小猫", scroll=False)
        return {"permissionsUnchanged": permissions}

    def force_stop_restart(self):
        self.h.stop()
        stopped = self.h.read_state()
        self.h.start()
        time.sleep(1)
        after = self.h.read_state()
        assert after == stopped, "Actual AtomicFile state changed at force-stop/start"
        self.h.capture("force-stop-start-persistent-state")
        return {"petId": after["petId"], "revision": after["revision"], "coins": after["coins"], "counts": after["counts"]}


CASES = ["launch", "touch_pet", "cancel_care", "cancel_game", "background_game", "full_twenty_second_game", "touch_sleep", "reject_invalid_name", "reject_search_without_permission", "force_stop_restart"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True, choices=[SERIAL])
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--upgrade-apk", type=Path, help="Candidate APK, used only by explicit upgrade_in_place case")
    parser.add_argument("--skip-initial-install", action="store_true", help="Continue the already verified emulator installation without reinstalling its baseline APK")
    parser.add_argument("--adb")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--cases", nargs="+", choices=CASES + V02_CASES + V03_CASES, default=CASES)
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = args.output or Path(__file__).parent / "artifacts" / stamp
    harness = AdbHarness(args.serial, output, args.adb)
    report = {"startedAtUtc": datetime.now(timezone.utc).isoformat(), "scope": "Actual API35 ARM64 emulator UI and AtomicFile; excludes real BLE, physical phone/badge, power and cloud acceptance", "cases": []}
    report_path = output / "runtime-report.json"
    def save():
        report["metadata"] = harness.metadata
        report["status"] = "passed" if len(report["cases"]) == len(args.cases) and all(row["status"] == "passed" for row in report["cases"]) else "incomplete"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    try:
        harness.preflight()
        if args.skip_initial_install:
            harness.verify_existing_apk(args.apk)
        else:
            harness.install(args.apk)
        suite = RuntimeSuite(harness, args.upgrade_apk)
        for name in args.cases:
            started, row = time.monotonic(), {"name": name}
            try:
                row.update(evidence=getattr(suite, name)(), status="passed")
            except Blocked as error:
                row.update(status="blocked", error=str(error))
            except Exception as error:
                row.update(status="failed", error=str(error), traceback=traceback.format_exc())
                try:
                    row["failureCapture"] = harness.capture("failure-" + name)
                except Exception as capture_error:
                    row["captureError"] = str(capture_error)
            row["seconds"] = round(time.monotonic() - started, 3)
            report["cases"].append(row)
            save()
            print(f"{name}: {row['status']}", flush=True)
            if row["status"] == "failed":
                break  # Do not hide a failure with data reset or later actions.
    except Exception as error:
        report["setupError"] = str(error)
        report["setupTraceback"] = traceback.format_exc()
    finally:
        save()
    print(f"Evidence: {report_path}")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
