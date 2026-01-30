# 创意阶段：UI 系统设计

## 问题描述

在肉鸽游戏中，需要实现 UI 系统以支持：
- 游戏主界面（HP 条、经验条、等级显示等）
- 背包界面（物品列表、使用、装备等）
- 技能界面（技能槽位、冷却时间、使用等）
- 属性界面（攻击、防御、速度等属性显示）
- UI 事件处理（点击、拖拽等操作）
- UI 数据同步（ECS 数据变化时更新 UI）

**需求：**
1. UI 与 ECS 解耦（UI 不直接依赖 ECS 组件）
2. UI 事件通过 EventBus 发送到 ECS
3. UI 数据通过查询 World 或监听 EventBus 事件获取
4. 支持多个 UI 模块（GameUI、InventoryUI、SkillUI、StatsUI）
5. UI 生命周期管理（显示/隐藏、初始化/销毁）
6. UI 更新性能优化（避免频繁查询）

## 约束条件

- **架构约束：**
  - UI 是 View 层的一部分，遵循 View → ECS 通过 EventBus 的规则
  - UI 不能直接修改 ECS 组件（只能通过 EventBus 发送事件）
  - UI 可以查询 World 获取数据（只读访问）
  - UI 应该监听 EventBus 事件来响应数据变化
  - UI 使用 Cocos Creator 的 UI 组件（Label、Button、ScrollView 等）

- **性能约束：**
  - UI 更新不应该阻塞主线程
  - 避免每帧查询 World（使用事件驱动 + 定时更新）
  - UI 更新应该批量处理（避免频繁刷新）

- **数据流约束：**
  - UI 事件 → EventBus → ECS Systems
  - ECS 数据变化 → EventBus 事件 → UI 监听 → UI 更新
  - UI 也可以直接查询 World（用于初始化或定期刷新）

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: UI System Architecture Design

### 方案 1：纯事件驱动（UI 只监听事件，不查询 World）

**设计思路：**
- UI 完全依赖 EventBus 事件来更新
- ECS 系统在数据变化时发送事件（如 HPChanged、LevelUp、InventoryChanged 等）
- UI 监听这些事件并更新显示

**优点：**
- 完全解耦，UI 不需要知道 World
- 事件驱动，性能好（只在变化时更新）
- 符合观察者模式

**缺点：**
- 需要为每个数据变化定义事件（事件爆炸）
- UI 初始化时需要特殊处理（没有事件触发）
- 如果事件丢失，UI 可能不同步

**实现：**
```typescript
// ECS 系统发送事件
eventBus.push({
    type: 'HPChanged',
    handle: playerHandle,
    cur: 80,
    max: 100
});

// UI 监听事件
eventBus.subscribe('HPChanged', (event) => {
    this.updateHPBar(event.cur, event.max);
});
```

**评估：** ❌ 不推荐
- 事件过多，维护成本高
- 初始化复杂
- 容易遗漏事件

---

### 方案 2：纯查询驱动（UI 定期查询 World）

**设计思路：**
- UI 在 update 中定期查询 World 获取最新数据
- 不需要定义大量事件
- 简单直接

**优点：**
- 实现简单，不需要定义事件
- UI 总是显示最新数据
- 初始化简单（直接查询）

**缺点：**
- 每帧查询 World，性能开销大
- UI 需要知道 ECS 组件结构（耦合）
- 无法区分"数据变化"和"数据未变化"（总是刷新）

**实现：**
```typescript
update(dt: number) {
    // 每帧查询
    const player = this.findPlayerEntity();
    if (player) {
        const hp = player.getComponent(HPComponent);
        this.updateHPBar(hp.cur, hp.max);
    }
}
```

**评估：** ❌ 不推荐
- 性能问题（每帧查询）
- 耦合度高

---

### 方案 3：混合方案（事件驱动 + 定时查询 + 直接查询）

**设计思路：**
- **UI 事件 → EventBus：** UI 操作（点击、拖拽）通过 EventBus 发送到 ECS
- **ECS 事件 → UI 监听：** 重要数据变化（LevelUp、EquipmentChange）通过 EventBus 通知 UI
- **UI 定时查询：** UI 在 update 中定期查询 World（如每 0.1 秒查询一次，而不是每帧）
- **UI 初始化查询：** UI 初始化时直接查询 World 获取初始数据

