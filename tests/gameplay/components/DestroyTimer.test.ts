/// <reference types="jest" />
/**
 * DestroyTimerComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { DestroyTimerComponent } from 'db://assets/scripts/gameplay/components/DestroyTimer';

describe('DestroyTimerComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('基本属性', () => {
        it('应该能够创建组件', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            
            expect(timer).toBeDefined();
            expect(timer.time).toBe(0);
        });

        it('应该能够设置销毁时间', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            
            timer.setTime(2.5);
            
            expect(timer.time).toBe(2.5);
        });
    });

    describe('isExpired', () => {
        it('应该在时间为 0 时返回 true', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(0);
            
            expect(timer.isExpired).toBe(true);
        });

        it('应该在时间为负数时返回 true', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(-0.1);
            
            expect(timer.isExpired).toBe(true);
        });

        it('应该在时间为正数时返回 false', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(1.0);
            
            expect(timer.isExpired).toBe(false);
        });

        it('应该正确更新 isExpired 状态', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(1.0);
            
            expect(timer.isExpired).toBe(false);
            
            timer.time = 0.5;
            expect(timer.isExpired).toBe(false);
            
            timer.time = 0;
            expect(timer.isExpired).toBe(true);
            
            timer.time = -0.1;
            expect(timer.isExpired).toBe(true);
        });
    });

    describe('reset', () => {
        it('应该能够重置组件', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(2.5);
            
            timer.reset();
            
            expect(timer.time).toBe(0);
        });
    });

    describe('使用场景', () => {
        it('应该能够用于超时保护场景', () => {
            const timer = entity.addComponent(DestroyTimerComponent);
            timer.setTime(3.0); // 3 秒后销毁
            
            // 模拟时间流逝
            let dt = 0.016; // 一帧时间
            
            // 前 3 秒内，不应该过期
            for (let i = 0; i < 180; i++) { // 180 帧 ≈ 3 秒
                timer.time -= dt;
                if (timer.time > 0) {
                    expect(timer.isExpired).toBe(false);
                }
            }
            
            // 超过 3 秒后，应该过期
            timer.time = 0;
            expect(timer.isExpired).toBe(true);
        });
    });
});
