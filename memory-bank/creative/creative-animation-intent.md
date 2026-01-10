# 创意阶段：AnimationIntent 组件设计

## 问题描述

根据架构约束规则 1，Fixed Systems（如 MoveSystem、CombatSystem、SkillSystem）不能直接修改 `AnimState`，只能通过 `AnimationIntent` 表达动画意图，然后由 `AnimationIntentSystem`（Render System）将意图转换为实际的动画状态。

**需求：**
1. Fixed Systems 可以设置动画意图（如 "move", "attack", "idle"）
2. AnimationIntentSystem 读取意图并更新 AnimState
3. 支持动画优先级（如攻击动画优先级高于移动动画）
4. 支持动画参数（如攻击方向、移动速度等）
5. 支持动画触发（一次性动画，如攻击、受击）

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要与 AnimState 配合工作
- 必须遵循架构约束：只有 AnimationIntentSystem 能修改 AnimState

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Component Design

### 方案 1：单一意图字段（简单版）

**设计思路：**
- 使用单个字段存储当前动画意图
- 系统每次更新时覆盖意图

**实现：**
```typescript
@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    /** 当前动画意图 */
    intent: string = 'idle';
    
    /** 动画优先级（数字越大优先级越高） */
    priority: number = 0;
    
    /** 动画参数（可选） */
    params: Record<string, any> = {};

    reset(): void {
        super.reset();
        this.intent = 'idle';
        this.priority = 0;
        this.params = {};
    }
}
```

**使用方式：**
```typescript
// MoveSystem 设置移动意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    intent.intent = 'move';
    intent.priority = 10;
    intent.params = { speed: velocity.magnitude };
}

// AnimationIntentSystem 读取意图并更新 AnimState
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    const animState = entity.getComponent(AnimStateComponent);
    if (animState && intent.priority >= animState.currentPriority) {
        animState.current = intent.intent;
        animState.currentPriority = intent.priority;
    }
    // 清空意图（可选）
    intent.intent = 'idle';
    intent.priority = 0;
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 内存占用小
- ✅ 可序列化

**缺点：**
- ⚠️ 多个系统同时设置意图时可能冲突
- ⚠️ 需要系统协调优先级

---

### 方案 2：意图队列（支持多个意图）

**设计思路：**
- 使用队列存储多个动画意图
- 按优先级排序，处理最高优先级的意图

**实现：**
```typescript
@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    /** 动画意图队列 */
    intents: AnimationIntentData[] = [];

    /** 添加动画意图 */
    addIntent(intent: string, priority: number, params?: Record<string, any>): void {
        this.intents.push({
            intent,
            priority,
            params: params || {},
            timestamp: Date.now() // 用于排序相同优先级的情况
        });
        
        // 按优先级排序（降序）
        this.intents.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.timestamp - a.timestamp; // 相同优先级，后添加的优先
        });
    }

    /** 获取最高优先级的意图 */
    getTopIntent(): AnimationIntentData | null {
        return this.intents.length > 0 ? this.intents[0] : null;
    }

    /** 移除意图 */
    removeIntent(intent: string): void {
        this.intents = this.intents.filter(i => i.intent !== intent);
    }

    /** 清空所有意图 */
    clear(): void {
        this.intents = [];
    }

    reset(): void {
        super.reset();
        this.intents = [];
    }
}

interface AnimationIntentData {
    intent: string;
    priority: number;
    params: Record<string, any>;
    timestamp: number;
}
```

**使用方式：**
```typescript
// MoveSystem 添加移动意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    intent.addIntent('move', 10, { speed: velocity.magnitude });
}

// CombatSystem 添加攻击意图（更高优先级）
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    intent.addIntent('attack', 50, { direction: attackDirection });
}

