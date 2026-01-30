# 场景管理设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 需求分析

### 当前问题

1. **缺少统一场景流程管理：** GameApp 中有 `preloadScene` 方法，但没有统一的场景切换流程
2. **World 状态管理不清晰：** 场景切换时 World 应该保留、重建还是合并？
3. **资源加载/卸载时机不明确：** 什么时候预加载？什么时候卸载？
4. **场景生命周期管理缺失：** 场景进入/退出时的清理逻辑分散
5. **场景类型不明确：** 主场景、战斗场景、商店场景等需要不同的处理策略

### 使用场景

1. **主场景（Main）：** 游戏主界面，保留玩家数据，切换到其他场景后返回
2. **战斗场景（Battle）：** 战斗关卡，进入时创建敌人，退出时清理所有敌人，保留玩家数据
3. **商店场景（Shop）：** 商店界面，进入时创建商店 NPC，退出时清理
4. **Boss 场景（Boss）：** Boss 战斗，进入时创建 Boss，退出时清理
5. **场景预加载：** 切换前预加载资源，避免卡顿
6. **场景清理：** 切换后清理不需要的资源，释放内存

### 约束条件

1. **架构约束：**
   - ECS World 只存纯数据，不依赖 Creator 场景
   - 场景切换时 View 层需要清理（ViewManager.clear()）
   - 资源管理器需要支持场景级别的资源卸载
   - 存档系统需要知道场景状态

2. **性能约束：**
   - 场景切换不应该阻塞主线程（异步切换）
   - 资源预加载应该并行执行
   - 避免重复加载资源

3. **数据流约束：**
   - 场景切换时，World 状态管理策略需要明确
   - 玩家数据（Inventory、Equipment、LevelExperience）应该保留
   - 场景特定数据（敌人、NPC）应该在场景退出时清理

---

## 设计选项

### 选项 1：场景状态机 + World 保留策略 ⭐ 推荐

**设计思路：**
- 创建一个 `SceneFlow` 类管理场景流程
- World 在整个游戏生命周期中保留，场景切换时只清理场景特定的实体
- 使用场景标识组件（SceneTagComponent）标记场景特定的实体
- 场景切换时清理所有带当前场景 Tag 的实体

**结构：**
```typescript
// 场景类型
enum SceneType {
    Main = 'main',
    Battle = 'battle',
    Shop = 'shop',
    Boss = 'boss'
}

// 场景标识组件（标记场景特定的实体）
@component
class SceneTagComponent {
    sceneType: SceneType;
}

// SceneFlow 类
class SceneFlow {
    private currentScene: SceneType = SceneType.Main;
    private world: World;
    private resourceManager: ResourceManager;
    private resourcePreloader: ResourcePreloader;
    private viewManager: ViewManager;
    
    // 场景切换
    async switchScene(targetScene: SceneType, options?: SceneSwitchOptions): Promise<void>
    
    // 场景预加载
    async preloadScene(sceneType: SceneType): Promise<void>
    
    // 场景清理
    private cleanupScene(sceneType: SceneType): void
    
    // 场景初始化
    private initializeScene(sceneType: SceneType): void
}

// 场景切换流程
async switchScene(targetScene: SceneType) {
    // 1. 预加载目标场景资源
    await this.preloadScene(targetScene);
    
    // 2. 清理当前场景（保留玩家数据）
    this.cleanupScene(this.currentScene);
    
    // 3. 暂停 ECS 更新（可选）
    // this.pauseECS();
    
    // 4. 加载 Creator 场景（使用 Cocos Creator API）
    await this.loadCreatorScene(targetScene);
    
    // 5. 初始化新场景（创建场景特定实体）
    this.initializeScene(targetScene);
    
    // 6. 恢复 ECS 更新
    // this.resumeECS();
    
    // 7. 更新当前场景
    this.currentScene = targetScene;
}

// 场景清理（只清理场景特定的实体）
private cleanupScene(sceneType: SceneType): void {
    // 查询所有带当前场景 Tag 的实体
    const sceneQuery = this.world.createQuery({
        all: [SceneTagComponent]
    });
    
    sceneQuery.forEach(entity => {
        const tag = entity.getComponent(SceneTagComponent);
        if (tag.sceneType === sceneType) {
            // 清理实体（ECS 会自动清理组件和视图）
            this.world.destroyEntity(entity);
        }
    });
    
    // 清理 View 层（场景切换时清理所有 View）
    this.viewManager.clear();
    
    // 卸载场景特定资源（可选）
    // this.resourceManager.unloadSceneResources(sceneType);
}

// 场景初始化（创建场景特定实体）
private initializeScene(sceneType: SceneType): void {
    switch (sceneType) {
        case SceneType.Battle:
            // 创建敌人实体
            this.createBattleEntities();
            break;
        case SceneType.Shop:
            // 创建商店 NPC 实体
            this.createShopEntities();
            break;
        case SceneType.Boss:
            // 创建 Boss 实体
            this.createBossEntities();
            break;
    }
}
```

