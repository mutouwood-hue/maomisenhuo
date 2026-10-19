#!/usr/bin/env python3
"""Generate phone and badge constants from one authored scene layout."""
from pathlib import Path
import json

APP = Path(__file__).resolve().parents[1]
REPO = APP.parent
source = REPO / "protocol/scene-layout-v1.json"
layout = json.loads(source.read_text())
room = layout["room"]
bed = room["bed"]
room_badge = room["badgeProjection"]
garden = layout["garden"]
garden_badge = garden["badgeProjection"]

js = "/* Generated from protocol/scene-layout-v1.json; shared by the phone scene and native badge. */\n"
js += "(function(root){'use strict';root.CatSceneLayout=Object.freeze(" + json.dumps(layout, ensure_ascii=False, separators=(",", ":")) + ");})(typeof window==='object'?window:globalThis);\n"
(APP / "web/scene-layout.js").write_text(js)

bed_center = bed["centerXZ"]
home_x, home_z = room_badge["homeWorldXZ"]
bed_screen_x = round(room_badge["homeFoot"][0] + (bed_center[0] * room["expansionXZ"] - home_x) * room_badge["pixelsPerWorldX"])
bed_screen_y = round(room_badge["homeFoot"][1] - (bed_center[1] * room["expansionXZ"] - home_z) * room_badge["pixelsPerWorldZ"] - bed["surfaceY"] * room_badge["pixelsPerWorldY"])
climb_x, climb_z = room_badge["climbPlatformXZ"]
climb_screen_x = round(room_badge["homeFoot"][0] + (climb_x * room["expansionXZ"] - home_x) * room_badge["pixelsPerWorldX"])
climb_screen_y = round(room_badge["homeFoot"][1] - (climb_z * room["expansionXZ"] - home_z) * room_badge["pixelsPerWorldZ"] - room_badge["climbPlatformTopY"] * room_badge["pixelsPerWorldY"])
header = """/* Generated from protocol/scene-layout-v1.json. Do not edit by hand. */
#pragma once
#define SCENE_LAYOUT_ROOM_XZ_SCALE {room_scale:.3f}f
#define SCENE_LAYOUT_ROOM_FLOOR_Y {room_floor:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_HOME_X {home_x_px}
#define SCENE_LAYOUT_ROOM_BADGE_HOME_FOOT_Y {home_y_px}
#define SCENE_LAYOUT_ROOM_BADGE_HOME_WORLD_X {home_world_x:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_HOME_WORLD_Z {home_world_z:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_X {room_px_x:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_Z {room_px_z:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_Y {room_px_y:.3f}f
#define SCENE_LAYOUT_ROOM_BED_X {bed_x:.3f}f
#define SCENE_LAYOUT_ROOM_BED_Z {bed_z:.3f}f
#define SCENE_LAYOUT_ROOM_BED_WIDTH {bed_width:.3f}f
#define SCENE_LAYOUT_ROOM_BED_DEPTH {bed_depth:.3f}f
#define SCENE_LAYOUT_ROOM_BED_SURFACE_Y {bed_y:.3f}f
#define SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_X {bed_badge_x}
#define SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_Y {bed_badge_y}
#define SCENE_LAYOUT_ROOM_BADGE_CLIMB_FOOT_X {climb_badge_x}
#define SCENE_LAYOUT_ROOM_BADGE_CLIMB_FOOT_Y {climb_badge_y}
#define SCENE_LAYOUT_GARDEN_BASE_SCALE {garden_base:.3f}f
#define SCENE_LAYOUT_GARDEN_XZ_SCALE {garden_scale:.3f}f
#define SCENE_LAYOUT_GARDEN_ORIGIN_X {garden_x:.3f}f
#define SCENE_LAYOUT_GARDEN_ORIGIN_Z {garden_z:.3f}f
#define SCENE_LAYOUT_GARDEN_BADGE_FOOT_Y {garden_foot_y}
#define SCENE_LAYOUT_GARDEN_BADGE_PATH_X {garden_path_x}
#define SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y {garden_fence_y}
#define SCENE_LAYOUT_GARDEN_BADGE_TREE_LEFT_X {garden_tree_left}
#define SCENE_LAYOUT_GARDEN_BADGE_TREE_RIGHT_X {garden_tree_right}
#define SCENE_LAYOUT_GARDEN_BADGE_FLOWER_LEFT_X {garden_flower_left}
#define SCENE_LAYOUT_GARDEN_BADGE_FLOWER_RIGHT_X {garden_flower_right}
""".format(
    room_scale=room["expansionXZ"], room_floor=room["floor"]["topY"],
    home_x_px=room_badge["homeFoot"][0], home_y_px=room_badge["homeFoot"][1],
    home_world_x=home_x, home_world_z=home_z,
    room_px_x=room_badge["pixelsPerWorldX"], room_px_z=room_badge["pixelsPerWorldZ"], room_px_y=room_badge["pixelsPerWorldY"],
    bed_x=bed_center[0] * room["expansionXZ"], bed_z=bed_center[1] * room["expansionXZ"],
    bed_width=bed["size"][0] * room["expansionXZ"], bed_depth=bed["size"][2] * room["expansionXZ"], bed_y=bed["surfaceY"],
    bed_badge_x=bed_screen_x, bed_badge_y=bed_screen_y,
    climb_badge_x=climb_screen_x, climb_badge_y=climb_screen_y,
    garden_base=garden["baseGeometryScale"], garden_scale=garden["expansionXZ"],
    garden_x=garden["originXZ"][0], garden_z=garden["originXZ"][1],
    garden_foot_y=garden_badge["groundFootY"], garden_path_x=garden_badge["pathCenterX"],
    garden_fence_y=garden_badge["fenceY"], garden_tree_left=garden_badge["treeCentersX"][0], garden_tree_right=garden_badge["treeCentersX"][1],
    garden_flower_left=garden_badge["flowerCentersX"][0], garden_flower_right=garden_badge["flowerCentersX"][1]
)
(REPO / "firmware/main/scene_layout.generated.h").write_text(header)
