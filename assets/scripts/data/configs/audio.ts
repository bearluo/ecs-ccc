/**
 * 音频配置
 * 
 * 定义游戏中所有音效和背景音乐的配置数据
 */

export interface AudioConfig {
    key: string;
    clipPath: string;  // 相对于 resources 的路径，如 "audio/skill_fireball"
    type: 'sfx' | 'bgm';  // 类型
    volume?: number;  // 默认音量（0-1），SFX 默认 1.0，BGM 默认 0.5
    loop?: boolean;  // 是否循环（仅 BGM 有效），默认 true
    priority?: 'critical' | 'normal';  // 优先级：critical 必须预加载，normal 允许异步加载，默认 'normal'
}

export const AudioConfigs: Record<string, AudioConfig> = {
    'skill_fireball': {
        key: 'skill_fireball',
        clipPath: 'audio/skill_fireball',
        type: 'sfx',
        volume: 1.0,
        priority: 'normal'
    },
    'hit': {
        key: 'hit',
        clipPath: 'audio/hit',
        type: 'sfx',
        volume: 0.8,
        priority: 'critical'  // 常用音效，必须预加载
    },
    'death': {
        key: 'death',
        clipPath: 'audio/death',
        type: 'sfx',
        volume: 0.9,
        priority: 'normal'
    },
    'battle_bgm': {
        key: 'battle_bgm',
        clipPath: 'audio/battle_bgm',
        type: 'bgm',
        volume: 0.5,
        loop: true,
        priority: 'critical'  // BGM 通常需要预加载
    }
};
