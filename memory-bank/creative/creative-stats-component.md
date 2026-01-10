# 创意阶段：Stats 属性系统组件设计

## 问题描述

在肉鸽游戏中，实体需要具备多种属性（攻击、防御、速度、生命值等），这些属性：
- 可能来自基础值、装备加成、Buff 加成、升级加成等多个来源
- 需要支持实时计算（基础值 + 加成）
- 需要支持临时修改（Buff）和永久修改（装备、升级）
- 需要支持百分比加成和固定值加成
- 需要高效查询和更新
- 数据可序列化（用于存档）

**需求：**
1. 支持基础属性值存储
2. 支持多个属性源（基础、装备、Buff、升级）
3. 支持百分比加成和固定值加成
4. 支持实时计算最终属性值
5. 数据可序列化

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效计算（避免每次查询都重新计算）
- 需要支持肉鸽游戏的常见属性（攻击、防御、速度、生命值、暴击率、暴击伤害等）
- 需要与现有 HPComponent、VelocityComponent 兼容（考虑是否替换或共存）

## 现有组件分析

**HPComponent：**
- 存储 `cur` 和 `max`
- 提供 `percentage` 和 `isDead` getter
- 简单直接，适合当前需求

**VelocityComponent：**
- 存储 `vx` 和 `vy`
- 直接存储速度向量

**问题：**
- HPComponent 的 `max` 可能需要受属性系统影响（如装备加成）
- VelocityComponent 的 `vx`、`vy` 可能受速度属性影响（如 Buff 加成）
- 需要考虑是否将 HP 和 Velocity 整合到 Stats 中，还是保持独立

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：独立 Stats 组件 + 属性源分离

**设计思路：**
- 创建独立的 `StatsComponent` 存储基础属性
- 使用多个字段存储不同来源的加成（base、equipment、buff、levelup）
- 提供计算方法计算最终值
- 与 HPComponent、VelocityComponent 保持独立，通过系统协调

**实现：**
```typescript
@component({ name: 'Stats', pooled: true, poolSize: 100 })
export class StatsComponent extends Component {
    // 基础属性（从配置读取或初始化）
    base: StatsData = {
        attack: 10,
        defense: 5,
        speed: 100,      // 移动速度（像素/秒）
        maxHP: 100,
        critRate: 0.05,  // 暴击率（0-1）
        critDamage: 1.5, // 暴击伤害倍数
        lifesteal: 0,    // 生命偷取（0-1）
    };

    // 装备加成（固定值）
    equipment: Partial<StatsData> = {};

    // Buff 加成（固定值，可能为负）
    buffFixed: Partial<StatsData> = {};

    // Buff 百分比加成（0.2 表示 +20%）
    buffPercent: Partial<Record<keyof StatsData, number>> = {};

    // 升级加成（固定值）
    levelup: Partial<StatsData> = {};

    /** 计算最终属性值 */
    getFinal(statName: keyof StatsData): number {
        const baseValue = this.base[statName] || 0;
        const equipmentValue = this.equipment[statName] || 0;
        const buffFixedValue = this.buffFixed[statName] || 0;
        const levelupValue = this.levelup[statName] || 0;
        const buffPercentValue = this.buffPercent[statName] || 0;

        // 计算公式：最终值 = (基础值 + 装备加成 + 固定Buff + 升级加成) * (1 + 百分比Buff)
        const fixedSum = baseValue + equipmentValue + buffFixedValue + levelupValue;
        return fixedSum * (1 + buffPercentValue);
    }

    /** 获取所有最终属性 */
    getAllFinal(): StatsData {
        return {
            attack: this.getFinal('attack'),
            defense: this.getFinal('defense'),
            speed: this.getFinal('speed'),
            maxHP: this.getFinal('maxHP'),
            critRate: this.getFinal('critRate'),
            critDamage: this.getFinal('critDamage'),
            lifesteal: this.getFinal('lifesteal'),
        };
    }

    reset(): void {
        super.reset();
        this.base = {
            attack: 10,
            defense: 5,
            speed: 100,
            maxHP: 100,
            critRate: 0.05,
            critDamage: 1.5,
            lifesteal: 0,
        };
        this.equipment = {};
        this.buffFixed = {};
        this.buffPercent = {};
        this.levelup = {};
    }
}

interface StatsData {
    attack: number;      // 攻击力
    defense: number;     // 防御力
    speed: number;       // 移动速度（像素/秒）
    maxHP: number;       // 最大生命值
    critRate: number;    // 暴击率（0-1）
    critDamage: number;  // 暴击伤害倍数
    lifesteal: number;   // 生命偷取（0-1）
}
```

