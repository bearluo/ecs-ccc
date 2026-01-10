/// <reference types="jest" />
/**
 * BuffSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { BuffSystem } from 'db://assets/scripts/gameplay/systems/BuffSystem';
import { BuffListComponent } from 'db://assets/scripts/gameplay/components/BuffList';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';

describe('BuffSystem', () => {
    let world: World;
    let buffSystem: BuffSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        buffSystem = world.registerSystem(BuffSystem);
    });

    describe('onUpdate', () => {
        it('应该减少 Buff 持续时间', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            
            buffList.addBuff('buff1', 'strength', 10.0, 1, { value: 0.2 });
            const buff = buffList.findBuff('strength');
            expect(buff).toBeDefined();
            expect(buff?.duration).toBe(10.0);

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            const updatedBuff = buffList.findBuff('strength');
            expect(updatedBuff?.duration).toBeCloseTo(9.0, 5);
        });

        it('应该在持续时间到期时移除 Buff', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            
            buffList.addBuff('buff1', 'strength', 1.0, 1, { value: 0.2 });
            expect(buffList.hasBuff('strength')).toBe(true);

            const dt = 1.5; // 超过持续时间
            buffSystem.onUpdate!(dt);

            expect(buffList.hasBuff('strength')).toBe(false);
        });

        it('应该应用 DOT 伤害效果', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 100;
            hp.max = 100;
            
            buffList.addBuff('dot1', 'poison', 5.0, 1, { damage: 10 }); // 每秒 10 点伤害

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            // 应该受到 10 点伤害
            expect(hp.cur).toBe(90);
        });

        it('应该应用 HOT 治疗效果', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 50;
            hp.max = 100;
            
            buffList.addBuff('hot1', 'hot', 5.0, 1, { heal: 5 }); // 每秒 5 点治疗

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            // 应该恢复 5 点生命值
            expect(hp.cur).toBe(55);
        });

        it('HOT 不应该超过最大生命值', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 98;
            hp.max = 100;
            
            buffList.addBuff('hot1', 'hot', 5.0, 1, { heal: 5 }); // 每秒 5 点治疗

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            // 应该被限制为最大生命值
            expect(hp.cur).toBe(100);
        });

        it('DOT 不应该将生命值降到 0 以下', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 5;
            hp.max = 100;
            
            buffList.addBuff('dot1', 'poison', 5.0, 1, { damage: 10 }); // 每秒 10 点伤害

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            // 应该被限制为 0
            expect(hp.cur).toBe(0);
        });

        it('应该处理多个 Buff', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            
            buffList.addBuff('buff1', 'strength', 10.0, 1, { value: 0.2 });
            buffList.addBuff('buff2', 'speed', 5.0, 1, { value: 0.3 });

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            expect(buffList.findBuff('strength')?.duration).toBeCloseTo(9.0, 5);
            expect(buffList.findBuff('speed')?.duration).toBeCloseTo(4.0, 5);
        });

        it('应该跳过已死亡的实体', () => {
            const entity = world.createEntity('TestEntity');
            const buffList = entity.addComponent(BuffListComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 0; // 已死亡
            hp.max = 100;
            
            buffList.addBuff('dot1', 'poison', 5.0, 1, { damage: 10 });

            const dt = 1.0;
            buffSystem.onUpdate!(dt);

            // 已死亡的实体不应该受到 DOT 伤害
            expect(hp.cur).toBe(0);
        });
    });
});
