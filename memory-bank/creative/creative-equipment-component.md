# 创意阶段：Equipment 装备组件设计

## 问题描述

在肉鸽游戏中，实体需要支持装备系统：
- 支持多个装备槽位（武器、防具、饰品等）
- 每个槽位只能装备特定类型的装备
- 装备提供属性加成（通过 StatsComponent.equipment）
- 支持装备替换和卸下
- 装备可能来自背包（Inventory）
- 需要存储装备数据（装备ID、配置、强化等级等）
- 数据可序列化（用于存档）

**需求：**
1. 支持多个装备槽位（固定或可扩展）
2. 支持装备类型限制（如武器槽只能装备武器）
3. 支持装备属性加成（与 StatsComponent 集成）
4. 支持装备替换和卸下
5. 支持装备强化/升级（可选）
6. 数据可序列化

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效查询和更新
- 需要与 StatsComponent 集成（装备时添加属性加成）
- 需要支持肉鸽游戏的常见装备类型（武器、护甲、饰品等）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：固定槽位 Map（按装备类型）

**设计思路：**
- 使用 Map 存储装备槽位（key: 装备类型，value: 装备数据）
- 每个装备类型对应一个槽位
- 装备类型定义明确（weapon、armor、accessory 等）

**实现：**
```typescript
// 装备类型枚举
export enum EquipmentType {
    Weapon = 'weapon',        // 武器
    Armor = 'armor',          // 护甲
    Helmet = 'helmet',        // 头盔
    Boots = 'boots',          // 靴子
    Accessory1 = 'accessory1', // 饰品1
    Accessory2 = 'accessory2', // 饰品2
}

// 装备数据
export interface EquipmentData {
    equipmentId: string;      // 装备 ID（用于查找配置）
    config: EquipmentConfig;  // 装备配置（从 ConfigLoader 加载）
    level: number;            // 强化等级（可选）
    durability?: number;      // 耐久度（可选）
}

@component({ name: 'Equipment', pooled: true, poolSize: 50 })
export class EquipmentComponent extends Component {
    /** 装备槽位（按类型存储） */
    slots: Map<EquipmentType, EquipmentData> = new Map();

    /** 获取装备 */
    getEquipment(type: EquipmentType): EquipmentData | undefined {
        return this.slots.get(type);
    }

    /** 装备物品 */
    equip(type: EquipmentType, equipmentId: string, config: EquipmentConfig, level: number = 1): EquipmentData | null {
        // 如果有旧装备，先卸下
        const oldEquipment = this.slots.get(type);
        this.slots.set(type, { equipmentId, config, level });
        return oldEquipment || null;
    }

    /** 卸下装备 */
    unequip(type: EquipmentType): EquipmentData | null {
        const equipment = this.slots.get(type);
        if (equipment) {
            this.slots.delete(type);
            return equipment;
        }
        return null;
    }

    /** 获取所有已装备的装备 */
    getAllEquipped(): EquipmentData[] {
        return Array.from(this.slots.values());
    }

    /** 检查是否已装备指定类型 */
    hasEquipment(type: EquipmentType): boolean {
        return this.slots.has(type);
    }

    reset(): void {
        super.reset();
        this.slots.clear();
    }
}
```

**优点：**
- ✅ 类型安全（枚举定义装备类型）
- ✅ 每个类型只有一个槽位（符合大多数游戏设计）
- ✅ 查询快速（Map 查找 O(1)）
- ✅ 易于扩展（新增装备类型只需添加枚举值）

**缺点：**
- ❌ Map 序列化需要特殊处理（需要转换为数组）
- ❌ 不支持同一类型多个槽位（如多个饰品槽）

---

### 方案 2：固定槽位数组（按索引）

**设计思路：**
- 使用固定数组存储装备槽位
- 每个索引对应一个固定的装备类型
- 通过索引访问槽位

