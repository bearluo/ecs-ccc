# 创意阶段：BuffList 组件数据结构设计

## 问题描述

在肉鸽游戏中，实体需要支持多个 Buff 效果（增益/减益），每个 Buff 可能有：
- 唯一 ID 和类型
- 持续时间（剩余时间）
- 堆叠层数（某些 Buff 可堆叠）
- 数值参数（如伤害加成、移动速度等）
- 来源信息（哪个技能/道具添加的）

**需求：**
1. 支持多个 Buff 同时存在
2. 支持 Buff 堆叠（相同类型可叠加层数）
3. 支持 Buff 持续时间管理
4. 支持 Buff 移除和查询
5. 数据可序列化（用于存档）

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效查询和更新
- 需要支持肉鸽游戏的常见 Buff 类型（伤害加成、速度、护盾、持续伤害等）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：数组 + Map 索引

**设计思路：**
- 使用数组存储 Buff 数据
- 使用 Map 建立 Buff 类型到数组索引的映射，快速查找

**实现：**
```typescript
@component({ name: 'BuffList', pooled: true, poolSize: 50 })
export class BuffListComponent extends Component {
    /** Buff 数据数组 */
    buffs: BuffData[] = [];
    
    /** Buff 类型到索引的映射（用于快速查找） */
    private typeIndexMap: Map<string, number[]> = new Map();

    /** 添加 Buff */
    addBuff(buffId: string, type: string, duration: number, stacks: number = 1, params?: any): void {
        const existingIndex = this.findBuffIndex(type);
        if (existingIndex >= 0) {
            // 堆叠
            this.buffs[existingIndex].stacks += stacks;
            this.buffs[existingIndex].duration = Math.max(this.buffs[existingIndex].duration, duration);
        } else {
            // 新增
            const buff: BuffData = {
                id: buffId,
                type,
                duration,
                stacks,
                params: params || {}
            };
            this.buffs.push(buff);
            this.updateTypeIndex(type, this.buffs.length - 1);
        }
    }

    /** 移除 Buff */
    removeBuff(type: string): void {
        const index = this.findBuffIndex(type);
        if (index >= 0) {
            this.buffs.splice(index, 1);
            this.rebuildTypeIndex();
        }
    }

    /** 查找 Buff */
    findBuff(type: string): BuffData | undefined {
        const index = this.findBuffIndex(type);
        return index >= 0 ? this.buffs[index] : undefined;
    }

    private findBuffIndex(type: string): number {
        const indices = this.typeIndexMap.get(type);
        return indices && indices.length > 0 ? indices[0] : -1;
    }

    reset(): void {
        super.reset();
        this.buffs = [];
        this.typeIndexMap.clear();
    }
}

interface BuffData {
    id: string;           // 唯一 ID
    type: string;          // Buff 类型（如 "damage_boost", "speed_boost"）
    duration: number;      // 剩余时间（秒）
    stacks: number;        // 堆叠层数
    params: any;           // 参数（如 { value: 0.2 } 表示 20% 加成）
}
```

**优点：**
- ✅ 数组存储，内存连续，性能好
- ✅ Map 索引，查找快速
- ✅ 支持堆叠
- ✅ 可序列化（但 Map 需要特殊处理）

**缺点：**
- ⚠️ Map 不能直接序列化，需要转换
- ⚠️ 删除元素后需要重建索引

---

### 方案 2：纯对象字典

**设计思路：**
- 使用对象字典（Record）存储 Buff，key 为 Buff 类型

