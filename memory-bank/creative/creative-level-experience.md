# 创意阶段：Level 和 Experience 组件设计

## 问题描述

在肉鸽游戏中，实体需要支持等级和经验系统：
- 等级提升时可能获得属性加成（通过 StatsComponent.levelup）
- 经验值积累到一定值后自动升级
- 需要支持经验值获取和升级触发
- 需要存储当前等级和经验值
- 数据可序列化（用于存档）

**需求：**
1. 支持等级存储（当前等级、最大等级）
2. 支持经验值存储（当前经验、升级所需经验）
3. 支持经验值增长和升级检测
4. 升级时触发属性加成（与 StatsComponent 集成）
5. 数据可序列化

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效查询和更新
- 需要与 StatsComponent 集成（升级时添加属性加成）
- 需要支持经验值曲线（不同等级升级所需经验不同）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：Level 和 Experience 分离为两个组件

**设计思路：**
- 创建独立的 `LevelComponent` 存储等级信息
- 创建独立的 `ExperienceComponent` 存储经验值信息
- 通过 UpgradeSystem 协调两个组件，检测升级并触发 StatsComponent 更新

**实现：**
```typescript
// LevelComponent
@component({ name: 'Level', pooled: true, poolSize: 100 })
export class LevelComponent extends Component {
    current: number = 1;        // 当前等级
    max: number = 100;          // 最大等级（可选，-1 表示无限制）

    reset(): void {
        super.reset();
        this.current = 1;
        this.max = 100;
    }
}

// ExperienceComponent
@component({ name: 'Experience', pooled: true, poolSize: 100 })
export class ExperienceComponent extends Component {
    current: number = 0;        // 当前经验值
    required: number = 100;     // 当前等级升级所需经验值
    total: number = 0;          // 累计总经验值（可选，用于统计）

    reset(): void {
        super.reset();
        this.current = 0;
        this.required = 100;
        this.total = 0;
    }

    /**
     * 添加经验值
     * @returns 是否升级
     */
    addExp(amount: number): boolean {
        this.current += amount;
        this.total += amount;
        
        // 检查是否升级
        if (this.current >= this.required) {
            this.current -= this.required;
            return true; // 触发升级
        }
        return false;
    }

    /**
     * 获取经验值百分比（0-1）
     */
    get percentage(): number {
        return this.required > 0 ? this.current / this.required : 1;
    }
}
```

**优点：**
- ✅ 职责清晰（等级和经验分离）
- ✅ 灵活的查询（可以只查询等级或经验）
- ✅ 易于扩展（可以独立添加组件）
- ✅ 符合 ECS 组件设计原则（单一职责）

**缺点：**
- ❌ 需要两个组件配合使用（增加查询复杂度）
- ❌ 经验值升级检测逻辑分散（需要在 UpgradeSystem 中处理）
- ❌ 可能存在不一致的情况（LevelComponent 和 ExperienceComponent 不匹配）

---

### 方案 2：合并为 LevelExperienceComponent

**设计思路：**
- 将等级和经验合并为一个组件
- 组件内部处理升级逻辑
- 提供统一的接口管理等级和经验

**实现：**
```typescript
@component({ name: 'LevelExperience', pooled: true, poolSize: 100 })
export class LevelExperienceComponent extends Component {
    level: number = 1;          // 当前等级
    maxLevel: number = 100;     // 最大等级（可选，-1 表示无限制）
    exp: number = 0;            // 当前经验值
    expRequired: number = 100;  // 当前等级升级所需经验值
    totalExp: number = 0;       // 累计总经验值（可选）

    reset(): void {
        super.reset();
        this.level = 1;
        this.maxLevel = 100;
        this.exp = 0;
        this.expRequired = 100;
        this.totalExp = 0;
    }

    /**
     * 添加经验值
     * @returns 升级的等级数（0 表示未升级）
     */
    addExp(amount: number): number {
        this.exp += amount;
        this.totalExp += amount;
        
        let levelsGained = 0;
        
        // 循环检测升级（可能一次获得大量经验，连续升级）
        while (this.exp >= this.expRequired && (this.maxLevel < 0 || this.level < this.maxLevel)) {
            this.exp -= this.expRequired;
            this.level++;
            levelsGained++;
            this.expRequired = this.calculateRequiredExp(this.level);
        }
        
        return levelsGained;
    }

    /**
     * 计算指定等级升级所需经验值
     * 经验曲线：线性、二次、指数等
     */
    private calculateRequiredExp(level: number): number {
        // 示例：二次曲线 exp = base * level^2
        const base = 100;
        return base * level * level;
    }

    /**
     * 获取经验值百分比（0-1）
     */
    get expPercentage(): number {
        return this.expRequired > 0 ? this.exp / this.expRequired : 1;
    }

    /**
     * 是否已达到最大等级
     */
    get isMaxLevel(): boolean {
        return this.maxLevel > 0 && this.level >= this.maxLevel;
    }
}
```

