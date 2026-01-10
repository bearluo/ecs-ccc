/// <reference types="jest" />
/**
 * StatsSyncSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { StatsSyncSystem } from 'db://assets/scripts/gameplay/systems/StatsSyncSystem';
import { StatsComponent } from 'db://assets/scripts/gameplay/components/Stats';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';
import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';

describe('StatsSyncSystem', () => {
    let world: World;
    let statsSyncSystem: StatsSyncSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        statsSyncSystem = world.registerSystem(StatsSyncSystem);
    });

    describe('maxHP 同步', () => {
        it('应该同步 StatsComponent.maxHP 到 HPComponent.max', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const hp = entity.addComponent(HPComponent);

            // 设置初始值
            stats.setBase({ maxHP: 100 });
            hp.max = 100;
            hp.cur = 80;

            // 修改 StatsComponent.maxHP
            stats.setBase({ maxHP: 150 });

            // 执行同步
            statsSyncSystem.onUpdate!(0.016);

            expect(hp.max).toBe(150);
            // 当前生命值应该按比例调整（80/100 * 150 = 120）
            expect(hp.cur).toBe(120);
        });

        it('应该保持生命值百分比', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const hp = entity.addComponent(HPComponent);

            // 初始：100/200 = 50%
            stats.setBase({ maxHP: 200 });
            hp.max = 200;
            hp.cur = 100;

            // 修改为 300
            stats.setBase({ maxHP: 300 });
            statsSyncSystem.onUpdate!(0.016);

            // 应该保持 50%，即 150/300
            expect(hp.cur).toBe(150);
            expect(hp.max).toBe(300);
        });

        it('应该在 maxHP 减少时确保 cur 不超过 max', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const hp = entity.addComponent(HPComponent);

            // 初始：150/200
            stats.setBase({ maxHP: 200 });
            hp.max = 200;
            hp.cur = 150;

            // 修改为 100（maxHP 减少）
            stats.setBase({ maxHP: 100 });
            statsSyncSystem.onUpdate!(0.016);

            // cur 应该被限制为 max
            expect(hp.cur).toBeLessThanOrEqual(hp.max);
            expect(hp.max).toBe(100);
        });

        it('应该在 maxHP 不变时不修改 HPComponent', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const hp = entity.addComponent(HPComponent);

            stats.setBase({ maxHP: 100 });
            hp.max = 100;
            hp.cur = 80;

            // 不修改 maxHP，只修改其他属性
            stats.setBase({ attack: 20 });

            statsSyncSystem.onUpdate!(0.016);

            // HPComponent 应该不变
            expect(hp.max).toBe(100);
            expect(hp.cur).toBe(80);
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const stats1 = entity1.addComponent(StatsComponent);
            const hp1 = entity1.addComponent(HPComponent);
            stats1.setBase({ maxHP: 100 });
            hp1.max = 100;
            hp1.cur = 80;

            const entity2 = world.createEntity('Entity2');
            const stats2 = entity2.addComponent(StatsComponent);
            const hp2 = entity2.addComponent(HPComponent);
            stats2.setBase({ maxHP: 200 });
            hp2.max = 200;
            hp2.cur = 150;

            // 修改两个实体的 maxHP
            stats1.setBase({ maxHP: 150 });
            stats2.setBase({ maxHP: 300 });

            statsSyncSystem.onUpdate!(0.016);

            expect(hp1.max).toBe(150);
            expect(hp1.cur).toBe(120);
            expect(hp2.max).toBe(300);
            expect(hp2.cur).toBe(225);
        });

        it('应该处理只有 StatsComponent 没有 HPComponent 的实体', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            stats.setBase({ maxHP: 100 });

            // 不应该报错
            expect(() => statsSyncSystem.onUpdate!(0.016)).not.toThrow();
        });
    });

    describe('speed 同步', () => {
        it('应该限制速度不超过最大速度', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const velocity = entity.addComponent(VelocityComponent);

            stats.setBase({ speed: 100 });
            velocity.vx = 150;
            velocity.vy = 0;

            statsSyncSystem.onUpdate!(0.016);

            // 速度应该被限制为 100
            const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            expect(speed).toBeCloseTo(100, 5);
        });

        it('应该按比例缩放速度向量', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const velocity = entity.addComponent(VelocityComponent);

            stats.setBase({ speed: 100 });
            // 初始速度 150，方向 (1, 1)
            velocity.vx = 106.066; // 150 / sqrt(2)
            velocity.vy = 106.066; // 150 / sqrt(2)

            statsSyncSystem.onUpdate!(0.016);

            // 速度应该被限制为 100，方向保持不变
            const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            expect(speed).toBeCloseTo(100, 5);
            
            // 方向应该保持一致（vx 和 vy 的比值应该相同）
            const ratio = velocity.vx / velocity.vy;
            expect(ratio).toBeCloseTo(1, 5);
        });

        it('应该在速度未超过最大速度时不修改', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const velocity = entity.addComponent(VelocityComponent);

            stats.setBase({ speed: 100 });
            velocity.vx = 80;
            velocity.vy = 0;

            const originalVx = velocity.vx;
            const originalVy = velocity.vy;

            statsSyncSystem.onUpdate!(0.016);

            expect(velocity.vx).toBe(originalVx);
            expect(velocity.vy).toBe(originalVy);
        });

        it('应该处理速度为 0 的情况', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const velocity = entity.addComponent(VelocityComponent);

            stats.setBase({ speed: 100 });
            velocity.vx = 0;
            velocity.vy = 0;

            statsSyncSystem.onUpdate!(0.016);

            expect(velocity.vx).toBe(0);
            expect(velocity.vy).toBe(0);
        });

        it('应该处理装备和 Buff 加成后的最大速度', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const velocity = entity.addComponent(VelocityComponent);

            stats.setBase({ speed: 100 });
            stats.addEquipmentBonus({ speed: 50 }); // 150
            stats.addBuffPercent({ speed: 0.2 }); // 150 * 1.2 = 180

            velocity.vx = 200;
            velocity.vy = 0;

            statsSyncSystem.onUpdate!(0.016);

            // 速度应该被限制为 180
            const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            expect(speed).toBeCloseTo(180, 5);
        });
    });

    describe('边界情况', () => {
        it('应该处理 maxHP 为 0 的情况', () => {
            const entity = world.createEntity('TestEntity');
            const stats = entity.addComponent(StatsComponent);
            const hp = entity.addComponent(HPComponent);

            stats.setBase({ maxHP: 100 });
            hp.max = 100;
            hp.cur = 80;

            stats.setBase({ maxHP: 0 });
            statsSyncSystem.onUpdate!(0.016);

            expect(hp.max).toBe(0);
            expect(hp.cur).toBe(0);
        });

        it('应该处理只有 HPComponent 没有 StatsComponent 的实体', () => {
            const entity = world.createEntity('TestEntity');
            const hp = entity.addComponent(HPComponent);
            hp.max = 100;
            hp.cur = 80;

            // 不应该报错
            expect(() => statsSyncSystem.onUpdate!(0.016)).not.toThrow();
            expect(hp.max).toBe(100);
            expect(hp.cur).toBe(80);
        });

        it('应该处理只有 VelocityComponent 没有 StatsComponent 的实体', () => {
            const entity = world.createEntity('TestEntity');
            const velocity = entity.addComponent(VelocityComponent);
            velocity.vx = 100;
            velocity.vy = 0;

            // 不应该报错
            expect(() => statsSyncSystem.onUpdate!(0.016)).not.toThrow();
        });
    });
});
