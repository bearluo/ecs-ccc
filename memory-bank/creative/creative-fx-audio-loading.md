# 特效和音效加载流程和使用流程设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 需求分析

### 当前问题

1. **FxDriver 未实现：** 目前只是占位代码，需要实现真正的特效播放功能
2. **AudioDriver 部分实现：** 有 ResourceManager 集成，但播放功能还是占位
3. **缺少 CommandBuffer 扩展：** 没有 `PlayFxAtPosition`、`PlayFxOnEntity` 和 `PlaySFX` 命令，ECS 无法触发特效和音效
4. **缺少配置系统：** 特效和音效的配置数据未定义
5. **缺少对象池：** 特效对象需要对象池管理（频繁创建/销毁）
6. **缺少生命周期管理：** 特效和音效的生命周期管理不清晰

### 使用场景

1. **技能特效：** 释放技能时播放特效（火球、闪电等）
2. **伤害特效：** 受到伤害时播放特效（血花、爆炸等）
3. **音效播放：** 技能释放、攻击、受击、死亡等音效
4. **背景音乐：** 场景切换、战斗开始/结束时的 BGM
5. **环境特效：** 场景中的持续特效（火焰、烟雾等）

### 约束条件

1. **架构约束：** 遵循 ECS → View 的单向数据流
   - ECS 系统不能直接调用 FxDriver/AudioDriver
   - 必须通过 RenderSyncSystem → CommandBuffer → ViewManager → FxDriver/AudioDriver

2. **Handle 使用：** 所有命令必须使用 Handle 而不是 entityId（异步安全）

3. **ResourceManager 已存在：** 需要复用现有的 ResourceManager 加载资源

4. **Cocos Creator 3.8.7 API：**
   - 特效：使用 ParticleSystem2D、Animation 或 Prefab 实例化
   - 音效：使用 AudioSource + AudioClip

5. **性能要求：**
   - 特效对象池：避免频繁创建/销毁
   - 音效并发限制：避免同时播放过多音效
   - 资源预加载：常用特效和音效应预加载

6. **内存管理：** 需要支持资源释放和清理

---

## 设计选项

### 选项 1：组件驱动 + CommandBuffer 扩展 ⭐ 推荐

**设计：** 
- 添加 `FxIntentComponent` 和 `AudioIntentComponent` 组件
- 扩展 CommandBuffer 支持 `PlayFxAtPosition`、`PlayFxOnEntity` 和 `PlaySFX` 命令（拆分避免二义性）
- RenderSyncSystem 读取组件并生成命令
- ViewManager 处理命令并调用 FxDriver/AudioDriver

**结构：**
```typescript
// 组件（ECS 层）
class FxIntentComponent {
    fxKey: string | null = null;  // 特效配置键
    position?: { x: number; y: number };  // 可选：世界坐标
    targetHandle?: Handle;  // 可选：目标实体
}

class AudioIntentComponent {
    sfxKey: string | null = null;  // 音效配置键
    bgmKey: string | null = null;  // 背景音乐配置键
    volume?: number;  // 可选：音量
}

// CommandBuffer 扩展
type RenderCommand = 
    | { type: 'PlayFxAtPosition'; fxKey: string; position: { x: number; y: number } }
    | { type: 'PlayFxOnEntity'; fxKey: string; handle: Handle }
    | { type: 'PlaySFX'; sfxKey: string; volume?: number }
    | { type: 'PlayBGM'; bgmKey: string; loop?: boolean; volume?: number }
    | ...其他命令

// 配置系统
interface FxConfig {
    key: string;
    prefabPath: string;  // 特效 Prefab 路径
    duration?: number;  // 持续时间（秒），用于自动清理
    poolSize?: number;  // 对象池大小
}

interface AudioConfig {
    key: string;
    clipPath: string;  // 音频文件路径
    type: 'sfx' | 'bgm';  // 类型
    volume?: number;  // 默认音量
}
```

**优点：**
- ✅ 符合 ECS 架构（组件驱动）
- ✅ 遵循架构约束（RenderSyncSystem 是唯一出口）
- ✅ 类型安全（TypeScript）
- ✅ 易于扩展（添加新特效/音效只需添加配置）
- ✅ 配置驱动（易于策划调整）

