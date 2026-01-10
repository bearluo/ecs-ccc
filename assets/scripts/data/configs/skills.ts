/**
 * 技能配置
 */

export interface SkillConfig {
    id: string;
    name: string;
    type: 'damage' | 'buff' | 'heal' | 'teleport';
    cooldown: number;
    maxUses?: number;  // -1 表示无限制
    damage?: number;
    heal?: number;
    range?: number;
    distance?: number;  // 传送距离
    buffType?: string;  // Buff 类型
    buffDuration?: number;
    buffStacks?: number;
    buffParams?: Record<string, any>;
    targetSelf?: boolean;  // 是否以自己为目标
    cost?: number;  // 消耗（MP/能量等）
}

export const SkillConfigs: Record<string, SkillConfig> = {
    'fireball': {
        id: 'fireball',
        name: '火球术',
        type: 'damage',
        cooldown: 3.0,
        damage: 100,
        range: 500,
        cost: 10
    },
    'heal': {
        id: 'heal',
        name: '治疗',
        type: 'heal',
        cooldown: 5.0,
        heal: 50,
        range: 0,  // 0 表示只能对自己使用
        targetSelf: true,
        cost: 15
    },
    'speed_boost': {
        id: 'speed_boost',
        name: '加速',
        type: 'buff',
        cooldown: 10.0,
        buffType: 'speed_boost',
        buffDuration: 5.0,
        buffStacks: 1,
        buffParams: { value: 0.2 },  // 20% 速度加成
        targetSelf: true,
        cost: 20
    },
    'teleport': {
        id: 'teleport',
        name: '传送',
        type: 'teleport',
        cooldown: 8.0,
        distance: 300,
        cost: 25
    }
};
