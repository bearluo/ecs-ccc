/**
 * 游戏应用入口
 * 
 * 负责初始化 ECS 世界、桥接层和表现层
 * 管理帧循环和系统更新
 */

import { Component, Node, _decorator } from 'cc';
import { World } from '@bl-framework/ecs';
import { Scheduler } from '../bridge/Scheduler';
import { CommandBuffer } from '../bridge/CommandBuffer';
import { EventBus } from '../bridge/EventBus';
import { ViewManager } from '../presentation/ViewManager';
import { AnimDriver } from '../presentation/AnimDriver';
import { FxDriver } from '../presentation/FxDriver';
import { AudioDriver } from '../presentation/AudioDriver';
import { ConfigLoader } from '../ConfigLoader';

// 系统
import { MoveSystem } from '../gameplay/systems/MoveSystem';
import { CombatSystem } from '../gameplay/systems/CombatSystem';
import { DeathSystem } from '../gameplay/systems/DeathSystem';
import { DestroySystem } from '../gameplay/systems/DestroySystem';
import { RenderSyncSystem } from '../gameplay/systems/RenderSyncSystem';
import { ViewSpawnSystem } from '../gameplay/systems/ViewSpawnSystem';
import { AnimationIntentSystem } from '../gameplay/systems/AnimationIntentSystem';
import { AnimationEventSystem } from '../gameplay/systems/AnimationEventSystem';
import { ResourceManager } from '../presentation/ResourceManager';
import { ResourcePreloader } from '../presentation/ResourcePreloader';
import { StartupPreloadConfig, ScenePreloadConfigs } from '../data/configs/resource-preload';

const { ccclass, property } = _decorator;

@ccclass('GameApp')
export class GameApp extends Component {
    private world!: World;
    private scheduler!: Scheduler;
    private commandBuffer!: CommandBuffer;
    private eventBus!: EventBus;
    private viewManager!: ViewManager;
    private animDriver!: AnimDriver;
    private fxDriver!: FxDriver;
    private audioDriver!: AudioDriver;
    private configLoader!: ConfigLoader;
    private resourceManager!: ResourceManager;
    private resourcePreloader!: ResourcePreloader;

    /** 视图父节点 */
    @property(Node)
    public viewParent: Node = null!;

    async onLoad() {
        // 初始化桥接层
        this.commandBuffer = new CommandBuffer();
        this.eventBus = new EventBus();

        // 初始化 ECS 世界
        this.world = new World({ 
            debug: true,
            initialEntityPoolSize: 1000,
            componentPoolSize: 100
        });

        // 初始化调度器
        this.scheduler = new Scheduler(
            this.world,
            this.commandBuffer,
            this.eventBus,
            {
                fixedDeltaTime: 1 / 60, // 60 FPS
                maxAccumulator: 0.25    // 最大累积 250ms
            }
        );

        // 初始化资源管理器
        this.resourceManager = new ResourceManager();
        
        // 初始化资源预加载器
        this.resourcePreloader = new ResourcePreloader(this.resourceManager);

        // 初始化表现层
        this.viewManager = new ViewManager(this.resourceManager);
        this.viewManager.setEventBus(this.eventBus); // 设置 EventBus，用于发送视图创建确认事件
        this.viewManager.setWorld(this.world); // 设置 World，用于查询实体
        this.viewManager.setViewParent(this.viewParent); // 设置视图父节点
        // 初始化配置系统
        this.configLoader = new ConfigLoader();
        
        // 初始化表现层驱动
        this.animDriver = new AnimDriver(this.eventBus);
        this.viewManager.setAnimDriver(this.animDriver); // 设置 AnimDriver，用于播放动画
        
        this.fxDriver = new FxDriver(this.resourceManager, this.configLoader);
        this.viewManager.setFxDriver(this.fxDriver); // 设置 FxDriver，用于播放特效
        
        this.audioDriver = new AudioDriver(this.resourceManager, this.configLoader);
        this.audioDriver.setViewParent(this.viewParent); // 设置视图父节点，初始化音频源
        this.viewManager.setAudioDriver(this.audioDriver); // 设置 AudioDriver，用于播放音效

        // 启动时预加载核心资源（可选：显示加载进度）
        try {
            await this.resourcePreloader.preloadParallel(
                StartupPreloadConfig,
                (progress) => {
                    console.log(`[GameApp] Preload progress: ${(progress * 100).toFixed(1)}%`);
                    // TODO: 更新 UI 加载进度条
                }
            );
            console.log('[GameApp] Preload completed');
        } catch (error) {
            console.error('[GameApp] Preload failed:', error);
            // 继续游戏，按需加载
        }

        // 注册 Fixed Systems (priority 0-99)
        this.world.registerSystem(MoveSystem);
        this.world.registerSystem(CombatSystem);
        this.world.registerSystem(DeathSystem);
        this.scheduler.registerFixedSystem(MoveSystem);
        this.scheduler.registerFixedSystem(CombatSystem);
        this.scheduler.registerFixedSystem(DeathSystem);

        // 注册 DestroySystem（处理实体销毁，两阶段销毁 + 超时保护）
        const destroySystem = this.world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(this.commandBuffer);
        destroySystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(DestroySystem);

        // 注册 ViewSpawnSystem（处理视图创建确认）
        const viewSpawnSystem = this.world.registerSystem(ViewSpawnSystem);
        viewSpawnSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(ViewSpawnSystem);

        // 注册 AnimationEventSystem（处理动画事件）
        const animationEventSystem = this.world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(AnimationEventSystem);
        
        // 注册 Render Systems (priority 100+)
        const animationIntentSystem = this.world.registerSystem(AnimationIntentSystem);
        this.scheduler.registerRenderSystem(AnimationIntentSystem);

        const renderSyncSystem = this.world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(this.commandBuffer);
        this.scheduler.registerRenderSystem(RenderSyncSystem);

        console.log('[GameApp] Initialized');
    }

    update(dt: number) {
        if (!this.world || !this.scheduler) return;

        // 收集输入/外部事件
        // TODO: 处理输入事件并推送到 EventBus

        // Fixed Step（固定步长）
        this.scheduler.stepFixed(dt);

        // Render Step（渲染）
        this.scheduler.stepRender(dt);

        // 刷新命令到 ViewManager
        const commands = this.scheduler.flushCommandsToPresentation();
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
     * 场景切换时预加载
     * @param sceneName 场景名称
     */
    async preloadScene(sceneName: string): Promise<void> {
        const config = ScenePreloadConfigs[sceneName];
        if (config) {
            await this.resourcePreloader.preloadParallel(config);
        }
    }

    onDestroy() {
        // 清理资源
        if (this.viewManager) {
            this.viewManager.clear();
        }
        if (this.resourceManager) {
            this.resourceManager.clear();
        }
        if (this.world) {
            this.world.destroy();
        }
        console.log('[GameApp] Destroyed');
    }
}

