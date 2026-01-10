# 创意阶段：UpgradeSystem 升级系统设计

## 问题描述

在肉鸽游戏中，需要系统来处理经验值获取和升级逻辑：
- 处理经验值获取（从各种来源：击杀敌人、完成任务、使用道具等）
- 调用 LevelExperienceComponent.addExp() 添加经验值
- 检测升级（addExp 返回升级等级数）
- 升级时添加属性加成到 StatsComponent.levelup
- 可能需要发送升级事件（用于 UI 显示、特效播放等）
- 需要支持经验值倍率（Buff、活动等）

**需求：**
1. 处理经验值获取（从各种来源）
2. 调用 LevelExperienceComponent.addExp()
3. 检测升级并添加属性加成
4. 支持经验值倍率
5. 发送升级事件（可选，用于 UI 显示）

## 约束条件

- 系统必须是 Fixed System，不能直接操作 View 层
- 不能直接修改 AnimState
- 需要与 LevelExperienceComponent 和 StatsComponent 集成
- 需要支持多种经验值来源（击杀、任务、道具等）
- 需要与 EventBus 集成（发送升级事件）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：被动系统（只处理外部调用）

**设计思路：**
- UpgradeSystem 不主动查询，只提供方法供外部调用
- 外部系统（如 DeathSystem、LootSystem）调用 addExperience 方法
- 系统负责处理经验值添加和升级逻辑

**实现：**
```typescript
@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 添加经验值（外部调用）
     * @param entity 目标实体
     * @param amount 经验值数量
     * @param source 来源（可选，如 'kill', 'quest', 'item'）
     */
    addExperience(entity: Entity, amount: number, source?: string): void {
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (!levelExp) return;

        // 应用经验值倍率（从 Buff 或其他来源）
        const multiplier = this.getExperienceMultiplier(entity);
        const finalAmount = amount * multiplier;

        // 记录升级前的等级
        const oldLevel = levelExp.level;

        // 添加经验值（组件内部处理升级）
        const levelsGained = levelExp.addExp(finalAmount);

        // 如果升级了，处理升级逻辑
        if (levelsGained > 0) {
            this.handleLevelUp(entity, oldLevel, levelExp.level, levelsGained);
        }
    }

    /**
     * 处理升级逻辑
     */
    private handleLevelUp(entity: Entity, oldLevel: number, newLevel: number, levelsGained: number): void {
        const stats = entity.getComponent(StatsComponent);
        if (!stats) return;

        // 从配置读取每级属性加成（或使用默认值）
        const bonusPerLevel = this.getBonusPerLevel(entity);
        
        // 添加多级属性加成
        for (let i = 0; i < levelsGained; i++) {
            stats.addLevelupBonus(bonusPerLevel);
        }

        // 发送升级事件（用于 UI 显示、特效播放等）
        if (this.eventBus) {
            this.eventBus.push({
                type: 'LevelUp',
                handle: entity.handle,
                oldLevel,
                newLevel,
                levelsGained
            });
        }
    }

    /**
     * 获取经验值倍率（从 Buff 或其他来源）
     */
    private getExperienceMultiplier(entity: Entity): number {
        // 可以从 BuffListComponent 中查找经验值倍率 Buff
        const buffList = entity.getComponent(BuffListComponent);
        if (!buffList) return 1.0;

        const expBuff = buffList.findBuff('exp_boost');
        if (expBuff && expBuff.params.value) {
            return 1.0 + expBuff.params.value; // 例如：value: 0.2 表示 +20%
        }

        return 1.0;
    }

    /**
     * 获取每级属性加成（从配置或使用默认值）
     */
    private getBonusPerLevel(entity: Entity): Partial<StatsData> {
        // 可以从配置读取（根据实体类型）
        // 或使用默认值
        return {
            attack: 2,
            defense: 1,
            maxHP: 10,
        };
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有逻辑通过外部调用触发
    }
}
```

**优点：**
- ✅ 职责清晰（只处理经验值添加和升级）
- ✅ 灵活性高（外部系统可以灵活调用）
- ✅ 易于测试（方法调用简单）
- ✅ 性能好（不主动查询，只在需要时执行）

**缺点：**
- ❌ 需要外部系统主动调用（可能遗漏）
- ❌ 经验值来源分散（需要在多个系统中调用）

---

### 方案 2：主动系统（监听死亡事件）

**设计思路：**
- UpgradeSystem 主动监听死亡事件（通过 EventBus）
- 当敌人死亡时，自动给击杀者添加经验值
- 同时提供方法供外部调用（任务、道具等）

