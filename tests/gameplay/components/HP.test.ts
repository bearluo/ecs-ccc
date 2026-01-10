/// <reference types="jest" />
/**
 * HPComponent 单元测试
 */

import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';

describe('HPComponent', () => {
    let component: HPComponent;

    beforeEach(() => {
        component = new HPComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.cur).toBe(100);
            expect(component.max).toBe(100);
        });
    });

    describe('reset', () => {
        it('应该重置所有值', () => {
            component.cur = 50;
            component.max = 200;

            component.reset();

            expect(component.cur).toBe(100);
            expect(component.max).toBe(100);
        });
    });

    describe('percentage', () => {
        it('应该计算正确的百分比', () => {
            component.max = 100;
            component.cur = 50;

            expect(component.percentage).toBe(0.5);
        });

        it('当 max 为 0 时应该返回 0', () => {
            component.max = 0;
            component.cur = 50;

            expect(component.percentage).toBe(0);
        });

        it('当 cur 为 0 时应该返回 0', () => {
            component.max = 100;
            component.cur = 0;

            expect(component.percentage).toBe(0);
        });

        it('当 cur 等于 max 时应该返回 1', () => {
            component.max = 100;
            component.cur = 100;

            expect(component.percentage).toBe(1);
        });
    });

    describe('isDead', () => {
        it('当 cur > 0 时应该返回 false', () => {
            component.cur = 1;
            expect(component.isDead).toBe(false);
        });

        it('当 cur = 0 时应该返回 true', () => {
            component.cur = 0;
            expect(component.isDead).toBe(true);
        });

        it('当 cur < 0 时应该返回 true', () => {
            component.cur = -1;
            expect(component.isDead).toBe(true);
        });
    });
});
