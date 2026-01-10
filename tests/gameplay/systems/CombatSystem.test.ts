/// <reference types="jest" />
/**
 * CombatSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { CombatSystem } from 'db://assets/scripts/gameplay/systems/CombatSystem';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';

describe('CombatSystem', () => {
    let world: World;
    let combatSystem: CombatSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        combatSystem = world.registerSystem(CombatSystem);
    });

    describe('onUpdate', () => {
        it('应该检测碰撞并造成伤害', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const hp1 = entity1.addComponent(HPComponent);
            transform1.x = 0;
            transform1.y = 0;
            hp1.cur = 100;
            hp1.max = 100;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const hp2 = entity2.addComponent(HPComponent);
            transform2.x = 50; // 距离 < 100 (collisionRadius * 2 = 50 * 2)
            transform2.y = 0;
            hp2.cur = 100;
            hp2.max = 100;

            const dt = 0.016;
            combatSystem.onUpdate!(dt);

            // 两个实体都应该受到伤害（每次碰撞减 10 点血量）
            expect(hp1.cur).toBe(90);
            expect(hp2.cur).toBe(90);
        });

        it('不应该伤害距离太远的实体', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const hp1 = entity1.addComponent(HPComponent);
            transform1.x = 0;
            transform1.y = 0;
            hp1.cur = 100;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const hp2 = entity2.addComponent(HPComponent);
            transform2.x = 150; // 距离 > 100 (collisionRadius * 2)
            transform2.y = 0;
            hp2.cur = 100;

            const dt = 0.016;
            combatSystem.onUpdate!(dt);

            expect(hp1.cur).toBe(100);
            expect(hp2.cur).toBe(100);
        });

        it('应该跳过已死亡的实体', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const hp1 = entity1.addComponent(HPComponent);
            transform1.x = 0;
            transform1.y = 0;
            hp1.cur = 0; // 已死亡

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const hp2 = entity2.addComponent(HPComponent);
            transform2.x = 50; // 在碰撞范围内
            transform2.y = 0;
            hp2.cur = 100;

            const dt = 0.016;
            combatSystem.onUpdate!(dt);

            // 已死亡的实体不应该参与碰撞检测
            expect(hp1.cur).toBe(0);
            expect(hp2.cur).toBe(100);
        });

        it('生命值不应该低于 0', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const hp1 = entity1.addComponent(HPComponent);
            transform1.x = 0;
            transform1.y = 0;
            hp1.cur = 5; // 生命值很低

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const hp2 = entity2.addComponent(HPComponent);
            transform2.x = 50; // 在碰撞范围内
            transform2.y = 0;
            hp2.cur = 5;

            const dt = 0.016;
            combatSystem.onUpdate!(dt);

            // 生命值应该被限制为 0
            expect(hp1.cur).toBe(0);
            expect(hp2.cur).toBe(0);
        });
    });
});