**实现：**
```typescript
@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
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

        // 获取击杀者（从事件中获取，或通过其他方式）
        const killerHandle = event.killerHandle;
        if (!killerHandle) return;

        const killerEntity = this.world.getEntityByHandle(killerHandle);
        if (!killerEntity) return;

        // 获取死亡实体的经验值（从配置或组件）
        const expValue = this.getExperienceValue(deadEntity);
        if (expValue > 0) {
            this.addExperience(killerEntity, expValue, 'kill');
        }
    }

    /**
     * 获取实体的经验值（击杀该实体可获得）
     */
    private getExperienceValue(entity: Entity): number {
        // 可以从 LevelExperienceComponent 获取（敌人等级）
        // 或从配置读取（根据实体类型）
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (levelExp) {
            // 经验值 = 基础值 * 等级
            return 10 * levelExp.level;
        }

        // 默认经验值
        return 10;
    }

    /**
     * 添加经验值（外部调用）
     */
    addExperience(entity: Entity, amount: number, source?: string): void {
        // ... 同方案 1 ...
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
```

**优点：**
- ✅ 自动处理击杀经验（不需要 DeathSystem 手动调用）
- ✅ 事件驱动（解耦，符合架构）
- ✅ 保持方案 1 的所有优点

**缺点：**
- ❌ 需要 EventBus 支持 EntityDeath 事件（需要扩展事件类型）
- ❌ 需要 DeathSystem 发送死亡事件（需要修改 DeathSystem）

---

### 方案 3：混合系统（主动查询 + 外部调用）

**设计思路：**
- UpgradeSystem 主动查询有 LevelExperienceComponent 的实体
- 检查是否有待处理的经验值（通过临时组件或事件队列）
- 同时提供方法供外部调用

**实现：**
```typescript
// 临时组件：经验值获取意图
@component({ name: 'ExperienceGain', pooled: true })
export class ExperienceGainComponent extends Component {
    amount: number = 0;
    source?: string;

    reset(): void {
        super.reset();
        this.amount = 0;
        this.source = undefined;
    }
}

@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    onUpdate(dt: number): void {
        // 查询所有有待处理经验值的实体
        const query = this.world.createQuery({
            all: [LevelExperienceComponent, ExperienceGainComponent]
        });

        query.forEach(entity => {
            const expGain = entity.getComponent(ExperienceGainComponent)!;
            
            // 处理经验值
            this.addExperience(entity, expGain.amount, expGain.source);
            
            // 移除临时组件
            this.world.removeComponent(entity.id, ExperienceGainComponent);
        });
    }

    /**
     * 添加经验值（外部调用，通过添加 ExperienceGainComponent）
     */
    addExperience(entity: Entity, amount: number, source?: string): void {
        // 如果实体已有 ExperienceGainComponent，累加
        let expGain = entity.getComponent(ExperienceGainComponent);
        if (expGain) {
            expGain.amount += amount;
        } else {
            // 创建新组件
            expGain = entity.addComponent(ExperienceGainComponent);
            expGain.amount = amount;
            expGain.source = source;
        }
    }

    /**
     * 处理经验值添加和升级（内部方法）
     */
    private processExperience(entity: Entity, amount: number, source?: string): void {
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (!levelExp) return;

        // 应用经验值倍率
        const multiplier = this.getExperienceMultiplier(entity);
        const finalAmount = amount * multiplier;

        const oldLevel = levelExp.level;
        const levelsGained = levelExp.addExp(finalAmount);

        if (levelsGained > 0) {
            this.handleLevelUp(entity, oldLevel, levelExp.level, levelsGained);
        }
    }

    // ... 其他方法同方案 1 ...
}
```

**优点：**
- ✅ 支持批量处理（一帧内多个经验值获取）
- ✅ 支持延迟处理（经验值可以累积）
- ✅ 保持方案 1 的灵活性

**缺点：**
- ❌ 增加临时组件（ExperienceGainComponent）
- ❌ 复杂度稍高（需要管理临时组件）

---

### 方案 4：纯事件驱动系统

**设计思路：**
- 完全通过 EventBus 事件驱动
- 外部系统发送 ExperienceGain 事件
- UpgradeSystem 订阅事件并处理

**实现：**
```typescript
@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅经验值获取事件
        this.eventBus.subscribe('ExperienceGain', (event: any) => {
            this.onExperienceGain(event);
        });
    }

    /**
     * 处理经验值获取事件
     */
    private onExperienceGain(event: any): void {
        const entity = this.world.getEntityByHandle(event.handle);
        if (!entity) return;

        this.addExperience(entity, event.amount, event.source);
    }

    /**
     * 添加经验值（内部方法）
     */
    private addExperience(entity: Entity, amount: number, source?: string): void {
        // ... 同方案 1 ...
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}

// 外部系统发送事件
// DeathSystem 或 LootSystem
this.eventBus.push({
    type: 'ExperienceGain',
    handle: killerEntity.handle,
    amount: 100,
    source: 'kill'
});
```

