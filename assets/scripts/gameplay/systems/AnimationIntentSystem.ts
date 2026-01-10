/**
 * 动画意图系统
 * 
 * ⚠️ 架构约束：唯一写入路径规则
 * 
 * ✅ 这是唯一能修改 AnimState 的系统
 * ✅ 读取 AnimationIntent 组件，更新 AnimState 组件
 * 
 * 原因：保证逻辑层（Fixed）和表现层（Render）的清晰分离
 * - Fixed Systems 只负责玩法逻辑，通过 AnimationIntent 表达意图
 * - Render Systems 负责将意图转换为实际的动画状态
 */

import { System, system } from '@bl-framework/ecs';
import { AnimationIntentComponent } from '../components/AnimationIntent';
import { AnimStateComponent } from '../components/AnimState';

@system({ priority: 100 })
export class AnimationIntentSystem extends System {
    /** 动画优先级映射（数字越大优先级越高） */
    private static readonly ANIM_PRIORITIES: Record<string, number> = {
        'idle': 0,
        'move': 10,
        'run': 10,
        'attack': 50,
        'skill': 50,
        'hurt': 40,
        'die': 100
    };

    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [AnimationIntentComponent, AnimStateComponent]
        });

        query.forEach(entity => {
            const animIntent = entity.getComponent(AnimationIntentComponent)!;
            const animState = entity.getComponent(AnimStateComponent)!;

            // 如果动画被锁定，不更新（等待动画完成）
            if (animState.locked) {
                return;
            }

            // 优先处理触发意图（一次性动画，如 attack、hurt、die）
            if (animIntent.triggerIntent) {
                const triggerAnim = animIntent.triggerIntent;
                const triggerPriority = this.getPriority(triggerAnim);
                const currentPriority = this.getPriority(animState.current);

                // 如果触发动画优先级更高，切换动画并锁定
                if (triggerPriority > currentPriority) {
                    animState.current = triggerAnim;
                    animState.locked = true; // ⚠️ 关键：自动锁定，等待动画完成
                    
                    // 从参数中读取动画速度（如果有）
                    if (animIntent.params.speed !== undefined) {
                        animState.speed = animIntent.params.speed;
                    }
                }

                // 清除触发意图（已处理）
                animIntent.clearTrigger();
            } else {
                // 处理持续意图（如 move、idle）
                const continuousAnim = animIntent.continuousIntent;
                const continuousPriority = this.getPriority(continuousAnim);
                const currentPriority = this.getPriority(animState.current);

                // 如果持续动画优先级更高，切换动画
                if (continuousPriority > currentPriority) {
                    animState.current = continuousAnim;
                    
                    // 从参数中读取动画速度（如果有）
                    if (animIntent.params.speed !== undefined) {
                        animState.speed = animIntent.params.speed;
                    }
                }
            }
        });
    }

    /**
     * 获取动画优先级
     * @param animName 动画名称
     * @returns 优先级（默认 0）
     */
    private getPriority(animName: string): number {
        return AnimationIntentSystem.ANIM_PRIORITIES[animName] || 0;
    }
}
