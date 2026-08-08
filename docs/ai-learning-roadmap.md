# 七名 AI 的学习与自博弈路线

目标不是把公开视频硬编码成一套固定流派，而是把可复核的人类决策原则转成数据、评测和可迭代策略。当前引擎已经有确定性随机种子、共享玩家规则、七套软权重、可完成 8 bot 对局的阶段级 headless 接口，以及一个受控席位加七名现有 AI 的动作级训练环境；专家样本 schema、历史策略池、短程 Recruit planner、随机动作执行后重规划边界、部署席位成对门禁、高置信残差安全 seam 和七席 legacy 宏观专家 rollout 均已落地。v3 粗粒度 planner 已通过正确性与隐私验证但在 12-seed 诊断中显著降低吃鸡率，因此后续改为“现有强规则策略作专家与回退，只学习残差”，而不是继续扩大替代式搜索。截至 2026-08-08，正式运行时使用 `AI_POLICY_VERSION=video-strategy-v4-safe-recruit-health`；它增加了七席共享的规则级生命安全守卫，但 residual provider 仍为空，尚未部署任何学习候选。

## 2026-08-08：v4 安全策略与学习实验终态

v4 已部署的变化是确定性的引擎安全规则，不是逻辑回归模型。七种 profile 共用以下边界：

- 当“夜鬼淘金”式英雄技能偷取酒馆牌并直接扣除 2 点生命、且会跨过安全底线时，不执行这次不安全激活。
- 在招募阶段打出随从前，投影直接英雄伤害、场上 `afterFriendlyPlayed.heroDamage`（按引擎的金色组件倍率）、普通 `damageHero` 战吼（按实际战吼触发次数，含 `War Drum`）以及 `BG26_525` 交互战吼（按其 golden repeat）的发现等级伤害；把护甲计入可承受量，并按当前 profile 的健康底线，在投影会穿越底线时保守持牌。
- 场上存在灵魂回溯者（Soul Rewinder）时，观察者按其已实现的招募阶段伤害回溯规则处理，不把可回溯伤害误判成必须持牌。除此之外，七席不会因人设偏好绕过同一生命安全守卫。

