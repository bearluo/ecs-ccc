/**
 * 碰撞系统
 * 
 * 检测实体之间的碰撞，触发碰撞事件
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 碰撞事件通过 EventBus 发送
 * 
 * 设计决策：使用空间网格（Spatial Grid）优化碰撞检测，时间复杂度 O(n + k)
 * 参考文档：memory-bank/creative/creative-collision-system.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { ColliderComponent } from '../components/Collider';
import { TransformComponent } from '../components/Transform';
import { EventBus } from '../../bridge/EventBus';

/**
 * 空间网格（用于优化碰撞检测）
 */
class SpatialGrid {
    private cellSize: number = 100; // 网格大小
    private grid: Map<string, Entity[]> = new Map();
    
    clear(): void {
        this.grid.clear();
    }
    
    insert(entity: Entity, transform: TransformComponent): void {
        const cellX = Math.floor(transform.x / this.cellSize);
        const cellY = Math.floor(transform.y / this.cellSize);
        const key = `${cellX},${cellY}`;
        
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(entity);
    }
    
    getNeighbors(entity: Entity, transform: TransformComponent): Entity[] {
        const cellX = Math.floor(transform.x / this.cellSize);
        const cellY = Math.floor(transform.y / this.cellSize);
        const neighbors: Entity[] = [];
        
        // 检查当前网格和周围 8 个网格
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (const e of cell) {
                        if (e.id !== entity.id) {
                            neighbors.push(e);
                        }
                    }
                }
            }
        }
        
        return neighbors;
    }
}

@system({ priority: 1 })
export class CollisionSystem extends System {
    private eventBus?: EventBus;
    private spatialGrid: SpatialGrid = new SpatialGrid();
    
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }
    
    onUpdate(dt: number): void {
        if (!this.eventBus) {
            console.warn('[CollisionSystem] EventBus not set');
            return;
        }
        
        const query = this.world.createQuery({
            all: [ColliderComponent, TransformComponent]
        });
        
        // 清空空间网格
        this.spatialGrid.clear();
        
        // 插入所有实体到空间网格
        query.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            this.spatialGrid.insert(entity, transform);
        });
        
        // 检测碰撞
        const processedPairs = new Set<string>();
        
        query.forEach(entityA => {
            const colliderA = entityA.getComponent(ColliderComponent)!;
            const transformA = entityA.getComponent(TransformComponent)!;
            
            // 只检测相邻网格的实体
            const neighbors = this.spatialGrid.getNeighbors(entityA, transformA);
            
            for (const entityB of neighbors) {
                // 避免重复检测
                const pairKey = entityA.id < entityB.id 
                    ? `${entityA.id},${entityB.id}` 
                    : `${entityB.id},${entityA.id}`;
                
                if (processedPairs.has(pairKey)) {
                    continue;
                }
                processedPairs.add(pairKey);
                
                const colliderB = entityB.getComponent(ColliderComponent)!;
                const transformB = entityB.getComponent(TransformComponent)!;
                
                // 检查碰撞层级
                if (!this.canCollide(colliderA, colliderB)) {
                    continue;
                }
                
                // 检测碰撞
                if (this.checkCollision(colliderA, transformA, colliderB, transformB)) {
                    // 发送碰撞事件
                    this.eventBus.push({
                        type: 'CollisionEvent',
                        entityA: entityA.id,
                        entityB: entityB.id,
                        data: {
                            colliderA: colliderA,
                            colliderB: colliderB
                        }
                    });
                }
            }
        });
    }
    
    private canCollide(colliderA: ColliderComponent, colliderB: ColliderComponent): boolean {
        // 检查碰撞层级（简化：如果层级相同或都为 0，可以碰撞）
        if (colliderA.layer === 0 || colliderB.layer === 0) {
            return true; // 默认层级可以碰撞
        }
        return colliderA.layer === colliderB.layer;
    }
    
    private checkCollision(
        colliderA: ColliderComponent,
        transformA: TransformComponent,
        colliderB: ColliderComponent,
        transformB: TransformComponent
    ): boolean {
        // 圆形 vs 圆形
        if (colliderA.type === 'circle' && colliderB.type === 'circle') {
            const dx = transformB.x - transformA.x;
            const dy = transformB.y - transformA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (colliderA.radius + colliderB.radius);
        }
        
        // 矩形 vs 矩形
        if (colliderA.type === 'box' && colliderB.type === 'box') {
            return this.checkAABB(
                transformA.x, transformA.y, colliderA.radius, colliderA.height,
                transformB.x, transformB.y, colliderB.radius, colliderB.height
            );
        }
        
        // 圆形 vs 矩形
        if (colliderA.type === 'circle' && colliderB.type === 'box') {
            return this.checkCircleRect(
                transformA.x, transformA.y, colliderA.radius,
                transformB.x, transformB.y, colliderB.radius, colliderB.height
            );
        }
        
        // 矩形 vs 圆形（交换参数）
        if (colliderA.type === 'box' && colliderB.type === 'circle') {
            return this.checkCircleRect(
                transformB.x, transformB.y, colliderB.radius,
                transformA.x, transformA.y, colliderA.radius, colliderA.height
            );
        }
        
        return false;
    }
    
    private checkAABB(
        x1: number, y1: number, w1: number, h1: number,
        x2: number, y2: number, w2: number, h2: number
    ): boolean {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    private checkCircleRect(
        cx: number, cy: number, radius: number,
        rx: number, ry: number, width: number, height: number
    ): boolean {
        const closestX = Math.max(rx, Math.min(cx, rx + width));
        const closestY = Math.max(ry, Math.min(cy, ry + height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (radius * radius);
    }
}