**缺点：**
- ⚠️ 需要添加组件和系统
- ⚠️ 命令类型增加（CommandBuffer 变复杂）

---

### 选项 2：直接命令模式（无组件）

**设计：** 
- ECS 系统直接生成 `PlayFx` 和 `PlaySFX` 命令
- 不通过组件，直接 push 到 CommandBuffer

**结构：**
```typescript
// CombatSystem 中
if (damage > 0) {
    this.commandBuffer.push({
        type: 'PlayFx',
        handle: target.handle,
        fxKey: 'hit',
        position: { x: target.x, y: target.y }
    });
}
```

**优点：**
- ✅ 简单直接，不需要组件
- ✅ 性能好（减少组件查询）

**缺点：**
- ❌ 违反架构约束（Fixed System 直接操作 CommandBuffer）
- ❌ 难以追踪和调试（命令来源分散）
- ❌ 不符合 ECS 设计原则（数据与逻辑分离）

---

### 选项 3：事件驱动模式

**设计：** 
- 使用 EventBus 发送特效/音效事件
- FxDriver/AudioDriver 监听 EventBus

**结构：**
```typescript
// CombatSystem 中
this.eventBus.push({
    type: 'PlayFxEvent',
    fxKey: 'hit',
    position: { x, y }
});

// FxDriver 中
this.eventBus.subscribe('PlayFxEvent', (event) => {
    this.playFx(event.fxKey, event.position);
});
```

**优点：**
- ✅ 解耦（事件驱动）
- ✅ 易于扩展（多个监听者）

**缺点：**
- ❌ 违反架构约束（View → ECS 方向错误）
- ❌ EventBus 是 View → ECS 的通道，不应反向使用
- ❌ 难以控制执行顺序

---

## 推荐方案：选项 1（组件驱动 + CommandBuffer 扩展）

### 理由

1. **符合架构约束：** RenderSyncSystem 是唯一出口，所有 ECS → View 的命令必须经过它
2. **数据驱动：** 组件存储意图，系统生成命令，符合 ECS 设计原则
3. **易于调试：** 可以通过查看组件状态追踪特效/音效播放意图
4. **配置驱动：** 特效和音效通过配置管理，易于策划调整
5. **类型安全：** TypeScript 类型检查，减少运行时错误

---

## 详细设计

### 1. 组件设计

#### FxIntentComponent（特效意图组件）

```typescript
@component({ name: 'FxIntent', pooled: true })
export class FxIntentComponent extends Component {
    /** 特效配置键（从配置中查找特效） */
    fxKey: string | null = null;
    
    /** 播放位置（世界坐标），如果提供则在此位置播放 */
    position?: { x: number; y: number };
    
    /** 目标实体 Handle（如果提供则在目标位置播放） */
    targetHandle?: Handle;
    
    reset(): void {
        super.reset();
        this.fxKey = null;
        this.position = undefined;
        this.targetHandle = undefined;
    }
}
```

**使用场景：**
- SkillSystem：释放技能时添加 `FxIntentComponent`，设置 `fxKey = 'fireball'`
- CombatSystem：造成伤害时添加 `FxIntentComponent`，设置 `fxKey = 'hit'`, `targetHandle = target.handle`

#### AudioIntentComponent（音效意图组件）

```typescript
@component({ name: 'AudioIntent', pooled: true })
export class AudioIntentComponent extends Component {
    /** 音效配置键 */
    sfxKey: string | null = null;
    
    /** 背景音乐配置键 */
    bgmKey: string | null = null;
    
    /** 音量（0-1），如果不提供则使用配置默认值 */
    volume?: number;
    
    /** BGM 是否循环（仅对 BGM 有效） */
    bgmLoop?: boolean;
    
    reset(): void {
        super.reset();
        this.sfxKey = null;
        this.bgmKey = null;
        this.volume = undefined;
        this.bgmLoop = undefined;
    }
}
```

**使用场景：**
- SkillSystem：释放技能时添加 `AudioIntentComponent`，设置 `sfxKey = 'skill_fireball'`
- DeathSystem：实体死亡时添加 `AudioIntentComponent`，设置 `sfxKey = 'death'`
- SceneManager：场景切换时添加 `AudioIntentComponent`，设置 `bgmKey = 'battle_bgm'`

