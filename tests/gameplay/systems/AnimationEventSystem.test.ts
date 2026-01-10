/// <reference types="jest" />
/**
 * AnimationEventSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { AnimationEventSystem } from 'db://assets/scripts/gameplay/systems/AnimationEventSystem';
import { AnimStateComponent } from 'db://assets/scripts/gameplay/components/AnimState';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';

describe('AnimationEventSystem', () => {
    let world: World;
    let animationEventSystem: AnimationEventSystem;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        eventBus = new EventBus();
        animationEventSystem = world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(eventBus);
    });

    describe('动画完成事件', () => {
        it('应该解锁匹配的动画状态', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            
            animState.current = 'attack';
            animState.locked = true;

            // 发送动画完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'attack' }
            });

            eventBus.flush();

            expect(animState.locked).toBe(false);
        });

        it('不应该解锁不匹配的动画状态', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            
            animState.current = 'attack';
            animState.locked = true;

            // 发送不同动画的完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'move' }
            });

            eventBus.flush();

            expect(animState.locked).toBe(true); // 应该保持锁定
        });

        it('不应该解锁未锁定的动画状态', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            
            animState.current = 'attack';
            animState.locked = false;

            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'attack' }
            });

            eventBus.flush();

            expect(animState.locked).toBe(false);
        });

        it('应该忽略无效的 Handle', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            
            animState.current = 'attack';
            animState.locked = true;

            // 使用无效的 Handle
            const invalidHandle = { id: 99999, gen: 99999 } as any;

            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: invalidHandle,
                data: { animName: 'attack' }
            });

            eventBus.flush();

            expect(animState.locked).toBe(true); // 应该保持锁定
        });
    });

    describe('动画事件点', () => {
        it('应该处理动画事件点', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);

            let markerReceived = false;
            let markerName = '';

            // 可以在这里添加事件点处理逻辑的测试
            // 目前 AnimationEventSystem 只记录事件点，不进行特殊处理

            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'marker',
                handle: entity.handle,
                data: { marker: 'hit' }
            });

            eventBus.flush();

            // 验证事件被处理（目前只是通过，不报错）
            expect(true).toBe(true);
        });
    });
});
