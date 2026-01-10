# ECS SpawnView 流程设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前 SpawnView 流程存在问题：
1. **状态管理混乱：** 通过 `viewId === 0` 判断是否需要创建视图，不够明确
2. **创建失败处理：** 如果 ViewManager 创建失败，`viewId` 已被设置为 `entityId`，无法重试
3. **异步加载：** 如果 Prefab 需要异步加载，当前流程无法处理
4. **职责不清：** RenderSyncSystem 既检测创建需求，又修改组件状态

## 架构约束

1. **ECS → View：** 只能通过 CommandBuffer（RenderSyncSystem 是唯一出口）
2. **View → ECS：** 只能通过 EventBus
3. **组件状态：** 只有 Fixed Systems 可以修改组件数据
4. **Render Systems：** 只能读取组件并生成命令，不能修改组件状态

## 设计选项

### 选项 1：Tag 组件标记（推荐）⭐

**设计：** 使用 `NeedViewTag` 组件标记需要创建视图的实体

**流程：**
```
阶段 1：实体创建
  Fixed System / Game Logic → 添加 ViewLinkComponent + NeedViewTag
  ViewLinkComponent.prefabKey = 'player'
  ViewLinkComponent.viewId = 0

阶段 2：检测并发送命令
  RenderSyncSystem → 检测 NeedViewTag → 发送 SpawnView 命令
  RenderSyncSystem → 移除 NeedViewTag（标记已处理）

阶段 3：视图创建
  ViewManager → 处理 SpawnView 命令 → 创建节点
  ViewManager → 成功：EventBus.push(ViewSpawnedEvent)
  ViewManager → 失败：EventBus.push(ViewSpawnFailedEvent)

阶段 4：确认创建（可选）
  ViewSpawnSystem → 监听 ViewSpawnedEvent → 设置 viewId
  ViewSpawnSystem → 监听 ViewSpawnFailedEvent → 重新添加 NeedViewTag（允许重试）
```

**优点：**
- ✅ 状态清晰：Tag 组件明确表示"需要创建视图"
- ✅ 符合 ECS 模式：使用 Tag 组件标记状态
- ✅ 可重试：创建失败后可以重新添加 Tag
- ✅ 职责分离：RenderSyncSystem 只负责发送命令，不修改状态

**缺点：**
- ⚠️ 需要额外的 Tag 组件
- ⚠️ 需要 ViewSpawnSystem 处理确认（或通过 EventBus 回调）

**实现要点：**
1. 创建 `NeedViewTag` 组件（Tag 组件，无数据）
2. `RenderSyncSystem` 检测 `NeedViewTag`，发送 `SpawnView` 命令，移除 Tag
3. `ViewManager` 创建成功后，通过 `EventBus` 发送 `ViewSpawnedEvent`
4. 可选的 `ViewSpawnSystem` 监听事件，设置 `viewId`

---

### 选项 2：状态枚举（ViewLinkState）

**设计：** 在 `ViewLinkComponent` 中添加状态枚举

**流程：**
```
ViewLinkComponent:
  prefabKey: string
  viewId: number
  state: 'none' | 'pending' | 'spawning' | 'ready' | 'failed'

阶段 1：实体创建
  Fixed System → 添加 ViewLinkComponent
  viewLink.prefabKey = 'player'
  viewLink.state = 'pending'

阶段 2：检测并发送命令
  RenderSyncSystem → 检测 state === 'pending' → 发送 SpawnView
  RenderSyncSystem → 设置 state = 'spawning'

阶段 3：视图创建
  ViewManager → 处理 SpawnView → 创建节点
  ViewManager → 成功：EventBus.push(ViewSpawnedEvent)
  ViewManager → 失败：EventBus.push(ViewSpawnFailedEvent)

阶段 4：确认创建
  ViewSpawnSystem → 监听事件 → 设置 state = 'ready' 或 'failed'
```

**优点：**
- ✅ 状态明确：枚举值清晰表达状态
- ✅ 可追踪：可以知道视图创建到哪一步
- ✅ 可重试：失败后可以重置为 'pending'

**缺点：**
- ⚠️ 需要修改 ViewLinkComponent（添加状态字段）
- ⚠️ 需要额外的系统处理状态转换
- ⚠️ 状态管理稍复杂

---

### 选项 3：ViewManager 回调确认

**设计：** ViewManager 创建成功后，通过 EventBus 发送确认事件，ECS 系统监听并更新状态

