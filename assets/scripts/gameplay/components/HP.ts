/**
 * 生命值组件
 * 
 * 存储实体的生命值信息
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'HP', pooled: true, poolSize: 100 })
export class HPComponent extends Component {
    cur: number = 100;
    max: number = 100;

    reset(): void {
        super.reset();
        this.cur = 100;
        this.max = 100;
    }

    /**
     * 获取生命值百分比
     */
    get percentage(): number {
        return this.max > 0 ? this.cur / this.max : 0;
    }

    /**
     * 是否已死亡
     */
    get isDead(): boolean {
        return this.cur <= 0;
    }
}

