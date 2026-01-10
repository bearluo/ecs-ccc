# 资源管理器设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 需求分析

### 当前问题

1. **资源加载分散：** ViewManager 中有 `prefabCache`，但资源加载逻辑分散
2. **缺少统一接口：** ViewPool 中有 TODO："从资源管理器加载 Prefab 并实例化"
3. **资源类型多样：** 需要管理 Prefab、Texture、Audio、AnimationClip 等
4. **异步加载需求：** Cocos Creator 的资源加载是异步的
5. **缓存管理：** 需要统一的缓存策略，避免重复加载
6. **资源释放：** 需要支持资源释放，避免内存泄漏

### 使用场景

1. **Prefab 加载：** ViewManager 和 ViewPool 需要加载 Prefab
2. **音频加载：** AudioDriver 需要加载音频资源
3. **特效加载：** FxDriver 可能需要加载特效 Prefab
4. **纹理加载：** UI 系统可能需要动态加载纹理
5. **动画加载：** AnimDriver 可能需要加载动画资源

### 约束条件

1. **Cocos Creator 3.8.7 API：** 必须使用 Creator 的资源加载 API
2. **异步安全：** 资源加载是异步的，需要处理 Handle 复用问题
3. **架构约束：** 资源管理器属于 Presentation 层，不能依赖 ECS
4. **性能要求：** 需要缓存机制，避免重复加载
5. **内存管理：** 需要支持资源释放，避免内存泄漏

---

## 设计选项

### 选项 1：单一资源管理器（ResourceManager）⭐ 推荐

**设计：** 创建一个统一的 `ResourceManager` 类，管理所有类型的资源

**结构：**
```typescript
class ResourceManager {
    // 资源缓存（按类型分类）
    private prefabCache: Map<string, Prefab> = new Map();
    private textureCache: Map<string, Texture2D> = new Map();
    private audioCache: Map<string, AudioClip> = new Map();
    
    // 加载中状态（避免重复加载）
    private loadingPrefabs: Map<string, Promise<Prefab>> = new Map();
    
    // 加载方法
    async loadPrefab(path: string): Promise<Prefab>
    async loadTexture(path: string): Promise<Texture2D>
    async loadAudio(path: string): Promise<AudioClip>
    
    // 释放方法
    releasePrefab(path: string): void
    releaseTexture(path: string): void
    releaseAudio(path: string): void
    
    // 清理方法
    clear(): void
}
```

**优点：**
- ✅ 统一接口，易于使用
- ✅ 集中管理，便于维护
- ✅ 支持缓存，避免重复加载
- ✅ 支持资源释放
- ✅ 类型安全（TypeScript）

**缺点：**
- ⚠️ 所有资源类型在一个类中，可能变得臃肿
- ⚠️ 需要为每种资源类型实现加载逻辑

---

### 选项 2：多管理器模式（ResourceManager + 各类型管理器）

**设计：** 一个主 `ResourceManager` + 各类型专用管理器（PrefabManager、AudioManager 等）

**结构：**
```typescript
class ResourceManager {
    private prefabManager: PrefabManager;
    private audioManager: AudioManager;
    private textureManager: TextureManager;
    
    getPrefab(path: string): Promise<Prefab> {
        return this.prefabManager.load(path);
    }
}

class PrefabManager {
    private cache: Map<string, Prefab> = new Map();
    async load(path: string): Promise<Prefab> { ... }
    release(path: string): void { ... }
}
```

**优点：**
- ✅ 职责分离，每个管理器专注一种资源
- ✅ 易于扩展新的资源类型
- ✅ 代码组织清晰

**缺点：**
- ❌ 增加复杂度，需要多个类
- ❌ 可能过度设计（当前阶段资源类型不多）

---

### 选项 3：基于 Cocos Creator 的 resources 系统

**设计：** 直接使用 Creator 的 `resources.load()` API，只做简单的缓存包装

**结构：**
```typescript
class ResourceManager {
    private cache: Map<string, any> = new Map();
    
    async load<T extends Asset>(path: string, type: typeof Asset): Promise<T> {
        if (this.cache.has(path)) {
            return this.cache.get(path) as T;
        }
        const asset = await resources.load(path, type);
        this.cache.set(path, asset);
        return asset as T;
    }
}
```

**优点：**
- ✅ 简单直接，利用 Creator 现有 API
- ✅ 代码量少
- ✅ 易于理解

**缺点：**
- ❌ 缺少加载状态管理（可能重复加载）
- ❌ 缺少资源释放逻辑
- ❌ 类型安全性较弱

---

### 选项 4：事件驱动的资源管理器

**设计：** 资源加载通过事件系统，支持加载进度、完成回调等

**结构：**
```typescript
class ResourceManager {
    private eventBus: EventBus;
    
    loadPrefab(path: string): void {
        this.eventBus.emit('resource:load:start', { path, type: 'prefab' });
        // 加载逻辑
        this.eventBus.emit('resource:load:complete', { path, asset });
    }
}
```

**优点：**
- ✅ 解耦，支持多个监听者
- ✅ 支持加载进度通知
- ✅ 易于扩展

**缺点：**
- ❌ 增加复杂度
- ❌ 当前阶段可能不需要事件系统
- ❌ 异步处理更复杂

---

## 推荐方案：选项 1（单一资源管理器）+ 选项 3（基于 Creator API）

### 设计决策

**采用选项 1 的架构 + 选项 3 的实现方式：**

