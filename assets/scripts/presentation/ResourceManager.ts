/**
 * 资源管理器
 * 
 * 统一管理游戏资源（Prefab、Texture、Audio 等）
 * 提供资源加载、缓存、释放功能
 * 
 * 设计决策：单一 ResourceManager 类，基于 Cocos Creator resources API
 * 参考文档：memory-bank/creative/creative-resource-manager.md
 */

import { Prefab, Texture2D, AudioClip, resources, Asset, SpriteFrame } from 'cc';

/**
 * 资源管理器
 */
export class ResourceManager {
    /** Prefab 缓存 */
    private prefabCache: Map<string, Prefab> = new Map();

    /** Texture2D 缓存 */
    private textureCache: Map<string, Texture2D> = new Map();

    /** AudioClip 缓存 */
    private audioCache: Map<string, AudioClip> = new Map();

    /** 加载中的 Prefab（避免重复加载） */
    private loadingPrefabs: Map<string, Promise<Prefab>> = new Map();

    /** 加载中的 Texture（避免重复加载） */
    private loadingTextures: Map<string, Promise<Texture2D>> = new Map();

    /** 加载中的 Audio（避免重复加载） */
    private loadingAudios: Map<string, Promise<AudioClip>> = new Map();

    /**
     * 加载 Prefab
     * @param path 资源路径（相对于 resources 目录，例如 "prefabs/player"）
     * @returns Prefab 对象
     */
    async loadPrefab(path: string): Promise<Prefab> {
        // 1. 检查缓存
        if (this.prefabCache.has(path)) {
            return this.prefabCache.get(path)!;
        }

        // 2. 检查是否正在加载
        if (this.loadingPrefabs.has(path)) {
            return await this.loadingPrefabs.get(path)!;
        }

        // 3. 开始加载
        const promise = this.resourcesLoad(path, Prefab);
        this.loadingPrefabs.set(path, promise);

        try {
            const prefab = await promise;
            this.prefabCache.set(path, prefab);
            this.loadingPrefabs.delete(path);
            return prefab;
        } catch (error) {
            this.loadingPrefabs.delete(path);
            console.error(`[ResourceManager] Failed to load prefab: ${path}`, error);
            throw new Error(`Resource load failed: ${path}`);
        }
    }

    /**
     * 加载 Texture2D
     * @param path 资源路径（相对于 resources 目录）
     * @returns Texture2D 对象
     */
    async loadTexture(path: string): Promise<Texture2D> {
        // 1. 检查缓存
        if (this.textureCache.has(path)) {
            return this.textureCache.get(path)!;
        }

        // 2. 检查是否正在加载
        if (this.loadingTextures.has(path)) {
            return await this.loadingTextures.get(path)!;
        }

        // 3. 开始加载
        const promise = this.resourcesLoad(path, Texture2D);
        this.loadingTextures.set(path, promise);

        try {
            const texture = await promise;
            this.textureCache.set(path, texture);
            this.loadingTextures.delete(path);
            return texture;
        } catch (error) {
            this.loadingTextures.delete(path);
            console.error(`[ResourceManager] Failed to load texture: ${path}`, error);
            throw new Error(`Resource load failed: ${path}`);
        }
    }

    /**
     * 加载 AudioClip
     * @param path 资源路径（相对于 resources 目录）
     * @returns AudioClip 对象
     */
    async loadAudio(path: string): Promise<AudioClip> {
        // 1. 检查缓存
        if (this.audioCache.has(path)) {
            return this.audioCache.get(path)!;
        }

        // 2. 检查是否正在加载
        if (this.loadingAudios.has(path)) {
            return await this.loadingAudios.get(path)!;
        }

        // 3. 开始加载
        const promise = this.resourcesLoad(path, AudioClip);
        this.loadingAudios.set(path, promise);

        try {
            const audio = await promise;
            this.audioCache.set(path, audio);
            this.loadingAudios.delete(path);
            return audio;
        } catch (error) {
            this.loadingAudios.delete(path);
            console.error(`[ResourceManager] Failed to load audio: ${path}`, error);
            throw new Error(`Resource load failed: ${path}`);
        }
    }

    /**
     * 释放 Prefab
     * @param path 资源路径
     */
    releasePrefab(path: string): void {
        const prefab = this.prefabCache.get(path);
        if (prefab) {
            resources.release(path,Prefab);
            this.prefabCache.delete(path);
        }
    }

    /**
     * 释放 Texture2D
     * @param path 资源路径
     */
    releaseTexture(path: string): void {
        const texture = this.textureCache.get(path);
        if (texture) {
            resources.release(path,Texture2D);
            this.textureCache.delete(path);
        }
    }

    /**
     * 释放 AudioClip
     * @param path 资源路径
     */
    releaseAudio(path: string): void {
        const audio = this.audioCache.get(path);
        if (audio) {
            resources.release(path,AudioClip);
            this.audioCache.delete(path);
        }
    }

    /**
     * 清理所有资源
     */
    clear(): void {
        // 释放所有 Prefab
        for (const [path, prefab] of this.prefabCache) {
            resources.release(path,Prefab);
        }
        this.prefabCache.clear();

        // 释放所有 Texture
        for (const [path, texture] of this.textureCache) {
            resources.release(path,Texture2D);
        }
        this.textureCache.clear();

        // 释放所有 Audio
        for (const [path, audio] of this.audioCache) {
            resources.release(path,AudioClip);
        }
        this.audioCache.clear();

        // 清理加载中状态
        this.loadingPrefabs.clear();
        this.loadingTextures.clear();
        this.loadingAudios.clear();
    }

    /**
     * 获取缓存统计信息（用于调试）
     */
    getStats(): { prefabs: number; textures: number; audios: number } {
        return {
            prefabs: this.prefabCache.size,
            textures: this.textureCache.size,
            audios: this.audioCache.size
        };
    }

    /**
     * 使用 Cocos Creator 的 resources.load 方法加载资源
     * @param path 资源路径
     * @param type 资源类型
     * @returns 资源对象
     */
    resourcesLoad<T extends Asset>(path: string, type: new (...args: any[]) => T): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, type,(err: Error | null, data: T)=>{
                if(err){
                    reject(err);
                }else{
                    resolve(data);
                }
            });
        });
    }

    getTexture(path: string): Texture2D | null {
        // 1. 检查缓存
        if (this.textureCache.has(path)) {
            return this.textureCache.get(path)!;
        }
        return null;
    }
}
