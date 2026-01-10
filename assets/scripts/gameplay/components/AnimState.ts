/**
 * 动画状态组件
 * 
 * ⚠️ 架构约束：唯一写入路径规则
 * 
 * ❌ 禁止：MoveSystem / CombatSystem / SkillSystem 等 Fixed Systems 直接修改 AnimState
 * ✅ 允许：只能写入 AnimationIntent 或 Tag 组件
 * ✅ 唯一写入者：AnimationIntentSystem（Render System，priority: 100+）
 * 
 * 原因：保证逻辑层（Fixed）和表现层（Render）的清晰分离
 * - Fixed Systems 只负责玩法逻辑，通过 AnimationIntent 表达意图
 * - Render Systems 负责将意图转换为实际的动画状态
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'AnimState', pooled: true, poolSize: 100 })
export class AnimStateComponent extends Component {
    current: string = 'idle';
    locked: boolean = false;
    speed: number = 1.0;
    /** 上一次发送到 View 层的动画名称（用于优化，避免重复发送相同动画命令） */
    lastSentAnim: string = '';

    reset(): void {
        super.reset();
        this.current = 'idle';
        this.locked = false;
        this.speed = 1.0;
        this.lastSentAnim = '';
    }
}

