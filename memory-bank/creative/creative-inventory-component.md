# 创意阶段：Inventory 背包组件设计

## 问题描述

在肉鸽游戏中，实体需要支持背包系统：
- 支持存储多个物品（装备、消耗品、材料等）
- 每个物品有数量（堆叠）
- 背包有容量限制（格子数或重量限制）
- 支持物品添加、移除、查找
- 物品可能来自掉落（LootSystem）
- 物品可能被装备（EquipmentComponent）
- 需要存储物品数据（物品ID、数量、配置等）
- 数据可序列化（用于存档）

**需求：**
1. 支持多个物品槽位（固定或动态）
2. 支持物品堆叠（相同物品合并）
3. 支持背包容量限制
4. 支持物品添加、移除、查找
5. 支持物品使用（消耗品）
6. 数据可序列化

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效查询和更新
- 需要与 EquipmentComponent 集成（装备从背包移除）
- 需要与 LootSystem 集成（掉落物品添加到背包）
- 需要支持肉鸽游戏的常见物品类型（装备、消耗品、材料等）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：固定槽位数组（每个槽位一个物品）

**设计思路：**
- 使用固定大小的数组存储物品槽位
- 每个槽位可以存储一个物品和数量
- 相同物品不会自动堆叠（需要手动堆叠）

**实现：**
```typescript
export interface InventoryItem {
    itemId: string;          // 物品 ID（用于查找配置）
    config: ItemConfig;      // 物品配置（从 ConfigLoader 加载）
    count: number;           // 数量（堆叠数量）
    slotIndex: number;       // 槽位索引
}

@component({ name: 'Inventory', pooled: true, poolSize: 50 })
export class InventoryComponent extends Component {
    /** 背包槽位数组（固定大小，如 30 个） */
    slots: (InventoryItem | null)[] = new Array(30).fill(null);

    /** 最大槽位数 */
    readonly maxSlots: number = 30;

    /** 当前使用的槽位数 */
    get usedSlots(): number {
        return this.slots.filter(slot => slot !== null).length;
    }

    /** 是否有空槽位 */
    get hasEmptySlot(): boolean {
        return this.usedSlots < this.maxSlots;
    }

    /** 添加物品（自动查找空槽位或堆叠） */
    addItem(itemId: string, count: number, configLoader: ConfigLoader): boolean {
        const config = configLoader.getItemConfig(itemId);
        if (!config) return false;

        // 如果物品可堆叠，尝试堆叠到现有槽位
        if (config.stackable) {
            for (let i = 0; i < this.maxSlots; i++) {
                const slot = this.slots[i];
                if (slot && slot.itemId === itemId) {
                    const maxStack = config.maxStack || 99;
                    const canAdd = Math.min(count, maxStack - slot.count);
                    if (canAdd > 0) {
                        slot.count += canAdd;
                        count -= canAdd;
                        if (count <= 0) return true;
                    }
                }
            }
        }

        // 查找空槽位
        for (let i = 0; i < this.maxSlots && count > 0; i++) {
            if (this.slots[i] === null) {
                const maxStack = config.maxStack || 99;
                const addCount = Math.min(count, maxStack);
                this.slots[i] = {
                    itemId,
                    config,
                    count: addCount,
                    slotIndex: i
                };
                count -= addCount;
            }
        }

        return count === 0; // 是否全部添加成功
    }

    /** 移除物品 */
    removeItem(slotIndex: number, count: number): boolean {
        const slot = this.slots[slotIndex];
        if (!slot) return false;

        if (slot.count <= count) {
            this.slots[slotIndex] = null;
        } else {
            slot.count -= count;
        }
        return true;
    }

    /** 获取物品（通过槽位索引） */
    getItem(slotIndex: number): InventoryItem | null {
        return slotIndex >= 0 && slotIndex < this.maxSlots ? this.slots[slotIndex] : null;
    }

    /** 查找物品槽位（通过物品 ID） */
    findItem(itemId: string): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] && this.slots[i]!.itemId === itemId) {
                indices.push(i);
            }
        }
        return indices;
    }

    reset(): void {
        super.reset();
        this.slots = new Array(30).fill(null);
    }
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 固定大小，内存可预测
- ✅ 索引访问快速（O(1)）
- ✅ 支持物品堆叠（通过 stackable 配置）
- ✅ 可序列化

**缺点：**
- ❌ 固定槽位数（无法动态扩展）
- ❌ 查找物品需要遍历（O(n)）
- ❌ 相同物品可能分散在多个槽位（需要手动堆叠）

---

### 方案 2：动态数组 + 自动堆叠

**设计思路：**
- 使用动态数组存储物品（只存储非空物品）
- 添加物品时自动堆叠（相同物品合并）
- 移除物品时自动整理（移除空槽位）

**实现：**
```typescript
export interface InventoryItem {
    itemId: string;
    config: ItemConfig;
    count: number;
}