**优点：**
- ✅ World 状态保留，玩家数据不会丢失
- ✅ 场景切换流程清晰，易于维护
- ✅ 场景特定的实体管理简单（通过 Tag 组件）
- ✅ 支持场景预加载，用户体验好
- ✅ 与存档系统兼容（World 始终存在）

**缺点：**
- ⚠️ 需要手动管理 SceneTagComponent（容易遗漏）
- ⚠️ 场景清理逻辑需要明确哪些实体属于场景
- ⚠️ World 中的实体数量可能会累积（如果不及时清理）

---

### 选项 2：场景状态机 + World 重建策略

**设计思路：**
- 场景切换时重建 World
- 使用存档系统保存玩家数据
- 场景切换时序列化玩家数据，重建 World 后反序列化

**结构：**
```typescript
class SceneFlow {
    async switchScene(targetScene: SceneType): Promise<void> {
        // 1. 保存玩家数据（序列化）
        const playerData = this.savePlayerData();
        
        // 2. 清理当前场景
        this.viewManager.clear();
        this.world.destroy();
        
        // 3. 预加载目标场景资源
        await this.preloadScene(targetScene);
        
        // 4. 重建 World
        this.world = new World({ ... });
        this.setupSystems(this.world);
        
        // 5. 恢复玩家数据（反序列化）
        this.restorePlayerData(playerData);
        
        // 6. 加载 Creator 场景
        await this.loadCreatorScene(targetScene);
        
        // 7. 初始化新场景
        this.initializeScene(targetScene);
    }
}
```

**优点：**
- ✅ World 完全干净，不会有遗留数据
- ✅ 场景切换逻辑简单（直接重建）

**缺点：**
- ❌ 玩家数据需要频繁序列化/反序列化（性能开销）
- ❌ 场景切换时间长（重建 World + 恢复数据）
- ❌ 需要修改存档系统支持临时数据保存
- ❌ 复杂系统的状态可能难以完整保存

**评估：** ❌ 不推荐
- 性能开销大
- 实现复杂
- 与现有存档系统设计冲突（存档系统设计为"重建 World"，但不应该用于场景切换）

---

### 选项 3：场景状态机 + World 分区策略

**设计思路：**
- 使用多个 World（主 World + 场景 World）
- 主 World 存储玩家数据（长期保留）
- 场景 World 存储场景特定数据（场景切换时重建）

**结构：**
```typescript
class SceneFlow {
    private mainWorld: World; // 玩家数据
    private sceneWorld: World; // 场景数据
    
    async switchScene(targetScene: SceneType): Promise<void> {
        // 1. 清理场景 World
        this.sceneWorld.destroy();
        this.sceneWorld = new World({ ... });
        
        // 2. 预加载资源
        await this.preloadScene(targetScene);
        
        // 3. 初始化场景 World
        this.initializeSceneWorld(targetScene);
        
        // 4. 加载 Creator 场景
        await this.loadCreatorScene(targetScene);
    }
}
```

**优点：**
- ✅ 玩家数据和场景数据完全分离
- ✅ 场景切换时只重建场景 World（性能好）