**优点：**
- ✅ 数据集中（等级和经验在一起，避免不一致）
- ✅ 逻辑集中（升级检测在组件内部）
- ✅ 易于使用（一个组件即可）
- ✅ 支持连续升级（一次获得大量经验）

**缺点：**
- ❌ 职责混合（等级和经验在一个组件中）
- ❌ 经验曲线计算逻辑硬编码（可以通过配置解决）

---

### 方案 3：LevelExperienceComponent + 配置驱动经验曲线

**设计思路：**
- 在方案 2 基础上，将经验曲线计算提取到配置
- 通过 ConfigLoader 获取经验曲线配置
- 组件存储当前状态，配置存储计算规则

**实现：**
```typescript
// 配置
export interface LevelConfig {
    maxLevel: number;
    expCurve: 'linear' | 'quadratic' | 'exponential' | 'custom';
    expBase: number;
    expMultiplier?: number;  // 二次曲线系数
    expExponent?: number;    // 指数曲线指数
    customExpFormula?: (level: number) => number;  // 自定义公式
}

export const LevelConfigs: Record<string, LevelConfig> = {
    'player': {
        maxLevel: 100,
        expCurve: 'quadratic',
        expBase: 100,
        expMultiplier: 1.0
    },
    'enemy': {
        maxLevel: -1,  // 无限制
        expCurve: 'linear',
        expBase: 50
    }
};

// 组件
@component({ name: 'LevelExperience', pooled: true, poolSize: 100 })
export class LevelExperienceComponent extends Component {
    level: number = 1;
    maxLevel: number = 100;
    exp: number = 0;
    expRequired: number = 100;
    totalExp: number = 0;
    configKey?: string;  // 配置键（如 'player'）

    reset(): void {
        super.reset();
        this.level = 1;
        this.maxLevel = 100;
        this.exp = 0;
        this.expRequired = 100;
        this.totalExp = 0;
        this.configKey = undefined;
    }

    /**
     * 设置配置（初始化时调用）
     */
    setConfig(configKey: string, config: LevelConfig): void {
        this.configKey = configKey;
        this.maxLevel = config.maxLevel;
        this.expRequired = this.calculateRequiredExp(1, config);
    }

    /**
     * 添加经验值
     * @returns 升级的等级数（0 表示未升级）
     */
    addExp(amount: number, configLoader: ConfigLoader): number {
        if (!this.configKey) {
            console.warn('[LevelExperienceComponent] Config not set');
            return 0;
        }

        const config = configLoader.getLevelConfig(this.configKey);
        if (!config) {
            console.warn(`[LevelExperienceComponent] Config not found: ${this.configKey}`);
            return 0;
        }

        this.exp += amount;
        this.totalExp += amount;
        
        let levelsGained = 0;
        
        while (this.exp >= this.expRequired && !this.isMaxLevel) {
            this.exp -= this.expRequired;
            this.level++;
            levelsGained++;
            this.expRequired = this.calculateRequiredExp(this.level, config);
        }
        
        return levelsGained;
    }

    private calculateRequiredExp(level: number, config: LevelConfig): number {
        switch (config.expCurve) {
            case 'linear':
                return config.expBase * level;
            case 'quadratic':
                return config.expBase * level * level * (config.expMultiplier || 1.0);
            case 'exponential':
                return config.expBase * Math.pow(config.expExponent || 2, level - 1);
            case 'custom':
                return config.customExpFormula ? config.customExpFormula(level) : config.expBase;
            default:
                return config.expBase;
        }
    }

    get expPercentage(): number {
        return this.expRequired > 0 ? this.exp / this.expRequired : 1;
    }

    get isMaxLevel(): boolean {
        return this.maxLevel > 0 && this.level >= this.maxLevel;
    }
}
```

