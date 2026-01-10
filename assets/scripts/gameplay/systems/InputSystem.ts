/**
 * 输入系统
 * 
 * 处理玩家输入，将输入转换为游戏事件
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 输入通过 EventBus 传递到 ECS
 */

import { System, system } from '@bl-framework/ecs';
import { EventBus } from '../../bridge/EventBus';
import { VelocityComponent } from '../components/Velocity';
import { AnimationIntentComponent } from '../components/AnimationIntent';
import { SkillSlotsComponent } from '../components/SkillSlots';

@system({ priority: 0 })
export class InputSystem extends System {
    private eventBus?: EventBus;
    
    /** 输入状态缓存 */
    private inputState: {
        moveX: number;
        moveY: number;
        skillSlots: boolean[];
    } = {
        moveX: 0,
        moveY: 0,
        skillSlots: [false, false, false, false]
    };

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    onUpdate(dt: number): void {
        if (!this.eventBus) {
            console.warn('[InputSystem] EventBus not set');
            return;
        }

        // 处理输入事件（从 EventBus 读取）
        this.processInputEvents();

        // 应用输入到实体（查询玩家实体）
        this.applyInputToEntities();
    }

    /**
     * 处理输入事件
     */
    private processInputEvents(): void {
        if (!this.eventBus) return;

        // 从 EventBus 获取输入事件（这里简化处理，实际应该从 EventBus 读取）
        // 在实际实现中，View 层会通过 EventBus.push 发送输入事件
        // 这里假设输入已经通过外部系统（如 Cocos Creator 的输入系统）设置到 inputState
    }

    /**
     * 应用输入到实体
     */
    private applyInputToEntities(): void {
        // 查询玩家实体（有 Velocity 和 AnimationIntent 组件）
        const query = this.world.createQuery({
            all: [VelocityComponent, AnimationIntentComponent]
        });

        query.forEach(entity => {
            const velocity = entity.getComponent(VelocityComponent)!;
            const animIntent = entity.getComponent(AnimationIntentComponent)!;

            // 应用移动输入
            const moveSpeed = 100; // 基础移动速度
            velocity.vx = this.inputState.moveX * moveSpeed;
            velocity.vy = this.inputState.moveY * moveSpeed;

            // 更新动画意图
            if (this.inputState.moveX !== 0 || this.inputState.moveY !== 0) {
                animIntent.setContinuousIntent('move', { speed: Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy) });
            } else {
                animIntent.setContinuousIntent('idle');
            }

            // 处理技能输入
            const skillSlots = entity.getComponent(SkillSlotsComponent);
            if (skillSlots) {
                for (let i = 0; i < this.inputState.skillSlots.length; i++) {
                    if (this.inputState.skillSlots[i]) {
                        // 触发技能动画意图
                        animIntent.trigger(`skill_${i}`);
                        this.inputState.skillSlots[i] = false; // 清除输入状态
                    }
                }
            }
        });
    }

    /**
     * 设置移动输入（由外部系统调用，如 Cocos Creator 输入系统）
     * @param x X 方向输入（-1 到 1）
     * @param y Y 方向输入（-1 到 1）
     */
    setMoveInput(x: number, y: number): void {
        this.inputState.moveX = x;
        this.inputState.moveY = y;
    }

    /**
     * 触发技能输入（由外部系统调用）
     * @param slotIndex 技能槽位索引
     */
    triggerSkill(slotIndex: number): void {
        if (slotIndex >= 0 && slotIndex < this.inputState.skillSlots.length) {
            this.inputState.skillSlots[slotIndex] = true;
        }
    }
}
