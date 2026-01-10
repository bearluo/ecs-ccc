/**
 * 速度组件
 * 
 * 存储实体的速度信息
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'Velocity', pooled: true, poolSize: 100 })
export class VelocityComponent extends Component {
    vx: number = 0;
    vy: number = 0;

    reset(): void {
        super.reset();
        this.vx = 0;
        this.vy = 0;
    }
}

