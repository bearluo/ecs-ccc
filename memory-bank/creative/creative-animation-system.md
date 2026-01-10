# 动画系统完善设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前动画系统存在以下问题：
1. **AnimDriver 功能不完整：** 只有基础的 `playAnim`，缺少动画事件监听
2. **动画状态管理不完善：** `AnimState.locked` 没有自动管理机制
3. **动画完成事件缺失：** 无法知道动画何时完成（影响死亡动画销毁流程）
4. **动画资源管理缺失：** 没有统一的动画资源加载和管理
5. **动画播放控制缺失：** 缺少停止、暂停、恢复等控制功能

## ⚠️ 关键问题（已修正）

### 问题 1：entityId 复用导致异步事件错误（致命）🔴
- **问题：** AnimDriver 使用 `entityId: number`，但 entityId 会复用，动画是异步的
- **后果：** 死亡动画播完 → finished → 解锁的是新实体（最难排查的 bug）
- **修正：** 使用 `Handle` 而不是 `entityId`

### 问题 2：O(N) 实体查找（性能 + 逻辑错误）🔴
- **问题：** AnimationEventSystem 遍历 Query 查找实体
- **后果：** 性能差，强依赖 id，违反 ECS 最佳实践
- **修正：** 使用 `world.getEntityByHandle` (O(1))

### 问题 3：状态双源（状态分裂）🔴
- **问题：** ECS 和 View 都维护 locked 状态
- **后果：** 状态不一致，难以排查
- **修正：** 锁定状态的权威只在 ECS（AnimStateComponent）

### 问题 4：事件命名混乱🔴
- **问题：** finished / unlock / die_complete 混用
- **后果：** AnimationEventSystem 变成 if-else 地狱
- **修正：** 统一为 `finished`（完成）和 `marker`（事件点）两类

## 架构约束

1. **ECS → View：** 只能通过 CommandBuffer（RenderSyncSystem 是唯一出口）
2. **View → ECS：** 只能通过 EventBus
3. **AnimState 唯一写入：** 只有 AnimationIntentSystem 能修改 AnimState
4. **职责分离：** Fixed Systems 表达意图，Render Systems 处理表现
5. **Handle 优先：** 所有异步操作必须使用 Handle，禁止使用 entityId
6. **状态权威在 ECS：** 锁定状态的权威只在 ECS，View 层不维护锁定状态
7. **O(1) 实体查找：** 使用 `world.getEntityByHandle`，禁止遍历 Query 查找实体

## 设计选项

### 选项 1：完整动画驱动（推荐）⭐

**设计：** 完善 AnimDriver，添加完整的动画事件监听和状态管理

**核心功能：**
1. **动画资源管理**
   - 从 Node 自动获取 Animation 组件
   - 支持动画资源缓存
   - 支持动画配置（速度、循环等）

2. **动画事件监听**
   - 监听动画开始（`play`）
   - 监听动画完成（`finished`）
   - 监听动画事件点（`AnimationClip` 中的事件）
   - 通过 EventBus 回传事件到 ECS

3. **动画状态同步**
   - 根据动画状态自动设置 `AnimState.locked`
   - 支持动画完成后的自动解锁

4. **动画播放控制**
   - 播放、停止、暂停、恢复
   - 设置播放速度
   - 设置循环模式

**优点：**
- ✅ 功能完整，满足所有动画需求
- ✅ 符合架构约束（View → ECS 通过 EventBus）
- ✅ 支持动画完成事件（可用于死亡动画销毁）
- ✅ 自动管理动画状态

**缺点：**
- ⚠️ 实现复杂度中等
- ⚠️ 需要深入了解 Cocos Creator Animation API

---

### 选项 2：简化版（最小实现）

**设计：** 只实现必要的功能，其他功能后续扩展

**核心功能：**
1. 动画播放
2. 动画完成事件监听
3. 基本的动画状态管理

**优点：**
- ✅ 实现简单快速
- ✅ 满足当前需求

**缺点：**
- ❌ 功能不完整，后续需要扩展
- ❌ 可能影响未来开发效率

---

### 选项 3：动画管理器（集中管理）

**设计：** 创建独立的 AnimationManager，统一管理所有动画

**核心功能：**
1. 动画资源池
2. 动画状态机
3. 动画事件分发
4. 动画配置管理

**优点：**
- ✅ 集中管理，易于扩展
- ✅ 支持复杂的动画逻辑

**缺点：**
- ⚠️ 实现复杂
- ⚠️ 可能过度设计

