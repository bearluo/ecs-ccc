/**
 * 视图对象池
 * 
 * 管理视图（Node）的对象池，支持对象复用，减少创建/销毁开销
 * 
 * 设计决策：使用多池管理（每个 prefabKey 一个池），支持池大小限制
 * 参考文档：memory-bank/creative/creative-view-pool.md
 */

import { Node, Prefab, instantiate } from 'cc';
import { ResourceManager } from './ResourceManager';
import { ServiceLocator } from '../app/ServiceLocator';

/**
 * 节点池（单个类型）
 */
class NodePool {
    private pool: Node[] = [];
    private maxSize: number;
    private prefabKey: string;
    private prefab?: Prefab;

    constructor(prefabKey: string, maxSize: number) {
        this.prefabKey = prefabKey;
        this.maxSize = maxSize;
    }

    /**
     * 从池中获取节点
     * ⚠️ 架构约束：如果 Prefab 未加载，返回 null
     */
    get(): Node | null {
        if (this.pool.length > 0) {
            const node = this.pool.pop()!;
            return node;
        }
        // 池为空，创建新节点（如果 Prefab 未加载会返回 null）
        return this.createNode();
    }

    /**
     * 检查是否有 Prefab（已加载）
     */
    hasPrefab(): boolean {
        return !!this.prefab;
    }

    /**
     * 回收节点到池中
     */
    release(node: Node): void {
        // 重置节点状态（不删除子节点，保留 prefab 结构）
        node.active = false;
        node.setPosition(0, 0, 0);
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(1, 1, 1);
        
        // 标记 prefabKey（用于回收时查找对应的池）
        (node as any).__prefabKey = this.prefabKey;
        
        // 注意：不删除子节点，因为 prefab 的子节点结构应该保留
        // 只重置节点的 Transform 状态即可
        
        if (this.pool.length < this.maxSize) {
            this.pool.push(node);
        } else {
            // 池已满，销毁节点
            node.destroy();
        }
    }

    /**
     * 创建新节点
     * ⚠️ 架构约束：如果 Prefab 未加载，返回 null（不创建临时 Node）
     */
    private createNode(): Node | null {
        // 如果 Prefab 已加载，直接实例化
        if (this.prefab) {
            const node = instantiate(this.prefab);
            (node as any).__prefabKey = this.prefabKey;
            return node;
        }

        // Prefab 未加载，返回 null（不创建临时 Node）
        // 由 RenderSyncSystem 在下一帧再次触发 SpawnView
        return null;
    }

    /**
     * 设置 Prefab（用于预加载）
     */
    setPrefab(prefab: Prefab): void {
        this.prefab = prefab;
    }

    /**
     * 清空池
     */
    clear(): void {
        for (const node of this.pool) {
            node.destroy();
        }
        this.pool = [];
    }

    /**
     * 获取池大小
     */
    getSize(): number {
        return this.pool.length;
    }

    /**
     * 获取最大池大小
     */
    getMaxSize(): number {
        return this.maxSize;
    }
}

/**
 * 视图对象池
 * 
 * 管理多种类型的视图对象池，支持对象复用
 */
export class ViewPool {
    /** 视图池：prefabKey -> NodePool */
    private pools: Map<string, NodePool> = new Map();
    
    /** 默认池大小 */
    private defaultMaxSize: number = 20;

    /** 资源管理器 */
    private resourceManager: ResourceManager;

    /**
     * 构造函数
     * @param defaultMaxSize 默认池大小（每个类型）
     */
    constructor(defaultMaxSize: number = 20) {
        this.defaultMaxSize = defaultMaxSize;
        this.resourceManager = ServiceLocator.require(ResourceManager);
    }

    /**
     * 获取视图（从池中或创建新节点）
     * ⚠️ 架构约束：不接收 entityId，ViewPool 不应知道 ECS 实体
     * @param prefabKey Prefab 键
     * @param ownerKey 所有者标识（仅用于调试/日志，不参与逻辑）
     * @returns 节点，如果 Prefab 未加载返回 null
     */
    get(prefabKey: string, ownerKey?: string): Node | null {
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = new NodePool(prefabKey, this.defaultMaxSize);
            this.pools.set(prefabKey, pool);
        }