---

### 2. CommandBuffer 扩展

```typescript
// CommandBuffer.ts
export type RenderCommand =
    | { type: 'SpawnView'; handle: Handle; prefabKey: string }
    | { type: 'SetPosition'; handle: Handle; x: number; y: number }
    | { type: 'PlayAnim'; handle: Handle; animName: string }
    | { type: 'PlayFxAtPosition'; fxKey: string; position: { x: number; y: number } }
    | { type: 'PlayFxOnEntity'; fxKey: string; handle: Handle }
    | { type: 'PlaySFX'; sfxKey: string; volume?: number }
    | { type: 'PlayBGM'; bgmKey: string; loop?: boolean; volume?: number }
    | { type: 'DestroyView'; handle: Handle };
```

**说明：**
- `PlayFxAtPosition`：在指定世界坐标位置播放特效（明确指定坐标）
- `PlayFxOnEntity`：在指定实体位置播放特效（从 ViewManager 获取实体节点的世界坐标）
- `PlaySFX`：无 `handle`（音效是全局的）
- `PlayBGM`：无 `handle`（BGM 是全局的）

**设计决策：拆分两个命令避免二义性**
- ✅ 语义清晰：`PlayFxAtPosition` 明确表示在坐标位置播放，`PlayFxOnEntity` 明确表示在实体位置播放
- ✅ 类型安全：TypeScript 可以完全区分两种命令类型，避免运行时判断
- ✅ 避免歧义：不会出现同时提供 `handle` 和 `position` 的情况
- ✅ 易于理解：代码阅读时一目了然，不需要额外的 if/else 判断

---

### 3. RenderSyncSystem 扩展

```typescript
// RenderSyncSystem.ts - 在 onUpdate 中添加

// FxIntent → PlayFxAtPosition / PlayFxOnEntity 命令
const fxQuery = this.world.createQuery({
    all: [FxIntentComponent]
});
fxQuery.forEach(entity => {
    const fxIntent = entity.getComponent(FxIntentComponent)!;
    
    if (fxIntent.fxKey) {
        // 优先级：position > targetHandle > 当前实体位置
        if (fxIntent.position) {
            // 情况 1：明确指定了位置坐标 → PlayFxAtPosition
            this.commandBuffer.push({
                type: 'PlayFxAtPosition',
                fxKey: fxIntent.fxKey,
                position: fxIntent.position
            });
        } else if (fxIntent.targetHandle) {
            // 情况 2：指定了目标实体 → PlayFxOnEntity
            if (this.world.isValidHandle(fxIntent.targetHandle)) {
                this.commandBuffer.push({
                    type: 'PlayFxOnEntity',
                    fxKey: fxIntent.fxKey,
                    handle: fxIntent.targetHandle
                });
            }
        } else {
            // 情况 3：使用当前实体位置 → PlayFxOnEntity
            this.commandBuffer.push({
                type: 'PlayFxOnEntity',
                fxKey: fxIntent.fxKey,
                handle: entity.handle
            });
        }
        
        // 移除组件（一次性意图）
        entity.removeComponent(FxIntentComponent);
    }
});

// AudioIntent → PlaySFX/PlayBGM 命令
const audioQuery = this.world.createQuery({
    all: [AudioIntentComponent]
});
audioQuery.forEach(entity => {
    const audioIntent = entity.getComponent(AudioIntentComponent)!;
    
    if (audioIntent.sfxKey) {
        this.commandBuffer.push({
            type: 'PlaySFX',
            sfxKey: audioIntent.sfxKey,
            volume: audioIntent.volume
        });
    }
    
    if (audioIntent.bgmKey) {
        this.commandBuffer.push({
            type: 'PlayBGM',
            bgmKey: audioIntent.bgmKey,
            loop: audioIntent.bgmLoop,
            volume: audioIntent.volume
        });
    }
    
    // 移除组件（一次性意图）
    entity.removeComponent(AudioIntentComponent);
});
```

---

### 4. 配置系统扩展

#### 特效配置（fx.ts）

```typescript
// assets/scripts/data/configs/fx.ts
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
```