**实现：**
```typescript
export enum EquipmentSlot {
    Weapon = 0,
    Armor = 1,
    Helmet = 2,
    Boots = 3,
    Accessory1 = 4,
    Accessory2 = 5,
}

export interface EquipmentData {
    equipmentId: string;
    config: EquipmentConfig;
    level: number;
    durability?: number;
}

@component({ name: 'Equipment', pooled: true, poolSize: 50 })
export class EquipmentComponent extends Component {
    /** 装备槽位数组（固定大小） */
    slots: (EquipmentData | null)[] = [null, null, null, null, null, null];

    /** 最大槽位数 */
    readonly maxSlots: number = 6;

    /** 获取装备 */
    getEquipment(slot: EquipmentSlot): EquipmentData | null {
        return slot >= 0 && slot < this.maxSlots ? this.slots[slot] : null;
    }

    /** 装备物品 */
    equip(slot: EquipmentSlot, equipmentId: string, config: EquipmentConfig, level: number = 1): EquipmentData | null {
        if (slot < 0 || slot >= this.maxSlots) return null;
        
        const oldEquipment = this.slots[slot];
        this.slots[slot] = { equipmentId, config, level };
        return oldEquipment || null;
    }

    /** 卸下装备 */
    unequip(slot: EquipmentSlot): EquipmentData | null {
        if (slot < 0 || slot >= this.maxSlots) return null;
        
        const equipment = this.slots[slot];
        if (equipment) {
            this.slots[slot] = null;
            return equipment;
        }
        return null;
    }

    /** 获取所有已装备的装备 */
    getAllEquipped(): EquipmentData[] {
        return this.slots.filter(slot => slot !== null) as EquipmentData[];
    }

    /** 查找空槽位 */
    findEmptySlot(): EquipmentSlot | null {
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] === null) {
                return i as EquipmentSlot;
            }
        }
        return null;
    }

    reset(): void {
        super.reset();
        this.slots = [null, null, null, null, null, null];
    }
}
```

**优点：**
- ✅ 数组直接序列化（无需转换）
- ✅ 索引访问快速（O(1)）
- ✅ 内存布局紧凑
- ✅ 固定大小，内存可预测

**缺点：**
- ❌ 装备类型与索引耦合（需要通过枚举映射）
- ❌ 不支持动态槽位数（固定 6 个）

---

### 方案 3：固定槽位 Record（按类型字符串）

**设计思路：**
- 使用 Record（对象）存储装备槽位
- key 是装备类型字符串（如 'weapon', 'armor'）
- value 是装备数据或 null

**实现：**
```typescript
export type EquipmentSlotType = 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory1' | 'accessory2';

export interface EquipmentData {
    equipmentId: string;
    config: EquipmentConfig;
    level: number;
    durability?: number;
}

@component({ name: 'Equipment', pooled: true, poolSize: 50 })
export class EquipmentComponent extends Component {
    /** 装备槽位（按类型字符串存储） */
    slots: Record<EquipmentSlotType, EquipmentData | null> = {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        accessory1: null,
        accessory2: null,
    };

    /** 获取装备 */
    getEquipment(type: EquipmentSlotType): EquipmentData | null {
        return this.slots[type] || null;
    }

    /** 装备物品 */
    equip(type: EquipmentSlotType, equipmentId: string, config: EquipmentConfig, level: number = 1): EquipmentData | null {
        const oldEquipment = this.slots[type];
        this.slots[type] = { equipmentId, config, level };
        return oldEquipment || null;
    }

    /** 卸下装备 */
    unequip(type: EquipmentSlotType): EquipmentData | null {
        const equipment = this.slots[type];
        if (equipment) {
            this.slots[type] = null;
            return equipment;
        }
        return null;
    }

    /** 获取所有已装备的装备 */
    getAllEquipped(): EquipmentData[] {
        return Object.values(this.slots).filter(slot => slot !== null) as EquipmentData[];
    }

    /** 检查是否已装备指定类型 */
    hasEquipment(type: EquipmentSlotType): boolean {
        return this.slots[type] !== null;
    }

    reset(): void {
        super.reset();
        this.slots = {
            weapon: null,
            armor: null,
            helmet: null,
            boots: null,
            accessory1: null,
            accessory2: null,
        };
    }
}
```

**优点：**
- ✅ 类型安全（TypeScript 类型定义）
- ✅ 直接序列化（Record 可以直接 JSON 序列化）
- ✅ 语义清晰（类型字符串直观）
- ✅ 易于查询（对象属性访问）

**缺点：**
- ❌ 类型字符串硬编码（如果拼写错误，编译时无法捕获）
- ❌ 不支持同一类型多个槽位

---

### 方案 4：灵活槽位数组 + 槽位配置

**设计思路：**
- 使用数组存储装备槽位
- 每个槽位有配置信息（槽位类型、是否可用等）
- 支持动态配置槽位

