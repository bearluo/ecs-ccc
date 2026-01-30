/**
 * 游戏应用入口
 * 
 * 负责初始化 ECS 世界、桥接层和表现层
 * 管理帧循环和系统更新
 */

import { Component, Node, _decorator } from 'cc';
import { World } from '@bl-framework/ecs';
import { Scheduler, SchedulerMode } from '../bridge/Scheduler';
import { CommandBuffer } from '../bridge/CommandBuffer';
import { EventBus } from '../bridge/EventBus';
import { ViewManager } from '../presentation/ViewManager';
import { AnimDriver } from '../presentation/AnimDriver';
import { FxDriver } from '../presentation/FxDriver';
import { AudioDriver } from '../presentation/AudioDriver';
import { ConfigLoader } from '../ConfigLoader';

// 组件（用于读档后恢复视图）
import { ViewLinkComponent } from '../gameplay/components/ViewLink';
import { NeedViewTagComponent } from '../gameplay/components/NeedViewTag';

// 系统
import { MoveSystem } from '../gameplay/systems/MoveSystem';
import { CombatSystem } from '../gameplay/systems/CombatSystem';
import { DeathSystem } from '../gameplay/systems/DeathSystem';
import { DestroySystem } from '../gameplay/systems/DestroySystem';
import { RenderSyncSystem } from '../gameplay/systems/RenderSyncSystem';
import { ViewSpawnSystem } from '../gameplay/systems/ViewSpawnSystem';
import { AnimationIntentSystem } from '../gameplay/systems/AnimationIntentSystem';
import { AnimationEventSystem } from '../gameplay/systems/AnimationEventSystem';
import { SaveSystem } from '../gameplay/systems/SaveSystem';
import { UISystem } from '../gameplay/systems/UISystem';
import { InventorySystem } from '../gameplay/systems/InventorySystem';
import { EquipmentSystem } from '../gameplay/systems/EquipmentSystem';
import { ResourceManager } from '../presentation/ResourceManager';
import { ResourcePreloader } from '../presentation/ResourcePreloader';
import { UIManager } from '../presentation/UI/UIManager';
import { StartupPreloadConfig, ScenePreloadConfigs } from '../data/configs/resource-preload';
import { SceneFlow, SceneSwitchOptions } from './SceneFlow';
import { ServiceLocator } from './ServiceLocator';
import { LoadingUI } from '../presentation/UI/LoadingUI';
import { SceneType } from './SceneContext';

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
    private saveSystem!: SaveSystem;
    private uiManager!: UIManager;
    private sceneFlow!: SceneFlow;
    public isPaused: boolean = false;

    /** 视图父节点 */
    @property(Node)
    public viewParent: Node = null!;

    async onLoad() {
        // 初始化桥接层
        this.commandBuffer = new CommandBuffer();
        this.eventBus = new EventBus();
        ServiceLocator.register(CommandBuffer, this.commandBuffer);
        ServiceLocator.register(EventBus, this.eventBus);

        // 初始化 ECS 世界
        this.world = new World({ 
            debug: true,
            initialEntityPoolSize: 1000,
            componentPoolSize: 100
        });

        // 初始化资源管理器
        this.resourceManager = new ResourceManager();
        ServiceLocator.register(ResourceManager, this.resourceManager);
        
        // 初始化资源预加载器
        this.resourcePreloader = new ResourcePreloader();
        ServiceLocator.register(ResourcePreloader, this.resourcePreloader);

        // 初始化表现层
        this.viewManager = new ViewManager();
        this.viewManager.setEventBus(this.eventBus); // 设置 EventBus，用于发送视图创建确认事件
        this.viewManager.setWorld(this.world); // 设置 World，用于查询实体
        this.viewManager.setViewParent(this.viewParent); // 设置视图父节点
        ServiceLocator.register(ViewManager, this.viewManager);
        // 初始化配置系统
        this.configLoader = new ConfigLoader();
        ServiceLocator.register(ConfigLoader, this.configLoader);
        // 初始化存档系统（必须在 ConfigLoader 之后）
        this.saveSystem = this.world.registerSystem(SaveSystem);
        this.saveSystem.setConfigLoader(this.configLoader);
        ServiceLocator.register(SaveSystem, this.saveSystem);

        // 初始化 UI 管理器
        this.uiManager = new UIManager();
        this.uiManager.setWorld(this.world);
        this.uiManager.setEventBus(this.eventBus);
        ServiceLocator.register(UIManager, this.uiManager);
        // 初始化场景流程管理器
        this.sceneFlow = new SceneFlow(
            this.world,
            this
        );
        
        // 初始化表现层驱动
        this.animDriver = new AnimDriver(this.eventBus);
        this.viewManager.setAnimDriver(this.animDriver); // 设置 AnimDriver，用于播放动画
        
        this.fxDriver = new FxDriver(this.resourceManager, this.configLoader);
        this.viewManager.setFxDriver(this.fxDriver); // 设置 FxDriver，用于播放特效
        
        this.audioDriver = new AudioDriver(this.resourceManager, this.configLoader);
        this.audioDriver.setViewParent(this.viewParent); // 设置视图父节点，初始化音频源
        this.viewManager.setAudioDriver(this.audioDriver); // 设置 AudioDriver，用于播放音效

        // 注册服务到 ServiceLocator
        ServiceLocator.register(World, this.world);
        ServiceLocator.register(Scheduler, this.scheduler);
        ServiceLocator.register(SceneFlow, this.sceneFlow);

        // 启动时预加载核心资源（可选：显示加载进度）
        try {
            this.uiManager.showUI('LoadingUI');
            const loadingUI = this.uiManager.getUI('LoadingUI') as LoadingUI;
            loadingUI?.setProgress(0);
            await this.resourcePreloader.preloadParallel(
                StartupPreloadConfig,
                (progress) => {
                    console.log(`[GameApp] Preload progress: ${(progress * 100).toFixed(1)}%`);
                    // 更新 UI 加载进度条
                    loadingUI?.setProgress(progress);
                }
            );
            console.log('[GameApp] Preload completed');
        } catch (error) {
            console.error('[GameApp] Preload failed:', error);
            // 继续游戏，按需加载
        }
        this.uiManager.hideUI('LoadingUI');

        // 注册 Fixed Systems (priority 0-99)
        this.world.registerSystem(MoveSystem);
        this.world.registerSystem(CombatSystem);
        this.world.registerSystem(DeathSystem);

        // 注册 DestroySystem（处理实体销毁，两阶段销毁 + 超时保护）
        const destroySystem = this.world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(this.commandBuffer);
        destroySystem.setEventBus(this.eventBus);

        // 注册 ViewSpawnSystem（处理视图创建确认）
        const viewSpawnSystem = this.world.registerSystem(ViewSpawnSystem);
        viewSpawnSystem.setEventBus(this.eventBus);

        // 注册 AnimationEventSystem（处理动画事件）
        const animationEventSystem = this.world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(this.eventBus);

        // 注册 InventorySystem 和 EquipmentSystem（UISystem 需要）
        const inventorySystem = this.world.registerSystem(InventorySystem);
        inventorySystem.setConfigLoader(this.configLoader);
        
        const equipmentSystem = this.world.registerSystem(EquipmentSystem);
        equipmentSystem.setConfigLoader(this.configLoader);
        equipmentSystem.setEventBus(this.eventBus);

        // 注册 UI 系统（处理 UI 事件）
        const uiSystem = this.world.registerSystem(UISystem);
        uiSystem.setEventBus(this.eventBus);
        uiSystem.setInventorySystem(inventorySystem);
        uiSystem.setEquipmentSystem(equipmentSystem);
        
        // 注册 Render Systems (priority 100+)
        this.world.registerSystem(AnimationIntentSystem);

        const renderSyncSystem = this.world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(this.commandBuffer);

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
        this.scheduler.registerFixedSystem(MoveSystem);
        this.scheduler.registerFixedSystem(CombatSystem);
        this.scheduler.registerFixedSystem(DeathSystem);
        this.scheduler.registerFixedSystem(DestroySystem);
        this.scheduler.registerFixedSystem(ViewSpawnSystem);
        this.scheduler.registerFixedSystem(AnimationEventSystem);
        this.scheduler.registerFixedSystem(InventorySystem);
        this.scheduler.registerFixedSystem(EquipmentSystem);
        this.scheduler.registerFixedSystem(UISystem);
        
        this.scheduler.registerRenderSystem(AnimationIntentSystem);
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
    }

    /**
     * 切换场景（委托给 SceneFlow）
     * @param sceneType 场景类型
     * @param options 切换选项
     */
    public async switchScene(sceneType: SceneType, options?: SceneSwitchOptions): Promise<void> {
        return this.sceneFlow.switchScene(sceneType, options);
    }

    /**
     * 获取当前场景
     */
    public getCurrentScene(): SceneType {
        return this.sceneFlow.getCurrentScene();
    }

    /**
     * 保存游戏（到指定槽位）
     * @param slotIndex 存档槽位索引（0-2）
     * @returns 是否保存成功
     */
    public saveGame(slotIndex: number = 0): boolean {
        if (!this.saveSystem) {
            console.error('[GameApp] SaveSystem not initialized');
            return false;
        }

        const success = this.saveSystem.saveGame(slotIndex);
        if (success) {
            const saveInfo = this.saveSystem.getSaveInfo(slotIndex);
            if (saveInfo) {
                const date = new Date(saveInfo.timestamp);
                console.log(`[GameApp] Game saved to slot ${slotIndex} at ${date.toLocaleTimeString()}, version: ${saveInfo.version}`);
            }
        } else {
            console.error(`[GameApp] Failed to save game to slot ${slotIndex}`);
        }
        return success;
    }

    /**
     * 读取游戏（从指定槽位，重建 World）
     * @param slotIndex 存档槽位索引（0-2）
     * @returns 是否读取成功
     */
    public loadGame(slotIndex: number = 0): boolean {
        if (!this.saveSystem) {
            console.error('[GameApp] SaveSystem not initialized');
            return false;
        }

        if (!this.saveSystem.hasSave(slotIndex)) {
            console.warn(`[GameApp] No save file found in slot ${slotIndex}`);
            return false;
        }

        // 读档：重建 World
        const newWorld = this.saveSystem.loadGame(slotIndex);
        if (!newWorld) {
            console.error(`[GameApp] Failed to load game from slot ${slotIndex}`);
            return false;
        }

        // 替换现有 World
        const oldWorld = this.world;
        this.world = newWorld;

        // 重新注册所有系统到新 World
        this.setupSystemsForWorld(newWorld);

        // 重新初始化 ViewManager（重建 View）
        this.viewManager.clear(); // 清空所有 View
        this.viewManager.setWorld(newWorld);

        // 更新调度器中的 World
        this.scheduler = new Scheduler(
            newWorld,
            this.commandBuffer,
            this.eventBus,
            {
                fixedDeltaTime: 1 / 60,
                maxAccumulator: 0.25
            }
        );

        // 重新注册系统到调度器
        this.setupSchedulerForSystems();

        // 为所有需要视图的实体重新创建 View（通过 NeedViewTag）
        this.restoreEntityViews(newWorld);

        // 销毁旧 World
        if (oldWorld) {
            oldWorld.destroy();
        }

        console.log(`[GameApp] Game loaded from slot ${slotIndex}`);
        return true;
    }

    /**
     * 删除存档
     * @param slotIndex 存档槽位索引（0-2）
     * @returns 是否删除成功
     */
    public deleteSave(slotIndex: number = 0): boolean {
        if (!this.saveSystem) {
            console.error('[GameApp] SaveSystem not initialized');
            return false;
        }

        const success = this.saveSystem.deleteSave(slotIndex);
        if (success) {
            console.log(`[GameApp] Save deleted from slot ${slotIndex}`);
        } else {
            console.error(`[GameApp] Failed to delete save from slot ${slotIndex}`);
        }
        return success;
    }

    /**
     * 检查是否有存档
     * @param slotIndex 存档槽位索引（0-2）
     * @returns 是否存在存档
     */
    public hasSave(slotIndex: number = 0): boolean {
        if (!this.saveSystem) {
            return false;
        }
        return this.saveSystem.hasSave(slotIndex);
    }

    /**
     * 获取存档信息
     * @param slotIndex 存档槽位索引（0-2）
     * @returns 存档信息，如果不存在返回 null
     */
    public getSaveInfo(slotIndex: number = 0) {
        if (!this.saveSystem) {
            return null;
        }
        return this.saveSystem.getSaveInfo(slotIndex);
    }

    /**
     * 为新 World 注册所有系统（读档后使用）
     */
    private setupSystemsForWorld(world: World): void {
        // 注册阶段 1 Fixed Systems
        world.registerSystem(MoveSystem);
        world.registerSystem(CombatSystem);
        world.registerSystem(DeathSystem);

        const destroySystem = world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(this.commandBuffer);
        destroySystem.setEventBus(this.eventBus);

        // 注册 ViewSpawnSystem（处理视图创建确认）
        const viewSpawnSystem = world.registerSystem(ViewSpawnSystem);
        viewSpawnSystem.setEventBus(this.eventBus);

        // 注册 AnimationEventSystem（处理动画事件）
        const animationEventSystem = world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(this.eventBus);

        // 注册 Render Systems
        world.registerSystem(AnimationIntentSystem);

        const renderSyncSystem = world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(this.commandBuffer);

        // 重新注册 SaveSystem
        this.saveSystem = world.registerSystem(SaveSystem);
        this.saveSystem.setConfigLoader(this.configLoader);

        // 重新注册 UI 系统
        const uiSystem = world.registerSystem(UISystem);
        uiSystem.setEventBus(this.eventBus);
        
        const inventorySystem = world.registerSystem(InventorySystem);
        inventorySystem.setConfigLoader(this.configLoader);
        
        const equipmentSystem = world.registerSystem(EquipmentSystem);
        equipmentSystem.setConfigLoader(this.configLoader);
        equipmentSystem.setEventBus(this.eventBus);
        
        uiSystem.setInventorySystem(inventorySystem);
        uiSystem.setEquipmentSystem(equipmentSystem);
    }

    /**
     * 为调度器注册所有系统（读档后使用）
     */
    private setupSchedulerForSystems(): void {
        // 注册阶段 1 Fixed Systems
        this.scheduler.registerFixedSystem(MoveSystem);
        this.scheduler.registerFixedSystem(CombatSystem);
        this.scheduler.registerFixedSystem(DeathSystem);
        this.scheduler.registerFixedSystem(DestroySystem);
        this.scheduler.registerFixedSystem(ViewSpawnSystem);
        this.scheduler.registerFixedSystem(AnimationEventSystem);
        this.scheduler.registerFixedSystem(InventorySystem);
        this.scheduler.registerFixedSystem(EquipmentSystem);
        this.scheduler.registerFixedSystem(UISystem);

        // 注册 Render Systems
        this.scheduler.registerRenderSystem(AnimationIntentSystem);
        this.scheduler.registerRenderSystem(RenderSyncSystem);
    }

    /**
     * 恢复实体视图（读档后为需要视图的实体添加 NeedViewTag）
     */
    private restoreEntityViews(world: World): void {
        // 查询所有有 ViewLinkComponent 的实体
        const viewQuery = world.createQuery({
            all: [ViewLinkComponent]
        });

        viewQuery.forEach(entity => {
            const viewLink = entity.getComponent(ViewLinkComponent);
            if (viewLink && viewLink.prefabKey) {
                // 添加 NeedViewTag，触发 ViewSpawnSystem 创建视图
                entity.addComponent(NeedViewTagComponent);
            }
        });
    }

    /**
     * 暂停游戏
     */
    public pause(): void {
        this.isPaused = true;
        this.scheduler.setMode(SchedulerMode.Paused);
        this.animDriver.pauseAllAnim();
        this.fxDriver.pauseAllFx();
        this.audioDriver.pauseAllAudio();
    }

    /**
     * 恢复游戏
     */
    public resume(): void {
        this.isPaused = false;
        this.scheduler.setMode(SchedulerMode.Running);
        this.animDriver.resumeAllAnim();
        this.fxDriver.resumeAllFx();
        this.audioDriver.resumeAllAudio();
    }

    onDestroy() {
        // 清理资源
        if (this.uiManager) {
            this.uiManager.clear();
        }
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

