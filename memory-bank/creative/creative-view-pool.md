# 创意阶段：ViewPool 对象池设计

## 问题描述

在肉鸽游戏中，需要频繁创建和销毁视图（Node），如子弹、特效、敌人等。频繁的创建/销毁会导致：
- 内存分配/释放开销
- GC 压力
- 性能下降

**需求：**
1. 支持视图对象复用（对象池）
2. 支持不同类型的视图（通过 prefabKey 区分）
3. 支持视图重置和清理
4. 支持池大小限制和自动扩容
5. 与 ViewManager 集成

## 约束条件

- 需要与 Cocos Creator 的 Node 系统集成
- 需要与 ViewManager 配合工作
- 需要考虑内存管理（避免池过大）
- 需要支持不同类型的 Prefab

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Object Pool Design

### 方案 1：单池 + 类型映射

**设计思路：**
- 使用单个数组存储所有视图
- 使用 Map 建立 prefabKey 到视图列表的映射

**实现：**
```typescript
export class ViewPool {
    /** 视图池：prefabKey -> Node[] */
    private pools: Map<string, Node[]> = new Map();
    
    /** 正在使用的视图：entityId -> Node */
    private activeViews: Map<number, Node> = new Map();
    
    /** 池大小限制（每个类型） */
    private maxPoolSize: number = 20;

    /** 获取视图 */
    get(prefabKey: string, entityId: number): Node | null {
        // 从池中获取
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = [];
            this.pools.set(prefabKey, pool);
        }

        let node: Node | null = null;
        if (pool.length > 0) {
            node = pool.pop()!;
        } else {
            // 池为空，创建新节点
            node = this.createNode(prefabKey);
        }

        if (node) {
            this.activeViews.set(entityId, node);
            node.active = true;
        }
        return node;
    }

    /** 回收视图 */
    release(entityId: number): void {
        const node = this.activeViews.get(entityId);
        if (!node) return;

        this.activeViews.delete(entityId);
        node.active = false;
        
        // 重置节点状态
        this.resetNode(node);
        
        // 放回池中
        const prefabKey = node.name; // 假设 name 存储 prefabKey
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = [];
            this.pools.set(prefabKey, pool);
        }
        
        if (pool.length < this.maxPoolSize) {
            pool.push(node);
        } else {
            // 池已满，销毁节点
            node.destroy();
        }
    }

    private createNode(prefabKey: string): Node {
        // TODO: 从资源管理器加载 Prefab 并实例化
        const node = new Node(prefabKey);
        return node;
    }

    private resetNode(node: Node): void {
        node.setPosition(0, 0, 0);
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(1, 1, 1);
        // 重置其他状态...
    }

    /** 清空所有池 */
    clear(): void {
        for (const pool of this.pools.values()) {
            for (const node of pool) {
                node.destroy();
            }
        }
        this.pools.clear();
        this.activeViews.clear();
    }
}
```

**优点：**
- ✅ 实现简单
- ✅ 支持多种类型
- ✅ 内存可控（池大小限制）

**缺点：**
- ⚠️ 需要手动管理 prefabKey（通过 node.name）
- ⚠️ Map 不能直接序列化

---

### 方案 2：多池管理（推荐）

**设计思路：**
- 为每种 prefabKey 创建独立的池
- 使用工厂模式创建节点

**实现：**
```typescript
export class ViewPool {
    /** 视图池：prefabKey -> Pool */
    private pools: Map<string, NodePool> = new Map();
    
    /** 正在使用的视图：entityId -> Node */
    private activeViews: Map<number, Node> = new Map();
    
    /** 默认池大小 */
    private defaultMaxSize: number = 20;

    /** 获取视图 */
    get(prefabKey: string, entityId: number): Node | null {
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = new NodePool(prefabKey, this.defaultMaxSize);
            this.pools.set(prefabKey, pool);
        }

        const node = pool.get();
        if (node) {
            this.activeViews.set(entityId, node);
            node.active = true;
        }
        return node;
    }

    /** 回收视图 */
    release(entityId: number): void {
        const node = this.activeViews.get(entityId);
        if (!node) return;

        this.activeViews.delete(entityId);
        
        // 查找对应的池（通过节点上的标记）
        const prefabKey = (node as any).__prefabKey;
        if (prefabKey) {
            const pool = this.pools.get(prefabKey);
            if (pool) {
                pool.release(node);
            }
        }
    }

    /** 清空所有池 */
    clear(): void {
        for (const pool of this.pools.values()) {
            pool.clear();
        }
        this.pools.clear();
        this.activeViews.clear();
    }
}

class NodePool {
    private pool: Node[] = [];
    private maxSize: number;
    private prefabKey: string;

    constructor(prefabKey: string, maxSize: number) {
        this.prefabKey = prefabKey;
        this.maxSize = maxSize;
    }

    get(): Node {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        // 创建新节点
        return this.createNode();
    }

    release(node: Node): void {
        // 重置节点
        node.active = false;
        node.setPosition(0, 0, 0);
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(1, 1, 1);
        
        // 标记 prefabKey
        (node as any).__prefabKey = this.prefabKey;
        
        if (this.pool.length < this.maxSize) {
            this.pool.push(node);
        } else {
            node.destroy();
        }
    }

    private createNode(): Node {
        // TODO: 从资源管理器加载 Prefab 并实例化
        const node = new Node(this.prefabKey);
        (node as any).__prefabKey = this.prefabKey;
        return node;
    }

    clear(): void {
        for (const node of this.pool) {
            node.destroy();
        }
        this.pool = [];
    }
}
```

