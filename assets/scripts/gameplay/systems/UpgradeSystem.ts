/**
 * 升级系统
 * 
 * 处理经验值获取和升级逻辑
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 被动系统，只处理外部调用
 * - 支持经验值倍率（从 Buff 获取）
 * - 升级时添加属性加成到 StatsComponent
 * 
 * 设计决策：被动系统（只处理外部调用）+ 可选事件支持
 * 参考文档：memory-bank/creative/creative-upgrade-system.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { LevelExperienceComponent } from '../components/LevelExperience';
import { StatsComponent } from '../components/Stats';
import { BuffListComponent } from '../components/BuffList';
import { EventBus } from '../../bridge/EventBus';
import { Handle } from '@bl-framework/ecs';
import type { StatsData } from '../components/Stats';

@system({ priority: 5 })  // 在 StatsSyncSystem 之后
export class UpgradeSystem extends System {
    private eventBus?: EventBus;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 添加经验值（外部调用）
     * @param entity 目标实体
     * @param amount 经验值数量
     * @param source 来源（可选，如 'kill', 'quest', 'item'）
     */
    addExperience(entity: Entity, amount: number, source?: string): void {
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (!levelExp) return;

        // 应用经验值倍率（从 Buff 或其他来源）
        const multiplier = this.getExperienceMultiplier(entity);
        const finalAmount = amount * multiplier;

        // 记录升级前的等级
        const oldLevel = levelExp.level;

        // 添加经验值（组件内部处理升级）
        const levelsGained = levelExp.addExp(finalAmount);

        // 如果升级了，处理升级逻辑
        if (levelsGained > 0) {
            this.handleLevelUp(entity, oldLevel, levelExp.level, levelsGained);
        }
    }

    /**
     * 处理升级逻辑
     */
    private handleLevelUp(entity: Entity, oldLevel: number, newLevel: number, levelsGained: number): void {
        const stats = entity.getComponent(StatsComponent);
        if (!stats) return;

        // 从配置读取每级属性加成（或使用默认值）
        const bonusPerLevel = this.getBonusPerLevel(entity);
        
        // 添加多级属性加成
        for (let i = 0; i < levelsGained; i++) {
            stats.addLevelupBonus(bonusPerLevel);
        }

        // 发送升级事件（用于 UI 显示、特效播放等）
        if (this.eventBus) {
            this.eventBus.push({
                type: 'LevelUp',
                handle: entity.handle,
                oldLevel,
                newLevel,
                levelsGained
            });
        }
    }

    /**
     * 获取经验值倍率（从 Buff 或其他来源）
     */
    private getExperienceMultiplier(entity: Entity): number {
        // 可以从 BuffListComponent 中查找经验值倍率 Buff
        const buffList = entity.getComponent(BuffListComponent);
        if (!buffList) return 1.0;

        const expBuff = buffList.findBuff('exp_boost');
        if (expBuff && expBuff.params.value) {
            return 1.0 + expBuff.params.value; // 例如：value: 0.2 表示 +20%
        }

        return 1.0;
    }

    /**
     * 获取每级属性加成（从配置或使用默认值）
     */
    private getBonusPerLevel(entity: Entity): Partial<StatsData> {
        // 可以从配置读取（根据实体类型）
        // 或使用默认值
        return {
            attack: 2,
            defense: 1,
            maxHP: 10,
        };
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有逻辑通过外部调用触发
    }
}