**优点：**
- 平衡了解耦和性能
- 重要事件及时响应（LevelUp、EquipmentChange）
- 常规数据定期刷新（HP、经验等）
- 初始化简单（直接查询）

**缺点：**
- 需要同时处理事件和查询（复杂度中等）
- 需要定义查询频率（避免过度查询）

**实现：**
```typescript
class GameUI extends Component {
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每 0.1 秒更新一次

    onLoad() {
        // 初始化：直接查询
        this.refreshFromWorld();
        
        // 监听重要事件
        this.eventBus.subscribe('LevelUp', this.onLevelUp.bind(this));
    }

    update(dt: number) {
        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld(); // 定期查询
        }
    }

    refreshFromWorld() {
        const player = this.findPlayerEntity();
        if (player) {
            const hp = player.getComponent(HPComponent);
            this.updateHPBar(hp.cur, hp.max);
        }
    }

    onLevelUp(event: LevelUpEvent) {
        // 事件驱动：立即更新
        this.showLevelUpEffect(event.newLevel);
    }

    onUseItemClick(itemId: string) {
        // UI 事件 → EventBus
        this.eventBus.push({
            type: 'UIEvent',
            eventName: 'use_item',
            data: { itemId }
        });
    }
}
```

**评估：** ✅ **推荐**
- 平衡了性能和复杂度
- 符合现有架构模式
- 灵活且可扩展

---

## 设计决策

### 决策 1：采用混合方案（事件驱动 + 定时查询 + 直接查询）

**理由：**
- 平衡了解耦和性能
- 重要事件及时响应，常规数据定期刷新
- 符合现有架构模式（EventBus + World 查询）

### 决策 2：UI 模块化设计（每个 UI 模块独立）

**设计：**
- `GameUI` - 游戏主界面（HP 条、经验条、等级等）
- `InventoryUI` - 背包界面（物品列表、使用、装备等）
- `SkillUI` - 技能界面（技能槽位、冷却时间等）
- `StatsUI` - 属性界面（攻击、防御、速度等）

**每个 UI 模块：**
- 独立的 Cocos Creator Component
- 可以显示/隐藏
- 可以独立初始化/销毁
- 通过 EventBus 与 ECS 通信

### 决策 3：UI 管理器（UIManager）

**设计：**
- 管理所有 UI 模块的创建/销毁
- 提供统一的 World 和 EventBus 访问
- 处理 UI 模块的显示/隐藏
- 提供 UI 模块查找方法

**实现：**
```typescript
class UIManager {
    private uiModules: Map<string, Component> = new Map();
    private world: World;
    private eventBus: EventBus;

    registerUI(name: string, uiComponent: Component): void;
    getUI(name: string): Component | null;
    showUI(name: string): void;
    hideUI(name: string): void;
    setWorld(world: World): void;
    setEventBus(eventBus: EventBus): void;
}
```

### 决策 4：UI 事件命名规范（带 namespace）

**UI 事件通过 EventBus 发送，使用 `UIEvent` 类型，eventName 使用 `ui:` 前缀避免冲突：**

```typescript
// UI 操作事件（使用 ui: 前缀）
{ type: 'UIEvent', eventName: 'ui:use_item', data: { itemId: string, slotIndex: number } }
{ type: 'UIEvent', eventName: 'ui:equip_item', data: { itemId: string, slotIndex: number } }
{ type: 'UIEvent', eventName: 'ui:unequip_item', data: { slotType: EquipmentSlotType } }
{ type: 'UIEvent', eventName: 'ui:use_skill', data: { slotIndex: number } }
{ type: 'UIEvent', eventName: 'ui:open_inventory', data: {} }
{ type: 'UIEvent', eventName: 'ui:close_inventory', data: {} }
{ type: 'UIEvent', eventName: 'ui:open_skill_panel', data: {} }
{ type: 'UIEvent', eventName: 'ui:open_stats_panel', data: {} }
```

**理由：**
- 避免未来 EventBus 事件名冲突
- 清晰标识事件来源（UI 层）
- 便于事件过滤和调试

### 决策 5：ECS 事件监听（UI 监听 ECS 事件）

**UI 监听以下 ECS 事件：**
- `LevelUp` - 升级事件（显示升级效果）
- `EquipmentChange` - 装备变化事件（更新装备 UI）
- `EntityDeath` - 实体死亡事件（显示死亡提示）

