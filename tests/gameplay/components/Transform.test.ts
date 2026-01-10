/// <reference types="jest" />
/**
 * TransformComponent 单元测试
 */

import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';

describe('TransformComponent', () => {
    let component: TransformComponent;

    beforeEach(() => {
        component = new TransformComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.x).toBe(0);
            expect(component.y).toBe(0);
            expect(component.rot).toBe(0);
        });
    });

    describe('reset', () => {
        it('应该重置所有值', () => {
            component.x = 10;
            component.y = 20;
            component.rot = 45;

            component.reset();

            expect(component.x).toBe(0);
            expect(component.y).toBe(0);
            expect(component.rot).toBe(0);
        });
    });

    describe('属性设置', () => {
        it('应该能够设置位置', () => {
            component.x = 10;
            component.y = 20;

            expect(component.x).toBe(10);
            expect(component.y).toBe(20);
        });

        it('应该能够设置旋转', () => {
            component.rot = 45;

            expect(component.rot).toBe(45);
        });
    });
});
