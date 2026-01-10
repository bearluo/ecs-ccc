# 技术上下文

## 技术栈详情

### Cocos Creator 3.8.7
- **版本:** 3.8.7
- **类型:** 2D 游戏引擎
- **语言:** TypeScript
- **模块:** 2D、UI、动画、物理（2D Box2D）

### ECS 框架：@bl-framework/ecs
- **版本:** 1.0.0
- **类型:** Entity-Component-System 框架
- **核心类:**
  - `World` - ECS 世界管理
  - `Entity` - 实体类
  - `Component` - 组件基类
  - `System` - 系统基类
  - `Query` - 查询系统
- **装饰器:**
  - `@component({ name, pooled, poolSize })` - 组件装饰器
  - `@system({ priority })` - 系统装饰器
- **特性:**
  - 查询缓存
  - 对象池支持
  - 系统优先级管理
  - BitSet 位运算优化

### TypeScript 配置
- 严格模式：关闭（`strict: false`）
- 继承 Cocos Creator 基础配置

## 技术约束

1. **引擎限制**
   - 必须与 Cocos Creator 的组件系统兼容
   - 需要处理 Node 的生命周期
   - 需要考虑场景加载/卸载

2. **ECS 框架限制**
   - World.update(dt) 是单一更新方法
   - 需要扩展为 Fixed Step + Render Step
   - 需要添加 CommandBuffer 和 EventBus

3. **性能要求**
   - 支持大量 Entity（1000+）
   - 系统执行效率
   - 内存使用优化

4. **开发体验**
   - TypeScript 类型安全
   - 易于调试
   - 清晰的 API

## 框架 API 参考

### World API
```typescript
// 创建实体
const entity = world.createEntity('Player');

// 添加组件
const component = world.addComponent(entityId, ComponentType);

// 获取组件
const component = world.getComponent(entityId, ComponentType);

// 创建查询
const query = world.createQuery({
    all: [ComponentA, ComponentB],
    any: [ComponentC],
    none: [ComponentD]
});

// 注册系统
world.registerSystem(SystemType);

// 更新世界
world.update(dt);
```

### Entity API
```typescript
// 获取组件
const component = entity.getComponent(ComponentType);

// 添加组件
const component = entity.addComponent(ComponentType);

// 获取或创建组件
const component = entity.getOrCreateComponent(ComponentType);
```

### Query API
```typescript
// 获取实体列表
const entities = query.getEntities();

// 遍历实体
query.forEach(entity => {
    // ...
});

// 获取数量
const count = query.getCount();
```

### System API
```typescript
@system({ priority: 0 })
class MySystem extends System {
    onInit?(): void;
    onUpdate?(dt: number): void;
    onDestroy?(): void;
    onEnable?(): void;
    onDisable?(): void;
}
```

## 需要扩展的部分

### 1. CommandBuffer（ECS → View）
```typescript
class CommandBuffer {
    push(command: RenderCommand): void;
    flush(): RenderCommand[];
    clear(): void;
}

type RenderCommand = 
    | { type: 'SpawnView', entityId: number, prefabKey: string }
    | { type: 'SetPosition', entityId: number, x: number, y: number }
    | { type: 'PlayAnim', entityId: number, animName: string }
    | { type: 'DestroyView', entityId: number };
```

### 2. EventBus（View → ECS）
```typescript
class EventBus {
    push(event: GameplayEvent): void;
    subscribe(type: string, handler: Function): void;
    flush(): void;
}

type GameplayEvent = 
    | { type: 'AnimationEvent', entityId: number, eventName: string }
    | { type: 'CollisionEvent', entityA: number, entityB: number }
    | { type: 'UIEvent', eventName: string, data?: any };
```

### 3. Scheduler（Fixed/Render 分离）
```typescript
class Scheduler {
    constructor(
        world: World,
        commandBuffer: CommandBuffer,
        eventBus: EventBus
    );
    
    stepFixed(dt: number): void;  // 执行 Fixed Systems
    stepRender(dt: number): void;  // 执行 Render Systems
    flushCommandsToPresentation(): void;
}
```

## 参考资源

- Cocos Creator 官方文档
- @bl-framework/ecs README
- ECS 架构模式最佳实践
- 其他游戏引擎的 ECS 实现（如 Unity ECS、EnTT）
