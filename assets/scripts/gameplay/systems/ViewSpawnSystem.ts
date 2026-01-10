/**
 * 视图生成系统
 * 
 * 处理视图创建确认事件，设置 viewId
 * 
 * ⚠️ 架构约束：
 * - Fixed System，可以修改组件数据
 * - 监听 ViewEvent 事件，处理视图创建确认
 */

import { System, system } from '@bl-framework/ecs';
import { ViewLinkComponent } from '../components/ViewLink';
import { NeedViewTagComponent } from '../components/NeedViewTag';
import { EventBus, GameplayEvent } from '../../bridge/EventBus';

@system({ priority: 4 })
export class ViewSpawnSystem extends System {
    private eventBus?: EventBus;

    /**
     * 设置 EventBus（依赖注入）
     */
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.eventBus.subscribe('ViewEvent', this.handleViewEvent.bind(this));
    }

    /**
     * 处理视图事件
     */
    private handleViewEvent(event: GameplayEvent): void {
        if (event.type === 'ViewEvent') {
            // 通过查询找到对应的实体
            const query = this.world.createQuery({ all: [] });
            let targetEntity = null;
            query.forEach(entity => {
                if (entity.id === event.entityId) {
                    targetEntity = entity;
                }
            });

            if (!targetEntity) {
                console.warn(`[ViewSpawnSystem] Entity ${event.entityId} not found`);
                return;
            }

            if (event.eventName === 'ViewSpawned') {
                // 视图创建成功，设置 viewId
                const viewLink = targetEntity.getComponent(ViewLinkComponent);
                if (viewLink && viewLink.viewId === 0) {
                    viewLink.viewId = event.entityId;
                }
            } else if (event.eventName === 'ViewSpawnFailed') {
                // 视图创建失败，重新添加 NeedViewTag 允许重试
                if (!targetEntity.hasComponent(NeedViewTagComponent)) {
                    this.world.addComponent(targetEntity.id, NeedViewTagComponent);
                }
                console.warn(`[ViewSpawnSystem] Failed to spawn view for entity ${event.entityId}`);
            }
        }
    }
}
