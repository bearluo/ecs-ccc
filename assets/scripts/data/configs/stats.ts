/**
 * 属性配置
 */

import { StatsData } from '../../gameplay/components/Stats';

export interface StatsConfig {
    baseStats: StatsData;
}

export const EntityStatsConfigs: Record<string, StatsConfig> = {
    'player': {
        baseStats: {
            attack: 15,
            defense: 8,
            speed: 120,
            maxHP: 100,
            critRate: 0.1,
            critDamage: 1.5,
            lifesteal: 0,
        }
    },
    'enemy_basic': {
        baseStats: {
            attack: 8,
            defense: 3,
            speed: 80,
            maxHP: 50,
            critRate: 0.05,
            critDamage: 1.2,
            lifesteal: 0,
        }
    },
    'enemy_elite': {
        baseStats: {
            attack: 20,
            defense: 10,
            speed: 100,
            maxHP: 200,
            critRate: 0.15,
            critDamage: 1.8,
            lifesteal: 0.1,
        }
    },
    'boss': {
        baseStats: {
            attack: 50,
            defense: 20,
            speed: 60,
            maxHP: 1000,
            critRate: 0.2,
            critDamage: 2.0,
            lifesteal: 0.2,
        }
    },
};
