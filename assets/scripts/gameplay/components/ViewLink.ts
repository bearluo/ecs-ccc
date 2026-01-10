/**
 * 视图链接组件
 * 
 * 链接到 Creator 的 View 层
 * 
 * ⚠️ 架构约束：
 * - 只存 viewId，不存 Node 引用
 * - 所有 Creator 对象都在 ViewManager 中管理
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'ViewLink', pooled: true, poolSize: 100 })
export class ViewLinkComponent extends Component {
    /** 视图 ID（用于在 ViewManager 中查找对应的 Node） */
    viewId: number = 0;
    
    /** Prefab 键（用于生成 View） */
    prefabKey: string = '';

    reset(): void {
        super.reset();
        this.viewId = 0;
        this.prefabKey = '';
    }
}

