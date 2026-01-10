# 创意阶段：EquipmentSystem 装备系统设计

## 问题描述

在肉鸽游戏中，需要系统来处理装备的装备和卸下逻辑：
- 处理装备操作（从背包装备物品到装备槽位）
- 处理卸下操作（从装备槽位卸下到背包）
- 更新 StatsComponent.equipment（装备时添加属性加成，卸下时移除）
- 验证装备类型（确保装备类型匹配槽位类型）
- 可能需要发送装备事件（用于 UI 显示、特效播放等）
- 需要与 InventoryComponent 集成（装备从背包移除，卸下添加到背包）

**需求：**
1. 处理装备/卸下操作
2. 更新 StatsComponent.equipment
3. 验证装备类型
4. 与 InventoryComponent 集成
5. 发送装备事件（可选）

## 约束条件

- 系统必须是 Fixed System，不能直接操作 View 层
- 不能直接修改 AnimState
- 需要与 EquipmentComponent、StatsComponent、InventoryComponent 集成
- 需要与 ConfigLoader 集成（获取装备配置）
- 需要与 EventBus 集成（发送装备事件）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：被动系统（只处理外部调用）

**设计思路：**
- EquipmentSystem 不主动查询，只提供方法供外部调用
- 外部系统（如 UI、InventorySystem）调用 equipItem/unequipItem 方法
- 系统负责处理装备/卸下逻辑和 StatsComponent 更新

**实现：**
```typescript
@system({ priority: 6 })  // 在 StatsSyncSystem 之后
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 装备物品（外部调用）
     * @param entity 目标实体
     * @param slotType 装备槽位类型
     * @param equipmentId 装备 ID（如果从背包装备，需要提供）
     * @param inventorySlotIndex 背包槽位索引（可选，如果从背包装备）
     */
    equipItem(entity: Entity, slotType: EquipmentSlotType, equipmentId?: string, inventorySlotIndex?: number): boolean {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        const inventory = entity.getComponent(InventoryComponent);
        
        if (!equipment || !stats || !this.configLoader) return false;

        // 如果从背包装备
        if (inventorySlotIndex !== undefined && inventory) {
            const item = inventory.getItem(inventorySlotIndex);
            if (!item || item.config.type !== 'equipment' || !item.config.equipmentConfig) {
                return false;
            }

            equipmentId = item.itemId;
        }

        if (!equipmentId) return false;

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
            
            // 如果背包存在，将旧装备添加到背包
            if (inventory) {
                inventory.addItem(oldEquipment.equipmentId, 1, this.configLoader);
            }
        }

        // 装备新装备
        equipment.equip(slotType, equipmentId, config, 1);

        // 添加新装备的属性加成
        stats.addEquipmentBonus(config.statsBonus);

        // 如果从背包装备，从背包移除
        if (inventorySlotIndex !== undefined && inventory) {
            inventory.removeItem(inventorySlotIndex, 1);
        }

        // 发送装备事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'EquipmentChange',
                handle: entity.handle,
                slotType,
                equipmentId,
                action: 'equip'
            });
        }

        return true;
    }

    /**
     * 卸下装备（外部调用）
     * @param entity 目标实体
     * @param slotType 装备槽位类型
     * @param addToInventory 是否添加到背包（默认 true）
     */
    unequipItem(entity: Entity, slotType: EquipmentSlotType, addToInventory: boolean = true): EquipmentData | null {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        const inventory = entity.getComponent(InventoryComponent);
        
        if (!equipment || !stats) return null;

        const unequipped = equipment.unequip(slotType);
        if (!unequipped) return null;

        // 移除装备的属性加成
        stats.removeEquipmentBonus(unequipped.config.statsBonus);

        // 如果背包存在且需要添加到背包
        if (addToInventory && inventory && this.configLoader) {
            const added = inventory.addItem(unequipped.equipmentId, 1, this.configLoader);
            if (!added) {
                console.warn(`[EquipmentSystem] Failed to add equipment to inventory: ${unequipped.equipmentId}`);
            }
        }

        // 发送卸下事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'EquipmentChange',
                handle: entity.handle,
                slotType,
                equipmentId: unequipped.equipmentId,
                action: 'unequip'
            });
        }

        return unequipped;
    }

    /**
     * 替换装备（装备新装备，自动卸下旧装备）
     */
    replaceEquipment(entity: Entity, slotType: EquipmentSlotType, equipmentId: string, inventorySlotIndex?: number): boolean {
        return this.equipItem(entity, slotType, equipmentId, inventorySlotIndex);
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有逻辑通过外部调用触发
    }
}
```

