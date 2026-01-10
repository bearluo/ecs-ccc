/**
 * 属性系统组件
 * 
 * 存储实体的基础属性和属性加成
 * 支持多个属性源：base（基础）、equipment（装备）、buff（Buff）、levelup（升级）
 * 
 * ⚠️ 架构约束：
 * - 纯数据组件，可序列化
 * - 不直接操作 View 层
 * - 属性计算通过 getFinal 方法进行实时计算
 * 
 * 计算公式：
 * 最终值 = (基础值 + 装备加成 + 固定Buff + 升级加成) * (1 + 百分比Buff)
 */

import { Component, component } from '@bl-framework/ecs';

/**
 * 属性数据接口
 */
export interface StatsData {
    attack: number;      // 攻击力
    defense: number;     // 防御力
    speed: number;       // 移动速度（像素/秒）
    maxHP: number;       // 最大生命值
    critRate: number;    // 暴击率（0-1）
    critDamage: number;  // 暴击伤害倍数
    lifesteal: number;   // 生命偷取（0-1）
}

@component({ name: 'Stats', pooled: true, poolSize: 100 })
export class StatsComponent extends Component {
    // 基础属性（从配置读取或初始化）
    base: StatsData = {
        attack: 10,
        defense: 5,
        speed: 100,
        maxHP: 100,
        critRate: 0.05,
        critDamage: 1.5,
        lifesteal: 0,
    };

    // 装备加成（固定值）
    equipment: Partial<StatsData> = {};

    // Buff 加成（固定值，可能为负）
    buffFixed: Partial<StatsData> = {};

    // Buff 百分比加成（0.2 表示 +20%）
    buffPercent: Partial<Record<keyof StatsData, number>> = {};

    // 升级加成（固定值）
    levelup: Partial<StatsData> = {};

    reset(): void {
        super.reset();
        this.base = {
            attack: 10,
            defense: 5,
            speed: 100,
            maxHP: 100,
            critRate: 0.05,
            critDamage: 1.5,
            lifesteal: 0,
        };
        this.equipment = {};
        this.buffFixed = {};
        this.buffPercent = {};
        this.levelup = {};
    }

    /**
     * 计算最终属性值
     * 公式：最终值 = (基础值 + 装备 + 固定Buff + 升级) * (1 + 百分比Buff)
     */
    getFinal(statName: keyof StatsData): number {
        const baseValue = this.base[statName] || 0;
        const equipmentValue = this.equipment[statName] || 0;
        const buffFixedValue = this.buffFixed[statName] || 0;
        const levelupValue = this.levelup[statName] || 0;
        const buffPercentValue = this.buffPercent[statName] || 0;

        // 计算公式
        const fixedSum = baseValue + equipmentValue + buffFixedValue + levelupValue;
        return fixedSum * (1 + buffPercentValue);
    }

    /**
     * 获取所有最终属性
     */
    getAllFinal(): StatsData {
        return {
            attack: this.getFinal('attack'),
            defense: this.getFinal('defense'),
            speed: this.getFinal('speed'),
            maxHP: this.getFinal('maxHP'),
            critRate: this.getFinal('critRate'),
            critDamage: this.getFinal('critDamage'),
            lifesteal: this.getFinal('lifesteal'),
        };
    }

    /**
     * 设置基础属性
     */
    setBase(stats: Partial<StatsData>): void {
        Object.assign(this.base, stats);
    }

    /**
     * 添加装备加成
     */
    addEquipmentBonus(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.equipment[statKey] || 0;
            this.equipment[statKey] = current + (bonus[statKey] || 0);
        });
    }

    /**
     * 移除装备加成
     */
    removeEquipmentBonus(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.equipment[statKey] || 0;
            this.equipment[statKey] = current - (bonus[statKey] || 0);
        });
    }

    /**
     * 添加 Buff 固定值加成
     */
    addBuffFixed(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.buffFixed[statKey] || 0;
            this.buffFixed[statKey] = current + (bonus[statKey] || 0);
        });
    }

    /**
     * 移除 Buff 固定值加成
     */
    removeBuffFixed(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.buffFixed[statKey] || 0;
            this.buffFixed[statKey] = current - (bonus[statKey] || 0);
        });
    }

    /**
     * 添加 Buff 百分比加成
     */
    addBuffPercent(bonus: Partial<Record<keyof StatsData, number>>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.buffPercent[statKey] || 0;
            this.buffPercent[statKey] = current + (bonus[statKey] || 0);
        });
    }

    /**
     * 移除 Buff 百分比加成
     */
    removeBuffPercent(bonus: Partial<Record<keyof StatsData, number>>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.buffPercent[statKey] || 0;
            this.buffPercent[statKey] = current - (bonus[statKey] || 0);
        });
    }

    /**
     * 添加升级加成
     */
    addLevelupBonus(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.levelup[statKey] || 0;
            this.levelup[statKey] = current + (bonus[statKey] || 0);
        });
    }

    /**
     * 移除升级加成
     */
    removeLevelupBonus(bonus: Partial<StatsData>): void {
        Object.keys(bonus).forEach(key => {
            const statKey = key as keyof StatsData;
            const current = this.levelup[statKey] || 0;
            this.levelup[statKey] = current - (bonus[statKey] || 0);
        });
    }
}
