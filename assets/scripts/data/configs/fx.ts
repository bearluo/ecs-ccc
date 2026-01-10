/**
 * 特效配置
 * 
 * 定义游戏中所有特效的配置数据
 */

export interface FxConfig {
    key: string;
    prefabPath: string;  // 相对于 resources 的路径，如 "effects/fireball"
    duration?: number;  // 持续时间（秒），用于自动清理，如果不提供则通过事件驱动
    poolSize?: number;  // 对象池大小，默认 10
    autoDestroy?: boolean;  // 是否自动销毁，默认 true
    priority?: 'critical' | 'normal';  // 优先级：critical 必须预加载，normal 允许异步加载，默认 'normal'
}

export const FxConfigs: Record<string, FxConfig> = {
    'fireball': {
        key: 'fireball',
        prefabPath: 'effects/fireball',
        duration: 2.0,
        poolSize: 10,
        autoDestroy: true,
        priority: 'normal'
    },
    'hit': {
        key: 'hit',
        prefabPath: 'effects/hit',
        duration: 0.5,
        poolSize: 20,
        autoDestroy: true,
        priority: 'critical'  // 常用特效，必须预加载
    },
    'explosion': {
        key: 'explosion',
        prefabPath: 'effects/explosion',
        duration: 1.0,
        poolSize: 10,
        autoDestroy: true,
        priority: 'normal'
    }
};