// AnimationIntentSystem 处理最高优先级意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    const topIntent = intent.getTopIntent();
    if (topIntent) {
        const animState = entity.getComponent(AnimStateComponent);
        if (animState) {
            animState.current = topIntent.intent;
            animState.currentPriority = topIntent.priority;
        }
        // 移除已处理的意图
        intent.removeIntent(topIntent.intent);
    }
}
```

**优点：**
- ✅ 支持多个系统同时设置意图
- ✅ 自动处理优先级
- ✅ 支持意图队列

**缺点：**
- ⚠️ 实现复杂
- ⚠️ 需要管理队列
- ⚠️ 内存占用稍大

---

### 方案 3：意图标记 + 参数（混合方案）

**设计思路：**
- 使用标记字段表示不同类型的动画意图
- 使用参数字段存储额外信息
- 支持多个意图同时存在（通过标记位）

**实现：**
```typescript
@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    /** 动画意图标记（位掩码） */
    flags: number = 0;
    
    /** 动画参数 */
    params: Record<string, any> = {};

    /** 意图优先级映射 */
    private static readonly INTENT_PRIORITIES: Record<string, number> = {
        'idle': 0,
        'move': 10,
        'attack': 50,
        'hurt': 40,
        'die': 100
    };

    /** 设置意图 */
    setIntent(intent: string, params?: Record<string, any>): void {
        const flag = this.getIntentFlag(intent);
        this.flags |= flag;
        if (params) {
            Object.assign(this.params, params);
        }
    }

    /** 清除意图 */
    clearIntent(intent: string): void {
        const flag = this.getIntentFlag(intent);
        this.flags &= ~flag;
    }

    /** 检查是否有意图 */
    hasIntent(intent: string): boolean {
        const flag = this.getIntentFlag(intent);
        return (this.flags & flag) !== 0;
    }

    /** 获取最高优先级的意图 */
    getTopIntent(): string | null {
        let topIntent: string | null = null;
        let topPriority = -1;

        for (const [intent, priority] of Object.entries(AnimationIntentComponent.INTENT_PRIORITIES)) {
            if (this.hasIntent(intent) && priority > topPriority) {
                topIntent = intent;
                topPriority = priority;
            }
        }

        return topIntent;
    }

    private getIntentFlag(intent: string): number {
        const intentMap: Record<string, number> = {
            'idle': 0x01,
            'move': 0x02,
            'attack': 0x04,
            'hurt': 0x08,
            'die': 0x10
        };
        return intentMap[intent] || 0;
    }

    reset(): void {
        super.reset();
        this.flags = 0;
        this.params = {};
    }
}
```

**优点：**
- ✅ 支持多个意图同时存在
- ✅ 内存占用小（位掩码）
- ✅ 优先级自动处理

**缺点：**
- ⚠️ 意图数量有限（受位掩码限制）
- ⚠️ 实现复杂

---

### 方案 4：简单字段 + 触发标记（推荐）

**设计思路：**
- 使用单个字段存储持续意图（如 move、idle）
- 使用触发标记表示一次性动画（如 attack、hurt）
- 简单实用，满足大部分需求

**实现：**
```typescript
@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    /** 持续动画意图（如 move、idle） */
    continuousIntent: string = 'idle';
    
    /** 触发动画意图（一次性，如 attack、hurt） */
    triggerIntent: string | null = null;
    
    /** 动画参数 */
    params: Record<string, any> = {};

    /** 设置持续意图 */
    setContinuousIntent(intent: string, params?: Record<string, any>): void {
        this.continuousIntent = intent;
        if (params) {
            Object.assign(this.params, params);
        }
    }

    /** 触发一次性动画 */
    trigger(intent: string, params?: Record<string, any>): void {
        this.triggerIntent = intent;
        if (params) {
            Object.assign(this.params, params);
        }
    }

    /** 清除触发意图（由 AnimationIntentSystem 调用） */
    clearTrigger(): void {
        this.triggerIntent = null;
    }

    reset(): void {
        super.reset();
        this.continuousIntent = 'idle';
        this.triggerIntent = null;
        this.params = {};
    }
}
```

**使用方式：**
```typescript
// MoveSystem 设置持续意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent && velocity.magnitude > 0) {
    intent.setContinuousIntent('move', { speed: velocity.magnitude });
} else if (intent) {
    intent.setContinuousIntent('idle');
}

