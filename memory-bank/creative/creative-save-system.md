# 创意阶段：SaveSystem 存档系统设计

## 问题描述

在肉鸽游戏中，需要实现存档系统以支持：
- 游戏进度保存（玩家数据、背包、装备、等级等）
- 游戏状态恢复（从存档点恢复游戏）
- 数据持久化（跨会话保存）
- 支持多个存档槽位（可选）
- 存档数据压缩（可选，节省存储空间）
- 存档版本管理（支持版本升级和兼容性）

**需求：**
1. 序列化 ECS World 的状态（实体和组件）
2. 支持部分存档（如只保存玩家实体）和完整存档（保存所有实体）
3. 处理配置引用（不序列化配置对象，只保存 ID）
4. 处理运行时数据（不序列化 viewId 等运行时生成的数据）
5. 支持存档/读档操作
6. 支持存档验证（数据完整性检查）
7. 支持存档版本管理

## 约束条件

- **架构约束：**
  - ECS 组件只存可序列化的纯数据
  - 不能序列化 Creator 对象引用（Node、Component 等）
  - 不能序列化配置对象（ConfigLoader 管理的配置）
  - ViewLink 的 viewId 是运行时生成的，不应该序列化
  - Tag 组件可能不需要序列化（如 DeadTag，恢复时重新计算）

- **性能约束：**
  - 序列化/反序列化应该高效（避免阻塞主线程）
  - 存档文件大小应该合理（支持压缩）
  - 读档时应该快速恢复状态

- **兼容性约束：**
  - ⚠️ **存档版本严格校验，不做隐式兼容**（版本不匹配直接失败）
  - 存档数据格式应该稳定（不频繁变更）

- **平台约束：**
  - Cocos Creator 支持 localStorage、sys.localStorage（Web 平台）
  - 支持 JSON 序列化/反序列化
  - 可以考虑使用压缩库（如 pako）进行压缩

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: SaveSystem Architecture Design

**重要约束（来自需求确认）：**
1. ✅ 采用"白名单 + 自定义序列化器"的混合方案
2. ✅ **存档只包含可推导的纯数据，不包含任何运行时状态**（严格要求）
3. ✅ **读档通过重建 World 实现，而非修补现有状态**（重要约束）
4. ✅ **EntityId 不作为稳定标识**（读档时重新生成）
5. ✅ **存档版本严格校验，不做隐式兼容**（版本不匹配直接失败）
6. ✅ **当前阶段仅支持玩家实体存档**（简化实现）

### 方案 1：简单 JSON 序列化（所有组件）

**设计思路：**
- 直接序列化所有实体和组件
- 使用 JSON.stringify/parse
- 存储到 localStorage

**优点：**
- 实现简单，开发快速
- 易于调试（JSON 可读）
- 不需要额外依赖

**缺点：**
- 可能序列化不需要的数据（Tag 组件、Intent 组件、viewId 等）
- 可能序列化配置对象（应该只保存 ID）
- 存档文件可能较大
- 性能可能较差（大量数据时）

**适用场景：**
- 简单场景（实体数量少）
- 原型开发阶段
- 存档数据量小

---

### 方案 2：选择性序列化（配置组件白名单）

**设计思路：**
- 定义需要序列化的组件白名单
- 序列化时只保存白名单中的组件
- 对配置引用进行特殊处理（只保存 ID）
- 对运行时数据（viewId 等）进行过滤

**组件分类：**
1. **持久化组件（需要序列化）：**
   - Transform、HP、Stats、Inventory、Equipment、LevelExperience
   - BuffList（需要序列化 Buff 数据，但不需要配置对象）
   - SkillSlots（需要序列化技能槽数据）

2. **临时组件（不需要序列化）：**
   - ViewLink（viewId 是运行时生成的，prefabKey 可以序列化）
   - AnimState（可以序列化，但恢复时会重新初始化）
   - AnimationIntent、FxIntent、AudioIntent（临时状态，不需要序列化）
   - DeadTag、NeedViewTag（Tag 组件，恢复时重新计算）
   - DestroyTimer（临时状态，不需要序列化）

