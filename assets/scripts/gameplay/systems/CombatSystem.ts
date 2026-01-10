/**
 * 战斗系统
 * 
 * 处理碰撞检测和伤害计算
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 * - 伤害计算使用 StatsComponent（攻击和防御）
 */

import { System, system } from '@bl-framework/ecs';
import { TransformComponent } from '../components/Transform';
import { HPComponent } from '../components/HP';
import { StatsComponent } from '../components/Stats';
import { FactionComponent, FactionType } from '../components/Faction';

@system({ priority: 1 })
export class CombatSystem extends System {
    /** 碰撞检测半径（简化版：圆形碰撞） */
    private collisionRadius: number = 50;

    onUpdate(dt: number): void {
        // 查询所有有位置和生命值的实体（可选：有 Stats 和 Faction 组件）
        const query = this.world.createQuery({
            all: [TransformComponent, HPComponent]
        });

        const entities = query.getEntities();

        // 简单的碰撞检测（圆形碰撞）
        for (let i = 0; i < entities.length; i++) {
            const entityA = entities[i];
            const transformA = entityA.getComponent(TransformComponent)!;
            const hpA = entityA.getComponent(HPComponent)!;
            const statsA = entityA.getComponent(StatsComponent);
            const factionA = entityA.getComponent(FactionComponent);

            // 跳过已死亡的实体
            if (hpA.isDead) continue;

            for (let j = i + 1; j < entities.length; j++) {
                const entityB = entities[j];
                const transformB = entityB.getComponent(TransformComponent)!;
                const hpB = entityB.getComponent(HPComponent)!;
                const statsB = entityB.getComponent(StatsComponent);
                const factionB = entityB.getComponent(FactionComponent);

                // 跳过已死亡的实体
                if (hpB.isDead) continue;

                // 阵营检测：只有不同阵营才会互相攻击
                if (factionA && factionB && factionA.faction === factionB.faction) {
                    continue;
                }

                // 计算距离
                const dx = transformB.x - transformA.x;
                const dy = transformB.y - transformA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 碰撞检测
                if (distance < this.collisionRadius * 2) {
                    // 使用 Stats 组件计算伤害
                    // 伤害公式：最终伤害 = 攻击力 - 防御力（至少造成 1 点伤害）
                    const attackA = statsA ? statsA.getFinal('attack') : 10;
                    const defenseB = statsB ? statsB.getFinal('defense') : 0;
                    const damageA = Math.max(1, attackA - defenseB);

                    const attackB = statsB ? statsB.getFinal('attack') : 10;
                    const defenseA = statsA ? statsA.getFinal('defense') : 0;
                    const damageB = Math.max(1, attackB - defenseA);

                    // 应用伤害
                    hpA.cur = Math.max(0, hpA.cur - damageB);
                    hpB.cur = Math.max(0, hpB.cur - damageA);
                }
            }
        }
    }
}

