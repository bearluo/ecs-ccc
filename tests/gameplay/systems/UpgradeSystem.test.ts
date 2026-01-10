/// <reference types="jest" />
/**
 * UpgradeSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { UpgradeSystem } from 'db://assets/scripts/gameplay/systems/UpgradeSystem';
import { LevelExperienceComponent } from 'db://assets/scripts/gameplay/components/LevelExperience';
import { StatsComponent } from 'db://assets/scripts/gameplay/components/Stats';
import { BuffListComponent } from 'db://assets/scripts/gameplay/components/BuffList';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';

describe('UpgradeSystem', () => {
    let world: World;
    let upgradeSystem: UpgradeSystem;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        upgradeSystem = world.registerSystem(UpgradeSystem);
        
        eventBus = new EventBus();
        upgradeSystem.setEventBus(eventBus);
    });

    describe('经验值添加', () => {
        it('应该正确添加经验值但不升级', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            upgradeSystem.addExperience(entity, 50);
            
            expect(levelExp.level).toBe(1);
            expect(levelExp.exp).toBe(50);
            expect(levelExp.totalExp).toBe(50);
        });

        it('应该正确处理升级并添加属性加成', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            const stats = entity.addComponent(StatsComponent);
            
            upgradeSystem.addExperience(entity, 150);
            
            expect(levelExp.level).toBe(2);
            // 默认每级加成：attack +2, defense +1, maxHP +10
            expect(stats.levelup.attack).toBe(2);
            expect(stats.levelup.defense).toBe(1);
            expect(stats.levelup.maxHP).toBe(10);
        });

        it('应该支持连续升级并添加多级属性加成', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            const stats = entity.addComponent(StatsComponent);
            
            // 添加足够经验值以连续升级2级
            upgradeSystem.addExperience(entity, 500);
            
            expect(levelExp.level).toBe(3);
            // 2级加成
            expect(stats.levelup.attack).toBe(4); // 2 * 2
            expect(stats.levelup.defense).toBe(2); // 1 * 2
            expect(stats.levelup.maxHP).toBe(20); // 10 * 2
        });

        it('如果没有 LevelExperienceComponent 应该不处理', () => {
            const entity = world.createEntity('TestEntity');
            
            // 不应该抛出错误
            expect(() => {
                upgradeSystem.addExperience(entity, 100);
            }).not.toThrow();
        });

        it('如果没有 StatsComponent 应该不添加属性加成', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            upgradeSystem.addExperience(entity, 150);
            
            expect(levelExp.level).toBe(2);
            // 应该不报错，只是不添加属性加成
        });
    });

    describe('经验值倍率', () => {
        it('应该应用经验值倍率 Buff', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            const buffList = entity.addComponent(BuffListComponent);
            
            // 添加经验值倍率 Buff（+20%）
            buffList.addBuff('exp_boost_1', 'exp_boost', 60, 1, { value: 0.2 });
            
            upgradeSystem.addExperience(entity, 100);
            
            // 100 * 1.2 = 120 经验值
            expect(levelExp.totalExp).toBe(120);
        });

        it('应该在没有 Buff 时使用默认倍率 1.0', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            upgradeSystem.addExperience(entity, 100);
            
            // 100 * 1.0 = 100 经验值
            expect(levelExp.totalExp).toBe(100);
        });
    });

    describe('升级事件', () => {
        it('应该在升级时发送 LevelUp 事件', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            entity.addComponent(StatsComponent);
            
            const events: any[] = [];
            eventBus.subscribe('LevelUp', (event) => {
                events.push(event);
            });
            
            upgradeSystem.addExperience(entity, 150);
            eventBus.flush();
            
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('LevelUp');
            expect(events[0].handle).toEqual(entity.handle);
            expect(events[0].oldLevel).toBe(1);
            expect(events[0].newLevel).toBe(2);
            expect(events[0].levelsGained).toBe(1);
        });

        it('应该在不升级时不发送事件', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(LevelExperienceComponent);
            
            const events: any[] = [];
            eventBus.subscribe('LevelUp', (event) => {
                events.push(event);
            });
            
            upgradeSystem.addExperience(entity, 50);
            eventBus.flush();
            
            expect(events.length).toBe(0);
        });
    });

    describe('来源参数', () => {
        it('应该接受来源参数但不影响逻辑', () => {
            const entity = world.createEntity('TestEntity');
            const levelExp = entity.addComponent(LevelExperienceComponent);
            
            upgradeSystem.addExperience(entity, 100, 'kill');
            
            expect(levelExp.totalExp).toBe(100);
        });
    });
});
