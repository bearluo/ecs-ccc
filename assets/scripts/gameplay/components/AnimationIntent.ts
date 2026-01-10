/**
 * 动画意图组件
 * 
 * Fixed Systems 通过此组件表达动画意图，AnimationIntentSystem 读取并更新 AnimState
 * 
 * ⚠️ 架构约束：唯一写入路径规则
 * 
 * ❌ 禁止：MoveSystem / CombatSystem / SkillSystem 等 Fixed Systems 直接修改 AnimState
 * ✅ 允许：只能写入 AnimationIntent 组件
 * ✅ 唯一写入者：AnimationIntentSystem（Render System，priority: 100+）负责读取意图并更新 AnimState
 * 
 * 设计决策：使用持续意图 + 触发意图的设计，符合架构约束
 * 参考文档：memory-bank/creative/creative-animation-intent.md
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'AnimationIntent', pooled: true, poolSize: 100 })
export class AnimationIntentComponent extends Component {
    /** 持续动画意图（如 move、idle） */
    continuousIntent: string = 'idle';
    
    /** 触发动画意图（一次性，如 attack、hurt） */
    triggerIntent: string | null = null;
    
    /** 动画参数 */
    params: Record<string, any> = {};

    /**
     * 设置持续意图
     * @param intent 动画意图名称
     * @param params 动画参数（可选）
     */
    setContinuousIntent(intent: string, params?: Record<string, any>): void {
        this.continuousIntent = intent;
        if (params) {
            Object.assign(this.params, params);
        }
    }

    /**
     * 触发一次性动画
     * @param intent 动画意图名称
     * @param params 动画参数（可选）
     */
    trigger(intent: string, params?: Record<string, any>): void {
        this.triggerIntent = intent;
        if (params) {
            Object.assign(this.params, params);
        }
    }

    /**
     * 清除触发意图（由 AnimationIntentSystem 调用）
     */
    clearTrigger(): void {
        this.triggerIntent = null;
    }

    reset(): void {
        super.reset();
        this.continuousIntent = 'idle';
        this.triggerIntent = null;
        this.params = {};
    }
}