#### 音效配置（audio.ts）

```typescript
// assets/scripts/data/configs/audio.ts
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
```

#### ConfigLoader 扩展

```typescript
// ConfigLoader.ts
import { FxConfigs, FxConfig } from './data/configs/fx';
import { AudioConfigs, AudioConfig } from './data/configs/audio';

export class ConfigLoader {
    // ... 现有方法 ...
    
    getFxConfig(key: string): FxConfig | undefined {
        return FxConfigs[key];
    }
    
    getAllFxConfigs(): FxConfig[] {
        return Object.keys(FxConfigs).map(key => FxConfigs[key]);
    }
    
    getAudioConfig(key: string): AudioConfig | undefined {
        return AudioConfigs[key];
    }
    
    getAllAudioConfigs(): AudioConfig[] {
        return Object.keys(AudioConfigs).map(key => AudioConfigs[key]);
    }
}
```

---

### 5. FxDriver 实现

```typescript
// FxDriver.ts
import { Node, Prefab, instantiate, ParticleSystem2D } from 'cc';
import { ResourceManager } from './ResourceManager';
import { ConfigLoader } from '../ConfigLoader';
import { FxConfig } from '../data/configs/fx';

export class FxDriver {
    private resourceManager: ResourceManager;
    private configLoader: ConfigLoader;
    
    /** 特效对象池（按 fxKey 分类） */
    private fxPools: Map<string, Node[]> = new Map();
    
    /** 活跃的特效节点（用于清理） */
    private activeFxNodes: Map<Node, { fxKey: string; remainingTime: number }> = new Map();
    
    constructor(resourceManager: ResourceManager, configLoader: ConfigLoader) {
        this.resourceManager = resourceManager;
        this.configLoader = configLoader;
    }
    
    /**
     * 播放特效
     * ⚠️ 架构约束：异步方法，如果 Prefab 未加载则按需加载
     * ⚠️ 返回值：不返回 Node，Driver 内部管理 Node，避免外部反向耦合
     * 预加载由 ResourcePreloader 统一管理，但支持按需加载（ResourceManager 会处理缓存）
     */
    async playFx(fxKey: string, position: { x: number; y: number }, parent?: Node): Promise<void> {
        const config = this.configLoader.getFxConfig(fxKey);
        if (!config) {
            console.warn(`[FxDriver] FxConfig not found: ${fxKey}`);
            return;
        }
        
        // 直接调用 loadPrefab，ResourceManager 会自动处理缓存和去重
        let prefab: Prefab;
        try {
            prefab = await this.resourceManager.loadPrefab(config.prefabPath);
        } catch (error) {
            console.error(`[FxDriver] Failed to load fx prefab: ${fxKey}`, error);
            return;
        }
        
        // 从对象池获取或创建节点
        let node: Node | null = null;
        const pool = this.fxPools.get(fxKey) || [];
        
        if (pool.length > 0) {
            node = pool.pop()!;
            node.active = true;  // 激活节点
        } else {
            node = instantiate(prefab);
        }
        
        // 设置位置
        node.setPosition(position.x, position.y, 0);
        
        // 设置父节点
        if (parent) {
            parent.addChild(node);
        }
        
        // 播放粒子系统或动画
        const particleSystem = node.getComponent(ParticleSystem2D);
        if (particleSystem) {
            particleSystem.resetSystem();
            particleSystem.play();
        }
        
        // 记录活跃节点（使用剩余时间，而不是绝对时间）
        const remainingTime = config.duration || Infinity;
        this.activeFxNodes.set(node, { fxKey, remainingTime });
        
        // ⚠️ 不返回 Node，Driver 内部管理，避免外部反向耦合
    }
    
    /**
     * 停止特效（回收到对象池）
     */
    stopFx(node: Node): void {
        if (!this.activeFxNodes.has(node)) {
            return;
        }
        
        const { fxKey } = this.activeFxNodes.get(node)!;
        
        // 停止粒子系统
        const particleSystem = node.getComponent(ParticleSystem2D);
        if (particleSystem) {
            particleSystem.stop();
        }
        
        // 移除父节点
        if (node.parent) {
            node.parent.removeChild(node);
        }
        
        // 回收到对象池
        node.active = false;
        const pool = this.fxPools.get(fxKey) || [];
        const config = this.configLoader.getFxConfig(fxKey);
        const maxSize = config?.poolSize || 10;
        
        if (pool.length < maxSize) {
            pool.push(node);
            this.fxPools.set(fxKey, pool);
        } else {
            // 对象池已满，销毁节点
            node.destroy();
        }
        
        // 移除活跃记录
        this.activeFxNodes.delete(node);
    }
    
    /**
     * 清理所有特效
     */
    clear(): void {
        // 清理所有活跃特效
        for (const node of this.activeFxNodes.keys()) {
            this.stopFx(node);
        }
        
        // 销毁对象池中的节点
        for (const pool of this.fxPools.values()) {
            for (const node of pool) {
                node.destroy();
            }
        }
        
        this.fxPools.clear();
        this.activeFxNodes.clear();
        // 注意：不清理 ResourceManager 的缓存，由 ResourceManager 统一管理
    }
    
    /**
     * 更新（用于自动清理过期的特效）
     * ⚠️ 关键：统一使用 update(dt) 管理特效生命周期，不允许使用 setTimeout
     * 原因：
     * 1. 与游戏暂停/时间缩放同步
     * 2. Scene 切换时安全清理
     * 3. Node 已被 destroy 时不会触发
     */
    update(dt: number): void {
        const expiredNodes: Node[] = [];
        
        for (const [node, info] of this.activeFxNodes.entries()) {
            // 检查节点是否已被销毁
            if (!node.isValid) {
                expiredNodes.push(node);
                continue;
            }
            
            // 更新剩余时间
            if (info.remainingTime !== Infinity) {
                info.remainingTime -= dt;
                
                // 时间到期，标记为过期
                if (info.remainingTime <= 0) {
                    expiredNodes.push(node);
                }
            }
        }
        
        // 清理过期的特效
        for (const node of expiredNodes) {
            this.stopFx(node);
        }
    }
}
```

