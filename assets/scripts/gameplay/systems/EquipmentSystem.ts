/**
 * 装备系统
 * 
 * 处理装备的装备和卸下逻辑
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 被动系统，只处理外部调用
 * - 装备时更新 StatsComponent.equipment
 * - 需要与 InventoryComponent 集成（装备从背包移除，卸下添加到背包）
 * 
 * 设计决策：被动系统（只处理外部调用）
 * 参考文档：memory-bank/creative/creative-equipment-system.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { EquipmentComponent, EquipmentData } from '../components/Equipment';
import { EquipmentSlotType } from '../../data/configs/equipment';
import { StatsComponent } from '../components/Stats';
import { InventoryComponent } from '../components/Inventory';
import { ConfigLoader } from '../../ConfigLoader';
import { EventBus } from '../../bridge/EventBus';
import { Handle } from '@bl-framework/ecs';

@system({ priority: 6 })  // 在 StatsSyncSystem 之后
export class EquipmentSystem extends System {
    private configLoader?: ConfigLoader;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 装备物品（外部调用）
     * @param entity 目标实体
     * @param slotType 装备槽位类型
     * @param equipmentId 装备 ID（如果从背包装备，需要提供）
     * @param inventorySlotIndex 背包槽位索引（可选，如果从背包装备）
     * @returns 是否成功装备
     */
    equipItem(entity: Entity, slotType: EquipmentSlotType, equipmentId?: string, inventorySlotIndex?: number): boolean {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        const inventory = entity.getComponent(InventoryComponent);
        
        if (!equipment || !stats || !this.configLoader) return false;

        // 如果从背包装备
        if (inventorySlotIndex !== undefined && inventory) {
            const item = inventory.getItem(inventorySlotIndex);
            if (!item || item.config.type !== 'equipment' || !item.config.equipmentConfig) {
                return false;
            }

            equipmentId = item.itemId;
        }

        if (!equipmentId) return false;

        // 从配置加载装备信息
        const config = this.configLoader.getEquipmentConfig(equipmentId);
        if (!config || config.type !== slotType) {
            console.warn(`[EquipmentSystem] Equipment config not found or type mismatch: ${equipmentId}`);
            return false;
        }

        // 卸下旧装备（如果有）
        const oldEquipment = equipment.unequip(slotType);
        if (oldEquipment) {
            // 移除旧装备的属性加成
            stats.removeEquipmentBonus(oldEquipment.config.statsBonus);
            
            // 如果背包存在，将旧装备添加到背包
            if (inventory) {
                inventory.addItem(oldEquipment.equipmentId, 1, this.configLoader);
            }
        }

        // 装备新装备
        equipment.equip(slotType, equipmentId, config, 1);

        // 添加新装备的属性加成
        stats.addEquipmentBonus(config.statsBonus);

        // 如果从背包装备，从背包移除
        if (inventorySlotIndex !== undefined && inventory) {
            inventory.removeItem(inventorySlotIndex, 1);
        }

        // 发送装备事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'EquipmentChange',
                handle: entity.handle,
                slotType,
                equipmentId,
                action: 'equip'
            });
        }

        return true;
    }

    /**
     * 卸下装备（外部调用）
     * @param entity 目标实体
     * @param slotType 装备槽位类型
     * @param addToInventory 是否添加到背包（默认 true）
     * @returns 卸下的装备数据，如果未装备返回 null
     */
    unequipItem(entity: Entity, slotType: EquipmentSlotType, addToInventory: boolean = true): EquipmentData | null {
        const equipment = entity.getComponent(EquipmentComponent);
        const stats = entity.getComponent(StatsComponent);
        const inventory = entity.getComponent(InventoryComponent);
        
        if (!equipment || !stats) return null;

        const unequipped = equipment.unequip(slotType);
        if (!unequipped) return null;

        // 移除装备的属性加成
        stats.removeEquipmentBonus(unequipped.config.statsBonus);

        // 如果背包存在且需要添加到背包
        if (addToInventory && inventory && this.configLoader) {
            const added = inventory.addItem(unequipped.equipmentId, 1, this.configLoader);
            if (!added) {
                console.warn(`[EquipmentSystem] Failed to add equipment to inventory: ${unequipped.equipmentId}`);
            }
        }

        // 发送卸下事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'EquipmentChange',
                handle: entity.handle,
                slotType,
                equipmentId: unequipped.equipmentId,
                action: 'unequip'
            });
        }

        return unequipped;
    }

    /**
     * 替换装备（装备新装备，自动卸下旧装备）
     * @param entity 目标实体
     * @param slotType 装备槽位类型
     * @param equipmentId 装备 ID
     * @param inventorySlotIndex 背包槽位索引（可选）
     * @returns 是否成功替换
     */
    replaceEquipment(entity: Entity, slotType: EquipmentSlotType, equipmentId: string, inventorySlotIndex?: number): boolean {
        return this.equipItem(entity, slotType, equipmentId, inventorySlotIndex);
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有逻辑通过外部调用触发
    }
}