---

## 推荐方案：选项 1（完整动画驱动）

**最终设计：完善 AnimDriver + 动画状态同步**

### 完整流程

```
阶段 1：动画意图设置（Fixed Systems）
  ┌─────────────────────────────────────┐
  │ Fixed Systems                       │
  │ - MoveSystem → setContinuousIntent('move')│
  │ - CombatSystem → trigger('attack')  │
  │ - DeathSystem → trigger('die')     │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ AnimationIntentComponent             │
  │ - continuousIntent / triggerIntent   │
  └─────────────────────────────────────┘

阶段 2：意图转换（AnimationIntentSystem）
  ┌─────────────────────────────────────┐
  │ AnimationIntentSystem (Render, 100) │
  │ - 读取 AnimationIntent              │
  │ - 更新 AnimState.current            │
  │ - 设置 AnimState.locked（触发动画） │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ AnimStateComponent                  │
  │ - current: 'attack'                  │
  │ - locked: true                      │
  └─────────────────────────────────────┘

阶段 3：命令生成（RenderSyncSystem）
  ┌─────────────────────────────────────┐
  │ RenderSyncSystem (Render, 100)      │
  │ - 检测 AnimState 变化               │
  │ - 发送 PlayAnim 命令                │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ CommandBuffer                       │
  │ - PlayAnim { entityId, animName }   │
  └─────────────────────────────────────┘

阶段 4：动画播放（ViewManager + AnimDriver）
  ┌─────────────────────────────────────┐
  │ ViewManager                         │
  │ - 处理 PlayAnim 命令                │
  │ - 调用 AnimDriver.playAnim()        │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ AnimDriver                          │
  │ - 播放动画                           │
  │ - 监听动画事件                       │
  │ - 发送 AnimationEvent 到 EventBus   │
  └─────────────────────────────────────┘
           ↓
  ┌─────────────────────────────────────┐
  │ EventBus                            │
  │ - AnimationEvent('finished', ...)   │
  │ - AnimationEvent('event', ...)       │
  └─────────────────────────────────────┘

阶段 5：事件处理（ECS Systems）
  ┌─────────────────────────────────────┐
  │ AnimationEventSystem (Fixed, 5)      │
  │ - 监听 AnimationEvent               │
  │ - 处理动画完成事件                   │
  │ - 解锁 AnimState.locked             │
  │ - 触发销毁流程（死亡动画）           │
  └─────────────────────────────────────┘
```

### 设计决策

#### 1. AnimDriver 完善

**⚠️ 关键修正：使用 Handle 而不是 entityId**

```typescript
import { Handle } from '@bl-framework/ecs';

export class AnimDriver {
    private eventBus: EventBus;
    private nodeBinder: NodeBinder; // 用于反向查找 Handle
    private nodeAnimMap: Map<Node, Animation> = new Map();
    private animInfoMap: Map<Node, AnimInfo> = new Map(); // 只记录播放信息，不记录锁定状态

    /**
     * 设置 NodeBinder（用于反向查找 Handle）
     */
    setNodeBinder(nodeBinder: NodeBinder): void {
        this.nodeBinder = nodeBinder;
    }

    /**
     * 为 Node 设置动画组件（自动从 Node 获取）
     */
    setupAnimation(node: Node): void {
        const animation = node.getComponent(Animation);
        if (animation) {
            this.nodeAnimMap.set(node, animation);
            this.setupAnimationEvents(node, animation);
        }
    }

    /**
     * 设置动画事件监听
     */
    private setupAnimationEvents(node: Node, animation: Animation): void {
        // 监听动画完成事件
        animation.on(Animation.EventType.FINISHED, () => {
            this.onAnimationFinished(node);
        });

        // 监听动画事件点（AnimationClip 中的事件）
        // TODO: 根据 Cocos Creator API 实现
    }

    /**
     * 播放动画
     */
    playAnim(node: Node, animName: string, speed: number = 1.0, loop: boolean = false): void {
        const animation = this.nodeAnimMap.get(node);
        if (!animation) {
            // 尝试自动获取
            this.setupAnimation(node);
            return;
        }

        const state = animation.getState(animName);
        if (state) {
            state.speed = speed;
            state.wrapMode = loop ? WrapMode.Loop : WrapMode.Normal;
            animation.play(animName);

            // 只记录播放信息（不记录锁定状态，锁定状态由 ECS 管理）
            this.animInfoMap.set(node, {
                currentAnim: animName,
                isPlaying: true
            });
        }
    }

    /**
     * 停止动画
     */
    stopAnim(node: Node): void {
        const animation = this.nodeAnimMap.get(node);
        if (animation) {
            animation.stop();
            this.animInfoMap.delete(node);
        }
    }

    /**
     * 动画完成回调
     */
    private onAnimationFinished(node: Node): void {
        const info = this.animInfoMap.get(node);
        if (!info) return;

        // ⚠️ 关键：使用 Handle 而不是 entityId
        const handle = this.nodeBinder.getHandle(node);
        if (handle) {
            // 发送通用动画完成事件（不区分类型，由 ECS 判断）
            this.sendAnimationFinished(handle, info.currentAnim);
        }

        // 清除状态
        this.animInfoMap.delete(node);
    }

    /**
     * 发送动画完成事件（使用 Handle）
     */
    private sendAnimationFinished(handle: Handle, animName: string): void {
        this.eventBus.push({
            type: 'AnimationEvent',
            eventName: 'finished',
            handle: handle, // 使用 Handle 而不是 entityId
            data: { animName }
        });
    }

    /**
     * 发送动画事件点（使用 Handle）
     */
    private sendAnimationMarker(handle: Handle, marker: string, data?: any): void {
        this.eventBus.push({
            type: 'AnimationEvent',
            eventName: 'marker',
            handle: handle, // 使用 Handle 而不是 entityId
            data: { marker, ...data }
        });
    }
}

interface AnimInfo {
    currentAnim: string;
    isPlaying: boolean;
    // ⚠️ 不包含 isLocked，锁定状态由 ECS 的 AnimStateComponent 管理
}
```

