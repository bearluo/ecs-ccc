/// <reference types="jest" />
/**
 * ViewLinkComponent 单元测试
 */

import { ViewLinkComponent } from 'db://assets/scripts/gameplay/components/ViewLink';

describe('ViewLinkComponent', () => {
    let component: ViewLinkComponent;

    beforeEach(() => {
        component = new ViewLinkComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.viewId).toBe(0);
            expect(component.prefabKey).toBe('');
        });
    });

    describe('reset', () => {
        it('应该重置所有值', () => {
            component.viewId = 123;
            component.prefabKey = 'player';

            component.reset();

            expect(component.viewId).toBe(0);
            expect(component.prefabKey).toBe('');
        });
    });

    describe('属性设置', () => {
        it('应该能够设置 viewId', () => {
            component.viewId = 123;
            expect(component.viewId).toBe(123);
        });

        it('应该能够设置 prefabKey', () => {
            component.prefabKey = 'player';
            expect(component.prefabKey).toBe('player');
        });
    });
});
