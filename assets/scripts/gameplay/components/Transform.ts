/**
 * 位置组件
 * 
 * 存储实体的位置和旋转信息
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'Transform', pooled: true, poolSize: 100 })
export class TransformComponent extends Component {
    x: number = 0;
    y: number = 0;
    rot: number = 0;

    reset(): void {
        super.reset();
        this.x = 0;
        this.y = 0;
        this.rot = 0;
    }
}

