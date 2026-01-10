# 创意阶段：Scheduler 系统排序优化

## 问题描述

当前 Scheduler 在每次更新时都会：
1. 获取所有系统实例
2. 按 priority 排序
3. 执行系统

**性能问题：**
- 排序操作有 O(n log n) 的时间复杂度
- 每次更新都排序是不必要的开销
- 系统列表只有在注册新系统或系统 priority 改变时才需要重新排序

## 需求

1. **性能优化：** 避免每次更新都排序
2. **正确性：** 保证系统按 priority 顺序执行
3. **灵活性：** 支持动态添加系统和改变 priority
4. **简洁性：** 代码易于理解和维护

## 约束条件

- 使用 `@bl-framework/ecs` 框架，不能修改框架代码
- 系统可能动态注册和移除
- 系统 priority 可能动态改变（虽然不常见）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Algorithm Design

### 方案 1：脏标记 + 延迟排序

**设计思路：**
- 维护一个已排序的系统列表缓存
- 使用脏标记（dirty flag）标记是否需要重新排序
- 只在脏标记为 true 时才排序
- 注册新系统或系统 priority 改变时设置脏标记

**实现：**
```typescript
class Scheduler {
    private fixedSystemsCache: System[] = [];
    private renderSystemsCache: System[] = [];
    private fixedSystemsDirty: boolean = true;
    private renderSystemsDirty: boolean = true;

    registerFixedSystem<T extends System>(systemType: new () => T): void {
        // 注册系统
        // 设置脏标记
        this.fixedSystemsDirty = true;
    }

    private updateFixedSystems(dt: number): void {
        // 检查脏标记
        if (this.fixedSystemsDirty) {
            this.refreshFixedSystemsCache();
            this.fixedSystemsDirty = false;
        }
        
        // 使用缓存执行
        for (const system of this.fixedSystemsCache) {
            if (system.enabled) {
                system.onUpdate?.(dt);
            }
        }
    }

    private refreshFixedSystemsCache(): void {
        this.fixedSystemsCache = this.fixedSystemTypes
            .map(type => this.world.getSystem(type))
            .filter((sys): sys is System => sys !== undefined)
            .sort((a, b) => a.priority - b.priority);
    }
}
```

**优点：**
- ✅ 性能好：只在必要时排序
- ✅ 实现简单：逻辑清晰
- ✅ 易于理解

**缺点：**
- ⚠️ 需要手动管理脏标记
- ⚠️ 如果系统 priority 动态改变，需要外部通知设置脏标记

---

### 方案 2：SortedSystemList 类（封装排序逻辑）

**设计思路：**
- 创建一个 SortedSystemList 类封装系统列表和排序逻辑
- 内部维护脏标记和缓存
- 提供注册、更新等方法

**实现：**
```typescript
class SortedSystemList {
    private systemTypes: (new () => System)[] = [];
    private cachedSystems: System[] = [];
    private dirty: boolean = true;

    add(systemType: new () => System): void {
        if (this.systemTypes.indexOf(systemType) === -1) {
            this.systemTypes.push(systemType);
            this.dirty = true;
        }
    }

    update(world: World, dt: number): void {
        if (this.dirty) {
            this.refresh(world);
            this.dirty = false;
        }

        for (const system of this.cachedSystems) {
            if (system.enabled) {
                system.onUpdate?.(dt);
            }
        }
    }

    private refresh(world: World): void {
        this.cachedSystems = this.systemTypes
            .map(type => world.getSystem(type))
            .filter((sys): sys is System => sys !== undefined)
            .sort((a, b) => a.priority - b.priority);
    }

    markDirty(): void {
        this.dirty = true;
    }
}

class Scheduler {
    private fixedSystems = new SortedSystemList();
    private renderSystems = new SortedSystemList();

    registerFixedSystem<T extends System>(systemType: new () => T): void {
        this.fixedSystems.add(systemType);
    }

    private updateFixedSystems(dt: number): void {
        this.fixedSystems.update(this.world, dt);
    }
}
```