**实现：**
```typescript
export interface EquipmentSlotConfig {
    slotIndex: number;
    slotType: string;      // 'weapon', 'armor' 等
    enabled: boolean;      // 是否启用（可用于解锁系统）
}

export interface EquipmentData {
    equipmentId: string;
    config: EquipmentConfig;
    level: number;
    slotIndex: number;     // 所在槽位索引
}

@component({ name: 'Equipment', pooled: true, poolSize: 50 })
export class EquipmentComponent extends Component {
    /** 装备槽位配置 */
    slotConfigs: EquipmentSlotConfig[] = [
        { slotIndex: 0, slotType: 'weapon', enabled: true },
        { slotIndex: 1, slotType: 'armor', enabled: true },
        { slotIndex: 2, slotType: 'helmet', enabled: true },
        { slotIndex: 3, slotType: 'boots', enabled: true },
        { slotIndex: 4, slotType: 'accessory', enabled: true },
        { slotIndex: 5, slotType: 'accessory', enabled: false }, // 未解锁
    ];

    /** 装备数据数组 */
    equipment: (EquipmentData | null)[] = [null, null, null, null, null, null];

    /** 获取装备（通过槽位索引） */
    getEquipmentByIndex(slotIndex: number): EquipmentData | null {
        return slotIndex >= 0 && slotIndex < this.equipment.length ? this.equipment[slotIndex] : null;
    }

    /** 获取装备（通过槽位类型） */
    getEquipmentByType(slotType: string): EquipmentData | null {
        const slotConfig = this.slotConfigs.find(config => config.slotType === slotType && config.enabled);
        if (!slotConfig) return null;
        return this.equipment[slotConfig.slotIndex];
    }

    /** 装备物品 */
    equip(slotIndex: number, equipmentId: string, config: EquipmentConfig, level: number = 1): EquipmentData | null {
        const slotConfig = this.slotConfigs.find(c => c.slotIndex === slotIndex);
        if (!slotConfig || !slotConfig.enabled) return null;

        // 检查装备类型是否匹配
        if (config.slotType !== slotConfig.slotType) {
            console.warn(`[Equipment] Equipment type mismatch: ${config.slotType} != ${slotConfig.slotType}`);
            return null;
        }

        const oldEquipment = this.equipment[slotIndex];
        this.equipment[slotIndex] = { equipmentId, config, level, slotIndex };
        return oldEquipment || null;
    }

    reset(): void {
        super.reset();
        this.equipment = [null, null, null, null, null, null];
        // slotConfigs 不重置（配置应该在初始化时设置）
    }
}
```

**优点：**
- ✅ 灵活性高（支持槽位解锁、动态配置）
- ✅ 支持槽位类型验证（装备类型必须匹配槽位类型）
- ✅ 易于扩展（可以添加新的槽位配置）

**缺点：**
- ❌ 复杂度高（需要管理槽位配置）
- ❌ 查询稍慢（需要查找配置）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 3（固定槽位 Record，按类型字符串）

**理由：**
1. **简单实用：** 对于肉鸽游戏，装备槽位通常是固定的，不需要动态配置
2. **类型安全：** 使用 TypeScript 联合类型，编译时类型检查
3. **易于序列化：** Record 可以直接 JSON 序列化，无需转换
4. **语义清晰：** 类型字符串直观，易于理解和维护
5. **性能足够：** 对象属性访问性能优秀

**实现建议：**
1. 创建 `EquipmentComponent`（使用 Record 存储槽位）
2. 定义 `EquipmentSlotType` 联合类型（固定装备槽位类型）
3. 定义 `EquipmentData` 接口（装备ID、配置、强化等级）
4. 创建 `EquipmentSystem` 负责：
   - 处理装备/卸下操作
   - 更新 StatsComponent.equipment（装备时添加属性，卸下时移除属性）
   - 装备类型验证（确保装备类型匹配槽位类型）
5. 创建 `EquipmentConfig` 配置（装备属性加成、类型、图标等）

**与现有系统的集成：**
- `StatsComponent`：装备时，通过 `addEquipmentBonus()` 添加属性加成；卸下时，通过 `removeEquipmentBonus()` 移除属性加成
- `Inventory`：背包可以存储装备，装备操作可能需要从背包移除装备
- `EquipmentSystem`：处理装备/卸下逻辑，协调 StatsComponent 和 Inventory
- `ConfigLoader`：存储装备配置（属性加成、类型、名称等）

**装备配置示例：**
```typescript
export interface EquipmentConfig {
    id: string;
    name: string;
    type: EquipmentSlotType;        // 装备类型（决定可以装备到哪个槽位）
    statsBonus: Partial<StatsData>; // 属性加成
    icon?: string;                  // 图标路径
    description?: string;            // 描述
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';  // 稀有度（可选）
}
```

