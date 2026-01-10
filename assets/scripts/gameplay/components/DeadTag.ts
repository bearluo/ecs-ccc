/**
 * 死亡标记组件
 * 
 * 标记实体已死亡
 * 这是一个标记组件，不包含数据
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'DeadTag' })
export class DeadTagComponent extends Component {
    // 标记组件，无数据
}

