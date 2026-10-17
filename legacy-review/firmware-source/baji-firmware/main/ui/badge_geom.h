/*
 * badge_geom - where an element's pixels are, computed from the spec alone.
 *
 * The specification's first rule is a geometric one: the panel is a disc of radius
 * 233, all *content* (labels, buttons, pills, bars, icons, the battery, the alert
 * bubble, the page dots) must sit with all four box corners inside the safe radius
 * 212, and the band 212..233 carries ring elements only (the 24-hour ring, the stat
 * arcs, the segmented care rings, the voice wave).
 *
 * That rule is worth more than a comment because the previous UI failed it: 19 of 20
 * widget boxes were partly or wholly under the bezel and the wardrobe tile had 1.8%
 * of its area visible -- a button that could not be seen or tapped, with every test
 * green (docs/gap-vs-v1.5.md). So the rule is enforced here, in a module with no
 * LVGL, no ESP-IDF and no allocation, against the generated tables. The same module
 * answers hit-testing and the repaint boxes at runtime, which is what keeps one
 * implementation of "where is this element" instead of three.
 *
 * Label boxes need text metrics, and there are no font files here: the advances are
 * approximated from the spec's own font table (one em per CJK glyph, 0.55 em per
 * Latin glyph, full line height per line). That is deliberately generous -- the
 * check should fail on an element that hangs off the glass, not on the kerning of a
 * label that comfortably fits.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "badge_spec.h"

#ifdef __cplusplus
extern "C" {
#endif

/** @brief Bounding box in screen pixels; (x, y) is the top-left corner. */
typedef struct {
    int x, y, w, h;
} badge_box_t;

/**
 * @brief Approximate advance width of one line of text, in pixels.
 *
 * Chinese and Japanese glyphs are full-width in the spec's font (Noto Sans SC), so
 * they count as one em; Latin, digits and punctuation as 0.55 em. Good to about
 * +/-10% of the real metrics, which is what the safe-circle check needs.
 */
int badge_text_advance(const char *utf8, int font_id);

/** @brief Approximate width of the widest line of a (possibly multi-line) label. */
int badge_text_width(const char *utf8, int font_id);

/** @brief Approximate box of a label whose centre is (cx, cy). */
void badge_label_box(const char *utf8, int font_id, int cx, int cy, badge_box_t *out);

/**
 * @brief Bounding box of an element, in screen pixels.
 *
 * @param text  the element's template already expanded (needed for labels), or NULL
 * @return false for elements with no box of their own (the ring types, the feather
 *         and the falling hearts), whose extent the caller decides
 */
bool badge_el_box(const badge_el_t *el, const char *text, badge_box_t *out);

/** @brief True when a ring-type element owns no rectangle of its own. */
bool badge_el_is_ring(const badge_el_t *el);

/** @brief Farthest-corner distance from the disc centre, in pixels. */
int badge_box_farthest(const badge_box_t *box);

/** @brief Nearest-corner distance from the disc centre, in pixels. */
int badge_box_nearest(const badge_box_t *box);

/** @brief Distance from the centre to one corner of a box. */
int badge_dist(int x, int y);

/**
 * @brief Whether the element satisfies the specification's placement rules.
 *
 * @param text   the expanded label (may be NULL for non-labels)
 * @param reason receives a short static explanation when it does not
 */
bool badge_el_placement_ok(const badge_el_t *el, const char *text, const char **reason);

/** @brief The drawn extent of a ring element: outer radius (midline r + w / 2). */
int badge_ring_outer_radius(const badge_el_t *el);

/** @brief Point-in-element test, in the specification's coordinate convention. */
bool badge_el_contains(const badge_el_t *el, const char *text, int px, int py);

/** @brief Walk a string's UTF-8 code points; returns the next pointer. */
const char *badge_utf8_next(const char *s, uint32_t *cp);

/** @brief Number of UTF-8 code points in a NUL-terminated string. */
int badge_utf8_count(const char *s);

/**
 * @brief Largest half-width a box may have while all four corners stay inside the
 *        safe circle, given that its bottom edge is at `y_bottom`.
 *
 * A box whose bottom edge is low on the glass may not also be wide: the safe circle
 * narrows as the bottom edge approaches the rim. The composites use this to keep their
 * own boxes off the bezel rather than relying on the disc mask to cut the corners off.
 *
 * `y_bottom` is a BOTTOM edge, which is the trap in reading the specification's own
 * numbers: BADGE_TOAST_Y 380 is a CENTRE line (badge_spec_data.h, and the reference's
 * drawToast() draws at `K.y - K.h/2`), so the toast's bottom edge is 400, not 380.
 * Read that way its 220 px width leaves its worst corner 200 px from the centre, inside
 * BADGE_SAFE_R 212 -- so the toast is inside the rule, and the clamp in badge_ui.c is a
 * defence against future geometry rather than a fix for a specification defect. See
 * badge_ui.c's file header, which records the same reading.
 */
int badge_safe_half_width_at(int y_bottom);

#ifdef __cplusplus
}
#endif
