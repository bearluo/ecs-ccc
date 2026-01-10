/// <reference types="jest" />
/**
 * DestroySystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { DestroySystem } from 'db://assets/scripts/gameplay/systems/DestroySystem';
import { CommandBuffer } from 'db://assets/scripts/bridge/CommandBuffer';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';
import { DeadTagComponent } from 'db://assets/scripts/gameplay/components/DeadTag';
import { DestroyTimerComponent } from 'db://assets/scripts/gameplay/components/DestroyTimer';

describe('DestroySystem', () => {
    let world: World;
    let destroySystem: DestroySystem;
    let commandBuffer: CommandBuffer;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        commandBuffer = new CommandBuffer();
        eventBus = new EventBus();
        destroySystem = world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(commandBuffer);
        destroySystem.setEventBus(eventBus);
    });

    describe('setCommandBuffer', () => {
        it('应该能够设置 CommandBuffer', () => {
            const newCommandBuffer = new CommandBuffer();
            destroySystem.setCommandBuffer(newCommandBuffer);

            // 通过执行系统来验证 CommandBuffer 是否设置成功
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0.001); // 设置很短的超时时间

            destroySystem.onUpdate!(0.002); // 超过超时时间

            // 应该生成 DestroyView 命令
            expect(newCommandBuffer.getCount()).toBeGreaterThan(0);
        });
    });

    describe('setEventBus', () => {
        it('应该能够设置 EventBus 并订阅动画事件', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);

            // 发送 'die' 动画完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'die' }
            });

            eventBus.flush();

            // 应该生成 DestroyView 命令
            const commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            expect(destroyCommand).toBeDefined();
        });
    });

    describe('onUpdate - DestroyTimer 超时保护', () => {
        it('应该在 DestroyTimer 到期时销毁实体', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(1.0); // 设置 1 秒超时

            // 保存 handle 的引用（销毁后可能无法访问）
            const entityHandleId = entity.handle.id;
            const entityHandleGen = entity.handle.gen;

            // 第一次更新：时间未到期，不应该销毁
            destroySystem.onUpdate!(0.5);
            let commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
            
            // 验证实体仍然有效（通过 Handle）
            expect(world.isValidHandle(entity.handle)).toBe(true);

            // 第二次更新：时间到期，应该销毁
            destroySystem.onUpdate!(0.6); // 累计 1.1 秒，超过 1 秒
            commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            
            expect(destroyCommand).toBeDefined();
            if (destroyCommand && destroyCommand.type === 'DestroyView') {
                // 验证命令是针对该实体的（通过比较 handle.id 和 handle.gen）
                expect(destroyCommand.handle.id).toBe(entityHandleId);
                expect(destroyCommand.handle.gen).toBe(entityHandleGen);
            }
        });

        it('应该更新 DestroyTimer 的时间', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(2.0);

            // 第一次更新
            destroySystem.onUpdate!(0.5);
            expect(timer.time).toBe(1.5); // 2.0 - 0.5 = 1.5

            // 第二次更新
            destroySystem.onUpdate!(0.5);
            expect(timer.time).toBe(1.0); // 1.5 - 0.5 = 1.0
        });

        it('应该只在有 DeadTag 时销毁实体（超时保护）', () => {
            const entity = world.createEntity('TestEntity');
            // 只有 DestroyTimer，没有 DeadTag
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0.001);

            destroySystem.onUpdate!(0.002);

            // 不应该销毁（没有 DeadTag）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });

        it('应该处理多个实体的 DestroyTimer', () => {
            const entity1 = world.createEntity('Entity1');
            entity1.addComponent(DeadTagComponent);
            const timer1 = entity1.addComponent(DestroyTimerComponent);
            timer1.setTime(0.5);

            const entity2 = world.createEntity('Entity2');
            entity2.addComponent(DeadTagComponent);
            const timer2 = entity2.addComponent(DestroyTimerComponent);
            timer2.setTime(1.0);

            // 保存 handle 的引用（销毁后可能无法访问）
            const entity1HandleId = entity1.handle.id;
            const entity2HandleId = entity2.handle.id;

            // 第一次更新：都不应该销毁
            destroySystem.onUpdate!(0.3);
            let commands = commandBuffer.flush();
            expect(commands.length).toBe(0);

            // 第二次更新：entity1 应该销毁（0.3 + 0.3 = 0.6 > 0.5）
            destroySystem.onUpdate!(0.3);
            commands = commandBuffer.flush();
            let destroyCommands = commands.filter(cmd => cmd.type === 'DestroyView');
            expect(destroyCommands.length).toBe(1);
            expect(destroyCommands[0]).toBeDefined();
            if (destroyCommands[0] && destroyCommands[0].type === 'DestroyView') {
                // 验证命令是针对 entity1 的（通过比较 handle.id）
                expect(destroyCommands[0].handle.id).toBe(entity1HandleId);
            }

            // 第三次更新：entity2 应该销毁（0.6 + 0.5 = 1.1 > 1.0）
            destroySystem.onUpdate!(0.5);
            commands = commandBuffer.flush();
            destroyCommands = commands.filter(cmd => cmd.type === 'DestroyView');
            expect(destroyCommands.length).toBe(1);
            expect(destroyCommands[0]).toBeDefined();
            if (destroyCommands[0] && destroyCommands[0].type === 'DestroyView') {
                // 验证命令是针对 entity2 的（通过比较 handle.id）
                expect(destroyCommands[0].handle.id).toBe(entity2HandleId);
            }
        });
    });

    describe('handleAnimationEvent - 动画完成事件', () => {
        it('应该在 die 动画完成时销毁实体', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);

            // 保存 entity.handle 的引用，因为销毁后可能无法访问
            const entityHandleId = entity.handle.id;

            // 发送 'die' 动画完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'die' }
            });

            eventBus.flush();

            const commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            
            expect(destroyCommand).toBeDefined();
            if (destroyCommand && destroyCommand.type === 'DestroyView') {
                // 验证命令是针对该实体的（通过比较 handle.id）
                expect(destroyCommand.handle.id).toBe(entityHandleId);
            }
        });

        it('不应该处理非 die 动画的完成事件', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);

            // 发送 'attack' 动画完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'attack' }
            });

            eventBus.flush();

            // 不应该销毁（不是 'die' 动画）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });

        it('应该只在实体有 DeadTag 时销毁', () => {
            const entity = world.createEntity('TestEntity');
            // 没有 DeadTag

            // 发送 'die' 动画完成事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'die' }
            });

            eventBus.flush();

            // 不应该销毁（没有 DeadTag）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });

        it('应该忽略无效的 Handle', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);

            // 使用无效的 Handle
            const invalidHandle = { id: 99999, gen: 99999 } as any;

            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: invalidHandle,
                data: { animName: 'die' }
            });

            eventBus.flush();

            // 不应该销毁（Handle 无效）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });

        it('应该忽略 marker 事件', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);

            // 发送 marker 事件
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'marker',
                handle: entity.handle,
                data: { marker: 'hit' }
            });

            eventBus.flush();

            // 不应该销毁（不是 finished 事件）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });
    });

    describe('两阶段销毁 - 动画完成优先于超时保护', () => {
        it('动画完成事件应该立即销毁，不需要等待 DestroyTimer', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(3.0); // 设置 3 秒超时

            // 发送 'die' 动画完成事件（动画完成，应该立即销毁）
            eventBus.push({
                type: 'AnimationEvent',
                eventName: 'finished',
                handle: entity.handle,
                data: { animName: 'die' }
            });

            eventBus.flush();

            // 应该立即生成 DestroyView 命令
            const commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            expect(destroyCommand).toBeDefined();

            // 即使 DestroyTimer 还未到期，实体也应该被销毁
            // 注意：实际销毁由 world.destroyEntity 处理，这里只验证命令生成
        });

        it('如果动画完成事件丢失，DestroyTimer 应该兜底', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0.5);

            // 不发送动画完成事件，只等待超时

            // 第一次更新：时间未到期
            destroySystem.onUpdate!(0.3);
            let commands = commandBuffer.flush();
            expect(commands.length).toBe(0);

            // 第二次更新：时间到期，应该销毁（超时保护）
            destroySystem.onUpdate!(0.3); // 累计 0.6 秒 > 0.5 秒
            commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            expect(destroyCommand).toBeDefined();
        });
    });

    describe('destroyEntity', () => {
        it('应该发送 DestroyView 命令并销毁实体', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0.001);

            // 保存 entity.handle 的引用
            const entityHandleId = entity.handle.id;

            destroySystem.onUpdate!(0.002);

            // 应该生成 DestroyView 命令
            const commands = commandBuffer.flush();
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            expect(destroyCommand).toBeDefined();
            if (destroyCommand && destroyCommand.type === 'DestroyView') {
                // 验证命令是针对该实体的（通过比较 handle.id）
                expect(destroyCommand.handle.id).toBe(entityHandleId);
            }

            // 注意：实际实体销毁由 world.destroyEntity 处理，这里只验证命令生成
            // DestroySystem 负责发送命令，实体销毁由 ECS 框架处理
        });

        it('应该在实体没有 DeadTag 时不销毁', () => {
            const entity = world.createEntity('TestEntity');
            // 没有 DeadTag，只有 DestroyTimer
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0.001);

            destroySystem.onUpdate!(0.002);

            // 不应该生成命令（没有 DeadTag）
            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });
    });
});
