/// <reference types="jest" />
/**
 * CollisionSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { CollisionSystem } from 'db://assets/scripts/gameplay/systems/CollisionSystem';
import { ColliderComponent } from 'db://assets/scripts/gameplay/components/Collider';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';

describe('CollisionSystem', () => {
    let world: World;
    let collisionSystem: CollisionSystem;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        collisionSystem = world.registerSystem(CollisionSystem);
        eventBus = new EventBus();
        collisionSystem.setEventBus(eventBus);
    });

    describe('onUpdate', () => {
        it('应该检测圆形碰撞', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const collider1 = entity1.addComponent(ColliderComponent);
            transform1.x = 0;
            transform1.y = 0;
            collider1.type = 'circle';
            collider1.radius = 20;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const collider2 = entity2.addComponent(ColliderComponent);
            transform2.x = 30; // 距离 30 < 40 (radius1 + radius2)
            transform2.y = 0;
            collider2.type = 'circle';
            collider2.radius = 20;

            const dt = 0.016;
            collisionSystem.onUpdate!(dt);

            // 应该发送碰撞事件
            const events: any[] = [];
            eventBus.subscribe('CollisionEvent', (event) => {
                events.push(event);
            });
            eventBus.flush();

            expect(events.length).toBeGreaterThan(0);
        });

        it('不应该检测距离太远的碰撞', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const collider1 = entity1.addComponent(ColliderComponent);
            transform1.x = 0;
            transform1.y = 0;
            collider1.type = 'circle';
            collider1.radius = 20;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const collider2 = entity2.addComponent(ColliderComponent);
            transform2.x = 100; // 距离 100 > 40
            transform2.y = 0;
            collider2.type = 'circle';
            collider2.radius = 20;

            const dt = 0.016;
            collisionSystem.onUpdate!(dt);

            const events: any[] = [];
            eventBus.subscribe('CollisionEvent', (event) => {
                events.push(event);
            });
            eventBus.flush();

            expect(events.length).toBe(0);
        });

        it('应该检测矩形碰撞', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const collider1 = entity1.addComponent(ColliderComponent);
            transform1.x = 0;
            transform1.y = 0;
            collider1.type = 'box';
            collider1.radius = 20; // width
            collider1.height = 20;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const collider2 = entity2.addComponent(ColliderComponent);
            transform2.x = 15; // 重叠
            transform2.y = 15;
            collider2.type = 'box';
            collider2.radius = 20;
            collider2.height = 20;

            const dt = 0.016;
            collisionSystem.onUpdate!(dt);

            const events: any[] = [];
            eventBus.subscribe('CollisionEvent', (event) => {
                events.push(event);
            });
            eventBus.flush();

            expect(events.length).toBeGreaterThan(0);
        });

        it('应该检测圆形和矩形碰撞', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const collider1 = entity1.addComponent(ColliderComponent);
            transform1.x = 0;
            transform1.y = 0;
            collider1.type = 'circle';
            collider1.radius = 20;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const collider2 = entity2.addComponent(ColliderComponent);
            transform2.x = 15; // 圆形中心在矩形内
            transform2.y = 0;
            collider2.type = 'box';
            collider2.radius = 20;
            collider2.height = 20;

            const dt = 0.016;
            collisionSystem.onUpdate!(dt);

            const events: any[] = [];
            eventBus.subscribe('CollisionEvent', (event) => {
                events.push(event);
            });
            eventBus.flush();

            // 应该检测到碰撞（圆形中心在矩形内）
            expect(events.length).toBeGreaterThan(0);
        });

        it('EventBus 未设置时应该警告', () => {
            const newWorld = new World({ debug: false });
            const systemWithoutEventBus = newWorld.registerSystem(CollisionSystem);
            // 不设置 EventBus

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const dt = 0.016;
            systemWithoutEventBus.onUpdate!(dt);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('应该处理多个实体', () => {
            const entity1 = world.createEntity('Entity1');
            const transform1 = entity1.addComponent(TransformComponent);
            const collider1 = entity1.addComponent(ColliderComponent);
            transform1.x = 0;
            transform1.y = 0;
            collider1.type = 'circle';
            collider1.radius = 20;

            const entity2 = world.createEntity('Entity2');
            const transform2 = entity2.addComponent(TransformComponent);
            const collider2 = entity2.addComponent(ColliderComponent);
            transform2.x = 30;
            transform2.y = 0;
            collider2.type = 'circle';
            collider2.radius = 20;

            const entity3 = world.createEntity('Entity3');
            const transform3 = entity3.addComponent(TransformComponent);
            const collider3 = entity3.addComponent(ColliderComponent);
            transform3.x = 60;
            transform3.y = 0;
            collider3.type = 'circle';
            collider3.radius = 20;

            const dt = 0.016;
            collisionSystem.onUpdate!(dt);

            const events: any[] = [];
            eventBus.subscribe('CollisionEvent', (event) => {
                events.push(event);
            });
            eventBus.flush();

            // entity1 和 entity2 碰撞，entity2 和 entity3 碰撞
            expect(events.length).toBeGreaterThan(0);
        });
    });
});