**数据序列化：**
Record 对象可以直接 JSON 序列化，所有字段都是可序列化的简单类型（string、number、object）。

---

## 实施指南

### 1. 组件接口定义

```typescript
// assets/scripts/gameplay/components/Equipment.ts

export type EquipmentSlotType = 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory1' | 'accessory2';

export interface EquipmentData {
    equipmentId: string;      // 装备 ID（用于查找配置）
    config: EquipmentConfig;  // 装备配置（从 ConfigLoader 加载）
    level: number;            // 强化等级（可选，默认为 1）
    durability?: number;      // 耐久度（可选）
}
```

### 2. 组件实现

见方案 3 的实现代码。

### 3. 系统集成

创建 `EquipmentSystem` 负责装备管理：

```typescript
// assets/scripts/gameplay/systems/EquipmentSystem.ts

@system({ priority: 6 })  // 在 StatsSyncSystem 之后
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    /**
     * 装备物品（外部调用）
     */
    equipItem(entity: Entity, slotType: EquipmentSlotType, equipmentId: string): boolean {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        if (!equipment || !stats || !this.configLoader) return false;

        // 从配置加载装备信息
        const config = this.configLoader.getEquipmentConfig(equipmentId);
        if (!config || config.type !== slotType) {
            console.warn(`[EquipmentSystem] Equipment config not found or type mismatch: ${equipmentId}`);
            return false;
        }

        // 卸下旧装备（如果有）
        const oldEquipment = equipment.unequip(slotType);
        if (oldEquipment) {
            // 移除旧装备的属性加成
            stats.removeEquipmentBonus(oldEquipment.config.statsBonus);
        }

        // 装备新装备
        equipment.equip(slotType, equipmentId, config, 1);

        // 添加新装备的属性加成
        stats.addEquipmentBonus(config.statsBonus);

        return true;
    }

    /**
     * 卸下装备（外部调用）
     */
    unequipItem(entity: Entity, slotType: EquipmentSlotType): EquipmentData | null {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        if (!equipment || !stats) return null;

        const unequipped = equipment.unequip(slotType);
        if (unequipped) {
            // 移除装备的属性加成
            stats.removeEquipmentBonus(unequipped.config.statsBonus);
        }

        return unequipped;
    }

    onUpdate(dt: number): void {
        // 可选：处理装备耐久度减少、装备效果等
        // 目前主要逻辑在 equipItem/unequipItem 方法中
    }
}
```

### 4. 配置集成

在 `data/configs/` 中创建装备配置：

```typescript
// assets/scripts/data/configs/equipment.ts

export interface EquipmentConfig {
    id: string;
    name: string;
    type: EquipmentSlotType;
    statsBonus: Partial<StatsData>;
    icon?: string;
    description?: string;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export const EquipmentConfigs: Record<string, EquipmentConfig> = {
    'sword_iron': {
        id: 'sword_iron',
        name: '铁剑',
        type: 'weapon',
        statsBonus: {
            attack: 10,
        },
        rarity: 'common',
    },
    'armor_leather': {
        id: 'armor_leather',
        name: '皮甲',
        type: 'armor',
        statsBonus: {
            defense: 5,
            maxHP: 20,
        },
        rarity: 'common',
    },
    'helmet_iron': {
        id: 'helmet_iron',
        name: '铁盔',
        type: 'helmet',
        statsBonus: {
            defense: 3,
            maxHP: 10,
        },
        rarity: 'common',
    },
    'boots_leather': {
        id: 'boots_leather',
        name: '皮靴',
        type: 'boots',
        statsBonus: {
            speed: 10,
        },
        rarity: 'common',
    },
    'ring_power': {
        id: 'ring_power',
        name: '力量戒指',
        type: 'accessory1',
        statsBonus: {
            attack: 5,
            critRate: 0.05,
        },
        rarity: 'rare',
    },
};
```

---

## 验收标准

- [ ] EquipmentComponent 可以正确存储和管理装备
- [ ] 支持装备/卸下操作
- [ ] 支持装备类型验证（类型必须匹配槽位类型）
- [ ] 与 StatsComponent 集成（装备时添加属性加成，卸下时移除）
- [ ] 数据可序列化
- [ ] EquipmentSystem 正确处理装备/卸下逻辑
- [ ] 支持装备强化等级（可选）
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持装备套装效果（多件装备组合加成）
2. 支持装备强化/升级系统
3. 支持装备耐久度系统
4. 支持装备附魔/词缀系统
5. 支持动态槽位解锁（方案 4）

但对于肉鸽游戏，方案 3 的简单实现已经足够。
