/// <reference types="jest" />
/**
 * NodeBinder 单元测试
 * 
 * 使用全局 mock (tests/__mocks__/cc.ts)
 */

import { NodeBinder } from 'db://assets/scripts/presentation/NodeBinder';
import { World, Entity } from '@bl-framework/ecs';
import { Node } from 'cc';

describe('NodeBinder', () => {
    let nodeBinder: NodeBinder;
    let world: World;
    let entity: Entity;
    let node: Node;

    beforeEach(() => {
        nodeBinder = new NodeBinder();
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
        node = new Node('TestNode');
    });

    describe('bind 和 getHandle', () => {
        it('应该能够绑定 Node 到 Handle', () => {
            nodeBinder.bind(node, entity.handle);
            
            const retrievedHandle = nodeBinder.getHandle(node);
            expect(retrievedHandle).toBeDefined();
            expect(retrievedHandle?.id).toBe(entity.handle.id);
            expect(retrievedHandle?.gen).toBe(entity.handle.gen);
        });

        it('应该能够通过 bindEntity 绑定', () => {
            nodeBinder.bindEntity(node, entity);
            
            const retrievedHandle = nodeBinder.getHandle(node);
            expect(retrievedHandle).toBeDefined();
            expect(retrievedHandle?.id).toBe(entity.handle.id);
        });

        it('未绑定的 Node 应该返回 undefined', () => {
            const unboundNode = new Node('UnboundNode');
            
            const handle = nodeBinder.getHandle(unboundNode);
            expect(handle).toBeUndefined();
        });
    });

    describe('unbind', () => {
        it('应该能够解绑 Node', () => {
            nodeBinder.bind(node, entity.handle);
            expect(nodeBinder.getHandle(node)).toBeDefined();
            
            nodeBinder.unbind(node);
            expect(nodeBinder.getHandle(node)).toBeUndefined();
        });
    });


    describe('clear', () => {
        it('应该清除所有绑定', () => {
            const node1 = new Node('Node1');
            const node2 = new Node('Node2');
            const entity1 = world.createEntity('Entity1');
            const entity2 = world.createEntity('Entity2');

            nodeBinder.bind(node1, entity1.handle);
            nodeBinder.bind(node2, entity2.handle);

            expect(nodeBinder.getHandle(node1)).toBeDefined();
            expect(nodeBinder.getHandle(node2)).toBeDefined();

            nodeBinder.clear();

            expect(nodeBinder.getHandle(node1)).toBeUndefined();
            expect(nodeBinder.getHandle(node2)).toBeUndefined();
        });
    });

    describe('Handle 存储', () => {
        it('相同 Handle 应该正确存储', () => {
            const node1 = new Node('Node1');
            const node2 = new Node('Node2');

            nodeBinder.bind(node1, entity.handle);
            nodeBinder.bind(node2, entity.handle);

            const handle1 = nodeBinder.getHandle(node1);
            const handle2 = nodeBinder.getHandle(node2);

            expect(handle1?.id).toBe(handle2?.id);
            expect(handle1?.gen).toBe(handle2?.gen);
        });

        it('不同 Handle 应该正确区分', () => {
            const entity1 = world.createEntity('Entity1');
            const entity2 = world.createEntity('Entity2');
            const node1 = new Node('Node1');
            const node2 = new Node('Node2');

            nodeBinder.bind(node1, entity1.handle);
            nodeBinder.bind(node2, entity2.handle);

            const handle1 = nodeBinder.getHandle(node1);
            const handle2 = nodeBinder.getHandle(node2);

            expect(handle1?.id).not.toBe(handle2?.id);
        });
    });
});
