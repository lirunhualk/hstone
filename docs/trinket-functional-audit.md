# 固定版本饰品功能审计

审计日期：2026-10-11。范围固定为炉石补丁 **36.0.3 / HearthstoneJSON build 247416 / zhCN** 的 204 件单人饰品，包含 98 件小饰品与 106 件大饰品。此记录核对仓库固定快照、卡面、实现分支和功能测试证据，不代表审计当日最新正式服。

[完整结构化记录](trinket-functional-audit.json) 保留每张卡的完整卡面、实现符号、测试路径、说明、初始状态与当前状态；下面按固定快照顺序列出全部 204 件。两个名称相同的层级版本按 CardID 分开记录。

## 状态与证据边界

| 当前状态 | 数量 | 含义 |
| --- | ---: | --- |
| reviewed / 已核对 | 182 | 已核对列出的源码与实际功能证据；不表示所有组合已测完，也不保证没有未知缺陷。 |
| bug / 确认缺陷 | 1 | 存在明确尚未修复的规则缺口。 |
| partial / 部分支持 | 21 | 根据下方分类区分实际实现缺口、间接取得内容未完整与专项验证不足。 |
| 合计 | 204 | 98 件小饰品、106 件大饰品；无重复、无遗漏。 |

`initialStatus` 保留原组记录；原记录缺字段时，仅对本轮明确先失败后修复的回归重建 `bug` 历史，其余回填当前状态。`initialStatusSource` 记录依据，避免将未记录的旧结论写成已知历史。当前保留 29 件初始缺陷记录，其中 28 件已修复并核对证据，1 件仍有缺口。

本轮新增 44 项饰品回归已通过，另核对了根代理对 42 类战斗饰品的副本结算规则。副厨师长的额外主动技能使用、金币返还和存档恢复，罪碑对酒馆法术/暗月奖品发现及金色锁手牌的复制，以及多种纪念品副本的独立计数、成长、召唤和保存批次已补回归。选择 smoke 仅证明入口能选中；它不能替代卡面功能验证。已有测试通过也没有证明全部英雄、随从、法术、触发顺序、重复饰品、满手、共享池、存档和 AI 组合完整。

## 剩余问题

**确认缺陷：古老的许愿叉骨（BG30_MagicItem_804）。** 黑荆棘的双倍宝石、伊莉斯/米尔菲丝/阿莱克丝塔萨的主动发现次数已接入倍率；伊莉斯真实两次发现回归已通过且只扣一次费用和使用次数。迦拉克隆仍没有在第一次替换后，按新实体和新等级继续第二次升级发现，因此该饰品仍不能标记为完整无缺陷。JSON 中保留旧说明，当前说明明确取代旧“伊莉斯仍失败”的结果。

| 部分支持分类 | 数量 | 具体边界 |
| --- | ---: | --- |
| 源码实现缺口 | 2 | 小饰品「赶潮纳迦肖像」与大饰品「惊喜肖像」仍有未覆盖的法术家族或后续获取机制。 |
| 间接取得内容未完整 | 12 | 包含伙伴、恩佐斯的鱼、无面操纵者、跳蛙、砰砰的怪物、混合体、摩戈尔、时空扭曲候选，以及仍可随机取得上述内容的未知宝珠；获取身份正确不等于赠送牌效果完整。 |
| 缺专项验证 | 7 | 祝福、沙锤手、民谣歌手、魔焰肖像的关键行为，以及游学者卷轴、舒适的棺椁、蓝鳃脚蹼的战斗自动施法触发归属，仍需专项验证；未复现的边界不能当成确认缺陷。 |

大型老旧烛台的固定成本 2 来源为 41 种，小型为 25 种。旧组说明中的大型“21”已纠正，并保留在 JSON 的 `previousNotes`。2026-10-14 的[时空扭曲审计](timewarp-functional-audit.md)接入大型 16 种、小型 12 种；新发现仅抽取完整且匹配本局种族的候选。其余来源保留部分支持，跳蛙骑士肖像不进入新报价或随机饰品候选。

## 离线校验与重跑

```powershell
node scripts/check-trinket-functional-audit.mjs
node scripts/check-trinket-functional-audit.mjs --test
```

默认检查固定快照身份、卡面一致性、204 件唯一覆盖、98/106 层级计数、合法状态、非空实现/测试证据及仓库内测试路径。`--test` 使用当前 Node 的内置类型剥离运行全部 `tests/trinket-*.test.ts`，并透传测试退出码；它不会联网或修改快照。已记录的缺陷允许保留在清单内，默认检查成功不表示缺陷已修复。

## 全部 204 件