@component({ name: 'Inventory', pooled: true, poolSize: 50 })
export class InventoryComponent extends Component {
    /** 物品列表（动态数组，自动堆叠） */
    items: InventoryItem[] = [];

    /** 最大槽位数 */
    readonly maxSlots: number = 30;

    /** 当前使用的槽位数（不同物品类型数量） */
    get usedSlots(): number {
        return this.items.length;
    }

    /** 是否有空槽位 */
    get hasEmptySlot(): boolean {
        return this.items.length < this.maxSlots;
    }

    /** 添加物品（自动堆叠） */
    addItem(itemId: string, count: number, configLoader: ConfigLoader): boolean {
        const config = configLoader.getItemConfig(itemId);
        if (!config) return false;

        // 如果物品可堆叠，尝试堆叠到现有物品
        if (config.stackable) {
            for (const item of this.items) {
                if (item.itemId === itemId) {
                    const maxStack = config.maxStack || 99;
                    const canAdd = Math.min(count, maxStack - item.count);
                    if (canAdd > 0) {
                        item.count += canAdd;
                        count -= canAdd;
                        if (count <= 0) return true;
                    }
                }
            }
        }

        // 添加新物品（直到槽位满了或数量用完）
        while (count > 0 && this.items.length < this.maxSlots) {
            const maxStack = config.maxStack || 99;
            const addCount = Math.min(count, maxStack);
            this.items.push({
                itemId,
                config,
                count: addCount
            });
            count -= addCount;
        }

        return count === 0; // 是否全部添加成功
    }

    /** 移除物品（通过物品 ID 和数量） */
    removeItem(itemId: string, count: number): boolean {
        let remaining = count;
        
        for (let i = this.items.length - 1; i >= 0 && remaining > 0; i--) {
            const item = this.items[i];
            if (item.itemId === itemId) {
                if (item.count <= remaining) {
                    remaining -= item.count;
                    this.items.splice(i, 1); // 移除整个物品
                } else {
                    item.count -= remaining;
                    remaining = 0;
                }
            }
        }

        return remaining === 0;
    }

    /** 移除物品（通过索引和数量） */
    removeItemByIndex(index: number, count: number): boolean {
        if (index < 0 || index >= this.items.length) return false;

        const item = this.items[index];
        if (item.count <= count) {
            this.items.splice(index, 1);
        } else {
            item.count -= count;
        }
        return true;
    }

    /** 获取物品（通过索引） */
    getItem(index: number): InventoryItem | null {
        return index >= 0 && index < this.items.length ? this.items[index] : null;
    }

    /** 查找物品（通过物品 ID） */
    findItem(itemId: string): InventoryItem | null {
        return this.items.find(item => item.itemId === itemId) || null;
    }

    /** 获取物品总数（通过物品 ID，考虑堆叠） */
    getItemCount(itemId: string): number {
        return this.items
            .filter(item => item.itemId === itemId)
            .reduce((sum, item) => sum + item.count, 0);
    }

