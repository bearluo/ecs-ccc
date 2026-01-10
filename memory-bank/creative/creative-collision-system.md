# 创意阶段：CollisionSystem 设计

## 问题描述

需要实现一个碰撞检测系统，用于检测实体之间的碰撞，触发碰撞事件。碰撞系统需要：
1. 支持多种碰撞体类型（圆形、矩形）
2. 高效检测大量实体的碰撞
3. 支持碰撞层级（玩家、敌人、子弹等）
4. 触发碰撞事件（伤害、拾取等）

**需求：**
- 检测实体之间的碰撞
- 支持碰撞层级过滤
- 触发碰撞事件（通过 EventBus）
- 性能优化（支持 1000+ 实体）

## 约束条件

- 系统必须是 Fixed System（priority: 0-99）
- 不能直接操作 View 层
- 碰撞检测结果通过 EventBus 发送事件
- 必须遵循架构约束

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：暴力检测（简单版）

**设计思路：**
- 遍历所有有碰撞体的实体
- 两两检测碰撞
- 时间复杂度 O(n²)

**实现：**
```typescript
@system({ priority: 1 })
export class CollisionSystem extends System {
    private eventBus?: EventBus;
    
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }
    
    onUpdate(dt: number): void {
        if (!this.eventBus) {
            console.warn('[CollisionSystem] EventBus not set');
            return;
        }
        
        const query = this.world.createQuery({
            all: [ColliderComponent, TransformComponent]
        });
        
        const entities = query.getAllEntities();
        
        // 两两检测碰撞
        for (let i = 0; i < entities.length; i++) {
            const entityA = entities[i];
            const colliderA = entityA.getComponent(ColliderComponent)!;
            const transformA = entityA.getComponent(TransformComponent)!;
            
            for (let j = i + 1; j < entities.length; j++) {
                const entityB = entities[j];
                const colliderB = entityB.getComponent(ColliderComponent)!;
                const transformB = entityB.getComponent(TransformComponent)!;
                
                // 检查碰撞层级
                if (!this.canCollide(colliderA, colliderB)) {
                    continue;
                }
                
                // 检测碰撞
                if (this.checkCollision(colliderA, transformA, colliderB, transformB)) {
                    // 发送碰撞事件
                    this.eventBus.push({
                        type: 'CollisionEvent',
                        entityIdA: entityA.id,
                        entityIdB: entityB.id,
                        colliderA: colliderA,
                        colliderB: colliderB
                    });
                }
            }
        }
    }
    
    private canCollide(colliderA: ColliderComponent, colliderB: ColliderComponent): boolean {
        // 检查碰撞层级
        return (colliderA.layer & colliderB.layer) !== 0;
    }
    
    private checkCollision(
        colliderA: ColliderComponent,
        transformA: TransformComponent,
        colliderB: ColliderComponent,
        transformB: TransformComponent
    ): boolean {
        // 圆形 vs 圆形
        if (colliderA.type === ColliderType.Circle && colliderB.type === ColliderType.Circle) {
            const dx = transformB.x - transformA.x;
            const dy = transformB.y - transformA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (colliderA.radius + colliderB.radius);
        }
        
        // 矩形 vs 矩形
        if (colliderA.type === ColliderType.Rectangle && colliderB.type === ColliderType.Rectangle) {
            return this.checkAABB(
                transformA.x, transformA.y, colliderA.width, colliderA.height,
                transformB.x, transformB.y, colliderB.width, colliderB.height
            );
        }
        
        // 圆形 vs 矩形
        if (colliderA.type === ColliderType.Circle && colliderB.type === ColliderType.Rectangle) {
            return this.checkCircleRect(
                transformA.x, transformA.y, colliderA.radius,
                transformB.x, transformB.y, colliderB.width, colliderB.height
            );
        }
        
        // 矩形 vs 圆形（交换参数）
        if (colliderA.type === ColliderType.Rectangle && colliderB.type === ColliderType.Circle) {
            return this.checkCircleRect(
                transformB.x, transformB.y, colliderB.radius,
                transformA.x, transformA.y, colliderA.width, colliderA.height
            );
        }
        
        return false;
    }
    
    private checkAABB(
        x1: number, y1: number, w1: number, h1: number,
        x2: number, y2: number, w2: number, h2: number
    ): boolean {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    private checkCircleRect(
        cx: number, cy: number, radius: number,
        rx: number, ry: number, width: number, height: number
    ): boolean {
        const closestX = Math.max(rx, Math.min(cx, rx + width));
        const closestY = Math.max(ry, Math.min(cy, ry + height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (radius * radius);
    }
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 易于理解和调试
- ✅ 适合实体数量较少的情况（< 100）

**缺点：**
- ⚠️ 性能差，O(n²) 时间复杂度
- ⚠️ 不适合大量实体（1000+）

---

### 方案 2：空间分区优化（推荐）

**设计思路：**
- 使用空间分区（Grid/QuadTree）优化碰撞检测
- 只检测同一分区内的实体
- 时间复杂度 O(n + k)，k 为平均每个分区的实体数

**实现：**

**1. 空间网格（Spatial Grid）：**
```typescript
class SpatialGrid {
    private cellSize: number = 100; // 网格大小
    private grid: Map<string, Entity[]> = new Map();
    
    clear(): void {
        this.grid.clear();
    }
    
    insert(entity: Entity, transform: TransformComponent): void {
        const cellX = Math.floor(transform.x / this.cellSize);
        const cellY = Math.floor(transform.y / this.cellSize);
        const key = `${cellX},${cellY}`;
        
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(entity);
    }
    
