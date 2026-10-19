#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "lvgl.h"

/* Presentation only. The phone supplies an already computed stage. These IDs
 * are NOT new local2 wire enums and must not be cast from encounter.stage. */
typedef enum { BADGE_GROWTH_ADULT, BADGE_GROWTH_KITTEN, BADGE_GROWTH_YOUNG } badge_growth_t;
typedef enum { BADGE_BREED_ORANGE, BADGE_BREED_SILVER, BADGE_BREED_TUXEDO,
 BADGE_BREED_SIAMESE, BADGE_BREED_RAGDOLL, BADGE_BREED_BLUE,
 BADGE_BREED_CALICO, BADGE_BREED_GOLDEN, BADGE_BREED_STARRY } badge_breed_t;
typedef enum { BADGE_OUTFIT_NONE, BADGE_OUTFIT_BANDANA, BADGE_OUTFIT_BOW,
 BADGE_OUTFIT_CAP, BADGE_OUTFIT_RAINCOAT, BADGE_OUTFIT_BACKPACK,
 BADGE_OUTFIT_SCARF, BADGE_OUTFIT_SAKURA, BADGE_OUTFIT_BELL,
 BADGE_OUTFIT_CROWN, BADGE_OUTFIT_CAPE, BADGE_OUTFIT_WINGS } badge_outfit_t;
typedef enum { BADGE_BODY_STANDARD, BADGE_BODY_SLIM, BADGE_BODY_ROUND } badge_body_t;
typedef struct {
 bool known;
 badge_growth_t growth;
 badge_breed_t breed;
 badge_outfit_t outfit;
 badge_body_t requested_body; /* Explicit request only; no body-shape algorithm. */
} badge_appearance_t;

#define BADGE_APPEARANCE_BUFFER_BYTES (1024u+192u*208u)
bool badge_appearance_from_names(badge_appearance_t *,const char *growth,
 const char *breed,const char *outfit,const char *body);
bool badge_appearance_valid(const badge_appearance_t *);
bool badge_appearance_equal(const badge_appearance_t *,const badge_appearance_t *);
bool badge_appearance_outfit_supported(badge_outfit_t);
/* Authored native RLE layers and lossless legacy frames decode to one I8 image.
 * No runtime GLB, new timer or LVGL object. Shared foot anchor (96,196), or
 * (72,147) when compact. */
bool badge_appearance_render(const lv_image_dsc_t *,const badge_appearance_t *,bool compact,unsigned clip,unsigned frame,
 lv_image_dsc_t *,uint8_t *buffer,size_t capacity);
/* The existing native sleep pose can share the same breed/stage palette. */
uint32_t badge_appearance_color(const badge_appearance_t *,unsigned role);
unsigned badge_appearance_size(const badge_appearance_t *);
