/**
 * 配置加载器
 * 
 * 管理游戏配置数据（技能、Buff、敌人、道具等）
 * 
 * 设计决策：使用静态配置 + TypeScript 类型定义，编译时类型检查
 * 参考文档：memory-bank/creative/creative-config-loader.md
 */

import { SkillConfig, SkillConfigs } from './data/configs/skills';
import { BuffConfig, BuffConfigs } from './data/configs/buffs';
import { FxConfig, FxConfigs } from './data/configs/fx';
import { AudioConfig, AudioConfigs } from './data/configs/audio';
import { StatsConfig, EntityStatsConfigs } from './data/configs/stats';
import { EquipmentConfig, EquipmentConfigs } from './data/configs/equipment';
import { ItemConfig, ItemConfigs } from './data/configs/items';
import { LootTable, LootTables } from './data/configs/loot';

/**
 * 配置加载器
 * 
 * 提供配置查询接口，支持类型安全的配置访问
 */
export class ConfigLoader {
    /**
     * 获取技能配置
     * @param skillId 技能 ID
     * @returns 技能配置，如果不存在返回 null
     */
    getSkillConfig(skillId: string): SkillConfig | null {
        return SkillConfigs[skillId] || null;
    }

    /**
     * 获取所有技能配置
     * @returns 所有技能配置数组
     */
    getAllSkillConfigs(): SkillConfig[] {
        return Object.keys(SkillConfigs).map(key => SkillConfigs[key]);
    }

    /**
     * 检查技能配置是否存在
     * @param skillId 技能 ID
     * @returns 是否存在
     */
    hasSkillConfig(skillId: string): boolean {
        return skillId in SkillConfigs;
    }

    /**
     * 获取 Buff 配置
     * @param buffId Buff ID
     * @returns Buff 配置，如果不存在返回 null
     */
    getBuffConfig(buffId: string): BuffConfig | null {
        return BuffConfigs[buffId] || null;
    }

    /**
     * 获取所有 Buff 配置
     * @returns 所有 Buff 配置数组
     */
    getAllBuffConfigs(): BuffConfig[] {
        return Object.keys(BuffConfigs).map(key => BuffConfigs[key]);
    }

    /**
     * 检查 Buff 配置是否存在
     * @param buffId Buff ID
     * @returns 是否存在
     */
    hasBuffConfig(buffId: string): boolean {
        return buffId in BuffConfigs;
    }

    /**
     * 获取特效配置
     * @param fxKey 特效配置键
     * @returns 特效配置，如果不存在返回 null
     */
    getFxConfig(fxKey: string): FxConfig | null {
        return FxConfigs[fxKey] || null;
    }

    /**
     * 获取所有特效配置
     * @returns 所有特效配置数组
     */
    getAllFxConfigs(): FxConfig[] {
        return Object.keys(FxConfigs).map(key => FxConfigs[key]);
    }

    /**
     * 检查特效配置是否存在
     * @param fxKey 特效配置键
     * @returns 是否存在
     */
    hasFxConfig(fxKey: string): boolean {
        return fxKey in FxConfigs;
    }

    /**
     * 获取音频配置
     * @param audioKey 音频配置键
     * @returns 音频配置，如果不存在返回 null
     */
    getAudioConfig(audioKey: string): AudioConfig | null {
        return AudioConfigs[audioKey] || null;
    }

    /**
     * 获取所有音频配置
     * @returns 所有音频配置数组
     */
    getAllAudioConfigs(): AudioConfig[] {
        return Object.keys(AudioConfigs).map(key => AudioConfigs[key]);
    }

    /**
     * 检查音频配置是否存在
     * @param audioKey 音频配置键
     * @returns 是否存在
     */
    hasAudioConfig(audioKey: string): boolean {
        return audioKey in AudioConfigs;
    }

    /**
     * 获取实体属性配置
     * @param entityKey 实体类型键（如 'player', 'enemy_basic'）
     * @returns 属性配置，如果不存在返回 null
     */
    getStatsConfig(entityKey: string): StatsConfig | null {
        return EntityStatsConfigs[entityKey] || null;
    }

    /**
     * 获取所有实体属性配置
     * @returns 所有属性配置数组
     */
    getAllStatsConfigs(): StatsConfig[] {
        return Object.keys(EntityStatsConfigs).map(key => EntityStatsConfigs[key]);
    }

    /**
     * 检查实体属性配置是否存在
     * @param entityKey 实体类型键
     * @returns 是否存在
     */
    hasStatsConfig(entityKey: string): boolean {
        return entityKey in EntityStatsConfigs;
    }

    /**
     * 获取装备配置
     * @param equipmentId 装备 ID
     * @returns 装备配置，如果不存在返回 null
     */
    getEquipmentConfig(equipmentId: string): EquipmentConfig | null {
        return EquipmentConfigs[equipmentId] || null;
    }

    /**
     * 获取所有装备配置
     * @returns 所有装备配置数组
     */
    getAllEquipmentConfigs(): EquipmentConfig[] {
        return Object.keys(EquipmentConfigs).map(key => EquipmentConfigs[key]);
    }

    /**
     * 检查装备配置是否存在
     * @param equipmentId 装备 ID
     * @returns 是否存在
     */
    hasEquipmentConfig(equipmentId: string): boolean {
        return equipmentId in EquipmentConfigs;
    }

    /**
     * 获取物品配置
     * @param itemId 物品 ID
     * @returns 物品配置，如果不存在返回 null
     */
    getItemConfig(itemId: string): ItemConfig | null {
        const config = ItemConfigs[itemId];
        if (!config) return null;

        // 如果是装备类型的物品，动态加载装备配置
        if (config.type === 'equipment' && !config.equipmentConfig) {
            const equipmentConfig = this.getEquipmentConfig(itemId);
            if (equipmentConfig) {
                config.equipmentConfig = equipmentConfig;
            }
        }

        return config;
    }

    /**
     * 获取所有物品配置
     * @returns 所有物品配置数组
     */
    getAllItemConfigs(): ItemConfig[] {
        return Object.keys(ItemConfigs).map(key => {
            const config = ItemConfigs[key];
            // 如果是装备类型的物品，动态加载装备配置
            if (config.type === 'equipment' && !config.equipmentConfig) {
                const equipmentConfig = this.getEquipmentConfig(config.id);
                if (equipmentConfig) {
                    config.equipmentConfig = equipmentConfig;
                }
            }
            return config;
        });
    }

    /**
     * 检查物品配置是否存在
     * @param itemId 物品 ID
     * @returns 是否存在
     */
    hasItemConfig(itemId: string): boolean {
        return itemId in ItemConfigs;
    }

    /**
     * 获取掉落表配置
     * @param lootTableId 掉落表 ID
     * @returns 掉落表配置，如果不存在返回 null
     */
    getLootTable(lootTableId: string): LootTable | null {
        return LootTables[lootTableId] || null;
    }

    /**
     * 获取所有掉落表配置
     * @returns 所有掉落表配置数组
     */
    getAllLootTables(): LootTable[] {
        return Object.keys(LootTables).map(key => LootTables[key]);
    }

    /**
     * 检查掉落表配置是否存在
     * @param lootTableId 掉落表 ID
     * @returns 是否存在
     */
    hasLootTable(lootTableId: string): boolean {
        return lootTableId in LootTables;
    }
}
