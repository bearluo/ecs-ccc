/**
 * 视图管理器
 * 
 * 管理 Entity 与 Creator Node 的映射关系
 * 消费 CommandBuffer 中的命令，更新 View 层
 */

import { Node, Prefab, instantiate, director } from 'cc';
import { Entity, Handle } from '@bl-framework/ecs';
import { RenderCommand } from '../bridge/CommandBuffer';
import { ViewPool } from './ViewPool';
import { NodeBinder } from './NodeBinder';
import { EventBus } from '../bridge/EventBus';
import { AnimDriver } from './AnimDriver';
import { FxDriver } from './FxDriver';
import { AudioDriver } from './AudioDriver';
import { AnimStateComponent } from '../gameplay/components/AnimState';
import { ViewLinkComponent } from '../gameplay/components/ViewLink';
import { ResourceManager } from './ResourceManager';

/**
 * 视图管理器
 * 
 * ⚠️ 关键修正：使用 Handle 而不是 entityId，避免异步操作错误
 * ⚠️ Handle 作为 Map Key：使用字符串 key 避免对象引用问题
 */
export class ViewManager {
    /** Handle Key → Node 映射（使用字符串 key 避免 Handle 对象引用问题） */
    private handleNodeMap: Map<string, Node> = new Map();

    /** Node → Handle 映射（反向查找，直接存储 Handle 对象） */
    private nodeHandleMap: Map<Node, Handle> = new Map();

    /** EntityId → Node 映射（保留，用于 ViewPool） */
    private entityNodeMap: Map<number, Node> = new Map();

    /** 资源管理器 */
    private resourceManager: ResourceManager;

    /** 视图对象池 */
    private viewPool: ViewPool;

    /** 节点绑定器 */
    private nodeBinder: NodeBinder;

    /** 事件总线（用于发送视图创建确认事件） */
    private eventBus?: EventBus;

    /** 动画驱动 */
    private animDriver?: AnimDriver;

    /** 特效驱动 */
    private fxDriver?: FxDriver;

    /** 音频驱动 */
    private audioDriver?: AudioDriver;
    
    /** 视图父节点 */
    private viewParent?: Node;

    /** World 引用（用于查询实体） */
    private world?: any; // @bl-framework/ecs World

    constructor(resourceManager?: ResourceManager) {
        this.resourceManager = resourceManager || new ResourceManager();
        this.viewPool = new ViewPool(20, this.resourceManager); // 默认池大小 20
        this.nodeBinder = new NodeBinder();
    }

    /**
     * 设置资源管理器（依赖注入）
     */
    setResourceManager(resourceManager: ResourceManager): void {
        this.resourceManager = resourceManager;
        this.viewPool.setResourceManager(resourceManager);
    }

    /**
     * 设置视图父节点
     */
    setViewParent(viewParent: Node): void {
        this.viewParent = viewParent;
    }

    /**
     * 设置 EventBus（依赖注入）
     */
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 设置 AnimDriver（依赖注入）
     */
    setAnimDriver(animDriver: AnimDriver): void {
        this.animDriver = animDriver;
        animDriver.setNodeBinder(this.nodeBinder);
    }

    /**
     * 设置 FxDriver（依赖注入）
     */
    setFxDriver(fxDriver: FxDriver): void {
        this.fxDriver = fxDriver;
    }

    /**
     * 设置 AudioDriver（依赖注入）
     */
    setAudioDriver(audioDriver: AudioDriver): void {
        this.audioDriver = audioDriver;
    }

    /**
     * 设置 World（用于查询实体）
     */
    setWorld(world: any): void {
        this.world = world;
    }

    /**
     * 将 Handle 转换为唯一 key（避免 Handle 对象引用问题）
     * Handle 结构：{ id: number, gen: number }
     */
    private handleToKey(handle: Handle): string {
        return `${(handle as any).id}_${(handle as any).gen}`;
    }