---

### 6. AudioDriver 实现

```typescript
// AudioDriver.ts
import { AudioClip, AudioSource, director } from 'cc';
import { ResourceManager } from './ResourceManager';
import { ConfigLoader } from '../ConfigLoader';
import { AudioConfig } from '../data/configs/audio';

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
    
    constructor(resourceManager: ResourceManager, configLoader: ConfigLoader) {
        this.resourceManager = resourceManager;
        this.configLoader = configLoader;
        this.initAudioSources();
    }
    
    /**
     * 初始化音频源
     */
    private initAudioSources(): void {
        // 创建 BGM 音频源（挂载到场景根节点）
        const scene = director.getScene();
        if (scene) {
            this.bgmSource = scene.addComponent(AudioSource);
            this.bgmSource.loop = true;
        }
        
        // 创建 SFX 音频源池
        for (let i = 0; i < this.maxSFXConcurrent; i++) {
            const source = scene?.addComponent(AudioSource) || new AudioSource();
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
}
```

---

### 7. ViewManager 扩展

```typescript
// ViewManager.ts - 在 processCommands 中添加

processCommands(commands: RenderCommand[]): void {
    for (const command of commands) {
        switch (command.type) {
            // ... 现有命令处理 ...
            
            case 'PlayFxAtPosition': {
                // 直接在指定坐标位置播放特效
                if (this.fxDriver) {
                    // 异步调用，不等待结果（fire and forget）
                    this.fxDriver.playFx(command.fxKey, command.position, this.viewParent).catch(error => {
                        console.error(`[ViewManager] Failed to play fx: ${command.fxKey}`, error);
                    });
                }
                break;
            }
            
            case 'PlayFxOnEntity': {
                // 在指定实体位置播放特效
                const node = this.getNodeByHandle(command.handle);
                if (!node) {
                    console.warn(`[ViewManager] Cannot find node for handle: ${command.handle}`);
                    break;
                }
                
                const worldPos = node.getWorldPosition();
                const position = { x: worldPos.x, y: worldPos.y };
                
                if (this.fxDriver) {
                    // 异步调用，不等待结果（fire and forget）
                    this.fxDriver.playFx(command.fxKey, position, this.viewParent).catch(error => {
                        console.error(`[ViewManager] Failed to play fx: ${command.fxKey}`, error);
                    });
                }
                break;
            }
            
            case 'PlaySFX': {
                if (this.audioDriver) {
                    // 异步调用，不等待结果（fire and forget）
                    this.audioDriver.playSFX(command.sfxKey, command.volume).catch(error => {
                        console.error(`[ViewManager] Failed to play SFX: ${command.sfxKey}`, error);
                    });
                }
                break;
            }
            
            case 'PlayBGM': {
                if (this.audioDriver) {
                    // 异步调用，不等待结果（fire and forget）
                    this.audioDriver.playBGM(command.bgmKey, command.loop, command.volume).catch(error => {
                        console.error(`[ViewManager] Failed to play BGM: ${command.bgmKey}`, error);
                    });
                }
                break;
            }
        }
    }
}
```