    reset(): void {
        super.reset();
        this.items = [];
    }
}
```

**优点：**
- ✅ 自动堆叠（相同物品自动合并）
- ✅ 内存效率高（只存储非空物品）
- ✅ 易于查找（可以快速找到物品）
- ✅ 自动整理（移除时自动删除空槽位）

**缺点：**
- ❌ 动态数组操作（添加/删除需要 O(n)）
- ❌ 槽位索引不稳定（移除物品后索引变化）
- ❌ 不支持固定槽位概念（UI 显示时可能不方便）

---

### 方案 3：固定槽位数组 + Map 索引（混合方案）

**设计思路：**
- 使用固定数组存储物品槽位（保持槽位索引稳定）
- 使用 Map 建立物品 ID 到槽位索引的映射（快速查找）
- 添加物品时自动堆叠（相同物品合并）

**实现：**
```typescript
export interface InventoryItem {
    itemId: string;
    config: ItemConfig;
    count: number;
    slotIndex: number;
}

@component({ name: 'Inventory', pooled: true, poolSize: 50 })
export class InventoryComponent extends Component {
    /** 物品槽位数组（固定大小） */
    slots: (InventoryItem | null)[] = new Array(30).fill(null);

    /** 物品 ID 到槽位索引的映射（用于快速查找） */
    private itemIndexMap: Map<string, number[]> = new Map();

    /** 最大槽位数 */
    readonly maxSlots: number = 30;

    /** 添加物品（自动堆叠） */
    addItem(itemId: string, count: number, configLoader: ConfigLoader): boolean {
        const config = configLoader.getItemConfig(itemId);
        if (!config) return false;

        // 如果物品可堆叠，尝试堆叠到现有槽位
        if (config.stackable) {
            const indices = this.itemIndexMap.get(itemId) || [];
            for (const index of indices) {
                const slot = this.slots[index];
                if (slot && slot.itemId === itemId) {
                    const maxStack = config.maxStack || 99;
                    const canAdd = Math.min(count, maxStack - slot.count);
                    if (canAdd > 0) {
                        slot.count += canAdd;
                        count -= canAdd;
                        if (count <= 0) return true;
                    }
                }
            }
        }

        // 查找空槽位
        for (let i = 0; i < this.maxSlots && count > 0; i++) {
            if (this.slots[i] === null) {
                const maxStack = config.maxStack || 99;
                const addCount = Math.min(count, maxStack);
                this.slots[i] = {
                    itemId,
                    config,
                    count: addCount,
                    slotIndex: i
                };
                this.updateItemIndex(itemId, i);
                count -= addCount;
            }
        }

        return count === 0;
    }

    /** 移除物品（通过槽位索引） */
    removeItem(slotIndex: number, count: number): boolean {
        const slot = this.slots[slotIndex];
        if (!slot) return false;

        if (slot.count <= count) {
            this.slots[slotIndex] = null;
            this.removeItemIndex(slot.itemId, slotIndex);
        } else {
            slot.count -= count;
        }
        return true;
    }

    /** 查找物品槽位（通过物品 ID） */
    findItem(itemId: string): number[] {
        return this.itemIndexMap.get(itemId) || [];
    }

    /** 获取物品总数（通过物品 ID，考虑堆叠） */
    getItemCount(itemId: string): number {
        const indices = this.itemIndexMap.get(itemId) || [];
        return indices.reduce((sum, index) => {
            const slot = this.slots[index];
            return sum + (slot ? slot.count : 0);
        }, 0);
    }

    private updateItemIndex(itemId: string, slotIndex: number): void {
        const indices = this.itemIndexMap.get(itemId) || [];
        if (!indices.includes(slotIndex)) {
            indices.push(slotIndex);
            this.itemIndexMap.set(itemId, indices);
        }
    }

