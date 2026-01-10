/// <reference types="jest" />
/**
 * AudioIntentComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { AudioIntentComponent } from 'db://assets/scripts/gameplay/components/AudioIntent';

describe('AudioIntentComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('组件基本功能', () => {
        it('应该能够添加 AudioIntentComponent', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            
            expect(audioIntent).toBeDefined();
            expect(audioIntent.sfxKey).toBeNull();
            expect(audioIntent.bgmKey).toBeNull();
            expect(audioIntent.volume).toBeUndefined();
            expect(audioIntent.bgmLoop).toBeUndefined();
        });

        it('应该能够设置 sfxKey', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.sfxKey = 'hit';
            
            expect(audioIntent.sfxKey).toBe('hit');
        });

        it('应该能够设置 bgmKey', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.bgmKey = 'battle_bgm';
            
            expect(audioIntent.bgmKey).toBe('battle_bgm');
        });

        it('应该能够设置 volume', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.volume = 0.8;
            
            expect(audioIntent.volume).toBe(0.8);
        });

        it('应该能够设置 bgmLoop', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.bgmLoop = true;
            
            expect(audioIntent.bgmLoop).toBe(true);
        });

        it('应该能够同时设置 sfxKey 和 bgmKey', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.sfxKey = 'hit';
            audioIntent.bgmKey = 'battle_bgm';
            
            expect(audioIntent.sfxKey).toBe('hit');
            expect(audioIntent.bgmKey).toBe('battle_bgm');
        });
    });

    describe('reset 方法', () => {
        it('应该能够重置组件', () => {
            const audioIntent = world.addComponent(entity.id, AudioIntentComponent);
            audioIntent.sfxKey = 'hit';
            audioIntent.bgmKey = 'battle_bgm';
            audioIntent.volume = 0.8;
            audioIntent.bgmLoop = true;
            
            audioIntent.reset();
            
            expect(audioIntent.sfxKey).toBeNull();
            expect(audioIntent.bgmKey).toBeNull();
            expect(audioIntent.volume).toBeUndefined();
            expect(audioIntent.bgmLoop).toBeUndefined();
        });
    });
});
