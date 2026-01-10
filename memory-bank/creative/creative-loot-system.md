# 创意阶段：LootSystem 掉落系统设计

## 问题描述

在肉鸽游戏中，需要系统来处理物品掉落逻辑：
- 敌人死亡时掉落物品（装备、消耗品、材料、经验等）
- 掉落物品可能在地面上（需要玩家拾取）
- 掉落物品可能直接进入背包（自动拾取）
- 掉落物品可能有掉落概率和掉落表（LootTable）
- 掉落物品可能有掉落位置（在敌人死亡位置附近）
- 需要与 InventoryComponent 集成（掉落物品添加到背包）
- 需要与 UpgradeSystem 集成（掉落经验值）

**需求：**
1. 处理敌人死亡时的物品掉落
2. 支持掉落表配置（不同敌人掉落不同物品）
3. 支持掉落概率（物品可能掉落也可能不掉落）
4. 支持掉落位置（在地面上或直接进入背包）
5. 与 InventoryComponent 集成（添加到背包）
6. 与 UpgradeSystem 集成（添加经验值）

## 约束条件

- 系统必须是 Fixed System，不能直接操作 View 层
- 不能直接修改 AnimState
- 需要与 DeathSystem 集成（敌人死亡时触发掉落）
- 需要与 InventoryComponent 集成（掉落物品添加到背包）
- 需要与 UpgradeSystem 集成（掉落经验值）
- 需要与 ConfigLoader 集成（获取掉落表配置）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：直接掉落系统（死亡时直接处理）

**设计思路：**
- LootSystem 监听死亡事件或主动查询死亡实体
- 敌人死亡时，立即处理掉落（直接添加到背包或创建掉落实体）
- 掉落逻辑在 LootSystem 中集中处理

**实现：**
```typescript
@system({ priority: 7 })  // 在 DeathSystem 之后
export class LootSystem extends System {
    private configLoader?: ConfigLoader;
    private inventorySystem?: InventorySystem;
    private upgradeSystem?: UpgradeSystem;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setInventorySystem(inventorySystem: InventorySystem): void {
        this.inventorySystem = inventorySystem;
    }

    setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
        this.upgradeSystem = upgradeSystem;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅死亡事件
        this.eventBus.subscribe('EntityDeath', (event: any) => {
            this.onEntityDeath(event);
        });
    }

    /**
     * 处理实体死亡事件
     */
    private onEntityDeath(event: any): void {
        const deadEntity = this.world.getEntityByHandle(event.handle);
        if (!deadEntity) return;

        // 获取击杀者（从事件中获取）
        const killerHandle = event.killerHandle;
        if (!killerHandle) return;

        const killerEntity = this.world.getEntityByHandle(killerHandle);
        if (!killerEntity) return;

        // 处理掉落
        this.dropLoot(deadEntity, killerEntity);
    }

    /**
     * 掉落物品（外部调用）
     */
    dropLoot(deadEntity: Entity, killerEntity: Entity): void {
        if (!this.configLoader) return;

        // 获取掉落表配置（根据实体类型）
        const lootTable = this.getLootTable(deadEntity);
        if (!lootTable) return;

        // 处理掉落表中的每个物品
        for (const lootEntry of lootTable.items) {
            // 掉落概率检查
            if (Math.random() > lootEntry.probability) {
                continue;
            }

            // 掉落数量（支持随机范围）
            const count = this.getLootCount(lootEntry);

            // 根据掉落类型处理
            switch (lootEntry.type) {
                case 'item':
                    this.dropItem(killerEntity, lootEntry.itemId, count);
                    break;
                case 'equipment':
                    this.dropItem(killerEntity, lootEntry.itemId, count);
                    break;
                case 'experience':
                    this.dropExperience(killerEntity, lootEntry.value || count);
                    break;
            }
        }
    }

    /**
     * 掉落物品（添加到背包）
     */
    private dropItem(killerEntity: Entity, itemId: string, count: number): void {
        if (this.inventorySystem) {
            this.inventorySystem.addItem(killerEntity, itemId, count);
        }
    }

    /**
     * 掉落经验值
     */
    private dropExperience(killerEntity: Entity, amount: number): void {
        if (this.upgradeSystem) {
            this.upgradeSystem.addExperience(killerEntity, amount, 'kill');
        }
    }

    /**
     * 获取掉落表（根据实体类型）
     */
    private getLootTable(entity: Entity): LootTable | null {
        // 可以从实体类型、配置等获取
        // 示例：根据实体名称或类型
        const entityType = entity.name || 'enemy_basic';
        return this.configLoader?.getLootTable(entityType) || null;
    }

    /**
     * 获取掉落数量（支持随机范围）
     */
    private getLootCount(lootEntry: LootEntry): number {
        if (lootEntry.countMin !== undefined && lootEntry.countMax !== undefined) {
            return Math.floor(Math.random() * (lootEntry.countMax - lootEntry.countMin + 1)) + lootEntry.countMin;
        }
        return lootEntry.count || 1;
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
```