**优点：**
- ✅ 清晰的属性源分离（base、equipment、buff、levelup）
- ✅ 灵活的计算公式（支持固定值和百分比）
- ✅ 与现有组件兼容（不破坏 HPComponent、VelocityComponent）
- ✅ 易于序列化（所有字段都是简单类型）
- ✅ 计算逻辑清晰（getFinal 方法）

**缺点：**
- ❌ 每次调用 `getFinal` 都需要计算（可以缓存，但需要脏标记机制）
- ❌ 属性名称硬编码（可以通过 Record 类型解决）
- ❌ 需要系统协调 Stats 和 HP 的同步（如 maxHP 变化时更新 HPComponent.max）

---

### 方案 2：独立 Stats 组件 + 最终值缓存

**设计思路：**
- 在方案 1 基础上，添加最终值缓存
- 使用脏标记机制，只在属性源变化时重新计算
- 提供 `update()` 方法手动触发更新

**实现：**
```typescript
@component({ name: 'Stats', pooled: true, poolSize: 100 })
export class StatsComponent extends Component {
    // ... 属性源字段（同方案 1）...

    /** 最终属性值缓存（只读） */
    private _final: StatsData = {
        attack: 10,
        defense: 5,
        speed: 100,
        maxHP: 100,
        critRate: 0.05,
        critDamage: 1.5,
        lifesteal: 0,
    };

    /** 脏标记 */
    private _dirty: boolean = true;

    /** 获取最终属性值（带缓存） */
    getFinal(statName: keyof StatsData): number {
        if (this._dirty) {
            this._recalculate();
        }
        return this._final[statName];
    }

    /** 获取所有最终属性（带缓存） */
    getAllFinal(): StatsData {
        if (this._dirty) {
            this._recalculate();
        }
        return { ...this._final };
    }

    /** 标记为脏（属性源变化时调用） */
    markDirty(): void {
        this._dirty = true;
    }

    /** 重新计算最终值 */
    private _recalculate(): void {
        this._final = {
            attack: this._calcFinal('attack'),
            defense: this._calcFinal('defense'),
            speed: this._calcFinal('speed'),
            maxHP: this._calcFinal('maxHP'),
            critRate: this._calcFinal('critRate'),
            critDamage: this._calcFinal('critDamage'),
            lifesteal: this._calcFinal('lifesteal'),
        };
        this._dirty = false;
    }

    private _calcFinal(statName: keyof StatsData): number {
        const baseValue = this.base[statName] || 0;
        const equipmentValue = this.equipment[statName] || 0;
        const buffFixedValue = this.buffFixed[statName] || 0;
        const levelupValue = this.levelup[statName] || 0;
        const buffPercentValue = this.buffPercent[statName] || 0;

        const fixedSum = baseValue + equipmentValue + buffFixedValue + levelupValue;
        return fixedSum * (1 + buffPercentValue);
    }

    reset(): void {
        super.reset();
        // ... 重置属性源...
        this._dirty = true;
        this._recalculate();
    }
}
```

**优点：**
- ✅ 性能优化（避免重复计算）
- ✅ 保持方案 1 的所有优点
- ✅ 提供明确的更新机制（markDirty）

**缺点：**
- ❌ 增加复杂度（脏标记机制）
- ❌ 需要系统主动调用 `markDirty()`（容易遗漏）
- ❌ 缓存可能导致数据不一致（如果忘记调用 markDirty）

---

### 方案 3：独立 Stats 组件 + 事件驱动更新

**设计思路：**
- 在方案 2 基础上，使用属性 setter 自动标记脏
- 属性修改时自动触发更新
- 与 BuffSystem 和 EquipmentSystem 集成