#### 2. AnimationEventSystem（新增，Fixed System）

**⚠️ 关键修正：使用 world.getEntityByHandle (O(1)) 而不是遍历 Query**

```typescript
import { Handle } from '@bl-framework/ecs';

@system({ priority: 5 })
export class AnimationEventSystem extends System {
    private eventBus?: EventBus;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.eventBus.subscribe('AnimationEvent', this.handleAnimationEvent.bind(this));
    }

    private handleAnimationEvent(event: GameplayEvent): void {
        if (event.type === 'AnimationEvent') {
            // ⚠️ 关键：使用 Handle 获取实体（O(1) 操作）
            if (!event.handle || !this.world.isValidHandle(event.handle)) {
                return;
            }

            const entity = this.world.getEntityByHandle(event.handle);
            if (!entity) return;

            const animState = entity.getComponent(AnimStateComponent);
            if (!animState) return;

            if (event.eventName === 'finished') {
                // 动画完成事件
                const animName = event.data?.animName;
                
                // 只有当前动画匹配时才解锁（防止异步事件导致的状态错误）
                if (animState.current === animName && animState.locked) {
                    animState.locked = false;
                }
            } else if (event.eventName === 'marker') {
                // 动画事件点（如 'hit'、'footstep'）
                const marker = event.data?.marker;
                // 可以触发其他系统（如伤害判定、音效等）
                // 这里只处理通用逻辑，具体业务由其他系统处理
            }
        }
    }
}
```

#### 3. ViewManager 修改

```typescript
private playAnim(entityId: number, animName: string): void {
    const node = this.entityNodeMap.get(entityId);
    if (!node) return;

    // 获取 AnimState 以获取动画速度
    const entity = this.getEntityById(entityId); // 需要通过查询获取
    const animState = entity?.getComponent(AnimStateComponent);
    const speed = animState?.speed || 1.0;

    // 判断是否循环（持续动画循环，触发动画不循环）
    const isLoop = this.isContinuousAnim(animName);

    // 通过 AnimDriver 播放动画
    this.animDriver.playAnim(node, animName, speed, isLoop);
}

private isContinuousAnim(animName: string): boolean {
    const continuousAnims = ['idle', 'move', 'run'];
    return continuousAnims.includes(animName);
}
```

#### 4. AnimationIntentSystem 修改