3. **配置引用组件（需要特殊处理）：**
   - InventoryComponent（InventoryItem.config 不应该序列化）
   - EquipmentComponent（EquipmentData.config 不应该序列化）

**优点：**
- 精确控制序列化内容
- 存档文件更小
- 性能更好
- 数据更清晰

**缺点：**
- 需要维护组件白名单
- 需要特殊处理配置引用
- 实现复杂度中等

**适用场景：**
- 推荐方案
- 生产环境使用

---

### 方案 3：自定义序列化器（每个组件实现 toJSON/fromJSON）

**设计思路：**
- 每个组件实现 `toJSON()` 和 `fromJSON()` 方法
- SaveSystem 调用这些方法进行序列化/反序列化
- 支持自定义序列化逻辑

**优点：**
- 灵活性高，每个组件可以自定义序列化逻辑
- 支持复杂数据结构的序列化
- 支持版本升级和兼容性处理

**缺点：**
- 需要修改所有组件（添加 toJSON/fromJSON 方法）
- 代码量较大
- 维护成本高

**适用场景：**
- 复杂数据结构
- 需要精细控制序列化过程
- 长期维护的项目

---

### 方案 4：混合方案（白名单 + 自定义序列化器，按需使用）

**设计思路：**
- 大部分组件使用自动序列化（基于白名单）
- 复杂组件（如 Inventory、Equipment）使用自定义序列化器
- 支持组件级别的序列化策略配置

**优点：**
- 平衡了灵活性和简洁性
- 大部分组件不需要修改
- 复杂组件可以精细控制

**缺点：**
- 实现复杂度中等
- 需要维护组件白名单和自定义序列化器

**适用场景：**
- **推荐方案（最佳平衡）**
- 生产环境使用

---

## 推荐方案：方案 4（混合方案）

### 设计决策

**采用方案 4：白名单 + 自定义序列化器（按需使用）✅**

**理由：**
1. 平衡了灵活性和简洁性
2. 大部分组件可以直接序列化，不需要修改
3. 复杂组件（Inventory、Equipment）可以精细控制
4. 支持未来扩展（如添加压缩、版本管理等）

**核心约束确认：**
1. ✅ **存档只包含可推导的纯数据，不包含任何运行时状态**
   - 纯数据：Transform、HP、Stats、LevelExperience、Inventory、Equipment 等
   - 运行时状态：ViewLink.viewId、AnimState.lastSentAnim、Intent 组件、Tag 组件等
   
2. ✅ **读档通过重建 World 实现，而非修补现有状态**
   - 读档时创建新的 World
   - 从存档数据重建所有实体和组件
   - 不修改现有 World 的状态
   
3. ✅ **EntityId 不作为稳定标识**
   - 存档中不包含 EntityId（或包含但不作为标识）
   - 读档时重新生成 EntityId
   - 实体关系通过其他方式维护（如通过组件关联）
   
4. ✅ **存档版本严格校验，不做隐式兼容**
   - 版本不匹配时直接失败，抛出错误
   - 不进行版本转换或兼容性处理
   - 版本号格式：`major.minor.patch`（如 "1.0.0"）
   
5. ✅ **当前阶段仅支持玩家实体存档**
   - 只序列化玩家实体（通过实体名称或组件识别）
   - 简化实现，减少复杂性
   - 未来可以扩展支持其他实体类型

### 实现架构

#### 1. 组件分类和序列化策略

**持久化组件（纯数据，自动序列化）：**
- `TransformComponent` - 位置信息（x, y, rot）
- `HPComponent` - 生命值（cur, max）
- `StatsComponent` - 属性（base, equipment, buffFixed, buffPercent, levelup）- 所有属性都是纯数据
- `LevelExperienceComponent` - 等级和经验（level, maxLevel, exp, expRequired, totalExp, configKey）
- `FactionComponent` - 阵营（faction）
- `ColliderComponent` - 碰撞体（radius, offsetX, offsetY）- 如果需要保存

