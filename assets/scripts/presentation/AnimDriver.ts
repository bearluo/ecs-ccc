/**
 * 动画驱动
 * 
 * 负责播放动画并回传动画事件
 * 
 * ⚠️ 关键修正：
 * - 使用 Handle 而不是 entityId（避免异步事件错误）
 * - 不维护锁定状态（锁定状态由 ECS 管理）
 */

import { Node, Animation, AnimationClip } from 'cc';
import { Handle } from '@bl-framework/ecs';
import { EventBus } from '../bridge/EventBus';
import { NodeBinder } from './NodeBinder';

/**
 * 动画播放信息（不包含锁定状态）
 */
interface AnimInfo {
    currentAnim: string;
    isPlaying: boolean;
}

/**
 * 动画驱动
 */
export class AnimDriver {
    private eventBus: EventBus;
    private nodeBinder?: NodeBinder;
    private nodeAnimMap: Map<Node, Animation> = new Map();
    private animInfoMap: Map<Node, AnimInfo> = new Map();

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    /**
     * 设置 NodeBinder（用于反向查找 Handle）
     */
    setNodeBinder(nodeBinder: NodeBinder): void {
        this.nodeBinder = nodeBinder;
    }

    /**
     * 为 Node 设置动画组件（自动从 Node 获取）
     */
    setupAnimation(node: Node): void {
        const animation = node.getComponent(Animation);
        if (animation) {
            this.nodeAnimMap.set(node, animation);
            this.setupAnimationEvents(node, animation);
        }
    }

    /**
     * 设置动画事件监听
     */
    private setupAnimationEvents(node: Node, animation: Animation): void {
        // 监听动画完成事件
        animation.on(Animation.EventType.FINISHED, () => {
            this.onAnimationFinished(node);
        });

        // TODO: 监听动画事件点（AnimationClip 中的事件）
        // 需要根据 Cocos Creator API 实现
    }

    /**
     * 播放动画
     * ⚠️ 防御性检查：如果已经在播放相同动画，只更新参数，不重新播放
     */
    playAnim(node: Node, animName: string, speed: number = 1.0, loop: boolean = false): void {
        const animation = this.nodeAnimMap.get(node);
        if (!animation) {
            // 尝试自动获取
            this.setupAnimation(node);
            const anim = this.nodeAnimMap.get(node);
            if (!anim) {
                console.warn(`[AnimDriver] Animation not found for node: ${node.name}`);
                return;
            }
        }

        const anim = this.nodeAnimMap.get(node)!;
        
        // ⚠️ 防御性检查：如果已经在播放相同动画，只更新参数，不重新播放
        const currentInfo = this.animInfoMap.get(node);
        if (currentInfo && currentInfo.currentAnim === animName && currentInfo.isPlaying) {
            const state = anim.getState(animName);
            if (state && state.isPlaying) {
                // 已经在播放相同动画，只更新速度和循环模式（如果需要）
                if (state.speed !== speed) {
                    state.speed = speed;
                }
                const expectedWrapMode = loop ? 2 : 1; // 2 = Loop, 1 = Normal
                if (state.wrapMode !== expectedWrapMode) {
                    state.wrapMode = expectedWrapMode;
                }
                return; // 跳过播放，避免动画重新开始
            }
        }

        const state = anim.getState(animName);
        if (state) {
            state.speed = speed;
            // 设置循环模式（Cocos Creator 3.8: 0=Default, 1=Normal, 2=Loop, 3=PingPong, 4=Reverse）
            // 注意：wrapMode 是数字枚举，不是对象
            state.wrapMode = loop ? 2 : 1; // 2 = Loop, 1 = Normal
            anim.play(animName);

            // 更新播放信息（不记录锁定状态，锁定状态由 ECS 管理）
            this.animInfoMap.set(node, {
                currentAnim: animName,
                isPlaying: true
            });
        } else {
            console.warn(`[AnimDriver] Animation state '${animName}' not found for node: ${node.name}`);
        }
    }

    /**
     * 停止动画
     */
    stopAnim(node: Node): void {
        const animation = this.nodeAnimMap.get(node);
        if (animation) {
            animation.stop();
            this.animInfoMap.delete(node);
        }
    }

    /**
     * 动画完成回调
     */
    private onAnimationFinished(node: Node): void {
        const info = this.animInfoMap.get(node);
        if (!info) return;

        // ⚠️ 关键：使用 Handle 而不是 entityId
        if (!this.nodeBinder) {
            console.warn(`[AnimDriver] NodeBinder not set`);
            return;
        }

        const handle = this.nodeBinder.getHandle(node);
        if (handle) {
            // 发送通用动画完成事件（不区分类型，由 ECS 判断）
            this.sendAnimationFinished(handle, info.currentAnim);
        }

        // 清除状态
        this.animInfoMap.delete(node);
    }

    /**
     * 发送动画完成事件（使用 Handle）
     */
    private sendAnimationFinished(handle: Handle, animName: string): void {
        this.eventBus.push({
            type: 'AnimationEvent',
            eventName: 'finished',
            handle: handle,
            data: { animName }
        });
    }

    /**
     * 发送动画事件点（使用 Handle）
     * @param handle 实体 Handle
     * @param marker 事件点名称（如 'hit'、'footstep'）
     * @param data 额外数据
     */
    sendAnimationMarker(handle: Handle, marker: string, data?: any): void {
        this.eventBus.push({
            type: 'AnimationEvent',
            eventName: 'marker',
            handle: handle,
            data: { marker, ...data }
        });
    }
}

