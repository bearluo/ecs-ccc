# 创意阶段：SkillSystem 设计

## 问题描述

需要实现一个技能系统，让实体能够释放技能。技能系统需要：
1. 读取技能槽位（SkillSlots）中的技能
2. 检查技能冷却时间
3. 执行技能效果（伤害、Buff、位移等）
4. 触发技能动画和特效
5. 与现有系统集成（战斗、Buff、动画）

**需求：**
- 实体能够释放技能
- 技能有冷却时间限制
- 技能有使用次数限制
- 技能效果可配置（伤害、范围、Buff 等）
- 技能释放流程清晰

## 约束条件

- 系统必须是 Fixed System（priority: 0-99）
- 不能直接操作 View 层
- 不能直接修改 AnimState
- 技能效果通过修改组件数据实现
- 技能动画通过 AnimationIntent 触发
- 技能特效通过 RenderSyncSystem 生成命令
- 必须遵循架构约束

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: System Design

### 方案 1：直接执行技能效果（简单版）

**设计思路：**
- SkillSystem 直接读取技能配置
- 直接执行技能效果（伤害、Buff 等）
- 直接触发动画意图

**实现：**
```typescript
@system({ priority: 2 })
export class SkillSystem extends System {
    private eventBus?: EventBus;
    
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }
    
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillSlotsComponent, TransformComponent]
        });
        
        query.forEach(entity => {
            const skillSlots = entity.getComponent(SkillSlotsComponent)!;
            const transform = entity.getComponent(TransformComponent)!;
            
            // 检查每个技能槽位
            for (let i = 0; i < skillSlots.slots.length; i++) {
                const slot = skillSlots.getSkillSlot(i);
                if (!slot) continue;
                
                // 检查冷却时间
                if (slot.cooldown > 0) {
                    slot.cooldown -= dt;
                    continue;
                }
                
                // 检查使用次数
                if (slot.maxUses > 0 && slot.uses >= slot.maxUses) {
                    continue;
                }
                
                // 检查技能释放条件（这里简化，实际应该通过事件触发）
                // 假设通过 AnimationIntent 的 triggerIntent 来触发技能
                const animIntent = entity.getComponent(AnimationIntentComponent);
                if (animIntent && animIntent.triggerIntent === `skill_${i}`) {
                    this.executeSkill(entity, slot, transform);
                    animIntent.clearTrigger(); // 清除触发
                }
            }
        });
    }
    
    private executeSkill(entity: Entity, slot: SkillSlotData, casterTransform: TransformComponent): void {
        const skillConfig = slot.config;
        
        // 1. 触发技能动画
        const animIntent = entity.getComponent(AnimationIntentComponent);
        if (animIntent) {
            animIntent.trigger('skill', { skillId: slot.skillId });
        }
        
        // 2. 执行技能效果
        switch (skillConfig.type) {
            case 'damage':
                this.executeDamageSkill(entity, slot, casterTransform, skillConfig);
                break;
            case 'buff':
                this.executeBuffSkill(entity, slot, casterTransform, skillConfig);
                break;
            case 'heal':
                this.executeHealSkill(entity, slot, casterTransform, skillConfig);
                break;
            case 'teleport':
                this.executeTeleportSkill(entity, slot, casterTransform, skillConfig);
                break;
        }
        
        // 3. 更新技能使用次数和冷却时间
        slot.uses++;
        slot.cooldown = slot.maxCooldown;
    }
    
    private executeDamageSkill(
        entity: Entity,
        slot: SkillSlotData,
        casterTransform: TransformComponent,
        config: any
    ): void {
        // 查找范围内的目标
        const targets = this.findTargetsInRange(casterTransform, config.range, entity);
        
        for (const target of targets) {
            const hp = target.getComponent(HPComponent);
            if (!hp || hp.isDead) continue;
            
            // 计算伤害（考虑技能等级）
            const damage = config.damage * slot.level;
            hp.cur = Math.max(0, hp.cur - damage);
            
            // 触发受击动画
            const targetAnimIntent = target.getComponent(AnimationIntentComponent);
            if (targetAnimIntent) {
                targetAnimIntent.trigger('hurt');
            }
        }
    }
    
    private executeBuffSkill(
        entity: Entity,
        slot: SkillSlotData,
        casterTransform: TransformComponent,
        config: any
    ): void {
        // 查找范围内的目标（可以是自己）
        const targets = config.targetSelf 
            ? [entity] 
            : this.findTargetsInRange(casterTransform, config.range, entity);
        
        for (const target of targets) {
            const buffList = target.getComponent(BuffListComponent);
            if (!buffList) continue;
            
            // 添加 Buff
            buffList.addBuff(
                config.buffType,
                config.duration * slot.level,
                config.buffParams || {},
                config.maxStacks || 1
            );
        }
    }
    
    private executeHealSkill(
        entity: Entity,
        slot: SkillSlotData,
        casterTransform: TransformComponent,
        config: any
    ): void {
        // 查找范围内的目标
        const targets = config.targetSelf 
            ? [entity] 
            : this.findTargetsInRange(casterTransform, config.range, entity);
        
        for (const target of targets) {
            const hp = target.getComponent(HPComponent);
            if (!hp || hp.isDead) continue;
            
            // 计算治疗量
            const heal = config.heal * slot.level;
            hp.cur = Math.min(hp.max, hp.cur + heal);
        }
    }
    
    private executeTeleportSkill(
        entity: Entity,
        slot: SkillSlotData,
        casterTransform: TransformComponent,
        config: any
    ): void {
        // 计算目标位置（简化：向前传送）
        const transform = entity.getComponent(TransformComponent)!;
        const velocity = entity.getComponent(VelocityComponent);
        
        if (velocity) {
            // 根据速度方向传送
            const distance = config.distance * slot.level;
            const angle = Math.atan2(velocity.vy, velocity.vx);
            transform.x += Math.cos(angle) * distance;
            transform.y += Math.sin(angle) * distance;
        }
    }
    
    private findTargetsInRange(
        center: TransformComponent,
        range: number,
        excludeEntity: Entity
    ): Entity[] {
        const query = this.world.createQuery({
            all: [TransformComponent, HPComponent]
        });
        
        const targets: Entity[] = [];
        
        query.forEach(entity => {
            if (entity.id === excludeEntity.id) return;
            
            const targetTransform = entity.getComponent(TransformComponent)!;
            const dx = targetTransform.x - center.x;
            const dy = targetTransform.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= range) {
                targets.push(entity);
            }
        });
        
        return targets;
    }
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 技能效果直接执行，易于理解
- ✅ 易于调试

**缺点：**
- ⚠️ 技能效果硬编码在系统中
- ⚠️ 难以扩展新技能类型
- ⚠️ 技能配置和系统耦合

---

### 方案 2：基于技能效果组件（推荐）

**设计思路：**
- 技能效果通过组件表达（如 SkillEffectComponent）
- SkillSystem 只负责触发和执行效果组件
- 效果组件由其他系统处理（如 BuffSystem、CombatSystem）

**实现：**

**1. 技能效果组件：**
```typescript
@component({ name: 'SkillEffect', pooled: true, poolSize: 100 })
export class SkillEffectComponent extends Component {
    /** 技能 ID */
    skillId: string = '';
    
