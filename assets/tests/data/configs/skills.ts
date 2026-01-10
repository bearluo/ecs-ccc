/**
 * 测试技能配置
 * 
 * 用于测试场景的技能配置数据
 */

import { SkillConfig } from '../../../scripts/data/configs/skills';

/**
 * 测试技能配置
 */
export const TestSkillConfigs: Record<string, SkillConfig> = {
    'test-fireball': {
        id: 'test-fireball',
        name: '测试火球',
        type: 'damage',
        cooldown: 2.0,
        damage: 50,
        range: 300,
        cost: 5
    },
    'test-heal': {
        id: 'test-heal',
        name: '测试治疗',
        type: 'heal',
        cooldown: 3.0,
        heal: 30,
        range: 0,
        targetSelf: true,
        cost: 10
    },
    'test-buff': {
        id: 'test-buff',
        name: '测试增益',
        type: 'buff',
        cooldown: 5.0,
        buffType: 'test_speed_boost',
        buffDuration: 3.0,
        buffStacks: 1,
        buffParams: { value: 0.15 },
        targetSelf: true,
        cost: 15
    },
    'test-teleport': {
        id: 'test-teleport',
        name: '测试传送',
        type: 'teleport',
        cooldown: 4.0,
        distance: 200,
        cost: 20
    }
};