**实现：**
```typescript
@component({ name: 'Stats', pooled: true, poolSize: 100 })
export class StatsComponent extends Component {
    // 使用私有字段 + getter/setter
    private _base: StatsData = { /* ... */ };
    private _equipment: Partial<StatsData> = {};
    private _buffFixed: Partial<StatsData> = {};
    private _buffPercent: Partial<Record<keyof StatsData, number>> = {};
    private _levelup: Partial<StatsData> = {};

    private _final: StatsData = { /* ... */ };
    private _dirty: boolean = true;

    /** 基础属性 getter */
    get base(): StatsData {
        return { ...this._base };
    }

    /** 设置基础属性 */
    setBase(statName: keyof StatsData, value: number): void {
        this._base[statName] = value;
        this.markDirty();
    }

    /** 添加装备加成 */
    addEquipmentBonus(bonus: Partial<StatsData>): void {
        Object.assign(this._equipment, bonus);
        this.markDirty();
    }

    /** 移除装备加成 */
    removeEquipmentBonus(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            delete this._equipment[key as keyof StatsData];
        });
        this.markDirty();
    }

    /** 添加 Buff 加成（固定值） */
    addBuffFixed(bonus: Partial<StatsData>): void {
        Object.assign(this._buffFixed, bonus);
        this.markDirty();
    }

    /** 移除 Buff 加成（固定值） */
    removeBuffFixed(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            delete this._buffFixed[key as keyof StatsData];
        });
        this.markDirty();
    }

    /** 添加 Buff 百分比加成 */
    addBuffPercent(bonus: Partial<Record<keyof StatsData, number>>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            this._buffPercent[statKey] = (this._buffPercent[statKey] || 0) + (bonus[statKey] || 0);
        });
        this.markDirty();
    }

    /** 移除 Buff 百分比加成 */
    removeBuffPercent(bonus: Partial<Record<keyof StatsData, number>>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            this._buffPercent[statKey] = (this._buffPercent[statKey] || 0) - (bonus[statKey] || 0);
        });
        this.markDirty();
    }

    // ... getFinal、getAllFinal、markDirty、_recalculate 等方法...
}
```

**优点：**
- ✅ 自动标记脏（避免遗漏）
- ✅ 封装性好（修改属性必须通过方法）
- ✅ 保持性能优化

**缺点：**
- ❌ 增加代码复杂度（大量 getter/setter）
- ❌ 需要手动管理属性源（如 BuffSystem 需要知道如何调用 addBuffFixed）
- ❌ 可能导致过度封装（简单赋值变成方法调用）

---

### 方案 4：扩展 HPComponent + 独立其他属性

**设计思路：**
- 不创建独立的 StatsComponent
- 扩展 HPComponent，使其支持 maxHP 的动态计算
- VelocityComponent 保持不变（速度受 Buff 影响时，由系统直接修改 vx/vy）
- 其他属性（攻击、防御、暴击等）创建独立的属性组件

**实现：**
```typescript
// 扩展 HPComponent
@component({ name: 'HP', pooled: true, poolSize: 100 })
export class HPComponent extends Component {
    cur: number = 100;
    baseMax: number = 100;  // 基础最大生命值
    maxBonus: number = 0;   // 加成（装备、Buff、升级）

    get max(): number {
        return this.baseMax + this.maxBonus;
    }

    // ... 其他方法...
}

// 攻击属性组件
@component({ name: 'Attack', pooled: true })
export class AttackComponent extends Component {
    base: number = 10;
    bonus: number = 0;

    get final(): number {
        return this.base + this.bonus;
    }
}

// 防御属性组件
@component({ name: 'Defense', pooled: true })
export class DefenseComponent extends Component {
    base: number = 5;
    bonus: number = 0;

    get final(): number {
        return this.base + this.bonus;
    }
}

// ... 其他属性组件...
```

**优点：**
- ✅ 最小化改动（不破坏现有组件）
- ✅ 组件职责清晰（每个属性一个组件）
- ✅ 灵活的查询（可以只查询需要的属性）

**缺点：**
- ❌ 组件数量过多（每个属性一个组件）
- ❌ 查询复杂（需要多个查询）
- ❌ 属性加成管理分散（BuffSystem 需要操作多个组件）
- ❌ 不利于批量操作（如获取所有属性）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 推荐方案：方案 1（独立 Stats 组件 + 属性源分离）

**理由：**
1. **清晰的架构：** 属性源分离（base、equipment、buff、levelup）让数据流向清晰
2. **易于维护：** 统一的属性管理，避免属性散落在多个组件中
3. **性能可接受：** 对于肉鸽游戏，属性查询频率不高，实时计算性能足够
4. **易于扩展：** 新增属性只需在 StatsData 接口中添加字段
5. **与现有组件兼容：** 不破坏 HPComponent 和 VelocityComponent，通过系统协调

