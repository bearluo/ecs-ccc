/**
 * 特效驱动
 * 
 * 负责播放特效（粒子、动画等）
 * 
 * ⚠️ 关键设计：
 * - 使用对象池管理特效节点（按 fxKey 分类）
 * - 使用 update(dt) 统一管理生命周期（禁止 setTimeout）
 * - 异步 playFx，不返回 Node（避免外部反向耦合）
 * - 支持 priority 配置（critical 必须预加载）
 */

import { Node, Prefab, ParticleSystem2D, instantiate } from 'cc';
import { ResourceManager } from './ResourceManager';
import { ConfigLoader } from '../ConfigLoader';

/**
 * 特效驱动
 */
export class FxDriver {
    private resourceManager: ResourceManager;
    private configLoader: ConfigLoader;
    
    /** 特效对象池（按 fxKey 分类） */
    private fxPools: Map<string, Node[]> = new Map();
    
    /** 活跃的特效节点（用于清理） */
    private activeFxNodes: Map<Node, { fxKey: string; remainingTime: number }> = new Map();
    
    constructor(resourceManager: ResourceManager, configLoader: ConfigLoader) {
        this.resourceManager = resourceManager;
        this.configLoader = configLoader;
    }
    
    /**
     * 播放特效
     * ⚠️ 架构约束：异步方法，如果 Prefab 未加载则按需加载
     * ⚠️ 返回值：不返回 Node，Driver 内部管理 Node，避免外部反向耦合
     * 预加载由 ResourcePreloader 统一管理，但支持按需加载（ResourceManager 会处理缓存）
     */
    async playFx(fxKey: string, position: { x: number; y: number }, parent?: Node): Promise<void> {
        const config = this.configLoader.getFxConfig(fxKey);
        if (!config) {
            console.warn(`[FxDriver] FxConfig not found: ${fxKey}`);
            return;
        }
        
        // 直接调用 loadPrefab，ResourceManager 会自动处理缓存和去重
        let prefab: Prefab;
        try {
            prefab = await this.resourceManager.loadPrefab(config.prefabPath);
        } catch (error) {
            console.error(`[FxDriver] Failed to load fx prefab: ${fxKey}`, error);
            return;
        }
        
        // 确保对象池存在
        if (!this.fxPools.has(fxKey)) {
            this.fxPools.set(fxKey, []);
        }
        
        // 从对象池获取或创建节点
        let node: Node | null = null;
        const pool = this.fxPools.get(fxKey)!;
        
        if (pool.length > 0) {
            node = pool.pop()!;
            node.active = true;  // 激活节点
        } else {
            node = instantiate(prefab);
        }
        
        // 设置位置
        node.setPosition(position.x, position.y, 0);
        
        // 设置父节点
        if (parent) {
            parent.addChild(node);
        }
        
        // 播放粒子系统或动画
        // 注意：ParticleSystem2D 在 resetSystem() 后会自动播放，无需手动调用 play()
        const particleSystem = node.getComponent(ParticleSystem2D);
        if (particleSystem) {
            particleSystem.resetSystem();
        }
        
        // 记录活跃节点（使用剩余时间，而不是绝对时间）
        const remainingTime = config.duration || Infinity;
        this.activeFxNodes.set(node, { fxKey, remainingTime });
        
        // ⚠️ 不返回 Node，Driver 内部管理，避免外部反向耦合
    }
    
    /**
     * 停止特效（回收到对象池）
     */
    stopFx(node: Node): void {
        if (!this.activeFxNodes.has(node)) {
            return;
        }
        
        const { fxKey } = this.activeFxNodes.get(node)!;
        
        // 停止粒子系统
        const particleSystem = node.getComponent(ParticleSystem2D);
        if (particleSystem) {
            particleSystem.stopSystem();
        }
        
        // 移除父节点
        if (node.parent) {
            node.parent.removeChild(node);
        }
        
        // 回收到对象池
        node.active = false;
        const pool = this.fxPools.get(fxKey) || [];
        const config = this.configLoader.getFxConfig(fxKey);
        const maxSize = config?.poolSize || 10;
        
        if (pool.length < maxSize) {
            pool.push(node);
            this.fxPools.set(fxKey, pool);
        } else {
            // 对象池已满，销毁节点
            node.destroy();
        }
        
        // 移除活跃记录
        this.activeFxNodes.delete(node);
    }
    
    /**
     * 更新特效生命周期（必须在每帧调用）
     * ⚠️ 关键：统一走 update(dt)，禁止使用 setTimeout
     * 原因：
     * 1. 与游戏暂停/时间缩放同步
     * 2. Scene 切换时安全清理
     * 3. Node 已被 destroy 时不会触发
     */
    update(dt: number): void {
        const nodesToStop: Node[] = [];
        
        // 遍历所有活跃特效，更新剩余时间
        for (const [node, info] of this.activeFxNodes.entries()) {
            // 检查节点是否有效
            if (!node.isValid) {
                nodesToStop.push(node);
                continue;
            }
            
            // 更新剩余时间
            info.remainingTime -= dt;
            
            // 如果时间到期，标记为停止
            if (info.remainingTime <= 0) {
                nodesToStop.push(node);
            }
        }
        
        // 停止到期的特效
        for (const node of nodesToStop) {
            this.stopFx(node);
        }
    }
    
    /**
     * 清理所有特效
     */
    clear(): void {
        // 清理所有活跃特效
        for (const node of this.activeFxNodes.keys()) {
            this.stopFx(node);
        }
        
        // 销毁对象池中的节点
        for (const pool of this.fxPools.values()) {
            for (const node of pool) {
                node.destroy();
            }
        }
        
        this.fxPools.clear();
        this.activeFxNodes.clear();
    }
}
