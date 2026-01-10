# 创意阶段：AISystem 设计

## 问题描述

需要实现一个 AI 系统，让非玩家实体（敌人、NPC）能够自主行为。AI 系统需要：
1. 支持多种 AI 行为模式（巡逻、追击、攻击、逃跑等）
2. 能够感知环境（检测玩家、检测障碍物）
3. 能够做出决策（选择行为、选择目标）
4. 与现有系统集成（移动、战斗、技能）

**需求：**
- AI 实体能够根据状态选择行为
- AI 能够感知玩家位置
- AI 能够执行移动、攻击等行为
- 支持简单的状态机或行为树

## 约束条件

- 系统必须是 Fixed System（priority: 0-99）
- 不能直接操作 View 层
- 不能直接修改 AnimState
- 只能通过修改组件数据来影响行为
- 必须遵循架构约束

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：基于状态机的简单 AI（推荐）

**设计思路：**
- 使用状态机管理 AI 行为状态
- AI 组件存储当前状态和目标
- AISystem 根据状态执行相应行为

**实现：**

**1. AI 组件（AIComponent）：**
```typescript
@component({ name: 'AI', pooled: true, poolSize: 50 })
export class AIComponent extends Component {
    /** AI 类型（如 'patrol', 'chase', 'attack'） */
    type: string = 'patrol';
    
    /** 当前状态 */
    state: string = 'idle';
    
    /** 目标实体 ID（0 表示无目标） */
    targetEntityId: number = 0;
    
    /** 感知范围 */
    perceptionRange: number = 200;
    
    /** 攻击范围 */
    attackRange: number = 50;
    
    /** 状态持续时间（秒） */
    stateTimer: number = 0;
    
    /** 状态参数 */
    stateParams: Record<string, any> = {};
    
    reset(): void {
        super.reset();
        this.type = 'patrol';
        this.state = 'idle';
        this.targetEntityId = 0;
        this.perceptionRange = 200;
        this.attackRange = 50;
        this.stateTimer = 0;
        this.stateParams = {};
    }
}
```

**2. AISystem 实现：**
```typescript
@system({ priority: 3 })
export class AISystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [AIComponent, TransformComponent, VelocityComponent]
        });
        
        query.forEach(entity => {
            const ai = entity.getComponent(AIComponent)!;
            const transform = entity.getComponent(TransformComponent)!;
            const velocity = entity.getComponent(VelocityComponent)!;
            
            // 更新状态计时器
            ai.stateTimer -= dt;
            
            // 感知阶段：检测玩家
            if (ai.targetEntityId === 0) {
                ai.targetEntityId = this.findTarget(entity, ai.perceptionRange);
            }
            
            // 决策阶段：根据状态执行行为
            switch (ai.state) {
                case 'idle':
                    this.handleIdle(entity, ai, transform, velocity, dt);
                    break;
                case 'patrol':
                    this.handlePatrol(entity, ai, transform, velocity, dt);
                    break;
                case 'chase':
                    this.handleChase(entity, ai, transform, velocity, dt);
                    break;
                case 'attack':
                    this.handleAttack(entity, ai, transform, velocity, dt);
                    break;
                case 'flee':
                    this.handleFlee(entity, ai, transform, velocity, dt);
                    break;
            }
        });
    }
    
    private findTarget(entity: Entity, range: number): number {
        // 查询玩家实体
        const playerQuery = this.world.createQuery({
            all: [FactionComponent, TransformComponent]
        });
        
        const selfTransform = entity.getComponent(TransformComponent)!;
        const selfFaction = entity.getComponent(FactionComponent);
        
        let nearestTargetId = 0;
        let nearestDistance = range;
        
        playerQuery.forEach(target => {
            const targetFaction = target.getComponent(FactionComponent)!;
            const targetTransform = target.getComponent(TransformComponent)!;
            
            // 检查是否为敌对阵营
            if (selfFaction && selfFaction.isHostileTo(targetFaction.type)) {
                const dx = targetTransform.x - selfTransform.x;
                const dy = targetTransform.y - selfTransform.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestTargetId = target.id;
                }
            }
        });
        
        return nearestTargetId;
    }
    
    private handleIdle(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 空闲状态：停止移动
        velocity.vx = 0;
        velocity.vy = 0;
        
        // 如果有目标，切换到追击状态
        if (ai.targetEntityId > 0) {
            ai.state = 'chase';
            ai.stateTimer = 10; // 追击 10 秒
        } else if (ai.stateTimer <= 0) {
            // 空闲时间到，切换到巡逻
            ai.state = 'patrol';
            ai.stateTimer = 5; // 巡逻 5 秒
        }
    }
    
    private handlePatrol(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 巡逻状态：随机移动
        if (!ai.stateParams.patrolTarget) {
            // 设置巡逻目标点
            ai.stateParams.patrolTarget = {
                x: transform.x + (Math.random() - 0.5) * 200,
                y: transform.y + (Math.random() - 0.5) * 200
            };
        }
        
        const target = ai.stateParams.patrolTarget;
        const dx = target.x - transform.x;
        const dy = target.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
            // 到达目标点，切换到空闲
            ai.state = 'idle';
            ai.stateTimer = 2;
            ai.stateParams.patrolTarget = null;
        } else {
            // 向目标点移动
            const speed = 30;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
        }
        
        // 如果有目标，切换到追击状态
        if (ai.targetEntityId > 0) {
            ai.state = 'chase';
            ai.stateTimer = 10;
        }
    }
    
    private handleChase(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 追击状态：向目标移动
        const target = this.world.getEntityById(ai.targetEntityId);
        if (!target) {
            ai.targetEntityId = 0;
            ai.state = 'idle';
            return;
        }
        
        const targetTransform = target.getComponent(TransformComponent)!;
        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < ai.attackRange) {
            // 进入攻击范围，切换到攻击状态
            ai.state = 'attack';
            ai.stateTimer = 1; // 攻击 1 秒
        } else if (distance > ai.perceptionRange * 1.5) {
            // 目标太远，失去目标
            ai.targetEntityId = 0;
            ai.state = 'idle';
        } else {
            // 向目标移动
            const speed = 50;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
        }
    }
    
    private handleAttack(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 攻击状态：停止移动，触发攻击动画
        velocity.vx = 0;
        velocity.vy = 0;
        
        // 设置攻击动画意图
        const animIntent = entity.getComponent(AnimationIntentComponent);
        if (animIntent) {
            animIntent.trigger('attack');
        }
        
        // 攻击状态结束后，切换到追击或空闲
        if (ai.stateTimer <= 0) {
            if (ai.targetEntityId > 0) {
                ai.state = 'chase';
                ai.stateTimer = 10;
            } else {
                ai.state = 'idle';
                ai.stateTimer = 2;
            }
        }
    }
    
    private handleFlee(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 逃跑状态：远离目标移动
        const target = this.world.getEntityById(ai.targetEntityId);
        if (!target) {
            ai.targetEntityId = 0;
            ai.state = 'idle';
            return;
        }
        
        const targetTransform = target.getComponent(TransformComponent)!;
        const dx = transform.x - targetTransform.x;
        const dy = transform.y - targetTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > ai.perceptionRange * 2) {
            // 足够远，切换到空闲
            ai.targetEntityId = 0;
            ai.state = 'idle';
        } else {
            // 远离目标
            const speed = 60;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
        }
    }
}
```

