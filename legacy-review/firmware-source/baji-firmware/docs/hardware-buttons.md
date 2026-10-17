# 两个物理按键：通路、读法与 PMIC 寄存器的读错

> 2026-10-12，真机（ESP32-S3-Touch-AMOLED-1.75C，`7c:0c:5f:42:36:84`，COM3）。
> 本文是按键与 AXP2101 状态位这**一件事**的唯一出处；`m1-hardware-verification.md` §5 只留指针。

板子右侧有两个按键（表冠侧一个、下方椭圆一个）。`BSP_CAPS_BUTTONS` 是 0，BSP 不提供任何按键 API，所以"这两个键能不能用、怎么读"必须自己搞清。**结论：都能用**，但走的是两条完全不同的通路。

---

## 1. 结论

| 物理位置 | 接到 | 读什么 | 能不能当应用输入 |
|---|---|---|---|
| **上键**（表冠侧） | AXP2101 的 **PWRON**，**不占 GPIO** | 读 PMIC 的 IRQ 状态寄存器 `0x49` | ✅ 能（短按）；⚠️ 长按会硬件断电，软件拦不住 |
| **下键**（椭圆） | ESP32-S3 **GPIO0**（BOOT） | `gpio_config` + 边沿中断/轮询 | ✅ 能 |

**先按上键 3 下、停 4.6 s、再按下键 3 下**，两个通道的归属是**排他**的：按上键期间 GPIO0 全程为 1；按下键期间 `INTSTS2` 全程为 0。所以"哪个键走哪条通路"是仪器测出来的，不是拿原理图猜的。

> **"上键/下键"这个方位词是用户侧转述**（我要求先按上、再按下），**没有做仪器的机械方位测量**。仪器只证明"两个键分属两个通道"。即使方位说反了，两个键**各自的通路归属**依然成立。

---

## 2. 多方交叉：为什么敢下这个结论

四条独立来源一致，缺一条都不会写成"结论"：

| 来源 | 说了什么 |
|---|---|
| **厂商数据手册** `AXP2101_Datasheet_V1.0_en.pdf` §6.13.2.44 | REG 49 是 IRQ Status 1，bit3 = `POWERON Short PRESS IRQ`，bit2 = Long PRESS，全部 `RW1C` |
| **厂商示例** `examples/arduino/.../05_LVGL_AXP2101_ADC_Data.ino:146` | `power.enableIRQ(XPOWERS_AXP2101_PKEY_SHORT_IRQ)`，并在 `isPekeyShortPressIrq()` 里当普通按键用 |
| **官方 IDF 示例** `examples/esp-idf/04_Immersive_block/main/main.c:457` | `const int CALIB_BUTTON_GPIO = GPIO_NUM_0;`，`.mode = GPIO_MODE_INPUT, .pull_up_en = ENABLE, .intr_type = GPIO_INTR_NEGEDGE`，界面写 "Press BOOT to recalibrate" |
| **本次双通道探针实测** | 见 §4 的原始日志 |

**原理图的 PDF 文本层不能用来判连线归属。** 我试过按文本坐标提取网标再 BFS 连线，得到的归属把两个键的网络混在一起；剔除元件符号框后仍然只能给出"这个键附近有 `GPIO0`/`CHIP_PU`/`PWRON` 三个标签"，无法定论。所以这份文档的事实全部来自**实测 + 手册**，原理图只用来确认"板上确实有两个键"。

---

## 3. 两个键的属性

### 3.1 下键 = GPIO0（BOOT）

| 属性 | 值 | 依据 |
|---|---|---|
| 引脚 | `GPIO0` | 官方示例直接把它当按键 |
| 空闲电平 | **1** | 实测 `[boot] GPIO0 idle level = 1` |
| 按下电平 | **0**（低有效） | 实测 `GPIO0 PRESSED -> LEVEL 0` |
| 上拉 | 需上拉（探针开内部上拉） | 官方示例 `.pull_up_en = GPIO_PULLUP_ENABLE` |
| 抖动 | **有**，见下 | 实测边沿数 > 电平变化数 |
| 中断 | 可用（`ANYEDGE` 实测通过） | `[isr confirmed]` |

**触点抖动是实测到的**，不是照本宣科：3 次按压只产生 6 次电平变化，但 ISR 计数是 `x1, x3, x1, x3, x1, x4`——每次按压期间多出 1–3 个边沿。所以**不要自己数边沿**，用现成的消抖组件：