```typescript
onUpdate(dt: number): void {
    const query = this.world.createQuery({
        all: [AnimationIntentComponent, AnimStateComponent]
    });

    query.forEach(entity => {
        const animIntent = entity.getComponent(AnimationIntentComponent)!;
        const animState = entity.getComponent(AnimStateComponent)!;

        // 如果动画被锁定，不更新（等待动画完成）
        if (animState.locked) {
            return;
        }

        // 优先处理触发意图（一次性动画，如 attack、hurt、die）
        if (animIntent.triggerIntent) {
            const triggerAnim = animIntent.triggerIntent;
            const triggerPriority = this.getPriority(triggerAnim);
            const currentPriority = this.getPriority(animState.current);

            // 如果触发动画优先级更高，切换动画并锁定
            if (triggerPriority > currentPriority) {
                animState.current = triggerAnim;
                animState.locked = true; // 锁定，等待动画完成
                
                // 从参数中读取动画速度（如果有）
                if (animIntent.params.speed !== undefined) {
                    animState.speed = animIntent.params.speed;
                }
            }

            // 清除触发意图（已处理）
            animIntent.clearTrigger();
        } else {
            // 处理持续意图（如 move、idle）
            const continuousAnim = animIntent.continuousIntent;
            const continuousPriority = this.getPriority(continuousAnim);
            const currentPriority = this.getPriority(animState.current);

            // 如果持续动画优先级更高，切换动画（不锁定）
            if (continuousPriority > currentPriority) {
                animState.current = continuousAnim;
                
                // 从参数中读取动画速度（如果有）
                if (animIntent.params.speed !== undefined) {
                    animState.speed = animIntent.params.speed;
                }
            }
        }
    });
}
```

#### 3. NodeBinder 修改

**⚠️ 关键修正：返回 Handle 而不是 entityId**

```typescript
import { Handle } from '@bl-framework/ecs';

export class NodeBinder {
    /** Node → Handle 映射 */
    private nodeHandleMap: Map<Node, Handle> = new Map();

    /**
     * 绑定 Node 到 Handle
     */
    bind(node: Node, handle: Handle): void {
        this.nodeHandleMap.set(node, handle);
    }

    /**
     * 获取 Node 对应的 Handle
     */
    getHandle(node: Node): Handle | undefined {
        return this.nodeHandleMap.get(node);
    }

    /**
     * 解绑 Node
     */
    unbind(node: Node): void {
        this.nodeHandleMap.delete(node);
    }

    clear(): void {
        this.nodeHandleMap.clear();
    }
}
```

#### 4. EventBus 扩展

**⚠️ 关键修正：AnimationEvent 使用 Handle**

```typescript
export type GameplayEvent =
    | { type: 'AnimationEvent'; eventName: 'finished' | 'marker'; handle: Handle; data?: any }
    | { type: 'CollisionEvent'; entityA: number; entityB: number; data?: any }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; eventName: 'ViewSpawned' | 'ViewSpawnFailed'; entityId: number };
```

#### 5. ViewManager 修改

```typescript
private spawnView(entityId: number, prefabKey: string): void {
    // ... 创建节点逻辑 ...
    
    // ⚠️ 关键：绑定时使用 entity.handle 而不是 entity.id
    const entity = this.getEntityById(entityId); // 需要通过查询获取
    if (entity) {
        this.nodeBinder.bind(node, entity.handle);
    }
}

private playAnim(entityId: number, animName: string): void {
    const node = this.entityNodeMap.get(entityId);
    if (!node) return;

    // 获取 AnimState 以获取动画速度
    const entity = this.getEntityById(entityId);
    const animState = entity?.getComponent(AnimStateComponent);
    const speed = animState?.speed || 1.0;

    // 判断是否循环（持续动画循环，触发动画不循环）
    const isLoop = this.isContinuousAnim(animName);

    // 通过 AnimDriver 播放动画
    this.animDriver.playAnim(node, animName, speed, isLoop);
}
```

#### 6. 动画配置（可选，MVP 后实现）

```typescript
// assets/scripts/data/configs/animations.ts
export interface AnimationConfig {
    name: string;
    loop: boolean;
    defaultSpeed: number;
    markers?: string[]; // 动画事件点名称
}

export const AnimationConfigs: Record<string, AnimationConfig> = {
    'idle': { name: 'idle', loop: true, defaultSpeed: 1.0 },
    'move': { name: 'move', loop: true, defaultSpeed: 1.0 },
    'attack': { name: 'attack', loop: false, defaultSpeed: 1.0, markers: ['hit'] },
    'die': { name: 'die', loop: false, defaultSpeed: 1.0 },
    // ...
};
```

### 关键设计原则

1. **Handle 优先：** 所有异步操作必须使用 Handle，禁止使用 entityId
2. **状态权威在 ECS：** AnimState.locked 的权威状态只在 ECS，View 层不维护锁定状态
3. **O(1) 实体查找：** 使用 `world.getEntityByHandle`，禁止遍历 Query 查找实体
4. **事件语义清晰：** 动画事件只分两类：`finished`（完成）和 `marker`（事件点），不区分业务语义