    private removeItemIndex(itemId: string, slotIndex: number): void {
        const indices = this.itemIndexMap.get(itemId) || [];
        const index = indices.indexOf(slotIndex);
        if (index >= 0) {
            indices.splice(index, 1);
            if (indices.length === 0) {
                this.itemIndexMap.delete(itemId);
            } else {
                this.itemIndexMap.set(itemId, indices);
            }
        }
    }

    reset(): void {
        super.reset();
        this.slots = new Array(30).fill(null);
        this.itemIndexMap.clear();
    }
}
```

**优点：**
- ✅ 槽位索引稳定（UI 显示友好）
- ✅ 快速查找（Map 索引 O(1)）
- ✅ 支持自动堆叠
- ✅ 固定大小，内存可预测

**缺点：**
- ❌ 复杂度稍高（需要维护 Map 索引）
- ❌ 序列化时需要处理 Map（需要转换为数组）
- ❌ Map 在序列化时可能丢失（需要特殊处理）

---

### 方案 4：固定槽位数组（简化版，无 Map 索引）

**设计思路：**
- 使用固定数组存储物品槽位（方案 1 的简化版）
- 不维护 Map 索引（查找时遍历，对于 30 个槽位性能足够）
- 添加物品时自动堆叠

**实现：**
```typescript
export interface InventoryItem {
    itemId: string;
    config: ItemConfig;
    count: number;
    slotIndex: number;
}

@component({ name: 'Inventory', pooled: true, poolSize: 50 })
export class InventoryComponent extends Component {
    /** 物品槽位数组（固定大小，如 30 个） */
    slots: (InventoryItem | null)[] = new Array(30).fill(null);

    /** 最大槽位数 */
    readonly maxSlots: number = 30;

    /** 当前使用的槽位数 */
    get usedSlots(): number {
        return this.slots.filter(slot => slot !== null).length;
    }

    /** 是否有空槽位 */
    get hasEmptySlot(): boolean {
        return this.usedSlots < this.maxSlots;
    }

    /** 添加物品（自动堆叠） */
    addItem(itemId: string, count: number, configLoader: ConfigLoader): boolean {
        const config = configLoader.getItemConfig(itemId);
        if (!config) return false;

        // 如果物品可堆叠，尝试堆叠到现有槽位
        if (config.stackable) {
            for (let i = 0; i < this.maxSlots; i++) {
                const slot = this.slots[i];
                if (slot && slot.itemId === itemId) {
                    const maxStack = config.maxStack || 99;
                    const canAdd = Math.min(count, maxStack - slot.count);
                    if (canAdd > 0) {
                        slot.count += canAdd;
                        count -= canAdd;
                        if (count <= 0) return true;
                    }
                }
            }
        }

        // 查找空槽位
        for (let i = 0; i < this.maxSlots && count > 0; i++) {
            if (this.slots[i] === null) {
                const maxStack = config.maxStack || 99;
                const addCount = Math.min(count, maxStack);
                this.slots[i] = {
                    itemId,
                    config,
                    count: addCount,
                    slotIndex: i
                };
                count -= addCount;
            }
        }

        return count === 0;
    }

    /** 移除物品（通过槽位索引） */
    removeItem(slotIndex: number, count: number): boolean {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return false;

        const slot = this.slots[slotIndex];
        if (!slot) return false;

        if (slot.count <= count) {
            this.slots[slotIndex] = null;
        } else {
            slot.count -= count;
        }
        return true;
    }

