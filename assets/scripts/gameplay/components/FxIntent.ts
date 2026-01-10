/**
 * 特效意图组件
 * 
 * Fixed Systems 通过此组件表达特效播放意图，RenderSyncSystem 读取并生成命令
 * 
 * ⚠️ 架构约束：唯一出口规则
 * 
 * ❌ 禁止：SkillSystem / CombatSystem 等 Fixed Systems 直接调用 FxDriver
 * ✅ 允许：只能添加 FxIntentComponent
 * ✅ 唯一处理者：RenderSyncSystem 负责读取意图并生成 PlayFxAtPosition / PlayFxOnEntity 命令
 */

import { Component, component } from '@bl-framework/ecs';
import { Handle } from '@bl-framework/ecs';

@component({ name: 'FxIntent', pooled: true, poolSize: 100 })
export class FxIntentComponent extends Component {
    /** 特效配置键（从配置中查找特效） */
    fxKey: string | null = null;
    
    /** 播放位置（世界坐标），如果提供则在此位置播放 */
    position?: { x: number; y: number };
    
    /** 目标实体 Handle（如果提供则在目标位置播放） */
    targetHandle?: Handle;
    
    reset(): void {
        super.reset();
        this.fxKey = null;
        this.position = undefined;
        this.targetHandle = undefined;
    }
}