**缺点：**
- ❌ 需要修改现有架构（GameApp 需要管理两个 World）
- ❌ 系统需要知道查询哪个 World（复杂度高）
- ❌ 场景数据和玩家数据交互困难（跨 World 通信）
- ❌ 与现有系统不兼容（所有系统都假设只有一个 World）

**评估：** ❌ 不推荐
- 架构改动太大
- 与现有设计不兼容
- 跨 World 通信复杂

---

### 选项 4：混合策略（场景 World + 玩家数据同步）

**设计思路：**
- 主 World 存储玩家数据（长期保留）
- 场景 World 存储场景数据（场景切换时重建）
- 玩家实体同时存在于两个 World（数据同步）

**结构：**
```typescript
class SceneFlow {
    private mainWorld: World; // 玩家数据
    private sceneWorld: World; // 场景数据
    
    // 玩家数据同步
    syncPlayerData(): void {
        // 从 mainWorld 同步玩家数据到 sceneWorld
    }
}
```

**优点：**
- ✅ 数据分离清晰
- ✅ 场景切换性能好

**缺点：**
- ❌ 数据同步逻辑复杂
- ❌ 容易出现数据不一致
- ❌ 架构改动太大

**评估：** ❌ 不推荐
- 数据同步复杂
- 容易出现不一致

---

## 推荐方案：选项 1（场景状态机 + World 保留策略）

### 理由

1. **最小改动：** 与现有架构兼容，不需要修改 GameApp 的核心逻辑
2. **性能好：** World 保留，场景切换时只需要清理场景特定实体
3. **易于维护：** 场景切换流程清晰，使用 Tag 组件标记场景实体
4. **与存档兼容：** World 始终存在，存档系统无需修改

### 实现细节

#### 1. 场景标识组件

```typescript
// gameplay/components/SceneTag.ts
import { component } from '@bl-framework/ecs';

export enum SceneType {
    Main = 'main',
    Battle = 'battle',
    Shop = 'shop',
    Boss = 'boss'
}

@component
export class SceneTagComponent {
    sceneType: SceneType;
    
    constructor(sceneType: SceneType = SceneType.Main) {
        this.sceneType = sceneType;
    }
}
```

#### 2. SceneFlow 类结构