**优点：**
- ✅ 实现简单，易于理解
- ✅ 性能好，状态转换清晰
- ✅ 易于扩展新状态
- ✅ 符合 ECS 架构（纯数据组件 + 系统逻辑）

**缺点：**
- ⚠️ 复杂 AI 行为需要多个状态
- ⚠️ 状态转换逻辑可能变得复杂

---

### 方案 2：基于行为树的 AI（复杂版）

**设计思路：**
- 使用行为树管理 AI 决策
- AI 组件存储行为树配置
- AISystem 执行行为树节点

**实现：**
```typescript
// 行为树节点类型
enum BTNodeType {
    Selector,  // 选择节点（OR）
    Sequence,  // 序列节点（AND）
    Action,    // 行为节点
    Condition  // 条件节点
}

interface BTNode {
    type: BTNodeType;
    name: string;
    children?: BTNode[];
    action?: (entity: Entity, ai: AIComponent) => boolean;
    condition?: (entity: Entity, ai: AIComponent) => boolean;
}

@component({ name: 'AI', pooled: true, poolSize: 50 })
export class AIComponent extends Component {
    /** 行为树根节点 */
    behaviorTree: BTNode;
    
    /** 当前执行的节点路径 */
    currentNodePath: number[] = [];
    
    // ... 其他字段同方案 1
}
```

**优点：**
- ✅ 支持复杂的 AI 决策逻辑
- ✅ 行为树可配置，易于调整
- ✅ 支持行为复用

**缺点：**
- ⚠️ 实现复杂，需要行为树执行引擎
- ⚠️ 性能开销较大
- ⚠️ 对于简单 AI 可能过度设计

---

### 方案 3：基于脚本的 AI（灵活版）

**设计思路：**
- AI 组件存储脚本 ID
- AISystem 加载并执行脚本
- 脚本定义 AI 行为逻辑

**优点：**
- ✅ 最灵活，支持运行时修改
- ✅ 易于配置和调整

**缺点：**
- ⚠️ 需要脚本引擎
- ⚠️ 性能开销大
- ⚠️ 调试困难

---

## 推荐方案

**选择方案 1：基于状态机的简单 AI**

**理由：**
1. **符合阶段 2 目标：** 阶段 2 是核心系统完善，不需要过度设计
2. **性能好：** 状态机执行效率高，适合大量 AI 实体
3. **易于实现：** 代码清晰，易于维护
4. **易于扩展：** 可以逐步添加新状态，不需要重构
5. **符合架构：** 纯数据组件 + 系统逻辑，完全符合 ECS 架构

**实施步骤：**
1. 创建 `AIComponent` 组件
2. 实现 `AISystem` 系统
3. 支持基本状态：idle、patrol、chase、attack、flee
4. 与现有系统集成（MoveSystem、CombatSystem）

**未来扩展：**
- 如果需要更复杂的 AI，可以在阶段 3 或阶段 4 引入行为树
- 可以添加 AI 配置系统，通过配置文件定义 AI 行为

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 设计决策总结

1. **AI 组件设计：** 使用状态机模式，存储当前状态、目标、感知范围等数据
2. **AI 系统设计：** 实现状态机逻辑，支持 idle、patrol、chase、attack、flee 等状态
3. **感知机制：** 通过查询系统检测范围内的敌对实体
4. **行为执行：** 通过修改 Velocity、AnimationIntent 等组件来影响行为
5. **架构约束：** 完全遵循架构约束，不直接操作 View 层

## 实施指南

1. **创建 AIComponent：** `assets/scripts/gameplay/components/AI.ts`
2. **实现 AISystem：** `assets/scripts/gameplay/systems/AISystem.ts`
3. **注册系统：** 在 GameApp 中注册 AISystem（Fixed System，priority: 3）
4. **测试：** 创建 AI 实体，验证行为状态转换

## 相关组件依赖

- `TransformComponent` - 位置信息
- `VelocityComponent` - 移动速度
- `FactionComponent` - 阵营信息
- `AnimationIntentComponent` - 动画意图（可选）
- `HPComponent` - 生命值（可选，用于判断是否逃跑）
