# 创意阶段：实体 Handle 系统设计

## 问题描述

在 ECS 系统中，当实体被销毁后，其实体 ID 可能会被复用。如果组件中持有的是旧的实体 ID，当新实体使用相同 ID 时，会导致引用到错误的实体。

**问题场景：**
1. 实体 A (ID: 100) 被 AI 实体 B 锁定为目标
2. 实体 A 被销毁，ID 100 被回收
3. 新实体 C 创建，复用 ID 100
4. AI 实体 B 仍然持有 targetEntityId = 100，但实际指向的是实体 C，而不是已销毁的实体 A

**需求：**
1. 组件需要能够安全地持有实体引用
2. 当实体被销毁时，引用应该自动失效
3. 系统需要能够检查引用是否有效
4. 性能开销要小

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要与现有系统兼容
- 性能要求：O(1) 查找，最小内存开销

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Architecture Design

### 方案 1：使用框架提供的 Handle 系统（推荐）✅

**设计思路：**
- ✅ **@bl-framework/ecs 已提供完整的 Handle 系统**
- 使用框架的 `Handle { id, gen }` 接口
- 通过 Generation（代数）机制防止 ID 复用
- 框架自动管理 Generation，无需手动维护

**框架 API：**

**1. Handle 类型（框架提供）：**
```typescript
// 来自 @bl-framework/ecs
export interface Handle {
    id: EntityId;  // 实体 ID
    gen: Gen;      // Generation（代数）
}
```

**2. Entity.handle getter（推荐使用）：**
```typescript
const entity = world.createEntity();
const handle = entity.handle; // 最简单的方式
// handle = { id: 1, gen: 1 }
```

**3. World API：**
```typescript
// 创建 Handle
const handle = world.createHandle(entityId);

// 通过 Handle 获取实体（带验证）
const entity = world.getEntityByHandle(handle);
if (entity) {
    // 实体有效
}

// 验证 Handle 有效性
if (world.isValidHandle(handle)) {
    // Handle 有效
}
```

**4. 辅助函数（可选）：**
```typescript
import { createEntityHandle, getEntityByHandle, isValidHandle } from '@bl-framework/ecs';

const handle = createEntityHandle(entity);
const entity = getEntityByHandle(world, handle);
if (isValidHandle(world, handle)) { ... }
```

**组件使用示例：**
```typescript
import { Handle } from '@bl-framework/ecs';

@component({ name: 'AI', pooled: true, poolSize: 50 })
export class AIComponent extends Component {
    /** 目标实体 Handle（替代 targetEntityId） */
    targetHandle: Handle | null = null;
    
    // ... 其他字段
    
    reset(): void {
        super.reset();
        this.targetHandle = null;
        // ... 其他重置
    }
}
```

**系统使用示例：**
```typescript
// 在 AISystem 中
private findTarget(entity: Entity, range: number): Handle | null {
    // ... 查找逻辑
    if (nearestTarget) {
        return nearestTarget.handle || null; // 使用 Entity.handle getter
    }
    return null;
}

private handleChase(entity: Entity, ai: AIComponent, ...): void {
    // 验证 Handle 有效性
    if (!ai.targetHandle || !this.world.isValidHandle(ai.targetHandle)) {
        ai.targetHandle = null;
        ai.state = 'idle';
        return;
    }
    
    // 通过 Handle 查找实体
    const target = this.world.getEntityByHandle(ai.targetHandle);
    if (!target) {
        ai.targetHandle = null;
        return;
    }
    
    // ... 处理逻辑
}
```

**优点：**
- ✅ **框架已实现，无需自己开发**
- ✅ 完全解决 ID 复用问题（通过 Generation 机制）
- ✅ 性能优秀：O(1) 查找和验证
- ✅ 内存开销小：每个实体一个 Generation
- ✅ 可序列化：Handle 是纯数据对象
- ✅ API 清晰：Entity.handle getter 最简单
- ✅ 自动管理：Generation 由框架自动维护

**缺点：**
- 无（框架已完美实现）

---

### 方案对比

