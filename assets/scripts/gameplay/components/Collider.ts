/**
 * 碰撞体组件
 * 
 * 存储实体的碰撞体信息
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'Collider', pooled: true, poolSize: 100 })
export class ColliderComponent extends Component {
    /** 碰撞体类型 */
    type: 'circle' | 'box' = 'circle';
    
    /** 半径（圆形）或宽度（矩形） */
    radius: number = 50;
    
    /** 高度（矩形，圆形时忽略） */
    height: number = 50;
    
    /** 是否触发（不产生物理碰撞，只触发事件） */
    isTrigger: boolean = false;
    
    /** 碰撞层级（用于过滤） */
    layer: number = 0;

    reset(): void {
        super.reset();
        this.type = 'circle';
        this.radius = 50;
        this.height = 50;
        this.isTrigger = false;
        this.layer = 0;
    }
}