**优点：**
- ✅ 封装性好：每个池独立管理
- ✅ 易于扩展：可以针对不同类型设置不同池大小
- ✅ 代码清晰

**缺点：**
- ⚠️ 需要额外的 NodePool 类

---

### 方案 3：懒加载 + 预加载

**设计思路：**
- 支持预加载（提前创建节点）
- 支持懒加载（需要时创建）

**实现：**
```typescript
export class ViewPool {
    private pools: Map<string, NodePool> = new Map();
    private activeViews: Map<number, Node> = new Map();
    private prefabCache: Map<string, Prefab> = new Map();

    /** 预加载视图 */
    async preload(prefabKey: string, count: number): Promise<void> {
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = new NodePool(prefabKey, count * 2);
            this.pools.set(prefabKey, pool);
        }

        // 加载 Prefab
        const prefab = await this.loadPrefab(prefabKey);
        this.prefabCache.set(prefabKey, prefab);

        // 预创建节点
        for (let i = 0; i < count; i++) {
            const node = instantiate(prefab);
            pool.release(node);
        }
    }

    private async loadPrefab(prefabKey: string): Promise<Prefab> {
        // TODO: 从资源管理器加载
        return null as any;
    }
}
```

**优点：**
- ✅ 支持预加载，减少运行时开销
- ✅ 支持懒加载，按需创建

**缺点：**
- ⚠️ 实现复杂
- ⚠️ 需要异步加载支持

---

## 方案对比

| 方案 | 实现复杂度 | 性能 | 可扩展性 | 内存管理 |
|------|------------|------|----------|----------|
| 方案 1：单池+映射 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 2：多池管理 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 方案 3：懒加载+预加载 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 推荐方案

### 🏆 方案 2：多池管理（适合 MVP）

**理由：**
1. **封装性好：** 每个池独立管理，代码清晰
2. **易于扩展：** 可以针对不同类型设置不同池大小
3. **性能好：** 对象复用，减少创建/销毁开销
4. **内存可控：** 池大小限制，避免内存泄漏

**如果未来需要预加载：**
- 可以在方案 2 基础上添加预加载功能（方案 3）

---

## 实施指南

### 关键方法

1. `get(prefabKey, entityId)` - 获取视图（从池中或创建新节点）
2. `release(entityId)` - 回收视图（放回池中）
3. `clear()` - 清空所有池
4. `preload(prefabKey, count)` - 预加载（可选）

### 与 ViewManager 集成

```typescript
export class ViewManager {
    private viewPool: ViewPool;

    constructor() {
        this.viewPool = new ViewPool();
    }

    private spawnView(entityId: number, prefabKey: string): void {
        // 从池中获取节点
        const node = this.viewPool.get(prefabKey, entityId);
        if (node) {
            const scene = director.getScene();
            if (scene) {
                scene.addChild(node);
            }
            this.entityNodeMap.set(entityId, node);
        }
    }

    private destroyView(entityId: number): void {
        const node = this.entityNodeMap.get(entityId);
        if (node) {
            // 回收到池中
            this.viewPool.release(entityId);
            this.entityNodeMap.delete(entityId);
        }
    }
}
```

---

## 验证

实施后需要验证：
- ✅ 视图对象复用正常
- ✅ 池大小限制正常
- ✅ 内存不会无限增长
- ✅ 与 ViewManager 集成正常

---

## 🎨🎨🎨 EXITING CREATIVE PHASE
