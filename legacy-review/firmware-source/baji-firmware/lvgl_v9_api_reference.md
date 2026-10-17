# LVGL 9.5.0 exact-API reference (quoted from the vendored tree)

Source tree: `managed_components/lvgl__lvgl` (read-only, ESP-IDF managed component).
Version proof: `#define LVGL_VERSION_MAJOR 9` / `MINOR 5` / `PATCH 0` — [lv_version.h:9-11](managed_components/lvgl__lvgl/lv_version.h#L9-L11).

Notation: every claim carries `file:line`. Anything I could not find in the tree is marked **NOT FOUND IN TREE** — I did not fill gaps from memory.

---

## 1. Screen / lifecycle / style basics

### create / clean / delete
```c
lv_obj_t * lv_obj_create(lv_obj_t * parent);
```
`// src/core/lv_obj.h:191` — `parent == NULL` creates a screen.

```c
void lv_obj_delete(lv_obj_t * obj);
void lv_obj_clean(lv_obj_t * obj);
void lv_obj_delete_delayed(lv_obj_t * obj, uint32_t delay_ms);
void lv_obj_delete_async(lv_obj_t * obj);
```
`// src/core/lv_obj_tree.h:46, :54, :61, :75`

**`lv_obj_del` is not a real function in 9.5 — it is a v8 compatibility macro:**
```c
#define lv_obj_del                       lv_obj_delete
#define lv_obj_del_async                 lv_obj_delete_async
```
`// src/lv_api_map_v8.h:117-118`

### screen load
```c
void lv_screen_load(struct _lv_obj_t * scr);
void lv_screen_load_anim(lv_obj_t * scr, lv_screen_load_anim_t anim_type, uint32_t time, uint32_t delay,
                         bool auto_del);
lv_obj_t * lv_screen_active(void);
```
`// src/display/lv_display.h:466, :476-477, :483` — note `lv_screen_load` takes `struct _lv_obj_t *` (not `lv_obj_t *`) verbatim in the header.

```c
typedef enum {
    LV_SCREEN_LOAD_ANIM_NONE,
    LV_SCREEN_LOAD_ANIM_OVER_LEFT, OVER_RIGHT, OVER_TOP, OVER_BOTTOM,
    LV_SCREEN_LOAD_ANIM_MOVE_LEFT, MOVE_RIGHT, MOVE_TOP, MOVE_BOTTOM,
    LV_SCREEN_LOAD_ANIM_FADE_IN,
    LV_SCREEN_LOAD_ANIM_FADE_ON = LV_SCREEN_LOAD_ANIM_FADE_IN, /*For backward compatibility*/
    LV_SCREEN_LOAD_ANIM_FADE_OUT,
    LV_SCREEN_LOAD_ANIM_OUT_LEFT, OUT_RIGHT, OUT_TOP, OUT_BOTTOM,
} lv_screen_load_anim_t;
```
Full block `// src/display/lv_display.h:62-79`.

`lv_scr_load` / `lv_scr_load_anim` / `lv_scr_load_anim_t` are v8 aliases only:
`// src/lv_api_map_v8.h:56, :144-145`

### init / deinit (mandatory)
```c
void lv_init(void);
void lv_deinit(void);
bool lv_is_initialized(void);
```
`// src/lv_init.h:35, :40, :45` — `lv_init()` must be called before any widget creation.

### style removal
```c
void lv_obj_remove_style(lv_obj_t * obj, const lv_style_t * style, lv_style_selector_t selector);
void lv_obj_remove_style_all(lv_obj_t * obj);
```
`// src/core/lv_obj_style.h:141, :156`

The header's own documented usage — this is exactly the arc-knob idiom:
```c
lv_obj_remove_style(obj, &style, LV_PART_ANY | LV_STATE_ANY); //Remove a specific style
lv_obj_remove_style(obj, NULL, LV_PART_MAIN | LV_STATE_ANY); //Remove all styles from the main part
lv_obj_remove_style(obj, NULL, LV_PART_ANY | LV_STATE_ANY); //Remove all styles
```
`// src/core/lv_obj_style.h:134-138`

### style setters (all take a trailing `lv_style_selector_t selector`)
```c
void lv_obj_set_style_bg_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector);      // lv_obj_style_gen.h:2270
void lv_obj_set_style_bg_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector);          // lv_obj_style_gen.h:2285
void lv_obj_set_style_border_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);     // lv_obj_style_gen.h:2494
void lv_obj_set_style_radius(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);           // lv_obj_style_gen.h:3138
void lv_obj_set_style_text_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector);    // lv_obj_style_gen.h:2874
void lv_obj_set_style_text_font(lv_obj_t * obj, const lv_font_t * value, lv_style_selector_t selector); // lv_obj_style_gen.h:2902
void lv_obj_set_style_text_letter_space(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // lv_obj_style_gen.h:2915
void lv_obj_set_style_text_align(lv_obj_t * obj, lv_text_align_t value, lv_style_selector_t selector); // lv_obj_style_gen.h:2958
void lv_obj_set_style_pad_top(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);          // lv_obj_style_gen.h:2127
void lv_obj_set_style_pad_left(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);         // lv_obj_style_gen.h:2153
```
All in `src/core/lv_obj_style_gen.h`.

**`pad_all` / `pad_hor` / `pad_ver` are NOT in the generated header — they are `static inline` helpers in `lv_obj_style.h`:**
```c
static inline void lv_obj_set_style_pad_all(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);  // lv_obj_style.h:276
static inline void lv_obj_set_style_pad_hor(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);  // lv_obj_style.h:284
static inline void lv_obj_set_style_pad_ver(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);  // lv_obj_style.h:290
```
Each expands into the four/two per-side setters, e.g. `pad_all` calls `pad_left/right/top/bottom` — `// src/core/lv_obj_style.h:276-294`.

`lv_text_align_t`: `LV_TEXT_ALIGN_AUTO, LEFT, CENTER, RIGHT` — `// src/misc/lv_text.h:55-58`.

**Important:** `src/core/lv_obj_style_gen.h` has only two conditional blocks in the whole file (`LV_USE_FLEX` at :1617/:3366 and `LV_USE_GRID` at :1680/:3434). Every style setter above is therefore **unconditionally declared** — no `LV_USE_*` gates them. Evidence: [lv_obj_style_gen.h:1617-1801](managed_components/lvgl__lvgl/src/core/lv_obj_style_gen.h#L1617-L1801).

### LV_OPA_*
```c
enum _lv_opacity_level_t {
    LV_OPA_TRANSP = 0,
    LV_OPA_0      = 0,
    LV_OPA_10     = 25,
    LV_OPA_20     = 51,
    LV_OPA_30     = 76,
    LV_OPA_40     = 102,
    LV_OPA_50     = 127,
    LV_OPA_60     = 153,
    LV_OPA_70     = 178,
    LV_OPA_80     = 204,
    LV_OPA_90     = 229,
    LV_OPA_100    = 255,
    LV_OPA_COVER  = 255,
};
#define LV_OPA_MIN 2    /**< Fully transparent if opa <= LV_OPA_MIN */
#define LV_OPA_MAX 253  /**< Fully cover if opa >= LV_OPA_MAX */
```
`// src/misc/lv_color.h:40-57`

### position / size / align
```c
void lv_obj_set_pos(lv_obj_t * obj, int32_t x, int32_t y);                                   // src/core/lv_obj_pos.h:54
void lv_obj_set_x(lv_obj_t * obj, int32_t x);                                                // src/core/lv_obj_pos.h:65
void lv_obj_set_y(lv_obj_t * obj, int32_t y);                                                // src/core/lv_obj_pos.h:76
void lv_obj_set_size(lv_obj_t * obj, int32_t w, int32_t h);                                  // src/core/lv_obj_pos.h:89
void lv_obj_set_width(lv_obj_t * obj, int32_t w);                                            // src/core/lv_obj_pos.h:108
void lv_obj_set_height(lv_obj_t * obj, int32_t h);                                           // src/core/lv_obj_pos.h:120
void lv_obj_align(lv_obj_t * obj, lv_align_t align, int32_t x_ofs, int32_t y_ofs);           // src/core/lv_obj_pos.h:179
void lv_obj_align_to(lv_obj_t * obj, const lv_obj_t * base, lv_align_t align, int32_t x_ofs,
                     int32_t y_ofs);                                                          // src/core/lv_obj_pos.h:190-191
```

### LV_ALIGN_*
```c
typedef enum {
    LV_ALIGN_DEFAULT = 0,
    LV_ALIGN_TOP_LEFT, LV_ALIGN_TOP_MID, LV_ALIGN_TOP_RIGHT,
    LV_ALIGN_BOTTOM_LEFT, LV_ALIGN_BOTTOM_MID, LV_ALIGN_BOTTOM_RIGHT,
    LV_ALIGN_LEFT_MID, LV_ALIGN_RIGHT_MID, LV_ALIGN_CENTER,
    LV_ALIGN_OUT_TOP_LEFT, LV_ALIGN_OUT_TOP_MID, LV_ALIGN_OUT_TOP_RIGHT,
    LV_ALIGN_OUT_BOTTOM_LEFT, LV_ALIGN_OUT_BOTTOM_MID, LV_ALIGN_OUT_BOTTOM_RIGHT,
    LV_ALIGN_OUT_LEFT_TOP, LV_ALIGN_OUT_LEFT_MID, LV_ALIGN_OUT_LEFT_BOTTOM,
    LV_ALIGN_OUT_RIGHT_TOP, LV_ALIGN_OUT_RIGHT_MID, LV_ALIGN_OUT_RIGHT_BOTTOM,
} lv_align_t;
```
Full block `// src/misc/lv_area.h:51-75`.

### states and parts (values, verbatim)
```c
LV_STATE_DEFAULT     = 0,
LV_STATE_ALT         = 1 << 0,
LV_STATE_CHECKED     = 1 << 2,
LV_STATE_FOCUSED     = 1 << 3,
LV_STATE_FOCUS_KEY   = 1 << 4,
LV_STATE_EDITED      = 1 << 5,
LV_STATE_HOVERED     = 1 << 6,
LV_STATE_PRESSED     = 1 << 7,
LV_STATE_SCROLLED    = 1 << 8,
LV_STATE_DISABLED    = 1 << 9,
LV_STATE_ANY         = 0xFFFF,
```
`// src/core/lv_obj_style.h:32-51`

```c
LV_PART_MAIN         = 0x000000,  /**< A background like rectangle*/
LV_PART_SCROLLBAR    = 0x010000,
LV_PART_INDICATOR    = 0x020000,
LV_PART_KNOB         = 0x030000,
LV_PART_SELECTED     = 0x040000,
LV_PART_ITEMS        = 0x050000,
LV_PART_CURSOR       = 0x060000,
LV_PART_CUSTOM_FIRST = 0x080000,
LV_PART_ANY          = 0x0F0000,
```
`// src/core/lv_obj_style.h:60-72` — **`LV_PART_MAIN` is numeric 0**, so `selector = 0` means `LV_PART_MAIN | LV_STATE_DEFAULT` (stated at `lv_obj_style.h:82-83`).

---

## 2. lv_arc — `src/widgets/arc/lv_arc.h`

```c
lv_obj_t * lv_arc_create(lv_obj_t * parent);                                            // lv_arc.h:68
void lv_arc_set_start_angle(lv_obj_t * obj, lv_value_precise_t start);                  // lv_arc.h:83
void lv_arc_set_end_angle(lv_obj_t * obj, lv_value_precise_t end);                      // lv_arc.h:90
void lv_arc_set_angles(lv_obj_t * obj, lv_value_precise_t start, lv_value_precise_t end); // lv_arc.h:98
void lv_arc_set_bg_start_angle(lv_obj_t * obj, lv_value_precise_t start);               // lv_arc.h:105
void lv_arc_set_bg_end_angle(lv_obj_t * obj, lv_value_precise_t end);                   // lv_arc.h:112
void lv_arc_set_bg_angles(lv_obj_t * obj, lv_value_precise_t start, lv_value_precise_t end); // lv_arc.h:120
void lv_arc_set_rotation(lv_obj_t * obj, int32_t rotation);                             // lv_arc.h:127
void lv_arc_set_mode(lv_obj_t * obj, lv_arc_mode_t type);                               // lv_arc.h:134
void lv_arc_set_value(lv_obj_t * obj, int32_t value);                                   // lv_arc.h:141
void lv_arc_set_range(lv_obj_t * obj, int32_t min, int32_t max);                        // lv_arc.h:149
void lv_arc_set_change_rate(lv_obj_t * obj, uint32_t rate);                             // lv_arc.h:170
void lv_arc_set_knob_offset(lv_obj_t * obj, int32_t offset);                            // lv_arc.h:177
int32_t lv_arc_get_value(const lv_obj_t * obj);                                         // lv_arc.h:216
int32_t lv_arc_get_rotation(const lv_obj_t * obj);                                      // lv_arc.h:244
void lv_arc_align_obj_to_angle(const lv_obj_t * obj, lv_obj_t * obj_to_align, int32_t r_offset);   // lv_arc.h:281
void lv_arc_rotate_obj_to_angle(const lv_obj_t * obj, lv_obj_t * obj_to_rotate, int32_t r_offset); // lv_arc.h:289
```

`lv_value_precise_t` is **`float` when `LV_USE_FLOAT` is on, otherwise `int32_t`**:
```c
#if LV_USE_FLOAT
typedef float lv_value_precise_t;
#else
typedef int32_t lv_value_precise_t;
#endif
```
`// src/misc/lv_types.h:88-92` — in this project `# CONFIG_LV_USE_FLOAT is not set` (sdkconfig:2921), so it is `int32_t`.

### LV_ARC_MODE_*
```c
typedef enum {
    LV_ARC_MODE_NORMAL,      /**< Clock-wise */
    LV_ARC_MODE_SYMMETRICAL, /**< Left/right from the midpoint */
    LV_ARC_MODE_REVERSE      /**< Counterclock-wise */
} lv_arc_mode_t;
```
`// src/widgets/arc/lv_arc.h:34-38`

### style parts
All three parts are genuinely used by the draw code:
- `LV_PART_MAIN` → background arc: `lv_obj_init_draw_arc_dsc(obj, LV_PART_MAIN, &arc_dsc);` — `// src/widgets/arc/lv_arc.c:832`
- `LV_PART_INDICATOR` → value arc + its padding/width: `// src/widgets/arc/lv_arc.c:846, :473, :494`
- `LV_PART_KNOB` → knob rect: `lv_obj_init_draw_rect_dsc(obj, LV_PART_KNOB, &knob_rect_dsc);` — `// src/widgets/arc/lv_arc.c:862`

`lv_obj_remove_style(x, NULL, LV_PART_KNOB)` is valid — the selector parameter is exactly a `lv_style_selector_t`, and `LV_PART_KNOB` alone is a legal selector (`// src/core/lv_obj_style.h:141`, and `LV_PART_KNOB` is listed as a valid example selector at `lv_obj_style_gen.h:2030`).

### (a) Are bg angles phase-relative to rotation? — **No. Rotation is additive on top of the angle.**
```c
arc_dsc.start_angle = arc->bg_angle_start + arc->rotation;
arc_dsc.end_angle = arc->bg_angle_end + arc->rotation;
```
`// src/widgets/arc/lv_arc.c:834-835` (main/background arc)

```c
arc_dsc.start_angle = arc->indic_angle_start + arc->rotation;
arc_dsc.end_angle = arc->indic_angle_end + arc->rotation;
```
`// src/widgets/arc/lv_arc.c:848-849` (indicator arc)

The setter stores the raw value without subtracting rotation:
```c
arc->bg_angle_start = start;
```
`// src/widgets/arc/lv_arc.c:232` (and `arc->bg_angle_end = end;` at `:254`, `arc->indic_angle_start = start;` at `:181`)

So: **angles are absolute in the arc's own frame; `lv_arc_set_rotation()` rotates the whole thing by adding a constant offset at draw time.** Invalidation agrees: `start_angle += arc->rotation;` — `// src/widgets/arc/lv_arc.c:880-881`.

### (b) Where is angle 0? — **3 o'clock. And angles increase CLOCKWISE.**
Header comments state it explicitly and consistently:
```
 * Set the start angle of an arc. 0 deg: right, 90 bottom, etc.
```
`// src/widgets/arc/lv_arc.h:79` (repeated for end at `:86`, `:101`, `:108`)

The trigonometry in the draw code confirms it:
```c
int32_t knob_x = (arc_r * lv_trigo_sin(angle + 90)) >> LV_TRIGO_SHIFT;
int32_t knob_y = (arc_r * lv_trigo_sin(angle)) >> LV_TRIGO_SHIFT;
```
`// src/widgets/arc/lv_arc.c:479-480` (identical pair at `:972-973`)

`lv_trigo_sin` is the integer sine normalized by `LV_TRIGO_SHIFT`:
```c
#define LV_TRIGO_SHIFT 15 /**<  >> LV_TRIGO_SHIFT to normalize*/
int32_t lv_trigo_sin(int16_t angle);
```
`// src/misc/lv_math.h:23, :53`

Because `sin(angle+90°) = cos(angle)`, at `angle = 0`: `x = r·cos(0) = +r`, `y = r·sin(0) = 0` → **the 3 o'clock position**. Increasing angle drives y positive, and screen y grows downward, so **angles progress clockwise** (90° → bottom). `LV_ARC_MODE_NORMAL` being documented "Clock-wise" (`lv_arc.h:35`) is consistent.

### (c) valid range and defaults
- Values are clamped by subtraction, not modulo: `if(end > 360) end -= 360;` — `// src/widgets/arc/lv_arc.c:190` (also `:220`, `:242`)
- `lv_arc_set_rotation` normalizes into `[0,360)`:
```c
while(rotation < 0) rotation += 360;
while(rotation >= 360) rotation -= 360;
```
`// src/widgets/arc/lv_arc.c:271-273`
- Constructor defaults: `// src/widgets/arc/lv_arc.c:523-534`
```c
arc->rotation = 0;
arc->bg_angle_start = 135;
arc->bg_angle_end   = 45;
arc->indic_angle_start = 135;
arc->indic_angle_end   = 270;
arc->type = LV_ARC_MODE_NORMAL;
arc->min_value = 0;
arc->max_value = 100;
arc->chg_rate = 720;
```
So the default background sweep is **135° → 45°** (i.e. from lower-left up and around to lower-right, spanning 270°); default value range **0..100**.

---

## 3. lv_bar — `src/widgets/bar/lv_bar.h`

```c
lv_obj_t * lv_bar_create(lv_obj_t * parent);                                        // lv_bar.h:67
void lv_bar_set_value(lv_obj_t * obj, int32_t value, lv_anim_enable_t anim);        // lv_bar.h:79
void lv_bar_set_start_value(lv_obj_t * obj, int32_t start_value, lv_anim_enable_t anim); // lv_bar.h:87
void lv_bar_set_range(lv_obj_t * obj, int32_t min, int32_t max);                    // lv_bar.h:96
void lv_bar_set_min_value(lv_obj_t * obj, int32_t min);                             // lv_bar.h:103
void lv_bar_set_max_value(lv_obj_t * obj, int32_t max);                             // lv_bar.h:110
void lv_bar_set_mode(lv_obj_t * obj, lv_bar_mode_t mode);                           // lv_bar.h:117
void lv_bar_set_orientation(lv_obj_t * obj, lv_bar_orientation_t orientation);      // lv_bar.h:124
int32_t lv_bar_get_value(const lv_obj_t * obj);                                     // lv_bar.h:135
lv_bar_mode_t lv_bar_get_mode(lv_obj_t * obj);                                      // lv_bar.h:163
bool lv_bar_is_symmetrical(lv_obj_t * obj);                                         // lv_bar.h:177
```

**`lv_bar_set_mode` DOES exist in v9** (it was not removed):
```c
typedef enum {
    LV_BAR_MODE_NORMAL,
    LV_BAR_MODE_SYMMETRICAL,
    LV_BAR_MODE_RANGE
} lv_bar_mode_t;

typedef enum {
    LV_BAR_ORIENTATION_AUTO,
    LV_BAR_ORIENTATION_HORIZONTAL,
    LV_BAR_ORIENTATION_VERTICAL
} lv_bar_orientation_t;
```
`// src/widgets/bar/lv_bar.h:32-36` and `:38-42`

`lv_anim_enable_t`:
```c
typedef bool lv_anim_enable_t;
```
`// src/misc/lv_anim.h:87` — so the third argument of `lv_bar_set_value` is a `bool`-compatible enum; `LV_ANIM_ON` / `LV_ANIM_OFF` are the intended constants.

### parts
- Background (track) → `LV_PART_MAIN`, including its padding: `// src/widgets/bar/lv_bar.c:395-398, :701-704`
- Filled part → `LV_PART_INDICATOR`: `lv_obj_init_draw_rect_dsc(obj, LV_PART_INDICATOR, &draw_rect_dsc);` — `// src/widgets/bar/lv_bar.c:552`

---

## 4. lv_switch — `src/widgets/switch/lv_switch.h`

```c
lv_obj_t * lv_switch_create(lv_obj_t * parent);                                        // lv_switch.h:57
void lv_switch_set_orientation(lv_obj_t * obj, lv_switch_orientation_t orientation);   // lv_switch.h:68
lv_switch_orientation_t lv_switch_get_orientation(lv_obj_t * obj);                     // lv_switch.h:79
```

### parts
- `LV_PART_MAIN` → used for the track background and for base-dir / anim-duration lookups: `// src/widgets/switch/lv_switch.c:245, :265, :321`
- `LV_PART_INDICATOR` → the moving "on" portion: `lv_obj_init_draw_rect_dsc(obj, LV_PART_INDICATOR, &draw_indic_dsc);` — `// src/widgets/switch/lv_switch.c:207`, and ext-draw at `:176`

### checked state + state API
The checked state is `LV_STATE_CHECKED = 1 << 2` — `// src/core/lv_obj_style.h:36`.

```c
void lv_obj_add_state(lv_obj_t * obj, lv_state_t state);      // src/core/lv_obj.h:225
void lv_obj_remove_state(lv_obj_t * obj, lv_state_t state);   // src/core/lv_obj.h:233
void lv_obj_set_state(lv_obj_t * obj, lv_state_t state, bool v); // src/core/lv_obj.h:241
bool lv_obj_has_state(const lv_obj_t * obj, lv_state_t state);   // src/core/lv_obj.h:290
```
`lv_obj_clear_state` is **only a v8 macro**:
```c
#define lv_obj_clear_flag                lv_obj_remove_flag
#define lv_obj_clear_state               lv_obj_remove_state
```
`// src/lv_api_map_v8.h:119-120`

---

## 5. lv_label — `src/widgets/label/lv_label.h`

```c
lv_obj_t * lv_label_create(lv_obj_t * parent);                                        // lv_label.h:78
void lv_label_set_text(lv_obj_t * obj, const char * text);                            // lv_label.h:91
void lv_label_set_text_fmt(lv_obj_t * obj, const char * fmt, ...) LV_FORMAT_ATTRIBUTE(2, 3); // lv_label.h:103
void lv_label_set_text_vfmt(lv_obj_t * obj, const char * fmt, va_list args);          // lv_label.h:120
void lv_label_set_text_static(lv_obj_t * obj, const char * text);                     // lv_label.h:129
void lv_label_set_long_mode(lv_obj_t * obj, lv_label_long_mode_t long_mode);          // lv_label.h:137
lv_label_long_mode_t lv_label_get_long_mode(const lv_obj_t * obj);                    // lv_label.h:190
```

### LV_LABEL_LONG_*
```c
typedef enum {
    LV_LABEL_LONG_MODE_WRAP,             /**< Keep the object width, wrap lines longer than object width and expand the object height*/
    LV_LABEL_LONG_MODE_DOTS,             /**< Keep the size and write dots at the end if the text is too long*/
    LV_LABEL_LONG_MODE_SCROLL,           /**< Keep the size and roll the text back and forth*/
    LV_LABEL_LONG_MODE_SCROLL_CIRCULAR,  /**< Keep the size and roll the text circularly*/
    LV_LABEL_LONG_MODE_CLIP,             /**< Keep the size and clip the text out of it*/
} lv_label_long_mode_t;
```
`// src/widgets/label/lv_label.h:49-55`

The old v8 names `LV_LABEL_LONG_WRAP` / `_DOT` / `_SCROLL` / `_SCROLL_CIRCULAR` / `_CLIP` exist only as compatibility macros:
`// src/lv_api_map_v9_1.h:103-107`

### rounded background + padding on a label
There is no label-specific background API — you use the generic `lv_obj_set_style_*` below. All four exist:
```c
void lv_obj_set_style_bg_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector);   // lv_obj_style_gen.h:2285
void lv_obj_set_style_bg_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector); // lv_obj_style_gen.h:2270
void lv_obj_set_style_radius(lv_obj_t * obj, int32_t value, lv_style_selector_t selector);   // lv_obj_style_gen.h:3138
static inline void lv_obj_set_style_pad_all(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // lv_obj_style.h:276
```
Note the documented default for `bg_opa` is `LV_OPA_TRANSP` — `// src/core/lv_obj_style_gen.h:2276`, so **you must set `bg_opa` explicitly** or the background never appears.

### spacing helpers
```c
void lv_obj_set_style_text_letter_space(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // lv_obj_style_gen.h:2915
static inline void lv_obj_set_style_pad_hor(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // lv_obj_style.h:284
static inline void lv_obj_set_style_pad_ver(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // lv_obj_style.h:290
```

---

## 6. lv_image — `src/widgets/image/lv_image.h`, `src/draw/lv_image_dsc.h`

```c
lv_obj_t * lv_image_create(lv_obj_t * parent);                              // lv_image.h:87
void lv_image_set_src(lv_obj_t * obj, const void * src);                    // lv_image.h:100
void lv_image_set_offset_x(lv_obj_t * obj, int32_t x);                      // lv_image.h:107
void lv_image_set_offset_y(lv_obj_t * obj, int32_t y);                      // lv_image.h:115
void lv_image_set_rotation(lv_obj_t * obj, int32_t angle);                  // lv_image.h:127
void lv_image_set_pivot(lv_obj_t * obj, int32_t x, int32_t y);              // lv_image.h:137
void lv_image_set_pivot_x(lv_obj_t * obj, int32_t x);                       // lv_image.h:144
void lv_image_set_pivot_y(lv_obj_t * obj, int32_t y);                       // lv_image.h:151
void lv_image_set_scale(lv_obj_t * obj, uint32_t zoom);                     // lv_image.h:164
void lv_image_set_scale_x(lv_obj_t * obj, uint32_t zoom);                   // lv_image.h:177
void lv_image_set_scale_y(lv_obj_t * obj, uint32_t zoom);                   // lv_image.h:190
void lv_image_set_antialias(lv_obj_t * obj, bool antialias);                // lv_image.h:205
void lv_image_set_inner_align(lv_obj_t * obj, lv_image_align_t align);     // lv_image.h:214
```

**There is no `lv_image_set_align`** — the function that takes `lv_image_align_t` is named **`lv_image_set_inner_align`** (`lv_image.h:214`). `lv_image_set_align` is **NOT FOUND IN TREE**.

### scale unit: 256 == 1x — CONFIRMED
The header comment for `lv_image_set_scale` states it verbatim:
```
 * @param zoom      the zoom factor.  Example values:
 *                      - 256 or LV_SCALE_NONE:  no zoom
 *                      - <256:  scale down
 *                      - >256:  scale up
 *                      - 128:  half size
 *                      - 512:  double size
```
`// src/widgets/image/lv_image.h:157-163`

And the constant itself:
```c
#define LV_SCALE_NONE            256        /**< Value for not zooming the image */
```
`// src/misc/lv_style.h:48`

### rotation unit
`lv_image_set_rotation` has **no unit comment in `lv_image.h`** (only the note "The image will be rotated around the set pivot set by `lv_image_set_pivot()`" at `:119`). The comparable style property is documented as 0.1°:
```
 * Rotate Widget. The value is interpreted in 0.1 degree units. E.g. 450 means 45 deg.
```
`// src/core/lv_obj_style_gen.h:2050`

### LV_IMAGE_ALIGN_*
```c
typedef enum {
    LV_IMAGE_ALIGN_DEFAULT = 0,
    LV_IMAGE_ALIGN_TOP_LEFT,
    LV_IMAGE_ALIGN_TOP_MID,
    LV_IMAGE_ALIGN_TOP_RIGHT,
    LV_IMAGE_ALIGN_BOTTOM_LEFT,
    LV_IMAGE_ALIGN_BOTTOM_MID,
    LV_IMAGE_ALIGN_BOTTOM_RIGHT,
    LV_IMAGE_ALIGN_LEFT_MID,
    LV_IMAGE_ALIGN_RIGHT_MID,
    LV_IMAGE_ALIGN_CENTER,
    _LV_IMAGE_ALIGN_AUTO_TRANSFORM, /**< Marks the start of modes that transform the image*/
    LV_IMAGE_ALIGN_STRETCH, /**< Set X and Y scale to fill the Widget's area. */
    LV_IMAGE_ALIGN_TILE,    /**< Tile image to fill Widget's area. Offset is applied to shift the tiling. */
    LV_IMAGE_ALIGN_CONTAIN, /**< The image keeps its aspect ratio, but is resized to the maximum size that fits within the Widget's area. */
    LV_IMAGE_ALIGN_COVER,   /**< The image keeps its aspect ratio and fills the Widget's area. */
} lv_image_align_t;
```
`// src/widgets/image/lv_image.h:44-58` (the `typedef enum {` opening is one line above at `:43`).

### lv_image_header_t and lv_image_dsc_t — exact definitions
Little-endian layout (the ESP32-S3 is little-endian, so this is the active one):
```c
typedef struct {
    uint32_t magic: 8;          /**< Magic number. Must be LV_IMAGE_HEADER_MAGIC*/
    uint32_t cf : 8;            /**< Color format: See `lv_color_format_t`*/
    uint32_t flags: 16;         /**< Image flags, see `lv_image_flags_t`*/

    uint32_t w: 16;
    uint32_t h: 16;
    uint32_t stride: 16;        /**< Number of bytes in a row*/
    uint32_t reserved_2: 16;    /**< Reserved to be used later*/
} lv_image_header_t;
```
`// src/draw/lv_image_dsc.h:98-107` (the `LV_BIG_ENDIAN_SYSTEM` variant is at `:87-96`)

```c
typedef struct {
    lv_image_header_t header;   /**< A header describing the basics of the image*/
    uint32_t data_size;         /**< Size of the image in bytes*/
    const uint8_t * data;       /**< Pointer to the data of the image*/
    const void * reserved;      /**< A reserved field to make it has same size as lv_draw_buf_t*/
    const void * reserved_2;    /**< A reserved field to make it has same size as lv_draw_buf_t*/
} lv_image_dsc_t;
```
`// src/draw/lv_image_dsc.h:132-138`

```c
#define LV_IMAGE_HEADER_MAGIC (0x19)
```
`// src/draw/lv_image_dsc.h:25`

`lv_image_flags_t` values (excerpt): `LV_IMAGE_FLAGS_ALLOCATED = 0x0010`, `LV_IMAGE_FLAGS_MODIFIABLE = 0x0020`, `LV_IMAGE_FLAGS_CUSTOM_DRAW = 0x0040`, user bits `0x0100..0x8000` — `// src/draw/lv_image_dsc.h:55-78`.

### LV_COLOR_FORMAT_*
```c
typedef enum {
    LV_COLOR_FORMAT_UNKNOWN           = 0,
    LV_COLOR_FORMAT_RAW               = 0x01,
    LV_COLOR_FORMAT_RAW_ALPHA         = 0x02,

    /*<=1 byte (+alpha) formats*/
    LV_COLOR_FORMAT_L8                = 0x06,
    LV_COLOR_FORMAT_I1                = 0x07,
    LV_COLOR_FORMAT_I2                = 0x08,
    LV_COLOR_FORMAT_I4                = 0x09,
    LV_COLOR_FORMAT_I8                = 0x0A,
    LV_COLOR_FORMAT_A8                = 0x0E,

    /*2 byte (+alpha) formats*/
    LV_COLOR_FORMAT_RGB565            = 0x12,
    LV_COLOR_FORMAT_ARGB8565          = 0x13,   /**< Not supported by sw renderer yet. */
    LV_COLOR_FORMAT_RGB565A8          = 0x14,   /**< Color array followed by Alpha array*/
    LV_COLOR_FORMAT_AL88              = 0x15,   /**< L8 with alpha >*/
    LV_COLOR_FORMAT_RGB565_SWAPPED    = 0x1B,

    /*3 byte (+alpha) formats*/
    LV_COLOR_FORMAT_RGB888            = 0x0F,
    LV_COLOR_FORMAT_ARGB8888          = 0x10,
    LV_COLOR_FORMAT_XRGB8888          = 0x11,
    LV_COLOR_FORMAT_ARGB8888_PREMULTIPLIED          = 0x1A,

    /*Formats not supported by software renderer but kept here so GPU can use it*/
    LV_COLOR_FORMAT_A1                = 0x0B,
    LV_COLOR_FORMAT_A2                = 0x0C,
    LV_COLOR_FORMAT_A4                = 0x0D,
    LV_COLOR_FORMAT_ARGB1555          = 0x16,
    LV_COLOR_FORMAT_ARGB4444          = 0x17,
    LV_COLOR_FORMAT_ARGB2222          = 0X18,
    /* ... YUV and NEMA_TSC formats follow ... */
} lv_color_format_t;
```
Full block `// src/misc/lv_color.h:139-221`.

Requested constants — **all present verbatim**:
- `LV_COLOR_FORMAT_RGB565A8` = `0x14` — `// src/misc/lv_color.h:156`
- `LV_COLOR_FORMAT_ARGB8888` = `0x10` — `// src/misc/lv_color.h:162`
- `LV_COLOR_FORMAT_A8` = `0x0E` — `// src/misc/lv_color.h:151`
- `LV_COLOR_FORMAT_I8` = `0x0A` — `// src/misc/lv_color.h:150`
- `LV_COLOR_FORMAT_RGB565` = `0x12` — `// src/misc/lv_color.h:154`

Native format selection (relevant to `LV_COLOR_DEPTH`): `LV_COLOR_DEPTH == 16` ⇒ `NATIVE = RGB565`, `NATIVE_WITH_ALPHA = RGB565A8` — `// src/misc/lv_color.h:208-210`.

### Hand-building a static `lv_image_dsc_t` for a plain C array

What the tree gives you, as facts:

1. **`magic` must be `LV_IMAGE_HEADER_MAGIC` (0x19).** The bin decoder reads the header by `lv_memcpy(header, &image->header, sizeof(lv_image_header_t))` with no validation of `magic` for the VARIABLE source — `// src/libs/bin_decoder/lv_bin_decoder.c:121-124`; it only repairs `magic` for legacy **files** (`:143-147`). The canonical static initializer sets it: `.magic = LV_IMAGE_HEADER_MAGIC` — `// src/draw/lv_draw_buf.h:54`.

2. **`data` must be non-NULL** or decoding fails outright:
```c
if(dsc->src_type == LV_IMAGE_SRC_VARIABLE && image->data == NULL) {
    return LV_RESULT_INVALID;
}
```
`// src/libs/bin_decoder/lv_bin_decoder.c:1014-1016` (same check at `src/draw/lv_image_decoder.c:371-377`)

3. **`stride` may be 0** and LVGL will compute it — but only on the decoder path for sources where the decoder did not set it:
```c
if(header->stride == 0) {
    LV_LOG_INFO("Image decoder didn't set stride. Calculate it from width.");
    header->stride = img_width_to_stride(header);
}
```
`// src/draw/lv_image_decoder.c:423-426`

with the formula:
```c
static uint32_t img_width_to_stride(lv_image_header_t * header)
{
    if(header->cf == LV_COLOR_FORMAT_RGB565A8) {
        return header->w * 2;
    }
    else {
        return ((uint32_t)header->w * lv_color_format_get_bpp(header->cf) + 7) >> 3;
    }
}
```
`// src/draw/lv_image_decoder.c:464-472` — **note the `RGB565A8` special case**: stride is `w * 2`, i.e. only the colour plane counts; the alpha plane trails it.

The independent library-side stride helper, which does include alignment rounding:
```c
#define LV_DRAW_BUF_STRIDE(w, cf) \
    LV_ROUND_UP(((w) * LV_COLOR_FORMAT_GET_BPP(cf) + 7) / 8, LV_DRAW_BUF_STRIDE_ALIGN)
```
`// src/draw/lv_draw_buf.h:36-37`

4. **Alignment.** There is no "must be 4-byte aligned" sentence to quote — I checked and it is **not stated in the tree**. What does exist:
```c
/** Align start address of draw_buf addresses to this bytes*/
#ifndef LV_DRAW_BUF_ALIGN
    #ifdef CONFIG_LV_DRAW_BUF_ALIGN
        #define LV_DRAW_BUF_ALIGN CONFIG_LV_DRAW_BUF_ALIGN
    #else
        #define LV_DRAW_BUF_ALIGN                       4
    #endif
#endif
```
`// src/lv_conf_internal.h:334-341`

```c
/** Will be added where memory needs to be aligned (with -Os data might not be aligned to boundary by default).
 *  E.g. __attribute__((aligned(4)))*/
#if LV_ATTRIBUTE_MEM_ALIGN ... 
```
`// src/lv_conf_internal.h:1742-1750`

The `LV_DRAW_BUF_DEFINE_STATIC` macro, used for static draw buffers, both applies `LV_ATTRIBUTE_MEM_ALIGN` and **over-allocates by `LV_DRAW_BUF_ALIGN`** so the start address can be nudged:
```c
#define LV_DRAW_BUF_DEFINE_STATIC(name, _w, _h, _cf) \
    static LV_ATTRIBUTE_MEM_ALIGN uint8_t buf_##name[LV_DRAW_BUF_SIZE(_w, _h, _cf)]; \
    static lv_draw_buf_t name = { \
        .header = { .magic = LV_IMAGE_HEADER_MAGIC, .cf = (_cf), \
                    .flags = LV_IMAGE_FLAGS_MODIFIABLE, \
                    .w = (_w), .h = (_h), \
                    .stride = LV_DRAW_BUF_STRIDE(_w, _cf), .reserved_2 = 0, }, \
        .data_size = sizeof(buf_##name), .data = buf_##name, .unaligned_data = buf_##name, }
```
`// src/draw/lv_draw_buf.h:50-65`

```c
#define LV_DRAW_BUF_SIZE(w, h, cf) \
    (LV_DRAW_BUF_STRIDE(w, cf) * (h) + LV_DRAW_BUF_ALIGN + \
     LV_COLOR_INDEXED_PALETTE_SIZE(cf) * sizeof(lv_color32_t))
```
`// src/draw/lv_draw_buf.h:40-42`

And `lv_draw_buf_align()` is a **handler-provided** operation that can legitimately return `NULL` when no handler is set:
```c
void * lv_draw_buf_align_ex(const lv_draw_buf_handlers_t * handlers, void * data, lv_color_format_t color_format)
{
    if(handlers->align_pointer_cb) return handlers->align_pointer_cb(data, color_format);
    else return NULL;
}
```
`// src/draw/lv_draw_buf.c:118-122`

**Honest summary of #6's alignment question:** the tree does *not* document a hard 4-byte requirement for an `lv_image_dsc_t.data` pointer. `LV_DRAW_BUF_ALIGN` defaults to 4 (`lv_conf_internal.h:339`) and the library's own static-buffer macros over-allocate and align to satisfy it, and the ESP32-S3 is a 32-bit Xtensa core, so 4-byte alignment is the safe and conventional choice — but I cannot quote a header line commanding it, because none exists.

---

## 7. lv_canvas — `src/widgets/canvas/lv_canvas.h`, `lv_canvas.c`

```c
lv_obj_t * lv_canvas_create(lv_obj_t * parent);                                                       // lv_canvas.h:41
void lv_canvas_set_buffer(lv_obj_t * obj, void * buf, int32_t w, int32_t h, lv_color_format_t cf);    // lv_canvas.h:62
void lv_canvas_set_draw_buf(lv_obj_t * obj, lv_draw_buf_t * draw_buf);                                // lv_canvas.h:71
void lv_canvas_set_px(lv_obj_t * obj, int32_t x, int32_t y, lv_color_t color, lv_opa_t opa);          // lv_canvas.h:89
void lv_canvas_set_palette(lv_obj_t * obj, uint8_t index, lv_color32_t color);                        // lv_canvas.h:101
lv_draw_buf_t * lv_canvas_get_draw_buf(lv_obj_t * obj);                                               // lv_canvas.h:107
lv_color32_t lv_canvas_get_px(lv_obj_t * obj, int32_t x, int32_t y);                                  // lv_canvas.h:116
lv_image_dsc_t * lv_canvas_get_image(lv_obj_t * canvas);                                              // lv_canvas.h:123
const void * lv_canvas_get_buf(lv_obj_t * canvas);                                                    // lv_canvas.h:132
void lv_canvas_copy_buf(lv_obj_t * obj, const lv_area_t * canvas_area, lv_draw_buf_t * src_buf, ...);  // lv_canvas.h:147
void lv_canvas_fill_bg(lv_obj_t * obj, lv_color_t color, lv_opa_t opa);                               // lv_canvas.h:156
void lv_canvas_init_layer(lv_obj_t * canvas, lv_layer_t * layer);                                     // lv_canvas.h:164
void lv_canvas_finish_layer(lv_obj_t * canvas, lv_layer_t * layer);                                   // lv_canvas.h:172
```

**Note `lv_canvas_set_px` takes FOUR arguments in v9** (`color` *and* `opa`), and `lv_color32_t` for palette/get_px.

### LV_CANVAS_BUF_SIZE_* — only ONE macro exists
```c
#define LV_CANVAS_BUF_SIZE(w, h, bpp, stride) (((((w * bpp + 7) >> 3) + stride - 1) & ~(stride - 1)) * h + LV_DRAW_BUF_ALIGN)
```
`// src/widgets/canvas/lv_canvas.h:178`

```c
uint32_t lv_canvas_buf_size(int32_t w, int32_t h, uint8_t bpp, uint8_t stride);
```
`// src/widgets/canvas/lv_canvas.h:183` — a function wrapper "Just a wrapper to `LV_CANVAS_BUF_SIZE` for bindings" (`:181`).

The v8-style per-format macros (`LV_CANVAS_BUF_SIZE_TRUE_COLOR`, `_TRUE_COLOR_ALPHA`, `_INDEXED_1/2/4/8BIT`, `_ALPHA_1/2/4/8BIT`) are **NOT FOUND IN TREE**. Only the single generic `LV_CANVAS_BUF_SIZE` above exists.

### Caller-owned buffer — YES, and it is NOT freed
```c
void lv_canvas_set_buffer(lv_obj_t * obj, void * buf, int32_t w, int32_t h, lv_color_format_t cf)
{
    LV_ASSERT_OBJ(obj, MY_CLASS);
    LV_ASSERT_NULL(buf);

    lv_canvas_t * canvas = (lv_canvas_t *)obj;
    uint32_t stride = lv_draw_buf_width_to_stride(w, cf);
    lv_draw_buf_init(&canvas->static_buf, w, h, cf, stride, buf, stride * h);
    canvas->draw_buf = &canvas->static_buf;
    ...
}
```
`// src/widgets/canvas/lv_canvas.c:70-87`

The buffer is adopted into the canvas's **own embedded `static_buf`** struct — the caller's pointer is stored, never copied and never freed. Caller ownership is confirmed by the header:
```
 * @param buf    buffer where content of canvas will be.
 *                 It can be allocated with `lv_malloc()` or
 *                 it can be statically allocated array (e.g. static lv_color_t buf[100*50]) or
 *                 it can be an address in RAM or external SRAM
```
`// src/widgets/canvas/lv_canvas.h:53-57`

And the destructor only drops an image-cache entry — **no `lv_free`, no `lv_draw_buf_destroy`:**
```c
static void lv_canvas_destructor(const lv_obj_class_t * class_p, lv_obj_t * obj)
{
    LV_UNUSED(class_p);
    LV_TRACE_OBJ_CREATE("begin");

    lv_canvas_t * canvas = (lv_canvas_t *)obj;
    if(canvas->draw_buf == NULL) return;

    lv_image_cache_drop(&canvas->draw_buf);
}
```
`// src/widgets/canvas/lv_canvas.c:443-452` (registered as `.destructor_cb = lv_canvas_destructor` at `:44`)

**Conclusion: a static/stack/externally-allocated buffer passed to `lv_canvas_set_buffer()` remains the caller's; deleting the canvas does not free it.** For a buffer with real alignment requirements the header points you at `lv_canvas_set_draw_buf()` instead:
```
 * Use lv_canvas_set_draw_buf() instead if you need to set a buffer with alignment requirement.
```
`// src/widgets/canvas/lv_canvas.h:50`

### default canvas colour format
`lv_canvas_set_buffer` does **not** default the format — `cf` is a required argument (`lv_canvas.h:62`). The qrcode widget, which is a canvas subclass, shows the intended use: it builds an I1 (1-bit indexed) canvas. There is no implied default; you must pass one.

---

## 8. Timers — `src/misc/lv_timer.h`

```c
typedef void (*lv_timer_cb_t)(lv_timer_t *);                                            // lv_timer.h:36

lv_timer_t * lv_timer_create_basic(void);                                               // lv_timer.h:80
lv_timer_t * lv_timer_create(lv_timer_cb_t timer_xcb, uint32_t period, void * user_data); // lv_timer.h:91
void lv_timer_delete(lv_timer_t * timer);                                               // lv_timer.h:97
void lv_timer_pause(lv_timer_t * timer);                                                // lv_timer.h:104
void lv_timer_resume(lv_timer_t * timer);                                               // lv_timer.h:110
void lv_timer_set_cb(lv_timer_t * timer, lv_timer_cb_t timer_cb);                       // lv_timer.h:117
void lv_timer_set_period(lv_timer_t * timer, uint32_t period);                          // lv_timer.h:124
void lv_timer_ready(lv_timer_t * timer);                                                // lv_timer.h:130
void lv_timer_set_repeat_count(lv_timer_t * timer, int32_t repeat_count);               // lv_timer.h:137
void lv_timer_set_auto_delete(lv_timer_t * timer, bool auto_delete);                    // lv_timer.h:144
void lv_timer_set_user_data(lv_timer_t * timer, void * user_data);                      // lv_timer.h:151
void lv_timer_reset(lv_timer_t * timer);                                                // lv_timer.h:158
void lv_timer_enable(bool en);                                                          // lv_timer.h:164
uint32_t lv_timer_get_idle(void);                                                       // lv_timer.h:170
uint32_t lv_timer_get_time_until_next(void);                                            // lv_timer.h:176
lv_timer_t * lv_timer_get_next(lv_timer_t * timer);                                     // lv_timer.h:183
void * lv_timer_get_user_data(lv_timer_t * timer);                                      // lv_timer.h:190
bool lv_timer_get_paused(lv_timer_t * timer);                                           // lv_timer.h:197
void lv_timer_set_external_data(lv_timer_t * timer, void * data, void (* free_cb)(void * data)); // lv_timer.h:212
uint32_t lv_timer_handler(void);                                                        // lv_timer.h:51
```

**`lv_timer_del` is only a v8 macro:**
```c
#define lv_timer_del                    lv_timer_delete
```
`// src/lv_api_map_v8.h:158`

### period unit = milliseconds
```
 * @param period call period in ms unit
```
`// src/misc/lv_timer.h:87`

### repeat_count semantics
```
 * @param repeat_count -1 : infinity;  0 : stop ;  n>0: residual times
```
`// src/misc/lv_timer.h:135`

### struct (it lives in the *private* header)
```c
struct _lv_timer_t {
    ...
    uint32_t period;           /**< How often the timer should run */
    uint32_t last_run;         /**< Last time the timer ran */
    lv_timer_cb_t timer_cb;    /**< Timer function */
    void * user_data;          /**< Custom user data */
    int32_t repeat_count;      /**< 1: One time;  -1 : infinity;  n>0: residual times */
    volatile int paused;
    uint32_t auto_delete : 1;
    ...
};
```
`// src/misc/lv_timer_private.h:31-41` — **note: `lv_timer_t`'s fields are not in `lv_timer.h`**; reading them requires `lv_timer_private.h` (i.e. `LV_USE_PRIVATE_API` or a direct include).

### tick source — `src/tick/lv_tick.h`
```c
typedef uint32_t (*lv_tick_get_cb_t)(void);                       // lv_tick.h:30
LV_ATTRIBUTE_TICK_INC void lv_tick_inc(uint32_t tick_period);     // lv_tick.h:43
uint32_t lv_tick_get(void);                                       // lv_tick.h:49
uint32_t lv_tick_elaps(uint32_t prev_tick);                       // lv_tick.h:56
uint32_t lv_tick_diff(uint32_t tick, uint32_t prev_tick);         // lv_tick.h:64
void lv_tick_set_cb(lv_tick_get_cb_t cb);                         // lv_tick.h:84
lv_tick_get_cb_t lv_tick_get_cb(void);                            // lv_tick.h:90
```
```
 * Set the custom callback for 'lv_tick_get'
 * @param cb        call this callback on 'lv_tick_get'
```
`// src/tick/lv_tick.h:81-82`

No `LV_TICK_CUSTOM` gate exists in 9.5 — `lv_tick_set_cb` is unconditionally declared.

---

## 9. Animations — `src/misc/lv_anim.h`

```c
void lv_anim_init(lv_anim_t * a);                                                  // lv_anim.h:177
void lv_anim_set_var(lv_anim_t * a, void * var);                                   // lv_anim.h:184
void lv_anim_set_exec_cb(lv_anim_t * a, lv_anim_exec_xcb_t exec_cb);               // lv_anim.h:193
void lv_anim_set_duration(lv_anim_t * a, uint32_t duration);                       // lv_anim.h:200
void lv_anim_set_delay(lv_anim_t * a, uint32_t delay);                             // lv_anim.h:207
void lv_anim_set_values(lv_anim_t * a, int32_t start, int32_t end);                // lv_anim.h:241
void lv_anim_set_path_cb(lv_anim_t * a, lv_anim_path_cb_t path_cb);                // lv_anim.h:258
void lv_anim_set_start_cb(lv_anim_t * a, lv_anim_start_cb_t start_cb);             // lv_anim.h:265
void lv_anim_set_get_value_cb(lv_anim_t * a, lv_anim_get_value_cb_t get_value_cb); // lv_anim.h:273
void lv_anim_set_completed_cb(lv_anim_t * a, lv_anim_completed_cb_t completed_cb); // lv_anim.h:280
void lv_anim_set_deleted_cb(lv_anim_t * a, lv_anim_deleted_cb_t deleted_cb);       // lv_anim.h:287
void lv_anim_set_reverse_duration(lv_anim_t * a, uint32_t duration);               // lv_anim.h:294
void lv_anim_set_reverse_time(lv_anim_t * a, uint32_t duration);                   // lv_anim.h:299 (legacy)
void lv_anim_set_reverse_delay(lv_anim_t * a, uint32_t delay);                     // lv_anim.h:306
void lv_anim_set_repeat_count(lv_anim_t * a, uint32_t cnt);                        // lv_anim.h:313
void lv_anim_set_repeat_delay(lv_anim_t * a, uint32_t delay);                      // lv_anim.h:320
void lv_anim_set_user_data(lv_anim_t * a, void * user_data);                       // lv_anim.h:335
lv_anim_t * lv_anim_start(const lv_anim_t * a);                                    // lv_anim.h:352
bool lv_anim_delete(void * var, lv_anim_exec_xcb_t exec_cb);                       // lv_anim.h:396
void lv_anim_delete_all(void);                                                     // lv_anim.h:401
lv_anim_t * lv_anim_get(void * var, lv_anim_exec_xcb_t exec_cb);                   // lv_anim.h:409
uint16_t lv_anim_count_running(void);                                              // lv_anim.h:445
```

### `lv_anim_ready_cb_t` / `lv_anim_set_ready_cb` — RENAMED
**Neither exists as a real symbol in 9.5.** They are v8 compatibility aliases:
```c
typedef lv_anim_completed_cb_t      lv_anim_ready_cb_t;
#define lv_anim_set_ready_cb            lv_anim_set_completed_cb
```
`// src/lv_api_map_v8.h:55, :162`

The real names are `lv_anim_completed_cb_t` (`lv_anim.h:105`) and `lv_anim_set_completed_cb` (`lv_anim.h:280`).

### `lv_anim_del` — v8 macro only
```c
#define lv_anim_del                     lv_anim_delete
#define lv_anim_del_all                 lv_anim_delete_all
```
`// src/lv_api_map_v8.h:160-161`

### callbacks
```c
typedef int32_t (*lv_anim_path_cb_t)(const lv_anim_t *);   // lv_anim.h:90
typedef void (*lv_anim_exec_xcb_t)(void *, int32_t);       // lv_anim.h:98
typedef void (*lv_anim_start_cb_t)(lv_anim_t *);           // lv_anim.h:108
typedef int32_t (*lv_anim_get_value_cb_t)(lv_anim_t *);    // lv_anim.h:111
typedef void (*lv_anim_deleted_cb_t)(lv_anim_t *);         // lv_anim.h:114
typedef void (*lv_anim_completed_cb_t)(lv_anim_t *);       // lv_anim.h:105
```

### `lv_anim_t` — full struct
```c
struct _lv_anim_t {
#if LV_USE_EXT_DATA
    lv_ext_data_t ext_data;
#endif
    void * var;                               /**< Variable (Widget or other user-provided object) to animate */
    lv_anim_exec_xcb_t exec_cb;               /**< Function to execute to animate */
    lv_anim_custom_exec_cb_t custom_exec_cb;  /**< Function to execute to animate,
                                               * same purpose as exec_cb but different parameters */
    lv_anim_start_cb_t start_cb;              /**< Call it when animation is starts (considering `delay`) */
    lv_anim_completed_cb_t completed_cb;      /**< Call it when animation is fully completed */
    lv_anim_deleted_cb_t deleted_cb;          /**< Call it when animation is deleted */
    lv_anim_get_value_cb_t get_value_cb;      /**< Get current value in relative mode */
    void * user_data;                         /**< Custom user data */
    lv_anim_path_cb_t path_cb;                /**< Provides path (curve) of animation */
    int32_t start_value;                      /**< Start value */
    int32_t current_value;                    /**< Current value */
    int32_t end_value;                        /**< End value */
    int32_t duration;                         /**< Animation duration in ms */
    int32_t act_time;                         /**< Ms elapsed since animation started. Set to negative to make delay. */
    uint32_t reverse_delay;                   /**< Wait (in ms) after forward play ends and before reverse play begins. */
    uint32_t reverse_duration;                /**< Reverse animation duration in ms */
    uint32_t repeat_delay;                    /**< Wait before repeating */
    uint32_t repeat_cnt;                      /**< Repeat count for animation */
    union _lv_anim_path_para_t {
        lv_anim_bezier3_para_t bezier3;       /**< Parameter used when path is custom_bezier */
    } parameter;

    /* Animation system use these - user shouldn't set */
    uint32_t last_timer_run;
    uint32_t pause_time;
    uint32_t pause_duration;
    uint8_t is_paused : 1;
    uint8_t reverse_play_in_progress : 1;
    uint8_t run_round : 1;
    uint8_t start_cb_called : 1;
    uint8_t early_apply  : 1;
};
```
`// src/misc/lv_anim.h:125-162`

Note the field is **`reverse_duration` / `reverse_delay`, not `playback_duration` / `playback_time`**. The v8 names survive only as macros:
```c
#define lv_anim_set_time                lv_anim_set_duration
#define lv_anim_set_playback_time       lv_anim_set_reverse_duration
#define lv_anim_set_playback_delay      lv_anim_set_reverse_delay
#define lv_anim_set_playback_duration   lv_anim_set_reverse_duration
```
`// src/lv_api_map_v9_1.h:109-112`

### LV_ANIM_PATH_* — **there is no such enum in v9.** They are FUNCTIONS.
**NOT FOUND IN TREE: any `LV_ANIM_PATH_*` identifier.** The built-in paths are declared as ordinary functions:
```c
int32_t lv_anim_path_linear(const lv_anim_t * a);              // lv_anim.h:510
int32_t lv_anim_path_ease_in(const lv_anim_t * a);             // lv_anim.h:517
int32_t lv_anim_path_ease_out(const lv_anim_t * a);            // lv_anim.h:524
int32_t lv_anim_path_ease_in_out(const lv_anim_t * a);         // lv_anim.h:531
int32_t lv_anim_path_overshoot(const lv_anim_t * a);           // lv_anim.h:538
int32_t lv_anim_path_bounce(const lv_anim_t * a);              // lv_anim.h:545
int32_t lv_anim_path_step(const lv_anim_t * a);                // lv_anim.h:553
int32_t lv_anim_path_custom_bezier3(const lv_anim_t * a);      // lv_anim.h:560
```
That is the complete list — ease-in and ease-out are `lv_anim_path_ease_in` / `lv_anim_path_ease_out`.

### infinite constants
```c
#define LV_ANIM_REPEAT_INFINITE      0xFFFFFFFF
#define LV_ANIM_PLAYTIME_INFINITE    0xFFFFFFFF
```
`// src/misc/lv_anim.h:27-28`

---

## 10. lv_qrcode — `src/libs/qrcode/lv_qrcode.h`

```c
lv_obj_t * lv_qrcode_create(lv_obj_t * parent);                                      // lv_qrcode.h:43
void lv_qrcode_set_size(lv_obj_t * obj, int32_t size);                               // lv_qrcode.h:50
void lv_qrcode_set_dark_color(lv_obj_t * obj, lv_color_t color);                     // lv_qrcode.h:57
void lv_qrcode_set_light_color(lv_obj_t * obj, lv_color_t color);                    // lv_qrcode.h:64
lv_result_t lv_qrcode_update(lv_obj_t * obj, const void * data, uint32_t data_len);  // lv_qrcode.h:73
void lv_qrcode_set_data(lv_obj_t * obj, const char * data);                          // lv_qrcode.h:80
void lv_qrcode_set_quiet_zone(lv_obj_t * obj, bool enable);                          // lv_qrcode.h:88
```
The full header guard: `#if LV_USE_QRCODE` at `// src/libs/qrcode/lv_qrcode.h:22`, closed `#endif /*LV_USE_QRCODE*/` at `:94`.

**`lv_qrcode_update` returns `lv_result_t` and takes `(obj, const void *data, uint32_t data_len)` — three args.** Documented: `@return LV_RESULT_OK: if no error; LV_RESULT_INVALID: on error` — `// src/libs/qrcode/lv_qrcode.h:71`.

**There is no `lv_qrcode_delete`** — **NOT FOUND IN TREE**. Delete it with `lv_obj_delete()` since it is a widget.

### it IS a widget (lv_obj subclass), subclassing canvas
```c
const lv_obj_class_t lv_qrcode_class = {
    ...
    .base_class = &lv_canvas_class,
    ...
};
```
`// src/libs/qrcode/lv_qrcode.c:37-41`, and:
```
 * Create an empty QR code (an `lv_canvas`) object.
```
`// src/libs/qrcode/lv_qrcode.h:39`

Private data confirms it embeds a canvas:
```c
struct _lv_qrcode_t {
    lv_canvas_t canvas;
    lv_color_t dark_color;
    lv_color_t light_color;
    int32_t quiet_zone;
};
```
`// src/libs/qrcode/lv_qrcode_private.h:31-36`

### the exact Kconfig symbol
```kconfig
		config LV_USE_QRCODE
			bool "QR code library"
```
`// Kconfig:1541-1542` — **note: no `default`, no `depends on`, no `select`.** (Compare `LV_USE_SNAPSHOT`, which is `default n`: `// Kconfig:1622-1624`.)

Mapping to the LVGL macro:
```c
/** QR code library */
#ifndef LV_USE_QRCODE
    #ifdef CONFIG_LV_USE_QRCODE
        #define LV_USE_QRCODE CONFIG_LV_USE_QRCODE
    #else
        #define LV_USE_QRCODE 0
    #endif
#endif
```
`// src/lv_conf_internal.h:3212-3219`

So on ESP-IDF the sdkconfig name is **`CONFIG_LV_USE_QRCODE`**, and it defaults to **0 (disabled)** because neither branch is taken unless you set it.

Current project state: `# CONFIG_LV_USE_QRCODE is not set` — `sdkconfig:3112`. Not present in `sdkconfig.defaults` (see §13).

---

## 11. lv_event

```c
typedef void (*lv_event_cb_t)(lv_event_t * e);                                      // src/misc/lv_event.h:29

lv_event_dsc_t * lv_obj_add_event_cb(lv_obj_t * obj, lv_event_cb_t event_cb, lv_event_code_t filter, void * user_data); // src/core/lv_obj_event.h:82
uint32_t lv_obj_remove_event_cb(lv_obj_t * obj, lv_event_cb_t event_cb);            // src/core/lv_obj_event.h:98
uint32_t lv_obj_remove_event_cb_with_user_data(lv_obj_t * obj, lv_event_cb_t event_cb, void * user_data); // src/core/lv_obj_event.h:107
lv_result_t lv_obj_send_event(lv_obj_t * obj, lv_event_code_t event_code, void * param); // src/core/lv_obj_event.h:47
uint32_t lv_obj_get_event_count(lv_obj_t * obj);                                    // src/core/lv_obj_event.h:84
lv_event_dsc_t * lv_obj_get_event_dsc(lv_obj_t * obj, uint32_t index);              // src/core/lv_obj_event.h:86
bool lv_obj_remove_event(lv_obj_t * obj, uint32_t index);                           // src/core/lv_obj_event.h:88
bool lv_obj_remove_event_dsc(lv_obj_t * obj, lv_event_dsc_t * dsc);                 // src/core/lv_obj_event.h:90

void * lv_event_get_target(lv_event_t * e);                                         // src/misc/lv_event.h:165
lv_obj_t * lv_event_get_target_obj(lv_event_t * e);                                 // src/core/lv_obj_event.h:70
void * lv_event_get_current_target(lv_event_t * e);                                 // src/misc/lv_event.h:173
lv_obj_t * lv_event_get_current_target_obj(lv_event_t * e);                         // src/core/lv_obj_event.h:63
lv_event_code_t lv_event_get_code(lv_event_t * e);                                  // src/misc/lv_event.h:180
void * lv_event_get_param(lv_event_t * e);                                          // src/misc/lv_event.h:187
void * lv_event_get_user_data(lv_event_t * e);                                      // src/misc/lv_event.h:194
void lv_event_stop_bubbling(lv_event_t * e);                                        // src/misc/lv_event.h:201
void lv_event_stop_trickling(lv_event_t * e);                                       // src/misc/lv_event.h:208
void lv_event_stop_processing(lv_event_t * e);                                      // src/misc/lv_event.h:215
lv_indev_t * lv_event_get_indev(lv_event_t * e);                                    // src/core/lv_obj_event.h:114
uint32_t lv_event_get_key(lv_event_t * e);                                          // src/core/lv_obj_event.h:136
int32_t lv_event_get_rotary_diff(lv_event_t * e);                                   // src/core/lv_obj_event.h:143
lv_draw_task_t * lv_event_get_draw_task(lv_event_t * e);                            // src/core/lv_obj_event.h:195
```

**Critical:** `lv_event_get_target` returns **`void *`**, not `lv_obj_t *` — `// src/misc/lv_event.h:165`. Use **`lv_event_get_target_obj`** (`lv_obj_t *`, `// src/core/lv_obj_event.h:70`) to avoid a cast. Likewise `lv_event_get_current_target` is `void *` (`:173`) and `lv_event_get_current_target_obj` is `lv_obj_t *` (`// src/core/lv_obj_event.h:63`).

**`lv_obj_add_event_cb_with_user_data` and any `LV_EVENT_DRAG` are NOT FOUND IN TREE.** `user_data` is passed directly to `lv_obj_add_event_cb` (`src/core/lv_obj_event.h:82`).

### lv_event_code_t — the input-device events you asked for
```c
LV_EVENT_ALL = 0,
LV_EVENT_PRESSED,             /**< Widget has been pressed */
LV_EVENT_PRESSING,            /**< Widget is being pressed (sent continuously while pressing)*/
LV_EVENT_PRESS_LOST,          /**< Widget is still being pressed but slid cursor/finger off Widget */
LV_EVENT_SHORT_CLICKED,       /**< Widget was pressed for a short period of time, then released. Not sent if scrolled. */
LV_EVENT_SINGLE_CLICKED,      /**< Sent for first short click within a small distance and short time */
LV_EVENT_DOUBLE_CLICKED,      /**< Sent for second short click within small distance and short time */
LV_EVENT_TRIPLE_CLICKED,      /**< Sent for third short click within small distance and short time */
LV_EVENT_LONG_PRESSED,        /**< Object has been pressed for at least `long_press_time`.  Not sent if scrolled. */
LV_EVENT_LONG_PRESSED_REPEAT, /**< Sent after `long_press_time` in every `long_press_repeat_time` ms.  Not sent if scrolled. */
LV_EVENT_CLICKED,             /**< Sent on release if not scrolled (regardless to long press)*/
LV_EVENT_RELEASED,            /**< Sent in every cases when Widget has been released */
LV_EVENT_SCROLL_BEGIN,
LV_EVENT_SCROLL_THROW_BEGIN,
LV_EVENT_SCROLL_END,
LV_EVENT_SCROLL,
LV_EVENT_GESTURE,
LV_EVENT_KEY,
LV_EVENT_ROTARY,
LV_EVENT_FOCUSED,
LV_EVENT_DEFOCUSED,
LV_EVENT_LEAVE,
LV_EVENT_HIT_TEST,
LV_EVENT_INDEV_RESET,
LV_EVENT_HOVER_OVER,
LV_EVENT_HOVER_LEAVE,
```
`// src/misc/lv_event.h:35-62`

All ten you named are present: `LV_EVENT_PRESSED` (:38), `LV_EVENT_PRESSING` (:39), `LV_EVENT_PRESS_LOST` (:40), `LV_EVENT_RELEASED` (:48), `LV_EVENT_LONG_PRESSED` (:45), `LV_EVENT_LONG_PRESSED_REPEAT` (:46), `LV_EVENT_CLICKED` (:47).

**Rename trap:** v8's `LV_EVENT_SHORT_CLICKED` still exists, but the modern "click" is `LV_EVENT_CLICKED` while `LV_EVENT_SHORT_CLICKED` / `SINGLE_CLICKED` / `DOUBLE_CLICKED` / `TRIPLE_CLICKED` are the multi-click family. There is **no `LV_EVENT_DRAG`** and no `LV_EVENT_DRAG_BEGIN/END` in the tree — dragging is expressed through `LV_EVENT_PRESSING` + the indev vector (see `lv_indev_get_vect`, §11 below).

Drawing/special/other codes: `LV_EVENT_COVER_CHECK`, `LV_EVENT_REFR_EXT_DRAW_SIZE`, `LV_EVENT_DRAW_MAIN_BEGIN`, `LV_EVENT_DRAW_MAIN`, `LV_EVENT_DRAW_MAIN_END`, `LV_EVENT_DRAW_POST_BEGIN`, `LV_EVENT_DRAW_POST`, `LV_EVENT_DRAW_POST_END`, `LV_EVENT_DRAW_TASK_ADDED` — `// src/misc/lv_event.h:65-73`.
`LV_EVENT_VALUE_CHANGED` (:76), `LV_EVENT_INSERT` (:77), `LV_EVENT_REFRESH` (:78), `LV_EVENT_READY` (:79), `LV_EVENT_CANCEL` (:80), `LV_EVENT_STATE_CHANGED` (:81), `LV_EVENT_CREATE` (:84), `LV_EVENT_DELETE` (:85), `LV_EVENT_SIZE_CHANGED` (:93), `LV_EVENT_STYLE_CHANGED` (:94), `LV_EVENT_LAYOUT_CHANGED` (:95), `LV_EVENT_GET_SELF_SIZE` (:96).
Flags: `LV_EVENT_PREPROCESS = 0x8000` (:125), `LV_EVENT_MARKED_DELETING = 0x10000` (:127), `LV_EVENT_LAST` (:123).

### indev
```c
lv_indev_t * lv_indev_active(void);                                     // src/indev/lv_indev.h:131
lv_indev_type_t lv_indev_get_type(const lv_indev_t * indev);            // src/indev/lv_indev.h:222
void lv_indev_get_point(const lv_indev_t * indev, lv_point_t * point);  // src/indev/lv_indev.h:320
lv_dir_t lv_indev_get_gesture_dir(const lv_indev_t * indev);            // src/indev/lv_indev.h:327
uint32_t lv_indev_get_key(const lv_indev_t * indev);                    // src/indev/lv_indev.h:334
lv_dir_t lv_indev_get_scroll_dir(const lv_indev_t * indev);             // src/indev/lv_indev.h:352
void lv_indev_get_vect(const lv_indev_t * indev, lv_point_t * point);   // src/indev/lv_indev.h:368
lv_obj_t * lv_indev_get_active_obj(void);                               // src/indev/lv_indev.h:387
```

**`lv_indev_get_act` is a v8 macro only:**
```c
#define lv_indev_get_act                 lv_indev_active
```
`// src/lv_api_map_v8.h:123`

So the v9 idiom is `lv_indev_get_point(lv_indev_active(), &p)`.

### children ordering / z-order
```c
lv_obj_t * lv_obj_get_child(const lv_obj_t * obj, int32_t idx);                        // src/core/lv_obj_tree.h:135
lv_obj_t * lv_obj_get_child_by_type(const lv_obj_t * obj, int32_t idx, const lv_obj_class_t * class_p); // src/core/lv_obj_tree.h:149-150
uint32_t lv_obj_get_child_count(const lv_obj_t * obj);                                 // src/core/lv_obj_tree.h:185
uint32_t lv_obj_get_child_count_by_type(const lv_obj_t * obj, const lv_obj_class_t * class_p); // src/core/lv_obj_tree.h:194
int32_t lv_obj_get_index(const lv_obj_t * obj);                                        // src/core/lv_obj_tree.h:287
int32_t lv_obj_get_index_by_type(const lv_obj_t * obj, const lv_obj_class_t * class_p); // src/core/lv_obj_tree.h:297
void lv_obj_move_to_index(lv_obj_t * obj, int32_t index);                              // src/core/lv_obj_tree.h:101
```
`idx` semantics: `0` = oldest/first-created child, `child count-1` = youngest, and **negative indices count from the youngest** (`-1` = youngest, `-2` = second youngest) — `// src/core/lv_obj_tree.h:127-132`.

`lv_obj_move_to_index` notes:
```
 * @note to move to the background: lv_obj_move_to_index(obj, 0)
 * @note to move forward (up): lv_obj_move_to_index(obj, lv_obj_get_index(obj) - 1)
```
`// src/core/lv_obj_tree.h:98-99`

**`lv_obj_move_foreground` / `lv_obj_move_background` are NOT real functions — they live in the v8 compatibility header as `static inline`:**
```c
static inline void lv_obj_move_foreground(lv_obj_t * obj);   // src/lv_api_map_v8.h:86-95
static inline void lv_obj_move_background(lv_obj_t * obj);   // src/lv_api_map_v8.h:103-106
```
Their entire body is a call to `lv_obj_move_to_index` (`:94` and `:105`).

---

## 12. opacity / transform style properties

```c
void lv_obj_set_style_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector);            // src/core/lv_obj_style_gen.h:3180
void lv_obj_set_style_opa_layered(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector);    // src/core/lv_obj_style_gen.h:3196
void lv_obj_set_style_image_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector);      // src/core/lv_obj_style_gen.h:2673
void lv_obj_set_style_transform_scale_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // src/core/lv_obj_style_gen.h:2033
void lv_obj_set_style_transform_scale_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // src/core/lv_obj_style_gen.h:2047
void lv_obj_set_style_transform_rotation(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // src/core/lv_obj_style_gen.h:2060
void lv_obj_set_style_transform_pivot_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // src/core/lv_obj_style_gen.h:2073
void lv_obj_set_style_transform_pivot_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector); // src/core/lv_obj_style_gen.h:2086
```

**`lv_obj_set_style_transform_scale` (unsuffixed) is NOT in the generated header** — it is a `static inline` convenience in `lv_obj_style.h` that calls both axis setters:
```c
static inline void lv_obj_set_style_transform_scale(lv_obj_t * obj, int32_t value,
                                                    lv_style_selector_t selector)
{
    lv_obj_set_style_transform_scale_x(obj, value, selector);
    lv_obj_set_style_transform_scale_y(obj, value, selector);
}
```
`// src/core/lv_obj_style.h:329-334`

Its v8 name is a macro:
```c
#define lv_obj_set_style_transform_zoom          lv_obj_set_style_transform_scale
#define lv_obj_set_style_transform_angle         lv_obj_set_style_transform_rotation
```
`// src/lv_api_map_v8.h:286-287`

### units — both proven from the headers
**scale: 256 == 1x**
```
 * Zoom Widget horizontally. The value 256 (or `LV_SCALE_NONE`) means normal size, 128
 * half size, 512 double size, and so on.
```
`// src/core/lv_obj_style_gen.h:2022-2023` (repeated for the Y axis at `:2036-2037`)
```c
#define LV_SCALE_NONE            256        /**< Value for not zooming the image */
```
`// src/misc/lv_style.h:48`

**rotation: 0.1 degree units**
```
 * Rotate Widget. The value is interpreted in 0.1 degree units. E.g. 450 means 45 deg.
```
`// src/core/lv_obj_style_gen.h:2050`

(For corroboration, `lv_arc_rotate_obj_to_angle` builds its rotation as `angle * 10 + 900` — that `/10` factor is the same 0.1° convention, plus 900 = 90° of compensation; `// src/widgets/arc/lv_arc.c:508`.)

### which part
These are ordinary style properties, so the part is whatever you pass as `selector`. `selector == 0` is `LV_PART_MAIN | LV_STATE_DEFAULT`:
```
 * - `0`: means `LV_PART_MAIN | LV_STATE_DEFAULT`
```
`// src/core/lv_obj_style_gen.h:2028` (and the header's own definition at `lv_obj_style.h:82-83`)

`LV_PART_MAIN == 0x000000` — `// src/core/lv_obj_style.h:61`. So passing `0` for the selector is exactly what the question calls "part 0", and it is valid and unambiguous.

### required LV_USE_* config
- **`LV_USE_TRANSFORM` does not exist** anywhere in the tree — **NOT FOUND IN TREE**. I searched every file (not just headers) for `LV_USE_TRANSFORM` under `managed_components/lvgl__lvgl` and got zero matches. Widget transforms are always compiled in; the relevant gates are the style setters being unconditional (see §1) and, for the *matrix* rendering path only:
```c
/** Using matrix for transformations.
 * Requirements:
 * - `LV_USE_MATRIX = 1`.
 * - Rendering engine needs to support 3x3 matrix transformations. */
#ifndef LV_DRAW_TRANSFORM_USE_MATRIX
    #ifdef CONFIG_LV_DRAW_TRANSFORM_USE_MATRIX
        #define LV_DRAW_TRANSFORM_USE_MATRIX CONFIG_LV_DRAW_TRANSFORM_USE_MATRIX
    #else
        #define LV_DRAW_TRANSFORM_USE_MATRIX            0
    #endif
#endif
```
`// src/lv_conf_internal.h:343-352`
```c
#if !LV_USE_MATRIX
#error "LV_DRAW_TRANSFORM_USE_MATRIX requires LV_USE_MATRIX = 1"
```
`// src/draw/lv_draw.h:38-39`
```kconfig
		config LV_USE_MATRIX
			bool "Enable matrix support"
			default n
			select LV_USE_FLOAT
```
`// Kconfig:919-922`
```c
#ifndef LV_USE_MATRIX
    #ifdef CONFIG_LV_USE_MATRIX
        #define LV_USE_MATRIX CONFIG_LV_USE_MATRIX
    #else
        #define LV_USE_MATRIX           0
    #endif
#endif
```
`// src/lv_conf_internal.h:1809-1815`

- **`lv_obj_set_style_opa` / `image_opa` / `transform_scale` / `transform_rotation` need no `LV_USE_*` gate at all.** They are declared unconditionally (the only `#if` blocks in `lv_obj_style_gen.h` are `LV_USE_FLEX` and `LV_USE_GRID` — `lv_obj_style_gen.h:1617, :1680, :3366, :3434`).

---

## 13. Config gating, and where `sdkconfig.defaults` stands

### Kconfig symbol per feature (exact names and defaults, quoted)

| Feature | Kconfig symbol | Definition | Default |
|---|---|---|---|
| arc | `LV_USE_ARC` | `Kconfig:1180-1182` | `default y if !LV_CONF_MINIMAL` |
| bar | `LV_USE_BAR` | `Kconfig:1186-1188` | `default y if !LV_CONF_MINIMAL` |
| switch | `LV_USE_SWITCH` | `Kconfig:1324` | `default y if !LV_CONF_MINIMAL` (same block pattern) |
| canvas | `LV_USE_CANVAS` | `Kconfig:1240-1242` | `default y if !LV_CONF_MINIMAL`; `imply LV_USE_IMAGE` |
| image | `LV_USE_IMAGE` | `Kconfig:1254-1256` | `default y if !LV_CONF_MINIMAL`; `imply LV_USE_LABEL` |
| label | `LV_USE_LABEL` | `Kconfig:1264` | `default y if !LV_CONF_MINIMAL` |
| qrcode | `LV_USE_QRCODE` | `Kconfig:1541-1542` | **no default → off** |
| snapshot | `LV_USE_SNAPSHOT` | `Kconfig:1622-1624` | `default n if !LV_CONF_MINIMAL` |
| matrix/transform | `LV_USE_MATRIX` | `Kconfig:919-922` | `default n`; `select LV_USE_FLOAT` |

**`LV_USE_ANIM` and `LV_USE_TRANSFORM` are NOT FOUND IN TREE** — neither has a Kconfig entry, a `lv_conf_internal.h` fallback, nor any occurrence anywhere in the component. Animations and widget transforms are unconditional.

The literal label lines:
```kconfig
		config LV_USE_ARC
			bool "Arc"
			default y if !LV_CONF_MINIMAL
```
`// Kconfig:1180-1182`
```kconfig
		config LV_USE_QRCODE
			bool "QR code library"
```
`// Kconfig:1541-1542`
```kconfig
		config LV_USE_SNAPSHOT
			bool "Enable API to take snapshot"
			default n if !LV_CONF_MINIMAL
```
`// Kconfig:1622-1624`

### Where `D:\黑客松\sdkconfig.defaults` stands

**Decisive fact: `sdkconfig.defaults` contains no `CONFIG_LV_USE_ARC`, `BAR`, `SWITCH`, `QRCODE`, `CANVAS`, `IMAGE`, `LABEL`, `ANIM`, `TRANSFORM`, `SNAPSHOT` or `MATRIX` line at all.** The only `CONFIG_LV_USE_*` lines in that file are:
```
CONFIG_LV_USE_CLIB_MALLOC=y
CONFIG_LV_USE_CLIB_STRING=y
CONFIG_LV_USE_CLIB_SPRINTF=y
```
`sdkconfig.defaults:39-41`
```
CONFIG_LV_USE_FONT_COMPRESSED=y
```
`sdkconfig.defaults:90`
```
CONFIG_LV_USE_SYSMON=y
# CONFIG_LV_USE_PERF_MONITOR is not set
# CONFIG_LV_USE_MEM_MONITOR is not set
```
`sdkconfig.defaults:112-114`

So, per feature, in `sdkconfig.defaults`:

| Feature | In sdkconfig.defaults | Consequence |
|---|---|---|
| arc | **absent** | falls through to Kconfig `default y if !LV_CONF_MINIMAL` → ends up **y** |
| bar | **absent** | → **y** |
| switch | **absent** | → **y** |
| canvas | **absent** | → **y** |
| image | **absent** | → **y** |
| label | **absent** | → **y** |
| anim | **absent** (no such symbol exists) | always on |
| transform | **absent** (no such symbol exists) | always on |
| qrcode | **absent** | no default → **not set / off** |
| snapshot | **absent** | `default n` → **not set / off** |
| matrix | **absent** | `default n` → **not set / off** |

That matches the generated `sdkconfig`, which is where the real values are visible:
```
CONFIG_LV_USE_ARC=y                               # sdkconfig:3016
CONFIG_LV_USE_BAR=y                               # sdkconfig:3018
CONFIG_LV_USE_CANVAS=y                            # sdkconfig:3039
CONFIG_LV_USE_IMAGE=y                             # sdkconfig:3043
CONFIG_LV_USE_LABEL=y                             # sdkconfig:3046
CONFIG_LV_USE_SWITCH=y                            # sdkconfig:3062
# CONFIG_LV_USE_QRCODE is not set                  # sdkconfig:3112
# CONFIG_LV_USE_SNAPSHOT is not set                # sdkconfig:3126
# CONFIG_LV_USE_MATRIX is not set                  # sdkconfig:2922
# CONFIG_LV_USE_FLOAT is not set                   # sdkconfig:2921
```

**Actionable:** to use `lv_qrcode` you must add `CONFIG_LV_USE_QRCODE=y` to `sdkconfig.defaults` (and re-run the config step) — it is off in both files today, and since `lv_qrcode.h` is entirely inside `#if LV_USE_QRCODE` (`lv_qrcode.h:22-94`), the symbols simply will not exist to compile against. Similarly, `lv_snapshot_*` is off (`lv_snapshot.h`), and `LV_USE_MATRIX` being off means `LV_DRAW_TRANSFORM_USE_MATRIX` cannot be enabled (it would `#error`, `lv_draw.h:38-39`) — though ordinary widget rotate/zoom does not need it.

---

## Traps — version-specific things that commonly break

1. **`lv_obj_del` does not exist** — it is `#define lv_obj_del lv_obj_delete` (`src/lv_api_map_v8.h:117`). Same for `lv_obj_del_async` (`:118`), `lv_obj_clear_state` (`:120`), `lv_obj_clear_flag` (`:119`). Real name: `lv_obj_delete` (`src/core/lv_obj_tree.h:46`).

2. **`lv_timer_del` → `lv_timer_delete`** (`src/lv_api_map_v8.h:158` vs `src/misc/lv_timer.h:97`).

3. **`lv_anim_del` → `lv_anim_delete`** (`src/lv_api_map_v8.h:160` vs `src/misc/lv_anim.h:396`).

4. **`lv_anim_ready_cb_t` / `lv_anim_set_ready_cb` are gone** — renamed to `lv_anim_completed_cb_t` / `lv_anim_set_completed_cb` and kept only as aliases at `src/lv_api_map_v8.h:55, :162`. The struct field is `completed_cb` (`src/misc/lv_anim.h:134`).

5. **`lv_anim_set_playback_time` / `_playback_delay` / `_playback_duration` are aliases for `reverse_*`** (`src/lv_api_map_v9_1.h:110-112`). The struct fields are `reverse_duration` / `reverse_delay` (`src/misc/lv_anim.h:144-145`). `lv_anim_set_time` is an alias for `lv_anim_set_duration` (`:109`).

6. **There is no `LV_ANIM_PATH_*` enum.** The paths are functions: `lv_anim_path_linear`, `lv_anim_path_ease_in`, `lv_anim_path_ease_out`, `lv_anim_path_ease_in_out`, `lv_anim_path_overshoot`, `lv_anim_path_bounce`, `lv_anim_path_step`, `lv_anim_path_custom_bezier3` (`src/misc/lv_anim.h:510-560`). Writing `LV_ANIM_PATH_EASE_IN` will not compile.

7. **`lv_indev_get_act` → `lv_indev_active`** (`src/lv_api_map_v8.h:123` vs `src/indev/lv_indev.h:131`). It is a *function*, so writing `lv_indev_get_act()` still compiles via the macro but `lv_indev_get_act` as an address does not.

8. **`lv_event_get_target` returns `void *` in v9** (`src/misc/lv_event.h:165`). Assigning it straight to `lv_obj_t *` is a constraint violation in C. Use `lv_event_get_target_obj` (returns `lv_obj_t *`, `src/core/lv_obj_event.h:70`) or `lv_event_get_current_target_obj` (`:63`).

9. **`lv_event_get_key` takes `lv_event_t *`, not `lv_indev_t *`** (`src/core/lv_obj_event.h:136`), and the header redirects you to `lv_indev_get_key(lv_indev_active())` for `LV_EVENT_KEY` (`src/misc/lv_event.h:54`).

10. **`LV_EVENT_DRAG` does not exist** — no drag event code in the tree. Dragging is `LV_EVENT_PRESSING` plus `lv_indev_get_vect(lv_indev_active(), &p)` (`src/indev/lv_indev.h:368`).

11. **`LV_LABEL_LONG_WRAP` etc. are v9.1 migration macros**, not the enum. Real constants are `LV_LABEL_LONG_MODE_*` (`src/widgets/label/lv_label.h:49-55`; macros at `src/lv_api_map_v9_1.h:103-107`).

12. **`lv_bar_set_value` takes THREE arguments in v9** — `(obj, value, lv_anim_enable_t anim)` (`src/widgets/bar/lv_bar.h:79`), and `lv_anim_enable_t` is literally `typedef bool` (`src/misc/lv_anim.h:87`). The v8 two-argument call is a compile error.

13. **`lv_canvas_set_px` takes FOUR arguments in v9** — `(obj, x, y, lv_color_t color, lv_opa_t opa)` (`src/widgets/canvas/lv_canvas.h:89`). `lv_canvas_get_px` returns `lv_color32_t`, not `lv_color_t` (`:116`).

14. **The v8 `LV_CANVAS_BUF_SIZE_*` family is gone.** Only `LV_CANVAS_BUF_SIZE(w,h,bpp,stride)` exists (`src/widgets/canvas/lv_canvas.h:178`). Note the four-argument signature includes `bpp` and `stride` explicitly.

15. **`lv_canvas_set_buffer` adopts the pointer into an embedded `static_buf` and never frees it** (`src/widgets/canvas/lv_canvas.c:70-87`; destructor `:443-452`). Passing a stack buffer that then goes out of scope leaves a dangling pointer in the canvas — the ownership rule is "caller owns", so the caller must keep it alive at least as long as the canvas.

16. **`lv_image_set_align` does not exist** — the function is `lv_image_set_inner_align(obj, lv_image_align_t)` (`src/widgets/image/lv_image.h:214`). All `lv_img_*` names are v8 macros (`src/lv_api_map_v8.h:172-186`), e.g. `lv_img_set_zoom` → `lv_image_set_scale`, `lv_img_set_angle` → `lv_image_set_rotation`.

17. **`lv_obj_set_style_transform_scale` is not in the generated header** — it is a `static inline` wrapper for `_x`/`_y` (`src/core/lv_obj_style.h:329-334`). `lv_obj_set_style_transform_zoom` / `_angle` are v8 macros (`src/lv_api_map_v8.h:286-287`).

18. **`lv_obj_set_style_pad_all` / `_hor` / `_ver` are likewise `static inline` wrappers** in `src/core/lv_obj_style.h:276, :284, :290`, not `lv_obj_style_gen.h`. Taking their address or forward-declaring them yourself will not link.

19. **Rotation is 0.1°** (`src/core/lv_obj_style_gen.h:2050`) and **scale is 256 == 1x** (`:2022-2023`, `src/misc/lv_style.h:48`). Mixing these up produces rotation of a fraction of a degree or a 256× blow-up.

20. **`selector == 0` is `LV_PART_MAIN | LV_STATE_DEFAULT`**, and `LV_PART_MAIN` is literally `0x000000` (`src/core/lv_obj_style.h:61`, comment at `:82-83`).

21. **Arc background/indicator angles include rotation additively at draw time** — the stored angle is absolute, `arc_dsc.start_angle = arc->bg_angle_start + arc->rotation` (`src/widgets/arc/lv_arc.c:834-835`, `:848-849`). Setting rotation and then expecting `set_bg_angles` to be relative to it is wrong.

22. **Arc angle 0 is 3 o'clock and angles go clockwise** (`src/widgets/arc/lv_arc.h:79`; trig at `src/widgets/arc/lv_arc.c:479-480` with `LV_TRIGO_SHIFT` = 15 at `src/misc/lv_math.h:23`). A "12 o'clock gauge" therefore needs a rotation of `-90` (or `270`), and the default sweep is 135→45 (`src/widgets/arc/lv_arc.c:524-525`).

23. **`lv_arc_set_angles` in v9 takes `lv_value_precise_t`**, which is `int32_t` here because `LV_USE_FLOAT` is off (`src/misc/lv_types.h:88-92`, `sdkconfig:2921`) — but would be `float` if you enable matrix/float support (`Kconfig:919-922` `select LV_USE_FLOAT`). Code that relies on the integer type will break if `LV_USE_MATRIX` is turned on.

24. **`lv_qrcode` has no `lv_qrcode_delete`** — use `lv_obj_delete` (it is an `lv_obj` subclass whose base class is `lv_canvas_class`, `src/libs/qrcode/lv_qrcode.c:41`). And `lv_qrcode_update` takes `(obj, const void *data, uint32_t data_len)` and returns `lv_result_t` (`src/libs/qrcode/lv_qrcode.h:73`).

25. **`lv_obj_move_foreground` / `lv_obj_move_background` are `static inline` in the v8 map**, not library functions (`src/lv_api_map_v8.h:86, :103`). They are one-liners over `lv_obj_move_to_index` (`src/core/lv_obj_tree.h:101`), whose index semantics include **negative indices from the youngest** (`:127-132`).

26. **`lv_obj_get_child` accepts negative `idx`** (`-1` = youngest, `-2` = second youngest) — `src/core/lv_obj_tree.h:127-132`. This is a behaviour change worth knowing if you ported v8 loops.

27. **`lv_timer_t`'s fields are not visible from `lv_timer.h`** — the struct is in `src/misc/lv_timer_private.h:31-41`. `lv_timer_get_user_data` (`src/misc/lv_timer.h:190`) is the supported accessor.

28. **`lv_timer_set_repeat_count` uses `-1` for infinity** (`src/misc/lv_timer.h:135`), while `lv_anim_set_repeat_count` uses `LV_ANIM_REPEAT_INFINITE` = `0xFFFFFFFF` (`src/misc/lv_anim.h:27`). Two different infinities in the same codebase.

29. **`lv_screen_load` is declared with `struct _lv_obj_t *`, not `lv_obj_t *`** (`src/display/lv_display.h:466`) — harmless for calls, but it means a prototype you write yourself must match or you get a conflicting-declaration error.

30. **`lv_qrcode` is disabled in this project.** `sdkconfig.defaults` does not mention it and `sdkconfig:3112` says `# CONFIG_LV_USE_QRCODE is not set`. The header is wholly inside `#if LV_USE_QRCODE` (`src/libs/qrcode/lv_qrcode.h:22`), so it will not even be declared until you add `CONFIG_LV_USE_QRCODE=y`. Same story for snapshot (`sdkconfig:3126`) and matrix (`sdkconfig:2922`).

31. **`LV_OPA_TRANSP == LV_OPA_0 == 0` and `LV_OPA_COVER == LV_OPA_100 == 255`** (`src/misc/lv_color.h:41-53`). The *default* `bg_opa` is `LV_OPA_TRANSP` (`src/core/lv_obj_style_gen.h:2276`), so a rounded label background silently does nothing unless `bg_opa` is set explicitly.

32. **The tree ships no usage examples for building a static `lv_image_dsc_t`** — `examples/` exists but contains no C-array image initialization (no `lv_image_dsc_t x = { ... }` anywhere in `src/` outside LVGL's own internals). The closest in-tree model is the `LV_DRAW_BUF_DEFINE_STATIC` macro at `src/draw/lv_draw_buf.h:50-65`, which sets `.magic = LV_IMAGE_HEADER_MAGIC`, `.cf`, `.flags = LV_IMAGE_FLAGS_MODIFIABLE`, `.w`, `.h`, `.stride = LV_DRAW_BUF_STRIDE(w, cf)` and `.data_size`. `data` must be non-NULL or decoding fails (`src/libs/bin_decoder/lv_bin_decoder.c:1014-1016`). I found **no header sentence mandating 4-byte alignment** of `data`; `LV_DRAW_BUF_ALIGN` merely defaults to 4 (`src/lv_conf_internal.h:339`).
