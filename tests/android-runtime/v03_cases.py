"""Actual platform touches for original clinic and outdoor completion.

No bridge evaluation, injected event/score, seeded inventory or save writes.
Only the separately authorized emulator harness can execute these flows.
"""
import time


class V03Cases:
    def _surface(self, label):
        nodes = self.h.find(label)
        assert len(nodes) == 1, "Expected one actual canvas: " + label
        return self.h.bounds(nodes[0])

    def clinic_complete(self):
        before = self.h.read_state()
        cost = 4 if before.get("healthIssue") is None else 8
        assert before["coins"] >= cost, "Keep real funds; never seed currency"
        self.h.tap_label("按原型步骤检查并治疗小猫")
        time.sleep(3)
        for number, name in enumerate(["体温计", "听诊器", "护理棉"], 1):
            self.h.tap_label("选择" + name + "，并按住小猫身体完成当前检查", scroll=False)
            x1, y1, x2, y2 = self._surface("按住猫咪身体进行检查")
            x, y = x1 + (x2-x1)*.57, y1 + (y2-y1)*.49
            self.h.swipe(x, y, x+2, y+1, 1800)
            self.h.capture("clinic-actual-tool-" + str(number))
        assert self.h.find("三项检查完成后确认付费护理"), "Actual checks have not enabled payment"
        self.h.tap_label("三项检查完成后确认付费护理", scroll=False)
        after = self.h.read_state()
        assert after["pendingClinic"] is None
        assert after["coins"] == before["coins"] - cost
        assert after["healthIssue"] is None and after["petId"] == before["petId"]
        self.h.capture("clinic-actual-paid-once")
        return {"costOnce": cost, "beforeCoins": before["coins"], "afterCoins": after["coins"]}

    def walk_complete(self):
        before = self.h.read_state()
        assert before.get("healthIssue") is None and before["stats"]["energy"] >= 12
        self.h.tap_label("选择真实本地出游活动")
        self.h.tap_label("暖爪小庭院", scroll=False)
        self.h.tap_label("牵绳散步 · 陪小猫依次走到三个路标。", scroll=False)
        pending = self.h.read_state()["pendingOutdoor"]
        story = ["butterfly", "lost-pouch", "rain"][sum(map(ord, pending["token"])) % 3]
        time.sleep(11)  # Actual original scene clock and observed encounter.
        self.h.capture("walk-natural-encounter-" + story)
        label = {"butterfly": "陪它观察 · 心情 +6", "lost-pouch": "帮忙找失主 · 心情 +6", "rain": "用小毯子擦干 · 健康 +3"}[story]
        for _ in range(4):
            controls = self.h.find(label)
            panels = self.h.find("户外偶遇")
            if controls and panels:
                a, b, c, d = self.h.bounds(controls[0])
                l, t, r, bottom = self.h.bounds(panels[0])
                if t < (b+d)/2 < bottom:
                    self.h.tap((a+c)/2, (b+d)/2)
                    break
                self.h.swipe((l+r)/2, bottom-12, (l+r)/2, t+30, 600)
            else:
                self.h.swipe(self.h.width*.55, self.h.height*.67, self.h.width*.55, self.h.height*.55, 600)
        else:
            raise AssertionError("Actual encounter option not reachable; do not bypass it")
        # A platform tap returns before the WebView -> Native -> disk response.
        # Observe the actual durable choice; never synthesize a success callback.
        for _ in range(30):
            chosen = self.h.read_state()
            if chosen["pendingOutdoor"] and chosen["pendingOutdoor"]["choice"]:
                break
            if story == "rain":
                break  # Rain intentionally remains uncommitted until scrub.
            time.sleep(.1)
        canvas = "小猫户外生活：点击地面遛猫，点击物品走近拾取；也可拖动或使用方向键"
        if story == "rain":
            time.sleep(.4)
            assert self.h.read_state()["wet"] is True
            x1, y1, x2, y2 = self._surface(canvas)
            left, right, y = x1+(x2-x1)*.60, x1+(x2-x1)*.84, y1+(y2-y1)*.35
            self.h.swipe(left, y, right, y, 1400)
            self.h.swipe(right, y, left, y, 1400)
            for _ in range(30):
                if self.h.read_state()["wet"] is False:
                    break
                time.sleep(.1)
            assert self.h.read_state()["wet"] is False, "Real scrub did not complete"
        chosen = self.h.read_state()
        assert chosen["pendingOutdoor"]["choice"]["event"] == story
        assert chosen["coins"] == before["coins"] and chosen["xp"] == before["xp"]
        for count, (xr, yr) in enumerate([(.775, .55), (.34, .52), (.23, .71)], 1):
            x1, y1, x2, y2 = self._surface(canvas)
            self.h.tap(x1+(x2-x1)*xr, y1+(y2-y1)*yr)
            for _ in range(24):
                state = self.h.read_state()
                if len(state["pendingOutdoor"]["collected"]) >= count:
                    break
                time.sleep(.65)
            assert len(state["pendingOutdoor"]["collected"]) == count
            self.h.capture("walk-actual-route-" + str(count))
        self.h.tap_label("完成原型出游目标后，把实际收获带回家", scroll=False)
        after = self.h.read_state()
        order = 0 if "first_walk" in before["world"]["claimedOrders"] else 8
        assert after["pendingOutdoor"] is None
        assert after["coins"] == before["coins"] + 4 + order
        assert after["xp"] == before["xp"] + 6
        assert after["world"]["completed"]["walk"] == before["world"]["completed"]["walk"] + 1
        self.h.capture("walk-actual-settlement")
        self.h.tap_label("回到小屋", scroll=False)
        self.h.capture("walk-actual-home")
        return {"story": story, "coins": after["coins"], "xp": after["xp"], "originalOrderCoins": order}


V03_CASES = ["clinic_complete", "walk_complete"]