**持久化组件（纯数据，但需要自定义序列化器过滤配置引用）：**
- `InventoryComponent` - 背包
  - ✅ 序列化：slots 数组、每个槽位的 itemId、count、slotIndex
  - ❌ 不序列化：InventoryItem.config（配置引用）
  - 📝 读档时通过 itemId 从 ConfigLoader 重新加载 config
  
- `EquipmentComponent` - 装备
  - ✅ 序列化：slots Record、每个槽位的 equipmentId、level、durability
  - ❌ 不序列化：EquipmentData.config（配置引用）
  - 📝 读档时通过 equipmentId 从 ConfigLoader 重新加载 config
  
- `BuffListComponent` - Buff 列表
  - ✅ 序列化：buffs Record、每个 Buff 的 id、type、duration、stacks、params、source
  - ✅ 注意：BuffData 中不包含配置引用，都是纯数据
  
- `SkillSlotsComponent` - 技能槽
  - ✅ 序列化：slots 数组、每个槽位的 skillId、cooldownRemaining、usesRemaining
  - ❌ 不序列化：SkillSlot.config（配置引用）
  - 📝 读档时通过 skillId 从 ConfigLoader 重新加载 config

**运行时组件（部分序列化纯数据，过滤运行时状态）：**
- `ViewLinkComponent`
  - ✅ 序列化：prefabKey（用于重建 View）
  - ❌ 不序列化：viewId（运行时生成，读档时重新生成）
  
- `AnimStateComponent`
  - ✅ 序列化：current、locked、speed（纯数据状态）
  - ❌ 不序列化：lastSentAnim（运行时优化数据，读档时重置）

**临时组件（运行时状态，不序列化）：**
- `AnimationIntentComponent` - 临时状态，读档时重置
- `FxIntentComponent` - 临时状态，读档时重置
- `AudioIntentComponent` - 临时状态，读档时重置
- `DeadTagComponent` - Tag 组件，读档时根据 HP 重新计算
- `NeedViewTagComponent` - Tag 组件，读档时根据 ViewLink 重新计算
- `DestroyTimerComponent` - 临时状态，读档时重置
- `AIComponent` - AI 状态（运行时状态），**当前阶段不序列化**

**不序列化的运行时状态总结：**
- 所有 Intent 组件（AnimationIntent、FxIntent、AudioIntent）
- 所有 Tag 组件（DeadTag、NeedViewTag）
- 所有 Timer 组件（DestroyTimer）
- ViewLink.viewId（运行时 ID）
- AnimState.lastSentAnim（运行时优化数据）
- AIComponent（AI 状态）
- Velocity（速度是运行时计算的，读档时重置）

#### 2. 数据格式

```typescript
interface SaveData {
    version: string;                    // 存档版本（如 "1.0.0"），严格校验
    timestamp: number;                  // 存档时间戳
    gameTime?: number;                  // 游戏时间（可选）
    entities: EntitySaveData[];        // 实体数据（当前阶段只包含玩家实体）
}

interface EntitySaveData {
    // ❌ 不包含 EntityId（EntityId 不作为稳定标识，读档时重新生成）
    name: string;                       // 实体名称（用于识别玩家实体，如 "Player"）
    components: ComponentSaveData[];    // 组件数据（只包含纯数据，不包含运行时状态）
}

interface ComponentSaveData {
    type: string;                       // 组件类型名称（如 "Transform"）
    data: any;                          // 组件数据（已过滤配置引用和运行时状态，只包含纯数据）
}
```

**重要约束：**
- ❌ EntityId 不作为存档数据的一部分（读档时重新生成）
- ❌ 不包含任何运行时状态（Intent、Tag、Timer 等）
- ❌ 不包含配置引用（config 对象），只包含 ID
- ✅ 只包含可推导的纯数据

#### 3. 存储方式

**方案 A：localStorage（Web 平台）**
- 使用 `sys.localStorage.setItem/getItem`
- 支持多个存档槽位（通过 key 区分，如 `save_1`, `save_2`）
- 容量限制：通常 5-10MB

