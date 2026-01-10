/**
 * 命令缓冲区
 * 
 * 用于 ECS → View 的命令传递
 * 所有 ECS 系统通过此缓冲区向 View 层发送渲染指令
 * 
 * ⚠️ 关键修正：使用 Handle 而不是 entityId，避免异步操作错误
 */

import { Handle } from '@bl-framework/ecs';

/**
 * 渲染命令类型
 * 
 * ⚠️ 关键修正：使用 Handle 而不是 entityId，避免异步操作错误
 */
export type RenderCommand =
    | { type: 'SpawnView'; handle: Handle; prefabKey: string }
    | { type: 'SetPosition'; handle: Handle; x: number; y: number }
    | { type: 'PlayAnim'; handle: Handle; animName: string }
    | { type: 'PlayFxAtPosition'; fxKey: string; position: { x: number; y: number } }
    | { type: 'PlayFxOnEntity'; fxKey: string; handle: Handle }
    | { type: 'PlaySFX'; sfxKey: string; volume?: number }
    | { type: 'PlayBGM'; bgmKey: string; loop?: boolean; volume?: number }
    | { type: 'DestroyView'; handle: Handle };

/**
 * 命令缓冲区
 * 
 * 收集所有 ECS 系统产生的渲染命令，每帧刷新到 ViewManager
 */
export class CommandBuffer {
    private commands: RenderCommand[] = [];

    /**
     * 添加命令
     */
    push(command: RenderCommand): void {
        this.commands.push(command);
    }

    /**
     * 清空并返回所有命令
     * 用于每帧刷新到 ViewManager
     */
    flush(): RenderCommand[] {
        const result = this.commands.map(cmd => ({ ...cmd }));
        this.commands = [];
        return result;
    }

    /**
     * 清空命令（不返回）
     */
    clear(): void {
        this.commands = [];
    }

    /**
     * 获取当前命令数量
     */
    getCount(): number {
        return this.commands.length;
    }
}

