/**
 * 场景流程管理器
 * 
 * 负责场景切换、资源预加载、场景清理和初始化
 * 
 * 设计决策：场景状态机 + World 保留策略
 * 参考文档：memory-bank/creative/creative-scene-flow.md
 */

import { director } from 'cc';
import { Query, World } from '@bl-framework/ecs';
import { SceneTagComponent } from '../gameplay/components/SceneTag';
import { ResourceManager } from '../presentation/ResourceManager';
import { ResourcePreloader } from '../presentation/ResourcePreloader';
import { ViewManager } from '../presentation/ViewManager';
import { ScenePreloadConfigs } from '../data/configs/resource-preload';
import { GameApp } from './GameApp';
import { SceneRegistry } from './SceneRegistry';
import { SceneContext, SceneType } from './SceneContext';
import { CocosSceneLoader, EngineSceneLoader } from './EngineSceneLoader';
import { CommandBuffer } from '../bridge/CommandBuffer';
import { ServiceLocator } from './ServiceLocator';

/**
 * 场景切换选项
 */
export interface SceneSwitchOptions {
    /** 是否预加载资源（默认 true） */
    preload?: boolean;
    /** 是否清理当前场景（默认 true） */
    cleanup?: boolean;
    /** 场景切换完成回调 */
    onComplete?: () => void;
    /** 场景切换失败回调 */
    onError?: (error: Error) => void;
}

/**
 * 场景切换 UI 接口
 */
export interface TransitionPresenter {
    show(scene: SceneType): void;
    progress(p: number): void;
    hide(): void;
    fail(err: Error): void;
}
  

/**
 * 场景流程管理器
 */
export class SceneFlow {
    private current: SceneType = SceneType.Main;
    private transitioning = false;
    private sceneTagQuery!: Query;
    private registry: typeof SceneRegistry = SceneRegistry;
    private engineLoader: EngineSceneLoader = new CocosSceneLoader((t) => this.getSceneName(t));
    private commandBuffer: CommandBuffer;

    private world: World;
    private gameApp: GameApp;
    private transitionPresenter: TransitionPresenter;
    /**
     * 场景名称映射（SceneType → Creator 场景名称）
     */
    private readonly sceneNameMap: Record<SceneType, string> = {
        [SceneType.Main]: 'scene-main',
        [SceneType.Battle]: 'scene-battle',
        [SceneType.Shop]: 'scene-shop',
        [SceneType.Boss]: 'scene-boss'
    };

    constructor(
        world: World,
        gameApp: GameApp
    ) {
        this.world = world;
        this.gameApp = gameApp;
        this.commandBuffer = ServiceLocator.require(CommandBuffer);
    }

    /**
     * 获取当前场景
     */
    getCurrentScene(): SceneType {
        return this.current;
    }

    /**
     * 切换场景
     */
    async switchScene(to: SceneType, opt: SceneSwitchOptions = {}): Promise<void> {
        if (this.transitioning) {
            console.warn(`[SceneFlow] Already transitioning to ${to}`);
            return;
        }
        this.transitioning = true;
        const from = this.current;
    
        const fromCtx = new SceneContext(this.world, from);
        const toCtx   = new SceneContext(this.world, to);

        try {
            this.beginTransition(from, to);

            // 1) preload
            if (opt.preload !== false) {
                await this.registry.get(to)?.preload?.(toCtx);
            }

            // 2) exit
            if (opt.cleanup !== false) {
                this.cleanupScene(from);
            }
            await this.registry.get(from)?.exit?.(fromCtx);

            // 3) engine load
            await this.engineLoader.load(to);

            // 4) enter
            await this.registry.get(to)?.enter(toCtx);

            this.current = to;
            opt.onComplete?.();
        } catch (error) {
            console.error(`[SceneFlow] Failed to switch scene to ${to}:`, error);
            opt.onError?.(error as Error);
            this.transitionPresenter?.fail(error as Error);
            throw error;
        } finally {
            this.endTransition();
            this.transitioning = false;
        }
    }

    /**
     * 获取场景名称（从 SceneType 转换为 Creator 场景名称）
     */
    private getSceneName(sceneType: SceneType): string {
        return this.sceneNameMap[sceneType] || 'scene-main';
    }

    /**
     * 清理场景（只清理场景特定的实体，保留玩家数据）
     */
    private cleanupScene(sceneType: SceneType): void {
        // 查询所有带当前场景 Tag 的实体
        const sceneQuery = this.sceneTagQuery;

        const entitiesToDestroy: any[] = [];
        sceneQuery.forEach(entity => {
            const tag = entity.getComponent(SceneTagComponent);
            if (tag && tag.sceneType === sceneType) {
                entitiesToDestroy.push(entity);
            }
        });

        // 销毁场景特定实体和view视图
        entitiesToDestroy.forEach(entity => {
            this.commandBuffer.push({ type: 'DestroyView', handle: entity.handle });
            this.world.destroyEntity(entity);
        });
    }

    /**
     * 设置场景切换 Presenter
     * @param transitionPresenter 场景切换 Presenter
     */
    setTransitionPresenter(transitionPresenter: TransitionPresenter): void {
        this.transitionPresenter = transitionPresenter;
    }

    /**
     * 开始场景切换
     */
    private beginTransition(from: SceneType, to: SceneType): void {
        this.gameApp.pause();
        // TODO: 锁定输入
        // this.inputLock?.lock?.();
        this.transitionPresenter?.show(this.current);
    }

    /**
     * 结束场景切换
     */
    private endTransition(): void {
        this.transitionPresenter?.hide();
        // TODO: 解锁输入
        // this.inputLock?.lock?.();
        this.gameApp.resume();
    }
}
