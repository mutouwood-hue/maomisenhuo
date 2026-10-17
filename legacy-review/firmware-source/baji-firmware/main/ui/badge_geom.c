#include "badge_geom.h"

#include <math.h>
#include <string.h>

#include "badge_spec_data.h"

/* ------------------------------------------------------------------ text ----*/

const char *badge_utf8_next(const char *s, uint32_t *cp)
{
    const unsigned char *p = (const unsigned char *)s;
    if (!p || !*p) {
        if (cp) *cp = 0;
        return s;
    }
    uint32_t c;
    if (p[0] < 0x80) {
        c = p[0];
        s += 1;
    } else if ((p[0] & 0xE0) == 0xC0 && p[1]) {
        c = ((uint32_t)(p[0] & 0x1F) << 6) | (uint32_t)(p[1] & 0x3F);
        s += 2;
    } else if ((p[0] & 0xF0) == 0xE0 && p[1] && p[2]) {
        c = ((uint32_t)(p[0] & 0x0F) << 12) | ((uint32_t)(p[1] & 0x3F) << 6) | (uint32_t)(p[2] & 0x3F);
        s += 3;
    } else if ((p[0] & 0xF8) == 0xF0 && p[1] && p[2] && p[3]) {
        c = ((uint32_t)(p[0] & 0x07) << 18) | ((uint32_t)(p[1] & 0x3F) << 12) |
            ((uint32_t)(p[2] & 0x3F) << 6) | (uint32_t)(p[3] & 0x3F);
        s += 4;
    } else {
        c = p[0];
        s += 1;
    }
    if (cp) *cp = c;
    return s;
}

int badge_utf8_count(const char *s)
{
    int n = 0;
    while (s && *s) {
        s = badge_utf8_next(s, NULL);
        n++;
    }
    return n;
}

/* One em for a full-width glyph, 0.55 em for the rest. The reference's own text
 * metrics come from the browser's font engine; this is the same rule the annotation
 * overlay uses when it lays out a box it cannot measure. */
static bool glyph_is_full_width(uint32_t cp)
{
    return (cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0x303E) ||
           (cp >= 0x3041 && cp <= 0x33FF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
           (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0xA000 && cp <= 0xA4CF) ||
           (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0xF900 && cp <= 0xFAFF) ||
           (cp >= 0xFE30 && cp <= 0xFE4F) || (cp >= 0xFF00 && cp <= 0xFF60) ||
           (cp >= 0xFFE0 && cp <= 0xFFE6) || (cp >= 0x20000 && cp <= 0x3FFFD);
}

int badge_text_advance(const char *utf8, int font_id)
{
    if (!utf8 || !*utf8) return 0;
    if (font_id < 0 || font_id >= BADGE_FONT_COUNT) font_id = BADGE_FONT_F20;
    const int size = badge_fonts[font_id].size;
    int total = 0;
    const char *s = utf8;
    while (*s) {
        uint32_t cp;
        s = badge_utf8_next(s, &cp);
        if (cp == '\n') continue;
        total += glyph_is_full_width(cp) ? size : (size * 55 + 50) / 100;
    }
    return total;
}

int badge_text_width(const char *utf8, int font_id)
{
    if (!utf8) return 0;
    int widest = 0, line = 0;
    const char *s = utf8;
    while (*s) {
        uint32_t cp;
        s = badge_utf8_next(s, &cp);
        if (cp == '\n') {
            if (line > widest) widest = line;
            line = 0;
            continue;
        }
        if (font_id < 0 || font_id >= BADGE_FONT_COUNT) font_id = BADGE_FONT_F20;
        const int size = badge_fonts[font_id].size;
        line += glyph_is_full_width(cp) ? size : (size * 55 + 50) / 100;
    }
    return line > widest ? line : widest;
}

void badge_label_box(const char *utf8, int font_id, int cx, int cy, badge_box_t *out)
{
    if (!out) return;
    if (font_id < 0 || font_id >= BADGE_FONT_COUNT) font_id = BADGE_FONT_F20;
    const int w = badge_text_width(utf8, font_id);
    int nl = 1;
    for (const char *s = utf8; s && *s; s++) {
        if (*s == '\n') nl++;
    }
    const int h = badge_fonts[font_id].line_h * nl;
    out->w = w;
    out->h = h;
    out->x = cx - w / 2;
    out->y = cy - h / 2;
}

/* ------------------------------------------------------------------ boxes ---*/

bool badge_el_is_ring(const badge_el_t *el)
{
    if (!el) return false;
    switch (el->type) {
    case BE_ARC:
    case BE_SEGS:
    case BE_DAYRING:
    case BE_WAVE:
        return true;
    default:
        return false;
    }
}

int badge_dist(int x, int y)
{
    const double dx = (double)x - (double)BADGE_CX;
    const double dy = (double)y - (double)BADGE_CY;
    return (int)(sqrt(dx * dx + dy * dy) + 0.5);
}

int badge_box_farthest(const badge_box_t *box)
{
    if (!box) return 0;
    const int x0 = box->x, y0 = box->y;
    const int x1 = box->x + box->w - 1, y1 = box->y + box->h - 1;
    int worst = 0;
    const int xs[2] = {x0, x1};
    const int ys[2] = {y0, y1};
    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 2; j++) {
            const int d = badge_dist(xs[i], ys[j]);
            if (d > worst) worst = d;
        }
    }
    return worst;
}

