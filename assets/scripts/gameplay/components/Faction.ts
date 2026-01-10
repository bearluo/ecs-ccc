/**
 * 阵营组件
 * 
 * 存储实体的阵营信息，用于区分敌友
 */

import { Component, component } from '@bl-framework/ecs';

/**
 * 阵营类型
 */
export enum FactionType {
    Player = 1,      // 玩家
    Enemy = 2,      // 敌人
    Neutral = 3,    // 中立
    Ally = 4        // 盟友
}

@component({ name: 'Faction', pooled: true, poolSize: 100 })
export class FactionComponent extends Component {
    /** 阵营类型 */
    faction: FactionType = FactionType.Neutral;

    /**
     * 检查是否敌对
     * @param other 其他阵营
     * @returns 是否敌对
     */
    isHostile(other: FactionType): boolean {
        if (this.faction === FactionType.Neutral) return false;
        if (other === FactionType.Neutral) return false;
        
        // 玩家 vs 敌人
        if (this.faction === FactionType.Player && other === FactionType.Enemy) return true;
        if (this.faction === FactionType.Enemy && other === FactionType.Player) return true;
        
        // 盟友不敌对
        if (this.faction === FactionType.Ally && other === FactionType.Player) return false;
        if (this.faction === FactionType.Player && other === FactionType.Ally) return false;
        
        return false;
    }

    reset(): void {
        super.reset();
        this.faction = FactionType.Neutral;
    }
}
