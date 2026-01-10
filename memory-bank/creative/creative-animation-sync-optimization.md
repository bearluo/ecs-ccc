# 动画同步优化设计

**状态：** ✅ 设计完成

## 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE

## 问题描述

当前动画同步存在性能问题：
1. **当前问题：** `RenderSyncSystem` 每帧都会发送 `PlayAnim` 命令，即使动画状态没有改变
2. **问题影响：** 
   - 每帧都调用 `AnimDriver.playAnim()`，导致动画重复播放
   - 即使 `animState.current` 保持不变（如持续 'idle' 状态），也会重复发送命令
   - 浪费性能，可能导致动画播放不流畅

3. **需求：** 只在动画状态改变时才发送 `PlayAnim` 命令，避免重复播放相同动画

## 架构约束

1. **ECS → View：** 只能通过 CommandBuffer（RenderSyncSystem 是唯一出口）
2. **状态同步：** AnimState.current 的变化应该触发动画播放
3. **职责分离：** RenderSyncSystem 负责命令生成，AnimDriver 负责动画播放
4. **数据流：**
   ```
   AnimationIntentSystem → AnimState.current 改变
     ↓
   RenderSyncSystem → 检测改变 → 发送 PlayAnim 命令
     ↓
   ViewManager → 调用 AnimDriver.playAnim()
   ```

## 设计选项

### 选项 1：在 AnimStateComponent 中添加 lastSentAnim 字段 ⭐ 推荐

**策略：**
- 在 `AnimStateComponent` 中添加 `lastSentAnim: string` 字段，记录上一次发送的动画名称
- `RenderSyncSystem` 只在 `animState.current !== animState.lastSentAnim` 时发送命令
- 发送后更新 `lastSentAnim = current`

**实现：**
```typescript
// AnimStateComponent.ts
export class AnimStateComponent extends Component {
    current: string = 'idle';
    locked: boolean = false;
    speed: number = 1.0;
    lastSentAnim: string = ''; // 新增：记录上一次发送的动画名称
}

// RenderSyncSystem.ts
animQuery.forEach(entity => {
    const animState = entity.getComponent(AnimStateComponent)!;
    const viewLink = entity.getComponent(ViewLinkComponent)!;

    if (viewLink.viewId > 0) {
        // 只在动画改变时发送命令
        if (animState.current !== animState.lastSentAnim) {
            this.commandBuffer.push({
                type: 'PlayAnim',
                handle: entity.handle,
                animName: animState.current
            });
            animState.lastSentAnim = animState.current; // 更新记录
        }
    }
});
```

**优点：**
- ✅ 简单直接，逻辑清晰
- ✅ 在组件层面跟踪状态，符合 ECS 设计
- ✅ 不需要额外的数据结构或系统间通信
- ✅ 性能优化明显：只在状态改变时发送命令

**缺点：**
- ⚠️ 需要在 `AnimStateComponent` 中添加字段（但这是合理的，属于状态跟踪）
- ⚠️ 需要确保 `lastSentAnim` 在适当的时候重置（如实体销毁、视图重新创建）

---

### 选项 2：在 AnimDriver 中检查当前播放状态

**策略：**
- `AnimDriver` 维护 `animInfoMap`，记录每个 Node 当前播放的动画
- `AnimDriver.playAnim()` 中检查动画是否已经在播放，如果是则跳过

**实现：**
```typescript
// AnimDriver.ts
playAnim(node: Node, animName: string, speed: number = 1.0, loop: boolean = false): void {
    // 检查是否已经在播放相同动画
    const currentInfo = this.animInfoMap.get(node);
    if (currentInfo && currentInfo.currentAnim === animName && currentInfo.isPlaying) {
        return; // 已经在播放，跳过
    
    // ... 播放动画逻辑
}
```

**优点：**
- ✅ 在 View 层处理，不污染 ECS 组件
- ✅ 防御性编程，即使命令重复发送也不会重复播放

**缺点：**
- ❌ 仍然会每帧发送命令（浪费 CommandBuffer 空间）
- ❌ 命令处理仍然会执行（虽然会提前返回）
- ❌ 没有从源头解决问题（应该在 RenderSyncSystem 层面避免发送）

---

### 选项 3：使用脏标记机制（Dirty Flag）