**优点：**
- ✅ 逻辑集中（掉落逻辑在 LootSystem 中）
- ✅ 事件驱动（通过死亡事件触发）
- ✅ 易于扩展（新增掉落类型只需添加 case）
- ✅ 支持掉落表和概率

**缺点：**
- ❌ 需要 DeathSystem 发送死亡事件（需要修改 DeathSystem）
- ❌ 需要依赖其他系统（InventorySystem、UpgradeSystem）

---

### 方案 2：掉落实体系统（在地面上创建掉落物品实体）

**设计思路：**
- 敌人死亡时，在地面上创建掉落物品实体
- 掉落物品实体有 TransformComponent 和 LootItemComponent
- 玩家靠近时拾取（通过 CollisionSystem 检测）
- LootSystem 处理拾取逻辑

**实现：**
```typescript
// 掉落物品组件
@component({ name: 'LootItem', pooled: true })
export class LootItemComponent extends Component {
    itemId: string = '';
    count: number = 1;
    lootType: 'item' | 'equipment' | 'experience' = 'item';
    value?: number;  // 经验值（如果是 experience 类型）

    reset(): void {
        super.reset();
        this.itemId = '';
        this.count = 1;
        this.lootType = 'item';
        this.value = undefined;
    }
}

@system({ priority: 7 })
export class LootSystem extends System {
    private configLoader?: ConfigLoader;
    private inventorySystem?: InventorySystem;
    private upgradeSystem?: UpgradeSystem;
    private eventBus?: EventBus;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅死亡事件
        this.eventBus.subscribe('EntityDeath', (event: any) => {
            this.onEntityDeath(event);
        });
        
        // 订阅碰撞事件（拾取）
        this.eventBus.subscribe('CollisionEvent', (event: any) => {
            this.onCollision(event);
        });
    }

    /**
     * 处理实体死亡事件（创建掉落物品实体）
     */
    private onEntityDeath(event: any): void {
        const deadEntity = this.world.getEntityByHandle(event.handle);
        if (!deadEntity) return;

        const transform = deadEntity.getComponent(TransformComponent);
        if (!transform) return;

        // 获取掉落表
        const lootTable = this.getLootTable(deadEntity);
        if (!lootTable) return;

        // 创建掉落物品实体
        for (const lootEntry of lootTable.items) {
            if (Math.random() > lootEntry.probability) continue;

            const count = this.getLootCount(lootEntry);
            this.createLootEntity(transform.x, transform.y, lootEntry, count);
        }
    }

    /**
     * 创建掉落物品实体
     */
    private createLootEntity(x: number, y: number, lootEntry: LootEntry, count: number): void {
        const lootEntity = this.world.createEntity('LootItem');
        
        // 添加位置组件
        const transform = lootEntity.addComponent(TransformComponent);
        transform.x = x + (Math.random() - 0.5) * 50; // 随机偏移
        transform.y = y + (Math.random() - 0.5) * 50;

        // 添加掉落物品组件
        const lootItem = lootEntity.addComponent(LootItemComponent);
        lootItem.itemId = lootEntry.itemId || '';
        lootItem.count = count;
        lootItem.lootType = lootEntry.type;
        lootItem.value = lootEntry.value;

        // 添加碰撞体（用于拾取检测）
        const collider = lootEntity.addComponent(ColliderComponent);
        collider.type = 'circle';
        collider.radius = 20;
        collider.layer = 3; // LOOT layer

        // 添加视图（可选）
        const viewLink = lootEntity.addComponent(ViewLinkComponent);
        viewLink.prefabKey = 'loot_item';
        lootEntity.addComponent(NeedViewTagComponent);
    }

    /**
     * 处理碰撞事件（拾取）
     */
    private onCollision(event: any): void {
        const entityA = this.world.getEntityByHandle(event.handleA);
        const entityB = this.world.getEntityByHandle(event.handleB);
        if (!entityA || !entityB) return;

        // 检查是否有掉落物品
        const lootA = entityA.getComponent(LootItemComponent);
        const lootB = entityB.getComponent(LootItemComponent);
        const playerA = entityA.getComponent(FactionComponent)?.faction === FactionType.Player;
        const playerB = entityB.getComponent(FactionComponent)?.faction === FactionType.Player;

        if (lootA && playerB) {
            this.pickupLoot(entityB, entityA);
        } else if (lootB && playerA) {
            this.pickupLoot(entityA, entityB);
        }
    }

    /**
     * 拾取掉落物品
     */
    private pickupLoot(playerEntity: Entity, lootEntity: Entity): void {
        const lootItem = lootEntity.getComponent(LootItemComponent);
        if (!lootItem) return;

        switch (lootItem.lootType) {
            case 'item':
            case 'equipment':
                if (this.inventorySystem) {
                    this.inventorySystem.addItem(playerEntity, lootItem.itemId, lootItem.count);
                }
                break;
            case 'experience':
                if (this.upgradeSystem) {
                    this.upgradeSystem.addExperience(playerEntity, lootItem.value || lootItem.count, 'kill');
                }
                break;
        }

        // 销毁掉落物品实体
        this.world.destroyEntity(lootEntity.id);
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
```

