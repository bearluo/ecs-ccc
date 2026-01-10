# 系统模式

## 架构模式

### 分层架构
```
Game App (应用层)
  ↓
ECS (逻辑层)
  ↓ (Command/Event)
Presentation (表现层)
```

### 数据流

#### ECS → View（命令流）
```
System → CommandBuffer → ViewManager → Node/Anim/FX
```

#### View → ECS（事件流）
```
Node/Anim/UI → EventBus → System
```

## 设计模式

### 1. 命令模式（Command Pattern）
- **用途：** ECS 系统向 View 层发送指令
- **实现：** CommandBuffer
- **命令类型：**
  - SpawnView
  - SetPosition
  - PlayAnim
  - PlayFx
  - DestroyView

### 2. 观察者模式（Observer Pattern）
- **用途：** View 层事件回传 ECS
- **实现：** EventBus
- **事件类型：**
  - AnimationEvent
  - CollisionEvent
  - UIEvent

### 3. 对象池模式（Object Pool Pattern）
- **用途：** Entity、Component、View 对象复用
- **实现：** ViewPool、EntityPool

### 4. 查询模式（Query Pattern）
- **用途：** 系统查询匹配的 Entity
- **实现：** Query（All/Any/None）

### 5. 系统模式（System Pattern）
- **用途：** 逻辑处理单元
- **分类：**
  - Fixed Systems：玩法逻辑
  - Render Systems：表现逻辑

## 组件模式

### 纯数据组件（Pure Data Component）
- 只包含数据，不包含逻辑
- 可序列化
- 无依赖 Creator API

### 标记组件（Tag Component）
- 只用于标记，无数据
- 如：DeadTag、DestroyTimer

### 链接组件（Link Component）
- 链接到外部资源
- 只存 ID，不存引用
- 如：ViewLink（viewId）

## 系统模式

### Fixed System（固定步长系统）
- 在 fixedUpdate 中执行
- 影响玩法一致性
- 示例：MoveSystem、CombatSystem
- **约束：** 不能直接修改 AnimState，不能直接操作 View 层

### Render System（渲染系统）
- 在 render 步骤中执行
- 只生成表现命令
- 示例：RenderSyncSystem、AnimationIntentSystem
- **约束：** RenderSyncSystem 是 ECS → View 的唯一出口

## 架构约束规则

### 约束 1：AnimState 的唯一写入路径

**规则：**
- ❌ Fixed Systems（MoveSystem、CombatSystem、SkillSystem 等）禁止直接修改 AnimState
- ✅ Fixed Systems 只能写入 AnimationIntent 或 Tag 组件
- ✅ 只有 AnimationIntentSystem（Render System）能修改 AnimState

**数据流：**
```
Fixed System → AnimationIntent/Tag → AnimationIntentSystem → AnimState
```

**原因：** 保证逻辑层（Fixed）和表现层（Render）的清晰分离

### 约束 2：RenderSyncSystem 是唯一出口

**规则：**
- ✅ 所有 ECS → View 的行为，必须通过 RenderSyncSystem 产出 RenderCommand
- ❌ 禁止任何系统直接操作 ViewManager
- ❌ 禁止 SkillSystem 直接 play FX
- ❌ 禁止 CombatSystem 直接操作 ViewManager

**数据流：**
```
Fixed System → 修改组件数据 → RenderSyncSystem → CommandBuffer → ViewManager
```

**原因：** 保证架构长期干净，避免系统间直接耦合

## 数据布局模式

### SoA（Structure of Arrays）
- 组件数据按类型分组存储
- 提高缓存局部性
- 适合批量处理

### AoS（Array of Structures）
- 传统对象数组
- 简单但性能较差
- 用于原型阶段

## 生命周期模式

### Entity 生命周期
```
Create → Add Components → Systems Process → Remove Components → Destroy
```

### View 生命周期
```
Spawn → Bind to Entity → Update → Unbind → Destroy/Recycle
```

### 同步点
- Entity 创建 → SpawnView 命令
- Entity 销毁 → DestroyView 命令
- Component 变更 → 相应命令生成