**注意：** 这些事件已经在 EventBus 中定义，UI 直接订阅即可。

---

## 详细设计

### 1. UIManager（UI 管理器）

**职责：**
- 管理所有 UI 模块的注册和查找
- 提供统一的 World 和 EventBus 访问接口
- 处理 UI 模块的显示/隐藏

**接口：**
```typescript
class UIManager {
    private uiModules: Map<string, Component> = new Map();
    private world: World | null = null;
    private eventBus: EventBus | null = null;

    /**
     * 注册 UI 模块
     */
    registerUI(name: string, uiComponent: Component): void;

    /**
     * 获取 UI 模块
     */
    getUI(name: string): Component | null;

    /**
     * 显示 UI 模块
     */
    showUI(name: string): void;

    /**
     * 隐藏 UI 模块
     */
    hideUI(name: string): void;

    /**
     * 设置 World（供 UI 查询）
     */
    setWorld(world: World): void;

    /**
     * 设置 EventBus（供 UI 发送事件）
     */
    setEventBus(eventBus: EventBus): void;

    /**
     * 获取 World（供 UI 查询）
     */
    getWorld(): World | null;

    /**
     * 获取 EventBus（供 UI 发送事件）
     */
    getEventBus(): EventBus | null;

    /**
     * 查找玩家实体（统一"谁是玩家"的规则）
     * @param world ECS World 实例
     * @returns 玩家实体，如果不存在返回 null
     */
    getPlayerEntity(world: World): Entity | null;

    /**
     * 清空所有 UI 模块
     */
    clear(): void;
}
```

**实现：**
```typescript
class UIManager {
    // ... 其他代码 ...

    /**
     * 查找玩家实体
     * 统一规则：有 LevelExperienceComponent 和 InventoryComponent 的实体是玩家
     */
    getPlayerEntity(world: World): Entity | null {
        const query = world.createQuery({
            all: [LevelExperienceComponent, InventoryComponent]
        });
        const entities = query.getEntities();
        return entities.length > 0 ? entities[0] : null;
    }
}
```

### 2. GameUI（游戏主界面）

**职责：**
- 显示玩家 HP 条
- 显示经验条和等级
- 显示游戏时间（可选）
- 显示快捷操作按钮（打开背包、技能等）

**数据来源：**
- HPComponent（HP 条）
- LevelExperienceComponent（经验条、等级）
- StatsComponent（可选：显示攻击力等）

**更新方式：**
- 定时查询（每 0.1 秒）
- 监听 LevelUp 事件（立即更新）

**UI 事件：**
- `open_inventory` - 打开背包
- `open_skill_panel` - 打开技能面板
- `open_stats_panel` - 打开属性面板

**实现：**
```typescript
@ccclass('GameUI')
export class GameUI extends Component {
    @property(Label)
    levelLabel: Label = null!;

    @property(ProgressBar)
    hpBar: ProgressBar = null!;

    @property(ProgressBar)
    expBar: ProgressBar = null!;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.1;

    onLoad() {
        // 获取 UIManager
        this.uiManager = UIManager.getInstance();
        this.uiManager?.registerUI('GameUI', this);

        // 初始化：直接查询
        this.refreshFromWorld();

        // 监听重要事件
        const eventBus = this.uiManager?.getEventBus();
        if (eventBus) {
            eventBus.subscribe('LevelUp', this.onLevelUp.bind(this));
        }
    }

    update(dt: number) {
        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        const player = this.findPlayerEntity(world);
        if (!player) return;

        // 更新 HP 条
        const hp = player.getComponent(HPComponent);
        if (hp && this.hpBar) {
            this.hpBar.progress = hp.cur / hp.max;
        }

        // 更新经验条和等级
        const levelExp = player.getComponent(LevelExperienceComponent);
        if (levelExp) {
            if (this.levelLabel) {
                this.levelLabel.string = `Lv.${levelExp.level}`;
            }
            if (this.expBar) {
                this.expBar.progress = levelExp.expPercentage;
            }
        }
    }

    private onLevelUp(event: LevelUpEvent) {
        // 显示升级效果
        this.showLevelUpEffect(event.newLevel);
        // 立即刷新（不需要等待定时器）
        this.refreshFromWorld();
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        // 更新 HP 条
        const hp = player.getComponent(HPComponent);
        if (hp && this.hpBar) {
            this.hpBar.progress = hp.cur / hp.max;
        }

        // 更新经验条和等级
        const levelExp = player.getComponent(LevelExperienceComponent);
        if (levelExp) {
            if (this.levelLabel) {
                this.levelLabel.string = `Lv.${levelExp.level}`;
            }
            if (this.expBar) {
                this.expBar.progress = levelExp.expPercentage;
            }
        }
    }

    private showLevelUpEffect(level: number): void {
        // 显示升级特效（可选）
        console.log(`Level Up! New Level: ${level}`);
    }

    onOpenInventoryClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:open_inventory',
            data: {}
        });
    }
}
```