| # | 层级 | 饰品 / CardID | 完整卡面 | 当前结论 | 精简说明 | 功能证据 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 小 | 永恒肖像<br>`BG30_MagicItem_301` | 获取一张永恒骑士。战斗开始时：使你的永恒骑士获得嘲讽和复生。 | 已核对 | 获取真实永恒骑士；开战只为既有骑士赋予嘲讽/复生，战斗副本不永久写回。已有获取及战斗事件测试。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 2 | 小 | 自动机肖像<br>`BG30_MagicItem_303` | 战斗开始时：当你有空位时，召唤一个星元自动机。 | 已核对 | One summon per combat; a full warband waits for the first opening. Summon and wherever-st… | [专项](../tests/trinket-combat-effects.test.ts) |
| 3 | 小 | 鬃尖笔墨套装<br>`BG30_MagicItem_410` | 复仇（3）：在本局对战中，你的鲜血宝石使随从额外获得+1生命值。 | 已核对 | 复仇3逐次提高宝石生命；进度仅当前战斗，成长写回拥有者，幽灵隔离且提图斯不倍增复仇计数。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 4 | 小 | 猪猪储蓄罐<br>`BG30_MagicItem_411` | 战斗开始时： 使你的野猪人获得“亡语：获取2张鲜血宝石。” | 已核对 | 开战为野猪人记录额外亡语；实际触发各给2宝石，满手烧牌，提图斯倍率走亡语链。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 5 | 小 | 古神信物<br>`BG30_MagicItem_416` | 塑造法术：选择一个随从，将其变形成为你另选的高一级的随从。 | 已核对 | Exact higher-tier shared-pool choice, target replacement, player/AI synchronous choice, f… | [专项](../tests/trinket-putricide-old-gods.test.ts) |
| 6 | 小 | 麦迪文之书<br>`BG30_MagicItem_420` | 发现一张 酒馆法术牌。在每个回合开始时，再发现一张。 | 已核对 | 获取时和每回合开始各发现1张不高于酒馆等级的法术；排队选择与JSON恢复覆盖，AI同步选择，发现不占法术共享池。 | [专项](../tests/trinket-book-of-medivh.test.ts) |
| 7 | 小 | 游学者卷轴<br>`BG30_MagicItem_422` | 每当你对一个随从施放法术时，使其获得+4/+4。 | 待验证触发边界 | 招募定向施法已覆盖；战斗自动对随从施法缺对应饰品分支。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 8 | 小 | 旅店老板的酒杯<br>`BG30_MagicItem_423` | 每当酒馆刷新时，会额外提供一个更高等级的随从。 | 已核对 | Extra exact next-tier offer on a real refresh; normal maximum Tavern Tier is respected. A… | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 9 | 小 | 艾泽拉斯星球仪<br>`BG30_MagicItem_425` | 每两个回合，在回合开始时获得2枚铸币并发现一个等级6的随从。（还剩2回合！） | 已核对 | 获取时不立即奖励；每两个招募回合开始+2金币并发现6级随从，重置计数并循环；发现候选按共享池预留。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 10 | 小 | 多彩罗盘<br>`BG30_MagicItem_426` | 随机获取一张与你战队相符类型的随从牌。在每个回合开始时，再获取一张。 | 已核对 | 初始/每回合获取1匹配主流类型随从，读取当前战隊；共享池抽取，空池/满手处理走统一获取路径。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 11 | 小 | 摇滚音乐盒<br>`BG30_MagicItem_430` | 随机获取一张 战吼随从牌。在每个回合开始时，再获取一张。 | 已核对 | Immediate and each turn-start Battlecry card, tier and active-tribe filtering, pool debit… | [专项](../tests/trinket-simple-effects.test.ts) |
| 12 | 小 | 大教堂模型<br>`BG30_MagicItem_434` | 每个回合你的第一个法术会额外施放一次。 | 已核对 | 每回合第一个法术额外施放1次，覆盖宝石、塑造抉择、酒馆法术和发现续链；轮次编码计数避免跨回合错误保留。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 13 | 小 | 点金补给<br>`BG30_MagicItem_435` | 每3个回合，在回合结束时，获取一张点金术。（还剩3回合！） | 已核对 | 获取当回合算第1个结束回合，每3个回合给1张点金术；计数在玩家饰品字典跨回合保留。 | [专项](../tests/lobby-systems.test.ts) |
| 14 | 小 | 天灾之杖<br>`BG30_MagicItem_437` | 复仇（5）： 随机使一个友方亡灵获得复生。 | 已核对 | Exactly five friendly deaths; eligible living Undead without Reborn selected. Deathrattle… | [专项](../tests/trinket-combat-effects.test.ts) |
| 15 | 小 | 诺米标签<br>`BG30_MagicItem_544` | 在你使用一张元素牌后，使酒馆中的元素在本局对战中获得+2/+2。 | 已核对 | 每次真实使用元素或全部类型随从，使当前及未来酒馆元素永久+2/+2；不是购买触发，永久类型增益进入状态。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 16 | 小 | 舒适的棺椁<br>`BG30_MagicItem_547` | 在你施放一个酒馆 法术后，你的亡灵在本局对战中拥有+1攻击力 （无论它们在哪）。 | 待验证触发边界 | 招募亡灵全局攻击已覆盖；战斗内酒馆施法未覆盖相同增长。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 17 | 小 | 死亡护命匣<br>`BG30_MagicItem_700` | 发现一个亡语随从。每场战斗中你的第一个亡语额外触发一次。 | 已核对 | Deathrattle Discover and first triggered friendly Deathrattle extra execution; per-combat… | [专项](../tests/trinket-combat-effects.test.ts) |
| 18 | 小 | 神秘魔方<br>`BG30_MagicItem_703` | 免费从2个新的小型饰品中选择一个以替换本饰品。在每个回合开始时，重复此效果。 | 已核对 | 获取后免费二选一替换；之后先结算当前饰品回合开始效果，再重复替换；alias独立持久化，AI同步选择。 | [专项](../tests/trinket-mystery-cube-kaleidoscope.test.ts) |
| 19 | 小 | 调酒机器人的油壶<br>`BG30_MagicItem_705` | 升级酒馆所需的铸币减少（3）枚。在每个回合开始时，重复此效果。 | 已核对 | 购买即降低升本费用3，以后每回合再降低3；到最高等级不累积；共享玩家/AI升本费用函数。 | [专项](../tests/lobby-systems.test.ts) |
| 20 | 小 | 映像吊坠<br>`BG30_MagicItem_706` | 获取一个随机友方随从的一张原始版复制。在每个回合开始时，重复此效果。 | 已核对 | Random board source produces non-golden plain identity, no enchantment/attachment copy. A… | [专项](../tests/trinket-simple-effects.test.ts) |
| 21 | 小 | 提克特斯标签<br>`BG30_MagicItem_707` | 发现一个等级3的暗月奖品。每三个回合，在回合开始时，重复此效果。（还剩3回合！） | 已核对 | 获取时发现3级暗月奖品，之后每3回合开始重复；候选与排队计数可恢复，AI自动选择施放，满手有烧牌边界。 | [专项](../tests/trinket-darkmoon-prizes.test.ts) |
| 22 | 小 | 泣血之心<br>`BG30_MagicItem_713` | 在8个友方随从 死亡后，随机获取一张亡灵牌。（还剩8个！） | 已核对 | 8友方死获取亡灵；已独立验证4死+下次4死跨战斗累计，满手触发消耗进度，生成牌受等级/开放种族限制。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 23 | 小 | 古老的许愿叉骨<br>`BG30_MagicItem_804` | 你的英雄技能会触发两次。 | 确认缺陷 | 迦拉克隆的第二次顺序升级发现仍缺失；其他已修主动发现不能证明本饰品完整。 | [专项](../tests/trinket-high-coupling-effects.test.ts) +1 |
| 24 | 小 | 鱼的肖像<br>`BG30_MagicItem_821` | 获取一张恩佐斯的鱼。 | 间接内容未完整 | 获取恩佐斯的鱼正确；复制不同友方亡语的赠送牌能力仍部分支持。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 25 | 小 | 辐光护手<br>`BG30_MagicItem_841` | 酒馆中的随从拥有+3/+3。酒馆中始终会有7张牌。 | 已核对 | 已在本轮之前修补购买随从/法术、吞食、偷取后补至7总报价；保留原报价/冻结/属性；满手失败及空共享池原子处理有6新增测试。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 26 | 小 | 地精钱包<br>`BG30_MagicItem_847` | 在每个回合 结束时，你的铸币上限提高1枚。 | 已核对 | growMaxGold count 1 occurs at end, multiplied by end-of-turn repetition; maxGold persists… | [专项](../tests/lobby-systems.test.ts) |
| 27 | 小 | 回溯者肖像<br>`BG30_MagicItem_868` | 获取一张灵魂回溯者和一张愤怒编织者。你的灵魂回溯者还会获得攻击力。 | 已核对 | 获取灵魂回溯者与愤怒编织者；每个灵魂回溯者按对应生命成长额同时获得攻击，金色倍率逐源结算。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 28 | 小 | 纪念品货架<br>`BG30_MagicItem_888` | 当你购买大型饰品时，本饰品变形成为它的复制。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-high-coupling-effects.test.ts) +1 |
| 29 | 小 | 旅途兑换券<br>`BG30_MagicItem_891` | 2回合后，选择一个大型饰品并购买以替换本饰品。（还剩2回合！） | 已核对 | Two starts after acquisition produce four greater choices, payment replaces vouchers, nor… | [专项](../tests/trinket-high-coupling-effects.test.ts) |
| 30 | 小 | 滑翔龙翼<br>`BG30_MagicItem_900` | 每当你使用一张牌时，使一条友方的龙获得+4/+4。 | 已核对 | 每次真实使用任意牌随机强化友方龙+4/+4，包括法术；没有龙时不造目标，全部类型识别，失败使用不推进。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 31 | 小 | 神圣重槌<br>`BG30_MagicItem_902` | 战斗开始时：使你最左边和最右边的随从获得圣盾。 | 已核对 | 准确物理最左/最右各圣盾；单随从去重，同一实体已有盾保持，战斗临时副本。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 32 | 小 | 鱼人语实用手册<br>`BG30_MagicItem_914` | 在你使用一张随从牌后，使你手牌中最左边的随从牌获得+3/+3。 | 已核对 | After an actual minion play and its Battlecry, only the leftmost remaining hand minion re… | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 33 | 小 | 锈蚀的三叉戟<br>`BG30_MagicItem_917` | 战斗开始时：使你的纳迦获得“亡语：随机获取一张塑造法术的法术牌。” | 已核对 | 开战时只给当时纳迦临时附加获取塑造法术亡语；死亡真实生成牌入持久手牌，提图斯逐次结算，幽灵不写原玩家。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 34 | 小 | 藏宝海湾美酒<br>`BG30_MagicItem_924` | 每当你花费铸币时，使一个友方海盗获得+4/+3。 | 已核对 | 每真实花费金币的交易只触发1次，随机友方海盗+4/+3；零费用/失败交易不触发，所有费用共享spendGold。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 35 | 小 | 幸运猫咪<br>`BG30_MagicItem_931` | 在7个友方随从死亡后， 随机获取一张野兽牌。（还剩7个！） | 已核对 | Seven-death threshold repeats, fourteen-death chain yields two real Beast rewards; genera… | [专项](../tests/trinket-combat-effects.test.ts) |
| 36 | 小 | 随从诱饵<br>`BG30_MagicItem_973` | 每当酒馆刷新时，总会额外提供2个 与你战队相符类型的随从。 | 已核对 | 每次真实酒馆刷新按战队代表类型追加2个池内随从；空战队不造类型，活跃种族和池余量限制，补位不误算手动刷新。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 37 | 小 | 达拉然之眼<br>`BG30_MagicItem_981` | 每当一个没有类型的友方随从死亡时，随机获取一张酒馆法术牌。 | 已核对 | 无类型死亡触发随机酒馆法术；typed被排除，满手报告失败，幽灵隔离使用persistentCombatOwner。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 38 | 小 | 野猪之神标签<br>`BG30_MagicItem_988` | 获取3张鲜血宝石。你的鲜血宝石使随从额外获得+2/+1。 | 已核对 | Three acquisition gems and global +2/+1 Blood Gem scaling; future/held gems read player c… | [专项](../tests/trinket-simple-effects.test.ts) |
| 39 | 小 | 尤格糕点<br>`BG30_MagicItem_994` | 转动尤格-萨隆 的命运之轮。在每个回合开始时，再次转动。 | 已核对 | 获取与每回合开始使用同一7项固定转盘；结果的英雄技能倍率、奖品、吞噬、金色报价与属性重分配均有实际状态测试。 | [专项](../tests/trinket-yogg-tags-pauldrons.test.ts) |
| 40 | 小 | 鲍勃摇头玩偶<br>`BG30_MagicItem_998` | 获得2枚铸币。酒馆中不会再提供等级1和等级2的牌。 | 已核对 | 初始金币+2、酒馆后续报价排除1/2星（含随从/法术）；普通刷新专项验证。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 41 | 小 | 法术扳手<br>`BG32_MagicItem_170` | 在你使用一张磁力随从牌后，随机获取一张酒馆法术牌。 | 已核对 | A played Magnetic minion grants a random Tavern Spell whether merged or independently pla… | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 42 | 小 | 华丽的时钟<br>`BG32_MagicItem_271` | 获得2枚铸币。在下个回合购买你的大型饰品，而非第9回合。 | 已核对 | 立即+2金币，下一回合给大饰品选择；已有大饰品后第9回合不会重复购买，获取轮次counter与待选择可恢复。 | [专项](../tests/trinket-high-coupling-effects.test.ts) |
| 43 | 小 | 神秘墓碑<br>`BG32_MagicItem_276` | 在每个回合结束时，你的亡灵在本局对战中拥有+2攻击力（无论它们在哪）。 | 已核对 | 每结束回合全局亡灵攻击+2，达卡莱重复计入；当前手牌/场上及以后生成/购买共享全局增益。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 44 | 小 | 普崔塞德标签<br>`BG32_MagicItem_300` | 制造一个自定义的亡灵。每2个回合，在回合开始时，重复此效果。（还剩2个回合！） | 已核对 | Two three-option combat/utility component selections produce an exact non-tripling custom… | [专项](../tests/trinket-putricide-old-gods.test.ts) |
| 45 | 小 | 黄金残片<br>`BG32_MagicItem_350` | 当你拥有15枚铸币时，随机获取一张等级5的金色随从牌。（每局对战限一次） | 已核对 | 金币到15时一次性生成5级金色牌；触发标记先消费，满手不会重复刷奖励，生成牌无共享池所有权。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 46 | 小 | 怨毒熏香<br>`BG32_MagicItem_360` | 战斗开始时：使你最左边和最右边的亡灵获得复生。 | 已核对 | 按亡灵序列取最左/最右而非战队物理边缘；已具有复生者占据对应边缘，单亡灵去重。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 47 | 小 | 口袋工厂<br>`BG32_MagicItem_361` | 发现一张等级4的具有类型的随从牌。在每个回合开始时，再获取一张它的复制。 | 已核对 | Exact typed Tier 4 Discover, remembers chosen definition for plain copies each start; sav… | [专项](../tests/trinket-discover-rewards.test.ts) |
| 48 | 小 | 异变神龛<br>`BG32_MagicItem_400` | 随机将你的 所有随从变形成为等级4的随从。 | 已核对 | 逐个将整队替换为准确4级池内随从；旧副本归池、保持实体位置，重算拥有者成长及三连；不是出售触发。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 49 | 小 | 战鼓<br>`BG32_MagicItem_416` | 每回合中，有一个战吼会额外触发两次。（还剩1个！） | 已核对 | 每回合首个战吼额外2次，独立每回合计数；普通/金色及铜须倍率同一触发入口。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 50 | 小 | 磨损的藏宝图<br>`BG32_MagicItem_428` | 两回合后，获得10枚铸币。（每局对战限一次） | 已核对 | Pays +10 only on second subsequent start; counter saturates at 2, preventing repeated rew… | [专项](../tests/trinket-simple-effects.test.ts) |
| 51 | 小 | 金刚鹦鹉肖像<br>`BG32_MagicItem_803` | 获取一张巨大的金刚鹦鹉。你的巨大的金刚鹦鹉还会触发你的最左边的战吼。 | 已核对 | 获取完整金刚鹦鹉；进击同时触发其他随从最左亡语与最左战吼，金色进击次数及战吼/亡语倍率走共享战斗路径。 | [专项](../tests/trinket-monstrous-macaw-portrait.test.ts) |
| 52 | 小 | 血缚耳环<br>`BG32_MagicItem_808` | 在你施放4个法术后，本饰品对你的所有随从各使用一张鲜血宝石。（还剩4个！） | 已核对 | 已新增战斗施法监听；招募与战斗均按副本累计4法术后对全部存活战队各施放1宝石，代码路径复核；招募阈值既有专项通过。未穷尽全部自动法术组合。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 53 | 小 | 伦德尔标签<br>`BG32_MagicItem_817` | 偷取酒馆中 等级最高的牌。在每个回合结束时，重复此效果。 | 已核对 | Includes Tavern minions and spells in highest-tier comparison; exact acquired entity pres… | [专项](../tests/trinket-simple-effects.test.ts) +1 |
| 54 | 小 | 朝圣小鬼标签<br>`BG32_MagicItem_821` | 每回合中，有一张恶魔牌可用生命值购买，而非铸币。（还剩1张！） | 已核对 | 每回合第一张符合条件恶魔可支付生命，付款不能致死并可先消耗护甲；成功才消费额度，下回合重置。 | [专项](../tests/trinket-health-purchases.test.ts) |
| 55 | 小 | 集市标签<br>`BG32_MagicItem_822` | 每回合中，有一张酒馆法术牌可用生命值购买，而非铸币。（还剩1张！） | 已核对 | 每回合1次生命购买，按实际折后法术报价；护甲优先、不可致死、满手失败不耗计数，读档/AI同规则。 | [专项](../tests/trinket-health-purchases.test.ts) |
| 56 | 小 | 邪能元素肖像<br>`BG32_MagicItem_830` | 获取一张邪能元素。你的邪能元素使随从额外获得+2/+2。 | 已核对 | Exact Felemental acquisition and +2/+2 on every pulse, including golden repetition and sh… | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 57 | 小 | 商贩元素肖像<br>`BG32_MagicItem_831` | 获取一张商贩元素。在每个回合开始时，再获取一张。 | 已核对 | 获取时及每回合开始生成商贩元素；实体使用完整出售生成水滴规则，零共享池所有权，10手牌上限统一处理。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 58 | 小 | 牺牲祭坛<br>`BG32_MagicItem_844` | 移除你的所有随从。每移除一个随从，获得3枚铸币。 | 已核对 | 移除场上每个随从+3金币，归还真实共享池所有权；属于移除不是出售，不触发出售/亡语。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 59 | 小 | 探险者的望远镜<br>`BG32_MagicItem_858` | 随机获取三张等级4的随从牌。 | 已核对 | Generates three exact Tier 4 active-type cards independently from normal refresh capacity… | [专项](../tests/trinket-simple-effects.test.ts) |
| 60 | 小 | 甲虫之戒<br>`BG32_MagicItem_860` | 复仇（5）：召唤一只2/2的甲虫，使其获得嘲讽。 | 已核对 | 复仇5召唤1只2/2嘲讽甲虫，读取本局甲虫成长；复仇计数不被亡语倍率放大，召唤受7场地容量限制。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 61 | 小 | 蓝鳃脚蹼<br>`BG32_MagicItem_893` | 在你施放一个酒馆法术后，使你手牌和战队中最左边的随从获得+3/+3。 | 待验证触发边界 | 招募场上/手牌左侧增益已覆盖；战斗酒馆施法缺对应增长。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 62 | 小 | 祝福肖像<br>`BG32_MagicItem_894` | 获取一张自然祝福。在每个回合开始时，再获取一张。你的自然祝福还会影响手牌中的随从牌。 | 缺专项验证 | 获取/供给和扩展目标代码存在；缺手牌、类型、重复施放专项。 | [专项](../tests/tavern-spells.test.ts) |
| 63 | 小 | 古风卷轴<br>`BG32_MagicItem_930` | 在你施放7个法术后，随机获取一张纳迦牌。（还剩7个！） | 已核对 | 累计每7次施法从共享池取得等级允许的纳迦；酒馆/宝石/塑造共有施法观察，触发后计数归零，满手统一处理。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) +1 |
| 64 | 小 | 艾萨拉的雕像<br>`BG32_MagicItem_931` | 随机获取3张塑造法术的法术牌。在每个回合开始时，再获取3张。 | 已核对 | 初始和每回合3随机塑造法术，来自固定可支持合法集合，临时法术到期/满手限制遵循共用手牌入口。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 65 | 小 | 黄金吊坠<br>`BG32_MagicItem_951` | 随机使一个等级4或以下的友方随从变为金色。在每个回合开始时，重复此效果。 | 已核对 | Random non-golden board minion Tier <=4, both acquisition and start. Preserves enchantmen… | [专项](../tests/trinket-simple-effects.test.ts) |
| 66 | 小 | 诈骗犯肖像<br>`BG32_MagicItem_957` | 获取一张 金币诈骗犯。每回合你购买的第一个海盗免费。 | 已核对 | 获取完整金币诈骗犯，每回合仅第一次成功购买海盗免金币；回合重置及保存覆盖，获取4张海盗提升金币上限由随从规则处理。 | [专项](../tests/trinket-acquisition-portraits.test.ts) +1 |
| 67 | 小 | 被诅咒的水晶<br>`BG35_MagicItem_150` | 在酒馆刷新后，在本回合中使酒馆中的随从获得+3/+3。 | 已核对 | 每真实刷新堆叠本回合酒馆+3/+3，旧报价/后续新报价共享累计量；购买后本回合临时增益与回合结束清理测试。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 68 | 小 | 亵渎者肖像<br>`BG35_MagicItem_151` | 获取一张林地亵渎者。酒馆中的恶魔饲料拥有+4/+4。 | 已核对 | Exact Woodland Defiler reward plus lesser +4/+4 Demon Fodder bonus; queued Fodder special… | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 69 | 小 | 恶魔挂毯<br>`BG35_MagicItem_152` | 在你刷新4次后，酒馆中等级最高的随从改为消耗生命值，而非铸币。（还剩4次！） | 已核对 | 每4次成功手动刷新标记最高等级报价支付生命；标记绑定真实实体并过存档，失败刷新/购买不消费进度或额度。 | [专项](../tests/trinket-health-purchases.test.ts) |
| 70 | 小 | 铜制线圈<br>`BG35_MagicItem_300` | 每当你磁力吸附一个随从时，使其获得+1/+1并提升此效果。 | 已核对 | 每磁力源+1/+1、+2/+2依次增长，增益在吸附前进入附件；真实次数玩家级保留，不把普通打出当吸附。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 71 | 小 | 废铁回收机标签<br>`BG35_MagicItem_301` | 随机获取一张磁力机械牌。在每个回合开始时，再获取 一张。 | 已核对 | Immediate and each start random Magnetic Mech from eligible shared pool, including dual-t… | [专项](../tests/trinket-simple-effects.test.ts) |
| 72 | 小 | 积雷标签<br>`BG35_MagicItem_302` | 在8个友方随从 死亡后，随机获取一张机械牌。（还剩8个！） | 已核对 | 每8友方死亡生成当前酒馆等级允许的机械；跨战斗持久进度，满手烧掉仍重置阈值，幽灵不写回原玩家。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 73 | 小 | 螺号肖像<br>`BG35_MagicItem_305` | 获取一张克隆螺号。每2个回合，在回合开始时，重复此效果。（还剩2回合！） | 已核对 | 初始1克隆螺号，每2回合开始再给1，计数0→1→0，满手烧牌不无限补发。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 74 | 小 | 典狱长标签<br>`BG35_MagicItem_306` | 塑造法术：消灭一个友方亡灵以随机获取一张亡灵牌。 | 已核对 | Only friendly Undead legal, actual destroy rather than sale, pooled random Undead reward,… | [专项](../tests/trinket-spellcraft-effects.test.ts) |
| 75 | 小 | 厄戈尔标签<br>`BG35_MagicItem_309` | 获取一张莫格顿大妈或莫格顿老爹。在每个回合开始时，重复此效果。 | 已核对 | 获取及每回合开始从固定两种莫格顿父母中随机生成1张；不是把relatedCardId唯一项直接当完整候选，满手遵循统一上限。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 76 | 小 | 废料铁匠肖像<br>`BG35_MagicItem_430` | 获取一张刺鬃废料铁匠。在一个友方嘲讽随从死亡后，对你的废料铁匠使用一张永久的鲜血宝石。 | 已核对 | 获取刺鬃废料铁匠；嘲讽死亡给仍存活废料铁匠永久宝石，战斗与持续board写回，幽灵不写回。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 77 | 小 | 珠宝盒<br>`BG35_MagicItem_434` | 获取一张能使野猪人获得嘲讽，圣盾或复生的鲜血宝石。在每个回合开始时，重复此效果。 | 已核对 | Immediate and each start one gem with rolled Taunt/Divine Shield/Reborn for Quilboar. Key… | [专项](../tests/trinket-simple-effects.test.ts) |
| 78 | 小 | 副厨师长标签<br>`BG35_MagicItem_801` | 每个回合你可以额外使用一次英雄技能。在你使用英雄技能后，获得（1）枚铸币。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-audit-group3.test.ts) |
| 79 | 小 | 麦克斯韦标签<br>`BG35_MagicItem_803` | 获取一张你的英雄技能对应的伙伴。 | 间接内容未完整 | 获取伙伴身份正确；15种伙伴的各自卡面能力仍标记部分支持。 | [专项](../tests/trinket-maxwell-sticker.test.ts) |
| 80 | 小 | 满当当的钱包<br>`BG35_MagicItem_814` | 当你升至等级6时，获得12枚铸币。 | 已核对 | Exact +12 on the successful transition to Tier 6; does not trigger merely by acquiring wh… | [专项](../tests/trinket-simple-effects.test.ts) |
| 81 | 小 | 魔术师的高帽<br>`BG35_MagicItem_815` | 获取等级1，2和3的随从牌各两张。 | 已核对 | 获取时各生成2张准确1/2/3级、兼容本局种族的普通随从；不会擅自升到当前酒馆等级，遵循手牌容量。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 82 | 小 | 未知宝珠<br>`BG35_MagicItem_816` | 随机获取一项小型 饰品。 | 间接内容未完整 | 随机小饰品入口正确；可选到赠送牌能力未完整的饰品。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 83 | 小 | 镜匣<br>`BG35_MagicItem_817` | 获取一张复映透镜。每2个回合，在回合开始时，重复此效果。（还剩2回合！） | 已核对 | Exact Mirror Lens supply now and each two starts; plain <=Tier 3 copy, full hand casting,… | [专项](../tests/trinket-mirror-timewarp.test.ts) |
| 84 | 小 | 神秘宝珠<br>`BG35_MagicItem_818` | 获得8枚铸币。 你的下一件饰品为小型饰品。 | 已核对 | 立即+8金币，第9回合以新的小饰品选购替代普通大饰品报价；保留宝珠与附加小饰品，合法所有权和保存alias约束。 | [专项](../tests/trinket-high-coupling-effects.test.ts) |
| 85 | 小 | 万花筒<br>`BG35_MagicItem_821` | 发现一张等级7的随从牌。将其锁入你的手牌2回合。 | 已核对 | 真实7星池3选1，选中牌锁到获取回合+2；人类交互可保存，AI同步选，满手可选择但烧毁，零普通池所有权。 | [专项](../tests/trinket-mystery-cube-kaleidoscope.test.ts) |
| 86 | 小 | 老旧的烛台<br>`BG35_MagicItem_823` | 发现一张来自小型时空扭曲的消耗为2的随从牌。 | 间接内容未完整 | 保留25种来源，接入12种完整规则；新发现按支持和本局种族过滤，其余13种排除。 | [专项](../tests/timewarp-support.test.ts) |
| 87 | 小 | 双头飞龙肖像<br>`BG35_MagicItem_834` | 获取一张重金属双头飞龙。战斗开始时：触发你的重金属双头飞龙的亡语。 | 已核对 | 获取重金属双头飞龙；开战逐只触发仍存活双头飞龙亡语，读取当时邻接、金色、提图斯与布莱恩倍率，走真实战吼路径。 | [专项](../tests/trinket-portrait-high-coupling.test.ts) |
| 88 | 小 | 多彩之泪<br>`BG35_MagicItem_840` | 随机获取一张 多彩幼龙。在每个回合开始时，重复此效果。 | 已核对 | 初始/每回合1真实随机多彩幼龙；生成牌不消耗共享池，循环取随机合法定义，满手停止。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 89 | 小 | 袋中旋风<br>`BG35_MagicItem_850` | 施放乘借东风。在每个回合开始时，再施放一次。 | 已核对 | Casts Ride the Wind immediately and each start; effect pulse count versus actual spell ca… | [专项](../tests/trinket-simple-effects.test.ts) |
| 90 | 小 | 水车<br>`BG35_MagicItem_851` | 在你使用一张元素牌后，随机获取一张酒馆法术牌。（每回合两次。） | 已核对 | 元素真实使用后生成随机法术，每回合最多2次；轮次编码持久化且跨回合恢复额度，满手仍消耗本次触发。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 91 | 小 | 跳蛙骑士肖像<br>`BG35_MagicItem_870` | 获取一张时空扭曲跳蛙骑士。 | 间接内容未完整 | 亡语增益及传播未实现；新报价和随机饰品入口排除，旧实体保留。 | [专项](../tests/timewarp-support.test.ts) |
| 92 | 小 | 熊妈妈标签<br>`BG35_MagicItem_871` | 每当你召唤一只野兽，使其获得+5/+5。 | 已核对 | Beast summons in both Recruit and combat gain +5/+5. Dual/All tribes use shared tribe che… | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 93 | 小 | 蛇首之杖<br>`BG35_MagicItem_872` | 塑造法术：使一只野兽获得+2/+2和 复生。 | 已核对 | 每回合提供固定蛇首之杖法术，只能选友方野兽；token文本未写直到下回合，当前实现永久+2/+2和复生，与既有专项一致；满手延后发牌及过期边界覆盖。 | [专项](../tests/trinket-spellcraft-effects.test.ts) |
| 94 | 小 | 沉没的船锚<br>`BG35_MagicItem_890` | 随机获取2张悬赏令。在每个回合开始时，重复此 效果。 | 已核对 | 初始/每回合2真实悬赏令，随机奖励定义及次数正确；满手/法术卡期行为统一处理。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 95 | 小 | 泡泡王冠<br>`BG35_MagicItem_920` | 一旦你施放了12个法术，你的酒馆法术使随从额外获得+4/+4。（还剩12个！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) +1 |
| 96 | 小 | 贝壳项链<br>`BG35_MagicItem_921` | 使随从获得属性值的酒馆法术消耗的铸币减少（2）枚。 | 已核对 | 仅使属性授予类别酒馆法术少2金币，费用不低于0；法术牌面/目标/花费仍用真实报价，生命支付法术不套金币折扣。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 97 | 小 | 赶潮纳迦肖像<br>`BG35_MagicItem_922` | 获取一张赶潮纳迦。在战斗中，在你施放一个法术后，获取一张该法术的复制。（每场战斗3次。） | 源码实现缺口 | 只监听战斗酒馆法术；卡面所写其他战斗法术家族未覆盖。 | [专项](../tests/trinket-portrait-high-coupling.test.ts) |
| 98 | 小 | 转录打字机<br>`BG35_MagicItem_931` | 获取你购买的下2个随从的各一张额外复制。（还剩2个！） | 已核对 | Next two successful minion purchases grant one generated plain copy each; spells/failed p… | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 99 | 大 | 瑞文戴尔肖像<br>`BG30_MagicItem_310` | 获取一张提图斯·瑞文戴尔。战斗开始时：使你的提图斯·瑞文戴尔的生命值翻倍。 | 已核对 | 获取真实提图斯；开战使所有存活提图斯当前生命翻倍，复制后的提图斯效果源也识别，战斗临时增益仅按保留规则写回。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 100 | 大 | 铁炉堡锻砧<br>`BG30_MagicItem_403` | 战斗开始时：使你没有类型的随从的属性值变为三倍。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 101 | 大 | 屠夫钩镰<br>`BG30_MagicItem_406` | 获取一张宰割。在每个回合开始时，再获取一张。 | 已核对 | Exact Slaughter acquisition and every-start supply; real Tavern Spell identity, normal fu… | [专项](../tests/trinket-simple-effects.test.ts) |
| 102 | 大 | 鬃尖笔墨套装<br>`BG30_MagicItem_410t2` | 复仇（4）：在本局对战中，你的鲜血宝石使随从额外获得+1/+1。 | 已核对 | 复仇4永久增加宝石+1/+1；每场复仇进度独立且金色/提图斯不重复死亡计数，幽灵侧只视觉结算。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 103 | 大 | 铜须肖像<br>`BG30_MagicItem_418` | 获取一张布莱恩·铜须和一张随机战吼随从牌。你的布莱恩·铜须视为鱼人和龙。 | 已核对 | 生成铜须+共享池随机战吼各1；已有/以后铜须视为龙/鱼人（tribes更新），类型规则及存档统一。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 104 | 大 | 麦迪文之书<br>`BG30_MagicItem_420t` | 发现2张 酒馆法术牌。在每个回合开始时，再发现2张。 | 已核对 | Two queued Tavern Spell Discovers both on acquisition and every start; each pending choic… | [专项](../tests/trinket-book-of-medivh.test.ts) |
| 105 | 大 | 游学者卷轴<br>`BG30_MagicItem_422t` | 每当你对一个随从施放法术时，使其获得+10/+10。 | 已核对 | 每个实际定向到随从的法术使目标+10/+10，覆盖宝石和酒馆/塑造目标；效果源施法与非法目标走共享合法性检查。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 106 | 大 | 多彩罗盘<br>`BG30_MagicItem_426t` | 随机获取2张与你战队相符类型的随从牌。在每个回合开始时，再获取2张。 | 已核对 | 初始/每回合2真实匹配战队类型的共享池牌，各次抽池、满手安全；读取当前主流战队类型。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 107 | 大 | 新潮眼罩<br>`BG30_MagicItem_439` | 你只需2个复制即可将海盗变为金色。 | 已核对 | Exactly two non-golden Pirate copies form golden; dual-type Pirates qualify, other tribes… | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 108 | 大 | 鲜血魔像标签<br>`BG30_MagicItem_442` | 每当一个友方野猪人死亡，召唤一个属性值等同于其鲜血宝石加成的魔像。 | 已核对 | 只响应友方野猪人死亡，魔像属性来自死亡实体鲜血宝石账本而非总属性；最少1/1、空场地限制及临时战斗召唤可回放。 | [专项](../tests/trinket-blood-golem-sticker.test.ts) |
| 109 | 大 | 猛猿标签<br>`BG30_MagicItem_540` | 在战斗中，在你召唤一只野兽后，使其攻击力翻倍。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 110 | 大 | 虚空坠饰<br>`BG30_MagicItem_541` | 酒馆中的随从拥有+2/+2。你的英雄在战斗之外每受到3次伤害后提升。（还剩3次！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) +1 |
| 111 | 大 | 诺米标签<br>`BG30_MagicItem_544t` | 在你使用一张元素牌后，使酒馆中的元素在本局对战中获得+5/+5。 | 已核对 | 大饰品版本每次元素真实使用提供永久酒馆类型+5/+5；当前/未来报价共有一个类型增益账本，全部类型正确触发。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 112 | 大 | 冰箱磁贴<br>`BG30_MagicItem_545` | 复仇（3）：随机获取一张磁力随从牌。 | 已核对 | 已复审AST转换：复仇3按副本独立counter，各副本随机生成1磁力随从；单件战斗、满手、重置既有专项通过。尚非穷尽组合测试。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 113 | 大 | 罐装宝石<br>`BG30_MagicItem_546` | 每场战斗中，在2个友方随从攻击后，本饰品对你的所有野猪人各使用一张鲜血宝石。（还剩2个！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 114 | 大 | 舒适的棺椁<br>`BG30_MagicItem_547t` | 在你施放一个酒馆 法术后，你的亡灵在本局对战中拥有+2攻击力 （无论它们在哪）。 | 已核对 | 每次酒馆法术施放后永久增加亡灵全局攻击2，并改当前战场/手牌；未来取得亡灵读取账本，自动施法也走相同观察。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 115 | 大 | 惊喜肖像<br>`BG30_MagicItem_555` | 获取一张惊喜元素。（在你意想不到的时候会出现更多……） | 源码实现缺口 | 获取惊喜元素存在；卡面额外出现更多的隐藏机制未实现。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 116 | 大 | 萨格拉斯之眼<br>`BG30_MagicItem_701` | 你每购买四张牌，第四张牌会消耗生命值，而非铸币。（还剩3张！） | 已核对 | Successful minion/spell purchases counted together; only fourth purchase spends discounte… | [专项](../tests/trinket-health-purchases.test.ts) |
| 117 | 大 | 罪碑标签<br>`BG30_MagicItem_801` | 每回合中，在你前2次发现卡牌时，额外获取一张复制。（还剩2次！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) +1 |
| 118 | 大 | 沙锤手肖像<br>`BG30_MagicItem_828` | 获取一张热情沙锤手。你的热情沙锤手会额外获取一张法术牌的复制。 | 缺专项验证 | 单件复制有证据；额外副本叠加存在代码疑点，尚无专项复现。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 119 | 大 | 吉尔尼斯带刺玫瑰<br>`BG30_MagicItem_864` | 复仇（3）：使你的随从永久获得+4/+5并对其造成1点伤害。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 120 | 大 | 操纵者肖像<br>`BG30_MagicItem_876` | 获取一张 无面操纵者。 | 间接内容未完整 | 获取无面操纵者正确；选择随从并成为复制的赠送牌能力仍部分支持。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 121 | 大 | 达拉然奶酪轮<br>`BG30_MagicItem_879t` | 酒馆中的随从拥有+2/+2。你每刷新4次后提升。（还剩4次！） | 已核对 | 基础酒馆永久+2/+2、每4真实刷新再+1/+1；计数跨回合、冻结/新报价共享累计增益，有主路径测试。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 122 | 大 | 强固之盾<br>`BG30_MagicItem_886` | 每当你召唤一个随从时，使其获得圣盾。（每场战斗限5次。） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 123 | 大 | 鱼人语实用手册<br>`BG30_MagicItem_914t` | 在你使用一张随从牌后，使你手牌中最左边的随从牌获得+6/+6。 | 已核对 | 每次使用随从后只强化仍在手牌的最左随从+6/+6，忽略法术与空手；打出的卡先移出，待选择战吼完成后结算。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 124 | 大 | 纳沙塔尔明信片<br>`BG30_MagicItem_919` | 在你使用一张纳迦牌后，随机获取一张塑造法术的法术牌。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) +1 |
| 125 | 大 | 恶鳞寿司卷<br>`BG30_MagicItem_920` | 获取一张恶鳞套餐。每个回合中，你的前两个塑造法术的法术额外施放一次。（还剩2个！） | 已核对 | Exact Slimy Seafood acquisition; first two Spellcraft cards per round get one extra execu… | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 126 | 大 | 藏宝海湾美酒<br>`BG30_MagicItem_924t` | 每当你花费铸币时，使一个友方海盗获得+6/+7。 | 已核对 | 每个实际金币消费交易强化随机友方海盗+6/+7，不按花费枚数重复；免费交易不触发，升级等共同走spendGold。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 127 | 大 | 机械加拉克苏斯标签<br>`BG30_MagicItem_942` | 随机获取2张磁力机械-恶魔牌。在每个回合开始时，再获取2张。 | 已核对 | 初始/每回合2真实磁力机械恶魔，固定3定义及普通/金色身份保持，生成不抽共享池，满手限制。 | [专项](../tests/trinket-mecha-jaraxxus-sticker.test.ts) |
| 128 | 大 | 测绘员肖像<br>`BG30_MagicItem_943` | 获取一张热气球测绘员。从你手牌中使用的鲜血宝石使随从额外获得+6/+6。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) +1 |
| 129 | 大 | 救赎者肖像<br>`BG30_MagicItem_944` | 获取一张救赎者娜拉。你的救赎者娜拉使随从额外获得+4/+4。 | 已核对 | 获取救赎者娜拉；每个真实娜拉各类型脉冲额外+4/+4，金色乘完整增益，多种族选目标共享辅助函数；招募及战斗施法路径都含portrait分支。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 130 | 大 | 熔岩提灯<br>`BG30_MagicItem_951` | 在你出售5个随从后，随机获取 一张元素牌。（还剩5个！） | 已核对 | 5真实出售循环获取1元素，共享池受剩余/等级约束，满手处理与计数跨回合一致。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 131 | 大 | 民谣歌手肖像<br>`BG30_MagicItem_987` | 获取一张苦情民谣歌手。在每个回合开始时，再获取一张。你的苦情民谣歌手还会使随从获得攻击力。 | 缺专项验证 | 获取/供给及加攻击分支存在；缺普通/金色与重复战吼专项。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 132 | 大 | 野猪之神标签<br>`BG30_MagicItem_988t` | 获取5张鲜血宝石。你的鲜血宝石使随从额外获得+3/+3。 | 已核对 | 获取时全局宝石成长+3/+3并提供5张宝石；满手时遵循上限，牌自身数值动态读本局成长，固定提升保存在PlayerState。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 133 | 大 | 艺匠之瓮<br>`BG30_MagicItem_989t` | 你的亡灵拥有+15攻击力。 | 已核对 | 已有场上/手牌+15攻击、未来亡灵使用全局bonus；复制获得不额外重触发购买效果属于待一手确认例外。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 134 | 大 | 帕格的鱼竿<br>`BG30_MagicItem_993` | 随机获取一张等级7的随从牌。在每个回合开始时，再获取一张。 | 已核对 | Immediate and every start exact generated Tier 7 reward from fixed special pool, active t… | [专项](../tests/trinket-discover-rewards.test.ts) |
| 135 | 大 | 青铜龙时钟<br>`BG30_MagicItem_995` | 战斗开始时：使你的每个随从获得等同于其攻击力的一半的生命值。 | 已核对 | 开战为每个存活随从加当前攻击一半的生命，奇数向上取整；永久保留类随从按共享战斗增益记账，普通随从下场清理。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 136 | 大 | 鲍勃的小费罐<br>`BG30_MagicItem_996` | 获得4枚铸币。你的铸币上限提高4枚。 | 已核对 | 购买金币与最大金币+4；永久上限读取和读档正确。复制一次性购买是否重触发不擅自判错，既有测试明确仅购买本体+4。 | [专项](../tests/lobby-systems.test.ts) +1 |
| 137 | 大 | 玄奥的法术书<br>`BG30_MagicItem_999` | 在你花掉7枚铸币后，施放闪亮的戒指。（还剩7枚！） | 已核对 | Gold spend accumulates across true payments; each seven casts real Shiny Ring and carries… | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 138 | 大 | 智慧之球补给<br>`BG31_MagicItem_903` | 获取一张冒牌的智慧之球。在每个回合开始时，重复此 效果。 | 已核对 | 立即及每回合開始生成真实冒牌智慧之球；法术完整规则包含两次付费有用刷新、共享副本与7级生成页面，手牌上限一致。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) +1 |
| 139 | 大 | 砰砰的怪物肖像<br>`BG32_MagicItem_172` | 获取一张 砰砰博士的怪物。在每个回合开始时，再获取一张。 | 间接内容未完整 | 获取/磁力身份存在；按本局磁力次数全局成长未实现。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 140 | 大 | 全能辅食<br>`BG32_MagicItem_200` | 每当一只友方野兽攻击时，使其获得+2攻击力并永久提升此效果。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 141 | 大 | 鲨鱼火炮<br>`BG32_MagicItem_232` | 在你花掉10枚铸币后，使你的海盗获得+1/+1并提升此效果。（还剩10枚！） | 已核对 | 累计每10真实金币消费向海盗施加递增+1/+1、+2/+2等脉冲，跨交易余数保留；单次大消费可独立结算多个阈值。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 142 | 大 | 邪恶魔典<br>`BG32_MagicItem_270t` | 复仇（4）：你的酒馆法术在本局对战中使随从额外获得+1/+1。 | 已核对 | 已复审AST转换：复仇4按副本独立counter，各副本永久提升酒馆法术+1/+1；单件既有专项通过，幽灵隔离保留。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 143 | 大 | 女沙皇肖像<br>`BG32_MagicItem_283` | 获取一张蓄能女沙皇。你的蓄能女沙皇还会使随从获得生命值。 | 已核对 | Exact Charging Czarina reward; every Czarina Tavern Spell pulse gives matching Health to … | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 144 | 大 | 阿格姆标签<br>`BG32_MagicItem_284` | 在你的回合结束时，本饰品对每个类型的各一个友方随从使用7张鲜血宝石。 | 已核对 | 回合末向每类型各一个不同实体逐张使用7宝石；双类型/全部类型避免重复占目标，多次回合末倍率重新选择，饰品施宝石不误触发手牌宝石专属效果。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 145 | 大 | 低音提琴鱼人肖像<br>`BG32_MagicItem_301` | 获取一张低音提琴鱼人。在战斗中，在你召唤一个鱼人后，使其获得圣盾。 | 已核对 | 获取低音提琴鱼人；每战斗鱼人召唤圣盾，手牌rally召唤已验证，圣盾幂等。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 146 | 大 | 先锋标签<br>`BG32_MagicItem_306` | 战斗开始时：触发所有友方亡语。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects-batch5.test.ts) +1 |
| 147 | 大 | 口袋工厂<br>`BG32_MagicItem_361t` | 发现一张等级5的具有类型的随从牌。在每个回合开始时，再获取一张它的复制。 | 已核对 | 立即发现准确5级有类型随从，记录选择definitionId；每回合开始生成普通复制。候选共享池预留/归还、AI同步选择及trinketSelections存档都有专项。 | [专项](../tests/trinket-discover-rewards.test.ts) |
| 148 | 大 | 旅店老板的炉火<br>`BG32_MagicItem_362t` | 发现两张等级6的随从牌。将其属性值变为30/30。 | 已核对 | 精确6星两次发现，选牌设为30/30，候选共享池保留/归还/满手安全，两步交互保存与AI同步。 | [专项](../tests/trinket-discover-rewards.test.ts) |
| 149 | 大 | 精灵龙鳞<br>`BG32_MagicItem_363` | 每当一条友方的龙攻击时，使其获得圣盾。（每场战斗限3次。） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects.test.ts) +1 |
| 150 | 大 | 诗心龙肖像<br>`BG32_MagicItem_364` | 获取一张时空扭曲诗心龙。 | 已核对 | 赠送完整时空扭曲诗心龙；实体effectSupport=complete，龙战斗属性和关键词永久保留走已实现战斗持久账本；生成牌不占普通共享池。 | [专项](../tests/trinket-acquisition-portraits.test.ts) +1 |
| 151 | 大 | 引路蜡烛<br>`BG32_MagicItem_366` | 每个回合中，你的前两次刷新只会包含等级6的牌。（还剩2次！） | 已核对 | 首2真实刷新所有报价均6星，第三次正常；回合开始重置，不把未付费失败刷新算次数，共享池约束。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 152 | 大 | 鬼魅标签<br>`BG32_MagicItem_367` | 你的回合结束效果额外触发一次。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) +1 |
| 153 | 大 | 森林之心<br>`BG32_MagicItem_801t` | 你的酒馆法术使随从额外获得+1/+1。在你从手牌施放6个酒馆法术后，提升此效果。（还剩6个！） | 已核对 | 获取即增加酒馆法术属性+1/+1；仅从手牌施放的酒馆法术累计每6次再提高光环，自动随从/饰品施法不推进此门槛。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 154 | 大 | 馆长标签<br>`BG32_MagicItem_807` | 获取一张金色混合体和一张10/10并具有烈毒的融合怪。 | 间接内容未完整 | 获取两张指定牌正确；混合体跟随融合怪属性成长未实现。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 155 | 大 | 血缚耳环<br>`BG32_MagicItem_808t` | 在你施放5个法术后，本饰品对你的所有随从各使用两张鲜血宝石。（还剩5个！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) +1 |
| 156 | 大 | 甲虫之戒<br>`BG32_MagicItem_860t` | 复仇（7）：召唤两只2/2的甲虫，使其获得嘲讽。 | 已核对 | 复仇7召唤2只当前甲虫成长的2/2嘲讽甲虫，逐只检查场地容量；计数与亡语倍率分离，招募战队不保留召唤实体。 | [专项](../tests/trinket-combat-effects.test.ts) |
| 157 | 大 | 回收标签<br>`BG32_MagicItem_888` | 在你使用一张元素牌后，获得一次免费的刷新。 | 已核对 | 每使用元素1免费刷新，计入玩家级额度，可跨回合保存，刷新共同消费1额度，复制配置表逐件叠加。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 158 | 大 | 镀金罗盘<br>`BG32_MagicItem_901` | 使你购买的下一个与你战队相符类型的随从变为金色。获得5次免费的刷新。 | 已核对 | Five acquisition free refreshes; next successfully bought minion matching any current war… | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 159 | 大 | 魅音排箫<br>`BG32_MagicItem_922` | 在每个回合结束时，使你最左边的随从获得+3/+3。在你施放一个法术后，提升此效果。 | 已核对 | 每次法术施放使永久计数+1，回合末给当前最左随从+3+计数的属性；回合末倍率按同一已提升数值重复，空战队不选目标。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 160 | 大 | 摩戈尔肖像<br>`BG32_MagicItem_926` | 获取一张潮汐先知摩戈尔。 | 间接内容未完整 | 获取摩戈尔及剧毒存在；攻击击杀后的手牌成长未实现。 | [专项](../tests/trinket-acquisition-portraits.test.ts) |
| 161 | 大 | 巨怪肖像<br>`BG32_MagicItem_998` | 获取一张奥术巨怪。 | 已核对 | Exact Arcane Behemoth reward; newly added normal/golden real Elemental-sale tests pass +s… | [专项](../tests/trinket-acquisition-portraits.test.ts) +1 |
| 162 | 大 | 亵渎者肖像<br>`BG35_MagicItem_151t` | 获取一张林地亵渎者。酒馆中的恶魔饲料拥有+15/+15。 | 已核对 | 赠送完整林地亵渎者；之后生成酒馆恶魔饲料时附加+15/+15，和小饰品版本可叠加；普通共享报价与零池饲料所有权分离。 | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 163 | 大 | 乌祖尔标签<br>`BG35_MagicItem_154` | 在你使用一张恶魔牌后，使另一个友方恶魔吞食酒馆中的一个随从并获得其属性值。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-audit-group1.test.ts) |
| 164 | 大 | 魔焰肖像<br>`BG35_MagicItem_156` | 获取一张魔焰执行者。每当你的魔焰执行者触发其效果时，还会使其相邻的随从获得等量的属性值。 | 缺专项验证 | 赠送牌和邻居吞食加成代码存在；缺叠加、金色、回合末专项。 | [专项](../tests/end-of-turn-minions.test.ts) |
| 165 | 大 | 铜制线圈<br>`BG35_MagicItem_300t` | 每当你磁力吸附一个随从时，使其获得+3/+2并提升此效果。 | 已核对 | 每次成功磁力在合并前给源随从递增+3/+2、+6/+4等属性，保留进度；非法/满手等通过统一磁力合法性，拳手继承真实附件结果。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 166 | 大 | 棘刺肩铠<br>`BG35_MagicItem_431t` | 在你触发一个亡语后，直到下一场战斗，你的鲜血宝石使随从额外获得+2/+1。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-yogg-tags-pauldrons.test.ts) +1 |
| 167 | 大 | 鲜血坠饰<br>`BG35_MagicItem_432` | 在你触发一个亡语后，本饰品随机对3个友方随从各使用一张永久的鲜血宝石。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) +1 |
| 168 | 大 | 血缚之戒<br>`BG35_MagicItem_435` | 在你从手牌中使用一张鲜血宝石后，本饰品对你具有圣盾的随从各使用一张鲜血宝石。 | 已核对 | 只在从手牌施放宝石后，向当前有圣盾的友方各使用1宝石；饰品额外宝石不递归触发自己，真实目标列表和成长账本共用。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 169 | 大 | 荒羽尘掸<br>`BG35_MagicItem_700` | 在你召唤6只野兽后，随机获取一张野兽牌。（还剩6只！） | 已核对 | 已复审AST转换：招募/战斗6兽召唤阈值按副本独立持久counter，满手处理/生成等级保留；单件既有专项通过。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 170 | 大 | 獠牙脚链<br>`BG35_MagicItem_701` | 战斗开始时：在本场战斗中，你的野兽拥有+1/+1。在你召唤一只野兽后，永久提升此效果。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects-batch5.test.ts) +1 |
| 171 | 大 | 迷你船模<br>`BG35_MagicItem_710` | 在你施放一个酒馆法术后，使你的海盗获得+2/+2。 | 已核对 | 每次酒馆法术施放后友方全部海盗+2/+2，双类型及全部类型匹配；普通法术、随从替代施法使用共享酒馆施法观察。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 172 | 大 | 防护戒指<br>`BG35_MagicItem_711` | 战斗开始时：随机使4个友方海盗获得圣盾。 | 已核对 | 已复审AST转换：各副本独立随机4个海盗施加圣盾，第二件不再遗漏；单件既有专项通过，圣盾幂等及随机次数保留。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 173 | 大 | 私掠者肖像<br>`BG35_MagicItem_712` | 获取一张骄傲的私掠者和随机2张悬赏令。在每个回合开始时，再获取2张悬赏令。 | 已核对 | Exact Proud Privateer plus two legal Bounties now, two Bounties every start. Full hand/ac… | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 174 | 大 | 结实的撬棍<br>`BG35_MagicItem_713` | 每当你获取一张海盗牌，使你最左边的随从获得+12/+12。 | 已核对 | 海盗随从成功进入手牌后强化最左战队+12/+12，购买与效果生成共享获取路径；满手未获得牌不触发，空战队忽略。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 175 | 大 | 火药桶<br>`BG35_MagicItem_714` | 战斗开始时：使3个友方海盗获得“亡语：召唤一个1/1的空中海盗，使其获得本随从的攻击力并使其立即发起攻击。” | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-powder-keg.test.ts) +2 |
| 176 | 大 | 死亡之触苹果<br>`BG35_MagicItem_731` | 在一个友方亡灵 复生后，使其获得复生。（每回合限3次。） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-combat-effects-batch5.test.ts) +1 |
| 177 | 大 | 灵魂酵罐<br>`BG35_MagicItem_732` | 战斗开始时：消灭你最左边的3个随从。在你的最后一个随从死亡后，再次召唤消灭的随从。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-soul-fermenter.test.ts) +2 |
| 178 | 大 | 典狱长标签<br>`BG35_MagicItem_733` | 塑造法术：消灭一个友方亡灵以随机获取2张亡灵牌。 | 已核对 | 每回合塑造法术销毁友方亡灵并抽共享池2亡灵；正确目标、亡语触发、满手、不算出售，AI挑弱目标已有专项。 | [专项](../tests/trinket-spellcraft-effects.test.ts) |
| 179 | 大 | 飞天魔像肖像<br>`BG35_MagicItem_740` | 获取一张坠落的飞天魔像。战斗开始时：使你的随从获得“亡语：使你的随从永久获得+2/+2。” | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-flying-golem-portrait.test.ts) +1 |
| 180 | 大 | B-Box拳手肖像<br>`BG35_MagicItem_741` | 获取一张极性B-Box拳手。 | 已核对 | 本次新增真实获取断言：获得普通完整BG26_149，属性符合固定卡面，零共享池所有权且池不变；实体的复制其他磁力规则已由拳手专项覆盖。 | [专项](../tests/trinket-audit-group3.test.ts) +1 |
| 181 | 大 | 手风琴机器人肖像<br>`BG35_MagicItem_742` | 在每个回合结束时，对你最左边和最右边的机械各磁力吸附一个手风琴机器人。 | 已核对 | 按机械序列两端各磁力1手风琴机器人；只有1机械去重；真实附件、后续磁力次数、达卡莱重复均共用吸附入口。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 182 | 大 | 电极吸附器<br>`BG35_MagicItem_743` | 磁力机械牌消耗的铸币为（2）枚。每当酒馆刷新时，总会额外提供一个磁力机械。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) +1 |
| 183 | 大 | 魔鳍标签<br>`BG35_MagicItem_750` | 在你购买一个酒馆法术后，获取一张1/1的鱼人并教会它该法术。（每回合2次。） | 已核对 | 每轮前2次成功购买酒馆法术后生成1/1学徒并记住该法术，满手额度照常消费；学徒战吼实际施法与存档恢复有专项。 | [专项](../tests/trinket-magicfin-tag.test.ts) |
| 184 | 大 | 小瞎眼标签<br>`BG35_MagicItem_752` | 在你的回合结束时，触发你最左边和最右边的随从的 战吼。 | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-yogg-tags-pauldrons.test.ts) +1 |
| 185 | 大 | 奔波尔霸标签<br>`BG35_MagicItem_753` | 在每个回合结束时，使你最左边的两个随从获得+1/+1。（在本局对战中你每触发一个战吼都会提升！） | 已核对 | Leftmost two minions gain 1 plus lifetime triggered Battlecries, including history before… | [专项](../tests/trinket-yogg-tags-pauldrons.test.ts) |
| 186 | 大 | 戏剧鱼人标签<br>`BG35_MagicItem_754` | 战斗开始时：使你的鱼人获得你手牌中攻击力最高的随从牌的攻击力。 | 已核对 | 开战仅从手牌随从读最高攻击并加到所有友方鱼人；法术不参与且手牌不消耗，战斗临时与永久保留共用账本。 | [专项](../tests/trinket-combat-effects-batch4.test.ts) |
| 187 | 大 | 切米尔拼贴画<br>`BG35_MagicItem_755` | 塑造法术：刷新酒馆，使其中变为战吼随从牌。这些牌的消耗为（1）。 | 已核对 | 刷新全部为真实战吼随从、消耗1，使用实际战吼标签（含interactive）；共享池/满手/后续普通刷新重置报价处理。 | [专项](../tests/trinket-spellcraft-effects.test.ts) |
| 188 | 大 | 麦克斯韦标签<br>`BG35_MagicItem_803t` | 获取一张你的英雄技能对应的金色伙伴。 | 间接内容未完整 | 真实金色伙伴身份正确；15种伙伴的专属能力仍部分支持。 | [专项](../tests/trinket-maxwell-sticker.test.ts) |
| 189 | 大 | 腐蚀秘典<br>`BG35_MagicItem_812` | 获取一张三连奖品。每当你即将获取三连奖励时，改为获取三连奖品。 | 已核对 | 立即获取真实三连奖品，之后正常三连奖励替换为奖品；满手、金色随从互动战吼之前发奖、奖品发现不计作酒馆法术有专项。 | [专项](../tests/trinket-darkmoon-prizes.test.ts) |
| 190 | 大 | 未知宝珠<br>`BG35_MagicItem_816t` | 随机获取一项大型饰品和4枚铸币。 | 间接内容未完整 | 随机大饰品和金币入口正确；仍可取得间接内容部分支持的饰品。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 191 | 大 | 安全徽章<br>`BG35_MagicItem_820` | 施放寒冰屏障。获得5枚铸币。 | 已核对 | Five Gold plus one Ice Block-like lethal-combat prevention; nonlethal hit preserves charg… | [专项](../tests/trinket-safe-badge.test.ts) |
| 192 | 大 | 万花筒<br>`BG35_MagicItem_821t` | 发现一张等级7的金色随从牌。将其锁入你的手牌2 回合。 | 已核对 | 发现7级池外金色牌，准确锁手至当前轮+2；候选可存档，金色无普通池扣除；本次罪碑复制回归验证金色及锁手不丢失。 | [专项](../tests/trinket-mystery-cube-kaleidoscope.test.ts) +1 |
| 193 | 大 | 老旧的烛台<br>`BG35_MagicItem_823t` | 发现一张来自大型时空扭曲的消耗为2的随从牌。 | 间接内容未完整 | 保留41种来源，接入16种完整规则；新发现按支持和本局种族过滤，其余25种排除。 | [专项](../tests/timewarp-support.test.ts) |
| 194 | 大 | 双线缝针<br>`BG35_MagicItem_838` | 塑造法术：选择一个友方随从，使其属性值翻倍，并将其锁入你的手牌1个回合。 | 已核对 | Legal friendly target permanently doubles current stats, removes to hand and locks until … | [专项](../tests/trinket-spellcraft-effects.test.ts) |
| 195 | 大 | 多彩之泪<br>`BG35_MagicItem_840t` | 随机获取2张多彩幼龙。在你使用7张战吼随从牌后，重复此效果。（还剩7张！） | 已核对 | 获取时随机生成2幼龙，之后每真实使用7张有战吼标识的随从再生成2张；计数由使用事件推进，布莱恩重复战吼不当多张使用。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 196 | 大 | 袋中旋风<br>`BG35_MagicItem_850t` | 施放乘借东风，触发四次。在每个回合开始时，再施放 两次。 | 已核对 | 初始1施法4独立乘借东风脉冲；每回合开始再2次真正自动施法，各读当次buff参数；不会把4脉冲算4张施法。 | [专项](../tests/trinket-simple-effects.test.ts) |
| 197 | 大 | 投球手肖像<br>`BG35_MagicItem_861` | 获取一张寒热骤变。在你使用10张元素牌后，重复此效果。（还剩10张！） | 已核对 | Exact Temperature Shift now and after each ten actual Elemental plays, All/dual included;… | [专项](../tests/trinket-recruit-trigger-effects-batch4.test.ts) |
| 198 | 大 | 爆燃余烬<br>`BG35_MagicItem_862` | 在你刷新后，使酒馆中生命值最高的随从属性值翻倍。 | 已核对 | 每次成功手动刷新后只选一个生命最高报价并将当前攻血翻倍，最高并列时随机单选；自动填空位不触发。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |
| 199 | 大 | 雪崩标签<br>`BG35_MagicItem_863` | 获取一张累叠雪崩。在你出售4个随从后，重复此效果。（还剩4个！） | 已核对 | 购买获取1累叠雪崩，以后4出售重复，计数归零跨回合；奖励是真实酒馆法术共用生成手牌上限。 | [专项](../tests/trinket-recruit-trigger-effects-batch5.test.ts) |
| 200 | 大 | 魔力丝带<br>`BG35_MagicItem_923` | 每当你施放一个法术，使你的随从永久获得+1/+1。（战斗中改为+2/+2！） | 缺陷 → 已核对 | 本轮缺陷已修复，真实行为回归通过；具体原症状和边界见 JSON。 | [专项](../tests/trinket-bewitched-ribbon.test.ts) +1 |
| 201 | 大 | 碎地者肖像<br>`BG35_MagicItem_924` | 获取一张碎地者。你的碎地者还会使其左边的随从获得属性值。 | 已核对 | 赠送完整碎地者；碎地者历史法术成长脉冲同时给当前左邻，相同金色及阶段倍率；最左没有邻居时只自身成长。 | [专项](../tests/trinket-audit-group3.test.ts) +1 |
| 202 | 大 | 珊瑚长矛<br>`BG35_MagicItem_925` | 每当你施放塑造法术的法术时，施放暴风城之力。 | 已核对 | 每真实塑造法术施放自动施放暴风城之力，逐副本循环，重复法术各触发；额外自动施法与玩家手牌施法历史区分。 | [专项](../tests/trinket-recruit-trigger-effects-batch3.test.ts) |
| 203 | 大 | 战队口哨<br>`BG35_MagicItem_930` | 获得一次免费的刷新，其中会包含你的战队随从的原始版复制。 | 已核对 | Queues exactly one free refresh containing plain warband copies; subsequent refresh rever… | [专项](../tests/trinket-recruit-economy-effects-batch4.test.ts) |
| 204 | 大 | 转录打字机<br>`BG35_MagicItem_931t` | 获取你购买的下4个随从的各一张额外复制。（还剩4个！） | 已核对 | 前4次成功购买随从各额外生成同definition的副本，不从共享池再扣；次数持久累计，满手失败购买不推进，生成后统一检查三连。 | [专项](../tests/trinket-recruit-trigger-effects.test.ts) |

详细说明和全部证据路径见 [JSON 清单](trinket-functional-audit.json)。