---

### 8. 资源预加载流程（基于 priority 配置）

#### priority 字段说明

- **`critical`**：必须预加载，游戏启动时或场景切换时必须加载完成
- **`normal`**：允许异步加载，可在需要时按需加载

这个字段将"经验判断"转化为"配置规则"，让预加载策略更加明确和可维护。

#### 启动时预加载

```typescript
// GameApp.ts
async onLoad() {
    // ... 现有代码 ...
    
    // 根据 priority 配置自动筛选需要预加载的资源
    // 只预加载 priority === 'critical' 的资源
    const criticalFxConfigs = this.configLoader.getAllFxConfigs()
        .filter(config => config.priority === 'critical');
    const criticalAudioConfigs = this.configLoader.getAllAudioConfigs()
        .filter(config => config.priority === 'critical');
    
    // 构建预加载配置
    const preloadPrefabs: { prefabKey: string; path: string }[] = [];
    const preloadAudios: string[] = [];
    
    // 添加 critical 特效预加载路径
    for (const fxConfig of criticalFxConfigs) {
        preloadPrefabs.push({ prefabKey: fxConfig.key, path: fxConfig.prefabPath });
    }
    
    // 添加 critical 音效预加载路径
    for (const audioConfig of criticalAudioConfigs) {
        preloadAudios.push(audioConfig.clipPath);
    }
    
    // 统一预加载 critical 资源
    if (preloadPrefabs.length > 0 || preloadAudios.length > 0) {
        await this.resourcePreloader.preloadParallel({
            prefabs: preloadPrefabs,
            textures: [],
            audios: preloadAudios.map(path => ({ audioKey: path, path }))
        });
    }
}

update(dt: number): void {
    // ... 现有更新逻辑 ...
    
    // ⚠️ 关键：必须在每帧调用 FxDriver.update(dt) 以统一管理特效生命周期
    // 不允许使用 setTimeout，必须通过 update(dt) 管理
    // 原因：
    // 1. 与游戏暂停/时间缩放同步
    // 2. Scene 切换时安全清理
    // 3. Node 已被 destroy 时不会触发
    if (this.fxDriver) {
        this.fxDriver.update(dt);
    }
}
```

#### 场景切换时预加载

```typescript
// 在 ResourcePreloader 中扩展，统一管理特效和音效预加载
// ResourcePreloader 根据配置中的 fxKeys 和 audioKeys，通过 ConfigLoader 获取路径
// 然后统一调用 ResourceManager 进行预加载

// 场景配置示例
interface ScenePreloadConfig {
    prefabs?: { prefabKey: string; path: string }[];
    textures?: { textureKey: string; path: string }[];
    audios?: { audioKey: string; path: string }[];
    fxKeys?: string[];  // 特效配置键列表
    audioKeys?: string[];  // 音效配置键列表
}

// ResourcePreloader 扩展方法（基于 priority 自动筛选）
async preloadSceneConfig(config: ScenePreloadConfig, configLoader: ConfigLoader): Promise<void> {
    const preloadPrefabs: { prefabKey: string; path: string }[] = [];
    const preloadAudios: string[] = [];
    
    // 处理特效配置键（只预加载 critical）
    if (config.fxKeys) {
        for (const fxKey of config.fxKeys) {
            const fxConfig = configLoader.getFxConfig(fxKey);
            if (fxConfig && fxConfig.priority === 'critical') {
                preloadPrefabs.push({ prefabKey: fxKey, path: fxConfig.prefabPath });
            }
        }
    }
    
    // 处理音效配置键（只预加载 critical）
    if (config.audioKeys) {
        for (const audioKey of config.audioKeys) {
            const audioConfig = configLoader.getAudioConfig(audioKey);
            if (audioConfig && audioConfig.priority === 'critical') {
                preloadAudios.push(audioConfig.clipPath);
            }
        }
    }
    
    // 统一预加载 critical 资源
    await this.preloadParallel({
        prefabs: [...(config.prefabs || []), ...preloadPrefabs],
        textures: config.textures || [],
        audios: [...(config.audios || []), ...preloadAudios.map(path => ({ audioKey: path, path }))]
    });
}
```

