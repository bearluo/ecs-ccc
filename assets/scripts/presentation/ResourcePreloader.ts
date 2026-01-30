/**
 * 资源预加载管理器
 * 
 * 负责统一管理资源预加载流程，支持：
 * - 批量预加载
 * - 加载进度跟踪
 * - 错误处理
 * 
 * 设计决策：ResourcePreloader 类 + 配置文件驱动
 * 参考文档：memory-bank/creative/creative-resource-loading-flow.md
 */

import { ServiceLocator } from '../app/ServiceLocator';
import { ResourceManager } from './ResourceManager';

/**
 * 预加载配置
 */
export interface PreloadConfig {
    prefabs?: string[];
    textures?: string[];
    audios?: string[];
}

/**
 * 资源预加载管理器
 */
export class ResourcePreloader {
    private resourceManager: ResourceManager;
    private loadingProgress: number = 0;
    private loadingStatus: 'idle' | 'loading' | 'complete' | 'error' = 'idle';
    private loadingErrors: string[] = [];

    constructor() {
        this.resourceManager = ServiceLocator.require(ResourceManager);
    }

    /**
     * 预加载配置的资源（串行加载）
     * @param config 预加载配置
     * @param onProgress 进度回调（0-1）
     */
    async preload(
        config: PreloadConfig,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        this.loadingStatus = 'loading';
        this.loadingProgress = 0;
        this.loadingErrors = [];

        const total = this.getTotalCount(config);
        let loaded = 0;

        try {
            // 预加载 Prefabs
            if (config.prefabs) {
                for (const path of config.prefabs) {
                    try {
                        await this.resourceManager.loadPrefab(path);
                        loaded++;
                        this.updateProgress(loaded, total, onProgress);
                    } catch (error) {
                        this.loadingErrors.push(`Prefab: ${path}`);
                        console.error(`[ResourcePreloader] Failed to preload prefab: ${path}`, error);
                    }
                }
            }

            // 预加载 Textures
            if (config.textures) {
                for (const path of config.textures) {
                    try {
                        await this.resourceManager.loadTexture(path);
                        loaded++;
                        this.updateProgress(loaded, total, onProgress);
                    } catch (error) {
                        this.loadingErrors.push(`Texture: ${path}`);
                        console.error(`[ResourcePreloader] Failed to preload texture: ${path}`, error);
                    }
                }
            }

            // 预加载 Audios
            if (config.audios) {
                for (const path of config.audios) {
                    try {
                        await this.resourceManager.loadAudio(path);
                        loaded++;
                        this.updateProgress(loaded, total, onProgress);
                    } catch (error) {
                        this.loadingErrors.push(`Audio: ${path}`);
                        console.error(`[ResourcePreloader] Failed to preload audio: ${path}`, error);
                    }
                }
            }

            this.loadingStatus = this.loadingErrors.length > 0 ? 'error' : 'complete';
            this.loadingProgress = 1.0;
            if (onProgress) onProgress(1.0);

            if (this.loadingErrors.length > 0) {
                console.warn(`[ResourcePreloader] Preload completed with ${this.loadingErrors.length} errors`);
            }
        } catch (error) {
            this.loadingStatus = 'error';
            console.error('[ResourcePreloader] Preload failed:', error);
            throw error;
        }
    }

    /**
     * 并行预加载（更快，但可能占用更多内存）
     * @param config 预加载配置
     * @param onProgress 进度回调（0-1）
     */
    async preloadParallel(
        config: PreloadConfig,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        this.loadingStatus = 'loading';
        this.loadingProgress = 0;
        this.loadingErrors = [];

        const promises: Promise<void>[] = [];
        const total = this.getTotalCount(config);
        let completed = 0;

        // 并行加载 Prefabs
        if (config.prefabs) {
            for (const path of config.prefabs) {
                promises.push(
                    this.resourceManager.loadPrefab(path)
                        .then(() => {
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                        .catch(error => {
                            this.loadingErrors.push(`Prefab: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload prefab: ${path}`, error);
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                );
            }
        }

        // 并行加载 Textures
        if (config.textures) {
            for (const path of config.textures) {
                promises.push(
                    this.resourceManager.loadTexture(path)
                        .then(() => {
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                        .catch(error => {
                            this.loadingErrors.push(`Texture: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload texture: ${path}`, error);
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                );
            }
        }

        // 并行加载 Audios
        if (config.audios) {
            for (const path of config.audios) {
                promises.push(
                    this.resourceManager.loadAudio(path)
                        .then(() => {
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                        .catch(error => {
                            this.loadingErrors.push(`Audio: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload audio: ${path}`, error);
                            completed++;
                            this.updateProgress(completed, total, onProgress);
                        })
                );
            }
        }

        try {
            await Promise.all(promises);
            this.loadingStatus = this.loadingErrors.length > 0 ? 'error' : 'complete';
            this.loadingProgress = 1.0;
            if (onProgress) onProgress(1.0);

            if (this.loadingErrors.length > 0) {
                console.warn(`[ResourcePreloader] Preload completed with ${this.loadingErrors.length} errors`);
            }
        } catch (error) {
            this.loadingStatus = 'error';
            console.error('[ResourcePreloader] Preload failed:', error);
            throw error;
        }
    }

    /**
     * 获取总资源数量
     */
    private getTotalCount(config: PreloadConfig): number {
        return (config.prefabs?.length || 0) +
               (config.textures?.length || 0) +
               (config.audios?.length || 0);
    }

    /**
     * 更新进度
     */
    private updateProgress(
        loaded: number,
        total: number,
        onProgress?: (progress: number) => void
    ): void {
        this.loadingProgress = total > 0 ? loaded / total : 1.0;
        if (onProgress) {
            onProgress(this.loadingProgress);
        }
    }

    /**
     * 获取加载进度（0-1）
     */
    getProgress(): number {
        return this.loadingProgress;
    }

    /**
     * 获取加载状态
     */
    getStatus(): 'idle' | 'loading' | 'complete' | 'error' {
        return this.loadingStatus;
    }

    /**
     * 获取加载错误列表
     */
    getErrors(): string[] {
        return [...this.loadingErrors];
    }

    /**
     * 重置状态
     */
    reset(): void {
        this.loadingStatus = 'idle';
        this.loadingProgress = 0;
        this.loadingErrors = [];
    }
}
