#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,re,math
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'artifacts/firmware-local-v3-perf034';src=OUT/'source';base=ROOT/'artifacts/firmware-local-v3-perf/source';safe=ROOT/'artifacts/firmware-local-v3-dmafix/source'
path='components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();s=(src/path).read_text();section=s[s.index('static lv_display_t *bsp_display_lcd_init'):s.index('static lv_indev_t *bsp_display_indev_init')]
checks=[]
def check(name,truth):assert truth,name;checks.append(dict(name=name,passed=True))
check('BSP_exact_deployed_032_safe10_source',sha(src/path)==sha(safe/path))
check('one_literal_10_row_profile',re.findall(r'\.buffer_height\s*=\s*([^,]+),',section)==['10'])
check('internal_draw_buffers',bool(re.search(r'\.use_psram\s*=\s*false',section)))
check('requires_double_buffer',bool(re.search(r'\.require_double_buffer\s*=\s*true',section)))
check('no20row_probe_or_registration_retry','probe' not in section and 'rows==' not in section and 'double20' not in section)
panel_header=(ROOT/'firmware/managed_components/espressif__esp_lcd_co5300/include/esp_lcd_co5300.h').read_text();check('no_clock_increase',sha(src/path)==sha(safe/path) and 'CO5300_PANEL_IO_QSPI_CONFIG' in s and '.pclk_hz = 40 * 1000 * 1000' in panel_header)
check('capture_64KiB_DMA_guard_unchanged',sha(src/'main/badge_diagnostics.c')==sha(base/'main/badge_diagnostics.c'))
main={str(p.relative_to(base)):sha(p) for p in (base/'main').rglob('*') if p.is_file()};check('all033_main_source_exact',all(sha(src/p)==h for p,h in main.items()))
check('sdkconfig_exact033',sha(src/'sdkconfig')==sha(base/'sdkconfig'))
check('sdkconfig_defaults_exact033',sha(src/'sdkconfig.defaults')==sha(base/'sdkconfig.defaults'))
check('partition_table_source_exact033',sha(src/'partitions.csv')==sha(base/'partitions.csv'))
report=dict(offline=True,deviceTouched=False,checks=checks,checkCount=len(checks),candidateBspSha256=sha(src/path),safe032BspSha256=sha(safe/path),mainFileCount=len(main),expectedPixelBytesPerBuffer=466*10*2,expectedTotalPixelBytes=2*466*10*2,previous20RowTotalPixelBytes=2*466*20*2,nominalReturnedInternalPixelBufferBytes=2*466*10*2,expectedFullScreenMinimumChunks=math.ceil(466/10),actualHeapRecoveryNotMeasured=True,captureMayStillRefuseIfRuntimeBudgetInsufficient=True)
(Path(__file__).resolve().parent/'fixed10-buffer-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(len(checks),'fixed10/immutability checks passed')
