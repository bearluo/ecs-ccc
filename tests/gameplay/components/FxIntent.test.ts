/// <reference types="jest" />
/**
 * FxIntentComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { FxIntentComponent } from 'db://assets/scripts/gameplay/components/FxIntent';
import { Handle } from '@bl-framework/ecs';

describe('FxIntentComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('组件基本功能', () => {
        it('应该能够添加 FxIntentComponent', () => {
            const fxIntent = world.addComponent(entity.id, FxIntentComponent);
            
            expect(fxIntent).toBeDefined();
            expect(fxIntent.fxKey).toBeNull();
            expect(fxIntent.position).toBeUndefined();
            expect(fxIntent.targetHandle).toBeUndefined();
        });

        it('应该能够设置 fxKey', () => {
            const fxIntent = world.addComponent(entity.id, FxIntentComponent);
            fxIntent.fxKey = 'fireball';
            
            expect(fxIntent.fxKey).toBe('fireball');
        });

        it('应该能够设置 position', () => {
            const fxIntent = world.addComponent(entity.id, FxIntentComponent);
            const position = { x: 10, y: 20 };
            fxIntent.position = position;
            
            expect(fxIntent.position).toEqual(position);
            expect(fxIntent.position.x).toBe(10);
            expect(fxIntent.position.y).toBe(20);
        });

        it('应该能够设置 targetHandle', () => {
            const fxIntent = world.addComponent(entity.id, FxIntentComponent);
            const targetEntity = world.createEntity('TargetEntity');
            fxIntent.targetHandle = targetEntity.handle;
            
            expect(fxIntent.targetHandle).toEqual(targetEntity.handle);
        });
    });

    describe('reset 方法', () => {
        it('应该能够重置组件', () => {
            const fxIntent = world.addComponent(entity.id, FxIntentComponent);
            fxIntent.fxKey = 'fireball';
            fxIntent.position = { x: 10, y: 20 };
            const targetEntity = world.createEntity('TargetEntity');
            fxIntent.targetHandle = targetEntity.handle;
            
            fxIntent.reset();
            
            expect(fxIntent.fxKey).toBeNull();
            expect(fxIntent.position).toBeUndefined();
            expect(fxIntent.targetHandle).toBeUndefined();
        });
    });
});