**方案 B：文件系统（Native 平台）**
- 使用 `fs.writeFileSync/readFileSync`（Node.js 环境）
- 或使用 Cocos Creator 的 `jsb.fileUtils`
- 支持更大的存档文件

**推荐：** 使用抽象层，根据平台自动选择存储方式

#### 4. 压缩（可选）

**方案 A：不压缩**
- 直接存储 JSON 字符串
- 简单快速
- 存档文件较大（可能 100KB+）

**方案 B：使用 pako（gzip 压缩）**
- 压缩 JSON 字符串
- 存档文件更小（可能减少 70-90%）
- 需要额外依赖

**推荐：** 支持可选压缩，默认开启（如果存档文件 > 10KB）

#### 5. 版本管理

**选定方案：严格版本校验（不做隐式兼容）**

**设计：**
- 存档版本格式：`major.minor.patch`（如 "1.0.0"）
- 读档时严格检查版本号，必须完全匹配
- **版本不匹配时直接失败，抛出错误，不进行任何转换或兼容处理**
- 错误信息明确：`SaveSystemError: Version mismatch. Save version: 1.0.0, Current version: 1.1.0`

**理由：**
- 简化实现，避免复杂的版本转换逻辑
- 明确错误处理，避免隐式兼容导致的数据不一致
- 未来如需支持版本升级，可以通过显式的 Migration 工具处理

**当前版本：** `"1.0.0"`（初始版本）

#### 6. 存档范围

**选定方案：部分存档（只保存玩家实体）** ✅

**设计：**
- **当前阶段仅支持玩家实体存档**
- 通过实体名称识别玩家实体（如 `entity.name === 'Player'`）
- 或通过组件识别（如有 `InventoryComponent` 或 `LevelExperienceComponent` 的实体）
- 存档文件中只包含玩家实体的数据

**优点：**
- 简化实现，减少复杂性
- 存档文件较小
- 符合肉鸽游戏常见需求（只保存玩家进度）

**未来扩展：**
- 可以添加 `SaveTagComponent` 来标记需要保存的实体
- 可以支持配置需要保存的实体类型列表
- 可以扩展为支持多个实体类型（玩家、宠物、建筑等）

---

## 实施指南

### 1. SaveSystem 接口设计

```typescript
/**
 * 存档系统
 * 
 * ⚠️ 架构约束：
 * - 存档只包含可推导的纯数据，不包含任何运行时状态
 * - 读档通过重建 World 实现，而非修补现有状态
 * - EntityId 不作为稳定标识（读档时重新生成）
 * - 存档版本严格校验，不做隐式兼容
 * - 当前阶段仅支持玩家实体存档
 * 
 * 设计决策：混合方案（白名单 + 自定义序列化器）
 * 参考文档：memory-bank/creative/creative-save-system.md
 */
@system({ priority: 99 })  // 最后执行
export class SaveSystem extends System {
    private configLoader?: ConfigLoader;
    private currentVersion: string = '1.0.0';  // 当前存档版本
    
    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }
    
    /**
     * 保存游戏状态（只保存玩家实体）
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否成功保存
     */
    saveGame(slotIndex: number): boolean;
    
    /**
     * 读取游戏状态（重建 World）
     * ⚠️ 注意：读档时会创建新的 World，而不是修补现有状态
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 新的 World 实例，如果读档失败返回 null
     */
    loadGame(slotIndex: number): World | null;
    
    /**
     * 删除存档
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否成功删除
     */
    deleteSave(slotIndex: number): boolean;
    
    /**
     * 检查存档是否存在
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否存在
     */
    hasSave(slotIndex: number): boolean;
    
    /**
     * 获取存档信息（用于显示存档列表）
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 存档信息，如果不存在返回 null
     */
    getSaveInfo(slotIndex: number): SaveInfo | null;
    
    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有操作通过外部调用触发
    }
}
```

