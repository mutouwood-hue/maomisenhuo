"""Additional actual UI flows; no save writes, bridge calls or fake inventory."""
import time


class V02Cases:
    def _raw_control(self, description):
        tree, _ = self.h.dump()
        nodes = [node for node in tree.iter("node") if node.attrib.get("package") == "com.catforest.app" and node.attrib.get("content-desc") == description]
        assert len(nodes) == 1, "Expected exactly one UI control: " + description
        return nodes[0]

    def _assert_no_reward(self, before, after):
        for key in ("petId", "name", "counts", "coins", "xp", "inventory", "healthIssue"):
            assert before.get(key) == after.get(key), "Canceled action changed " + key
        if "world" in before:
            for key in ("completed", "collected", "claimedOrders", "choices"):
                assert before["world"][key] == after["world"][key], "Canceled action changed world." + key

    def upgrade_in_place(self):
        assert self.upgrade_apk is not None, "--upgrade-apk is required for this explicit case"
        self.h.stop()
        before = self.h.read_state()
        self.h.capture("pre-upgrade-real-save")
        self.h.metadata["baselineQualification"] = "Existing APK/save retained as upgrade baseline; its prior qualification is recorded separately"
        self.h.install(self.upgrade_apk)
        self.h.start()
        time.sleep(1.5)
        after = self.h.read_state()
        for key in before:
            if key not in ("revision", "updatedAtMs"):
                assert after.get(key) == before[key], "Upgrade lost/changed existing field: " + key
        assert after["revision"] >= before["revision"]
        self.h.capture("post-upgrade-real-save")
        return {"petId": after["petId"], "beforeRevision": before["revision"], "afterRevision": after["revision"]}

    def wardrobe_purchase_and_rewear(self):
        before = self.h.read_state()
        owned = before.get("wardrobe", ["none"])
        candidates = [("bandana", "莓莓三角巾", 12), ("bow", "蝴蝶结", 18)]
        choices = [item for item in candidates if item[0] not in owned and before["coins"] >= item[2]]
        assert choices, "No affordable unowned test outfit; keep actual save, do not seed coins"
        item, name, price = choices[0]
        self.h.tap_label("打开手机小屋的服饰衣柜和毛色选择")
        self.h.tap_label(f"{name}，{price} 枚喵币 · 买下并穿上")
        purchased = self.h.read_state()
        assert purchased["coins"] == before["coins"] - price
        assert purchased["outfit"] == item and purchased["wardrobe"].count(item) == 1
        selected = self._raw_control(name + "，正在穿着")
        assert selected.attrib.get("enabled") == "false", "Already selected outfit must not be buyable again"
        x1, y1, x2, y2 = self.h.bounds(selected)
        self.h.tap((x1+x2)//2, (y1+y2)//2)  # real touch on disabled repeat purchase control
        assert self.h.read_state()["coins"] == purchased["coins"]
        self.h.tap_label("换回自然毛毛")
        assert self.h.read_state()["outfit"] == "none"
        self.h.tap_label(name + "，衣柜已拥有 · 穿上")
        reworn = self.h.read_state()
        assert reworn["outfit"] == item and reworn["coins"] == purchased["coins"]
        assert reworn["wardrobe"].count(item) == 1
        self.h.capture("wardrobe-bought-repeat-blocked-reworn")
        self.h.tap_label("回到小屋", scroll=False)
        self.force_stop_restart()
        assert self.h.read_state()["outfit"] == item
        return {"outfit": item, "costOnce": price, "coins": reworn["coins"]}

    def empty_inventory_buttons(self):
        before = self.h.read_state()
        empty = [(key, name) for key, name in [("fish", "小鱼"), ("flower", "野花"), ("shell", "贝壳"), ("star", "星星石")] if before.get("inventory", {}).get(key, 0) == 0]
        assert empty, "No genuinely empty inventory slot; do not alter saved inventory"
        self.h.tap_label("查看出游收获与出售物品")
        for key, name in empty:
            for label in ("出售一份" + name, "出售背包里的全部" + name):
                node = self._raw_control(label)
                assert node.attrib.get("enabled") == "false", "Zero stock sale should be disabled: " + key
        node = self._raw_control("出售一份" + empty[0][1])
        x1, y1, x2, y2 = self.h.bounds(node)
        self.h.tap((x1+x2)//2, (y1+y2)//2)
        after = self.h.read_state()
        self._assert_no_reward(before, after)
        self.h.capture("actual-empty-stock-sale-disabled")
        self.h.tap_label("收好", scroll=False)
        return {"emptySlotsVerified": [key for key, _ in empty]}

    def _start_explore(self):
        self.h.tap_label("选择真实本地出游活动")
        self.h.tap_label("暖爪小庭院", scroll=False)
        self.h.tap_label("自由探险 · 让小猫闻花、找贝壳，收集五件小礼物。", scroll=False)

    def outdoor_cancel(self):
        before = self.h.read_state()
        self._start_explore()
        started = self.h.read_state()
        assert started["pendingOutdoor"]["mode"] == "explore"
        assert started["pendingOutdoor"]["collected"] == []
        self.h.capture("outdoor-real-session-before-cancel")
        self.h.tap_label("回到小屋", scroll=False)
        after = self.h.read_state()
        assert after["pendingOutdoor"] is None
        self._assert_no_reward(before, after)
        self.h.capture("outdoor-canceled-without-reward")
        return {"inventory": after["inventory"], "coins": after["coins"]}

    def clinic_cancel(self):
        before = self.h.read_state()
        expected_cost = 4 if before.get("healthIssue") is None else 8
        assert before["coins"] >= expected_cost, "Real funds insufficient to start clinic"
        self.h.tap_label("按原型步骤检查并治疗小猫")
        pending = self.h.read_state()
        assert pending["pendingClinic"]["cost"] == expected_cost
        assert pending["coins"] == before["coins"], "Opening clinic must not charge"
        finish = self._raw_control("三项检查完成后确认付费护理")
        assert finish.attrib.get("enabled") == "false", "Payment must be disabled before three real checks"
        self.h.capture("clinic-open-unpaid-incomplete")
        self.h.tap_label("回到小屋", scroll=False)
        after = self.h.read_state()
        assert after["pendingClinic"] is None
        self._assert_no_reward(before, after)
        self.h.capture("clinic-canceled-without-charge")
        return {"costNotCharged": expected_cost, "coins": after["coins"]}


V02_CASES = ["upgrade_in_place", "wardrobe_purchase_and_rewear", "empty_inventory_buttons", "outdoor_cancel", "clinic_cancel"]
