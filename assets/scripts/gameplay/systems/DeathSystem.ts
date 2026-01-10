/**
 * 死亡系统
 * 
 * 检测死亡并添加死亡标记
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 */

import { System, system } from '@bl-framework/ecs';
import { HPComponent } from '../components/HP';
import { DeadTagComponent } from '../components/DeadTag';
import { DestroyTimerComponent } from '../components/DestroyTimer';
import { AnimationIntentComponent } from '../components/AnimationIntent';

@system({ priority: 2 })
export class DeathSystem extends System {
    /** 默认销毁延迟时间（秒）- 超时保护 */
    private defaultDestroyDelay: number = 3.0;

    onUpdate(dt: number): void {
        // 查询所有有生命值但没有死亡标记的实体
        const query = this.world.createQuery({
            all: [HPComponent],
            none: [DeadTagComponent]
        });

        query.forEach(entity => {
            const hp = entity.getComponent(HPComponent)!;

            // 检测死亡
            if (hp.isDead) {
                // 添加死亡标记
                entity.addComponent(DeadTagComponent);
                
                // 设置死亡动画意图（通过 AnimationIntent，由 AnimationIntentSystem 处理）
                // ⚠️ 架构：遵循唯一写入路径规则，不直接修改 AnimState
                const animIntent = entity.getComponent(AnimationIntentComponent);
                if (animIntent) {
                    animIntent.trigger('die');
                }
                
                // 添加销毁计时器（超时保护）
                // ⚠️ 架构：两阶段销毁 + 超时保护
                // 优先使用动画完成事件，DestroyTimer 作为兜底
                const timer = entity.addComponent(DestroyTimerComponent);
                timer.setTime(this.defaultDestroyDelay);
            }
        });
    }
}

