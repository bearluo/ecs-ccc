# Handle 作为 Map Key 的问题和解决方案

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前代码使用 `Map<Handle, Node>` 来存储 Handle 到 Node 的映射，但 Handle 可能是一个临时对象：

1. **问题：** 如果 `entity.handle` 每次返回新的对象实例，Map 的 key 比较会失败
2. **后果：** `handleNodeMap.get(handle)` 无法正确找到对应的 Node
3. **影响：** 所有使用 Handle 作为 key 的地方都会失效

## 设计选项

### 选项 1：使用 Handle 的唯一标识符作为 Key（推荐）⭐

**设计：** 将 Handle 转换为字符串 key：`${handle.id}_${handle.gen}`

**优点：**
- ✅ 稳定可靠，不依赖对象引用
- ✅ 性能好，字符串比较快速
- ✅ 易于调试（可以打印 key）

**缺点：**
- ⚠️ 需要 Handle 有 id 和 gen 属性
- ⚠️ 需要确保 Handle 结构稳定

**实现：**
```typescript
// 创建 Handle 的字符串 key
private getHandleKey(handle: Handle): string {
    return `${handle.id}_${handle.gen}`;
}

// 使用字符串 key 的 Map
private handleNodeMap: Map<string, Node> = new Map();
```

---

### 选项 2：使用 WeakMap（不推荐）

**设计：** 使用 `WeakMap<Handle, Node>`

**优点：**
- ✅ 自动垃圾回收
- ✅ 不需要手动清理

**缺点：**
- ❌ 无法遍历（无法实现 clear() 方法）
- ❌ 无法获取 size
- ❌ 如果 Handle 是临时对象，仍然无法工作

---

### 选项 3：使用 entityId 作为 Key（回退方案）

**设计：** 如果 Handle 不稳定，回退到使用 entityId

**优点：**
- ✅ 简单直接
- ✅ 性能好

**缺点：**
- ❌ 失去了 Handle 的优势（避免 entityId 复用）
- ❌ 需要额外维护 Handle → entityId 映射

---

## 推荐方案：选项 1（Handle 唯一标识符）

### 实现方案

**假设 Handle 结构：**
```typescript
type Handle = {
    id: number;
    gen: number;
}
```

**实现：**
```typescript
export class ViewManager {
    /** Handle Key → Node 映射 */
    private handleNodeMap: Map<string, Node> = new Map();

    /** Node → Handle Key 映射（反向查找） */
    private nodeHandleKeyMap: Map<Node, string> = new Map();

    /**
     * 获取 Handle 的唯一 key
     */
    private getHandleKey(handle: Handle): string {
        return `${handle.id}_${handle.gen}`;
    }

    private spawnView(handle: Handle, prefabKey: string): void {
        const handleKey = this.getHandleKey(handle);
        
        // 如果已存在，先销毁
        if (this.handleNodeMap.has(handleKey)) {
            this.destroyView(handle);
        }

        // ... 其他逻辑

        // 记录映射
        this.handleNodeMap.set(handleKey, node);
        this.nodeHandleKeyMap.set(node, handleKey);
    }

    private getNodeByHandle(handle: Handle): Node | undefined {
        const handleKey = this.getHandleKey(handle);
        return this.handleNodeMap.get(handleKey);
    }
}
```

### 验证 Handle 结构

**需要确认：**
1. Handle 是否有 `id` 和 `gen` 属性？
2. Handle 是否是稳定的对象引用？
3. 如果 Handle 是稳定的，可以直接使用对象作为 key

**验证方法：**
```typescript
// 测试 Handle 是否稳定
const entity = world.getEntityByHandle(handle);
const handle1 = entity.handle;
const handle2 = entity.handle;
console.log(handle1 === handle2); // 如果 true，说明是稳定引用
console.log(handle1.id, handle1.gen); // 检查结构
```

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [ ] 验证 Handle 的实际结构
- [ ] 如果 Handle 不稳定，实现字符串 key 方案
- [ ] 如果 Handle 稳定，保持当前实现
- [ ] 测试 Map 的 get/set 操作
- [ ] 更新所有使用 Handle 作为 key 的地方
