/**
 * Buff 配置
 */

export interface BuffConfig {
    id: string;
    name: string;
    type: string;
    duration: number;
    maxStacks?: number;  // 最大堆叠层数，-1 表示无限制
    params?: Record<string, any>;  // 参数（如 { value: 0.2 } 表示 20% 加成）
}

export const BuffConfigs: Record<string, BuffConfig> = {
    'speed_boost': {
        id: 'speed_boost',
        name: '速度提升',
        type: 'speed_boost',
        duration: 5.0,
        maxStacks: 3,
        params: { value: 0.2 }  // 每层 20% 速度加成
    },
    'poison': {
        id: 'poison',
        name: '中毒',
        type: 'poison',
        duration: 10.0,
        maxStacks: 5,
        params: { damage: 5 }  // 每层每秒 5 点伤害
    },
    'heal_over_time': {
        id: 'heal_over_time',
        name: '持续治疗',
        type: 'hot',
        duration: 8.0,
        maxStacks: 1,
        params: { heal: 10 }  // 每秒 10 点治疗
    }
};
