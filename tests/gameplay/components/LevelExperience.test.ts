/// <reference types="jest" />
/**
 * LevelExperienceComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { LevelExperienceComponent } from 'db://assets/scripts/gameplay/components/LevelExperience';

describe('LevelExperienceComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('组件创建和重置', () => {
        it('应该正确创建 LevelExperienceComponent', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            expect(levelExp).toBeDefined();
            expect(levelExp.level).toBe(1);
            expect(levelExp.maxLevel).toBe(100);
            expect(levelExp.exp).toBe(0);
            expect(levelExp.expRequired).toBe(100);
            expect(levelExp.totalExp).toBe(0);
        });

        it('应该正确重置组件', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            // 修改属性
            levelExp.level = 5;
            levelExp.exp = 50;
            levelExp.totalExp = 500;
            
            // 重置
            levelExp.reset();
            
            expect(levelExp.level).toBe(1);
            expect(levelExp.maxLevel).toBe(100);
            expect(levelExp.exp).toBe(0);
            expect(levelExp.expRequired).toBe(100);
            expect(levelExp.totalExp).toBe(0);
        });
    });

    describe('经验值添加和升级', () => {
        it('应该正确添加经验值但不升级', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            const levelsGained = levelExp.addExp(50);
            
            expect(levelsGained).toBe(0);
            expect(levelExp.level).toBe(1);
            expect(levelExp.exp).toBe(50);
            expect(levelExp.totalExp).toBe(50);
            expect(levelExp.expRequired).toBe(100);
        });

        it('应该正确升级（单级）', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            const levelsGained = levelExp.addExp(150);
            
            expect(levelsGained).toBe(1);
            expect(levelExp.level).toBe(2);
            expect(levelExp.exp).toBe(50); // 150 - 100 = 50
            expect(levelExp.totalExp).toBe(150);
            expect(levelExp.expRequired).toBe(400); // 100 * 2 * 2 = 400
        });

        it('应该支持连续升级（多级）', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            // 添加足够经验值以连续升级
            // 1级需要100，2级需要400，总共500经验可以升到2级并剩余0
            const levelsGained = levelExp.addExp(500);
            
            expect(levelsGained).toBe(2);
            expect(levelExp.level).toBe(3);
            expect(levelExp.exp).toBe(0); // 500 - 100 - 400 = 0
            expect(levelExp.totalExp).toBe(500);
            expect(levelExp.expRequired).toBe(900); // 100 * 3 * 3 = 900
        });

        it('不应该接受负数或零经验值', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            const levelsGained1 = levelExp.addExp(-10);
            const levelsGained2 = levelExp.addExp(0);
            
            expect(levelsGained1).toBe(0);
            expect(levelsGained2).toBe(0);
            expect(levelExp.exp).toBe(0);
            expect(levelExp.totalExp).toBe(0);
        });

        it('不应该超过最大等级', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            levelExp.maxLevel = 2;
            levelExp.level = 2;
            levelExp.expRequired = 400;
            
            const levelsGained = levelExp.addExp(10000);
            
            expect(levelsGained).toBe(0);
            expect(levelExp.level).toBe(2);
            expect(levelExp.isMaxLevel).toBe(true);
        });
    });

    describe('经验值百分比和最大等级检查', () => {
        it('应该正确计算经验值百分比', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            levelExp.addExp(50);
            
            expect(levelExp.expPercentage).toBeCloseTo(0.5); // 50 / 100 = 0.5
        });

        it('经验值百分比应该在满级时正确计算', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            levelExp.maxLevel = 2;
            levelExp.level = 2;
            levelExp.expRequired = 400; // 需要设置 expRequired
            
            expect(levelExp.isMaxLevel).toBe(true);
            // 满级时，expPercentage 根据 exp 和 expRequired 计算
            // 如果没有 exp 则为 0（符合逻辑，因为满级后不再需要经验）
            expect(levelExp.expPercentage).toBe(0);
            
            // 如果设置了 exp，应该按比例计算
            levelExp.exp = 200;
            expect(levelExp.expPercentage).toBeCloseTo(0.5); // 200 / 400 = 0.5
        });

        it('应该正确检查是否达到最大等级', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            expect(levelExp.isMaxLevel).toBe(false);
            
            levelExp.maxLevel = 1;
            expect(levelExp.isMaxLevel).toBe(true);
            
            levelExp.maxLevel = 0;
            expect(levelExp.isMaxLevel).toBe(false); // maxLevel <= 0 时认为无限制
        });
    });

    describe('经验曲线计算', () => {
        it('应该使用二次曲线计算升级所需经验值', () => {
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            // 1级：100 * 1 * 1 = 100
            expect(levelExp.expRequired).toBe(100);
            
            // 升级到2级，新经验需求应该是 100 * 2 * 2 = 400
            levelExp.addExp(150);
            expect(levelExp.expRequired).toBe(400);
            
            // 升级到3级，新经验需求应该是 100 * 3 * 3 = 900
            levelExp.addExp(450);
            expect(levelExp.expRequired).toBe(900);
        });
    });
});
