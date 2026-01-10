/// <reference types="jest" />
/**
 * ResourcePreloader 单元测试
 * 
 * 使用全局 mock (tests/__mocks__/cc.ts) 用于 ResourceManager 内部使用的 cc 模块
 */

import { ResourcePreloader } from 'db://assets/scripts/presentation/ResourcePreloader';
import { ResourceManager } from 'db://assets/scripts/presentation/ResourceManager';
import { PreloadConfig } from 'db://assets/scripts/presentation/ResourcePreloader';

// Mock ResourceManager
jest.mock('db://assets/scripts/presentation/ResourceManager');

describe('ResourcePreloader', () => {
    let resourcePreloader: ResourcePreloader;
    let mockResourceManager: jest.Mocked<ResourceManager>;

    beforeEach(() => {
        // 创建 mock ResourceManager
        mockResourceManager = {
            loadPrefab: jest.fn(),
            loadTexture: jest.fn(),
            loadAudio: jest.fn(),
            releasePrefab: jest.fn(),
            releaseTexture: jest.fn(),
            releaseAudio: jest.fn(),
            clear: jest.fn(),
            getStats: jest.fn()
        } as any;

        resourcePreloader = new ResourcePreloader(mockResourceManager);
        jest.clearAllMocks();
    });

    describe('构造函数', () => {
        it('应该正确初始化', () => {
            expect(resourcePreloader.getStatus()).toBe('idle');
            expect(resourcePreloader.getProgress()).toBe(0);
            expect(resourcePreloader.getErrors()).toEqual([]);
        });
    });

    describe('preload (串行加载)', () => {
        it('应该串行加载 Prefabs', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const mockPrefab2 = { name: 'prefab2' } as any;

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockResolvedValueOnce(mockPrefab2);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preload(config);

            expect(mockResourceManager.loadPrefab).toHaveBeenCalledTimes(2);
            expect(mockResourceManager.loadPrefab).toHaveBeenNthCalledWith(1, 'prefabs/test1');
            expect(mockResourceManager.loadPrefab).toHaveBeenNthCalledWith(2, 'prefabs/test2');
            expect(resourcePreloader.getStatus()).toBe('complete');
            expect(resourcePreloader.getProgress()).toBe(1.0);
        });

        it('应该串行加载多种资源类型', async () => {
            const mockPrefab = { name: 'prefab' } as any;
            const mockTexture = { name: 'texture' } as any;
            const mockAudio = { name: 'audio' } as any;

            mockResourceManager.loadPrefab.mockResolvedValueOnce(mockPrefab);
            mockResourceManager.loadTexture.mockResolvedValueOnce(mockTexture);
            mockResourceManager.loadAudio.mockResolvedValueOnce(mockAudio);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test'],
                textures: ['textures/test'],
                audios: ['audio/test']
            };

            await resourcePreloader.preload(config);

            expect(mockResourceManager.loadPrefab).toHaveBeenCalledTimes(1);
            expect(mockResourceManager.loadTexture).toHaveBeenCalledTimes(1);
            expect(mockResourceManager.loadAudio).toHaveBeenCalledTimes(1);
            expect(resourcePreloader.getStatus()).toBe('complete');
        });

        it('应该正确更新进度', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const mockPrefab2 = { name: 'prefab2' } as any;

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockResolvedValueOnce(mockPrefab2);

            const progressCallback = jest.fn();
            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preload(config, progressCallback);

            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback).toHaveBeenLastCalledWith(1.0);
        });

        it('应该处理单个资源加载失败', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const error = new Error('Load failed');

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockRejectedValueOnce(error);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preload(config);

            expect(resourcePreloader.getStatus()).toBe('error');
            expect(resourcePreloader.getErrors()).toContain('Prefab: prefabs/test2');
        });

        it('应该处理空配置', async () => {
            const config: PreloadConfig = {};

            await resourcePreloader.preload(config);

            expect(resourcePreloader.getStatus()).toBe('complete');
            expect(resourcePreloader.getProgress()).toBe(1.0);
        });
    });

    describe('preloadParallel (并行加载)', () => {
        it('应该并行加载 Prefabs', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const mockPrefab2 = { name: 'prefab2' } as any;

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockResolvedValueOnce(mockPrefab2);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preloadParallel(config);

            expect(mockResourceManager.loadPrefab).toHaveBeenCalledTimes(2);
            expect(resourcePreloader.getStatus()).toBe('complete');
        });

        it('应该并行加载多种资源类型', async () => {
            const mockPrefab = { name: 'prefab' } as any;
            const mockTexture = { name: 'texture' } as any;
            const mockAudio = { name: 'audio' } as any;

            mockResourceManager.loadPrefab.mockResolvedValueOnce(mockPrefab);
            mockResourceManager.loadTexture.mockResolvedValueOnce(mockTexture);
            mockResourceManager.loadAudio.mockResolvedValueOnce(mockAudio);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test'],
                textures: ['textures/test'],
                audios: ['audio/test']
            };

            await resourcePreloader.preloadParallel(config);

            expect(mockResourceManager.loadPrefab).toHaveBeenCalledTimes(1);
            expect(mockResourceManager.loadTexture).toHaveBeenCalledTimes(1);
            expect(mockResourceManager.loadAudio).toHaveBeenCalledTimes(1);
            expect(resourcePreloader.getStatus()).toBe('complete');
        });

        it('应该正确更新进度（并行）', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const mockPrefab2 = { name: 'prefab2' } as any;

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockResolvedValueOnce(mockPrefab2);

            const progressCallback = jest.fn();
            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preloadParallel(config, progressCallback);

            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback).toHaveBeenLastCalledWith(1.0);
        });

        it('应该处理单个资源加载失败（并行）', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const error = new Error('Load failed');

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockRejectedValueOnce(error);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preloadParallel(config);

            expect(resourcePreloader.getStatus()).toBe('error');
            expect(resourcePreloader.getErrors()).toContain('Prefab: prefabs/test2');
        });
    });

    describe('状态管理', () => {
        it('应该正确返回状态', async () => {
            expect(resourcePreloader.getStatus()).toBe('idle');

            const mockPrefab = { name: 'prefab' } as any;
            mockResourceManager.loadPrefab.mockResolvedValueOnce(mockPrefab);

            const config: PreloadConfig = { prefabs: ['prefabs/test'] };
            const preloadPromise = resourcePreloader.preload(config);

            expect(resourcePreloader.getStatus()).toBe('loading');

            await preloadPromise;

            expect(resourcePreloader.getStatus()).toBe('complete');
        });

        it('应该正确返回进度', async () => {
            const mockPrefab1 = { name: 'prefab1' } as any;
            const mockPrefab2 = { name: 'prefab2' } as any;

            mockResourceManager.loadPrefab
                .mockResolvedValueOnce(mockPrefab1)
                .mockResolvedValueOnce(mockPrefab2);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test1', 'prefabs/test2']
            };

            await resourcePreloader.preload(config);

            expect(resourcePreloader.getProgress()).toBe(1.0);
        });

        it('应该正确返回错误列表', async () => {
            const error = new Error('Load failed');
            mockResourceManager.loadPrefab.mockRejectedValueOnce(error);

            const config: PreloadConfig = {
                prefabs: ['prefabs/test']
            };

            await resourcePreloader.preload(config);

            const errors = resourcePreloader.getErrors();
            expect(errors.length).toBe(1);
            expect(errors[0]).toContain('Prefab: prefabs/test');
        });

        it('应该正确重置状态', async () => {
            const mockPrefab = { name: 'prefab' } as any;
            mockResourceManager.loadPrefab.mockResolvedValueOnce(mockPrefab);

            const config: PreloadConfig = { prefabs: ['prefabs/test'] };
            await resourcePreloader.preload(config);

            expect(resourcePreloader.getStatus()).toBe('complete');

            resourcePreloader.reset();

            expect(resourcePreloader.getStatus()).toBe('idle');
            expect(resourcePreloader.getProgress()).toBe(0);
            expect(resourcePreloader.getErrors()).toEqual([]);
        });
    });
});
