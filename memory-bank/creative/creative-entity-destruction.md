# 实体销毁流程设计

**状态：** ✅ 设计完成（等待实施）

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前实体死亡和销毁流程存在问题：
1. **当前流程：** DeathSystem → RenderSyncSystem → CommandBuffer → ViewManager → 立即销毁
2. **问题：** 没有等待死亡动画完成就销毁了实体和视图
3. **需求：** 需要等待死亡动画播放完成后，再销毁实体和视图

## 架构约束

1. **ECS → View：** 只能通过 CommandBuffer（RenderSyncSystem 是唯一出口）
2. **View → ECS：** 只能通过 EventBus
3. **动画事件：** AnimDriver 负责监听动画事件并发送到 EventBus
4. **系统职责分离：** Fixed Systems 处理逻辑，Render Systems 处理表现

## 设计选项

### 选项 1：两阶段销毁（动画事件驱动）⭐ 推荐

**流程：**
```
阶段 1：死亡检测和动画播放
  DeathSystem → 添加 DeadTag
  RenderSyncSystem → 检测 DeadTag → 发送 PlayAnim('die') 命令
  ViewManager → 播放死亡动画

阶段 2：动画完成和实体销毁
  AnimDriver → 监听动画完成事件 → EventBus.push(AnimationEvent('die_complete', entityId))
  DestroySystem → 监听 AnimationEvent('die_complete') → 销毁实体 → 发送 DestroyView 命令
  ViewManager → 销毁视图节点
```

**优点：**
- ✅ 完全符合架构约束（View → ECS 通过 EventBus）
- ✅ 职责清晰：DeathSystem 检测死亡，DestroySystem 处理销毁
- ✅ 解耦性好：动画完成事件驱动，不依赖时间
- ✅ 可扩展：可以支持其他销毁触发条件（如超时、手动销毁等）

**缺点：**
- ⚠️ 需要实现动画事件监听（AnimDriver）
- ⚠️ 如果动画事件丢失，实体可能永远不会被销毁（需要超时保护）

**实现要点：**
1. 新增 `DestroySystem`（Fixed System，priority: 3）
2. `AnimDriver` 监听动画完成事件，发送 `AnimationEvent('die_complete', entityId)`
3. `RenderSyncSystem` 检测到 `DeadTag` 时，只发送 `PlayAnim('die')`，不发送 `DestroyView`
4. `DestroySystem` 监听 `AnimationEvent('die_complete')`，销毁实体并发送 `DestroyView` 命令

---

### 选项 2：DestroyTimer + 动画事件（混合方案）

**流程：**
```
阶段 1：死亡检测和动画播放
  DeathSystem → 添加 DeadTag + DestroyTimer(默认 2 秒)
  RenderSyncSystem → 检测 DeadTag → 发送 PlayAnim('die') 命令
  ViewManager → 播放死亡动画

阶段 2：销毁触发（两种方式）
  方式 A：动画完成事件（优先）
    AnimDriver → EventBus.push(AnimationEvent('die_complete', entityId))
    DestroySystem → 立即销毁实体和视图
  
  方式 B：超时保护（兜底）
    DestroySystem → 检测 DestroyTimer 到期 → 销毁实体和视图
```

**优点：**
- ✅ 有超时保护，不会因为动画事件丢失导致实体永远不销毁
- ✅ 动画完成时立即销毁，响应快
- ✅ 复用现有的 DestroyTimer 组件

**缺点：**
- ⚠️ 需要同时处理两种触发条件，逻辑稍复杂
- ⚠️ 如果动画时间超过 DestroyTimer，可能提前销毁

**实现要点：**
1. `DeathSystem` 添加 `DeadTag` 时，同时添加 `DestroyTimer`（默认 2 秒）
2. `DestroySystem` 同时监听 `AnimationEvent('die_complete')` 和 `DestroyTimer` 到期
3. 任一条件满足即销毁实体

---

### 选项 3：状态机（DestroyingTag）

**流程：**
```
阶段 1：死亡检测
  DeathSystem → 添加 DeadTag
  RenderSyncSystem → 检测 DeadTag → 发送 PlayAnim('die') 命令 + 添加 DestroyingTag

阶段 2：动画完成
  AnimDriver → EventBus.push(AnimationEvent('die_complete', entityId))
  DestroySystem → 检测 DestroyingTag + 动画完成事件 → 销毁实体和视图
```

