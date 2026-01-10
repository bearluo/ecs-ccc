/// <reference types="jest" />
/**
 * InventorySystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { InventorySystem } from 'db://assets/scripts/gameplay/systems/InventorySystem';
import { InventoryComponent } from 'db://assets/scripts/gameplay/components/Inventory';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';
import { BuffListComponent } from 'db://assets/scripts/gameplay/components/BuffList';
import { ConfigLoader } from 'db://assets/scripts/ConfigLoader';

describe('InventorySystem', () => {
    let world: World;
    let inventorySystem: InventorySystem;
    let configLoader: ConfigLoader;

    beforeEach(() => {
        world = new World({ debug: false });
        inventorySystem = world.registerSystem(InventorySystem);
        
        configLoader = new ConfigLoader();
        inventorySystem.setConfigLoader(configLoader);
    });

    describe('物品添加和移除', () => {
        it('应该正确添加物品到背包', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            const success = inventorySystem.addItem(entity, 'potion_heal', 5);
            
            expect(success).toBe(true);
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('potion_heal')).toBe(5);
        });

        it('应该正确移除物品（通过槽位索引）', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            inventorySystem.addItem(entity, 'potion_heal', 5);
            const removed = inventorySystem.removeItem(entity, 0, 3);
            
            expect(removed).toBe(true);
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('potion_heal')).toBe(2);
        });

        it('应该正确移除物品（通过物品 ID）', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            inventorySystem.addItem(entity, 'potion_heal', 5);
            const removed = inventorySystem.removeItemByType(entity, 'potion_heal', 3);
            
            expect(removed).toBe(true);
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('potion_heal')).toBe(2);
        });

        it('如果没有 InventoryComponent 应该返回 false', () => {
            const entity = world.createEntity('TestEntity');
            
            const success = inventorySystem.addItem(entity, 'potion_heal', 5);
            
            expect(success).toBe(false);
        });

        it('如果没有 ConfigLoader 应该返回 false', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            // 创建新的系统实例，不设置 configLoader
            const newSystem = new InventorySystem();
            newSystem['world'] = world;
            // 不设置 configLoader
            
            const success = newSystem.addItem(entity, 'potion_heal', 5);
            
            expect(success).toBe(false);
        });
    });

    describe('物品使用（消耗品）', () => {
        it('应该正确使用治疗药水（恢复生命值）', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            const hp = entity.addComponent(HPComponent);
            
            hp.cur = 50;
            hp.max = 100;
            
            inventorySystem.addItem(entity, 'potion_heal', 1);
            const used = inventorySystem.useItem(entity, 0);
            
            expect(used).toBe(true);
            expect(hp.cur).toBe(100); // 50 + 50 = 100（不能超过 max）
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('potion_heal')).toBe(0); // 已消耗
        });

        it('应该正确使用速度卷轴（添加 Buff）', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            entity.addComponent(BuffListComponent);
            
            inventorySystem.addItem(entity, 'scroll_speed', 1);
            const used = inventorySystem.useItem(entity, 0);
            
            expect(used).toBe(true);
            const buffList = entity.getComponent(BuffListComponent);
            // applyBuffEffect 会添加 speed_boost Buff，使用时间戳作为 ID
            const allBuffs = buffList?.getAllBuffs() || [];
            const speedBuff = allBuffs.find(buff => buff.type === 'speed_boost');
            expect(speedBuff).toBeDefined();
            expect(speedBuff?.params.value).toBe(0.2);
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('scroll_speed')).toBe(0);
        });

        it('不应该使用非消耗品', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            inventorySystem.addItem(entity, 'sword_iron', 1);
            const used = inventorySystem.useItem(entity, 0);
            
            expect(used).toBe(false);
            const inventory = entity.getComponent(InventoryComponent);
            expect(inventory?.getItemCount('sword_iron')).toBe(1); // 未消耗
        });

        it('使用不存在的物品应该返回 false', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            const used = inventorySystem.useItem(entity, 0);
            
            expect(used).toBe(false);
        });

        it('使用空槽位应该返回 false', () => {
            const entity = world.createEntity('TestEntity');
            entity.addComponent(InventoryComponent);
            
            const used = inventorySystem.useItem(entity, 10);
            
            expect(used).toBe(false);
        });
    });
});