**优点：**
- ✅ 掉落物品可视化（在地面上显示）
- ✅ 支持玩家主动拾取（增加游戏性）
- ✅ 支持掉落物品自动消失（超时）
- ✅ 符合游戏体验（掉落物品需要拾取）

**缺点：**
- ❌ 复杂度高（需要创建掉落实体、碰撞检测、视图等）
- ❌ 性能开销（每个掉落物品都是一个实体）
- ❌ 需要额外的视图资源（掉落物品 Prefab）

---

### 方案 3：混合系统（直接掉落 + 可选地面掉落）

**设计思路：**
- 默认直接添加到背包（简单快速）
- 可选：某些物品在地面上掉落（需要拾取）
- 通过配置控制掉落方式

**实现：**
```typescript
@system({ priority: 7 })
export class LootSystem extends System {
    // ... 同方案 1 ...

    /**
     * 掉落物品（根据配置决定是直接添加还是创建掉落实体）
     */
    private dropItem(killerEntity: Entity, itemId: string, count: number, dropOnGround: boolean = false): void {
        if (dropOnGround) {
            // 创建掉落实体（同方案 2）
            this.createLootEntity(killerEntity, itemId, count);
        } else {
            // 直接添加到背包（同方案 1）
            if (this.inventorySystem) {
                this.inventorySystem.addItem(killerEntity, itemId, count);
            }
        }
    }
}
```

**优点：**
- ✅ 灵活性高（可以配置掉落方式）
- ✅ 简单物品直接添加（性能好）
- ✅ 重要物品地面掉落（增加游戏性）

**缺点：**
- ❌ 复杂度高（需要实现两种掉落方式）
- ❌ 需要配置控制（增加配置复杂度）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 1（直接掉落系统，死亡时直接处理）

**理由：**
1. **简单实用：** 对于肉鸽游戏，直接添加到背包更简单快速
2. **性能好：** 不需要创建掉落实体，减少实体数量
3. **易于实现：** 逻辑集中，易于维护
4. **符合肉鸽游戏特点：** 肉鸽游戏通常节奏快，直接掉落更合适
5. **易于扩展：** 如果后续需要地面掉落，可以升级为方案 3

**实现建议：**
1. 创建 `LootSystem`（事件驱动，监听死亡事件）
2. 支持掉落表配置（不同敌人掉落不同物品）
3. 支持掉落概率（物品可能掉落也可能不掉落）
4. 与 InventorySystem 集成（掉落物品添加到背包）
5. 与 UpgradeSystem 集成（掉落经验值）
6. 如果后续需要地面掉落，可以升级为方案 3

**与现有系统的集成：**
- `DeathSystem`：敌人死亡时，发送 EntityDeath 事件（包含 killerHandle）
- `LootSystem`：监听死亡事件，处理掉落逻辑
- `InventorySystem`：掉落物品时，调用 `inventorySystem.addItem()`
- `UpgradeSystem`：掉落经验值时，调用 `upgradeSystem.addExperience()`
- `ConfigLoader`：获取掉落表配置（LootTable）