// CombatSystem 触发攻击动画
const intent = entity.getComponent(AnimationIntentComponent);
if (intent && isAttacking) {
    intent.trigger('attack', { direction: attackDirection });
}

// AnimationIntentSystem 处理意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    const animState = entity.getComponent(AnimStateComponent);
    if (animState) {
        // 优先处理触发动画
        if (intent.triggerIntent) {
            animState.current = intent.triggerIntent;
            intent.clearTrigger();
        } else {
            // 否则使用持续意图
            animState.current = intent.continuousIntent;
        }
    }
}
```

**优点：**
- ✅ 实现简单，易于理解
- ✅ 区分持续动画和触发动画
- ✅ 满足大部分游戏需求
- ✅ 可序列化

**缺点：**
- ⚠️ 不支持多个触发动画同时存在（但通常不需要）

---

## 方案对比

| 方案 | 实现复杂度 | 灵活性 | 性能 | 可维护性 |
|------|------------|--------|------|----------|
| 方案 1：单一意图 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 方案 2：意图队列 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 方案 3：位掩码 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| 方案 4：简单字段+触发 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 推荐方案

### 🏆 方案 4：简单字段 + 触发标记

**理由：**
1. **简单实用：** 满足大部分游戏需求（持续动画 + 触发动画）
2. **易于理解：** 代码清晰，维护简单
3. **性能好：** 内存占用小，访问快速
4. **符合架构：** 清晰区分 Fixed Systems 的意图和 Render System 的状态

**适用场景：**
- 持续动画：move、idle、run 等
- 触发动画：attack、hurt、die 等
- 这是肉鸽游戏中最常见的场景

**如果未来需要更复杂的意图管理：**
- 可以升级到方案 2（意图队列）
- 或者使用方案 3（位掩码）

---

## 实施指南

### 数据结构定义

```typescript
@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    continuousIntent: string = 'idle';      // 持续动画意图
    triggerIntent: string | null = null;    // 触发动画意图（一次性）
    params: Record<string, any> = {};       // 动画参数
}
```

### 关键方法

1. `setContinuousIntent(intent, params)` - 设置持续意图
2. `trigger(intent, params)` - 触发一次性动画
3. `clearTrigger()` - 清除触发意图（由 AnimationIntentSystem 调用）

### 使用示例

```typescript
// MoveSystem 设置移动意图
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    if (velocity.magnitude > 0) {
        intent.setContinuousIntent('move', { speed: velocity.magnitude });
    } else {
        intent.setContinuousIntent('idle');
    }
}

// CombatSystem 触发攻击动画
const intent = entity.getComponent(AnimationIntentComponent);
if (intent && isAttacking) {
    intent.trigger('attack', { direction: attackDirection });
}

// AnimationIntentSystem 处理意图并更新 AnimState
const intent = entity.getComponent(AnimationIntentComponent);
if (intent) {
    const animState = entity.getComponent(AnimStateComponent);
    if (animState) {
        if (intent.triggerIntent) {
            animState.current = intent.triggerIntent;
            intent.clearTrigger();
        } else {
            animState.current = intent.continuousIntent;
        }
    }
}
```

---

## 验证

实施后需要验证：
- ✅ Fixed Systems 可以设置动画意图
- ✅ AnimationIntentSystem 正确更新 AnimState
- ✅ 触发动画优先级高于持续动画
- ✅ 数据可序列化
- ✅ 符合架构约束（只有 AnimationIntentSystem 修改 AnimState）

---

## 🎨🎨🎨 EXITING CREATIVE PHASE