**实现：**
```typescript
@component({ name: 'BuffList', pooled: true, poolSize: 50 })
export class BuffListComponent extends Component {
    /** Buff 字典：type -> BuffData */
    buffs: Record<string, BuffData> = {};

    /** 添加 Buff */
    addBuff(buffId: string, type: string, duration: number, stacks: number = 1, params?: any): void {
        if (this.buffs[type]) {
            // 堆叠
            this.buffs[type].stacks += stacks;
            this.buffs[type].duration = Math.max(this.buffs[type].duration, duration);
        } else {
            // 新增
            this.buffs[type] = {
                id: buffId,
                type,
                duration,
                stacks,
                params: params || {}
            };
        }
    }

    /** 移除 Buff */
    removeBuff(type: string): void {
        delete this.buffs[type];
    }

    /** 查找 Buff */
    findBuff(type: string): BuffData | undefined {
        return this.buffs[type];
    }

    /** 获取所有 Buff */
    getAllBuffs(): BuffData[] {
        return Object.values(this.buffs);
    }

    reset(): void {
        super.reset();
        this.buffs = {};
    }
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 直接序列化（JSON 友好）
- ✅ 查找快速（O(1)）
- ✅ 删除简单

**缺点：**
- ⚠️ 每个类型只能有一个 Buff（但可通过 stacks 堆叠）
- ⚠️ 遍历需要 Object.values()

---

### 方案 3：数组 + 唯一 ID 索引

**设计思路：**
- 使用数组存储所有 Buff（支持同类型多个）
- 使用 Map 建立 ID 到索引的映射

**实现：**
```typescript
@component({ name: 'BuffList', pooled: true, poolSize: 50 })
export class BuffListComponent extends Component {
    /** Buff 数组（支持同类型多个） */
    buffs: BuffData[] = [];
    
    /** Buff ID 到索引的映射 */
    private idIndexMap: Map<string, number> = new Map();

    /** 添加 Buff */
    addBuff(buffId: string, type: string, duration: number, stacks: number = 1, params?: any): void {
        // 检查是否已存在（通过 ID）
        if (this.idIndexMap.has(buffId)) {
            const index = this.idIndexMap.get(buffId)!;
            this.buffs[index].stacks += stacks;
            this.buffs[index].duration = Math.max(this.buffs[index].duration, duration);
        } else {
            // 新增
            const buff: BuffData = {
                id: buffId,
                type,
                duration,
                stacks,
                params: params || {}
            };
            const index = this.buffs.length;
            this.buffs.push(buff);
            this.idIndexMap.set(buffId, index);
        }
    }

    /** 移除 Buff（通过 ID） */
    removeBuff(buffId: string): void {
        const index = this.idIndexMap.get(buffId);
        if (index !== undefined) {
            // 交换到末尾再删除（避免移动元素）
            const lastIndex = this.buffs.length - 1;
            if (index !== lastIndex) {
                const lastBuff = this.buffs[lastIndex];
                this.buffs[index] = lastBuff;
                this.idIndexMap.set(lastBuff.id, index);
            }
            this.buffs.pop();
            this.idIndexMap.delete(buffId);
        }
    }

    /** 查找 Buff（通过类型，返回第一个） */
    findBuffByType(type: string): BuffData | undefined {
        return this.buffs.find(buff => buff.type === type);
    }

    /** 查找所有同类型 Buff */
    findAllBuffsByType(type: string): BuffData[] {
        return this.buffs.filter(buff => buff.type === type);
    }

    reset(): void {
        super.reset();
        this.buffs = [];
        this.idIndexMap.clear();
    }
}
```

**优点：**
- ✅ 支持同类型多个 Buff（通过唯一 ID）
- ✅ 查找快速（通过 ID）
- ✅ 删除优化（交换到末尾）

**缺点：**
- ⚠️ Map 不能直接序列化
- ⚠️ 按类型查找需要遍历（O(n)）

---

### 方案 4：混合方案（类型字典 + 数组）

**设计思路：**
- 使用对象字典存储每个类型的 Buff 列表（支持同类型多个）
- 同时维护一个所有 Buff 的数组（用于遍历）

**实现：**
```typescript
@component({ name: 'BuffList', pooled: true, poolSize: 50 })
export class BuffListComponent extends Component {
    /** 按类型分组的 Buff 字典 */
    buffsByType: Record<string, BuffData[]> = {};
    
    /** 所有 Buff 的数组（用于遍历） */
    allBuffs: BuffData[] = [];

    /** 添加 Buff */
    addBuff(buffId: string, type: string, duration: number, stacks: number = 1, params?: any): void {
        const typeBuffs = this.buffsByType[type] || [];
        const existing = typeBuffs.find(b => b.id === buffId);
        
        if (existing) {
            // 更新现有 Buff
            existing.stacks += stacks;
            existing.duration = Math.max(existing.duration, duration);
        } else {
            // 新增
            const buff: BuffData = {
                id: buffId,
                type,
                duration,
                stacks,
                params: params || {}
            };
            typeBuffs.push(buff);
            this.buffsByType[type] = typeBuffs;
            this.allBuffs.push(buff);
        }
    }