- `espressif/button`（`iot_button.h`，带单击/双击/长按/消抖）**已经在仓库里**——`managed_components/espressif__button/`，由 BSP 经 `esp_lvgl_adapter` 传递依赖进来，`dependencies.lock` 锁定。
- 需要用 `esp_lv_adapter_register_button()` 接成 LVGL 输入设备时，得先开 `CONFIG_ESP_LVGL_ADAPTER_ENABLE_BUTTON`（`sdkconfig.defaults` 里目前**没有**这一项）。

**strapping 警告**：GPIO0 是 ESP32-S3 的启动模式引脚——复位瞬间被拉低会进下载模式。所以 (a) 按键初始化必须在启动之后，(b) 刷写/复位时不要按住下键。本次所有复位日志都是 `boot:0x2b (SPI_FAST_FLASH_BOOT)`，与此一致。

### 3.2 上键 = AXP2101 PWRON

不占 MCU 引脚，全靠 I2C 读寄存器。I2C 地址 `0x34`，探针回读 `IC_TYPE(0x03)=0x4A`（与手册一致），总线是 BSP 的 `GPIO14/15`。

**寄存器地图**（地址与位定义均出自手册 §6.13.2）：

| 寄存器 | 位 | 含义 | 读/写 |
|---|---|---|---|
| `0x00` STATUS1 | 5 | **VBUS good**（电平） | R |
| `0x00` STATUS1 | 3 | **电池在位**（电平） | R |
| `0x01` STATUS2 | 2:0 | 充电状态：000 tri / 001 pre / 010 CC / 011 CV / 100 done / 101 未充 | R |
| `0x01` STATUS2 | 6:5 | 电池电流方向：00 待机 / 01 充电 / 10 放电 | R |
| `0x41` INTEN2 | 3 / 2 | 短按 / 长按 **中断使能**（复位默认 **1**） | RW |
| `0x41` INTEN2 | 1 / 0 | 负沿 / 正沿 **中断使能**（复位默认 **0**） | RW |
| `0x49` INTSTS2 | 3 | PWRON **短按** | **RW1C** |
| `0x49` INTSTS2 | 2 | PWRON **长按** | **RW1C** |
| `0x49` INTSTS2 | 1 / 0 | PWRON **负沿（按下）/ 正沿（松手）** | **RW1C** |
| `0x49` INTSTS2 | 7 / 6 / 5 / 4 | VBUS 插入 / 移除、电池插入 / 移除 | **RW1C** |
| `0x22` PWROFF_EN | 1 | `PWRON > OFFLEVEL` 作为关机源（复位默认来自 EFUSE） | RW |
| `0x27` | 3:2 | **OFFLEVEL**：00=4 s，01=**6 s**，10=8 s，11=10 s（**默认 6 s**） | RW |
| `0x10` | 2 | PWRON 按住 16 s 强制关 PMIC（默认关） | RW |

### 3.3 实测时序

按下瞬间报**负沿**，松手时才报**短按**：

```
BTN  79776 ms  AXP2101 INTSTS2 = 0x02  -> negative(press)
BTN  79916 ms  AXP2101 INTSTS2 = 0x09  -> positive(release?) SHORT     ← 0x08|0x01
```

**所以"短按"是松手时的判定**，不是按下时。要区分短按/长按就看 bit3 与 bit2。

### 3.4 长按 = 硬件断电；但长按标志为何没报仍未解释

按住上键不放，**板子直接从 USB 上消失**：COM3 与 `VID_303A` 设备同时不见，串口日志在 `141076 ms` 处截断。"长按会断电"这件事**是实测的**——接口消失是可观测量，而且它发生在按住期间（当时的操作是"按住约 8 s"，板子在中途就断了）。

**但断电到底用了多少秒，没有测到。** 现场没有计时（用户未看清秒数），文档里 6 s 这个数字的**唯一来源是手册默认值**（`0x27` OFFLEVEL = 01b = 6 s），不是本次量到的。已知的量化边界只有："≤ 8 s 内发生"。

**也没有出现过 `0x04`（长按）**，这一点同样没有解释清楚：

- **(H1)** 短按/长按都是**松手时**判定（§3.3 已证短按如此）。按住不放直到断电 → 永远没有"松手" → 长按标志永不产生。
- **(H2)** 长按本应在按住约 1.5 s（`0x27` 的 IRQLEVEL）时就置位，但被 PMIC 的关机时序抢先。

