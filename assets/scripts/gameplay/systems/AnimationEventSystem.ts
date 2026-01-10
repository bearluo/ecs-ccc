/**
 * 动画事件系统
 * 
 * ⚠️ 关键修正：
 * - 使用 world.getEntityByHandle (O(1)) 而不是遍历 Query
 * - 处理动画完成事件，解锁 AnimState.locked
 * - 只有当前动画匹配时才解锁（防止异步事件导致的状态错误）
 */

import { System, system, Handle } from '@bl-framework/ecs';
import { AnimStateComponent } from '../components/AnimState';
import { EventBus, GameplayEvent } from '../../bridge/EventBus';

@system({ priority: 5 })
export class AnimationEventSystem extends System {
    private eventBus?: EventBus;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.eventBus.subscribe('AnimationEvent', this.handleAnimationEvent.bind(this));
    }

    private handleAnimationEvent(event: GameplayEvent): void {
        if (event.type === 'AnimationEvent') {
            // ⚠️ 关键：使用 Handle 获取实体（O(1) 操作）
            if (!event.handle || !this.world.isValidHandle(event.handle)) {
                return;
            }

            const entity = this.world.getEntityByHandle(event.handle);
            if (!entity) return;

            const animState = entity.getComponent(AnimStateComponent);
            if (!animState) return;

            if (event.eventName === 'finished') {
                // 动画完成事件
                const animName = event.data?.animName;
                
                // 只有当前动画匹配时才解锁（防止异步事件导致的状态错误）
                if (animName && animState.current === animName && animState.locked) {
                    animState.locked = false;
                }
            } else if (event.eventName === 'marker') {
                // 动画事件点（如 'hit'、'footstep'）
                // 可以触发其他系统（如伤害判定、音效等）
                // 这里只处理通用逻辑，具体业务由其他系统处理
                const marker = event.data?.marker;
                // TODO: 可以在这里触发其他事件或系统
            }
        }
    }
}
