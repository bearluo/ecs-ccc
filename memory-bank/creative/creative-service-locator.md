# 服务定位器设计

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 需求分析

### 当前问题

1. **服务访问分散：** 有些服务使用单例模式（`ResourceManager.getInstance()`、`UIManager.getInstance()`），有些在 GameApp 中管理（World、Scheduler、CommandBuffer 等）
2. **依赖注入复杂：** GameApp 中需要手动管理大量服务的创建和注入（通过 `setXxx()` 方法）
3. **访问方式不统一：** 不同服务有不同的访问方式，增加学习成本和维护难度
4. **测试困难：** 单例模式使得单元测试时难以替换依赖
5. **生命周期不清晰：** 服务的创建、初始化、销毁时机分散在各个地方

### 使用场景

1. **系统依赖注入：** Systems 需要访问 CommandBuffer、EventBus、ConfigLoader 等
2. **表现层服务访问：** ViewManager、AnimDriver、FxDriver 等需要访问共享服务
3. **UI 服务访问：** UI 模块需要访问 World、EventBus、ResourceManager 等
4. **场景切换：** SceneFlow 需要访问多个服务（World、ResourceManager、ViewManager 等）

### 约束条件

1. **架构约束：**
   - 不能破坏现有的 ECS 架构
   - 不能影响系统的独立性和可测试性
   - 需要支持依赖注入和服务定位器混合模式

2. **性能约束：**
   - 服务定位不能成为性能瓶颈
   - 类型推断应该在编译时完成

3. **兼容性约束：**
   - 需要与现有的单例模式兼容（ResourceManager、UIManager 等）
   - 不能破坏现有的 API

---

## 设计选项

### 选项 1：轻量级服务注册表（Service Registry）⭐ 推荐

**设计思路：**
- 创建一个简单的 `ServiceLocator` 类，提供服务的注册和获取
- 支持类型安全的服务访问（通过泛型）
- 与现有单例模式兼容（可以选择性注册）
- 支持服务依赖注入（通过构造函数或 setter）

**结构：**
```typescript
// app/ServiceLocator.ts
export class ServiceLocator {
    private static services: Map<Function, any> = new Map();

    /**
     * 注册服务
     */
    static register<T>(serviceClass: new (...args: any[]) => T, instance: T): void {
        this.services.set(serviceClass, instance);
    }

    /**
     * 获取服务
     */
    static get<T>(serviceClass: new (...args: any[]) => T): T | null {
        return this.services.get(serviceClass) || null;
    }

    /**
     * 获取服务（必需，不存在时抛出错误）
     */
    static require<T>(serviceClass: new (...args: any[]) => T): T {
        const service = this.services.get(serviceClass);
        if (!service) {
            throw new Error(`Service ${serviceClass.name} not registered`);
        }
        return service;
    }

    /**
     * 检查服务是否已注册
     */
    static has<T>(serviceClass: new (...args: any[]) => T): boolean {
        return this.services.has(serviceClass);
    }

    /**
     * 取消注册服务
     */
    static unregister<T>(serviceClass: new (...args: any[]) => T): void {
        this.services.delete(serviceClass);
    }

    /**
     * 清空所有服务
     */
    static clear(): void {
        this.services.clear();
    }
}

// 使用示例：
// 在 GameApp.onLoad() 中注册服务
ServiceLocator.register(World, this.world);
ServiceLocator.register(CommandBuffer, this.commandBuffer);
ServiceLocator.register(EventBus, this.eventBus);
ServiceLocator.register(ResourceManager, this.resourceManager);

// 在 Systems 中获取服务
const commandBuffer = ServiceLocator.require(CommandBuffer);
const eventBus = ServiceLocator.require(EventBus);
```

**优点：**
- ✅ 实现简单，易于理解
- ✅ 类型安全（通过泛型）
- ✅ 与现有代码兼容（可以逐步迁移）
- ✅ 支持依赖注入和服务定位器混合模式
- ✅ 易于测试（可以注册 mock 服务）

**缺点：**
- ⚠️ 仍然需要手动注册服务
- ⚠️ 编译时无法保证所有服务都已注册

---

### 选项 2：强类型服务定位器（使用字符串键或 Symbol 键）

**设计思路：**
- 使用字符串键或 Symbol 键作为服务标识符
- 提供类型定义文件，定义所有服务的类型

**结构：**
```typescript
// 服务类型定义
export const ServiceKeys = {
    World: Symbol('World'),
    CommandBuffer: Symbol('CommandBuffer'),
    EventBus: Symbol('EventBus'),
    ResourceManager: Symbol('ResourceManager'),
    // ...
} as const;

export class ServiceLocator {
    private static services: Map<Symbol, any> = new Map();

    static register<T>(key: Symbol, instance: T): void {
        this.services.set(key, instance);
    }

    static get<T>(key: Symbol): T | null {
        return this.services.get(key) || null;
    }
}
```