**倾向 H1，但未证实。** 一次按压就能分辨：按住 **2–3 s 后松手**（短于 OFFLEVEL），若 `0x04` 在松手时出现则是 H1，若在按住期间出现则是 H2。

**无论哪种，实际约束是一样的**：任何"长按手势"都必须短于断电阈值，否则板子直接断电。想放宽就得改 `0x22`/`0x27`（手册里可配，**本次没改过、没测**）。另外 `0x22` bit0 可以把"长按"从断电改成**重启**，`0x10` bit0 提供软件关机（`Soft PWROFF`）——如果关掉长按断电，就得用软件关机来补，否则这个键再也关不掉机器。

---

## 4. 记录在案的缺陷：`badge_hw.c` 把状态位读错了

`main/hw/badge_hw.c:84-86`（脏工作区，未提交）：

```c
/* The charger bit is STATUS1 bit 5 on the AXP2101; VBUS present is IRS2 bit 3. */
#define AXP_STATUS1_BAT_PRESENT (1u << 5)
#define AXP_IRS2_VBUS_GOOD      (1u << 3)
#define AXP_IRS2 0x49
```

它被这样用（`power_poll()`，`badge_hw.c:242-255`）：

```c
s_hw.usb      = (irs2 & AXP_IRS2_VBUS_GOOD) != 0;              /* 读 0x49 bit3 */
s_hw.charging = s_hw.usb && (st1 & AXP_STATUS1_BAT_PRESENT) != 0;
```

### 4.1 手册怎么说

- **`0x00` STATUS1 bit5 = VBUS good**（电平）；**bit3 = 电池在位**（电平）。
- **`0x49` bit3 = PWRON 短按**，且是 **`RW1C` 事件位，不是电平**。
- `0x49` 里跟 VBUS 有关的是 bit7/bit6（插入/移除），同样是**锁存事件**：手册写明"VBUS Remove to clear it"。

也就是说，用 `0x49` 的任何一位当"USB 在不在"是**两重错**：位号错，量纲也错（事件 vs 电平）。

### 4.2 实测（USB 插着、无按压，每秒一行基线）

```
AXP2101 IC_TYPE(0x03) = 0x4A
STATUS1(0x00)=0x38   →  bit5=1(VBUS good)  bit4=1(BATFET 开)  bit3=1(电池在位)
STATUS2(0x01)=0x32   →  bits6:5=01(充电方向)  bits2:0=010(CC 恒流充电)
INTSTS2(0x49)=0x00   →  bit3=0        ← 一直是 0，而 USB 正插着
```

`0x49` 为 0 是**符合手册**的：探针在启动时清过状态，之后 USB 一直插着，插入事件不会重新产生。这恰好说明**事件位不能当电平用**。

### 4.3 影响

1. **`badge_hw_usb_present()` 现在返回 false，而 USB 是插着的。**（已修，见 §4.4；真机后果即"桌面态进不去"，§6.5 有验证。）
2. **按一次上键后它会卡在 true。** `0x49` bit3 是 `RW1C`，只有写 1 或 POR 才清；代码从不清（全仓库搜不到任何对 `0x48/0x49/0x4A` 的写）。所以按一下上键，这个位就永久置位到下次重启。
3. 每个轮询周期都把**上一次按键残留**当成"USB 在位"，`badge_hw_charging()` 跟着一起错。
4. 下游看得见：`main/main.c:382` 把它喂给 `badge_fsm_set_power()`，而 [`badge_fsm.c:382`](../main/ui/badge_fsm.c) 的桌面充电态判据是 `fsm->usb && fsm->flat`。**真机插上 USB 不会进桌面态；按一下上键反而会（如果此刻恰好平放）。**

### 4.4 修法（已实施，见 §6）

```c
/* STATUS1 is a level register: bit5 VBUS good, bit3 battery present.
 * INTSTS2 (0x49) holds LATCHED IRQ events (RW1C) -- never a level. */
#define AXP_STATUS1_VBUS_GOOD   (1u << 5)
#define AXP_STATUS1_BAT_PRESENT (1u << 3)

s_hw.usb      = (st1 & AXP_STATUS1_VBUS_GOOD) != 0;
s_hw.charging = (st1 & AXP_STATUS1_BAT_PRESENT) &&
                (st2 & 0x07) <= 0x03;   /* tri/pre/CC/CV = 在充 */
```

