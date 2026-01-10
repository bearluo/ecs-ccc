/// <reference types="jest" />
/**
 * ResourceManager 单元测试
 * 
 * 注意：由于 ResourceManager 依赖 Cocos Creator 的 resources API，完整测试需要在 Cocos Creator 环境中进行
 * 这里只测试核心逻辑（缓存、加载状态管理等）
 * 
 * 使用全局 mock (tests/__mocks__/cc.ts)
 */

import { ResourceManager } from 'db://assets/scripts/presentation/ResourceManager';
import { Prefab, Texture2D, AudioClip, resources } from 'cc';

describe('ResourceManager', () => {
    let resourceManager: ResourceManager;
    const mockResources = resources as any;

    beforeEach(() => {
        resourceManager = new ResourceManager();
        jest.clearAllMocks();
    });

    describe('loadPrefab', () => {
        it('应该从缓存返回已加载的 Prefab', async () => {
            const path = 'prefabs/test';
            let savedPrefab: any;

            // 第一次加载 - 设置 mock 回调
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedPrefab = new (Prefab as any)('test');
                        callback(null, savedPrefab);
                    });
                }
            });
            const prefab1 = await resourceManager.loadPrefab(path);

            expect(prefab1).toBeDefined();
            expect(prefab1).toBe(savedPrefab);
            expect(mockResources.load).toHaveBeenCalledTimes(1);
            expect(mockResources.load).toHaveBeenCalledWith(path, Prefab, expect.any(Function));

            // 第二次加载应该从缓存返回
            const prefab2 = await resourceManager.loadPrefab(path);
            expect(prefab2).toBe(prefab1);
            expect(mockResources.load).toHaveBeenCalledTimes(1); // 不应该再次调用
        });

        it('应该避免重复加载（加载中状态）', async () => {
            const path = 'prefabs/test';
            let savedPrefab: any;
            let callbackFn: ((prefab: any) => void) | null = null;

            // 创建一个延迟的回调
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    callbackFn = () => {
                        savedPrefab = new (Prefab as any)('test');
                        callback(null, savedPrefab);
                    };
                }
            });

            // 同时发起两个加载请求
            const promise1 = resourceManager.loadPrefab(path);
            const promise2 = resourceManager.loadPrefab(path);

            // 应该只调用一次 resources.load
            expect(mockResources.load).toHaveBeenCalledTimes(1);

            // 完成加载
            if (callbackFn) {
                callbackFn(new (Prefab as any)('test'));
            }
            const prefab1 = await promise1;
            const prefab2 = await promise2;

            expect(prefab1).toBe(savedPrefab);
            expect(prefab2).toBe(savedPrefab);
        });

        it('应该处理加载失败', async () => {
            const path = 'prefabs/invalid';
            const error = new Error('Load failed');

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        callback(error);
                    });
                }
            });

            await expect(resourceManager.loadPrefab(path)).rejects.toThrow('Resource load failed: prefabs/invalid');
        });
    });

    describe('loadTexture', () => {
        it('应该从缓存返回已加载的 Texture', async () => {
            const path = 'textures/test';
            let savedTexture: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedTexture = new (Texture2D as any)('test');
                        callback(null, savedTexture);
                    });
                }
            });
            const texture1 = await resourceManager.loadTexture(path);

            expect(texture1).toBe(savedTexture);

            // 第二次应该从缓存返回
            const texture2 = await resourceManager.loadTexture(path);
            expect(texture2).toBe(texture1);
            expect(mockResources.load).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadAudio', () => {
        it('应该从缓存返回已加载的 Audio', async () => {
            const path = 'audio/test';
            let savedAudio: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedAudio = new (AudioClip as any)('test');
                        callback(null, savedAudio);
                    });
                }
            });
            const audio1 = await resourceManager.loadAudio(path);

            expect(audio1).toBe(savedAudio);

            // 第二次应该从缓存返回
            const audio2 = await resourceManager.loadAudio(path);
            expect(audio2).toBe(audio1);
            expect(mockResources.load).toHaveBeenCalledTimes(1);
        });
    });

    describe('releasePrefab', () => {
        it('应该释放 Prefab 并从缓存中移除', async () => {
            const path = 'prefabs/test';
            let savedPrefab: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedPrefab = new (Prefab as any)('test');
                        callback(null, savedPrefab);
                    });
                }
            });
            await resourceManager.loadPrefab(path);

            // 释放资源
            resourceManager.releasePrefab(path);

            expect(mockResources.release).toHaveBeenCalledWith(path, Prefab);
            
            // 再次加载应该重新加载
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedPrefab = new (Prefab as any)('test');
                        callback(null, savedPrefab);
                    });
                }
            });
            await resourceManager.loadPrefab(path);
            expect(mockResources.load).toHaveBeenCalledTimes(2);
        });

        it('释放不存在的资源不应该报错', () => {
            expect(() => {
                resourceManager.releasePrefab('prefabs/nonexistent');
            }).not.toThrow();
        });
    });

    describe('releaseTexture', () => {
        it('应该释放 Texture 并从缓存中移除', async () => {
            const path = 'textures/test';
            let savedTexture: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedTexture = new (Texture2D as any)('test');
                        callback(null, savedTexture);
                    });
                }
            });
            await resourceManager.loadTexture(path);

            resourceManager.releaseTexture(path);

            expect(mockResources.release).toHaveBeenCalledWith(path, Texture2D);
        });
    });

    describe('releaseAudio', () => {
        it('应该释放 Audio 并从缓存中移除', async () => {
            const path = 'audio/test';
            let savedAudio: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedAudio = new (AudioClip as any)('test');
                        callback(null, savedAudio);
                    });
                }
            });
            await resourceManager.loadAudio(path);

            resourceManager.releaseAudio(path);

            expect(mockResources.release).toHaveBeenCalledWith(path, AudioClip);
        });
    });

    describe('clear', () => {
        it('应该释放所有资源并清空缓存', async () => {
            const savedAssets: any[] = [];

            mockResources.load
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            const prefab = new (Prefab as any)('prefab');
                            savedAssets.push(prefab);
                            callback(null, prefab);
                        });
                    }
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            const texture = new (Texture2D as any)('texture');
                            savedAssets.push(texture);
                            callback(null, texture);
                        });
                    }
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            const audio = new (AudioClip as any)('audio');
                            savedAssets.push(audio);
                            callback(null, audio);
                        });
                    }
                });

            await resourceManager.loadPrefab('prefabs/test');
            await resourceManager.loadTexture('textures/test');
            await resourceManager.loadAudio('audio/test');

            resourceManager.clear();

            expect(mockResources.release).toHaveBeenCalledTimes(3);
            expect(mockResources.release).toHaveBeenCalledWith('prefabs/test', Prefab);
            expect(mockResources.release).toHaveBeenCalledWith('textures/test', Texture2D);
            expect(mockResources.release).toHaveBeenCalledWith('audio/test', AudioClip);

            // 检查缓存已清空
            const stats = resourceManager.getStats();
            expect(stats.prefabs).toBe(0);
            expect(stats.textures).toBe(0);
            expect(stats.audios).toBe(0);
        });
    });

    describe('getStats', () => {
        it('应该返回正确的缓存统计信息', async () => {
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
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(null, new (Texture2D as any)('texture'));
                        });
                    }
                })
                .mockImplementationOnce((p: string, type: any, callback: any) => {
                    if (callback) {
                        Promise.resolve().then(() => {
                            callback(null, new (AudioClip as any)('audio'));
                        });
                    }
                });

            await resourceManager.loadPrefab('prefabs/test1');
            await resourceManager.loadPrefab('prefabs/test2');
            await resourceManager.loadTexture('textures/test');
            await resourceManager.loadAudio('audio/test');

            const stats = resourceManager.getStats();
            expect(stats.prefabs).toBe(2);
            expect(stats.textures).toBe(1);
            expect(stats.audios).toBe(1);
        });
    });
});