    /** 移除 Buff */
    removeBuff(buffId: string, type: string): void {
        const typeBuffs = this.buffsByType[type];
        if (typeBuffs) {
            const index = typeBuffs.findIndex(b => b.id === buffId);
            if (index >= 0) {
                const buff = typeBuffs[index];
                typeBuffs.splice(index, 1);
                if (typeBuffs.length === 0) {
                    delete this.buffsByType[type];
                }
                
                // 从 allBuffs 中移除
                const allIndex = this.allBuffs.indexOf(buff);
                if (allIndex >= 0) {
                    this.allBuffs.splice(allIndex, 1);
                }
            }
        }
    }

    /** 查找 Buff（通过类型，返回第一个） */
    findBuffByType(type: string): BuffData | undefined {
        const typeBuffs = this.buffsByType[type];
        return typeBuffs && typeBuffs.length > 0 ? typeBuffs[0] : undefined;
    }

    reset(): void {
        super.reset();
        this.buffsByType = {};
        this.allBuffs = [];
    }
}
```

**优点：**
- ✅ 支持同类型多个 Buff
- ✅ 按类型查找快速（O(1)）
- ✅ 可序列化
- ✅ 支持遍历所有 Buff

**缺点：**
- ⚠️ 需要维护两个数据结构（同步问题）
- ⚠️ 删除时需要更新两个地方

---

## 方案对比

| 方案 | 查找性能 | 序列化 | 同类型多个 | 实现复杂度 | 内存效率 |
|------|----------|--------|------------|------------|----------|
| 方案 1：数组+Map | ⭐⭐⭐⭐ | ⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 2：对象字典 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 3：数组+ID索引 | ⭐⭐⭐ | ⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 4：混合方案 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 推荐方案

### 🏆 方案 2：纯对象字典（简化版，适合 MVP）

**理由：**
1. **实现简单：** 代码清晰，易于理解和维护
2. **序列化友好：** 直接 JSON 序列化，无需转换
3. **性能好：** 查找 O(1)，适合肉鸽游戏的常见场景
4. **堆叠支持：** 通过 `stacks` 字段支持堆叠，满足大部分需求

**适用场景：**
- 每个 Buff 类型在同一实体上只存在一个实例（通过 stacks 堆叠）
- 这是肉鸽游戏中最常见的场景

**如果未来需要同类型多个 Buff：**
- 可以升级到方案 4（混合方案）
- 或者使用方案 3（数组+ID索引）

---

## 实施指南

### 数据结构定义

```typescript
interface BuffData {
    id: string;           // 唯一 ID（用于区分同类型的不同 Buff）
    type: string;         // Buff 类型（如 "damage_boost", "speed_boost", "dot"）
    duration: number;     // 剩余时间（秒）
    stacks: number;       // 堆叠层数（默认 1）
    params: Record<string, any>;  // 参数（如 { value: 0.2 } 表示 20% 加成）
    source?: string;      // 来源（可选，如技能 ID）
}
```

### 关键方法

1. `addBuff(buffId, type, duration, stacks, params)` - 添加/更新 Buff
2. `removeBuff(type)` - 移除 Buff
3. `findBuff(type)` - 查找 Buff
4. `getAllBuffs()` - 获取所有 Buff（用于遍历）
5. `hasBuff(type)` - 检查是否有 Buff

### 使用示例

```typescript
// 添加伤害加成 Buff
buffList.addBuff('skill_001', 'damage_boost', 5.0, 1, { value: 0.2 });

// 堆叠 Buff
buffList.addBuff('skill_001', 'damage_boost', 5.0, 1, { value: 0.2 }); // stacks 变为 2

// 查找 Buff
const buff = buffList.findBuff('damage_boost');
if (buff) {
    const damageMultiplier = 1 + buff.params.value * buff.stacks; // 1.4 (20% * 2)
}

// 移除 Buff
buffList.removeBuff('damage_boost');
```

---

## 验证

实施后需要验证：
- ✅ Buff 添加和移除正常
- ✅ Buff 堆叠功能正常
- ✅ 数据可序列化
- ✅ 查询性能满足需求

---

## 🎨🎨🎨 EXITING CREATIVE PHASE