**策略：**
- 在 `AnimStateComponent` 中添加 `dirty: boolean` 字段
- `AnimationIntentSystem` 更新 `animState.current` 时，设置 `dirty = true`
- `RenderSyncSystem` 只处理 `dirty === true` 的实体，处理后设置 `dirty = false`

**实现：**
```typescript
// AnimStateComponent.ts
export class AnimStateComponent extends Component {
    current: string = 'idle';
    locked: boolean = false;
    speed: number = 1.0;
    dirty: boolean = false; // 新增：脏标记
}

// AnimationIntentSystem.ts
if (triggerPriority > currentPriority) {
    animState.current = triggerAnim;
    animState.locked = true;
    animState.dirty = true; // 标记为脏
}

// RenderSyncSystem.ts
animQuery.forEach(entity => {
    const animState = entity.getComponent(AnimStateComponent)!;
    if (animState.dirty && viewLink.viewId > 0) {
        this.commandBuffer.push({
            type: 'PlayAnim',
            handle: entity.handle,
            animName: animState.current
        });
        animState.dirty = false; // 清除脏标记
    }
});
```

**优点：**
- ✅ 精确控制：只在状态改变时标记为脏
- ✅ 性能最优：系统层面避免处理未改变的实体
- ✅ 符合常见的 ECS 优化模式

**缺点：**
- ⚠️ 需要修改 `AnimationIntentSystem`（设置脏标记）
- ⚠️ 需要确保脏标记在适当的时候清除（如视图重新创建）
- ⚠️ 增加了组件状态复杂度

---

### 选项 4：混合策略（lastSentAnim + AnimDriver 检查）⭐⭐ 最推荐

**策略：**
- **主策略：** 在 `RenderSyncSystem` 中使用 `lastSentAnim` 避免发送重复命令（源头优化）
- **兜底策略：** 在 `AnimDriver` 中检查当前播放状态，避免重复播放（防御性编程）

**实现：**
```typescript
// AnimStateComponent.ts（添加 lastSentAnim）
// RenderSyncSystem.ts（使用 lastSentAnim 检查）
// AnimDriver.ts（检查当前播放状态）
```

**优点：**
- ✅ 双重保障：源头避免 + 防御性检查
- ✅ 性能最优：不在源头发送无效命令
- ✅ 健壮性强：即使有遗漏，AnimDriver 也能防御
- ✅ 符合最佳实践：优化在源头，防御在边界

**缺点：**
- ⚠️ 需要两个地方的修改，但职责清晰

---

## 推荐方案：选项 4（混合策略）

### 完整实现

#### 1. AnimStateComponent 修改

```typescript
@component({ name: 'AnimState', pooled: true, poolSize: 100 })
export class AnimStateComponent extends Component {
    current: string = 'idle';
    locked: boolean = false;
    speed: number = 1.0;
    lastSentAnim: string = ''; // 新增：记录上一次发送的动画名称

    reset(): void {
        super.reset();
        this.current = 'idle';
        this.locked = false;
        this.speed = 1.0;
        this.lastSentAnim = ''; // 重置
    }
}
```

#### 2. RenderSyncSystem 修改（源头优化）

```typescript
// AnimState → PlayAnim 命令（只在动画改变时发送）
const animQuery = this.world.createQuery({
    all: [AnimStateComponent, ViewLinkComponent]
});
animQuery.forEach(entity => {
    const animState = entity.getComponent(AnimStateComponent)!;
    const viewLink = entity.getComponent(ViewLinkComponent)!;

    if (viewLink.viewId > 0) {
        // ⚠️ 关键优化：只在动画改变时发送命令
        if (animState.current !== animState.lastSentAnim) {
            this.commandBuffer.push({
                type: 'PlayAnim',
                handle: entity.handle,
                animName: animState.current
            });
            // 更新记录（同步到组件状态）
            animState.lastSentAnim = animState.current;
        }
    }
});
```

#### 3. AnimDriver 修改（防御性检查）

