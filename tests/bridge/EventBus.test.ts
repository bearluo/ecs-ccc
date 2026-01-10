/// <reference types="jest" />
/**
 * EventBus 单元测试
 */

import { EventBus, GameplayEvent } from 'db://assets/scripts/bridge/EventBus';
import { World } from '@bl-framework/ecs';

describe('EventBus', () => {
    let eventBus: EventBus;
    let world: World;

    beforeEach(() => {
        eventBus = new EventBus();
        world = new World({ debug: false });
    });

    describe('push', () => {
        it('应该能够添加事件', () => {
            const entity = world.createEntity('TestEntity');
            const event: GameplayEvent = {
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'attack' }
            };

            eventBus.push(event);

            expect(eventBus.getEventCount()).toBe(1);
        });

        it('应该能够添加多个事件', () => {
            const entity = world.createEntity('TestEntity');
            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.push({ type: 'CollisionEvent', entityA: 1, entityB: 2 });
            eventBus.push({ type: 'UIEvent', eventName: 'pause' });

            expect(eventBus.getEventCount()).toBe(3);
        });
    });

    describe('subscribe', () => {
        it('应该能够订阅事件', () => {
            const entity = world.createEntity('TestEntity');
            const handler = jest.fn();
            eventBus.subscribe('AnimationEvent', handler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.flush();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'attack' }
            });
        });

        it('应该能够订阅多个处理器', () => {
            const entity = world.createEntity('TestEntity');
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            eventBus.subscribe('AnimationEvent', handler1);
            eventBus.subscribe('AnimationEvent', handler2);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.flush();

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('应该支持通用订阅（*）', () => {
            const entity = world.createEntity('TestEntity');
            const handler = jest.fn();

            eventBus.subscribe('*', handler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.push({ type: 'CollisionEvent', entityA: 1, entityB: 2 });
            eventBus.flush();

            expect(handler).toHaveBeenCalledTimes(2);
        });
    });

    describe('unsubscribe', () => {
        it('应该能够取消订阅', () => {
            const entity = world.createEntity('TestEntity');
            const handler = jest.fn();

            eventBus.subscribe('AnimationEvent', handler);
            eventBus.unsubscribe('AnimationEvent', handler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.flush();

            expect(handler).not.toHaveBeenCalled();
        });

        it('应该只取消指定的处理器', () => {
            const entity = world.createEntity('TestEntity');
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            eventBus.subscribe('AnimationEvent', handler1);
            eventBus.subscribe('AnimationEvent', handler2);
            eventBus.unsubscribe('AnimationEvent', handler1);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.flush();

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe('flush', () => {
        it('应该处理所有事件并清空队列', () => {
            const entity1 = world.createEntity('Entity1');
            const entity2 = world.createEntity('Entity2');
            const handler = jest.fn();

            eventBus.subscribe('AnimationEvent', handler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity1.handle, data: { animName: 'attack' } });
            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity2.handle, data: { animName: 'attack' } });

            eventBus.flush();

            expect(handler).toHaveBeenCalledTimes(2);
            expect(eventBus.getEventCount()).toBe(0);
        });

        it('应该只分发匹配类型的事件', () => {
            const entity = world.createEntity('TestEntity');
            const animationHandler = jest.fn();
            const collisionHandler = jest.fn();

            eventBus.subscribe('AnimationEvent', animationHandler);
            eventBus.subscribe('CollisionEvent', collisionHandler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.push({ type: 'CollisionEvent', entityA: 1, entityB: 2 });
            eventBus.flush();

            expect(animationHandler).toHaveBeenCalledTimes(1);
            expect(collisionHandler).toHaveBeenCalledTimes(1);
        });

        it('应该同时分发到特定类型和通用订阅者', () => {
            const entity = world.createEntity('TestEntity');
            const specificHandler = jest.fn();
            const generalHandler = jest.fn();

            eventBus.subscribe('AnimationEvent', specificHandler);
            eventBus.subscribe('*', generalHandler);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.flush();

            expect(specificHandler).toHaveBeenCalledTimes(1);
            expect(generalHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('clear', () => {
        it('应该清空所有事件', () => {
            const entity = world.createEntity('TestEntity');
            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.push({ type: 'CollisionEvent', entityA: 1, entityB: 2 });

            eventBus.clear();

            expect(eventBus.getEventCount()).toBe(0);
        });

        it('清空后 flush 不应该处理任何事件', () => {
            const entity = world.createEntity('TestEntity');
            const handler = jest.fn();

            eventBus.subscribe('AnimationEvent', handler);
            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            eventBus.clear();
            eventBus.flush();

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('getEventCount', () => {
        it('应该返回正确的事件数量', () => {
            const entity = world.createEntity('TestEntity');
            expect(eventBus.getEventCount()).toBe(0);

            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'attack' } });
            expect(eventBus.getEventCount()).toBe(1);

            eventBus.push({ type: 'CollisionEvent', entityA: 1, entityB: 2 });
            expect(eventBus.getEventCount()).toBe(2);
        });
    });
});
