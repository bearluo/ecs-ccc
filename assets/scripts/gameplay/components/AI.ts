/**
 * AI 组件
 * 
 * 存储 AI 实体的行为状态和目标信息
 * 
 * 设计决策：使用状态机模式，支持 idle、patrol、chase、attack、flee 等状态
 * 参考文档：memory-bank/creative/creative-ai-system.md
 * 
 * ⚠️ 使用 Handle 系统：targetHandle 使用框架提供的 Handle 防止实体 ID 复用问题
 * 参考文档：memory-bank/creative/creative-entity-handle.md
 */

import { Component, component, Handle } from '@bl-framework/ecs';

@component({ name: 'AI', pooled: true, poolSize: 50 })
export class AIComponent extends Component {
    /** AI 类型（如 'patrol', 'chase', 'attack'） */
    type: string = 'patrol';
    
    /** 当前状态 */
    state: string = 'idle';
    
    /** 目标实体 Handle（null 表示无目标） */
    targetHandle: Handle | null = null;
    
    /** 感知范围 */
    perceptionRange: number = 200;
    
    /** 攻击范围 */
    attackRange: number = 50;
    
    /** 状态持续时间（秒） */
    stateTimer: number = 0;
    
    /** 状态参数 */
    stateParams: Record<string, any> = {};
    
    reset(): void {
        super.reset();
        this.type = 'patrol';
        this.state = 'idle';
        this.targetHandle = null;
        this.perceptionRange = 200;
        this.attackRange = 50;
        this.stateTimer = 0;
        this.stateParams = {};
    }
}
