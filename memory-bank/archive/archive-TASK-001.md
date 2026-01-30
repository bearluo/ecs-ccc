# 任务归档：TASK-001 设计 ECS 和 Creator 结合的游戏框架（肉鸽手游向）

## METADATA

| 项 | 值 |
|----|-----|
| **任务 ID** | TASK-001 |
| **任务名称** | 设计 ECS 和 Creator 结合的游戏框架（肉鸽手游向） |
| **复杂度** | Level 4 - 复杂系统 |
| **状态** | 已完成（阶段 1–3 实现 + 反思 + 归档） |
| **归档日期** | 2025-01-29 |
| **实现范围** | 阶段 1（MVP）、阶段 2（核心系统完善）、阶段 3（完整功能实现） |

---

## SUMMARY

本任务实现了一个将 **Entity Component System (ECS)** 架构与 **Cocos Creator 3.8.7** 深度结合的游戏开发框架，面向肉鸽手游：玩法逻辑全部在 ECS（数值、状态、战斗、技能、Buff、AI），Creator 负责 View（节点、动画、特效、UI、音频、资源），两边通过 **CommandBuffer + EventBus** 桥接，严格保持「ECS 只存纯数据、不把 Node/Animator 塞进 ECS」的架构约束。

**核心成果：**
- **桥接层：** CommandBuffer、EventBus、Scheduler、SortedSystemList 全部落地并优化（脏标记、Fixed/Render 分离）；RenderCommand 与事件统一使用 Handle。
- **阶段 1：** 6 组件 + 4 系统 + ViewManager/AnimDriver，MVP 从创建→移动→受伤→死亡动画→回收链路闭环。
- **阶段 2：** 扩展组件（Collider、Faction、BuffList、SkillSlots、AnimationIntent、DestroyTimer、AI 等）、扩展系统（Input、AI、Collision、Buff、Skill、Cooldown、AnimationIntent）、表现层（FxDriver、AudioDriver、ViewPool、NodeBinder）、配置系统；SpawnView 流程优化（NeedViewTag + EventBus 确认）、实体 Handle 迁移、动画系统完善、实体销毁与动画同步优化。
- **阶段 3：** 资源管理（ResourceManager、ResourcePreloader、ViewPool 资源加载）、高级组件与系统（Inventory、Equipment、LevelExperience、Stats、Loot、Upgrade、Equipment、Save）、UI 系统（UIManager、GameUI、InventoryUI、SkillUI、StatsUI、UISystem）、场景管理（SceneFlow、SceneTag、EngineSceneLoader、SceneRegistry）、服务定位器（ServiceLocator）。
- **创意阶段文档 30 篇**（`memory-bank/creative/creative-*.md`），单元测试覆盖桥接层、组件、系统、配置与场景管理。

---

## REQUIREMENTS

### 业务与架构目标

1. **玩法逻辑全在 ECS：** 数值、状态、战斗、技能、Buff、AI 等均为 ECS 组件与系统，不依赖 Creator API。
2. **Creator 负责 View：** 节点、动画、特效、UI、音频、资源等由表现层管理，ECS 不持有 Node/Animator 等引用。
3. **桥接层低耦合：** ECS → View 通过 RenderCommand（CommandBuffer）；View → ECS 通过 GameplayEvent（EventBus）；不把 Node/Animator 塞进 ECS 数据。
4. **面向肉鸽手游：** 支持多场景切换、存档读档、背包/装备/技能/属性、掉落与升级等肉鸽常用能力。

### 技术约束

- ECS 内只放可序列化的纯数据。
- AnimState 唯一写入路径为 AnimationIntentSystem（Render 系统）。
- 所有 ECS → View 行为必须经 RenderSyncSystem 产出 RenderCommand。
- 跨边界实体引用使用 Handle（id + gen），避免 entityId 复用导致错误引用。

### 阶段目标（已实现）

