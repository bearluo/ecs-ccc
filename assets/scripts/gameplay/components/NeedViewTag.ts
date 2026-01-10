/**
 * 需要视图标记组件
 * 
 * 标记实体需要创建视图
 * 这是一个标记组件，不包含数据
 */

import { Component, component } from '@bl-framework/ecs';

@component({ name: 'NeedViewTag' })
export class NeedViewTagComponent extends Component {
    // 标记组件，无数据，只用于标记实体需要创建视图
}
