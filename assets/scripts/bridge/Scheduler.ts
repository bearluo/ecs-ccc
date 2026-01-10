/**
 * 调度器
 * 
 * 封装 World.update() 为 Fixed Step 和 Render Step
 * 管理固定步长更新和渲染更新
 */

import { World, System } from '@bl-framework/ecs';
import { CommandBuffer } from './CommandBuffer';
import { EventBus } from './EventBus';
import { SortedSystemList } from './SortedSystemList';

/**
 * 调度器配置
 */
export interface SchedulerConfig {
    /** 固定步长时间（秒） */
    fixedDeltaTime?: number;
    /** 最大累积时间（防止螺旋死亡） */
    maxAccumulator?: number;
}

/**
 * 调度器
 * 
 * 负责：
 * 1. 固定步长更新（Fixed Systems，priority 0-99）
 * 2. 渲染更新（Render Systems，priority 100+）
 * 3. 事件和命令的刷新
 */
export class Scheduler {
    private world: World;
    private commandBuffer: CommandBuffer;
    private eventBus: EventBus;
    private config: Required<SchedulerConfig>;
    
    /** 固定步长累积器 */
    private accumulator: number = 0;

    /** Fixed Systems 列表 (priority 0-99) */
    private fixedSystems: SortedSystemList;

    /** Render Systems 列表 (priority 100+) */
    private renderSystems: SortedSystemList;

    constructor(
        world: World,
        commandBuffer: CommandBuffer,
        eventBus: EventBus,
        config: SchedulerConfig = {}
    ) {
        this.world = world;
        this.commandBuffer = commandBuffer;
        this.eventBus = eventBus;
        this.config = {
            fixedDeltaTime: config.fixedDeltaTime ?? 1 / 60, // 60 FPS
            maxAccumulator: config.maxAccumulator ?? 0.25,    // 最大累积 250ms
        };

        // 初始化系统列表
        this.fixedSystems = new SortedSystemList();
        this.renderSystems = new SortedSystemList();
    }

    /**
     * 固定步长更新
     * 执行所有 Fixed Systems (priority 0-99)
     */
    stepFixed(dt: number): void {
        // 累积时间
        this.accumulator += dt;
        
        // 防止螺旋死亡：限制最大累积时间
        if (this.accumulator > this.config.maxAccumulator) {
            this.accumulator = this.config.maxAccumulator;
        }

        // 执行固定步长更新（可能执行多次）
        const fixedDelta = this.config.fixedDeltaTime;
        while (this.accumulator >= fixedDelta) {
            // 先处理事件（View → ECS）
            this.eventBus.flush();
            
            // 执行 Fixed Systems (priority 0-99)
            this.updateFixedSystems(fixedDelta);
            
            this.accumulator -= fixedDelta;
        }
    }

    /**
     * 渲染更新
     * 执行所有 Render Systems (priority 100+)
     */
    stepRender(dt: number): void {
        // 执行 Render Systems (priority 100+)
        this.updateRenderSystems(dt);
    }

    /**
     * 注册 Fixed System (priority 0-99)
     */
    registerFixedSystem<T extends System>(systemType: new () => T): void {
        this.fixedSystems.add(systemType);
    }

    /**
     * 注册 Render System (priority 100+)
     */
    registerRenderSystem<T extends System>(systemType: new () => T): void {
        this.renderSystems.add(systemType);
    }

    /**
     * 更新 Fixed Systems (priority 0-99)
     * 使用 SortedSystemList 自动处理排序和脏标记
     */
    private updateFixedSystems(dt: number): void {
        this.fixedSystems.update(this.world, dt);
    }

    /**
     * 更新 Render Systems (priority 100+)
     * 使用 SortedSystemList 自动处理排序和脏标记
     */
    private updateRenderSystems(dt: number): void {
        this.renderSystems.update(this.world, dt);
    }

    /**
     * 刷新命令到表现层
     * 将 CommandBuffer 中的命令传递给 ViewManager
     */
    flushCommandsToPresentation(): RenderCommand[] {
        return this.commandBuffer.flush();
    }

    /**
     * 获取固定步长累积器值
     */
    getAccumulator(): number {
        return this.accumulator;
    }

    /**
     * 重置累积器
     */
    resetAccumulator(): void {
        this.accumulator = 0;
    }
}

// 导入类型
import type { RenderCommand } from './CommandBuffer';

