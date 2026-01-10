/**
 * StatsComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { StatsComponent, StatsData } from '../../../assets/scripts/gameplay/components/Stats';

describe('StatsComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({
            debug: false,
            initialEntityPoolSize: 100,
            componentPoolSize: 50
        });
        entity = world.createEntity('TestEntity');
    });

    describe('组件创建和重置', () => {
        it('应该正确创建 StatsComponent', () => {
            const stats = entity.addComponent(StatsComponent);
            
            expect(stats).toBeDefined();
            expect(stats.base.attack).toBe(10);
            expect(stats.base.defense).toBe(5);
            expect(stats.base.speed).toBe(100);
            expect(stats.base.maxHP).toBe(100);
            expect(stats.base.critRate).toBe(0.05);
            expect(stats.base.critDamage).toBe(1.5);
            expect(stats.base.lifesteal).toBe(0);
        });

        it('应该正确重置组件', () => {
            const stats = entity.addComponent(StatsComponent);
            
            // 修改属性
            stats.base.attack = 20;
            stats.equipment.attack = 10;
            stats.buffFixed.attack = 5;
            
            // 重置
            stats.reset();
            
            expect(stats.base.attack).toBe(10);
            expect(stats.equipment.attack).toBeUndefined();
            expect(stats.buffFixed.attack).toBeUndefined();
        });
    });

    describe('基础属性计算', () => {
        it('应该正确计算基础属性值', () => {
            const stats = entity.addComponent(StatsComponent);
            
            expect(stats.getFinal('attack')).toBe(10);
            expect(stats.getFinal('defense')).toBe(5);
            expect(stats.getFinal('speed')).toBe(100);
            expect(stats.getFinal('maxHP')).toBe(100);
        });

        it('应该返回所有最终属性', () => {
            const stats = entity.addComponent(StatsComponent);
            const allFinal = stats.getAllFinal();
            
            expect(allFinal.attack).toBe(10);
            expect(allFinal.defense).toBe(5);
            expect(allFinal.speed).toBe(100);
            expect(allFinal.maxHP).toBe(100);
            expect(allFinal.critRate).toBe(0.05);
            expect(allFinal.critDamage).toBe(1.5);
            expect(allFinal.lifesteal).toBe(0);
        });
    });

    describe('装备加成', () => {
        it('应该正确添加装备固定值加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addEquipmentBonus({ attack: 10, defense: 5 });
            
            expect(stats.getFinal('attack')).toBe(20); // 10 + 10
            expect(stats.getFinal('defense')).toBe(10); // 5 + 5
        });

        it('应该正确累积装备加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addEquipmentBonus({ attack: 10 });
            stats.addEquipmentBonus({ attack: 5 });
            
            expect(stats.getFinal('attack')).toBe(25); // 10 + 10 + 5
        });

        it('应该正确移除装备加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addEquipmentBonus({ attack: 10, defense: 5 });
            stats.removeEquipmentBonus({ attack: 5 });
            
            expect(stats.getFinal('attack')).toBe(15); // 10 + 10 - 5
            expect(stats.getFinal('defense')).toBe(10); // 5 + 5
        });
    });

    describe('Buff 固定值加成', () => {
        it('应该正确添加 Buff 固定值加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffFixed({ attack: 5, speed: 20 });
            
            expect(stats.getFinal('attack')).toBe(15); // 10 + 5
            expect(stats.getFinal('speed')).toBe(120); // 100 + 20
        });

        it('应该支持负值 Buff（减益）', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffFixed({ attack: -5, speed: -20 });
            
            expect(stats.getFinal('attack')).toBe(5); // 10 - 5
            expect(stats.getFinal('speed')).toBe(80); // 100 - 20
        });

        it('应该正确移除 Buff 固定值加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffFixed({ attack: 10 });
            stats.removeBuffFixed({ attack: 5 });
            
            expect(stats.getFinal('attack')).toBe(15); // 10 + 10 - 5
        });
    });

    describe('Buff 百分比加成', () => {
        it('应该正确添加 Buff 百分比加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffPercent({ attack: 0.2 }); // +20%
            
            expect(stats.getFinal('attack')).toBe(12); // 10 * 1.2
        });

        it('应该正确应用百分比加成到总和', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addEquipmentBonus({ attack: 10 }); // 基础 10 + 装备 10 = 20
            stats.addBuffPercent({ attack: 0.2 }); // 20 * 1.2 = 24
            
            expect(stats.getFinal('attack')).toBe(24);
        });

        it('应该支持负百分比加成（减益）', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffPercent({ attack: -0.1 }); // -10%
            
            expect(stats.getFinal('attack')).toBe(9); // 10 * 0.9
        });

        it('应该正确移除 Buff 百分比加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addBuffPercent({ attack: 0.2 });
            stats.removeBuffPercent({ attack: 0.1 });
            
            expect(stats.getFinal('attack')).toBe(11); // 10 * 1.1
        });
    });

    describe('升级加成', () => {
        it('应该正确添加升级加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addLevelupBonus({ attack: 5, maxHP: 50 });
            
            expect(stats.getFinal('attack')).toBe(15); // 10 + 5
            expect(stats.getFinal('maxHP')).toBe(150); // 100 + 50
        });

        it('应该正确移除升级加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addLevelupBonus({ attack: 10 });
            stats.removeLevelupBonus({ attack: 5 });
            
            expect(stats.getFinal('attack')).toBe(15); // 10 + 10 - 5
        });
    });

    describe('复合属性计算', () => {
        it('应该正确计算多源属性加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            // 基础 10
            // 装备 +10
            // Buff 固定 +5
            // 升级 +5
            // Buff 百分比 +20%
            // 最终 = (10 + 10 + 5 + 5) * 1.2 = 36
            stats.addEquipmentBonus({ attack: 10 });
            stats.addBuffFixed({ attack: 5 });
            stats.addLevelupBonus({ attack: 5 });
            stats.addBuffPercent({ attack: 0.2 });
            
            expect(stats.getFinal('attack')).toBe(36);
        });

        it('应该正确处理不同属性的独立加成', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.addEquipmentBonus({ attack: 10, defense: 5 });
            stats.addBuffFixed({ attack: 5, speed: 20 });
            stats.addBuffPercent({ attack: 0.2, speed: 0.1 });
            
            expect(stats.getFinal('attack')).toBe(30); // (10 + 10 + 5) * 1.2 = 25 * 1.2 = 30
            expect(stats.getFinal('defense')).toBe(10); // 5 + 5
            expect(stats.getFinal('speed')).toBe(132); // (100 + 20) * 1.1 = 120 * 1.1 = 132
        });
    });

    describe('setBase 方法', () => {
        it('应该正确设置基础属性', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.setBase({ attack: 20, defense: 10 });
            
            expect(stats.base.attack).toBe(20);
            expect(stats.base.defense).toBe(10);
            expect(stats.base.speed).toBe(100); // 未设置的保持原值
        });
    });

    describe('边界情况', () => {
        it('应该处理属性值为 0 的情况', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.setBase({ attack: 0 });
            stats.addBuffPercent({ attack: 0.2 });
            
            expect(stats.getFinal('attack')).toBe(0); // 0 * 1.2 = 0
        });

        it('应该处理百分比加成后结果小于 0 的情况（通过 Math.max 处理）', () => {
            const stats = entity.addComponent(StatsComponent);
            
            stats.setBase({ attack: 10 });
            stats.addBuffFixed({ attack: -15 }); // 10 - 15 = -5
            
            // 注意：这里可能产生负值，实际使用中可能需要 Math.max(0, result)
            // 但组件本身不负责限制，由使用方处理
            expect(stats.getFinal('attack')).toBe(-5);
        });
    });
});