**重要约束：**
- `loadGame` 返回新的 `World` 实例，而不是修改现有 World
- `saveGame` 是同步方法（使用 localStorage 同步操作）
- `loadGame` 是同步方法（如果使用异步存储，需要调整接口）

### 2. 序列化策略配置

```typescript
// 组件白名单配置
const SAVABLE_COMPONENTS = new Set([
    'Transform',
    'HP',
    'Stats',
    'LevelExperience',
    'Inventory',
    'Equipment',
    'BuffList',
    'SkillSlots',
    'Faction',
    'Collider',
    'ViewLink',        // 部分序列化
    'AnimState',       // 部分序列化
]);

// 不序列化的组件
const TEMPORARY_COMPONENTS = new Set([
    'DeadTag',
    'NeedViewTag',
    'DestroyTimer',
    'AnimationIntent',
    'FxIntent',
    'AudioIntent',
]);

// 需要自定义序列化器的组件
const CUSTOM_SERIALIZER_COMPONENTS = new Set([
    'Inventory',
    'Equipment',
    'BuffList',
    'SkillSlots',
]);
```

### 3. 自定义序列化器接口和示例

```typescript
/**
 * 组件序列化器接口
 */
interface ComponentSerializer {
    /**
     * 序列化组件（只保存纯数据，过滤配置引用和运行时状态）
     */
    serialize(component: Component): any;
    
    /**
     * 反序列化组件（重建组件，从 ConfigLoader 加载配置引用）
     * @param entity 目标实体
     * @param data 序列化数据
     * @param configLoader 配置加载器（用于加载配置引用）
     */
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void;
}
```

**InventoryComponent 序列化器示例：**

```typescript
class InventoryComponentSerializer implements ComponentSerializer {
    serialize(component: InventoryComponent): any {
        return {
            slots: component.slots.map(slot => {
                if (!slot) return null;
                // 只保存纯数据：itemId、count、slotIndex
                // ❌ 不保存 config（配置引用）
                return {
                    itemId: slot.itemId,
                    count: slot.count,
                    slotIndex: slot.slotIndex,
                };
            }),
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const inventory = entity.addComponent(InventoryComponent);
        
        inventory.slots = data.slots.map((slotData: any, index: number) => {
            if (!slotData) return null;
            
            // 从 ConfigLoader 重新加载配置（配置引用重建）
            const config = configLoader.getItemConfig(slotData.itemId);
            if (!config) {
                console.warn(`[SaveSystem] Item config not found: ${slotData.itemId}`);
                return null;
            }
            
            // 重建 InventoryItem（包含配置引用）
            return {
                itemId: slotData.itemId,
                config: config,              // 从 ConfigLoader 重新加载
                count: slotData.count,
                slotIndex: index,
            };
        });
    }
}
```

**EquipmentComponent 序列化器示例：**

```typescript
class EquipmentComponentSerializer implements ComponentSerializer {
    serialize(component: EquipmentComponent): any {
        const slots: Record<string, any> = {};
        
        for (const [slotType, equipmentData] of Object.entries(component.slots)) {
            if (!equipmentData) {
                slots[slotType] = null;
            } else {
                // 只保存纯数据：equipmentId、level、durability
                // ❌ 不保存 config（配置引用）
                slots[slotType] = {
                    equipmentId: equipmentData.equipmentId,
                    level: equipmentData.level,
                    durability: equipmentData.durability,
                };
            }
        }
        
        return { slots };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const equipment = entity.addComponent(EquipmentComponent);
        
        for (const [slotType, equipmentData] of Object.entries(data.slots)) {
            if (!equipmentData) {
                equipment.slots[slotType as EquipmentSlotType] = null;
            } else {
                // 从 ConfigLoader 重新加载配置
                const config = configLoader.getEquipmentConfig(equipmentData.equipmentId);
                if (!config) {
                    console.warn(`[SaveSystem] Equipment config not found: ${equipmentData.equipmentId}`);
                    equipment.slots[slotType as EquipmentSlotType] = null;
                } else {
                    // 重建 EquipmentData（包含配置引用）
                    equipment.slots[slotType as EquipmentSlotType] = {
                        equipmentId: equipmentData.equipmentId,
                        config: config,              // 从 ConfigLoader 重新加载
                        level: equipmentData.level || 1,
                        durability: equipmentData.durability,
                    };
                }
            }
        }
    }
}
```

