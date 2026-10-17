#!/usr/bin/env python3
"""Lightweight host regression of the production gesture classifier; no device I/O."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
C_TEST = r'''
#include "badge_gesture.h"
#include <stdio.h>
#include <stdint.h>
static unsigned checks, failures;
static void expect(const char *name, badge_gesture_kind_t actual, badge_gesture_kind_t expected) {
    checks++;
    if(actual!=expected) { failures++; fprintf(stderr,"FAIL %s: %d != %d\n",name,actual,expected); }
    else printf("PASS %s\n",name);
}
static badge_gesture_kind_t run(int dx,int dy,uint32_t duration) {
    badge_gesture_t g={0}; badge_gesture_begin(&g,200,200,0);
    return badge_gesture_end(&g,200+dx,200+dy,duration);
}
int main(void) {
    expect("tap at300ms and11px",run(11,0,300),BADGE_GESTURE_TAP);
    expect("301ms is not a tap",run(0,0,301),BADGE_GESTURE_NONE);
    expect("12px is not a tap",run(12,0,100),BADGE_GESTURE_NONE);
    expect("599ms is not a hold",run(0,0,599),BADGE_GESTURE_NONE);
    expect("600ms is a hold not tap",run(0,0,600),BADGE_GESTURE_HOLD);
    expect("hold allows11px",run(11,0,600),BADGE_GESTURE_HOLD);
    expect("hold rejects12px",run(12,0,600),BADGE_GESTURE_NONE);
    expect("49px is not swipe",run(49,0,100),BADGE_GESTURE_NONE);
    expect("50px at500ms swipe",run(50,0,500),BADGE_GESTURE_RIGHT);
    expect("501ms is not swipe",run(50,0,501),BADGE_GESTURE_NONE);
    expect("up",run(0,-50,100),BADGE_GESTURE_UP);
    expect("left",run(-50,0,100),BADGE_GESTURE_LEFT);
    expect("down",run(0,50,100),BADGE_GESTURE_DOWN);
    expect("diagonal distance and dominant direction",run(40,40,100),BADGE_GESTURE_DOWN);
    badge_gesture_t g={0}; badge_gesture_begin(&g,200,200,0); badge_gesture_move(&g,220,200);
    expect("out and back never taps",badge_gesture_end(&g,200,200,100),BADGE_GESTURE_NONE);
    g=(badge_gesture_t){0}; badge_gesture_begin(&g,200,200,0); badge_gesture_move(&g,250,200);
    expect("out and back is not a final swipe",badge_gesture_end(&g,200,200,100),BADGE_GESTURE_NONE);
    g=(badge_gesture_t){0}; badge_gesture_begin(&g,200,200,UINT32_MAX-100);
    expect("tap across timer wrap",badge_gesture_end(&g,200,200,199),BADGE_GESTURE_TAP);
    g=(badge_gesture_t){0}; badge_gesture_begin(&g,200,200,UINT32_MAX-300);
    expect("hold across timer wrap",badge_gesture_end(&g,200,200,299),BADGE_GESTURE_HOLD);
    g=(badge_gesture_t){0}; badge_gesture_begin(&g,-10,900,0);
    expect("clamp edge coordinates",badge_gesture_end(&g,-1,700,100),BADGE_GESTURE_TAP);
    if(g.x!=0 || g.y!=465 || g.last_x!=0 || g.last_y!=465) { failures++; fprintf(stderr,"FAIL clamp range\n"); }
    g=(badge_gesture_t){0};
    expect("inactive release",badge_gesture_end(&g,200,200,100),BADGE_GESTURE_NONE);
    badge_gesture_begin(&g,200,200,0); badge_gesture_begin(&g,200,200,400);
    expect("target re-press does not reset duration",badge_gesture_end(&g,200,200,600),BADGE_GESTURE_HOLD);
    printf("CHECKS %u FAILURES %u\n",checks,failures); return failures ? 1 : 0;
}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=ROOT / "firmware/tools/latest-gesture-report.json")
    args = parser.parse_args()
    compiler = shutil.which("cc") or shutil.which("clang")
    report = {"timestamp": datetime.now(timezone.utc).isoformat(), "status": "failed", "checks": 0,
              "sourceSha256": {}, "scope": "Host production classifier only; no LVGL/hardware acceptance"}
    for name in ("badge_gesture.c", "badge_gesture.h", "badge_ui_contract.h"):
        source = ROOT / "firmware/main" / name
        report["sourceSha256"][name] = hashlib.sha256(source.read_bytes()).hexdigest()
    if not compiler:
        report["error"] = "A host C compiler is unavailable"
    else:
        with tempfile.TemporaryDirectory(prefix="cat-gesture-") as directory:
            folder = Path(directory); test = folder / "test.c"; executable = folder / "test"
            test.write_text(C_TEST)
            build = subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-I", str(ROOT / "firmware/main"),
                                    str(test), str(ROOT / "firmware/main/badge_gesture.c"), "-o", str(executable)], capture_output=True, text=True)
            if build.returncode:
                report["error"] = build.stderr
            else:
                result = subprocess.run([str(executable)], capture_output=True, text=True)
                report.update(status="passed" if result.returncode == 0 else "failed", checks=result.stdout.count("PASS "),
                              stdout=result.stdout, stderr=result.stderr)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "checks": report["checks"], "report": str(args.report)}, ensure_ascii=False))
    raise SystemExit(0 if report["status"] == "passed" else 1)


if __name__ == "__main__":
    main()