### 3. InventoryUI（背包界面）

**职责：**
- 显示背包物品列表（30 个槽位）
- 支持物品使用（点击使用）
- 支持物品装备（点击装备）
- 显示物品详情（悬停显示）

**数据来源：**
- InventoryComponent（物品列表）

**更新方式：**
- 定时查询（每 0.2 秒，背包更新频率较低）
- 监听 InventoryChanged 事件（如果定义）

**UI 事件：**
- `use_item` - 使用物品（data: { itemId, slotIndex }）
- `equip_item` - 装备物品（data: { itemId, slotIndex }）
- `close_inventory` - 关闭背包

**实现：**
```typescript
@ccclass('InventoryUI')
export class InventoryUI extends Component {
    @property(Node)
    itemListContainer: Node = null!;

    @property(Prefab)
    itemSlotPrefab: Prefab = null!;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.2;
    private itemSlots: Node[] = [];

    onLoad() {
        this.uiManager = UIManager.getInstance();
        this.uiManager?.registerUI('InventoryUI', this);
        this.node.active = false; // 默认隐藏

        // 创建物品槽位
        this.createItemSlots();
    }

    update(dt: number) {
        if (!this.node.active) return; // 隐藏时不更新

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private createItemSlots() {
        // 创建 30 个物品槽位
        for (let i = 0; i < 30; i++) {
            const slotNode = instantiate(this.itemSlotPrefab);
            slotNode.setParent(this.itemListContainer);
            this.itemSlots.push(slotNode);
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const inventory = player.getComponent(InventoryComponent);
        if (!inventory) return;

        // 更新每个槽位
        for (let i = 0; i < inventory.maxSlots; i++) {
            const item = inventory.getItem(i);
            this.updateItemSlot(i, item);
        }
    }

    private updateItemSlot(slotIndex: number, item: InventoryItem | null) {
        const slotNode = this.itemSlots[slotIndex];
        if (!slotNode) return;

        // 更新槽位显示（图标、数量等）
        const iconSprite = slotNode.getChildByName('Icon')?.getComponent(Sprite);
        const countLabel = slotNode.getChildByName('Count')?.getComponent(Label);

        if (item) {
            // 显示物品
            if (iconSprite) {
                // 加载物品图标（从配置或资源）
                // iconSprite.spriteFrame = ...;
            }
            if (countLabel) {
                countLabel.string = item.count > 1 ? item.count.toString() : '';
            }
        } else {
            // 清空槽位
            if (iconSprite) {
                iconSprite.spriteFrame = null;
            }
            if (countLabel) {
                countLabel.string = '';
            }
        }
    }

    onItemClick(slotIndex: number) {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        const player = this.findPlayerEntity(world);
        if (!player) return;

        const inventory = player.getComponent(InventoryComponent);
        if (!inventory) return;

        const item = inventory.getItem(slotIndex);
        if (!item) return;

        const eventBus = this.uiManager?.getEventBus();
        if (!eventBus) return;

        // 根据物品类型发送不同事件
        if (item.config.type === 'consumable') {
            // 使用物品
            eventBus.push({
                type: 'UIEvent',
                eventName: 'ui:use_item',
                data: { itemId: item.itemId, slotIndex }
            });
        } else if (item.config.type === 'equipment') {
            // 装备物品
            eventBus.push({
                type: 'UIEvent',
                eventName: 'ui:equip_item',
                data: { itemId: item.itemId, slotIndex }
            });
        }
    }

    onCloseClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:close_inventory',
            data: {}
        });
        this.node.active = false;
    }

    show() {
        this.node.active = true;
        this.refreshFromWorld(); // 显示时立即刷新
    }

    hide() {
        this.node.active = false;
    }
}
```