        const node = pool.get();
        if (node) {
            node.active = true;
            if (ownerKey) {
                // ownerKey 仅用于日志记录
                (node as any).__ownerKey = ownerKey;
            }
        } else if (ownerKey) {
            // 记录日志（Prefab 未加载）
            console.warn(`[ViewPool] Prefab not loaded for ${prefabKey}, ownerKey=${ownerKey}`);
        }
        return node;
    }

    /**
     * 检查 Prefab 是否可用（已加载到 NodePool）
     * @param prefabKey Prefab 键
     * @returns 是否已加载
     */
    hasPrefab(prefabKey: string): boolean {
        const pool = this.pools.get(prefabKey);
        return pool ? pool.hasPrefab() : false;
    }

    /**
     * 预加载 Prefab（异步）
     * ⚠️ 架构约束：不管理加载状态，由 ResourceManager 管理
     * @param prefabKey Prefab 键
     * @param path 资源路径（相对于 resources 目录）
     */
    async preloadPrefab(prefabKey: string, path: string): Promise<void> {
        try {
            // 调用 ResourceManager 加载（ResourceManager 处理缓存和去重）
            const prefab = await this.resourceManager.loadPrefab(path);
            let pool = this.pools.get(prefabKey);
            if (!pool) {
                pool = new NodePool(prefabKey, this.defaultMaxSize);
                this.pools.set(prefabKey, pool);
            }
            pool.setPrefab(prefab);
        } catch (error) {
            console.error(`[ViewPool] Failed to preload prefab: ${prefabKey} from ${path}`, error);
        }
    }

    /**
     * 批量预加载 Prefab（并行）
     * @param paths Prefab 路径配置数组
     */
    async preloadPrefabs(paths: { prefabKey: string; path: string }[]): Promise<void> {
        const promises = paths.map(({ prefabKey, path }) => 
            this.preloadPrefab(prefabKey, path)
        );
        await Promise.all(promises);
    }

    /**
     * 回收视图（放回池中）
     * ⚠️ 架构约束：不接收 entityId，通过节点上的 prefabKey 标记查找对应的池
     * @param node 要回收的节点
     */
    release(node: Node): void {
        if (!node) return;
        
        // 查找对应的池（通过节点上的标记）
        const prefabKey = (node as any).__prefabKey;
        if (prefabKey) {
            const pool = this.pools.get(prefabKey);
            if (pool) {
                pool.release(node);
            } else {
                // 找不到对应的池，直接销毁
                node.destroy();
            }
        } else {
            // 没有标记，直接销毁
            node.destroy();
        }
    }

    /**
     * 清空所有池
     * ⚠️ 资源释放规则：先清空 ViewPool，再清空 ResourceManager
     */
    clear(): void {
        for (const pool of this.pools.values()) {
            pool.clear();
        }
        this.pools.clear();
    }

    /**
     * 获取池统计信息
     * ⚠️ 注意：不再跟踪 active 数量（因为不再使用 entityId）
     */
    getStats(): { [prefabKey: string]: { size: number; maxSize: number } } {
        const stats: { [prefabKey: string]: { size: number; maxSize: number } } = {};
        
        for (const [prefabKey, pool] of this.pools.entries()) {
            stats[prefabKey] = {
                size: pool.getSize(),
                maxSize: pool.getMaxSize()
            };
        }
        
        return stats;
    }

    /**
     * 设置特定类型的池大小
     * @param prefabKey Prefab 键
     * @param maxSize 最大池大小
     */
    setMaxSize(prefabKey: string, maxSize: number): void {
        let pool = this.pools.get(prefabKey);
        if (!pool) {
            pool = new NodePool(prefabKey, maxSize);
            this.pools.set(prefabKey, pool);
        } else {
            // 如果新的大小小于当前池大小，需要清理多余的节点
            const currentPool = pool as any;
            if (maxSize < currentPool.pool.length) {
                const excess = currentPool.pool.splice(maxSize);
                for (const node of excess) {
                    node.destroy();
                }
            }
            currentPool.maxSize = maxSize;
        }
    }
}