**优点：**
- ✅ 类型安全
- ✅ 编译时检查

**缺点：**
- ❌ 使用 Symbol 键需要额外的类型定义
- ❌ 代码复杂度增加
- ❌ 不如泛型方式直观

**评估：** ❌ 不推荐
- 使用泛型更直观、类型更安全

---

### 选项 3：完全依赖注入容器（Dependency Injection Container）

**设计思路：**
- 创建完整的依赖注入容器
- 支持构造函数注入、属性注入
- 自动解析依赖关系

**结构：**
```typescript
export class DIContainer {
    private services: Map<string, any> = new Map();
    private factories: Map<string, Function> = new Map();

    register<T>(token: string, factory: () => T): void {
        this.factories.set(token, factory);
    }

    resolve<T>(token: string): T {
        // 自动解析依赖...
    }
}
```

**优点：**
- ✅ 强大的依赖注入能力
- ✅ 自动解析依赖

**缺点：**
- ❌ 实现复杂
- ❌ 对于当前项目来说过度设计
- ❌ 运行时依赖解析，性能开销大
- ❌ 与现有架构不匹配

**评估：** ❌ 不推荐
- 过度设计，不符合当前项目需求

---

### 选项 4：保持现状（不实现服务定位器）

**设计思路：**
- 继续使用单例模式 + 手动依赖注入
- 只在需要的地方使用单例（ResourceManager、UIManager 等）
- GameApp 继续管理核心服务的创建和注入

**优点：**
- ✅ 不需要额外代码
- ✅ 保持现有架构不变

**缺点：**
- ❌ 服务访问方式不统一
- ❌ 依赖管理复杂
- ❌ 测试困难（单例难以替换）

**评估：** ⚠️ 可选
- 如果项目已经稳定，可以保持现状
- 但如果有计划扩展或重构，建议实现服务定位器

---

## 推荐方案：选项 1（轻量级服务注册表）

### 理由

1. **最小改动：** 实现简单，不影响现有架构
2. **逐步迁移：** 可以逐步将服务迁移到 ServiceLocator，不需要一次性重构
3. **类型安全：** 使用泛型保证类型安全
4. **易于测试：** 可以注册 mock 服务进行测试
5. **兼容性好：** 与现有单例模式兼容，可以共存

### 实现细节

#### 1. ServiceLocator 类结构

```typescript
// app/ServiceLocator.ts
/**
 * 服务定位器
 * 
 * 提供全局服务的注册和访问
 * 支持类型安全的服务访问
 * 
 * 使用示例：
 * // 注册服务
 * ServiceLocator.register(World, this.world);
 * 
 * // 获取服务
 * const world = ServiceLocator.require(World);
 */
export class ServiceLocator {
    private static services: Map<Function, any> = new Map();

    /**
     * 注册服务
     * @param serviceClass 服务类（构造函数）
     * @param instance 服务实例
     */
    static register<T>(serviceClass: new (...args: any[]) => T, instance: T): void {
        if (this.services.has(serviceClass)) {
            console.warn(`[ServiceLocator] Service ${serviceClass.name} is already registered, replacing...`);
        }
        this.services.set(serviceClass, instance);
    }

    /**
     * 获取服务（可选，不存在返回 null）
     * @param serviceClass 服务类（构造函数）
     * @returns 服务实例，如果未注册返回 null
     */
    static get<T>(serviceClass: new (...args: any[]) => T): T | null {
        return this.services.get(serviceClass) || null;
    }

    /**
     * 获取服务（必需，不存在时抛出错误）
     * @param serviceClass 服务类（构造函数）
     * @returns 服务实例
     * @throws Error 如果服务未注册
     */
    static require<T>(serviceClass: new (...args: any[]) => T): T {
        const service = this.services.get(serviceClass);
        if (!service) {
            throw new Error(`[ServiceLocator] Service ${serviceClass.name} is not registered`);
        }
        return service;
    }

    /**
     * 检查服务是否已注册
     * @param serviceClass 服务类（构造函数）
     * @returns 是否已注册
     */
    static has<T>(serviceClass: new (...args: any[]) => T): boolean {
        return this.services.has(serviceClass);
    }

    /**
     * 取消注册服务
     * @param serviceClass 服务类（构造函数）
     */
    static unregister<T>(serviceClass: new (...args: any[]) => T): void {
        this.services.delete(serviceClass);
    }

    /**
     * 清空所有服务（用于测试或清理）
     */
    static clear(): void {
        this.services.clear();
    }
}
```