**其他方案（不推荐）：**

1. **弱引用系统** - WeakRef 可能不支持，不能序列化
2. **引用计数** - 可能导致内存泄漏，不符合 ECS 理念
3. **直接存储 Entity 引用** - 不能序列化，违反 ECS 原则
4. **自己实现 Handle 系统** - 框架已提供，无需重复实现

---

## 推荐方案

**选择方案 1：使用框架提供的 Handle 系统**

**理由：**
1. **框架已实现：** @bl-framework/ecs 已提供完整的 Handle 系统
2. **完全解决问题：** 通过 Generation 机制完全防止 ID 复用问题
3. **性能优秀：** O(1) 查找和验证，内存开销小
4. **符合架构：** 纯数据，可序列化，符合 ECS 设计原则
5. **易于使用：** Entity.handle getter 最简单
6. **自动管理：** Generation 由框架自动维护，无需手动操作

**实施步骤：**
1. ✅ 框架已提供 Handle 系统，无需实现
2. 更新组件：`targetEntityId: number` → `targetHandle: Handle | null`
3. 更新系统代码：
   - 使用 `entity.handle` 创建 Handle
   - 使用 `world.getEntityByHandle(handle)` 获取实体
   - 使用 `world.isValidHandle(handle)` 验证有效性
4. 逐步迁移现有代码

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 设计决策总结

1. **Handle 设计：** 使用 ID + Version 组合，提供唯一且可验证的实体引用
2. **管理器设计：** EntityHandleManager 管理版本号，提供创建和验证功能
3. **生命周期集成：** 在实体销毁时递增版本号，使旧 Handle 失效
4. **迁移策略：** 逐步迁移，先创建 Handle 系统，再更新组件和系统

## 实施指南

1. ✅ **框架已提供 Handle 系统，无需创建**
2. **导入 Handle 类型：**
   ```typescript
   import { Handle } from '@bl-framework/ecs';
   ```
3. **迁移组件：** 
   - `AIComponent.targetEntityId: number` → `AIComponent.targetHandle: Handle | null`
   - 其他需要持有实体引用的组件
4. **更新系统代码：**
   - 创建 Handle：`const handle = entity.handle;` 或 `world.createHandle(entityId)`
   - 获取实体：`const entity = world.getEntityByHandle(handle);`
   - 验证有效性：`if (world.isValidHandle(handle)) { ... }`
5. **更新 AISystem：**
   - `findTarget()` 返回 `Handle | null`
   - `handleChase()` 等方法使用 Handle 查找实体

## 相关组件需要迁移

- `AIComponent` - `targetEntityId: number` → `targetHandle: Handle | null`
- 未来可能需要的组件（如 ParentComponent、OwnerComponent 等）

## 框架 API 参考

### Handle 接口
```typescript
interface Handle {
    id: EntityId;  // 实体 ID
    gen: Gen;      // Generation（代数）
}
```

### Entity.handle getter（推荐）
```typescript
const entity = world.createEntity();
const handle = entity.handle; // 最简单的方式
```

### World API
```typescript
// 创建 Handle
world.createHandle(entityId): Handle | undefined

// 通过 Handle 获取实体（带验证）
world.getEntityByHandle(handle): Entity | undefined

// 验证 Handle 有效性
world.isValidHandle(handle): boolean
```

### 辅助函数（可选）
```typescript
import { createEntityHandle, getEntityByHandle, isValidHandle } from '@bl-framework/ecs';

createEntityHandle(entity): Handle | undefined
getEntityByHandle(world, handle): Entity | undefined
isValidHandle(world, handle): boolean
```

## 性能考虑

1. **内存开销：** 每个实体一个版本号（4-8 字节）
2. **查找性能：** O(1) Map 查找
3. **验证性能：** O(1) 版本号比较
4. **清理策略：** 可以定期清理已销毁实体的版本号（需要确保没有活跃引用）

## 扩展性

- 可以支持批量验证 Handle
- 可以添加 Handle 缓存机制
- 可以支持 Handle 池化（如果需要）
