# 当前活动上下文

## 当前阶段
**BUILD 模式 - 阶段 1 代码实现完成（含性能优化）**

## 当前焦点
- ✅ 详细实施计划已创建
- ✅ 分 4 个阶段实施
- ✅ 架构设计文档完整
- ✅ 开发规范文档已创建
- ✅ 阶段 1 核心代码已实现
- ✅ 性能优化：SortedSystemList 脏标记机制
- ✅ 创意阶段：Scheduler 优化方案已确定并实现
- ⏳ 待测试和验证（需要在 Cocos Creator 中测试）

## 关键决策

### 技术选型
1. **使用现有 ECS 框架：** `@bl-framework/ecs`
   - ✅ World、Entity、Component、System 核心已提供
   - ✅ Query 查询系统已提供
   - ✅ 装饰器支持（@component、@system）
   - ⚠️ 需要扩展：CommandBuffer、EventBus、Scheduler

### 架构决策
1. **分层架构：** Game App → ECS (@bl-framework/ecs) → Bridge → Presentation
2. **桥接方式：** CommandBuffer（ECS→View）+ EventBus（View→ECS）
3. **数据原则：** ECS 组件只存纯数据，不存 Creator 对象引用
4. **执行模式：** Fixed Step + Render Step（通过 Scheduler 封装）

### 实施策略
- **阶段 1（MVP）：** 最小可跑版本，1-2 天
- **阶段 2：** 核心系统完善，3-5 天
- **阶段 3：** 完整功能实现，5-7 天
- **阶段 4：** 优化和工具，3-5 天

## 待办事项

### 立即开始
1. 创建目录结构
2. 实现 ECS 核心（World、Entity、Component、Query、System）
3. 实现 Scheduler 和 CommandBuffer
4. 实现 6 个核心组件
5. 实现 4 个核心系统
6. 实现 ViewManager 和 AnimDriver
7. 集成到 GameApp

### 后续阶段
- 扩展组件和系统
- 表现层完善
- 配置系统
- 优化和工具

## 技术要点

### 核心接口
- **World.update(dt)** - ECS 框架提供的更新方法
- **Scheduler.stepFixed(dt)** - 固定步长更新（封装 World.update）
- **Scheduler.stepRender(dt)** - 渲染更新（封装 World.update）
- **Scheduler.flushCommandsToPresentation()** - 刷新命令到表现层
- **CommandBuffer.push(command)** - 添加命令
- **EventBus.push(event)** - 发送事件

### 关键文件
- `@bl-framework/ecs` - ECS 核心框架（已存在）
- `bridge/Scheduler.ts` - 调度器（需要实现）
- `bridge/CommandBuffer.ts` - 命令缓冲区（需要实现）
- `bridge/EventBus.ts` - 事件总线（需要实现）
- `presentation/ViewManager.ts` - 视图管理器（需要实现）