    /**
     * 处理渲染命令
     */
    processCommands(commands: RenderCommand[]): void {
        for (const command of commands) {
            switch (command.type) {
                case 'SpawnView':
                    this.spawnView(command.handle, command.prefabKey);
                    break;
                case 'SetPosition':
                    this.setPosition(command.handle, command.x, command.y);
                    break;
                case 'PlayAnim':
                    this.playAnim(command.handle, command.animName);
                    break;
                case 'PlayFxAtPosition': {
                    // 直接在指定坐标位置播放特效
                    if (this.fxDriver && this.viewParent) {
                        // 异步调用，不等待结果（fire and forget）
                        this.fxDriver.playFx(command.fxKey, command.position, this.viewParent).catch(error => {
                            console.error(`[ViewManager] Failed to play fx: ${command.fxKey}`, error);
                        });
                    }
                    break;
                }
                case 'PlayFxOnEntity': {
                    // 在指定实体位置播放特效
                    const node = this.getNodeByHandle(command.handle);
                    if (!node) {
                        console.warn(`[ViewManager] Cannot find node for handle: ${command.handle}`);
                        break;
                    }
                    
                    const worldPos = node.getWorldPosition();
                    const position = { x: worldPos.x, y: worldPos.y };
                    
                    if (this.fxDriver && this.viewParent) {
                        // 异步调用，不等待结果（fire and forget）
                        this.fxDriver.playFx(command.fxKey, position, this.viewParent).catch(error => {
                            console.error(`[ViewManager] Failed to play fx: ${command.fxKey}`, error);
                        });
                    }
                    break;
                }
                case 'PlaySFX': {
                    if (this.audioDriver) {
                        // 异步调用，不等待结果（fire and forget）
                        this.audioDriver.playSFX(command.sfxKey, command.volume).catch(error => {
                            console.error(`[ViewManager] Failed to play SFX: ${command.sfxKey}`, error);
                        });
                    }
                    break;
                }
                case 'PlayBGM': {
                    if (this.audioDriver) {
                        // 异步调用，不等待结果（fire and forget）
                        this.audioDriver.playBGM(command.bgmKey, command.loop, command.volume).catch(error => {
                            console.error(`[ViewManager] Failed to play BGM: ${command.bgmKey}`, error);
                        });
                    }
                    break;
                }
                case 'DestroyView':
                    this.destroyView(command.handle);
                    break;
            }
        }
    }

    /**
     * 生成视图
     */
    private spawnView(handle: Handle, prefabKey: string): void {
        if (!this.world || !this.world.isValidHandle(handle)) {
            console.warn(`[ViewManager] Invalid handle for spawn: ${handle}`);
            return;
        }

        const entity = this.world.getEntityByHandle(handle);
        if (!entity) {
            console.warn(`[ViewManager] Entity not found for handle: ${handle}`);
            return;
        }

        const entityId = entity.id;
        const handleKey = this.handleToKey(handle);

        // 如果已存在，先销毁
        if (this.handleNodeMap.has(handleKey)) {
            this.destroyView(handle);
        }

        // 从对象池获取节点（不传递 entityId，使用 handleKey 作为 ownerKey）
        const node = this.viewPool.get(prefabKey, handleKey);
        if (!node) {
            // Prefab 未加载，发送失败事件，由 RenderSyncSystem 在下一帧再次触发
            if (this.eventBus) {
                this.eventBus.push({
                    type: 'ViewEvent',
                    eventName: 'ViewSpawnFailed',
                    entityId: entityId
                });
            }
            return;
        }
        
        // 添加到场景
        if (this.viewParent) {
            this.viewParent.addChild(node);
        }

        // 记录映射
        this.handleNodeMap.set(handleKey, node);
        this.nodeHandleMap.set(node, handle); // 直接存储 Handle 对象
        this.entityNodeMap.set(entityId, node); // 保留用于 ViewPool
        
        // 绑定节点（使用 Handle）
        this.nodeBinder.bind(node, handle);

        // 设置动画组件（如果 AnimDriver 已设置）
        if (this.animDriver) {
            this.animDriver.setupAnimation(node);
        }

        // 发送成功事件
        if (this.eventBus) {
            this.eventBus.push({
                type: 'ViewEvent',
                eventName: 'ViewSpawned',
                entityId: entityId
            });
        }
    }

