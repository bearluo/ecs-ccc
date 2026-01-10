/**
 * 移动系统
 * 
 * 根据速度更新位置
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 */

import { System, system } from '@bl-framework/ecs';
import { TransformComponent } from '../components/Transform';
import { VelocityComponent } from '../components/Velocity';

@system({ priority: 0 })
export class MoveSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [TransformComponent, VelocityComponent]
        });

        query.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            const velocity = entity.getComponent(VelocityComponent)!;

            // 更新位置
            transform.x += velocity.vx * dt;
            transform.y += velocity.vy * dt;
        });
    }
}

