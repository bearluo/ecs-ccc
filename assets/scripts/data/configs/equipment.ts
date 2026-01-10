/**
 * 装备配置
 */

import { StatsData } from '../../gameplay/components/Stats';

export type EquipmentSlotType = 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory1' | 'accessory2';

export interface EquipmentConfig {
    id: string;
    name: string;
    type: EquipmentSlotType;        // 装备类型（决定可以装备到哪个槽位）
    statsBonus: Partial<StatsData>; // 属性加成
    icon?: string;                  // 图标路径
    description?: string;            // 描述
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';  // 稀有度（可选）
}

export const EquipmentConfigs: Record<string, EquipmentConfig> = {
    'sword_iron': {
        id: 'sword_iron',
        name: '铁剑',
        type: 'weapon',
        statsBonus: {
            attack: 10,
        },
        rarity: 'common',
    },
    'armor_leather': {
        id: 'armor_leather',
        name: '皮甲',
        type: 'armor',
        statsBonus: {
            defense: 5,
            maxHP: 20,
        },
        rarity: 'common',
    },
    'helmet_iron': {
        id: 'helmet_iron',
        name: '铁盔',
        type: 'helmet',
        statsBonus: {
            defense: 3,
            maxHP: 10,
        },
        rarity: 'common',
    },
    'boots_leather': {
        id: 'boots_leather',
        name: '皮靴',
        type: 'boots',
        statsBonus: {
            speed: 10,
        },
        rarity: 'common',
    },
    'ring_power': {
        id: 'ring_power',
        name: '力量戒指',
        type: 'accessory1',
        statsBonus: {
            attack: 5,
            critRate: 0.05,
        },
        rarity: 'rare',
    },
    'ring_health': {
        id: 'ring_health',
        name: '生命戒指',
        type: 'accessory2',
        statsBonus: {
            maxHP: 50,
        },
        rarity: 'rare',
    },
};
