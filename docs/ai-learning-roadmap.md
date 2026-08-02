# 七名 AI 的学习与自博弈路线

目标不是把公开视频硬编码成一套固定流派，而是把可复核的人类决策原则转成数据、评测和可迭代策略。当前引擎已经有确定性随机种子、共享玩家规则、七套软权重、可完成 8 bot 对局的阶段级 headless 接口，以及一个受控席位加七名现有 AI 的动作级训练环境；专家样本 schema、历史策略池、短程 Recruit planner、随机动作执行后重规划边界、部署席位成对门禁、高置信残差安全 seam 和七席 legacy 宏观专家 rollout 均已落地。v3 粗粒度 planner 已通过正确性与隐私验证但在 12-seed 诊断中显著降低吃鸡率，因此后续改为“现有强规则策略作专家与回退，只学习残差”，而不是继续扩大替代式搜索；当前 residual provider 为空，尚未部署任何学习候选。

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

2026-08-01 的 v2 端到端诊断明确阻止了直接上线 planner：seed `0x8b10` 的完整候选曾用时约 116.8 秒，缩小预算后仍约 28.9 秒，而且刷新被结构性剪枝、五个 profile 的升本价值为零、满场时会囤手牌。planner v3 修复了这些机制问题，并把单 seed 七席完整评测降到十几秒量级；但在本轮正式策略修复之前的 evaluator 快照 `bf338145…abc3e` 上，12 个独立 seed、84 个部署席位配对的结果仍明确拒绝策略替换。候选平均名次差 `+0.2976`（正数更差），95% 区间 `[-0.0341, +0.6293]`；前四率差 `-0.0119`；吃鸡率差 `-0.0952`，95% 区间 `[-0.1399, -0.0505]`。所有 runner、动作、边界和重规划完整性计数均为零，所以这是策略质量否决，不是基础设施故障。它继续保留为训练与正确性 seam，实际七名 AI 仍走现有强规则策略；正式策略自身现已升级为 `video-strategy-v3-certified-replacements`，仅修复已持有实体的对子自计数、普通金色/磁力三连误值和满场先卖后买的破坏性边界，不等同于接入 planner。

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
