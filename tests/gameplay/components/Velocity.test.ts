/// <reference types="jest" />
/**
 * VelocityComponent 单元测试
 */

import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';

describe('VelocityComponent', () => {
    let component: VelocityComponent;

    beforeEach(() => {
        component = new VelocityComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.vx).toBe(0);
            expect(component.vy).toBe(0);
        });
    });

    describe('reset', () => {
        it('应该重置所有值', () => {
            component.vx = 10;
            component.vy = 20;

            component.reset();

            expect(component.vx).toBe(0);
            expect(component.vy).toBe(0);
        });
    });

    describe('属性设置', () => {
        it('应该能够设置速度', () => {
            component.vx = 10;
            component.vy = 20;

            expect(component.vx).toBe(10);
            expect(component.vy).toBe(20);
        });
    });
});