**实现建议：**
1. 创建独立的 `StatsComponent`
2. 使用方案 1 的基础结构（不添加缓存，保持简单）
3. 如果后续性能成为瓶颈，再考虑添加缓存机制
4. 创建 `StatsSyncSystem` 负责：
   - 同步 `StatsComponent.maxHP` 到 `HPComponent.max`
   - 同步 `StatsComponent.speed` 到 `VelocityComponent`（通过修改 vx/vy）
5. 在 `BuffSystem` 中，当 Buff 影响属性时，调用 `StatsComponent` 的相应方法

**与现有系统的集成：**
- `BuffSystem`：Buff 影响属性时，修改 `StatsComponent.buffFixed` 或 `buffPercent`
- `EquipmentSystem`：装备时，修改 `StatsComponent.equipment`
- `UpgradeSystem`：升级时，修改 `StatsComponent.levelup`
- `CombatSystem`：计算伤害时，使用 `StatsComponent.getFinal('attack')` 和 `getFinal('defense')`
- `MoveSystem`：可以使用 `StatsComponent.getFinal('speed')` 限制最大速度

**数据序列化：**
所有字段都是可序列化的简单类型（number、对象），可以直接 JSON 序列化。

---

## 实施指南

### 1. 组件接口定义

```typescript
// assets/scripts/gameplay/components/Stats.ts

export interface StatsData {
    attack: number;      // 攻击力
    defense: number;     // 防御力
    speed: number;       // 移动速度（像素/秒）
    maxHP: number;       // 最大生命值
    critRate: number;    // 暴击率（0-1）
    critDamage: number;  // 暴击伤害倍数
    lifesteal: number;   // 生命偷取（0-1）
}
```

### 2. 组件实现

见方案 1 的实现代码。

### 3. 系统集成

创建 `StatsSyncSystem` 负责属性同步：

```typescript
// assets/scripts/gameplay/systems/StatsSyncSystem.ts

@system({ priority: 3 })  // 在 MoveSystem 之后，CombatSystem 之前
export class StatsSyncSystem extends System {
    onUpdate(dt: number): void {
        // 同步 maxHP
        const hpQuery = this.world.createQuery({
            all: [StatsComponent, HPComponent]
        });
        hpQuery.forEach(entity => {
            const stats = entity.getComponent(StatsComponent)!;
            const hp = entity.getComponent(HPComponent)!;
            const newMaxHP = stats.getFinal('maxHP');
            
            if (hp.max !== newMaxHP) {
                // 按比例调整当前生命值
                const ratio = hp.max > 0 ? hp.cur / hp.max : 1;
                hp.max = newMaxHP;
                hp.cur = Math.min(hp.cur, newMaxHP * ratio);
            }
        });

        // 同步 speed（可选，如果需要限制最大速度）
        // 注意：VelocityComponent 存储的是向量，这里只是建议实现
    }
}
```

### 4. 配置集成

在 `data/configs/` 中创建属性配置：

```typescript
// assets/scripts/data/configs/stats.ts

export interface StatsConfig {
    baseStats: StatsData;
}

export const EntityStatsConfigs: Record<string, StatsConfig> = {
    'player': {
        baseStats: {
            attack: 15,
            defense: 8,
            speed: 120,
            maxHP: 100,
            critRate: 0.1,
            critDamage: 1.5,
            lifesteal: 0,
        }
    },
    'enemy_basic': {
        baseStats: {
            attack: 8,
            defense: 3,
            speed: 80,
            maxHP: 50,
            critRate: 0.05,
            critDamage: 1.2,
            lifesteal: 0,
        }
    },
};
```

---

## 验收标准

- [ ] StatsComponent 可以正确计算最终属性值
- [ ] 支持多个属性源（base、equipment、buff、levelup）
- [ ] 支持百分比加成和固定值加成
- [ ] 数据可序列化
- [ ] 与现有系统（HPComponent、VelocityComponent）兼容
- [ ] StatsSyncSystem 正确同步属性到相关组件
- [ ] 单元测试覆盖所有功能

---

## 后续优化（可选）

如果性能成为瓶颈，可以考虑：
1. 添加最终值缓存（方案 2）
2. 使用事件驱动更新（方案 3）
3. 只在特定系统查询时计算（延迟计算）

但对于肉鸽游戏，方案 1 的性能已经足够。