```typescript
playAnim(node: Node, animName: string, speed: number = 1.0, loop: boolean = false): void {
    const animation = this.nodeAnimMap.get(node);
    if (!animation) {
        this.setupAnimation(node);
        const anim = this.nodeAnimMap.get(node);
        if (!anim) {
            console.warn(`[AnimDriver] Animation not found for node: ${node.name}`);
            return;
        }
    }

    const anim = this.nodeAnimMap.get(node)!;
    
    // ⚠️ 防御性检查：如果已经在播放相同动画，跳过
    const currentInfo = this.animInfoMap.get(node);
    if (currentInfo && currentInfo.currentAnim === animName && currentInfo.isPlaying) {
        const state = anim.getState(animName);
        if (state && state.isPlaying) {
            // 已经在播放相同动画，只更新速度和循环模式（如果需要）
            if (state.speed !== speed) {
                state.speed = speed;
            }
            if ((loop && state.wrapMode !== 2) || (!loop && state.wrapMode !== 1)) {
                state.wrapMode = loop ? 2 : 1;
            }
            return; // 跳过播放
        }
    }

    const state = anim.getState(animName);
    if (state) {
        state.speed = speed;
        state.wrapMode = loop ? 2 : 1;
        anim.play(animName);

        // 更新播放信息
        this.animInfoMap.set(node, {
            currentAnim: animName,
            isPlaying: true
        });
    } else {
        console.warn(`[AnimDriver] Animation state '${animName}' not found for node: ${node.name}`);
    }
}
```

#### 4. ViewManager 销毁视图时清理（可选）

```typescript
destroyView(handle: Handle): void {
    const handleKey = this.handleToKey(handle);
    const node = this.handleNodeMap.get(handleKey);
    if (node) {
        // 清理 AnimDriver 状态
        if (this.animDriver) {
            this.animDriver.stopAnim(node);
        }
        
        // ... 其他清理逻辑
    }
    
    // 清理组件状态的 lastSentAnim（通过实体销毁自动处理，不需要手动清理）
}
```

### 设计决策

1. **lastSentAnim 字段：**
   - 作用：跟踪上一次发送到 View 层的动画名称
   - 重置：在 `reset()` 中重置为空字符串（组件回收时自动重置）
   - 同步：在发送命令后立即更新，保持与 `current` 同步

2. **RenderSyncSystem 检查：**
   - 只在 `animState.current !== animState.lastSentAnim` 时发送命令
   - 发送后立即更新 `lastSentAnim`，避免下一帧重复发送

3. **AnimDriver 防御性检查：**
   - 检查 `animInfoMap` 中的当前播放状态
   - 检查 Cocos Creator `AnimationState.isPlaying`
   - 如果已经在播放相同动画，只更新参数（speed、wrapMode），不重新播放

4. **特殊情况处理：**
   - **动画锁定（locked）：** 不影响同步优化，因为锁定期间 `current` 不会改变
   - **动画完成解锁：** `AnimationEventSystem` 只更新 `locked`，不改变 `current`，不会触发重复发送
   - **视图重新创建：** `lastSentAnim` 会在组件重置时清空，新视图会正常播放动画
   - **实体销毁：** 组件回收时 `reset()` 会清空 `lastSentAnim`

### 优势总结

1. **性能优化：**
   - 只在动画状态改变时发送命令（源头优化）
   - 减少 CommandBuffer 的命令数量
   - 减少 ViewManager 和 AnimDriver 的处理开销

2. **防御性强：**
   - 双重检查：ECS 层面 + View 层面
   - 即使有遗漏，也不会导致动画重复播放

3. **架构合规：**
   - 不违反"RenderSyncSystem 是唯一出口"约束
   - 不破坏"AnimState 唯一写入路径"约束
   - 状态跟踪在组件层面，符合 ECS 设计

4. **易于维护：**
   - 逻辑清晰：`lastSentAnim` 记录上一次发送的状态
   - 代码简单：只需在 RenderSyncSystem 中添加比较逻辑
   - 易于调试：可以添加日志输出优化效果

## 🎨🎨🎨 EXITING CREATIVE PHASE

## 实施检查清单

- [x] 修改 `AnimStateComponent.ts`（添加 `lastSentAnim` 字段）✅
- [x] 修改 `RenderSyncSystem.ts`（只在动画改变时发送命令）✅
- [x] 修改 `AnimDriver.ts`（添加防御性检查，避免重复播放）✅
- [x] 更新 `reset()` 方法（重置 `lastSentAnim`）✅
- [x] 编写单元测试（测试动画同步优化）✅
- [x] 所有测试通过（241/241）✅
- [ ] 性能测试（验证优化效果）- 待运行时测试

## 参考

- 架构约束：`memory-bank/systemPatterns.md`
- 动画系统设计：`memory-bank/creative/creative-animation-intent.md`
- 动画事件系统：`memory-bank/creative/creative-animation-system.md`
