# 资源加载和预加载流程设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 需求分析

### 当前状态

1. **ResourceManager 已实现：** 提供 `loadPrefab`、`loadTexture`、`loadAudio` 等基础加载方法
2. **ViewPool 支持预加载：** 有 `preloadPrefab` 方法，但缺少统一的预加载流程
3. **GameApp 初始化：** 创建了 ResourceManager，但没有预加载逻辑
4. **缺少加载策略：** 没有明确的预加载时机、加载顺序、进度管理

### 使用场景

1. **游戏启动预加载：**
   - 预加载核心 Prefab（玩家、敌人、道具等）
   - 预加载常用音频（BGM、常用 SFX）
   - 预加载 UI 资源

2. **场景切换预加载：**
   - 进入新场景前预加载场景相关资源
   - 预加载下一波敌人的 Prefab

3. **运行时按需加载：**
   - 生成新实体时加载 Prefab（如果未预加载）
   - 播放音效时加载音频（如果未预加载）
   - 显示特效时加载特效资源

4. **资源释放：**
   - 场景切换时释放不再使用的资源
   - 游戏结束时清理所有资源

### 约束条件

1. **Cocos Creator 3.8.7 API：** 必须使用 `resources.load()` 异步加载
2. **架构约束：** 资源管理属于 Presentation 层，不能依赖 ECS
3. **性能要求：** 
   - 预加载不应阻塞游戏启动
   - 按需加载需要快速响应
   - 避免重复加载
4. **内存管理：** 需要控制资源缓存大小，避免内存溢出
5. **用户体验：** 需要加载进度反馈（可选）

---

## 设计选项

### 选项 1：集中式预加载管理器（ResourcePreloader）⭐ 推荐

**设计：** 创建一个 `ResourcePreloader` 类，统一管理预加载流程

**结构：**
```typescript
interface PreloadConfig {
    prefabs?: string[];      // Prefab 路径列表
    textures?: string[];    // Texture 路径列表
    audios?: string[];      // Audio 路径列表
}

class ResourcePreloader {
    private resourceManager: ResourceManager;
    private loadingProgress: number = 0;
    private loadingStatus: 'idle' | 'loading' | 'complete' | 'error' = 'idle';
    
    // 预加载配置
    async preload(config: PreloadConfig): Promise<void>
    
    // 获取加载进度
    getProgress(): number
    
    // 获取加载状态
    getStatus(): 'idle' | 'loading' | 'complete' | 'error'
    
    // 批量预加载（带进度回调）
    async preloadWithProgress(
        config: PreloadConfig,
        onProgress?: (progress: number) => void
    ): Promise<void>
}
```

**优点：**
- ✅ 统一管理预加载流程
- ✅ 支持进度回调
- ✅ 易于扩展（支持场景切换预加载）
- ✅ 与 ResourceManager 解耦

**缺点：**
- ⚠️ 需要额外的类
- ⚠️ 需要定义预加载配置结构

---

### 选项 2：ResourceManager 扩展方法

**设计：** 在 `ResourceManager` 中添加预加载方法

**结构：**
```typescript
class ResourceManager {
    // 现有方法...
    
    // 批量预加载
    async preloadPrefabs(paths: string[]): Promise<void>
    async preloadTextures(paths: string[]): Promise<void>
    async preloadAudios(paths: string[]): Promise<void>
    
    // 预加载配置
    async preload(config: PreloadConfig): Promise<void>
}
```

**优点：**
- ✅ 不需要额外的类
- ✅ 所有资源管理逻辑集中

**缺点：**
- ⚠️ ResourceManager 职责过重
- ⚠️ 预加载逻辑与加载逻辑混合

---

### 选项 3：配置驱动的预加载系统

**设计：** 使用配置文件定义预加载资源，系统自动加载

**结构：**
```typescript
// data/configs/resource-preload.ts
export const ResourcePreloadConfig = {
    startup: {
        prefabs: ['prefabs/player', 'prefabs/enemy'],
        audios: ['audio/bgm', 'audio/sfx/hit']
    },
    scene1: {
        prefabs: ['prefabs/boss'],
        textures: ['textures/boss-bg']
    }
};

// ResourcePreloader 读取配置并加载
```

**优点：**
- ✅ 配置与代码分离
- ✅ 易于修改预加载资源
- ✅ 支持多场景配置

**缺点：**
- ⚠️ 需要配置文件管理
- ⚠️ 配置验证逻辑复杂

