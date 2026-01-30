/**
 * 装备组件
 * 
 * 存储实体的装备信息
 * 
 * ⚠️ 架构约束：
 * - 纯数据组件，可序列化
 * - 不直接操作 View 层
 * 
 * 设计决策：固定槽位 Record（按类型字符串），使用 EquipmentSlotType 联合类型
 * 参考文档：memory-bank/creative/creative-equipment-component.md
 */

import { Component, component } from '@bl-framework/ecs';
import { EquipmentSlotType, EquipmentConfig } from '../../data/configs/equipment';

/**
 * 装备数据
 */
export interface EquipmentData {
    equipmentId: string;      // 装备 ID（用于查找配置）
    config: EquipmentConfig;  // 装备配置（从 ConfigLoader 加载）
    level: number;            // 强化等级（可选，默认为 1）
    durability?: number;      // 耐久度（可选）
}

@component({ name: 'Equipment', pooled: true, poolSize: 50 })
export class EquipmentComponent extends Component {
    /** 装备槽位（按类型字符串存储） */
    slots: Record<EquipmentSlotType, EquipmentData | null> = {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        accessory1: null,
        accessory2: null,
    };

    /**
     * 获取装备
     * @param type 装备槽位类型
     * @returns 装备数据，如果未装备返回 null
     */
    getEquipment(type: EquipmentSlotType): EquipmentData | null {
        return this.slots[type] || null;
    }

    /**
     * 装备物品
     * @param type 装备槽位类型
     * @param equipmentId 装备 ID
     * @param config 装备配置
     * @param level 强化等级（默认 1）
     * @returns 旧装备数据，如果没有旧装备返回 null
     */
    equip(type: EquipmentSlotType, equipmentId: string, config: EquipmentConfig, level: number = 1): EquipmentData | null {
        const oldEquipment = this.slots[type];
        this.slots[type] = {
            equipmentId,
            config,
            level,
        };
        return oldEquipment || null;
    }

    /**
     * 卸下装备
     * @param type 装备槽位类型
     * @returns 装备数据，如果未装备返回 null
     */
    unequip(type: EquipmentSlotType): EquipmentData | null {
        const equipment = this.slots[type];
        if (equipment) {
            this.slots[type] = null;
            return equipment;
        }
        return null;
    }

    /**
     * 获取所有已装备的装备
     * @returns 装备数据数组
     */
    getAllEquipped(): EquipmentData[] {
        const result: EquipmentData[] = [];
        const keys = Object.keys(this.slots);
        for (let i = 0; i < keys.length; i++) {
            const slot = this.slots[keys[i]];
            if (slot !== null) {
                result.push(slot);
            }
        }
        return result;
    }

    /**
     * 检查是否已装备指定类型
     * @param type 装备槽位类型
     * @returns 是否已装备
     */
    hasEquipment(type: EquipmentSlotType): boolean {
        return this.slots[type] !== null;
    }

    reset(): void {
        super.reset();
        this.slots = {
            weapon: null,
            armor: null,
            helmet: null,
            boots: null,
            accessory1: null,
            accessory2: null,
        };
    }
}