**优点：**
- ✅ 配置驱动（经验曲线可配置）
- ✅ 灵活性高（支持多种经验曲线）
- ✅ 保持方案 2 的所有优点
- ✅ 易于测试（可以测试不同的经验曲线）

**缺点：**
- ❌ 组件依赖 ConfigLoader（但只在 addExp 时使用，可以通过参数传入）
- ❌ 稍微复杂（需要配置系统支持）

---

### 方案 4：LevelComponent + ExperienceComponent（简化版，无升级逻辑）

**设计思路：**
- 将等级和经验分离为两个简单组件（只存储数据）
- 升级逻辑完全在 UpgradeSystem 中处理
- 组件只负责数据存储

**实现：**
```typescript
// LevelComponent（只存储等级）
@component({ name: 'Level', pooled: true, poolSize: 100 })
export class LevelComponent extends Component {
    current: number = 1;
    max: number = 100;

    reset(): void {
        super.reset();
        this.current = 1;
        this.max = 100;
    }
}

// ExperienceComponent（只存储经验值）
@component({ name: 'Experience', pooled: true, poolSize: 100 })
export class ExperienceComponent extends Component {
    current: number = 0;      // 当前经验值
    required: number = 100;   // 当前等级升级所需经验值
    total: number = 0;        // 累计总经验值

    reset(): void {
        super.reset();
        this.current = 0;
        this.required = 100;
        this.total = 0;
    }

    get percentage(): number {
        return this.required > 0 ? this.current / this.required : 1;
    }
}

// UpgradeSystem 负责升级逻辑
@system({ priority: 5 })
export class UpgradeSystem extends System {
    private configLoader: ConfigLoader;

    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [LevelComponent, ExperienceComponent, StatsComponent]
        });

        query.forEach(entity => {
            const level = entity.getComponent(LevelComponent)!;
            const exp = entity.getComponent(ExperienceComponent)!;
            const stats = entity.getComponent(StatsComponent)!;

            // 检查是否升级
            while (exp.current >= exp.required && !level.isMaxLevel) {
                // 升级
                exp.current -= exp.required;
                level.current++;
                
                // 计算新的升级所需经验值
                exp.required = this.calculateRequiredExp(level.current);
                
                // 添加属性加成（从配置读取）
                const levelConfig = this.configLoader.getLevelConfig('player');
                if (levelConfig && levelConfig.statsBonus) {
                    stats.addLevelupBonus(levelConfig.statsBonus);
                }
            }
        });
    }

    private calculateRequiredExp(level: number): number {
        // 从配置读取经验曲线
        // ...
    }
}
```

**优点：**
- ✅ 组件职责单一（只存储数据）
- ✅ 逻辑集中在系统（符合 ECS 原则）
- ✅ 易于测试（组件和系统分开测试）
- ✅ 灵活性高（升级逻辑可以轻松修改）

**缺点：**
- ❌ 需要两个组件配合（查询复杂度）
- ❌ 升级逻辑在系统不在组件（需要在每帧检查）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 2（合并为 LevelExperienceComponent，简单实现）

**理由：**
1. **简单实用：** 对于肉鸽游戏，等级和经验通常总是同时存在，合并为单个组件更简单
2. **数据一致性：** 避免等级和经验不同步的问题
3. **升级逻辑集中：** 升级检测在组件内部，支持连续升级
4. **性能足够：** 经验值更新频率不高，实时计算性能足够
5. **易于扩展：** 如果后续需要更复杂的配置，可以升级为方案 3

