/**
 * EquipmentComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { EquipmentComponent, EquipmentData } from 'db://assets/scripts/gameplay/components/Equipment';
import { EquipmentSlotType, EquipmentConfig } from 'db://assets/scripts/data/configs/equipment';

describe('EquipmentComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('组件创建和重置', () => {
        it('应该正确创建 EquipmentComponent', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            expect(equipment).toBeDefined();
            expect(equipment.slots.weapon).toBeNull();
            expect(equipment.slots.armor).toBeNull();
            expect(equipment.slots.helmet).toBeNull();
            expect(equipment.slots.boots).toBeNull();
            expect(equipment.slots.accessory1).toBeNull();
            expect(equipment.slots.accessory2).toBeNull();
        });

        it('应该正确重置组件', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            // 装备物品
            const mockConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            equipment.equip('weapon', 'sword_iron', mockConfig, 1);
            
            // 重置
            equipment.reset();
            
            expect(equipment.slots.weapon).toBeNull();
            expect(equipment.slots.armor).toBeNull();
        });
    });

    describe('装备操作', () => {
        it('应该正确装备物品', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const mockConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            const oldEquipment = equipment.equip('weapon', 'sword_iron', mockConfig, 1);
            
            expect(oldEquipment).toBeNull(); // 没有旧装备
            expect(equipment.hasEquipment('weapon')).toBe(true);
            const equipped = equipment.getEquipment('weapon');
            expect(equipped).not.toBeNull();
            expect(equipped?.equipmentId).toBe('sword_iron');
            expect(equipped?.level).toBe(1);
        });

        it('应该正确替换装备', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const config1: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            const config2: EquipmentConfig = {
                id: 'sword_steel',
                name: '钢剑',
                type: 'weapon',
                statsBonus: { attack: 20 }
            };
            
            equipment.equip('weapon', 'sword_iron', config1, 1);
            const oldEquipment = equipment.equip('weapon', 'sword_steel', config2, 1);
            
            expect(oldEquipment).not.toBeNull();
            expect(oldEquipment?.equipmentId).toBe('sword_iron');
            expect(equipment.getEquipment('weapon')?.equipmentId).toBe('sword_steel');
        });

        it('应该正确卸下装备', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const mockConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            equipment.equip('weapon', 'sword_iron', mockConfig, 1);
            const unequipped = equipment.unequip('weapon');
            
            expect(unequipped).not.toBeNull();
            expect(unequipped?.equipmentId).toBe('sword_iron');
            expect(equipment.hasEquipment('weapon')).toBe(false);
            expect(equipment.getEquipment('weapon')).toBeNull();
        });

        it('卸下未装备的槽位应该返回 null', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const unequipped = equipment.unequip('weapon');
            
            expect(unequipped).toBeNull();
        });
    });

    describe('装备查询', () => {
        it('应该正确获取已装备的装备', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const weaponConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            const armorConfig: EquipmentConfig = {
                id: 'armor_leather',
                name: '皮甲',
                type: 'armor',
                statsBonus: { defense: 5, maxHP: 20 }
            };
            
            equipment.equip('weapon', 'sword_iron', weaponConfig, 1);
            equipment.equip('armor', 'armor_leather', armorConfig, 1);
            
            expect(equipment.getEquipment('weapon')?.equipmentId).toBe('sword_iron');
            expect(equipment.getEquipment('armor')?.equipmentId).toBe('armor_leather');
        });

        it('应该正确获取所有已装备的装备', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const weaponConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            const armorConfig: EquipmentConfig = {
                id: 'armor_leather',
                name: '皮甲',
                type: 'armor',
                statsBonus: { defense: 5, maxHP: 20 }
            };
            
            equipment.equip('weapon', 'sword_iron', weaponConfig, 1);
            equipment.equip('armor', 'armor_leather', armorConfig, 1);
            
            const allEquipped = equipment.getAllEquipped();
            
            expect(allEquipped.length).toBe(2);
            expect(allEquipped.some(eq => eq.equipmentId === 'sword_iron')).toBe(true);
            expect(allEquipped.some(eq => eq.equipmentId === 'armor_leather')).toBe(true);
        });

        it('应该正确检查是否已装备', () => {
            const equipment = entity.addComponent(EquipmentComponent);
            
            const mockConfig: EquipmentConfig = {
                id: 'sword_iron',
                name: '铁剑',
                type: 'weapon',
                statsBonus: { attack: 10 }
            };
            
            expect(equipment.hasEquipment('weapon')).toBe(false);
            
            equipment.equip('weapon', 'sword_iron', mockConfig, 1);
            
            expect(equipment.hasEquipment('weapon')).toBe(true);
            expect(equipment.hasEquipment('armor')).toBe(false);
        });
    });
});
