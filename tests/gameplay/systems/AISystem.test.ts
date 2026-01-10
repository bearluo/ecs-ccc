/// <reference types="jest" />
/**
 * AISystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { AISystem } from 'db://assets/scripts/gameplay/systems/AISystem';
import { AIComponent } from 'db://assets/scripts/gameplay/components/AI';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';
import { FactionComponent, FactionType } from 'db://assets/scripts/gameplay/components/Faction';
import { AnimationIntentComponent } from 'db://assets/scripts/gameplay/components/AnimationIntent';

describe('AISystem', () => {
    let world: World;
    let aiSystem: AISystem;

    beforeEach(() => {
        world = new World({ debug: false });
        aiSystem = world.registerSystem(AISystem);
    });

    describe('onUpdate', () => {
        it('idle 状态应该停止移动', () => {
            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            ai.state = 'idle';
            velocity.vx = 10;
            velocity.vy = 5;

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(velocity.vx).toBe(0);
            expect(velocity.vy).toBe(0);
            expect(animIntent.continuousIntent).toBe('idle');
        });

        it('idle 状态应该切换到 patrol', () => {
            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            ai.state = 'idle';
            ai.stateTimer = 0; // 空闲时间到

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(ai.state).toBe('patrol');
        });

        it('patrol 状态应该向目标点移动', () => {
            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            transform.x = 0;
            transform.y = 0;
            ai.state = 'patrol';
            ai.stateParams.patrolTarget = { x: 100, y: 0 };

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(velocity.vx).toBeGreaterThan(0);
            expect(velocity.vy).toBe(0);
            expect(animIntent.continuousIntent).toBe('move');
        });

        it('chase 状态应该向目标移动', () => {
            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 100;
            targetTransform.y = 0;
            targetFaction.faction = FactionType.Player;

            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const faction = entity.addComponent(FactionComponent);

            transform.x = 0;
            transform.y = 0;
            ai.state = 'chase';
            ai.targetHandle = target.handle || null;
            ai.attackRange = 50;
            faction.faction = FactionType.Enemy;

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            // 目标在攻击范围外，应该移动
            expect(velocity.vx).toBeGreaterThan(0);
            expect(animIntent.continuousIntent).toBe('move');
        });

        it('chase 状态在目标进入攻击范围时应该切换到 attack', () => {
            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 30; // 在攻击范围内（attackRange = 50）
            targetTransform.y = 0;
            targetFaction.faction = FactionType.Player;

            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const faction = entity.addComponent(FactionComponent);

            transform.x = 0;
            transform.y = 0;
            ai.state = 'chase';
            ai.targetHandle = target.handle || null;
            ai.attackRange = 50;
            faction.faction = FactionType.Enemy;

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(ai.state).toBe('attack');
        });

        it('attack 状态应该触发攻击动画', () => {
            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 30;
            targetTransform.y = 0;
            targetFaction.faction = FactionType.Player;

            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const faction = entity.addComponent(FactionComponent);

            transform.x = 0;
            transform.y = 0;
            ai.state = 'attack';
            ai.targetHandle = target.handle || null;
            ai.stateTimer = 1.0;
            faction.faction = FactionType.Enemy;

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(velocity.vx).toBe(0);
            expect(velocity.vy).toBe(0);
            expect(animIntent.triggerIntent).toBe('attack');
        });

        it('应该更新状态计时器', () => {
            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);

            ai.state = 'idle';
            ai.stateTimer = 5.0;

            const dt = 1.0;
            aiSystem.onUpdate!(dt);

            expect(ai.stateTimer).toBeCloseTo(4.0, 5);
        });

        it('应该查找目标', () => {
            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 50; // 在感知范围内（perceptionRange = 200）
            targetTransform.y = 0;
            targetFaction.faction = FactionType.Player;

            const entity = world.createEntity('TestEntity');
            const ai = entity.addComponent(AIComponent);
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);
            const faction = entity.addComponent(FactionComponent);

            transform.x = 0;
            transform.y = 0;
            ai.targetHandle = null;
            ai.perceptionRange = 200;
            faction.faction = FactionType.Enemy;

            const dt = 0.016;
            aiSystem.onUpdate!(dt);

            expect(ai.targetHandle).not.toBeNull();
            if (ai.targetHandle) {
                expect(ai.targetHandle.id).toBe(target.id);
            }
        });
    });
});
