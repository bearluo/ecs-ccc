# RenderCommand 使用 Handle 设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前 `RenderCommand` 类型使用 `entityId: number` 来标识实体，存在以下问题：

1. **entityId 复用风险：** entityId 会被复用，如果命令延迟处理，可能操作到错误的实体
2. **异步操作不安全：** CommandBuffer 的命令可能跨帧处理，使用 entityId 不安全
3. **与动画系统不一致：** 动画系统已改为使用 Handle，RenderCommand 应该保持一致

## 架构约束

1. **ECS → View：** 只能通过 CommandBuffer（RenderSyncSystem 是唯一出口）
2. **Handle 优先：** 所有异步操作必须使用 Handle，禁止使用 entityId
3. **向后兼容：** 需要确保现有代码能平滑迁移

## 设计选项

### 选项 1：完全迁移到 Handle（推荐）⭐

**设计：** 将所有 RenderCommand 的 entityId 改为 handle

**优点：**
- ✅ 完全避免 entityId 复用问题
- ✅ 与动画系统保持一致
- ✅ 架构统一，易于维护
- ✅ 异步操作安全

**缺点：**
- ⚠️ 需要修改所有使用 RenderCommand 的地方
- ⚠️ ViewManager 需要适配 Handle

**影响范围：**
- `CommandBuffer.ts` - RenderCommand 类型定义
- `RenderSyncSystem.ts` - 命令生成（使用 entity.handle）
- `ViewManager.ts` - 命令处理（需要 Handle → Node 映射）

---

### 选项 2：混合方案（entityId + Handle）

**设计：** 同时支持 entityId 和 Handle，逐步迁移

**优点：**
- ✅ 向后兼容
- ✅ 可以逐步迁移

**缺点：**
- ❌ 代码复杂度增加
- ❌ 容易混淆
- ❌ 维护成本高

---

### 选项 3：保持 entityId（不推荐）

**设计：** 继续使用 entityId，接受复用风险

**优点：**
- ✅ 无需修改代码

**缺点：**
- ❌ 存在 entityId 复用风险
- ❌ 与动画系统不一致
- ❌ 异步操作不安全

---

## 推荐方案：选项 1（完全迁移到 Handle）

### 设计决策

**核心原则：**
1. 所有 RenderCommand 使用 `handle: Handle` 而不是 `entityId: number`
2. RenderSyncSystem 使用 `entity.handle` 生成命令
3. ViewManager 通过 Handle 查找 Node（需要 Handle → Node 映射）

### 完整设计

#### 1. CommandBuffer 修改

```typescript
import { Handle } from '@bl-framework/ecs';

/**
 * 渲染命令类型
 * 
 * ⚠️ 关键修正：使用 Handle 而不是 entityId，避免异步操作错误
 */
export type RenderCommand =
    | { type: 'SpawnView'; handle: Handle; prefabKey: string }
    | { type: 'SetPosition'; handle: Handle; x: number; y: number }
    | { type: 'PlayAnim'; handle: Handle; animName: string }
    | { type: 'DestroyView'; handle: Handle };
```

#### 2. RenderSyncSystem 修改

```typescript
// 所有命令生成处使用 entity.handle
this.commandBuffer.push({
    type: 'SpawnView',
    handle: entity.handle, // 使用 Handle 而不是 entity.id
    prefabKey: viewLink.prefabKey
});

this.commandBuffer.push({
    type: 'SetPosition',
    handle: entity.handle, // 使用 Handle 而不是 entity.id
    x: transform.x,
    y: transform.y
});

this.commandBuffer.push({
    type: 'PlayAnim',
    handle: entity.handle, // 使用 Handle 而不是 entity.id
    animName: animState.current
});

this.commandBuffer.push({
    type: 'DestroyView',
    handle: entity.handle // 使用 Handle 而不是 entity.id
});
```

#### 3. ViewManager 修改

**关键变化：**
- 需要维护 `Handle → Node` 映射
- 处理命令时通过 Handle 查找 Node
- 需要 World 支持通过 Handle 获取 entityId（用于 ViewPool）

