# cat3d -- software 3D rasteriser for the pixel-cat model.
#
# The six breed textures are linked straight into the application image with
# EMBED_FILES. They therefore live in flash and are read through the cache,
# costing zero bytes of internal SRAM and requiring no filesystem partition.

idf_component_register(
    SRCS
        "src/cat3d.c"
        "src/cat_assets_esp32.c"
    INCLUDE_DIRS
        "include"
        "data"
    EMBED_FILES
        "data/tex_orange.bin"
        "data/tex_silver.bin"
        "data/tex_tuxedo.bin"
        "data/tex_siamese.bin"
        "data/tex_ragdoll.bin"
        "data/tex_blue.bin"
)

# The component is pure computation plus read-only flash data, so it needs
# neither RTOS primitives nor dynamic allocation of its own (the caller supplies
# an allocator). Keeping the dependency list tight keeps it testable on the host.
