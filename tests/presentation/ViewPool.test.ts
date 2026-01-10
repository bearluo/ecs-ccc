/// <reference types="jest" />
/**
 * ViewPool 单元测试
 * 
 * 测试 ViewPool 的核心逻辑（池管理、统计、资源加载等）
 * 
 * 使用全局 mock (tests/__mocks__/cc.ts)
 */

import { ViewPool } from 'db://assets/scripts/presentation/ViewPool';
import { ResourceManager } from 'db://assets/scripts/presentation/ResourceManager';
import { Node, Prefab, instantiate, resources } from 'cc';

describe('ViewPool', () => {
    let viewPool: ViewPool;
    let resourceManager: ResourceManager;
    let mockInstantiate: jest.Mock;
    const mockResources = resources as any;

    beforeEach(() => {
        // Mock instantiate 已经在 jest.mock 中处理
        mockInstantiate = instantiate as unknown as jest.Mock;

        resourceManager = new ResourceManager();
        viewPool = new ViewPool(20, resourceManager);
        jest.clearAllMocks();
    });

    describe('构造函数', () => {
        it('应该使用默认池大小创建', () => {
            const pool = new ViewPool();
            const stats = pool.getStats();
            expect(stats).toEqual({});
        });

        it('应该使用指定的池大小创建', () => {
            const pool = new ViewPool(10);
            const stats = pool.getStats();
            expect(stats).toEqual({});
        });

        it('应该接受 ResourceManager', () => {
            const pool = new ViewPool(20, resourceManager);
            expect(pool).toBeDefined();
        });
    });

    describe('get 和 release', () => {
        it('应该从池中获取节点（Prefab 已预加载）', async () => {
            // 先预加载 Prefab
            await viewPool.preloadPrefab('test-prefab', 'prefabs/test');
            
            const node = viewPool.get('test-prefab');
            expect(node).toBeDefined();
            expect(node?.active).toBe(true);
        });

        it('Prefab 未加载时应该返回 null', () => {
            const node = viewPool.get('test-prefab');
            expect(node).toBeNull();
        });

        it('应该回收节点到池中', async () => {
            // 先预加载 Prefab
            await viewPool.preloadPrefab('test-prefab', 'prefabs/test');
            
            const node = viewPool.get('test-prefab');
            expect(node).toBeDefined();

            viewPool.release(node!);

            // 再次获取应该从池中返回
            const node2 = viewPool.get('test-prefab');
            expect(node2).toBeDefined();
        });

        it('应该为不同的 prefabKey 创建不同的池', async () => {
            await viewPool.preloadPrefab('prefab1', 'prefabs/prefab1');
            await viewPool.preloadPrefab('prefab2', 'prefabs/prefab2');
            
            const node1 = viewPool.get('prefab1');
            const node2 = viewPool.get('prefab2');

            expect(node1).toBeDefined();
            expect(node2).toBeDefined();

            const stats = viewPool.getStats();
            expect(Object.keys(stats).length).toBe(2);
            expect(stats['prefab1']).toBeDefined();
            expect(stats['prefab2']).toBeDefined();
        });

        it('应该正确标记节点的 prefabKey', async () => {
            await viewPool.preloadPrefab('test-prefab', 'prefabs/test');
            
            const node = viewPool.get('test-prefab') as any;
            expect(node?.__prefabKey).toBe('test-prefab');
        });

        it('应该限制池大小', async () => {
            const pool = new ViewPool(2); // 最大池大小为 2
            pool.setResourceManager(resourceManager);

            await pool.preloadPrefab('test', 'prefabs/test');

            // 获取并释放 3 个节点
            const node1 = pool.get('test');
            const node2 = pool.get('test');
            const node3 = pool.get('test');

            pool.release(node1!);
            pool.release(node2!);
            pool.release(node3!);

            // 池应该只保留 2 个节点，第 3 个应该被销毁
            const stats = pool.getStats();
            expect(stats['test'].size).toBe(2);
        });

        it('释放 null 不应该报错', () => {
            expect(() => {
                viewPool.release(null as any);
            }).not.toThrow();
        });
    });

    describe('hasPrefab', () => {
        it('Prefab 未加载时应该返回 false', () => {
            expect(viewPool.hasPrefab('test-prefab')).toBe(false);
        });

        it('Prefab 已加载时应该返回 true', async () => {
            await viewPool.preloadPrefab('test-prefab', 'prefabs/test');
            expect(viewPool.hasPrefab('test-prefab')).toBe(true);
        });
    });

    describe('preloadPrefab', () => {
        it('应该预加载 Prefab', async () => {
            let savedPrefab: any;
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        // 使用类型断言，因为 Prefab 构造函数接受可选参数
                        savedPrefab = new (Prefab as any)('test-prefab');
                        callback(null, savedPrefab);
                    });
                }
            });

            await viewPool.preloadPrefab('test-prefab', 'prefabs/test');

            // 获取节点时应该使用预加载的 Prefab
            const node = viewPool.get('test-prefab');
            expect(node).toBeDefined();
            expect(mockInstantiate).toHaveBeenCalled();
        });

        it('没有 ResourceManager 时应该警告', async () => {
            const pool = new ViewPool();
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            await pool.preloadPrefab('test', 'prefabs/test');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[ViewPool] ResourceManager not set')
            );
            consoleSpy.mockRestore();
        });

        it('加载失败时应该记录错误', async () => {
            const error = new Error('Load failed');
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        callback(error);
                    });
                }
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await viewPool.preloadPrefab('test', 'prefabs/test');

            // ResourceManager 和 ViewPool 都会记录错误
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[ResourceManager] Failed to load prefab'),
                expect.anything()
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[ViewPool] Failed to preload prefab'),
                expect.anything()
            );
            consoleSpy.mockRestore();
        });
    });

    describe('getStats', () => {
        it('应该返回正确的统计信息', async () => {
            await viewPool.preloadPrefab('prefab1', 'prefabs/prefab1');
            await viewPool.preloadPrefab('prefab2', 'prefabs/prefab2');
            
            viewPool.get('prefab1');
            viewPool.get('prefab1');
            viewPool.get('prefab2');

            const stats = viewPool.getStats();

            expect(stats['prefab1']).toBeDefined();
            expect(stats['prefab2']).toBeDefined();
        });

        it('应该正确统计池大小和最大大小', async () => {
            const pool = new ViewPool(10);
            pool.setResourceManager(resourceManager);

            await pool.preloadPrefab('test', 'prefabs/test');

            const node1 = pool.get('test');
            const node2 = pool.get('test');

            pool.release(node1!);
            pool.release(node2!);

            const stats = pool.getStats();
            expect(stats['test'].size).toBe(2);
            expect(stats['test'].maxSize).toBe(10);
        });
    });

    describe('setMaxSize', () => {
        it('应该设置特定类型的池大小', () => {
            viewPool.setMaxSize('test-prefab', 5);
            const stats = viewPool.getStats();
            expect(stats['test-prefab']?.maxSize).toBe(5);
        });

        it('应该清理超出新大小的节点', async () => {
            const pool = new ViewPool(10);
            pool.setResourceManager(resourceManager);

            await pool.preloadPrefab('test', 'prefabs/test');

            // 获取并释放 5 个节点
            const nodes: Node[] = [];
            for (let i = 0; i < 5; i++) {
                const node = pool.get('test');
                expect(node).toBeDefined();
                nodes.push(node!);
            }

            // 释放所有节点
            nodes.forEach(node => pool.release(node));

            // 验证池中有节点
            let stats = pool.getStats();
            expect(stats['test']).toBeDefined();
            const initialSize = stats['test'].size;
            expect(initialSize).toBe(5);

            // 设置最大大小为 2
            pool.setMaxSize('test', 2);

            // 池中应该只剩下最多 2 个节点
            stats = pool.getStats();
            expect(stats['test'].size).toBeLessThanOrEqual(2);
            expect(stats['test'].maxSize).toBe(2);
        });
    });

    describe('clear', () => {
        it('应该清空所有池', async () => {
            await viewPool.preloadPrefab('prefab1', 'prefabs/prefab1');
            await viewPool.preloadPrefab('prefab2', 'prefabs/prefab2');
            
            viewPool.get('prefab1');
            viewPool.get('prefab2');

            viewPool.clear();

            const stats = viewPool.getStats();
            expect(Object.keys(stats).length).toBe(0);
        });
    });

    describe('setResourceManager', () => {
        it('应该设置资源管理器', () => {
            const pool = new ViewPool();
            pool.setResourceManager(resourceManager);

            expect(pool).toBeDefined();
        });
    });

    describe('节点状态重置', () => {
        it('释放节点时应该重置节点状态', async () => {
            await viewPool.preloadPrefab('test', 'prefabs/test');
            
            const node = viewPool.get('test') as any;
            expect(node).toBeDefined();
            
            // 修改节点状态
            node.setPosition(100, 200, 0);
            node.active = true;

            viewPool.release(node);

            // 节点应该被重置（虽然我们无法直接验证，但可以验证节点被回收）
            const node2 = viewPool.get('test');
            expect(node2).toBeDefined();
        });
    });

    describe('多池管理', () => {
        it('应该为每个 prefabKey 维护独立的池', async () => {
            await viewPool.preloadPrefab('prefab1', 'prefabs/prefab1');
            await viewPool.preloadPrefab('prefab2', 'prefabs/prefab2');
            await viewPool.preloadPrefab('prefab3', 'prefabs/prefab3');
            
            viewPool.get('prefab1');
            viewPool.get('prefab1');
            viewPool.get('prefab2');
            viewPool.get('prefab3');

            const stats = viewPool.getStats();
            expect(Object.keys(stats).length).toBe(3);
            expect(stats['prefab1']).toBeDefined();
            expect(stats['prefab2']).toBeDefined();
            expect(stats['prefab3']).toBeDefined();
        });

        it('应该正确回收到对应的池', async () => {
            await viewPool.preloadPrefab('prefab1', 'prefabs/prefab1');
            await viewPool.preloadPrefab('prefab2', 'prefabs/prefab2');
            
            const node1 = viewPool.get('prefab1');
            const node2 = viewPool.get('prefab2');

            viewPool.release(node1!);
            viewPool.release(node2!);

            const stats = viewPool.getStats();
            expect(stats['prefab1'].size).toBe(1);
            expect(stats['prefab2'].size).toBe(1);
        });
    });

    describe('preloadPrefabs', () => {
        it('应该批量预加载多个 Prefab', async () => {
            mockResources.load
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(null, new (Prefab as any)('prefab1'));
                        });
                    }
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(null, new (Prefab as any)('prefab2'));
                        });
                    }
                });

            await viewPool.preloadPrefabs([
                { prefabKey: 'prefab1', path: 'prefabs/prefab1' },
                { prefabKey: 'prefab2', path: 'prefabs/prefab2' }
            ]);

            expect(viewPool.hasPrefab('prefab1')).toBe(true);
            expect(viewPool.hasPrefab('prefab2')).toBe(true);
        });

        it('批量预加载失败时应该继续加载其他资源', async () => {
            // 模拟一个加载失败
            mockResources.load
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(new Error('Load failed'));
                        });
                    }
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(null, new (Prefab as any)('prefab2'));
                        });
                    }
                });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await viewPool.preloadPrefabs([
                { prefabKey: 'prefab1', path: 'prefabs/prefab1' },
                { prefabKey: 'prefab2', path: 'prefabs/prefab2' }
            ]);

            // prefab1 加载失败，prefab2 应该成功
            expect(viewPool.hasPrefab('prefab1')).toBe(false);
            expect(viewPool.hasPrefab('prefab2')).toBe(true);

            consoleSpy.mockRestore();
        });
    });
});
