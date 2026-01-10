/// <reference types="jest" />
/**
 * MoveSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { MoveSystem } from 'db://assets/scripts/gameplay/systems/MoveSystem';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';

describe('MoveSystem', () => {
    let world: World;
    let moveSystem: MoveSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        moveSystem = world.registerSystem(MoveSystem);
    });

    describe('onUpdate', () => {
        it('应该根据速度更新位置', () => {
            const entity = world.createEntity('TestEntity');
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);

            transform.x = 0;
            transform.y = 0;
            velocity.vx = 10;
            velocity.vy = 5;

            const dt = 0.016; // 16ms
            moveSystem.onUpdate!(dt);

            expect(transform.x).toBeCloseTo(0.16, 5);
            expect(transform.y).toBeCloseTo(0.08, 5);
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const velocity1 = entity1.addComponent(VelocityComponent);
            transform1.x = 0;
            transform1.y = 0;
            velocity1.vx = 10;
            velocity1.vy = 5;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const velocity2 = entity2.addComponent(VelocityComponent);
            transform2.x = 100;
            transform2.y = 100;
            velocity2.vx = -5;
            velocity2.vy = -10;

            const dt = 0.016;
            moveSystem.onUpdate!(dt);

            expect(transform1.x).toBeCloseTo(0.16, 5);
            expect(transform1.y).toBeCloseTo(0.08, 5);
            expect(transform2.x).toBeCloseTo(99.92, 5);
            expect(transform2.y).toBeCloseTo(99.84, 5);
        });

        it('应该只更新有 Transform 和 Velocity 的实体', () => {
            const entity1 = world.createEntity('Entity1');
            entity1.addComponent(TransformComponent);
            entity1.addComponent(VelocityComponent);

            const entity2 = world.createEntity('Entity2');
            entity2.addComponent(TransformComponent);
            // 没有 Velocity 组件

            const transform1 = entity1.getComponent(TransformComponent)!;
            const transform2 = entity2.getComponent(TransformComponent)!;
            const velocity1 = entity1.getComponent(VelocityComponent)!;

            transform1.x = 0;
            transform1.y = 0;
            transform2.x = 0;
            transform2.y = 0;
            velocity1.vx = 10;
            velocity1.vy = 5;

            const dt = 0.016;
            moveSystem.onUpdate!(dt);

            // entity1 应该移动
            expect(transform1.x).toBeCloseTo(0.16, 5);
            // entity2 不应该移动（没有 Velocity）
            expect(transform2.x).toBe(0);
        });

        it('应该处理零速度', () => {
            const entity = world.createEntity('TestEntity');
            const transform = entity.addComponent(TransformComponent);
            const velocity = entity.addComponent(VelocityComponent);

            transform.x = 10;
            transform.y = 20;
            velocity.vx = 0;
            velocity.vy = 0;

            const dt = 0.016;
            moveSystem.onUpdate!(dt);

            expect(transform.x).toBe(10);
            expect(transform.y).toBe(20);
        });
    });
});