`STATUS2[2:0]` 的充电状态编码**手册里有明确定义**，本次也读到了 `0x010`（CC，即在充电）。顺带说：`badge_hw.c:251-253` 那段注释的理由——"状态寄存器的充电位在不同 AXP2101 版本间不一样，所以用上面那对位更通用"——与手册和这次读数都不符，**这个 workaround 的动机不成立**。

`charging` 用白名单（0–3 在充）而不是"非 0x05"：0x04 是"充满、插着"（插着但没在充，玻璃上不该显示充电），0x06/0x07 是保留值，按"没在充"处理而不是猜。

若要用上键，还必须补两件事：**读后写 `0x49` 清除**（否则同一事件反复触发），以及**显式使能 `0x41` 的边沿位**（bit1/bit0 复位默认是 0；短按/长按位 bit3/bit2 默认是 1）。

---

## 5. 顺手核对过、结论是没问题的

记录下来是因为"排除了什么"比结论更耐用，免得下一个人重查：

- **VBAT 高字节掩码 `& 0x1F`**（`badge_hw.c:246`）：**这一条两个来源互相矛盾，未定论**，写在这里是因为容易误判。
  - 项目写法 `((adc[0] & 0x1F) << 8) | adc[1]`（5 位）**与厂商驱动完全一致**——XPowersLib 的 `getBattVoltage()` 用 `readRegisterH5L8(0x34, 0x35)`，而 `H5L8` 就是 `(h5 & 0x1F) << 8 | l8`。
  - **但手册说 `0x34` 的 bit5:0 是 `vbat[13:8]`（6 位）**，且 ADC 章节写明"数据是 14 位，必须先读高 6 位再读低 8 位"。
  - 谁对取决于 ADC 的 LSB，**本次没测到 VBAT 原始读数，无法判定**：若 LSB = 0.5 mV（14 位满量程 8.192 V），则高于 4.096 V 时 `vbat[13]=1` 会被丢掉，`mv` 读出约 100–200，被 `mv > 2500 && mv < 4600` 的守卫拦下 → **电量百分比在高电量区停止更新**（不是显示错值）；若 LSB = 1 mV，则最高位永远用不到，此掩码无害。
  - 要判定只需读一次 `0x34/0x35` 原始值：`adc[0] & 0x20`（bit5，即 `vbat[13]`）是否曾置位。**未测，未观测到症状。**
- **`0x30` 的 ADC 使能位名字与位号不对应**（`badge_hw.c:77-78`）：`AXP_ADC_VBAT_EN` 写的是 **bit2 = VBUS 电压通道**，`AXP_ADC_TS_EN` 写的是 **bit3 = VSYS 电压通道**；正确的是 bit0（电池）/ bit1（TS）。手册里这两位的复位默认**就是 1**，所以电池电压本来就能读——`pmic_probe()` 那句"开机时多数 ADC 是关的"不成立，而它实际打开的两个通道代码从不读。**也是潜在偏差，未观测到症状。**
- **两个键都不会占新引脚**：下键是 GPIO0，上键根本不占 MCU 引脚。但要注意**上键的轮询和触摸/IMU 共用同一条 I2C 总线**——这正是 `badge_hw.c` 里 `POLL_MS 500` 那条注释的理由（"a 30 fps mode does not issue 60 reads a second on the touch controller's bus"），10 ms 的探针轮询是**排查姿势**，不是可以直接搬进固件的频率。
- **`AXP_IRS1`、`AXP_VBAT_L`、`AXP_STATUS2`** 三个宏除了定义本身没有任何引用（`PMIC_PROBE` 之外的死定义）。

---

## 6. 仍未确定