    /** 移除物品（通过物品 ID 和数量） */
    removeItemByType(itemId: string, count: number): boolean {
        let remaining = count;
        
        for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot && slot.itemId === itemId) {
                if (slot.count <= remaining) {
                    remaining -= slot.count;
                    this.slots[i] = null;
                } else {
                    slot.count -= remaining;
                    remaining = 0;
                }
            }
        }

        return remaining === 0;
    }

    /** 获取物品（通过槽位索引） */
    getItem(slotIndex: number): InventoryItem | null {
        return slotIndex >= 0 && slotIndex < this.maxSlots ? this.slots[slotIndex] : null;
    }

    /** 查找物品槽位（通过物品 ID） */
    findItem(itemId: string): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] && this.slots[i]!.itemId === itemId) {
                indices.push(i);
            }
        }
        return indices;
    }

    /** 获取物品总数（通过物品 ID，考虑堆叠） */
    getItemCount(itemId: string): number {
        return this.findItem(itemId).reduce((sum, index) => {
            const slot = this.slots[index];
            return sum + (slot ? slot.count : 0);
        }, 0);
    }

    reset(): void {
        super.reset();
        this.slots = new Array(30).fill(null);
    }
}
```

**优点：**
- ✅ 实现简单（无 Map 索引，代码清晰）
- ✅ 槽位索引稳定（UI 显示友好）
- ✅ 直接序列化（数组可以直接 JSON 序列化）
- ✅ 支持自动堆叠
- ✅ 固定大小，内存可预测
- ✅ 对于 30 个槽位，遍历查找性能足够（O(n) 但 n 小）

**缺点：**
- ❌ 查找需要遍历（但对于固定槽位数，性能可接受）
- ❌ 相同物品可能分散在多个槽位（需要手动整理）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 4（固定槽位数组，简化版）

**理由：**
1. **简单实用：** 对于肉鸽游戏，背包通常固定大小（如 30 个槽位），不需要动态扩展
2. **槽位索引稳定：** 固定槽位索引对 UI 显示友好（槽位位置固定）
3. **直接序列化：** 数组可以直接 JSON 序列化，无需转换
4. **性能足够：** 对于 30 个槽位，遍历查找性能足够（O(30) = O(1) 实际效果）
5. **易于维护：** 无 Map 索引，代码更简单，减少维护成本

**实现建议：**
1. 创建 `InventoryComponent`（固定槽位数组，30 个槽位）
2. 定义 `InventoryItem` 接口（物品ID、配置、数量、槽位索引）
3. 定义 `ItemConfig` 配置接口（物品ID、名称、类型、可堆叠、最大堆叠数等）
4. 创建 `InventorySystem` 负责：
   - 处理物品添加/移除（自动堆叠）
   - 处理物品使用（消耗品）
   - 与 EquipmentSystem 集成（装备从背包移除）
   - 与 LootSystem 集成（掉落物品添加到背包）
5. 创建 `ItemConfig` 配置（物品属性、类型、堆叠规则等）

**与现有系统的集成：**
- `EquipmentSystem`：装备物品时，从背包移除物品；卸下装备时，添加到背包
- `LootSystem`：击杀敌人掉落物品时，添加到背包
- `ConfigLoader`：存储物品配置（ItemConfig）
- `StatsComponent`：通过 EquipmentSystem 间接影响（装备物品时添加属性加成）

**物品配置示例：**
```typescript
export interface ItemConfig {
    id: string;
    name: string;
    type: 'equipment' | 'consumable' | 'material' | 'quest';
    stackable: boolean;      // 是否可堆叠
    maxStack?: number;       // 最大堆叠数（默认 99）
    icon?: string;           // 图标路径
    description?: string;    // 描述
    // 如果是装备，包含装备配置
    equipmentConfig?: EquipmentConfig;
    // 如果是消耗品，包含使用效果
    consumableEffect?: {
        type: 'heal' | 'buff' | 'damage';
        value: number;
        duration?: number;
    };
}
```

**数据序列化：**
数组可以直接 JSON 序列化，所有字段都是可序列化的简单类型。

---

## 实施指南

### 1. 组件接口定义

```typescript
// assets/scripts/gameplay/components/Inventory.ts