int badge_box_nearest(const badge_box_t *box)
{
    if (!box) return 0;
    /* Clamp the centre to the box: the nearest point of a box to a point is the
     * clamped projection, which also covers the "box contains the centre" case. */
    int nx = BADGE_CX, ny = BADGE_CY;
    if (nx < box->x) nx = box->x;
    if (ny < box->y) ny = box->y;
    if (nx > box->x + box->w - 1) nx = box->x + box->w - 1;
    if (ny > box->y + box->h - 1) ny = box->y + box->h - 1;
    return badge_dist(nx, ny);
}

bool badge_el_box(const badge_el_t *el, const char *text, badge_box_t *out)
{
    if (!el || !out) return false;
    switch (el->type) {
    case BE_LABEL: {
        badge_label_box(text ? text : "", el->font, el->x, el->y, out);
        if (el->align == BADGE_ALIGN_LEFT) out->x = el->x;
        else if (el->align == BADGE_ALIGN_RIGHT) out->x = el->x - out->w;
        return true;
    }
    case BE_ICON: {
        const int s = BADGE_ICON_PX * el->scale_x2 / 2;
        out->w = s;
        out->h = s;
        out->x = el->x - s / 2;
        out->y = el->y - s / 2;
        return true;
    }
    case BE_BATTERY:
        out->w = el->w;
        out->h = el->h;
        out->x = el->x - el->w / 2;
        out->y = el->y - el->h / 2;
        return true;
    case BE_ALERT:
        out->w = el->r * 2;
        out->h = el->r * 2;
        out->x = el->x - el->r;
        out->y = el->y - el->r;
        return true;
    case BE_BTN:
        out->w = el->r * 2;
        out->h = el->r * 2;
        out->x = el->x - el->r;
        out->y = el->y - el->r;
        return true;
    case BE_PILL:
    case BE_QR:
        out->w = el->w;
        out->h = el->h;
        out->x = el->x - el->w / 2;
        out->y = el->y - el->h / 2;
        return true;
    case BE_BAR:
        out->x = el->x;
        out->y = el->y;
        out->w = el->w;
        out->h = el->h;
        return true;
    case BE_TOGGLE:
        out->w = el->w;
        out->h = el->h;
        out->x = el->x - el->w; /* x is the right edge */
        out->y = el->y - el->h / 2;
        return true;
    case BE_DOTS: {
        const int n = el->n > 0 ? el->n : 3;
        out->w = n * el->r * 2 + (n - 1) * el->gap;
        out->h = el->r * 2;
        out->x = el->x - out->w / 2;
        out->y = el->y - el->r;
        return true;
    }
    case BE_ZZZ:
        out->w = 56;
        out->h = 40;
        out->x = el->x - out->w / 2;
        out->y = el->y - out->h / 2;
        return true;
    case BE_HIT:
        if (el->w > 0 && el->h > 0) {
            out->x = el->x - el->w / 2;
            out->y = el->y - el->h / 2;
            out->w = el->w;
            out->h = el->h;
        } else {
            const int r = el->r > 0 ? el->r : 0;
            out->x = el->x - r;
            out->y = el->y - r;
            out->w = r * 2;
            out->h = r * 2;
        }
        return true;
    default:
        return false;
    }
}

int badge_ring_outer_radius(const badge_el_t *el)
{
    if (!el) return 0;
    switch (el->type) {
    case BE_ARC:
    case BE_SEGS:
        return el->r + el->w / 2;
    case BE_DAYRING: {
        const int outer = el->r + el->w / 2;
        const int outer2 = el->r2 + el->w2 / 2;
        return outer > outer2 ? outer : outer2;
    }
    case BE_WAVE:
        return el->r;
    default:
        return 0;
    }
}

int badge_safe_half_width_at(int y_bottom)
{
    const int dy = y_bottom > BADGE_CY ? y_bottom - BADGE_CY : BADGE_CY - y_bottom;
    if (dy >= BADGE_SAFE_R) return 0;
    return (int)sqrt((double)(BADGE_SAFE_R * BADGE_SAFE_R - dy * dy));
}