```typescript
// app/SceneFlow.ts
import { World } from '@bl-framework/ecs';
import { SceneType, SceneTagComponent } from '../gameplay/components/SceneTag';
import { ResourceManager } from '../presentation/ResourceManager';
import { ResourcePreloader } from '../presentation/ResourcePreloader';
import { ViewManager } from '../presentation/ViewManager';
import { ScenePreloadConfigs } from '../data/configs/resource-preload';
import { director, Scene as CCScene } from 'cc';

export interface SceneSwitchOptions {
    /** 是否预加载资源（默认 true） */
    preload?: boolean;
    /** 是否清理当前场景（默认 true） */
    cleanup?: boolean;
    /** 场景切换完成回调 */
    onComplete?: () => void;
    /** 场景切换失败回调 */
    onError?: (error: Error) => void;
}

export class SceneFlow {
    private currentScene: SceneType = SceneType.Main;
    private world: World;
    private resourceManager: ResourceManager;
    private resourcePreloader: ResourcePreloader;
    private viewManager: ViewManager;
    private gameApp: GameApp;
    
    constructor(
        world: World,
        resourceManager: ResourceManager,
        resourcePreloader: ResourcePreloader,
        viewManager: ViewManager,
        gameApp: GameApp
    ) {
        this.world = world;
        this.resourceManager = resourceManager;
        this.resourcePreloader = resourcePreloader;
        this.viewManager = viewManager;
        this.gameApp = gameApp;
    }
    
    /**
     * 获取当前场景
     */
    getCurrentScene(): SceneType {
        return this.currentScene;
    }
    
    /**
     * 切换场景
     */
    async switchScene(targetScene: SceneType, options: SceneSwitchOptions = {}): Promise<void> {
        const {
            preload = true,
            cleanup = true,
            onComplete,
            onError
        } = options;
        
        try {
            // 1. 预加载目标场景资源
            if (preload) {
                await this.preloadScene(targetScene);
            }
            
            // 2. 清理当前场景（保留玩家数据）
            if (cleanup) {
                this.cleanupScene(this.currentScene);
            }
            
            // 3. 加载 Creator 场景（使用 Cocos Creator API）
            await this.loadCreatorScene(targetScene);
            
            // 4. 初始化新场景（创建场景特定实体）
            this.initializeScene(targetScene);
            
            // 5. 更新当前场景
            this.currentScene = targetScene;
            
            // 6. 调用完成回调
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error(`[SceneFlow] Failed to switch scene to ${targetScene}:`, error);
            if (onError) {
                onError(error as Error);
            }
            throw error;
        }
    }
    
    /**
     * 预加载场景资源
     */
    async preloadScene(sceneType: SceneType): Promise<void> {
        const config = ScenePreloadConfigs[sceneType];
        if (config) {
            await this.resourcePreloader.preloadParallel(
                config,
                (progress) => {
                    console.log(`[SceneFlow] Preloading ${sceneType}: ${(progress * 100).toFixed(1)}%`);
                    // TODO: 更新 UI 加载进度条
                }
            );
        }
    }
    
    /**
     * 加载 Creator 场景
     */
    private async loadCreatorScene(sceneType: SceneType): Promise<void> {
        const sceneName = this.getSceneName(sceneType);
        
        return new Promise<void>((resolve, reject) => {
            director.loadScene(sceneName, (error: Error | null) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
    
    /**
     * 获取场景名称（从 SceneType 转换为 Creator 场景名称）
     */
    private getSceneName(sceneType: SceneType): string {
        const sceneNameMap: Record<SceneType, string> = {
            [SceneType.Main]: 'scene-main',
            [SceneType.Battle]: 'scene-battle',
            [SceneType.Shop]: 'scene-shop',
            [SceneType.Boss]: 'scene-boss'
        };
        return sceneNameMap[sceneType] || 'scene-main';
    }
    
    /**
     * 清理场景（只清理场景特定的实体，保留玩家数据）
     */
    private cleanupScene(sceneType: SceneType): void {
        // 查询所有带当前场景 Tag 的实体
        const sceneQuery = this.world.createQuery({
            all: [SceneTagComponent]
        });
        
        const entitiesToDestroy: any[] = [];
        sceneQuery.forEach(entity => {
            const tag = entity.getComponent(SceneTagComponent);
            if (tag && tag.sceneType === sceneType) {
                entitiesToDestroy.push(entity);
            }
        });
        
        // 销毁场景特定实体
        entitiesToDestroy.forEach(entity => {
            this.world.destroyEntity(entity);
        });
        
        // 清理 View 层（场景切换时清理所有 View）
        this.viewManager.clear();
        
        // 卸载场景特定资源（可选）
        // this.resourceManager.unloadSceneResources(sceneType);
    }
    
    /**
     * 初始化场景（创建场景特定实体）
     */
    private initializeScene(sceneType: SceneType): void {
        switch (sceneType) {
            case SceneType.Main:
                this.createMainSceneEntities();
                break;
            case SceneType.Battle:
                this.createBattleSceneEntities();
                break;
            case SceneType.Shop:
                this.createShopSceneEntities();
                break;
            case SceneType.Boss:
                this.createBossSceneEntities();
                break;
        }
    }
    
    /**
     * 创建主场景实体
     */
    private createMainSceneEntities(): void {
        // 主场景通常只需要玩家实体（已在 World 中）
        // 如果需要 NPC 或其他实体，在这里创建
    }
    
    /**
     * 创建战斗场景实体
     */
    private createBattleSceneEntities(): void {
        // 创建敌人实体（示例）
        // const enemyEntity = this.world.createEntity();
        // enemyEntity.addComponent(SceneTagComponent, SceneType.Battle);
        // enemyEntity.addComponent(TransformComponent, { x: 100, y: 100 });
        // enemyEntity.addComponent(HPComponent, { cur: 100, max: 100 });
        // ... 其他组件
    }
    
    /**
     * 创建商店场景实体
     */
    private createShopSceneEntities(): void {
        // 创建商店 NPC 实体（示例）
        // const shopNPC = this.world.createEntity();
        // shopNPC.addComponent(SceneTagComponent, SceneType.Shop);
        // ... 其他组件
    }
    
    /**
     * 创建 Boss 场景实体
     */
    private createBossSceneEntities(): void {
        // 创建 Boss 实体（示例）
        // const bossEntity = this.world.createEntity();
        // bossEntity.addComponent(SceneTagComponent, SceneType.Boss);
        // ... 其他组件
    }
}
```