**优点：**
- ✅ 使用状态标记，逻辑清晰
- ✅ 可以区分"已死亡"和"正在销毁"两个状态

**缺点：**
- ⚠️ 需要额外的状态组件（DestroyingTag）
- ⚠️ 如果动画事件丢失，实体可能永远不会被销毁

---

### 选项 4：纯时间驱动（DestroyTimer）

**流程：**
```
阶段 1：死亡检测
  DeathSystem → 添加 DeadTag + DestroyTimer(动画时长)
  RenderSyncSystem → 检测 DeadTag → 发送 PlayAnim('die') 命令

阶段 2：超时销毁
  DestroySystem → 检测 DestroyTimer 到期 → 销毁实体和视图
```

**优点：**
- ✅ 实现简单，不需要动画事件
- ✅ 可靠，不会因为事件丢失导致问题

**缺点：**
- ❌ 不够精确：如果动画实际播放时间与预期不符，可能提前或延后销毁
- ❌ 需要手动配置每个实体的动画时长

---

## 推荐方案：选项 1 + 选项 2 的混合（最佳实践）

**最终设计：两阶段销毁 + 超时保护**

### 完整流程

```
阶段 1：死亡检测和动画播放
  ┌─────────────────────────────────────┐
  │ DeathSystem (Fixed, priority: 2)   │
  │ - 检测 HP.isDead                    │
  │ - 添加 DeadTag                      │
  │ - 添加 DestroyTimer(默认 3 秒)     │ ← 超时保护
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ RenderSyncSystem (Render, 100)     │
  │ - 检测 DeadTag                      │
  │ - 发送 PlayAnim('die') 命令         │
  │ - 不发送 DestroyView（等待动画）    │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ ViewManager                         │
  │ - 播放死亡动画                      │
  └─────────────────────────────────────┘

阶段 2：动画完成和实体销毁
  ┌─────────────────────────────────────┐
  │ AnimDriver                          │
  │ - 监听动画完成事件                  │
  │ - EventBus.push(AnimationEvent)    │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ DestroySystem (Fixed, priority: 3) │
  │ - 监听 AnimationEvent('die_complete')│
  │ - 或检测 DestroyTimer 到期          │
  │ - 销毁实体                          │
  │ - 发送 DestroyView 命令            │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ ViewManager                         │
  │ - 销毁视图节点                      │
  │ - 回收到 ViewPool                  │
  └─────────────────────────────────────┘
```

### 设计决策

1. **DestroySystem（新增）**
   - Fixed System，priority: 3（在 DeathSystem 之后执行）
   - 监听 `AnimationEvent('die_complete', entityId)`
   - 同时检测 `DestroyTimer` 到期（超时保护）
   - 销毁实体：`world.destroyEntity(entityId)`
   - 发送 `DestroyView` 命令到 CommandBuffer

2. **DeathSystem（修改）**
   - 添加 `DeadTag` 时，同时添加 `DestroyTimer`（默认 3 秒）
   - 提供配置选项：`destroyDelay`（可配置）

3. **RenderSyncSystem（修改）**
   - 检测到 `DeadTag` 时，只发送 `PlayAnim('die')` 命令
   - **不再发送** `DestroyView` 命令（由 DestroySystem 负责）

4. **AnimDriver（增强）**
   - 监听动画完成事件（Cocos Creator Animation 的 `finished` 事件）
   - 发送 `AnimationEvent('die_complete', entityId)` 到 EventBus
   - 需要知道 entityId（通过 NodeBinder 反向查找）

5. **EventBus（扩展）**
   - 已有 `AnimationEvent` 类型，支持 `eventName: 'die_complete'`

### 实现细节

#### 1. DestroySystem 实现