**设计原则：**
- ✅ **职责分离：** Driver 只负责播放，不负责预加载
- ✅ **统一管理：** ResourcePreloader 统一管理所有资源预加载
- ✅ **配置驱动：** 通过 priority 字段自动筛选需要预加载的资源，避免硬编码

---

### 9. 使用示例

#### ECS 系统触发特效和音效

```typescript
// SkillSystem.ts
onUpdate(dt: number): void {
    const query = this.world.createQuery({
        all: [SkillSlotsComponent]
    });
    
    query.forEach(entity => {
        const skills = entity.getComponent(SkillSlotsComponent)!;
        
        if (skills.activeSkill) {
            const skillConfig = ConfigLoader.getInstance().getSkillConfig(skills.activeSkill.id);
            
            // 添加特效意图
            const fxIntent = entity.addComponent(FxIntentComponent);
            fxIntent.fxKey = skillConfig.fxKey;  // 如 'fireball'
            fxIntent.position = { x: entity.x, y: entity.y };
            
            // 添加音效意图
            const audioIntent = entity.addComponent(AudioIntentComponent);
            audioIntent.sfxKey = skillConfig.sfxKey;  // 如 'skill_fireball'
            
            // ... 其他技能逻辑 ...
        }
    });
}

// CombatSystem.ts
onUpdate(dt: number): void {
    // ... 碰撞检测和伤害计算 ...
    
    if (damage > 0) {
        // 添加受击特效意图
        const fxIntent = target.addComponent(FxIntentComponent);
        fxIntent.fxKey = 'hit';
        fxIntent.targetHandle = target.handle;
        
        // 添加受击音效意图
        const audioIntent = target.addComponent(AudioIntentComponent);
        audioIntent.sfxKey = 'hit';
    }
}
```

---

## 实现步骤

1. **创建组件：** `FxIntentComponent.ts`、`AudioIntentComponent.ts`
2. **扩展 CommandBuffer：** 添加 `PlayFxAtPosition`、`PlayFxOnEntity`、`PlaySFX`、`PlayBGM` 命令类型
3. **扩展 RenderSyncSystem：** 添加特效和音效命令生成逻辑
4. **创建配置：** `fx.ts`、`audio.ts`
5. **扩展 ConfigLoader：** 添加特效和音效配置查询方法
6. **实现 FxDriver：** 完整的特效加载和播放功能
7. **实现 AudioDriver：** 完整的音效和 BGM 播放功能
8. **扩展 ViewManager：** 处理特效和音效命令
9. **集成到 GameApp：** 初始化 FxDriver 和 AudioDriver，设置依赖，**在 update(dt) 中调用 FxDriver.update(dt)**
10. **资源预加载：** 通过 ResourcePreloader 统一管理，Driver 不负责预加载（职责分离）
11. **单元测试：** 编写单元测试覆盖核心功能

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 验证

### 需求验证

- ✅ **ECS 触发特效/音效：** 通过组件驱动，符合架构约束
- ✅ **资源加载：** 复用 ResourceManager，支持预加载
- ✅ **对象池管理：** FxDriver 实现对象池，避免频繁创建/销毁
- ✅ **配置驱动：** 特效和音效通过配置管理，易于调整
- ✅ **生命周期管理：** 特效自动清理，音效并发限制
- ✅ **Handle 使用：** 所有命令使用 Handle，异步安全

### 架构约束验证