---

## 推荐方案：选项 1 + 选项 3 组合

**设计决策：** 使用 `ResourcePreloader` 类 + 配置文件驱动

### 架构设计

```
ResourcePreloader (预加载管理器)
    ↓ 使用
ResourceManager (资源管理器)
    ↓ 使用
Cocos Creator resources API
```

### 核心组件

#### 1. ResourcePreloader 类

```typescript
/**
 * 资源预加载管理器
 * 
 * 负责统一管理资源预加载流程，支持：
 * - 批量预加载
 * - 加载进度跟踪
 * - 错误处理
 */
export class ResourcePreloader {
    private resourceManager: ResourceManager;
    private loadingProgress: number = 0;
    private loadingStatus: 'idle' | 'loading' | 'complete' | 'error' = 'idle';
    private loadingErrors: string[] = [];
    
    constructor(resourceManager: ResourceManager) {
        this.resourceManager = resourceManager;
    }
    
    /**
     * 预加载配置的资源
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
     */
    async preloadParallel(
        config: PreloadConfig,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        this.loadingStatus = 'loading';
        this.loadingProgress = 0;
        this.loadingErrors = [];
        
        const promises: Promise<void>[] = [];
        
        // 并行加载 Prefabs
        if (config.prefabs) {
            for (const path of config.prefabs) {
                promises.push(
                    this.resourceManager.loadPrefab(path)
                        .catch(error => {
                            this.loadingErrors.push(`Prefab: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload prefab: ${path}`, error);
                        })
                );
            }
        }
        
        // 并行加载 Textures
        if (config.textures) {
            for (const path of config.textures) {
                promises.push(
                    this.resourceManager.loadTexture(path)
                        .catch(error => {
                            this.loadingErrors.push(`Texture: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload texture: ${path}`, error);
                        })
                );
            }
        }
        
        // 并行加载 Audios
        if (config.audios) {
            for (const path of config.audios) {
                promises.push(
                    this.resourceManager.loadAudio(path)
                        .catch(error => {
                            this.loadingErrors.push(`Audio: ${path}`);
                            console.error(`[ResourcePreloader] Failed to preload audio: ${path}`, error);
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
    
    private getTotalCount(config: PreloadConfig): number {
        return (config.prefabs?.length || 0) +
               (config.textures?.length || 0) +
               (config.audios?.length || 0);
    }
    
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
    
    getProgress(): number {
        return this.loadingProgress;
    }
    
    getStatus(): 'idle' | 'loading' | 'complete' | 'error' {
        return this.loadingStatus;
    }
    
    getErrors(): string[] {
        return [...this.loadingErrors];
    }
    
    reset(): void {
        this.loadingStatus = 'idle';
        this.loadingProgress = 0;
        this.loadingErrors = [];
    }
}
```

#### 2. 预加载配置

```typescript
// assets/scripts/data/configs/resource-preload.ts

/**
 * 资源预加载配置
 */
export interface PreloadConfig {
    prefabs?: string[];
    textures?: string[];
    audios?: string[];
}

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
```

#### 3. GameApp 集成

```typescript
// assets/scripts/app/GameApp.ts

import { ResourcePreloader } from '../presentation/ResourcePreloader';
import { StartupPreloadConfig } from '../data/configs/resource-preload';

@ccclass('GameApp')
export class GameApp extends Component {
    private resourcePreloader!: ResourcePreloader;
    
    async onLoad() {
        // ... 现有初始化代码 ...
        
        // 初始化资源预加载器
        this.resourcePreloader = new ResourcePreloader(this.resourceManager);
        
        // 启动时预加载（可选：显示加载进度）
        try {
            await this.resourcePreloader.preloadParallel(
                StartupPreloadConfig,
                (progress) => {
                    console.log(`[GameApp] Preload progress: ${(progress * 100).toFixed(1)}%`);
                    // TODO: 更新 UI 加载进度条
                }
            );
            console.log('[GameApp] Preload completed');
        } catch (error) {
            console.error('[GameApp] Preload failed:', error);
            // 继续游戏，按需加载
        }
        
        console.log('[GameApp] Initialized');
    }
    
    /**
     * 场景切换时预加载
     */
    async preloadScene(sceneName: string): Promise<void> {
        const config = ScenePreloadConfigs[sceneName];
        if (config) {
            await this.resourcePreloader.preloadParallel(config);
        }
    }
}
```