### 优势总结

1. **功能完整：** 支持动画播放、事件监听、状态管理
2. **架构合规：** 完全符合 ECS → View（CommandBuffer）和 View → ECS（EventBus）的约束
3. **状态管理正确：** 锁定状态的权威在 ECS，避免状态分裂
4. **异步安全：** 使用 Handle 避免 entityId 复用导致的异步事件错误
5. **性能优化：** O(1) 实体查找，符合 ECS 最佳实践
6. **支持销毁流程：** 动画完成事件可用于死亡动画销毁
7. **可扩展：** 支持动画配置、事件点等高级功能

### 使用示例

```typescript
// 1. Fixed System 设置动画意图
const intent = entity.getComponent(AnimationIntentComponent);
intent.trigger('attack'); // 触发攻击动画

// 2. AnimationIntentSystem 更新 AnimState
// animState.current = 'attack'
// animState.locked = true（自动锁定）

// 3. RenderSyncSystem 发送 PlayAnim 命令

// 4. ViewManager 调用 AnimDriver.playAnim()

// 5. AnimDriver 播放动画并监听完成事件
// 注意：AnimDriver 不维护 locked 状态，只记录播放信息

// 6. 动画完成 → EventBus.push(AnimationEvent('finished', handle))
// ⚠️ 使用 Handle 而不是 entityId

// 7. AnimationEventSystem 通过 handle 获取实体（O(1)）
// 8. 检查当前动画是否匹配，解锁 AnimState.locked
```

### 死亡动画销毁流程（完整示例）

```typescript
// 阶段 1：死亡检测
DeathSystem → entity.addComponent(DeadTagComponent)
DeathSystem → intent.trigger('die')

// 阶段 2：动画播放
AnimationIntentSystem → animState.current = 'die', animState.locked = true
RenderSyncSystem → PlayAnim('die')
AnimDriver → 播放死亡动画

// 阶段 3：动画完成
AnimDriver → AnimationEvent('finished', handle, { animName: 'die' })
AnimationEventSystem → 检查 animState.current === 'die' → 解锁
DestroySystem → 监听 AnimationEvent('finished') + 检查 DeadTag → 销毁实体
```

## 🎨🎨🎨 EXITING CREATIVE PHASE

## ⚠️ 关键修正点

### 必改项（不改一定翻车）

1. **AnimDriver 使用 Handle**
   - ❌ `sendAnimationEvent(entityId: number, ...)`
   - ✅ `sendAnimationEvent(handle: Handle, ...)`
   - ✅ NodeBinder 返回 Handle 而不是 entityId

2. **AnimationEventSystem 使用 O(1) 查找**
   - ❌ 遍历 Query 查找实体
   - ✅ `world.getEntityByHandle(event.handle)`

3. **移除 AnimDriver 的锁定状态**
   - ❌ `animStateMap.isLocked`
   - ✅ 只记录播放信息，锁定状态由 ECS 管理

4. **统一动画事件类型**
   - ❌ `finished` / `unlock` / `die_complete` 混用
   - ✅ `finished`（完成）和 `marker`（事件点）两类

### 可选项（MVP 后）

- [ ] AnimationConfig 驱动 loop / speed / marker
- [ ] 动画打断规则（priority）

## 实施检查清单

- [ ] 修改 `NodeBinder`（返回 Handle 而不是 entityId）
- [ ] 完善 `AnimDriver`（使用 Handle，移除锁定状态）
- [ ] 扩展 `EventBus`（AnimationEvent 使用 Handle）
- [ ] 创建 `AnimationEventSystem`（使用 world.getEntityByHandle）
- [ ] 修改 `AnimationIntentSystem`（自动设置 locked）
- [ ] 修改 `ViewManager`（绑定 Handle，集成 AnimDriver）
- [ ] 创建动画配置（可选）
- [ ] 更新 `GameApp` 和测试场景（注册 AnimationEventSystem）
- [ ] 编写单元测试
- [ ] 更新文档

## 参考

- 架构约束：`memory-bank/systemPatterns.md`
- 动画意图设计：`memory-bank/creative/creative-animation-intent.md`
- 实体销毁流程：`memory-bank/creative/creative-entity-destruction.md`
- Cocos Creator Animation API 文档