**实现建议：**
1. 创建 `LevelExperienceComponent`（合并等级和经验）
2. 使用简单的经验曲线计算（二次曲线，可以在后续通过配置扩展）
3. 创建 `UpgradeSystem` 负责：
   - 处理经验值获取（从各种来源：击杀、任务等）
   - 调用 `LevelExperienceComponent.addExp()`
   - 检测升级（`addExp` 返回升级等级数）
   - 升级时添加属性加成到 `StatsComponent.levelup`
4. 如果后续需要配置驱动，可以升级为方案 3

**与现有系统的集成：**
- `LootSystem`：击杀敌人时，通过 UpgradeSystem 给玩家添加经验值
- `UpgradeSystem`：处理经验值获取和升级逻辑，更新 StatsComponent
- `StatsComponent`：升级时通过 `addLevelupBonus()` 添加属性加成
- `ConfigLoader`：可选，存储经验曲线配置（后续扩展）

**数据序列化：**
所有字段都是可序列化的简单类型（number），可以直接 JSON 序列化。

---

## 实施指南

### 1. 组件接口定义

```typescript
// assets/scripts/gameplay/components/LevelExperience.ts

@component({ name: 'LevelExperience', pooled: true, poolSize: 100 })
export class LevelExperienceComponent extends Component {
    level: number = 1;
    maxLevel: number = 100;
    exp: number = 0;
    expRequired: number = 100;
    totalExp: number = 0;

    // ... 方法实现 ...
}
```

### 2. 经验曲线计算

使用简单的二次曲线：
```typescript
calculateRequiredExp(level: number): number {
    const base = 100;
    return base * level * level;
}
```

### 3. 系统集成

创建 `UpgradeSystem`：
```typescript
// assets/scripts/gameplay/systems/UpgradeSystem.ts

@system({ priority: 5 })
export class UpgradeSystem extends System {
    onUpdate(dt: number): void {
        // 这个系统主要负责：
        // 1. 处理外部经验值获取请求（通过事件或直接调用）
        // 2. 调用 LevelExperienceComponent.addExp()
        // 3. 处理升级时的属性加成
    }

    /**
     * 添加经验值（外部调用）
     */
    addExperience(entity: Entity, amount: number): void {
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (!levelExp) return;

        const levelsGained = levelExp.addExp(amount);
        
        if (levelsGained > 0) {
            // 升级了，添加属性加成
            const stats = entity.getComponent(StatsComponent);
            if (stats) {
                // 每级增加的属性（可以从配置读取）
                const bonusPerLevel = {
                    attack: 2,
                    defense: 1,
                    maxHP: 10,
                };
                
                // 添加多级加成
                for (let i = 0; i < levelsGained; i++) {
                    stats.addLevelupBonus(bonusPerLevel);
                }
            }
        }
    }
}
```

### 4. 配置集成（可选，后续扩展）

如果后续需要配置驱动，可以在 `data/configs/` 中创建：

```typescript
// assets/scripts/data/configs/levels.ts

export interface LevelConfig {
    maxLevel: number;
    expCurve: 'linear' | 'quadratic' | 'exponential';
    expBase: number;
    statsBonusPerLevel: Partial<StatsData>;
}

export const LevelConfigs: Record<string, LevelConfig> = {
    'player': {
        maxLevel: 100,
        expCurve: 'quadratic',
        expBase: 100,
        statsBonusPerLevel: {
            attack: 2,
            defense: 1,
            maxHP: 10,
        }
    },
};
```

---

## 验收标准

- [ ] LevelExperienceComponent 可以正确存储等级和经验值
- [ ] 支持经验值增长和升级检测
- [ ] 支持连续升级（一次获得大量经验）
- [ ] 升级时正确计算新的升级所需经验值
- [ ] 与 StatsComponent 集成（升级时添加属性加成）
- [ ] 数据可序列化
- [ ] UpgradeSystem 正确处理经验值获取和升级逻辑
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果后续需要更复杂的经验曲线或配置驱动，可以：
1. 升级为方案 3（配置驱动）
2. 支持不同类型的经验曲线（线性、二次、指数、自定义）
3. 支持等级上限动态调整
4. 支持经验值奖励倍率（Buff、活动等）

但对于肉鸽游戏，方案 2 的简单实现已经足够。