#### 3. 集成到 GameApp

```typescript
// app/GameApp.ts
export class GameApp extends Component {
    private sceneFlow!: SceneFlow;
    
    async onLoad() {
        // ... 现有初始化代码 ...
        
        // 初始化场景流程管理器
        this.sceneFlow = new SceneFlow(
            this.world,
            this.resourceManager,
            this.resourcePreloader,
            this.viewManager,
            this
        );
    }
    
    /**
     * 切换场景（委托给 SceneFlow）
     */
    public async switchScene(sceneType: SceneType, options?: SceneSwitchOptions): Promise<void> {
        return this.sceneFlow.switchScene(sceneType, options);
    }
    
    /**
     * 获取当前场景
     */
    public getCurrentScene(): SceneType {
        return this.sceneFlow.getCurrentScene();
    }
}
```

### 实施指南

#### 阶段 1：创建 SceneTag 组件

1. 创建 `gameplay/components/SceneTag.ts`
2. 定义 `SceneType` 枚举
3. 定义 `SceneTagComponent` 组件

#### 阶段 2：实现 SceneFlow 类

1. 创建 `app/SceneFlow.ts`
2. 实现场景切换流程
3. 实现场景清理逻辑
4. 实现场景初始化逻辑

#### 阶段 3：集成到 GameApp

1. 在 `GameApp.onLoad()` 中初始化 `SceneFlow`
2. 提供 `switchScene()` 和 `getCurrentScene()` 方法
3. 移除 `GameApp.preloadScene()` 方法（由 SceneFlow 管理）

#### 阶段 4：场景实体创建

1. 在所有场景特定的实体上添加 `SceneTagComponent`
2. 玩家实体**不添加** `SceneTagComponent`（保留）
3. 实现各场景的实体创建逻辑

#### 阶段 5：测试和验证

1. 测试场景切换流程
2. 验证玩家数据保留
3. 验证场景特定实体清理
4. 验证资源加载/卸载

### 注意事项

1. **玩家实体管理：**
   - 玩家实体**不应该**添加 `SceneTagComponent`
   - 玩家实体应该在游戏启动时创建，在整个游戏生命周期中保留

2. **场景实体管理：**
   - 所有场景特定的实体（敌人、NPC、道具等）都应该添加 `SceneTagComponent`
   - 场景切换时，这些实体会被自动清理

3. **资源管理：**
   - 场景切换时，View 层会被清理（`viewManager.clear()`）
   - 资源管理器可以选择卸载场景特定资源，但需要谨慎（避免重复加载）

4. **存档兼容：**
   - 存档系统应该只保存玩家数据，不保存场景特定实体
   - 读档后，需要根据当前场景重新创建场景特定实体

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 总结

**推荐方案：** 场景状态机 + World 保留策略

**核心设计：**
- 使用 `SceneFlow` 类管理场景流程
- World 在整个游戏生命周期中保留
- 使用 `SceneTagComponent` 标记场景特定实体
- 场景切换时清理带当前场景 Tag 的实体，保留玩家数据

**实施步骤：**
1. 创建 SceneTag 组件
2. 实现 SceneFlow 类
3. 集成到 GameApp
4. 场景实体创建（添加 SceneTagComponent）
5. 测试和验证

**关键约束：**
- 玩家实体不添加 SceneTagComponent（保留）
- 场景特定实体必须添加 SceneTagComponent（自动清理）
- 场景切换时清理 View 层，保留 World 状态
