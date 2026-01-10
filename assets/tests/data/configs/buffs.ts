/**
 * 测试 Buff 配置
 * 
 * 用于测试场景的 Buff 配置数据
 */

import { BuffConfig } from '../../../scripts/data/configs/buffs';

/**
 * 测试 Buff 配置
 */
export const TestBuffConfigs: Record<string, BuffConfig> = {
    'test_speed_boost': {
        id: 'test_speed_boost',
        name: '测试速度提升',
        type: 'test_speed_boost',
        duration: 3.0,
        maxStacks: 2,
        params: { value: 0.15 }  // 每层 15% 速度加成
    },
    'test_poison': {
        id: 'test_poison',
        name: '测试中毒',
        type: 'test_poison',
        duration: 5.0,
        maxStacks: 3,
        params: { damage: 3 }  // 每层每秒 3 点伤害
    },
    'test_heal_over_time': {
        id: 'test_heal_over_time',
        name: '测试持续治疗',
        type: 'test_hot',
        duration: 4.0,
        maxStacks: 1,
        params: { heal: 5 }  // 每秒 5 点治疗
    },
    'test_damage_boost': {
        id: 'test_damage_boost',
        name: '测试伤害提升',
        type: 'test_damage_boost',
        duration: 6.0,
        maxStacks: 1,
        params: { value: 0.25 }  // 25% 伤害加成
    }
};