    /**
     * 设置位置
     */
    private setPosition(handle: Handle, x: number, y: number): void {
        const handleKey = this.handleToKey(handle);
        const node = this.handleNodeMap.get(handleKey);
        if (node) {
            node.setPosition(x, y, 0);
        }
    }

    /**
     * 播放动画
     */
    private playAnim(handle: Handle, animName: string): void {
        const handleKey = this.handleToKey(handle);
        const node = this.handleNodeMap.get(handleKey);
        if (!node) return;

        if (!this.animDriver) {
            console.warn(`[ViewManager] AnimDriver not set`);
            return;
        }

        // 获取 AnimState 以获取动画速度
        if (!this.world || !this.world.isValidHandle(handle)) {
            return;
        }

        const entity = this.world.getEntityByHandle(handle);
        if (!entity) return;

        const animState = entity.getComponent(AnimStateComponent);
        const speed = animState?.speed || 1.0;

        // 判断是否循环（持续动画循环，触发动画不循环）
        const isLoop = this.isContinuousAnim(animName);

        // 通过 AnimDriver 播放动画
        this.animDriver.playAnim(node, animName, speed, isLoop);
    }

    /**
     * 判断是否为持续动画（循环播放）
     */
    private isContinuousAnim(animName: string): boolean {
        const continuousAnims = ['idle', 'move', 'run'];
        return continuousAnims.indexOf(animName) >= 0;
    }

    /**
     * 通过 entityId 获取实体（需要 World 支持）
     */
    private getEntityById(entityId: number): Entity | null {
        if (!this.world) return null;
        // 注意：这里需要 World 提供 getEntityById 方法
        // 如果不存在，需要通过查询获取
        try {
            return this.world.getEntityById?.(entityId) || null;
        } catch {
            return null;
        }
    }

    /**
     * 销毁视图
     */
    private destroyView(handle: Handle): void {
        const handleKey = this.handleToKey(handle);
        const node = this.handleNodeMap.get(handleKey);
        if (!node) return;

        // 获取 entityId（用于 ViewPool）
        let entityId: number | undefined;
        if (this.world && this.world.isValidHandle(handle)) {
            const entity = this.world.getEntityByHandle(handle);
            if (entity) {
                entityId = entity.id;
            }
        }

        // 从场景移除
        if (node.parent) {
            node.removeFromParent();
        }

        // 移除映射
        this.handleNodeMap.delete(handleKey);
        this.nodeHandleMap.delete(node);
        if (entityId) {
            this.entityNodeMap.delete(entityId);
        }

        // 解绑节点
        this.nodeBinder.unbind(node);

        // 回收到对象池（直接传递 node，不传递 entityId）
        this.viewPool.release(node);
    }

    /**
     * 获取 Handle 对应的 Node
     */
    getNodeByHandle(handle: Handle): Node | undefined {
        const handleKey = this.handleToKey(handle);
        return this.handleNodeMap.get(handleKey);
    }

    /**
     * 获取 Node 对应的 Handle
     */
    getHandleByNode(node: Node): Handle | undefined {
        return this.nodeHandleMap.get(node);
    }

    /**
     * 获取 EntityId 对应的 Node（保留，用于向后兼容）
     */
    getNode(entityId: number): Node | undefined {
        return this.entityNodeMap.get(entityId);
    }

    /**
     * 清空所有视图
     */
    clear(): void {
        // 回收所有节点到对象池
        // 直接使用 nodeHandleMap 获取 Handle，无需字符串转换
        const nodesToDestroy: Node[] = [];
        for (const node of this.handleNodeMap.values()) {
            nodesToDestroy.push(node);
        }
        
        for (const node of nodesToDestroy) {
            const handle = this.nodeHandleMap.get(node);
            if (handle) {
                this.destroyView(handle);
            }
        }
        
        this.handleNodeMap.clear();
        this.nodeHandleMap.clear();
        this.entityNodeMap.clear();
        this.nodeBinder.clear();
        this.viewPool.clear();
    }

    /**
     * 获取视图对象池（用于配置池大小等）
     */
    getViewPool(): ViewPool {
        return this.viewPool;
    }

    /**
     * 获取节点绑定器
     */
    getNodeBinder(): NodeBinder {
        return this.nodeBinder;
    }
}