#### 2. 在 GameApp 中注册服务

```typescript
// app/GameApp.ts
import { ServiceLocator } from './ServiceLocator';

export class GameApp extends Component {
    async onLoad() {
        // ... 初始化代码 ...

        // 注册服务到 ServiceLocator
        ServiceLocator.register(World, this.world);
        ServiceLocator.register(CommandBuffer, this.commandBuffer);
        ServiceLocator.register(EventBus, this.eventBus);
        ServiceLocator.register(ResourceManager, this.resourceManager);
        ServiceLocator.register(ResourcePreloader, this.resourcePreloader);
        ServiceLocator.register(ConfigLoader, this.configLoader);
        ServiceLocator.register(ViewManager, this.viewManager);
        ServiceLocator.register(AnimDriver, this.animDriver);
        ServiceLocator.register(FxDriver, this.fxDriver);
        ServiceLocator.register(AudioDriver, this.audioDriver);
        ServiceLocator.register(UIManager, this.uiManager);
        ServiceLocator.register(SceneFlow, this.sceneFlow);
        // 注意：Scheduler 和 SaveSystem 通常不需要全局访问，可以不注册
    }

    onDestroy() {
        // 清理服务（可选，根据需求决定）
        // ServiceLocator.clear();
    }
}
```

#### 3. 在 Systems 中使用服务定位器

```typescript
// gameplay/systems/SomeSystem.ts
import { ServiceLocator } from '../../app/ServiceLocator';
import { CommandBuffer } from '../../bridge/CommandBuffer';
import { EventBus } from '../../bridge/EventBus';

@system({ priority: 0 })
export class SomeSystem extends System {
    private commandBuffer?: CommandBuffer;
    private eventBus?: EventBus;

    onInit(): void {
        // 使用 ServiceLocator 获取服务
        this.commandBuffer = ServiceLocator.get(CommandBuffer);
        this.eventBus = ServiceLocator.require(EventBus); // 必需的服务使用 require
    }
}
```

#### 4. 与现有单例模式兼容

```typescript
// 现有代码可以继续使用单例模式
const resourceManager = ResourceManager.getInstance();

// 也可以选择在 ServiceLocator 中注册
ServiceLocator.register(ResourceManager, ResourceManager.getInstance());

// 然后使用 ServiceLocator 访问
const resourceManager = ServiceLocator.get(ResourceManager);
```

### 实施指南

#### 阶段 1：创建 ServiceLocator 类

1. 创建 `app/ServiceLocator.ts`
2. 实现基本的注册和获取方法
3. 添加类型安全支持

#### 阶段 2：在 GameApp 中注册核心服务

1. 在 `GameApp.onLoad()` 中注册核心服务
2. 保持现有的依赖注入方式（兼容）
3. 逐步迁移服务访问到 ServiceLocator

#### 阶段 3：更新 Systems 使用 ServiceLocator（可选）

1. 可以选择性地更新 Systems 使用 ServiceLocator
2. 保持现有的 `setXxx()` 方法（向后兼容）
3. 优先迁移经常访问的服务

#### 阶段 4：测试和验证

1. 编写单元测试
2. 验证服务注册和获取
3. 验证类型安全

### 注意事项

1. **服务生命周期：**
   - 服务应该在 GameApp.onLoad() 时注册
   - 服务可以在 onDestroy() 时取消注册（可选）
   - 不建议在运行时频繁注册/取消注册

2. **类型安全：**
   - 使用泛型保证类型安全
   - 使用 `require()` 方法获取必需的服务（会在未注册时抛出错误）
   - 使用 `get()` 方法获取可选的服务（未注册时返回 null）

3. **向后兼容：**
   - 保持现有的依赖注入方式（`setXxx()` 方法）
   - 不强制所有代码都使用 ServiceLocator
   - 可以逐步迁移

4. **测试支持：**
   - 在测试中可以使用 `ServiceLocator.register()` 注册 mock 服务
   - 测试结束后使用 `ServiceLocator.clear()` 清理

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 总结

**推荐方案：** 轻量级服务注册表（ServiceLocator）

**核心设计：**
- 简单的服务注册和获取机制
- 类型安全的泛型支持
- 与现有单例模式和依赖注入兼容
- 可以逐步迁移，不需要一次性重构

**实施步骤：**
1. 创建 ServiceLocator 类
2. 在 GameApp 中注册核心服务
3. （可选）更新 Systems 使用 ServiceLocator
4. 测试和验证

**关键约束：**
- 保持向后兼容（现有的 `setXxx()` 方法）
- 服务注册时机：GameApp.onLoad()
- 类型安全：使用泛型和 `require()` 方法
