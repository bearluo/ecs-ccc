/**
 * 物品配置
 */

import { EquipmentConfig } from './equipment';

export interface ItemConfig {
    id: string;
    name: string;
    type: 'equipment' | 'consumable' | 'material' | 'quest';
    stackable: boolean;
    maxStack?: number;
    icon?: string;
    description?: string;
    equipmentConfig?: EquipmentConfig;  // 如果是装备，包含装备配置
    consumableEffect?: {
        type: 'heal' | 'buff' | 'damage';
        value: number;
        duration?: number;
    };
}

export const ItemConfigs: Record<string, ItemConfig> = {
    'potion_heal': {
        id: 'potion_heal',
        name: '治疗药水',
        type: 'consumable',
        stackable: true,
        maxStack: 10,
        consumableEffect: {
            type: 'heal',
            value: 50,
        },
    },
    'scroll_speed': {
        id: 'scroll_speed',
        name: '速度卷轴',
        type: 'consumable',
        stackable: true,
        maxStack: 5,
        consumableEffect: {
            type: 'buff',
            value: 0.2,  // +20% 速度
            duration: 10,
        },
    },
    // 装备类型的物品需要包含 equipmentConfig
    'sword_iron': {
        id: 'sword_iron',
        name: '铁剑',
        type: 'equipment',
        stackable: false,
        equipmentConfig: undefined,  // 将通过 ConfigLoader 动态加载
    },
    'armor_leather': {
        id: 'armor_leather',
        name: '皮甲',
        type: 'equipment',
        stackable: false,
        equipmentConfig: undefined,
    },
};