**掉落表配置示例：**
```typescript
// assets/scripts/data/configs/loot.ts

export interface LootEntry {
    type: 'item' | 'equipment' | 'experience';
    itemId?: string;        // 物品 ID（如果是 item 或 equipment）
    value?: number;         // 经验值（如果是 experience）
    probability: number;    // 掉落概率（0-1）
    count?: number;         // 固定数量
    countMin?: number;      // 最小数量（随机）
    countMax?: number;      // 最大数量（随机）
}

export interface LootTable {
    id: string;
    name: string;
    items: LootEntry[];
}

export const LootTables: Record<string, LootTable> = {
    'enemy_basic': {
        id: 'enemy_basic',
        name: '基础敌人掉落表',
        items: [
            {
                type: 'experience',
                value: 10,
                probability: 1.0,  // 100% 掉落经验
            },
            {
                type: 'item',
                itemId: 'potion_heal',
                probability: 0.3,  // 30% 掉落治疗药水
                countMin: 1,
                countMax: 2,
            },
            {
                type: 'equipment',
                itemId: 'sword_iron',
                probability: 0.1,  // 10% 掉落铁剑
                count: 1,
            },
        ],
    },
    'enemy_elite': {
        id: 'enemy_elite',
        name: '精英敌人掉落表',
        items: [
            {
                type: 'experience',
                value: 50,
                probability: 1.0,
            },
            {
                type: 'equipment',
                itemId: 'sword_iron',
                probability: 0.5,
                count: 1,
            },
            {
                type: 'item',
                itemId: 'potion_heal',
                probability: 0.8,
                countMin: 2,
                countMax: 5,
            },
        ],
    },
};
```

---

## 实施指南

### 1. 系统接口定义

```typescript
// assets/scripts/gameplay/systems/LootSystem.ts

@system({ priority: 7 })
export class LootSystem extends System {
    private configLoader?: ConfigLoader;
    private inventorySystem?: InventorySystem;
    private upgradeSystem?: UpgradeSystem;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setInventorySystem(inventorySystem: InventorySystem): void {
        this.inventorySystem = inventorySystem;
    }

    setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
        this.upgradeSystem = upgradeSystem;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅死亡事件
        this.eventBus.subscribe('EntityDeath', (event: any) => {
            this.onEntityDeath(event);
        });
    }

    /**
     * 掉落物品（外部调用）
     */
    dropLoot(deadEntity: Entity, killerEntity: Entity): void {
        // ... 实现 ...
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
```

### 2. 死亡事件扩展

扩展 EventBus 事件类型，DeathSystem 发送死亡事件：
```typescript
// EventBus.ts
export type GameplayEvent =
    | { type: 'AnimationEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'CollisionEvent'; handleA: Handle; handleB: Handle }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'LevelUp'; handle: Handle; oldLevel: number; newLevel: number; levelsGained: number }
    | { type: 'EquipmentChange'; handle: Handle; slotType: EquipmentSlotType; equipmentId: string; action: 'equip' | 'unequip' }
    | { type: 'EntityDeath'; handle: Handle; killerHandle?: Handle };  // 新增，包含击杀者
```

### 3. DeathSystem 修改

DeathSystem 发送死亡事件时包含击杀者信息：
```typescript
// DeathSystem.ts
if (this.eventBus) {
    this.eventBus.push({
        type: 'EntityDeath',
        handle: entity.handle,
        killerHandle: killerHandle  // 需要从 CombatSystem 或其他系统获取
    });
}
```

### 4. 掉落表配置

在 `data/configs/` 中创建掉落表配置：
```typescript
// assets/scripts/data/configs/loot.ts

export interface LootEntry {
    type: 'item' | 'equipment' | 'experience';
    itemId?: string;
    value?: number;
    probability: number;
    count?: number;
    countMin?: number;
    countMax?: number;
}

export interface LootTable {
    id: string;
    name: string;
    items: LootEntry[];
}

export const LootTables: Record<string, LootTable> = {
    // ... 配置 ...
};
```

---

## 验收标准

- [ ] LootSystem 可以正确处理敌人死亡时的物品掉落
- [ ] 支持掉落表配置（不同敌人掉落不同物品）
- [ ] 支持掉落概率（物品可能掉落也可能不掉落）
- [ ] 支持掉落数量随机范围
- [ ] 与 InventorySystem 集成（掉落物品添加到背包）
- [ ] 与 UpgradeSystem 集成（掉落经验值）
- [ ] 与 DeathSystem 集成（监听死亡事件）
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持地面掉落（方案 2 或方案 3）
2. 支持掉落物品自动消失（超时）
3. 支持掉落物品磁吸效果（自动飞向玩家）
4. 支持掉落物品品质筛选（只掉落高品质物品）
5. 支持掉落物品数量倍率（Buff、活动等）

但对于肉鸽游戏，方案 1 的简单实现已经足够。
