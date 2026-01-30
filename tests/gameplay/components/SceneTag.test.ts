/// <reference types="jest" />
/**
 * SceneTagComponent 单元测试
 */

import { SceneTagComponent, SceneType } from 'db://assets/scripts/gameplay/components/SceneTag';

describe('SceneTagComponent', () => {
    let component: SceneTagComponent;

    beforeEach(() => {
        component = new SceneTagComponent();
    });

    describe('初始化', () => {
        it('应该有默认值', () => {
            expect(component.sceneType).toBe(SceneType.Main);
        });
    });

    describe('reset', () => {
        it('应该重置为默认值', () => {
            component.sceneType = SceneType.Battle;

            component.reset();

            expect(component.sceneType).toBe(SceneType.Main);
        });
    });

    describe('属性设置', () => {
        it('应该能够设置场景类型', () => {
            component.sceneType = SceneType.Battle;
            expect(component.sceneType).toBe(SceneType.Battle);

            component.sceneType = SceneType.Shop;
            expect(component.sceneType).toBe(SceneType.Shop);

            component.sceneType = SceneType.Boss;
            expect(component.sceneType).toBe(SceneType.Boss);
        });
    });

    describe('SceneType 枚举', () => {
        it('应该包含所有场景类型', () => {
            expect(SceneType.Main).toBe('main');
            expect(SceneType.Battle).toBe('battle');
            expect(SceneType.Shop).toBe('shop');
            expect(SceneType.Boss).toBe('boss');
        });
    });
});
