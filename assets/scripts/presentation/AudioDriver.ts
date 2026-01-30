/**
 * 音频驱动
 * 
 * 负责播放音效和背景音乐
 * 
 * ⚠️ 关键设计：
 * - 使用 currentBGMKey 直接缓存配置键（不通过 clip 反查 config）
 * - 支持并发限制（SFX 最多同时播放 10 个）
 * - 异步 playSFX/playBGM，支持按需加载
 * - 支持 priority 配置（critical 必须预加载）
 */

import { AudioClip, AudioSource, Node } from 'cc';
import { ResourceManager } from './ResourceManager';
import { ConfigLoader } from '../ConfigLoader';

/**
 * 音频驱动
 */
export class AudioDriver {
    private resourceManager: ResourceManager;
    private configLoader: ConfigLoader;
    
    /** SFX 音频源（可并发播放多个） */
    private sfxSources: AudioSource[] = [];
    
    /** BGM 音频源（全局唯一） */
    private bgmSource?: AudioSource;
    
    /** 当前 BGM 的配置键（直接缓存 key，不通过 clip 反查 config） */
    private currentBGMKey?: string;
    
    /** 音效并发数量限制 */
    private maxSFXConcurrent: number = 10;
    
    /** 音效音量 */
    private sfxVolume: number = 1.0;
    
    /** BGM 音量 */
    private bgmVolume: number = 0.5;
    
    /** 视图父节点（用于挂载音频源） */
    private viewParent?: Node;
    
    constructor(resourceManager: ResourceManager, configLoader: ConfigLoader) {
        this.resourceManager = resourceManager;
        this.configLoader = configLoader;
    }
    
    /**
     * 设置视图父节点（依赖注入）
     * ⚠️ 必须在初始化音频源之前调用
     */
    setViewParent(viewParent: Node): void {
        this.viewParent = viewParent;
        this.initAudioSources();
    }
    
    /**
     * 初始化音频源
     * ⚠️ 在 viewParent 上创建音频源，而不是直接在 scene 上
     */
    private initAudioSources(): void {
        if (!this.viewParent) {
            console.warn('[AudioDriver] viewParent not set, cannot initialize audio sources');
            return;
        }
        
        // 创建 BGM 音频源（挂载到 viewParent）
        this.bgmSource = this.viewParent.addComponent(AudioSource) as AudioSource;
        this.bgmSource.loop = true;
        
        // 创建 SFX 音频源池（挂载到 viewParent）
        for (let i = 0; i < this.maxSFXConcurrent; i++) {
            const source = this.viewParent.addComponent(AudioSource) as AudioSource;
            this.sfxSources.push(source);
        }
    }
    
    /**
     * 播放音效
     * ⚠️ 架构约束：异步方法，如果 AudioClip 未加载则按需加载
     * 预加载由 ResourcePreloader 统一管理，但支持按需加载（ResourceManager 会处理缓存）
     */
    async playSFX(sfxKey: string, volume?: number): Promise<void> {
        const config = this.configLoader.getAudioConfig(sfxKey);
        if (!config || config.type !== 'sfx') {
            console.warn(`[AudioDriver] SFX config not found: ${sfxKey}`);
            return;
        }
        
        // 直接调用 loadAudio，ResourceManager 会自动处理缓存和去重
        let clip: AudioClip;
        try {
            clip = await this.resourceManager.loadAudio(config.clipPath);
        } catch (error) {
            console.error(`[AudioDriver] Failed to load SFX: ${sfxKey}`, error);
            return;
        }
        
        // 查找可用的 SFX 音频源
        let availableSource: AudioSource | undefined;
        for (const source of this.sfxSources) {
            if (!source.playing) {
                availableSource = source;
                break;
            }
        }
        
        if (!availableSource) {
            console.warn(`[AudioDriver] No available SFX source, max concurrent: ${this.maxSFXConcurrent}`);
            return;
        }
        
        // 播放音效
        availableSource.clip = clip;
        availableSource.volume = volume !== undefined ? volume : (config.volume ?? this.sfxVolume);
        availableSource.loop = false;
        availableSource.play();
    }
    
    /**
     * 播放背景音乐
     * ⚠️ 架构约束：异步方法，如果 AudioClip 未加载则按需加载
     * 预加载由 ResourcePreloader 统一管理，但支持按需加载（ResourceManager 会处理缓存）
     */
    async playBGM(bgmKey: string, loop?: boolean, volume?: number): Promise<void> {
        const config = this.configLoader.getAudioConfig(bgmKey);
        if (!config || config.type !== 'bgm') {
            console.warn(`[AudioDriver] BGM config not found: ${bgmKey}`);
            return;
        }
        
        // 如果正在播放相同的 BGM，不重复播放（直接比较 key）
        if (this.currentBGMKey === bgmKey && this.bgmSource?.playing) {
            // 只更新音量（如果需要）
            if (volume !== undefined && this.bgmSource) {
                this.bgmSource.volume = volume;
            }
            return;
        }
        
        // 直接调用 loadAudio，ResourceManager 会自动处理缓存和去重
        let clip: AudioClip;
        try {
            clip = await this.resourceManager.loadAudio(config.clipPath);
        } catch (error) {
            console.error(`[AudioDriver] Failed to load BGM: ${bgmKey}`, error);
            return;
        }
        
        if (!this.bgmSource) {
            console.error(`[AudioDriver] BGM source not initialized`);
            return;
        }
        
        // 停止当前 BGM
        if (this.bgmSource.playing) {
            this.bgmSource.stop();
        }
        
        // 播放新 BGM
        this.bgmSource.clip = clip;
        this.bgmSource.loop = loop !== undefined ? loop : (config.loop ?? true);
        this.bgmSource.volume = volume !== undefined ? volume : (config.volume ?? this.bgmVolume);
        this.bgmSource.play();
        
        // 直接缓存 key，不缓存 clip（避免通过 clip 反查 config）
        this.currentBGMKey = bgmKey;
    }
    
    /**
     * 停止背景音乐
     */
    stopBGM(): void {
        if (this.bgmSource && this.bgmSource.playing) {
            this.bgmSource.stop();
            this.currentBGMKey = undefined;
        }
    }
    
    /**
     * 设置 SFX 音量
     */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        
        // 更新所有 SFX 音频源的音量（正在播放的）
        for (const source of this.sfxSources) {
            if (source.playing) {
                source.volume = this.sfxVolume;
            }
        }
    }
    
    /**
     * 设置 BGM 音量
     */
    setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        
        if (this.bgmSource) {
            this.bgmSource.volume = this.bgmVolume;
        }
    }
    
    /**
     * 清理资源
     */
    clear(): void {
        // 停止所有音频
        this.stopBGM();
        for (const source of this.sfxSources) {
            if (source.playing) {
                source.stop();
            }
        }
        
        this.currentBGMKey = undefined;
    }

    /**
     * 暂停所有音频
     * TODO: 实现
     */
    pauseAllAudio(): void {
    }
    /**
     * 恢复所有音频
     * TODO: 实现
     */
    resumeAllAudio(): void {
    }
}
