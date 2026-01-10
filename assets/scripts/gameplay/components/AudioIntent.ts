/**
 * 音效意图组件
 * 
 * Fixed Systems 通过此组件表达音效播放意图，RenderSyncSystem 读取并生成命令
 * 
 * ⚠️ 架构约束：唯一出口规则
 * 
 * ❌ 禁止：SkillSystem / DeathSystem 等 Fixed Systems 直接调用 AudioDriver
 * ✅ 允许：只能添加 AudioIntentComponent
 * ✅ 唯一处理者：RenderSyncSystem 负责读取意图并生成 PlaySFX / PlayBGM 命令
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'AudioIntent', pooled: true, poolSize: 100 })
export class AudioIntentComponent extends Component {
    /** 音效配置键 */
    sfxKey: string | null = null;
    
    /** 背景音乐配置键 */
    bgmKey: string | null = null;
    
    /** 音量（0-1），如果不提供则使用配置默认值 */
    volume?: number;
    
    /** BGM 是否循环（仅对 BGM 有效） */
    bgmLoop?: boolean;
    
    reset(): void {
        super.reset();
        this.sfxKey = null;
        this.bgmKey = null;
        this.volume = undefined;
        this.bgmLoop = undefined;
    }
}
