/// <reference types="jest" />
/**
 * Scheduler 单元测试
 */

import { World, System } from '@bl-framework/ecs';
import { Scheduler } from 'db://assets/scripts/bridge/Scheduler';
import { CommandBuffer } from 'db://assets/scripts/bridge/CommandBuffer';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';

// Mock 系统
class TestFixedSystem extends System {
    priority = 0;
    updateCount = 0;
    onUpdate(dt: number): void {
        this.updateCount++;
    }
}

class TestRenderSystem extends System {
    priority = 100;
    updateCount = 0;
    onUpdate(dt: number): void {
        this.updateCount++;
    }
}

describe('Scheduler', () => {
    let world: World;
    let commandBuffer: CommandBuffer;
    let eventBus: EventBus;
    let scheduler: Scheduler;

    beforeEach(() => {
        world = new World({ debug: false });
        commandBuffer = new CommandBuffer();
        eventBus = new EventBus();
        scheduler = new Scheduler(world, commandBuffer, eventBus, {
            fixedDeltaTime: 1 / 60, // 60 FPS
            maxAccumulator: 0.25
        });
    });

    describe('构造函数', () => {
        it('应该使用默认配置', () => {
            const defaultScheduler = new Scheduler(world, commandBuffer, eventBus);

            expect(defaultScheduler.getAccumulator()).toBe(0);
        });

        it('应该使用自定义配置', () => {
            const customScheduler = new Scheduler(world, commandBuffer, eventBus, {
                fixedDeltaTime: 1 / 30, // 30 FPS
                maxAccumulator: 0.5
            });

            // 通过 stepFixed 验证配置
            customScheduler.stepFixed(0.5);
            expect(customScheduler.getAccumulator()).toBeLessThanOrEqual(0.5);
        });
    });

    describe('stepFixed', () => {
        it('应该累积时间', () => {
            scheduler.stepFixed(0.016);

            expect(scheduler.getAccumulator()).toBeGreaterThan(0);
        });

        it('应该执行固定步长更新', () => {
            const fixedSystem = world.registerSystem(TestFixedSystem);
            scheduler.registerFixedSystem(TestFixedSystem);

            scheduler.stepFixed(1 / 60); // 使用 fixedDeltaTime 的值

            expect(fixedSystem.updateCount).toBeGreaterThan(0);
        });

        it('应该处理事件', () => {
            const handler = jest.fn();
            eventBus.subscribe('AnimationEvent', handler);

            const entity = world.createEntity('TestEntity');
            eventBus.push({ type: 'AnimationEvent', eventName: 'finished', handle: entity.handle, data: { animName: 'test' } });
            scheduler.stepFixed(1 / 60); // 需要执行固定步长才能处理事件

            expect(handler).toHaveBeenCalled();
        });

        it('应该限制最大累积时间', () => {
            scheduler.stepFixed(1.0); // 1 秒，超过 maxAccumulator (0.25)

            expect(scheduler.getAccumulator()).toBeLessThanOrEqual(0.25);
        });

        it('应该执行多次固定步长更新', () => {
            const fixedSystem = world.registerSystem(TestFixedSystem);
            scheduler.registerFixedSystem(TestFixedSystem);

            // 累积足够的时间执行多次更新
            scheduler.stepFixed(0.1); // 应该执行多次

            expect(fixedSystem.updateCount).toBeGreaterThan(1);
        });
    });

    describe('stepRender', () => {
        it('应该执行 Render Systems', () => {
            const renderSystem = world.registerSystem(TestRenderSystem);
            scheduler.registerRenderSystem(TestRenderSystem);

            scheduler.stepRender(0.016);

            expect(renderSystem.updateCount).toBe(1);
        });

        it('不应该执行 Fixed Systems', () => {
            const fixedSystem = world.registerSystem(TestFixedSystem);
            scheduler.registerFixedSystem(TestFixedSystem);

            scheduler.stepRender(0.016);

            expect(fixedSystem.updateCount).toBe(0);
        });
    });

    describe('registerFixedSystem', () => {
        it('应该注册 Fixed System', () => {
            world.registerSystem(TestFixedSystem);
            scheduler.registerFixedSystem(TestFixedSystem);

            scheduler.stepFixed(1 / 60); // 使用 fixedDeltaTime 的值

            const fixedSystem = world.getSystem(TestFixedSystem)!;
            expect(fixedSystem.updateCount).toBeGreaterThan(0);
        });
    });

    describe('registerRenderSystem', () => {
        it('应该注册 Render System', () => {
            world.registerSystem(TestRenderSystem);
            scheduler.registerRenderSystem(TestRenderSystem);

            scheduler.stepRender(0.016);

            const renderSystem = world.getSystem(TestRenderSystem)!;
            expect(renderSystem.updateCount).toBe(1);
        });
    });

    describe('flushCommandsToPresentation', () => {
        it('应该刷新命令缓冲区', () => {
            const entity = world.createEntity('TestEntity');
            commandBuffer.push({ type: 'SpawnView', handle: entity.handle, prefabKey: 'player' });

            const commands = scheduler.flushCommandsToPresentation();

            expect(commands.length).toBe(1);
            expect(commandBuffer.getCount()).toBe(0);
        });
    });

    describe('getAccumulator', () => {
        it('应该返回累积器值', () => {
            expect(scheduler.getAccumulator()).toBe(0);

            scheduler.stepFixed(0.01);
            const accumulator = scheduler.getAccumulator();

            expect(accumulator).toBeGreaterThan(0);
        });
    });

    describe('resetAccumulator', () => {
        it('应该重置累积器', () => {
            scheduler.stepFixed(0.016);
            expect(scheduler.getAccumulator()).toBeGreaterThan(0);

            scheduler.resetAccumulator();
            expect(scheduler.getAccumulator()).toBe(0);
        });
    });
});
