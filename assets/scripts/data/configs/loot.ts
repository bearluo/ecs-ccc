/**
 * 掉落表配置
 */

export interface LootEntry {
    type: 'item' | 'equipment' | 'experience';
    itemId?: string;        // 物品 ID（如果是 item 或 equipment）
    value?: number;         // 经验值（如果是 experience）
    probability: number;    // 掉落概率（0-1）
    count?: number;         // 固定数量
    countMin?: number;      // 最小数量（随机）
    countMax?: number;      // 最大数量（随机）
}

export interface LootTable {
    id: string;
    name: string;
    items: LootEntry[];
}

export const LootTables: Record<string, LootTable> = {
    'enemy_basic': {
        id: 'enemy_basic',
        name: '基础敌人掉落表',
        items: [
            {
                type: 'experience',
                value: 10,
                probability: 1.0,  // 100% 掉落经验
            },
            {
                type: 'item',
                itemId: 'potion_heal',
                probability: 0.3,  // 30% 掉落治疗药水
                countMin: 1,
                countMax: 2,
            },
            {
                type: 'equipment',
                itemId: 'sword_iron',
                probability: 0.1,  // 10% 掉落铁剑
                count: 1,
            },
        ],
    },
    'enemy_elite': {
        id: 'enemy_elite',
        name: '精英敌人掉落表',
        items: [
            {
                type: 'experience',
                value: 50,
                probability: 1.0,
            },
            {
                type: 'equipment',
                itemId: 'sword_iron',
                probability: 0.5,
                count: 1,
            },
            {
                type: 'item',
                itemId: 'potion_heal',
                probability: 0.8,
                countMin: 2,
                countMax: 5,
            },
        ],
    },
    'boss': {
        id: 'boss',
        name: 'Boss 掉落表',
        items: [
            {
                type: 'experience',
                value: 200,
                probability: 1.0,
            },
            {
                type: 'equipment',
                itemId: 'ring_power',
                probability: 0.8,
                count: 1,
            },
            {
                type: 'equipment',
                itemId: 'armor_leather',
                probability: 0.6,
                count: 1,
            },
        ],
    },
};