| 项 | 状态 |
|---|---|
| 长按标志到底在松手还是按住时报（H1/H2） | **未决**，§3.4 给了分辨方法 |
| 长按断电的**实测**时长 | **未测**。已知"按住期间断电，且 ≤8 s 内发生"；6 s 是手册默认值，不是量到的 |
| 长按断电的阈值是否真是 6 s | 未测；`0x27` 可配，但本次没读过该寄存器 |
| 改 `0x22`/`0x27` 放宽或关掉长按断电 | 手册里可配，**本次没改过** |
| `AXP_IRQ` 网络经电平转换器接到哪个 MCU GPIO | 未测。上键走**轮询 I2C**不需要它；想改成 GPIO 中断省 I2C 流量才需要 |
| `0x41` 只靠复位默认（不显式写）能否收到短按 | 未单独验证——探针在任何按压前就写了 `0x0F` |
| VBAT 高字节该按 5 位还是 6 位取（§5） | **未决**，手册与厂商驱动互相矛盾；没测到 VBAT 原始读数 |
| 物理方位（哪个键更靠上）的仪器确认 | 只有用户侧转述，没有仪器测量 |

---

## 7. 怎么复现

探针是**仓库外**的一次性工程（改坏了只是刷回项目固件，不动仓库），沿用 `m1-hardware-verification.md` §4 那个 I2C 探针的做法：

- 位置：`D:\btnprobe`，构建树 `D:\btnprobe-build`
- 逻辑：**双通道同时监听**——GPIO0 挂 `GPIO_INTR_ANYEDGE` + AXP2101 每 10 ms 轮询 `0x49`，事件带毫秒时间戳；每秒打一行 `REF` 基线（`0x00`/`0x01`/`0x49` 原始值 + 各位解码）
- 引脚：`GPIO0`（按键）、`GPIO14/15`（BSP 的 I2C SCL/SDA）；`printf` 而非 `ESP_LOGx`，不受日志级别影响

```powershell
idf.py -B D:\btnprobe-build set-target esp32s3
idf.py -B D:\btnprobe-build -p COM3 build
idf.py -B D:\btnprobe-build -p COM3 flash monitor
```

操作：先按上键 3 下 → 停 3 秒 → 再按下键 3 下。然后核对"上键只出 `BTN ... AXP2101 INTSTS2`、下键只出 `BTN ... GPIO0`"。

**刷之前先备份 NVS**（`0x9000` 长 `0x8000`，里面是猫的存档）：

```powershell
python -m esptool --chip esp32s3 -p COM3 read_flash 0x9000 0x8000 D:\btnprobe\nvs_backup.bin
```

**恢复**：先写回 NVS，再刷 `dist/` 那三个镜像（顺序不能反）：

```powershell
python -m esptool --chip esp32s3 -p COM3 -b 460800 write_flash 0x9000 D:\btnprobe\nvs_backup.bin
tools\build-firmware.ps1 -p COM3 flash
```

本次恢复后的验证：启动日志出现 `pet_save: loaded 95 bytes` → `app: restored 1 cat(s), 120 coins, active='小橘'` → `app: ready`，存档无损。

---

## 6. 两个键接进了玩法（2026-10-12 晚）

上面的结论原本只是"键能用、但固件没接"。现在接上了。**接线全部在 `main/hw/badge_hw.c`，语义全部在 `main/ui/badge_fsm.c` 的 `badge_fsm_button()`**，两者分开是因为前者有 I2C/GPIO 的现场知识，后者能在宿主测试里跑。

### 6.1 映射

| 键 | 事件 | 动作 | 依据 |
|---|---|---|---|
| **上键** | 短按（松手判定） | 待机常显/息屏 → 唤醒回主表盘；**已亮且不在主表盘** → 回主表盘；已在主表盘 → 只刷新空闲计时 | 规范 modes 表："抬起、触摸、唤醒词回到互动态"——这是第四个触发源 |
| **上键** | 长按 | **不做任何事**（故意的） | 长按是 PMIC 的硬件断电（`0x27` OFFLEVEL，默认 6 s），固件拦不住；见 §3.4。绑上去只会得到"按住约 6 秒机器黑掉" |
| **下键** | 单击 | 该画面声明了 `tap_cat` 时 = **抚摸**；未声明则**什么都不做** | 走和手指同一个门（`do_tap()` 用的 `gest_declared()`），所以键和手指不会各说各话 |
| **下键** | 长按 ≥ `long_press_ms`(600) | **按住说话**（该画面声明了 `long`） | 手持时物理按键比在玻璃上长按更可靠：手指不会挡住小猫 |
| **下键** | 松开 | 结束这次聆听 | 和松手等价 |

两个**待机常显**下的例外，都是为了让键不"像坏的"：上键短按唤醒（上面那条），下键单击/长按也唤醒而不是成为死键。