- **阶段 1：** 最小可跑版本，从扣血到死亡动画到回收的完整链路。
- **阶段 2：** 完整战斗系统（输入、移动、AI、碰撞、伤害、Buff）、技能系统、特效与音效、配置驱动。
- **阶段 3：** 资源管理、高级组件与系统（背包、装备、等级经验、属性、掉落、升级、存档）、UI 系统、场景管理、服务定位器。

---

## IMPLEMENTATION

### 架构分层

```
Game App（入口/场景/全局服务）
    ↓
ECS（World / Entity / Components / Systems）
    ↓ 桥接：CommandBuffer + EventBus
Presentation（ViewPool / NodeBinder / Anim / FX / Audio / UI）
```

### 关键实现要点

| 领域 | 实现要点 |
|------|----------|
| **桥接层** | CommandBuffer（SpawnView、SetPosition、PlayAnim、DestroyView、PlayFx、PlaySFX/BGM 等）；EventBus（push/subscribe/flush）；Scheduler（stepFixed/stepRender、SortedSystemList 脏标记）；RenderCommand 与事件统一使用 Handle。 |
| **ECS 组件** | 核心：Transform、Velocity、HP、AnimState、ViewLink、DeadTag；扩展：Collider、Faction、BuffList、SkillSlots、AnimationIntent、DestroyTimer、AI、NeedViewTag、SceneTag 等；高级：Inventory、Equipment、LevelExperience、Stats 等。 |
| **ECS 系统** | Fixed：Move、Combat、Death、Input、AI、Collision、Buff、Skill、Cooldown、Destroy、ViewSpawn、Loot、Upgrade、Equipment、Save、UISystem 等；Render：RenderSync、AnimationIntent、AnimationEvent。 |
| **表现层** | ViewManager（Handle→Node、命令消费、ViewPool）、AnimDriver、FxDriver、AudioDriver、NodeBinder、ResourceManager、ResourcePreloader；UI：UIManager、GameUI、InventoryUI、SkillUI、StatsUI。 |
| **场景与入口** | SceneFlow（预加载→清理→加载→初始化）、SceneTag 标记场景实体、EngineSceneLoader、SceneRegistry、SceneContext；GameApp 集成 Scheduler、CommandBuffer、EventBus、ServiceLocator、UIManager、SceneFlow。 |

### 关键设计决策（创意文档索引）

- **实体引用：** 采用框架 Handle（creative-entity-handle.md）；RenderCommand/事件用 Handle（creative-rendercommand-handle.md）；Handle 作 Map key 用字符串（creative-handle-map-key.md）。
- **SpawnView：** NeedViewTag + RenderSyncSystem 发令 + ViewManager 确认 + ViewSpawnSystem 写 ViewLink（creative-spawn-view-flow.md）。
- **销毁与动画：** 两阶段销毁（死亡动画 + DestroyTimer/动画事件）（creative-entity-destruction.md）；动画同步用 lastSentAnim + AnimDriver 防御性检查（creative-animation-sync-optimization.md）。
- **场景管理：** World 保留、SceneTag 标记场景实体、SceneFlow 统一流程（creative-scene-flow.md）。
- **存档：** 白名单 + 自定义序列化器、读档重建 World（creative-save-system.md）。
- **UI：** 事件驱动 + 定时查询 + UISystem 处理 UI 事件（creative-ui-system.md）。
- **服务定位：** ServiceLocator 轻量注册表，与单例（ResourceManager、UIManager 等）并存（creative-service-locator.md）。

### 主要代码与配置位置

- **入口与场景：** `assets/scripts/app/GameApp.ts`、`SceneFlow.ts`、`SceneContext.ts`、`SceneRegistry.ts`、`EngineSceneLoader.ts`、`ServiceLocator.ts`
- **桥接：** `assets/scripts/bridge/CommandBuffer.ts`、`EventBus.ts`、`Scheduler.ts`、`SortedSystemList.ts`
- **组件：** `assets/scripts/gameplay/components/`（含 index 导出）
- **系统：** `assets/scripts/gameplay/systems/`（含 index 导出）
- **表现层：** `assets/scripts/presentation/ViewManager.ts`、`ViewPool.ts`、`AnimDriver.ts`、`FxDriver.ts`、`AudioDriver.ts`、`ResourceManager.ts`、`ResourcePreloader.ts`、`UI/`
- **配置：** `assets/scripts/data/configs/`（skills、buffs、items、equipment、stats、loot、fx、audio 等）