### 4. SkillUI（技能界面）

**职责：**
- 显示技能槽位（4 个）
- 显示技能冷却时间
- 支持技能使用（点击使用）

**数据来源：**
- SkillSlotsComponent（技能列表）

**更新方式：**
- 定时查询（每 0.1 秒，冷却时间需要实时更新）

**UI 事件：**
- `use_skill` - 使用技能（data: { slotIndex }）
- `close_skill_panel` - 关闭技能面板

**实现：**
```typescript
@ccclass('SkillUI')
export class SkillUI extends Component {
    @property(Node)
    skillSlotsContainer: Node = null!;

    @property(Prefab)
    skillSlotPrefab: Prefab = null!;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.1;
    private skillSlots: Node[] = [];

    onLoad() {
        this.uiManager = UIManager.getInstance();
        this.uiManager?.registerUI('SkillUI', this);
        this.node.active = false;

        this.createSkillSlots();
    }

    update(dt: number) {
        if (!this.node.active) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const skillSlots = player.getComponent(SkillSlotsComponent);
        if (!skillSlots) return;

        // 更新每个技能槽位
        for (let i = 0; i < skillSlots.maxSlots; i++) {
            const skill = skillSlots.getSkill(i);
            this.updateSkillSlot(i, skill);
        }
    }

    private updateSkillSlot(slotIndex: number, skill: SkillSlotData | null) {
        const slotNode = this.skillSlots[slotIndex];
        if (!slotNode) return;

        // 更新技能显示（图标、冷却时间等）
        const cooldownLabel = slotNode.getChildByName('Cooldown')?.getComponent(Label);
        const cooldownMask = slotNode.getChildByName('CooldownMask')?.getComponent(Sprite);

        if (skill) {
            // 显示技能
            if (cooldownLabel) {
                cooldownLabel.string = skill.cooldown > 0 ? skill.cooldown.toFixed(1) : '';
            }
            if (cooldownMask) {
                // 显示冷却遮罩
                cooldownMask.fillRange = skill.cooldown / skill.maxCooldown;
            }
        } else {
            // 清空槽位
            if (cooldownLabel) {
                cooldownLabel.string = '';
            }
            if (cooldownMask) {
                cooldownMask.fillRange = 0;
            }
        }
    }

    onSkillClick(slotIndex: number) {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:use_skill',
            data: { slotIndex }
        });
    }

    show() {
        this.node.active = true;
        this.refreshFromWorld();
    }

    hide() {
        this.node.active = false;
    }
}
```

### 5. StatsUI（属性界面）

**职责：**
- 显示玩家属性（攻击、防御、速度、最大 HP 等）
- 显示属性来源（基础、装备、Buff、升级）

**数据来源：**
- StatsComponent（属性数据）

**更新方式：**
- 定时查询（每 0.2 秒）
- 监听 EquipmentChange 事件（装备变化时立即更新）

**UI 事件：**
- `close_stats_panel` - 关闭属性面板

**实现：**
```typescript
@ccclass('StatsUI')
export class StatsUI extends Component {
    @property(Label)
    attackLabel: Label = null!;

    @property(Label)
    defenseLabel: Label = null!;

    @property(Label)
    speedLabel: Label = null!;

    @property(Label)
    maxHPLabel: Label = null!;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.2;

    onLoad() {
        this.uiManager = UIManager.getInstance();
        this.uiManager?.registerUI('StatsUI', this);
        this.node.active = false;

        // 监听装备变化事件
        const eventBus = this.uiManager?.getEventBus();
        if (eventBus) {
            eventBus.subscribe('EquipmentChange', this.onEquipmentChange.bind(this));
        }
    }

    update(dt: number) {
        if (!this.node.active) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const stats = player.getComponent(StatsComponent);
        if (!stats) return;

        // ⚠️ 性能注意：getFinal() 可能变重（合并 buff/equipment）
        // 只在 refreshFromWorld() 中调用，不在每帧调用
        // 当前更新频率已控制为 0.2 秒，这是合理的
        const finalStats = stats.getFinal();
        if (this.attackLabel) {
            this.attackLabel.string = `攻击: ${finalStats.attack.toFixed(0)}`;
        }
        if (this.defenseLabel) {
            this.defenseLabel.string = `防御: ${finalStats.defense.toFixed(0)}`;
        }
        if (this.speedLabel) {
            this.speedLabel.string = `速度: ${finalStats.speed.toFixed(0)}`;
        }
        if (this.maxHPLabel) {
            this.maxHPLabel.string = `最大HP: ${finalStats.maxHP.toFixed(0)}`;
        }
    }

    private onEquipmentChange(event: EquipmentChangeEvent) {
        // 装备变化时立即更新
        this.refreshFromWorld();
    }

    show() {
        this.node.active = true;
        this.refreshFromWorld();
    }

    hide() {
        this.node.active = false;
    }
}
```

