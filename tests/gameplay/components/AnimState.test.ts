/// <reference types="jest" />
/**
 * AnimStateComponent 单元测试
 */

import { AnimStateComponent } from 'db://assets/scripts/gameplay/components/AnimState';

describe('AnimStateComponent', () => {
    let component: AnimStateComponent;

    beforeEach(() => {
        component = new AnimStateComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.current).toBe('idle');
            expect(component.locked).toBe(false);
            expect(component.speed).toBe(1.0);
            expect(component.lastSentAnim).toBe(''); // 新增字段
        });
    });

    describe('reset', () => {
        it('应该重置所有值', () => {
            component.current = 'run';
            component.locked = true;
            component.speed = 2.0;
            component.lastSentAnim = 'run';

            component.reset();

            expect(component.current).toBe('idle');
            expect(component.locked).toBe(false);
            expect(component.speed).toBe(1.0);
            expect(component.lastSentAnim).toBe(''); // 应该重置为空字符串
        });
    });

    describe('属性设置', () => {
        it('应该能够设置当前动画', () => {
            component.current = 'run';
            expect(component.current).toBe('run');
        });

        it('应该能够设置锁定状态', () => {
            component.locked = true;
            expect(component.locked).toBe(true);
        });

        it('应该能够设置动画速度', () => {
            component.speed = 2.0;
            expect(component.speed).toBe(2.0);
        });

        it('应该能够设置 lastSentAnim（用于优化动画同步）', () => {
            component.lastSentAnim = 'idle';
            expect(component.lastSentAnim).toBe('idle');
        });
    });
});