设计上刻意**没做**的：下键单击不会顺手导航回主表盘。早先的实现先 `home()` 再判断 `tap_cat`，结果是"在设置画面按下键会默默离开设置"——那正是上键的职责，已改成按当前画面判断（宿主测试 `test_buttons()` 有两条断言钉住这点）。

### 6.2 怎么读的

- **下键**：`espressif/button` 4.2.1（`iot_button_new_gpio_device()`，`active_level=0`，内部上拉）。用它不是图方便，是因为 §3.1 量到按压有 1–3 个多余边沿（ISR 计数 `x1,x3,x1,x3,x1,x4`），自己数边沿会把一次单击变成好几次抚摸。
  - **极性坑**：`iot_button_get_key_level()` 返回的是**逻辑**状态，`button_gpio.c:42` 是 `level == active_level ? 1 : 0`，所以 **1 = 按下**、0 = 空闲。启动日志 `lower=GPIO0 idle=yes` 就是它。第一版按裸电平理解，把空闲读成"按键卡住"，已改。
- **上键**：`0x49` INTSTS2 bit3，**读后写回 RW1C 清除**（同时清长按位与两个边沿位，免得残留位被反复读到）。轮询在 `badge_hw_poll()` 里，和 PMIC 读数同一个 500 ms 节拍——**锁存位不会漏**，60 ms 的短按也会留在 bit3 上直到被清。
  - 另外在 `badge_hw_button_init()` 里**显式使能 `0x41` bit3**：复位默认就是 1，但一个面向用户的功能靠"默认值没被改过"是不该的。

### 6.3 线程模型（这一条错了会很难查）

下键的回调跑在 `espressif/button` **自己的定时器任务**上，是整个固件里唯一不在 LVGL 线程的输入。状态机与 LVGL 都是单线程的，所以回调**只入队**，由 `app_tick_cb()` 持锁出队后调用 `badge_fsm_button()`（`main.c` 的 `app_key_cb()` + 4 格环形队列）。按键产生的效果和手势进**同一个池子**，所以第 4b 步的 `badge_fsm_take_fx()` 会照常把提示音和震动一起处理掉，不需要第二条通路。

### 6.4 上行协议

短按唤醒会上报 `EVT_WAKE`，`a=3`（新增 `EVT_WAKE_BUTTON`）。规范里 `EVT_WAKE.a` 只有 `0 抬起 / 1 触摸 / 2 唤醒词` 三个值，**3 是我们加的第四种唤醒原因**，属于对规范的扩展而不是读法。事件**类型**没有增加（仍是 14 类），只是 `a` 多了一个取值，所以 8 字节上行的事件布局不变。

### 6.5 验证到什么程度

- ✅ 两键的**通路**：§1–§4 的仪器实测（通道归属排他）。
- ✅ GPIO0 **空闲状态**：真机启动日志 `lower=GPIO0 idle=yes`（极性修正后）。这句话本身也是一次极性取证——见 §6.2 的坑。
- ✅ **USB / 充电位修复**（§4.4）：**真机确认**。修好后启动日志稳定出现 `PERF mode=desk`，而桌面态的判据是 `fsm->usb && fsm->flat`——修复前 `badge_hw_usb_present()` 在插着线的板子上返回 false，桌面态**根本进不去**（§4.3 第 4 条记的正是这个现象）。现在进得去，说明 `0x00` STATUS1 bit5 读对了。
  - 未覆盖的一半：**拔线**和**充电中**两个方向没有单独验（板子一直插在 COM3 上供电）。
- ✅ **映射逻辑**：`tests/host/test_badge_fsm.c` 的 `test_buttons()`——唤醒上报、待机常显不死键、主表盘抚摸+冷却、非主表盘不抚摸也不导航、长按说话、未声明 `long` 时按住无效、按键推迟空闲超时、退化入参不崩。整套宿主测试 `ALL HOST TESTS PASSED`。
- ❌ **没有用人手按过。** 真机上"按下去到底出不出抚摸/唤不唤醒"**没有验证**——按下键和按上键都是物理动作，本轮没做。上键那条尤其要看：它的通路是 I2C 读一个锁存位，而不是 GPIO 边沿，所以"轮询能捕到短按"这句话只有 §3.3 的探针数据支持，没有经由这条新代码验证过。
- ❌ 下键**长按阈值**（`long_press_ms` = 600 ms）只在宿主测试里验过，没在真机上量过手感。
