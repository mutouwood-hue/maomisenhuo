idf_component_register(SRCS "main.c" INCLUDE_DIRS "." REQUIRES nvs_flash esp_timer hal esp_hw_support)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Werror)
