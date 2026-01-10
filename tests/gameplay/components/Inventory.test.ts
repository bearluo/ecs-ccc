/// <reference types="jest" />
/**
 * InventoryComponent 单元测试
 */

import { World } from '@bl-framework/ecs';
import { InventoryComponent, InventoryItem } from 'db://assets/scripts/gameplay/components/Inventory';
import { ConfigLoader } from 'db://assets/scripts/ConfigLoader';

describe('InventoryComponent', () => {
    let world: World;
    let entity: any;
    let configLoader: ConfigLoader;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
        configLoader = new ConfigLoader();
    });

    describe('组件创建和重置', () => {
        it('应该正确创建 InventoryComponent', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            expect(inventory).toBeDefined();
            expect(inventory.maxSlots).toBe(30);
            expect(inventory.usedSlots).toBe(0);
            expect(inventory.hasEmptySlot).toBe(true);
            expect(inventory.slots.length).toBe(30);
            expect(inventory.slots.every(slot => slot === null)).toBe(true);
        });

        it('应该正确重置组件', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // 添加物品
            inventory.addItem('potion_heal', 5, configLoader);
            
            // 重置
            inventory.reset();
            
            expect(inventory.usedSlots).toBe(0);
            expect(inventory.slots.every(slot => slot === null)).toBe(true);
        });
    });

    describe('物品添加', () => {
        it('应该正确添加物品到空槽位', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            const added = inventory.addItem('potion_heal', 3, configLoader);
            
            expect(added).toBe(true);
            expect(inventory.usedSlots).toBe(1);
            const item = inventory.getItem(0);
            expect(item).not.toBeNull();
            expect(item?.itemId).toBe('potion_heal');
            expect(item?.count).toBe(3);
            expect(item?.slotIndex).toBe(0);
        });

        it('应该支持自动堆叠（可堆叠物品）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // 先添加 5 个
            inventory.addItem('potion_heal', 5, configLoader);
            // 再添加 3 个（应该堆叠到同一个槽位）
            inventory.addItem('potion_heal', 3, configLoader);
            
            expect(inventory.usedSlots).toBe(1);
            const item = inventory.getItem(0);
            expect(item?.count).toBe(8); // 5 + 3 = 8
        });

        it('应该支持最大堆叠数限制', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // potion_heal 的 maxStack 是 10
            // 先添加 8 个
            inventory.addItem('potion_heal', 8, configLoader);
            // 再添加 5 个（只能再添加 2 个，剩余的 3 个需要新槽位）
            inventory.addItem('potion_heal', 5, configLoader);
            
            const item1 = inventory.getItem(0);
            expect(item1?.count).toBe(10); // 达到最大堆叠数
            
            const item2 = inventory.getItem(1);
            expect(item2?.count).toBe(3); // 剩余的 3 个
            expect(inventory.usedSlots).toBe(2);
        });

        it('不应该添加不存在的物品', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            const added = inventory.addItem('nonexistent_item', 1, configLoader);
            
            expect(added).toBe(false);
            expect(inventory.usedSlots).toBe(0);
        });

        it('应该在背包满时返回 false', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // 填满背包（30 个槽位，每个槽位 1 个不堆叠的物品）
            for (let i = 0; i < 30; i++) {
                const mockConfig = configLoader.getItemConfig('sword_iron');
                if (mockConfig) {
                    inventory.slots[i] = {
                        itemId: `item_${i}`,
                        config: mockConfig,
                        count: 1,
                        slotIndex: i
                    };
                }
            }
            
            const added = inventory.addItem('potion_heal', 1, configLoader);
            expect(added).toBe(false);
        });

        it('应该支持不可堆叠物品（装备）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // 添加装备（不可堆叠）
            inventory.addItem('sword_iron', 1, configLoader);
            inventory.addItem('sword_iron', 1, configLoader);
            
            // 应该占用 2 个槽位
            expect(inventory.usedSlots).toBe(2);
            expect(inventory.getItem(0)?.count).toBe(1);
            expect(inventory.getItem(1)?.count).toBe(1);
        });
    });

    describe('物品移除', () => {
        it('应该正确移除物品（通过槽位索引）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            inventory.addItem('potion_heal', 5, configLoader);
            const removed = inventory.removeItem(0, 3);
            
            expect(removed).toBe(true);
            const item = inventory.getItem(0);
            expect(item?.count).toBe(2); // 5 - 3 = 2
        });

        it('应该正确移除整个物品（数量足够）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            inventory.addItem('potion_heal', 5, configLoader);
            const removed = inventory.removeItem(0, 5);
            
            expect(removed).toBe(true);
            expect(inventory.getItem(0)).toBeNull();
            expect(inventory.usedSlots).toBe(0);
        });

        it('应该正确移除物品（通过物品 ID）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // potion_heal 是可堆叠的，所以会合并到同一个槽位
            inventory.addItem('potion_heal', 5, configLoader);
            inventory.addItem('potion_heal', 3, configLoader);
            
            // 应该合并到一个槽位，总共 8 个
            expect(inventory.getItem(0)?.count).toBe(8);
            expect(inventory.usedSlots).toBe(1);
            
            const removed = inventory.removeItemByType('potion_heal', 6);
            
            expect(removed).toBe(true);
            // 移除 6 个后，剩余 2 个
            expect(inventory.getItem(0)?.count).toBe(2);
        });

        it('移除不存在的物品应该返回 false', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            const removed = inventory.removeItem(0, 1);
            
            expect(removed).toBe(false);
        });

        it('移除数量不足应该返回 false', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            inventory.addItem('potion_heal', 5, configLoader);
            const removed = inventory.removeItemByType('potion_heal', 10);
            
            expect(removed).toBe(false);
        });
    });

    describe('物品查询', () => {
        it('应该正确获取物品（通过槽位索引）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            inventory.addItem('potion_heal', 5, configLoader);
            const item = inventory.getItem(0);
            
            expect(item).not.toBeNull();
            expect(item?.itemId).toBe('potion_heal');
            expect(item?.count).toBe(5);
        });

        it('应该正确查找物品槽位（通过物品 ID）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            // potion_heal 是可堆叠的，所以会合并到同一个槽位
            inventory.addItem('potion_heal', 5, configLoader);
            inventory.addItem('potion_heal', 3, configLoader);
            
            const indices = inventory.findItem('potion_heal');
            
            // 由于自动堆叠，应该只有一个槽位
            expect(indices.length).toBe(1);
            expect(indices).toContain(0);
            
            // 测试多个槽位的情况（使用不可堆叠物品）
            inventory.addItem('sword_iron', 1, configLoader);
            inventory.addItem('sword_iron', 1, configLoader);
            const swordIndices = inventory.findItem('sword_iron');
            expect(swordIndices.length).toBe(2); // 不可堆叠，占用 2 个槽位
        });

        it('应该正确获取物品总数（考虑堆叠）', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            inventory.addItem('potion_heal', 5, configLoader);
            inventory.addItem('potion_heal', 3, configLoader);
            
            const count = inventory.getItemCount('potion_heal');
            
            expect(count).toBe(8); // 5 + 3 = 8
        });

        it('查找不存在的物品应该返回空数组', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            const indices = inventory.findItem('nonexistent_item');
            const count = inventory.getItemCount('nonexistent_item');
            
            expect(indices.length).toBe(0);
            expect(count).toBe(0);
        });
    });

    describe('槽位状态', () => {
        it('应该正确计算已使用的槽位数', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            expect(inventory.usedSlots).toBe(0);
            
            inventory.addItem('potion_heal', 5, configLoader);
            expect(inventory.usedSlots).toBe(1);
            
            inventory.addItem('sword_iron', 1, configLoader);
            expect(inventory.usedSlots).toBe(2);
        });

        it('应该正确检查是否有空槽位', () => {
            const inventory = entity.addComponent(InventoryComponent);
            
            expect(inventory.hasEmptySlot).toBe(true);
            
            // 填满背包
            for (let i = 0; i < 30; i++) {
                const mockConfig = configLoader.getItemConfig('sword_iron');
                if (mockConfig) {
                    inventory.slots[i] = {
                        itemId: `item_${i}`,
                        config: mockConfig,
                        count: 1,
                        slotIndex: i
                    };
                }
            }
            
            expect(inventory.hasEmptySlot).toBe(false);
        });
    });
});