**ViewLinkComponent 序列化器示例（部分序列化）：**

```typescript
class ViewLinkComponentSerializer implements ComponentSerializer {
    serialize(component: ViewLinkComponent): any {
        // ✅ 只保存 prefabKey（用于重建 View）
        // ❌ 不保存 viewId（运行时状态，读档时重新生成）
        return {
            prefabKey: component.prefabKey,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const viewLink = entity.addComponent(ViewLinkComponent);
        viewLink.prefabKey = data.prefabKey;
        // viewId 不设置，由 ViewManager 在重建 View 时生成
    }
}
```

**AnimStateComponent 序列化器示例（部分序列化）：**

```typescript
class AnimStateComponentSerializer implements ComponentSerializer {
    serialize(component: AnimStateComponent): any {
        // ✅ 只保存纯数据状态：current、locked、speed
        // ❌ 不保存 lastSentAnim（运行时优化数据，读档时重置）
        return {
            current: component.current,
            locked: component.locked,
            speed: component.speed,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const animState = entity.addComponent(AnimStateComponent);
        animState.current = data.current || 'idle';
        animState.locked = data.locked || false;
        animState.speed = data.speed || 1.0;
        // lastSentAnim 不设置，使用 reset() 的默认值 ''
    }
}
```

### 4. 实体过滤策略

```typescript
/**
 * 判断实体是否需要保存
 * 当前阶段：只保存玩家实体
 */
function shouldSaveEntity(entity: Entity): boolean {
    // 方案 1：根据实体名称（如 "Player"）
    if (entity.name === 'Player') return true;
    
    // 方案 2：根据组件（如有 InventoryComponent 或 LevelExperienceComponent 的实体）
    // 玩家通常有这些组件
    if (entity.getComponent(InventoryComponent)) return true;
    if (entity.getComponent(LevelExperienceComponent)) return true;
    
    // 方案 3：根据多个组件组合判断（更精确）
    // 玩家通常同时有 StatsComponent 和 LevelExperienceComponent
    if (entity.getComponent(StatsComponent) && entity.getComponent(LevelExperienceComponent)) {
        return true;
    }
    
    return false;
}
```

**当前实现建议：** 使用方案 3（组合判断），更精确地识别玩家实体

**未来扩展：** 可以添加 `SaveTagComponent` 来显式标记需要保存的实体

### 5. 存储抽象层

```typescript
/**
 * 存储适配器接口
 */
interface StorageAdapter {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
    hasItem(key: string): boolean;
}

/**
 * localStorage 适配器（Web 平台）
 */
class LocalStorageAdapter implements StorageAdapter {
    setItem(key: string, value: string): void {
        sys.localStorage.setItem(key, value);
    }
    
    getItem(key: string): string | null {
        return sys.localStorage.getItem(key);
    }
    
    removeItem(key: string): void {
        sys.localStorage.removeItem(key);
    }
    
    hasItem(key: string): boolean {
        return sys.localStorage.getItem(key) !== null;
    }
}

/**
 * 存档键名格式：save_{slotIndex}
 * 例如：save_0, save_1, ..., save_9
 */
function getSaveKey(slotIndex: number): string {
    if (slotIndex < 0 || slotIndex > 9) {
        throw new Error(`Invalid slot index: ${slotIndex}. Must be between 0 and 9.`);
    }
    return `save_${slotIndex}`;
}
```

**当前实现建议：** 直接使用 `sys.localStorage`，不需要抽象层（简化实现）

**未来扩展：** 如果需要支持多平台（Native），可以添加抽象层

---

## 验收标准