**流程：**
```
阶段 1：实体创建
  Fixed System → 添加 ViewLinkComponent
  viewLink.prefabKey = 'player'
  viewLink.viewId = 0

阶段 2：检测并发送命令
  RenderSyncSystem → 检测 viewId === 0 && prefabKey → 发送 SpawnView
  （不修改 viewId，等待确认）

阶段 3：视图创建
  ViewManager → 处理 SpawnView → 创建节点
  ViewManager → 成功：EventBus.push(ViewSpawnedEvent { entityId, viewId })
  ViewManager → 失败：EventBus.push(ViewSpawnFailedEvent { entityId })

阶段 4：确认创建
  ViewSpawnSystem → 监听 ViewSpawnedEvent → 设置 viewId
  ViewSpawnSystem → 监听 ViewSpawnFailedEvent → 记录错误（可重试）
```

**优点：**
- ✅ 职责清晰：RenderSyncSystem 只发送命令，ViewManager 负责创建和确认
- ✅ 异步友好：可以处理异步加载的情况
- ✅ 错误处理：失败事件可以触发重试逻辑

**缺点：**
- ⚠️ 需要额外的系统（ViewSpawnSystem）处理确认
- ⚠️ 需要扩展 EventBus 的事件类型

---

### 选项 4：简化版（当前改进）

**设计：** 保持当前流程，但改进状态管理

**流程：**
```
阶段 1：实体创建
  Fixed System → 添加 ViewLinkComponent
  viewLink.prefabKey = 'player'
  viewLink.viewId = 0

阶段 2：检测并发送命令
  RenderSyncSystem → 检测 viewId === 0 && prefabKey → 发送 SpawnView
  RenderSyncSystem → 设置 viewId = -1（标记为"创建中"）

阶段 3：视图创建
  ViewManager → 处理 SpawnView → 创建节点
  ViewManager → 成功：设置 viewId = entityId（通过某种方式）
  ViewManager → 失败：保持 viewId = -1（可以重试）

阶段 4：重试机制
  RenderSyncSystem → 检测 viewId === -1（超过一定时间）→ 重试
```

**优点：**
- ✅ 改动最小：只需要修改 viewId 的状态值
- ✅ 实现简单：不需要额外的组件或系统

**缺点：**
- ❌ 状态不够明确：-1 的含义不够直观
- ❌ 重试机制需要时间判断，不够优雅
- ❌ ViewManager 需要能够设置 viewId（违反架构约束）

---

## 推荐方案：选项 1 + 选项 3 的混合（最佳实践）

**最终设计：Tag 组件 + EventBus 确认**

### 完整流程

```
阶段 1：实体创建（Fixed System）
  ┌─────────────────────────────────────┐
  │ Fixed System / Game Logic           │
  │ - 创建实体                          │
  │ - 添加 ViewLinkComponent            │
  │   prefabKey = 'player'              │
  │   viewId = 0                        │
  │ - 添加 NeedViewTag（标记需要视图）  │
  └─────────────────────────────────────┘

阶段 2：检测并发送命令（RenderSyncSystem）
  ┌─────────────────────────────────────┐
  │ RenderSyncSystem (Render, 100)     │
  │ - 查询有 NeedViewTag 的实体        │
  │ - 发送 SpawnView 命令               │
  │ - 移除 NeedViewTag（避免重复）     │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ CommandBuffer                       │
  │ - 收集 SpawnView 命令               │
  └─────────────────────────────────────┘

阶段 3：视图创建（ViewManager）
  ┌─────────────────────────────────────┐
  │ ViewManager                         │
  │ - 处理 SpawnView 命令               │
  │ - 从 ViewPool 获取节点              │
  │ - 添加到场景                        │
  │ - 绑定节点                          │
  │ - 成功：EventBus.push(ViewSpawned)  │
  │ - 失败：EventBus.push(ViewSpawnFailed)│
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ EventBus                            │
  │ - ViewSpawnedEvent { entityId }     │
  │ - ViewSpawnFailedEvent { entityId }  │
  └─────────────────────────────────────┘

阶段 4：确认创建（ViewSpawnSystem，可选）
  ┌─────────────────────────────────────┐
  │ ViewSpawnSystem (Fixed, priority: 4)│
  │ - 监听 ViewSpawnedEvent             │
  │ - 设置 viewId = entityId            │
  │ - 监听 ViewSpawnFailedEvent         │
  │ - 重新添加 NeedViewTag（允许重试）  │
  └─────────────────────────────────────┘
```

### 设计决策

#### 1. NeedViewTag 组件（Tag 组件）

```typescript
@component({ name: 'NeedViewTag', pooled: false })
export class NeedViewTagComponent extends Component {
    // Tag 组件，无数据，只用于标记
}
```