**优点：**
- ✅ 职责清晰（只处理装备/卸下逻辑）
- ✅ 灵活性高（外部系统可以灵活调用）
- ✅ 易于测试（方法调用简单）
- ✅ 性能好（不主动查询，只在需要时执行）

**缺点：**
- ❌ 需要外部系统主动调用（可能遗漏）
- ❌ 装备操作分散（需要在多个系统中调用）

---

### 方案 2：事件驱动系统

**设计思路：**
- 完全通过 EventBus 事件驱动
- 外部系统发送 EquipItem/UnequipItem 事件
- EquipmentSystem 订阅事件并处理

**实现：**
```typescript
@system({ priority: 6 })
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅装备事件
        this.eventBus.subscribe('EquipItem', (event: any) => {
            this.onEquipItem(event);
        });
        
        this.eventBus.subscribe('UnequipItem', (event: any) => {
            this.onUnequipItem(event);
        });
    }

    /**
     * 处理装备事件
     */
    private onEquipItem(event: any): void {
        const entity = this.world.getEntityByHandle(event.handle);
        if (!entity) return;

        this.equipItem(entity, event.slotType, event.equipmentId, event.inventorySlotIndex);
    }

    /**
     * 处理卸下事件
     */
    private onUnequipItem(event: any): void {
        const entity = this.world.getEntityByHandle(event.handle);
        if (!entity) return;

        this.unequipItem(entity, event.slotType, event.addToInventory);
    }

    // ... equipItem 和 unequipItem 方法同方案 1 ...

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
```

**优点：**
- ✅ 完全解耦（通过事件通信）
- ✅ 符合架构原则（事件驱动）
- ✅ 易于扩展（新增装备来源只需发送事件）

**缺点：**
- ❌ 需要扩展 EventBus 事件类型
- ❌ 所有装备操作都需要发送事件（可能遗漏）

---

### 方案 3：混合系统（主动查询 + 外部调用）

**设计思路：**
- EquipmentSystem 主动查询有 EquipmentIntentComponent 的实体
- 检查是否有待处理的装备操作（通过临时组件）
- 同时提供方法供外部调用

**实现：**
```typescript
// 临时组件：装备意图
@component({ name: 'EquipmentIntent', pooled: true })
export class EquipmentIntentComponent extends Component {
    action: 'equip' | 'unequip' = 'equip';
    slotType?: EquipmentSlotType;
    equipmentId?: string;
    inventorySlotIndex?: number;

    reset(): void {
        super.reset();
        this.action = 'equip';
        this.slotType = undefined;
        this.equipmentId = undefined;
        this.inventorySlotIndex = undefined;
    }
}

@system({ priority: 6 })
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    onUpdate(dt: number): void {
        // 查询所有有待处理装备操作的实体
        const query = this.world.createQuery({
            all: [EquipmentComponent, EquipmentIntentComponent]
        });

        query.forEach(entity => {
            const intent = entity.getComponent(EquipmentIntentComponent)!;
            
            if (intent.action === 'equip' && intent.slotType && intent.equipmentId) {
                this.equipItem(entity, intent.slotType, intent.equipmentId, intent.inventorySlotIndex);
            } else if (intent.action === 'unequip' && intent.slotType) {
                this.unequipItem(entity, intent.slotType);
            }
            
            // 移除临时组件
            this.world.removeComponent(entity.id, EquipmentIntentComponent);
        });
    }

    // ... equipItem 和 unequipItem 方法同方案 1 ...
}
```

**优点：**
- ✅ 支持批量处理（一帧内多个装备操作）
- ✅ 支持延迟处理（装备操作可以累积）
- ✅ 保持方案 1 的灵活性

**缺点：**
- ❌ 增加临时组件（EquipmentIntentComponent）
- ❌ 复杂度稍高（需要管理临时组件）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 1（被动系统，只处理外部调用）

**理由：**
1. **简单实用：** 被动系统实现简单，性能好
2. **灵活性高：** 外部系统可以灵活调用，不强制使用事件
3. **易于测试：** 方法调用简单，易于单元测试
4. **符合架构：** 系统职责清晰，只处理装备逻辑
5. **性能好：** 不主动查询，只在需要时执行

