/**
 * 渲染同步系统
 * 
 * ⚠️ 架构约束：唯一出口规则
 * 
 * ✅ 所有 ECS → View 的行为，必须通过 RenderSyncSystem 产出 RenderCommand
 * 
 * ❌ 禁止：SkillSystem 直接 play FX
 * ❌ 禁止：CombatSystem 直接操作 ViewManager
 * ❌ 禁止：任何 Fixed System 直接操作 View 层
 * 
 * ✅ 正确流程：
 *    Fixed System → 修改组件数据 → RenderSyncSystem → CommandBuffer → ViewManager
 * 
 * 原因：保证 3 个月后架构还"干净"，避免系统间直接耦合
 */

import { System, system } from '@bl-framework/ecs';
import { TransformComponent } from '../components/Transform';
import { AnimStateComponent } from '../components/AnimState';
import { ViewLinkComponent } from '../components/ViewLink';
import { DeadTagComponent } from '../components/DeadTag';
import { NeedViewTagComponent } from '../components/NeedViewTag';
import { FxIntentComponent } from '../components/FxIntent';
import { AudioIntentComponent } from '../components/AudioIntent';
import { CommandBuffer } from '../../bridge/CommandBuffer';

@system({ priority: 100 })
export class RenderSyncSystem extends System {
    private commandBuffer?: CommandBuffer;

    /**
     * 设置 CommandBuffer（依赖注入）
     * 必须在系统注册后调用
     */
    setCommandBuffer(commandBuffer: CommandBuffer): void {
        this.commandBuffer = commandBuffer;
    }

    onUpdate(dt: number): void {
        if (!this.commandBuffer) {
            console.warn('[RenderSyncSystem] CommandBuffer not set');
            return;
        }

        // NeedViewTag → SpawnView 命令（检测需要创建视图的实体）
        const spawnQuery = this.world.createQuery({
            all: [ViewLinkComponent, NeedViewTagComponent]
        });
        spawnQuery.forEach(entity => {
            const viewLink = entity.getComponent(ViewLinkComponent)!;
            
            if (viewLink.prefabKey) {
                // 发送 SpawnView 命令（使用 Handle）
                this.commandBuffer.push({
                    type: 'SpawnView',
                    handle: entity.handle,
                    prefabKey: viewLink.prefabKey
                });
                
                // 移除 Tag，避免重复发送命令
                this.world.removeComponent(entity.id, NeedViewTagComponent);
            }
        });

        // Transform → SetPosition 命令
        const transformQuery = this.world.createQuery({
            all: [TransformComponent, ViewLinkComponent]
        });
        transformQuery.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            const viewLink = entity.getComponent(ViewLinkComponent)!;

            if (viewLink.viewId > 0) {
                this.commandBuffer.push({
                    type: 'SetPosition',
                    handle: entity.handle,
                    x: transform.x,
                    y: transform.y
                });
            }
        });

        // AnimState → PlayAnim 命令（只在动画改变时发送）
        // ⚠️ 性能优化：避免每帧重复发送相同动画命令
        const animQuery = this.world.createQuery({
            all: [AnimStateComponent, ViewLinkComponent]
        });
        animQuery.forEach(entity => {
            const animState = entity.getComponent(AnimStateComponent)!;
            const viewLink = entity.getComponent(ViewLinkComponent)!;

            if (viewLink.viewId > 0) {
                // ⚠️ 关键优化：只在动画改变时发送命令，避免重复播放相同动画
                if (animState.current !== animState.lastSentAnim) {
                    this.commandBuffer.push({
                        type: 'PlayAnim',
                        handle: entity.handle,
                        animName: animState.current
                    });
                    // 更新记录（同步到组件状态）
                    animState.lastSentAnim = animState.current;
                }
            }
        });

        // DeadTag → 已通过 AnimState → PlayAnim 命令处理（不再单独处理）
        // ⚠️ 架构：两阶段销毁
        // 阶段 1：DeathSystem 设置死亡动画意图 → AnimationIntentSystem 更新 AnimState → RenderSyncSystem 发送 PlayAnim('die')
        // 阶段 2：由 DestroySystem 在动画完成或超时后销毁
        // 注意：这里不再单独处理 DeadTag，因为 AnimState 已经通过 AnimationIntentSystem 更新为 'die'

        // FxIntent → PlayFxAtPosition / PlayFxOnEntity 命令
        const fxQuery = this.world.createQuery({
            all: [FxIntentComponent]
        });
        fxQuery.forEach(entity => {
            const fxIntent = entity.getComponent(FxIntentComponent)!;
            
            if (fxIntent.fxKey) {
                // 优先级：position > targetHandle > 当前实体位置
                if (fxIntent.position) {
                    // 情况 1：明确指定了位置坐标 → PlayFxAtPosition
                    this.commandBuffer.push({
                        type: 'PlayFxAtPosition',
                        fxKey: fxIntent.fxKey,
                        position: fxIntent.position
                    });
                } else if (fxIntent.targetHandle) {
                    // 情况 2：指定了目标实体 → PlayFxOnEntity
                    if (this.world.isValidHandle(fxIntent.targetHandle)) {
                        this.commandBuffer.push({
                            type: 'PlayFxOnEntity',
                            fxKey: fxIntent.fxKey,
                            handle: fxIntent.targetHandle
                        });
                    }
                } else {
                    // 情况 3：使用当前实体位置 → PlayFxOnEntity
                    this.commandBuffer.push({
                        type: 'PlayFxOnEntity',
                        fxKey: fxIntent.fxKey,
                        handle: entity.handle
                    });
                }
                
                // 移除组件（一次性意图）
                this.world.removeComponent(entity.id, FxIntentComponent);
            }
        });

        // AudioIntent → PlaySFX/PlayBGM 命令
        const audioQuery = this.world.createQuery({
            all: [AudioIntentComponent]
        });
        audioQuery.forEach(entity => {
            const audioIntent = entity.getComponent(AudioIntentComponent)!;
            
            if (audioIntent.sfxKey) {
                this.commandBuffer.push({
                    type: 'PlaySFX',
                    sfxKey: audioIntent.sfxKey,
                    volume: audioIntent.volume
                });
            }
            
            if (audioIntent.bgmKey) {
                this.commandBuffer.push({
                    type: 'PlayBGM',
                    bgmKey: audioIntent.bgmKey,
                    loop: audioIntent.bgmLoop,
                    volume: audioIntent.volume
                });
            }
            
            // 移除组件（一次性意图）
            this.world.removeComponent(entity.id, AudioIntentComponent);
        });
    }
}

