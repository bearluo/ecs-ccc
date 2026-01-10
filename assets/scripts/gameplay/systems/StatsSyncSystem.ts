/**
 * 属性同步系统
 * 
 * 负责将 StatsComponent 的属性同步到相关组件
 * - 同步 maxHP 到 HPComponent.max
 * - 可选：同步 speed 到 VelocityComponent（通过限制最大速度）
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 优先级设置为 3（在 MoveSystem 之后，CombatSystem 之前）
 */

import { System, system } from '@bl-framework/ecs';
import { StatsComponent } from '../components/Stats';
import { HPComponent } from '../components/HP';
import { VelocityComponent } from '../components/Velocity';

@system({ priority: 3 })
export class StatsSyncSystem extends System {
    onUpdate(dt: number): void {
        // 同步 maxHP 到 HPComponent
        const hpQuery = this.world.createQuery({
            all: [StatsComponent, HPComponent]
        });

        hpQuery.forEach(entity => {
            const stats = entity.getComponent(StatsComponent)!;
            const hp = entity.getComponent(HPComponent)!;
            const newMaxHP = stats.getFinal('maxHP');

            if (hp.max !== newMaxHP) {
                // 按比例调整当前生命值（保持生命值百分比）
                const ratio = hp.max > 0 ? hp.cur / hp.max : 1;
                hp.max = newMaxHP;
                hp.cur = newMaxHP * ratio;

                // 确保当前生命值不超过最大值
                if (hp.cur > hp.max) {
                    hp.cur = hp.max;
                }
            }
        });

        // 可选：同步 speed 到 VelocityComponent（限制最大速度）
        // 注意：VelocityComponent 存储的是速度向量，这里只限制速度大小
        const speedQuery = this.world.createQuery({
            all: [StatsComponent, VelocityComponent]
        });

        speedQuery.forEach(entity => {
            const stats = entity.getComponent(StatsComponent)!;
            const velocity = entity.getComponent(VelocityComponent)!;
            const maxSpeed = stats.getFinal('speed');

            // 计算当前速度大小
            const currentSpeed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);

            // 如果当前速度超过最大速度，按比例缩放
            if (currentSpeed > maxSpeed && currentSpeed > 0) {
                const scale = maxSpeed / currentSpeed;
                velocity.vx *= scale;
                velocity.vy *= scale;
            }
        });
    }
}
