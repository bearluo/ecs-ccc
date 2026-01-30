/**
 * 场景标识组件
 * 
 * 用于标记场景特定的实体，场景切换时自动清理
 * 玩家实体不应该添加此组件（在整个游戏生命周期中保留）
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'SceneTag', pooled: true, poolSize: 50 })
export class SceneTagComponent extends Component {
    sceneType: string = '';

    reset(): void {
        super.reset();
        this.sceneType = '';
    }
}