**用途：** 标记实体需要创建视图

#### 2. RenderSyncSystem 修改

```typescript
// 检测需要创建视图的实体
const spawnQuery = this.world.createQuery({
    all: [ViewLinkComponent, NeedViewTagComponent]
});
spawnQuery.forEach(entity => {
    const viewLink = entity.getComponent(ViewLinkComponent)!;
    
    if (viewLink.prefabKey) {
        // 发送 SpawnView 命令
        this.commandBuffer.push({
            type: 'SpawnView',
            entityId: entity.id,
            prefabKey: viewLink.prefabKey
        });
        
        // 移除 Tag，避免重复发送命令
        entity.removeComponent(NeedViewTagComponent);
    }
});
```

#### 3. ViewManager 修改

```typescript
private spawnView(entityId: number, prefabKey: string): void {
    // ... 创建节点逻辑 ...
    
    if (node) {
        // 成功：发送确认事件
        this.eventBus.push({
            type: 'ViewEvent',
            eventName: 'ViewSpawned',
            entityId: entityId
        });
    } else {
        // 失败：发送失败事件
        this.eventBus.push({
            type: 'ViewEvent',
            eventName: 'ViewSpawnFailed',
            entityId: entityId
        });
    }
}
```

#### 4. ViewSpawnSystem（可选，Fixed System）

```typescript
@system({ priority: 4 })
export class ViewSpawnSystem extends System {
    private eventBus?: EventBus;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.eventBus.subscribe('ViewEvent', this.handleViewEvent.bind(this));
    }

    private handleViewEvent(event: GameplayEvent): void {
        if (event.type === 'ViewEvent') {
            if (event.eventName === 'ViewSpawned') {
                const entity = this.world.getEntityById?.(event.entityId);
                if (entity) {
                    const viewLink = entity.getComponent(ViewLinkComponent);
                    if (viewLink) {
                        viewLink.viewId = event.entityId;
                    }
                }
            } else if (event.eventName === 'ViewSpawnFailed') {
                // 记录错误，重新添加 Tag 允许重试
                const entity = this.world.getEntityById?.(event.entityId);
                if (entity && !entity.hasComponent(NeedViewTagComponent)) {
                    entity.addComponent(NeedViewTagComponent);
                }
                console.warn(`[ViewSpawnSystem] Failed to spawn view for entity ${event.entityId}`);
            }
        }
    }
}
```

#### 5. EventBus 扩展

```typescript
export type GameplayEvent =
    | { type: 'AnimationEvent'; entityId: number; eventName: string; data?: any }
    | { type: 'CollisionEvent'; entityA: number; entityB: number; data?: any }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; eventName: 'ViewSpawned' | 'ViewSpawnFailed'; entityId: number }; // 新增
```

### 优势总结

1. **状态清晰：** Tag 组件明确表示"需要创建视图"
2. **职责分离：** RenderSyncSystem 只发送命令，ViewManager 负责创建和确认
3. **可重试：** 创建失败后可以重新添加 NeedViewTag
4. **异步友好：** 可以处理异步加载的情况
5. **符合架构：** 完全符合 ECS → View（CommandBuffer）和 View → ECS（EventBus）的约束
6. **可扩展：** 可以轻松添加重试逻辑、超时处理等

### 使用示例

```typescript
// 创建实体并标记需要视图
const player = world.createEntity('Player');
const viewLink = player.addComponent(ViewLinkComponent);
viewLink.prefabKey = 'player';
viewLink.viewId = 0;
player.addComponent(NeedViewTagComponent); // 标记需要创建视图

// RenderSyncSystem 会自动检测并发送 SpawnView 命令
// ViewManager 会创建视图并发送确认事件
// ViewSpawnSystem（可选）会设置 viewId
```

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [ ] 创建 `NeedViewTagComponent`（Tag 组件）
- [ ] 修改 `RenderSyncSystem`（检测 Tag，发送命令，移除 Tag）
- [ ] 修改 `ViewManager`（发送确认事件）
- [ ] 扩展 `EventBus`（添加 ViewEvent 类型）
- [ ] 创建 `ViewSpawnSystem`（可选，处理确认）
- [ ] 更新测试场景（使用 NeedViewTag）
- [ ] 编写单元测试
- [ ] 更新文档

## 参考

- 架构约束：`memory-bank/systemPatterns.md`
- 事件总线：`assets/scripts/bridge/EventBus.ts`
- 命令缓冲区：`assets/scripts/bridge/CommandBuffer.ts`
- 视图管理器：`assets/scripts/presentation/ViewManager.ts`
