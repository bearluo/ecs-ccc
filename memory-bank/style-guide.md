# 开发规范文档

## 目录

1. [架构约束规则](#架构约束规则)
2. [编码规范](#编码规范)
3. [组件开发规范](#组件开发规范)
4. [系统开发规范](#系统开发规范)
5. [命名规范](#命名规范)
6. [文件组织规范](#文件组织规范)
7. [代码审查检查清单](#代码审查检查清单)

---

## 架构约束规则

### 规则 1：AnimState 的唯一写入路径

**硬规则：** AnimState 组件只能由 AnimationIntentSystem 修改

#### ❌ 禁止做法

```typescript
// ❌ 错误：MoveSystem 直接修改 AnimState
@system({ priority: 0 })
class MoveSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [TransformComponent, VelocityComponent]
        });
        query.forEach(entity => {
            // ❌ 禁止直接修改 AnimState
            const animState = entity.getComponent(AnimStateComponent);
            if (animState) {
                animState.current = 'run'; // ❌ 违反规则
            }
        });
    }
}
```

#### ✅ 正确做法

```typescript
// ✅ 正确：MoveSystem 写入 AnimationIntent
@system({ priority: 0 })
class MoveSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [TransformComponent, VelocityComponent]
        });
        query.forEach(entity => {
            // ✅ 写入意图组件
            const intent = entity.getOrCreateComponent(AnimationIntentComponent);
            intent.wantMove = true;
        });
    }
}

// ✅ 正确：AnimationIntentSystem 读取意图并更新 AnimState
@system({ priority: 100 })
class AnimationIntentSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [AnimationIntentComponent]
        });
        query.forEach(entity => {
            const intent = entity.getComponent(AnimationIntentComponent)!;
            const animState = entity.getOrCreateComponent(AnimStateComponent);
            
            // ✅ 唯一允许修改 AnimState 的地方
            if (intent.wantMove) {
                animState.current = 'run';
            }
        });
    }
}
```

**实施要求：**
- 在 `AnimState.ts` 文件头部必须添加约束注释
- 代码审查时必须检查是否有违反此规则

---

### 规则 2：RenderSyncSystem 是唯一出口

**硬规则：** 所有 ECS → View 的行为，必须通过 RenderSyncSystem 产出 RenderCommand

#### ❌ 禁止做法

```typescript
// ❌ 错误：SkillSystem 直接操作 ViewManager
@system({ priority: 1 })
class SkillSystem extends System {
    private viewManager: ViewManager; // ❌ 禁止直接依赖 ViewManager
    
    onUpdate(dt: number): void {
        // ❌ 禁止直接操作 View 层
        this.viewManager.playFx('explosion', x, y);
    }
}

// ❌ 错误：CombatSystem 直接操作 ViewManager
@system({ priority: 1 })
class CombatSystem extends System {
    onUpdate(dt: number): void {
        // ❌ 禁止直接操作 View 层
        ViewManager.instance.playAnim(entityId, 'hit');
    }
}
```

#### ✅ 正确做法

```typescript
// ✅ 正确：SkillSystem 只修改组件数据
@system({ priority: 1 })
class SkillSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillComponent]
        });
        query.forEach(entity => {
            const skill = entity.getComponent(SkillComponent)!;
            // ✅ 只修改组件数据
            skill.isCasting = true;
            skill.castTime = 0;
        });
    }
}

// ✅ 正确：RenderSyncSystem 读取组件并产出命令
@system({ priority: 100 })
class RenderSyncSystem extends System {
    private commandBuffer: CommandBuffer;
    
    onUpdate(dt: number): void {
        // Transform → SetPosition
        const transformQuery = this.world.createQuery({
            all: [TransformComponent, ViewLinkComponent]
        });
        transformQuery.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            this.commandBuffer.push({
                type: 'SetPosition',
                entityId: entity.id,
                x: transform.x,
                y: transform.y
            });
        });
        
        // AnimState → PlayAnim
        const animQuery = this.world.createQuery({
            all: [AnimStateComponent, ViewLinkComponent]
        });
        animQuery.forEach(entity => {
            const animState = entity.getComponent(AnimStateComponent)!;
            this.commandBuffer.push({
                type: 'PlayAnim',
                entityId: entity.id,
                animName: animState.current
            });
        });
    }
}
```

**实施要求：**
- 在 `RenderSyncSystem.ts` 文件头部必须添加约束注释
- 所有 Fixed Systems 禁止直接依赖 ViewManager、AnimDriver 等 View 层类
- 代码审查时必须检查是否有违反此规则

---

### 规则 3：阶段 1 禁止事项

**硬规则：** 阶段 1 只做核心链路，不做复杂功能

#### ❌ 阶段 1 禁止实现

- ❌ SoA / Chunk / Archetype 数据布局优化
- ❌ Buff / Skill / Stats 复杂系统
- ❌ UI 系统
- ❌ 配置系统（JSON/TS 配置加载）
- ❌ 对象池泛化（只做 ViewPool）

#### ✅ 阶段 1 允许实现

- ✅ 6 个核心组件（Transform、Velocity、HP、AnimState、ViewLink、DeadTag）
- ✅ 4 个核心系统（MoveSystem、CombatSystem、DeathSystem、RenderSyncSystem）
- ✅ 桥接层（CommandBuffer、EventBus、Scheduler）
- ✅ 基础表现层（ViewManager、AnimDriver）
- ✅ ViewPool（仅用于 View 对象复用）

**原因：** 阶段 1 的目标是"链路闭环"，先让核心流程跑通，再优化和扩展。

---

## 编码规范

### TypeScript 规范

#### 1. 类型安全

```typescript
// ✅ 正确：使用类型注解
const entity: Entity = world.createEntity('Player');
const position: TransformComponent = entity.getComponent(TransformComponent)!;

// ❌ 错误：使用 any
const entity: any = world.createEntity('Player');
```

#### 2. 空值检查

```typescript
// ✅ 正确：使用可选链和空值合并
const component = entity.getComponent(ComponentType);
if (component) {
    component.value = 10;
}

// ✅ 正确：使用 getOrCreateComponent
const component = entity.getOrCreateComponent(ComponentType);
component.value = 10;

// ❌ 错误：直接使用可能为 undefined 的值
const component = entity.getComponent(ComponentType);
component.value = 10; // ❌ 可能报错
```

#### 3. 装饰器使用

```typescript
// ✅ 正确：使用 @component 装饰器
@component({ name: 'Transform', pooled: true })
class TransformComponent extends Component {
    x: number = 0;
    y: number = 0;
}

// ✅ 正确：使用 @system 装饰器
@system({ priority: 0 })
class MoveSystem extends System {
    onUpdate(dt: number): void {
        // ...
    }
}
```

---

## 组件开发规范

### 组件定义模板

```typescript
/**
 * 组件名称
 * 
 * 组件描述：说明组件的用途
 * 
 * ⚠️ 架构约束（如适用）：
 * - AnimState 只能由 AnimationIntentSystem 修改
 * - ViewLink 只存 viewId，不存 Node 引用
 */
@component({ 
    name: 'ComponentName',  // 组件名称（必填）
    pooled: true,           // 是否使用对象池（可选，默认 false）
    poolSize: 100           // 对象池大小（可选，默认 100）
})
class ComponentNameComponent extends Component {
    // 属性定义
    property1: number = 0;
    property2: string = '';
    
    // 可选：组件初始化
    onInit?(): void {
        // 初始化逻辑
    }
    
    // 可选：组件销毁
    onDestroy?(): void {
        // 清理逻辑
    }
    
    // 可选：重置（对象池使用）
    reset(): void {
        super.reset();
        this.property1 = 0;
        this.property2 = '';
    }
}
```

### 组件分类

#### 1. 数据组件（Data Component）
- 包含游戏数据
- 可序列化
- 示例：Transform、Velocity、HP

#### 2. 标记组件（Tag Component）
- 只用于标记，无数据
- 示例：DeadTag、DestroyTimer

```typescript
@component({ name: 'DeadTag' })
class DeadTagComponent extends Component {
    // 标记组件，无数据
}
```

#### 3. 链接组件（Link Component）
- 链接到外部资源
- 只存 ID，不存引用
- 示例：ViewLink（viewId）

```typescript
@component({ name: 'ViewLink', pooled: true })
class ViewLinkComponent extends Component {
    viewId: number = 0;      // ✅ 只存 ID
    prefabKey: string = '';  // ✅ 只存资源键
    
    // ❌ 禁止：不存 Node 引用
    // node: Node; // ❌ 违反规则
}
```

---

## 系统开发规范

### 系统定义模板

```typescript
/**
 * 系统名称
 * 
 * 系统描述：说明系统的职责
 * 
 * ⚠️ 架构约束（如适用）：
 * - RenderSyncSystem 是 ECS → View 的唯一出口
 * - Fixed Systems 不能直接修改 AnimState
 */
@system({ 
    priority: 0  // 优先级（必填，数值越小越先执行）
})
class SystemNameSystem extends System {
    // 可选：系统初始化
    onInit?(): void {
        // 初始化逻辑
    }
    
    // 系统更新（必填）
    onUpdate(dt: number): void {
        // 查询实体
        const query = this.world.createQuery({
            all: [ComponentA, ComponentB],
            any: [ComponentC],
            none: [ComponentD]
        });
        
        // 处理实体
        query.forEach(entity => {
            const componentA = entity.getComponent(ComponentA)!;
            const componentB = entity.getComponent(ComponentB)!;
            
            // 系统逻辑
        });
    }
    
    // 可选：系统销毁
    onDestroy?(): void {
        // 清理逻辑
    }
}
```

### 系统分类

#### 1. Fixed Systems（固定步长系统）
- Priority: 0-99
- 在 `stepFixed()` 中执行
- 影响玩法一致性
- 禁止直接操作 View 层
- 示例：MoveSystem、CombatSystem、SkillSystem

```typescript
@system({ priority: 0 })
class MoveSystem extends System {
    onUpdate(dt: number): void {
        // ✅ 只修改组件数据
        // ❌ 禁止直接操作 ViewManager
    }
}
```

#### 2. Render Systems（渲染系统）
- Priority: 100+
- 在 `stepRender()` 中执行
- 只生成表现命令
- 示例：RenderSyncSystem、AnimationIntentSystem

```typescript
@system({ priority: 100 })
class RenderSyncSystem extends System {
    private commandBuffer: CommandBuffer;
    
    onUpdate(dt: number): void {
        // ✅ 读取组件并产出命令
        this.commandBuffer.push({
            type: 'SetPosition',
            entityId: entity.id,
            x: transform.x,
            y: transform.y
        });
    }
}
```

### 查询使用规范

```typescript
// ✅ 正确：使用 createQuery 创建查询
const query = this.world.createQuery({
    all: [TransformComponent, VelocityComponent],
    any: [HealthComponent],
    none: [DeadTagComponent]
});

// ✅ 正确：遍历查询结果
query.forEach(entity => {
    const transform = entity.getComponent(TransformComponent)!;
    // 处理逻辑
});

// ✅ 正确：获取实体列表
const entities = query.getEntities();

// ✅ 正确：获取数量
const count = query.getCount();
```

---

## 命名规范

### 文件命名

- **组件文件：** `ComponentName.ts`（PascalCase）
  - 示例：`Transform.ts`、`Velocity.ts`、`HP.ts`
- **系统文件：** `SystemNameSystem.ts`（PascalCase + System 后缀）
  - 示例：`MoveSystem.ts`、`CombatSystem.ts`、`RenderSyncSystem.ts`
- **桥接层文件：** `ClassName.ts`（PascalCase）
  - 示例：`CommandBuffer.ts`、`EventBus.ts`、`Scheduler.ts`
- **表现层文件：** `ClassName.ts`（PascalCase）
  - 示例：`ViewManager.ts`、`AnimDriver.ts`

### 类命名

- **组件类：** `ComponentNameComponent`（PascalCase + Component 后缀）
  - 示例：`TransformComponent`、`VelocityComponent`
- **系统类：** `SystemNameSystem`（PascalCase + System 后缀）
  - 示例：`MoveSystem`、`CombatSystem`
- **其他类：** `ClassName`（PascalCase）
  - 示例：`CommandBuffer`、`EventBus`、`ViewManager`

### 变量命名

- **普通变量：** `camelCase`
  - 示例：`entity`、`component`、`transform`
- **常量：** `UPPER_SNAKE_CASE`
  - 示例：`MAX_ENTITIES`、`FIXED_DELTA_TIME`
- **私有属性：** `private _camelCase`（可选下划线前缀）
  - 示例：`private _commandBuffer`、`private _enabled`

### 方法命名

- **普通方法：** `camelCase`
  - 示例：`onUpdate()`、`getComponent()`、`addComponent()`
- **生命周期方法：** `onXxx()`（on 前缀）
  - 示例：`onInit()`、`onUpdate()`、`onDestroy()`

---

## 文件组织规范

### 目录结构

```
assets/scripts/
  app/                    # 应用入口
    GameApp.ts
    SceneFlow.ts
  bridge/                 # 桥接层
    CommandBuffer.ts
    EventBus.ts
    Scheduler.ts
  gameplay/               # 游戏逻辑
    components/           # 组件
      Transform.ts
      Velocity.ts
      HP.ts
      AnimState.ts
      ViewLink.ts
      DeadTag.ts
    systems/              # 系统
      MoveSystem.ts
      CombatSystem.ts
      DeathSystem.ts
      RenderSyncSystem.ts
  presentation/           # 表现层
    ViewManager.ts
    ViewPool.ts
    AnimDriver.ts
    FxDriver.ts
    AudioDriver.ts
  data/                   # 数据配置
    configs/
      monster.json
      skill.json
```

### 导入规范

```typescript
// ✅ 正确：按模块分组导入
// 1. 外部库
import { World, Component, System } from '@bl-framework/ecs';

// 2. 桥接层
import { CommandBuffer } from '../bridge/CommandBuffer';
import { EventBus } from '../bridge/EventBus';

// 3. 组件
import { TransformComponent } from '../components/Transform';
import { VelocityComponent } from '../components/Velocity';

// 4. 系统
import { MoveSystem } from '../systems/MoveSystem';

// 5. 表现层
import { ViewManager } from '../../presentation/ViewManager';
```

---

## 代码审查检查清单

### 架构约束检查

- [ ] **AnimState 写入检查**
  - [ ] 是否有 Fixed System 直接修改 AnimState？
  - [ ] 是否只有 AnimationIntentSystem 修改 AnimState？
  - [ ] AnimState.ts 文件头部是否有约束注释？

- [ ] **RenderSyncSystem 出口检查**
  - [ ] 是否有系统直接操作 ViewManager？
  - [ ] 是否所有 ECS → View 行为都通过 RenderSyncSystem？
  - [ ] RenderSyncSystem.ts 文件头部是否有约束注释？

- [ ] **阶段 1 禁止事项检查**
  - [ ] 是否实现了 SoA/Chunk/Archetype？
  - [ ] 是否实现了 Buff/Skill/Stats？
  - [ ] 是否实现了 UI 系统？
  - [ ] 是否实现了配置系统？
  - [ ] 是否实现了对象池泛化？

### 代码质量检查

- [ ] **类型安全**
  - [ ] 是否使用了 any 类型？
  - [ ] 是否进行了空值检查？
  - [ ] 是否使用了可选链和空值合并？

- [ ] **装饰器使用**
  - [ ] 组件是否使用了 @component 装饰器？
  - [ ] 系统是否使用了 @system 装饰器？
  - [ ] 装饰器配置是否正确？

- [ ] **命名规范**
  - [ ] 文件命名是否符合规范？
  - [ ] 类命名是否符合规范？
  - [ ] 变量命名是否符合规范？

- [ ] **文件组织**
  - [ ] 文件是否放在正确的目录？
  - [ ] 导入语句是否按模块分组？

### 性能检查

- [ ] **查询优化**
  - [ ] 是否重复创建相同的查询？
  - [ ] 是否使用了查询缓存？

- [ ] **对象池**
  - [ ] 组件是否启用了对象池（如适用）？
  - [ ] View 对象是否使用了 ViewPool？

---

## 示例代码

### 完整的组件示例

```typescript
/**
 * 位置组件
 * 
 * 存储实体的位置和旋转信息
 */
@component({ name: 'Transform', pooled: true, poolSize: 100 })
class TransformComponent extends Component {
    x: number = 0;
    y: number = 0;
    rot: number = 0;
    
    reset(): void {
        super.reset();
        this.x = 0;
        this.y = 0;
        this.rot = 0;
    }
}
```

### 完整的系统示例

```typescript
/**
 * 移动系统
 * 
 * 根据速度更新位置
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 */
@system({ priority: 0 })
class MoveSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [TransformComponent, VelocityComponent]
        });
        
        query.forEach(entity => {
            const transform = entity.getComponent(TransformComponent)!;
            const velocity = entity.getComponent(VelocityComponent)!;
            
            // 更新位置
            transform.x += velocity.vx * dt;
            transform.y += velocity.vy * dt;
        });
    }
}
```

---

## 总结

遵循这些开发规范可以确保：
1. **架构清晰：** 逻辑层和表现层清晰分离
2. **代码质量：** 类型安全、易于维护
3. **性能优化：** 合理使用对象池和查询缓存
4. **长期维护：** 3 个月后架构仍然干净

**记住：** 这些规则不是建议，而是硬约束。违反这些规则会导致架构混乱，难以维护。