```typescript
@system({ priority: 3 })
export class DestroySystem extends System {
    private commandBuffer?: CommandBuffer;
    private eventBus?: EventBus;

    setCommandBuffer(commandBuffer: CommandBuffer): void {
        this.commandBuffer = commandBuffer;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        // 订阅动画完成事件
        this.eventBus.subscribe('AnimationEvent', this.handleAnimationEvent.bind(this));
    }

    onUpdate(dt: number): void {
        // 方式 1：检测 DestroyTimer 到期（超时保护）
        const timerQuery = this.world.createQuery({
            all: [DestroyTimerComponent]
        });
        timerQuery.forEach(entity => {
            const timer = entity.getComponent(DestroyTimerComponent)!;
            timer.time -= dt;
            if (timer.isExpired) {
                this.destroyEntity(entity.id);
            }
        });
    }

    private handleAnimationEvent(event: GameplayEvent): void {
        if (event.type === 'AnimationEvent' && event.eventName === 'die_complete') {
            this.destroyEntity(event.entityId);
        }
    }

    private destroyEntity(entityId: number): void {
        // 检查实体是否存在且有 DeadTag
        const entity = this.world.getEntityById?.(entityId);
        if (!entity || !entity.hasComponent(DeadTagComponent)) {
            return;
        }

        // 销毁实体
        this.world.destroyEntity(entityId);

        // 发送 DestroyView 命令
        if (this.commandBuffer) {
            this.commandBuffer.push({
                type: 'DestroyView',
                entityId: entityId
            });
        }
    }
}
```

#### 2. DeathSystem 修改

```typescript
@system({ priority: 2 })
export class DeathSystem extends System {
    private defaultDestroyDelay: number = 3.0; // 默认 3 秒超时

    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [HPComponent],
            none: [DeadTagComponent]
        });

        query.forEach(entity => {
            const hp = entity.getComponent(HPComponent)!;
            if (hp.isDead) {
                // 添加死亡标记
                entity.addComponent(DeadTagComponent);
                
                // 添加销毁计时器（超时保护）
                const timer = entity.addComponent(DestroyTimerComponent);
                timer.setTime(this.defaultDestroyDelay);
            }
        });
    }
}
```

#### 3. RenderSyncSystem 修改

```typescript
// DeadTag → PlayDieAnim 命令（不再发送 DestroyView）
const deadQuery = this.world.createQuery({
    all: [DeadTagComponent, ViewLinkComponent]
});
deadQuery.forEach(entity => {
    const viewLink = entity.getComponent(ViewLinkComponent)!;
    if (viewLink.viewId > 0) {
        // 只播放死亡动画，不销毁视图
        this.commandBuffer.push({
            type: 'PlayAnim',
            entityId: entity.id,
            animName: 'die'
        });
    }
});
```

#### 4. AnimDriver 增强

```typescript
export class AnimDriver {
    private nodeBinder: NodeBinder; // 需要反向查找 entityId

    playAnim(node: Node, animName: string): void {
        const animation = this.nodeAnimMap.get(node);
        if (animation) {
            animation.play(animName);
            
            // 监听动画完成事件
            if (animName === 'die') {
                animation.once(Animation.EventType.FINISHED, () => {
                    const entityId = this.nodeBinder.getEntityId(node);
                    if (entityId) {
                        this.sendAnimationEvent(entityId, 'die_complete');
                    }
                });
            }
        }
    }
}
```

### 优势总结

1. **架构合规：** 完全符合 ECS → View（CommandBuffer）和 View → ECS（EventBus）的约束
2. **职责清晰：** DeathSystem 检测死亡，DestroySystem 处理销毁，RenderSyncSystem 同步表现
3. **可靠性：** 超时保护确保实体不会永远不销毁
4. **精确性：** 动画完成事件确保动画播放完整
5. **可扩展：** 可以支持其他销毁触发条件（如手动销毁、条件销毁等）

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [ ] 创建 `DestroySystem.ts`
- [ ] 修改 `DeathSystem.ts`（添加 DestroyTimer）
- [ ] 修改 `RenderSyncSystem.ts`（移除立即销毁逻辑）
- [ ] 增强 `AnimDriver.ts`（监听动画完成事件）
- [ ] 更新 `GameApp.ts`（注册 DestroySystem）
- [ ] 更新 `Scheduler.ts`（注册 DestroySystem 到 Fixed Systems）
- [ ] 编写单元测试
- [ ] 更新文档

## 参考

- 架构约束：`memory-bank/systemPatterns.md`
- 事件总线：`assets/scripts/bridge/EventBus.ts`
- 命令缓冲区：`assets/scripts/bridge/CommandBuffer.ts`