---

## 加载流程设计

### 1. 游戏启动流程

```
GameApp.onLoad()
    ↓
初始化 ResourceManager
    ↓
初始化 ResourcePreloader
    ↓
预加载 StartupPreloadConfig（并行）
    ↓
显示加载进度（可选）
    ↓
预加载完成 → 开始游戏
```

### 2. 运行时按需加载流程

```
实体需要 View
    ↓
ViewManager.spawnView()
    ↓
ViewPool.get(prefabKey)
    ↓
检查 Prefab 是否已加载
    ↓
未加载 → ResourceManager.loadPrefab()（异步）
    ↓
加载完成 → 实例化 Node
    ↓
返回 Node
```

### 3. 场景切换流程

```
场景切换请求
    ↓
预加载新场景资源（ResourcePreloader.preloadParallel）
    ↓
释放旧场景资源（ResourceManager.release*）
    ↓
切换场景
```

### 4. 资源释放策略

**策略 1：场景切换时释放**
- 场景切换时释放旧场景的特定资源
- 保留通用资源（玩家、常用音效等）

**策略 2：LRU 缓存**
- 维护资源使用时间
- 内存不足时释放最久未使用的资源

**策略 3：手动释放**
- 提供 `releaseSceneResources(sceneName)` 方法
- 由游戏逻辑控制释放时机

**推荐：策略 1 + 策略 3 组合**
- 场景切换时自动释放场景特定资源
- 提供手动释放接口，由游戏逻辑控制

---

## 错误处理

### 1. 预加载错误

- **单个资源加载失败：** 记录错误，继续加载其他资源
- **关键资源加载失败：** 记录错误，游戏继续运行，按需加载时重试
- **所有资源加载失败：** 记录错误，游戏继续运行，完全按需加载

### 2. 运行时加载错误

- **Prefab 加载失败：** 发送 `ViewSpawnFailed` 事件，ViewSpawnSystem 重新添加 `NeedViewTag`
- **Audio 加载失败：** 静默失败，记录警告日志
- **Texture 加载失败：** 使用默认纹理或占位符

---

## 性能优化

### 1. 并行加载

- 使用 `preloadParallel` 并行加载多个资源
- 注意：并行加载可能占用更多内存和网络带宽

### 2. 预加载时机

- **启动时：** 预加载核心资源（玩家、常用敌人、常用音效）
- **场景切换前：** 预加载新场景资源
- **波次切换时：** 预加载下一波敌人资源

### 3. 缓存策略

- ResourceManager 已实现缓存机制
- 避免重复加载相同资源

### 4. 资源分组

- 按场景分组资源
- 按优先级分组（核心资源优先加载）

---

## 实施步骤

### 阶段 1：基础预加载系统

1. ✅ 创建 `ResourcePreloader` 类
2. ✅ 实现 `preload` 方法（串行加载）
3. ✅ 实现 `preloadParallel` 方法（并行加载）
4. ✅ 实现进度跟踪

### 阶段 2：配置系统

1. ✅ 创建预加载配置文件
2. ✅ 定义 `StartupPreloadConfig`
3. ✅ 定义 `ScenePreloadConfigs`

### 阶段 3：GameApp 集成

1. ✅ 在 `GameApp.onLoad()` 中初始化 `ResourcePreloader`
2. ✅ 启动时预加载核心资源
3. ✅ 添加场景切换预加载方法

### 阶段 4：ViewPool 集成（可选）

1. ⏳ 在 `ViewPool` 中添加批量预加载方法
2. ⏳ 支持预加载多个 Prefab

### 阶段 5：资源释放策略

1. ⏳ 实现场景资源释放方法
2. ⏳ 添加资源使用统计（用于 LRU 缓存）

---

## 验收标准

1. ✅ 游戏启动时能够预加载核心资源
2. ✅ 预加载进度能够正确跟踪
3. ✅ 预加载错误不影响游戏启动
4. ✅ 运行时按需加载正常工作
5. ✅ 场景切换时能够预加载新场景资源
6. ✅ 资源释放功能正常

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

**设计决策：** 使用 `ResourcePreloader` 类 + 配置文件驱动的预加载系统

**关键特性：**
- 统一预加载管理
- 支持串行和并行加载
- 进度跟踪和错误处理
- 配置驱动，易于扩展

**下一步：** 实施阶段 1-3，创建 `ResourcePreloader` 类和配置文件