export interface InventoryItem {
    itemId: string;          // 物品 ID（用于查找配置）
    config: ItemConfig;      // 物品配置（从 ConfigLoader 加载）
    count: number;           // 数量（堆叠数量）
    slotIndex: number;       // 槽位索引
}
```

### 2. 组件实现

见方案 4 的实现代码。

### 3. 系统集成

创建 `InventorySystem`：
```typescript
// assets/scripts/gameplay/systems/InventorySystem.ts

@system({ priority: 7 })  // 在 EquipmentSystem 之后
export class InventorySystem extends System {
    private configLoader?: ConfigLoader;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    /**
     * 添加物品到背包（外部调用）
     */
    addItem(entity: Entity, itemId: string, count: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory || !this.configLoader) return false;

        return inventory.addItem(itemId, count, this.configLoader);
    }

    /**
     * 从背包移除物品（外部调用）
     */
    removeItem(entity: Entity, slotIndex: number, count: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory) return false;

        return inventory.removeItem(slotIndex, count);
    }

    /**
     * 使用物品（消耗品，外部调用）
     */
    useItem(entity: Entity, slotIndex: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory) return false;

        const item = inventory.getItem(slotIndex);
        if (!item || item.config.type !== 'consumable') return false;

        // 应用消耗品效果（根据配置）
        // 例如：恢复生命值、添加 Buff 等
        
        // 消耗数量
        return inventory.removeItem(slotIndex, 1);
    }

    onUpdate(dt: number): void {
        // 可选：处理物品自动整理、物品过期等
    }
}
```

### 4. 配置集成

在 `data/configs/` 中创建物品配置：

```typescript
// assets/scripts/data/configs/items.ts

export interface ItemConfig {
    id: string;
    name: string;
    type: 'equipment' | 'consumable' | 'material' | 'quest';
    stackable: boolean;
    maxStack?: number;
    icon?: string;
    description?: string;
    equipmentConfig?: EquipmentConfig;  // 如果是装备，包含装备配置
    consumableEffect?: {
        type: 'heal' | 'buff' | 'damage';
        value: number;
        duration?: number;
    };
}

export const ItemConfigs: Record<string, ItemConfig> = {
    'potion_heal': {
        id: 'potion_heal',
        name: '治疗药水',
        type: 'consumable',
        stackable: true,
        maxStack: 10,
        consumableEffect: {
            type: 'heal',
            value: 50,
        },
    },
    'scroll_speed': {
        id: 'scroll_speed',
        name: '速度卷轴',
        type: 'consumable',
        stackable: true,
        maxStack: 5,
        consumableEffect: {
            type: 'buff',
            value: 0.2,  // +20% 速度
            duration: 10,
        },
    },
    // 装备类型的物品需要包含 equipmentConfig
    'sword_iron': {
        id: 'sword_iron',
        name: '铁剑',
        type: 'equipment',
        stackable: false,
        equipmentConfig: EquipmentConfigs['sword_iron'],  // 引用装备配置
    },
};
```

---

## 验收标准

- [ ] InventoryComponent 可以正确存储和管理物品
- [ ] 支持物品自动堆叠（相同物品合并）
- [ ] 支持背包容量限制（最大槽位数）
- [ ] 支持物品添加、移除、查找
- [ ] 支持物品使用（消耗品效果）
- [ ] 与 EquipmentSystem 集成（装备从背包移除）
- [ ] 与 LootSystem 集成（掉落物品添加到背包）
- [ ] 数据可序列化
- [ ] InventorySystem 正确处理物品管理逻辑
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持背包分类（按类型分组显示）
2. 支持背包排序（按名称、类型、稀有度等）
3. 支持背包整理（自动整理物品位置）
4. 支持背包搜索（快速查找物品）
5. 支持重量限制（不只是槽位数限制）
6. 支持背包扩展（通过升级增加槽位数）

但对于肉鸽游戏，方案 4 的简单实现已经足够。