---

## 集成方案

### 1. 在 GameApp 中集成 UIManager

```typescript
// GameApp.ts
import { UIManager } from '../presentation/UI/UIManager';

export class GameApp extends Component {
    private uiManager!: UIManager;

    async onLoad() {
        // ... 其他初始化 ...

        // 初始化 UI 管理器
        this.uiManager = UIManager.getInstance();
        this.uiManager.setWorld(this.world);
        this.uiManager.setEventBus(this.eventBus);

        // ... 其他初始化 ...
    }
}
```

### 2. UI 事件处理（在 ECS Systems 中）

**InputSystem 或新建 UISystem 处理 UI 事件：**

```typescript
@system({ priority: 10 })
export class UISystem extends System {
    private eventBus!: EventBus;
    private inventorySystem!: InventorySystem;
    private equipmentSystem!: EquipmentSystem;
    private skillSystem!: SkillSystem;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    setInventorySystem(system: InventorySystem): void {
        this.inventorySystem = system;
    }

    // ... 其他 setter ...

    onInit(): void {
        if (this.eventBus) {
            this.eventBus.subscribe('UIEvent', this.onUIEvent.bind(this));
        }
    }

    private onUIEvent(event: UIEvent): void {
        // 只处理 ui: 命名空间的事件
        if (!event.eventName.startsWith('ui:')) {
            return;
        }

        switch (event.eventName) {
            case 'ui:use_item':
                this.handleUseItem(event.data);
                break;
            case 'ui:equip_item':
                this.handleEquipItem(event.data);
                break;
            case 'ui:use_skill':
                this.handleUseSkill(event.data);
                break;
            // ... 其他事件处理 ...
        }
    }

    private handleUseItem(data: { itemId: string; slotIndex: number }): void {
        // 查找玩家实体
        const player = this.findPlayerEntity();
        if (!player) return;

        // 使用物品
        this.inventorySystem?.useItem(player, data.slotIndex);
    }

    // ... 其他处理方法 ...
}
```

---

## 总结

### 核心设计决策

1. **混合方案：** 事件驱动 + 定时查询 + 直接查询
2. **模块化设计：** 每个 UI 模块独立（GameUI、InventoryUI、SkillUI、StatsUI）
3. **UIManager：** 统一管理 UI 模块，提供 World 和 EventBus 访问
4. **UI 事件规范：** 通过 EventBus 发送 UIEvent，使用 `ui:` 命名空间前缀
5. **更新频率：** 根据 UI 类型设置不同的更新间隔（GameUI 0.1s、InventoryUI 0.2s）
6. **玩家实体查找：** UIManager 提供统一的 `getPlayerEntity()` 方法，统一"谁是玩家"的规则
7. **性能优化：** `stats.getFinal()` 等可能变重的方法只在 `refreshFromWorld()` 中调用，不在每帧调用

### 数据流

```
UI 操作 → EventBus (UIEvent) → UISystem → ECS Systems
ECS 数据变化 → EventBus (LevelUp/EquipmentChange) → UI 监听 → UI 更新
ECS 数据 → World 查询 → UI 定时刷新
```

### 实现优先级

1. **UIManager** - 基础框架
2. **GameUI** - 主界面（HP 条、经验条）
3. **InventoryUI** - 背包界面
4. **SkillUI** - 技能界面
5. **StatsUI** - 属性界面
6. **UISystem** - UI 事件处理系统

### 验收标准

- ✅ UI 模块可以独立显示/隐藏
- ✅ UI 事件通过 EventBus 发送到 ECS
- ✅ UI 数据通过查询 World 或监听事件更新
- ✅ UI 更新性能合理（不每帧查询）
- ✅ UI 与 ECS 解耦（UI 不直接修改组件）
