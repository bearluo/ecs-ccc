# 项目简介

## 项目名称
ECS-CCC (Entity Component System for Cocos Creator)

## 项目目标
设计并实现一个将 ECS 架构模式与 Cocos Creator 3.8.7 引擎深度结合的游戏开发框架，专门针对肉鸽手游场景优化，提供高性能、可扩展、易用的游戏开发解决方案。

## 核心设计理念

### 职责分离
- **ECS 层：** 玩法逻辑全在 ECS（数值、状态、战斗、技能、Buff、AI）
- **Creator 层：** Creator 负责 View（节点、动画、特效、UI、音频、资源）
- **桥接层：** 两边通过桥接层低耦合对接（不把 Node/Animator 塞进 ECS 数据里）

### 数据原则
- ECS 内只放可序列化的纯数据
- Creator 的 Node / Component / Animation / Spine 都属于 View 层
- ECS → View：用 RenderCommand（渲染指令）
- View → ECS：用 GameplayEvent（回传事件）

## 技术栈
- **引擎:** Cocos Creator 3.8.7
- **语言:** TypeScript
- **架构模式:** Entity Component System (ECS)
- **平台:** Web (2D 游戏)
- **目标场景:** 肉鸽手游（Roguelike）

## 核心需求

### 1. ECS 核心系统
- Entity 管理（创建/销毁/查询）
- Component 系统（纯数据组件）
- System 执行框架（Fixed/Render 分离）
- 查询和过滤机制（All/Any/None）
- 命令缓冲区（ECS → View）
- 事件总线（View → ECS）

### 2. Creator 集成
- 与 Cocos Creator 组件系统集成
- Node 与 Entity 的双向绑定（通过 viewId）
- 生命周期同步
- 场景管理集成
- 视图对象池

### 3. 游戏逻辑系统（肉鸽向）
- 移动系统
- 战斗系统（碰撞、伤害、死亡）
- AI 系统
- Buff 系统
- 技能系统
- 冷却系统
- 掉落系统
- 升级系统

### 4. 表现层系统
- 视图管理器（ViewManager）
- 动画驱动（AnimDriver）
- 特效驱动（FxDriver）
- 音频驱动（AudioDriver）
- UI 系统

### 5. 性能优化
- 组件数据布局优化（SoA）
- 系统执行顺序优化
- 查询缓存机制
- 内存池管理

### 6. 开发体验
- TypeScript 类型安全
- 调试工具（World.dump、SystemProfiler、DebugDraw）
- 配置系统（JSON/TS）
- 文档和示例

## 项目结构

```
assets/scripts/
  app/                    # 应用入口
    GameApp.ts           # 主入口
    SceneFlow.ts         # 场景流程
    ServiceLocator.ts    # 服务定位器（可选）
  ecs/                   # ECS 核心
    World.ts             # ECS 世界
    Entity.ts            # 实体
    Component.ts         # 组件基类
    Query.ts             # 查询系统
    System.ts            # 系统基类
    Scheduler.ts         # 调度器
    CommandBuffer.ts     # 命令缓冲区
    EventBus.ts          # 事件总线
  gameplay/              # 游戏逻辑
    components/          # 游戏组件
      Transform.ts
      Velocity.ts
      HP.ts
      Faction.ts
      Skill.ts
      Buff.ts
      AnimState.ts
      ViewLink.ts
      ...
    systems/             # 游戏系统
      InputSystem.ts
      MoveSystem.ts
      AISystem.ts
      CombatSystem.ts
      BuffSystem.ts
      SkillSystem.ts
      CooldownSystem.ts
      DeathSystem.ts
      AnimationIntentSystem.ts
      RenderSyncSystem.ts
      ...
  presentation/          # 表现层
    ViewManager.ts       # 视图管理器
    ViewPool.ts          # 视图对象池
    NodeBinder.ts        # 节点绑定器
    AnimDriver.ts        # 动画驱动
    FxDriver.ts          # 特效驱动
    AudioDriver.ts       # 音频驱动
    UI/                  # UI 系统
  data/                  # 数据配置
    configs/             # 配置文件
      monster.json       # 怪物表
      skill.json         # 技能表
      loot.json          # 掉落表
```

## 关键特性

### 1. 完全解耦
- ECS 层不依赖 Creator API
- 所有 Creator 对象在 ViewManager 中管理
- 通过 Command 和 Event 通信

### 2. 高性能
- SoA 数据布局
- 查询缓存
- 对象池
- 批量处理

### 3. 易用性
- TypeScript 类型安全
- 清晰的 API
- 完善的文档
- 调试工具

### 4. 可扩展性
- 组件化设计
- 系统解耦
- 配置驱动
- 易于添加新功能

## 成功指标

- ✅ 支持 1000+ Entity 流畅运行
- ✅ API 易于学习和使用
- ✅ 与 Creator 原生性能相当或更好
- ✅ 完整的文档和示例
- ✅ 调试工具完整可用
