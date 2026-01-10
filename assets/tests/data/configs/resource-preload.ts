/**
 * 测试资源预加载配置
 * 
 * 用于测试场景的资源预加载配置
 */

import { PreloadConfig } from '../../../scripts/presentation/ResourcePreloader';

/**
 * 测试启动预加载配置
 */
export const TestStartupPreloadConfig: PreloadConfig = {
    prefabs: [
        'tests/prefabs/enemy',
        'tests/prefabs/player'
    ],
    audios: [
    ]
};

/**
 * 测试场景预加载配置
 */
export const TestScenePreloadConfigs: Record<string, PreloadConfig> = {
    'test-scene-1': {
        prefabs: ['prefabs/test-boss'],
        textures: ['textures/test-bg'],
        audios: ['audio/test-bgm-boss']
    },
    'test-scene-2': {
        prefabs: ['prefabs/test-shop-item'],
        textures: ['textures/test-shop-bg']
    }
};
