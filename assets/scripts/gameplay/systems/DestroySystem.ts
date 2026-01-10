/**
 * 销毁系统
 * 
 * 处理实体销毁逻辑
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 通过 CommandBuffer 发送 DestroyView 命令
 * - 两阶段销毁：动画完成事件驱动 + DestroyTimer 兜底
 * 
 * 销毁触发条件：
 * 1. 动画完成事件：监听 'die' 动画完成
 * 2. DestroyTimer 到期：超时保护
 */

import { System, system, Handle } from '@bl-framework/ecs';
import { DeadTagComponent } from '../components/DeadTag';
import { DestroyTimerComponent } from '../components/DestroyTimer';
import { CommandBuffer } from '../../bridge/CommandBuffer';
import { EventBus, GameplayEvent } from '../../bridge/EventBus';

@system({ priority: 3 })
export class DestroySystem extends System {
    private commandBuffer?: CommandBuffer;
    private eventBus?: EventBus;

    /**
     * 设置 CommandBuffer（依赖注入）
     */
    setCommandBuffer(commandBuffer: CommandBuffer): void {
        this.commandBuffer = commandBuffer;
    }

    /**
     * 设置 EventBus（依赖注入）
     */
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        // 订阅动画完成事件
        this.eventBus.subscribe('AnimationEvent', this.handleAnimationEvent.bind(this));
    }

    onUpdate(dt: number): void {
        // 方式 1：检测 DestroyTimer 到期（超时保护）
        const timerQuery = this.world.createQuery({
            all: [DestroyTimerComponent, DeadTagComponent]
        });
        timerQuery.forEach(entity => {
            const timer = entity.getComponent(DestroyTimerComponent)!;
            timer.time -= dt;
            
            if (timer.isExpired) {
                // 超时销毁
                this.destroyEntity(entity);
            }
        });
    }

    /**
     * 处理动画完成事件
     * ⚠️ 关键：检查是否是 'die' 动画完成
     */
    private handleAnimationEvent(event: GameplayEvent): void {
        if (event.type === 'AnimationEvent' && event.eventName === 'finished') {
            const animName = event.data?.animName;
            
            // 只处理 'die' 动画完成事件
            if (animName === 'die' && event.handle) {
                // ⚠️ 关键：使用 Handle 获取实体（O(1) 操作）
                if (!this.world.isValidHandle(event.handle)) {
                    return;
                }

                const entity = this.world.getEntityByHandle(event.handle);
                if (!entity) return;

                // 检查是否有 DeadTag（必须是死亡实体）
                if (entity.hasComponent(DeadTagComponent)) {
                    // 动画完成，立即销毁
                    this.destroyEntity(entity);
                }
            }
        }
    }

    /**
     * 销毁实体
     * ⚠️ 关键：使用 Handle 而不是 entityId
     */
    private destroyEntity(entity: any): void {
        // 检查实体是否有效
        if (!this.world.isValidHandle(entity.handle)) {
            return;
        }

        // 检查是否有 DeadTag（必须是死亡实体）
        if (!entity.hasComponent(DeadTagComponent)) {
            return;
        }

        const handle = entity.handle;

        // 发送 DestroyView 命令（使用 Handle）
        if (this.commandBuffer) {
            this.commandBuffer.push({
                type: 'DestroyView',
                handle: handle
            });
        }

        // 销毁实体（ECS 会自动清理组件和引用）
        this.world.destroyEntity(entity.id);
    }
}