    /** 技能类型 */
    type: string = '';
    
    /** 施法者实体 ID */
    casterId: number = 0;
    
    /** 目标实体 ID（0 表示范围技能，需要查找目标） */
    targetId: number = 0;
    
    /** 技能参数 */
    params: Record<string, any> = {};
    
    /** 剩余持续时间（用于持续技能） */
    duration: number = 0;
    
    reset(): void {
        super.reset();
        this.skillId = '';
        this.type = '';
        this.casterId = 0;
        this.targetId = 0;
        this.params = {};
        this.duration = 0;
    }
}
```

**2. SkillSystem 实现：**
```typescript
@system({ priority: 2 })
export class SkillSystem extends System {
    private eventBus?: EventBus;
    
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }
    
    onUpdate(dt: number): void {
        // 处理技能释放请求（通过事件或组件）
        this.processSkillRequests(dt);
        
        // 处理技能效果组件
        this.processSkillEffects(dt);
    }
    
    private processSkillRequests(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillSlotsComponent, TransformComponent]
        });
        
        query.forEach(entity => {
            const skillSlots = entity.getComponent(SkillSlotsComponent)!;
            
            // 检查每个技能槽位
            for (let i = 0; i < skillSlots.slots.length; i++) {
                const slot = skillSlots.getSkillSlot(i);
                if (!slot) continue;
                
                // 检查冷却时间
                if (slot.cooldown > 0) {
                    slot.cooldown -= dt;
                    continue;
                }
                
                // 检查使用次数
                if (slot.maxUses > 0 && slot.uses >= slot.maxUses) {
                    continue;
                }
                
                // 检查技能释放条件（通过 AnimationIntent 触发）
                const animIntent = entity.getComponent(AnimationIntentComponent);
                if (animIntent && animIntent.triggerIntent === `skill_${i}`) {
                    this.castSkill(entity, slot, i);
                    animIntent.clearTrigger();
                }
            }
        });
    }
    
    private castSkill(entity: Entity, slot: SkillSlotData, slotIndex: number): void {
        const skillConfig = slot.config;
        const transform = entity.getComponent(TransformComponent)!;
        
        // 1. 触发技能动画
        const animIntent = entity.getComponent(AnimationIntentComponent);
        if (animIntent) {
            animIntent.trigger('skill', { skillId: slot.skillId });
        }
        
        // 2. 创建技能效果组件
        if (skillConfig.targetType === 'self') {
            // 对自己释放
            const effect = entity.addComponent(SkillEffectComponent);
            effect.skillId = slot.skillId;
            effect.type = skillConfig.type;
            effect.casterId = entity.id;
            effect.targetId = entity.id;
            effect.params = { ...skillConfig.params, level: slot.level };
            effect.duration = skillConfig.duration || 0;
        } else if (skillConfig.targetType === 'enemy') {
            // 对敌人释放（范围技能）
            const targets = this.findTargetsInRange(transform, skillConfig.range || 100, entity);
            for (const target of targets) {
                const effect = target.addComponent(SkillEffectComponent);
                effect.skillId = slot.skillId;
                effect.type = skillConfig.type;
                effect.casterId = entity.id;
                effect.targetId = target.id;
                effect.params = { ...skillConfig.params, level: slot.level };
                effect.duration = skillConfig.duration || 0;
            }
        } else if (skillConfig.targetType === 'point') {
            // 对点释放（需要从配置中读取目标点）
            // 这里简化处理，实际应该从输入系统获取
        }
        
        // 3. 更新技能使用次数和冷却时间
        slot.uses++;
        slot.cooldown = slot.maxCooldown;
    }
    
    private processSkillEffects(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillEffectComponent]
        });
        
        query.forEach(entity => {
            const effect = entity.getComponent(SkillEffectComponent)!;
            
            // 处理技能效果（由其他系统处理，这里只管理生命周期）
            if (effect.duration > 0) {
                effect.duration -= dt;
                if (effect.duration <= 0) {
                    // 移除效果组件
                    entity.removeComponent(SkillEffectComponent);
                }
            } else {
                // 立即效果，处理完后移除
                entity.removeComponent(SkillEffectComponent);
            }
        });
    }
    
    private findTargetsInRange(
        center: TransformComponent,
        range: number,
        excludeEntity: Entity
    ): Entity[] {
        const query = this.world.createQuery({
            all: [TransformComponent, FactionComponent]
        });
        
        const casterFaction = excludeEntity.getComponent(FactionComponent);
        const targets: Entity[] = [];
        
        query.forEach(entity => {
            if (entity.id === excludeEntity.id) return;
            
            const targetFaction = entity.getComponent(FactionComponent)!;
            if (casterFaction && !casterFaction.isHostileTo(targetFaction.type)) {
                return; // 不是敌对目标
            }
            
            const targetTransform = entity.getComponent(TransformComponent)!;
            const dx = targetTransform.x - center.x;
            const dy = targetTransform.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= range) {
                targets.push(entity);
            }
        });
        
        return targets;
    }
}
```

**3. 其他系统处理技能效果：**
```typescript
// CombatSystem 处理伤害效果
@system({ priority: 1 })
export class CombatSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillEffectComponent, HPComponent]
        });
        
        query.forEach(entity => {
            const effect = entity.getComponent(SkillEffectComponent)!;
            if (effect.type === 'damage') {
                const hp = entity.getComponent(HPComponent)!;
                const damage = effect.params.damage || 0;
                hp.cur = Math.max(0, hp.cur - damage);
            }
        });
    }
}

