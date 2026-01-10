/**
 * 排序系统列表
 * 
 * 封装系统列表的排序逻辑，使用脏标记机制避免不必要的排序
 */

import { World, System } from '@bl-framework/ecs';

/**
 * 排序系统列表
 * 
 * 特性：
 * - 自动按 priority 排序
 * - 脏标记机制：只在必要时排序
 * - 支持动态添加系统
 */
export class SortedSystemList {
    /** 系统类型列表 */
    private systemTypes: (new () => System)[] = [];

    /** 已排序的系统实例缓存 */
    private cachedSystems: System[] = [];

    /** 脏标记：是否需要重新排序 */
    private dirty: boolean = true;

    /**
     * 添加系统类型
     */
    add(systemType: new () => System): void {
        if (this.systemTypes.indexOf(systemType) === -1) {
            this.systemTypes.push(systemType);
            this.dirty = true; // 标记为脏
        }
    }

    /**
     * 移除系统类型
     */
    remove(systemType: new () => System): void {
        const index = this.systemTypes.indexOf(systemType);
        if (index !== -1) {
            this.systemTypes.splice(index, 1);
            this.dirty = true; // 标记为脏
        }
    }

    /**
     * 更新所有系统
     * 
     * @param world ECS 世界
     * @param dt 帧间隔时间
     */
    update(world: World, dt: number): void {
        // 检查脏标记，必要时刷新缓存
        if (this.dirty) {
            this.refresh(world);
            this.dirty = false;
        }

        // 执行所有系统（已排序）
        for (const system of this.cachedSystems) {
            if (system.enabled) {
                system.onUpdate?.(dt);
            }
        }
    }

    /**
     * 刷新缓存：获取系统实例并按 priority 排序
     */
    private refresh(world: World): void {
        this.cachedSystems = this.systemTypes
            .map(type => world.getSystem(type))
            .filter((sys): sys is System => sys !== undefined)
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * 标记为脏（强制下次更新时重新排序）
     * 
     * 当系统 priority 动态改变时，需要调用此方法
     */
    markDirty(): void {
        this.dirty = true;
    }

    /**
     * 获取系统数量
     */
    getCount(): number {
        return this.systemTypes.length;
    }

    /**
     * 清空所有系统
     */
    clear(): void {
        this.systemTypes = [];
        this.cachedSystems = [];
        this.dirty = true;
    }
}



