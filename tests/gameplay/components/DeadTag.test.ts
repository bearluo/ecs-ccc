/// <reference types="jest" />
/**
 * DeadTagComponent 单元测试
 */

import { DeadTagComponent } from 'db://assets/scripts/gameplay/components/DeadTag';

describe('DeadTagComponent', () => {
    let component: DeadTagComponent;

    beforeEach(() => {
        component = new DeadTagComponent();
    });

    describe('初始化', () => {
        it('应该能够创建实例', () => {
            expect(component).toBeDefined();
        });

        it('应该是标记组件（无数据）', () => {
            // DeadTag 是标记组件，只用于标记，不包含数据
            expect(component).toBeInstanceOf(DeadTagComponent);
        });
    });
});
