/**
 * 事件总线
 * 
 * 用于 View → ECS 的事件传递
 * View 层通过此总线向 ECS 发送游戏事件
 */

import { Handle } from '@bl-framework/ecs';
import type { EquipmentSlotType } from '../data/configs/equipment';
import { SceneType } from '../app/SceneContext';
/**
 * 游戏事件类型
 * 
 * ⚠️ 关键修正：AnimationEvent 使用 Handle 而不是 entityId，避免异步事件错误
 */
export type GameplayEvent =
    | { type: 'AnimationEvent'; eventName: 'finished' | 'marker'; handle: Handle; data?: any }
    | { type: 'CollisionEvent'; entityA: number; entityB: number; data?: any }
    | { type: 'UIEvent'; eventName: string; data?: any }
    | { type: 'ViewEvent'; eventName: 'ViewSpawned' | 'ViewSpawnFailed'; entityId: number }
    | { type: 'LevelUp'; handle: Handle; oldLevel: number; newLevel: number; levelsGained: number }
    | { type: 'EquipmentChange'; handle: Handle; slotType: EquipmentSlotType; equipmentId: string; action: 'equip' | 'unequip' }
    | { type: 'EntityDeath'; handle: Handle; killerHandle?: Handle }

/**
 * 事件处理器类型
 */
type EventHandler = (event: GameplayEvent) => void;

/**
 * 事件总线
 * 
 * 收集所有 View 层产生的事件，每帧刷新到 ECS 系统
 */
export class EventBus {
    private events: GameplayEvent[] = [];
    private subscribers: Map<string, EventHandler[]> = new Map();

    /**
     * 发送事件
     */
    push(event: GameplayEvent): void {
        this.events.push(event);
    }

    /**
     * 订阅事件
     */
    subscribe(type: string, handler: EventHandler): void {
        if (!this.subscribers.has(type)) {
            this.subscribers.set(type, []);
        }
        this.subscribers.get(type)!.push(handler);
    }

    /**
     * 取消订阅
     */
    unsubscribe(type: string, handler: EventHandler): void {
        const handlers = this.subscribers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index >= 0) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 处理所有事件
     * 分发事件到订阅者
     */
    flush(): void {
        const events = this.events.slice();
        this.events = [];

        for (const event of events) {
            // 分发到特定类型订阅者
            const handlers = this.subscribers.get(event.type);
            if (handlers) {
                for (const handler of handlers) {
                    handler(event);
                }
            }

            // 分发到通用订阅者（订阅 '*' 类型）
            const allHandlers = this.subscribers.get('*');
            if (allHandlers) {
                for (const handler of allHandlers) {
                    handler(event);
                }
            }
        }
    }

    /**
     * 清空事件（不处理）
     */
    clear(): void {
        this.events = [];
    }

    /**
     * 获取当前事件数量
     */
    getEventCount(): number {
        return this.events.length;
    }
}

