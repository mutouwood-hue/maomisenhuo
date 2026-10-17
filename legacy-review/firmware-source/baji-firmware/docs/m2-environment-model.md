# M2 端侧环境模型：工具已实现，真实权重与场景验收未完成

日期：2026-10-14；范围：训练/评估/导出工具，不改固件。Q9合规已通过，不再待合规确认；环境与主动语音独立授权、原音频不出设备、不存环境PCM、不转写/识别人仍为工程要求。基线见[三端契约](<m2-contract.md>)与[PRD环境定义](<../_ref/notion-current-2026-10-14.md#L1718-L1761>)。

## 当前证据与限制

- [离线模型工具](<../tools/environment-model/environment_model.py>)实现真实本地PCM读取、特征、分组防泄漏、softmax训练、分割评估、按源group交叉验证、小C权重导出。只依赖numpy和Python标准库；不请求网络、不上传录音。
- [测试](<../tools/environment-model/test_environment_model.py>)14项通过，涵盖静音/满幅/格式/部分窗、group/recording/speaker/location隔离及连接组CV、NC许可/隐私授权拒绝、重复内容/完整性、独立OOD留出、数学优化、UNKNOWN拒识与导出。全部数学/合成fixture测试，**没有环境场景准确率证据**。
- [特征黄金向量](<../tools/environment-model/feature-fixtures.json>)由[生成器](<../tools/environment-model/generate_fixtures.py>)生成，明确标SYNTHETIC_NUMERICAL_ORACLE_NOT_SCENE_ACCURACY，仅Python/C数值一致性。
- 当前项目未发现可用于训练的四类真实标注环境数据集；已有猫叫/提示音不覆盖QUIET/CONVERSATION/NOISY/MUSIC，不可冒充。**未训练、未导出生产权重，环境分类功能未验收完成**。
- 未下载数据集、巨大预训练模型或个人录音。还未测ESP32-S3时间/RAM/电流/双麦真实域偏移；软件内存预算不等于实测。

## 低内存DSP与provider精确规格 v1

输入与固件冻结一致：16kHz双通道PCM16交错，每次320frames/640 samples/20ms。模型不留PCM，回调结束硬件层清零。特征只RAM，不落盘/上传；撤回、断连或epoch变化必须reset聚合，不能混合不同授权窗口。

每20ms块得到12维frame：

1. mono_i = trunc((L_i+R_i)/2)/32768，使用int32加法后向零截断，不能有符号右移代替；stereo每侧除32768。
2. f0=ln(max(RMS(mono),1e-6))；f1=相邻sign(mono>=0)改变次数/319。
3. f2=min(max(abs(mono))/max(RMS,1e-6),20)；f3=abs(mean(mono))。
4. f4=ln(max(RMS(L),1e-6))-ln(max(RMS(R),1e-6))；f5=所有640samples中abs(sample)>=32760的比例，先int32避免-32768溢出。
5. f6..11=250/500/1000/2000/4000/6000Hz六个Goertzel ln-power：coefficient=2cos(2πf/16000)，初始s1=s2=0，每sample s=mono+coefficient*s1-s2；s2=s1,s1=s。power=max(s1²+s2²-coefficient*s1*s2,0)/320²；ln(max(power,1e-12))。无window函数、无FFT、不去DC（DC单列）。
6. 50完整块构成1秒特征窗口。使用Welford：delta=frame-mean，mean+=delta/n，M2+=delta*(frame-newMean)。最终24维=[mean12, sqrt(max(M2/50,0))12]。非滑动、丢弃未满窗口；不零填补短音频以伪造QUIET。
7. 每帧6×320 Goertzel循环+时域统计；聚合12mean/12M2约100bytes，权重4×24+mean24+scale24+bias4=148 float约592bytes。建议模型临时RAM<32KiB，每回调预算10ms以内，须真机实测。1秒窗意味着事件采样区间应对应整窗；不能每20ms重复上传前次结果。

推理：z=(feature24-mean24)/scale24；logits_c=dot(weights[c],z)+bias[c]；稳定softmax减max(logits)，类别顺序固定QUIET/CONVERSATION/NOISY/MUSIC映射固件1..4。pmax<minConfidence或max(abs(z))>maxZ输出UNKNOWN0；nonfinite、无权重、未满窗输出UNKNOWN。完整训练模型has_model=true表示有加载模型，不等于通过发布验收；无权重has_model=false。confidence_permille=round(clamp(pmax,0,1)*1000)。未知类是拒识出口，不以合成噪声训练一个任意UNKNOWN类；仍需真实域外样本评估拒识能力。

[导出工具](<../tools/environment-model/environment_model.py>)输出model.json（schema/labels/标准化/权重/显式阈值/manifest hash/许可证/isProductionApproved=false）、metrics.json（三split混淆矩阵4×5，UNKNOWN为拒识列、各类recall/macroF1/rejectionRate）、baji_env_weights.h（平铺float常量）。生产模型仍应另做签名/hash/版本校验，不将导出的实验头自动链接生产。

## 输入数据manifest与运行

[JSON Schema](<../tools/environment-model/manifest.schema.json>)定义输入：schema=baji-environment-linear-v1、isRealLabeledAudio=true、clips中每项id/path/groupId/recordingId/speakerGroupId/locationGroupId/sourceUrl/license/licenseUrl/attribution/authorizationRef/label/split/sha256/labeler/captureDomain/isUseAuthorized/isPrivacyUseAuthorized。两个独立授权布尔必须true，许可URL/归属致谢/授权引用不可空；仅字段声明不替代人工核验。工具执行SHA256和跨split四维来源/内容重复检查；TRAIN/VALIDATION/TEST必须各有四类，OOD_TEST仅允许UNKNOWN且必须存在。录制、说话者群、地点群任一相同不可跨split；CV再以四维来源连接分量整体隔离，避免相邻窗口/不同切片同源泄漏。16kHz stereo uncompressed PCM16 WAV，1..600秒；单声道复制到双道不能证明佩戴双麦域性能。许可允许列表CC0-1.0/CC-BY-4.0/CC-BY-3.0；实际授权还须人工核对，声明字段不是法律证明。自采隐私谈话**不允许**借训练名义绕开PRD不留原音频边界。OOD_TEST不参与训练或阈值调参，单独报告falseAcceptanceRate/rejectionRate；它不能只用合成白噪声替代真实域外混合声。

```powershell
& 'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m unittest -v test_environment_model
# 从tools/environment-model运行。只在已有合法真实标注数据时执行：
& 'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' environment_model.py '<manifest.json>' '<fresh-output-directory>' --min-confidence 0.75 --max-z 8 --cv-folds 3
```

0.75/8仅命令示例试验参数，不是已标定阈值。阈值/超参只在validation与训练分组CV选择；TEST只用于最终一次测评，不能反复调整后还宣称独立测试。工具允许用户显式选择阈值，不能自动把任何宏F1当达标。默认不输出、缓存或复制原始音频。

## 外部数据调查与可行方案

- [AudioSet官方下载说明](https://research.google.com/audioset/download.html)：发布标签/128维特征标CC-BY4.0，但大多原音频是YouTube链接；**数据标签许可不自动授权链接视频原音轨商业复制/训练**。2.4GB VGGish特征与本工具DSP不一致，不可直接当本模型训练输入。未下载。
- [IRMAS官方Zenodo](https://zenodo.org/records/1290750)：音乐数据明确CC-BY-NC-SA4.0，约11GB，排除生产训练。未下载。
- ESC-50等环境benchmark要逐clip核查许可，且不满足中文交谈/佩戴双麦/安静及混合音乐噪声的四类定义；不能把音频事件识别和整场景识别混为完成。
- 推荐先由产品/数据owner提供**合法既有非敏感音源或专门许可的数据**，包含实际静音底噪、背景多人交谈、音乐+噪声混合，双麦设备域另在RAM在线人工标label、不留谈话PCM。只有环境label不足以离线训练声学特征，可在独立同意和另行确认的训练方案下评估非可逆特征留存；当前没有该新增授权，工具不自行采集。
- 线性DSP是可部署的小基线，不保证音乐与交谈可分；若真实验证不可接受，再评估许可明确tiny CNN/log-mel模型和约32KB临时RAM边界，不能凭小模型名称或阈值把未验证能力称完成。

## 本轮模型制品与真实数据审计（2026-10-14 22:14）

已读[最新PRD音频与隐私正文](<../_ref/prd-user-current-20261014.md#L1681-L1757>)。A03四类是真实场景，不将speech朗读、音乐单音、静音数学fixture或音量阈值伪装为完整场景验收。Q9已通过，但不扩大为存储环境PCM的授权。

### 可实施加载/导出与独立评估

- [训练导出工具](<../tools/environment-model/environment_model.py>)新增version=1、TRAIN四维来源+内容SHA256列表、float32权重评估、原生`bj_env_weights_t`结构头与制品hash列表。训练输出目录必须不存在，避免覆盖实验。旧平铺头仍兼容数值检查。
- [严格加载/评估工具](<../tools/environment-model/model_artifact.py>)要求调用方提供可信记录中的model SHA256；校验schema、固定标签顺序、版本、每个数组shape/有限值、float32溢出/scale下溢、阈值、允许许可与训练来源。当前工具只加载`isProductionApproved=false`实验模型，不能自行批准生产。hash能发现篡改，**不是签名**；模型签名/发布密钥属于后续发布门禁。
- 独立evaluate固定模型阈值，仅VALIDATION/TEST/OOD_TEST读取PCM；先对旧模型TRAIN来源与新留出集检查group/recording/speaker/location/content交集，再流式校验SHA256并提特征，不复制原音频。报告真实输入计数、4×5混淆矩阵、recall/macroF1/拒识、每recording等权准确率、OOD误接纳。一个完整manifest仍须包含TRAIN/VALIDATION/TEST/OOD_TEST，evaluate不重新训练也不读取TRAIN PCM。重复执行TEST调参不被技术上自动证明为独立，须实验登记锁定。
- 新[制品测试](<../tools/environment-model/test_model_artifact.py>)与原测试共20项数值/安全回归；所有临时数学声样本仅测试程序，**不是四类精度证据**，未留存权重。

固件交接（实现由firmware-m2负责）：训练输出`baji_env_model_data.h`包含`static const bj_env_weights_t bj_env_exported_weights`，宏`BJ_ENV_EXPERIMENTAL_MODEL=1`、`BJ_ENV_MODEL_VERSION=1u`、`BJ_ENV_MODEL_SHA256`（model.json字节SHA256）。24mean/24scale/96row-major weights/4bias与阈值直接匹配[固件结构](<../firmware-v2/interaction/baji_env_model.h#L7-L12>)；仅关闭采样的init阶段显式`bj_audio_runtime_weights(&bj_env_exported_weights)`，对象须static寿命。不得默认链接fixture；实验构建须独立显式授权开关。无模型仍UNKNOWN/has_model=false，有已加载实验模型不等于产品精度验收。真实场景/功耗由Lead独占设备测试。

```powershell
# 从tools/environment-model运行；不占串口、不使用麦克风
& 'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m unittest -v test_environment_model test_model_artifact
# 已有合法完整真实manifest、训练导出后，独立固定模型评估
& 'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' model_artifact.py '<model.json>' '<manifest.json>' '<fresh-evaluation.json>' --model-sha256 '<trusted-recorded-64hex>'
```

### 官方来源逐项结论（全部未下载）

|来源|官方实际许可/规模|四类适配与结论|
|---|---|---|
|[MUSAN / OpenSLR17](https://www.openslr.org/17/)|页面CC-BY4.0；11GB；还须核验包内逐源许可/致谢|music/speech/noise不是QUIET/多人CONVERSATION完整标注；朗读不冒充交谈。Lead不允许11GB下载，本轮不使用。|
|[FSD50K / Zenodo4060432](https://zenodo.org/records/4060432)|24.7GB；逐clip CC0/CC-BY/CC-BY-NC/ Sampling+混合，数据库整体BY4.0；官方商业用途要求联系作者|44.1k mono弱事件标注，按uploader隔离dev/eval；仅明确CC0/BY子集可候选，仍需commercial contact和隐私核验，不把弱事件标注直接映射场景。NC/Sampling+排除，QUIET/真实交谈覆盖未知。|
|[DEMAND / Zenodo1227121](https://zenodo.org/records/1227121)|CC-BY-SA3.0，音频与文档一起；7.4GB，16通道48k/16k|真实环境底噪、多通道有价值；SA不是NC，但当前工具allowlist不含SA，需权重/派生物分发义务决策后才接入，不能擅自把许可证改BY。每地点录制不可切片跨split，真实四类仍不足。|
|[ESC-50官方说明](https://raw.githubusercontent.com/karolpiczak/ESC-50/master/README.md)|整体BY-NC3.0，约600MB；仅ESC-10子集BY并有逐clip归属|总体排除；ESC-10有限环境事件可作为NOISY/OOD候选，不含完整QUIET/CONVERSATION/MUSIC四类。官方提示预处理类别泄漏，不能报本项目四类准确率。|

网页公开许可元数据**不等于已经下载hash**：本轮没有音频下载，因此没有伪造SHA256。真正接入时必须登记原始下载URL、文件/归档SHA256、逐clip许可证URL/原作者致谢、授权核验引用、人工场景标签与captureDomain；转换/重采样另记原hash→转换hash，mono复制双声道标明域差异。不允许为填齐类别人工混音/合成声样本验收。

Lead仅批准可选≤200MB、逐clip商业许可明确的公开既有非私人样本；本轮没有找到可信四类齐全小包，因此没有消耗该额度或训练长任务。现实下一步是数据owner从许可明确既有数据审核真实安静底噪、背景多人交谈、噪声和音乐的独立来源，包含真实混合/OOD，再运行现有工具得到诚实混淆矩阵；设备在线人工label只保留类别/计数，不落环境原音频。若线性DSP失败，不应继续调阈值冒充多类完成，应在同一真实holdout上评估许可明确tiny CNN并重新实测内存功耗。

## 发布门禁

真实四类标注train/validation/test与域外数据→Python/C向量一致→场景混淆矩阵及误报/漏报定义→两板线上RAM推理与可感知指示→撤回/低电/连接epoch清零→CPU/RAM/电流→签名模型包发布。当前只完成前置工具和数值测试，缺数据/训练权重/实体精度与功耗是具体未完成项，不再归因为Q9合规待确认。