本轮严格视频语料由 7 个 runtime-compatible Bilibili 来源组成，共 `60` 个决策窗口、`64` 条训练样本；标签分布为 `upgradeNow=12`、`defer=10`、`refreshOnce=11`、`stop=10`、`freeze=10`、`unfreeze=11`。新增复核来源包括 [伊莉斯+腐蚀秘典，打开上限！想玩什么随心所欲！](https://www.bilibili.com/video/BV1w9Ti6tEMq/) 与 [龙族巅峰，人均十万，暴打背靠背！](https://www.bilibili.com/video/BV1y1VD6DEj7/)。补丁 `35.4.2` 的窗口只允许使用跨补丁不变的宏观按钮、金币合法性和招募到战斗阶段边界，明确排除卡牌、数值、英雄、饰品和异常规则；另行登记的 `36.2` 来源仅作 evidence，因晚于当前固定运行时而不进入训练。

标签边界是机器可核的：直接标签必须能从目标决策本身观察；推断 `defer` 或 `stop` 时，必须由目标动作之外的一次可见操作把资源从“足以执行目标动作”推进到“立即不足”，并记录操作前、操作后和所需费用；推断 `unfreeze` 只允许发生在招募阶段进入战斗阶段的边界。一次刷新本身永远不能标成 `stop`。每个训练窗口还绑定 BVID、时间点和复核媒体 SHA-256，避免同一页面的视频字节漂移后仍被当成原证据。

固定媒体 SHA 分组的三折逻辑回归产物通过了结构、来源与哈希验证，但三个分类头均未通过事前固定的离线质量门禁：

| 分类头 | 两类召回率 | Balanced accuracy | Lift | Coverage | Covered accuracy | `qualityPassed` |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| upgrade | `0.75 / 0.40` | `0.575000` | `+0.075000` | `0` | — | false |
| refresh | `0.272727 / 0.50` | `0.386364` | `-0.113636` | `0.190476` | `0.250000` | false |
| freeze | `0.50 / 0.636364` | `0.568182` | `+0.068182` | `0.333333` | `0.428571` | false |

产物绑定如下：

- artifact SHA-256：`00c68092851d2bcef989c34034e695cccf8dec6a00bf4495fc49a5d92d93f964`
- runtime payload SHA-256：`5303146fe0c6e2a90512dea463e4d027f9b61f3c47991218aa7e66205b4bfaaf`
- dataset SHA-256：`35ca24d17803ee6a5a389d049bf561bb6253a39a41e432a320a99832becac832`

视频样本没有配对的 legacy baseline，因此整体 `promotionGate.passed=false` 还包含 `pairedBaselineComplete=false`；但这不是唯一否决理由，三个头各自的 `qualityPassed` 已经全部为 `false`。流程在离线门禁处停止：没有部署该 runtime payload，没有运行研究模拟，也没有执行预留的正式 `304` / `305` 种子区间。`30_400_001–30_400_064` 与 `30_500_001–30_500_096` 现已在共享 seed ledger 中显式标为 `sealed`；通用、planner、residual 和 policy-suite benchmark 均须在创建策略或报告进度前拒绝访问，不能只靠文档约定。以上结果只描述小型公开视频语料的离线分类表现和本地安全规则，不能外推为真实天梯胜率或已经证明七名 AI 的对局强度提升。

另一个不依赖逻辑回归的公开视频规则候选 `video-residual-buy-spike-before-level` 随后只进入开发诊断：当旧策略准备升本，但升本后不足以正常买牌、当前商店存在显著即时提升且血量或场面要求节奏时，以 `0.95` 置信度改为延后升本。全新诊断种子 `91_000_001–91_000_004` 同时覆盖 `neutral-v1` 与 `live-lobby-v1`、八个物理轮换，共完成 `128/128` 个 baseline/candidate 运行和 `448/448` 个 profile pair，无失败、截断或平局；候选在 `43,121` 次调用中覆盖 `175` 次。结果仅有平均名次差 `-0.017857`（负数较好，95% seed-cluster 区间 `[-0.062778, +0.027064]`）、前四率差 `+0.006696`（`[-0.020194, +0.033587]`）和吃鸡率差 `0`（`[-0.025935, +0.025935]`）。对子与健康升本 profile 的平均名次分别恶化 `+0.28125 / +0.234375`；因此它在 4-seed 诊断即停止，不扩大到 24-seed 晋级门禁，也不部署。这里的开发区间是候选筛除证据，不是正式 promotion 证据。

同一研究队列中的“后期高本、资源有余量时更积极升本”候选也只运行了开发筛选。`92_000_001–92_000_004` 覆盖双场景与八轮换，完成 `128/128` 局和 `448/448` 个 profile pair，产生 `47` 次真实覆盖；平均名次差为 `-0.0513`，95% seed-cluster 区间 `[-0.1775, +0.0749]`，前四率和吃鸡率均为 `+0.00893`。健康升本 profile 仅触发 `2` 次，既没有稳定总体证据，也没有解决已知弱项，因此在 4-seed 阶段否决，不扩样、不部署。

为避免不断围绕未经量化的直觉试规则，随后先用全新开发种子 `92_100_001–92_100_008` 对当前 v4 七个 profile 建立双场景、八物理轮换的绝对基线；`64/64` 局全部完成，无平局或截断。结果如下：

| Profile | 平均名次 | 前四率 | 吃鸡率 |
| --- | ---: | ---: | ---: |
| balanced | `3.8906` | `0.6406` | `0.1563` |
| magnetic | `3.7188` | `0.6250` | `0.2031` |
| tempo | `3.9063` | `0.6563` | `0.1406` |
| triple | `4.1875` | `0.5781` | `0.1094` |
| powerLevel | `5.0000` | `0.3125` | `0.0781` |
| economy | `4.3438` | `0.5469` | `0.1563` |
| deathrattle | `4.5469` | `0.5156` | `0.0625` |

该小样本只用于发现研究方向，不能把 profile 间的绝对值当作严格因果比较。它指出健康升本、亡语和经济 profile 的决赛转化仍值得优先研究。

### 满场差 1 金的原子换将候选：开发筛选否决

在现有 v4 满场替换逻辑只会“先买再卖”的安全边界上，本轮增加了一个仅供 headless 反事实评测的 `sell-one-v5` 候选：满场且手牌不超过 8 张时，如果一个确定的金币报价恰好只差 1 金，允许出售当前最弱且实际售价恰为 1 金的场上随从，再购买锁定的同一报价。来源带 `afterSold`、出售发现等副作用时直接弃权；完整交易必须在克隆状态上通过“出售→重新取得报价→重新评分→购买”，目标在出售后的分数仍须至少比来源高出当前 profile 的 `replacementMargin`，且不能留下待处理交互。成功克隆才以保留根状态和八个既有 `PlayerState` 引用的方式原子安装；任何安装失败都回滚。普通 `advanceHeadlessGame`、UI、reducer 和生产 v4 没有候选开关。

评测器为每个 `(seed, scenario, rotation)` 只建立一次 canonical legacy baseline，再分别只把七个正式 profile 中一个焦点席位切为候选；候选第一次真正改变动作前要求初始 JSON 哈希和 RNG 完全一致，之后不伪称随机轨迹仍相同。结果按 seed 聚类并同时报告总体、场景、profile 与物理席位；物理席位只作干扰诊断。任一不完整对局、失败、平局、截断、哈希漂移、零决策分叉、出售后异常或诊断账本不闭合都会 fail closed。预注册晋级门槛要求至少 24 个 seed、平均名次差不高于 `-0.10` 且区间上界低于 0、前四率与吃鸡率区间下界分别不低于 `-0.02 / -0.03`；每个场景和七个 profile 还须通过较宽的分组非劣门槛。

最终有效开发筛选使用 `92_240_001–92_240_008`：`1,024/1,024` 个计划运行和 `896/896` 个焦点 pair 全部完成，零失败、平局、截断或哈希不一致。焦点诊断严格闭账：`eligible=1,291 = dryRunAccepted 271 + scoreAborts 1,020`，另有资格判断前的 `handCapacityAborts=7`；`dryRunAccepted=salesCommitted=purchasesCommitted=decisionDivergences=271`，出售后、报价漂移、资金、交互和执行失败均为 0。

总体平均名次差为 `-0.071429`，95% seed-cluster 区间 `[-0.129119, -0.013738]`；前四率差 `+0.010045`（`[-0.002848, +0.022937]`），吃鸡率差 `+0.004464`（`[-0.006094, +0.015022]`）。虽然总体名次区间方向为正向，但效果没有达到事前固定的 `-0.10` 最小改善，而且 magnetic 的名次区间上界 `+0.274783` 高于分组上限 `+0.25`、前四率区间下界 `-0.106478` 低于 `-0.05`，tempo 的前四率区间下界 `-0.055868` 也低于 `-0.05`。因此 `technicalEvidenceUsable=true`、`screenEvidenceUsable=true`，但 `accepted=false`。流程严格停止，不运行 24-seed 扩样，也不解封或运行 `304` / `305` 正式区间；生产版本继续是 v4。economy 的名次差 `-0.21875` 显示这个交易原语可能适合后续做 profile-aware 研究，但不能据此事后缩小人群并宣布本候选获胜。

### 结算后整队增益守卫：开发筛选否决

`sell-one-v5` 的同批训练诊断显示七个 profile 都有真实交易分叉（balanced / magnetic / tempo / triple / powerLevel / economy / deathrattle 分别为 `35 / 38 / 49 / 32 / 27 / 47 / 43` 次），所以不能把 magnetic 的退化解释成“没有触发”。下一候选在查看任何新种子结果前固定为 headless-only `sell-one-v6-settled-warband`，并完整保留 `sell-one-v5` 作为历史复现模式。v6 沿用 v5 的满场、手牌容量、恰差 1 金、来源实际售价、出售副作用、锁定报价、资金和局部替换分差守卫；唯一新增的策略变化是：在完整克隆中执行出售、重取同一报价、局部复核、购买，再调用一次现有 `playAiHand` 把目标及其自然产生的手牌动作结算到稳定点。若出现待处理交互或执行失败则弃权；只有结算后的场上随从总 `minionScore` 不低于出售前整队总分加该 profile 已存在的 `replacementMargin`，才原子安装克隆。未打出的目标不会计入结算后整队分数；若三连压缩了格子但结算后的整队价值仍过线，则不会仅因场上少于七个实体而误杀。磁力宿主、成长核心、三连与其他协同的损失通过其对整队评分的影响进入同一个守卫；不按 `profile.id` 特判，也不修改任何 profile 参数。

该假设来自公开视频中“低血时优先兑现即时战力”“磁力宿主需计入累计投资和未来引擎价值”“满场仍须保留转型空间并比较相对战力”的稳定原则：[低血稳血与后期转化](https://www.bilibili.com/video/BV1n66KBDEEp/)、[机械磁力投资与循环组件](https://www.bilibili.com/video/BV1e92eBTEUD/) 和 [相对战力与转型空间](https://www.bilibili.com/video/BV1NMB5YEELt/)。复核没有发现能无歧义证明“满场恰差 1 金、卖普通随从后购买目标”的连续视频实例，因此一金交易本身仍是工程推断，不能称为直接模仿学习结果。

开发筛选固定使用从未运行的 `92_300_001–92_300_008`，双场景、八物理轮换、每次只替换一个正式 profile，计划 `1,024` 局和 `896` 个 pair。揭示结果前必须冻结候选语义、专项测试、内容/策略/profile/evaluator hash。除既有技术完整性、总体 `-0.10` 最小名次改善、总体区间和场景/profile 非劣门槛外，本轮新增：七个 profile 各自至少一次真实分叉、各自诊断账本闭合、各自平均名次差必须 `<= 0`。8-seed 筛选若除“至少 24 seed”外任何门槛失败，立即否决，不在同批种子调阈值或补样。

只有 8-seed 筛选除样本数外全部通过，才冻结同一实现并使用独立的 `92_310_001–92_310_024` 做一次 promotion；筛选的 8 seed 不并入 24-seed 推断。promotion 仍要求平均名次差 `<= -0.10` 且 95% 区间上界 `< 0`，前四率/吃鸡率区间下界分别 `>= -0.02 / -0.03`，并通过上述全部场景和七 profile 门槛。任一失败、平局、截断、初始哈希不一致、执行异常或源码/内容/profile 漂移均 fail closed。正式 `304` / `305` 区间继续封存且与本候选无关。

预注册的 `92_300_001–92_300_008` 随后一次性完成：`1,024/1,024` 个计划运行、`896/896` 个 pair，零 runner failure、平局、截断、缺失配对或初始哈希不一致。策略版本保持 `video-strategy-v4-safe-recruit-health`，内容快照前后均为 `54749567…d634d97c`，evaluator core 前后均为 `d7a194ee…fdb3f67`，profile hash 前后均为 `93d9b252…e4cca2d9`。焦点诊断严格闭账：`eligible=1,112 = dryRunAccepted 244 + scoreAborts 850 + settledWarbandScoreAborts 18`，资格判断前另有 `handCapacityAborts=3`；`dryRunAccepted=salesCommitted=purchasesCommitted=decisionDivergences=244`，其余报价、资金、交互、执行和出售后异常均为 0。七个 profile 均有真实分叉，数量依次为 `29 / 39 / 41 / 29 / 32 / 38 / 36`，整队守卫在各 profile 分别拦截 `2 / 2 / 5 / 2 / 2 / 3 / 2` 次。

强度结果没有通过开发筛选。总体平均名次差仅 `-0.032366`，95% seed-cluster 区间 `[-0.086488, +0.021755]`，未达到 `-0.10` 且区间跨过 0；前四率差 `+0.007813`（`[-0.007350, +0.022975]`），吃鸡率差 `+0.011161`（`[-0.002518, +0.024840]`）。magnetic 的名次点估计由旧候选的 `+0.09375` 转为 `-0.09375`，说明守卫确实过滤了部分风险交易，但 tempo / triple 的名次均值仍分别退化 `+0.007813 / +0.015625`，违反新增的逐 profile `<= 0` 门槛；tempo 吃鸡率、triple 前四率和 deathrattle 前四率的分组区间下界也低于 `-0.05`。因此 `technicalEvidenceUsable=true`、`screenEvidenceUsable=true`、`accepted=false`，且失败理由不只有样本数。流程按预注册停止：`92_300_001–92_300_008` 在 seed ledger 中永久标为 consumed，未执行的 `92_310_001–92_310_024` 保持 sealed，不运行 24-seed promotion，也不修改生产 v4。

### 单焦点 cooperative categorical CEM：selection 已完成并被 gate 否决

v6 已在独立的 `92_300_001–92_300_008` 上完成验收并被否决；这批失败结果没有被复用来选择参数。正式七席仍运行 `AI_POLICY_VERSION=video-strategy-v4-safe-recruit-health`。下面的 CEM 已完成 headless training 和一次性 independent selection，但 selection gate 明确否决候选，因此没有进入 roster-final，也不是已部署改进或生产推广证据。

预注册方法为 `single-focus-cooperative-categorical-cem-v1`，注册 ID 为 `cooperative-cem-power-level-v1`。每个候选必须提供完整的 `player-1..player-7` profile 快照，但只允许改变 `player-5 / powerLevel` 的四个字段；其余六个 profile 必须与生产快照逐字节等价，focus profile 的其他字段也保持不变，任何 residual policy override 都被禁止。四个离散 gene grid 与初始 incumbent 固定如下：

| gene | 注册取值 | 初始 incumbent |
| --- | --- | --- |
| `upgradeRoundOffset` | `[-1, 0, 1]` | `-1` |
| `minimumUpgradeHealth` | `[10, 12, 14, 16, 18]` | `14` |
| `replacementMargin` | `[2, 2.5, 3, 3.5, 4]` | `3` |
| `maxRefreshes` | `[1, 2, 3, 4, 5]` | `2` |

优化器固定使用 `optimizer seed=93_000_000`、`populationSize=8`、`eliteCount=2`、`generations=4`、`smoothing=0.5`、`probabilityFloor=0.02`。初始分布在每个 gene 内均匀；`mulberry32-v1` 按类别权重无放回采样，每代第 0 个候选保留 incumbent，分数越高越优。完全同分时先保留 incumbent，再按 ASCII candidate ID 排序。`93_000_000` 只驱动参数采样，不是对局 seed，也不属于下述隔离区间。

每个候选都用当前生产策略作为 baseline，在 `initialHealth=40`、`maxRounds=150` 下运行 `neutral-v1` 与 `live-lobby-v1` 两个场景、8 个物理席位 rotation，并对 `player-1..player-7` 的七种 profile 全部成对计分。fresh training 的 8 个 seed 因而对应每候选 `8 × 2 × 8 × 2 = 256` 局、`8 × 2 × 8 × 7 = 896` 个 profile pair；4 代共 32 个候选槽位，计划上限为 `8,192` 局。rotation 只改变 profile 所在物理席位，不放宽“只有 powerLevel 四个 gene 可变”的边界。

候选可行性要求 policy-suite `evidenceUsable=true`，总体平均名次差 `<= 0`，powerLevel 的前四率差 `>= -0.02`、吃鸡率差 `>= -0.03`；其余每个 profile 分别要求平均名次差 `<= +0.25`、前四率差 `>= -0.05`、吃鸡率差 `>= -0.05`。训练 benchmark 自身还必须保持 `promotionAccepted=false`，因为搜索结果不能在本阶段自我晋级。这些是搜索期的 mean-delta 约束，不等同于最终推广门槛。归一化违约量为所有正向越界之和：名次越界除以 `7`，比率越界除以 `1`，不可用 evidence 另加 `1`；缺失 mean 以 `0` 代入效用和越界计算、不额外增加归一化罚分，但仍各自产生一个失败理由；每个失败理由计一次违约。效用与最终分数严格固定为：

```text
utility = -100 * powerLevelPlacementDelta
          + 10 * powerLevelTopFourDelta
          + 5 * powerLevelWinDelta
          - 1 * overallPlacementDelta

feasibleScore   =  1_000_000 + utility
infeasibleScore = -1_000_000
                  - 100_000 * violationCount
                  - 1_000 * normalizedViolation
                  + utility
```

注册运行没有隐式默认授权。CLI 必须同时收到精确的确认串 `run-registered-cooperative-cem-power-level-v1`、protocol SHA-256 `875b635dab585be70c75f576294806069b048ea39709f6d849debf29ad4f512d` 和 implementation SHA-256 `11afa8ce77a348397ef984eef92a72d27a25b999834ad2e9dc0476054f8ecd88`；任一缺失或不匹配都在首局前失败。protocol pin 绑定注册 payload，implementation pin 绑定本次搜索、评测器及递归 `lib/game` 源码清单。注入 evaluator 的运行永远标为 `injected-test`，不能产生 training evidence。

注册 CLI 还必须在任何 CEM 候选或首局对局开始前，原子、只增不改地落盘 `run-attempt.json`。该 marker 绑定 registration、training reservation、seed 区间以及 protocol / implementation pins；一旦存在，就证明这次 seed 尝试已经开始。若进程在第一个候选 checkpoint 前崩溃，即使目录中仍是 0 个 candidate checkpoint，后续也只能显式使用 `--resume-search-only`，不得再伪装成 fresh training。每完成一个候选，才写入一个连续序号的 raw-bound checkpoint，其中同时保存 compact evaluation、原始 `AiPolicySuiteBenchmarkResult`、两项 pin 和 checkpoint hash；恢复时必须是确定性 CEM replay 的严格前缀，任何缺口、乱序、raw/summary 不一致或 provenance 漂移均 fail closed。

resume 只用于把搜索跑完并保留诊断，不会恢复证据资格：凡使用 `search-only`、读取任何 checkpoint/cache，或不是一次无中断 fresh registered run 的 artifact，`trainingEvidenceUsable` 与 `selectionScreenEligible` 都必须为 false。只有显式三重授权、0 个缓存候选、无 resume 且所有候选 benchmark evidence 均可用的完整 fresh run，才可能把训练 artifact 标为可用；这仍不等于可以上线。

本次 fresh registered training 已一次性完成 32 个候选槽位，未使用 resume 或 cache；每个候选完成 `256/256` 局和 `896/896` 个 pair，所有 benchmark evidence 可用。训练 artifact hash 为 `21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8`，evolution artifact hash 为 `10a6a388050577bb548f5d39b0d3318e89bab57a675412ded319a511c9ffaee0`。选中的可行候选 `cooperative-cem-power-level-v1-g0003-c0000-83a9c758b795` 使用 `upgradeRoundOffset=-1`、`minimumUpgradeHealth=14`、`replacementMargin=3.5`、`maxRefreshes=2`；总体名次差为 `-0.002232`（95% 区间 `[-0.023254,+0.018789]`），powerLevel 名次差为 `-0.15625`（`[-0.383186,+0.070686]`）。它满足搜索期约束并取得 selection 资格，但区间仍跨 0，不能据此推广。

原始 marker、artifact、32 个 raw-bound checkpoint、旧 implementation 的 42 个源码文件和两个 pin anchor 已归档到 tracked evidence bundle。训练结果注册 SHA-256 为 `11dcd989e16b8eef0679b65e4cf0517bdc73e1c937097eb3fc3ffaed74151b7c`；bundle payload / gzip blob / manifest SHA-256 分别为 `a391f271f15afd0946bde35a1599080adb1166aeabf940af39b58008e7e9ce1b`、`af2b63510891f78e7d61877d7ae2f49add6789ea9b1a1694f521736093ca2465`、`38eb37d9eb7ad6993eb52a00b0b826dad68e63465f77a9224dc7ae52455b1a5f`。历史 reader 只依赖冻结的结果注册与归档自身，不依赖后续 selection ledger 或 live CEM pin。

独立 selection 随后在事前冻结的 `93_100_001–93_100_024` 上一次性完成。双场景、8 个物理轮换的 baseline/candidate 共 `768/768` 局，形成 `2,688/2,688` 个 profile pair；runner failure、截断、平局、缺失配对和 provider error 均为 `0`，内容、策略、evaluator 与 candidate profile 前后哈希稳定，因而 `evidenceUsable=true`。这只证明结果可信，不代表候选合格。总体与焦点结果如下，名次差为负才表示改善：

| 范围 | 平均名次差及 95% 区间 | 前四率差及 95% 区间 | 吃鸡率差及 95% 区间 |
| --- | --- | --- | --- |
| 全部七 profile | `-0.00409226`；`[-0.01652328, +0.00833876]` | `-0.00037202`；`[-0.00502090, +0.00427686]` | `+0.00334821`；`[+0.00148341, +0.00521302]` |
| powerLevel | `+0.09635417`；`[-0.01149406, +0.20420240]` | `-0.02343750`；`[-0.04781986, +0.00094486]` | `-0.00520833`；`[-0.02710899, +0.01669232]` |

selection gate 的精确失败理由只有三条，且都来自 powerLevel：

1. `powerLevel placement mean delta must be at most -0.1`：实际为 `+0.09635417`，不仅没有达到至少 `0.10` 的改善，点估计方向还变差。
2. `powerLevel placement confidence interval upper bound must be below 0`：区间上界为 `+0.20420240`，无法排除真实退化。
3. `powerLevel top-four confidence interval lower bound must be at least -0.02`：下界为 `-0.04781986`，越过事前固定的非劣底线。

这不是基础设施失败，也不能用总体吃鸡率的小幅正向结果覆盖焦点否决。训练 8 个 seed cluster 中，powerLevel 名次有 `7/8` 显示改善；独立 selection 的 24 个 cluster 却只有 `5` 个改善、`4` 个持平、`15` 个恶化。训练期 powerLevel 名次差 `-0.15625` 在 selection 反转为 `+0.09635417`，而且 `neutral-v1 / live-lobby-v1` 的点估计都恶化，分别为 `+0.08854167 / +0.10416667`。因此本轮把 8-seed 搜索收益明确判为过拟合，不能复用 `93_100` 调参、补样或重跑。

权威 selection result SHA-256 为 `1bcf2fc7d17d73b014a6f460871149cad8b7cfac4cce1a4a821af6ecbd8d46f7`。artifact / checkpoint / raw benchmark SHA-256 分别为 `d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b`、`47645dc8c269dbc46bc02fab4f7fb70bdd8af33d0ad82631b185cb6ef9f6d6e6`、`6d661e2b5fdb0ae409a4349b7474c1d6f494d3d54280d54d2736b9f2fa697e88`。selection 的源码快照、双 marker、raw-bound checkpoint 与 artifact 已保存到 tracked evidence bundle；archive payload / gzip blob / manifest SHA-256 分别为 `cffdb55a3d19404f03c5d0a1dd832c8dd824536714995ccaeb88e87db8a8391b`、`211cd71dbc2f363ffc77b5d329d3f056c03e891c941f5fc29542cae219f76973`、`1b85c47f8b14ba15cfe593dd06a2ba6680f1033e2bb7690d0a3d38754db4d310`。

seed ledger 的边界已经固定，当前没有可运行的新 CEM 区间：

| 阶段 | seed 区间 | 当前处置 |
| --- | --- | --- |
| 已暴露训练区间 | `93_000_001–93_000_008` | 在能力协议建立前被测试路径暴露，已永久 quarantine 并标为 consumed，绝不作为训练证据 |
| fresh CEM training | `93_010_001–93_010_008` | 完整 registered training 已完成并归档，永久标为 consumed，不得重跑 |
| independent selection | `93_100_001–93_100_024` | 完整 registered selection 已完成、归档并被 gate 否决；永久标为 consumed，不得重跑或复用 |
| roster final | `93_200_001–93_200_096` | sealed 且从未运行；本轮 selection 失败后不得解封 |

本轮 CEM 分支到此终止：生产继续保持 `video-strategy-v4-safe-recruit-health`，没有候选进入 `93_200`。下一轮不再只围绕 powerLevel 做大网格搜索，而采用以下事前约束：

1. 用同一套 `4` 个小步长 delta 参数化全部七个 profile，限制每个 delta 在预注册邻域内，避免针对单一 profile 形成独立的大搜索空间。
2. 参数搜索使用全新 training 区间，模型与门槛冻结后才揭示完全独立的 validation 区间；validation 不参与候选选择、阈值调整或追加样本。
3. training 只对候选做七 profile 联合替换（joint intervention）；训练结束后只冻结一个候选进入 validation，再评测一次 joint intervention 和七次仅替换一个 profile 的 single intervention，既量化整体效果，也分离 profile 自身收益与同桌外部性，且禁止在 validation 中择优；joint 的七档与每个 single 的焦点档都必须有真实策略决策分叉，零暴露不能作为非劣证据。
4. 优化目标以七 profile 宏平均为基础，并加入风险调整后的最差 profile 目标和明确的逐 profile 非劣约束；不能用一个 profile 的大收益抵消另一个 profile 的可靠退化。

`93_300_001–93_300_016` 与 `93_310_001–93_310_024` 只能作为下一轮 development / validation 的拟议命名区间：截至 2026-08-08，它们尚未写入 seed ledger、尚未注册或 reserved，也从未运行。只有新协议、实现、门槛、归档方案与 fail-before-game 测试全部冻结后，才能另行决定是否登记；本文不构成运行授权。

v4 安全守卫另有一条只用于 headless 的单座位反事实基准：每个 seed/scenario 先跑一局全 `legacy-v3`，再分别只把 `player-1..player-7` 中一个物理座位切到 `safe-v4`，其余座位保持 v3；正常 reducer、UI、存档和生产 `advanceHeadlessGame` 没有关闭安全守卫的开关。开发区间 `90_040_001–90_040_004` 覆盖 `neutral-v1` 与 `live-lobby-v1`，共完成 `64/64` 局、`56/56` 个原始 pair 和 `28/28` 个 seed/profile 逻辑配对，无失败、截断或平局。名次、前四率和吃鸡率差均为 `0`，四 seed 的 95% seed-cluster 区间也均为 `[0, 0]`。受控座位共遇到 `33` 次随从自伤候选，其中 `31` 次由已实现的伤害回溯观察者豁免，另外 `2` 次不会穿过安全底线；没有英雄技能自伤机会、底线穿越、致死风险或实际决策分叉。因此这批自然模拟触达了伤害投影路径，却没有触达 v4 与 v3 真正分叉的护栏，不能据此证明或否定对局强度变化，也不扩大到 24-seed promotion 门禁。v4 暂保留为经过七 profile 边界测试的 hard safety invariant；基准现在要求 legacy 原本要执行的下一动作确实被 v4 改写，单纯过滤一张本来不会选择的低分危险牌不算 treatment exposure，零实际决策分叉时即使其他统计门槛满足也会 fail closed。修正该口径后只在同一开发区间做了等价性复现，不把重复运行当成新的独立样本；结果逐项一致，当前 evaluator SHA-256 为 `dab8ca5fc3a4c2d351ac7ce941b3afbd34c13e6a698dfba1106a44855ba71333`。

反事实审查同时修正了两处投影语义：`War Drum` 只按当前回合尚未消费的真实饰品计数增加战吼次数，不再“持有即永久 +2”；将手牌中的 Soul Rewinder 打到场上时，也把它自身纳入本次 `afterFriendlyPlayed` 伤害的回溯观察者。benchmark override 绑定到本次克隆状态并由 `try/finally` 清理，且只接受 canonical `player-0..player-7` roster，避免同步重入或伪造大厅把 v3 行为泄漏到普通游戏。

## 证据到训练样本

优先把视频整理成小型“专家决策样本”，而不是直接从像素端到端训练。每条样本只记录公开可见信息：

- 补丁、回合、生命/护甲、金币、酒馆等级和升级费用；
- 当前战队、手牌、商店、可见对手快照和最近承伤；
- 候选计划，例如稳血、常规升本、速本、拿经济、保对子、转型或结束回合；
- 实际选择、解释、视频 BV 号与时间点、标注置信度；
- 哪些结论是画面事实，哪些只是工程推断。

首批高价值标签来自以下已复核视频：

- [8 分钟精通升本节奏](https://www.bilibili.com/video/BV13ozHYXEk6/)：常规、慢本和速本应由场面风险与经济条件切换。
- [1 分钟学会判断随从战力](https://www.bilibili.com/video/BV15jN3e8E6R/)：区分即时战力、经济和组合兑现，并把重伤作为重新评估节奏的信号。
- [酒馆战棋想赢必备的思维方式](https://www.bilibili.com/video/BV1NMB5YEELt/)：评估相对战力、未来计划、转型空间和有限对手信息。
- [前期抗住，万物转鱼人](https://www.bilibili.com/video/BV1TVnbzfEyQ/)：先用混合战力过渡，核心与支持件出现后再承担拆阵成本转型。

Bilibili 只提供策略和交互观察，不作为卡牌规则或数值权威。

2025–2026 的决赛/高分实战又补充了一组后期转化研究队列：[走位 3 回合，把控全场](https://www.bilibili.com/video/BV12tEC6mEkX/)、[杨梅杯决赛 R3](https://www.bilibili.com/video/BV1VXdcBwEuw/)、[黄金棋坛北京站决赛 R1](https://www.bilibili.com/video/BV1C8qSBiEEC/)、[中欧战棋邀请赛决赛第八场](https://www.bilibili.com/video/BV1nhpFzrEH6/) 和 [十三诗心龙强势站场](https://www.bilibili.com/video/BV1X3JL6UEyR/)。其中第一条已逐局面复核到“四人残局停五本、先查旧对手快照、再把资源用于即时购买与调位”；其余四条目前只把公开标题与赛事/阵容主题登记为待标注来源，不能据标题直接推导刷新、升本或转型阈值。

## 第一阶段：完整对局与动作级训练 seam 已完成

当前已经实现：

```text
createHeadlessGame(seed) -> GameState
advanceHeadlessGame(state) -> cloned next phase
```

它可以无真人、无假人地让 8 个 AI 运行至结束，并支持固定种子和全席位轮换。动作级环境位于 `lib/game/ai-training-environment.ts`：一个席位作为受控真人，其他七席继续使用当前 AI；受控动作复用现有 reducer，`END_TURN` 后由引擎自动完成另外七席招募和战斗。

```text
new AiTrainingEnvironment(seed, controlledSeat)
reset(seed, controlledSeat) -> observation
observe() -> privacySafeObservation
legalActions() -> revisionScopedOpaqueTokenActions
step(actionToken) -> { observation, legalActions, accepted, ownBattle, rewardSignals, done }
```

已经强制执行的关键约束：

- `observableState` 不得包含对手当前隐藏战队、手牌或 AI 本不应知道的精确共享池信息；
- 每个动作仍调用玩家共用的购买、出售、施法、上场、冻结和升级规则；
- reducer 通过 `gameTransition(...).accepted` 明确返回动作是否被接受；非法动作返回原状态并保持随机数和 trace 完全不变，不能用“返回了一个相同的新对象”冒充成功；
- 同一种子、席位和动作序列必须逐字节可重复；
- 非法动作由 `legalActions` 在边界处消除，而不是靠训练惩罚掩盖引擎错误；
- 观测使用显式 allowlist 和递归禁键测试，不泄露 `seed`、随机数状态、精确共享池、其他六场战斗或对手当前手牌/商店/战队；动作所需的实例 ID 保留在环境内部，模型只看到当前状态版本有效的 opaque token、区域和索引，旧 mask 的 token 会被拒绝；
- 允许纯 7/8 AI 对局在没有人类玩家时继续到结束。

默认 `legalActions` 继续以“有界候选枚举 + 真实 reducer 裁决”优先保证正确性；同一 state revision 的 mask 会缓存，fork 直接克隆当前状态。planner 专用 mask 排除其评分尚未使用的 `MOVE_MINION`，并复用引擎已有的费用、容量、合法目标和磁力查询走无副作用快速路径；固定 seed 的线性 walker 会在每个 revision 先构造 fast mask，再与 reducer mask 的动作描述和顺序逐项比较。每步另报告是否跨过私有 RNG 边界，但不暴露 RNG 值。动作在执行前被保守分为 deterministic、replan、terminal 和 unsupported；replan transition 不执行动作，也不返回 environment 或 observation，调用者把 token 提交给真实 episode 后必须重新规划。这样刷新、随机生成、发现和可能带随机触发的购买不再被永久剪枝，也不能偷看 counterfactual 随机结果。`scripts/benchmark-ai.ts` 继续负责完整大厅名次、前四率、吃鸡率和策略诊断；中性训练/基准环境尚未自动处理英雄、饰品和异常选择。

2026-08-01 的 v2 端到端诊断明确阻止了直接上线 planner：seed `0x8b10` 的完整候选曾用时约 116.8 秒，缩小预算后仍约 28.9 秒，而且刷新被结构性剪枝、五个 profile 的升本价值为零、满场时会囤手牌。planner v3 修复了这些机制问题，并把单 seed 七席完整评测降到十几秒量级；但在当时正式策略修复之前的 evaluator 快照 `bf338145…abc3e` 上，12 个独立 seed、84 个部署席位配对的结果仍明确拒绝策略替换。候选平均名次差 `+0.2976`（正数更差），95% 区间 `[-0.0341, +0.6293]`；前四率差 `-0.0119`；吃鸡率差 `-0.0952`，95% 区间 `[-0.1399, -0.0505]`。所有 runner、动作、边界和重规划完整性计数均为零，所以这是策略质量否决，不是基础设施故障。它继续保留为训练与正确性 seam，实际七名 AI 仍走现有强规则策略；当时正式策略升级为 `video-strategy-v3-certified-replacements`，仅修复已持有实体的对子自计数、普通金色/磁力三连误值和满场先卖后买的破坏性边界，不等同于接入 planner。当前 v4 版本与本轮未部署的逻辑回归结果见文首终态。

`scripts/benchmark-ai-recruit-planner.ts` 已把后续判断固定为部署席位成对评测：每个 seed 只跑一场未轮换基线，再逐个替换正式七席；每席保留精确名次或截断区间，七席先在 seed 内等权聚合，然后计算 seed-cluster 95% 置信区间。输出包含完整 profile、内容/策略/planner/environment 版本、配置和 evaluator/profile hash；长跑结束会重算 evaluator hash，源码中途漂移、任一 incomplete plan、拒绝动作、缺失 pair、平局或 runner failure 都会自动否决。默认单 seed 只用于诊断，绝不会满足 24-seed 接受门槛。

## 第二阶段：先优化现有可解释策略

在深度强化学习之前，先对现有权重做进化搜索或坐标搜索。这与当前实现最匹配，样本效率高，结果仍可审计。

1. 将 `AiStrategyProfile` 的数值权重序列化为候选参数。
2. 每代在固定训练种子、七种席位轮换和多个对手策略快照上自博弈。
3. 以最终名次为主目标，生命安全、未花金币和非法/空场行为只作约束或很小的塑形项。
4. 保留若干历史强策略组成对手池，避免七个策略一起退化到只会克制当前版本。
5. 只在从未参与搜索的留出种子上决定是否接受新权重。

首个自动化切片已经落地：`scripts/search-ai-policy.ts` 对单个 `AiStrategyProfile` 数值参数做只读坐标搜索，候选只在同步评测作用域内覆盖，不会修改默认权重。训练种子与留出种子强制不重叠，每个基础种子覆盖 8 个席位，并按 `(seed, rotation)` 做成对名次比较和 seed 聚类置信区间。逐局记录对已淘汰玩家保留精确名次，对截断时仍存活的玩家只记录 `[1, 存活人数]` 区间，不伪造最终名次。

首版接受门槛故意严格：默认至少 24 个独立留出种子，两臂所有计划对局都必须有同一个 schedule key、无引擎平局，并覆盖完整的名次区间证据。平均名次采用“候选最坏名次减基线最好名次”，至少改善 0.10，双侧 95% seed-cluster 区间必须完全优于零；前四率与吃鸡率同样采用“候选下界减基线上界”的置信区间做非劣保护。

首个 96-seed 固定候选确认已经给出负结果，而不是上线许可。`powerLevel.upgradeRoundOffset -1→0` 在全新 `51001–51096`、每臂 768 局中把平均名次改善 `0.9557`，95% 区间 `[-1.1120, -0.7995]`，并把前四率提高 `21.48` 个百分点；但吃鸡率差的 95% 区间下界为 `-3.0585` 个百分点，略低于事前固定的 `-3.00` 个百分点非劣门槛，所以 `accepted=false`，默认值不变。该确认不与此前 24-seed 探索结果合并，也不追加样本；下一轮应先在新训练种子上设计能保留稳血收益并改善决赛转化的新候选，再锁定另一个从未看过的最终留出集。

下一轮开发筛选在查看新数据前固定为三个互斥候选，均以 `upgradeRoundOffset=0` 为基础，但只增加一种后期转化行为：`offset0-scouted-shield-break-v1` 把 `scoutingWeight` 从 `0.45` 提到刚好开启已观察圣盾嘲讽破盾站位的 `0.5`；`offset0-safe-tier6-v1` 只在有效生命至少 24、满场、升本后仍有 3 金、最弱随从至少 14 分且没有即时商店/法术提升时提前一回合上六；`offset0-tier6-refresh-v1` 只在六本、满场且有效生命至少 14 时增加一次刷新上限。三项不互相组合，线上默认新增字段均为零。

`30100001–30100064` 的首次正式训练进程在约 8.9 秒后被外部中断，没有 stdout、指标或 artifact；即使中断前可能计算了少量 baseline，对其内容也没有任何观察。该范围因此以 `aborted-unobserved` 永久记为 consumed：不构成证据、不合并到任何结果，也不得重跑或用于候选选择。

该次中断的不可变审计记录如下；时间均为 UTC，`stdout` / `stderr` 专指应用进程输出，不把工具控制通道的中断标记算作应用输出。

| 字段 | 审计值 |
| --- | --- |
| Attempt ID | `power-level-offset0-final-conversion-screen-30100001-attempt-20260801T142327Z-v1` |
| 原注册 ID | `power-level-offset0-final-conversion-screen-30100001-v1` |
| 原固定区间 | `30100001–30100064`；64 个 seed clusters；baseline、A、B、C 各 512 局；`maxRounds=100` |
| 精确应用 CLI | `node --experimental-strip-types scripts/search-ai-policy.ts --training-screen --expected-protocol-hash 85fd1ae26ddbeb26c6f5498c757012a3d53977ba56903b5fa80ad3fedc055209` |
| Protocol hash | `85fd1ae26ddbeb26c6f5498c757012a3d53977ba56903b5fa80ad3fedc055209` |
| Search evaluator hash | `a67b741681fff2166c40c1dd5c873b01185fb7286b3e269452fadf082058b62c` |
| Benchmark evaluator hash | `10f089d01ef7226e77c63fb41b458ff79a9551258617d323c37a883a9b52dc98` |
| Content snapshot hash | `aefc2bba98b65da81f88190b9b1e2b2aba2216c24fc9e48c388943013058e817` |
| Live baseline profile hash | `c9488d3eaf97e25a5026354f9a07f7579e4733158ff13122d411487e17366051` |
| Candidate A profile hash | `dc22c93ef32b9f7beaefa8dd439a016f2ccf6b0f03fb1885f33f937e3701c8b4` |
| Candidate B profile hash | `7974e0452d3dbfae17df15df2f895e03ec19f47052fef4efd615f591dcf31bc8` |
| Candidate C profile hash | `b699b309198a251ed9163c1dda86b3e70b027f6ad4f76cf7b2822b79e495f8a9` |
| 工具调用时间 | `2026-08-01T14:23:27.550Z` |
| 中断标记时间 | `2026-08-01T14:23:36.429Z` |
| 已观察持续时间 | 约 `8.879 s` |
| 进程死亡确认时间 | `2026-08-02T02:15:14.996Z` |
| 中断来源 | 外部 user/session 中断 |
| 应用 stdout / stderr | `0 / 0`；工具控制通道仅有 abort marker |
| 终态 JSON | `false` |
| Artifact | `none` |
| Callback / raw result path | `none / none` |
| PID / exit code | `unavailable / unavailable` |
| 死亡确认 | 确认时没有存活的子进程 |
| 结果状态 | `outcome-unobserved`：没有可解释或可复用的对局、指标、候选资格或排名证据 |
| 对策略流程的影响 | 运营遥测没有改变候选、门槛或排序；没有候选被选择，也没有结果被合并 |
| 区间处置 | 任何正式运行一旦中断，整段区间都视为 consumed；`30100001–30100064` 永不重用 |
| 下一块机械选择 | `30200001–30200096` 已保留给确认，因此下一训练块机械选择 `30300001–30300064`，不依据未观察结果作判断 |
| 保护边界 | Seed ledger 只保护 benchmark / training API；通用核心 `createHeadlessGame` 不作密码学封锁，不能把 ledger 声明误读为全引擎不可达保证 |
| 303 启动前检查 | 自 registration patch `2026-08-02T02:18:49.391Z` 起，固定审计 18 个 session files（317,830,037 bytes；92,231 complete；0 invalid；0 partial）；22 个含 303 token 的 tool call 均为 patch/search/read，`node`、`npm`、`createHeadlessGame`、正式 CLI、registered-call 均为 0，当前进程与 outputs 也没有 303 执行；该检查不授权运行 |

迁移后的固定训练范围为 `30300001–30300064`，注册 ID 为 `power-level-offset0-final-conversion-screen-30300001-v1`；仍是 64 个 seed clusters、每个 8 席位轮换、`maxRounds=100`，线上 baseline 只跑一次，三个候选各跑完整 512 局，不中途淘汰。训练资格要求零平局/截断/缺失且 provenance 稳定，平均名次差不高于 `-0.10` 且 95% 区间上界低于零；为避免再次贴线，前四率与吃鸡率区间下界分别至少为 `-0.01 / -0.02`。多名合格时按“名次区间上界更低、吃鸡区间下界更高、前四区间下界更高、candidate ID 字典序”固定排序，只选第一名。无人合格即停止。`30200001–30200096` 继续保持 sealed 且尚未执行；只有训练选出并冻结完整候选后，才能将其注册为一次 96-cluster 确认。正式门槛仍为名次改善至少 `0.10` 且区间上界低于零、前四/吃鸡区间下界不低于 `-0.02 / -0.03`。失败后不追加、不换区间、不合并历史结果、不重复同一候选。

### 303 正式训练终态（2026-08-02）

`303` 已通过一次性 Windows Task Scheduler worker 完整执行，未发生会话中断或重试。启动前先从通过 typecheck 和 113 项 AI 聚焦测试的共享源码复制 43 个运行文件到外部只读快照；复制前后逐文件一致，快照 manifest SHA-256 为 `d3df9b1d6d9f61155e30e80b45d83e0e81f2ecb188f0865b1dae2eb15b37fcee`。任务定义读回检查固定了绝对 PowerShell/worker/快照/Node 路径、当前交互身份与 Limited 权限、`IgnoreNew`、零重启、无限执行时限、无触发器，以及不因 idle/battery 停止；定义 XML SHA-256 为 `43c1fa8e2fe018bead1ca6352f09ca3aea7fa217c2261dd766aa126195dd08d1`。正式任务在 `2026-08-02T03:59:39.953Z` 唯一启动，`2026-08-02T03:59:41.674Z` 创建不可删除的 registration 级 claim，并在 `2026-08-02T04:23:57.124Z` 成功发布终态，scheduler exit code 为零；完成后的任务已禁用，claim 永久保留。

本次运行绑定 protocol `d8504aefae2e2ea0a7a8d3a3194d9eb0e63cfa990001dd4f1104d74bf455118a`、worker/entry/registration/ledger/benchmark/Node 基础设施指纹 `762d7a47ff1771ad3ce97723dca64c2894be9805586389c38331227995c29f40`、content `aefc2bba98b65da81f88190b9b1e2b2aba2216c24fc9e48c388943013058e817`、benchmark evaluator `0fa821273df7e22a3c68f26494321eb4c2e533327b26b45efe0b275db30d5dff`、search evaluator `691f48ae36b9c8f7603f740347421852da7caff3678c5c802e6f350c1093f9d8` 与 live profile `c9488d3eaf97e25a5026354f9a07f7579e4733158ff13122d411487e17366051`。所有前后 hash、profile binding、protocol、content、evaluator、Node 与基础设施稳定性检查均为 true，`selectionEvidenceUsable=true`，终态 `result.json` SHA-256 为 `6c98fbf001213f3afee22c3dc0372c63ea7a61374862393b6379af83d2709c60`。这里的 evidence usable 只说明完整审计可信，不代表有候选通过资格门槛。

四臂各完成 512 局，均无截断；baseline 出现 1 局 draw，三个候选均为零 draw。baseline 的平均名次、前四率和吃鸡率分别为 `4.9844 / 37.50% / 11.13%`。候选的保守成对结果如下；百分点区间均为 95% seed-cluster 区间：

| 候选 | 平均名次 | 名次差及 95% 区间 | 前四率；差及区间 | 吃鸡率；差及区间 | 资格 |
| --- | ---: | --- | --- | --- | --- |
| A `offset0-scouted-shield-break-v1` | 4.0449 | `-0.939453`；`[-1.134200, -0.744706]` | 59.18%；`+21.6797pp`；`[+16.4783, +26.8811]pp` | 13.28%；`+2.1484pp`；`[-1.5687, +5.8656]pp` | false |
| B `offset0-safe-tier6-v1` | 4.0469 | `-0.937500`；`[-1.132487, -0.742513]` | 59.18%；`+21.6797pp`；`[+16.4783, +26.8811]pp` | 13.09%；`+1.9531pp`；`[-1.7500, +5.6562]pp` | false |
| C `offset0-tier6-refresh-v1` | 4.0371 | `-0.947266`；`[-1.144608, -0.749923]` | 59.38%；`+21.8750pp`；`[+16.6808, +27.0692]pp` | 14.06%；`+2.9297pp`；`[-0.4915, +6.3508]pp` | false |

三项的唯一资格否决理由都是 `baseline must contain zero drawn games`。固定协议没有“忽略一局 draw”、只比较候选之间或选择点估计最佳者的例外，因此权威结果为 `selected=null`。`30300001–30300064` 已在共享 seed ledger 中以 `task-scheduler-one-shot-claim-created-formal-screen` 永久记为 consumed，不得重跑、追加、换 seed 后合并或把 C 事后提名；`30200001–30200096` 继续 sealed 且不得执行。线上 `powerLevel.upgradeRoundOffset` 保持 `-1`，A 的 `scoutingWeight=0.5` 与 B/C 的实验开关均不部署。本轮点估计可用于提出未来的新假设，但不能作为确认或上线许可；新的正式周期必须先解释/约束 draw 完整性，并预注册全新训练区间。

100/300 回合诊断发现，少量大厅会在只剩两名 AI 后长期互相打不掉血；此时目标策略往往早已淘汰并拥有精确名次，简单要求整个大厅 `gameOver` 会错误丢弃有效样本。搜索器因此不把存活者填成某个虚假排名，也不使用完成局子集，而是使用上述 partial-identification bounds；只有最不利解释也过线才允许接受。

**draw 根因已修复**（`2849ed6`）：`simulateBattle` 中第 61 回合起每回合额外递增 1 点战斗伤害（`damage += max(0, round - 60)`），确保任何大厅终会结束。下一训练周期（304）需将 `maxRounds` 从 100 提升至 150，在 `ai-training-screen-registration.ts` 中更新 `startSeed`/`maxRounds`/ID，并同步 `benchmark-ai.ts` 的预检断言。

`scripts/ai-policy-artifact.ts` 已能把一次基准、完整七策略 profile、训练/留出 schedule、接受证据、内容/策略/evaluator/profile hash 冻结成 canonical SHA-256 artifact。validator 会拒绝缺失或重复策略、hash 漂移、种子重叠，以及没有完整 24-seed 留出门禁却声称 `accepted=true` 的结果；它不会自动写历史池或修改 live policy。下一步是把多个已验证 artifact 组成真实对手池、加入简单 balanced 基线和只评一次的独立最终 gate；之后才能复用同一 evaluator 做多坐标或进化搜索。

Hearthstone 研究已表明，竞争式进化可以直接优化数据驱动代理；MCTS 加监督状态评估也能提高搜索质量和效率：[Optimizing Hearthstone Agents using an Evolutionary Algorithm](https://arxiv.org/abs/2410.19681)、[Improving Hearthstone AI by Combining MCTS and Supervised Learning Algorithms](https://arxiv.org/abs/1808.04794)。这些论文研究的是传统 Hearthstone，不应把其数值结果直接外推到酒馆战棋，但方法顺序具有参考价值。

## 第三阶段：两回合规划与有限模拟

把单步贪心升级为分层规划，而不是一开始枚举所有底层动作：

- 宏观动作：稳血、升本、拿经济、找核心、保三连、转型、结束；
- 微观动作：具体买牌、出售、施法、上场、刷新和冻结；
- 搜索：深度 2 的 beam search，先保留 6 至 10 个最高分序列；
- 评价：当前战力、下一回合资源、核心/三连可选性、预计伤害尾部风险、拆阵成本、循环位和浪费金币；
- 对手：只模拟最后实际观察到的阵容；旧快照使用保守成长区间，未知对手使用训练集分布，绝不读取隐藏当前状态。

战斗 Monte Carlo 的结果只是评价特征之一，不能单独替代血量、未来经济和成型概率。

当前 planner 仍不能直接导入 live engine：它依赖训练环境，而训练环境又依赖 engine reducer，会形成循环依赖；训练环境还把受控席映射为真人语义，计划末尾的 `END_TURN` 也不能在单席 `runAiRecruit` 内递归触发整轮结算。因此不再尝试导入它。独立的 residual port 已改为只包住正式策略的升本、单次刷新和最终冻结三个宏观布尔边界；合法性、生命安全、手牌/刷新/动作上限和实际 mutation 都留在 engine，未注册、弃权、低于 `0.90`、非法、异常或异步 proposal 全部回退。上下文带内容/策略版本和 checkpoint，但用严格 allowlist 排除 GameState、seed、RNG、共享池、runtime ID 与隐藏对手信息；无 provider 时连 context 都不构造，固定 seed 的完整状态与原策略逐字节相等。刷新、随机发现或随机生成继续作为“只执行当前动作、观察公开结果、随后重规划”的叶节点。

`scripts/ai-legacy-expert-rollout.ts` 现在可以把 `player-1` 至 `player-7` 的上述三个 legacy 宏观判断被动记录为行为克隆样本。recorder 始终弃权，所以正式动作仍由原策略执行；保留的每条 context 已经过 residual 边界的深冻结、精确字段校验和隐私禁键检查，标签直接使用 `legacyChoice`，合法动作使用 `legalChoices`。输出 bundle 不含调度 seed、运行时 player/instance/interaction ID、RNG 或共享池，只带版本、七个 profile、按 kind/profile 的计数、聚合评测摘要和 canonical SHA-256；原始 benchmark 结果被明确放在 bundle 外，防止训练数据误收 seed。固定 `0x5e01`、一回合的合同 smoke 记录了 295 次判断（升本 176、刷新 63、冻结 56），覆盖全部七个 profile，且与无 recorder 的 benchmark 逐字节相同。下一项关键工作是用这些轨迹和人工视频标签训练真正 provider，并先通过指定席位成对留出门禁；recorder 与 seam 本身都不构成部署许可。

## 第四阶段：模仿学习、bandit 与强化学习

数据量较小时，先用视频标签训练宏观动作分类器，或用 contextual bandit 学习“当前局面选哪类计划”。它可以作为 beam search 的先验，并继续由规则引擎保证动作合法。

等 headless 环境可以并行运行大量完整对局后，再评估 PPO、离线 RL 或其他 actor-critic 方法：

- 状态：公开局面张量、最近战果、观察过的对手快照、当前阵容信心；
- 动作：带合法动作 mask 的分层动作，不直接输出任意卡牌 ID 字符串；
- 主奖励：归一化最终名次；
- 塑形：小权重的战斗结果、资源浪费和致命风险，且必须验证没有改变最终目标；
- 训练：人口式自博弈与历史策略池，七席轮换；
- 部署：只提交确定性参数或模型文件，游戏运行时不访问视频或训练服务。

## 接受门槛

任何“AI 变强”结论至少满足：

- 训练种子与留出评测种子严格分离；
- 每个结果必须记录内容、策略、完整 profile 和 evaluator 源码哈希；同一实验两臂 hash 不一致或评测后工作树已漂移时，只能保留为历史快照，不能更新当前默认权重；
- 七个策略覆盖等量席位和起始商店分布；
- 报告平均名次、吃鸡/前四率、置信区间、截断率和每策略样本数；
- 至少 24 个独立留出 seed；计划对局必须无平局、无缺失 schedule key，截断存活者不得被填充成虚假名次，名次与比率的最坏情况区间必须通过门槛；
- 对当前已发布策略、历史策略池和至少一个简单基线分别比较；
- 通过全部规则、隐私、确定性、存档和 UI 回归测试；
- 没有空场、非法动作、隐藏信息读取或明显的奖励投机；
- 只有留出集改善且关键安全指标不退化时，才更新默认权重。

对受控 planner 的首个可辩护评测采用“部署席位成对替换”，而不是伪装成现有 benchmark 的 profile rotation：每个 seed 先跑一场未轮换的 8 bot 基线，再分别让 `player-1` 至 `player-7` 使用其原 profile 的候选 planner；同 seed、同物理席位配对，先把七席差值在 seed 内等权聚合，再对至少 24 个独立留出 seed 做置信区间。任何 incomplete plan、动作拒绝、超时或缺失席位都令整次门禁失败。当前 API 不能把同一个候选 profile 公平轮换到八个物理席位，因此不得把 `controlledSeat=s` 与 `rotation=s` 直接比较。
