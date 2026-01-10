/**
 * AI 系统
 * 
 * 管理 AI 实体的行为状态和决策
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 * 
 * 设计决策：使用状态机模式，支持 idle、patrol、chase、attack、flee 等状态
 * 参考文档：memory-bank/creative/creative-ai-system.md
 */

import { System, system, Entity, Handle } from '@bl-framework/ecs';
import { AIComponent } from '../components/AI';
import { TransformComponent } from '../components/Transform';
import { VelocityComponent } from '../components/Velocity';
import { FactionComponent, FactionType } from '../components/Faction';
import { AnimationIntentComponent } from '../components/AnimationIntent';
import { HPComponent } from '../components/HP';

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
            if (!ai.targetHandle || !this.world.isValidHandle(ai.targetHandle)) {
                ai.targetHandle = this.findTarget(entity, ai.perceptionRange);
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
    
    private findTarget(entity: Entity, range: number): Handle | null {
        // 查询所有有阵营和位置的实体
        const targetQuery = this.world.createQuery({
            all: [FactionComponent, TransformComponent]
        });
        
        const selfTransform = entity.getComponent(TransformComponent)!;
        const selfFaction = entity.getComponent(FactionComponent);
        
        if (!selfFaction) return null;
        
        let nearestTarget: Entity | null = null;
        let nearestDistance = range;
        
        targetQuery.forEach(target => {
            const targetFaction = target.getComponent(FactionComponent)!;
            const targetTransform = target.getComponent(TransformComponent)!;
            
            // 检查是否为敌对阵营
            if (selfFaction.isHostile(targetFaction.faction)) {
                const dx = targetTransform.x - selfTransform.x;
                const dy = targetTransform.y - selfTransform.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestTarget = target;
                }
            }
        });
        
        // 返回目标的 Handle
        return nearestTarget?.handle || null;
    }
    
    private handleIdle(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 空闲状态：停止移动
        velocity.vx = 0;
        velocity.vy = 0;
        
        // 设置空闲动画
        const animIntent = entity.getComponent(AnimationIntentComponent);
        if (animIntent) {
            animIntent.setContinuousIntent('idle');
        }
        
        // 如果有目标，切换到追击状态
        if (ai.targetHandle && this.world.isValidHandle(ai.targetHandle)) {
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
            
            // 设置移动动画
            const animIntent = entity.getComponent(AnimationIntentComponent);
            if (animIntent) {
                animIntent.setContinuousIntent('move');
            }
        }
        
        // 如果有目标，切换到追击状态
        if (ai.targetHandle && this.world.isValidHandle(ai.targetHandle)) {
            ai.state = 'chase';
            ai.stateTimer = 10;
        }
    }
    
    private handleChase(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 追击状态：向目标移动
        // 验证 Handle 有效性（在同步代码中，如果 isValidHandle 返回 true，getEntityByHandle 不会返回 null）
        if (!ai.targetHandle || !this.world.isValidHandle(ai.targetHandle)) {
            ai.targetHandle = null;
            ai.state = 'idle';
            return;
        }
        
        // 通过 Handle 获取实体（已验证有效性，不会为 null）
        const target = this.world.getEntityByHandle(ai.targetHandle)!;
        
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
            ai.targetHandle = null;
            ai.state = 'idle';
        } else {
            // 向目标移动
            const speed = 50;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
            
            // 设置移动动画
            const animIntent = entity.getComponent(AnimationIntentComponent);
            if (animIntent) {
                animIntent.setContinuousIntent('move');
            }
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
            if (ai.targetHandle && this.world.isValidHandle(ai.targetHandle)) {
                ai.state = 'chase';
                ai.stateTimer = 10;
            } else {
                ai.targetHandle = null;
                ai.state = 'idle';
                ai.stateTimer = 2;
            }
        }
    }
    
    private handleFlee(entity: Entity, ai: AIComponent, transform: TransformComponent, velocity: VelocityComponent, dt: number): void {
        // 逃跑状态：远离目标移动
        // 验证 Handle 有效性（在同步代码中，如果 isValidHandle 返回 true，getEntityByHandle 不会返回 null）
        if (!ai.targetHandle || !this.world.isValidHandle(ai.targetHandle)) {
            ai.targetHandle = null;
            ai.state = 'idle';
            return;
        }
        
        // 通过 Handle 获取实体（已验证有效性，不会为 null）
        const target = this.world.getEntityByHandle(ai.targetHandle)!;
        
        const targetTransform = target.getComponent(TransformComponent)!;
        const dx = transform.x - targetTransform.x;
        const dy = transform.y - targetTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > ai.perceptionRange * 2) {
            // 足够远，切换到空闲
            ai.targetHandle = null;
            ai.state = 'idle';
        } else {
            // 远离目标
            const speed = 60;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
            
            // 设置移动动画
            const animIntent = entity.getComponent(AnimationIntentComponent);
            if (animIntent) {
                animIntent.setContinuousIntent('move');
            }
        }
    }

}