// BuffSystem 处理 Buff 效果
@system({ priority: 4 })
export class BuffSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillEffectComponent, BuffListComponent]
        });
        
        query.forEach(entity => {
            const effect = entity.getComponent(SkillEffectComponent)!;
            if (effect.type === 'buff') {
                const buffList = entity.getComponent(BuffListComponent)!;
                buffList.addBuff(
                    effect.params.buffType,
                    effect.params.duration,
                    effect.params.buffParams || {},
                    effect.params.maxStacks || 1
                );
            }
        });
    }
}
```

**优点：**
- ✅ 技能效果解耦，易于扩展
- ✅ 符合 ECS 架构（组件 + 系统）
- ✅ 技能效果可以由多个系统处理
- ✅ 易于添加新技能类型

**缺点：**
- ⚠️ 实现稍复杂，需要多个系统协作
- ⚠️ 技能效果处理分散在多个系统中

---

### 方案 3：基于事件驱动的技能系统（复杂版）

**设计思路：**
- 技能释放通过事件触发
- 技能效果通过事件传播
- 完全解耦，易于扩展

**优点：**
- ✅ 最灵活，完全解耦
- ✅ 易于扩展和组合

**缺点：**
- ⚠️ 实现复杂，需要事件系统支持
- ⚠️ 调试困难
- ⚠️ 对于阶段 2 可能过度设计

---

## 推荐方案

**选择方案 2：基于技能效果组件**

**理由：**
1. **符合 ECS 架构：** 使用组件表达技能效果，符合 ECS 设计原则
2. **易于扩展：** 新技能类型只需添加新的效果处理逻辑
3. **解耦清晰：** 技能释放和效果处理分离
4. **符合阶段 2 目标：** 核心系统完善，不需要过度设计

**实施步骤：**
1. 创建 `SkillEffectComponent` 组件（可选，如果使用方案 2）
2. 实现 `SkillSystem` 系统
3. 支持基本技能类型：damage、buff、heal、teleport
4. 与现有系统集成（CombatSystem、BuffSystem、AnimationIntentSystem）

**注意：**
- 如果选择方案 1，不需要创建 SkillEffectComponent
- 如果选择方案 2，需要修改 CombatSystem 和 BuffSystem 来处理技能效果

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 设计决策总结

1. **技能释放触发：** 通过 AnimationIntent 的 triggerIntent 触发（如 `skill_0` 表示释放第 0 个技能槽）
2. **技能效果执行：** 方案 1 直接执行，方案 2 通过 SkillEffectComponent 组件表达
3. **技能冷却管理：** 在 SkillSlotsComponent 中管理，SkillSystem 更新冷却时间
4. **技能目标查找：** 通过查询系统查找范围内的目标实体
5. **架构约束：** 完全遵循架构约束，不直接操作 View 层，通过 AnimationIntent 触发动画

## 实施指南

1. **实现 SkillSystem：** `assets/scripts/gameplay/systems/SkillSystem.ts`
2. **注册系统：** 在 GameApp 中注册 SkillSystem（Fixed System，priority: 2）
3. **设置 EventBus：** 在 GameApp 中调用 `skillSystem.setEventBus(eventBus)`（如果需要）
4. **测试：** 创建技能实体，验证技能释放和效果

## 相关组件依赖

- `SkillSlotsComponent` - 技能槽位
- `TransformComponent` - 位置信息
- `AnimationIntentComponent` - 动画意图（触发技能）
- `FactionComponent` - 阵营信息（查找目标）
- `HPComponent` - 生命值（伤害技能）
- `BuffListComponent` - Buff 列表（Buff 技能）

## 技能配置示例

```typescript
// 技能配置（从 ConfigLoader 加载）
const skillConfig = {
    id: 'fireball',
    type: 'damage',
    targetType: 'enemy', // 'self' | 'enemy' | 'point'
    range: 150,
    damage: 50,
    cooldown: 2.0,
    maxUses: -1, // -1 表示无限制
    params: {
        // 其他参数
    }
};
```
