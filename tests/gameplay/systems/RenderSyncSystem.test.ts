/// <reference types="jest" />
/**
 * RenderSyncSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { RenderSyncSystem } from 'db://assets/scripts/gameplay/systems/RenderSyncSystem';
import { CommandBuffer } from 'db://assets/scripts/bridge/CommandBuffer';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { AnimStateComponent } from 'db://assets/scripts/gameplay/components/AnimState';
import { ViewLinkComponent } from 'db://assets/scripts/gameplay/components/ViewLink';
import { DeadTagComponent } from 'db://assets/scripts/gameplay/components/DeadTag';
import { FxIntentComponent } from 'db://assets/scripts/gameplay/components/FxIntent';
import { AudioIntentComponent } from 'db://assets/scripts/gameplay/components/AudioIntent';

describe('RenderSyncSystem', () => {
    let world: World;
    let renderSyncSystem: RenderSyncSystem;
    let commandBuffer: CommandBuffer;

    beforeEach(() => {
        world = new World({ debug: false });
        commandBuffer = new CommandBuffer();
        renderSyncSystem = world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(commandBuffer);
    });

    describe('setCommandBuffer', () => {
        it('应该能够设置 CommandBuffer', () => {
            const newCommandBuffer = new CommandBuffer();
            renderSyncSystem.setCommandBuffer(newCommandBuffer);

            // 通过执行系统来验证 CommandBuffer 是否设置成功
            const entity = world.createEntity('TestEntity');
            entity.addComponent(TransformComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);
            viewLink.viewId = 1;

            renderSyncSystem.onUpdate!(0.016);

            // 应该生成命令
            expect(newCommandBuffer.getCount()).toBeGreaterThan(0);
        });
    });

    describe('onUpdate', () => {
        it('CommandBuffer 未设置时应该警告', () => {
            // 创建一个新的 World 和 System 实例，确保 CommandBuffer 未设置
            const testWorld = new World({ debug: false });
            const testSystem = testWorld.registerSystem(RenderSyncSystem);
            // 不设置 CommandBuffer

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            testSystem.onUpdate!(0.016);

            expect(consoleSpy).toHaveBeenCalledWith('[RenderSyncSystem] CommandBuffer not set');
            consoleSpy.mockRestore();
        });

        it('应该从 Transform 生成 SetPosition 命令', () => {
            const entity = world.createEntity('TestEntity');
            const transform = entity.addComponent(TransformComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);

            transform.x = 10;
            transform.y = 20;
            viewLink.viewId = 1;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const setPositionCommand = commands.find(cmd => cmd.type === 'SetPosition');

            expect(setPositionCommand).toBeDefined();
            if (setPositionCommand && setPositionCommand.type === 'SetPosition') {
                expect(setPositionCommand.handle).toEqual(entity.handle);
                expect(setPositionCommand.x).toBe(10);
                expect(setPositionCommand.y).toBe(20);
            }
        });

        it('应该从 AnimState 生成 PlayAnim 命令', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);

            animState.current = 'run';
            viewLink.viewId = 1;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');

            expect(playAnimCommand).toBeDefined();
            if (playAnimCommand && playAnimCommand.type === 'PlayAnim') {
                expect(playAnimCommand.handle).toEqual(entity.handle);
                expect(playAnimCommand.animName).toBe('run');
            }
        });

        it('应该只在动画改变时发送 PlayAnim 命令（性能优化）', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);

            animState.current = 'idle';
            animState.lastSentAnim = ''; // 初始状态：未发送过
            viewLink.viewId = 1;

            // 第一次更新：应该发送命令（动画从 '' 变为 'idle'）
            renderSyncSystem.onUpdate!(0.016);
            let commands = commandBuffer.flush();
            let playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');
            expect(playAnimCommand).toBeDefined();
            if (playAnimCommand && playAnimCommand.type === 'PlayAnim') {
                expect(playAnimCommand.animName).toBe('idle');
            }
            // 验证 lastSentAnim 已更新
            expect(animState.lastSentAnim).toBe('idle');

            // 第二次更新：动画状态未改变，不应该发送命令
            renderSyncSystem.onUpdate!(0.016);
            commands = commandBuffer.flush();
            playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');
            expect(playAnimCommand).toBeUndefined(); // 不应该发送命令

            // 第三次更新：动画状态改变（从 'idle' 变为 'run'），应该发送命令
            animState.current = 'run';
            renderSyncSystem.onUpdate!(0.016);
            commands = commandBuffer.flush();
            playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');
            expect(playAnimCommand).toBeDefined();
            if (playAnimCommand && playAnimCommand.type === 'PlayAnim') {
                expect(playAnimCommand.animName).toBe('run');
            }
            // 验证 lastSentAnim 已更新
            expect(animState.lastSentAnim).toBe('run');
        });

        it('DeadTag 不再生成 DestroyView 命令（已由 DestroySystem 处理）', () => {
            // ⚠️ 注意：DeadTag 不再由 RenderSyncSystem 处理
            // 死亡动画通过 AnimState 处理，销毁由 DestroySystem 处理
            const entity = world.createEntity('TestEntity');
            entity.addComponent(DeadTagComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);
            viewLink.viewId = 1;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            // RenderSyncSystem 不再处理 DeadTag，不会生成 PlayAnim 和 DestroyView 命令
            // 这些功能已由其他系统处理
            const destroyCommand = commands.find(cmd => cmd.type === 'DestroyView');
            expect(destroyCommand).toBeUndefined();
        });

        it('viewId 为 0 时不应该生成命令', () => {
            const entity = world.createEntity('TestEntity');
            const transform = entity.addComponent(TransformComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);

            transform.x = 10;
            transform.y = 20;
            viewLink.viewId = 0; // 无效的 viewId

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            expect(commands.length).toBe(0);
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const viewLink1 = entity1.addComponent(ViewLinkComponent);
            transform1.x = 10;
            viewLink1.viewId = 1;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const viewLink2 = entity2.addComponent(ViewLinkComponent);
            transform2.x = 20;
            viewLink2.viewId = 2;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const setPositionCommands = commands.filter(cmd => cmd.type === 'SetPosition');

            expect(setPositionCommands.length).toBe(2);
        });

        it('应该正确处理动画状态改变时 lastSentAnim 的更新', () => {
            const entity = world.createEntity('TestEntity');
            const animState = entity.addComponent(AnimStateComponent);
            const viewLink = entity.addComponent(ViewLinkComponent);

            // 初始状态：未发送过动画
            animState.current = 'idle';
            animState.lastSentAnim = '';
            viewLink.viewId = 1;

            // 第一次更新：应该发送 'idle' 动画命令
            renderSyncSystem.onUpdate!(0.016);
            let commands = commandBuffer.flush();
            let playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');
            expect(playAnimCommand).toBeDefined();
            expect(animState.lastSentAnim).toBe('idle');

            // 修改动画状态（模拟 AnimationIntentSystem 更新）
            animState.current = 'run';
            // 注意：lastSentAnim 仍然是 'idle'，因为 RenderSyncSystem 还没有处理

            // 第二次更新：应该发送 'run' 动画命令（因为 current !== lastSentAnim）
            renderSyncSystem.onUpdate!(0.016);
            commands = commandBuffer.flush();
            playAnimCommand = commands.find(cmd => cmd.type === 'PlayAnim');
            expect(playAnimCommand).toBeDefined();
            if (playAnimCommand && playAnimCommand.type === 'PlayAnim') {
                expect(playAnimCommand.animName).toBe('run');
            }
            expect(animState.lastSentAnim).toBe('run'); // 应该更新为 'run'
        });

        it('应该从 FxIntent 生成 PlayFxAtPosition 命令（当指定了 position）', () => {
            const entity = world.createEntity('TestEntity');
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = 'fireball';
            fxIntent.position = { x: 100, y: 200 };

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playFxCommand = commands.find(cmd => cmd.type === 'PlayFxAtPosition');

            expect(playFxCommand).toBeDefined();
            if (playFxCommand && playFxCommand.type === 'PlayFxAtPosition') {
                expect(playFxCommand.fxKey).toBe('fireball');
                expect(playFxCommand.position).toEqual({ x: 100, y: 200 });
            }

            // 组件应该被移除（一次性意图）
            expect(entity.getComponent(FxIntentComponent)).toBeFalsy();
        });

        it('应该从 FxIntent 生成 PlayFxOnEntity 命令（当指定了 targetHandle）', () => {
            const entity = world.createEntity('TestEntity');
            const targetEntity = world.createEntity('TargetEntity');
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = 'hit';
            fxIntent.targetHandle = targetEntity.handle;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playFxCommand = commands.find(cmd => cmd.type === 'PlayFxOnEntity');

            expect(playFxCommand).toBeDefined();
            if (playFxCommand && playFxCommand.type === 'PlayFxOnEntity') {
                expect(playFxCommand.fxKey).toBe('hit');
                expect(playFxCommand.handle).toEqual(targetEntity.handle);
            }

            // 组件应该被移除
            expect(entity.getComponent(FxIntentComponent)).toBeFalsy();
        });

        it('应该从 FxIntent 生成 PlayFxOnEntity 命令（当未指定 position 和 targetHandle，使用当前实体）', () => {
            const entity = world.createEntity('TestEntity');
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = 'explosion';
            // 不设置 position 和 targetHandle

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playFxCommand = commands.find(cmd => cmd.type === 'PlayFxOnEntity');

            expect(playFxCommand).toBeDefined();
            if (playFxCommand && playFxCommand.type === 'PlayFxOnEntity') {
                expect(playFxCommand.fxKey).toBe('explosion');
                expect(playFxCommand.handle).toEqual(entity.handle);
            }

            // 组件应该被移除
            expect(entity.getComponent(FxIntentComponent)).toBeFalsy();
        });

        it('无效的 targetHandle 不应该生成命令', () => {
            const entity = world.createEntity('TestEntity');
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = 'hit';
            fxIntent.targetHandle = { id: 999, gen: 999 }; // 无效的 Handle

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playFxCommand = commands.find(cmd => cmd.type === 'PlayFxOnEntity' || cmd.type === 'PlayFxAtPosition');

            expect(playFxCommand).toBeUndefined();
        });

        it('fxKey 为空时不应该生成命令', () => {
            const entity = world.createEntity('TestEntity');
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = null; // 空的 fxKey

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playFxCommand = commands.find(cmd => cmd.type === 'PlayFxAtPosition' || cmd.type === 'PlayFxOnEntity');

            expect(playFxCommand).toBeUndefined();
        });

        it('应该从 AudioIntent 生成 PlaySFX 命令', () => {
            const entity = world.createEntity('TestEntity');
            const audioIntent = entity.addComponent(AudioIntentComponent);
            audioIntent.sfxKey = 'hit';
            audioIntent.volume = 0.8;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playSFXCommand = commands.find(cmd => cmd.type === 'PlaySFX');

            expect(playSFXCommand).toBeDefined();
            if (playSFXCommand && playSFXCommand.type === 'PlaySFX') {
                expect(playSFXCommand.sfxKey).toBe('hit');
                expect(playSFXCommand.volume).toBe(0.8);
            }

            // 组件应该被移除
            expect(entity.getComponent(AudioIntentComponent)).toBeFalsy();
        });

        it('应该从 AudioIntent 生成 PlayBGM 命令', () => {
            const entity = world.createEntity('TestEntity');
            const audioIntent = entity.addComponent(AudioIntentComponent);
            audioIntent.bgmKey = 'battle_bgm';
            audioIntent.bgmLoop = true;
            audioIntent.volume = 0.6;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playBGMCommand = commands.find(cmd => cmd.type === 'PlayBGM');

            expect(playBGMCommand).toBeDefined();
            if (playBGMCommand && playBGMCommand.type === 'PlayBGM') {
                expect(playBGMCommand.bgmKey).toBe('battle_bgm');
                expect(playBGMCommand.loop).toBe(true);
                expect(playBGMCommand.volume).toBe(0.6);
            }

            // 组件应该被移除
            expect(entity.getComponent(AudioIntentComponent)).toBeFalsy();
        });

        it('应该同时生成 PlaySFX 和 PlayBGM 命令（如果 AudioIntent 同时设置了两个）', () => {
            const entity = world.createEntity('TestEntity');
            const audioIntent = entity.addComponent(AudioIntentComponent);
            audioIntent.sfxKey = 'hit';
            audioIntent.bgmKey = 'battle_bgm';

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const playSFXCommand = commands.find(cmd => cmd.type === 'PlaySFX');
            const playBGMCommand = commands.find(cmd => cmd.type === 'PlayBGM');

            expect(playSFXCommand).toBeDefined();
            expect(playBGMCommand).toBeDefined();
            if (playSFXCommand && playSFXCommand.type === 'PlaySFX') {
                expect(playSFXCommand.sfxKey).toBe('hit');
            }
            if (playBGMCommand && playBGMCommand.type === 'PlayBGM') {
                expect(playBGMCommand.bgmKey).toBe('battle_bgm');
            }

            // 组件应该被移除
            expect(entity.getComponent(AudioIntentComponent)).toBeFalsy();
        });

        it('AudioIntent 中 sfxKey 和 bgmKey 都为空时不应该生成命令', () => {
            const entity = world.createEntity('TestEntity');
            const audioIntent = entity.addComponent(AudioIntentComponent);
            audioIntent.sfxKey = null;
            audioIntent.bgmKey = null;

            renderSyncSystem.onUpdate!(0.016);

            const commands = commandBuffer.flush();
            const audioCommands = commands.filter(cmd => cmd.type === 'PlaySFX' || cmd.type === 'PlayBGM');

            expect(audioCommands.length).toBe(0);
        });
    });
});