1. **单一 ResourceManager 类：** 统一管理所有资源类型
2. **基于 Creator resources API：** 使用 `resources.load()` 加载资源
3. **缓存机制：** 使用 Map 缓存已加载的资源
4. **加载状态管理：** 使用 Promise Map 避免重复加载
5. **资源释放：** 使用 `resources.release()` 释放资源

### 实现方案

#### 核心接口

```typescript
export class ResourceManager {
    // 资源缓存
    private prefabCache: Map<string, Prefab> = new Map();
    private textureCache: Map<string, Texture2D> = new Map();
    private audioCache: Map<string, AudioClip> = new Map();
    
    // 加载中状态（避免重复加载）
    private loadingPrefabs: Map<string, Promise<Prefab>> = new Map();
    private loadingTextures: Map<string, Promise<Texture2D>> = new Map();
    private loadingAudios: Map<string, Promise<AudioClip>> = new Map();
    
    /**
     * 加载 Prefab
     * @param path 资源路径（相对于 resources 目录）
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
        const promise = resources.load(path, Prefab) as Promise<Prefab>;
        this.loadingPrefabs.set(path, promise);
        
        try {
            const prefab = await promise;
            this.prefabCache.set(path, prefab);
            this.loadingPrefabs.delete(path);
            return prefab;
        } catch (error) {
            this.loadingPrefabs.delete(path);
            throw error;
        }
    }
    
    /**
     * 加载 Texture2D
     */
    async loadTexture(path: string): Promise<Texture2D> {
        // 类似 loadPrefab 的逻辑
    }
    
    /**
     * 加载 AudioClip
     */
    async loadAudio(path: string): Promise<AudioClip> {
        // 类似 loadPrefab 的逻辑
    }
    
    /**
     * 释放 Prefab
     */
    releasePrefab(path: string): void {
        const prefab = this.prefabCache.get(path);
        if (prefab) {
            resources.release(prefab);
            this.prefabCache.delete(path);
        }
    }
    
    /**
     * 清理所有资源
     */
    clear(): void {
        // 释放所有资源
        for (const [path, prefab] of this.prefabCache) {
            resources.release(prefab);
        }
        this.prefabCache.clear();
        // ... 清理其他缓存
    }
}
```

#### 与现有系统集成

**ViewManager 集成：**
```typescript
export class ViewManager {
    private resourceManager: ResourceManager;
    
    constructor(resourceManager: ResourceManager) {
        this.resourceManager = resourceManager;
    }
    
    private async spawnView(handle: Handle, prefabKey: string): Promise<void> {
        // 使用 ResourceManager 加载 Prefab
        const prefab = await this.resourceManager.loadPrefab(`prefabs/${prefabKey}`);
        // ... 其他逻辑
    }
}
```

**ViewPool 集成：**
```typescript
export class ViewPool {
    private resourceManager: ResourceManager;
    
    async get(prefabKey: string, entityId: number): Promise<Node> {
        // 使用 ResourceManager 加载 Prefab
        const prefab = await this.resourceManager.loadPrefab(`prefabs/${prefabKey}`);
        // ... 实例化逻辑
    }
}
```

**AudioDriver 集成：**
```typescript
export class AudioDriver {
    private resourceManager: ResourceManager;
    
    async playSFX(sfxName: string): Promise<void> {
        const audioClip = await this.resourceManager.loadAudio(`audio/sfx/${sfxName}`);
        // ... 播放逻辑
    }
}
```

#### 资源路径约定

```
resources/
  prefabs/
    player.prefab
    enemy.prefab
    bullet.prefab
  audio/
    sfx/
      attack.mp3
      hit.mp3
    bgm/
      battle.mp3
  textures/
    ui/
      button.png
```

#### 错误处理

```typescript
async loadPrefab(path: string): Promise<Prefab> {
    try {
        // 加载逻辑
    } catch (error) {
        console.error(`[ResourceManager] Failed to load prefab: ${path}`, error);
        throw new Error(`Resource load failed: ${path}`);
    }
}
```

#### 资源释放策略

1. **手动释放：** 调用 `releasePrefab(path)` 释放特定资源
2. **场景切换：** 在场景切换时调用 `clear()` 释放所有资源
3. **引用计数：** （可选）实现引用计数，自动释放未使用的资源

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [ ] 创建 `ResourceManager` 类
- [ ] 实现 `loadPrefab` 方法（带缓存和加载状态管理）
- [ ] 实现 `loadTexture` 方法
- [ ] 实现 `loadAudio` 方法
- [ ] 实现资源释放方法
- [ ] 集成到 `ViewManager`
- [ ] 集成到 `ViewPool`
- [ ] 集成到 `AudioDriver`
- [ ] 添加错误处理
- [ ] 编写单元测试
- [ ] 更新文档

## 设计决策总结

1. **架构选择：** 单一 ResourceManager 类，统一管理所有资源类型
2. **实现方式：** 基于 Cocos Creator 的 `resources.load()` API
3. **缓存策略：** 使用 Map 缓存已加载的资源，避免重复加载
4. **加载状态：** 使用 Promise Map 管理加载中状态，避免重复请求
5. **资源释放：** 支持手动释放和批量清理
6. **路径约定：** 使用相对路径，基于 `resources/` 目录
7. **错误处理：** 统一的错误处理和日志记录

## 后续优化（阶段 4）

- 引用计数自动释放
- 资源预加载系统
- 资源加载进度回调
- 资源热更新支持
- 资源压缩和优化
