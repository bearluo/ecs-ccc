/**
 * 技能系统
 * 
 * 处理技能释放和效果执行
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 * - 技能效果通过修改组件数据实现
 * - 技能动画通过 AnimationIntent 触发
 * 
 * 设计决策：直接执行技能效果，技能释放通过 AnimationIntent 触发
 * 参考文档：memory-bank/creative/creative-skill-system.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { SkillSlotsComponent, SkillSlotData } from '../components/SkillSlots';
import { TransformComponent } from '../components/Transform';
import { AnimationIntentComponent } from '../components/AnimationIntent';
import { HPComponent } from '../components/HP';
import { BuffListComponent } from '../components/BuffList';
import { VelocityComponent } from '../components/Velocity';
import { FactionComponent, FactionType } from '../components/Faction';

@system({ priority: 2 })
export class SkillSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillSlotsComponent, TransformComponent]
        });
        
        query.forEach(entity => {
            const skillSlots = entity.getComponent(SkillSlotsComponent)!;
            const transform = entity.getComponent(TransformComponent)!;
            
            // 检查每个技能槽位
            for (let i = 0; i < skillSlots.slots.length; i++) {
                const slot = skillSlots.getSkill(i);
                if (!slot) continue;
                
                // 检查冷却时间
                if (slot.cooldown > 0) {
                    continue;
                }
                
                // 检查使用次数
                if (slot.maxUses >= 0 && slot.uses >= slot.maxUses) {
                    continue;
                }
                
                // 检查技能释放条件（通过 AnimationIntent 的 triggerIntent 来触发技能）
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
        const skillType = skillConfig.type || 'damage';
        switch (skillType) {
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
        const targets = this.findTargetsInRange(casterTransform, config.range || 100, entity);
        
        for (const target of targets) {
            const hp = target.getComponent(HPComponent);
            if (!hp || hp.isDead) continue;
            
            // 计算伤害（考虑技能等级）
            const damage = (config.damage || 0) * slot.level;
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
            : this.findTargetsInRange(casterTransform, config.range || 100, entity);
        
        for (const target of targets) {
            const buffList = target.getComponent(BuffListComponent);
            if (!buffList) continue;
            
            // 添加 Buff
            const buffId = `${slot.skillId}_${Date.now()}`;
            buffList.addBuff(
                buffId,
                config.buffType || 'buff',
                (config.duration || 5) * slot.level,
                1,
                config.buffParams || {},
                slot.skillId
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
            : this.findTargetsInRange(casterTransform, config.range || 100, entity);
        
        for (const target of targets) {
            const hp = target.getComponent(HPComponent);
            if (!hp || hp.isDead) continue;
            
            // 计算治疗量
            const heal = (config.heal || 0) * slot.level;
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
            const distance = (config.distance || 100) * slot.level;
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
            all: [TransformComponent, FactionComponent]
        });
        
        const casterFaction = excludeEntity.getComponent(FactionComponent);
        const targets: Entity[] = [];
        
        query.forEach(entity => {
            if (entity.id === excludeEntity.id) return;
            
            const targetFaction = entity.getComponent(FactionComponent)!;
            if (casterFaction && !casterFaction.isHostile(targetFaction.faction)) {
                return; // 不是敌对目标（对于伤害技能）
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