```typescript
export class ViewManager {
    /** Handle → Node 映射 */
    private handleNodeMap: Map<Handle, Node> = new Map();
    
    /** Node → Handle 映射（反向查找） */
    private nodeHandleMap: Map<Node, Handle> = new Map();
    
    /** EntityId → Node 映射（保留，用于 ViewPool） */
    private entityNodeMap: Map<number, Node> = new Map();

    /**
     * 处理渲染命令
     */
    processCommands(commands: RenderCommand[]): void {
        for (const command of commands) {
            switch (command.type) {
                case 'SpawnView':
                    this.spawnView(command.handle, command.prefabKey);
                    break;
                case 'SetPosition':
                    this.setPosition(command.handle, command.x, command.y);
                    break;
                case 'PlayAnim':
                    this.playAnim(command.handle, command.animName);
                    break;
                case 'DestroyView':
                    this.destroyView(command.handle);
                    break;
            }
        }
    }

    /**
     * 生成视图
     */
    private spawnView(handle: Handle, prefabKey: string): void {
        if (!this.world || !this.world.isValidHandle(handle)) {
            console.warn(`[ViewManager] Invalid handle for spawn: ${handle}`);
            return;
        }

        const entity = this.world.getEntityByHandle(handle);
        if (!entity) {
            console.warn(`[ViewManager] Entity not found for handle: ${handle}`);
            return;
        }

        const entityId = entity.id;

        // 如果已存在，先销毁
        if (this.handleNodeMap.has(handle)) {
            this.destroyView(handle);
        }

        // 从对象池获取节点
        const node = this.viewPool.get(prefabKey, entityId);
        if (!node) {
            console.warn(`[ViewManager] Failed to get node from pool: prefabKey=${prefabKey}`);
            if (this.eventBus) {
                this.eventBus.push({
                    type: 'ViewEvent',
                    eventName: 'ViewSpawnFailed',
                    entityId: entityId
                });
            }
            return;
        }
        
        // 添加到场景
        const scene = director.getScene();
        if (scene) {
            scene.addChild(node);
        }

        // 记录映射
        this.handleNodeMap.set(handle, node);
        this.nodeHandleMap.set(node, handle);
        this.entityNodeMap.set(entityId, node); // 保留用于 ViewPool
        
        // 绑定节点（使用 Handle）
        this.nodeBinder.bind(node, handle);

        // 设置动画组件
        if (this.animDriver) {
            this.animDriver.setupAnimation(node);
        }

        // 发送成功事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'ViewEvent',
                eventName: 'ViewSpawned',
                entityId: entityId
            });
        }
    }

    /**
     * 设置位置
     */
    private setPosition(handle: Handle, x: number, y: number): void {
        const node = this.handleNodeMap.get(handle);
        if (node) {
            node.setPosition(x, y, 0);
        }
    }

    /**
     * 播放动画
     */
    private playAnim(handle: Handle, animName: string): void {
        const node = this.handleNodeMap.get(handle);
        if (!node) return;

        if (!this.animDriver) {
            console.warn(`[ViewManager] AnimDriver not set`);
            return;
        }

        // 获取 AnimState 以获取动画速度
        if (!this.world || !this.world.isValidHandle(handle)) {
            return;
        }

        const entity = this.world.getEntityByHandle(handle);
        if (!entity) return;

        const animState = entity.getComponent(AnimStateComponent);
        const speed = animState?.speed || 1.0;

        // 判断是否循环
        const isLoop = this.isContinuousAnim(animName);

        // 通过 AnimDriver 播放动画
        this.animDriver.playAnim(node, animName, speed, isLoop);
    }

    /**
     * 销毁视图
     */
    private destroyView(handle: Handle): void {
        const node = this.handleNodeMap.get(handle);
        if (!node) return;

        // 获取 entityId（用于 ViewPool）
        let entityId: number | undefined;
        if (this.world && this.world.isValidHandle(handle)) {
            const entity = this.world.getEntityByHandle(handle);
            if (entity) {
                entityId = entity.id;
            }
        }

        // 从场景移除
        if (node.parent) {
            node.removeFromParent();
        }

        // 移除映射
        this.handleNodeMap.delete(handle);
        this.nodeHandleMap.delete(node);
        if (entityId) {
            this.entityNodeMap.delete(entityId);
        }

        // 解绑节点
        this.nodeBinder.unbind(node);

        // 回收到对象池
        if (entityId) {
            this.viewPool.release(entityId);
        }
    }

    /**
     * 获取 Handle 对应的 Node
     */
    getNodeByHandle(handle: Handle): Node | undefined {
        return this.handleNodeMap.get(handle);
    }

    /**
     * 获取 Node 对应的 Handle
     */
    getHandleByNode(node: Node): Handle | undefined {
        return this.nodeHandleMap.get(node);
    }
}
```

#### 4. ViewEvent 保持 entityId（向后兼容）

**设计决策：** ViewEvent 仍然使用 entityId，因为：
- ViewEvent 是同步的（在同一帧内处理）
- ViewSpawnSystem 需要 entityId 来设置 viewLink.viewId
- 保持向后兼容

```typescript
// EventBus.ts 保持不变
export type GameplayEvent =
    | { type: 'AnimationEvent'; eventName: 'finished' | 'marker'; handle: Handle; data?: any }
    | { type: 'CollisionEvent'; entityA: number; entityB: number; data?: any }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; eventName: 'ViewSpawned' | 'ViewSpawnFailed'; entityId: number }; // 保持 entityId
```

### 优势总结

1. **异步安全：** Handle 避免 entityId 复用问题
2. **架构统一：** 与动画系统保持一致
3. **易于维护：** 统一的 Handle 使用方式
4. **向后兼容：** ViewEvent 保持 entityId，不影响现有系统

### 迁移影响

**需要修改的文件：**
1. `CommandBuffer.ts` - RenderCommand 类型定义
2. `RenderSyncSystem.ts` - 所有命令生成处
3. `ViewManager.ts` - 命令处理逻辑，添加 Handle 映射

**不需要修改的文件：**
- `EventBus.ts` - ViewEvent 保持 entityId
- `ViewSpawnSystem.ts` - 使用 ViewEvent，不受影响
- 其他系统 - 不直接使用 RenderCommand

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [ ] 修改 `CommandBuffer.ts`（RenderCommand 使用 Handle）
- [ ] 修改 `RenderSyncSystem.ts`（使用 entity.handle）
- [ ] 修改 `ViewManager.ts`（添加 Handle 映射，修改命令处理）
- [ ] 测试命令生成和处理流程
- [ ] 验证 Handle 有效性检查
- [ ] 更新文档

## 参考

- 动画系统 Handle 迁移：`memory-bank/creative/creative-animation-system.md`
- 架构约束：`memory-bank/systemPatterns.md`