- [ ] SaveSystem 可以正确序列化玩家实体的所有持久化组件（纯数据）
- [ ] 存档只包含可推导的纯数据，不包含任何运行时状态
- [ ] 存档文件格式正确（JSON，支持可选压缩）
- [ ] 读档时通过重建 World 实现，而非修补现有状态
- [ ] EntityId 不作为稳定标识（读档时重新生成）
- [ ] 存档版本严格校验（版本不匹配直接失败，不做隐式兼容）
- [ ] 配置引用正确恢复（从 ConfigLoader 重新加载）
- [ ] ViewLink 的 viewId 正确重建（通过 prefabKey 重新生成，viewId 不序列化）
- [ ] 运行时状态正确重置（Intent 组件、Tag 组件、Timer 组件不序列化）
- [ ] 存档文件大小合理（支持可选压缩，默认开启）
- [ ] 支持多个存档槽位（0-9）
- [ ] 当前阶段仅支持玩家实体存档
- [ ] 单元测试覆盖所有功能（包括版本校验、配置引用恢复、World 重建等）

---

## 后续优化（可选）

如果后续需要更复杂的功能，可以考虑：
1. 支持存档版本升级（Migration）
2. 支持增量存档（只保存变更的数据）
3. 支持存档加密（防止修改）
4. 支持存档校验（CRC 或 Hash）
5. 支持存档压缩率配置
6. 支持存档预览（缩略图、描述等）
7. 支持云存档同步

但对于肉鸽游戏，基础实现已经足够。

---

## 🎨🎨🎨 EXITING CREATIVE PHASE

**选定方案：** 方案 4（混合方案：白名单 + 自定义序列化器）✅

**核心约束总结（严格执行）：**
1. ✅ **存档只包含可推导的纯数据，不包含任何运行时状态**
   - 纯数据：位置、生命值、属性、等级、经验、背包物品ID和数量、装备ID和等级等
   - 运行时状态：viewId、lastSentAnim、Intent组件、Tag组件、Timer组件、Velocity等
   
2. ✅ **读档通过重建 World 实现，而非修补现有状态**
   - `loadGame(slotIndex: number): World | null` 返回新的 World 实例
   - 不修改现有 World 的状态
   - GameApp 负责替换：`this.world = saveSystem.loadGame(slotIndex)`
   
3. ✅ **EntityId 不作为稳定标识**
   - 存档数据中不包含 EntityId（或包含但不作为标识）
   - 读档时通过 `world.createEntity(name)` 重新生成 EntityId
   - 实体关系通过组件关联、实体名称等方式维护
   
4. ✅ **存档版本严格校验，不做隐式兼容**
   - 版本不匹配时直接抛出错误：`SaveSystemError: Version mismatch. Save version: X, Current version: Y`
   - 不进行版本转换、兼容性处理或隐式升级
   - 当前版本：`"1.0.0"`
   
5. ✅ **当前阶段仅支持玩家实体存档**
   - 只序列化玩家实体（通过实体名称或组件识别）
   - 存档数据中 `entities` 数组只包含玩家实体
   - 简化实现，减少复杂性

**核心设计决策：**
1. ✅ 使用组件白名单控制序列化范围
2. ✅ 复杂组件（Inventory、Equipment）使用自定义序列化器
3. ✅ **存档只包含可推导的纯数据，不包含任何运行时状态**
4. ✅ **读档通过重建 World 实现，而非修补现有状态**
5. ✅ **EntityId 不作为稳定标识（读档时重新生成）**
6. ✅ **存档版本严格校验（版本不匹配直接失败，不做隐式兼容）**
7. ✅ **当前阶段仅支持玩家实体存档**
8. ✅ 使用 localStorage 存储（Web 平台）
9. ✅ 支持可选压缩（默认开启）

**实施指南：**
- SaveSystem 是被动系统（不主动查询，只处理外部调用）
- `loadGame` 返回新的 `World` 实例，由 GameApp 负责替换
- 所有系统需要在读档后重新注册到新 World
- ViewManager 需要在读档后重置并重建 View（通过 prefabKey）

**下一步：** 实施阶段（/build 命令）
