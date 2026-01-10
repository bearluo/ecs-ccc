/**
 * 节点绑定器
 * 
 * 负责将 ECS 组件数据绑定到 Cocos Creator Node
 * 提供双向绑定功能（ECS → Node 和 Node → ECS）
 */

import { Node } from 'cc';
import { Entity, Handle } from '@bl-framework/ecs';

/**
 * 节点绑定器
 * 
 * ⚠️ 关键修正：使用 Handle 而不是 entityId，避免异步事件错误
 * 注意：Handle 作为 Map 的 value 是安全的，只有作为 key 时才需要字符串
 */
export class NodeBinder {
    /** Node → Handle 映射 */
    private nodeHandleMap: Map<Node, Handle> = new Map();

    /**
     * 绑定 Node 到 Handle
     * @param node Cocos Creator 节点
     * @param handle ECS 实体 Handle
     */
    bind(node: Node, handle: Handle): void {
        this.nodeHandleMap.set(node, handle);
    }

    /**
     * 绑定 Node 到 Entity（通过 Entity 对象）
     * @param node Cocos Creator 节点
     * @param entity ECS 实体
     */
    bindEntity(node: Node, entity: Entity): void {
        this.nodeHandleMap.set(node, entity.handle);
    }

    /**
     * 解绑 Node
     * @param node Cocos Creator 节点
     */
    unbind(node: Node): void {
        this.nodeHandleMap.delete(node);
    }

    /**
     * 获取 Node 对应的 Handle
     * @param node Cocos Creator 节点
     * @returns ECS 实体 Handle，如果未绑定返回 undefined
     */
    getHandle(node: Node): Handle | undefined {
        return this.nodeHandleMap.get(node);
    }

    /**
     * 清理所有绑定
     */
    clear(): void {
        this.nodeHandleMap.clear();
    }
}
