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
 * 调度器模式
 * Running: 运行中
 * Transition: 过渡中
 * Paused: 暂停中
 */
export enum SchedulerMode {
    Running,
    Transition,
    Paused,
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
    private mode: SchedulerMode = SchedulerMode.Running;
    private fxDriver: FxDriver;
    private viewManager: ViewManager;
    private animDriver: AnimDriver;
    private audioDriver: AudioDriver;

    /** 固定步长累积器 */
    private accumulator: number = 0;

    /** Fixed Systems 列表 (priority 0-99) */
    private fixedSystems: SortedSystemList;

    /** Render Systems 列表 (priority 100+) */
    private renderSystems: SortedSystemList;

    /** Transition / Presentation Systems 列表（切场景也要跑） */
    private transitionSystems: SortedSystemList;

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
        this.fxDriver = ServiceLocator.require(FxDriver);
        this.viewManager = ServiceLocator.require(ViewManager);
        this.animDriver = ServiceLocator.require(AnimDriver);
        this.audioDriver = ServiceLocator.require(AudioDriver);
        // 初始化系统列表
        this.fixedSystems = new SortedSystemList();
        this.renderSystems = new SortedSystemList();
        this.transitionSystems = new SortedSystemList();
    }
    /**
     * 设置调度器模式
     * @param mode 调度器模式
     */
    setMode(mode: SchedulerMode): void {
        this.mode = mode;
        if (mode !== SchedulerMode.Running) {
            this.resetAccumulator(); // 很推荐：避免切回 Running 时补一堆 fixed tick
        }
    }
    /**
     * 固定步长更新
     * 执行所有 Fixed Systems (priority 0-99)
     */
    stepFixed(dt: number): void {
        if (this.mode !== SchedulerMode.Running) return;
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
        if (this.mode === SchedulerMode.Running) {
            // 执行 Render Systems (priority 100+)
            this.updateRenderSystems(dt);
        } else if (this.mode === SchedulerMode.Transition) {
            // 只跑切场景也必须跑的系统
            // 例如：EventDispatch(Lifecycle/Transition)、ViewCommandExecute、BridgeSystem
            this.transitionSystems.update(this.world, dt);

            // 可选：在这里刷允许的事件（生命周期/切换类）
            this.eventBus.flush();
        } else if (this.mode === SchedulerMode.Paused) {
            // 看需求：可能也跑 transitionSystems（UI）
            this.transitionSystems.update(this.world, dt);
            this.eventBus.flush();
        }

        // 刷新命令到 ViewManager
        const commands = this.flushCommandsToPresentation();
        if (commands.length > 0) {
            this.viewManager.processCommands(commands);
        }
        
        // ⚠️ 关键：必须在每帧调用 FxDriver.update(dt) 以统一管理特效生命周期
        // 不允许使用 setTimeout，必须通过 update(dt) 管理
        // 原因：
        // 1. 与游戏暂停/时间缩放同步
        // 2. Scene 切换时安全清理
        // 3. Node 已被 destroy 时不会触发
        if (this.fxDriver) {
            this.fxDriver.update(dt);
        }
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
     * 注册 Transition System (切场景也要跑)
     */
    registerTransitionSystem<T extends System>(systemType: new () => T): void {
        this.transitionSystems.add(systemType);
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
import { FxDriver } from '../presentation/FxDriver';
import { ServiceLocator } from '../app/ServiceLocator';
import { ViewManager } from '../presentation/ViewManager';
import { AudioDriver } from '../presentation/AudioDriver';
import { AnimDriver } from '../presentation/AnimDriver';