**实现建议：**
1. 创建 `EquipmentSystem`（被动系统，提供 equipItem/unequipItem 方法）
2. 处理装备类型验证（确保装备类型匹配槽位类型）
3. 更新 StatsComponent.equipment（装备时添加属性，卸下时移除）
4. 与 InventoryComponent 集成（装备从背包移除，卸下添加到背包）
5. 发送装备事件（用于 UI 显示、特效播放等）

**与现有系统的集成：**
- `InventorySystem`：从背包装备物品时，调用 `equipmentSystem.equipItem(entity, slotType, undefined, inventorySlotIndex)`
- `UI 系统`：玩家点击装备按钮时，调用 `equipmentSystem.equipItem(entity, slotType, equipmentId)`
- `EquipmentComponent`：调用 `equip()` 和 `unequip()` 方法
- `StatsComponent`：通过 `addEquipmentBonus()` 和 `removeEquipmentBonus()` 更新属性
- `ConfigLoader`：获取装备配置（EquipmentConfig）
- `EventBus`：发送 EquipmentChange 事件（用于 UI 显示）

**装备操作流程：**
```typescript
// 从背包装备物品
equipmentSystem.equipItem(player, 'weapon', undefined, inventorySlotIndex);

// 直接装备物品（不经过背包）
equipmentSystem.equipItem(player, 'weapon', 'sword_iron');

// 卸下装备（自动添加到背包）
equipmentSystem.unequipItem(player, 'weapon', true);

// 卸下装备（不添加到背包，丢弃）
equipmentSystem.unequipItem(player, 'weapon', false);
```

---

## 实施指南

### 1. 系统接口定义

```typescript
// assets/scripts/gameplay/systems/EquipmentSystem.ts

@system({ priority: 6 })
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 装备物品（外部调用）
     */
    equipItem(entity: Entity, slotType: EquipmentSlotType, equipmentId?: string, inventorySlotIndex?: number): boolean {
        // ... 实现 ...
    }

    /**
     * 卸下装备（外部调用）
     */
    unequipItem(entity: Entity, slotType: EquipmentSlotType, addToInventory: boolean = true): EquipmentData | null {
        // ... 实现 ...
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
    }
}
```

### 2. 装备类型验证

确保装备类型匹配槽位类型：
```typescript
const config = this.configLoader.getEquipmentConfig(equipmentId);
if (!config || config.type !== slotType) {
    console.warn(`[EquipmentSystem] Equipment type mismatch: ${config.type} != ${slotType}`);
    return false;
}
```

### 3. StatsComponent 更新

装备时添加属性，卸下时移除：
```typescript
// 装备时
stats.addEquipmentBonus(config.statsBonus);

// 卸下时
stats.removeEquipmentBonus(oldEquipment.config.statsBonus);
```

### 4. InventoryComponent 集成

装备从背包移除，卸下添加到背包：
```typescript
// 从背包装备
if (inventorySlotIndex !== undefined && inventory) {
    inventory.removeItem(inventorySlotIndex, 1);
}

// 卸下到背包
if (addToInventory && inventory && this.configLoader) {
    inventory.addItem(unequipped.equipmentId, 1, this.configLoader);
}
```

### 5. 装备事件

扩展 EventBus 事件类型：
```typescript
// EventBus.ts
export type GameplayEvent =
    | { type: 'AnimationEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'CollisionEvent'; handleA: Handle; handleB: Handle }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'LevelUp'; handle: Handle; oldLevel: number; newLevel: number; levelsGained: number }
    | { type: 'EquipmentChange'; handle: Handle; slotType: EquipmentSlotType; equipmentId: string; action: 'equip' | 'unequip' };  // 新增
```

---

## 验收标准

- [ ] EquipmentSystem 可以正确处理装备/卸下操作
- [ ] 支持装备类型验证（类型必须匹配槽位类型）
- [ ] 装备时正确添加属性加成到 StatsComponent
- [ ] 卸下时正确移除属性加成
- [ ] 与 InventoryComponent 集成（装备从背包移除，卸下添加到背包）
- [ ] 支持替换装备（自动卸下旧装备）
- [ ] 发送装备事件（用于 UI 显示）
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持装备套装效果（多件装备组合加成）
2. 支持装备强化/升级系统
3. 支持装备耐久度系统
4. 支持装备附魔/词缀系统
5. 支持装备自动替换（新装备属性更好时自动替换）

但对于肉鸽游戏，方案 1 的简单实现已经足够。
