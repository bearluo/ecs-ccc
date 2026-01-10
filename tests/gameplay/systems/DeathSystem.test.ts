/// <reference types="jest" />
/**
 * DeathSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { DeathSystem } from 'db://assets/scripts/gameplay/systems/DeathSystem';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';
import { DeadTagComponent } from 'db://assets/scripts/gameplay/components/DeadTag';

describe('DeathSystem', () => {
    let world: World;
    let deathSystem: DeathSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        deathSystem = world.registerSystem(DeathSystem);
    });

    describe('onUpdate', () => {
        it('应该为生命值 <= 0 的实体添加 DeadTag', () => {
            const entity = world.createEntity('TestEntity');
            const hp = entity.addComponent(HPComponent);
            hp.cur = 0;
            hp.max = 100;

            const dt = 0.016;
            deathSystem.onUpdate!(dt);

            const deadTag = entity.getComponent(DeadTagComponent);
            expect(deadTag).toBeDefined();
        });

        it('不应该为生命值 > 0 的实体添加 DeadTag', () => {
            const entity = world.createEntity('TestEntity');
            const hp = entity.addComponent(HPComponent);
            hp.cur = 1;
            hp.max = 100;

            const dt = 0.016;
            deathSystem.onUpdate!(dt);

            const deadTag = entity.getComponent(DeadTagComponent);
            expect(deadTag).toBeUndefined();
        });

        it('不应该重复添加 DeadTag', () => {
            const entity = world.createEntity('TestEntity');
            const hp = entity.addComponent(HPComponent);
            hp.cur = 0;
            hp.max = 100;

            const dt = 0.016;
            deathSystem.onUpdate!(dt);
            const deadTag1 = entity.getComponent(DeadTagComponent);

            deathSystem.onUpdate!(dt);
            const deadTag2 = entity.getComponent(DeadTagComponent);

            // 两次获取的应该是同一个组件实例
            expect(deadTag1).toBe(deadTag2);
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const hp1 = entity1.addComponent(HPComponent);
            hp1.cur = 0;

            const entity2 = world.createEntity('Entity2');
            const hp2 = entity2.addComponent(HPComponent);
            hp2.cur = 50; // 未死亡

            const entity3 = world.createEntity('Entity3');
            const hp3 = entity3.addComponent(HPComponent);
            hp3.cur = 0;

            const dt = 0.016;
            deathSystem.onUpdate!(dt);

            expect(entity1.getComponent(DeadTagComponent)).toBeDefined();
            expect(entity2.getComponent(DeadTagComponent)).toBeUndefined();
            expect(entity3.getComponent(DeadTagComponent)).toBeDefined();
        });
    });
});