bool badge_el_placement_ok(const badge_el_t *el, const char *text, const char **reason)
{
    static const char *RING_OUT = "ring element extends past the glass (r > 233)";
    static const char *CONTENT_OUT = "content box has a corner outside the safe radius 212";
    static const char *RING_BAND = "ring element's outer edge is inside the safe radius 212";
    static const char *HIT_OUT = "tap area reaches past the glass";
    if (reason) *reason = NULL;
    if (!el) return false;

    /*
     * A tap area is not content: the specification's biggest ones are the whole disc
     * (`hit_cat` on the main dial is r=233, the way the reference makes the cat itself
     * tappable). Holding a full-disc target to the 212 content rule would be wrong, so
     * the rule for it is only that it must not reach past the physical disc.
     */
    if (el->type == BE_HIT) {
        if (el->r > 0 && (el->w == 0 || el->h == 0)) {
            if (badge_dist(el->x, el->y) + el->r > BADGE_R) {
                if (reason) *reason = HIT_OUT;
                return false;
            }
            return true;
        }
        badge_box_t hit;
        if (badge_el_box(el, text, &hit)) {
            const int x0 = hit.x < 0 ? 0 : hit.x;
            const int y0 = hit.y < 0 ? 0 : hit.y;
            const int x1 = hit.x + hit.w - 1 > BADGE_TOUCH_MAX ? BADGE_TOUCH_MAX : hit.x + hit.w - 1;
            const int y1 = hit.y + hit.h - 1 > BADGE_TOUCH_MAX ? BADGE_TOUCH_MAX : hit.y + hit.h - 1;
            const int corners[4][2] = {{x0, y0}, {x1, y0}, {x0, y1}, {x1, y1}};
            for (int i = 0; i < 4; i++) {
                if (badge_dist(corners[i][0], corners[i][1]) > BADGE_R) {
                    if (reason) *reason = HIT_OUT;
                    return false;
                }
            }
        }
        return true;
    }

    if (badge_el_is_ring(el)) {
        const int outer = badge_ring_outer_radius(el);
        if (outer > BADGE_R) {
            if (reason) *reason = RING_OUT;
            return false;
        }
        /* The voice waveform is drawn at r=206, i.e. INSIDE the band: it is the
         * reference's decoration around the microphone button, not a ring that carries
         * information, so it is not held to the band rule. */
        if (el->type == BE_WAVE) return true;
        /* Everything else that lives in the band must actually be in it. The stat arcs
         * intrude by 2 px (midline 214, width 8) -- the specification's own number, and
         * the reason this bound is 4 rather than 0. */
        if (outer < BADGE_SAFE_R - 4) {
            if (reason) *reason = RING_BAND;
            return false;
        }
        return true;
    }

    badge_box_t box;
    if (!badge_el_box(el, text, &box)) return true; /* decorations (feather, hearts) */

    /* Every content element must clear the safe circle on all four corners. The
     * bubble and the toast are clamped by badge_safe_half_width_at() at draw time
     * rather than by this rule, because the specification's own toast width does not
     * fit and the composite has to shrink it. */
    if (badge_box_farthest(&box) > BADGE_SAFE_R) {
        if (reason) *reason = CONTENT_OUT;
        return false;
    }
    return true;
}

bool badge_el_contains(const badge_el_t *el, const char *text, int px, int py)
{
    if (!el) return false;

    /* The two round targets: the alert bubble and the care buttons. */
    if (el->type == BE_ALERT || el->type == BE_BTN) {
        const int dx = px - el->x, dy = py - el->y;
        return dx * dx + dy * dy <= el->r * el->r;
    }

    /* The pills' tap area is their rectangle, not their rounded ends: a 44 px pill
     * with 22 px corners should answer everywhere inside it. */
    if (el->type == BE_PILL || el->type == BE_QR || el->type == BE_BATTERY ||
        el->type == BE_BAR || el->type == BE_TOGGLE || el->type == BE_DOTS ||
        el->type == BE_HIT) {
        badge_box_t box;
        if (!badge_el_box(el, text, &box)) return false;
        if (el->type == BE_HIT && el->r > 0 && box.w == 0) {
            const int dx = px - el->x, dy = py - el->y;
            return dx * dx + dy * dy <= el->r * el->r;
        }
        return px >= box.x && py >= box.y && px < box.x + box.w && py < box.y + box.h;
    }

    /* Labels and icons: a slightly enlarged glyph box, so a 16x16 icon is still
     * grabbable at its edge. */
    badge_box_t box;
    if (!badge_el_box(el, text, &box)) return false;
    const int pad = (el->type == BE_LABEL) ? 2 : 3;
    return px >= box.x - pad && py >= box.y - pad && px < box.x + box.w + pad &&
           py < box.y + box.h + pad;
}
