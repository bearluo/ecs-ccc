/// <reference types="jest" />
/**
 * AnimationIntent 组件单元测试
 */

import { World } from '@bl-framework/ecs';
import { AnimationIntentComponent } from 'db://assets/scripts/gameplay/components/AnimationIntent';

describe('AnimationIntentComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('持续意图', () => {
        it('应该能够设置持续意图', () => {
            const intent = world.addComponent(entity.id, AnimationIntentComponent);
            
            intent.setContinuousIntent('move', { speed: 100 });
            
            expect(intent.continuousIntent).toBe('move');
            expect(intent.params.speed).toBe(100);
        });

        it('应该默认持续意图为 idle', () => {
            const intent = world.addComponent(entity.id, AnimationIntentComponent);
            
            expect(intent.continuousIntent).toBe('idle');
        });
    });

    describe('触发意图', () => {
        it('应该能够触发一次性动画', () => {
            const intent = world.addComponent(entity.id, AnimationIntentComponent);
            
            intent.trigger('attack', { direction: 1 });
            
            expect(intent.triggerIntent).toBe('attack');
            expect(intent.params.direction).toBe(1);
        });

        it('应该能够清除触发意图', () => {
            const intent = world.addComponent(entity.id, AnimationIntentComponent);
            
            intent.trigger('attack');
            intent.clearTrigger();
            
            expect(intent.triggerIntent).toBeNull();
        });
    });

    describe('重置', () => {
        it('应该能够重置组件', () => {
            const intent = world.addComponent(entity.id, AnimationIntentComponent);
            
            intent.setContinuousIntent('move');
            intent.trigger('attack');
            intent.reset();
            
            expect(intent.continuousIntent).toBe('idle');
            expect(intent.triggerIntent).toBeNull();
            expect(Object.keys(intent.params).length).toBe(0);
        });
    });
});
