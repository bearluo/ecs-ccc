/**
 * 等级和经验组件
 * 
 * 合并等级和经验值的管理
 * 支持经验值增长和升级检测
 * 
 * ⚠️ 架构约束：
 * - 纯数据组件，可序列化
 * - 不直接操作 View 层
 * - 升级逻辑在组件内部，支持连续升级
 * 
 * 设计决策：合并为 LevelExperienceComponent（等级和经验统一管理）
 * 参考文档：memory-bank/creative/creative-level-experience.md
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'LevelExperience', pooled: true, poolSize: 100 })
export class LevelExperienceComponent extends Component {
    /** 当前等级 */
    level: number = 1;
    
    /** 最大等级 */
    maxLevel: number = 100;
    
    /** 当前经验值 */
    exp: number = 0;
    
    /** 当前等级升级所需经验值 */
    expRequired: number = 100;
    
    /** 累计总经验值 */
    totalExp: number = 0;

    reset(): void {
        super.reset();
        this.level = 1;
        this.maxLevel = 100;
        this.exp = 0;
        this.expRequired = 100;
        this.totalExp = 0;
    }

    /**
     * 计算指定等级升级所需经验值（简单二次曲线）
     * @param level 等级
     * @returns 所需经验值
     */
    private calculateRequiredExp(level: number): number {
        const base = 100;
        return base * level * level;
    }

    /**
     * 添加经验值
     * @param amount 经验值数量
     * @returns 升级的等级数（0 表示未升级）
     */
    addExp(amount: number): number {
        if (amount <= 0) return 0;
        if (this.isMaxLevel) return 0;

        this.exp += amount;
        this.totalExp += amount;
        
        let levelsGained = 0;
        
        // 支持连续升级（一次获得大量经验可能连升多级）
        while (this.exp >= this.expRequired && !this.isMaxLevel) {
            this.exp -= this.expRequired;
            this.level++;
            levelsGained++;
            
            // 如果未达到最大等级，计算新的升级所需经验值
            if (!this.isMaxLevel) {
                this.expRequired = this.calculateRequiredExp(this.level);
            }
        }
        
        return levelsGained;
    }

    /**
     * 获取经验值百分比（0-1）
     */
    get expPercentage(): number {
        return this.expRequired > 0 ? this.exp / this.expRequired : 1;
    }

    /**
     * 是否达到最大等级
     */
    get isMaxLevel(): boolean {
        return this.maxLevel > 0 && this.level >= this.maxLevel;
    }
}
