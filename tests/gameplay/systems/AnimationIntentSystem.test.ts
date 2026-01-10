/// <reference types="jest" />
/**
 * AnimationIntentSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { AnimationIntentSystem } from 'db://assets/scripts/gameplay/systems/AnimationIntentSystem';
import { AnimationIntentComponent } from 'db://assets/scripts/gameplay/components/AnimationIntent';
import { AnimStateComponent } from 'db://assets/scripts/gameplay/components/AnimState';

describe('AnimationIntentSystem', () => {
    let world: World;
    let animIntentSystem: AnimationIntentSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        animIntentSystem = world.registerSystem(AnimationIntentSystem);
    });

    describe('onUpdate', () => {
        it('应该将持续意图转换为动画状态', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.setContinuousIntent('move');
            animState.current = 'idle';

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            expect(animState.current).toBe('move');
        });

        it('应该优先处理触发意图', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.setContinuousIntent('move');
            animIntent.trigger('attack'); // 触发意图优先级更高
            animState.current = 'idle';

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            expect(animState.current).toBe('attack');
        });

        it('应该清除触发意图', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.trigger('attack');
            animState.current = 'idle';

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            expect(animIntent.triggerIntent).toBeNull();
        });

        it('应该根据优先级选择动画', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.setContinuousIntent('idle'); // 优先级 0
            animState.current = 'move'; // 优先级 10

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            // idle 优先级低于 move，不应该替换
            expect(animState.current).toBe('move');
        });

        it('应该处理动画速度参数', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.setContinuousIntent('move', { speed: 1.5 });
            animState.current = 'idle';
            animState.speed = 1.0;

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            expect(animState.speed).toBe(1.5);
        });

        it('应该跳过锁定的动画', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            animIntent.setContinuousIntent('move');
            animState.current = 'idle';
            animState.locked = true; // 锁定动画

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            // 锁定的动画不应该被更新
            expect(animState.current).toBe('idle');
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const animIntent1 = entity1.addComponent(AnimationIntentComponent);
            const animState1 = entity1.addComponent(AnimStateComponent);
            animIntent1.setContinuousIntent('move');

            const entity2 = world.createEntity('Entity2');
            const animIntent2 = entity2.addComponent(AnimationIntentComponent);
            const animState2 = entity2.addComponent(AnimStateComponent);
            animIntent2.trigger('attack');

            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);

            expect(animState1.current).toBe('move');
            expect(animState2.current).toBe('attack');
        });

        it('应该只修改 current，不修改 lastSentAnim（lastSentAnim 由 RenderSyncSystem 管理）', () => {
            const entity = world.createEntity('TestEntity');
            const animIntent = entity.addComponent(AnimationIntentComponent);
            const animState = entity.addComponent(AnimStateComponent);
            
            // 设置初始状态
            animState.current = 'idle';
            animState.lastSentAnim = 'idle'; // 假设上一次发送的是 'idle'
            
            // 设置动画意图
            animIntent.setContinuousIntent('move');
            
            const dt = 0.016;
            animIntentSystem.onUpdate!(dt);
            
            // AnimationIntentSystem 应该只修改 current
            expect(animState.current).toBe('move');
            // lastSentAnim 应该保持不变（由 RenderSyncSystem 更新）
            expect(animState.lastSentAnim).toBe('idle');
        });
    });
});
