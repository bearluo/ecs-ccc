/**
 * 资源预加载配置
 * 
 * 定义游戏启动和场景切换时需要预加载的资源
 */

import { PreloadConfig } from '../../presentation/ResourcePreloader';

/**
 * 启动时预加载配置
 */
export const StartupPreloadConfig: PreloadConfig = {
    prefabs: [
        'prefabs/player',
        'prefabs/enemy-basic',
        'prefabs/enemy-elite',
        'prefabs/projectile',
        'prefabs/item-health',
        'prefabs/item-power'
    ],
    audios: [
        'audio/bgm-main',
        'audio/sfx/hit',
        'audio/sfx/explosion',
        'audio/sfx/pickup'
    ]
};

/**
 * 场景预加载配置（按场景名称）
 */
export const ScenePreloadConfigs: Record<string, PreloadConfig> = {
    'scene-boss': {
        prefabs: ['prefabs/boss'],
        textures: ['textures/boss-bg'],
        audios: ['audio/bgm-boss']
    },
    'scene-shop': {
        prefabs: ['prefabs/shop-item'],
        textures: ['textures/shop-bg']
    }
};
