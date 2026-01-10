/// <reference types="jest" />
/**
 * CommandBuffer 单元测试
 */

import { CommandBuffer, RenderCommand } from "db://assets/scripts/bridge/CommandBuffer";
import { World } from '@bl-framework/ecs';

describe('CommandBuffer', () => {
    let commandBuffer: CommandBuffer;
    let world: World;

    beforeEach(() => {
        commandBuffer = new CommandBuffer();
        world = new World({ debug: false });
    });

    describe('push', () => {
        it('应该能够添加命令', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'SpawnView',
                handle: entity.handle,
                prefabKey: 'player'
            };

            commandBuffer.push(command);

            expect(commandBuffer.getCount()).toBe(1);
        });

        it('应该能够添加多个命令', () => {
            const entity = world.createEntity('TestEntity');
            commandBuffer.push({ type: 'SpawnView', handle: entity.handle, prefabKey: 'player' });
            commandBuffer.push({ type: 'SetPosition', handle: entity.handle, x: 10, y: 20 });
            commandBuffer.push({ type: 'PlayAnim', handle: entity.handle, animName: 'run' });

            expect(commandBuffer.getCount()).toBe(3);
        });
    });

    describe('flush', () => {
        it('应该返回所有命令并清空缓冲区', () => {
            const entity = world.createEntity('TestEntity');
            commandBuffer.push({ type: 'SpawnView', handle: entity.handle, prefabKey: 'player' });
            commandBuffer.push({ type: 'SetPosition', handle: entity.handle, x: 10, y: 20 });

            const commands = commandBuffer.flush();

            expect(commands.length).toBe(2);
            expect(commands[0].type).toBe('SpawnView');
            expect(commands[1].type).toBe('SetPosition');
            expect(commandBuffer.getCount()).toBe(0);
        });

        it('应该返回空数组当缓冲区为空时', () => {
            const commands = commandBuffer.flush();

            expect(commands.length).toBe(0);
        });

        it('应该返回命令的副本，不影响原始命令', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'SetPosition',
                handle: entity.handle,
                x: 10,
                y: 20
            };

            commandBuffer.push(command);
            const flushed = commandBuffer.flush();

            expect(flushed[0]).not.toBe(command);
            expect(flushed[0]).toEqual(command);
        });
    });

    describe('clear', () => {
        it('应该清空所有命令', () => {
            const entity = world.createEntity('TestEntity');
            commandBuffer.push({ type: 'SpawnView', handle: entity.handle, prefabKey: 'player' });
            commandBuffer.push({ type: 'SetPosition', handle: entity.handle, x: 10, y: 20 });

            commandBuffer.clear();

            expect(commandBuffer.getCount()).toBe(0);
        });
    });

    describe('getCount', () => {
        it('应该返回正确的命令数量', () => {
            const entity = world.createEntity('TestEntity');
            expect(commandBuffer.getCount()).toBe(0);

            commandBuffer.push({ type: 'SpawnView', handle: entity.handle, prefabKey: 'player' });
            expect(commandBuffer.getCount()).toBe(1);

            commandBuffer.push({ type: 'SetPosition', handle: entity.handle, x: 10, y: 20 });
            expect(commandBuffer.getCount()).toBe(2);
        });
    });

    describe('命令类型', () => {
        it('应该支持 SpawnView 命令（使用 Handle）', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'SpawnView',
                handle: entity.handle,
                prefabKey: 'player'
            };

            commandBuffer.push(command);
            const flushed = commandBuffer.flush();

            expect(flushed[0].type).toBe('SpawnView');
            if (flushed[0].type === 'SpawnView') {
                expect(flushed[0].handle).toEqual(entity.handle);
                expect(flushed[0].prefabKey).toBe('player');
            }
        });

        it('应该支持 SetPosition 命令（使用 Handle）', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'SetPosition',
                handle: entity.handle,
                x: 10,
                y: 20
            };

            commandBuffer.push(command);
            const flushed = commandBuffer.flush();

            expect(flushed[0].type).toBe('SetPosition');
            if (flushed[0].type === 'SetPosition') {
                expect(flushed[0].handle).toEqual(entity.handle);
                expect(flushed[0].x).toBe(10);
                expect(flushed[0].y).toBe(20);
            }
        });

        it('应该支持 PlayAnim 命令（使用 Handle）', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'PlayAnim',
                handle: entity.handle,
                animName: 'run'
            };

            commandBuffer.push(command);
            const flushed = commandBuffer.flush();

            expect(flushed[0].type).toBe('PlayAnim');
            if (flushed[0].type === 'PlayAnim') {
                expect(flushed[0].handle).toEqual(entity.handle);
                expect(flushed[0].animName).toBe('run');
            }
        });

        it('应该支持 DestroyView 命令（使用 Handle）', () => {
            const entity = world.createEntity('TestEntity');
            const command: RenderCommand = {
                type: 'DestroyView',
                handle: entity.handle
            };

            commandBuffer.push(command);
            const flushed = commandBuffer.flush();

            expect(flushed[0].type).toBe('DestroyView');
            if (flushed[0].type === 'DestroyView') {
                expect(flushed[0].handle).toEqual(entity.handle);
            }
        });
    });
});