---

## TESTING

- **策略：** 单元测试覆盖桥接层、组件、系统、ConfigLoader、ResourceManager、ResourcePreloader、ViewPool、SceneFlow、ServiceLocator、UISystem 等；关键路径多文件数百用例通过。
- **重点：** CommandBuffer/EventBus 行为、RenderSyncSystem 与 Handle、ViewSpawnSystem、DestroySystem、ConfigLoader 各配置 getter、SceneFlow 预加载/清理/加载流程、SaveSystem 序列化/反序列化与约束。
- **运行时验证：** 在 Cocos Creator 中跑完整流程（场景切换、存档读档、UI、特效与音效）为后续待办，当前以单测为主。

---

## LESSONS LEARNED

（摘自 `memory-bank/reflection/reflection-TASK-001.md`）

1. **先定边界再实现：** ECS 与 View 的边界在创意阶段定清楚，实现时严格遵守，减少「该放 ECS 还是 View」的纠结。
2. **Handle 是跨边界引用的唯一安全方式：** 凡涉及异步、跨帧、事件回调的实体引用，一律用 Handle + 校验，避免 ID 复用和生命周期错位。
3. **创意文档是活的规格：** creative-*.md 记录「最后选了啥」与「为啥不选别的」，便于改需求或加人时理解约束和取舍。
4. **阶段 1 禁止清单防 scope creep：** 明确不做什么（SoA/Chunk、Buff/Skill/Stats/UI/配置等），先闭环再扩展。
5. **测试优先覆盖桥接与数据流：** CommandBuffer、EventBus、RenderSyncSystem、ViewManager、ConfigLoader 等有测试，能尽早发现接口和生命周期问题。
6. **表现与逻辑解耦：** AnimationIntent 表达意图、AnimationIntentSystem 写 AnimState；销毁采用「意图 + 延迟执行」（Timer/事件），不在单帧内混写逻辑与表现销毁。
7. **Map key 用字符串：** 凡用 Handle 做 key 的 Map，统一用字符串形式，避免对象引用比较问题。

---

## REFERENCES

### Memory Bank

- **任务跟踪：** `memory-bank/tasks.md`（归档后已更新状态与归档链接）
- **实施进度：** `memory-bank/progress.md`
- **反思文档：** `memory-bank/reflection/reflection-TASK-001.md`
- **当前活动上下文：** `memory-bank/activeContext.md`（归档后已重置为下一任务）

### 创意阶段文档（memory-bank/creative/）

- 桥接与架构：creative-scheduler-optimization.md、creative-entity-handle.md、creative-rendercommand-handle.md、creative-handle-map-key.md、creative-spawn-view-flow.md、creative-entity-destruction.md、creative-animation-sync-optimization.md、creative-animation-system.md、creative-animation-intent.md
- 玩法与配置：creative-buff-list.md、creative-skill-slots.md、creative-skill-system.md、creative-config-loader.md、creative-ai-system.md、creative-collision-system.md
- 表现与资源：creative-view-pool.md、creative-fx-audio-loading.md、creative-resource-manager.md、creative-resource-loading-flow.md、creative-viewpool-resource-loading.md
- 高级玩法：creative-inventory-component.md、creative-equipment-component.md、creative-equipment-system.md、creative-level-experience.md、creative-stats-component.md、creative-loot-system.md、creative-upgrade-system.md、creative-save-system.md
- UI 与场景：creative-ui-system.md、creative-scene-flow.md、creative-service-locator.md

### 后续行动

- 阶段 4：性能优化（SoA/Chunk、查询、内存池）、调试工具（World.dump、SystemProfiler、DebugDraw）、文档与示例。
- Cocos Creator 运行时验证：场景切换、存档读档、UI、特效与音效完整流程。
- 启动下一任务可使用 `/van` 命令。