    getNeighbors(entity: Entity, transform: TransformComponent): Entity[] {
        const cellX = Math.floor(transform.x / this.cellSize);
        const cellY = Math.floor(transform.y / this.cellSize);
        const neighbors: Entity[] = [];
        
        // 检查当前网格和周围 8 个网格
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (const e of cell) {
                        if (e.id !== entity.id) {
                            neighbors.push(e);
                        }
                    }
                }
            }
        }
        
        return neighbors;
    }
}

@system({ priority: 1 })
export class CollisionSystem extends System {
    private eventBus?: EventBus;
    private spatialGrid: SpatialGrid = new SpatialGrid();
    
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }
    
    onUpdate(dt: number): void {
        if (!this.eventBus) {
            console.warn('[CollisionSystem] EventBus not set');
            return;
        }
        
        const query = this.world.createQuery({
            all: [ColliderComponent, TransformComponent]
        });
        
        // 清空空间网格
        this.spatialGrid.clear();
        
        // 插入所有实体到空间网格
        query.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            this.spatialGrid.insert(entity, transform);
        });
        
        // 检测碰撞
        const processedPairs = new Set<string>();
        
        query.forEach(entityA => {
            const colliderA = entityA.getComponent(ColliderComponent)!;
            const transformA = entityA.getComponent(TransformComponent)!;
            
            // 只检测相邻网格的实体
            const neighbors = this.spatialGrid.getNeighbors(entityA, transformA);
            
            for (const entityB of neighbors) {
                // 避免重复检测
                const pairKey = entityA.id < entityB.id 
                    ? `${entityA.id},${entityB.id}` 
                    : `${entityB.id},${entityA.id}`;
                
                if (processedPairs.has(pairKey)) {
                    continue;
                }
                processedPairs.add(pairKey);
                
                const colliderB = entityB.getComponent(ColliderComponent)!;
                const transformB = entityB.getComponent(TransformComponent)!;
                
                // 检查碰撞层级
                if (!this.canCollide(colliderA, colliderB)) {
                    continue;
                }
                
                // 检测碰撞
                if (this.checkCollision(colliderA, transformA, colliderB, transformB)) {
                    // 发送碰撞事件
                    this.eventBus.push({
                        type: 'CollisionEvent',
                        entityIdA: entityA.id,
                        entityIdB: entityB.id,
                        colliderA: colliderA,
                        colliderB: colliderB
                    });
                }
            }
        });
    }
    
    // ... 其他方法同方案 1
}
```

**优点：**
- ✅ 性能好，适合大量实体（1000+）
- ✅ 时间复杂度 O(n + k)，k 远小于 n
- ✅ 易于实现和理解

**缺点：**
- ⚠️ 需要额外的内存存储空间网格
- ⚠️ 网格大小需要根据游戏场景调整

---

### 方案 3：四叉树优化（复杂版）

**设计思路：**
- 使用四叉树进行空间分区
- 动态调整树结构
- 适合实体分布不均匀的场景

**优点：**
- ✅ 性能好，适合复杂场景
- ✅ 自适应空间分区

**缺点：**
- ⚠️ 实现复杂
- ⚠️ 需要动态维护树结构
- ⚠️ 对于阶段 2 可能过度设计

---

## 推荐方案

**选择方案 2：空间分区优化（Spatial Grid）**

**理由：**
1. **性能好：** 适合大量实体（1000+），满足阶段 2 的性能要求
2. **实现简单：** 比四叉树简单，比暴力检测高效
3. **易于调整：** 网格大小可以根据场景调整
4. **符合阶段 2 目标：** 核心系统完善，不需要过度设计

**实施步骤：**
1. 实现 `SpatialGrid` 类
2. 实现 `CollisionSystem` 系统
3. 支持圆形和矩形碰撞检测
4. 支持碰撞层级过滤
5. 通过 EventBus 发送碰撞事件

**未来扩展：**
- 如果需要更复杂的空间分区，可以在阶段 4 引入四叉树
- 可以添加碰撞缓存，避免重复检测

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 设计决策总结

1. **碰撞检测算法：** 使用空间网格（Spatial Grid）优化，时间复杂度 O(n + k)
2. **碰撞体类型：** 支持圆形和矩形，支持圆形 vs 矩形检测
3. **碰撞层级：** 使用位掩码（CollisionLayer）进行层级过滤
4. **碰撞事件：** 通过 EventBus 发送碰撞事件，其他系统订阅处理
5. **架构约束：** 完全遵循架构约束，不直接操作 View 层

## 实施指南

1. **创建 SpatialGrid 类：** `assets/scripts/gameplay/systems/SpatialGrid.ts`（可选，可以内联到 CollisionSystem）
2. **实现 CollisionSystem：** `assets/scripts/gameplay/systems/CollisionSystem.ts`
3. **注册系统：** 在 GameApp 中注册 CollisionSystem（Fixed System，priority: 1）
4. **设置 EventBus：** 在 GameApp 中调用 `collisionSystem.setEventBus(eventBus)`
5. **测试：** 创建多个碰撞体实体，验证碰撞检测和事件触发

## 相关组件依赖

- `ColliderComponent` - 碰撞体信息
- `TransformComponent` - 位置信息
- `FactionComponent` - 阵营信息（可选，用于过滤碰撞）

## 性能优化建议

1. **网格大小调整：** 根据游戏场景和实体大小调整 `cellSize`
2. **碰撞缓存：** 可以缓存上一帧的碰撞结果，避免重复检测
3. **触发器优化：** 触发器（isTrigger）不需要精确碰撞检测，可以提前返回
4. **静态实体优化：** 静态实体（不移动）可以单独处理，避免重复插入网格