**优点：**
- ✅ 完全解耦（通过事件通信）
- ✅ 符合架构原则（事件驱动）
- ✅ 易于扩展（新增经验值来源只需发送事件）

**缺点：**
- ❌ 需要扩展 EventBus 事件类型
- ❌ 所有经验值来源都需要发送事件（可能遗漏）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 1（被动系统，只处理外部调用）+ 方案 2 的事件支持（混合）

**理由：**
1. **简单实用：** 被动系统实现简单，性能好
2. **灵活性高：** 外部系统可以灵活调用，不强制使用事件
3. **可选事件支持：** 可以同时支持事件驱动（DeathSystem 发送死亡事件时自动添加经验）
4. **易于测试：** 方法调用简单，易于单元测试
5. **符合架构：** 不强制事件驱动，但支持事件（可选）

**实现建议：**
1. 创建 `UpgradeSystem`（被动系统，提供 addExperience 方法）
2. 支持可选的事件订阅（DeathSystem 发送死亡事件时自动处理）
3. 处理经验值倍率（从 BuffListComponent 获取）
4. 处理升级逻辑（添加属性加成到 StatsComponent）
5. 发送升级事件（用于 UI 显示、特效播放等）

**与现有系统的集成：**
- `DeathSystem`：敌人死亡时，可以调用 `upgradeSystem.addExperience(killer, expValue, 'kill')` 或发送事件
- `LootSystem`：掉落经验道具时，调用 `upgradeSystem.addExperience(player, expValue, 'item')`
- `LevelExperienceComponent`：调用 `addExp()` 方法添加经验值
- `StatsComponent`：升级时通过 `addLevelupBonus()` 添加属性加成
- `EventBus`：发送 LevelUp 事件（用于 UI 显示）
- `ConfigLoader`：可选，存储经验值配置和属性加成配置

**经验值来源示例：**
```typescript
// DeathSystem 中
if (killerEntity && upgradeSystem) {
    const expValue = 10 * deadEntity.getComponent(LevelExperienceComponent)?.level || 1;
    upgradeSystem.addExperience(killerEntity, expValue, 'kill');
}

// LootSystem 中
if (item.type === 'experience') {
    upgradeSystem.addExperience(player, item.expValue, 'item');
}
```

---

## 实施指南

### 1. 系统接口定义

```typescript
// assets/scripts/gameplay/systems/UpgradeSystem.ts

@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 可选：订阅死亡事件（如果 DeathSystem 发送）
        // this.eventBus.subscribe('EntityDeath', (event) => { ... });
    }

    /**
     * 添加经验值（外部调用）
     */
    addExperience(entity: Entity, amount: number, source?: string): void {
        // ... 实现 ...
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
    }
}
```

### 2. 经验值倍率处理

从 BuffListComponent 中查找 exp_boost Buff：
```typescript
private getExperienceMultiplier(entity: Entity): number {
    const buffList = entity.getComponent(BuffListComponent);
    if (!buffList) return 1.0;

    const expBuff = buffList.findBuff('exp_boost');
    if (expBuff && expBuff.params.value) {
        return 1.0 + expBuff.params.value;
    }

    return 1.0;
}
```

### 3. 属性加成配置

可以从配置读取或使用默认值：
```typescript
private getBonusPerLevel(entity: Entity): Partial<StatsData> {
    // 可以从配置读取（根据实体类型）
    // 或使用默认值
    return {
        attack: 2,
        defense: 1,
        maxHP: 10,
    };
}
```

### 4. 升级事件

扩展 EventBus 事件类型：
```typescript
// EventBus.ts
export type GameplayEvent =
    | { type: 'AnimationEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'CollisionEvent'; handleA: Handle; handleB: Handle }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; handle: Handle; eventName: string; data?: any }
    | { type: 'LevelUp'; handle: Handle; oldLevel: number; newLevel: number; levelsGained: number };  // 新增
```

---

## 验收标准

- [ ] UpgradeSystem 可以正确处理经验值添加
- [ ] 支持经验值倍率（从 Buff 获取）
- [ ] 升级时正确添加属性加成到 StatsComponent
- [ ] 支持连续升级（一次获得大量经验）
- [ ] 发送升级事件（用于 UI 显示）
- [ ] 与 DeathSystem 集成（击杀敌人获得经验）
- [ ] 与 LootSystem 集成（使用经验道具获得经验）
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持经验值配置（不同敌人提供不同经验值）
2. 支持经验值曲线配置（不同等级升级所需经验不同）
3. 支持经验值奖励倍率配置（活动、Buff 等）
4. 支持升级时的技能解锁
5. 支持升级时的装备解锁

但对于肉鸽游戏，方案 1 的简单实现已经足够。
