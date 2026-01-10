/// <reference types="jest" />
/**
 * InputSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { InputSystem } from 'db://assets/scripts/gameplay/systems/InputSystem';
import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';
import { AnimationIntentComponent } from 'db://assets/scripts/gameplay/components/AnimationIntent';
import { SkillSlotsComponent } from 'db://assets/scripts/gameplay/components/SkillSlots';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';

describe('InputSystem', () => {
    let world: World;
    let inputSystem: InputSystem;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        inputSystem = world.registerSystem(InputSystem);
        eventBus = new EventBus();
        inputSystem.setEventBus(eventBus);
    });

    describe('setMoveInput', () => {
        it('应该设置移动输入', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            inputSystem.setMoveInput(1, 0); // 向右移动
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            expect(velocity.vx).toBe(100); // 基础速度 100
            expect(velocity.vy).toBe(0);
        });

        it('应该更新动画意图为 move', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            inputSystem.setMoveInput(1, 0);
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            expect(animIntent.continuousIntent).toBe('move');
        });

        it('没有输入时应该设置为 idle', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);

            inputSystem.setMoveInput(0, 0);
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            expect(velocity.vx).toBe(0);
            expect(velocity.vy).toBe(0);
            expect(animIntent.continuousIntent).toBe('idle');
        });
    });

    describe('triggerSkill', () => {
        it('应该触发技能动画意图', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const skillSlots = entity.addComponent(SkillSlotsComponent);

            inputSystem.triggerSkill(0);
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            expect(animIntent.triggerIntent).toBe('skill_0');
        });

        it('触发技能后应该设置技能动画意图', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const skillSlots = entity.addComponent(SkillSlotsComponent);

            inputSystem.triggerSkill(0);
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            // 应该设置技能触发意图
            expect(animIntent.triggerIntent).toBe('skill_0');
        });
    });

    describe('onUpdate', () => {
        it('EventBus 未设置时应该警告', () => {
            const newWorld = new World({ debug: false });
            const systemWithoutEventBus = newWorld.registerSystem(InputSystem);
            // 不设置 EventBus

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const dt = 0.016;
            systemWithoutEventBus.onUpdate!(dt);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('应该只处理有 Velocity 和 AnimationIntent 的实体', () => {
            const entity1 = world.createEntity('Entity1');
            entity1.addComponent(VelocityComponent);
            entity1.addComponent(AnimationIntentComponent);

            const entity2 = world.createEntity('Entity2');
            entity2.addComponent(VelocityComponent);
            // 没有 AnimationIntent

            inputSystem.setMoveInput(1, 0);
            const dt = 0.016;
            inputSystem.onUpdate!(dt);

            const velocity1 = entity1.getComponent(VelocityComponent)!;
            expect(velocity1.vx).toBe(100);
        });
    });
});