- ✅ **RenderSyncSystem 是唯一出口：** 所有 ECS → View 的命令经过它
- ✅ **组件驱动：** 使用 FxIntentComponent 和 AudioIntentComponent
- ✅ **数据与逻辑分离：** 组件存数据，系统生成命令
- ✅ **类型安全：** TypeScript 类型检查

### 性能验证

- ✅ **对象池：** 特效对象池，避免频繁创建/销毁
- ✅ **并发限制：** 音效并发数量限制
- ✅ **资源缓存：** ResourceManager 提供缓存
- ✅ **预加载：** 支持启动时和场景切换时预加载

---

## 总结

本设计采用**组件驱动 + CommandBuffer 扩展**的方案，完全符合 ECS 架构约束，通过配置驱动的方式管理特效和音效，使用对象池优化性能，支持资源预加载和生命周期管理。

**关键决策：**
1. 使用组件存储意图，系统生成命令（符合 ECS 原则）
2. 扩展 CommandBuffer 支持特效和音效命令（遵循架构约束）
3. **拆分 `PlayFx` 为两个命令避免二义性：** `PlayFxAtPosition`（坐标位置）和 `PlayFxOnEntity`（实体位置）
   - ✅ 语义清晰：两个命令明确表示不同的锚点来源
   - ✅ 类型安全：TypeScript 可以完全区分两种命令类型
   - ✅ 避免歧义：不会出现同时提供 `handle` 和 `position` 的情况
   - ✅ 易于理解：代码阅读时一目了然，不需要额外的 if/else 判断
4. **FX 生命周期统一走 update(dt)，禁止使用 setTimeout：**
   - ✅ 与游戏暂停/时间缩放同步
   - ✅ Scene 切换时安全清理
   - ✅ Node 已被 destroy 时不会触发
   - ⚠️ 必须在 GameApp.update(dt) 中调用 FxDriver.update(dt)
   - ❌ 禁止混用 setTimeout（典型"早期方便、后期炸锅"的风险点）
5. **职责分离：Driver 不负责预加载，但支持按需加载**
   - ✅ 预加载统一由 ResourcePreloader 管理
   - ✅ Driver 播放时直接调用 ResourceManager.loadPrefab/loadAudio（自动处理缓存）
   - ✅ ResourceManager 会处理缓存和去重，避免重复加载
   - ✅ 保持 Driver 单一职责（播放），资源加载由 ResourceManager 处理
6. **priority 配置字段：将经验判断转化为配置规则**
   - ✅ `critical`：必须预加载，游戏启动时或场景切换时必须加载完成
   - ✅ `normal`：允许异步加载，可在需要时按需加载
   - ✅ 预加载流程根据 priority 自动筛选需要预加载的资源
   - ✅ 避免了硬编码的预加载列表，配置更加灵活和可维护
7. **FxDriver.playFx 不返回 Node：避免外部反向耦合**
   - ✅ 返回值改为 `Promise<void>`（不返回 Node）
   - ✅ Driver 内部管理 Node，外部不依赖返回值
   - ✅ 避免外部系统"拿 Node 做事"导致的反向耦合
   - ✅ MVP 可以先保留返回值，但不被外部系统使用
8. **AudioDriver.currentBGM 直接缓存 key：避免通过 clip 反查 config**
   - ✅ 使用 `currentBGMKey?: string` 直接缓存配置键
   - ✅ 移除 `findConfigByClip()` 方法和 `currentBGM?: AudioClip` 字段
   - ✅ 避免通过 clip 反查 config 的隐性 bug
   - ✅ 代码更简洁，逻辑更清晰
9. **异步方法设计：支持按需加载，提升灵活性**
   - ✅ `playFx()` 返回 `Promise<void>`（异步，不返回 Node）
   - ✅ `playSFX()` 和 `playBGM()` 返回 `Promise<void>`（异步）
   - ✅ 如果资源未加载，会自动按需加载（ResourceManager 会处理缓存）
   - ✅ ViewManager 使用 fire and forget 模式调用（不阻塞渲染）
10. FxDriver 实现对象池管理（性能优化）
11. AudioDriver 实现并发限制（性能优化）
12. 配置驱动管理特效和音效（易于策划调整）
