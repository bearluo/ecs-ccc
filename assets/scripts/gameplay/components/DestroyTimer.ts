/**
 * 销毁计时器组件
 * 
 * 标记实体将在指定时间后销毁
 * 这是一个标记组件，包含倒计时数据
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'DestroyTimer', pooled: true, poolSize: 100 })
export class DestroyTimerComponent extends Component {
    /** 剩余时间（秒） */
    time: number = 0;

    /**
     * 设置销毁时间
     * @param time 剩余时间（秒）
     */
    setTime(time: number): void {
        this.time = time;
    }

    /**
     * 是否已到期
     * @returns 是否已到期
     */
    get isExpired(): boolean {
        return this.time <= 0;
    }

    reset(): void {
        super.reset();
        this.time = 0;
    }
}
