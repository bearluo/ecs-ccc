/// <reference types="jest" />
/**
 * AudioDriver 单元测试
 * 
 * 测试 AudioDriver 的核心逻辑（播放音效、BGM、音量控制、并发限制等）
 * 
 * 使用全局 mock (tests/__mocks__/cc.ts)
 */

import { AudioDriver } from 'db://assets/scripts/presentation/AudioDriver';
import { ResourceManager } from 'db://assets/scripts/presentation/ResourceManager';
import { ConfigLoader } from 'db://assets/scripts/ConfigLoader';
import { AudioClip, AudioSource, Node, resources } from 'cc';

describe('AudioDriver', () => {
    let audioDriver: AudioDriver;
    let resourceManager: ResourceManager;
    let configLoader: ConfigLoader;
    let mockViewParent: Node;
    const mockResources = resources as any;

    beforeEach(() => {
        resourceManager = new ResourceManager();
        configLoader = new ConfigLoader();
        jest.clearAllMocks();
        
        // 创建 mock viewParent
        mockViewParent = new (Node as any)('ViewParent');
        mockViewParent.addComponent = jest.fn((type: any) => {
            if (type && (type.name === 'AudioSource' || type.name === 'MockAudioSource')) {
                const source = new (AudioSource as any)();
                source.playing = false;
                source.volume = 1.0;
                source.loop = false;
                source.clip = null;
                source.play = jest.fn(() => { source.playing = true; });
                source.stop = jest.fn(() => { source.playing = false; });
                return source;
            }
            return new type();
        });
        
        audioDriver = new AudioDriver(resourceManager, configLoader);
        audioDriver.setViewParent(mockViewParent);
    });

    describe('构造函数和 setViewParent', () => {
        it('应该正确初始化音频源', () => {
            expect(audioDriver).toBeDefined();
            expect(mockViewParent.addComponent).toHaveBeenCalled();
        });

        it('viewParent 未设置时应该警告', () => {
            const newDriver = new AudioDriver(resourceManager, configLoader);
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            // 尝试初始化音频源（通过 playBGM 触发）
            // 注意：由于 viewParent 未设置，initAudioSources 会在 setViewParent 时被调用
            // 但这里我们测试的是 setViewParent 的行为
            newDriver.setViewParent(null as any);
            
            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] viewParent not set, cannot initialize audio sources');
            consoleSpy.mockRestore();
        });
    });

    describe('playSFX', () => {
        it('配置不存在时应该警告并返回', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            await audioDriver.playSFX('nonexistent');
            
            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] SFX config not found: nonexistent');
            consoleSpy.mockRestore();
        });

        it('BGM 配置不应该作为 SFX 播放', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            await audioDriver.playSFX('battle_bgm');
            
            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] SFX config not found: battle_bgm');
            consoleSpy.mockRestore();
        });

        it('应该加载并播放 SFX', async () => {
            const sfxKey = 'hit';
            let savedClip: any;
            let savedSource: any;

            // Mock loadAudio
            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('hit');
                        callback(null, savedClip);
                    });
                }
            });

            // 获取可用的音频源（通过构造函数中创建的）
            const sfxSources = (audioDriver as any).sfxSources;
            savedSource = sfxSources[0];
            savedSource.play = jest.fn(() => { savedSource.playing = true; });

            await audioDriver.playSFX(sfxKey, 0.8);

            expect(savedSource.clip).toBe(savedClip);
            expect(savedSource.volume).toBe(0.8); // 使用传入的音量
            expect(savedSource.loop).toBe(false);
            expect(savedSource.play).toHaveBeenCalled();
        });

        it('应该使用配置的默认音量（如果未提供）', async () => {
            const sfxKey = 'hit'; // volume: 0.8
            let savedClip: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('hit');
                        callback(null, savedClip);
                    });
                }
            });

            const sfxSources = (audioDriver as any).sfxSources;
            const source = sfxSources[0];
            source.play = jest.fn(() => { source.playing = true; });

            await audioDriver.playSFX(sfxKey);

            expect(source.volume).toBe(0.8); // 使用配置的默认音量
        });

        it('加载失败时应该记录错误并返回', async () => {
            const sfxKey = 'hit';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        callback(new Error('Load failed'));
                    });
                }
            });

            await audioDriver.playSFX(sfxKey);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[AudioDriver] Failed to load SFX: hit',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('没有可用音频源时应该警告并返回', async () => {
            const sfxKey = 'hit';
            let savedClip: any;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // 填满所有音频源
            const sfxSources = (audioDriver as any).sfxSources;
            for (const source of sfxSources) {
                source.playing = true;
            }

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('hit');
                        callback(null, savedClip);
                    });
                }
            });

            await audioDriver.playSFX(sfxKey);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[AudioDriver] No available SFX source, max concurrent: 10'
            );
            consoleSpy.mockRestore();
        });
    });

    describe('playBGM', () => {
        it('配置不存在时应该警告并返回', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            await audioDriver.playBGM('nonexistent');
            
            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] BGM config not found: nonexistent');
            consoleSpy.mockRestore();
        });

        it('SFX 配置不应该作为 BGM 播放', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            await audioDriver.playBGM('hit');
            
            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] BGM config not found: hit');
            consoleSpy.mockRestore();
        });

        it('应该加载并播放 BGM', async () => {
            const bgmKey = 'battle_bgm';
            let savedClip: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('battle_bgm');
                        callback(null, savedClip);
                    });
                }
            });

            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.play = jest.fn(() => { bgmSource.playing = true; });

            await audioDriver.playBGM(bgmKey, true, 0.6);

            expect(bgmSource.clip).toBe(savedClip);
            expect(bgmSource.loop).toBe(true);
            expect(bgmSource.volume).toBe(0.6);
            expect(bgmSource.play).toHaveBeenCalled();
            expect((audioDriver as any).currentBGMKey).toBe(bgmKey);
        });

        it('相同的 BGM 不应该重复播放', async () => {
            const bgmKey = 'battle_bgm';
            let savedClip: any;

            mockResources.load.mockImplementation((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('battle_bgm');
                        callback(null, savedClip);
                    });
                }
            });

            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.playing = true;
            bgmSource.play = jest.fn(() => { bgmSource.playing = true; });
            bgmSource.stop = jest.fn(() => { bgmSource.playing = false; });

            // 第一次播放
            await audioDriver.playBGM(bgmKey);
            const firstPlayCallCount = bgmSource.play.mock.calls.length;

            // 第二次播放相同 BGM
            await audioDriver.playBGM(bgmKey);

            // 不应该再次调用 play（只更新音量）
            expect(bgmSource.play.mock.calls.length).toBe(firstPlayCallCount);
            expect((audioDriver as any).currentBGMKey).toBe(bgmKey);
        });

        it('应该使用配置的默认 loop 和 volume（如果未提供）', async () => {
            const bgmKey = 'battle_bgm'; // loop: true, volume: 0.5
            let savedClip: any;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        savedClip = new (AudioClip as any)('battle_bgm');
                        callback(null, savedClip);
                    });
                }
            });

            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.play = jest.fn(() => { bgmSource.playing = true; });

            await audioDriver.playBGM(bgmKey);

            expect(bgmSource.loop).toBe(true); // 使用配置的默认值
            expect(bgmSource.volume).toBe(0.5); // 使用配置的默认值
        });

        it('BGM 源未初始化时应该记录错误并返回', async () => {
            const bgmKey = 'battle_bgm';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // 创建一个没有 bgmSource 的 AudioDriver
            (audioDriver as any).bgmSource = undefined;

            mockResources.load.mockImplementationOnce((p: string, type: any, callback: any) => {
                if (callback) {
                    Promise.resolve().then(() => {
                        callback(null, new (AudioClip as any)('battle_bgm'));
                    });
                }
            });

            await audioDriver.playBGM(bgmKey);

            expect(consoleSpy).toHaveBeenCalledWith('[AudioDriver] BGM source not initialized');
            consoleSpy.mockRestore();
        });
    });

    describe('stopBGM', () => {
        it('应该停止 BGM 并清除 currentBGMKey', () => {
            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.playing = true;
            bgmSource.stop = jest.fn(() => { bgmSource.playing = false; });
            (audioDriver as any).currentBGMKey = 'battle_bgm';

            audioDriver.stopBGM();

            expect(bgmSource.stop).toHaveBeenCalled();
            expect((audioDriver as any).currentBGMKey).toBeUndefined();
        });

        it('BGM 未播放时不应该报错', () => {
            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.playing = false;
            bgmSource.stop = jest.fn();

            expect(() => audioDriver.stopBGM()).not.toThrow();
        });
    });

    describe('setSFXVolume 和 setBGMVolume', () => {
        it('应该设置 SFX 音量', () => {
            const sfxSources = (audioDriver as any).sfxSources;
            sfxSources[0].playing = true;
            sfxSources[0].volume = 1.0;

            audioDriver.setSFXVolume(0.7);

            expect((audioDriver as any).sfxVolume).toBe(0.7);
            expect(sfxSources[0].volume).toBe(0.7);
        });

        it('应该限制音量范围（0-1）', () => {
            audioDriver.setSFXVolume(-0.5);
            expect((audioDriver as any).sfxVolume).toBe(0);

            audioDriver.setSFXVolume(1.5);
            expect((audioDriver as any).sfxVolume).toBe(1);
        });

        it('应该设置 BGM 音量', () => {
            const bgmSource = (audioDriver as any).bgmSource;
            bgmSource.volume = 0.5;

            audioDriver.setBGMVolume(0.8);

            expect((audioDriver as any).bgmVolume).toBe(0.8);
            expect(bgmSource.volume).toBe(0.8);
        });
    });

    describe('clear', () => {
        it('应该停止所有音频并清除 currentBGMKey', () => {
            const bgmSource = (audioDriver as any).bgmSource;
            const sfxSources = (audioDriver as any).sfxSources;
            
            bgmSource.playing = true;
            bgmSource.stop = jest.fn();
            sfxSources[0].playing = true;
            sfxSources[0].stop = jest.fn();
            (audioDriver as any).currentBGMKey = 'battle_bgm';

            audioDriver.clear();

            expect(bgmSource.stop).toHaveBeenCalled();
            expect(sfxSources[0].stop).toHaveBeenCalled();
            expect((audioDriver as any).currentBGMKey).toBeUndefined();
        });
    });
});