**优点：**
- ✅ 封装性好：逻辑封装在类中
- ✅ 可复用：可以用于 Fixed 和 Render 系统
- ✅ 易于扩展：可以添加更多功能（如移除系统）
- ✅ 性能好：脏标记机制

**缺点：**
- ⚠️ 需要额外的类
- ⚠️ 如果系统 priority 动态改变，仍需要外部通知

---

### 方案 3：观察者模式 + 自动检测 priority 变化

**设计思路：**
- 使用 Proxy 或 getter/setter 监听系统 priority 变化
- 自动设置脏标记
- 更自动化，但实现复杂

**实现：**
```typescript
// 使用 Proxy 监听 priority 变化（复杂，不推荐）
```

**优点：**
- ✅ 完全自动化

**缺点：**
- ❌ 实现复杂
- ❌ 性能开销（Proxy 有额外开销）
- ❌ 过度设计

---

### 方案 4：直接使用 World 的系统列表（如果可访问）

**设计思路：**
- 如果 World 或 SystemManager 提供了获取已排序系统列表的方法
- 直接使用，无需自己排序

**检查：**
- SystemManager 有 `getAllSystems()` 方法，返回的系统列表已经按 priority 排序
- 但需要过滤出 Fixed 和 Render 系统

**实现：**
```typescript
private updateFixedSystems(dt: number): void {
    // 获取所有系统（已排序）
    const allSystems = this.world.getAllSystems();
    
    // 过滤 Fixed Systems (priority 0-99)
    const fixedSystems = allSystems.filter(sys => 
        sys.priority >= 0 && sys.priority < 100
    );
    
    for (const system of fixedSystems) {
        if (system.enabled) {
            system.onUpdate?.(dt);
        }
    }
}
```

**优点：**
- ✅ 最简单：无需自己排序
- ✅ 性能好：World 已经维护了排序列表
- ✅ 自动同步：系统 priority 改变时自动反映

**缺点：**
- ⚠️ 需要检查 World 是否有 `getAllSystems()` 方法
- ⚠️ 需要过滤系统（但过滤是 O(n)，比排序 O(n log n) 快）

---

## 方案对比

| 方案 | 性能 | 复杂度 | 可维护性 | 自动化程度 |
|------|------|--------|----------|------------|
| 方案 1：脏标记 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 方案 2：SortedSystemList | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 方案 3：观察者模式 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 方案 4：使用 World 列表 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 推荐方案

### 🏆 方案 2：SortedSystemList 类（已实现）

**理由：**
1. **性能好：** 脏标记机制，只在必要时排序
2. **封装性好：** 排序逻辑封装在类中，代码清晰
3. **易于维护：** 单一职责，易于理解和扩展
4. **灵活性：** 支持动态添加/移除系统

**实现状态：** ✅ 已实现

**实现文件：**
- `assets/scripts/bridge/SortedSystemList.ts` - SortedSystemList 类
- `assets/scripts/bridge/Scheduler.ts` - 使用 SortedSystemList

**关键特性：**
- ✅ 脏标记机制：只在系统列表改变时排序
- ✅ 自动排序：按 priority 自动排序
- ✅ 缓存机制：排序结果缓存，避免重复排序
- ✅ 支持动态添加/移除系统

---

## 实施指南

### 如果采用方案 4：

1. 移除 `fixedSystemTypes` 和 `renderSystemTypes` 数组
2. 移除 `registerFixedSystem` 和 `registerRenderSystem` 方法
3. 修改 `updateFixedSystems` 和 `updateRenderSystems` 使用 `world.getAllSystems()` 并过滤
4. 更新 GameApp.ts，移除系统注册到 Scheduler 的代码

### 如果采用方案 2：

1. 创建 `SortedSystemList` 类
2. 在 Scheduler 中使用两个 `SortedSystemList` 实例
3. 保持现有的注册方法

---

## 验证

实施后需要验证：
- ✅ 系统按 priority 顺序执行
- ✅ 性能提升（避免不必要的排序）
- ✅ 代码简洁易维护

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

